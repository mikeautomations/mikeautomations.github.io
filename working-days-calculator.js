// /en/working-days-calculator/ client logic. Progressive enhancement: the page already explains the rules and shows worked examples without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of PART 1 of src/app/landing/data/tools/working-days-calc.ts (types removed, keep identical).
// tests/tools-d-working-days.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 builds the form inside #wd-app and reads the bank holiday dates from the JSON script #wd-data (data: working-days-uk.ts).
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

  root.WorkingDays = { parseIso, toIso, classify, countWorkingDays, addWorkingDays };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("wd-app");
  const dataEl = document.getElementById("wd-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const fmt = (iso) => {
    const p = iso.split("-").map(Number);
    return DAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] + " " + p[2] + " " + MONTHS[p[1] - 1] + " " + p[0];
  };
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const ERR = {
    "bad-date": "Enter real dates.",
    order: "The end date must be on or after the start date.",
    range: "That range is too long. Pick one of up to 100 years.",
    "bad-n": "The number of working days must be a whole number from 0 to 5000.",
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;

  function field(label, hint, control) {
    const id = "wd-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const p = el("p", "ft-hint", hint); p.id = id + "-h"; control.setAttribute("aria-describedby", p.id); wrap.append(p); }
    wrap.append(control);
    return wrap;
  }
  function select(options) {
    const s = el("select");
    options.forEach((o) => { const op = el("option", null, o[1]); op.value = o[0]; s.append(op); });
    return s;
  }
  function dateInput() {
    const i = el("input");
    i.type = "date";
    return i;
  }

  const mode = select([["count", "Count working days between two dates"], ["add", "Add working days to a date"], ["sub", "Subtract working days from a date"]]);
  const region = select(DATA.regions);
  const incl = select([["no", "Do not count the start date (day 1 is the next working day)"], ["yes", "Count the start date"]]);
  const start = dateInput();
  const end = dateInput();
  const nIn = el("input");
  nIn.type = "number";
  nIn.inputMode = "numeric";
  nIn.min = "0";
  nIn.step = "1";

  const box = el("section", "ft-box");
  box.setAttribute("aria-labelledby", "wd-calc-h");
  const h = el("h2", "lx-h3", "Your dates");
  h.id = "wd-calc-h";
  const grid = el("div", "ft-grid");
  const fMode = field("What do you want to work out?", null, mode);
  const fRegion = field("Bank holidays for", "Covers " + DATA.years[0] + " to " + DATA.years[1] + ", from GOV.UK. Weekends are Saturday and Sunday.", region);
  const fIncl = field("Counting the start date", null, incl);
  const fStart = field("Start date", null, start);
  const fEnd = field("End date (always counted)", null, end);
  const fN = field("Number of working days", "A whole number, for example 14.", nIn);
  grid.append(fRegion, fIncl, fStart, fEnd, fN);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");
  const out = el("div", "ft-box");
  out.setAttribute("aria-live", "polite");
  out.setAttribute("aria-atomic", "true");

  const row = (k, v) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", null, v));
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

  function render() {
    const m = mode.value;
    fEnd.hidden = m !== "count";
    fN.hidden = m === "count";
    fStart.querySelector("label").textContent = m === "count" ? "Start date" : "Date to start from";
    err.textContent = "";
    out.textContent = "";
    const hint = () => out.append(el("p", "ft-hint", "Enter the dates to see the result."));
    if (start.value === "" || (m === "count" ? end.value === "" : nIn.value.trim() === "")) { hint(); return; }
    const rule = { weekend: [0, 6], halfDays: [], holidays: DATA.holidays[region.value], eves: {}, eveOff: false };
    const includeStart = incl.value === "yes";
    let r;
    if (m === "count") r = countWorkingDays(start.value, end.value, includeStart, rule);
    else r = addWorkingDays(start.value, Number(nIn.value), m === "sub" ? -1 : 1, includeStart, rule);
    if (!r.ok) { err.textContent = ERR[r.error] || ERR["bad-date"]; hint(); return; }

    const days = (n) => plural(n, "working day", "working days");
    out.append(el("h3", "lx-h3", m === "count"
      ? "There " + (r.workingDays === 1 ? "is " : "are ") + days(r.workingDays) + " from " + fmt(start.value) + " to " + fmt(end.value)
      : (m === "add" ? "Add " : "Subtract ") + days(Number(nIn.value)) + ": " + fmt(r.date)));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table");
    const tb = el("tbody");
    if (m === "count") tb.append(row("Working days", String(r.workingDays)), row("Calendar days looked at", String(r.examined)));
    else tb.append(row("Result", fmt(r.date)), row("Calendar days from the start date", String(Math.round(Math.abs(parseIso(r.date) - parseIso(start.value)) / DAY))));
    tb.append(row("Weekend days skipped (Saturdays and Sundays)", String(r.weekendDays)), row("Bank holidays skipped", String(r.skipped.length)));
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    if (r.skipped.length) out.append(list("Bank holidays skipped on weekdays:", r.skipped));
    else out.append(el("p", "ft-hint", region.value === "none" ? "No public holidays were applied, only weekends." : "No bank holidays fell on a weekday in this period."));
    if (outside(start.value) || outside(m === "count" ? end.value : r.date)) {
      out.append(el("p", "ft-hint", "Part of this period is outside " + DATA.years[0] + " to " + DATA.years[1] + ", so bank holidays there are not applied: only weekends were skipped."));
    }
    out.append(el("p", "ft-hint", "A guide only. Check how your contract counts working days, and whether it counts the start date."));
  }

  box.append(h, fMode, grid, err, out);
  [mode, region, incl, start, end, nIn].forEach((n) => { n.addEventListener("input", render); n.addEventListener("change", render); });

  app.textContent = "";
  app.append(box);
  // Faster first use: open with today and a date 30 days on, and 10 working days, so an answer shows before anyone types.
  (function prefill() {
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const t = new Date();
    const later = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 30);
    const inRange = (d) => d.getFullYear() >= DATA.years[0] && d.getFullYear() <= DATA.years[1];
    if (!start.value && inRange(t)) start.value = iso(t);
    if (!end.value && inRange(later)) end.value = iso(later);
    if (!nIn.value) nIn.value = "10";
  })();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
