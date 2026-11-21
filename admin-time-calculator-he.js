// /he/admin-time-calculator/ client logic. Needs public/he-tools-core.js first. Progressive enhancement: the page explains
// the sum without JS. No dependencies, no network requests, no cookies, no storage: nothing typed here leaves the device.
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

  root.HeAdminTime = { parseNum, adminTime, fmtHours, fmtMoney };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const T = root.HeTools;
  const app = document.getElementById("hatc-app");
  const dataEl = document.getElementById("hatc-data");
  if (!T || !app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const { el, button, field, textInput } = T;
  const MAX = DATA.max || 6;

  app.textContent = "";

  // The rows survive a re-render (add, remove); typing only updates the results.
  const tasks = [{ name: "", minutes: "", perWeek: "" }];

  const boxTasks = el("section", "ht-box");
  boxTasks.setAttribute("aria-labelledby", "hatc-h-tasks");
  const hTasks = el("h2", "lx-h3", "המשימות החוזרות שלכם");
  hTasks.id = "hatc-h-tasks";
  const quickLabel = el("p", "ht-hint", "הוספה מהירה (עד " + MAX + " משימות):");
  quickLabel.id = "hatc-quick";
  const quickRow = el("div", "try-controls");
  quickRow.setAttribute("role", "group");
  quickRow.setAttribute("aria-labelledby", "hatc-quick");
  const lines = el("div", "ht-lines");
  const addRow = el("div", "try-controls");
  const btnAdd = button("הוספת משימה");
  const addStatus = el("p", "ht-hint");
  addStatus.setAttribute("aria-live", "polite");
  addRow.append(btnAdd);
  boxTasks.append(hTasks, quickLabel, quickRow, lines, addRow, addStatus);

  const boxValue = el("section", "ht-box");
  boxValue.setAttribute("aria-labelledby", "hatc-h-value");
  const hValue = el("h2", "lx-h3", "כמה שווה שעה");
  hValue.id = "hatc-h-value";
  const fHourly = field("ערך לשעה", textInput("text", "", { autocomplete: "off", inputMode: "decimal" }), "התעריף שלכם לשעה, או העלות לשעה של עובד. אם תשאירו ריק, יוצגו רק השעות.");
  const curSelect = el("select");
  for (const c of DATA.currencies) {
    const o = el("option", null, c.label);
    o.value = c.code;
    curSelect.append(o);
  }
  const fCur = field("מטבע", curSelect);
  const gValue = el("div", "ht-grid");
  gValue.append(fHourly.wrap, fCur.wrap);
  boxValue.append(hValue, gValue);

  const boxOut = el("section", "ht-box");
  boxOut.setAttribute("aria-labelledby", "hatc-h-out");
  const hOut = el("h2", "lx-h3", "מה יוצא בסך הכול");
  hOut.id = "hatc-h-out";
  const results = el("div");
  results.style.display = "grid";
  results.style.gap = "0.75rem";
  results.setAttribute("aria-live", "polite");
  boxOut.append(hOut, results);

  app.append(boxTasks, boxValue, boxOut);

  function renderRows(focusIndex) {
    lines.textContent = "";
    tasks.forEach((t, i) => {
      const line = el("div", "ht-line");
      const fName = field("משימה " + (i + 1), textInput("text", t.name, { autocomplete: "off", maxLength: 60 }));
      const fMin = field("דקות בכל פעם", textInput("text", t.minutes, { autocomplete: "off", inputMode: "decimal" }));
      const fWeek = field("פעמים בשבוע", textInput("text", t.perWeek, { autocomplete: "off", inputMode: "decimal" }));
      const nameLabel = fName.wrap.querySelector("label");
      nameLabel.id = fName.input.id + "-l";
      fMin.input.setAttribute("aria-describedby", nameLabel.id);
      fWeek.input.setAttribute("aria-describedby", nameLabel.id);
      const rm = button("הסרה");
      rm.setAttribute("aria-label", "הסרה, משימה " + (i + 1));
      fName.input.addEventListener("input", () => { t.name = fName.input.value; update(); });
      fMin.input.addEventListener("input", () => { t.minutes = fMin.input.value; update(); });
      fWeek.input.addEventListener("input", () => { t.perWeek = fWeek.input.value; update(); });
      rm.addEventListener("click", () => {
        tasks.splice(i, 1);
        if (!tasks.length) tasks.push({ name: "", minutes: "", perWeek: "" });
        addStatus.textContent = "המשימה הוסרה.";
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
    if (tasks.length >= MAX) { addStatus.textContent = "שש משימות זה המקסימום במחשבון הזה."; return; }
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
  const hoursText = (n) => {
    const f = fmtHours(n);
    return f === "1" ? "שעה" : f === "2" ? "שעתיים" : f + " שעות";
  };

  function update() {
    const cur = DATA.currencies.find((c) => c.code === curSelect.value) || DATA.currencies[0];
    const money = (n) => (cur.code === "ILS" ? fmtMoney(n) + " ₪" : cur.symbol + fmtMoney(n));
    const r = adminTime(tasks, fHourly.input.value, "משימה");
    results.textContent = "";
    if (!r.rows.length) {
      results.append(el("p", "ht-hint", "הוסיפו כמה דקות לוקחת משימה וכמה פעמים בשבוע אתם עושים אותה, והסיכום יופיע כאן."));
      return;
    }
    results.append(el("p", "ht-out ht-subject", "בסך הכול: " + hoursText(r.weeklyHours) + " בשבוע על המשימות האלה."));

    const t1 = el("table", "ht-when");
    const b1 = el("tbody");
    b1.append(tableRow("שעות בשבוע", hoursText(r.weeklyHours)), tableRow("שעות בחודש", hoursText(r.monthlyHours)), tableRow("שעות בשנה", hoursText(r.yearlyHours)));
    if (r.hasCost) b1.append(tableRow("עלות בחודש", money(r.monthlyCost)), tableRow("עלות בשנה", money(r.yearlyCost)));
    t1.append(b1);
    results.append(t1);
    if (!r.hasCost) results.append(el("p", "ht-hint", "הוסיפו ערך לשעה כדי לראות כמה הזמן הזה עולה."));

    results.append(el("h3", "lx-h3", r.top.length === 1 ? "המשימה שלוקחת הכי הרבה זמן" : "המשימות שלוקחות הכי הרבה זמן (עד שלוש)"));
    const t2 = el("table", "ht-when");
    const head = el("thead");
    const hr = el("tr");
    for (const h of ["משימה", "בשבוע", "חלק מהסך הכול"]) { const th = el("th", null, h); th.scope = "col"; hr.append(th); }
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
    results.append(el("p", "ht-hint", "זו העלות של הזמן שהולך על המשימות האלה, לפי המספרים שהזנתם. זו לא הבטחה לשום חיסכון."));
  }

  fHourly.input.addEventListener("input", update);
  curSelect.addEventListener("change", update);
  renderRows(-1);
  update();
})(typeof window !== "undefined" ? window : globalThis);
