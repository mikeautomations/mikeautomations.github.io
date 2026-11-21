// /he/quote-generator/ client logic. Needs public/he-tools-core.js first. Progressive enhancement: the page already
// explains what goes in a quote without JS. No dependencies, no network requests, no cookies, no tracking: nothing typed
// here leaves the device. The only storage is localStorage, and only when the person presses "שמירה במכשיר" (try/catch).
// The logo is read in the browser and never uploaded.
(function () {
  "use strict";
  const T = window.HeTools;
  const app = document.getElementById("hq-app");
  if (!T || !app) return;
  const { el, button, field, textInput, textArea, select, formatMoney, formatDate, addDays, computeDoc, parseNumber } = T;

  const STORE = "mike-he-quote-business-v1";
  const MAX_LOGO = 400 * 1024;
  const KINDS = [
    { value: "עבודה", label: "עבודה" },
    { value: "חומרים", label: "חומרים" },
    { value: "אחר", label: "אחר" },
  ];
  const state = { logo: "", lines: [] };

  const f = {};
  f.bizName = field("שם העסק", textInput("text", "", { autocomplete: "organization" }));
  f.bizId = field("מספר עוסק (לא חובה)", textInput("text", "", { autocomplete: "off", inputMode: "numeric" }), "עוסק מורשה, עוסק פטור או ח.פ.");
  f.bizContact = field("כתובת, טלפון ומייל", textArea(3));
  f.logo = field("לוגו (לא חובה)", textInput("file"), "PNG, JPG, GIF או WebP, עד 400KB. נקרא בדפדפן ולא עולה לשרת.");
  f.logo.input.accept = "image/png,image/jpeg,image/gif,image/webp";
  f.custName = field("שם הלקוח", textInput("text", "", { autocomplete: "off" }));
  f.custDetails = field("כתובת או אתר העבודה", textArea(3));
  f.number = field("מספר הצעה", textInput("text", "1001"));
  f.date = field("תאריך ההצעה", textInput("date", T.todayIso()));
  f.valid = field("בתוקף עד", textInput("date", addDays(T.todayIso(), 30)));
  f.currency = field("מטבע", select(T.CURRENCIES.map((c) => ({ value: c.code, label: c.label })), "ILS"));
  f.discountKind = field("הנחה", select([{ value: "none", label: "ללא הנחה" }, { value: "percent", label: "אחוז הנחה (%)" }, { value: "amount", label: "סכום הנחה" }], "none"));
  f.discountValue = field("ערך ההנחה", textInput("text", "", { inputMode: "decimal" }), "אחוז או סכום, לפי הבחירה שלפני.");
  f.taxLabel = field("שם המס", textInput("text", "מע\"מ"));
  f.taxPercent = field("שיעור מס (%)", textInput("text", "18", { inputMode: "decimal" }), "מחושב אחרי ההנחה. עוסק פטור: 0. שיעור המע\"מ הרגיל כיום 18%, כדאי לוודא שהוא עדיין העדכני.");
  f.terms = field("תנאים, פרטי תשלום, מה לא כלול", textArea(4));
  f.terms.input.value = "תשלום: שוטף + 30 מתאריך חשבון העסקה. ההצעה מבוססת על העבודה המתוארת ובתוקף עד התאריך שלמעלה. מחירי ההצעה לפני מע\"מ אלא אם צוין אחרת.";

  const msg = el("p", "ht-status");
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  const logoMsg = el("p", "ht-error");
  logoMsg.setAttribute("role", "alert");

  // Line items
  const linesBox = el("div", "ht-lines");
  function addLine(kind, desc, qty, price) {
    state.lines.push({ kind: kind || "עבודה", description: desc || "", qty: qty == null ? "1" : qty, price: price || "" });
    renderLines();
  }
  function renderLines() {
    linesBox.textContent = "";
    state.lines.forEach((ln, i) => {
      const row = el("div", "ht-qline");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "שורה " + (i + 1));
      const kind = field("סוג", select(KINDS, ln.kind));
      const desc = field("תיאור", textInput("text", ln.description, { placeholder: "למשל: החלפת לוח חשמל" }));
      const qty = field("כמות (שעות או יחידות)", textInput("text", ln.qty, { inputMode: "decimal" }));
      const price = field("מחיר ליחידה", textInput("text", ln.price, { inputMode: "decimal", placeholder: "0.00" }));
      kind.input.addEventListener("change", () => { ln.kind = kind.input.value; update(); });
      desc.input.addEventListener("input", () => { ln.description = desc.input.value; update(); });
      qty.input.addEventListener("input", () => { ln.qty = qty.input.value; update(); });
      price.input.addEventListener("input", () => { ln.price = price.input.value; update(); });
      const del = button("הסרה");
      del.setAttribute("aria-label", "הסרה, שורה " + (i + 1));
      del.addEventListener("click", () => {
        state.lines.splice(i, 1);
        if (!state.lines.length) state.lines.push({ kind: "עבודה", description: "", qty: "1", price: "" });
        renderLines();
      });
      row.append(kind.wrap, desc.wrap, qty.wrap, price.wrap, del);
      linesBox.append(row);
    });
    update();
  }
  const addLabour = button("הוספת שורת עבודה");
  const addMaterial = button("הוספת שורת חומרים");
  addLabour.addEventListener("click", () => addLine("עבודה"));
  addMaterial.addEventListener("click", () => addLine("חומרים"));

  // Preview
  const sheet = el("section", "ht-paper");
  sheet.setAttribute("aria-label", "תצוגה מקדימה של ההצעה");
  const live = el("p");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  Object.assign(live.style, { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0" });

  const val = (x) => x.input.value.trim();
  const row2 = (a, b, cls) => {
    const r = el("div", cls);
    r.style.display = "flex";
    r.style.justifyContent = "space-between";
    r.style.gap = "1.5rem";
    const bv = el("span", null, b);
    bv.dir = "ltr";
    r.append(el("span", null, a), bv);
    return r;
  };

  let lastAnnounced = "";
  function update() {
    const cur = f.currency.input.value;
    const t = computeDoc({ lines: state.lines, discountKind: f.discountKind.input.value, discountValue: f.discountValue.input.value, taxPercent: f.taxPercent.input.value });
    const fm = (c) => formatMoney(c, cur);
    sheet.textContent = "";

    const head = el("div", "ht-top");
    const from = el("div");
    if (state.logo) { const img = el("img", "ht-logo"); img.src = state.logo; img.alt = val(f.bizName) ? "לוגו " + val(f.bizName) : "לוגו העסק"; from.append(img); }
    from.append(el("p", "ht-name", val(f.bizName) || "שם העסק"));
    if (val(f.bizId)) from.append(el("p", "ht-block", "מספר עוסק: " + val(f.bizId)));
    if (val(f.bizContact)) from.append(el("p", "ht-block", val(f.bizContact)));
    const meta = el("div");
    meta.append(el("p", "ht-title", "הצעת מחיר"));
    const dl = el("dl", "ht-meta");
    const addMeta = (k, v) => { if (v) dl.append(el("dt", null, k), el("dd", null, v)); };
    addMeta("מספר הצעה", val(f.number));
    addMeta("תאריך", formatDate(f.date.input.value));
    addMeta("בתוקף עד", formatDate(f.valid.input.value));
    meta.append(dl);
    head.append(from, meta);

    const to = el("div");
    to.append(el("p", "ht-label", "הצעה עבור"), el("p", "ht-name", val(f.custName) || "שם הלקוח"));
    if (val(f.custDetails)) to.append(el("p", "ht-block", val(f.custDetails)));

    const scroll = el("div", "ht-scroll");
    const tbl = el("table", "ht-table");
    const cap = el("caption", null, "שורות ההצעה");
    // Visually hidden with the clip pattern (no left or right offsets, which would widen the page).
    Object.assign(cap.style, { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0" });
    tbl.append(cap);
    const thead = el("thead");
    const hr = el("tr");
    [["תיאור", false], ["כמות", true], ["מחיר ליחידה", true], ["סכום", true]].forEach(([h, num]) => { const th = el("th", num ? "num" : null, h); th.scope = "col"; hr.append(th); });
    thead.append(hr);
    tbl.append(thead);
    const tb = el("tbody");
    state.lines.forEach((ln, i) => {
      const c = t.lines[i];
      if (!ln.description.trim() && !c.totalCents && !c.unitCents) return;
      const tr = el("tr");
      const d = el("td");
      d.append(document.createTextNode(ln.description.trim() || "-"));
      if (ln.kind && ln.kind !== "אחר") d.append(el("span", null, " (" + ln.kind + ")"));
      tr.append(d, el("td", "num", String(c.qty)), el("td", "num", fm(c.unitCents)), el("td", "num", fm(c.totalCents)));
      tb.append(tr);
    });
    if (!tb.childNodes.length) { const tr = el("tr"); const td = el("td", null, "הוסיפו את השורה הראשונה"); td.colSpan = 4; tr.append(td); tb.append(tr); }
    tbl.append(tb);
    scroll.append(tbl);

    const tot = el("div", "ht-totals");
    tot.append(row2("סכום ביניים", fm(t.subtotalCents)));
    if (t.discountCents) tot.append(row2(f.discountKind.input.value === "percent" ? "הנחה (" + parseNumber(f.discountValue.input.value) + "%)" : "הנחה", "-" + fm(t.discountCents)));
    const pct = Math.min(100, parseNumber(f.taxPercent.input.value));
    if (pct > 0) tot.append(row2((val(f.taxLabel) || "מס") + " (" + pct + "%)", fm(t.taxCents)));
    tot.append(row2("סה\"כ", fm(t.totalCents), "grand"));

    sheet.append(head, to, scroll, tot);
    if (val(f.terms)) { const tm = el("div"); tm.append(el("p", "ht-label", "תנאים והערות"), el("p", "ht-block", val(f.terms))); sheet.append(tm); }
    sheet.append(el("p", "ht-disclaimer", "הצעת מחיר זו הופקה בכלי חינמי. היא אינה חשבונית מס."));

    const announce = "סה\"כ " + fm(t.totalCents);
    if (announce !== lastAnnounced) { lastAnnounced = announce; live.textContent = announce; }
  }

  // Logo: read in the browser only.
  f.logo.input.addEventListener("change", () => {
    logoMsg.textContent = "";
    const file = f.logo.input.files && f.logo.input.files[0];
    if (!file) { state.logo = ""; update(); return; }
    T.readLogo(file, MAX_LOGO, (data) => { state.logo = data; logoMsg.textContent = ""; update(); }, (m) => { logoMsg.textContent = m; f.logo.input.value = ""; });
  });

  // Save business details on this device (localStorage, only when asked).
  function saveBusiness() {
    const d = { name: f.bizName.input.value, bizId: f.bizId.input.value, contact: f.bizContact.input.value, currency: f.currency.input.value, taxLabel: f.taxLabel.input.value, taxPercent: f.taxPercent.input.value, terms: f.terms.input.value, logo: state.logo };
    try { localStorage.setItem(STORE, JSON.stringify(d)); msg.textContent = "נשמר במכשיר הזה. שום דבר לא נשלח לשום מקום."; }
    catch (e) { msg.textContent = "השמירה לא הצליחה, ייתכן שהדפדפן חוסם אחסון. ההצעה עצמה עובדת כרגיל."; }
  }
  function loadBusiness() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name) f.bizName.input.value = d.name;
      if (d.bizId) f.bizId.input.value = d.bizId;
      if (d.contact) f.bizContact.input.value = d.contact;
      if (d.currency && T.CURRENCIES.some((c) => c.code === d.currency)) f.currency.input.value = d.currency;
      if (d.taxLabel != null) f.taxLabel.input.value = d.taxLabel;
      if (d.taxPercent != null) f.taxPercent.input.value = d.taxPercent;
      if (d.terms) f.terms.input.value = d.terms;
      if (typeof d.logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(d.logo)) state.logo = d.logo;
      msg.textContent = "נטענו פרטי העסק השמורים שלכם.";
    } catch (e) { /* storage unavailable or bad data: start blank */ }
  }
  function forgetBusiness() {
    try { localStorage.removeItem(STORE); msg.textContent = "הפרטים השמורים נמחקו מהמכשיר."; }
    catch (e) { msg.textContent = "אין גישה לאחסון של הדפדפן."; }
  }

  const save = button("שמירה במכשיר");
  const forget = button("מחיקת הפרטים השמורים");
  const print = button("הורדת PDF", true);
  save.addEventListener("click", saveBusiness);
  forget.addEventListener("click", forgetBusiness);
  print.addEventListener("click", () => { update(); window.print(); });

  [f.bizName, f.bizId, f.bizContact, f.custName, f.custDetails, f.number, f.date, f.valid, f.currency, f.discountKind, f.discountValue, f.taxLabel, f.taxPercent, f.terms].forEach((x) => {
    x.input.addEventListener("input", update);
    x.input.addEventListener("change", update);
  });

  // Layout
  const box = (title, ...kids) => {
    const b = el("fieldset", "ht-box");
    const lg = el("legend", null, title);
    lg.style.fontWeight = "700";
    b.append(lg, ...kids);
    return b;
  };
  const grid = (...kids) => { const g = el("div", "ht-grid"); g.append(...kids.map((k) => k.wrap || k)); return g; };
  const lineControls = el("div", "try-controls");
  lineControls.append(addLabour, addMaterial);

  const form = el("div", "ht-noprint");
  form.style.display = "grid";
  form.style.gap = "1rem";
  form.append(
    box("העסק שלכם", grid(f.bizName, f.bizId), f.bizContact.wrap, f.logo.wrap, logoMsg),
    box("הלקוח", f.custName.wrap, f.custDetails.wrap),
    box("פרטי ההצעה", grid(f.number, f.date, f.valid, f.currency)),
    box("עבודה וחומרים", linesBox, lineControls),
    box("הנחה ומס", grid(f.discountKind, f.discountValue, f.taxLabel, f.taxPercent)),
    box("תנאים והערות", f.terms.wrap),
  );

  const actions = el("div", "try-controls ht-noprint");
  actions.append(print, save, forget);
  const hint = el("p", "ht-hint ht-noprint", "הורדת PDF פותחת את חלון ההדפסה של הדפדפן. בוחרים \"שמירה כ-PDF\" במקום מדפסת. מודפסת רק ההצעה.");

  const preview = el("div");
  const ph = el("h2", "lx-h3 ht-noprint", "תצוגה מקדימה");
  preview.append(ph, live, sheet);

  app.textContent = "";
  const intro = el("p", "ht-noprint");
  intro.append(el("span", "try-label", "מחולל הצעות"), document.createTextNode(" עובד בדפדפן שלכם. שום דבר ממה שתקלידו לא עוזב את המכשיר."));
  app.append(intro, form, actions, hint, msg, preview);

  loadBusiness();
  addLine("עבודה", "", "1", "");
  addLine("חומרים", "", "1", "");
})();
