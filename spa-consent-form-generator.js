// Treatment consent and health questionnaire maker (spa, beauty, massage, clinics). Runs in the browser; nothing is sent
// anywhere. The page puts its labels and example in <script type="application/json" id="cf-data"> and an empty <div id="cf-app">.
// Output: a printable form with the business header, blank lines for the client, tick-box health questions (Yes / No),
// consent statements to tick, and signature lines. Shared styling: GP_CSS + RC_CSS + DM_CSS from the page.
(function (root) {
  "use strict";
  /** Lines of a textarea as a clean list: trimmed, empty lines dropped, capped at max items. */
  function lines(text, max) { return String(text || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, max || 30); }
  root.ConsentForm = { lines };
  if (typeof document === "undefined") return;
  const app = document.getElementById("cf-app"), dataEl = document.getElementById("cf-data");
  if (!app || !dataEl) return;
  let DATA; try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const button = (c, x) => { const b = el("button", c, x); b.type = "button"; return b; };
  let uid = 0;
  const field = (label, control, hint) => {
    const w = el("div", "ft-field gp-field"), lab = el("label", null, label);
    control.id = control.id || "cf-f" + ++uid; lab.htmlFor = control.id; w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control); return w;
  };
  const text = (ph, max) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (ph) c.placeholder = ph; c.maxLength = max || 80; return c; };
  const area = (rows, ph) => { const c = el("textarea"); c.rows = rows; c.dir = "auto"; if (ph) c.placeholder = ph; c.maxLength = 1200; return c; };

  const business = text(UI.business.placeholder, 60);
  const details = area(3, UI.details.placeholder);
  const treatment = text(UI.treatment.placeholder, 80);
  const qs = area(8, ""); const sts = area(6, ""); const care = area(3, UI.aftercare.placeholder);
  const form = el("div", "ft-box gp-form");
  const tryBtn = button("try-btn", UI.example), clearBtn = button("try-btn gp-ghost", UI.clear);
  const top = el("div", "gp-form-top"), btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  top.append(el("h2", "gp-h", UI.formTitle), btns);
  const checkList = el("ul", "gp-checks"); const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  form.append(top, field(UI.business.label, business), field(UI.details.label, details, UI.details.hint), field(UI.treatment.label, treatment),
    field(UI.questions.label, qs, UI.questions.hint), field(UI.statements.label, sts, UI.statements.hint), field(UI.aftercare.label, care), checksH, checkList);

  const paper = el("div", "rc-paper dm-paper"); paper.setAttribute("aria-live", "polite");
  const stage = el("div", "rc-stage"); stage.append(paper);
  const pdf = button("try-btn try-btn-primary rc-btn", UI.pdf), copy = button("try-btn rc-btn", UI.copy);
  const acts = el("div", "rc-acts"); acts.append(pdf, copy);
  const prev = el("section", "gp-card"); prev.append(el("h2", "gp-h", UI.previewTitle), stage, acts, el("p", "gp-hint", UI.pdfHint));
  const side = el("div", "gp-side"); side.append(prev);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const blank = (label) => { const d = el("div", "cf-blank"); d.append(el("span", "rc-small", label), el("span", "dm-line")); return d; };
  function render() {
    paper.textContent = "";
    const head = el("div", "rc-head"), box = el("div");
    box.append(el("p", "rc-biz", business.value.trim() || UI.business.example), el("p", "rc-det", details.value.trim()));
    head.append(box, el("p", "rc-title", UI.title)); paper.append(head);
    if (treatment.value.trim()) paper.append(el("p", "cf-treat", UI.treatment.label + ": " + treatment.value.trim()));
    const who = el("div", "cf-grid"); UI.client.forEach((l) => who.append(blank(l))); paper.append(who);
    const q = lines(qs.value, 30);
    if (q.length) {
      paper.append(el("h3", "cf-h", UI.questions.title));
      const t = el("table", "rc-table dm-table"), th = el("thead"), hr = el("tr");
      [UI.questions.col, UI.yes, UI.no].forEach((x, i) => hr.append(el("th", i ? "dm-n" : "", x))); th.append(hr);
      const tb = el("tbody");
      q.forEach((x) => { const r = el("tr"); r.append(el("td", null, x), el("td", "dm-n cf-box", "☐"), el("td", "dm-n cf-box", "☐")); tb.append(r); });
      t.append(th, tb); paper.append(t);
      paper.append(blank(UI.details2));
    }
    const s = lines(sts.value, 20);
    if (s.length) { paper.append(el("h3", "cf-h", UI.statements.title)); const ul = el("ul", "cf-list"); s.forEach((x) => ul.append(el("li", null, "☐ " + x))); paper.append(ul); }
    const a = care.value.trim();
    if (a) { paper.append(el("h3", "cf-h", UI.aftercare.title)); paper.append(el("p", "rc-note dm-notep", a)); }
    const sign = el("div", "dm-sign"); UI.sign.forEach((x) => { const d = el("div", "dm-sig"); d.append(el("span", "dm-line"), el("span", "rc-small", x)); sign.append(d); }); paper.append(sign);
    checkList.textContent = "";
    const list = [business.value.trim() ? ["ok", "business_ok"] : ["bad", "business_missing"], q.length ? ["ok", "q_ok"] : ["warn", "q_missing"], s.length ? ["ok", "s_ok"] : ["bad", "s_missing"], treatment.value.trim() ? ["ok", "t_ok"] : ["warn", "t_missing"]];
    const order = { bad: 0, warn: 1, ok: 2 };
    list.sort((x, y) => order[x[0]] - order[y[0]]).forEach(([lv, id]) => {
      const li = el("li", "gp-check gp-" + lv), icn = el("span", "gp-ic", lv === "ok" ? "✓" : lv === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text"); tx.append(el("span", "gp-sr", UI.level[lv] + ": "), document.createTextNode(UI.checks[id])); li.append(icn, tx); checkList.append(li);
    });
  }
  function asText() {
    const out = [business.value.trim(), ...lines(details.value, 6), "", UI.title, treatment.value.trim() ? UI.treatment.label + ": " + treatment.value.trim() : "", ""];
    UI.client.forEach((l) => out.push(l + ": ________"));
    const q = lines(qs.value, 30); if (q.length) { out.push("", UI.questions.title); q.forEach((x) => out.push("- " + x + "  [ ] " + UI.yes + "  [ ] " + UI.no)); }
    const s = lines(sts.value, 20); if (s.length) { out.push("", UI.statements.title); s.forEach((x) => out.push("[ ] " + x)); }
    if (care.value.trim()) out.push("", UI.aftercare.title, care.value.trim());
    out.push(""); UI.sign.forEach((x) => out.push(x + ": ________"));
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function fill(e) { business.value = e.business; details.value = e.details; treatment.value = e.treatment; qs.value = e.questions.join("\n"); sts.value = e.statements.join("\n"); care.value = e.aftercare; }
  form.addEventListener("input", render);
  tryBtn.addEventListener("click", () => { fill(DATA.example); render(); business.focus(); });
  clearBtn.addEventListener("click", () => { fill({ business: "", details: "", treatment: "", questions: DATA.defaults.questions, statements: DATA.defaults.statements, aftercare: "" }); render(); business.focus(); });
  pdf.addEventListener("click", () => {
    render(); const old = document.title; document.title = UI.file.replace("{n}", treatment.value.trim() || business.value.trim()).trim();
    const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore); window.print(); setTimeout(restore, 2000);
  });
  copy.addEventListener("click", () => {
    const done = () => { copy.dataset.done = "1"; copy.textContent = "✓ " + UI.copied; setTimeout(() => { copy.dataset.done = ""; copy.textContent = UI.copy; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(asText()).then(done, () => {});
  });
  fill(DATA.example); render();
})(typeof globalThis !== "undefined" ? globalThis : this);
