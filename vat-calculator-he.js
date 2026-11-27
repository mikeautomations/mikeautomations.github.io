// /he/vat-calculator/ client logic (Hebrew, RTL). Progressive enhancement: the page already explains the calculation without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of src/app/landing/data/tools/vat-he-calc.ts with the types removed (keep identical).
// tests/he-tools-d.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the texts from <script id="vc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to PART 1 of vat-he-calc.ts) ----------
  function parseAmountHe(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function computeVatHe(mode, amount, pct) {
    const a = parseAmountHe(amount);
    const p = parseAmountHe(pct);
    if (!Number.isFinite(a)) return { ok: false, error: "הזינו סכום בספרות בלבד." };
    if (a >= 1e9) return { ok: false, error: "הסכום גדול מדי." };
    if (!Number.isFinite(p) || p > 100) return { ok: false, error: "שיעור המע\"מ צריך להיות מספר בין 0 ל-100." };
    const cents = Math.round(a * 100 + 1e-9);
    let netCents;
    let vatCents;
    let grossCents;
    if (mode === "remove") {
      grossCents = cents;
      netCents = Math.round((cents * 100) / (100 + p));
      vatCents = grossCents - netCents;
    } else {
      netCents = cents;
      vatCents = Math.round((cents * p) / 100);
      grossCents = netCents + vatCents;
    }
    return { ok: true, mode: mode === "remove" ? "remove" : "add", pct: p, netCents, vatCents, grossCents };
  }

  function formatIlsHe(cents) {
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const num = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(abs % 100).padStart(2, "0");
    return (neg ? "-" : "") + num + " ₪";
  }
  // ---------- end PART 1 ----------

  root.VatCalculatorHe = { parseAmountHe, computeVatHe, formatIlsHe };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("vc-app");
  const dataEl = document.getElementById("vc-data");
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
    const id = "vc-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }

  const mode = el("select");
  [["add", T.modeAdd], ["remove", T.modeRemove]].forEach((m) => {
    const o = el("option", null, m[1]);
    o.value = m[0];
    mode.append(o);
  });
  const amount = el("input");
  amount.type = "text";
  amount.inputMode = "decimal";
  amount.dir = "ltr";
  amount.autocomplete = "off";
  amount.placeholder = T.amountPlaceholder;
  amount.value = "1000";
  const rate = el("input");
  rate.type = "text";
  rate.inputMode = "decimal";
  rate.dir = "ltr";
  rate.autocomplete = "off";
  rate.value = String(DATA.defaultPct);

  const form = el("div", "ft-box");
  const grid = el("div", "ft-grid");
  grid.append(field(T.mode, null, mode), field(T.amount, T.amountHint, amount), field(T.rate, T.rateHint, rate));
  // Quick amounts: one tap fills the sum, so the first answer needs no typing.
  const chips = el("div", "try-controls");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", T.quick);
  [100, 500, 1000, 5000, 10000, 50000].forEach((n) => {
    const b = el("button", "try-btn", n.toLocaleString("en-US") + " ₪");
    b.type = "button";
    b.addEventListener("click", () => { amount.value = String(n); update(); });
    chips.append(b);
  });
  form.append(grid, chips);

  const error = el("p", "ft-error");
  error.setAttribute("role", "alert");
  const result = el("div", "ft-box");
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");

  function row(label, value, strong) {
    const tr = el("tr");
    const th = el("th", null, label);
    th.scope = "row";
    const td = el("td", "ft-ltr", value);
    if (strong) { th.style.fontWeight = "700"; td.style.fontWeight = "700"; }
    tr.append(th, td);
    return tr;
  }

  function update() {
    result.textContent = "";
    if (!amount.value.trim()) { error.textContent = ""; result.append(el("p", "ft-hint", T.empty)); return; }
    const r = computeVatHe(mode.value, amount.value, rate.value);
    if (!r.ok) { error.textContent = r.error; result.append(el("p", "ft-hint", T.empty)); return; }
    error.textContent = "";
    const table = el("table", "ft-when");
    const body = el("tbody");
    body.append(
      row(T.net, formatIlsHe(r.netCents), mode.value === "add"),
      row(T.vat + " (" + r.pct + "%)", formatIlsHe(r.vatCents)),
      row(T.gross, formatIlsHe(r.grossCents), mode.value === "remove"),
    );
    table.append(body);
    const big = el("p", "ft-big ft-ltr", formatIlsHe(mode.value === "add" ? r.grossCents : r.netCents));
    big.style.cssText = "font-size:2rem;font-weight:800;margin:0;line-height:1.2";
    const cap = el("p", "ft-hint", mode.value === "add" ? T.gross : T.net);
    cap.style.margin = "0";
    result.append(cap, big);
    const how = r.mode === "remove"
      ? T.howRemove.replace("{G}", formatIlsHe(r.grossCents)).replace("{F}", String(1 + r.pct / 100)).replace("{N}", formatIlsHe(r.netCents))
      : T.howAdd.replace("{N}", formatIlsHe(r.netCents)).replace("{F}", String(1 + r.pct / 100)).replace("{G}", formatIlsHe(r.grossCents));
    result.append(table, el("p", "ft-hint", how));
  }
  [mode, amount, rate].forEach((n) => n.addEventListener("input", update));
  mode.addEventListener("change", update);

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.tag), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, result);
  update();
})(typeof globalThis !== "undefined" ? globalThis : this);
