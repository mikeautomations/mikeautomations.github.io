// /en/1099-checker/ client logic. Progressive enhancement: the page already states every rule without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device. Downloads are
// made in the browser from Blob URLs.
// PART 1 is a line-for-line copy of src/app/landing/data/tools/1099-calc.ts with the types removed.
// tests/1099-checker.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the tax year and the examples from <script id="t99-data"> (src/app/landing/en/1099-checker-page.tsx).
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to 1099-calc.ts) ----------
  /** Who you paid, as their Form W-9 would show it. */
  const ENTITIES = [
    ["individual", "Individual, sole proprietor or single-member LLC"],
    ["llc-partnership", "LLC taxed as a partnership"],
    ["llc-corp", "LLC taxed as a C or S corporation"],
    ["c-corp", "C corporation"],
    ["s-corp", "S corporation"],
    ["partnership", "Partnership"],
    ["exempt", "Tax-exempt organization or government body"],
    ["unknown", "Not sure yet (no W-9)"],
  ];

  /** What the payment was for. */
  const PAYMENTS = [
    ["services", "Services by a non-employee (contractor, freelancer)"],
    ["rent", "Rent (office space, equipment, land)"],
    ["attorney-fees", "Attorney's fees for legal services"],
    ["attorney-proceeds", "Gross proceeds paid to an attorney (for example a settlement)"],
    ["royalties", "Royalties"],
    ["medical", "Medical and health care payments"],
    ["other", "Other income (prizes, awards, damages, not for services)"],
    ["goods", "Goods, merchandise, freight or storage"],
  ];

  /** How it was paid. */
  const METHODS = [
    ["direct", "Check, ACH, cash or wire"],
    ["card", "Credit card, payment card or third-party payment network"],
  ];

  /** Minimum total for the year, in cents, for payments made in 2026. null: never reported on 1099-NEC or 1099-MISC. */
  const THRESHOLDS = {
    services: 200000,
    rent: 200000,
    "attorney-fees": 200000,
    "attorney-proceeds": 60000,
    royalties: 1000,
    medical: 200000,
    other: 200000,
    goods: null,
  };

  /** The form and box each payment type goes in. */
  const BOXES = {
    services: ["1099-NEC", "1a"],
    rent: ["1099-MISC", "1"],
    "attorney-fees": ["1099-NEC", "1a"],
    "attorney-proceeds": ["1099-MISC", "10"],
    royalties: ["1099-MISC", "2"],
    medical: ["1099-MISC", "6"],
    other: ["1099-MISC", "3"],
    goods: null,
  };

  /** Payment types that stay reportable when the payee is a corporation. */
  const CORP_REPORTABLE = ["attorney-fees", "attorney-proceeds", "medical"];

  const CORPS = ["llc-corp", "c-corp", "s-corp"];

  /** 123456 → "$1,234.56"; 200000 → "$2,000". */
  function money(cents) {
    const neg = cents < 0;
    const c = Math.abs(Math.round(cents));
    const whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const frac = c % 100;
    return `${neg ? "-" : ""}$${whole}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
  }

  /** "$2,000.50", "2000.5", "2,000" → cents; anything else (or a negative amount) → null. */
  function parseAmount(s) {
    const t = String(s == null ? "" : s).replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const [w, f = ""] = t.split(".");
    return +w * 100 + +(f + "00").slice(0, 2);
  }

  const label = (list, id) => (list.find((x) => x[0] === id) || [id, id])[1];
  const entityLabel = (e) => label(ENTITIES, e);
  const paymentLabel = (p) => label(PAYMENTS, p);
  const methodLabel = (m) => label(METHODS, m);

  /** The likely answer for one payee, following the IRS Instructions for Forms 1099-MISC and 1099-NEC (Rev. December 2026). */
  function check(p) {
    const box = BOXES[p.payment];
    const min = THRESHOLDS[p.payment];
    const notes = [];
    const r = (kind, w9, headline, reason) => {
      const onForm = (kind === "nec" || kind === "misc" || kind === "check") && box;
      return { kind, form: onForm ? onForm[0] : kind === "1099k" ? "1099-K" : null, box: onForm ? onForm[1] : null, w9, headline, reason, notes };
    };
    if (p.payment === "rent") notes.push("Rent paid to a real estate agent or property manager is not reported by you: the agent or manager reports the rent paid over to the owner.");
    if (p.payment === "services") notes.push("Payments to your employees go on Form W-2, not a 1099.");
    if (p.payment === "attorney-fees" || p.payment === "attorney-proceeds") notes.push("You must get the attorney's TIN (a W-9 is the usual way), even if the law firm is a corporation.");
    if (!box || min == null) return r("none", false, "No 1099-NEC or 1099-MISC", "Payments for merchandise, telegrams, telephone, freight, storage and similar items are not reported on Form 1099-NEC or 1099-MISC.");
    if (p.method === "card") return r("1099k", false, "Reported on Form 1099-K, not by you", "Payments made with a credit card or payment card, and third-party network transactions, are reported on Form 1099-K by the payment settlement entity, not on Form 1099-NEC or 1099-MISC.");
    if (p.entity === "exempt") return r("none", false, "No 1099-NEC or 1099-MISC", "Payments to a tax-exempt organization, the United States, a state, the District of Columbia, a U.S. territory or a foreign government are not reported on these forms.");
    if (p.cents < min) return r("none", false, "Below the threshold", `Form ${box[0]}, box ${box[1]} starts at ${money(min)} for the year. This payee's total is ${money(p.cents)}.`);
    const corp = CORPS.indexOf(p.entity) >= 0;
    const reportable = CORP_REPORTABLE.indexOf(p.payment) >= 0;
    if (corp && !reportable) return r("none", false, "Generally no 1099: paid to a corporation", "Payments to a corporation, including an LLC taxed as a C or S corporation, are generally not reported. Keep their W-9: it is how you know the classification.");
    const kind = box[0] === "1099-NEC" ? "nec" : "misc";
    const formBox = `Form ${box[0]}, box ${box[1]}`;
    if (p.entity === "unknown" && !reportable) return r("check", true, `Likely ${formBox}, unless they are a corporation`, `The total is ${money(p.cents)}, at or over the ${money(min)} threshold. Corporations are generally exempt, so the W-9 decides it.`);
    return r(kind, true, `Likely ${formBox}`, corp
      ? `The total is ${money(p.cents)}, at or over the ${money(min)} threshold, and this type of payment is reported even when the payee is a corporation.`
      : `The total is ${money(p.cents)}, at or over the ${money(min)} threshold for this box.`);
  }

  // ---------- deadlines ----------

  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const DAY = 86400000;
  const toMs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const fromMs = (ms) => { const d = new Date(ms); return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

  function addDays(iso, n) {
    return fromMs(toMs(iso) + n * DAY);
  }

  /** 0 = Sunday ... 6 = Saturday. */
  function weekday(iso) {
    return new Date(toMs(iso)).getUTCDay();
  }

  /**
   * A due date on a Saturday or Sunday moves to the next business day. Legal holidays move it too; none falls on these
   * dates in 2027 in the District of Columbia, but a statewide holiday where you file can (the page says so).
   */
  function nextBusinessDay(iso) {
    let d = iso;
    while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
    return d;
  }

  /** Due dates for forms reporting payments made in `taxYear`, filed the year after. */
  function deadlines(taxYear) {
    const y = pad(taxYear + 1, 4);
    const ev = (id, form, md, lab, detail) => {
      const regular = `${y}-${md}`;
      return { id, form, regular, date: nextBusinessDay(regular), label: lab, detail };
    };
    return [
      ev("nec", "1099-NEC", "01-31", "Form 1099-NEC due to recipients and the IRS", `Paper or electronic. Covers payments made in ${taxYear}.`),
      ev("misc-recipient", "1099-MISC", "01-31", "Form 1099-MISC due to recipients", `Copy B to each recipient. Covers payments made in ${taxYear}.`),
      ev("misc-paper", "1099-MISC", "02-28", "Form 1099-MISC due to the IRS (paper)", `If you file on paper. Covers payments made in ${taxYear}.`),
      ev("misc-efile", "1099-MISC", "03-31", "Form 1099-MISC due to the IRS (electronic)", `If you e-file. Covers payments made in ${taxYear}.`),
    ];
  }

  /** "2027-02-01" → "February 1, 2027". */
  function usDate(iso) {
    const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${M[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
  }

  // ---------- bulk input and downloads ----------

  /** Split one CSV line, honouring double quotes. */
  function csvCells(line) {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === "\t") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const words = (s) => ` ${String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

  /** Free text or a code → entity; null if it can't be read. "LLC" on its own is "unknown": the W-9 decides. */
  function readEntity(s) {
    const w = words(s);
    const code = ENTITIES.find((e) => words(e[0]) === w);
    if (code) return code[0];
    if (w === "  " || / (unknown|not sure|no w 9|tbd) /.test(w)) return "unknown";
    if (/ (exempt|nonprofit|non profit|charity|government|govt|501c3|501 c 3) /.test(w)) return "exempt";
    if (/ llc /.test(w)) {
      if (/ (c|s|corp|corporation|c corp|s corp|scorp|ccorp) /.test(w)) return "llc-corp";
      if (/ partnership /.test(w)) return "llc-partnership";
      if (/ (single member|smllc|disregarded|sole) /.test(w)) return "individual";
      return "unknown";
    }
    if (/ (s corp|scorp|s corporation) /.test(w)) return "s-corp";
    if (/ (c corp|ccorp|c corporation|corporation|corp|inc|incorporated) /.test(w)) return "c-corp";
    if (/ (partnership|llp|lp|general partnership) /.test(w)) return "partnership";
    if (/ (individual|sole|sole proprietor|sole prop|person|freelancer|contractor|self employed) /.test(w)) return "individual";
    return null;
  }

  /** Free text or a code → payment type; null if it can't be read. */
  function readPayment(s) {
    const w = words(s);
    const code = PAYMENTS.find((p) => words(p[0]) === w);
    if (code) return code[0];
    if (/ (gross proceeds|proceeds|settlement) /.test(w)) return "attorney-proceeds";
    if (/ (attorney|attorneys|legal|lawyer|law firm) /.test(w)) return "attorney-fees";
    if (/ (rent|rents|rental|lease) /.test(w)) return "rent";
    if (/ (royalty|royalties) /.test(w)) return "royalties";
    if (/ (medical|health|health care|healthcare) /.test(w)) return "medical";
    if (/ (goods|merchandise|products|product|supplies|freight|storage|inventory) /.test(w)) return "goods";
    if (/ (services|service|nec|contractor|freelance|labor|labour|consulting|fees|fee) /.test(w)) return "services";
    if (/ (other|prize|prizes|award|awards|damages) /.test(w)) return "other";
    return null;
  }

  /** Free text or a code → payment method; blank means check, ACH, cash or wire. null if it can't be read. */
  function readMethod(s) {
    const w = words(s);
    if (w === "  " || / (direct|check|cheque|ach|cash|wire|bank|transfer|bank transfer) /.test(w)) return "direct";
    if (/ (card|credit|credit card|debit|payment card|network|third party|app|platform) /.test(w)) return "card";
    return null;
  }

  /** CSV (or tab-separated) with columns name,entity,payment,amount,method (header row optional; method may be blank). */
  function parseCsv(text) {
    const rows = [];
    String(text || "").split(/\r?\n/).forEach((raw, i) => {
      if (!raw.trim()) return;
      const [name = "", ent = "", pay = "", amt = "", meth = ""] = csvCells(raw);
      const n = i + 1;
      if (i === 0 && /^(name|payee|vendor)$/i.test(name) && /amount|total/i.test(amt)) return;
      const entity = readEntity(ent);
      if (!entity) { rows.push({ line: n, error: `Line ${n}: entity type "${ent}" not recognized (try individual, partnership, llc-partnership, llc-corp, c-corp, s-corp, exempt or unknown).` }); return; }
      const payment = readPayment(pay);
      if (!payment) { rows.push({ line: n, error: `Line ${n}: payment type "${pay}" not recognized (try services, rent, attorney-fees, attorney-proceeds, royalties, medical, other or goods).` }); return; }
      const cents = parseAmount(amt);
      if (cents == null) { rows.push({ line: n, error: `Line ${n}: amount "${amt}" is not a number (for example 2500 or $2,500.00).` }); return; }
      const method = readMethod(meth);
      if (!method) { rows.push({ line: n, error: `Line ${n}: payment method "${meth}" not recognized (try check, ach, cash, wire or card).` }); return; }
      rows.push({ line: n, payee: { name: name.slice(0, 120), entity, payment, cents, method } });
    });
    return rows;
  }

  const csvCell = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  /** A W-9 and 1099 tracker: one row per payee, with blank columns to fill in as W-9s arrive and forms go out. */
  function toCsv(payees) {
    const head = ["payee", "entity", "payment_type", "paid_by", "total_2026", "likely_result", "form", "box", "get_w9", "w9_received", "tin_on_file", "form_sent_to_payee", "filed_with_irs", "why"];
    const lines = [head.join(",")];
    for (const p of payees) {
      const r = check(p);
      lines.push([p.name, entityLabel(p.entity), paymentLabel(p.payment), methodLabel(p.method), (p.cents / 100).toFixed(2), r.headline, r.form || "", r.box || "", r.w9 ? "yes" : "no", "", "", "", "", r.reason].map(csvCell).join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }

  /** The deadlines that apply to these payees: 1099-NEC dates if any is likely on 1099-NEC, and so on. All of them if none. */
  function deadlinesFor(payees, taxYear) {
    const forms = payees.map((p) => check(p)).filter((r) => r.kind === "nec" || r.kind === "misc" || r.kind === "check").map((r) => r.form);
    const all = deadlines(taxYear);
    return forms.length ? all.filter((e) => forms.indexOf(e.form) >= 0) : all;
  }

  /** 32-bit FNV-1a, twice with different seeds, as 16 hex characters: a stable id for a calendar event. */
  function hash(s) {
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }

  const icsText = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  /** Fold a content line at 75 octets (RFC 5545 3.1), never splitting a UTF-8 character. */
  function fold(line) {
    const out = [];
    let cur = "", bytes = 0;
    for (const ch of line) {
      const n = new TextEncoder().encode(ch).length;
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join("\r\n ");
  }

  /**
   * An iCalendar file: one all-day event per deadline, reminders 30, 14 and 7 days before, CRLF line ends.
   * UIDs come from the deadline and its date, so downloading again updates the same events.
   * `stamp` is the DTSTAMP in UTC, e.g. "20261112T090000Z".
   */
  function toIcs(events, stamp, source = "https://mikeautomations.github.io/en/1099-checker/") {
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mike Automations//1099 checker//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const e of events) {
      const uid = `${hash(["1099", e.id, e.regular].join("|"))}@mikeautomations.github.io`;
      const moved = e.date !== e.regular ? ` The regular date, ${usDate(e.regular)}, falls on a weekend, so it moves to the next business day.` : "";
      L.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`,
        `SUMMARY:${icsText(e.label)}`,
        `DESCRIPTION:${icsText(`${e.detail}${moved}\nA guide, not tax advice: check the IRS instructions or ask your CPA. Made with ${source}`)}`,
        "TRANSP:TRANSPARENT");
      for (const days of [30, 14, 7]) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`${days} days to go: ${e.label}`)}`, `TRIGGER:-P${days}D`, "END:VALARM");
      L.push("END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return L.map(fold).join("\r\n") + "\r\n";
  }

  const API = { money, parseAmount, entityLabel, paymentLabel, methodLabel, check, addDays, weekday, nextBusinessDay, deadlines, usDate, readEntity, readPayment, readMethod, parseCsv, toCsv, deadlinesFor, hash, toIcs };
  root.Form1099 = API;
  root.Form1099Data = { ENTITIES, PAYMENTS, METHODS, THRESHOLDS, BOXES, CORP_REPORTABLE };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("t99-app");
  const dataEl = document.getElementById("t99-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const YEAR = DATA.taxYear;
  const GUIDE = "This is a guide, not tax advice. Check the IRS instructions or ask your CPA.";

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  let uid = 0;
  const nextId = () => "t99-f" + ++uid;

  function button(text, primary) {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  }

  function select(options, value) {
    const s = el("select");
    options.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; s.append(o); });
    if (value) s.value = value;
    return s;
  }

  function labelled(text, input, hint) {
    const wrap = el("div", "t99-field");
    const id = nextId();
    const lab = el("label", null, text);
    lab.htmlFor = id;
    input.id = id;
    wrap.append(lab);
    if (hint) { const h = el("span", "t99-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return wrap;
  }

  function download(name, type, text) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function table(head, rows, cls) {
    const wrap = el("div", "lx-table-wrap");
    const t = el("table", "lx-table " + (cls || ""));
    const thead = el("thead");
    const tr = el("tr");
    head.forEach((h) => { const th = el("th", null, h); th.scope = "col"; tr.append(th); });
    thead.append(tr);
    const tbody = el("tbody");
    rows.forEach((r) => {
      const row = el("tr");
      r.forEach((c, i) => {
        const td = el("td");
        td.dataset.label = head[i];
        if (c instanceof Node) td.append(c); else td.textContent = c;
        row.append(td);
      });
      tbody.append(row);
    });
    t.append(thead, tbody);
    wrap.append(t);
    return wrap;
  }

  // ---------- results, shared by the rows and the CSV ----------
  function render(out, payees, base) {
    out.textContent = "";
    if (!payees.length) return;
    const results = payees.map((p) => check(p));
    const forms = results.filter((r) => r.kind === "nec" || r.kind === "misc" || r.kind === "check").length;
    const w9 = results.filter((r) => r.w9).length;
    const who = (i) => payees[i].name || `Payee ${i + 1}`;
    out.append(el("h3", "lx-h3", `${payees.length} payee${payees.length === 1 ? "" : "s"}: ${forms} likely 1099${forms === 1 ? "" : "s"}, ${w9} W-9${w9 === 1 ? "" : "s"} to get first`));
    out.append(table(["Payee", `Total ${YEAR}`, "Likely result", "Why", "W-9"], payees.map((p, i) => {
      const r = results[i];
      return [who(i), money(p.cents), el("strong", "t99-r t99-r-" + r.kind, r.headline), r.reason, r.w9 ? el("strong", "t99-w9", "Get a W-9 first") : "Not needed for this"];
    }), "t99-results"));
    const notes = [];
    results.forEach((r) => r.notes.forEach((n) => { if (notes.indexOf(n) < 0) notes.push(n); }));
    if (notes.length) { const ul = el("ul", "t99-notes"); notes.forEach((n) => ul.append(el("li", null, n))); out.append(ul); }
    const evs = deadlinesFor(payees, YEAR);
    out.append(el("h3", "lx-h3", forms ? "Your deadlines" : "The deadlines, if you do send any"));
    out.append(table(["Date", "What is due"], evs.map((e) => [usDate(e.date), e.label + (e.date !== e.regular ? ` (${usDate(e.regular)} is a weekend)` : "")]), "t99-dates"));
    out.append(el("p", "t99-guide", GUIDE));
    const row = el("div", "try-controls t99-downloads");
    const csv = button("Download W-9 and 1099 tracker (CSV)");
    const ics = button("Add deadlines to calendar (.ics)");
    const print = button("Print or save as PDF");
    csv.addEventListener("click", () => download(base + "-tracker.csv", "text/csv;charset=utf-8", "﻿" + toCsv(payees)));
    ics.addEventListener("click", () => download("1099-deadlines-" + YEAR + ".ics", "text/calendar;charset=utf-8", toIcs(evs, stamp())));
    print.addEventListener("click", () => window.print());
    row.append(csv, ics, print);
    out.append(row);
  }

  // ---------- payee rows ----------
  function rowsBox() {
    const box = el("section", "t99-box");
    box.setAttribute("aria-labelledby", "t99-rows-h");
    const h = el("h2", "lx-h3", "Your payees");
    h.id = "t99-rows-h";
    const p = el("p", "t99-hint", `One row per person or business you paid in ${YEAR}. Enter the total for the whole year. If you paid someone partly by card, enter only what you paid by check, ACH, cash or wire.`);
    const list = el("div", "t99-rows");
    const err = el("p", "t99-error");
    err.setAttribute("role", "alert");
    const out = el("div", "t99-out");
    out.setAttribute("aria-live", "polite");
    const rows = [];

    function number() {
      rows.forEach((r, i) => { r.legend.textContent = `Payee ${i + 1}`; });
    }

    function run() {
      err.textContent = "";
      const payees = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const cents = parseAmount(r.amount.value);
        if (cents == null) { err.textContent = `Payee ${i + 1}: enter the total paid as a number, for example 2500 or 2,500.00.`; r.amount.focus(); out.textContent = ""; return; }
        payees.push({ name: r.name.value.trim().slice(0, 120), entity: r.entity.value, payment: r.payment.value, cents, method: r.method.value });
      }
      render(out, payees, "1099-check");
    }

    function addRow(v) {
      v = v || {};
      const fs = el("fieldset", "t99-row");
      const legend = el("legend");
      const name = el("input");
      name.type = "text";
      name.autocomplete = "off";
      name.maxLength = 120;
      name.value = v.name || "";
      const entity = select(ENTITIES, v.entity);
      const payment = select(PAYMENTS, v.payment);
      const amount = el("input");
      amount.type = "text";
      amount.inputMode = "decimal";
      amount.placeholder = "2,500.00";
      amount.value = v.amount || "";
      const method = select(METHODS, v.method);
      const remove = button("Remove this payee");
      const row = { fs, legend, name, entity, payment, amount, method };
      remove.addEventListener("click", () => {
        if (rows.length === 1) return;
        rows.splice(rows.indexOf(row), 1);
        fs.remove();
        number();
      });
      fs.append(legend, labelled("Payee name", name), labelled("Entity type (from their W-9)", entity), labelled("What you paid for", payment), labelled(`Total paid in ${YEAR} (USD)`, amount), labelled("How you paid", method), remove);
      [name, amount].forEach((i) => i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") run(); }));
      rows.push(row);
      list.append(fs);
      number();
      return row;
    }

    const add = button("Add another payee");
    add.addEventListener("click", () => addRow().name.focus());
    const go = button("Check these payees", true);
    go.addEventListener("click", run);
    const example = button("Fill in an example");
    example.addEventListener("click", () => {
      rows.forEach((r) => r.fs.remove());
      rows.length = 0;
      DATA.example.forEach((v) => addRow(v));
      run();
    });
    addRow();
    const actions = el("div", "try-controls");
    actions.append(add, go, example);
    box.append(h, p, list, err, actions, out);
    return box;
  }

  // ---------- paste a list ----------
  function csvBox() {
    const box = el("section", "t99-box");
    box.setAttribute("aria-labelledby", "t99-csv-h");
    const h = el("h2", "lx-h3", "Paste a vendor list (CSV)");
    h.id = "t99-csv-h";
    const p = el("p", null, "One payee per line: name, entity type, payment type, total, how paid. Words work (\"LLC taxed as S corp\", \"legal fees\", \"ACH\"). Leave how paid blank for check, ACH, cash or wire. Comma or tab separated, so you can paste from a spreadsheet.");
    const ta = el("textarea", "t99-csv");
    ta.rows = 6;
    ta.spellcheck = false;
    ta.placeholder = DATA.csvExample;
    const err = el("ul", "t99-error");
    const go = button("Check the list", true);
    const example = button("Fill in an example");
    example.addEventListener("click", () => { ta.value = DATA.csvExample; });
    const out = el("div", "t99-out");
    out.setAttribute("aria-live", "polite");
    go.addEventListener("click", () => {
      err.textContent = "";
      const rows = parseCsv(ta.value);
      rows.filter((r) => r.error).forEach((r) => err.append(el("li", null, r.error)));
      const payees = rows.filter((r) => r.payee).map((r) => r.payee);
      if (!rows.length) err.append(el("li", null, "Paste at least one line."));
      render(out, payees, "1099-check-list");
    });
    const actions = el("div", "try-controls");
    actions.append(go, example);
    box.append(h, p, labelled("Vendors (CSV)", ta), err, actions, out);
    return box;
  }

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Checker"), document.createTextNode(" Works in your browser. Nothing you type leaves your device."));
  app.append(intro, rowsBox(), csvBox());
})(typeof globalThis !== "undefined" ? globalThis : this);
