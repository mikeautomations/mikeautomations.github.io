// /en/free-invoice-generator/ client logic. Progressive enhancement: the page explains the tool without JS.
// No dependencies, no network requests, no cookies, no tracking: nothing typed here leaves the device. The only
// storage is localStorage, and only when the person presses "Save on this device" (wrapped in try/catch).
// PART 1 is a line-for-line copy of the pure functions in src/app/landing/data/tools/invoice-generator.ts with the
// types removed; tests/free-tools.test.ts loads this file in a sandbox and checks both copies agree.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to invoice-generator.ts) ----------
  const CURRENCIES = [
    { code: "USD", symbol: "$", label: "US dollar ($)" },
    { code: "GBP", symbol: "£", label: "British pound (£)" },
    { code: "EUR", symbol: "€", label: "Euro (€)" },
  ];

  function parseNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) && v > 0 && v < 1e9 ? v : 0;
    const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return 0;
    const n = Number(s);
    return Number.isFinite(n) && n < 1e9 ? n : 0;
  }

  function lineCents(line) {
    return Math.round(parseNumber(line.qty) * Math.round(parseNumber(line.price) * 100));
  }

  function cleanRate(v) {
    const n = parseNumber(v);
    return n > 100 ? 100 : n;
  }

  function totals(lines, taxRate) {
    const subtotal = lines.reduce((sum, l) => sum + lineCents(l), 0);
    const rate = cleanRate(taxRate);
    const tax = Math.round((subtotal * rate) / 100);
    return { subtotal, rate, tax, total: subtotal + tax };
  }

  function formatMoney(cents, code) {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    const neg = cents < 0;
    const abs = Math.abs(Math.round(cents));
    const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${neg ? "-" : ""}${cur.symbol}${whole}.${String(abs % 100).padStart(2, "0")}`;
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (mo < 1 || mo > 12 || dt.getUTCDate() !== d) return "";
    return `${d} ${MONTHS[mo - 1]} ${y}`;
  }

  function addDays(iso, n) {
    if (!formatDate(iso)) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return dt.toISOString().slice(0, 10);
  }

  root.InvoiceGenerator = { parseNumber, lineCents, cleanRate, totals, formatMoney, formatDate, addDays };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("inv-app");
  if (!app) return;

  const STORE_KEY = "mike-invoice-details-v1";
  const MAX_LOGO_BYTES = 1500000;
  const MAX_SAVED_LOGO_CHARS = 400000;

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
  /** A labelled field. Returns { wrap, input }. */
  function field(label, input, hint) {
    const id = "inv-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    input.id = id;
    wrap.append(lab, input);
    if (hint) {
      const h = el("p", "ft-hint", hint);
      h.id = id + "-hint";
      input.setAttribute("aria-describedby", h.id);
      wrap.append(h);
    }
    return { wrap, input };
  }
  const textInput = (type, value, extra) => {
    const i = el("input");
    i.type = type || "text";
    if (value != null) i.value = value;
    if (extra) Object.assign(i, extra);
    return i;
  };
  const textArea = (rows) => {
    const t = el("textarea");
    t.rows = rows || 3;
    return t;
  };

  const todayIso = () => {
    const d = new Date();
    return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ----- state -----
  const state = {
    logo: "",
    lines: [{ description: "", qty: "1", price: "" }],
  };

  app.textContent = "";

  const form = el("div", "ft-noprint");
  form.style.display = "grid";
  form.style.gap = "1rem";

  // Your details
  const boxMe = el("section", "ft-box");
  boxMe.setAttribute("aria-labelledby", "inv-h-me");
  const hMe = el("h2", "lx-h3", "Your business");
  hMe.id = "inv-h-me";
  const fBiz = field("Business name", textInput("text", "", { autocomplete: "organization" }));
  const fAddr = field("Address", textArea(3), "Shown under your business name.");
  const fContact = field("Email or phone (optional)", textInput("text", "", { autocomplete: "off" }));
  const fLogo = field("Logo (optional)", textInput("file"), "PNG, JPG, WebP or GIF, up to 1.5 MB. It stays on your device.");
  fLogo.input.accept = "image/png,image/jpeg,image/webp,image/gif";
  const logoRow = el("div", "try-controls");
  const btnRemoveLogo = button("Remove logo");
  btnRemoveLogo.hidden = true;
  logoRow.append(btnRemoveLogo);
  const logoMsg = el("p", "ft-error");
  logoMsg.setAttribute("role", "alert");
  const meGrid = el("div", "ft-grid");
  meGrid.append(fBiz.wrap, fContact.wrap);
  boxMe.append(hMe, meGrid, fAddr.wrap, fLogo.wrap, logoRow, logoMsg);

  // Client
  const boxClient = el("section", "ft-box");
  boxClient.setAttribute("aria-labelledby", "inv-h-client");
  const hClient = el("h2", "lx-h3", "Your client");
  hClient.id = "inv-h-client";
  const fClient = field("Client name", textInput("text", ""));
  const fClientAddr = field("Client address and details", textArea(3));
  boxClient.append(hClient, fClient.wrap, fClientAddr.wrap);

  // Invoice details
  const boxInv = el("section", "ft-box");
  boxInv.setAttribute("aria-labelledby", "inv-h-inv");
  const hInv = el("h2", "lx-h3", "Invoice details");
  hInv.id = "inv-h-inv";
  const issue = todayIso();
  const fNum = field("Invoice number", textInput("text", "INV-001"));
  const fDate = field("Invoice date", textInput("date", issue));
  const fDue = field("Due date", textInput("date", addDays(issue, 14)));
  const fCur = field("Currency", el("select"));
  for (const c of CURRENCIES) {
    const o = el("option", null, c.label);
    o.value = c.code;
    fCur.input.append(o);
  }
  const fTaxName = field("Tax name (optional)", textInput("text", "VAT"), "For example VAT or Sales tax.");
  const fTaxRate = field("Tax rate % (optional)", textInput("text", ""), "Leave empty for no tax. For example 20.");
  fTaxRate.input.inputMode = "decimal";
  const invGrid = el("div", "ft-grid");
  invGrid.append(fNum.wrap, fDate.wrap, fDue.wrap, fCur.wrap, fTaxName.wrap, fTaxRate.wrap);
  boxInv.append(hInv, invGrid);

  // Line items
  const boxLines = el("section", "ft-box");
  boxLines.setAttribute("aria-labelledby", "inv-h-lines");
  const hLines = el("h2", "lx-h3", "Items");
  hLines.id = "inv-h-lines";
  const linesWrap = el("div", "ft-lines");
  const btnAdd = button("Add another item");
  const live = el("p", "inv-total-live");
  live.id = "inv-live";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  boxLines.append(hLines, linesWrap, el("div", "try-controls"), live);
  boxLines.children[2].append(btnAdd);

  // Notes and payment
  const boxPay = el("section", "ft-box");
  boxPay.setAttribute("aria-labelledby", "inv-h-pay");
  const hPay = el("h2", "lx-h3", "Payment details and notes");
  hPay.id = "inv-h-pay";
  const fPay = field("How to pay you", textArea(4), "For example bank name, account name, sort code and account number, or a payment link.");
  const fNotes = field("Notes (optional)", textArea(3), "For example thank you, payment terms or a purchase order number.");
  boxPay.append(hPay, fPay.wrap, fNotes.wrap);

  // Actions
  const boxAct = el("section", "ft-box");
  boxAct.setAttribute("aria-labelledby", "inv-h-act");
  const hAct = el("h2", "lx-h3", "Save your invoice");
  hAct.id = "inv-h-act";
  const actRow = el("div", "try-controls");
  const btnPdf = button("Download PDF", true);
  const btnSave = button("Save on this device");
  const btnClear = button("Clear saved details");
  actRow.append(btnPdf, btnSave, btnClear);
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const actHint = el("p", "ft-hint", "Download PDF opens your browser's print window: choose Save as PDF. Only the invoice is printed. \"Save on this device\" keeps your business details, tax and payment details in this browser so you can reuse them. Nothing is uploaded.");
  boxAct.append(hAct, actRow, status, actHint);

  form.append(boxMe, boxClient, boxInv, boxLines, boxPay, boxAct);

  // Preview
  const previewWrap = el("section");
  previewWrap.setAttribute("aria-labelledby", "inv-h-prev");
  const hPrev = el("h2", "lx-h3 ft-noprint", "Preview");
  hPrev.id = "inv-h-prev";
  const paper = el("div", "inv-paper");
  paper.id = "inv-preview";
  previewWrap.append(hPrev, paper);

  app.append(form, previewWrap);

  // ----- line rows -----
  function renderLines() {
    linesWrap.textContent = "";
    state.lines.forEach((ln, i) => {
      const row = el("div", "ft-line");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", `Item ${i + 1}`);
      const d = field("Description", textInput("text", ln.description));
      const q = field("Qty", textInput("text", ln.qty));
      q.input.inputMode = "decimal";
      const p = field("Price each", textInput("text", ln.price));
      p.input.inputMode = "decimal";
      d.input.addEventListener("input", () => { ln.description = d.input.value; update(); });
      q.input.addEventListener("input", () => { ln.qty = q.input.value; update(); });
      p.input.addEventListener("input", () => { ln.price = p.input.value; update(); });
      const rm = button("Remove");
      rm.setAttribute("aria-label", `Remove item ${i + 1}`);
      rm.addEventListener("click", () => {
        state.lines.splice(i, 1);
        if (!state.lines.length) state.lines.push({ description: "", qty: "1", price: "" });
        renderLines();
        update();
        btnAdd.focus();
      });
      row.append(d.wrap, q.wrap, p.wrap, rm);
      linesWrap.append(row);
    });
  }

  btnAdd.addEventListener("click", () => {
    state.lines.push({ description: "", qty: "1", price: "" });
    renderLines();
    update();
    const rows = linesWrap.querySelectorAll(".ft-line");
    const last = rows[rows.length - 1];
    const first = last && last.querySelector("input");
    if (first) first.focus();
  });

  // ----- preview -----
  const block = (cls, text) => el("p", cls, text);

  function renderPreview() {
    const cur = fCur.input.value;
    const t = totals(state.lines, fTaxRate.input.value);
    paper.textContent = "";

    const top = el("div", "inv-top");
    const from = el("div");
    if (state.logo) {
      const img = el("img", "inv-logo");
      img.src = state.logo;
      img.alt = fBiz.input.value.trim() ? `${fBiz.input.value.trim()} logo` : "Business logo";
      from.append(img);
    }
    if (fBiz.input.value.trim()) from.append(block("inv-name", fBiz.input.value.trim()));
    if (fAddr.input.value.trim()) from.append(block("inv-block", fAddr.input.value.trim()));
    if (fContact.input.value.trim()) from.append(block("inv-block", fContact.input.value.trim()));

    const head = el("div");
    head.append(el("p", "inv-title", "INVOICE"));
    const meta = el("dl", "inv-meta");
    const addMeta = (k, v) => {
      if (!v) return;
      meta.append(el("dt", null, k), el("dd", null, v));
    };
    addMeta("Invoice no.", fNum.input.value.trim());
    addMeta("Date", formatDate(fDate.input.value));
    addMeta("Due date", formatDate(fDue.input.value));
    head.append(meta);
    top.append(from, head);

    const parties = el("div", "inv-parties");
    const bill = el("div");
    bill.append(el("p", "inv-label", "Bill to"));
    if (fClient.input.value.trim()) bill.append(block("inv-name", fClient.input.value.trim()));
    if (fClientAddr.input.value.trim()) bill.append(block("inv-block", fClientAddr.input.value.trim()));
    if (!fClient.input.value.trim() && !fClientAddr.input.value.trim()) bill.append(block("inv-block", "Client name and address"));
    parties.append(bill);

    const scroll = el("div", "inv-scroll");
    const table = el("table", "inv-table");
    const cap = el("caption", null, "Invoice items");
    // Visually hidden but read by screen readers (an off-screen left offset made the page scroll sideways).
    Object.assign(cap.style, { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: "0" });
    table.append(cap);
    const thead = el("thead");
    const hr = el("tr");
    for (const [h, num] of [["Description", false], ["Qty", true], ["Price", true], ["Amount", true]]) {
      const th = el("th", num ? "num" : null, h);
      th.scope = "col";
      hr.append(th);
    }
    thead.append(hr);
    const tbody = el("tbody");
    let shown = 0;
    for (const ln of state.lines) {
      const cents = lineCents(ln);
      if (!ln.description.trim() && !cents) continue;
      shown++;
      const tr = el("tr");
      tr.append(
        el("td", null, ln.description.trim()),
        el("td", "num", String(parseNumber(ln.qty) || 0)),
        el("td", "num", formatMoney(Math.round(parseNumber(ln.price) * 100), cur)),
        el("td", "num", formatMoney(cents, cur)),
      );
      tbody.append(tr);
    }
    if (!shown) {
      const tr = el("tr");
      const td = el("td", null, "Add your first item");
      td.colSpan = 4;
      tr.append(td);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    scroll.append(table);

    const tot = el("div", "inv-totals");
    const row = (k, v, cls) => {
      const d = el("div", cls);
      d.append(el("span", null, k), el("span", null, v));
      tot.append(d);
    };
    row("Subtotal", formatMoney(t.subtotal, cur));
    if (t.rate > 0) row(`${fTaxName.input.value.trim() || "Tax"} (${String(+t.rate.toFixed(2))}%)`, formatMoney(t.tax, cur));
    row("Total due", formatMoney(t.total, cur), "grand");

    const notes = el("div", "inv-notes");
    if (fPay.input.value.trim()) {
      const d = el("div");
      d.append(el("p", "inv-label", "Payment details"), block("inv-block", fPay.input.value.trim()));
      notes.append(d);
    }
    if (fNotes.input.value.trim()) {
      const d = el("div");
      d.append(el("p", "inv-label", "Notes"), block("inv-block", fNotes.input.value.trim()));
      notes.append(d);
    }

    paper.append(top, parties, scroll, tot);
    if (notes.children.length) paper.append(notes);
    return t;
  }

  let liveTimer = 0;
  function update() {
    const t = renderPreview();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = `Total due: ${formatMoney(t.total, fCur.input.value)}`; }, 500);
  }

  for (const f of [fBiz, fAddr, fContact, fClient, fClientAddr, fNum, fDate, fDue, fCur, fTaxName, fTaxRate, fPay, fNotes]) {
    f.input.addEventListener("input", update);
    f.input.addEventListener("change", update);
  }

  // ----- logo (read locally, never uploaded) -----
  fLogo.input.addEventListener("change", () => {
    logoMsg.textContent = "";
    const file = fLogo.input.files && fLogo.input.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { logoMsg.textContent = "Please choose a PNG, JPG, WebP or GIF image."; fLogo.input.value = ""; return; }
    if (file.size > MAX_LOGO_BYTES) { logoMsg.textContent = "That image is over 1.5 MB. Please choose a smaller one."; fLogo.input.value = ""; return; }
    const r = new FileReader();
    r.onload = () => { state.logo = String(r.result || ""); btnRemoveLogo.hidden = !state.logo; update(); };
    r.onerror = () => { logoMsg.textContent = "Could not read that file."; };
    r.readAsDataURL(file);
  });
  btnRemoveLogo.addEventListener("click", () => {
    state.logo = "";
    fLogo.input.value = "";
    btnRemoveLogo.hidden = true;
    update();
    fLogo.input.focus();
  });

  // ----- save on this device -----
  const say = (msg) => { status.textContent = msg; };

  function savedData() {
    return {
      biz: fBiz.input.value, address: fAddr.input.value, contact: fContact.input.value,
      currency: fCur.input.value, taxName: fTaxName.input.value, taxRate: fTaxRate.input.value,
      payment: fPay.input.value, notes: fNotes.input.value,
      logo: state.logo && state.logo.length <= MAX_SAVED_LOGO_CHARS ? state.logo : "",
    };
  }

  btnSave.addEventListener("click", () => {
    const d = savedData();
    const logoSkipped = !!state.logo && !d.logo;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      say("Saved on this device." + (logoSkipped ? " Your logo is too big to save, so add it again next time." : ""));
    } catch (e) {
      say("Could not save: your browser has storage turned off. Your invoice is still fine to print.");
    }
  });

  btnClear.addEventListener("click", () => {
    try {
      localStorage.removeItem(STORE_KEY);
      say("Saved details cleared from this device.");
    } catch (e) {
      say("Could not clear: your browser has storage turned off.");
    }
  });

  function loadSaved() {
    let d = null;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      d = raw ? JSON.parse(raw) : null;
    } catch (e) { d = null; }
    if (!d || typeof d !== "object") return;
    const s = (v) => (typeof v === "string" ? v : "");
    fBiz.input.value = s(d.biz);
    fAddr.input.value = s(d.address);
    fContact.input.value = s(d.contact);
    if (CURRENCIES.some((c) => c.code === d.currency)) fCur.input.value = d.currency;
    if (typeof d.taxName === "string") fTaxName.input.value = d.taxName;
    fTaxRate.input.value = s(d.taxRate);
    fPay.input.value = s(d.payment);
    fNotes.input.value = s(d.notes);
    if (typeof d.logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(d.logo)) { state.logo = d.logo; btnRemoveLogo.hidden = false; }
    say("Loaded your saved details.");
  }

  // ----- print / PDF -----
  btnPdf.addEventListener("click", () => {
    update();
    const old = document.title;
    const num = fNum.input.value.trim();
    document.title = num ? `Invoice ${num}` : "Invoice";
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
    // Some browsers do not fire afterprint: put the title back anyway.
    setTimeout(restore, 2000);
  });

  renderLines();
  loadSaved();
  update();
})(typeof window !== "undefined" ? window : globalThis);
