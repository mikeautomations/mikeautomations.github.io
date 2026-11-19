// /en/quote-follow-up-generator/ client logic. Progressive enhancement: the page explains when to follow up without JS.
// No dependencies, no network requests, no cookies, no storage: nothing typed here leaves the device. The templates arrive
// as JSON in <script id="qfu-data"> (src/app/landing/data/tools/quote-follow-up.ts). PART 1 is a copy of selectTemplate and
// buildFollowUp from that file with the types removed; tests/tools-b-quote-follow-up.test.ts loads this file in a sandbox
// and checks both copies agree.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to quote-follow-up.ts) ----------
  const DAY_VALUES = ["3", "7", "14", "30"];
  const TONE_VALUES = ["friendly", "direct", "last"];

  function selectTemplate(days, tone) {
    const d = DAY_VALUES.indexOf(String(days)) >= 0 ? String(days) : "7";
    const o = TONE_VALUES.indexOf(String(tone)) >= 0 ? String(tone) : "friendly";
    if (d === "3" && o === "last") return { days: d, tone: "direct", adjusted: true };
    return { days: d, tone: o, adjusted: false };
  }

  const clean = (v) => String(v == null ? "" : v).trim();
  const AGO = { "3": "a few days ago", "7": "a week ago", "14": "two weeks ago", "30": "about a month ago" };

  function buildFollowUp(inputs, templates) {
    const sel = selectTemplate(inputs.days, inputs.tone);
    const t = templates[sel.days][sel.tone];
    const amount = clean(inputs.amount);
    const vals = {
      name: clean(inputs.name) || "there",
      item: clean(inputs.item) || "[what you quoted]",
      amountbit: amount ? " (" + amount + ")" : "",
      ago: AGO[sel.days],
      sender: clean(inputs.sender) || "[your name]",
    };
    const tidy = (s) => s.replace(/[ \t]{2,}/g, " ").replace(/ +([.,])/g, "$1").replace(/ +\n/g, "\n");
    const fill = (s) => tidy(s.replace(/\{(\w+)\}/g, (_, k) => (vals[k] != null ? vals[k] : ""))).trim();
    return { subject: fill(t.subject), body: t.body.map(fill).join("\n\n"), short: fill(t.short), days: sel.days, tone: sel.tone, adjusted: sel.adjusted };
  }
  // ---------- end PART 1 ----------

  root.QuoteFollowUp = { selectTemplate, buildFollowUp };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("qfu-app");
  const dataEl = document.getElementById("qfu-data");
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
    const id = "qfu-f" + ++uid;
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
  boxForm.setAttribute("aria-labelledby", "qfu-h-form");
  const hForm = el("h2", "lx-h3", "Your quote");
  hForm.id = "qfu-h-form";
  const fName = field("Client name", textInput({ autocomplete: "off" }), "First name is fine. Left empty, the message says \"Hi there\".");
  const fItem = field("What you quoted", textInput({ autocomplete: "off" }), "For example the kitchen refit, the website redesign or the monthly bookkeeping.");
  const fAmount = field("Amount (optional)", textInput({ autocomplete: "off" }), "Type it as you want it to read, for example £450 or $1,200. Left empty, it is left out.");
  const fDays = field("Days since you sent the quote", select(DATA.days, "7"));
  const fTone = field("Tone", select(DATA.tones, "friendly"));
  const fChannel = field("Where will you send it?", select(DATA.channels, "email"));
  const fSender = field("Your name or business", textInput({ autocomplete: "off" }));
  const g1 = el("div", "ft-grid");
  g1.append(fName.wrap, fItem.wrap, fAmount.wrap, fSender.wrap);
  const g2 = el("div", "ft-grid");
  g2.append(fDays.wrap, fTone.wrap, fChannel.wrap);
  boxForm.append(hForm, g1, g2);

  const boxOut = el("section", "ft-box");
  boxOut.setAttribute("aria-labelledby", "qfu-h-out");
  const hOut = el("h2", "lx-h3", "Your follow-up");
  hOut.id = "qfu-h-out";
  const note = el("p", "ft-hint");
  note.setAttribute("aria-live", "polite");

  const emailGroup = el("div", "ft-msg");
  const subjectOut = el("p", "ft-out ft-subject");
  subjectOut.id = "qfu-subject";
  const bodyOut = el("pre", "ft-out");
  bodyOut.id = "qfu-body";
  bodyOut.style.fontFamily = "inherit";
  const emailRow = el("div", "try-controls");
  const btnEmail = button("Copy email", true);
  const btnSubject = button("Copy subject only");
  const btnBody = button("Copy body only");
  emailRow.append(btnEmail, btnSubject, btnBody);
  emailGroup.append(el("p", "ft-hint", "Subject"), subjectOut, el("p", "ft-hint", "Body"), bodyOut, emailRow);

  const shortGroup = el("div", "ft-msg");
  const shortOut = el("pre", "ft-out");
  shortOut.id = "qfu-short";
  shortOut.style.fontFamily = "inherit";
  const count = el("p", "ft-hint");
  const shortRow = el("div", "try-controls");
  const btnShort = button("Copy message", true);
  shortRow.append(btnShort);
  shortGroup.append(el("p", "ft-hint", "Message"), shortOut, count, shortRow);

  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  boxOut.append(hOut, note, emailGroup, shortGroup, status);

  app.append(boxForm, boxOut);

  let current = { subject: "", body: "", short: "" };

  function update() {
    const r = buildFollowUp({
      days: fDays.input.value, tone: fTone.input.value, name: fName.input.value, item: fItem.input.value,
      amount: fAmount.input.value, sender: fSender.input.value,
    }, DATA.templates);
    current = r;
    const isEmail = fChannel.input.value !== "short";
    emailGroup.style.display = isEmail ? "" : "none";
    shortGroup.style.display = isEmail ? "none" : "";
    subjectOut.textContent = r.subject;
    bodyOut.textContent = r.body;
    shortOut.textContent = r.short;
    count.textContent = r.short.length + " characters";
    note.textContent = r.adjusted ? "A last check-in is too early at 3 days, so this is the direct version." : "";
  }

  async function copy(text, what) {
    status.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
      status.textContent = what + " copied.";
    } catch (e) {
      // Fallback: copy through a temporary textarea so it still works without the clipboard API.
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
      status.textContent = ok ? what + " copied." : "Could not copy. Select the text above and copy it yourself.";
    }
  }

  btnEmail.addEventListener("click", () => copy("Subject: " + current.subject + "\n\n" + current.body, "Email"));
  btnSubject.addEventListener("click", () => copy(current.subject, "Subject"));
  btnBody.addEventListener("click", () => copy(current.body, "Body"));
  btnShort.addEventListener("click", () => copy(current.short, "Message"));

  for (const f of [fDays, fTone, fChannel, fName, fItem, fAmount, fSender]) {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  }
  update();
})(typeof window !== "undefined" ? window : globalThis);
