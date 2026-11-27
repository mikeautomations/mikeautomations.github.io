// Shared engine for the free document makers: purchase order, delivery note, work order (kind "lines") and timesheet
// (kind "timesheet"). Each page puts its labels in <script type="application/json" id="dm-data"> and an empty
// <div id="dm-app">. Everything runs in the browser; nothing is sent anywhere. Money is worked out in pennies.
// The pure part (DocMaker) is tested by tests/doc-makers.test.ts.
(function (root) {
  "use strict";
  const cents = (n) => Math.round((Number(n) || 0) * 100);

  function totals(lines, mode, rate) {
    const sum = lines.reduce((s, l) => s + Math.round((Number(l.qty) || 0) * cents(l.price)), 0);
    const r = mode === "none" ? 0 : Math.max(0, Number(rate) || 0) / 100;
    if (mode === "inclusive") { const tax = Math.round(sum - sum / (1 + r)); return { subtotal: sum - tax, tax, total: sum }; }
    const tax = Math.round(sum * r);
    return { subtotal: sum, tax, total: sum + tax };
  }
  function money(p, currency, pattern) {
    const neg = p < 0, a = Math.abs(Math.round(p));
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return pattern.replace("{c}", currency).replace("{n}", (neg ? "-" : "") + whole + "." + String(a % 100).padStart(2, "0"));
  }
  function nextNumber(n) {
    const m = /^(.*?)(\d+)(\D*)$/.exec((n || "").trim());
    if (!m) return (n || "").trim() ? n.trim() + "-2" : "1";
    return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0") + m[3];
  }
  /** Minutes worked between "HH:MM" start and end, minus break minutes. An end before the start means past midnight. */
  function minutes(start, end, brk) {
    const p = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const s = p(start), e = p(end);
    if (s === null || e === null) return 0;
    let d = e - s; if (d < 0) d += 1440;
    return Math.max(0, d - Math.max(0, Number(brk) || 0));
  }
  /** 495 minutes -> "8:15". */
  function hm(min) { const m = Math.max(0, Math.round(min)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
  /** Pay in pennies for a number of minutes at an hourly rate. */
  function pay(min, rate) { return Math.round((min / 60) * cents(rate)); }

  root.DocMaker = { totals, money, nextNumber, minutes, hm, pay };
  if (typeof document === "undefined") return;
  const app = document.getElementById("dm-app");
  const dataEl = document.getElementById("dm-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui, L = UI.labels, TS = DATA.kind === "timesheet";

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  function field(label, control, hint) {
    const w = el("div", "ft-field gp-field"), lab = el("label", null, label);
    control.id = control.id || "dm-f" + ++uid; lab.htmlFor = control.id; w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control); return w;
  }
  const text = (f) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (f && f.placeholder) c.placeholder = f.placeholder; c.maxLength = (f && f.max) || 80; return c; };
  const num = () => { const c = el("input"); c.type = "number"; c.min = "0"; c.step = "any"; c.inputMode = "decimal"; c.dir = "ltr"; return c; };
  const timeIn = () => { const c = el("input"); c.type = "time"; c.dir = "ltr"; return c; };
  const select = (opts) => { const s = el("select"); opts.forEach((o) => { const v = Array.isArray(o) ? o : [o, o]; const x = el("option", null, v[1]); x.value = v[0]; s.append(x); }); return s; };
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => iso(new Date());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const showDate = (s, short) => { if (!s) return ""; try { return parse(s).toLocaleDateString(UI.dateLocale, short ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return s; } };
  const sym = () => (typeof currency !== "undefined" ? currency.value : UI.defaultCurrency);
  const fmt = (p) => money(p, sym(), UI.money);

  // ---- common header fields ----
  const business = text(UI.business);
  const details = el("textarea"); details.rows = 3; details.dir = "auto"; details.placeholder = UI.details.placeholder; details.maxLength = 300;
  const number = text(UI.number); number.dir = "ltr";
  const date = el("input"); date.type = "date"; date.dir = "ltr";
  const note = el("textarea"); note.rows = 2; note.dir = "auto"; note.maxLength = 300; if (UI.note.placeholder) note.placeholder = UI.note.placeholder;
  const form = el("div", "ft-box gp-form");
  const tryBtn = button("try-btn", UI.example), clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top"), btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const rowA = el("div", "rc-row");
  if (!TS) rowA.append(field(UI.number.label, number), field(UI.date.label, date));
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";

  // ---- preview paper ----
  const paper = el("div", "rc-paper dm-paper"); paper.setAttribute("aria-live", "polite");
  const head = el("div", "rc-head"), bizBox = el("div"), biz = el("p", "rc-biz"), det = el("p", "rc-det");
  bizBox.append(biz, det); head.append(bizBox, el("p", "rc-title", UI.title));
  const meta = el("div", "rc-meta");
  const table = el("table", "rc-table dm-table"), thead = el("thead"), tbody = el("tbody"); table.append(thead, tbody);
  const noteP = el("p", "rc-note dm-notep");
  const sign = el("div", "dm-sign");
  (UI.sign || []).forEach((s) => { const d = el("div", "dm-sig"); d.append(el("span", "dm-line"), el("span", "rc-small", s)); sign.append(d); });
  paper.append(head, meta, table, noteP, sign);
  const stage = el("div", "rc-stage"); stage.append(paper);
  const pdf = button("try-btn try-btn-primary rc-btn", UI.pdf), copy = button("try-btn rc-btn", UI.copy), next = button("try-btn gp-ghost rc-btn", UI.next);
  const acts = el("div", "rc-acts"); acts.append(pdf, copy, next);
  const status = el("p", "gp-status"); status.setAttribute("role", "status");
  const prev = el("section", "gp-card"); prev.append(el("h2", "gp-h", UI.previewTitle), stage, acts, el("p", "gp-hint", UI.pdfHint), status);
  const side = el("div", "gp-side"); side.append(prev);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  let lines = [], rows = [], drawLinesRef = null;
  let party, party2, extras = {}, tax, rate, currency, rateField, addBtn, linesBox;
  let who, from, days, hourly, mode;

  if (!TS) {
    party = text(UI.party);
    party2 = UI.party2 ? text(UI.party2) : null;
    (UI.extra || []).forEach((x) => { extras[x.id] = text(x); });
    linesBox = el("div", "rc-lines");
    addBtn = button("try-btn gp-ghost rc-add", UI.addLine);
    tax = select(UI.tax ? UI.tax.options : [["none", ""]]); rate = num(); rate.value = String(UI.defaultRate || 0);
    currency = select(UI.currency.options);
    const showP = !!UI.price;
    const drawLines = () => {
      linesBox.textContent = "";
      lines.forEach((l, i) => {
        const row = el("div", "rc-line"); row.style.gridTemplateColumns = showP ? "" : "minmax(0,1fr) 5rem auto";
        const d = text({ max: 100 }), q = num(), p = showP ? num() : null;
        d.value = l.desc; q.value = String(l.qty); q.step = "1"; if (p) p.value = l.price === "" ? "" : String(l.price);
        d.setAttribute("aria-label", UI.desc + " " + (i + 1)); q.setAttribute("aria-label", UI.qty + " " + (i + 1)); if (p) p.setAttribute("aria-label", UI.price + " " + (i + 1));
        d.addEventListener("input", () => { l.desc = d.value; render(); });
        q.addEventListener("input", () => { l.qty = Number(q.value) || 0; render(); });
        if (p) p.addEventListener("input", () => { l.price = p.value === "" ? "" : Number(p.value) || 0; render(); });
        const x = button("try-btn gp-ghost rc-x", "✕"); x.setAttribute("aria-label", UI.removeLine.replace("{n}", String(i + 1)));
        x.disabled = lines.length === 1;
        x.addEventListener("click", () => { lines.splice(i, 1); drawLines(); render(); });
        const hd = (t, c) => { const w = el("div", "ft-field gp-field"); if (i === 0) { const s = el("span", "rc-small", t); s.setAttribute("aria-hidden", "true"); w.append(s); } w.append(c); return w; };
        row.append(hd(UI.desc, d), hd(UI.qty, q)); if (p) row.append(hd(UI.price, p)); row.append(x);
        linesBox.append(row);
      });
      addBtn.hidden = lines.length >= 30;
    };
    drawLinesRef = drawLines;
    addBtn.addEventListener("click", () => { lines.push({ desc: "", qty: 1, price: "" }); drawLines(); render(); const ins = linesBox.querySelectorAll("input[type=text]"); ins[ins.length - 1].focus(); });
    form.append(formTop, field(UI.business.label, business), field(UI.details.label, details, UI.details.hint), rowA, field(UI.party.label, party));
    if (party2) form.append(field(UI.party2.label, party2));
    (UI.extra || []).forEach((x) => form.append(field(x.label, extras[x.id])));
    const ih = el("h3", "gp-h", UI.items); ih.style.marginTop = "0.6rem";
    form.append(ih, linesBox, addBtn);
    if (UI.tax) {
      rateField = field(UI.rate, rate);
      const rt = el("div", "rc-row3"); rt.append(field(UI.tax.label, tax), rateField, field(UI.currency.label, currency));
      if (UI.currency.options.length < 2) { rt.style.gridTemplateColumns = "minmax(0,1.4fr) minmax(0,1fr)"; rt.lastChild.hidden = true; }
      form.append(rt);
    } else if (showP) { const rt = el("div", "rc-row"); rt.append(field(UI.currency.label, currency)); form.append(rt); }
    form.append(field(UI.note.label, note), checksH, checkList);
  } else {
    who = text(UI.who);
    from = el("input"); from.type = "date"; from.dir = "ltr";
    days = select(UI.periods);
    hourly = num();
    mode = null;
    currency = select(UI.currency.options);
    linesBox = el("div", "dm-ts");
    const row2 = el("div", "rc-row"); row2.append(field(UI.from.label, from, UI.from.hint), field(UI.days.label, days));
    const row3 = el("div", "rc-row"); row3.append(field(UI.hourly.label, hourly, UI.hourly.hint), field(UI.currency.label, currency));
    if (UI.currency.options.length < 2) { row3.style.gridTemplateColumns = "minmax(0,1fr)"; row3.lastChild.hidden = true; }
    const ih = el("h3", "gp-h", UI.items); ih.style.marginTop = "0.6rem";
    form.append(formTop, field(UI.business.label, business), field(UI.who.label, who), row2, row3, ih, linesBox, field(UI.note.label, note), checksH, checkList);
  }

  // timesheet rows follow the period
  function buildRows() {
    const n = Number(days.value) || 7, start = from.value ? parse(from.value) : new Date();
    const old = rows; rows = [];
    for (let i = 0; i < n; i++) { const d = new Date(start); d.setDate(d.getDate() + i); const k = iso(d); rows.push(old.find((r) => r.date === k) || { date: k, s: "", e: "", b: "" }); }
    linesBox.textContent = "";
    const hdr = el("div", "dm-tsrow dm-tshead"); [UI.col.day, UI.col.start, UI.col.end, UI.col.brk, UI.col.hours].forEach((t) => hdr.append(el("span", "rc-small", t))); hdr.setAttribute("aria-hidden", "true"); linesBox.append(hdr);
    rows.forEach((r) => {
      const row = el("div", "dm-tsrow"), day = el("span", "dm-day", showDate(r.date, true));
      const s = timeIn(), e = timeIn(), b = num(); b.step = "5"; b.placeholder = "0";
      s.value = r.s; e.value = r.e; b.value = r.b === "" ? "" : String(r.b);
      const hrs = el("span", "dm-hrs");
      const lbl = showDate(r.date, true);
      s.setAttribute("aria-label", UI.col.start + " " + lbl); e.setAttribute("aria-label", UI.col.end + " " + lbl); b.setAttribute("aria-label", UI.col.brk + " " + lbl);
      const upd = () => { r.s = s.value; r.e = e.value; r.b = b.value === "" ? "" : Number(b.value) || 0; hrs.textContent = r.s && r.e ? hm(minutes(r.s, r.e, r.b)) : ""; render(); };
      s.addEventListener("input", upd); e.addEventListener("input", upd); b.addEventListener("input", upd);
      hrs.textContent = r.s && r.e ? hm(minutes(r.s, r.e, r.b)) : "";
      row.append(day, s, e, b, hrs); linesBox.append(row);
    });
  }

  function value() {
    if (TS) return { business: business.value, who: who.value, from: from.value, rate: Number(hourly.value) || 0, note: note.value, rows };
    return {
      business: business.value, details: details.value, number: number.value, date: showDate(date.value), party: party.value, party2: party2 ? party2.value : "",
      extras: (UI.extra || []).map((x) => [x.label, extras[x.id].value]), lines: lines.map((l) => ({ desc: l.desc, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })),
      mode: tax ? tax.value : "none", rate: Number(rate.value) || 0, note: note.value,
    };
  }
  const tr = (cells, cls) => { const r = el("tr", cls); cells.forEach((c, i) => { const td = el("td", i === 0 ? "" : "dm-n"); if (typeof c === "string") td.textContent = c; else if (c) td.append(c); r.append(td); }); tbody.append(r); return r; };
  const trSpan = (label, val, cls, span) => { const r = el("tr", cls); const a = el("td", null, label); a.colSpan = span; r.append(a, el("td", "dm-n", val)); tbody.append(r); };

  function renderLines(r) {
    const showP = !!UI.price, t = totals(r.lines, r.mode, r.rate);
    if (rateField) rateField.hidden = tax.value === "none";
    thead.textContent = ""; tbody.textContent = "";
    const hr = el("tr"); hr.append(el("th", null, UI.desc), el("th", "dm-n", UI.qty)); if (showP) hr.append(el("th", "dm-n", UI.price), el("th", "dm-n", UI.lineTotal)); thead.append(hr);
    const used = r.lines.filter((l) => l.desc.trim() || l.price);
    used.forEach((l) => { const cells = [l.desc.trim() || "—", String(l.qty)]; if (showP) cells.push(fmt(cents(l.price)), fmt(Math.round(l.qty * cents(l.price)))); tr(cells); });
    if (showP) {
      const span = 3; let first = true; const sep = () => { const c = first ? "rc-sep" : ""; first = false; return c; };
      if (r.mode === "exclusive") { trSpan(L.subtotal, fmt(t.subtotal), sep(), span); trSpan(UI.taxName + " " + r.rate + "%", fmt(t.tax), "", span); }
      trSpan(L.total, fmt(t.total), sep() + " rc-total", span);
      if (r.mode === "inclusive") trSpan(L.includes.replace("{tax}", UI.taxName + " " + r.rate + "%").replace("{amount}", fmt(t.tax)), "", "rc-small", span);
    } else { const units = used.reduce((s, l) => s + l.qty, 0); if (units) trSpan(L.items, String(units), "rc-sep rc-total", 1); }
    meta.textContent = "";
    const bits = [r.number.trim() ? L.number + " " + r.number.trim() : "", r.date ? L.date + ": " + r.date : "", r.party.trim() ? UI.party.label + ": " + r.party.trim() : "", r.party2.trim() ? UI.party2.label + ": " + r.party2.trim() : "", ...r.extras.filter((x) => x[1].trim()).map((x) => x[0] + ": " + x[1].trim())];
    bits.forEach((s) => { if (s) meta.append(el("span", null, s)); });
    return { total: t.total, items: used.length };
  }
  function renderSheet(r) {
    thead.textContent = ""; tbody.textContent = "";
    const hr = el("tr"); [UI.col.day, UI.col.start, UI.col.end, UI.col.brk, UI.col.hours].forEach((t, i) => hr.append(el("th", i ? "dm-n" : "", t))); thead.append(hr);
    let mins = 0, worked = 0;
    r.rows.forEach((x) => { const m = x.s && x.e ? minutes(x.s, x.e, x.b) : 0; mins += m; if (m) worked++; tr([showDate(x.date, true), x.s || "", x.e || "", x.b ? String(x.b) : "", m ? hm(m) : ""]); });
    trSpan(L.total, hm(mins), "rc-sep rc-total", 4);
    if (r.rate > 0) trSpan(L.pay + " (" + L.rate.replace("{rate}", fmt(cents(r.rate))) + ")", fmt(pay(mins, r.rate)), "rc-total", 4);
    meta.textContent = "";
    [r.who.trim() ? UI.who.label + ": " + r.who.trim() : "", r.rows.length ? L.period + ": " + showDate(r.rows[0].date) + " – " + showDate(r.rows[r.rows.length - 1].date) : ""].forEach((s) => { if (s) meta.append(el("span", null, s)); });
    return { mins, worked };
  }
  function render() {
    const r = value();
    biz.textContent = r.business.trim() || UI.business.placeholder.replace(/^.*?: |^e\.g\. /, "");
    det.textContent = TS ? "" : r.details.trim();
    const x = TS ? renderSheet(r) : renderLines(r);
    noteP.textContent = r.note.trim(); noteP.hidden = !r.note.trim();
    checkList.textContent = "";
    const list = [];
    list.push(r.business.trim() ? ["ok", "business_ok"] : ["bad", "business_missing"]);
    if (TS) { list.push(x.worked ? ["ok", "hours_ok"] : ["bad", "hours_missing"]); list.push(r.who.trim() ? ["ok", "who_ok"] : ["warn", "who_missing"]); if (x.mins > 0 && r.rate <= 0) list.push(["warn", "rate_missing"]); }
    else { list.push(x.items ? ["ok", "items_ok"] : ["bad", "items_missing"]); list.push(r.number.trim() ? ["ok", "number_ok"] : ["warn", "number_missing"]); list.push(r.party.trim() ? ["ok", "party_ok"] : ["warn", "party_missing"]); }
    const order = { bad: 0, warn: 1, ok: 2 };
    list.sort((a, b) => order[a[0]] - order[b[0]]).forEach(([lv, id]) => {
      const li = el("li", "gp-check gp-" + lv), icn = el("span", "gp-ic", lv === "ok" ? "✓" : lv === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text"); tx.append(el("span", "gp-sr", UI.level[lv] + ": "), document.createTextNode(UI.checks[id] || id)); li.append(icn, tx); checkList.append(li);
    });
  }
  function asText() {
    const r = value(), out = [r.business.trim()];
    if (TS) {
      out.push(UI.title + (r.who.trim() ? " – " + r.who.trim() : ""), "");
      let mins = 0; r.rows.forEach((x) => { const m = x.s && x.e ? minutes(x.s, x.e, x.b) : 0; mins += m; if (m) out.push(`${showDate(x.date, true)}: ${x.s}–${x.e}${x.b ? " (" + UI.col.brk.toLowerCase() + " " + x.b + ")" : ""} = ${hm(m)}`); });
      out.push("", `${L.total}: ${hm(mins)}`); if (r.rate > 0) out.push(`${L.pay}: ${fmt(pay(mins, r.rate))}`);
    } else {
      out.push(...r.details.split("\n").map((s) => s.trim()).filter(Boolean), "", `${UI.title} ${r.number}`.trim(), r.date ? `${L.date}: ${r.date}` : "");
      if (r.party.trim()) out.push(`${UI.party.label}: ${r.party.trim()}`); if (r.party2.trim()) out.push(`${UI.party2.label}: ${r.party2.trim()}`);
      r.extras.forEach((x) => { if (x[1].trim()) out.push(`${x[0]}: ${x[1].trim()}`); });
      out.push("");
      r.lines.filter((l) => l.desc.trim() || l.price).forEach((l) => out.push(`${l.qty} x ${l.desc.trim()}${UI.price ? "  " + fmt(Math.round(l.qty * cents(l.price))) : ""}`));
      if (UI.price) { const t = totals(r.lines, r.mode, r.rate); out.push(""); if (r.mode === "exclusive") out.push(`${L.subtotal}: ${fmt(t.subtotal)}`, `${UI.taxName} ${r.rate}%: ${fmt(t.tax)}`); out.push(`${L.total}: ${fmt(t.total)}`); }
    }
    if (r.note.trim()) out.push("", r.note.trim());
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  form.addEventListener("input", (e) => { if (!e.target.closest || !e.target.closest(".rc-line, .dm-tsrow")) render(); });
  form.addEventListener("change", (e) => { if (TS && (e.target === from || e.target === days)) buildRows(); render(); });
  pdf.addEventListener("click", () => {
    render();
    const old = document.title; document.title = UI.file.replace("{n}", TS ? who.value.trim() : number.value.trim()).trim();
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore); window.print(); setTimeout(restore, 2000);
  });
  copy.addEventListener("click", () => {
    const done = () => { copy.dataset.done = "1"; copy.textContent = "✓ " + UI.copied; setTimeout(() => { copy.dataset.done = ""; copy.textContent = UI.copy; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(asText()).then(done, () => {});
  });
  next.addEventListener("click", () => {
    if (TS) { const s = from.value ? parse(from.value) : new Date(); s.setDate(s.getDate() + (Number(days.value) || 7)); from.value = iso(s); rows = []; buildRows(); render(); status.textContent = UI.nextDone; return; }
    number.value = nextNumber(number.value); party.value = ""; if (party2) party2.value = ""; Object.values(extras).forEach((c) => { c.value = ""; });
    lines = [{ desc: "", qty: 1, price: "" }]; date.value = today(); drawLinesRef(); render();
    status.textContent = UI.nextDone.replace("{n}", number.value); party.focus();
  });
  function reset() {
    business.value = ""; details.value = ""; note.value = UI.defaultNote || ""; status.textContent = ""; currency.value = UI.defaultCurrency;
    if (TS) { who.value = ""; hourly.value = ""; days.selectedIndex = 0; from.value = mondayOf(new Date()); rows = []; }
    else { number.value = ""; date.value = today(); party.value = ""; if (party2) party2.value = ""; Object.values(extras).forEach((c) => { c.value = ""; }); lines = [{ desc: "", qty: 1, price: "" }]; if (tax) { tax.value = "none"; rate.value = String(UI.defaultRate || 0); } }
  }
  function mondayOf(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example; reset(); business.value = e.business; note.value = e.note || note.value;
    if (TS) { who.value = e.who; hourly.value = String(e.rate); from.value = e.from; rows = e.rows.map(([s, en, b], i) => { const d = parse(e.from); d.setDate(d.getDate() + i); return { date: iso(d), s, e: en, b }; }); buildRows(); }
    else {
      details.value = e.details; number.value = e.number; party.value = e.party; if (party2) party2.value = e.party2 || ""; (UI.extra || []).forEach((x) => { extras[x.id].value = (e.extras || {})[x.id] || ""; });
      if (tax && e.mode) tax.value = e.mode; lines = e.lines.map(([d, q, p]) => ({ desc: d, qty: q, price: p == null ? "" : p })); drawLinesRef();
    }
    render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); if (TS) buildRows(); else drawLinesRef(); render(); business.focus(); });
  reset();
  if (TS) buildRows(); else drawLinesRef();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
