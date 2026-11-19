// /en/payment-reminder-email-generator/ client logic. Progressive enhancement: the page explains when to send each
// reminder without JS. No dependencies, no network requests, no cookies, no storage: nothing typed here leaves the
// device. The email templates arrive as JSON in <script id="pre-data"> (src/app/landing/data/tools/payment-reminder.ts).
// PART 1 is a line-for-line copy of selectTemplate and buildReminder from that file with the types removed;
// tests/free-tools.test.ts loads this file in a sandbox and checks both copies agree.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to payment-reminder.ts) ----------
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
    const vals = {
      name: clean(inputs.name) || "there",
      invoice: clean(inputs.invoice) || "[invoice number]",
      amount: clean(inputs.amount) || "[amount]",
      dueon: due ? "on " + due : sel.timing === "before" ? "soon" : "",
      link: clean(inputs.link),
      sender: clean(inputs.sender) || "[your name]",
      replyby: clean(inputs.replyby) ? "by " + clean(inputs.replyby) : "within the next few days",
    };
    const link = vals.link;
    const tidy = (s) => s.replace(/[ \t]{2,}/g, " ").replace(/ +([.,])/g, "$1").replace(/ +\n/g, "\n");
    const fill = (s) => tidy(s.replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : ""))).trim();
    const paragraphs = [];
    for (const p of t.body) {
      const text = link ? p : p.replace(/\s*You can pay here: \{link\}/g, "");
      if (!text.trim()) continue;
      paragraphs.push(fill(text));
    }
    return { subject: fill(t.subject), body: paragraphs.join("\n\n"), timing: sel.timing, tone: sel.tone, adjusted: sel.adjusted };
  }

  root.PaymentReminder = { selectTemplate, buildReminder };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pre-app");
  const dataEl = document.getElementById("pre-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (text, primary) => {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  };
  let uid = 0;
  function field(label, input, hint) {
    const id = "pre-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    input.id = id;
    wrap.append(lab, input);
    if (hint) {
      const h = el("p", "ft-hint", hint);
      h.id = id + "-hint";
      input.setAttribute("aria-describedby", h.id);
      wrap.append(h);
    }
    return { wrap, input };
  }
  const textInput = (extra) => {
    const i = el("input");
    i.type = "text";
    if (extra) Object.assign(i, extra);
    return i;
  };
  const select = (options, value) => {
    const s = el("select");
    for (const o of options) {
      const opt = el("option", null, o.label);
      opt.value = o.value;
      s.append(opt);
    }
    s.value = value;
    return s;
  };

  app.textContent = "";

  const boxForm = el("section", "ft-box");
  boxForm.setAttribute("aria-labelledby", "pre-h-form");
  const hForm = el("h2", "lx-h3", "Your reminder");
  hForm.id = "pre-h-form";
  const fTiming = field("How overdue is the invoice?", select(DATA.timings, "d7"));
  const fTone = field("Tone", select(DATA.tones, "friendly"));
  const fName = field("Client name", textInput({ autocomplete: "off" }), "First name is fine. Left empty, the email says \"Hi there\".");
  const fInvoice = field("Invoice number", textInput({ autocomplete: "off" }));
  const fAmount = field("Amount", textInput({ autocomplete: "off" }), "Type it as you want it to read, for example £450.00 or $1,200.");
  const fDue = field("Due date (optional)", textInput({ autocomplete: "off" }), "For example 30 November 2026.");
  const fLink = field("Payment link (optional)", textInput({ autocomplete: "off" }), "A link to pay online. Left empty, that sentence is left out.");
  const fSender = field("Your name or business", textInput({ autocomplete: "off" }));
  const fReply = field("Pay or reply by (optional)", textInput({ autocomplete: "off" }), "Used by the firm and final notices. Left empty, they say \"within the next few days\".");
  const grid = el("div", "ft-grid");
  grid.append(fTiming.wrap, fTone.wrap);
  const grid2 = el("div", "ft-grid");
  grid2.append(fName.wrap, fInvoice.wrap, fAmount.wrap, fDue.wrap, fLink.wrap, fSender.wrap, fReply.wrap);
  boxForm.append(hForm, grid, grid2);

  const boxOut = el("section", "ft-box");
  boxOut.setAttribute("aria-labelledby", "pre-h-out");
  const hOut = el("h2", "lx-h3", "Your email");
  hOut.id = "pre-h-out";
  const note = el("p", "ft-hint");
  note.setAttribute("aria-live", "polite");
  const subjectLabel = el("p", "ft-hint", "Subject");
  const subjectOut = el("p", "ft-out ft-subject");
  subjectOut.id = "pre-subject";
  const bodyLabel = el("p", "ft-hint", "Body");
  const bodyOut = el("pre", "ft-out");
  bodyOut.id = "pre-body";
  bodyOut.style.fontFamily = "inherit";
  const copyRow = el("div", "try-controls");
  const btnCopyAll = button("Copy email", true);
  const btnCopySubject = button("Copy subject only");
  const btnCopyBody = button("Copy body only");
  copyRow.append(btnCopyAll, btnCopySubject, btnCopyBody);
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  boxOut.append(hOut, note, subjectLabel, subjectOut, bodyLabel, bodyOut, copyRow, status);

  app.append(boxForm, boxOut);

  let current = { subject: "", body: "" };

  function update() {
    const r = buildReminder({
      timing: fTiming.input.value, tone: fTone.input.value, name: fName.input.value, invoice: fInvoice.input.value,
      amount: fAmount.input.value, due: fDue.input.value, link: fLink.input.value, sender: fSender.input.value, replyby: fReply.input.value,
    }, DATA.templates);
    current = r;
    subjectOut.textContent = r.subject;
    bodyOut.textContent = r.body;
    note.textContent = r.adjusted ? "A final notice does not suit an invoice that is not overdue yet, so this is the firm version." : "";
  }

  async function copy(text, what) {
    status.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
      status.textContent = `${what} copied.`;
    } catch (e) {
      // Fallback: select the text so the person can copy it with the keyboard.
      const ta = el("textarea");
      ta.value = text;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      status.textContent = ok ? `${what} copied.` : "Could not copy. Select the text above and copy it yourself.";
    }
  }

  btnCopyAll.addEventListener("click", () => copy(`Subject: ${current.subject}\n\n${current.body}`, "Email"));
  btnCopySubject.addEventListener("click", () => copy(current.subject, "Subject"));
  btnCopyBody.addEventListener("click", () => copy(current.body, "Body"));

  for (const f of [fTiming, fTone, fName, fInvoice, fAmount, fDue, fLink, fSender, fReply]) {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  }
  update();
})(typeof window !== "undefined" ? window : globalThis);
