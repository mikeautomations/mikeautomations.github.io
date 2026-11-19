// /he/price-increase-letter/ client logic (Hebrew, RTL, gender-neutral wording). Progressive enhancement: the page already explains the letter and shows a worked example without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of clean(), money(), parseIso(), longDate() and priceIncreaseHe() in
// src/app/landing/data/tools/price-increase-letter-he.ts with the types removed.
// tests/tools-c-price-increase.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads its texts from <script id="pilh-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to price-increase-letter-he.ts) ----------
  const CURRENCIES_HE = ["₪", "$", "€"];
  const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const clean = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");

  function money(n, cur) {
    const r = round2(n);
    const s = Number.isInteger(r) ? String(r) : r.toFixed(2);
    const [whole, frac] = s.split(".");
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac ? "." + frac : ""} ${cur}`;
  }

  function parseIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const back = new Date(Date.UTC(y, mo - 1, d));
    return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? [y, mo, d] : null;
  }

  function longDate(iso) {
    const p = parseIso(iso);
    return p ? `${p[2]} ב${MONTHS_HE[p[1] - 1]} ${p[0]}` : "";
  }

  function priceIncreaseHe(i) {
    const cur = CURRENCIES_HE.indexOf(i.currency) >= 0 ? i.currency : "₪";
    const oldPrice = i.oldPrice;
    if (typeof oldPrice !== "number" || !Number.isFinite(oldPrice) || oldPrice <= 0) return { ok: false, error: "הזינו את המחיר הנוכחי, מספר גדול מ-0." };
    let newPrice;
    let pct;
    if (i.mode === "pct") {
      if (typeof i.pct !== "number" || !Number.isFinite(i.pct) || i.pct <= 0) return { ok: false, error: "הזינו את העלייה באחוזים, מספר גדול מ-0." };
      if (i.pct > 300) return { ok: false, error: "העלייה יכולה להיות עד 300 אחוז." };
      newPrice = round2(oldPrice * (1 + i.pct / 100));
      pct = round1(i.pct);
    } else {
      if (typeof i.newPrice !== "number" || !Number.isFinite(i.newPrice) || i.newPrice <= 0) return { ok: false, error: "הזינו את המחיר החדש, מספר גדול מ-0." };
      if (i.newPrice <= oldPrice) return { ok: false, error: "המחיר החדש צריך להיות גבוה מהמחיר הנוכחי. הכלי מיועד להעלאות מחיר." };
      newPrice = round2(i.newPrice);
      pct = round1(((newPrice - oldPrice) / oldPrice) * 100);
    }
    if (pct <= 0) return { ok: false, error: "העלייה קטנה מדי כדי להיות מוצגת באחוזים. בדקו את שני המחירים." };
    if (newPrice <= oldPrice) return { ok: false, error: "המחיר החדש צריך להיות גבוה מהמחיר הנוכחי. הכלי מיועד להעלאות מחיר." };
    const dateIn = clean(i.startDate);
    if (dateIn && !parseIso(dateIn)) return { ok: false, error: "הזינו תאריך תקין." };
    const dateText = dateIn ? longDate(dateIn) : "[תאריך תחילה]";
    const business = clean(i.business) || "[שם העסק]";
    const client = clean(i.client);
    const service = clean(i.service) || "השירות";
    const oldText = money(oldPrice, cur);
    const newText = money(newPrice, cur);
    const pctText = String(pct);
    const tone = i.tone === "brief" || i.tone === "formal" ? i.tone : "warm";
    const reason = i.reason === "costs" || i.reason === "value" || i.reason === "review" ? i.reason : "none";

    const longReason = {
      costs: "העלויות שלנו עלו בשנה האחרונה, והשינוי מאפשר לנו לשמור על אותה רמת שירות.",
      value: `הוספנו ל${service} ערך נוסף בשנה האחרונה, והמחיר החדש משקף זאת.`,
      review: "אנחנו בודקים את המחירים אחת לשנה, וזו תוצאת הבדיקה של השנה.",
      none: "",
    };
    const shortReason = {
      costs: "העלויות שלנו עלו.",
      value: "המחיר משקף את הערך הנוסף שהוספנו.",
      review: "זה בעקבות בדיקת המחירים השנתית.",
      none: "",
    };
    const hi = tone === "formal" ? (client ? `לכבוד ${client},` : "לקוחות יקרים,") : client ? `שלום ${client},` : "שלום,";

    let subject;
    let paras;
    if (tone === "brief") {
      subject = `עדכון מחיר החל מ-${dateText}`;
      paras = [hi, `החל מ-${dateText} מחיר ${service} יעלה מ-${oldText} ל-${newText} (עלייה של ${pctText}%). ${shortReason[reason]} שאלות? אפשר פשוט להשיב.`.replace(/ {2,}/g, " "), `תודה,\n${business}`];
    } else if (tone === "formal") {
      subject = `הודעה על עדכון מחירים החל מ-${dateText}`;
      paras = [
        hi,
        `ברצוננו להודיע כי החל מ-${dateText} מחיר ${service} יעודכן מ-${oldText} ל-${newText}, עלייה של ${pctText}%.`,
        ...(reason === "none" ? [] : [longReason[reason]]),
        "נשמח לענות על כל שאלה. אנחנו מעריכים את שיתוף הפעולה ומודים על ההבנה.",
        `בברכה,\n${business}`,
      ];
    } else {
      subject = `עדכון מחירים החל מ-${dateText}`;
      paras = [
        hi,
        `תודה שאתם איתנו ב${business}. רצינו לעדכן אתכם מראש על שינוי במחירים, כדי שלא יהיו הפתעות.`,
        `החל מ-${dateText} מחיר ${service} יעודכן מ-${oldText} ל-${newText}, עלייה של ${pctText}%.`,
        ...(reason === "none" ? [] : [longReason[reason]]),
        "אם יש שאלות, אפשר להשיב להודעה הזו ונשמח לדבר על זה. תודה על ההבנה.",
        `בברכה,\n${business}`,
      ];
    }
    const body = paras.join("\n\n");
    const short = [
      `${hi} עדכון קצר מ${business}: החל מ-${dateText} מחיר ${service} יעלה מ-${oldText} ל-${newText} (עלייה של ${pctText}%).`,
      tone === "brief" || reason === "none" ? "" : shortReason[reason],
      tone === "brief" ? "שאלות? אפשר פשוט להשיב." : "נשמח לדבר על זה אם יש שאלות.",
    ].filter(Boolean).join(" ");
    return { ok: true, oldPrice, newPrice, pct, pctText, oldText, newText, dateText, subject, body, short, showEmail: i.channel !== "message" };
  }

  root.PriceIncreaseHe = { clean, money, parseIso, longDate, priceIncreaseHe };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pilh-app");
  const dataEl = document.getElementById("pilh-data");
  if (!app || !dataEl) return;
  let T;
  try { T = JSON.parse(dataEl.textContent || "").ui; } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (text, primary) => {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  };
  let uid = 0;
  function field(label, hint, control) {
    const id = "pilh-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  const textInput = () => { const i = el("input"); i.type = "text"; i.autocomplete = "off"; return i; };
  const numInput = () => { const i = el("input"); i.type = "number"; i.inputMode = "decimal"; i.min = "0"; i.step = "any"; i.dir = "ltr"; return i; };
  const select = (options, value) => {
    const s = el("select");
    for (const o of options) { const opt = el("option", null, o[1]); opt.value = o[0]; s.append(opt); }
    s.value = value;
    return s;
  };

  const business = textInput();
  const client = textInput();
  const service = textInput();
  const currency = select([["₪", "₪ שקל"], ["$", "$ דולר"], ["€", "€ יורו"]], "₪");
  const mode = select([["price", T.modePrice], ["pct", T.modePct]], "price");
  const oldP = numInput();
  const newP = numInput();
  const pctI = numInput();
  const start = el("input");
  start.type = "date";
  start.dir = "ltr";
  const reason = select([["costs", T.rCosts], ["value", T.rValue], ["review", T.rReview], ["none", T.rNone]], "costs");
  const tone = select([["warm", T.tWarm], ["brief", T.tBrief], ["formal", T.tFormal]], "warm");
  const channel = select([["email", T.cEmail], ["message", T.cMessage]], "email");

  const fNew = field(T.newPrice, null, newP);
  const fPct = field(T.pct, T.pctHint, pctI);
  fPct.hidden = true;

  const form = el("section", "ft-box");
  form.setAttribute("aria-labelledby", "pilh-h-form");
  const hForm = el("h2", "lx-h3", T.formTitle);
  hForm.id = "pilh-h-form";
  const g1 = el("div", "ft-grid");
  g1.append(field(T.business, null, business), field(T.client, T.clientHint, client), field(T.service, T.serviceHint, service), field(T.currency, null, currency));
  const g2 = el("div", "ft-grid");
  g2.append(field(T.mode, null, mode), field(T.oldPrice, null, oldP), fNew, fPct, field(T.start, T.startHint, start));
  const g3 = el("div", "ft-grid");
  g3.append(field(T.reason, null, reason), field(T.tone, null, tone), field(T.channel, null, channel));
  form.append(hForm, g1, g2, g3);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");
  const out = el("div", "pilh-out");
  out.setAttribute("aria-live", "polite");
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  app.textContent = "";
  app.append(form, err, out, status);

  async function copy(text, what) {
    status.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else throw new Error("no clipboard");
      status.textContent = what + " " + T.copied;
    } catch (e) {
      const ta = el("textarea");
      ta.value = text;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      status.textContent = ok ? what + " " + T.copied : T.copyFail;
    }
  }

  const num = (i) => (i.value.trim() === "" ? NaN : Number(i.value));

  function render() {
    const byPct = mode.value === "pct";
    fNew.hidden = byPct;
    fPct.hidden = !byPct;
    err.textContent = "";
    out.textContent = "";
    status.textContent = "";
    if (oldP.value.trim() === "" || (byPct ? pctI.value.trim() === "" : newP.value.trim() === "")) return;
    const r = priceIncreaseHe({
      business: business.value, client: client.value, service: service.value, currency: currency.value, mode: mode.value,
      oldPrice: num(oldP), newPrice: num(newP), pct: num(pctI), startDate: start.value, reason: reason.value, tone: tone.value, channel: channel.value,
    });
    if (!r.ok) { err.textContent = r.error; return; }
    out.append(el("p", "pilh-headline", `${T.increase}: ${r.pctText}% (${T.from} ${r.oldText} ${T.to} ${r.newText})`));
    if (r.showEmail) {
      const box = el("section", "ft-box");
      box.setAttribute("aria-labelledby", "pilh-h-email");
      const h = el("h2", "lx-h3", T.emailTitle);
      h.id = "pilh-h-email";
      const row = el("div", "try-controls");
      const b1 = button(T.copyEmail, true);
      const b2 = button(T.copySubject);
      b1.addEventListener("click", () => copy(`${T.subjectWord}: ${r.subject}\n\n${r.body}`, T.emailWord));
      b2.addEventListener("click", () => copy(r.subject, T.subjectWord));
      row.append(b1, b2);
      const body = el("pre", "ft-out", r.body);
      body.style.fontFamily = "inherit";
      box.append(h, el("p", "ft-hint", T.subjectWord), el("p", "ft-out ft-subject", r.subject), el("p", "ft-hint", T.letterWord), body, row);
      out.append(box);
    }
    const box2 = el("section", "ft-box");
    box2.setAttribute("aria-labelledby", "pilh-h-short");
    const h2 = el("h2", "lx-h3", T.shortTitle);
    h2.id = "pilh-h-short";
    const row2 = el("div", "try-controls");
    const b3 = button(T.copyShort, !r.showEmail);
    b3.addEventListener("click", () => copy(r.short, T.shortWord));
    row2.append(b3);
    box2.append(h2, el("p", "ft-out", r.short), row2);
    out.append(box2);
  }

  for (const c of [business, client, service, currency, mode, oldP, newP, pctI, start, reason, tone, channel]) {
    c.addEventListener("input", render);
    c.addEventListener("change", render);
  }
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
