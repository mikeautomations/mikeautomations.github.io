// /en/break-even-calculator/ client logic. Progressive enhancement: the page already explains the sums without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of the pure functions in src/app/landing/data/tools/break-even-calc.ts with the types removed.
// tests/tools-a-break-even.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the texts from <script id="be-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to break-even-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function num(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    const f = frac.replace(/0+$/, "");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? "." + f : ""}`;
  }

  function fix2(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  function parseNum(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function breakEven(i) {
    const { fixed, price, variable } = i;
    const hasTarget = i.target !== undefined && i.target !== null;
    const vals = hasTarget ? [fixed, price, variable, i.target] : [fixed, price, variable];
    for (const v of vals) if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "number" };
    if (vals.some((v) => v < 0)) return { ok: false, error: "negative" };
    if (vals.some((v) => v > 1e12)) return { ok: false, error: "huge" };
    if (price <= 0) return { ok: false, error: "price" };
    if (price <= variable) return { ok: false, error: "margin" };
    const c = price - variable;
    const unitsExact = fixed / c;
    const units = Math.ceil(unitsExact - 1e-9);
    let target = null;
    if (hasTarget) {
      const t = i.target;
      const tExact = (fixed + t) / c;
      const tUnits = Math.ceil(tExact - 1e-9);
      target = { profit: t, units: tUnits, extra: tUnits - units, revenue: round2(tExact * price) };
    }
    return { ok: true, contribution: round2(c), marginPct: round2((c / price) * 100), unitsExact: round2(unitsExact), units, revenue: round2(unitsExact * price), target };
  }
  // ---------- end PART 1 ----------

  root.BreakEvenTool = { breakEven, num, fix2, parseNum };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("be-app");
  const dataEl = document.getElementById("be-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const T = DATA.ui;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  function field(label, hint, control) {
    const id = "be-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  const numInput = (placeholder) => {
    const i = el("input");
    i.type = "text";
    i.inputMode = "decimal";
    i.autocomplete = "off";
    i.placeholder = placeholder || "";
    return i;
  };

  const cur = el("select");
  DATA.currencies.forEach((c) => { const o = el("option", null, c.label); o.value = c.symbol; cur.append(o); });
  const fixed = numInput(T.fixedPlaceholder);
  const price = numInput(T.pricePlaceholder);
  const variable = numInput(T.variablePlaceholder);
  const target = numInput(T.targetPlaceholder);

  const form = el("div", "ft-box");
  const grid = el("div", "ft-grid");
  grid.append(
    field(T.currency, null, cur),
    field(T.fixed, T.fixedHint, fixed),
    field(T.price, T.priceHint, price),
    field(T.variable, T.variableHint, variable),
    field(T.target, T.targetHint, target),
  );
  form.append(grid);

  const error = el("p", "ft-error");
  error.setAttribute("role", "alert");
  const result = el("div", "ft-box");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");

  function row(label, value, strong) {
    const tr = el("tr");
    const th = el("th", null, label);
    th.scope = "row";
    const td = el("td", null, value);
    if (strong) { th.style.fontWeight = "700"; td.style.fontWeight = "700"; }
    tr.append(th, td);
    return tr;
  }

  function update() {
    result.textContent = "";
    const sym = cur.value;
    const m = (n) => sym + fix2(n);
    if (!fixed.value.trim() || !price.value.trim() || !variable.value.trim()) { error.textContent = ""; result.append(el("p", "ft-hint", T.empty)); return; }
    const hasTarget = target.value.trim() !== "";
    const r = breakEven({
      fixed: parseNum(fixed.value),
      price: parseNum(price.value),
      variable: parseNum(variable.value),
      target: hasTarget ? parseNum(target.value) : null,
    });
    if (!r.ok) { error.textContent = T.errors[r.error] || T.errors.number; result.append(el("p", "ft-hint", T.empty)); return; }
    error.textContent = "";
    result.append(el("p", "ft-hint", T.headline.replace("{N}", num(r.units))));
    const table = el("table", "ft-when");
    const body = el("tbody");
    body.append(
      row(T.rUnits, num(r.units), true),
      row(T.rRevenue, m(r.revenue), true),
      row(T.rContribution, m(r.contribution)),
      row(T.rMargin, num(r.marginPct) + "%"),
    );
    if (r.target) {
      body.append(
        row(T.rTargetUnits.replace("{P}", m(r.target.profit)), num(r.target.units)),
        row(T.rExtra, num(r.target.extra), true),
        row(T.rTargetRevenue, m(r.target.revenue)),
      );
    }
    table.append(body);
    result.append(table);
  }
  [fixed, price, variable, target].forEach((n) => n.addEventListener("input", update));
  cur.addEventListener("change", update);

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.tag), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, result);
  update();
})(typeof globalThis !== "undefined" ? globalThis : this);
