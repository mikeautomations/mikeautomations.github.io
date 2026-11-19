// /en/hourly-rate-calculator/ client logic. Progressive enhancement: the page already explains the sum without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of hourlyRate() and money() in src/app/landing/data/tools/hourly-rate-calc.ts with the types removed.
// tests/hourly-rate-calculator.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to hourly-rate-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function hourlyRate(i) {
    const { takeHome, costs, weeksOff, daysPerWeek, hoursPerDay, taxPct } = i;
    for (const v of [takeHome, costs, weeksOff, daysPerWeek, hoursPerDay, taxPct]) {
      if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "Enter numbers only." };
    }
    if (takeHome < 0 || costs < 0) return { ok: false, error: "Pay and costs cannot be negative." };
    if (weeksOff < 0 || weeksOff >= 52) return { ok: false, error: "Weeks off must be from 0 to 51." };
    if (daysPerWeek <= 0 || daysPerWeek > 7) return { ok: false, error: "Working days per week must be more than 0 and no more than 7." };
    if (hoursPerDay <= 0 || hoursPerDay > 24) return { ok: false, error: "Billable hours per day must be more than 0 and no more than 24." };
    if (taxPct < 0 || taxPct > 90) return { ok: false, error: "Tax set-aside must be from 0 to 90 percent." };
    const profitNeeded = takeHome / (1 - taxPct / 100);
    const revenueNeeded = profitNeeded + costs;
    const workingWeeks = 52 - weeksOff;
    const billableDays = workingWeeks * daysPerWeek;
    const billableHours = billableDays * hoursPerDay;
    return {
      ok: true,
      profitNeeded: round2(profitNeeded),
      taxSetAside: round2(profitNeeded - takeHome),
      revenueNeeded: round2(revenueNeeded),
      workingWeeks,
      billableDays: round2(billableDays),
      billableHours: round2(billableHours),
      hourly: round2(revenueNeeded / billableHours),
      day: round2(revenueNeeded / billableDays),
      monthly: round2(revenueNeeded / 12),
    };
  }

  function money(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  root.HourlyRate = { hourlyRate, money };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("hr-app");
  const dataEl = document.getElementById("hr-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;

  function field(label, hint, value, step) {
    const id = "hr-f" + ++uid;
    const wrap = el("div", "hr-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = step || "any";
    if (value != null) input.value = String(value);
    wrap.append(lab);
    if (hint) { const h = el("span", "hr-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return { wrap, input };
  }

  const blank = (input) => input.value.trim() === "";
  const num = (input) => (blank(input) ? NaN : Number(input.value));

  const box = el("section", "hr-box");
  box.setAttribute("aria-labelledby", "hr-calc-h");
  const h = el("h2", "lx-h3", "Your numbers");
  h.id = "hr-calc-h";

  const curWrap = el("div", "hr-field");
  const curLab = el("label", null, "Currency symbol");
  curLab.htmlFor = "hr-cur";
  const cur = el("select");
  cur.id = "hr-cur";
  DATA.currencies.forEach((c) => { const o = el("option", null, c.label); o.value = c.symbol; cur.append(o); });
  curWrap.append(curLab, cur);

  const takeHome = field("Yearly take-home pay you want", "What you want to keep after business costs and tax.", "");
  const costs = field("Business costs per year", "Software, insurance, vehicle, phone, equipment, training and so on.", "");
  const weeks = field("Weeks off per year", "Holiday, sick days and bank holidays. A starting value: change it.", 5, "0.5");
  const days = field("Working days per week", "A starting value: change it.", 5, "0.5");
  const hours = field("Billable hours per working day", "Only hours a client pays for. You will not bill every hour you work: admin, quotes and chasing payments are not billable.", 5, "0.5");
  const tax = field("Tax set-aside, percent (optional)", "The share of your pay you will put aside for tax. Leave at 0 for a before-tax rate.", 0, "any");

  const err = el("p", "hr-error");
  err.setAttribute("role", "alert");
  const out = el("div", "hr-out");
  out.setAttribute("aria-live", "polite");

  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", strong ? "hr-strong" : null, v));
    return tr;
  };

  function render() {
    err.textContent = "";
    out.textContent = "";
    if (blank(takeHome.input)) return;
    const raw = {
      takeHome: num(takeHome.input),
      costs: blank(costs.input) ? 0 : num(costs.input),
      weeksOff: num(weeks.input),
      daysPerWeek: num(days.input),
      hoursPerDay: num(hours.input),
      taxPct: blank(tax.input) ? 0 : num(tax.input),
    };
    const r = hourlyRate(raw);
    if (!r.ok) { err.textContent = r.error; return; }
    const m = (n) => cur.value + money(n);
    out.append(el("p", "hr-headline", `Minimum hourly rate: ${m(r.hourly)}`));
    out.append(el("p", "hr-headline", `Minimum day rate: ${m(r.day)}`));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table hr-results");
    t.append(el("caption", "hr-cap", "How the rate is worked out"));
    const tb = el("tbody");
    tb.append(row("Take-home pay you want", m(raw.takeHome)));
    if (raw.taxPct > 0) tb.append(row("Set aside for tax", m(r.taxSetAside)));
    tb.append(
      row("Pay before tax set-aside", m(r.profitNeeded)),
      row("Business costs", m(raw.costs)),
      row("Income the business must bring in", m(r.revenueNeeded), true),
      row("Working weeks", String(r.workingWeeks)),
      row("Billable days", String(r.billableDays)),
      row("Billable hours", String(r.billableHours)),
      row("Minimum hourly rate", m(r.hourly), true),
      row("Minimum day rate", m(r.day), true),
      row("Income needed per month", m(r.monthly)),
    );
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    out.append(el("p", "hr-hint", "This is a minimum. It assumes you bill every hour you entered. Charge more for slow months and late payers."));
  }

  box.append(h, curWrap, takeHome.wrap, costs.wrap, weeks.wrap, days.wrap, hours.wrap, tax.wrap, err, out);
  [takeHome, costs, weeks, days, hours, tax].forEach((f) => f.input.addEventListener("input", render));
  cur.addEventListener("change", render);

  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
