// /en/faq-generator/ and /he/faq-generator/ client logic. Progressive enhancement: without JS the page shows an
// example. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/faq.ts with the types removed (made with the TypeScript compiler).
// tests/faq-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts and suggested questions (English or Hebrew) from <script id="fg-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to faq.ts) ----------
  const one = (s) => (s || "").replace(/\s+/g, " ").trim();
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** Items with both a question and an answer, tidied, without exact duplicate questions. */
  function clean(items) {
      const seen = new Set();
      const out = [];
      for (const it of items) {
          const q = one(it.q), a = (it.a || "").split(/\r?\n/).map(one).filter(Boolean).join("\n");
          const key = q.toLowerCase();
          if (!q || !a || seen.has(key))
              continue;
          seen.add(key);
          out.push({ q, a });
      }
      return out;
  }
  /** FAQPage structured data, ready to paste inside <script type="application/ld+json">. */
  function jsonLd(items) {
      const data = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: clean(items).map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a.replace(/\n/g, " ") } })),
      };
      return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  }
  /** The FAQ section for a website: a heading and one <details> per question, plus the structured data. */
  function html(items, heading, withSchema, rtl) {
      const list = clean(items);
      const body = list.map((it) => `  <details>\n    <summary>${esc(it.q)}</summary>\n${it.a.split("\n").map((p) => `    <p>${esc(p)}</p>`).join("\n")}\n  </details>`).join("\n");
      const section = `<section class="faq"${rtl ? ' dir="rtl"' : ""}>\n  <h2>${esc(one(heading))}</h2>\n${body}\n</section>`;
      return withSchema ? `${section}\n<script type="application/ld+json">\n${jsonLd(list)}\n</script>` : section;
  }
  function text(items, heading) {
      return [one(heading), ...clean(items).map((it) => `${it.q}\n${it.a}`)].filter(Boolean).join("\n\n");
  }
  /** Checks for each question (n is its number, from 1) and for the list as a whole. */
  function checks(items) {
      const c = [];
      const filled = items.filter((it) => one(it.q) || one(it.a));
      filled.forEach((it) => {
          const n = items.indexOf(it) + 1;
          const q = one(it.q), a = one(it.a);
          if (q && !a)
              c.push({ level: "bad", id: "answer_missing", n });
          else if (!q && a)
              c.push({ level: "bad", id: "question_missing", n });
          else if (a.length < 25)
              c.push({ level: "warn", id: "answer_short", n });
          else if (a.length > 420)
              c.push({ level: "warn", id: "answer_long", n });
          if (q && !/[?？؟]$/.test(q))
              c.push({ level: "warn", id: "question_mark", n });
      });
      const keys = filled.map((it) => one(it.q).toLowerCase()).filter(Boolean);
      if (new Set(keys).size < keys.length)
          c.push({ level: "warn", id: "duplicate" });
      const ready = clean(items).length;
      c.push(ready >= 4 ? { level: "ok", id: "count_ok", n: ready } : { level: "warn", id: "count_few", n: ready });
      return c;
  }

  const API = { clean, jsonLd, html, text, checks };
  root.FaqGen = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("fg-app");
  const dataEl = document.getElementById("fg-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const RTL = !!DATA.rtl;

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
    control.id = control.id || "fg-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }

  // Form.
  const heading = el("input"); heading.type = "text"; heading.dir = "auto"; heading.maxLength = UI.heading.max; heading.value = UI.heading.value;
  const type = el("select");
  UI.banks.forEach((b) => { const o = el("option", null, b.label); o.value = b.id; type.append(o); });
  const chips = el("div", "fg-chips");
  let items = [];
  const itemsBox = el("div", "fg-items");
  const addBtn = button("try-btn gp-ghost fg-add", UI.add);
  const schemaLab = el("label", "fg-opt");
  const schemaCb = el("input"); schemaCb.type = "checkbox"; schemaCb.checked = true;
  schemaLab.append(schemaCb, document.createTextNode(UI.schema));
  let newIndex = -1;

  function drawChips() {
    chips.textContent = "";
    const bank = UI.banks.find((b) => b.id === type.value) || UI.banks[0];
    bank.qs.forEach(([q, hint]) => {
      const used = items.some((it) => it.q.trim().toLowerCase() === q.toLowerCase());
      const c = button("try-btn gp-ghost fg-chip", (used ? "✓ " : "+ ") + q);
      c.setAttribute("aria-pressed", used ? "true" : "false");
      c.addEventListener("click", () => {
        if (items.some((it) => it.q.trim().toLowerCase() === q.toLowerCase())) return;
        const empty = items.findIndex((it) => !it.q.trim() && !it.a.trim());
        if (empty >= 0) items[empty] = { q, a: "", hint }; else items.push({ q, a: "", hint });
        newIndex = empty >= 0 ? empty : items.length - 1;
        drawItems(); drawChips(); render();
        const ta = itemsBox.querySelectorAll("textarea")[newIndex];
        if (ta) ta.focus();
      });
      chips.append(c);
    });
  }
  function drawItems() {
    itemsBox.textContent = "";
    items.forEach((it, i) => {
      const box = el("div", "fg-item" + (i === newIndex ? " new" : ""));
      const q = el("input"); q.type = "text"; q.dir = "auto"; q.maxLength = 160; q.value = it.q;
      const a = el("textarea"); a.rows = 3; a.dir = "auto"; a.maxLength = 700; a.value = it.a; if (it.hint) a.placeholder = it.hint;
      q.addEventListener("input", () => { it.q = q.value; render(); });
      q.addEventListener("change", drawChips);
      a.addEventListener("input", () => { it.a = a.value; render(); });
      const x = button("try-btn gp-ghost fg-x", "✕");
      x.setAttribute("aria-label", UI.remove.replace("{n}", String(i + 1)));
      x.addEventListener("click", () => { items.splice(i, 1); if (!items.length) items.push({ q: "", a: "" }); newIndex = -1; drawItems(); drawChips(); render(); });
      box.append(wrapField(UI.q.replace("{n}", String(i + 1)), q), x, wrapField(UI.a.replace("{n}", String(i + 1)), a));
      itemsBox.append(box);
    });
    addBtn.hidden = items.length >= 30;
    newIndex = -1;
  }
  addBtn.addEventListener("click", () => { items.push({ q: "", a: "" }); newIndex = items.length - 1; drawItems(); render(); const ins = itemsBox.querySelectorAll("input"); ins[ins.length - 1].focus(); });
  type.addEventListener("change", drawChips);

  const tryBtn = button("try-btn", UI.exampleBtn);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const sugH = el("h3", "gp-h", UI.suggestTitle); sugH.style.marginTop = "0.6rem";
  const itemsH = el("h3", "gp-h", UI.itemsTitle); itemsH.style.marginTop = "0.8rem";
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.type.label, type), sugH, el("p", "gp-hint", UI.suggestHint), chips, wrapField(UI.heading.label, heading), itemsH, itemsBox, addBtn, schemaLab, checksH, checkList);

  // Preview and code.
  const preview = el("div", "fg-preview");
  preview.dir = RTL ? "rtl" : "ltr";
  const tabs = el("div", "fg-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", UI.codeLabel);
  let tab = "html";
  const tabBtns = UI.tabs.map(([id, label]) => {
    const b = button("try-btn gp-ghost fg-tab", label);
    b.setAttribute("role", "tab");
    b.dataset.tab = id;
    b.addEventListener("click", () => { tab = id; render(); });
    tabs.append(b);
    return b;
  });
  const code = el("textarea", "gp-code-box fg-code");
  code.readOnly = true; code.rows = 10; code.spellcheck = false; code.dir = "ltr";
  code.setAttribute("aria-label", UI.codeLabel);
  const cp = button("try-btn try-btn-primary fg-btn", UI.copy);
  const acts = el("div", "fg-acts"); acts.append(cp);
  const card = el("section", "gp-card");
  card.append(el("h2", "gp-h", UI.previewTitle), preview, tabs, code, acts);
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  let openSet = new Set([0]);
  function render() {
    const list = API.clean(items);
    const was = [...preview.querySelectorAll("details")].map((d, i) => (d.open ? i : -1)).filter((i) => i >= 0);
    if (preview.childNodes.length) openSet = new Set(was);
    preview.textContent = "";
    if (!list.length) preview.append(el("p", "fg-empty", UI.previewEmpty));
    else {
      preview.append(el("h3", null, heading.value.trim()));
      list.forEach((it, i) => {
        const d = el("details");
        if (openSet.has(i)) d.open = true;
        d.append(el("summary", null, it.q));
        it.a.split("\n").forEach((p) => d.append(el("p", null, p)));
        preview.append(d);
      });
    }
    for (const b of tabBtns) b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    code.value = tab === "schema" ? '<script type="application/ld+json">\n' + API.jsonLd(list) + "\n</script>" : tab === "text" ? API.text(list, heading.value) : API.html(list, heading.value, schemaCb.checked, RTL);
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(items).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode((UI.checks[c.id] || c.id).replace("{n}", String(c.n || ""))));
      li.append(icn, tx); checkList.append(li);
    });
  }
  preview.addEventListener("toggle", (e) => { const d = e.target; if (d.open) { d.classList.add("just-opened"); setTimeout(() => d.classList.remove("just-opened"), 400); } }, true);
  heading.addEventListener("input", render);
  schemaCb.addEventListener("change", render);
  cp.addEventListener("click", () => {
    const done = () => { cp.dataset.done = "1"; cp.textContent = "✓ " + UI.copied; setTimeout(() => { cp.dataset.done = ""; cp.textContent = UI.copy; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, () => {});
    else { code.select(); try { if (document.execCommand("copy")) done(); } catch (e) {} }
  });
  tryBtn.addEventListener("click", () => {
    const e = UI.example;
    type.value = e.type; heading.value = UI.heading.value;
    items = e.items.map(([q, a]) => ({ q, a }));
    openSet = new Set([0]); preview.textContent = "";
    drawItems(); drawChips(); render();
  });
  clearBtn.addEventListener("click", () => { items = [{ q: "", a: "" }]; heading.value = UI.heading.value; preview.textContent = ""; drawItems(); drawChips(); render(); });
  items = [{ q: "", a: "" }];
  drawItems();
  drawChips();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
