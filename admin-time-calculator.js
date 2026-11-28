// /en/admin-time-calculator/ client logic. Progressive enhancement: the page explains the sum without JS.
// No dependencies, no network requests, no cookies, no storage: nothing typed here leaves the device.
// PART 1 is a copy of parseNum, adminTime, fmtHours and fmtMoney in src/app/landing/data/tools/admin-time-calc.ts with the
// types removed; tests/tools-b-admin-time.test.ts loads this file in a sandbox and checks both copies agree.
// It shows the cost of the manual time only. It never estimates a saving.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to admin-time-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function parseNum(v) {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 && v < 1e9 ? v : 0;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n < 1e9 ? n : 0;
  }

  function adminTime(tasks, hourlyValue, fallbackName) {
    const fb = fallbackName == null ? "Task" : fallbackName;
    const rows = [];
    (tasks || []).slice(0, 6).forEach((t, i) => {
      const minutes = parseNum(t.minutes);
      const perWeek = parseNum(t.perWeek);
      const weeklyMinutes = minutes * perWeek;
      if (weeklyMinutes <= 0) return;
      const name = String(t.name == null ? "" : t.name).trim() || fb + " " + (i + 1);
      rows.push({ name, minutes, perWeek, weeklyMinutes, weeklyHours: round2(weeklyMinutes / 60), share: 0 });
    });
    const total = rows.reduce((s, r) => s + r.weeklyMinutes, 0);
    for (const r of rows) r.share = total > 0 ? Math.round((r.weeklyMinutes / total) * 100) : 0;
    const top = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.weeklyMinutes - a.r.weeklyMinutes || a.i - b.i).slice(0, 3).map((x) => x.r);
    const hourly = parseNum(hourlyValue);
    const weeklyHoursExact = total / 60;
    return {
      rows,
      top,
      totalMinutesPerWeek: total,
      weeklyHours: round2(weeklyHoursExact),
      monthlyHours: round2((weeklyHoursExact * 52) / 12),
      yearlyHours: round2(weeklyHoursExact * 52),
      hourly,
      hasCost: hourly > 0 && total > 0,
      monthlyCost: round2(((weeklyHoursExact * 52) / 12) * hourly),
      yearlyCost: round2(weeklyHoursExact * 52 * hourly),
    };
  }

  function fmtHours(n) {
    return String(Math.round(n * 10) / 10);
  }

  function fmtMoney(n) {
    const neg = n < 0;
    return (neg ? "-" : "") + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  // ---------- end PART 1 ----------

  root.AdminTime = { parseNum, adminTime, fmtHours, fmtMoney };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("atc-app");
  const dataEl = document.getElementById("atc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const MAX = DATA.max || 6;

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
    const id = "atc-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    lab.id = id + "-l";
    input.id = id;
    wrap.append(lab, input);
    if (hint) {
      const h = el("p", "ft-hint", hint);
      h.id = id + "-hint";
      input.setAttribute("aria-describedby", h.id);
      wrap.append(h);
    }
    return { wrap, input, label: lab };
  }
  const textInput = (extra) => {
    const i = el("input");
    i.type = "text";
    if (extra) Object.assign(i, extra);
    return i;
  };

  app.textContent = "";

  // The rows survive a re-render (add, remove); typing only updates the results.
  const tasks = [{ name: "", minutes: "", perWeek: "" }];

  const boxTasks = el("section", "ft-box");
  boxTasks.setAttribute("aria-labelledby", "atc-h-tasks");
  const hTasks = el("h2", "lx-h3", "Your repetitive tasks");
  hTasks.id = "atc-h-tasks";
  const quickLabel = el("p", "ft-hint", "Quick add (up to " + MAX + " tasks):");
  quickLabel.id = "atc-quick";
  const quickRow = el("div", "try-controls");
  quickRow.setAttribute("role", "group");
  quickRow.setAttribute("aria-labelledby", "atc-quick");
  const lines = el("div", "ft-lines");
  const addRow = el("div", "try-controls");
  const btnAdd = button("Add a task");
  const addStatus = el("p", "ft-hint");
  addStatus.setAttribute("aria-live", "polite");
  addRow.append(btnAdd);
  boxTasks.append(hTasks, quickLabel, quickRow, lines, addRow, addStatus);

  const boxValue = el("section", "ft-box");
  boxValue.setAttribute("aria-labelledby", "atc-h-value");
  const hValue = el("h2", "lx-h3", "What an hour is worth");
  hValue.id = "atc-h-value";
  const fHourly = field("Hourly value", textInput({ autocomplete: "off", inputMode: "decimal" }), "Your own pay rate, or what a team member costs per hour. Left empty, only the hours are shown.");
  const curSelect = el("select");
  for (const c of DATA.currencies) {
    const o = el("option", null, c.label);
    o.value = c.symbol;
    curSelect.append(o);
  }
  const fCur = field("Currency", curSelect);
  const gValue = el("div", "ft-grid");
  gValue.append(fHourly.wrap, fCur.wrap);
  boxValue.append(hValue, gValue);

  const boxOut = el("section", "ft-box");
  boxOut.setAttribute("aria-labelledby", "atc-h-out");
  const hOut = el("h2", "lx-h3", "What it adds up to");
  hOut.id = "atc-h-out";
  const results = el("div", "ft-msg");
  results.setAttribute("aria-live", "polite");
  boxOut.append(hOut, results);

  app.append(boxTasks, boxValue, boxOut);

  function renderRows(focusIndex) {
    lines.textContent = "";
    tasks.forEach((t, i) => {
      const line = el("div", "ft-line");
      const fName = field("Task " + (i + 1), textInput({ autocomplete: "off", maxLength: 60, value: t.name }));
      const fMin = field("Minutes each time", textInput({ autocomplete: "off", inputMode: "decimal", value: t.minutes }));
      const fWeek = field("Times per week", textInput({ autocomplete: "off", inputMode: "decimal", value: t.perWeek }));
      fMin.input.setAttribute("aria-describedby", fName.label.id);
      fWeek.input.setAttribute("aria-describedby", fName.label.id);
      const rm = button("Remove");
      rm.setAttribute("aria-label", "Remove task " + (i + 1));
      fName.input.addEventListener("input", () => { t.name = fName.input.value; update(); });
      fMin.input.addEventListener("input", () => { t.minutes = fMin.input.value; update(); });
      fWeek.input.addEventListener("input", () => { t.perWeek = fWeek.input.value; update(); });
      rm.addEventListener("click", () => {
        tasks.splice(i, 1);
        if (!tasks.length) tasks.push({ name: "", minutes: "", perWeek: "" });
        addStatus.textContent = "Task removed.";
        renderRows(Math.min(i, tasks.length - 1));
        update();
      });
      line.append(fName.wrap, fMin.wrap, fWeek.wrap, rm);
      lines.append(line);
      if (focusIndex === i) fMin.input.focus();
    });
    btnAdd.disabled = tasks.length >= MAX;
  }

  function addTask(name) {
    addStatus.textContent = "";
    if (name) {
      const empty = tasks.findIndex((t) => !t.name.trim() && !String(t.minutes).trim() && !String(t.perWeek).trim());
      if (empty >= 0) { tasks[empty].name = name; renderRows(empty); update(); return; }
    }
    if (tasks.length >= MAX) { addStatus.textContent = "Six tasks is the most this calculator takes."; return; }
    tasks.push({ name: name || "", minutes: "", perWeek: "" });
    renderRows(tasks.length - 1);
    update();
  }

  for (const p of DATA.presets) {
    const b = button(p);
    b.addEventListener("click", () => addTask(p));
    quickRow.append(b);
  }
  btnAdd.addEventListener("click", () => addTask(""));

  const cell = (tag, text) => el(tag, null, text);
  function tableRow(th, td) {
    const tr = el("tr");
    const h = el("th", null, th);
    h.scope = "row";
    tr.append(h, cell("td", td));
    return tr;
  }
  const hoursText = (n) => fmtHours(n) + (fmtHours(n) === "1" ? " hour" : " hours");

  function update() {
    const sym = curSelect.value;
    const money = (n) => sym + fmtMoney(n);
    const r = adminTime(tasks, fHourly.input.value, "Task");
    results.textContent = "";
    if (!r.rows.length) {
      results.append(el("p", "ft-hint", "Add the minutes a task takes and how many times a week you do it, and your totals appear here."));
      return;
    }
    results.append(el("p", "ft-out ft-subject", "In total: " + hoursText(r.weeklyHours) + " a week on these tasks."));

    const t1 = el("table", "ft-when");
    const b1 = el("tbody");
    b1.append(tableRow("Hours per week", hoursText(r.weeklyHours)), tableRow("Hours per month", hoursText(r.monthlyHours)), tableRow("Hours per year", hoursText(r.yearlyHours)));
    if (r.hasCost) b1.append(tableRow("Cost per month", money(r.monthlyCost)), tableRow("Cost per year", money(r.yearlyCost)));
    t1.append(b1);
    results.append(t1);
    if (!r.hasCost) results.append(el("p", "ft-hint", "Add an hourly value to see what this time costs."));

    results.append(el("h3", "lx-h3", "Top " + r.top.length + (r.top.length === 1 ? " task by time" : " tasks by time")));
    const t2 = el("table", "ft-when");
    const head = el("thead");
    const hr = el("tr");
    for (const h of ["Task", "Per week", "Share"]) { const th = el("th", null, h); th.scope = "col"; hr.append(th); }
    head.append(hr);
    const b2 = el("tbody");
    for (const t of r.top) {
      const tr = el("tr");
      const name = cell("td", t.name);
      name.style.overflowWrap = "anywhere";
      tr.append(name, cell("td", hoursText(t.weeklyHours)), cell("td", t.share + "%"));
      b2.append(tr);
    }
    t2.append(head, b2);
    results.append(t2);
    results.append(el("p", "ft-hint", "This is the cost of the time spent on these jobs, based on the numbers you entered. It is not a promise of any saving."));
  }

  fHourly.input.addEventListener("input", update);
  curSelect.addEventListener("change", update);
  if (DATA.example) {
    tasks.length = 0;
    DATA.example.tasks.forEach((t) => tasks.push({ name: t.name, minutes: String(t.minutes), perWeek: String(t.perWeek) }));
    fHourly.input.value = String(DATA.example.hourly);
  }
  renderRows(-1);
  update();
})(typeof window !== "undefined" ? window : globalThis);
