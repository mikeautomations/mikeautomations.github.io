// /en/receipt-generator/ and /he/payment-confirmation/ client logic. Progressive enhancement: without JS the page
// explains the tool. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/receipt.ts with the types removed (made with the TypeScript
// compiler). tests/receipt-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="rc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to receipt.ts) ----------
  const cents = (n) => Math.round((Number(n) || 0) * 100);
  /** Subtotal, tax and total in pennies. Inclusive: the prices already contain the tax, which is worked out of them. */
  function totals(lines, mode, rate) {
      const sum = lines.reduce((s, l) => s + Math.round((Number(l.qty) || 0) * cents(l.price)), 0);
      const r = mode === "none" ? 0 : Math.max(0, Number(rate) || 0) / 100;
      if (mode === "inclusive") {
          const tax = Math.round(sum - sum / (1 + r));
          return { subtotal: sum - tax, tax, total: sum };
      }
      const tax = Math.round(sum * r);
      return { subtotal: sum, tax, total: sum + tax };
  }
  /** Pennies as money text: 1234 -> "12.34" with thousands separators, then the currency pattern ("{c}{n}" or "{n} {c}"). */
  function money(p, currency, pattern) {
      const neg = p < 0;
      const a = Math.abs(Math.round(p));
      const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const n = (neg ? "-" : "") + whole + "." + String(a % 100).padStart(2, "0");
      return pattern.replace("{c}", currency).replace("{n}", n);
  }
  /** The next receipt number, keeping any prefix and leading zeros: R-0041 -> R-0042, 2026/9 -> 2026/10. */
  function nextNumber(n) {
      const m = /^(.*?)(\d+)(\D*)$/.exec((n || "").trim());
      if (!m)
          return (n || "").trim() ? n.trim() + "-2" : "1";
      const next = String(Number(m[2]) + 1).padStart(m[2].length, "0");
      return m[1] + next + m[3];
  }
  /** The receipt as plain text, for an email or a message. fmt turns pennies into money text. */
  function asText(r, l, fmt) {
      const t = totals(r.lines, r.mode, r.rate);
      const out = [r.business.trim(), ...r.details.split("\n").map((s) => s.trim()).filter(Boolean), "", `${l.receipt} ${r.number}`.trim(), `${l.date}: ${r.date}`];
      if (r.customer.trim())
          out.push(`${l.to}: ${r.customer.trim()}`);
      out.push("");
      for (const x of r.lines.filter((x) => x.desc.trim() || x.price))
          out.push(`${(Number(x.qty) || 0) !== 1 ? x.qty + " x " : ""}${x.desc.trim()}  ${fmt(Math.round((Number(x.qty) || 0) * cents(x.price)))}`);
      out.push("");
      if (r.mode === "exclusive")
          out.push(`${l.subtotal}: ${fmt(t.subtotal)}`, `${r.taxName} ${r.rate}%: ${fmt(t.tax)}`);
      out.push(`${l.total}: ${fmt(t.total)}`);
      if (r.mode === "inclusive")
          out.push(l.includes.replace("{tax}", `${r.taxName} ${r.rate}%`).replace("{amount}", fmt(t.tax)));
      out.push(`${l.paid}${r.method.trim() ? " (" + r.method.trim() + ")" : ""}: ${fmt(cents(r.paid))}`);
      const bal = t.total - cents(r.paid);
      if (bal > 0)
          out.push(`${l.balance}: ${fmt(bal)}`);
      if (r.note.trim())
          out.push("", r.note.trim());
      return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function checks(r) {
      const c = [];
      const t = totals(r.lines, r.mode, r.rate);
      c.push(r.business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      c.push(t.total > 0 ? { level: "ok", id: "items_ok" } : { level: "bad", id: "items_missing" });
      c.push(r.number.trim() ? { level: "ok", id: "number_ok" } : { level: "warn", id: "number_missing" });
      const paid = cents(r.paid);
      if (t.total > 0 && paid > t.total)
          c.push({ level: "warn", id: "overpaid" });
      else if (t.total > 0 && paid === t.total)
          c.push({ level: "ok", id: "paid_full" });
      else if (t.total > 0 && paid > 0)
          c.push({ level: "ok", id: "paid_part" });
      else if (t.total > 0)
          c.push({ level: "warn", id: "paid_none" });
      return c;
  }

  const API = { totals, money, nextNumber, asText, checks };
  root.Receipt = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("rc-app");
  const dataEl = document.getElementById("rc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const L = UI.labels;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  function wrapField(label, control, hint) {
    const w = el("div", "ft-field gp-field");
    const lab = el("label", null, label);
    control.id = control.id || "rc-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const text = (f) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (f.placeholder) c.placeholder = f.placeholder; if (f.max) c.maxLength = f.max; return c; };
  const num = (ph) => { const c = el("input"); c.type = "number"; c.min = "0"; c.step = "any"; c.inputMode = "decimal"; c.dir = "ltr"; if (ph != null) c.placeholder = ph; return c; };
  const select = (opts) => { const s = el("select"); opts.forEach((o) => { const v = Array.isArray(o) ? o : [o, o]; const x = el("option", null, v[1]); x.value = v[0]; s.append(x); }); return s; };
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const fmt = (p) => API.money(p, currency.value, UI.money);
  const showDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); try { return new Date(y, m - 1, d).toLocaleDateString(UI.dateLocale, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } };

  // Form.
  const style = select(UI.style.options);
  const business = text(UI.business);
  const details = el("textarea"); details.rows = 3; details.dir = "auto"; details.placeholder = UI.details.placeholder; details.maxLength = UI.details.max;
  const number = text(UI.number); number.dir = "ltr";
  const date = el("input"); date.type = "date"; date.dir = "ltr";
  const customer = text(UI.customer);
  const linesBox = el("div", "rc-lines");
  let lines = [];
  const addBtn = button("try-btn gp-ghost rc-add", UI.addLine);
  const tax = select(UI.tax.options);
  const rate = num(""); rate.value = String(UI.defaultRate);
  const currency = select(UI.currency.options);
  const method = select(UI.method.options);
  const paid = num("");
  let paidAuto = true;
  const note = text(UI.note);

  function drawLines() {
    linesBox.textContent = "";
    lines.forEach((l, i) => {
      const row = el("div", "rc-line");
      const d = text({ placeholder: "", max: 80 }); d.value = l.desc;
      const q = num(""); q.value = String(l.qty); q.step = "1";
      const p = num(""); p.value = l.price === "" ? "" : String(l.price);
      d.setAttribute("aria-label", UI.desc + " " + (i + 1)); q.setAttribute("aria-label", UI.qty + " " + (i + 1)); p.setAttribute("aria-label", UI.price + " " + (i + 1));
      d.addEventListener("input", () => { l.desc = d.value; render(); });
      q.addEventListener("input", () => { l.qty = Number(q.value) || 0; render(); });
      p.addEventListener("input", () => { l.price = p.value === "" ? "" : Number(p.value) || 0; render(); });
      const x = button("try-btn gp-ghost rc-x", "✕");
      x.setAttribute("aria-label", UI.removeLine.replace("{n}", String(i + 1)));
      x.disabled = lines.length === 1;
      x.addEventListener("click", () => { lines.splice(i, 1); drawLines(); render(); });
      const head = (t, c) => { const w = el("div", "ft-field gp-field"); if (i === 0) { const s = el("span", "rc-small", t); s.setAttribute("aria-hidden", "true"); w.append(s); } w.append(c); return w; };
      row.append(head(UI.desc, d), head(UI.qty, q), head(UI.price, p), x);
      linesBox.append(row);
    });
    addBtn.hidden = lines.length >= 20;
  }
  addBtn.addEventListener("click", () => { lines.push({ desc: "", qty: 1, price: "" }); drawLines(); render(); const ins = linesBox.querySelectorAll("input[type=text]"); ins[ins.length - 1].focus(); });

  const rowA = el("div", "rc-row"); rowA.append(wrapField(UI.number.label, number), wrapField(UI.date.label, date));
  const rateField = wrapField(UI.rate, rate);
  const curField = wrapField(UI.currency.label, currency);
  const rowT = el("div", "rc-row3"); rowT.append(wrapField(UI.tax.label, tax), rateField, curField);
  if (UI.currency.options.length < 2) { curField.hidden = true; rowT.style.gridTemplateColumns = "minmax(0, 1.4fr) minmax(0, 1fr)"; }
  const rowP = el("div", "rc-row"); rowP.append(wrapField(UI.method.label, method), wrapField(UI.paid.label, paid, UI.paid.hint));
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const itemsH = el("h3", "gp-h", UI.items); itemsH.style.marginTop = "0.6rem";
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.style.label, style), wrapField(UI.business.label, business), wrapField(UI.details.label, details, UI.details.hint), rowA,
    wrapField(UI.customer.label, customer), itemsH, linesBox, addBtn, rowT, rowP, wrapField(UI.note.label, note), checksH, checkList);

  // Preview: one paper, updated in place.
  const paper = el("div", "rc-paper");
  paper.setAttribute("aria-live", "polite");
  const head = el("div", "rc-head");
  const bizBox = el("div");
  const biz = el("p", "rc-biz"), det = el("p", "rc-det");
  bizBox.append(biz, det);
  const title = el("p", "rc-title", L.receipt);
  head.append(bizBox, title);
  const meta = el("div", "rc-meta");
  const table = el("table", "rc-table");
  const tbody = el("tbody"); table.append(tbody);
  const noteP = el("p", "rc-note");
  const stamp = el("div", "rc-stamp", UI.stamp);
  stamp.setAttribute("aria-hidden", "true");
  stamp.hidden = true;
  paper.append(head, meta, table, noteP, stamp);
  const stage = el("div", "rc-stage"); stage.append(paper);
  const pdf = button("try-btn try-btn-primary rc-btn", UI.pdf);
  const copy = button("try-btn rc-btn", UI.copy);
  const next = button("try-btn gp-ghost rc-btn", UI.next);
  const acts = el("div", "rc-acts"); acts.append(pdf, copy, next);
  const status = el("p", "gp-status"); status.setAttribute("role", "status");
  const prev = el("section", "gp-card");
  prev.append(el("h2", "gp-h", UI.previewTitle), stage, acts, el("p", "gp-hint", UI.pdfHint), status);
  const side = el("div", "gp-side"); side.append(prev);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const value = () => ({
    business: business.value, details: details.value, number: number.value, date: showDate(date.value), customer: customer.value,
    lines: lines.map((l) => ({ desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })), mode: tax.value, rate: Number(rate.value) || 0,
    taxName: UI.taxName, method: method.value, paid: Number(paid.value) || 0, note: note.value,
  });
  const tr = (a, b, cls) => { const r = el("tr", cls); const x = el("td"); const y = el("td", null, b); if (typeof a === "string") x.textContent = a; else x.append(a); r.append(x, y); tbody.append(r); return r; };
  let lastStamp = "";
  function render() {
    rateField.hidden = tax.value === "none";
    const r0 = value();
    const t = API.totals(r0.lines, r0.mode, r0.rate);
    if (paidAuto) paid.value = t.total ? (t.total / 100).toFixed(2) : "";
    const r = value();
    paper.dataset.style = style.value;
    biz.textContent = r.business.trim() || UI.business.placeholder.replace(/^.*?: |^e\.g\. /, "");
    det.textContent = r.details.trim();
    meta.textContent = "";
    for (const s of [r.number.trim() ? L.number + " " + r.number.trim() : "", r.date ? L.date + ": " + r.date : "", r.customer.trim() ? L.to + ": " + r.customer.trim() : ""]) if (s) meta.append(el("span", null, s));
    tbody.textContent = "";
    r.lines.filter((l) => l.desc.trim() || l.price).forEach((l) => {
      const d = el("span");
      if (l.qty !== 1) d.append(el("span", "rc-q", l.qty + " × "));
      d.append(document.createTextNode(l.desc.trim() || "—"));
      tr(d, fmt(Math.round(l.qty * Math.round(l.price * 100))));
    });
    let first = true;
    const sep = () => { const c = first ? "rc-sep" : ""; first = false; return c; };
    if (r.mode === "exclusive") { tr(L.subtotal, fmt(t.subtotal), sep()); tr(UI.taxName + " " + r.rate + "%", fmt(t.tax)); }
    tr(L.total, fmt(t.total), sep() + " rc-total");
    if (r.mode === "inclusive") { const x = tr(L.includes.replace("{tax}", UI.taxName + " " + r.rate + "%").replace("{amount}", fmt(t.tax)), ""); x.className = "rc-small"; }
    const paidP = Math.round(r.paid * 100);
    tr(L.paid + (r.method ? " (" + r.method + ")" : ""), fmt(paidP), "rc-sep");
    if (t.total - paidP > 0 && paidP > 0) tr(L.balance, fmt(t.total - paidP));
    noteP.textContent = r.note.trim();
    noteP.hidden = !r.note.trim();
    const s = t.total > 0 && paidP >= t.total ? "full" : t.total > 0 && paidP > 0 ? "part" : "";
    if (s !== lastStamp) { stamp.hidden = !s; stamp.textContent = s === "part" ? UI.stampPart : UI.stamp; stamp.dataset.part = s === "part" ? "1" : ""; lastStamp = s; }
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(r).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx); checkList.append(li);
    });
  }
  paid.addEventListener("input", () => { paidAuto = paid.value === ""; });
  form.addEventListener("input", (e) => { if (!e.target.closest || !e.target.closest(".rc-line")) render(); });
  form.addEventListener("change", render);
  pdf.addEventListener("click", () => {
    render();
    const old = document.title;
    document.title = UI.file.replace("{n}", number.value.trim()).trim();
    let page = null;
    if (style.value === "slip") { page = el("style"); page.textContent = "@page { size: 80mm auto; margin: 4mm; }"; document.head.append(page); }
    const restore = () => { document.title = old; if (page) page.remove(); window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 2000);
  });
  copy.addEventListener("click", () => {
    const t = API.asText(value(), L, fmt);
    const done = () => { copy.dataset.done = "1"; copy.textContent = "✓ " + UI.copied; setTimeout(() => { copy.dataset.done = ""; copy.textContent = UI.copy; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, () => {});
  });
  next.addEventListener("click", () => {
    number.value = API.nextNumber(number.value);
    customer.value = ""; lines = [{ desc: "", qty: 1, price: "" }]; paidAuto = true; date.value = today();
    drawLines(); render();
    status.textContent = UI.nextDone.replace("{n}", number.value);
    customer.focus();
  });
  function reset() {
    style.value = "page"; business.value = ""; details.value = ""; number.value = ""; date.value = today(); customer.value = "";
    lines = [{ desc: "", qty: 1, price: "" }]; tax.value = "none"; rate.value = String(UI.defaultRate); currency.value = UI.defaultCurrency;
    method.selectedIndex = 0; paid.value = ""; paidAuto = true; note.value = UI.defaultNote; status.textContent = "";
  }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    reset();
    business.value = e.business; details.value = e.details; number.value = e.number; customer.value = e.customer; tax.value = e.mode; method.value = e.method; note.value = e.note;
    lines = e.lines.map(([d, q, p]) => ({ desc: d, qty: q, price: p }));
    drawLines(); render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); drawLines(); render(); business.focus(); });
  reset();
  drawLines();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
