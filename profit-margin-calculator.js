// /en/profit-margin-calculator/ client logic. Progressive enhancement: the page already explains margin and markup without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of fromPrice(), priceFromMargin(), priceFromMarkup() and money() in
// src/app/landing/data/tools/margin-calc.ts with the types removed.
// tests/profit-margin-calculator.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to margin-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function fromPrice(cost, price) {
    if (!isNum(cost) || !isNum(price)) return { ok: false, error: "Enter numbers only." };
    if (cost < 0) return { ok: false, error: "Cost cannot be negative." };
    if (price <= 0) return { ok: false, error: "Price must be more than 0." };
    const profit = price - cost;
    return {
      ok: true,
      cost: round2(cost),
      price: round2(price),
      profit: round2(profit),
      marginPct: round2((profit / price) * 100),
      markupPct: cost === 0 ? Infinity : round2((profit / cost) * 100),
    };
  }

  function priceFromMargin(cost, marginPct) {
    if (!isNum(cost) || !isNum(marginPct)) return { ok: false, error: "Enter numbers only." };
    if (cost < 0) return { ok: false, error: "Cost cannot be negative." };
    if (marginPct >= 100) return { ok: false, error: "Margin must be below 100 percent. No price can give a 100 percent margin on a cost above zero." };
    if (marginPct < 0) return { ok: false, error: "Margin cannot be negative here." };
    const price = cost / (1 - marginPct / 100);
    if (price <= 0) return { ok: false, error: "Price must be more than 0. Enter a cost above 0." };
    return fromPrice(cost, price);
  }

  function priceFromMarkup(cost, markupPct) {
    if (!isNum(cost) || !isNum(markupPct)) return { ok: false, error: "Enter numbers only." };
    if (cost < 0) return { ok: false, error: "Cost cannot be negative." };
    if (markupPct < 0) return { ok: false, error: "Markup cannot be negative here." };
    const price = cost * (1 + markupPct / 100);
    if (price <= 0) return { ok: false, error: "Price must be more than 0. Enter a cost above 0." };
    return fromPrice(cost, price);
  }

  function money(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  root.ProfitMargin = { fromPrice, priceFromMargin, priceFromMarkup, money };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pm-app");
  const dataEl = document.getElementById("pm-data");
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
  const blank = (input) => input.value.trim() === "";
  const num = (input) => (blank(input) ? NaN : Number(input.value));

  function field(label, hint) {
    const id = "pm-f" + ++uid;
    const wrap = el("div", "pm-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "any";
    wrap.append(lab);
    if (hint) { const h = el("span", "pm-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return { wrap, input };
  }

  const box = el("section", "pm-box");
  box.setAttribute("aria-labelledby", "pm-calc-h");
  const h = el("h2", "lx-h3", "Your numbers");
  h.id = "pm-calc-h";

  // Mode choice: a native radio group, so arrow keys and screen readers work without extra code.
  const modes = [
    ["price", "Cost and price: find margin and markup"],
    ["margin", "Cost and margin: find the price"],
    ["markup", "Cost and markup: find the price"],
  ];
  const fs = el("fieldset", "pm-modes");
  fs.append(el("legend", null, "What do you want to work out?"));
  const radios = modes.map(([val, text], i) => {
    const lab = el("label", "pm-mode");
    const r = el("input");
    r.type = "radio";
    r.name = "pm-mode";
    r.value = val;
    r.checked = i === 0;
    lab.append(r, document.createTextNode(" " + text));
    fs.append(lab);
    return r;
  });

  const curWrap = el("div", "pm-field");
  const curLab = el("label", null, "Currency symbol");
  curLab.htmlFor = "pm-cur";
  const cur = el("select");
  cur.id = "pm-cur";
  DATA.currencies.forEach((c) => { const o = el("option", null, c.label); o.value = c.symbol; cur.append(o); });
  curWrap.append(curLab, cur);

  const cost = field("Cost", "What one sale costs you: materials, your time, fees and delivery.");
  const price = field("Selling price", "What the customer pays.");
  const margin = field("Margin you want, percent", "Profit as a share of the price. Below 100.");
  const markup = field("Markup you want, percent", "Profit as a share of the cost.");

  const err = el("p", "pm-error");
  err.setAttribute("role", "alert");
  const out = el("div", "pm-out");
  out.setAttribute("aria-live", "polite");

  const mode = () => radios.find((r) => r.checked).value;
  function syncFields() {
    const m = mode();
    price.wrap.hidden = m !== "price";
    margin.wrap.hidden = m !== "margin";
    markup.wrap.hidden = m !== "markup";
  }

  const pct = (n) => (n === Infinity ? "not defined (the cost is 0)" : money(n) + "%");
  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", strong ? "pm-strong" : null, v));
    return tr;
  };

  function render() {
    err.textContent = "";
    out.textContent = "";
    const m = mode();
    const second = m === "price" ? price : m === "margin" ? margin : markup;
    if (blank(cost.input) || blank(second.input)) return;
    const c = num(cost.input);
    const x = num(second.input);
    const r = m === "price" ? fromPrice(c, x) : m === "margin" ? priceFromMargin(c, x) : priceFromMarkup(c, x);
    if (!r.ok) { err.textContent = r.error; return; }
    const s = cur.value;
    out.append(el("p", "pm-headline", `Margin: ${pct(r.marginPct)}`));
    out.append(el("p", "pm-headline", `Markup: ${pct(r.markupPct)}`));
    if (m !== "price") out.append(el("p", "pm-headline", `Selling price: ${s}${money(r.price)}`));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table pm-results");
    t.append(el("caption", "pm-cap", "The breakdown"));
    const tb = el("tbody");
    tb.append(
      row("Cost", s + money(r.cost)),
      row("Selling price", s + money(r.price), m !== "price"),
      row("Profit (price minus cost)", s + money(r.profit)),
      row("Margin (profit / price)", pct(r.marginPct), true),
      row("Markup (profit / cost)", pct(r.markupPct), true),
    );
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
  }

  box.append(h, fs, curWrap, cost.wrap, price.wrap, margin.wrap, markup.wrap, err, out);
  syncFields();
  radios.forEach((r) => r.addEventListener("change", () => { syncFields(); render(); }));
  [cost, price, margin, markup].forEach((f) => f.input.addEventListener("input", render));
  cur.addEventListener("change", render);

  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
