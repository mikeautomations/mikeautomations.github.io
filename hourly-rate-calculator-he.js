// /he/hourly-rate-calculator/ client logic. Progressive enhancement: the page already explains everything without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is generated from src/app/landing/he-tools/hourly-rate-he-data.ts (hourlyRate(), money(), fmt()), types removed.
// tests/he-tools-c.test.ts loads this file in a sandbox and checks it gives the same results as the TypeScript.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (generated from hourly-rate-he-data.ts) ----------
  // /he/hourly-rate-calculator/: the maths and the copy. public/hourly-rate-calculator-he.js carries a copy of
  // hourlyRate(), money() and fmt() (PART 1 of that file, generated from this file's functions);
  // tests/he-tools-c.test.ts checks both give the same numbers. Self-contained on purpose (no imports).
  // Money is entered per month, the way Israeli freelancers think about it, and worked out per year.
  const IL_VAT_PCT = 18;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  function hourlyRate(i) {
      const { takeHomeMonthly, costsMonthly, weeksOff, daysPerWeek, hoursPerDay, taxPct } = i;
      for (const v of [takeHomeMonthly, costsMonthly, weeksOff, daysPerWeek, hoursPerDay, taxPct]) {
          if (typeof v !== "number" || !Number.isFinite(v))
              return { ok: false, error: "יש להזין מספרים בלבד." };
      }
      if (takeHomeMonthly < 0 || costsMonthly < 0)
          return { ok: false, error: "השכר וההוצאות לא יכולים להיות שליליים." };
      if (weeksOff < 0 || weeksOff >= 52)
          return { ok: false, error: "שבועות חופשה: מספר בין 0 ל-51." };
      if (daysPerWeek <= 0 || daysPerWeek > 7)
          return { ok: false, error: "ימי עבודה בשבוע: יותר מ-0 ועד 7." };
      if (hoursPerDay <= 0 || hoursPerDay > 24)
          return { ok: false, error: "שעות לחיוב ביום: יותר מ-0 ועד 24." };
      if (taxPct < 0 || taxPct > 90)
          return { ok: false, error: "ההפרשה למס צריכה להיות בין 0 ל-90 אחוז." };
      const takeHome = takeHomeMonthly * 12;
      const costs = costsMonthly * 12;
      const profitNeeded = takeHome / (1 - taxPct / 100);
      const revenueNeeded = profitNeeded + costs;
      const workingWeeks = 52 - weeksOff;
      const billableDays = workingWeeks * daysPerWeek;
      const billableHours = billableDays * hoursPerDay;
      const vat = 1 + IL_VAT_PCT / 100;
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
          hourlyWithVat: round2((revenueNeeded / billableHours) * vat),
          dayWithVat: round2((revenueNeeded / billableDays) * vat),
      };
  }
  /** 1234.5 -> "1,234.50". Written by hand so the page and the tests never depend on the device's locale. */
  function money(n) {
      const neg = n < 0;
      const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
      return `${neg ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  }
  /** Amount with the currency after it, as Hebrew is written: "135.00 ₪". */
  function fmt(n, symbol) {
      return money(n) + (symbol ? " " + symbol : "");
  }
  const CURRENCIES = [
      { symbol: "₪", label: "₪ שקל" },
      { symbol: "$", label: "$ דולר" },
      { symbol: "€", label: "€ אירו" },
      { symbol: "", label: "בלי סימן מטבע" },
  ];
  const EXAMPLE_INPUT = { takeHomeMonthly: 12000, costsMonthly: 1500, weeksOff: 4, daysPerWeek: 5, hoursPerDay: 5, taxPct: 0 };
  const FAQ = [
      {
          q: "למה לא פשוט לחלק את השכר השנתי ב-52 שבועות של 40 שעות?",
          a: "כי אי אפשר לחייב כל שעה שעובדים. הצעות מחיר, ניירת, חשבוניות, מרדף אחרי תשלומים ולמידה לוקחים זמן שאף לקוח לא משלם עליו, וחופשה ומחלה לא מכניסות כסף. אם מחלקים את ההוצאות על שעות שלא תחייבו, מגיעים לתעריף נמוך מדי.",
      },
      {
          q: "כמה שעות לחיוב ביום כדאי להזין?",
          a: "הזינו את השעות שאתם באמת מחייבים ביום עבודה רגיל, לא את השעות שאתם יושבים בעבודה. אם אתם לא בטוחים, רשמו את הזמן שלכם במשך שבועיים וספרו רק שעות שלקוח משלם עליהן. אצל רבים זה פחות ממה שציפו.",
      },
      {
          q: "כמה להפריש למס הכנסה ולביטוח לאומי?",
          a: "זה תלוי בגובה ההכנסה, בסוג העוסק ובנתונים האישיים, ולכן הדף לא מציע אחוז. שאלו רואה חשבון או בדקו באתר רשות המסים ובאתר ביטוח לאומי, והזינו את החלק מהשכר שתפרישו. השאירו 0 כדי לקבל תעריף לפני הפרשה למס.",
      },
      {
          q: "האם התעריף כולל מע\"מ?",
          a: "לא. התעריף שהמחשבון מחזיר הוא לפני מע\"מ. עוסק מורשה מוסיף מע\"מ על המחיר ללקוח, בשיעור של 18% נכון לנובמבר 2026, ומעביר אותו למדינה, כך שהוא לא נחשב הכנסה שלכם. עוסק פטור לא גובה מע\"מ. המחשבון מציג גם את המחיר ללקוח כולל מע\"מ, לבחירתכם.",
      },
  ];

  root.HourlyRateHe = { IL_VAT_PCT, hourlyRate, money, fmt, CURRENCIES, EXAMPLE_INPUT, FAQ };

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
    const wrap = el("div", "het-field");
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
    if (hint) { const h = el("span", "het-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return { wrap, input };
  }

  const blank = (input) => input.value.trim() === "";
  const num = (input) => (blank(input) ? NaN : Number(input.value));

  const box = el("section", "het-box");
  box.setAttribute("aria-labelledby", "hr-calc-h");
  const h = el("h2", "lx-h3", "הנתונים שלכם");
  h.id = "hr-calc-h";

  const curWrap = el("div", "het-field");
  const curLab = el("label", null, "מטבע");
  curLab.htmlFor = "hr-cur";
  const cur = el("select");
  cur.id = "hr-cur";
  DATA.currencies.forEach((c) => { const o = el("option", null, c.label); o.value = c.symbol; cur.append(o); });
  curWrap.append(curLab, cur);

  const takeHome = field("שכר נטו חודשי שאתם רוצים", "מה שאתם רוצים שיישאר אחרי הוצאות העסק והמס.", "");
  const costs = field("הוצאות עסק בחודש", "תוכנות, ביטוח, רכב, טלפון, ציוד, הדרכות וכדומה.", "");
  const weeks = field("שבועות חופשה בשנה", "חופשה, מחלה וחגים. ערך התחלתי, אפשר לשנות.", 4, "0.5");
  const days = field("ימי עבודה בשבוע", "ערך התחלתי, אפשר לשנות.", 5, "0.5");
  const hours = field("שעות לחיוב ביום עבודה", "רק שעות שלקוח משלם עליהן. לא תחייבו כל שעה שאתם עובדים: ניירת, הצעות מחיר ומרדף אחרי תשלומים לא נכללים.", 5, "0.5");
  const tax = field("הפרשה למס הכנסה ולביטוח לאומי, באחוזים (רשות)", "החלק מהשכר שתפרישו. השאירו 0 כדי לקבל תעריף לפני הפרשה.", 0, "any");

  const vatWrap = el("label", "het-check");
  const vat = el("input");
  vat.type = "checkbox";
  vat.id = "hr-vat";
  vatWrap.append(vat, document.createTextNode(" אני עוסק מורשה: הצג גם מחיר כולל מע\"מ (" + IL_VAT_PCT + "%)"));

  const err = el("p", "het-error");
  err.setAttribute("role", "alert");
  const out = el("div", "het-out");
  out.setAttribute("aria-live", "polite");

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
    if (blank(takeHome.input)) return;
    const raw = {
      takeHomeMonthly: num(takeHome.input),
      costsMonthly: blank(costs.input) ? 0 : num(costs.input),
      weeksOff: num(weeks.input),
      daysPerWeek: num(days.input),
      hoursPerDay: num(hours.input),
      taxPct: blank(tax.input) ? 0 : num(tax.input),
    };
    const r = hourlyRate(raw);
    if (!r.ok) { err.textContent = r.error; return; }
    const m = (n) => fmt(n, cur.value);
    out.append(el("p", "het-headline", "תעריף מינימלי לשעה: " + m(r.hourly)));
    out.append(el("p", "het-headline", "תעריף מינימלי ליום: " + m(r.day)));
    if (vat.checked) out.append(el("p", null, "ללקוח כולל מע\"מ: " + m(r.hourlyWithVat) + " לשעה, " + m(r.dayWithVat) + " ליום."));
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table het-results");
    t.append(el("caption", "het-cap", "איך חושב התעריף"));
    const tb = el("tbody");
    tb.append(row("שכר נטו שנתי שאתם רוצים", m(raw.takeHomeMonthly * 12)));
    if (raw.taxPct > 0) tb.append(row("הפרשה למס ולביטוח לאומי", m(r.taxSetAside)));
    tb.append(
      row("שכר לפני הפרשה", m(r.profitNeeded)),
      row("הוצאות עסק בשנה", m(raw.costsMonthly * 12)),
      row("ההכנסה שהעסק צריך להכניס בשנה", m(r.revenueNeeded), true),
      row("שבועות עבודה", String(r.workingWeeks)),
      row("ימי חיוב", String(r.billableDays)),
      row("שעות חיוב", String(r.billableHours)),
      row("תעריף מינימלי לשעה (לפני מע\"מ)", m(r.hourly), true),
      row("תעריף מינימלי ליום (לפני מע\"מ)", m(r.day), true),
      row("הכנסה נדרשת בחודש", m(r.monthly)),
    );
    if (vat.checked) tb.append(row("לשעה כולל מע\"מ", m(r.hourlyWithVat)), row("ליום כולל מע\"מ", m(r.dayWithVat)));
    t.append(tb);
    wrap.append(t);
    out.append(wrap);
    out.append(el("p", "het-hint", "זה המינימום, לא המחיר שחייבים לגבות. אפשר לגבות יותר כדי להתכונן לחודשים איטיים או ללקוחות שמאחרים בתשלום."));
  }

  box.append(h, curWrap, takeHome.wrap, costs.wrap, weeks.wrap, days.wrap, hours.wrap, tax.wrap, vatWrap, err, out);
  [takeHome, costs, weeks, days, hours, tax].forEach((f) => f.input.addEventListener("input", render));
  cur.addEventListener("change", render);
  vat.addEventListener("change", render);

  app.textContent = "";
  app.append(box);
})(typeof globalThis !== "undefined" ? globalThis : this);
