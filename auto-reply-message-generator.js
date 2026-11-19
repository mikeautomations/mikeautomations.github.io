// /en/auto-reply-message-generator/ client logic. Progressive enhancement: the page already shows example messages without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is src/app/landing/data/tools/auto-reply.ts with the types removed (keep identical).
// tests/auto-reply-message-generator.test.ts loads this file in a sandbox and checks both copies give identical output.
(function (root) {
  "use strict";

  // ---------- PART 1: pure builder (keep identical to auto-reply.ts) ----------
  // Templates and pure builder behind /en/auto-reply-message-generator/. No DOM, no network. The browser gets the same code:
  // public/auto-reply-message-generator.js PART 1 is this file's functions with the types removed (tests/auto-reply-message-generator.test.ts
  // loads that file in a sandbox and checks both copies give identical output).
  // A message is made of short parts (thanks, status, reply time, urgent contact, booking link, sign-off). Each situation and tone
  // supplies the wording; the channel decides the shape: email gets a subject, greeting and sign-off, a website form gets
  // an on-screen confirmation with neither, WhatsApp gets a short chat message with no sign-off.
  const SITUATIONS = [
      { id: "after-hours", label: "After hours", hint: "Someone writes while you are closed.", where: "Use it for evenings, nights and weekends." },
      { id: "holiday", label: "Holiday or out of office", hint: "You are away for days or weeks.", where: "Set the return date so people know when to expect a reply." },
      { id: "new-enquiry", label: "New enquiry received", hint: "Confirm you got the enquiry.", where: "Sent straight away, in working hours or not." },
      { id: "busy", label: "Busy period", hint: "Replies are slower than usual.", where: "Switch it on when the inbox is behind, off when it is not." },
  ];
  const CHANNELS = [
      { id: "email", label: "Email", hint: "Subject, greeting and sign-off." },
      { id: "form", label: "Website form", hint: "The message shown after someone sends your contact form." },
      { id: "whatsapp", label: "WhatsApp Business", hint: "Short and chatty, no sign-off." },
  ];
  const TONES = [
      { id: "friendly", label: "Friendly", hint: "Warm and plain." },
      { id: "professional", label: "Professional", hint: "Formal and polite." },
      { id: "short", label: "Short", hint: "As few words as possible." },
  ];
  /** The details worth asking for in each situation. */
  const FIELD_LABELS = {
      business: { label: "Business name", hint: "Optional.", placeholder: "Example Plumbing" },
      signOff: { label: "Sign-off name", hint: "Optional. Used at the end of an email.", placeholder: "Sam at Example Plumbing" },
      hours: { label: "Opening hours", hint: "Optional.", placeholder: "Monday to Friday, 9am to 5pm" },
      backOn: { label: "Back on", hint: "Optional. The day you return.", placeholder: "Monday 5 January" },
      replyTime: { label: "When will you reply?", hint: "Finishes the sentence \"We'll reply ...\". Only promise what you can keep.", placeholder: "within one working day" },
      urgent: { label: "Urgent contact", hint: "Optional. A number or address for urgent matters.", placeholder: "07700 900123" },
      bookingUrl: { label: "Booking link", hint: "Optional. Your online booking page.", placeholder: "example.com/book", type: "url" },
  };
  const COMMON = ["business", "replyTime", "urgent", "bookingUrl"];
  /** Which fields to show for a situation and channel. */
  function fieldsFor(situation, channel = "email") {
      const f = ["business"];
      if (channel === "email")
          f.push("signOff");
      if (situation === "after-hours")
          f.push("hours");
      if (situation === "holiday")
          f.push("backOn");
      for (const id of COMMON)
          if (!f.includes(id))
              f.push(id);
      return f;
  }
  const cleanLine = (s, max = 160) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
  /** An http(s) link, or null. A bare "example.com/book" gets https://. */
  function safeLink(raw) {
      let t = String(raw == null ? "" : raw).trim();
      if (!t)
          return null;
      if (!/^https?:\/\//i.test(t))
          t = "https://" + t;
      return /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?([/?#][^\s"'<>]*)?$/i.test(t) ? t : null;
  }
  const paren = (s, pre = "") => (s ? ` (${pre}${s})` : "");
  /** The wording for each situation and tone. */
  const TEMPLATES = {
      "after-hours": {
          friendly: {
              status: (d) => `We're away from our desks right now${paren(d.hours, "we're open ")}, but your message is safe and we'll read it as soon as we're back.`,
              defaultReply: "when we're next open",
              subject: (d) => `We've got your message${d.b ? ` - ${d.b}` : ""}`,
          },
          professional: {
              status: (d) => `Our office is currently closed${paren(d.hours, "opening hours: ")}. Your message has been received and will be dealt with when we reopen.`,
              defaultReply: "when we next open",
              subject: (d) => `Your message has been received${d.b ? ` - ${d.b}` : ""}`,
          },
          short: {
              status: (d) => `We're closed right now${paren(d.hours, "open ")}, but we have your message.`,
              defaultReply: "when we're back",
              subject: (d) => `Got your message${d.b ? ` - ${d.b}` : ""}`,
          },
      },
      holiday: {
          friendly: {
              status: (d) => `We're away${d.backOn ? ` and back on ${d.backOn}` : ""}, so replies will be slower than usual.`,
              defaultReply: "when we're back",
              subject: (d) => `Out of office${d.backOn ? `: back on ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
          },
          professional: {
              status: (d) => `We are currently out of the office${d.backOn ? ` and will return on ${d.backOn}` : ""}. Messages are not checked regularly until then.`,
              defaultReply: "on our return",
              subject: (d) => `Out of office${d.backOn ? `: returning ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
          },
          short: {
              status: (d) => `We're away${d.backOn ? ` until ${d.backOn}` : ""}.`,
              defaultReply: "when we're back",
              subject: (d) => `Away${d.backOn ? ` until ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
          },
      },
      "new-enquiry": {
          friendly: {
              status: () => "We've got your enquiry and a real person will read it.",
              defaultReply: "as soon as we can",
              subject: (d) => `We've got your enquiry${d.b ? ` - ${d.b}` : ""}`,
          },
          professional: {
              status: () => "We have received your enquiry and it has been passed to the right person.",
              defaultReply: "as soon as possible",
              subject: (d) => `Your enquiry has been received${d.b ? ` - ${d.b}` : ""}`,
          },
          short: {
              status: () => "We have your enquiry.",
              defaultReply: "as soon as we can",
              subject: (d) => `Enquiry received${d.b ? ` - ${d.b}` : ""}`,
          },
      },
      busy: {
          friendly: {
              status: () => "We're busier than usual at the moment, so replies are taking a little longer. Thanks for your patience.",
              defaultReply: "as soon as we can",
              subject: (d) => `We've got your message, replies are a little slower${d.b ? ` - ${d.b}` : ""}`,
          },
          professional: {
              status: () => "We are experiencing a high volume of messages at present, so responses may take longer than usual. Thank you for your patience.",
              defaultReply: "as soon as possible",
              subject: (d) => `Your message has been received${d.b ? ` - ${d.b}` : ""}`,
          },
          short: {
              status: () => "We're very busy right now, so replies are slower than usual.",
              defaultReply: "as soon as we can",
              subject: (d) => `Busy, but we have your message${d.b ? ` - ${d.b}` : ""}`,
          },
      },
  };
  const WORDS = {
      friendly: {
          hi: "Hi there,",
          bye: "Speak soon,",
          thanks: (b, k) => (k === "new-enquiry" ? `Thanks for getting in touch${b ? ` with ${b}` : ""}.` : `Thanks for your message${b ? ` to ${b}` : ""}.`),
          reply: (w) => `We'll reply ${w}.`,
          urgent: (u) => `If it's urgent, please contact ${u}.`,
          book: (url) => `Prefer to talk it through? You can book a time here: ${url}`,
      },
      professional: {
          hi: "Hello,",
          bye: "Kind regards,",
          thanks: (b) => `Thank you for contacting ${b || "us"}.`,
          reply: (w) => `We will respond ${w}.`,
          urgent: (u) => `For urgent matters, please contact ${u}.`,
          book: (url) => `To arrange an appointment, you can book a time here: ${url}`,
      },
      short: {
          hi: "Hi,",
          bye: "Thanks,",
          thanks: (b) => `Thanks for your message${b ? ` to ${b}` : ""}.`,
          reply: (w) => `We'll reply ${w}.`,
          urgent: (u) => `Urgent? ${u}`,
          book: (url) => `Book a time: ${url}`,
      },
  };
  const templateKey = (situation, tone, channel) => `${situation}/${tone}/${channel}`;
  const isSituation = (s) => s === "after-hours" || s === "holiday" || s === "new-enquiry" || s === "busy";
  const isChannel = (s) => s === "email" || s === "form" || s === "whatsapp";
  const isTone = (s) => s === "friendly" || s === "professional" || s === "short";
  /** Builds the message. Unknown situation, channel or tone fall back to after-hours, email and friendly. */
  function buildAutoReply(input) {
      const situation = isSituation(input.situation) ? input.situation : "after-hours";
      const channel = isChannel(input.channel) ? input.channel : "email";
      const tone = isTone(input.tone) ? input.tone : "friendly";
      const warnings = [];
      const t = TEMPLATES[situation][tone];
      const w = WORDS[tone];
      const b = cleanLine(input.business, 100);
      const d = { b, hours: cleanLine(input.hours, 80), backOn: cleanLine(input.backOn, 60), reply: cleanLine(input.replyTime, 80) };
      const link = safeLink(input.bookingUrl);
      if (cleanLine(input.bookingUrl) && !link)
          warnings.push("The booking link does not look like a web address, so it was left out.");
      const urgent = cleanLine(input.urgent, 120);
      const paragraphs = [];
      paragraphs.push([w.thanks(b, situation), t.status(d), w.reply(d.reply || t.defaultReply)].join(" "));
      if (urgent)
          paragraphs.push(w.urgent(urgent));
      if (link)
          paragraphs.push(w.book(link));
      let body;
      if (channel === "email") {
          const sign = cleanLine(input.signOff, 80) || b;
          body = [w.hi, ...paragraphs, sign ? `${w.bye}\n${sign}` : w.bye.replace(/,$/, ".")].join("\n\n");
      }
      else if (channel === "form") {
          body = paragraphs.join("\n\n");
      }
      else {
          body = [w.hi, ...paragraphs].join("\n\n");
      }
      const subject = channel === "email" ? t.subject(d) : "";
      const text = subject ? `Subject: ${subject}\n\n${body}` : body;
      return { subject, body, text, warnings };
  }

  const API = { SITUATIONS, CHANNELS, TONES, FIELD_LABELS, fieldsFor, cleanLine, safeLink, TEMPLATES, templateKey, buildAutoReply };
  root.AutoReply = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ar-app");
  if (!app) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  const state = { situation: "after-hours", channel: "email", tone: "friendly" };
  const ORDER = ["business", "signOff", "hours", "backOn", "replyTime", "urgent", "bookingUrl"];

  function radios(legend, name, items, key) {
    const set = el("fieldset", "ar-set");
    set.append(el("legend", null, legend));
    const row = el("div", "ar-choices");
    items.forEach((it) => {
      const id = "ar-r" + ++uid;
      const wrap = el("div", "ar-choice");
      const r = el("input");
      r.type = "radio"; r.name = name; r.id = id; r.value = it.id; r.checked = state[key] === it.id;
      const lab = el("label", null, it.label);
      lab.htmlFor = id;
      const hint = el("span", "ar-hint", it.hint);
      hint.id = id + "-h";
      r.setAttribute("aria-describedby", hint.id);
      r.addEventListener("change", () => { state[key] = it.id; render(); });
      wrap.append(r, lab, hint);
      row.append(wrap);
    });
    set.append(row);
    return set;
  }

  const form = el("section", "ar-box");
  form.setAttribute("aria-labelledby", "ar-form-h");
  const fh = el("h2", "lx-h3", "Build your message");
  fh.id = "ar-form-h";
  form.append(fh, radios("1. Situation", "ar-situation", SITUATIONS, "situation"), radios("2. Where will it be used?", "ar-channel", CHANNELS, "channel"), radios("3. Tone", "ar-tone", TONES, "tone"));

  const details = el("fieldset", "ar-set");
  details.append(el("legend", null, "4. Your details"));
  const grid = el("div", "ar-grid");
  const fields = {};
  ORDER.forEach((key) => {
    const meta = FIELD_LABELS[key];
    const id = "ar-f" + ++uid;
    const wrap = el("div", "ar-field");
    const lab = el("label", null, meta.label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = meta.type === "url" ? "url" : "text";
    input.placeholder = meta.placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    const h = el("span", "ar-hint", meta.hint);
    h.id = id + "-h";
    input.setAttribute("aria-describedby", h.id);
    input.addEventListener("input", render);
    wrap.append(lab, input, h);
    fields[key] = { wrap, input };
    grid.append(wrap);
  });
  details.append(grid);
  form.append(details);

  const out = el("section", "ar-box");
  out.setAttribute("aria-labelledby", "ar-out-h");
  const oh = el("h2", "lx-h3", "Your message");
  oh.id = "ar-out-h";
  const subjWrap = el("div", "ar-field");
  const subjLab = el("label", null, "Subject");
  subjLab.htmlFor = "ar-subject";
  const subject = el("input");
  subject.id = "ar-subject"; subject.type = "text"; subject.readOnly = true;
  subjWrap.append(subjLab, subject);
  const bodyWrap = el("div", "ar-field");
  const bodyLab = el("label", null, "Message");
  bodyLab.htmlFor = "ar-body";
  const body = el("textarea", "ar-text");
  body.id = "ar-body"; body.rows = 12; body.readOnly = true;
  const count = el("span", "ar-hint");
  count.id = "ar-count";
  body.setAttribute("aria-describedby", "ar-count");
  bodyWrap.append(bodyLab, body, count);
  const warn = el("p", "ar-warn");
  const copyRow = el("div", "try-controls");
  const copyMsg = el("button", "try-btn try-btn-primary", "Copy message");
  copyMsg.type = "button";
  const copySubj = el("button", "try-btn", "Copy subject");
  copySubj.type = "button";
  const status = el("p", "ar-status");
  status.setAttribute("role", "status");
  copyRow.append(copyMsg, copySubj);
  const where = el("p", "ar-hint");
  out.append(oh, subjWrap, bodyWrap, warn, copyRow, status, where);

  async function copyText(text, input) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        status.textContent = "Copied.";
        return;
      }
    } catch (e) { /* fall back to selecting */ }
    input.focus();
    input.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    status.textContent = ok ? "Copied." : "Selected. Press Ctrl+C (Cmd+C on a Mac) to copy.";
  }
  copyMsg.addEventListener("click", () => copyText(body.value, body));
  copySubj.addEventListener("click", () => copyText(subject.value, subject));

  function render() {
    status.textContent = "";
    const show = fieldsFor(state.situation, state.channel);
    ORDER.forEach((k) => { fields[k].wrap.hidden = show.indexOf(k) === -1; });
    const v = { situation: state.situation, channel: state.channel, tone: state.tone };
    ORDER.forEach((k) => { if (show.indexOf(k) !== -1) v[k] = fields[k].input.value; });
    const r = buildAutoReply(v);
    subject.value = r.subject;
    subjWrap.hidden = !r.subject;
    copySubj.hidden = !r.subject;
    body.value = r.body;
    count.textContent = r.body.length + " characters";
    warn.textContent = r.warnings.join(" ");
    const s = SITUATIONS.filter((x) => x.id === state.situation)[0];
    where.textContent = s ? s.where : "";
  }

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Generator"), document.createTextNode(" Works in your browser. Nothing you type is sent anywhere."));
  app.append(intro, form, out);
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
