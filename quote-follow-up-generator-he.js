// /he/quote-follow-up-generator/ client logic. Needs public/he-tools-core.js first. Progressive enhancement: the page
// explains when to follow up without JS. No dependencies, no network requests, no cookies, no storage: nothing typed here
// leaves the device. The templates arrive as JSON in <script id="hqfu-data"> (src/app/landing/he-tools/quote-follow-up-he.ts).
// PART 1 is a copy of selectTemplate and buildFollowUp from that file with the types removed;
// tests/tools-b-quote-follow-up.test.ts loads this file in a sandbox and checks both copies agree.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to quote-follow-up-he.ts) ----------
  const DAY_VALUES = ["3", "7", "14", "30"];
  const TONE_VALUES = ["friendly", "direct", "last"];

  function selectTemplate(days, tone) {
    const d = DAY_VALUES.indexOf(String(days)) >= 0 ? String(days) : "7";
    const o = TONE_VALUES.indexOf(String(tone)) >= 0 ? String(tone) : "friendly";
    if (d === "3" && o === "last") return { days: d, tone: "direct", adjusted: true };
    return { days: d, tone: o, adjusted: false };
  }

  const clean = (v) => String(v == null ? "" : v).trim();
  const AGO = { "3": "לפני כמה ימים", "7": "לפני שבוע", "14": "לפני שבועיים", "30": "לפני כחודש" };

  function buildFollowUp(inputs, templates) {
    const sel = selectTemplate(inputs.days, inputs.tone);
    const t = templates[sel.days][sel.tone];
    const amount = clean(inputs.amount);
    const vals = {
      name: clean(inputs.name),
      item: clean(inputs.item) || "[נושא ההצעה]",
      amountbit: amount ? " (על סך " + amount + ")" : "",
      ago: AGO[sel.days],
      sender: clean(inputs.sender) || "[השם שלכם]",
    };
    const tidy = (s) => s.replace(/[ \t]{2,}/g, " ").replace(/ +([.,])/g, "$1").replace(/ +\n/g, "\n").replace(/^[,\s]+/, "");
    const fill = (s) => tidy(s.replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : ""))).trim();
    return { subject: fill(t.subject), body: t.body.map(fill).join("\n\n"), short: fill(t.short), days: sel.days, tone: sel.tone, adjusted: sel.adjusted };
  }
  // ---------- end PART 1 ----------

  root.HeQuoteFollowUp = { selectTemplate, buildFollowUp };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const T = root.HeTools;
  const app = document.getElementById("hqfu-app");
  const dataEl = document.getElementById("hqfu-data");
  if (!T || !app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const { el, button, field, textInput, select } = T;

  app.textContent = "";

  const fChannel = field("איפה תשלחו?", select(DATA.channels, "whatsapp"));
  const fDays = field("כמה ימים עברו מאז שליחת ההצעה?", select(DATA.days, "7"));
  const fTone = field("טון", select(DATA.tones, "friendly"));
  const fName = field("שם הלקוח", textInput("text", "", { autocomplete: "off" }), "שם פרטי מספיק. אם תשאירו ריק, ההודעה תתחיל ב\"שלום,\" או ב\"היי,\".");
  const fItem = field("מה הצעתם", textInput("text", "", { autocomplete: "off" }), "למשל שיפוץ המטבח, עיצוב האתר או הנהלת החשבונות החודשית.");
  const fAmount = field("סכום (לא חובה)", textInput("text", "", { autocomplete: "off" }), "כמו שתרצו שייראה, למשל 4,800 ₪. אם תשאירו ריק, הוא לא יופיע.");
  const fSender = field("השם שלכם או של העסק", textInput("text", "", { autocomplete: "off" }));

  const boxForm = el("section", "ht-box");
  boxForm.setAttribute("aria-labelledby", "hqfu-h-form");
  const hForm = el("h2", "lx-h3", "פרטי ההצעה");
  hForm.id = "hqfu-h-form";
  const g1 = el("div", "ht-grid");
  g1.append(fChannel.wrap, fDays.wrap, fTone.wrap);
  const g2 = el("div", "ht-grid");
  g2.append(fName.wrap, fItem.wrap, fAmount.wrap, fSender.wrap);
  boxForm.append(hForm, g1, g2);

  const note = el("p", "ht-hint");
  note.setAttribute("aria-live", "polite");

  // WhatsApp / SMS (first)
  const boxWa = el("section", "ht-box");
  boxWa.setAttribute("aria-labelledby", "hqfu-h-wa");
  const hWa = el("h2", "lx-h3", "הודעה קצרה לוואטסאפ או SMS");
  hWa.id = "hqfu-h-wa";
  const waOut = el("pre", "ht-out");
  waOut.id = "hqfu-wa";
  waOut.style.fontFamily = "inherit";
  const count = el("p", "ht-hint");
  const waRow = el("div", "try-controls");
  const btnWa = button("העתקת ההודעה", true);
  waRow.append(btnWa);
  const waStatus = el("p", "ht-status");
  waStatus.setAttribute("role", "status");
  waStatus.setAttribute("aria-live", "polite");
  boxWa.append(hWa, waOut, count, waRow, waStatus);

  // Email
  const boxMail = el("section", "ht-box");
  boxMail.setAttribute("aria-labelledby", "hqfu-h-mail");
  const hMail = el("h2", "lx-h3", "הודעה במייל");
  hMail.id = "hqfu-h-mail";
  const subjectOut = el("p", "ht-out ht-subject");
  subjectOut.id = "hqfu-subject";
  const bodyOut = el("pre", "ht-out");
  bodyOut.id = "hqfu-body";
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

  app.append(boxForm, note, boxWa, boxMail);

  let current = { subject: "", body: "", short: "" };

  function update() {
    const r = buildFollowUp({
      days: fDays.input.value, tone: fTone.input.value, name: fName.input.value, item: fItem.input.value,
      amount: fAmount.input.value, sender: fSender.input.value,
    }, DATA.templates);
    current = r;
    const isMail = fChannel.input.value === "email";
    boxWa.hidden = isMail;
    boxMail.hidden = !isMail;
    waOut.textContent = r.short;
    count.textContent = r.short.length + " תווים";
    subjectOut.textContent = r.subject;
    bodyOut.textContent = r.body;
    note.textContent = r.adjusted ? "בדיקה אחרונה מוקדמת מדי אחרי 3 ימים, ולכן זו הגרסה הישירה." : "";
  }

  btnWa.addEventListener("click", () => T.copy(current.short, "ההודעה", waStatus));
  btnMail.addEventListener("click", () => T.copy("נושא: " + current.subject + "\n\n" + current.body, "המייל", mailStatus));
  btnSubject.addEventListener("click", () => T.copy(current.subject, "הנושא", mailStatus));
  btnBody.addEventListener("click", () => T.copy(current.body, "הגוף", mailStatus));

  [fChannel, fDays, fTone, fName, fItem, fAmount, fSender].forEach((f) => {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  });
  update();
})(typeof window !== "undefined" ? window : globalThis);
