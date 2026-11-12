// /en/company-deadlines/ client logic. Progressive enhancement: the page already explains every rule without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device. Downloads are
// made in the browser from Blob URLs.
// PART 1 is a line-for-line copy of src/app/landing/data/tools/company-deadlines-calc.ts with the types removed.
// tests/company-deadlines.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads penalties and sources from <script id="cd-data"> (src/app/landing/data/tools/company-deadlines.ts).
(function (root) {
  "use strict";

  // ---------- PART 1: pure date maths (keep identical to company-deadlines-calc.ts) ----------
  const DAY = 86400000;

  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const fromMs = (ms) => { const d = new Date(ms); return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const toMs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const parts = (iso) => [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)];

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function parseDate(s) {
    const t = String(s || "").trim();
    let y, m, d;
    let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else {
      r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
      if (!r) return null;
      d = +r[1]; m = +r[2]; y = +r[3];
    }
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
  }

  function addDays(iso, n) {
    return fromMs(toMs(iso) + n * DAY);
  }

  function isMonthEnd(iso) {
    const [y, m, d] = parts(iso);
    return d === daysInMonth(y, m);
  }

  function addMonths(iso, n) {
    const [y, m, d] = parts(iso);
    const idx = y * 12 + (m - 1) + n;
    const ty = Math.floor(idx / 12);
    const tm = idx - ty * 12 + 1;
    const last = daysInMonth(ty, tm);
    const td = isMonthEnd(iso) ? last : Math.min(d, last);
    return `${pad(ty, 4)}-${pad(tm)}-${pad(td)}`;
  }

  function addYears(iso, n) {
    const [y, m, d] = parts(iso);
    return `${pad(y + n, 4)}-${pad(m)}-${pad(Math.min(d, daysInMonth(y + n, m)))}`;
  }

  function yearEndFrom(iso) {
    const [y, m, d] = parts(iso);
    return fromMs(Date.UTC(y + 1, m - 1, d) - DAY);
  }

  function weekday(iso) {
    return new Date(toMs(iso)).getUTCDay();
  }

  const later = (a, b) => (a > b ? a : b);

  function firstArd(incorporated) {
    const [y, m] = parts(incorporated);
    return `${pad(y + 1, 4)}-${pad(m)}-${pad(daysInMonth(y + 1, m))}`;
  }

  function accountsDeadline(incorporated, periodEnd) {
    const ard1 = firstArd(incorporated);
    const end = periodEnd || ard1;
    if (end === ard1) {
      const long = end >= addYears(incorporated, 1);
      const due = long ? later(addMonths(incorporated, 21), addMonths(end, 3)) : addMonths(end, 9);
      return { periodStart: incorporated, periodEnd: end, kind: long ? "first-long" : "first-short", due, ardMoved: false };
    }
    if (end < addMonths(ard1, 12)) return { periodStart: incorporated, periodEnd: end, kind: "changed", due: null, ardMoved: true };
    const ardMoved = end.slice(5) !== ard1.slice(5) && !(isMonthEnd(end) && end.slice(5, 7) === ard1.slice(5, 7));
    return { periodStart: addDays(addMonths(end, -12), 1), periodEnd: end, kind: "later", due: addMonths(end, 9), ardMoved };
  }

  function ctPaymentDue(apEnd) {
    return addDays(addMonths(apEnd, 9), 1);
  }

  function ctReturnDue(apEnd, accountsEnd) {
    return later(addMonths(apEnd, 12), addMonths(accountsEnd, 12));
  }

  function ctPeriods(acc) {
    const mk = (start, end) => ({ start, end, payDue: ctPaymentDue(end), returnDue: ctReturnDue(end, acc.periodEnd) });
    if (acc.kind === "changed") return [];
    if (acc.kind === "first-long") {
      const firstEnd = yearEndFrom(acc.periodStart);
      return [mk(acc.periodStart, firstEnd), mk(addDays(firstEnd, 1), acc.periodEnd)];
    }
    return [mk(acc.periodStart, acc.periodEnd)];
  }

  function confirmationStatement(incorporated, lastStatement) {
    const statementDate = lastStatement ? addYears(lastStatement, 1) : yearEndFrom(incorporated);
    return { statementDate, due: addDays(statementDate, 14), first: !lastStatement };
  }

  function accountsPenaltySteps(due) {
    return [addDays(due, 1), addDays(addMonths(due, 1), 1), addDays(addMonths(due, 3), 1), addDays(addMonths(due, 6), 1)];
  }

  function returnPenaltySteps(due) {
    return [addDays(due, 1), addMonths(due, 3), addMonths(due, 6), addMonths(due, 12)];
  }

  const longDate = (iso) => {
    const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${+iso.slice(8, 10)} ${M[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
  };

  function companyDeadlines(c) {
    const accounts = accountsDeadline(c.incorporated, c.periodEnd);
    const ct = ctPeriods(accounts);
    const cs = confirmationStatement(c.incorporated, c.lastStatement);
    const ev = (kind, date, label, detail) => ({ kind, date, label, title: c.name ? `${c.name}: ${label}` : label, detail });
    const range = (a, b) => `${longDate(a)} to ${longDate(b)}`;
    const events = [];
    const notes = [];
    if (accounts.due) events.push(ev("accounts", accounts.due, "Accounts due at Companies House", `Annual accounts for ${range(accounts.periodStart, accounts.periodEnd)}.`));
    ct.forEach((p, i) => {
      const part = ct.length > 1 ? ` (${i + 1} of ${ct.length})` : "";
      events.push(ev("ct-pay", p.payDue, `Corporation Tax payment due${part}`, `Accounting period ${range(p.start, p.end)}. Applies to taxable profits up to £1.5 million.`));
      events.push(ev("ct600", p.returnDue, `Company Tax Return (CT600) due${part}`, `Accounting period ${range(p.start, p.end)}.`));
    });
    events.push(ev("cs", cs.due, "Confirmation statement due", `Review period ends ${longDate(cs.statementDate)}; file within 14 days.`));
    events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (accounts.kind === "changed") notes.push("This period end does not match the default accounting reference date, so the date was probably changed (form AA01). The tool does not calculate changed periods: check the company on Companies House.");
    if (accounts.ardMoved) notes.push("The year end differs from the default for this incorporation date. If this period was shortened or extended, the deadline can differ: check Companies House.");
    if (ct.length > 1) notes.push("The first accounts cover more than 12 months, so there are 2 Corporation Tax accounting periods, 2 payments and 2 returns. This assumes trading started the day the company was set up: check HMRC's letter for your exact dates.");
    if (ct.some((p) => weekday(p.payDue) === 0 || weekday(p.payDue) === 6)) notes.push("A Corporation Tax payment date falls on a weekend: the payment should reach HMRC on the last working day before it, unless you pay by Faster Payments.");
    return { company: c, accounts, ct, cs, events, notes };
  }

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
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  function parseCsv(text) {
    const rows = [];
    String(text || "").split(/\r?\n/).forEach((raw, i) => {
      if (!raw.trim()) return;
      const [name = "", inc = "", end = "", cs = ""] = csvCells(raw);
      if (i === 0 && /^name$/i.test(name) && /incorp/i.test(inc)) return;
      const incorporated = parseDate(inc);
      if (!incorporated) { rows.push({ line: i + 1, error: `Line ${i + 1}: incorporation date "${inc}" is not a date (use YYYY-MM-DD or DD/MM/YYYY).` }); return; }
      const periodEnd = end ? parseDate(end) : null;
      if (end && !periodEnd) { rows.push({ line: i + 1, error: `Line ${i + 1}: period end "${end}" is not a date.` }); return; }
      if (periodEnd && periodEnd <= incorporated) { rows.push({ line: i + 1, error: `Line ${i + 1}: period end is before the incorporation date.` }); return; }
      const lastStatement = cs ? parseDate(cs) : null;
      if (cs && !lastStatement) { rows.push({ line: i + 1, error: `Line ${i + 1}: last confirmation statement date "${cs}" is not a date.` }); return; }
      rows.push({ line: i + 1, company: { name: name.slice(0, 120), incorporated, periodEnd, lastStatement } });
    });
    return rows;
  }

  const csvCell = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  function toCsv(results) {
    const lines = [["company", "deadline", "date", "details"].join(",")];
    for (const r of results) for (const e of r.events) lines.push([r.company.name, e.label, e.date, e.detail].map(csvCell).join(","));
    return lines.join("\r\n") + "\r\n";
  }

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

  function toIcs(results, stamp, source = "https://mikeautomations.github.io/en/company-deadlines/") {
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mike Automations//Company deadlines//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const r of results) {
      for (const e of r.events) {
        const d = e.date.replace(/-/g, "");
        const uid = `${hash([r.company.name, r.company.incorporated, e.kind, e.title, e.detail].join("|"))}@mikeautomations.github.io`;
        L.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`,
          `SUMMARY:${icsText(e.title)}`,
          `DESCRIPTION:${icsText(`${e.detail}\nA guide, not advice: check the official page. Made with ${source}`)}`,
          "TRANSP:TRANSPARENT");
        for (const days of [30, 14, 7]) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`${days} days to go: ${e.title}`)}`, `TRIGGER:-P${days}D`, "END:VALARM");
        L.push("END:VEVENT");
      }
    }
    L.push("END:VCALENDAR");
    return L.map(fold).join("\r\n") + "\r\n";
  }

  const API = { daysInMonth, parseDate, addDays, isMonthEnd, addMonths, addYears, yearEndFrom, weekday, firstArd, accountsDeadline, ctPaymentDue, ctReturnDue, ctPeriods, confirmationStatement, accountsPenaltySteps, returnPenaltySteps, longDate, companyDeadlines, parseCsv, toCsv, hash, toIcs };
  root.CompanyDeadlines = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("cd-app");
  const dataEl = document.getElementById("cd-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const now = new Date();
  const today = `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const shortDate = (iso) => `${weekdayName(iso)} ${longDate(iso)}`;
  const weekdayName = (iso) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday(iso)];
  let uid = 0;

  function field(label, hint, type) {
    const id = "cd-f" + ++uid;
    const wrap = el("div", "cd-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = type || "date";
    input.min = "1900-01-01";
    input.max = "2200-12-31";
    wrap.append(lab);
    if (hint) { const h = el("span", "cd-hint", hint); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(input);
    return { wrap, input };
  }

  function button(text, primary) {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
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

  function downloads(getResults, base) {
    const row = el("div", "try-controls cd-downloads");
    const ics = button("Add to calendar (.ics)");
    const csv = button("Download CSV");
    const print = button("Print or save as PDF");
    ics.addEventListener("click", () => { const r = getResults(); if (r.length) download(base + ".ics", "text/calendar;charset=utf-8", toIcs(r, stamp())); });
    csv.addEventListener("click", () => { const r = getResults(); if (r.length) download(base + ".csv", "text/csv;charset=utf-8", "\ufeff" + toCsv(r)); });
    print.addEventListener("click", () => window.print());
    row.append(ics, csv, print);
    return row;
  }

  function statusCell(iso) {
    if (iso < today) return el("span", "cd-past", "Date has passed");
    const days = Math.round((toMs(iso) - toMs(today)) / DAY);
    return el("span", days <= 30 ? "cd-soon" : null, days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`);
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

  // ---------- one company ----------
  function renderOne(out, r) {
    out.textContent = "";
    const h = el("h3", "lx-h3", "Your deadlines");
    out.append(h);
    if (r.accounts.kind === "changed") out.append(el("p", "cd-warn", "No accounts deadline worked out for this period end: see the note below."));
    out.append(table(["Date", "What is due", "Details", "When"], r.events.map((e) => [shortDate(e.date), e.label, e.detail, statusCell(e.date)]), "cd-results"));
    if (r.events.some((e) => e.date < today)) out.append(el("p", "cd-warn", "Some of these dates have passed. For the next ones, enter a later accounts period end and the last confirmation statement date."));
    if (r.notes.length) { const ul = el("ul", "cd-notes"); r.notes.forEach((n) => ul.append(el("li", null, n))); out.append(ul); }

    if (r.accounts.due) {
      out.append(el("h3", "lx-h3", "If the accounts are late"));
      const steps = accountsPenaltySteps(r.accounts.due);
      out.append(table(["Filed from", "Late by", "Penalty"], DATA.accountsPenalties.map((p, i) => [longDate(steps[i]), p.late, p.amount])));
      out.append(el("p", "lx-fine", DATA.accountsNotes.join(" ")));
    }
    r.ct.forEach((p, i) => {
      out.append(el("h3", "lx-h3", r.ct.length > 1 ? `If tax return ${i + 1} of ${r.ct.length} is late` : "If the Company Tax Return is late"));
      const steps = returnPenaltySteps(p.returnDue);
      out.append(table(["From", "Late by", "Penalty"], DATA.returnPenalties.map((x, j) => [longDate(steps[j]), x.late, x.penalty])));
    });
    if (r.ct.length) out.append(el("p", "lx-fine", DATA.returnNotes.join(" ") + " " + DATA.paymentNotes.join(" ")));
    out.append(el("p", "lx-fine", `Confirmation statement: ${DATA.cs.penalty} The fee is ${DATA.cs.feeOnline} online or ${DATA.cs.feePaper} on paper.`));
    out.append(el("p", "cd-guide", "This is a guide, not advice. Check the official page. The dates on Companies House and in HMRC's letters are the ones that count."));
  }

  function single() {
    const box = el("section", "cd-box");
    box.setAttribute("aria-labelledby", "cd-one-h");
    const h = el("h2", "lx-h3", "One company");
    h.id = "cd-one-h";
    const inc = field("Incorporation date", "The date on the certificate of incorporation.");
    const end = field("Accounts period end (optional)", "Leave blank for the first accounts. For later years, enter the year end you want dates for.");
    const cs = field("Last confirmation statement date (optional)", "Leave blank if the company has not filed one yet.");
    const err = el("p", "cd-error");
    err.setAttribute("role", "alert");
    const go = button("Work out the deadlines", true);
    const out = el("div", "cd-out");
    out.setAttribute("aria-live", "polite");
    let last = [];
    const run = () => {
      err.textContent = "";
      const i = parseDate(inc.input.value);
      const e = end.input.value ? parseDate(end.input.value) : null;
      const c = cs.input.value ? parseDate(cs.input.value) : null;
      if (!i) { err.textContent = "Enter the incorporation date."; inc.input.focus(); return; }
      if (end.input.value && !e) { err.textContent = "The accounts period end is not a valid date."; return; }
      if (e && e <= i) { err.textContent = "The accounts period end must be after the incorporation date."; return; }
      if (cs.input.value && !c) { err.textContent = "The confirmation statement date is not a valid date."; return; }
      const r = companyDeadlines({ name: "", incorporated: i, periodEnd: e, lastStatement: c });
      last = [r];
      renderOne(out, r);
      dl.hidden = false;
    };
    go.addEventListener("click", run);
    [inc, end, cs].forEach((f) => f.input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") run(); }));
    const dl = downloads(() => last, "company-deadlines");
    dl.hidden = true;
    const actions = el("div", "try-controls");
    actions.append(go);
    box.append(h, inc.wrap, end.wrap, cs.wrap, err, actions, out, dl);
    return box;
  }

  // ---------- many companies ----------
  function bulk() {
    const box = el("section", "cd-box");
    box.setAttribute("aria-labelledby", "cd-bulk-h");
    const h = el("h2", "lx-h3", "Many companies at once");
    h.id = "cd-bulk-h";
    const p = el("p", null, "Paste one company per line: name, incorporation date, accounts period end, last confirmation statement date. The last two can be blank. Dates as YYYY-MM-DD or DD/MM/YYYY.");
    const id = "cd-f" + ++uid;
    const lab = el("label", null, "Companies (CSV)");
    lab.htmlFor = id;
    const ta = el("textarea", "cd-csv");
    ta.id = id;
    ta.rows = 6;
    ta.spellcheck = false;
    ta.placeholder = "name,incorporation,period_end,last_cs\nExample Trading Ltd,2025-04-06,,\nSample Services Ltd,2019-03-14,2026-03-31,2026-03-13";
    const err = el("ul", "cd-error");
    const go = button("Work out all deadlines", true);
    const example = button("Fill in an example");
    example.addEventListener("click", () => { ta.value = "name,incorporation,period_end,last_cs\nExample Trading Ltd,2025-04-06,,\nSample Services Ltd,2019-03-14,2026-03-31,2026-03-13\nDemo Design Ltd,2025-01-01,,"; });
    const out = el("div", "cd-out");
    out.setAttribute("aria-live", "polite");
    let last = [];
    go.addEventListener("click", () => {
      err.textContent = "";
      out.textContent = "";
      const rows = parseCsv(ta.value);
      rows.filter((r) => r.error).forEach((r) => err.append(el("li", null, r.error)));
      last = rows.filter((r) => r.company).map((r) => companyDeadlines(r.company));
      dl.hidden = !last.length;
      if (!last.length) { if (!rows.length) err.append(el("li", null, "Paste at least one line.")); return; }
      const all = [];
      last.forEach((r) => r.events.forEach((e) => all.push([e.date, r.company.name || "(no name)", e.label, e.detail])));
      all.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      out.append(el("h3", "lx-h3", `${last.length} compan${last.length === 1 ? "y" : "ies"}, ${all.length} deadlines`));
      out.append(table(["Date", "Company", "What is due", "Details", "When"], all.map((a) => [shortDate(a[0]), a[1], a[2], a[3], statusCell(a[0])]), "cd-results"));
      const notes = el("ul", "cd-notes");
      last.forEach((r) => r.notes.forEach((n) => notes.append(el("li", null, `${r.company.name || "(no name)"}: ${n}`))));
      if (notes.childNodes.length) out.append(notes);
      out.append(el("p", "cd-guide", "This is a guide, not advice. Check the official page. The dates on Companies House and in HMRC's letters are the ones that count."));
    });
    const dl = downloads(() => last, "company-deadlines-all");
    dl.hidden = true;
    const actions = el("div", "try-controls");
    actions.append(go, example);
    box.append(h, p, lab, ta, err, actions, out, dl);
    return box;
  }

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Calculator"), document.createTextNode(" Works in your browser. Nothing you type leaves your device."));
  app.append(intro, single(), bulk());
})(typeof globalThis !== "undefined" ? globalThis : this);
