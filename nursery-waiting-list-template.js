// Waiting list template maker for nurseries, childminders, clubs and clinics. Runs in the browser; nothing is sent anywhere.
// Pick the columns and how many blank rows, then print it (landscape PDF) or download a CSV that opens in Excel or
// Google Sheets. Page data: <script type="application/json" id="nw-data"> and <div id="nw-app">. Pure part: csv().
(function (root) {
  "use strict";
  const q = (v) => { const s = String(v == null ? "" : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  /** CSV text: a header row of labels, then the rows (arrays aligned to the columns). A BOM lets Excel read Hebrew. */
  function csv(labels, rows) { return "﻿" + [labels, ...rows].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n"; }
  root.WaitingList = { csv };
  if (typeof document === "undefined") return;
  const app = document.getElementById("nw-app"), dataEl = document.getElementById("nw-data");
  if (!app || !dataEl) return;
  let DATA; try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui, COLS = DATA.columns;
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const button = (c, x) => { const b = el("button", c, x); b.type = "button"; return b; };
  let uid = 0;
  const field = (label, control) => { const w = el("div", "ft-field gp-field"), l = el("label", null, label); control.id = "nw-f" + ++uid; l.htmlFor = control.id; w.append(l, control); return w; };

  const name = el("input"); name.type = "text"; name.dir = "auto"; name.maxLength = 60; name.placeholder = UI.name.placeholder;
  const blanks = el("input"); blanks.type = "number"; blanks.min = "0"; blanks.max = "40"; blanks.value = "12"; blanks.dir = "ltr";
  const sample = el("input"); sample.type = "checkbox"; sample.checked = true;
  const sampleLab = el("label", "nw-check"); sampleLab.append(sample, document.createTextNode(" " + UI.sample));
  const colsBox = el("fieldset", "nw-cols"); colsBox.append(el("legend", null, UI.columns));
  const checks = COLS.map((c) => { const l = el("label", "nw-check"), i = el("input"); i.type = "checkbox"; i.checked = !!c.on; l.append(i, document.createTextNode(" " + c.label)); colsBox.append(l); return i; });
  const form = el("div", "ft-box gp-form");
  form.append(el("h2", "gp-h", UI.formTitle), field(UI.name.label, name), colsBox, field(UI.blanks, blanks), sampleLab);

  const paper = el("div", "rc-paper dm-paper nw-paper"); paper.setAttribute("aria-live", "polite");
  const stage = el("div", "rc-stage"); stage.append(paper);
  const pdf = button("try-btn try-btn-primary rc-btn", UI.pdf), dl = button("try-btn rc-btn", UI.csv);
  const acts = el("div", "rc-acts"); acts.append(pdf, dl);
  const prev = el("section", "gp-card"); prev.append(el("h2", "gp-h", UI.previewTitle), stage, acts, el("p", "gp-hint", UI.hint));
  const side = el("div", "gp-side"); side.append(prev);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const cols = () => COLS.filter((c, i) => checks[i].checked);
  const rowsData = () => {
    const c = cols(), n = Math.max(0, Math.min(40, Number(blanks.value) || 0)), out = [];
    if (sample.checked) DATA.example.forEach((r) => out.push(c.map((x) => r[x.id] || "")));
    for (let i = 0; i < n; i++) out.push(c.map(() => ""));
    return out;
  };
  function render() {
    paper.textContent = "";
    const head = el("div", "rc-head"); const b = el("div"); b.append(el("p", "rc-biz", name.value.trim() || UI.name.example)); head.append(b, el("p", "rc-title", UI.title)); paper.append(head);
    const c = cols();
    if (!c.length) { paper.append(el("p", "rc-note", UI.none)); return; }
    const t = el("table", "rc-table dm-table nw-table"), th = el("thead"), hr = el("tr");
    hr.append(el("th", null, "#")); c.forEach((x) => hr.append(el("th", null, x.label))); th.append(hr);
    const tb = el("tbody"); rowsData().forEach((r, i) => { const tr = el("tr"); tr.append(el("td", null, String(i + 1))); r.forEach((v) => tr.append(el("td", null, v))); tb.append(tr); });
    t.append(th, tb); paper.append(t);
  }
  form.addEventListener("input", render); form.addEventListener("change", render);
  pdf.addEventListener("click", () => {
    render();
    const page = el("style"); page.textContent = "@page { size: A4 landscape; margin: 10mm; }"; document.head.append(page);
    const old = document.title; document.title = UI.file.replace("{n}", name.value.trim()).trim();
    const restore = () => { document.title = old; page.remove(); window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore); window.print(); setTimeout(restore, 2000);
  });
  dl.addEventListener("click", () => {
    const c = cols(); if (!c.length) return;
    const blob = new Blob([csv(c.map((x) => x.label), rowsData())], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = UI.file.replace("{n}", name.value.trim()).trim().replace(/\s+/g, "-") + ".csv";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
