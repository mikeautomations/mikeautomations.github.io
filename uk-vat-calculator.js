// /en/uk-vat-calculator/ client logic. Progressive enhancement: the page already explains the sums without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of vatCalc() and money() in src/app/landing/data/tools/uk-vat-calc.ts with the types removed.
// tests/uk-vat-calculator.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to uk-vat-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function money(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  const pct = (n) => String(Math.round(n * 100) / 100);

  function vatCalc(i) {
    const { mode, amount, ratePct } = i;
    if (mode !== "add" && mode !== "remove") return { ok: false, error: "Choose add VAT or remove VAT." };
    for (const v of [amount, ratePct]) {
      if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "Enter numbers only." };
    }
    if (amount < 0) return { ok: false, error: "The amount cannot be negative." };
    if (ratePct < 0 || ratePct > 100) return { ok: false, error: "The VAT rate must be from 0 to 100 percent." };
    const r = ratePct / 100;
    const factor = pct(1 + r);
    if (mode === "add") {
      const net = round2(amount);
      const gross = round2(amount * (1 + r));
      return { ok: true, net, vat: round2(gross - net), gross, formula: `Gross = net x ${factor}. VAT = gross - net.` };
    }
    const gross = round2(amount);
    const net = round2(amount / (1 + r));
    return { ok: true, net, vat: round2(gross - net), gross, formula: `Net = gross / ${factor}. VAT = gross - net.` };
  }

  root.UkVat = { vatCalc, money };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("vat-app");
  const dataEl = document.getElementById("vat-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const box = el("section", "ft-box");
  box.setAttribute("aria-labelledby", "vat-calc-h");
  const h = el("h2", "lx-h3", "Your amount");
  h.id = "vat-calc-h";

  // Add or remove
  const modes = el("fieldset", "vat-modes");
  modes.append(el("legend", null, "What do you want to do?"));
  const modeInputs = {};
  [["add", "Add VAT (the amount is before VAT)"], ["remove", "Remove VAT (the amount includes VAT)"]].forEach(([v, text], idx) => {
    const lab = el("label", "vat-mode");
    const inp = el("input");
    inp.type = "radio";
    inp.name = "vat-mode";
    inp.value = v;
    inp.checked = idx === 0;
    modeInputs[v] = inp;
    lab.append(inp, el("span", null, text));
    modes.append(lab);
  });

  // Amount
  const amtWrap = el("div", "ft-field");
  const amtLab = el("label", null, "Amount (£)");
  amtLab.htmlFor = "vat-amount";
  const amt = el("input");
  amt.id = "vat-amount";
  amt.type = "number";
  amt.inputMode = "decimal";
  amt.min = "0";
  amt.step = "any";
  amtWrap.append(amtLab, amt);

  // Rate
  const rateWrap = el("div", "ft-field");
  const rateLab = el("label", null, "VAT rate");
  rateLab.htmlFor = "vat-rate";
  const rate = el("select");
  rate.id = "vat-rate";
  DATA.rates.forEach((r) => { const o = el("option", null, r.label); o.value = String(r.pct); rate.append(o); });
  const customOpt = el("option", null, "Custom rate");
  customOpt.value = "custom";
  rate.append(customOpt);
  rateWrap.append(rateLab, rate);

  const customWrap = el("div", "ft-field");
  customWrap.hidden = true;
  const customLab = el("label", null, "Custom VAT rate (%)");
  customLab.htmlFor = "vat-custom";
  const custom = el("input");
  custom.id = "vat-custom";
  custom.type = "number";
  custom.inputMode = "decimal";
  custom.min = "0";
  custom.max = "100";
  custom.step = "any";
  customWrap.append(customLab, custom);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");
  const out = el("div", "vat-out");
  out.setAttribute("aria-live", "polite");

  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", strong ? "vat-strong" : null, v));
    return tr;
  };

  const mode = () => (modeInputs.remove.checked ? "remove" : "add");

  function render() {
    customWrap.hidden = rate.value !== "custom";
    err.textContent = "";
    out.textContent = "";
    if (amt.value.trim() === "") return;
    let ratePct;
    if (rate.value === "custom") {
      if (custom.value.trim() === "") return;
      ratePct = Number(custom.value);
    } else {
      ratePct = Number(rate.value);
    }
    const r = vatCalc({ mode: mode(), amount: Number(amt.value), ratePct });
    if (!r.ok) { err.textContent = r.error; return; }
    const m = (n) => "£" + money(n);
    out.append(el("p", "vat-headline", mode() === "add" ? `Total including VAT: ${m(r.gross)}` : `Price before VAT: ${m(r.net)}`));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table vat-results");
    t.append(el("caption", "vat-cap", "Net, VAT and gross"));
    const tb = el("tbody");
    tb.append(row("Net (before VAT)", m(r.net), mode() === "remove"), row("VAT", m(r.vat)), row("Gross (including VAT)", m(r.gross), mode() === "add"));
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    out.append(el("p", "ft-hint", "Formula used: " + r.formula));
  }

  box.append(h, modes, amtWrap, rateWrap, customWrap, err, out);
  [amt, custom].forEach((f) => f.addEventListener("input", render));
  rate.addEventListener("change", render);
  modeInputs.add.addEventListener("change", render);
  modeInputs.remove.addEventListener("change", render);

  if (amt.value.trim() === "") amt.value = "100";
  render();
  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
