// /en/customer-tracker-template/ and /he/customer-tracker/ client logic. Progressive enhancement: without JS the page
// explains the template. The .xlsx file is written in the browser. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/tracker.ts with the types removed (made with the TypeScript
// compiler). tests/customer-tracker-template.test.ts checks both copies give identical results.
// PART 2 reads its texts and the template (English or Hebrew) from <script id="ct-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to tracker.ts) ----------
  let CRC_TABLE = null;
  function crc32(data) {
      if (!CRC_TABLE) {
          CRC_TABLE = [];
          for (let n = 0; n < 256; n++) {
              let c = n;
              for (let k = 0; k < 8; k++)
                  c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
              CRC_TABLE.push(c >>> 0);
          }
      }
      let crc = 0xffffffff;
      for (let i = 0; i < data.length; i++)
          crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
      return (crc ^ 0xffffffff) >>> 0;
  }
  function bytes(parts) {
      const len = parts.reduce((a, p) => a + p.length, 0);
      const out = new Uint8Array(len);
      let o = 0;
      for (const p of parts) {
          out.set(p, o);
          o += p.length;
      }
      return out;
  }
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  /** UTF-8 bytes of a string. */
  function utf8(s) {
      const out = [];
      for (const ch of Array.from(s)) {
          const c = ch.codePointAt(0);
          if (c < 0x80)
              out.push(c);
          else if (c < 0x800)
              out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
          else if (c < 0x10000)
              out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
          else
              out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
      return new Uint8Array(out);
  }
  /** A ZIP file with the files stored as they are. Names must be plain ASCII. */
  function makeZip(files) {
      const local = [];
      const central = [];
      let offset = 0;
      const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;
      for (const f of files) {
          const name = Array.from(f.name).map((c) => c.charCodeAt(0) & 0x7f);
          const crc = crc32(f.data);
          const head = bytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), name]);
          local.push(head, f.data);
          central.push(bytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
          offset += head.length + f.data.length;
      }
      const cd = bytes(central);
      return bytes([...local, cd, bytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])]);
  }
  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** Column letter for a 1-based column number: 1 -> A, 27 -> AA. */
  function col(n) {
      let s = "";
      for (; n > 0; n = Math.floor((n - 1) / 26))
          s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      return s;
  }
  /** Excel's date number for YYYY-MM-DD (days since 30 December 1899). */
  function serial(date) {
      const [y, m, d] = date.split("-").map(Number);
      return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  /** Names safe for a drop-down list: no commas or quotes, trimmed, unique, not empty. */
  function listItems(items) {
      const out = [];
      for (const it of items) {
          const v = String(it || "").replace(/[,"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
          if (v && !out.includes(v))
              out.push(v);
      }
      return out;
  }
  const ROWS = 1000;
  const ref = (sheet, range) => `'${sheet.replace(/'/g, "''")}'!${range}`;
  const fq = (s) => '"' + s.replace(/"/g, '""') + '"';
  const istr = (r, s, style = 0) => `<c r="${r}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${x(s)}</t></is></c>`;
  const num = (r, n, style = 0) => `<c r="${r}"${style ? ` s="${style}"` : ""}><v>${n}</v></c>`;
  const fml = (r, f, style = 0) => `<c r="${r}"${style ? ` s="${style}"` : ""}><f>${x(f)}</f></c>`;
  function stylesXml(currencyFormat) {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="${x(currencyFormat)}"/></numFmts>
  <fonts count="5"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF0B1430"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF55627A"/><name val="Arial"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B1430"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F4FA"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6DEEB"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  <xf numFmtId="9" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
  <xf numFmtId="165" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="4"><dxf><font><b/><color rgb="FF0C6B45"/></font><fill><patternFill><bgColor rgb="FFD7F5E3"/></patternFill></fill></dxf><dxf><font><color rgb="FF4B5563"/></font><fill><patternFill><bgColor rgb="FFE5E7EB"/></patternFill></fill></dxf><dxf><font><b/><color rgb="FF1E40AF"/></font><fill><patternFill><bgColor rgb="FFDBEAFE"/></patternFill></fill></dxf><dxf><font><b/><color rgb="FFB42318"/></font><fill><patternFill><bgColor rgb="FFFEE2E2"/></patternFill></fill></dxf></dxfs>
  </styleSheet>`;
  }
  /** The Enquiries sheet. */
  function enquiriesXml(o) {
      const st = listItems(o.statuses), src = listItems(o.sources);
      const widths = [12, 20, 15, 24, 14, 30, 14, 15, 11, 34];
      const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${i === 0 || i === 7 ? ' style="2"' : i === 8 ? ' style="3"' : ""}/>`).join("");
      const head = `<row r="1" ht="24" customHeight="1">${o.headers.map((h, i) => istr(`${col(i + 1)}1`, h, 1)).join("")}</row>`;
      const t = serial(o.today);
      const rows = o.examples.map((e, i) => {
          const r = i + 2;
          return `<row r="${r}">${[
              num(`A${r}`, t - e.daysAgo, 2), istr(`B${r}`, e.name), istr(`C${r}`, e.phone), istr(`D${r}`, e.email), istr(`E${r}`, src[e.source] || ""), istr(`F${r}`, e.wants),
              istr(`G${r}`, st[e.status] || ""), e.followUpIn == null ? "" : num(`H${r}`, t + e.followUpIn, 2), e.value ? num(`I${r}`, e.value, 3) : "", istr(`J${r}`, e.notes),
          ].join("")}</row>`;
      }).join("");
      const range = `2:${ROWS}`;
      const [sNew, , , sWon, sLost] = st;
      const cf = `<conditionalFormatting sqref="G${range.replace(":", ":G")}">` +
          `<cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>${x(fq(sWon))}</formula></cfRule>` +
          `<cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>${x(fq(sLost))}</formula></cfRule>` +
          `<cfRule type="cellIs" dxfId="2" priority="3" operator="equal"><formula>${x(fq(sNew))}</formula></cfRule></conditionalFormatting>` +
          `<conditionalFormatting sqref="H2:H${ROWS}"><cfRule type="expression" dxfId="3" priority="4"><formula>${x(`AND(H2<>"",H2<=TODAY(),$G2<>${fq(sWon)},$G2<>${fq(sLost)})`)}</formula></cfRule></conditionalFormatting>`;
      const dv = `<dataValidations count="2">` +
          `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="G2:G${ROWS}"><formula1>${x(fq(st.join(",")))}</formula1></dataValidation>` +
          `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="E2:E${ROWS}"><formula1>${x(fq(src.join(",")))}</formula1></dataValidation></dataValidations>`;
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><tabColor rgb="FF0C6B45"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0"${o.rtl ? ' rightToLeft="1"' : ""} tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${head}${rows}</sheetData>
  <autoFilter ref="A1:J1"/>
  ${cf}
  ${dv}
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  </worksheet>`;
  }
  /** The Summary sheet: everything is a formula over the Enquiries sheet. */
  function summaryXml(o) {
      const st = listItems(o.statuses), src = listItems(o.sources), E = o.sheetNames[0], S = o.summary;
      const R = (c) => ref(E, `$${c}$2:$${c}$${ROWS}`);
      const rows = [];
      let r = 1;
      rows.push(`<row r="${r}" ht="28" customHeight="1">${istr(`A${r}`, [o.business.trim(), S.title].filter(Boolean).join(": "), 4)}</row>`);
      r = 3;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.total, 5)}${fml(`B${r}`, `COUNTA(${R("B")})`, 7)}</row>`);
      const totalRow = r;
      r++;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.open, 5)}${fml(`B${r}`, `COUNTA(${R("B")})-COUNTIF(${R("G")},${fq(st[3])})-COUNTIF(${R("G")},${fq(st[4])})`, 7)}</row>`);
      r++;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.due, 5)}${fml(`B${r}`, `COUNTIFS(${R("H")},"<="&TODAY(),${R("G")},"<>"&${fq(st[3])},${R("G")},"<>"&${fq(st[4])})`, 7)}</row>`);
      r++;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.winRate, 5)}${fml(`B${r}`, `IF(B${totalRow}=0,0,COUNTIF(${R("G")},${fq(st[3])})/B${totalRow})`, 6)}</row>`);
      r++;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.valueWon, 5)}${fml(`B${r}`, `SUMIF(${R("G")},${fq(st[3])},${R("I")})`, 8)}</row>`);
      r += 2;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.byStatus, 1)}${istr(`B${r}`, "", 1)}</row>`);
      for (const s of st) {
          r++;
          rows.push(`<row r="${r}">${istr(`A${r}`, s, 5)}${fml(`B${r}`, `COUNTIF(${R("G")},${fq(s)})`, 7)}</row>`);
      }
      r += 2;
      rows.push(`<row r="${r}">${istr(`A${r}`, S.bySource, 1)}${istr(`B${r}`, "", 1)}</row>`);
      for (const s of src) {
          r++;
          rows.push(`<row r="${r}">${istr(`A${r}`, s, 5)}${fml(`B${r}`, `COUNTIF(${R("E")},${fq(s)})`, 7)}</row>`);
      }
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><tabColor rgb="FF0B1430"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0"${o.rtl ? ' rightToLeft="1"' : ""}/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/></cols>
  <sheetData>${rows.join("")}</sheetData>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  </worksheet>`;
  }
  /** Every file inside the .xlsx, by name. */
  function xlsxFiles(o) {
      const [E, S] = o.sheetNames;
      return [
          { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
          { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
          { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${x(E)}" sheetId="1" r:id="rId1"/><sheet name="${x(S)}" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${x(ref(E, "$A$1:$J$1"))}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
          { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
          { name: "xl/styles.xml", text: stylesXml(o.currencyFormat) },
          { name: "xl/worksheets/sheet1.xml", text: enquiriesXml(o) },
          { name: "xl/worksheets/sheet2.xml", text: summaryXml(o) },
      ];
  }
  function xlsx(o) {
      return makeZip(xlsxFiles(o).map((f) => ({ name: f.name, data: utf8(f.text) })));
  }
  /** The same counts the Summary sheet shows, for the live preview. */
  function summarize(o) {
      const ex = o.examples;
      const won = ex.filter((e) => e.status === 3);
      const closed = (e) => e.status === 3 || e.status === 4;
      return {
          total: ex.length,
          open: ex.filter((e) => !closed(e)).length,
          due: ex.filter((e) => e.followUpIn != null && e.followUpIn <= 0 && !closed(e)).length,
          winRate: ex.length ? won.length / ex.length : 0,
          valueWon: won.reduce((s, e) => s + e.value, 0),
          byStatus: o.statuses.map((_, i) => ex.filter((e) => e.status === i).length),
          bySource: o.sources.map((_, i) => ex.filter((e) => e.source === i).length),
      };
  }

  const API = { crc32, utf8, makeZip, col, serial, listItems, enquiriesXml, summaryXml, xlsxFiles, xlsx, summarize };
  root.Tracker = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ct-app");
  const dataEl = document.getElementById("ct-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui, BASE = DATA.tracker;

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
    control.id = control.id || "ct-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const localDate = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const dayText = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); };

  // Form.
  const business = el("input"); business.type = "text"; business.dir = "auto"; business.placeholder = UI.business.placeholder; business.maxLength = UI.business.max;
  const stBox = el("div", "ct-statuses");
  const stIns = BASE.statuses.map((s, i) => { const c = el("input"); c.type = "text"; c.dir = "auto"; c.maxLength = 30; c.value = s; stBox.append(wrapField(UI.roles[i], c)); return c; });
  const sources = el("textarea"); sources.rows = 5; sources.dir = "auto"; sources.maxLength = UI.sources.max; sources.value = BASE.sources.join("\n");
  const currency = el("select");
  UI.currency.options.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; currency.append(o); });
  const exLab = el("label", "ct-opt");
  const exCb = el("input"); exCb.type = "checkbox"; exCb.checked = true;
  exLab.append(exCb, document.createTextNode(UI.examples));
  const resetBtn = button("try-btn gp-ghost", UI.reset);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(resetBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const stH = el("h3", "gp-h", UI.statusesTitle); stH.style.marginTop = "0.6rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.business.label, business), stH, el("p", "gp-hint", UI.statusesHint), stBox, wrapField(UI.sources.label, sources, UI.sources.hint), wrapField(UI.currency.label, currency), exLab);

  // Preview: a little workbook with two tabs.
  const bar = el("div", "ct-bar"); bar.append(el("span", null, "▦"), el("span", null, UI.fileName));
  bar.firstChild.setAttribute("aria-hidden", "true");
  const table = el("table", "ct-table");
  table.setAttribute("aria-label", UI.tableLabel);
  const scroll = el("div", "ct-scroll"); scroll.append(table);
  scroll.tabIndex = 0; scroll.setAttribute("role", "region"); scroll.setAttribute("aria-label", UI.tabs[0]);
  const sum = el("div", "ct-sum"); sum.hidden = true;
  const tabs = el("div", "ct-tabs"); tabs.setAttribute("role", "tablist");
  const tabBtns = UI.tabs.map((t, i) => { const b = button("try-btn ct-tab", t); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", i ? "false" : "true"); b.addEventListener("click", () => show(i)); tabs.append(b); return b; });
  const book = el("div", "ct-book"); book.append(bar, scroll, sum, tabs);
  const dl = button("try-btn try-btn-primary", UI.download);
  const acts = el("div", "ct-acts"); acts.append(dl);
  const card = el("section", "gp-card"); card.append(el("h2", "gp-h", UI.previewTitle), book, acts, el("p", "ct-works", UI.works));
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  function show(i) {
    scroll.hidden = i !== 0; sum.hidden = i !== 1;
    tabBtns.forEach((b, k) => b.setAttribute("aria-selected", k === i ? "true" : "false"));
    if (i === 1) drawSummary(true);
  }
  function options() {
    const statuses = stIns.map((c, i) => c.value.trim() || BASE.statuses[i]);
    const src = API.listItems(sources.value.split(/\r?\n/));
    return { ...BASE, business: business.value, statuses, sources: src.length ? src : BASE.sources, currencyFormat: currency.value, examples: exCb.checked ? BASE.examples : [], today: localDate(new Date()) };
  }
  const money = (n) => { const sym = (currency.selectedOptions[0] || {}).textContent || UI.money; const v = n.toLocaleString(); return sym === "₪" ? v + " ₪" : sym + v; };
  const SHOW = [0, 1, 4, 5, 6, 7, 8];
  function drawTable() {
    const o = options();
    table.textContent = "";
    const thead = el("thead"), hr = el("tr");
    hr.append(el("th", "ct-n", ""));
    // The preview shows the columns that matter most; the file has all ten.
    SHOW.forEach((k) => hr.append(el("th", null, o.headers[k])));
    thead.append(hr);
    const tb = el("tbody");
    o.examples.forEach((e, i) => {
      const tr = el("tr");
      tr.append(el("td", "ct-n", String(i + 2)));
      const pill = el("span", "ct-pill", o.statuses[e.status] || ""); pill.dataset.s = String(e.status);
      const st = el("td"); st.append(pill);
      const closed = e.status === 3 || e.status === 4;
      const fu = el("td", e.followUpIn != null && e.followUpIn <= 0 && !closed ? "ct-due" : null, e.followUpIn == null ? "" : dayText(e.followUpIn));
      const cells = [el("td", null, dayText(-e.daysAgo)), el("td", null, e.name), el("td", null, e.phone), el("td", null, e.email), el("td", null, o.sources[e.source] || ""), el("td", null, e.wants), st, fu, el("td", null, e.value ? money(e.value) : ""), el("td", null, e.notes)];
      SHOW.forEach((k) => tr.append(cells[k]));
      tb.append(tr);
    });
    const more = el("tr", "ct-more"); const mt = el("td", null, UI.more); mt.colSpan = SHOW.length + 1; more.append(mt); tb.append(more);
    table.append(thead, tb);
  }
  function drawSummary(animate) {
    const o = options();
    const s = API.summarize(o);
    sum.textContent = "";
    const cards = el("div", "ct-cards");
    const c = (v, l, warn) => { const d = el("div", "ct-card" + (warn ? " warn" : "")); d.append(el("b", null, v), el("span", null, l)); cards.append(d); };
    c(String(s.open), UI.cards.open); c(String(s.due), UI.cards.due, s.due > 0); c(Math.round(s.winRate * 100) + "%", UI.cards.winRate); c(money(s.valueWon), UI.cards.valueWon);
    sum.append(cards);
    const bars = (title, labels, vals) => {
      const box = el("div", "ct-bars"); box.append(el("h4", null, title));
      const max = Math.max(1, ...vals);
      labels.forEach((l, i) => {
        const row = el("div", "ct-barrow"); const tr = el("div", "ct-track"); const f = el("div", "ct-fill"); tr.append(f);
        row.append(el("span", null, l), tr, el("span", null, String(vals[i])));
        box.append(row);
        const w = (vals[i] / max) * 100 + "%";
        if (animate) requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = w; })); else f.style.width = w;
      });
      sum.append(box);
    };
    bars(o.summary.byStatus, o.statuses, s.byStatus);
    bars(o.summary.bySource, o.sources, s.bySource);
  }
  function render() { drawTable(); if (!sum.hidden) drawSummary(false); }
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  dl.addEventListener("click", () => {
    const data = API.xlsx(options());
    const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = el("a"); a.href = url; a.download = UI.fileName; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  resetBtn.addEventListener("click", () => {
    business.value = ""; stIns.forEach((c, i) => { c.value = BASE.statuses[i]; }); sources.value = BASE.sources.join("\n"); currency.selectedIndex = 0; exCb.checked = true;
    render(); business.focus();
  });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
