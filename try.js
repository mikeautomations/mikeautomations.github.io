// /en/try/ client logic (docs/superpowers/specs/2026-11-10-interactive-tools-design.md, section 2).
// A simulated inbox that plays one reminder sequence over about 60 seconds. No dependencies, no third-party requests,
// no cookies or storage. The data (the site's own templates, filled for an example business) comes from
// <script id="try-data"> rendered by src/app/landing/en/try-page.tsx. The only network request is the optional
// "send me the demo emails" form, and only when the visitor presses its button.
(() => {
  "use strict";
  const app = document.getElementById("try-app");
  const dataEl = document.getElementById("try-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  if (!DATA || !DATA.demos || !DATA.demos.length) return;

  const TOTAL = 60; // seconds of playback for the whole sequence
  const STEP = 0.25;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const dayLabel = (d, n) => d.days === "day" ? "Day " + n
    : n < 0 ? -n + " days before the due date" : n === 0 ? "Due date" : n + " days after the due date";

  // ---------- static frame ----------
  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Demo"), document.createTextNode(" A simulation in your browser. Nothing is sent anywhere."));
  const tabs = el("div", "try-tabs");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Choose a demo");
  const setup = el("p");
  const controls = el("div", "try-controls");
  const playBtn = el("button", "try-btn try-btn-primary", "Play demo");
  const replayBtn = el("button", "try-btn", "Replay");
  const replyBtn = el("button", "try-btn", "Reply as the client");
  [playBtn, replayBtn, replyBtn].forEach((b) => { b.type = "button"; controls.append(b); });
  replyBtn.title = "See what happens when the client replies: the reminders stop";

  const timeline = el("div", "try-timeline");
  const timeHead = el("div", "try-time-head");
  const dayNow = el("span", "try-time-day");
  const timeNote = el("span", null, "Sped up: about 60 seconds for several weeks");
  timeHead.append(dayNow, timeNote);
  const track = el("div", "try-track");
  const fill = el("div", "try-fill");
  track.append(fill);
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", "Demo timeline");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(TOTAL));
  timeline.append(timeHead, track);

  const inbox = el("div", "try-inbox");
  const listWrap = el("div", "try-list");
  const listHead = el("div", "try-list-head");
  const list = el("ul");
  list.style.listStyle = "none";
  list.style.margin = "0";
  list.style.padding = "0";
  listWrap.append(listHead, list);
  const read = el("div", "try-read");
  read.setAttribute("aria-live", "off");
  inbox.append(listWrap, read);

  const live = el("p", "try-live");
  live.setAttribute("aria-live", "polite");
  const summary = el("div", "try-summary");
  summary.hidden = true;

  app.append(intro, tabs, setup, controls, timeline, inbox, summary, live);

  // ---------- state ----------
  let demo = DATA.demos[0];
  let t = 0;
  let timer = null;
  let next = 0; // index of the next item to deliver
  let stopped = false;
  let ended = false;
  let ticks = [];
  let last = 0;
  let stoppedDay = 0;

  const tabBtns = DATA.demos.map((d) => {
    const b = el("button", "try-btn", d.tab);
    b.type = "button";
    b.addEventListener("click", () => choose(d));
    tabs.append(b);
    return b;
  });

  function announce(msg) { live.textContent = ""; window.setTimeout(() => { live.textContent = msg; }, 30); }

  function currentDay() {
    const items = demo.items;
    let prev = null, nxt = null;
    for (const it of items) { if (it.at <= t) prev = it; else { nxt = it; break; } }
    if (!prev) return items[0].day;
    if (stopped) return stoppedDay;
    if (!nxt) return prev.day;
    const f = (t - prev.at) / (nxt.at - prev.at);
    return prev.day + Math.floor((nxt.day - prev.day) * f);
  }

  function paint() {
    const pct = Math.min(100, (t / TOTAL) * 100);
    fill.style.width = pct + "%";
    track.setAttribute("aria-valuenow", String(Math.round(t)));
    const label = dayLabel(demo, currentDay());
    dayNow.textContent = stopped ? "Stopped: " + label : ended ? label + ": sequence finished" : label;
    track.setAttribute("aria-valuetext", dayNow.textContent);
    ticks.forEach((tk, i) => tk.classList.toggle("is-done", i < next));
    playBtn.textContent = timer ? "Pause" : t > 0 && !ended && !stopped ? "Play" : "Play demo";
    playBtn.disabled = ended || stopped;
    replyBtn.disabled = stopped || (ended && !reduce) || !demo.items.slice(0, next).some((it) => it.kind === "email");
  }

  function select(btn, item, mine) {
    list.querySelectorAll(".try-msg").forEach((b) => b.removeAttribute("aria-current"));
    btn.setAttribute("aria-current", "true");
    btn.classList.remove("is-new");
    read.textContent = "";
    const meta = el("div", "try-read-meta");
    meta.append(el("div", "try-read-subj", mine ? "Re: " + lastSubject() : item.subject));
    meta.append(el("div", null, "From: " + (mine ? demo.to + " (you, as the client)" : demo.from)));
    meta.append(el("div", null, "To: " + (mine ? demo.from : demo.to)));
    meta.append(el("div", null, mine ? "Sent: " + dayLabel(demo, currentDay()) : "Arrived: " + dayLabel(demo, item.day)));
    read.append(meta, el("pre", "try-body", mine ? item.text : item.body));
    if (!mine) read.append(el("p", "try-src", "Wording: " + item.source + ". " + demo.business + " is an example business, for illustration."));
  }

  function lastSubject() {
    const emails = demo.items.slice(0, next).filter((it) => it.kind === "email");
    return emails.length ? emails[emails.length - 1].subject : "";
  }

  function addEmail(item, mine) {
    const li = el("li");
    const b = el("button", "try-msg" + (mine ? " try-mine" : " is-new"));
    b.type = "button";
    const top = el("span", "try-msg-from");
    top.append(el("b", null, mine ? "You (" + demo.client + ")" : demo.from.split(",")[0]), el("span", null, mine ? "now" : dayLabel(demo, item.day).replace(" days before the due date", "d before due").replace(" days after the due date", "d overdue")));
    b.append(top, el("span", "try-msg-subj", mine ? "Re: " + lastSubject() : item.subject));
    b.addEventListener("click", () => select(b, item, mine));
    li.append(b);
    list.prepend(li);
    select(b, item, mine);
  }

  function addNote(text, cls) {
    const li = el("li", "try-note" + (cls ? " " + cls : ""), text);
    list.prepend(li);
  }

  function deliver(item) {
    if (item.kind === "email") {
      addEmail(item, false);
      announce(dayLabel(demo, item.day) + ": new email to " + demo.client + ". " + item.subject);
    } else {
      addNote(dayLabel(demo, item.day) + ": " + item.text);
      announce(dayLabel(demo, item.day) + ": " + item.text);
    }
  }

  function showSummary(replied) {
    const L = demo.list;
    summary.textContent = "";
    summary.append(el("h3", null, L.title));
    summary.append(el("p", "lx-fine", replied
      ? "The sequence stopped when " + demo.client + " replied. In a real build this list reaches " + demo.owner + " each morning."
      : "The sequence has finished. In a real build this list reaches " + demo.owner + " each morning."));
    const wrap = el("div", "lx-table-wrap");
    const table = el("table", "lx-table try-morning");
    const thead = el("thead");
    const hr = el("tr");
    L.head.forEach((h) => { const th = el("th", null, h); th.scope = "col"; hr.append(th); });
    thead.append(hr);
    const tbody = el("tbody");
    const clientRow = replied ? [L.client[0], L.client[1], demo.reply.status] : L.client;
    [clientRow].concat(L.rows).forEach((r) => {
      const tr = el("tr");
      r.forEach((c) => tr.append(el("td", null, c)));
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    summary.append(wrap);
    const more = el("p", "lx-fine");
    more.append(document.createTextNode(demo.client + " is the client in this demo; the other rows are examples too. "));
    const a = el("a", null, "See the full sequence and templates");
    a.href = "#demo-" + demo.id;
    more.append(a);
    summary.append(more);
    summary.hidden = false;
  }

  function stopTimer() { if (timer) { window.clearInterval(timer); timer = null; } }

  function tick() {
    // Real elapsed time, so a throttled background tab still keeps to about 60 seconds.
    const now = Date.now();
    t = Math.min(TOTAL, t + Math.min(5, (now - last) / 1000));
    last = now;
    while (next < demo.items.length && demo.items[next].at <= t) deliver(demo.items[next++]);
    if (t >= TOTAL) finish();
    paint();
  }

  function finish() {
    stopTimer();
    while (next < demo.items.length) deliver(demo.items[next++]);
    t = TOTAL;
    ended = true;
    showSummary(false);
    announce("Sequence finished. The owner's morning list is shown below the inbox.");
  }

  function play() {
    if (timer) { stopTimer(); paint(); announce("Paused"); return; }
    if (ended || stopped) return;
    last = Date.now();
    timer = window.setInterval(tick, STEP * 1000);
    paint();
  }

  function reset() {
    stopTimer();
    t = 0; next = 0; stopped = false; ended = false;
    list.textContent = "";
    summary.hidden = true;
    summary.textContent = "";
    read.textContent = "";
    read.append(el("p", "try-empty", reduce
      ? "Every message is shown at once because your device asks for reduced motion."
      : "Press Play to start. Emails arrive here as " + demo.client + " would get them."));
    listHead.textContent = demo.client + "'s inbox (demo)";
    // Ticks on the timeline, one per message or event.
    ticks.forEach((tk) => tk.remove());
    ticks = demo.items.map((it) => {
      const tk = el("span", "try-tick" + (it.kind === "event" ? " is-event" : ""));
      tk.style.left = (it.at / TOTAL) * 100 + "%";
      tk.title = dayLabel(demo, it.day);
      track.append(tk);
      return tk;
    });
    if (reduce) finish();
    paint();
  }

  function choose(d) {
    demo = d;
    tabBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(DATA.demos[i] === d)));
    setup.textContent = "";
    setup.append(el("span", "try-label", "Example business, for illustration"), document.createTextNode(" " + (d.setup.indexOf(d.business) === -1 ? d.business + ". " : "") + d.setup));
    reset();
    const sel = document.querySelector("#try-form select[name=demo]");
    if (sel) sel.value = d.id;
  }

  function reply() {
    if (reduce && (ended || next === 0)) {
      // Reduced motion shows everything at once; to show a reply, rewind to just after the first email.
      reset();
      ended = false; summary.hidden = true;
      list.textContent = "";
      const first = demo.items.findIndex((it) => it.kind === "email");
      next = 0;
      while (next <= first) deliver(demo.items[next++]);
      t = demo.items[first].at;
    }
    if (stopped || next === 0) return;
    stopTimer();
    stoppedDay = currentDay();
    stopped = true;
    addEmail({ text: demo.reply.text }, true);
    addNote(demo.reply.note, "is-stop");
    announce(demo.client + " replied. " + demo.reply.note);
    showSummary(true);
    paint();
  }

  playBtn.addEventListener("click", play);
  replayBtn.addEventListener("click", () => { reset(); if (!reduce) play(); });
  replyBtn.addEventListener("click", reply);
  choose(DATA.demos[0]);

  // ---------- optional: real demo emails (only rendered when DEMO_SCRIPT_URL is set) ----------
  const form = document.getElementById("try-form");
  const url = form && form.getAttribute("data-script-url");
  if (form && url) {
    const status = document.getElementById("try-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = (n) => ((form.elements[n] && form.elements[n].value) || "").trim();
      const btn = form.querySelector("button[type=submit]");
      if (v("website")) { status.textContent = "Thanks. Check your inbox in a minute."; return; }
      if (!form.elements.consent.checked) { status.textContent = "Please tick the box to say you want the demo emails."; return; }
      btn.disabled = true;
      status.textContent = "Sending...";
      let j = {};
      try {
        // Apps Script: text/plain avoids a CORS preflight; the script reads the JSON body itself.
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ name: v("name"), email: v("email"), demo: v("demo"), consent: true, website: v("website"), page: location.pathname }) });
        j = await r.json().catch(() => ({}));
      } catch (err) { j = {}; }
      if (j.ok === true) {
        status.textContent = "Done. The first email should arrive within a minute (check your spam folder if not), and the rest over about 5 minutes. Reply to any of them to see the rest stop.";
        form.querySelectorAll("input, select, button").forEach((n) => { n.disabled = true; });
        return;
      }
      btn.disabled = false;
      status.textContent = j.error === "limit"
        ? "This address has already had a demo today. You can try again tomorrow, or watch the demo above."
        : j.error === "busy"
          ? "The demo has reached its limit for today. Please try again tomorrow, or watch the demo above."
          : "That didn't work. Please check your name and email address, or email " + "mikelgershman@gmail.com" + " and Michael will send it.";
    });
  }
})();
