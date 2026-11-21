// /en/appointment-reminder-generator/ and /he/appointment-reminder/ client logic. Progressive enhancement: without
// JS the page shows example messages. No requests to us, no storage. public/character-counter.js loads first and
// gives the SMS count (root.CharCount).
// PART 1 is a copy of src/app/landing/data/tools/reminder.ts with the types removed (made with the TypeScript
// compiler). tests/appointment-reminder-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="rm-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to reminder.ts) ----------
  const pad = (n) => String(n).padStart(2, "0");
  function validDate(date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
      if (!m)
          return false;
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function validTime(time) {
      const m = /^(\d{2}):(\d{2})$/.exec(time || "");
      return !!m && +m[1] < 24 && +m[2] < 60;
  }
  /** Date and time plus some minutes, across midnight and month ends. */
  function addMinutes(date, time, minutes) {
      const [y, mo, d] = date.split("-").map(Number);
      const [h, mi] = time.split(":").map(Number);
      const t = new Date(Date.UTC(y, mo - 1, d, h, mi) + Math.round(minutes) * 60000);
      return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` };
  }
  function weekday(date) {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  /** "25 November" (dm) or "25.11" (dmy, the Israeli short form). */
  function shortDate(date, t) {
      const [, m, d] = date.split("-").map(Number);
      return t.dateFormat === "dmy" ? `${d}.${m}` : `${d} ${t.months[m - 1]}`;
  }
  /**
   * Fills {name} placeholders. A part in [square brackets] is dropped when any placeholder inside it is empty, so
   * "Hi[ {client}]," reads "Hi," without a name and optional lines disappear cleanly.
   */
  function fill(tpl, vars) {
      const val = (k) => (vars[k] ?? "").trim();
      return tpl
          .replace(/\[([^[\]]*)\]/g, (_, inner) => (/\{(\w+)\}/.test(inner) && [...inner.matchAll(/\{(\w+)\}/g)].some((m) => !val(m[1])) ? "" : inner))
          .replace(/\{(\w+)\}/g, (_, k) => val(k))
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
  }
  function vars(a, t, withReply) {
      const ok = validDate(a.date);
      return {
          business: a.business, client: a.client, service: a.service, time: validTime(a.time) ? a.time : "",
          day: ok ? t.days[weekday(a.date)] : "", date: ok ? shortDate(a.date, t) : "",
          place: a.place, phone: a.phone, note: a.note,
          reply: withReply ? fill(t.reply, { phone: a.phone }) : "",
      };
  }
  /** The three messages: when it's booked, the day before and on the day. */
  function messages(a, t, withReply) {
      const v = vars(a, t, withReply);
      return { confirm: fill(t.confirm, v), dayBefore: fill(t.dayBefore, v), sameDay: fill(t.sameDay, v) };
  }
  const stamp = (date, time) => date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
  function event(a, t) {
      if (!validDate(a.date) || !validTime(a.time))
          return null;
      const v = vars(a, t, false);
      const title = fill(t.eventTitle, v) || a.business.trim() || a.service.trim();
      return { title, details: fill(t.eventDetails, v), location: a.place.trim(), start: { date: a.date, time: a.time }, end: addMinutes(a.date, a.time, a.minutes > 0 ? a.minutes : 60) };
  }
  const query = (pairs) => pairs.filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  function googleCalendarUrl(e) {
      return "https://calendar.google.com/calendar/render?" + query([["action", "TEMPLATE"], ["text", e.title], ["dates", `${stamp(e.start.date, e.start.time)}/${stamp(e.end.date, e.end.time)}`], ["details", e.details], ["location", e.location]]);
  }
  function outlookUrl(e) {
      return "https://outlook.live.com/calendar/0/action/compose?" + query([["path", "/calendar/action/compose"], ["rru", "addevent"], ["subject", e.title], ["startdt", `${e.start.date}T${e.start.time}:00`], ["enddt", `${e.end.date}T${e.end.time}:00`], ["body", e.details], ["location", e.location]]);
  }
  const icsText = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  /** Folds a content line at 75 bytes (UTF-8), never inside a character. */
  function fold(line) {
      const out = [];
      let cur = "";
      let bytes = 0;
      for (const ch of Array.from(line)) {
          const cp = ch.codePointAt(0);
          const b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
          if (bytes + b > (out.length ? 74 : 75)) {
              out.push(cur);
              cur = "";
              bytes = 0;
          }
          cur += ch;
          bytes += b;
      }
      out.push(cur);
      return out.join("\r\n ");
  }
  /** A calendar file with one event and a reminder an hour before. uid and now (UTC, YYYYMMDDTHHMMSSZ) are passed in. */
  function ics(e, uid, now) {
      const lines = [
          "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mike Automations//Appointment reminder//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
          "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${now}`, `DTSTART:${stamp(e.start.date, e.start.time)}`, `DTEND:${stamp(e.end.date, e.end.time)}`,
          `SUMMARY:${icsText(e.title)}`,
          ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
          ...(e.details ? [`DESCRIPTION:${icsText(e.details)}`] : []),
          "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.title)}`, "TRIGGER:-PT1H", "END:VALARM",
          "END:VEVENT", "END:VCALENDAR",
      ];
      return lines.map(fold).join("\r\n") + "\r\n";
  }
  /** What's missing or risky. today is YYYY-MM-DD in the visitor's time zone. */
  function checks(a, withReply, today) {
      const c = [];
      if (!validDate(a.date) || !validTime(a.time))
          c.push({ level: "bad", id: "when_missing" });
      else if (a.date < today)
          c.push({ level: "warn", id: "past" });
      else
          c.push({ level: "ok", id: "when_ok" });
      c.push(a.business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      c.push(a.place.trim() ? { level: "ok", id: "place_ok" } : { level: "warn", id: "place_missing" });
      if (withReply && !a.phone.trim())
          c.push({ level: "warn", id: "phone_missing" });
      else if (withReply)
          c.push({ level: "ok", id: "reply_ok" });
      else
          c.push({ level: "warn", id: "reply_off" });
      return c;
  }

  const API = { validDate, validTime, addMinutes, weekday, shortDate, fill, messages, event, googleCalendarUrl, outlookUrl, fold, ics, checks };
  root.Reminder = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("rm-app");
  const dataEl = document.getElementById("rm-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const TX = DATA.texts;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  const localDate = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d); };
  // The example lands on a Tuesday to Thursday about a week ahead, never on a weekend or Friday.
  const inAWeek = () => { const d = new Date(); d.setDate(d.getDate() + 6); while (d.getDay() < 2 || d.getDay() > 4) d.setDate(d.getDate() + 1); return localDate(d); };

  let uid = 0;
  const inputs = {};
  function field(key) {
    const f = UI.fields[key];
    const id = "rm-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    const c = el("input");
    c.type = f.type || "text";
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max && c.type === "text") c.maxLength = f.max;
    if (c.type === "number") { c.min = String(f.min); c.max = String(f.max); c.step = String(f.step); c.inputMode = "numeric"; }
    c.dir = f.ltr || c.type !== "text" ? "ltr" : "auto";
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }
  function option(text, on) {
    const lab = el("label", "rm-opt");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = on;
    lab.append(cb, document.createTextNode(text));
    return { lab, cb };
  }
  function copyText(text, btn, label) {
    const done = () => { btn.dataset.done = "1"; btn.textContent = "✓ " + UI.copied; setTimeout(() => { btn.dataset.done = ""; btn.textContent = label; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => {});
    else {
      const t = el("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.append(t); t.select();
      try { if (document.execCommand("copy")) done(); } catch (e) {} t.remove();
    }
  }

  // Form.
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const when = el("div", "rm-row2");
  when.append(field("date"), field("time"), field("minutes"));
  const reply = option(UI.askReply, true);
  const cal = option(UI.addCal, false);
  const checkList = el("ul", "gp-checks");
  const form = el("div", "ft-box gp-form");
  form.append(formTop, field("business"), field("client"), field("service"), when, field("place"), field("phone"), field("note"), reply.lab, cal.lab, el("h3", "gp-h", UI.checksTitle), checkList);
  form.lastChild.previousSibling.style.marginTop = "0.9rem";

  // Messages: three cards made once and updated in place, so nothing flickers while typing.
  const empty = el("p", "rm-empty", UI.empty);
  const list = el("div", "rm-msgs");
  const cards = {};
  ["confirm", "dayBefore", "sameDay"].forEach((k) => {
    const card = el("div", "rm-msg");
    const head = el("div", "rm-head");
    head.append(el("span", "rm-kind", UI.kinds[k][0]), el("span", "rm-when", UI.kinds[k][1]));
    const bubble = el("div", "rm-bubble");
    bubble.dir = "auto";
    const sms = el("span", "rm-sms");
    const acts = el("div", "rm-acts");
    const wa = el("a", "try-btn rm-btn", UI.whatsapp);
    wa.target = "_blank"; wa.rel = "noopener noreferrer";
    wa.setAttribute("aria-label", UI.whatsappLabel.replace("{kind}", UI.kinds[k][0]));
    const cp = button("try-btn try-btn-primary rm-btn", UI.copy);
    cp.setAttribute("aria-label", UI.copy + ": " + UI.kinds[k][0]);
    cp.addEventListener("click", () => copyText(bubble.textContent, cp, UI.copy));
    acts.append(wa, cp);
    const foot = el("div", "rm-foot");
    foot.append(sms, acts);
    card.append(head, bubble, foot);
    list.append(card);
    cards[k] = { bubble, sms, wa };
  });
  const msgCard = el("section", "gp-card");
  msgCard.setAttribute("aria-live", "polite");
  msgCard.append(el("h2", "gp-h", UI.messagesTitle), empty, list);

  const gLink = el("a", "try-btn try-btn-primary rm-btn", UI.google);
  const oLink = el("a", "try-btn rm-btn", UI.outlook);
  for (const a of [gLink, oLink]) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  const icsBtn = button("try-btn gp-ghost rm-btn", UI.ics);
  const calRow = el("div", "rm-cal");
  calRow.append(gLink, oLink, icsBtn);
  const calCard = el("section", "gp-card");
  calCard.append(el("h2", "gp-h", UI.calTitle), el("p", "gp-hint", UI.calHint), calRow);

  const side = el("div", "gp-side");
  side.append(msgCard, calCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  const values = () => ({
    business: inputs.business.value, client: inputs.client.value, service: inputs.service.value, date: inputs.date.value, time: inputs.time.value,
    minutes: Number(inputs.minutes.value) || DATA.minutes, place: inputs.place.value, phone: inputs.phone.value, note: inputs.note.value,
  });
  const CC = root.CharCount;
  let current = null;
  function render() {
    const a = values();
    const ev = API.event(a, TX);
    current = ev;
    const ready = !!ev && !!a.business.trim();
    empty.hidden = ready;
    list.hidden = !ready;
    if (ready) {
      const m = API.messages(a, TX, reply.cb.checked);
      if (cal.cb.checked) m.confirm += "\n" + API.googleCalendarUrl(ev);
      for (const k in cards) {
        const c = cards[k];
        if (c.bubble.textContent !== m[k]) c.bubble.textContent = m[k];
        c.wa.href = "https://wa.me/?text=" + encodeURIComponent(m[k]);
        if (CC) {
          const s = CC.sms(m[k]);
          const max = s.segments * s.perSegment;
          c.sms.textContent = (s.segments === 1 ? UI.smsOne : UI.smsCount).replace("{n}", String(s.segments)).replace("{used}", String(s.units)).replace("{max}", String(max));
          c.sms.dataset.multi = s.segments > 1 ? "1" : "";
        }
      }
    }
    for (const x of [gLink, oLink]) { x.toggleAttribute("aria-disabled", !ev); if (!ev) x.removeAttribute("href"); }
    if (ev) { gLink.href = API.googleCalendarUrl(ev); oLink.href = API.outlookUrl(ev); }
    icsBtn.disabled = !ev;
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(a, reply.cb.checked, localDate(new Date())).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx);
      checkList.append(li);
    });
  }
  icsBtn.addEventListener("click", () => {
    if (!current) return;
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "@appointment";
    const blob = new Blob([API.ics(current, id, now)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url; a.download = UI.icsName; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    icsBtn.dataset.done = "1";
    setTimeout(() => { icsBtn.dataset.done = ""; }, 1600);
  });
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  const reset = () => { for (const k in inputs) inputs[k].value = ""; inputs.date.value = tomorrow(); inputs.time.value = "10:00"; inputs.minutes.value = String(DATA.minutes); };
  tryBtn.addEventListener("click", () => {
    for (const k in inputs) inputs[k].value = DATA.example[k] == null ? "" : String(DATA.example[k]);
    inputs.date.value = inAWeek();
    render(); inputs.business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); render(); inputs.business.focus(); });
  reset();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
