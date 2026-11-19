// Shared client code for the Hebrew free tools (invoice, quote, payment reminder): /he/invoice-generator/,
// /he/quote-generator/, /he/payment-reminder-generator/. No dependencies, no network requests, no cookies, no tracking:
// nothing typed here leaves the device. PART 1 is a copy of the pure logic in src/app/landing/he-tools/he-tools-core.ts
// (types removed); tests/he-tools-a.test.ts loads this file in a sandbox and checks both copies agree.
// Load this file before the tool's own script.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to he-tools-core.ts) ----------
  function parseNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 && v < 1e9 ? v : 0;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n < 1e9 ? n : 0;
  }

  function toCents(v) {
    return Math.round(parseNumber(v) * 100 + 1e-9);
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function computeDoc(input) {
    const lines = (input.lines || []).map((l) => {
      const qty = parseNumber(l.qty);
      const unitCents = toCents(l.price);
      return { qty, unitCents, totalCents: Math.round(qty * unitCents) };
    });
    const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
    let discountCents = 0;
    if (input.discountKind === "percent") discountCents = Math.round((subtotalCents * clamp(parseNumber(input.discountValue), 0, 100)) / 100);
    else if (input.discountKind === "amount") discountCents = toCents(input.discountValue);
    discountCents = Math.min(discountCents, subtotalCents);
    const taxableCents = subtotalCents - discountCents;
    const taxCents = Math.round((taxableCents * clamp(parseNumber(input.taxPercent), 0, 100)) / 100);
    return { lines, subtotalCents, discountCents, taxableCents, taxCents, totalCents: taxableCents + taxCents };
  }

  function formatMoney(cents, code) {
    const SYMBOLS = { ILS: "₪", USD: "$", EUR: "€", GBP: "£" };
    const sym = SYMBOLS[code] || "₪";
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const num = `${String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${String(abs % 100).padStart(2, "0")}`;
    return code === "ILS" || !SYMBOLS[code] ? `${neg ? "-" : ""}${num} ${sym}` : `${neg ? "-" : ""}${sym}${num}`;
  }

  const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (mo < 1 || mo > 12 || dt.getUTCDate() !== d) return "";
    return `${d} ב${MONTHS[mo - 1]} ${y}`;
  }

  function addDays(iso, n) {
    if (!formatDate(iso)) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
  }

  function normalizePhone(v) {
    let d = String(v == null ? "" : v).replace(/[^\d]/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("972") && d.length >= 11 && d.length <= 12) return d;
    if (d.startsWith("0") && d.length >= 9 && d.length <= 10) return "972" + d.slice(1);
    return "";
  }
  // ---------- end PART 1 ----------

  const CURRENCIES = [
    { code: "ILS", label: "שקל חדש (₪)" },
    { code: "USD", label: "דולר ($)" },
    { code: "EUR", label: "יורו (€)" },
    { code: "GBP", label: "לירה שטרלינג (£)" },
  ];

  const api = { CURRENCIES, parseNumber, toCents, computeDoc, formatMoney, formatDate, addDays, normalizePhone };
  root.HeTools = api;

  // ---------- PART 2: small DOM helpers ----------
  if (typeof document === "undefined") return;

  api.el = function (tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  api.button = function (text, primary) {
    const b = api.el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  };
  let uid = 0;
  /** A labelled field with an optional hint. Returns { wrap, input }. */
  api.field = function (label, input, hint) {
    const id = "ht-f" + ++uid;
    const wrap = api.el("div", "ht-field");
    const lab = api.el("label", null, label);
    lab.htmlFor = id;
    input.id = id;
    wrap.append(lab, input);
    if (hint) {
      const h = api.el("p", "ht-hint", hint);
      h.id = id + "-hint";
      input.setAttribute("aria-describedby", h.id);
      wrap.append(h);
    }
    return { wrap, input };
  };
  api.textInput = function (type, value, extra) {
    const i = api.el("input");
    i.type = type || "text";
    if (value != null) i.value = value;
    if (extra) Object.keys(extra).forEach((k) => { i[k] = extra[k]; });
    return i;
  };
  api.textArea = function (rows) {
    const t = api.el("textarea");
    t.rows = rows || 3;
    return t;
  };
  api.select = function (options, value) {
    const s = api.el("select");
    options.forEach((o) => {
      const opt = api.el("option", null, o.label);
      opt.value = o.value;
      s.append(opt);
    });
    if (value != null) s.value = value;
    return s;
  };
  api.todayIso = function () {
    const d = new Date();
    return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  /** Reads a logo in the browser only. cb(dataUrl) on success, onError(message) otherwise. */
  api.readLogo = function (file, maxBytes, cb, onError) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return onError("אפשר לבחור תמונה מסוג PNG, JPG, WebP או GIF.");
    if (file.size > maxBytes) return onError("התמונה גדולה מדי. בחרו תמונה קטנה יותר.");
    const r = new FileReader();
    r.onload = () => cb(String(r.result || ""));
    r.onerror = () => onError("לא הצלחנו לקרוא את הקובץ.");
    r.readAsDataURL(file);
  };
  /** Copies text and reports in a status element. */
  api.copy = async function (text, what, status) {
    status.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else throw new Error("no clipboard");
      status.textContent = what + " הועתק.";
    } catch (e) {
      const ta = api.el("textarea");
      ta.value = text;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      status.textContent = ok ? what + " הועתק." : "ההעתקה לא הצליחה. סמנו את הטקסט והעתיקו ידנית.";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
