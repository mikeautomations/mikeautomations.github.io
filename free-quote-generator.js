// /en/free-quote-generator/ client logic. Progressive enhancement: the page already explains what goes in a quote without JS.
// No dependencies, no network requests, no cookies. Nothing typed here leaves the device. The only storage is localStorage,
// and only when you press "Save business details on this device". The logo is read in the browser and never uploaded.
// PART 1 is a copy of the pure maths in src/app/landing/data/tools/quote-calc.ts with the types removed.
// tests/free-quote-generator.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to quote-calc.ts) ----------
  const CURRENCIES = {
    GBP: { symbol: "£", locale: "en-GB", label: "GBP (£)" },
    USD: { symbol: "$", locale: "en-US", label: "USD ($)" },
    EUR: { symbol: "€", locale: "en-IE", label: "EUR (€)" },
  };
  const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  function toCents(v) { return Math.round(num(v) * 100 + 1e-9 * Math.sign(num(v))); }

  function computeQuote(input) {
    const lines = (input.lines || []).map((l) => {
      const qty = Math.max(0, num(l.qty));
      const unitCents = Math.max(0, toCents(l.unitPrice));
      return { description: String(l.description || ""), qty, unitCents, totalCents: Math.round(qty * unitCents) };
    });
    const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
    let discountCents = 0;
    if (input.discountKind === "percent") discountCents = Math.round((subtotalCents * clamp(num(input.discountValue), 0, 100)) / 100);
    else if (input.discountKind === "amount") discountCents = Math.max(0, toCents(input.discountValue));
    discountCents = Math.min(discountCents, subtotalCents);
    const taxableCents = subtotalCents - discountCents;
    const taxCents = Math.round((taxableCents * clamp(num(input.taxPercent), 0, 100)) / 100);
    return { lines, subtotalCents, discountCents, taxableCents, taxCents, totalCents: taxableCents + taxCents };
  }

  function formatMoney(cents, currency) {
    const c = CURRENCIES[currency] || CURRENCIES.GBP;
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${neg ? "-" : ""}${c.symbol}${whole}.${String(abs % 100).padStart(2, "0")}`;
  }

  function addDays(iso, n) {
    const ms = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000;
    const d = new Date(ms);
    return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  // ---------- end PART 1 ----------

  const api = { CURRENCIES, toCents, computeQuote, formatMoney, addDays };
  root.QuoteCalc = api;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("fq-app");
  if (!app) return;

  const STORE = "mike-quote-business-v1";
  const MAX_LOGO = 400 * 1024;
  const state = { logo: "", lines: [] };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let uid = 0;
  function field(label, control, hint) {
    const id = "fq-f" + (++uid);
    control.id = id;
    const wrap = el("div", "fq-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    wrap.append(lab, control);
    if (hint) { const h = el("span", "fq-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    return wrap;
  }
  function input(type, value, extra) {
    const i = el("input"); i.type = type; if (value != null) i.value = value;
    if (extra) Object.keys(extra).forEach((k) => i.setAttribute(k, extra[k]));
    return i;
  }
  function select(options, value) {
    const s = el("select");
    options.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; s.append(o); });
    s.value = value;
    return s;
  }
  const button = (text, primary) => { const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text); b.type = "button"; return b; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const niceDate = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${+iso.slice(8, 10)} ${m[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
  };

  // Form controls
  const f = {
    bizName: input("text", "", { autocomplete: "organization" }),
    bizContact: el("textarea"),
    logo: input("file", null, { accept: "image/png,image/jpeg,image/gif,image/webp" }),
    custName: input("text", "", { autocomplete: "off" }),
    custDetails: el("textarea"),
    number: input("text", "Q-0001"),
    date: input("date", today()),
    valid: input("date", addDays(today(), 30)),
    currency: select(Object.keys(CURRENCIES).map((k) => [k, CURRENCIES[k].label]), "GBP"),
    discountKind: select([["none", "No discount"], ["percent", "Percent off (%)"], ["amount", "Amount off"]], "none"),
    discountValue: input("number", "", { min: "0", step: "any", inputmode: "decimal" }),
    taxLabel: input("text", "VAT"),
    taxPercent: input("number", "0", { min: "0", max: "100", step: "any", inputmode: "decimal" }),
    terms: el("textarea"),
  };
  f.bizContact.rows = 3; f.custDetails.rows = 3; f.terms.rows = 4;
  f.terms.value = "Payment due within 14 days of invoice. This quote is an estimate based on the work described and is valid until the date above.";

  const msg = el("p", "fq-msg");
  msg.setAttribute("aria-live", "polite");
  const logoMsg = el("span", "fq-hint");

  // Line items
  const linesBox = el("div", "fq-lines");
  function addLine(kind, desc, qty, price) {
    state.lines.push({ kind: kind || "Labour", description: desc || "", qty: qty == null ? "1" : qty, unitPrice: price || "" });
    renderLines();
  }
  function renderLines() {
    linesBox.textContent = "";
    state.lines.forEach((ln, i) => {
      const row = el("fieldset", "fq-line");
      row.append(el("legend", "fq-legend", `Line ${i + 1}`));
      const kind = select([["Labour", "Labour"], ["Materials", "Materials"], ["Other", "Other"]], ln.kind);
      const desc = input("text", ln.description, { placeholder: "e.g. Fit new consumer unit" });
      const qty = input("number", ln.qty, { min: "0", step: "any", inputmode: "decimal" });
      const price = input("number", ln.unitPrice, { min: "0", step: "any", inputmode: "decimal", placeholder: "0.00" });
      const del = button("Remove");
      del.setAttribute("aria-label", `Remove line ${i + 1}`);
      kind.addEventListener("change", () => { ln.kind = kind.value; update(); });
      desc.addEventListener("input", () => { ln.description = desc.value; update(); });
      qty.addEventListener("input", () => { ln.qty = qty.value; update(); });
      price.addEventListener("input", () => { ln.unitPrice = price.value; update(); });
      del.addEventListener("click", () => { state.lines.splice(i, 1); if (!state.lines.length) state.lines.push({ kind: "Labour", description: "", qty: "1", unitPrice: "" }); renderLines(); });
      row.append(field("Type", kind), field("Description", desc), field("Quantity (hours or units)", qty), field("Unit price", price), del);
      linesBox.append(row);
    });
    update();
  }
  const addLabour = button("Add labour line");
  const addMaterial = button("Add materials line");
  addLabour.addEventListener("click", () => addLine("Labour"));
  addMaterial.addEventListener("click", () => addLine("Materials"));

  // Preview
  const sheet = el("section", "fq-sheet");
  sheet.setAttribute("aria-label", "Quote preview");
  const live = el("p", "fq-sr");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");

  function row2(a, b, cls) { const r = el("div", "fq-trow" + (cls ? " " + cls : "")); r.append(el("span", null, a), el("span", null, b)); return r; }

  function currentTotals() {
    return computeQuote({
      lines: state.lines.map((l) => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice })),
      discountKind: f.discountKind.value,
      discountValue: f.discountValue.value,
      taxPercent: f.taxPercent.value,
    });
  }

  let lastAnnounced = "";
  function update() {
    const cur = f.currency.value;
    const t = currentTotals();
    const fm = (c) => formatMoney(c, cur);
    sheet.textContent = "";
    const head = el("div", "fq-head");
    const from = el("div", "fq-from");
    if (state.logo) { const img = el("img", "fq-logo"); img.src = state.logo; img.alt = f.bizName.value ? `${f.bizName.value} logo` : "Business logo"; from.append(img); }
    from.append(el("strong", "fq-biz", f.bizName.value || "Your business name"));
    from.append(el("div", "fq-pre", f.bizContact.value));
    const meta = el("div", "fq-meta");
    meta.append(el("h3", "fq-title", "Quote"));
    meta.append(row2("Quote no.", f.number.value || "-"), row2("Date", niceDate(f.date.value) || "-"), row2("Valid until", niceDate(f.valid.value) || "-"));
    head.append(from, meta);
    const to = el("div", "fq-to");
    to.append(el("span", "fq-label", "Prepared for"), el("strong", null, f.custName.value || "Customer name"), el("div", "fq-pre", f.custDetails.value));

    const tbl = el("table", "fq-table");
    const thead = el("thead"); const hr = el("tr");
    ["Description", "Qty", "Unit price", "Amount"].forEach((h, i) => { const th = el("th", i ? "fq-num" : null, h); th.scope = "col"; hr.append(th); });
    thead.append(hr); tbl.append(thead);
    const tb = el("tbody");
    state.lines.forEach((ln, i) => {
      const c = t.lines[i];
      if (!c.description && !c.totalCents && !c.unitCents) return;
      const tr = el("tr");
      const d = el("td"); d.append(document.createTextNode(c.description || "-"));
      if (ln.kind && ln.kind !== "Other") d.append(el("span", "fq-kind", " (" + ln.kind.toLowerCase() + ")"));
      tr.append(d, el("td", "fq-num", String(c.qty)), el("td", "fq-num", fm(c.unitCents)), el("td", "fq-num", fm(c.totalCents)));
      tb.append(tr);
    });
    if (!tb.childNodes.length) { const tr = el("tr"); const td = el("td", null, "Add your first line item to see it here."); td.colSpan = 4; tr.append(td); tb.append(tr); }
    tbl.append(tb);

    const tot = el("div", "fq-totals");
    tot.append(row2("Subtotal", fm(t.subtotalCents)));
    if (t.discountCents) tot.append(row2(f.discountKind.value === "percent" ? `Discount (${num(f.discountValue.value)}%)` : "Discount", "-" + fm(t.discountCents)));
    const taxPct = clamp(num(f.taxPercent.value), 0, 100);
    if (taxPct > 0) tot.append(row2(`${f.taxLabel.value || "Tax"} (${taxPct}%)`, fm(t.taxCents)));
    tot.append(row2("Total", fm(t.totalCents), "fq-grand"));

    sheet.append(head, to, tbl, tot);
    if (f.terms.value.trim()) { const tm = el("div", "fq-terms"); tm.append(el("span", "fq-label", "Terms and notes"), el("div", "fq-pre", f.terms.value)); sheet.append(tm); }

    const announce = `Total ${fm(t.totalCents)}`;
    if (announce !== lastAnnounced) { lastAnnounced = announce; live.textContent = announce; }
  }

  // Logo: read in the browser only.
  f.logo.addEventListener("change", () => {
    const file = f.logo.files && f.logo.files[0];
    logoMsg.textContent = "";
    if (!file) { state.logo = ""; update(); return; }
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { logoMsg.textContent = "Choose a PNG, JPG, GIF or WebP image."; f.logo.value = ""; return; }
    if (file.size > MAX_LOGO) { logoMsg.textContent = "That image is over 400 KB. Choose a smaller one."; f.logo.value = ""; return; }
    const r = new FileReader();
    r.onload = () => { state.logo = String(r.result); logoMsg.textContent = "Logo added. It stays on this device."; update(); };
    r.onerror = () => { logoMsg.textContent = "Could not read that image."; };
    r.readAsDataURL(file);
  });

  // Save business details on this device (localStorage, only when asked).
  function saveBusiness() {
    const data = { name: f.bizName.value, contact: f.bizContact.value, currency: f.currency.value, taxLabel: f.taxLabel.value, taxPercent: f.taxPercent.value, terms: f.terms.value, logo: state.logo };
    try { localStorage.setItem(STORE, JSON.stringify(data)); msg.textContent = "Saved on this device. It is not sent anywhere."; }
    catch (e) { msg.textContent = "Could not save here. Your browser may block storage. Your quote still works."; }
  }
  function loadBusiness() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name) f.bizName.value = d.name;
      if (d.contact) f.bizContact.value = d.contact;
      if (d.currency && CURRENCIES[d.currency]) f.currency.value = d.currency;
      if (d.taxLabel != null) f.taxLabel.value = d.taxLabel;
      if (d.taxPercent != null) f.taxPercent.value = d.taxPercent;
      if (d.terms) f.terms.value = d.terms;
      if (typeof d.logo === "string" && d.logo.indexOf("data:image/") === 0) state.logo = d.logo;
      msg.textContent = "Loaded your saved business details.";
    } catch (e) { /* storage unavailable or bad data: start blank */ }
  }
  function forgetBusiness() {
    try { localStorage.removeItem(STORE); msg.textContent = "Saved details removed from this device."; }
    catch (e) { msg.textContent = "Could not reach browser storage."; }
  }

  const save = button("Save business details on this device");
  const forget = button("Forget saved details");
  const print = button("Download PDF", true);
  save.addEventListener("click", saveBusiness);
  forget.addEventListener("click", forgetBusiness);
  print.addEventListener("click", () => { update(); window.print(); });
  print.setAttribute("aria-describedby", "fq-print-hint");

  ["input", "change"].forEach((ev) => app.addEventListener(ev, (e) => { if (e.target !== f.logo) update(); }));

  // Layout
  function box(title, ...kids) { const b = el("fieldset", "fq-box"); b.append(el("legend", "fq-boxtitle", title), ...kids); return b; }
  const grid = (...kids) => { const g = el("div", "fq-grid"); g.append(...kids); return g; };
  const logoField = field("Logo (optional)", f.logo, "PNG, JPG, GIF or WebP, up to 400 KB. Read in your browser and never uploaded.");
  logoField.append(logoMsg);
  const lineControls = el("div", "try-controls");
  lineControls.append(addLabour, addMaterial);

  const form = el("div", "fq-form");
  form.append(
    box("Your business", field("Business name", f.bizName), field("Address, phone, email, VAT or tax number", f.bizContact), logoField),
    box("Customer", field("Customer name", f.custName), field("Address or job site", f.custDetails)),
    box("Quote details", grid(field("Quote number", f.number), field("Quote date", f.date), field("Valid until", f.valid), field("Currency", f.currency))),
    box("Labour and materials", linesBox, lineControls),
    box("Discount and tax", grid(field("Discount", f.discountKind), field("Discount value", f.discountValue, "A percent or an amount, depending on the choice before it."), field("Tax name", f.taxLabel, "VAT in the UK, sales tax in the US."), field("Tax rate (%)", f.taxPercent, "Applied after the discount. Use 0 if you do not charge it."))),
    box("Terms and notes", field("Terms, payment details, what is not included", f.terms)),
  );

  const actions = el("div", "try-controls fq-actions");
  actions.append(print, save, forget);
  const hint = el("p", "fq-hint", "Download PDF opens your print dialog. Choose Save as PDF as the printer. Only the quote is printed.");
  hint.id = "fq-print-hint";

  const preview = el("div", "fq-preview");
  preview.append(el("h2", "lx-h3 fq-previewtitle", "Live preview"), live, sheet);

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Quote maker"), document.createTextNode(" Works in your browser. Nothing you type leaves your device."));
  app.append(intro, form, actions, hint, msg, preview);

  loadBusiness();
  addLine("Labour", "", "1", "");
  addLine("Materials", "", "1", "");
})(typeof globalThis !== "undefined" ? globalThis : this);
