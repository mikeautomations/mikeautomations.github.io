// /en/income-and-expenses-spreadsheet/ and /he/income-expenses/ client logic. Progressive enhancement: without JS
// the page explains the template. The .xlsx file is written in the browser. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/bookkeeping.ts with the types removed (made with the TypeScript
// compiler). tests/income-and-expenses-spreadsheet.test.ts checks both copies give identical results.
// PART 2 reads its texts and the template (English or Hebrew) from <script id="bk-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to bookkeeping.ts) ----------
  // The ZIP and XML helpers come from public/customer-tracker-template.js, loaded first.
  const { col, listItems, makeZip, serial, utf8, x } = root.Tracker;
  const ROWS = 1000, FROWS = 400;
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const fq = (s) => '"' + s.replace(/"/g, '""') + '"';
  const istr = (r, s, style = 0) => `<c r="${r}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${x(s)}</t></is></c>`;
  const num = (r, n, style = 0) => `<c r="${r}"${style ? ` s="${style}"` : ""}><v>${n}</v></c>`;
  const fml = (r, f, style = 0) => `<c r="${r}"${style ? ` s="${style}"` : ""}><f>${x(f)}</f></c>`;
  function styles(currencyFormat) {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="${x(currencyFormat)}"/></numFmts>
  <fonts count="6"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF0B1430"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF55627A"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF0C6B45"/><name val="Arial"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B1430"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F4FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D6"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6DEEB"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF0B1430"/></top><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
  <xf numFmtId="165" fontId="3" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  <xf numFmtId="165" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
  <xf numFmtId="9" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="1"><dxf><font><b/><color rgb="FFB42318"/></font><fill><patternFill><bgColor rgb="FFFEE2E2"/></patternFill></fill></dxf></dxfs>
  </styleSheet>`;
  }
  const head = (o, rows, cols, extra, tab, selected) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><tabColor rgb="${tab}"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0"${o.rtl ? ' rightToLeft="1"' : ""}${selected ? ' tabSelected="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${rows}</sheetData>
  ${extra}
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  </worksheet>`;
  const colsXml = (widths, styles) => widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${styles[i] ? ` style="${styles[i]}"` : ""}/>`).join("");
  const vatF = (amountCell, sum) => `IF(${amountCell}="","",ROUND(${amountCell}-${amountCell}/(1+${q(sum)}!$B$4),2))`;
  const netF = (amountCell, vatCell) => `IF(${amountCell}="","",${amountCell}-${vatCell})`;
  /** Column letters per sheet: income has VAT and net only when VAT is on. */
  function layout(vat) {
      return vat
          ? { income: ["date", "who", "what", "doc", "amount", "method", "vat", "net", "notes"], expenses: ["date", "who", "category", "what", "amount", "receipt", "vat", "net", "notes"] }
          : { income: ["date", "who", "what", "doc", "amount", "method", "notes"], expenses: ["date", "who", "category", "what", "amount", "receipt", "notes"] };
  }
  const letter = (keys, k) => col(keys.indexOf(k) + 1);
  function incomeXml(o) {
      const keys = layout(o.vat).income, S = o.sheetNames[2];
      const H = (k) => o.income.headers[["date", "who", "what", "doc", "amount", "method", "vat", "net", "notes"].indexOf(k)];
      const widths = { date: 12, who: 22, what: 30, doc: 13, amount: 13, method: 15, vat: 11, net: 13, notes: 28 };
      const styleOf = {};
      keys.forEach((k, i) => { if (k === "date")
          styleOf[i] = 2; if (["amount", "vat", "net"].includes(k))
          styleOf[i] = 3; });
      const A = letter(keys, "amount"), V = letter(keys, "vat"), N = letter(keys, "net");
      let rows = `<row r="1" ht="24" customHeight="1">${keys.map((k, i) => istr(`${col(i + 1)}1`, H(k), 1)).join("")}</row>`;
      const methods = listItems(o.income.methods);
      const n = Math.max(o.vat ? FROWS : 0, o.examples.income.length + 1);
      for (let r = 2; r <= n; r++) {
          const e = o.examples.income[r - 2];
          const cells = [];
          if (e) {
              cells.push(num(`A${r}`, serial(`${o.year}-${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`), 2), istr(`B${r}`, e.who), istr(`C${r}`, e.what), istr(`D${r}`, e.doc), num(`${A}${r}`, e.amount, 3), istr(`F${r}`, methods[e.kind] || ""));
          }
          if (o.vat && r <= FROWS)
              cells.push(fml(`${V}${r}`, vatF(`${A}${r}`, S), 3), fml(`${N}${r}`, netF(`${A}${r}`, `${V}${r}`), 3));
          if (cells.length)
              rows += `<row r="${r}">${cells.join("")}</row>`;
      }
      const M = letter(keys, "method");
      const dv = `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${M}2:${M}${ROWS}"><formula1>${x(fq(methods.join(",")))}</formula1></dataValidation></dataValidations>`;
      return head(o, rows, colsXml(keys.map((k) => widths[k]), styleOf), `<autoFilter ref="A1:${col(keys.length)}1"/>\n${dv}`, "FF0C6B45", true);
  }
  function expensesXml(o) {
      const keys = layout(o.vat).expenses, S = o.sheetNames[2];
      const H = (k) => o.expenses.headers[["date", "who", "category", "what", "amount", "receipt", "vat", "net", "notes"].indexOf(k)];
      const widths = { date: 12, who: 22, category: 22, what: 28, amount: 13, receipt: 12, vat: 11, net: 13, notes: 26 };
      const styleOf = {};
      keys.forEach((k, i) => { if (k === "date")
          styleOf[i] = 2; if (["amount", "vat", "net"].includes(k))
          styleOf[i] = 3; });
      const A = letter(keys, "amount"), V = letter(keys, "vat"), N = letter(keys, "net"), C = letter(keys, "category"), R = letter(keys, "receipt");
      const cats = listItems(o.expenses.categories);
      let rows = `<row r="1" ht="24" customHeight="1">${keys.map((k, i) => istr(`${col(i + 1)}1`, H(k), 1)).join("")}</row>`;
      const n = Math.max(o.vat ? FROWS : 0, o.examples.expenses.length + 1);
      for (let r = 2; r <= n; r++) {
          const e = o.examples.expenses[r - 2];
          const cells = [];
          if (e) {
              cells.push(num(`A${r}`, serial(`${o.year}-${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`), 2), istr(`B${r}`, e.who), istr(`${C}${r}`, cats[e.kind] || ""), istr(`D${r}`, e.what), num(`${A}${r}`, e.amount, 3), istr(`${R}${r}`, e.receipt === false ? o.expenses.no : o.expenses.yes));
          }
          if (o.vat && r <= FROWS)
              cells.push(fml(`${V}${r}`, vatF(`${A}${r}`, S), 3), fml(`${N}${r}`, netF(`${A}${r}`, `${V}${r}`), 3));
          if (cells.length)
              rows += `<row r="${r}">${cells.join("")}</row>`;
      }
      const dv = `<dataValidations count="2">` +
          `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${C}2:${C}${ROWS}"><formula1>${x(fq(cats.join(",")))}</formula1></dataValidation>` +
          `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${R}2:${R}${ROWS}"><formula1>${x(fq([o.expenses.yes, o.expenses.no].join(",")))}</formula1></dataValidation></dataValidations>`;
      const cf = `<conditionalFormatting sqref="${R}2:${R}${ROWS}"><cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>${x(fq(o.expenses.no))}</formula></cfRule></conditionalFormatting>`;
      return head(o, rows, colsXml(keys.map((k) => widths[k]), styleOf), `<autoFilter ref="A1:${col(keys.length)}1"/>\n${cf}\n${dv}`, "FFB42318", false);
  }
  function summaryXml(o) {
      const [I, E] = o.sheetNames, Sm = o.summary, li = layout(o.vat).income, le = layout(o.vat).expenses;
      const rng = (sheet, c) => `${q(sheet)}!$${c}$2:$${c}$${ROWS}`;
      const iA = rng(I, "A"), iAmt = rng(I, letter(li, "amount")), eA = rng(E, "A"), eAmt = rng(E, letter(le, "amount"));
      const iV = o.vat ? rng(I, letter(li, "vat")) : "", eV = o.vat ? rng(E, letter(le, "vat")) : "", eC = rng(E, letter(le, "category"));
      // SUMIFS ignores the empty "" cells the VAT formulas leave, and DATE($B$3,13,1) rolls over to January next year.
      const sp = (dates, vals, m) => `SUMIFS(${vals},${dates},">="&DATE($B$3,${m},1),${dates},"<"&DATE($B$3,${m + 1},1))`;
      const rows = [];
      rows.push(`<row r="1" ht="28" customHeight="1">${istr("A1", [o.business.trim(), Sm.title].filter(Boolean).join(": "), 4)}</row>`);
      rows.push(`<row r="3">${istr("A3", Sm.year, 5)}${num("B3", o.year, 10)}</row>`);
      if (o.vat)
          rows.push(`<row r="4">${istr("A4", Sm.rate, 5)}<c r="B4" s="13"><v>${o.rate / 100}</v></c></row>`);
      const heads = [Sm.month, Sm.income, Sm.expenses, Sm.profit, ...(o.vat ? [Sm.vatIn, Sm.vatOut, Sm.vatDue] : [])];
      const top = 6;
      rows.push(`<row r="${top}" ht="22" customHeight="1">${heads.map((h, i) => istr(`${col(i + 1)}${top}`, h, 1)).join("")}</row>`);
      for (let m = 1; m <= 12; m++) {
          const r = top + m;
          const cells = [istr(`A${r}`, o.months[m - 1], 7), fml(`B${r}`, sp(iA, iAmt, m), 6), fml(`C${r}`, sp(eA, eAmt, m), 6), fml(`D${r}`, `B${r}-C${r}`, 11)];
          if (o.vat)
              cells.push(fml(`E${r}`, sp(iA, iV, m), 6), fml(`F${r}`, sp(eA, eV, m), 6), fml(`G${r}`, `E${r}-F${r}`, 11));
          rows.push(`<row r="${r}">${cells.join("")}</row>`);
      }
      const tr = top + 13;
      rows.push(`<row r="${tr}">${istr(`A${tr}`, Sm.total, 12)}${heads.slice(1).map((_, i) => fml(`${col(i + 2)}${tr}`, `SUM(${col(i + 2)}${top + 1}:${col(i + 2)}${top + 12})`, 8)).join("")}</row>`);
      let r = tr + 2;
      rows.push(`<row r="${r}">${istr(`A${r}`, Sm.byCategory, 1)}${istr(`B${r}`, "", 1)}</row>`);
      for (const c of listItems(o.expenses.categories)) {
          r++;
          rows.push(`<row r="${r}">${istr(`A${r}`, c, 5)}${fml(`B${r}`, `SUMIFS(${eAmt},${eC},${fq(c)},${eA},">="&DATE($B$3,1,1),${eA},"<"&DATE($B$3+1,1,1))`, 6)}</row>`);
      }
      r += 2;
      rows.push(`<row r="${r}">${istr(`A${r}`, Sm.note, 9)}</row>`);
      const widths = [26, 15, 15, 15, 15, 15, 15];
      const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><tabColor rgb="FF0B1430"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0"${o.rtl ? ' rightToLeft="1"' : ""}/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${cols}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="1"><mergeCell ref="A${r}:${col(heads.length)}${r}"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  </worksheet>`;
  }
  function bookFiles(o) {
      const [I, E, S] = o.sheetNames;
      const ws = (n) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      const rel = (n) => `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`;
      const li = layout(o.vat);
      return [
          { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${ws(1)}${ws(2)}${ws(3)}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
          { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
          { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${x(I)}" sheetId="1" r:id="rId1"/><sheet name="${x(E)}" sheetId="2" r:id="rId2"/><sheet name="${x(S)}" sheetId="3" r:id="rId3"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${x(`${q(I)}!$A$1:$${col(li.income.length)}$1`)}</definedName><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">${x(`${q(E)}!$A$1:$${col(li.expenses.length)}$1`)}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
          { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel(1)}${rel(2)}${rel(3)}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
          { name: "xl/styles.xml", text: styles(o.currencyFormat) },
          { name: "xl/worksheets/sheet1.xml", text: incomeXml(o) },
          { name: "xl/worksheets/sheet2.xml", text: expensesXml(o) },
          { name: "xl/worksheets/sheet3.xml", text: summaryXml(o) },
      ];
  }
  function book(o) {
      return makeZip(bookFiles(o).map((f) => ({ name: f.name, data: utf8(f.text) })));
  }
  /** What the Summary sheet will show for the examples, for the live preview. Money in whole units, rounded to pennies. */
  function totals(o) {
      const r2 = (n) => Math.round(n * 100) / 100;
      const vatOf = (a) => (o.vat ? r2(a - a / (1 + o.rate / 100)) : 0);
      const months = (list) => Array.from({ length: 12 }, (_, i) => r2(list.filter((e) => e.m === i + 1).reduce((s, e) => s + e.amount, 0)));
      const cats = listItems(o.expenses.categories);
      return {
          income: months(o.examples.income),
          expenses: months(o.examples.expenses),
          vatIn: r2(o.examples.income.reduce((s, e) => s + vatOf(e.amount), 0)),
          vatOut: r2(o.examples.expenses.reduce((s, e) => s + vatOf(e.amount), 0)),
          byCategory: cats.map((_, i) => r2(o.examples.expenses.filter((e) => e.kind === i).reduce((s, e) => s + e.amount, 0))),
      };
  }

  const API = { layout, incomeXml, expensesXml, summaryXml, bookFiles, book, totals };
  root.Bookkeeping = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("bk-app");
  const dataEl = document.getElementById("bk-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui, BASE = DATA.book;

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const button = (cls, txt) => { const b = el("button", cls, txt); b.type = "button"; return b; };
  let uid = 0;
  function wrapField(label, control, hint) {
    const w = el("div", "ft-field gp-field");
    const lab = el("label", null, label);
    control.id = control.id || "bk-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const area = (value, max) => { const t = el("textarea"); t.rows = 5; t.dir = "auto"; t.maxLength = max; t.value = value; return t; };

  // Form.
  const thisYear = new Date().getFullYear();
  const business = el("input"); business.type = "text"; business.dir = "auto"; business.placeholder = UI.business.placeholder; business.maxLength = UI.business.max;
  const year = el("select");
  [thisYear - 1, thisYear, thisYear + 1].forEach((y) => { const o = el("option", null, String(y)); o.value = String(y); year.append(o); });
  year.value = String(thisYear);
  const rate = el("input"); rate.type = "number"; rate.min = "0"; rate.max = "50"; rate.step = "0.5"; rate.dir = "ltr"; rate.value = String(UI.rate.value);
  const currency = el("select");
  UI.currency.options.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; currency.append(o); });
  const row = el("div", "bk-row"); row.append(wrapField(UI.year.label, year), wrapField(UI.rate.label, rate), wrapField(UI.currency.label, currency));
  const vatLab = el("label", "ct-opt"); const vat = el("input"); vat.type = "checkbox"; vatLab.append(vat, document.createTextNode(UI.vat));
  const cats = area(BASE.expenses.categories.join("\n"), UI.categories.max);
  const methods = area(BASE.income.methods.join("\n"), UI.methods.max);
  const exLab = el("label", "ct-opt"); const exCb = el("input"); exCb.type = "checkbox"; exCb.checked = true; exLab.append(exCb, document.createTextNode(UI.examples));
  const resetBtn = button("try-btn gp-ghost", UI.reset);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(resetBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.business.label, business), vatLab, row, wrapField(UI.categories.label, cats, UI.categories.hint), wrapField(UI.methods.label, methods, UI.methods.hint), exLab);

  // Preview: a workbook with three tabs.
  const bar = el("div", "ct-bar"); const ico = el("span", null, "▦"); ico.setAttribute("aria-hidden", "true"); bar.append(ico, el("span", null, UI.fileName));
  const panes = UI.tabs.map((t, i) => { const p = el("div", i === 2 ? "ct-sum" : "ct-scroll"); p.hidden = i !== 0; if (i < 2) { p.tabIndex = 0; p.setAttribute("role", "region"); p.setAttribute("aria-label", t); } return p; });
  const tabs = el("div", "ct-tabs"); tabs.setAttribute("role", "tablist");
  let current = 0;
  const tabBtns = UI.tabs.map((t, i) => { const b = button("try-btn ct-tab", t); b.setAttribute("role", "tab"); b.addEventListener("click", () => { current = i; render(true); }); tabs.append(b); return b; });
  const wb = el("div", "ct-book"); wb.append(bar, ...panes, tabs);
  const dl = button("try-btn try-btn-primary", UI.download);
  const acts = el("div", "ct-acts"); acts.append(dl);
  const card = el("section", "gp-card"); card.append(el("h2", "gp-h", UI.previewTitle), wb, acts, el("p", "ct-works", UI.works));
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const lines = (t) => t.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  function options() {
    const c = lines(cats), m = lines(methods);
    return {
      ...BASE, business: business.value, year: Number(year.value), vat: vat.checked, rate: Number(rate.value) || 0, currencyFormat: currency.value,
      income: { ...BASE.income, methods: m.length ? m : BASE.income.methods },
      expenses: { ...BASE.expenses, categories: c.length ? c : BASE.expenses.categories },
      examples: exCb.checked ? BASE.examples : { income: [], expenses: [] },
    };
  }
  const sym = () => (currency.selectedOptions[0] || {}).textContent || UI.money;
  const money = (n) => { const v = n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); return sym() === "₪" ? v + " ₪" : sym() + v; };
  const dateText = (o, e) => String(e.d).padStart(2, "0") + "/" + String(e.m).padStart(2, "0") + "/" + o.year;
  const vatOf = (o, a) => Math.round((a - a / (1 + o.rate / 100)) * 100) / 100;
  function table(o, which) {
    const keys = API.layout(o.vat)[which];
    const H = which === "income" ? o.income.headers : o.expenses.headers;
    const all = which === "income" ? ["date", "who", "what", "doc", "amount", "method", "vat", "net", "notes"] : ["date", "who", "category", "what", "amount", "receipt", "vat", "net", "notes"];
    const show = keys.filter((k) => k !== "notes" && k !== "doc");
    const t = el("table", "ct-table"); t.setAttribute("aria-label", UI.tableLabel);
    const hr = el("tr"); hr.append(el("th", "ct-n", "")); show.forEach((k) => hr.append(el("th", null, H[all.indexOf(k)])));
    const th = el("thead"); th.append(hr);
    const tb = el("tbody");
    o.examples[which].forEach((e, i) => {
      const tr = el("tr"); tr.append(el("td", "ct-n", String(i + 2)));
      const v = vatOf(o, e.amount);
      const cell = { date: dateText(o, e), who: e.who, what: e.what, amount: money(e.amount), method: o.income.methods[e.kind] || "", category: o.expenses.categories[e.kind] || "", receipt: e.receipt === false ? o.expenses.no : o.expenses.yes, vat: money(v), net: money(Math.round((e.amount - v) * 100) / 100) };
      show.forEach((k) => tr.append(el("td", k === "receipt" && e.receipt === false ? "bk-no" : null, cell[k])));
      tb.append(tr);
    });
    const more = el("tr", "ct-more"); const mt = el("td", null, UI.more); mt.colSpan = show.length + 1; more.append(mt); tb.append(more);
    t.append(th, tb);
    return t;
  }
  function summary(o, animate) {
    const s = API.totals(o);
    const inc = s.income.reduce((a, b) => a + b, 0), exp = s.expenses.reduce((a, b) => a + b, 0);
    const p = panes[2]; p.textContent = "";
    const cards = el("div", "ct-cards");
    const c = (v, l, warn) => { const d = el("div", "ct-card" + (warn ? " warn" : "")); d.append(el("b", null, v), el("span", null, l)); cards.append(d); };
    c(money(inc), UI.cards.income); c(money(exp), UI.cards.expenses); c(money(inc - exp), UI.cards.profit, inc - exp < 0);
    if (o.vat) c(money(Math.round((s.vatIn - s.vatOut) * 100) / 100), UI.cards.vatDue);
    p.append(cards);
    const box = el("div", "ct-bars"); box.append(el("h4", null, UI.chartTitle));
    const chart = el("div", "bk-chart"); chart.setAttribute("aria-hidden", "true");
    const max = Math.max(1, ...s.income, ...s.expenses);
    const bars = [];
    for (let m = 0; m < 12; m++) {
      const col = el("div", "bk-m"); const a = el("i", "in"), b = el("i", "out"); col.append(a, b); chart.append(col);
      bars.push([a, (s.income[m] / max) * 100], [b, (s.expenses[m] / max) * 100]);
    }
    const ml = el("div", "bk-ml"); ml.setAttribute("aria-hidden", "true");
    o.months.forEach((m) => ml.append(el("span", null, m.slice(0, 3))));
    const legend = el("div", "bk-legend"); legend.append(el("span", null, UI.legendIn), el("span", null, UI.legendOut));
    box.append(chart, ml, legend);
    p.append(box);
    const cb = el("div", "ct-bars"); cb.append(el("h4", null, o.summary.byCategory));
    const cmax = Math.max(1, ...s.byCategory);
    o.expenses.categories.forEach((name, i) => {
      if (!s.byCategory[i]) return;
      const r = el("div", "ct-barrow"); const tr = el("div", "ct-track"); const f = el("div", "ct-fill"); f.style.background = "#f0a43a"; tr.append(f);
      r.append(el("span", null, name), tr, el("span", null, money(s.byCategory[i])));
      r.style.gridTemplateColumns = "9rem minmax(0, 1fr) auto";
      cb.append(r);
      bars.push([f, (s.byCategory[i] / cmax) * 100, true]);
    });
    p.append(cb);
    const apply = () => bars.forEach(([n, v, w]) => { if (w) n.style.width = v + "%"; else n.style.height = v + "%"; });
    if (animate) requestAnimationFrame(() => requestAnimationFrame(apply)); else apply();
  }
  function render(animate) {
    const o = options();
    rate.disabled = !vat.checked;
    panes.forEach((p, i) => { p.hidden = i !== current; });
    tabBtns.forEach((b, i) => b.setAttribute("aria-selected", i === current ? "true" : "false"));
    panes[0].textContent = ""; panes[0].append(table(o, "income"));
    panes[1].textContent = ""; panes[1].append(table(o, "expenses"));
    if (current === 2) summary(o, animate === true);
  }
  form.addEventListener("input", () => render(false));
  form.addEventListener("change", () => render(false));
  dl.addEventListener("click", () => {
    const data = API.book(options());
    const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = el("a"); a.href = url; a.download = UI.fileName; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  resetBtn.addEventListener("click", () => {
    business.value = ""; year.value = String(thisYear); vat.checked = false; rate.value = String(UI.rate.value); currency.selectedIndex = 0;
    cats.value = BASE.expenses.categories.join("\n"); methods.value = BASE.income.methods.join("\n"); exCb.checked = true;
    render(false); business.focus();
  });
  render(false);
})(typeof globalThis !== "undefined" ? globalThis : this);
