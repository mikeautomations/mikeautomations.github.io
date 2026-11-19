// /he/auto-reply-messages/ client logic (Hebrew, RTL). Progressive enhancement: the page already shows example messages without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is src/app/landing/he-tools/auto-reply-messages-logic.ts with the types removed (keep identical).
// tests/he-tools-b.test.ts loads this file in a sandbox and checks both copies give identical output.
// PART 2 reads the situations, channels, tones, field labels and texts from <script id="ar-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure builder (keep identical to auto-reply-messages-logic.ts) ----------
  function fieldsFor(situation, channel) {
    if (channel === void 0) channel = "whatsapp";
    const COMMON = ["business", "replyTime", "urgent", "bookingUrl"];
    const f = ["business"];
    if (channel === "email") f.push("signOff");
    if (situation === "after-hours") f.push("hours");
    if (situation === "holiday") f.push("greeting", "backOn");
    for (const id of COMMON) if (!f.includes(id)) f.push(id);
    return f;
  }

  const cleanLine = (s, max = 160) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);

  function safeLink(raw) {
    let t = String(raw == null ? "" : raw).trim();
    if (!t) return null;
    if (!/^https?:\/\//i.test(t)) t = "https://" + t;
    return /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?([/?#][^\s"'<>]*)?$/i.test(t) ? t : null;
  }

  const paren = (s, pre = "") => (s ? ` (${pre}${s})` : "");

  const TEMPLATES = {
    "after-hours": {
      friendly: {
        status: (d) => `אנחנו לא זמינים כרגע${paren(d.hours, "שעות הפעילות: ")}, אבל ההודעה שלכם אצלנו ונקרא אותה ברגע שנחזור.`,
        defaultReply: "כשנחזור לפעילות",
        subject: (d) => `קיבלנו את ההודעה${d.b ? ` - ${d.b}` : ""}`,
      },
      professional: {
        status: (d) => `המשרד סגור כעת${paren(d.hours, "שעות פעילות: ")}. פנייתכם התקבלה ותטופל עם חזרתנו לפעילות.`,
        defaultReply: "עם חזרתנו לפעילות",
        subject: (d) => `פנייתכם התקבלה${d.b ? ` - ${d.b}` : ""}`,
      },
      short: {
        status: (d) => `אנחנו סגורים כרגע${paren(d.hours, "פתוחים ")}, אבל קיבלנו את ההודעה.`,
        defaultReply: "כשנחזור",
        subject: (d) => `קיבלנו את ההודעה${d.b ? ` - ${d.b}` : ""}`,
      },
    },
    holiday: {
      friendly: {
        status: (d) => `אנחנו בחופשה${d.backOn ? ` ונחזור לפעילות: ${d.backOn}` : ""}, אז המענה יהיה איטי מהרגיל.`,
        defaultReply: "כשנחזור",
        subject: (d) => `אנחנו בחופשה${d.backOn ? `, חוזרים: ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
      },
      professional: {
        status: (d) => `אנו נמצאים כעת בחופשה${d.backOn ? ` וחוזרים לפעילות: ${d.backOn}` : ""}. הודעות אינן נבדקות באופן שוטף עד אז.`,
        defaultReply: "עם שובנו",
        subject: (d) => `הודעת היעדרות${d.backOn ? `: חזרה ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
      },
      short: {
        status: (d) => `אנחנו בחופשה${d.backOn ? `, חוזרים: ${d.backOn}` : ""}.`,
        defaultReply: "כשנחזור",
        subject: (d) => `בחופשה${d.backOn ? `, חוזרים: ${d.backOn}` : ""}${d.b ? ` - ${d.b}` : ""}`,
      },
    },
    "new-enquiry": {
      friendly: {
        status: () => "קיבלנו את הפנייה, ואדם אמיתי יקרא אותה.",
        defaultReply: "בהקדם",
        subject: (d) => `קיבלנו את הפנייה${d.b ? ` - ${d.b}` : ""}`,
      },
      professional: {
        status: () => "פנייתכם התקבלה והועברה לגורם המתאים.",
        defaultReply: "בהקדם האפשרי",
        subject: (d) => `פנייתכם התקבלה${d.b ? ` - ${d.b}` : ""}`,
      },
      short: {
        status: () => "קיבלנו את הפנייה.",
        defaultReply: "בהקדם",
        subject: (d) => `הפנייה התקבלה${d.b ? ` - ${d.b}` : ""}`,
      },
    },
    busy: {
      friendly: {
        status: () => "יש לנו עומס גדול כרגע, אז המענה לוקח קצת יותר זמן מהרגיל. תודה על הסבלנות.",
        defaultReply: "בהקדם",
        subject: (d) => `קיבלנו את ההודעה, המענה איטי יותר כרגע${d.b ? ` - ${d.b}` : ""}`,
      },
      professional: {
        status: () => "אנו מקבלים כעת כמות גדולה של פניות, ולכן זמן המענה ארוך מהרגיל. תודה על הסבלנות.",
        defaultReply: "בהקדם האפשרי",
        subject: (d) => `פנייתכם התקבלה${d.b ? ` - ${d.b}` : ""}`,
      },
      short: {
        status: () => "עמוסים כרגע, והמענה איטי מהרגיל.",
        defaultReply: "בהקדם",
        subject: (d) => `עמוסים, אבל קיבלנו את ההודעה${d.b ? ` - ${d.b}` : ""}`,
      },
    },
  };

  const WORDS = {
    friendly: {
      hi: "היי,",
      bye: "נדבר בקרוב,",
      thanks: (b, k) => (k === "new-enquiry" ? `תודה על הפנייה${b ? ` אל ${b}` : ""}.` : `תודה על ההודעה${b ? ` אל ${b}` : ""}.`),
      reply: (w) => `נחזור אליכם ${w}.`,
      urgent: (u) => `אם זה דחוף, אפשר ליצור קשר: ${u}`,
      book: (url) => `מעדיפים לדבר? אפשר לקבוע שיחה כאן: ${url}`,
    },
    professional: {
      hi: "שלום,",
      bye: "בברכה,",
      thanks: (b) => `תודה על פנייתכם${b ? ` אל ${b}` : ""}.`,
      reply: (w) => `נשיב ${w}.`,
      urgent: (u) => `לעניינים דחופים ניתן לפנות אל: ${u}`,
      book: (url) => `לקביעת פגישה ניתן להיכנס לקישור: ${url}`,
    },
    short: {
      hi: "היי,",
      bye: "תודה,",
      thanks: (b) => `תודה על ההודעה${b ? ` אל ${b}` : ""}.`,
      reply: (w) => `נחזור אליכם ${w}.`,
      urgent: (u) => `דחוף? ${u}`,
      book: (url) => `לקביעת תור: ${url}`,
    },
  };

  const isSituation = (s) => s === "after-hours" || s === "holiday" || s === "new-enquiry" || s === "busy";
  const isChannel = (s) => s === "email" || s === "form" || s === "whatsapp";
  const isTone = (s) => s === "friendly" || s === "professional" || s === "short";

  function buildAutoReplyHe(input) {
    const situation = isSituation(input.situation) ? input.situation : "after-hours";
    const channel = isChannel(input.channel) ? input.channel : "whatsapp";
    const tone = isTone(input.tone) ? input.tone : "friendly";
    const warnings = [];

    const t = TEMPLATES[situation][tone];
    const w = WORDS[tone];
    const b = cleanLine(input.business, 100);
    const d = { b, hours: cleanLine(input.hours, 80), backOn: cleanLine(input.backOn, 60), reply: cleanLine(input.replyTime, 80) };

    const link = safeLink(input.bookingUrl);
    if (cleanLine(input.bookingUrl) && !link) warnings.push("הקישור לקביעת תור לא נראה ככתובת אינטרנט, ולכן הוא הושמט.");

    const urgent = cleanLine(input.urgent, 120);
    const greeting = situation === "holiday" ? cleanLine(input.greeting, 60) : "";
    const paragraphs = [];
    const main = [w.thanks(b, situation), t.status(d), w.reply(d.reply || t.defaultReply)].join(" ");
    paragraphs.push(greeting ? `${greeting} ${main}` : main);
    if (urgent) paragraphs.push(w.urgent(urgent));
    if (link) paragraphs.push(w.book(link));

    let body;
    if (channel === "email") {
      const sign = cleanLine(input.signOff, 80) || b;
      body = [w.hi, ...paragraphs, sign ? `${w.bye}\n${sign}` : w.bye.replace(/,$/, ".")].join("\n\n");
    } else if (channel === "form") {
      body = paragraphs.join("\n\n");
    } else {
      body = [w.hi, ...paragraphs].join("\n\n");
    }
    const subject = channel === "email" ? t.subject(d) : "";
    const text = subject ? `נושא: ${subject}\n\n${body}` : body;
    return { subject, body, text, warnings };
  }

  root.AutoReplyHe = { buildAutoReplyHe, fieldsFor, safeLink, cleanLine };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ar-app");
  const dataEl = document.getElementById("ar-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const T = DATA.ui;
  const FIELD_LABELS = DATA.fields;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  const state = { situation: "after-hours", channel: "whatsapp", tone: "friendly" };
  const ORDER = ["business", "signOff", "hours", "greeting", "backOn", "replyTime", "urgent", "bookingUrl"];

  function radios(legend, name, items, key) {
    const set = el("fieldset", "ft-set");
    set.append(el("legend", null, legend));
    const row = el("div", "ft-choices");
    items.forEach((it) => {
      const id = "ar-r" + ++uid;
      const wrap = el("div", "ft-choice");
      const r = el("input");
      r.type = "radio"; r.name = name; r.id = id; r.value = it.id; r.checked = state[key] === it.id;
      const lab = el("label", null, it.label);
      lab.htmlFor = id;
      const hint = el("span", "ft-hint", it.hint);
      hint.id = id + "-h";
      r.setAttribute("aria-describedby", hint.id);
      r.addEventListener("change", () => { state[key] = it.id; render(); });
      wrap.append(r, lab, hint);
      row.append(wrap);
    });
    set.append(row);
    return set;
  }

  const form = el("section", "ft-box");
  form.setAttribute("aria-labelledby", "ar-form-h");
  const fh = el("h2", "lx-h3", T.formTitle);
  fh.id = "ar-form-h";
  form.append(fh, radios(T.situation, "ar-situation", DATA.situations, "situation"), radios(T.channel, "ar-channel", DATA.channels, "channel"), radios(T.tone, "ar-tone", DATA.tones, "tone"));

  const details = el("fieldset", "ft-set");
  details.append(el("legend", null, T.details));
  const grid = el("div", "ft-grid");
  const fields = {};
  ORDER.forEach((key) => {
    const meta = FIELD_LABELS[key];
    const id = "ar-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, meta.label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = meta.type === "url" ? "url" : "text";
    if (key === "urgent" || key === "bookingUrl") input.dir = "ltr";
    input.placeholder = meta.placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    const h = el("span", "ft-hint", meta.hint);
    h.id = id + "-h";
    input.setAttribute("aria-describedby", h.id);
    input.addEventListener("input", render);
    wrap.append(lab, input, h);
    fields[key] = { wrap, input };
    grid.append(wrap);
  });
  details.append(grid);
  form.append(details);

  const out = el("section", "ft-box");
  out.setAttribute("aria-labelledby", "ar-out-h");
  const oh = el("h2", "lx-h3", T.outTitle);
  oh.id = "ar-out-h";
  const subjWrap = el("div", "ft-field");
  const subjLab = el("label", null, T.subject);
  subjLab.htmlFor = "ar-subject";
  const subject = el("input");
  subject.id = "ar-subject"; subject.type = "text"; subject.readOnly = true;
  subjWrap.append(subjLab, subject);
  const bodyWrap = el("div", "ft-field");
  const bodyLab = el("label", null, T.message);
  bodyLab.htmlFor = "ar-body";
  const body = el("textarea");
  body.id = "ar-body"; body.rows = 12; body.readOnly = true;
  const count = el("span", "ft-hint");
  count.id = "ar-count";
  body.setAttribute("aria-describedby", "ar-count");
  bodyWrap.append(bodyLab, body, count);
  const warn = el("p", "ft-error");
  const copyRow = el("div", "try-controls");
  const copyMsg = el("button", "try-btn try-btn-primary", T.copyMsg);
  copyMsg.type = "button";
  const copySubj = el("button", "try-btn", T.copySubject);
  copySubj.type = "button";
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  copyRow.append(copyMsg, copySubj);
  const where = el("p", "ft-hint");
  out.append(oh, subjWrap, bodyWrap, warn, copyRow, status, where);

  async function copyText(text, input) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        status.textContent = T.copied;
        return;
      }
    } catch (e) { /* fall back to selecting */ }
    input.focus();
    input.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    status.textContent = ok ? T.copied : T.selected;
  }
  copyMsg.addEventListener("click", () => copyText(body.value, body));
  copySubj.addEventListener("click", () => copyText(subject.value, subject));

  function render() {
    status.textContent = "";
    const show = fieldsFor(state.situation, state.channel);
    ORDER.forEach((k) => { fields[k].wrap.hidden = show.indexOf(k) === -1; });
    const v = { situation: state.situation, channel: state.channel, tone: state.tone };
    ORDER.forEach((k) => { if (show.indexOf(k) !== -1) v[k] = fields[k].input.value; });
    const r = buildAutoReplyHe(v);
    subject.value = r.subject;
    subjWrap.hidden = !r.subject;
    copySubj.hidden = !r.subject;
    body.value = r.body;
    count.textContent = r.body.length + " " + T.chars;
    warn.textContent = r.warnings.join(" ");
    const s = DATA.situations.filter((x) => x.id === state.situation)[0];
    where.textContent = s ? s.where : "";
  }

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.generator), document.createTextNode(" " + T.intro));
  app.append(intro, form, out);
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
