// /en/privacy-policy-generator/ and /he/privacy-policy/ client logic. Progressive enhancement: without JS the page
// lists what a policy covers. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/privacy-policy.ts with the types removed (made with the TypeScript
// compiler). tests/privacy-policy-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="pp-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to privacy-policy.ts) ----------
  /** Fills {name} placeholders; a [bracketed] part is dropped when any placeholder inside it is empty. */
  function fill(tpl, vars) {
      const val = (k) => (vars[k] ?? "").trim();
      return tpl
          .replace(/\[([^[\]]*)\]/g, (_, inner) => ([...inner.matchAll(/\{(\w+)\}/g)].some((m) => !val(m[1])) ? "" : inner))
          .replace(/\{(\w+)\}/g, (_, k) => val(k))
          .replace(/ {2,}/g, " ")
          .replace(/ ([,.])/g, "$1")
          .trim();
  }
  const USE_ORDER = ["contact", "booking", "payments", "account", "newsletter", "analytics", "ads"];
  function build(i, t) {
      const v = {
          business: i.business, website: i.website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""), email: i.email, address: i.address,
          date: i.date, payment: i.payment, analytics: i.analytics, ads: i.ads, providers: i.providers,
      };
      const clean = (a) => a.map((p) => fill(p, v)).filter(Boolean);
      const S = (h, paras, bullets = [], after = []) => ({ h, paras: clean(paras), bullets: clean(bullets), after: clean(after) });
      const u = i.uses;
      const out = [];
      out.push(S("", [t.intro]));
      out.push(S(t.who.h, [t.who.p]));
      const used = USE_ORDER.filter((k) => u[k]);
      out.push(S(t.collect.h, [t.collect.p], used.map((k) => t.collect[k]), [t.required || ""]));
      if (t.legal)
          out.push(S(t.legal.h, [t.legal.p]));
      out.push(S(t.share.h, [t.share.p, i.providers.trim() ? t.share.providers : "", t.share.law, t.transfers || ""]));
      if (u.analytics || u.ads)
          out.push(S(t.cookies.h, [t.cookies.p, u.analytics ? t.cookies.analytics : "", u.ads ? t.cookies.ads : "", t.cookies.control]));
      out.push(S(t.retention.h, [t.retention[i.retention] || t.retention.needed]));
      out.push(S(t.security.h, [t.security.p]));
      out.push(S(t.rights.h, [t.rights.p], t.rights.list || [], [u.newsletter && t.marketing ? t.marketing : "", t.rights.how, t.rights.complain || "", i.children ? t.children : ""]));
      out.push(S(t.changes.h, [t.changes.p]));
      return { title: fill(t.title, v), updated: fill(t.updated, v), sections: out.filter((s) => s.paras.length || s.bullets.length || s.after.length) };
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function asText(d) {
      const parts = [d.title, d.updated];
      for (const s of d.sections)
          parts.push([s.h, ...s.paras, ...s.bullets.map((b) => "• " + b), ...s.after].filter(Boolean).join("\n"));
      return parts.join("\n\n");
  }
  function asHtml(d) {
      const body = d.sections.map((s) => [s.h ? `<h2>${esc(s.h)}</h2>` : "", ...s.paras.map((p) => `<p>${esc(p)}</p>`), s.bullets.length ? `<ul>\n${s.bullets.map((b) => `  <li>${esc(b)}</li>`).join("\n")}\n</ul>` : "", ...s.after.map((p) => `<p>${esc(p)}</p>`)].filter(Boolean).join("\n"));
      return [`<h1>${esc(d.title)}</h1>`, `<p><em>${esc(d.updated)}</em></p>`, ...body].join("\n");
  }
  /** cookieBanner: whether to remind about asking consent for non-essential cookies (UK/EU and Israel). */
  function checks(i, cookieBanner) {
      const c = [];
      c.push(i.business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      c.push(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim()) ? { level: "ok", id: "email_ok" } : { level: "bad", id: "email_missing" });
      if (!i.website.trim())
          c.push({ level: "warn", id: "website_missing" });
      const any = USE_ORDER.some((k) => i.uses[k]);
      c.push(any ? { level: "ok", id: "uses_ok" } : { level: "warn", id: "uses_none" });
      if (i.uses.payments && !i.payment.trim())
          c.push({ level: "warn", id: "payment_missing" });
      if (i.uses.analytics && !i.analytics.trim())
          c.push({ level: "warn", id: "analytics_missing" });
      if ((i.uses.analytics || i.uses.ads) && cookieBanner)
          c.push({ level: "warn", id: "cookie_banner" });
      c.push({ level: "warn", id: "not_advice" });
      return c;
  }

  const API = { fill, build, asText, asHtml, checks };
  root.PrivacyPolicy = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pp-app");
  const dataEl = document.getElementById("pp-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const KEYS = ["contact", "booking", "payments", "account", "newsletter", "analytics", "ads"];

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
    control.id = control.id || "pp-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const text = (f) => { const c = el("input"); c.type = "text"; c.dir = f.ltr ? "ltr" : "auto"; if (f.placeholder) c.placeholder = f.placeholder; if (f.max) c.maxLength = f.max; return c; };
  const select = (o) => { const s = el("select"); o.options.forEach(([v, l]) => { const x = el("option", null, l); x.value = v; s.append(x); }); return s; };
  const todayText = () => { try { return new Date().toLocaleDateString(UI.dateLocale, { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date().toISOString().slice(0, 10); } };

  // Form.
  const region = select(UI.region);
  const business = text(UI.business), website = text(UI.website), email = text(UI.email), address = text(UI.address);
  email.type = "email"; email.autocomplete = "email"; website.type = "url";
  const fs = el("fieldset", "pp-uses");
  fs.append(el("legend", null, UI.usesTitle));
  const uses = {};
  const subs = {};
  const sub = (k, f) => { const c = text(f); const w = wrapField(f.label, c); w.classList.add("pp-sub"); subs[k] = { w, c }; return w; };
  for (const k of KEYS) {
    const lab = el("label", "pp-opt");
    const cb = el("input"); cb.type = "checkbox"; cb.value = k;
    lab.append(cb, document.createTextNode(UI.uses[k]));
    uses[k] = cb;
    fs.append(lab);
    if (k === "payments") fs.append(sub("payments", UI.payment));
    if (k === "analytics") fs.append(sub("analytics", UI.analytics));
    if (k === "ads") fs.append(sub("ads", UI.ads));
  }
  const providers = text(UI.providers);
  const retention = select(UI.retention);
  const childLab = el("label", "pp-opt");
  const children = el("input"); children.type = "checkbox";
  childLab.append(children, document.createTextNode(UI.children));
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const regionField = wrapField(UI.region.label, region);
  if (UI.region.options.length < 2) regionField.hidden = true;
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, regionField, wrapField(UI.business.label, business), wrapField(UI.website.label, website), wrapField(UI.email.label, email),
    wrapField(UI.address.label, address), fs, wrapField(UI.providers.label, providers, UI.providers.hint), wrapField(UI.retention.label, retention), childLab, checksH, checkList);

  // Preview.
  const doc = el("div", "pp-doc");
  doc.tabIndex = 0;
  doc.setAttribute("role", "region");
  doc.setAttribute("aria-label", UI.previewTitle);
  doc.dir = DATA.rtl ? "rtl" : "ltr";
  const cpText = button("try-btn try-btn-primary pp-btn", UI.copyText);
  const cpHtml = button("try-btn pp-btn", UI.copyHtml);
  const acts = el("div", "pp-acts"); acts.append(cpText, cpHtml);
  const card = el("section", "gp-card");
  card.append(el("h2", "gp-h", UI.previewTitle), doc, acts, el("p", "pp-note", UI.disclaimer));
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const value = () => {
    const u = {};
    for (const k of KEYS) u[k] = uses[k].checked;
    return { business: business.value, website: website.value, email: email.value, address: address.value, date: todayText(), uses: u,
      payment: subs.payments.c.value, analytics: subs.analytics.c.value, ads: subs.ads.c.value, providers: providers.value, retention: retention.value, children: children.checked };
  };
  let current = null;
  let prevHeads = null, prevUsed = null;
  function render() {
    for (const k in subs) subs[k].w.hidden = !uses[k].checked;
    const v = value();
    const t = UI.policies[region.value];
    const d = API.build(v, t);
    current = d;
    const used = KEYS.filter((k) => v.uses[k]);
    const heads = d.sections.map((s) => s.h);
    doc.textContent = "";
    doc.append(el("h3", null, d.title), el("p", "pp-upd", d.updated));
    for (const s of d.sections) {
      if (s.h) { const h = el("h4", null, s.h); if (prevHeads && !prevHeads.includes(s.h)) h.className = "pp-new"; doc.append(h); }
      for (const p of s.paras) doc.append(el("p", null, p));
      if (s.bullets.length) {
        const ul = el("ul");
        s.bullets.forEach((b, i) => {
          const li = el("li", null, b);
          if (s.h === t.collect.h && prevUsed && !prevUsed.includes(used[i])) li.className = "pp-new";
          ul.append(li);
        });
        doc.append(ul);
      }
      for (const p of s.after) doc.append(el("p", null, p));
    }
    prevHeads = heads; prevUsed = used;
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(v, !!UI.cookieBanner[region.value]).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx); checkList.append(li);
    });
  }
  function copy(btn, label, s) {
    const done = () => { btn.dataset.done = "1"; btn.textContent = "✓ " + UI.copied; setTimeout(() => { btn.dataset.done = ""; btn.textContent = label; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(done, () => {});
  }
  cpText.addEventListener("click", () => current && copy(cpText, UI.copyText, API.asText(current)));
  cpHtml.addEventListener("click", () => current && copy(cpHtml, UI.copyHtml, API.asHtml(current)));
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  function reset() {
    region.value = UI.region.options[0][0]; business.value = ""; website.value = ""; email.value = ""; address.value = ""; providers.value = "";
    for (const k of KEYS) uses[k].checked = k === "contact";
    for (const k in subs) subs[k].c.value = "";
    retention.value = "needed"; children.checked = true;
  }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    reset();
    region.value = e.region; business.value = e.business; website.value = e.website; email.value = e.email; address.value = e.address; providers.value = e.providers;
    for (const k of KEYS) uses[k].checked = !!e.uses[k];
    subs.payments.c.value = e.payment; subs.analytics.c.value = e.analytics; subs.ads.c.value = e.ads;
    retention.value = e.retention;
    render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); prevHeads = null; render(); business.focus(); });
  reset();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
