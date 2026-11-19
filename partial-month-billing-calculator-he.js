// /he/partial-month-billing-calculator/ client logic (Hebrew, RTL). Progressive enhancement: the page already explains the sum without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of src/app/landing/data/tools/partial-month-calc.ts with the types removed (keep identical).
// tests/he-tools-d.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the texts from <script id="pm-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to PART 1 of partial-month-calc.ts) ----------
  function parseNumHe(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function partialMonthHe(basis, fee, monthDays, workedDays, vatPct) {
    const f = parseNumHe(fee);
    const md = parseNumHe(monthDays);
    const wd = parseNumHe(workedDays);
    const vp = parseNumHe(vatPct === "" || vatPct == null ? 0 : vatPct);
    if (!Number.isFinite(f)) return { ok: false, error: "הזינו סכום בספרות בלבד." };
    if (f >= 1e9) return { ok: false, error: "הסכום גדול מדי." };
    if (!Number.isFinite(md) || md < 1 || md > 31) return { ok: false, error: "ימי העבודה בחודש: מספר בין 1 ל-31." };
    if (!Number.isFinite(wd)) return { ok: false, error: "הזינו את מספר הימים שעבדתם, אפשר גם חצי יום (למשל 12.5)." };
    if (wd > md) return { ok: false, error: "הימים שעבדתם לא יכולים להיות יותר מימי העבודה בחודש." };
    if (!Number.isFinite(vp) || vp > 100) return { ok: false, error: "שיעור המע\"מ צריך להיות מספר בין 0 ל-100." };
    const feeCents = Math.round(f * 100 + 1e-9);
    const isDaily = basis === "daily";
    const dayRateCents = isDaily ? feeCents : Math.round(feeCents / md);
    const amountCents = isDaily ? Math.round(feeCents * wd) : Math.round((feeCents * wd) / md);
    const vatCents = Math.round((amountCents * vp) / 100);
    return { ok: true, basis: isDaily ? "daily" : "monthly", dayRateCents, workedDays: wd, monthDays: md, amountCents, vatPct: vp, vatCents, totalCents: amountCents + vatCents };
  }

  function formatIlsPm(cents) {
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const num = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(abs % 100).padStart(2, "0");
    return (neg ? "-" : "") + num + " ₪";
  }
  // ---------- end PART 1 ----------

  root.PartialMonthHe = { parseNumHe, partialMonthHe, formatIlsPm };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pm-app");
  const dataEl = document.getElementById("pm-data");
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
    const id = "pm-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  function numInput(placeholder) {
    const i = el("input");
    i.type = "text";
    i.inputMode = "decimal";
    i.dir = "ltr";
    i.autocomplete = "off";
    if (placeholder) i.placeholder = placeholder;
    return i;
  }

  const basis = el("select");
  [["monthly", T.basisMonthly], ["daily", T.basisDaily]].forEach((m) => {
    const o = el("option", null, m[1]);
    o.value = m[0];
    basis.append(o);
  });
  const fee = numInput(T.feePlaceholder);
  const monthDays = numInput(T.monthDaysPlaceholder);
  const worked = numInput(T.workedPlaceholder);

  const vatBox = el("input");
  vatBox.type = "checkbox";
  const vatId = "pm-vat";
  vatBox.id = vatId;
  const vatLab = el("label", null, T.vatCheck);
  vatLab.htmlFor = vatId;
  const vatRow = el("div", "ft-field");
  vatRow.style.gridTemplateColumns = "auto 1fr";
  vatRow.style.alignItems = "center";
  vatRow.style.columnGap = "0.5rem";
  vatBox.style.width = "1.25rem";
  vatBox.style.height = "1.25rem";
  vatBox.style.minHeight = "0";
  vatRow.append(vatBox, vatLab);
  const rate = numInput();
  rate.value = String(DATA.defaultPct);
  const rateField = field(T.rate, T.rateHint, rate);
  rateField.hidden = true;

  const form = el("div", "ft-box");
  const grid = el("div", "ft-grid");
  const feeField = field(T.feeMonthly, T.feeHint, fee);
  const feeLabel = feeField.querySelector("label");
  grid.append(field(T.basis, null, basis), feeField, field(T.monthDays, T.monthDaysHint, monthDays), field(T.worked, T.workedHint, worked));
  form.append(grid, vatRow, rateField);

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
  const num = (n) => String(Math.round(n * 100) / 100);

  function update() {
    feeLabel.textContent = basis.value === "daily" ? T.feeDaily : T.feeMonthly;
    rateField.hidden = !vatBox.checked;
    result.textContent = "";
    if (!fee.value.trim() || !monthDays.value.trim() || !worked.value.trim()) { error.textContent = ""; result.append(el("p", "ft-hint", T.empty)); return; }
    const r = partialMonthHe(basis.value, fee.value, monthDays.value, worked.value, vatBox.checked ? rate.value : 0);
    if (!r.ok) { error.textContent = r.error; result.append(el("p", "ft-hint", T.empty)); return; }
    error.textContent = "";
    const table = el("table", "ft-when");
    const body = el("tbody");
    if (r.basis === "monthly") body.append(row(T.dayRate, formatIlsPm(r.dayRateCents)));
    body.append(row(T.amount, formatIlsPm(r.amountCents), !vatBox.checked));
    if (vatBox.checked) {
      body.append(row(T.vat + " (" + r.vatPct + "%)", formatIlsPm(r.vatCents)), row(T.total, formatIlsPm(r.totalCents), true));
    }
    table.append(body);
    const how = r.basis === "monthly"
      ? T.howMonthly.replace("{F}", formatIlsPm(Math.round(parseNumHe(fee.value) * 100))).replace("{M}", num(r.monthDays)).replace("{W}", num(r.workedDays)).replace("{A}", formatIlsPm(r.amountCents))
      : T.howDaily.replace("{F}", formatIlsPm(r.dayRateCents)).replace("{W}", num(r.workedDays)).replace("{A}", formatIlsPm(r.amountCents));
    result.append(table, el("p", "ft-hint", how));
  }
  [basis, fee, monthDays, worked, vatBox, rate].forEach((n) => n.addEventListener("input", update));
  [basis, vatBox].forEach((n) => n.addEventListener("change", update));

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.tag), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, result);
  update();
})(typeof globalThis !== "undefined" ? globalThis : this);
