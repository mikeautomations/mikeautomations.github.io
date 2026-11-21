// /en/cancellation-policy-generator/ and /he/cancellation-policy/ client logic. Progressive enhancement: without
// JS the page shows an example policy. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/cancel-policy.ts with the types removed (made with the TypeScript
// compiler). tests/cancellation-policy-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="cp-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to cancel-policy.ts) ----------
  /** Fills {name} placeholders; a [bracketed] part is dropped when any placeholder inside it is empty. */
  function fill(tpl, vars) {
      const val = (k) => (vars[k] ?? "").trim();
      return tpl
          .replace(/\[([^[\]]*)\]/g, (_, inner) => ([...inner.matchAll(/\{(\w+)\}/g)].some((m) => !val(m[1])) ? "" : inner))
          .replace(/\{(\w+)\}/g, (_, k) => val(k))
          .replace(/ {2,}/g, " ")
          .trim();
  }
  const num = (n) => (Math.round(n * 100) / 100).toString();
  function fee(f, t, currency) {
      if (f.kind === "none" || !(f.value > 0))
          return "";
      return f.kind === "percent" ? fill(t.percent, { n: num(Math.min(f.value, 100)) }) : fill(t.money, { c: currency, n: num(f.value) });
  }
  function noticeText(hours, t) {
      return t.notice[String(hours)] || fill(t.hours, { n: String(hours) });
  }
  /** The policy as a list of sentences for a website, plus a short version and an SMS line. */
  function build(p, t) {
      const v = {
          business: p.business,
          notice: noticeText(p.notice, t),
          how: p.how,
          lateFee: fee(p.late, t, p.currency),
          noShowFee: fee(p.noShow, t, p.currency),
          deposit: fee(p.deposit, t, p.currency),
          grace: p.grace > 0 ? String(p.grace) : "",
      };
      const lines = [
          fill(t.noticeLine, v),
          fill(v.deposit ? t.freeDeposit : t.freeLine, v),
          fill(v.lateFee ? t.lateFee : t.lateNone, v),
          v.noShowFee ? fill(t.noShowFee, v) : "",
          v.deposit ? fill(t.depositLine, v) : "",
          v.grace ? fill(t.graceLine, v) : "",
          p.exceptions ? fill(t.exceptionsLine, v) : "",
      ].filter(Boolean);
      const fees = [v.lateFee ? fill(t.shortLate, v) : "", v.noShowFee ? fill(t.shortNoShow, v) : ""].filter(Boolean).join(" ");
      return {
          title: fill(t.title, v),
          intro: fill(t.intro, v),
          lines,
          short: fill(t.short, { ...v, fees }),
          sms: fill(t.sms, { ...v, fees }),
      };
  }
  /** Plain text of the website version: title, intro and one line per rule. */
  function asText(b) {
      return [b.title, "", b.intro, "", ...b.lines.map((l) => "• " + l)].join("\n");
  }
  const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** The website version as simple HTML for any site builder. */
  function asHtml(b) {
      return `<h2>${escHtml(b.title)}</h2>\n<p>${escHtml(b.intro)}</p>\n<ul>\n${b.lines.map((l) => `  <li>${escHtml(l)}</li>`).join("\n")}\n</ul>`;
  }
  function checks(p) {
      const c = [];
      c.push(p.business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      c.push(p.how.trim() ? { level: "ok", id: "how_ok" } : { level: "warn", id: "how_missing" });
      c.push(p.notice < 24 ? { level: "warn", id: "notice_short" } : p.notice > 72 ? { level: "warn", id: "notice_long" } : { level: "ok", id: "notice_ok" });
      const charges = (p.late.kind !== "none" && p.late.value > 0) || (p.noShow.kind !== "none" && p.noShow.value > 0);
      const deposit = p.deposit.kind !== "none" && p.deposit.value > 0;
      if (charges && !deposit)
          c.push({ level: "warn", id: "fee_no_deposit" });
      else if (charges)
          c.push({ level: "ok", id: "fees_ok" });
      if (p.late.kind === p.noShow.kind && p.late.kind !== "none" && p.noShow.value < p.late.value)
          c.push({ level: "warn", id: "noshow_lower" });
      if ((p.late.kind === "percent" && p.late.value > 100) || (p.noShow.kind === "percent" && p.noShow.value > 100))
          c.push({ level: "bad", id: "over_100" });
      return c;
  }

  const API = { fill, fee, noticeText, build, asText, asHtml, checks };
  root.CancelPolicy = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("cp-app");
  const dataEl = document.getElementById("cp-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const TX = DATA.texts;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  const nextId = () => "cp-f" + ++uid;
  function wrapField(label, control, hint) {
    const w = el("div", "ft-field gp-field");
    const lab = el("label", null, label);
    control.id = control.id || nextId();
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const text = (f) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (f.placeholder) c.placeholder = f.placeholder; if (f.max) c.maxLength = f.max; return c; };
  const numberIn = (ph) => { const c = el("input"); c.type = "number"; c.min = "0"; c.step = "any"; c.inputMode = "decimal"; c.dir = "ltr"; if (ph) c.placeholder = ph; return c; };
  const select = (options) => { const s = el("select"); options.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; s.append(o); }); return s; };
  function copyText(value, btn, label) {
    const done = () => { btn.dataset.done = "1"; btn.textContent = "✓ " + UI.copied; setTimeout(() => { btn.dataset.done = ""; btn.textContent = label; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value).then(done, () => {});
    else {
      const t = el("textarea"); t.value = value; t.style.position = "fixed"; t.style.opacity = "0"; document.body.append(t); t.select();
      try { if (document.execCommand("copy")) done(); } catch (e) {} t.remove();
    }
  }

  // Form.
  const business = text(UI.business);
  const how = text(UI.how);
  const notice = select(UI.notice.options);
  const currency = select(UI.currency.options);
  const fees = {};
  function feeRow(key, label) {
    const kind = select(UI.kinds);
    const amt = numberIn("");
    const row = el("div", "cp-fee");
    const a = wrapField(UI.amount, amt);
    a.classList.add("cp-amt");
    row.append(wrapField(label, kind), a);
    amt.setAttribute("aria-label", label + ": " + UI.amount);
    fees[key] = { kind, amt, row };
    return row;
  }
  const grace = numberIn(UI.grace.placeholder);
  const exLab = el("label", "cp-opt");
  const exCb = el("input");
  exCb.type = "checkbox";
  exLab.append(exCb, document.createTextNode(UI.exceptions));
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const row1 = el("div", "cp-row");
  const curField = wrapField(UI.currency.label, currency);
  row1.append(wrapField(UI.notice.label, notice), curField);
  if (UI.currency.options.length < 2) { curField.hidden = true; row1.style.gridTemplateColumns = "minmax(0, 1fr)"; }
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle);
  checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.business.label, business), wrapField(UI.how.label, how, UI.how.hint), row1,
    feeRow("deposit", UI.deposit), feeRow("late", UI.late), feeRow("noShow", UI.noShow), wrapField(UI.grace.label, grace), exLab, checksH, checkList);

  // Output, made once and updated in place.
  const empty = el("p", "cp-empty", UI.empty);
  const doc = el("div", "cp-doc");
  const docH = el("h3");
  const docP = el("p");
  const docUl = el("ul");
  doc.append(docH, docP, docUl);
  const copyTextBtn = button("try-btn try-btn-primary cp-btn", UI.copyText);
  const copyHtmlBtn = button("try-btn cp-btn", UI.copyHtml);
  const acts1 = el("div", "cp-acts");
  acts1.append(copyTextBtn, copyHtmlBtn);
  const shortQ = el("p", "cp-quote");
  const shortBtn = button("try-btn cp-btn", UI.copy);
  shortBtn.setAttribute("aria-label", UI.copy + ": " + UI.shortTitle);
  const smsQ = el("p", "cp-quote");
  const smsBtn = button("try-btn cp-btn", UI.copy);
  smsBtn.setAttribute("aria-label", UI.copy + ": " + UI.smsTitle);
  const filled = el("div");
  const sub = (title, hint) => { const d = el("div", "cp-sub"); d.append(el("h3", "gp-h", title)); if (hint) d.append(el("p", "gp-hint", hint)); return d; };
  const s1 = sub(UI.websiteTitle, UI.websiteHint); s1.style.marginTop = "0.6rem"; s1.append(doc, acts1);
  const s2 = sub(UI.shortTitle, UI.shortHint); s2.append(shortQ, shortBtn);
  const s3 = sub(UI.smsTitle, ""); s3.append(smsQ, smsBtn);
  filled.append(s1, s2, s3);
  const outCard = el("section", "gp-card");
  outCard.setAttribute("aria-live", "polite");
  outCard.append(el("h2", "gp-h", UI.outTitle), empty, filled);

  const side = el("div", "gp-side");
  side.append(outCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  const feeOf = (k) => ({ kind: fees[k].kind.value, value: Number(fees[k].amt.value) || 0 });
  const values = () => ({ business: business.value, how: how.value, notice: Number(notice.value), late: feeOf("late"), noShow: feeOf("noShow"), deposit: feeOf("deposit"), grace: Number(grace.value) || 0, exceptions: exCb.checked, currency: currency.value });
  let current = null;
  function render() {
    for (const k in fees) fees[k].row.dataset.kind = fees[k].kind.value;
    const p = values();
    const ready = !!p.business.trim();
    empty.hidden = ready;
    filled.hidden = !ready;
    if (ready) {
      const b = API.build(p, TX);
      current = b;
      docH.textContent = b.title;
      docP.textContent = b.intro;
      docUl.textContent = "";
      b.lines.forEach((l) => docUl.append(el("li", null, l)));
      shortQ.textContent = b.short;
      smsQ.textContent = b.sms;
    }
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(p).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx);
      checkList.append(li);
    });
  }
  copyTextBtn.addEventListener("click", () => current && copyText(API.asText(current), copyTextBtn, UI.copyText));
  copyHtmlBtn.addEventListener("click", () => current && copyText(API.asHtml(current), copyHtmlBtn, UI.copyHtml));
  shortBtn.addEventListener("click", () => copyText(shortQ.textContent, shortBtn, UI.copy));
  smsBtn.addEventListener("click", () => copyText(smsQ.textContent, smsBtn, UI.copy));
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  function reset() {
    business.value = ""; how.value = ""; notice.value = "24"; currency.value = UI.defaultCurrency; grace.value = ""; exCb.checked = true;
    for (const k in fees) { fees[k].kind.value = "none"; fees[k].amt.value = ""; }
  }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    business.value = e.business; how.value = e.how; notice.value = e.notice; grace.value = e.grace; exCb.checked = e.exceptions;
    for (const k of ["late", "noShow", "deposit"]) { fees[k].kind.value = e[k + "Kind"]; fees[k].amt.value = e[k]; }
    render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); render(); business.focus(); });
  reset();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
