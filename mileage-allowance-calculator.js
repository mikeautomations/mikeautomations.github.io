// /en/mileage-allowance-calculator/ client logic. Progressive enhancement: the page already explains the rates and shows a worked example without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of round2(), money() and mileageAllowance() in src/app/landing/data/tools/mileage-allowance.ts with the types removed.
// The rates are NOT copied: they live in the AMAP constant in that file and arrive as JSON in <script id="mil-data">.
// tests/tools-c-mileage.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to mileage-allowance.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function money(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  function mileageAllowance(i, rates) {
    const yr = rates.years.filter((y) => y.id === i.yearId)[0];
    if (!yr) return { ok: false, error: "Choose a tax year." };
    if (i.vehicle !== "car" && i.vehicle !== "motorcycle" && i.vehicle !== "bicycle") return { ok: false, error: "Choose a vehicle." };
    for (const v of [i.miles, i.alreadyMiles, i.passengers]) {
      if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "Enter numbers only." };
    }
    if (i.miles <= 0) return { ok: false, error: "Business miles on this trip must be more than 0." };
    if (i.miles > 100000) return { ok: false, error: "Business miles on one trip must be 100,000 or less." };
    if (i.alreadyMiles < 0 || i.alreadyMiles > 1000000) return { ok: false, error: "Miles already claimed must be from 0 to 1,000,000." };
    if (!Number.isInteger(i.passengers) || i.passengers < 0 || i.passengers > 8) return { ok: false, error: "Passengers must be a whole number from 0 to 8." };
    let firstMiles;
    let overMiles;
    let firstRate;
    let overRate;
    let passengers = 0;
    let passengerRate = 0;
    if (i.vehicle === "car") {
      firstMiles = Math.max(0, Math.min(i.miles, rates.threshold - i.alreadyMiles));
      overMiles = i.miles - firstMiles;
      firstRate = yr.carFirst;
      overRate = yr.carOver;
      passengers = i.passengers;
      passengerRate = yr.passenger;
    } else {
      firstMiles = i.miles;
      overMiles = 0;
      firstRate = i.vehicle === "motorcycle" ? yr.motorcycle : yr.bicycle;
      overRate = firstRate;
    }
    const firstAmount = round2((firstMiles * firstRate) / 100);
    const overAmount = round2((overMiles * overRate) / 100);
    const passengerAmount = round2((passengers * i.miles * passengerRate) / 100);
    return {
      ok: true,
      vehicle: i.vehicle,
      yearId: yr.id,
      miles: i.miles,
      firstMiles: round2(firstMiles),
      overMiles: round2(overMiles),
      firstRate,
      overRate,
      firstAmount,
      overAmount,
      passengers,
      passengerRate,
      passengerAmount,
      total: round2(firstAmount + overAmount + passengerAmount),
      crossesThreshold: i.vehicle === "car" && firstMiles > 0 && overMiles > 0,
    };
  }

  root.MileageAllowance = { money, mileageAllowance };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("mil-app");
  const dataEl = document.getElementById("mil-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const RATES = DATA.rates;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  function field(label, hint, control) {
    const id = "mil-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  const numInput = (value, step) => { const i = el("input"); i.type = "number"; i.inputMode = step === "1" ? "numeric" : "decimal"; i.min = "0"; i.step = step; i.value = value; return i; };
  const select = (options, value) => {
    const s = el("select");
    for (const o of options) { const opt = el("option", null, o[1]); opt.value = o[0]; s.append(opt); }
    s.value = value;
    return s;
  };

  const year = select(RATES.years.map((y) => [y.id, y.label]), RATES.years[0].id);
  const vehicle = select(DATA.vehicles.map((v) => [v.value, v.label]), "car");
  const miles = numInput("", "any");
  const already = numInput("0", "any");
  const pass = numInput("0", "1");
  pass.max = "8";

  const fAlready = field("Car and van miles already claimed this tax year", "Business miles you have already claimed from 6 April. The 10,000 mile threshold counts cars and vans together.", already);
  const fPass = field("Passengers", "Fellow employees on the same business journey, car or van only.", pass);

  const box = el("section", "ft-box");
  box.setAttribute("aria-labelledby", "mil-h");
  const h = el("h2", "lx-h3", "The trip");
  h.id = "mil-h";
  const grid = el("div", "ft-grid");
  grid.append(field("Tax year", null, year), field("Vehicle", null, vehicle), field("Business miles on this trip", "Do not include ordinary commuting.", miles), fAlready, fPass);
  box.append(h, grid);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");
  const out = el("div", "mil-out");
  out.setAttribute("aria-live", "polite");

  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", strong ? "mil-strong" : null, v));
    return tr;
  };
  const num = (i) => (i.value.trim() === "" ? NaN : Number(i.value));
  const fmtMiles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  function render() {
    const isCar = vehicle.value === "car";
    fAlready.hidden = !isCar;
    fPass.hidden = !isCar;
    err.textContent = "";
    out.textContent = "";
    if (miles.value.trim() === "") return;
    const r = mileageAllowance({
      vehicle: vehicle.value, yearId: year.value, miles: num(miles),
      alreadyMiles: isCar ? (already.value.trim() === "" ? 0 : num(already)) : 0,
      passengers: isCar ? (pass.value.trim() === "" ? 0 : num(pass)) : 0,
    }, RATES);
    if (!r.ok) { err.textContent = r.error; return; }
    const m = (n) => "£" + money(n);
    out.append(el("p", "mil-headline", `You can claim ${m(r.total)} tax-free`));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table mil-results");
    t.append(el("caption", "mil-cap", "How it is worked out"));
    const tb = el("tbody");
    if (r.vehicle === "car") {
      tb.append(row(`${fmtMiles(r.firstMiles)} miles at ${r.firstRate}p (up to the 10,000 mile threshold)`, m(r.firstAmount)));
      tb.append(row(`${fmtMiles(r.overMiles)} miles at ${r.overRate}p (over 10,000 miles)`, m(r.overAmount)));
      if (r.passengers > 0) tb.append(row(`${r.passengers} passenger${r.passengers === 1 ? "" : "s"} x ${fmtMiles(r.miles)} miles at ${r.passengerRate}p`, m(r.passengerAmount)));
    } else {
      tb.append(row(`${fmtMiles(r.firstMiles)} miles at ${r.firstRate}p`, m(r.firstAmount)));
    }
    tb.append(row("Total tax-free amount", m(r.total), true));
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    if (r.crossesThreshold) out.append(el("p", "ft-hint", "This trip crosses the 10,000 mile threshold, so it is paid at two rates."));
    out.append(el("p", "ft-hint", "Rates are the HMRC approved mileage allowance payments on GOV.UK. A guide only, not tax advice."));
  }

  for (const c of [year, vehicle, miles, already, pass]) {
    c.addEventListener("input", render);
    c.addEventListener("change", render);
  }
  miles.value = "100";
  app.textContent = "";
  app.append(box, err, out);
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
