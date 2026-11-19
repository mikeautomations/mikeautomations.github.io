// /he/payment-reminder-generator/ client logic. Needs public/he-tools-core.js first. Progressive enhancement: the page
// explains when to send each reminder without JS. No dependencies, no network requests, no cookies, no storage: nothing
// typed here leaves the device. The templates arrive as JSON in <script id="hpre-data">
// (src/app/landing/he-tools/payment-reminder-he.ts). PART 1 is a copy of selectTemplate and buildReminder from that
// file with the types removed; tests/he-tools-a.test.ts loads this file in a sandbox and checks both copies agree.
// The WhatsApp button only builds a wa.me link from what the person typed: the message is sent by them, not by this page.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to payment-reminder-he.ts) ----------
  const TIMING_VALUES = ["before", "today", "d7", "d14", "d30"];
  const TONE_VALUES = ["friendly", "firm", "final"];

  function selectTemplate(timing, tone) {
    const t = TIMING_VALUES.indexOf(timing) >= 0 ? timing : "d7";
    const o = TONE_VALUES.indexOf(tone) >= 0 ? tone : "friendly";
    if ((t === "before" || t === "today") && o === "final") return { timing: t, tone: "firm", adjusted: true };
    return { timing: t, tone: o, adjusted: false };
  }

  const clean = (v) => String(v == null ? "" : v).trim();

  function buildReminder(inputs, templates) {
    const sel = selectTemplate(inputs.timing, inputs.tone);
    const t = templates[sel.timing][sel.tone];
    const due = clean(inputs.due);
    const reply = clean(inputs.replyby);
    const vals = {
      name: clean(inputs.name),
      invoice: clean(inputs.invoice) || "[מספר חשבונית]",
      amount: clean(inputs.amount) || "[סכום]",
      dueon: due ? "בתאריך " + due : "בקרוב",
      dueat: due ? " (מועד התשלום: " + due + ")" : "",
      link: clean(inputs.link),
      sender: clean(inputs.sender) || "[השם שלכם]",
      replyby: reply ? "עד " + reply : "בימים הקרובים",
    };
    const tidy = (s) => s.replace(/[ \t]{2,}/g, " ").replace(/ +([.,])/g, "$1").replace(/ +\n/g, "\n").replace(/^[,\s]+/, "");
    const fill = (s) => tidy(s.replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : ""))).trim();
    const make = (parts) => {
      const out = [];
      for (const p of parts) {
        if (!vals.link && p.indexOf("{link}") >= 0) continue;
        const text = fill(p);
        if (text) out.push(text);
      }
      return out;
    };
    return {
      subject: fill(t.subject),
      body: make(t.body).join("\n\n"),
      whatsapp: make(t.wa).join("\n"),
      timing: sel.timing, tone: sel.tone, adjusted: sel.adjusted,
    };
  }
  // ---------- end PART 1 ----------

  root.HePaymentReminder = { selectTemplate, buildReminder };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const T = root.HeTools;
  const app = document.getElementById("hpre-app");
  const dataEl = document.getElementById("hpre-data");
  if (!T || !app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const { el, button, field, textInput, select } = T;

  app.textContent = "";

  const fTiming = field("כמה זמן עבר?", select(DATA.timings, "d7"));
  const fTone = field("טון", select(DATA.tones, "friendly"));
  const fName = field("שם הלקוח", textInput("text", "", { autocomplete: "off" }), "שם פרטי מספיק. אם תשאירו ריק, ההודעה תתחיל ב\"שלום,\".");
  const fInvoice = field("מספר חשבונית", textInput("text", "", { autocomplete: "off" }));
  const fAmount = field("סכום", textInput("text", "", { autocomplete: "off" }), "כמו שתרצו שייראה, למשל 1,200 ₪.");
  const fDue = field("מועד התשלום (לא חובה)", textInput("text", "", { autocomplete: "off" }), "למשל 30.11.2026 או 30 בנובמבר.");
  const fLink = field("קישור לתשלום (לא חובה)", textInput("text", "", { autocomplete: "off", inputMode: "url" }), "קישור לתשלום מקוון, ביט או פייבוקס. אם תשאירו ריק, המשפט עם הקישור לא יופיע.");
  const fSender = field("השם שלכם או של העסק", textInput("text", "", { autocomplete: "off" }));
  const fReply = field("לשלם או להשיב עד (לא חובה)", textInput("text", "", { autocomplete: "off" }), "בשימוש בניסוח התקיף ובהודעה האחרונה. אם תשאירו ריק, ייכתב \"בימים הקרובים\".");
  const fPhone = field("טלפון הלקוח לוואטסאפ (לא חובה)", textInput("tel", "", { autocomplete: "off", inputMode: "tel", dir: "ltr" }), "למשל 054-123-4567. משמש רק כדי לבנות כפתור שפותח וואטסאפ אצלכם.");

  const boxForm = el("section", "ht-box");
  boxForm.setAttribute("aria-labelledby", "hpre-h-form");
  const hForm = el("h2", "lx-h3", "פרטי התזכורת");
  hForm.id = "hpre-h-form";
  const g1 = el("div", "ht-grid");
  g1.append(fTiming.wrap, fTone.wrap);
  const g2 = el("div", "ht-grid");
  g2.append(fName.wrap, fInvoice.wrap, fAmount.wrap, fDue.wrap, fLink.wrap, fSender.wrap, fReply.wrap, fPhone.wrap);
  boxForm.append(hForm, g1, g2);

  const note = el("p", "ht-hint");
  note.setAttribute("aria-live", "polite");

  // Email
  const boxMail = el("section", "ht-box");
  boxMail.setAttribute("aria-labelledby", "hpre-h-mail");
  const hMail = el("h2", "lx-h3", "הודעה במייל");
  hMail.id = "hpre-h-mail";
  const subjectOut = el("p", "ht-out ht-subject");
  subjectOut.id = "hpre-subject";
  const bodyOut = el("pre", "ht-out");
  bodyOut.id = "hpre-body";
  bodyOut.style.fontFamily = "inherit";
  const mailRow = el("div", "try-controls");
  const btnMail = button("העתקת המייל", true);
  const btnSubject = button("העתקת הנושא בלבד");
  const btnBody = button("העתקת הגוף בלבד");
  mailRow.append(btnMail, btnSubject, btnBody);
  const mailStatus = el("p", "ht-status");
  mailStatus.setAttribute("role", "status");
  mailStatus.setAttribute("aria-live", "polite");
  boxMail.append(hMail, el("p", "ht-hint", "נושא"), subjectOut, el("p", "ht-hint", "גוף ההודעה"), bodyOut, mailRow, mailStatus);

  // WhatsApp / SMS
  const boxWa = el("section", "ht-box");
  boxWa.setAttribute("aria-labelledby", "hpre-h-wa");
  const hWa = el("h2", "lx-h3", "הודעה קצרה לוואטסאפ או SMS");
  hWa.id = "hpre-h-wa";
  const waOut = el("pre", "ht-out");
  waOut.id = "hpre-wa";
  waOut.style.fontFamily = "inherit";
  const waRow = el("div", "try-controls");
  const btnWa = button("העתקת ההודעה", true);
  const waLink = el("a", "try-btn", "פתיחה בוואטסאפ");
  waLink.target = "_blank";
  waLink.rel = "noopener noreferrer";
  waLink.hidden = true;
  waRow.append(btnWa, waLink);
  const waStatus = el("p", "ht-status");
  waStatus.setAttribute("role", "status");
  waStatus.setAttribute("aria-live", "polite");
  boxWa.append(hWa, waOut, waRow, waStatus, el("p", "ht-hint", "הכפתור \"פתיחה בוואטסאפ\" מופיע כשכותבים מספר טלפון תקין. ההודעה לא נשלחת לבד: אתם בודקים ולוחצים על שליחה."));

  app.append(boxForm, note, boxMail, boxWa);

  let current = { subject: "", body: "", whatsapp: "" };

  function update() {
    const r = buildReminder({
      timing: fTiming.input.value, tone: fTone.input.value, name: fName.input.value, invoice: fInvoice.input.value,
      amount: fAmount.input.value, due: fDue.input.value, link: fLink.input.value, sender: fSender.input.value, replyby: fReply.input.value,
    }, DATA.templates);
    current = r;
    subjectOut.textContent = r.subject;
    bodyOut.textContent = r.body;
    waOut.textContent = r.whatsapp;
    note.textContent = r.adjusted ? "הודעה אחרונה לא מתאימה לחשבונית שעדיין לא באיחור, ולכן זה הניסוח התקיף." : "";
    const phone = T.normalizePhone(fPhone.input.value);
    if (phone) { waLink.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(r.whatsapp); waLink.hidden = false; }
    else { waLink.removeAttribute("href"); waLink.hidden = true; }
  }

  btnMail.addEventListener("click", () => T.copy("נושא: " + current.subject + "\n\n" + current.body, "המייל", mailStatus));
  btnSubject.addEventListener("click", () => T.copy(current.subject, "הנושא", mailStatus));
  btnBody.addEventListener("click", () => T.copy(current.body, "הגוף", mailStatus));
  btnWa.addEventListener("click", () => T.copy(current.whatsapp, "ההודעה", waStatus));

  [fTiming, fTone, fName, fInvoice, fAmount, fDue, fLink, fSender, fReply, fPhone].forEach((f) => {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  });
  update();
})(typeof window !== "undefined" ? window : globalThis);
