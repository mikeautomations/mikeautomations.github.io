// /en/late-payment-interest-calculator/ client logic. Progressive enhancement: the page already explains the rules and a worked example without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of daysBetween(), fixedSumFor(), latePayment() and money() in
// src/app/landing/data/tools/late-payment-interest-calc.ts with the types removed.
// tests/late-payment-interest-calculator.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to late-payment-interest-calc.ts) ----------
  const MARGIN_PCT = 8;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function money(n) {
    const neg = n < 0;
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  function daysBetween(a, b) {
    const parse = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
      if (!m) return NaN;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const t = Date.UTC(y, mo - 1, d);
      const back = new Date(t);
      return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : NaN;
    };
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  function fixedSumFor(debt) {
    if (debt < 1000) return 40;
    if (debt < 10000) return 70;
    return 100;
  }

  function latePayment(i) {
    const { debt, baseRatePct, dueDate, paidDate } = i;
    for (const v of [debt, baseRatePct]) {
      if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "Enter numbers only." };
    }
    if (debt <= 0) return { ok: false, error: "The unpaid amount must be more than 0." };
    if (baseRatePct < 0 || baseRatePct > 25) return { ok: false, error: "The base rate must be from 0 to 25 percent." };
    const diff = daysBetween(dueDate, paidDate);
    if (!Number.isFinite(diff)) return { ok: false, error: "Enter a real due date and a real payment date." };
    const days = diff > 0 ? diff : 0;
    const annualRatePct = MARGIN_PCT + baseRatePct;
    const dailyRaw = (debt * annualRatePct) / 100 / 365;
    const interest = round2(dailyRaw * days);
    const fixedSum = days > 0 ? fixedSumFor(debt) : 0;
    const claim = round2(interest + fixedSum);
    return {
      ok: true,
      days,
      annualRatePct: round2(annualRatePct),
      dailyInterest: round2(dailyRaw),
      interest,
      fixedSum,
      claim,
      total: round2(debt + claim),
      formula: `Interest = debt x ${round2(annualRatePct)}% / 365 x days late. The ${round2(annualRatePct)}% is 8% plus the ${round2(baseRatePct)}% base rate.`,
    };
  }

  root.LatePayment = { daysBetween, fixedSumFor, latePayment, money };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("lpi-app");
  const dataEl = document.getElementById("lpi-data");
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

  function field(label, hint, type, value, extra) {
    const id = "lpi-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = type;
    if (type === "number") { input.inputMode = "decimal"; input.min = "0"; input.step = "any"; }
    if (value != null) input.value = String(value);
    if (extra) Object.assign(input, extra);
    wrap.append(lab);
    if (hint) { const p = el("p", "ft-hint", hint); p.id = id + "-h"; input.setAttribute("aria-describedby", p.id); wrap.append(p); }
    wrap.append(input);
    return { wrap, input };
  }

  const todayIso = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const box = el("section", "ft-box");
  box.setAttribute("aria-labelledby", "lpi-calc-h");
  const h = el("h2", "lx-h3", "The late invoice");
  h.id = "lpi-calc-h";

  const debt = field("Unpaid invoice amount (£)", "The amount that is overdue.", "number", "");
  const due = field("Agreed payment date", "The day the invoice was due. Interest starts the day after.", "date", "");
  const paid = field("Date paid, or today if still unpaid", "Leave blank to use today's date.", "date", "");
  const base = field("Bank of England base rate (%)", DATA.baseHint, "number", DATA.defaultBase);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");
  const out = el("div", "lpi-out");
  out.setAttribute("aria-live", "polite");

  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", strong ? "lpi-strong" : null, v));
    return tr;
  };

  function render() {
    err.textContent = "";
    out.textContent = "";
    if (debt.input.value.trim() === "" || due.input.value === "") return;
    const r = latePayment({
      debt: Number(debt.input.value),
      baseRatePct: base.input.value.trim() === "" ? NaN : Number(base.input.value),
      dueDate: due.input.value,
      paidDate: paid.input.value || todayIso(),
    });
    if (!r.ok) { err.textContent = r.error; return; }
    const m = (n) => "£" + money(n);
    if (r.days === 0) {
      out.append(el("p", "lpi-headline", "Not late on these dates, so no statutory interest or fixed sum yet."));
      return;
    }
    out.append(el("p", "lpi-headline", `You can claim ${m(r.claim)} on top of the invoice`));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table lpi-results");
    t.append(el("caption", "lpi-cap", "How it is worked out"));
    const tb = el("tbody");
    tb.append(
      row("Days late", String(r.days)),
      row("Yearly interest rate (8% + base rate)", r.annualRatePct + "%"),
      row("Interest per day", m(r.dailyInterest)),
      row("Interest for " + r.days + " days", m(r.interest), true),
      row("Fixed compensation", m(r.fixedSum), true),
      row("Interest plus fixed compensation", m(r.claim), true),
      row("Invoice plus the above", m(r.total)),
    );
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    out.append(el("p", "ft-hint", "Formula used: " + r.formula));
    out.append(el("p", "ft-hint", "The fixed sum is charged once per late payment. Reasonable recovery costs above it can be claimed too. A guide only, not legal advice."));
  }

  // Faster first use: one tap fills a sample invoice and shows the full working.
  const sample = el("button", "try-btn", "Try an example");
  sample.type = "button";
  sample.addEventListener("click", () => { debt.input.value = "2500"; due.input.value = "2026-08-01"; paid.input.value = "2026-09-15"; render(); });
  const acts = el("div", "try-controls");
  acts.append(sample);
  box.append(h, debt.wrap, due.wrap, paid.wrap, base.wrap, acts, err, out);
  [debt, due, paid, base].forEach((f) => { f.input.addEventListener("input", render); f.input.addEventListener("change", render); });

  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
