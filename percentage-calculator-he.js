// /he/percentage-calculator/ client logic (Hebrew, RTL). Progressive enhancement: the page already explains the sums without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of the pure functions in src/app/landing/data/tools/percent-calc.ts with the types removed.
// tests/tools-a-percentage.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the texts from <script id="pc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure maths (keep identical to percent-calc.ts) ----------
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  function num(n) {
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    const f = frac.replace(/0+$/, "");
    const neg = n < 0 && (whole !== "0" || f !== "");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? "." + f : ""}`;
  }

  function fix2(n) {
    const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
    const neg = n < 0 && (whole !== "0" || frac !== "00");
    return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }

  function parseNum(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function percentCalc(i) {
    const { mode, a, b } = i;
    if (!["of", "what", "change", "after", "before"].includes(mode)) return { ok: false, error: "mode" };
    for (const v of [a, b]) if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "number" };
    if (Math.abs(a) > 1e12 || Math.abs(b) > 1e12) return { ok: false, error: "number" };
    if (mode === "of") return { ok: true, mode, value: round2((a / 100) * b), extra: null };
    if (mode === "what") {
      if (b === 0) return { ok: false, error: "zero" };
      return { ok: true, mode, value: round2((a / b) * 100), extra: null };
    }
    if (mode === "change") {
      if (a === 0) return { ok: false, error: "zero" };
      return { ok: true, mode, value: round2(((b - a) / Math.abs(a)) * 100), extra: round2(b - a) };
    }
    // after / before: a is a price, b is the discount in percent
    if (a < 0) return { ok: false, error: "negative" };
    if (b < 0 || b > 100) return { ok: false, error: "range" };
    if (mode === "after") {
      const after = round2(a * (1 - b / 100));
      return { ok: true, mode, value: after, extra: round2(a - after) };
    }
    if (b >= 100) return { ok: false, error: "range" };
    const before = round2(a / (1 - b / 100));
    return { ok: true, mode, value: before, extra: round2(before - a) };
  }
  // ---------- end PART 1 ----------

  root.PercentageHe = { percentCalc, num, fix2, parseNum };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pc-app");
  const dataEl = document.getElementById("pc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const T = DATA.ui;
  const RTL = !!DATA.rtl;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  function field(id, labelEl, control) {
    const wrap = el("div", "ft-field");
    labelEl.htmlFor = id;
    control.id = id;
    wrap.append(labelEl, control);
    return wrap;
  }
  const numInput = () => {
    const i = el("input");
    i.type = "text";
    i.inputMode = "decimal";
    i.autocomplete = "off";
    if (RTL) i.dir = "ltr";
    return i;
  };

  const mode = el("select");
  DATA.modes.forEach((m) => { const o = el("option", null, m.label); o.value = m.id; mode.append(o); });
  mode.hidden = true;
  // Plain buttons instead of a drop-down: one tap picks the sum, and each one opens with a worked example already filled in.
  const tabs = el("div", "ft-tabs");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", T.mode);
  const tabBtns = DATA.modes.map((m) => {
    const b = el("button", "try-btn", m.label);
    b.type = "button";
    b.addEventListener("click", () => { mode.value = m.id; dirty = false; labels(); prefill(); update(); });
    tabs.append(b);
    return b;
  });
  let dirty = false;
  const eg = (t) => (t || "").replace(/[^0-9.,]/g, "");
  function prefill() { if (dirty) return; const c = cfg(); aIn.value = eg(c.aPlaceholder); bIn.value = eg(c.bPlaceholder); }
  const aIn = numInput();
  const bIn = numInput();
  const aLab = el("label");
  const bLab = el("label");

  const form = el("div", "ft-box");
  const grid = el("div", "ft-grid");
  grid.append(field("pc-a", aLab, aIn), field("pc-b", bLab, bIn));
  form.append(el("p", "ft-hint", T.mode), tabs, mode, grid);

  const error = el("p", "ft-error");
  error.setAttribute("role", "alert");
  const result = el("div", "ft-box");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");

  const cfg = () => DATA.modes.find((m) => m.id === mode.value) || DATA.modes[0];
  const fill = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : ""));

  function labels() {
    const c = cfg();
    aLab.textContent = c.a;
    bLab.textContent = c.b;
    aIn.placeholder = c.aPlaceholder || "";
    bIn.placeholder = c.bPlaceholder || "";
    tabBtns.forEach((b, i) => { const on = DATA.modes[i].id === c.id; b.setAttribute("aria-pressed", on ? "true" : "false"); b.style.background = on ? "var(--lx-blue)" : ""; b.style.color = on ? "#fff" : ""; b.style.borderColor = on ? "var(--lx-blue)" : ""; });
  }

  function update() {
    result.textContent = "";
    const c = cfg();
    if (!aIn.value.trim() || !bIn.value.trim()) { error.textContent = ""; result.append(el("p", "ft-hint", T.empty)); return; }
    const a = parseNum(aIn.value);
    const b = parseNum(bIn.value);
    const r = percentCalc({ mode: c.id, a, b });
    if (!r.ok) { error.textContent = T.errors[r.error] || T.errors.number; result.append(el("p", "ft-hint", T.empty)); return; }
    error.textContent = "";
    const money = c.id === "after" || c.id === "before";
    const map = {
      A: money ? fix2(a) : num(a),
      B: num(b),
      V: money ? fix2(r.value) : num(r.value),
      X: r.extra == null ? "" : fix2(Math.abs(r.extra)),
      DIR: r.value > 0 ? T.up : r.value < 0 ? T.down : T.same,
    };
    if (c.id === "change") map.V = num(Math.abs(r.value));
    const head = el("p", null, fill(c.result, map));
    head.style.fontWeight = "700";
    head.style.fontSize = "1.7rem";
    head.style.margin = "0";
    result.append(head);
    if (r.extra != null && c.extra) result.append(el("p", "ft-hint", fill(c.extra, map)));
    if (c.formula) result.append(el("p", "ft-hint", c.formula));
  }

  [aIn, bIn].forEach((n) => n.addEventListener("input", () => { dirty = true; update(); }));
  mode.addEventListener("change", () => { dirty = false; labels(); prefill(); update(); });

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.tag), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, result);
  labels();
  prefill();
  update();
})(typeof globalThis !== "undefined" ? globalThis : this);
