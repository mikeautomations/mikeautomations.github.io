// /he/working-days-calculator/ client logic (Hebrew, RTL). Progressive enhancement: the page already explains the rules and shows worked examples without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of PART 1 of src/app/landing/data/tools/working-days-calc.ts (types removed, keep identical).
// tests/tools-d-working-days.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the texts and the holiday dates from the JSON script #wdh-data (data: working-days-il.ts).
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to PART 1 of working-days-calc.ts) ----------
  const DAY = 86400000;
  const MAX_DAYS = 36600;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function parseIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
    if (!m) return NaN;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : NaN;
  }

  function toIso(t) {
    return new Date(t).toISOString().slice(0, 10);
  }

  function classify(t, rule) {
    const iso = toIso(t);
    const wd = new Date(t).getUTCDay();
    if (rule.weekend.indexOf(wd) >= 0) return { kind: "weekend", weight: 0, name: "" };
    if (has(rule.holidays, iso)) return { kind: "holiday", weight: 0, name: rule.holidays[iso] };
    if (rule.eveOff && has(rule.eves, iso)) return { kind: "eve", weight: 0, name: rule.eves[iso] };
    if (rule.halfDays.indexOf(wd) >= 0) return { kind: "half", weight: 0.5, name: "" };
    return { kind: "work", weight: 1, name: "" };
  }

  function countWorkingDays(startIso, endIso, includeStart, rule) {
    const a = parseIso(startIso);
    const b = parseIso(endIso);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: false, error: "bad-date" };
    if (b < a) return { ok: false, error: "order" };
    const span = Math.round((b - a) / DAY);
    if (span > MAX_DAYS) return { ok: false, error: "range" };
    let workingDays = 0;
    let weekendDays = 0;
    let halfDays = 0;
    let examined = 0;
    const skipped = [];
    const evesWorked = [];
    for (let t = includeStart ? a : a + DAY; t <= b; t += DAY) {
      const c = classify(t, rule);
      examined++;
      if (c.weight > 0) {
        workingDays += c.weight;
        if (c.kind === "half") halfDays++;
        if (!rule.eveOff && has(rule.eves, toIso(t))) evesWorked.push({ date: toIso(t), name: rule.eves[toIso(t)] });
      } else if (c.kind === "weekend") weekendDays++;
      else skipped.push({ date: toIso(t), name: c.name });
    }
    return { ok: true, date: endIso, weekday: new Date(b).getUTCDay(), examined, workingDays, weekendDays, halfDays, skipped, evesWorked };
  }

  function addWorkingDays(startIso, n, dir, includeStart, rule) {
    const a = parseIso(startIso);
    if (!Number.isFinite(a)) return { ok: false, error: "bad-date" };
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 5000) return { ok: false, error: "bad-n" };
    const step = (dir < 0 ? -1 : 1) * DAY;
    let workingDays = 0;
    let weekendDays = 0;
    let halfDays = 0;
    let examined = 0;
    const skipped = [];
    const evesWorked = [];
    let t = a;
    if (n > 0) {
      t = includeStart ? a : a + step;
      for (;;) {
        if (examined >= MAX_DAYS) return { ok: false, error: "range" };
        const c = classify(t, rule);
        examined++;
        if (c.weight > 0) {
          workingDays += c.weight;
          if (c.kind === "half") halfDays++;
          if (!rule.eveOff && has(rule.eves, toIso(t))) evesWorked.push({ date: toIso(t), name: rule.eves[toIso(t)] });
        } else if (c.kind === "weekend") weekendDays++;
        else skipped.push({ date: toIso(t), name: c.name });
        if (workingDays >= n) break;
        t += step;
      }
    }
    const byDate = (x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
    skipped.sort(byDate);
    evesWorked.sort(byDate);
    return { ok: true, date: toIso(t), weekday: new Date(t).getUTCDay(), examined, workingDays, weekendDays, halfDays, skipped, evesWorked };
  }
  // ---------- end PART 1 ----------

  root.WorkingDaysHe = { parseIso, toIso, classify, countWorkingDays, addWorkingDays };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("wdh-app");
  const dataEl = document.getElementById("wdh-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const T = DATA.ui;

  const p2 = (n) => String(n).padStart(2, "0");
  const fmt = (iso) => {
    const p = iso.split("-").map(Number);
    return "יום " + T.weekdays[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] + ", " + p2(p[2]) + "." + p2(p[1]) + "." + p[0];
  };
  const ERR = { "bad-date": T.errDate, order: T.errOrder, range: T.errRange, "bad-n": T.errN };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;

  function field(label, hint, control) {
    const id = "wdh-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const p = el("p", "ft-hint", hint); p.id = id + "-h"; control.setAttribute("aria-describedby", p.id); wrap.append(p); }
    wrap.append(control);
    return wrap;
  }
  function check(label, hint, checked) {
    const id = "wdh-f" + ++uid;
    const wrap = el("div", "ft-choice");
    const input = el("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    const lab = el("label", null, label);
    lab.htmlFor = id;
    wrap.append(input, lab);
    if (hint) { const p = el("p", "ft-hint", hint); p.id = id + "-h"; input.setAttribute("aria-describedby", p.id); wrap.append(p); }
    return { wrap, input };
  }
  function select(options) {
    const s = el("select");
    options.forEach((o) => { const op = el("option", null, o[1]); op.value = o[0]; s.append(op); });
    return s;
  }
  function dateInput() {
    const i = el("input");
    i.type = "date";
    i.dir = "ltr";
    return i;
  }

  const mode = select([["count", T.modeCount], ["add", T.modeAdd], ["sub", T.modeSub]]);
  const weekend = select([["fri-sat", T.weekendFriSat], ["sat", T.weekendSat]]);
  const half = check(T.fridayHalf, T.fridayHalfHint, false);
  const eve = check(T.eveCounts, T.eveHint, true);
  const incl = check(T.includeStart, T.includeStartHint, false);
  const start = dateInput();
  const end = dateInput();
  const nIn = el("input");
  nIn.type = "number";
  nIn.inputMode = "numeric";
  nIn.dir = "ltr";
  nIn.min = "0";
  nIn.step = "1";

  const form = el("div", "ft-box");
  const grid = el("div", "ft-grid");
  const fMode = field(T.mode, null, mode);
  const fWeekend = field(T.weekend, null, weekend);
  const fStart = field(T.start, null, start);
  const fEnd = field(T.end, null, end);
  const fN = field(T.n, T.nHint, nIn);
  grid.append(fMode, fWeekend, fStart, fEnd, fN);
  const choices = el("div", "ft-choices");
  choices.append(half.wrap, eve.wrap, incl.wrap);
  form.append(grid, choices);

  const error = el("p", "ft-error");
  error.setAttribute("role", "alert");
  const result = el("div", "ft-box");
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");

  const num = (n) => String(Math.round(n * 10) / 10);
  const row = (label, value) => {
    const tr = el("tr");
    const th = el("th", null, label);
    th.scope = "row";
    tr.append(th, el("td", "ft-ltr", value));
    return tr;
  };
  const list = (title, items) => {
    const wrap = el("div");
    wrap.append(el("p", "ft-hint", title));
    const ul = el("ul");
    items.forEach((s) => ul.append(el("li", null, fmt(s.date) + ": " + s.name)));
    wrap.append(ul);
    return wrap;
  };
  const outside = (iso) => {
    const y = Number(iso.slice(0, 4));
    return y < DATA.years[0] || y > DATA.years[1];
  };

  function update() {
    const m = mode.value;
    const satOnly = weekend.value === "sat";
    fEnd.hidden = m !== "count";
    fN.hidden = m === "count";
    half.wrap.hidden = !satOnly;
    result.textContent = "";
    error.textContent = "";
    const empty = () => result.append(el("p", "ft-hint", T.empty));
    if (start.value === "" || (m === "count" ? end.value === "" : nIn.value.trim() === "")) { empty(); return; }
    const rule = {
      weekend: satOnly ? [6] : [5, 6],
      halfDays: satOnly && half.input.checked ? [5] : [],
      holidays: DATA.holidays,
      eves: DATA.eves,
      eveOff: !eve.input.checked,
    };
    let r;
    if (m === "count") r = countWorkingDays(start.value, end.value, incl.input.checked, rule);
    else r = addWorkingDays(start.value, Number(nIn.value), m === "sub" ? -1 : 1, incl.input.checked, rule);
    if (!r.ok) { error.textContent = ERR[r.error] || T.errDate; empty(); return; }

    const head = m === "count" ? T.headCount.replace("{N}", num(r.workingDays))
      : (m === "add" ? T.headAdd : T.headSub).replace("{D}", fmt(r.date)).replace("{N}", String(Number(nIn.value)));
    result.append(el("h3", "lx-h3", head));
    const table = el("table", "ft-when");
    const body = el("tbody");
    if (m === "count") body.append(row(T.rowWorking, num(r.workingDays)), row(T.rowCalendar, String(r.examined)));
    else body.append(row(T.rowCalendar, String(r.examined)));
    body.append(row(T.rowWeekend, String(r.weekendDays)));
    if (r.halfDays) body.append(row(T.rowHalf, String(r.halfDays)));
    table.append(body);
    result.append(table);
    const hol = r.skipped.filter((s) => DATA.holidays[s.date]);
    const eves = r.skipped.filter((s) => !DATA.holidays[s.date]);
    if (hol.length) result.append(list(T.skippedHol, hol));
    else result.append(el("p", "ft-hint", T.skippedNone));
    if (eves.length) result.append(list(T.skippedEve, eves));
    if (r.evesWorked.length) result.append(list(T.evesWorked, r.evesWorked));
    if (outside(start.value) || outside(m === "count" ? end.value : r.date)) result.append(el("p", "ft-hint", T.outside));
    result.append(el("p", "ft-hint", T.note));
  }

  [mode, weekend, start, end, nIn, half.input, eve.input, incl.input].forEach((n) => { n.addEventListener("input", update); n.addEventListener("change", update); });

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.tag), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, result);
  update();
})(typeof globalThis !== "undefined" ? globalThis : this);
