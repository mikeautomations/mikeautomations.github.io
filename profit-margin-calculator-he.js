// /he/profit-margin-calculator/ client logic. Progressive enhancement: the page already explains everything without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is generated from src/app/landing/he-tools/margin-he-data.ts (fromPrice(), priceFromMargin(), priceFromMarkup(), calc(), money(), fmt()), types removed.
// tests/he-tools-c.test.ts loads this file in a sandbox and checks it gives the same results as the TypeScript.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (generated from margin-he-data.ts) ----------
  // /he/profit-margin-calculator/: the maths and the copy. public/profit-margin-calculator-he.js carries a copy of these
  // functions (PART 1, generated from this file); tests/he-tools-c.test.ts checks both give the same numbers.
  // Self-contained on purpose (no imports). Includes the optional "price including VAT" step.
  const IL_VAT_PCT = 18;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  function fromPrice(cost, price) {
      if (!isNum(cost) || !isNum(price))
          return { ok: false, error: "יש להזין מספרים בלבד." };
      if (cost < 0)
          return { ok: false, error: "העלות לא יכולה להיות שלילית." };
      if (price <= 0)
          return { ok: false, error: "המחיר חייב להיות גדול מ-0." };
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
      if (!isNum(cost) || !isNum(marginPct))
          return { ok: false, error: "יש להזין מספרים בלבד." };
      if (cost < 0)
          return { ok: false, error: "העלות לא יכולה להיות שלילית." };
      if (marginPct >= 100)
          return { ok: false, error: "הרווח הגולמי חייב להיות מתחת ל-100 אחוז. אין מחיר שנותן 100 אחוז כשיש עלות." };
      if (marginPct < 0)
          return { ok: false, error: "הרווח הגולמי לא יכול להיות שלילי כאן." };
      const price = cost / (1 - marginPct / 100);
      if (price <= 0)
          return { ok: false, error: "המחיר חייב להיות גדול מ-0. הזינו עלות גדולה מ-0." };
      return fromPrice(cost, price);
  }
  function priceFromMarkup(cost, markupPct) {
      if (!isNum(cost) || !isNum(markupPct))
          return { ok: false, error: "יש להזין מספרים בלבד." };
      if (cost < 0)
          return { ok: false, error: "העלות לא יכולה להיות שלילית." };
      if (markupPct < 0)
          return { ok: false, error: "התוספת לא יכולה להיות שלילית כאן." };
      const price = cost * (1 + markupPct / 100);
      if (price <= 0)
          return { ok: false, error: "המחיר חייב להיות גדול מ-0. הזינו עלות גדולה מ-0." };
      return fromPrice(cost, price);
  }
  /** Price including VAT -> price before VAT. */
  const removeVat = (gross) => round2(gross / (1 + IL_VAT_PCT / 100));
  /** Price before VAT -> price including VAT. */
  const addVat = (net) => round2(net * (1 + IL_VAT_PCT / 100));
  /**
   * One calculation for the page. vat = true means "the price is shown including VAT":
   * in "price" mode the price you type is gross and the margin is worked out on the price before VAT;
   * in the other modes the price found is before VAT and the price including VAT is added.
   * The cost is always the cost before VAT. gross is null when vat is off.
   */
  function calc(mode, cost, x, vat) {
      if (mode === "price") {
          if (!vat || !isNum(x))
              return { r: fromPrice(cost, x), gross: null };
          return { r: fromPrice(cost, removeVat(x)), gross: round2(x) };
      }
      const r = mode === "margin" ? priceFromMargin(cost, x) : priceFromMarkup(cost, x);
      return { r, gross: r.ok && vat ? addVat(r.price) : null };
  }
  function money(n) {
      const neg = n < 0;
      const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
      return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }
  /** Amount with the currency after it, as Hebrew is written: "100.00 ₪". */
  function fmt(n, symbol) {
      return money(n) + (symbol ? " " + symbol : "");
  }
  const CURRENCIES = [
      { symbol: "₪", label: "₪ שקל" },
      { symbol: "$", label: "$ דולר" },
      { symbol: "€", label: "€ אירו" },
      { symbol: "", label: "בלי סימן מטבע" },
  ];
  const EXAMPLE = { cost: 60, price: 100 };
  const FAQ = [
      {
          q: "מה ההבדל בין רווח גולמי (מרווח) לתוספת (מארק-אפ)?",
          a: "שניהם מבוססים על אותו רווח, אבל מחלקים אותו במשהו אחר. רווח גולמי הוא הרווח חלקי מחיר המכירה. תוספת היא הרווח חלקי העלות. לכן באותה עסקה התוספת תמיד גבוהה מהרווח הגולמי באחוזים.",
      },
      {
          q: "איך הופכים תוספת לרווח גולמי?",
          a: "השתמשו במצב \"עלות ותוספת\": הזינו עלות ותוספת, והמחשבון יציג את המחיר ואת הרווח הגולמי שמתאים לו. בחישוב ידני: רווח גולמי = תוספת חלקי (100 + תוספת). למשל, תוספת של 100 אחוז היא רווח גולמי של 50 אחוז.",
      },
      {
          q: "האם רווח גולמי יכול להיות 100 אחוז או יותר?",
          a: "לא. רווח גולמי הוא חלק ממחיר המכירה, ולכן הוא נשאר מתחת ל-100 אחוז כל עוד יש עלות. לתוספת אין תקרה כזו: למכור במחיר פי שלושה מהעלות זה תוספת של 200 אחוז.",
      },
      {
          q: "האם להכניס מע\"מ לחישוב?",
          a: "הרווח צריך להיחשב על המחיר לפני מע\"מ, כי המע\"מ עובר למדינה. אם המחיר שלכם מוצג ללקוח כולל מע\"מ (18% נכון לנובמבר 2026), הפעילו את האפשרות \"המחיר כולל מע\"מ\" והמחשבון יוריד אותו לפני החישוב. הזינו את העלות לפני מע\"מ. עוסק פטור לא גובה מע\"מ, ואז לא צריך להפעיל אותה.",
      },
  ];

  root.ProfitMarginHe = { IL_VAT_PCT, fromPrice, priceFromMargin, priceFromMarkup, removeVat, addVat, calc, money, fmt, CURRENCIES, EXAMPLE, FAQ };

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
    const wrap = el("div", "het-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "any";
    wrap.append(lab);
    if (hint) { const h = el("span", "het-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return { wrap, input };
  }

  const box = el("section", "het-box");
  box.setAttribute("aria-labelledby", "pm-calc-h");
  const h = el("h2", "lx-h3", "הנתונים שלכם");
  h.id = "pm-calc-h";

  // Mode choice: a native radio group, so arrow keys and screen readers work without extra code.
  const modes = [
    ["price", "עלות ומחיר: לחשב רווח גולמי ותוספת"],
    ["margin", "עלות ורווח גולמי: לחשב מחיר"],
    ["markup", "עלות ותוספת: לחשב מחיר"],
  ];
  const fs = el("fieldset", "het-set");
  fs.append(el("legend", null, "מה רוצים לחשב?"));
  const radios = modes.map(([val, text], i) => {
    const lab = el("label", "het-mode");
    const r = el("input");
    r.type = "radio";
    r.name = "pm-mode";
    r.value = val;
    r.checked = i === 0;
    lab.append(r, document.createTextNode(" " + text));
    fs.append(lab);
    return r;
  });

  const curWrap = el("div", "het-field");
  const curLab = el("label", null, "מטבע");
  curLab.htmlFor = "pm-cur";
  const cur = el("select");
  cur.id = "pm-cur";
  DATA.currencies.forEach((c) => { const o = el("option", null, c.label); o.value = c.symbol; cur.append(o); });
  curWrap.append(curLab, cur);

  const cost = field("עלות (לפני מע\"מ)", "מה עולה לכם מכירה אחת: חומרים, הזמן שלכם, עמלות ומשלוח.");
  const price = field("מחיר מכירה", "מה שהלקוח משלם.");
  const margin = field("רווח גולמי רצוי, באחוזים", "הרווח כחלק ממחיר המכירה. מתחת ל-100.");
  const markup = field("תוספת רצויה, באחוזים", "הרווח כחלק מהעלות.");

  const vatWrap = el("label", "het-check");
  const vat = el("input");
  vat.type = "checkbox";
  vat.id = "pm-vat";
  const vatText = document.createTextNode("");
  vatWrap.append(vat, vatText);

  const err = el("p", "het-error");
  err.setAttribute("role", "alert");
  const out = el("div", "het-out");
  out.setAttribute("aria-live", "polite");

  const mode = () => radios.find((r) => r.checked).value;
  function syncFields() {
    const m = mode();
    price.wrap.hidden = m !== "price";
    margin.wrap.hidden = m !== "margin";
    markup.wrap.hidden = m !== "markup";
    vatText.textContent = " " + (m === "price" ? "המחיר שהזנתי כולל מע\"מ (" + IL_VAT_PCT + "%)" : "הצג גם את המחיר ללקוח כולל מע\"מ (" + IL_VAT_PCT + "%)");
  }

  const pct = (n) => (n === Infinity ? "לא מוגדר (העלות 0)" : money(n) + "%");
  const row = (k, v, strong) => {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", "het-num" + (strong ? " het-strong" : ""), v));
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
    const res = calc(m, c, x, vat.checked);
    const r = res.r;
    if (!r.ok) { err.textContent = r.error; return; }
    const f = (n) => fmt(n, cur.value);
    out.append(el("p", "het-headline", "רווח גולמי: " + pct(r.marginPct)));
    out.append(el("p", "het-headline", "תוספת: " + pct(r.markupPct)));
    if (m !== "price") out.append(el("p", "het-headline", "מחיר מכירה" + (res.gross != null ? " לפני מע\"מ" : "") + ": " + f(r.price)));
    if (res.gross != null) out.append(el("p", "het-headline", "מחיר ללקוח כולל מע\"מ: " + f(res.gross)));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table het-results");
    t.append(el("caption", "het-cap", "הפירוט"));
    const tb = el("tbody");
    tb.append(row("עלות", f(r.cost)));
    if (res.gross != null) tb.append(row("מחיר כולל מע\"מ", f(res.gross)));
    tb.append(
      row("מחיר מכירה" + (res.gross != null ? " (לפני מע\"מ)" : ""), f(r.price), m !== "price"),
      row("רווח (מחיר פחות עלות)", f(r.profit)),
      row("רווח גולמי (רווח חלקי מחיר)", pct(r.marginPct), true),
      row("תוספת (רווח חלקי עלות)", pct(r.markupPct), true),
    );
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
  }

  box.append(h, fs, curWrap, cost.wrap, price.wrap, margin.wrap, markup.wrap, vatWrap, err, out);
  syncFields();
  radios.forEach((r) => r.addEventListener("change", () => { syncFields(); render(); }));
  [cost, price, margin, markup].forEach((f) => f.input.addEventListener("input", render));
  cur.addEventListener("change", render);
  vat.addEventListener("change", render);

  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
