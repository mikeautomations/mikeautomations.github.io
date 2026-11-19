// /he/invoice-generator/ client logic (document maker: חשבון עסקה, הצעת מחיר, קבלה). Needs public/he-tools-core.js first.
// Progressive enhancement: the page explains the tool without JS. No dependencies, no network requests, no cookies, no
// tracking: nothing typed here leaves the device. The only storage is localStorage, and only when the person presses
// "שמירה במכשיר" (wrapped in try/catch). The logo is read in the browser and never uploaded.
// It never produces a חשבונית מס: every document carries a line saying so.
(function () {
  "use strict";
  const T = window.HeTools;
  const app = document.getElementById("hinv-app");
  if (!T || !app) return;
  const { el, button, field, textInput, textArea, select, formatMoney, formatDate, addDays, computeDoc, parseNumber } = T;

  const STORE_KEY = "mike-he-invoice-details-v1";
  const MAX_LOGO_BYTES = 1500000;
  const MAX_SAVED_LOGO_CHARS = 400000;
  const DOC_TYPES = [
    { value: "deal", label: "חשבון עסקה", title: "חשבון עסקה", numLabel: "מספר חשבון עסקה", numDefault: "1001" },
    { value: "quote", label: "הצעת מחיר", title: "הצעת מחיר", numLabel: "מספר הצעה", numDefault: "1001" },
    { value: "receipt", label: "קבלה", title: "קבלה", numLabel: "מספר קבלה", numDefault: "1001" },
  ];
  const STATUSES = [
    { value: "licensed", label: "עוסק מורשה", idLabel: "מספר עוסק מורשה", vat: "18" },
    { value: "exempt", label: "עוסק פטור", idLabel: "מספר עוסק פטור", vat: "0" },
    { value: "company", label: "חברה בע\"מ", idLabel: "ח.פ.", vat: "18" },
    { value: "other", label: "אחר", idLabel: "מספר עוסק / ת.ז.", vat: "18" },
  ];
  const docType = (v) => DOC_TYPES.find((d) => d.value === v) || DOC_TYPES[0];
  const status = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];

  const state = { logo: "", lines: [{ description: "", qty: "1", price: "" }] };

  app.textContent = "";

  const form = el("div", "ht-noprint");
  form.style.display = "grid";
  form.style.gap = "1rem";

  const box = (id, title, ...kids) => {
    const b = el("section", "ht-box");
    b.setAttribute("aria-labelledby", id);
    const h = el("h2", "lx-h3", title);
    h.id = id;
    b.append(h, ...kids);
    return b;
  };
  const grid = (...kids) => { const g = el("div", "ht-grid"); g.append(...kids); return g; };

  // Document type and business
  const fType = field("סוג המסמך", select(DOC_TYPES.map((d) => ({ value: d.value, label: d.label })), "deal"));
  const fStatus = field("סטטוס העסק", select(STATUSES.map((s) => ({ value: s.value, label: s.label })), "licensed"));
  const fBiz = field("שם העסק", textInput("text", "", { autocomplete: "organization" }));
  const fBizId = field("מספר עוסק", textInput("text", "", { autocomplete: "off", inputMode: "numeric" }), "מספר עוסק מורשה או פטור, או ח.פ. מופיע על המסמך כדי שהלקוח יזהה אתכם.");
  const fAddr = field("כתובת", textArea(3), "מוצגת מתחת לשם העסק.");
  const fContact = field("טלפון או מייל (לא חובה)", textInput("text", "", { autocomplete: "off" }));
  const fLogo = field("לוגו (לא חובה)", textInput("file"), "PNG, JPG, WebP או GIF, עד 1.5MB. נשאר במכשיר שלכם.");
  fLogo.input.accept = "image/png,image/jpeg,image/webp,image/gif";
  const btnRemoveLogo = button("הסרת הלוגו");
  btnRemoveLogo.hidden = true;
  const logoRow = el("div", "try-controls");
  logoRow.append(btnRemoveLogo);
  const logoMsg = el("p", "ht-error");
  logoMsg.setAttribute("role", "alert");
  const boxMe = box("hinv-h-me", "המסמך והעסק שלכם", grid(fType.wrap, fStatus.wrap), grid(fBiz.wrap, fBizId.wrap), fAddr.wrap, fContact.wrap, fLogo.wrap, logoRow, logoMsg);

  // Client
  const fClient = field("שם הלקוח", textInput("text", ""));
  const fClientId = field("מספר עוסק / ח.פ. של הלקוח (לא חובה)", textInput("text", "", { inputMode: "numeric" }));
  const fClientAddr = field("כתובת ופרטי הלקוח", textArea(3));
  const boxClient = box("hinv-h-client", "הלקוח", fClient.wrap, fClientId.wrap, fClientAddr.wrap);

  // Details
  const issue = T.todayIso();
  const fNum = field("מספר מסמך", textInput("text", "1001"));
  const fDate = field("תאריך", textInput("date", issue));
  const fDue = field("מועד תשלום", textInput("date", addDays(issue, 30)));
  const fCur = field("מטבע", select(T.CURRENCIES.map((c) => ({ value: c.code, label: c.label })), "ILS"));
  const fVat = field("שיעור מע\"מ (%)", textInput("text", "18", { inputMode: "decimal" }), "המחירים מוזנים לפני מע\"מ. עוסק פטור: 0. שיעור המע\"מ הרגיל כיום 18%, כדאי לוודא שהוא עדיין העדכני.");
  const boxInv = box("hinv-h-inv", "פרטי המסמך", grid(fNum.wrap, fDate.wrap, fDue.wrap, fCur.wrap, fVat.wrap));

  // Lines
  const linesWrap = el("div", "ht-lines");
  const btnAdd = button("הוספת שורה");
  const addRow = el("div", "try-controls");
  addRow.append(btnAdd);
  const live = el("p", "ht-live");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  const boxLines = box("hinv-h-lines", "שורות", linesWrap, addRow, live);

  // Payment and notes
  const fPay = field("איך משלמים", textArea(4), "למשל פרטי חשבון בנק, ביט, פייבוקס או קישור לתשלום.");
  const fNotes = field("הערות (לא חובה)", textArea(3), "למשל תודה, תנאי תשלום או מספר הזמנה.");
  const boxPay = box("hinv-h-pay", "פרטי תשלום והערות", fPay.wrap, fNotes.wrap);

  // Actions
  const btnPdf = button("הורדת PDF", true);
  const btnSave = button("שמירה במכשיר");
  const btnClear = button("מחיקת הפרטים השמורים");
  const actRow = el("div", "try-controls");
  actRow.append(btnPdf, btnSave, btnClear);
  const statusEl = el("p", "ht-status");
  statusEl.setAttribute("role", "status");
  statusEl.setAttribute("aria-live", "polite");
  const actHint = el("p", "ht-hint", "הורדת PDF פותחת את חלון ההדפסה של הדפדפן: בוחרים \"שמירה כ-PDF\". מודפס רק המסמך. \"שמירה במכשיר\" שומרת את פרטי העסק, המע\"מ ופרטי התשלום בדפדפן הזה כדי שיהיו מוכנים בפעם הבאה. שום דבר לא נשלח לשום מקום.");
  const boxAct = box("hinv-h-act", "שמירת המסמך", actRow, statusEl, actHint);

  form.append(boxMe, boxClient, boxInv, boxLines, boxPay, boxAct);

  // Preview
  const previewWrap = el("section");
  previewWrap.setAttribute("aria-labelledby", "hinv-h-prev");
  const hPrev = el("h2", "lx-h3 ht-noprint", "תצוגה מקדימה");
  hPrev.id = "hinv-h-prev";
  const paper = el("div", "ht-paper");
  previewWrap.append(hPrev, paper);
  app.append(form, previewWrap);

  // ----- line rows -----
  function renderLines() {
    linesWrap.textContent = "";
    state.lines.forEach((ln, i) => {
      const row = el("div", "ht-line");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "שורה " + (i + 1));
      const d = field("תיאור", textInput("text", ln.description));
      const q = field("כמות", textInput("text", ln.qty, { inputMode: "decimal" }));
      const p = field("מחיר ליחידה", textInput("text", ln.price, { inputMode: "decimal" }));
      d.input.addEventListener("input", () => { ln.description = d.input.value; update(); });
      q.input.addEventListener("input", () => { ln.qty = q.input.value; update(); });
      p.input.addEventListener("input", () => { ln.price = p.input.value; update(); });
      const rm = button("הסרה");
      rm.setAttribute("aria-label", "הסרת שורה " + (i + 1));
      rm.addEventListener("click", () => {
        state.lines.splice(i, 1);
        if (!state.lines.length) state.lines.push({ description: "", qty: "1", price: "" });
        renderLines();
        update();
        btnAdd.focus();
      });
      row.append(d.wrap, q.wrap, p.wrap, rm);
      linesWrap.append(row);
    });
  }
  btnAdd.addEventListener("click", () => {
    state.lines.push({ description: "", qty: "1", price: "" });
    renderLines();
    update();
    const rows = linesWrap.querySelectorAll(".ht-line");
    const last = rows[rows.length - 1];
    const first = last && last.querySelector("input");
    if (first) first.focus();
  });

  // ----- preview -----
  const block = (cls, text) => el("p", cls, text);
  const val = (f) => f.input.value.trim();

  function renderPreview() {
    const cur = fCur.input.value;
    const dt = docType(fType.input.value);
    const st = status(fStatus.input.value);
    const t = computeDoc({ lines: state.lines, discountKind: "none", discountValue: 0, taxPercent: fVat.input.value });
    const rate = Math.min(100, parseNumber(fVat.input.value));
    paper.textContent = "";

    const top = el("div", "ht-top");
    const from = el("div");
    if (state.logo) {
      const img = el("img", "ht-logo");
      img.src = state.logo;
      img.alt = val(fBiz) ? "לוגו " + val(fBiz) : "לוגו העסק";
      from.append(img);
    }
    if (val(fBiz)) from.append(block("ht-name", val(fBiz)));
    if (val(fBizId)) from.append(block("ht-block", st.idLabel + ": " + val(fBizId)));
    if (val(fAddr)) from.append(block("ht-block", val(fAddr)));
    if (val(fContact)) from.append(block("ht-block", val(fContact)));

    const head = el("div");
    head.append(el("p", "ht-title", dt.title));
    const meta = el("dl", "ht-meta");
    const addMeta = (k, v) => { if (v) meta.append(el("dt", null, k), el("dd", null, v)); };
    addMeta(dt.numLabel, val(fNum));
    addMeta("תאריך", formatDate(fDate.input.value));
    if (dt.value !== "receipt") addMeta(dt.value === "quote" ? "בתוקף עד" : "מועד תשלום", formatDate(fDue.input.value));
    head.append(meta);
    top.append(from, head);

    const parties = el("div");
    parties.append(el("p", "ht-label", dt.value === "quote" ? "הצעה עבור" : "לכבוד"));
    if (val(fClient)) parties.append(block("ht-name", val(fClient)));
    if (val(fClientId)) parties.append(block("ht-block", "מספר עוסק / ח.פ.: " + val(fClientId)));
    if (val(fClientAddr)) parties.append(block("ht-block", val(fClientAddr)));
    if (!val(fClient) && !val(fClientAddr)) parties.append(block("ht-block", "שם וכתובת הלקוח"));

    const scroll = el("div", "ht-scroll");
    const table = el("table", "ht-table");
    const cap = el("caption", null, "שורות המסמך");
    // Visually hidden with the clip pattern (no left or right offsets, which would widen the page).
    Object.assign(cap.style, { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0" });
    table.append(cap);
    const thead = el("thead");
    const hr = el("tr");
    [["תיאור", false], ["כמות", true], ["מחיר ליחידה", true], ["סכום", true]].forEach(([h, num]) => {
      const th = el("th", num ? "num" : null, h);
      th.scope = "col";
      hr.append(th);
    });
    thead.append(hr);
    const tbody = el("tbody");
    let shown = 0;
    state.lines.forEach((ln, i) => {
      const c = t.lines[i];
      if (!ln.description.trim() && !c.totalCents) return;
      shown++;
      const tr = el("tr");
      tr.append(el("td", null, ln.description.trim()), el("td", "num", String(c.qty)), el("td", "num", formatMoney(c.unitCents, cur)), el("td", "num", formatMoney(c.totalCents, cur)));
      tbody.append(tr);
    });
    if (!shown) {
      const tr = el("tr");
      const td = el("td", null, "הוסיפו את השורה הראשונה");
      td.colSpan = 4;
      tr.append(td);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    scroll.append(table);

    const tot = el("div", "ht-totals");
    const row = (k, v, cls) => {
      const d = el("div", cls);
      const vs = el("span", null, v);
      vs.dir = "ltr";
      d.append(el("span", null, k), vs);
      tot.append(d);
    };
    row("סכום לפני מע\"מ", formatMoney(t.subtotalCents, cur));
    if (rate > 0) row("מע\"מ (" + String(+rate.toFixed(2)) + "%)", formatMoney(t.taxCents, cur));
    row(dt.value === "receipt" ? "סה\"כ שולם" : "סה\"כ לתשלום", formatMoney(t.totalCents, cur), "grand");

    const notes = el("div", "ht-notes");
    if (val(fPay)) { const d = el("div"); d.append(el("p", "ht-label", "פרטי תשלום"), block("ht-block", val(fPay))); notes.append(d); }
    if (val(fNotes)) { const d = el("div"); d.append(el("p", "ht-label", "הערות"), block("ht-block", val(fNotes))); notes.append(d); }

    paper.append(top, parties, scroll, tot);
    if (notes.children.length) paper.append(notes);
    paper.append(el("p", "ht-disclaimer", "מסמך זה הופק בכלי חינמי, אינו חשבונית מס ואינו מופק מתוכנה מאושרת. " + (st.value === "exempt" ? "עוסק פטור. " : "")));
    return t;
  }

  let liveTimer = 0;
  function update() {
    const t = renderPreview();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = "סה\"כ: " + formatMoney(t.totalCents, fCur.input.value); }, 500);
  }

  // Document type changes the number label default; status changes the VAT default and the id label.
  fType.input.addEventListener("change", () => { fDue.wrap.querySelector("label").textContent = fType.input.value === "quote" ? "בתוקף עד" : "מועד תשלום"; fDue.wrap.hidden = fType.input.value === "receipt"; });
  fStatus.input.addEventListener("change", () => {
    const st = status(fStatus.input.value);
    fVat.input.value = st.vat;
    fBizId.wrap.querySelector("label").textContent = st.idLabel;
    update();
  });

  [fType, fStatus, fBiz, fBizId, fAddr, fContact, fClient, fClientId, fClientAddr, fNum, fDate, fDue, fCur, fVat, fPay, fNotes].forEach((f) => {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  });

  // ----- logo -----
  fLogo.input.addEventListener("change", () => {
    logoMsg.textContent = "";
    const file = fLogo.input.files && fLogo.input.files[0];
    if (!file) return;
    T.readLogo(file, MAX_LOGO_BYTES, (data) => { state.logo = data; btnRemoveLogo.hidden = !state.logo; update(); }, (m) => { logoMsg.textContent = m; fLogo.input.value = ""; });
  });
  btnRemoveLogo.addEventListener("click", () => {
    state.logo = "";
    fLogo.input.value = "";
    btnRemoveLogo.hidden = true;
    update();
    fLogo.input.focus();
  });

  // ----- save on this device -----
  const say = (m) => { statusEl.textContent = m; };
  btnSave.addEventListener("click", () => {
    const d = {
      status: fStatus.input.value, biz: fBiz.input.value, bizId: fBizId.input.value, address: fAddr.input.value, contact: fContact.input.value,
      currency: fCur.input.value, vat: fVat.input.value, payment: fPay.input.value, notes: fNotes.input.value,
      logo: state.logo && state.logo.length <= MAX_SAVED_LOGO_CHARS ? state.logo : "",
    };
    const skipped = !!state.logo && !d.logo;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      say("נשמר במכשיר הזה." + (skipped ? " הלוגו גדול מדי לשמירה, הוסיפו אותו שוב בפעם הבאה." : ""));
    } catch (e) {
      say("השמירה לא הצליחה: האחסון בדפדפן כבוי. אפשר עדיין להדפיס את המסמך.");
    }
  });
  btnClear.addEventListener("click", () => {
    try { localStorage.removeItem(STORE_KEY); say("הפרטים השמורים נמחקו מהמכשיר."); }
    catch (e) { say("המחיקה לא הצליחה: האחסון בדפדפן כבוי."); }
  });
  function loadSaved() {
    let d = null;
    try { const raw = localStorage.getItem(STORE_KEY); d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    if (!d || typeof d !== "object") return;
    const s = (v) => (typeof v === "string" ? v : "");
    if (STATUSES.some((x) => x.value === d.status)) { fStatus.input.value = d.status; fBizId.wrap.querySelector("label").textContent = status(d.status).idLabel; }
    fBiz.input.value = s(d.biz);
    fBizId.input.value = s(d.bizId);
    fAddr.input.value = s(d.address);
    fContact.input.value = s(d.contact);
    if (T.CURRENCIES.some((c) => c.code === d.currency)) fCur.input.value = d.currency;
    if (typeof d.vat === "string") fVat.input.value = d.vat;
    fPay.input.value = s(d.payment);
    fNotes.input.value = s(d.notes);
    if (typeof d.logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(d.logo)) { state.logo = d.logo; btnRemoveLogo.hidden = false; }
    say("נטענו הפרטים השמורים שלכם.");
  }

  // ----- print / PDF -----
  btnPdf.addEventListener("click", () => {
    update();
    const old = document.title;
    const num = val(fNum);
    document.title = docType(fType.input.value).title + (num ? " " + num : "");
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    setTimeout(restore, 2000);
  });

  renderLines();
  loadSaved();
  update();
})();
