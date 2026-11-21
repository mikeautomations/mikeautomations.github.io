// /en/price-list-maker/ and /he/price-list/ client logic. Progressive enhancement: without JS the page explains the
// tool. The price list is drawn on a canvas in the browser. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/price-list.ts with the types removed (made with the TypeScript
// compiler). tests/price-list-maker.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="pl-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to price-list.ts) ----------
  const FORMATS = { a4: { w: 1240, h: 1754 }, post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };
  /** Adds the currency: "45" -> "£45", "from 45" -> "from £45", and a range once: "45-60" -> "£45-60". */
  function priceText(raw, currency, pattern) {
      const t = (raw || "").trim();
      if (!t || !currency)
          return t;
      if (t.includes(currency))
          return t;
      const money = (n) => pattern.replace("{c}", currency).replace("{n}", n);
      return t.replace(/\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?/g, (n) => money(n.replace(/\s*([-–])\s*/, "$1")));
  }
  /** Sections with their empty items removed, and empty sections dropped. */
  function clean(sections) {
      return sections
          .map((s) => ({ title: (s.title || "").trim(), items: s.items.filter((i) => (i.name || "").trim()).map((i) => ({ name: i.name.trim(), price: (i.price || "").trim(), note: (i.note || "").trim() })) }))
          .filter((s) => s.items.length || s.title);
  }
  /**
   * Lays the list out between top and bottom. Sizes are in "lines" of the base font: a section heading takes 2.3, an
   * item 1.55 and its note 1.05 more. The base size is the largest that fits, up to maxBase.
   */
  function layout(sections, top, bottom, maxBase) {
      const list = clean(sections);
      let units = 0;
      list.forEach((s, i) => { if (s.title)
          units += i ? 2.3 : 1.7; s.items.forEach((it) => { units += 1.55 + (it.note ? 1.05 : 0); }); });
      const base = units ? Math.min(maxBase, Math.floor((bottom - top) / units)) : maxBase;
      const rows = [];
      let y = top;
      list.forEach((s, i) => {
          if (s.title) {
              y += base * (i ? 2.3 : 1.7);
              rows.push({ kind: "section", y: y - base * 0.55, text: s.title });
          }
          s.items.forEach((it) => {
              y += base * 1.55;
              rows.push({ kind: "item", y: y - base * 0.45, text: it.name, price: it.price });
              if (it.note) {
                  y += base * 1.05;
                  rows.push({ kind: "note", y: y - base * 0.4, text: it.note });
              }
          });
      });
      return { base, rows };
  }
  function checks(business, sections, base, minBase) {
      const c = [];
      const list = clean(sections);
      const items = list.flatMap((s) => s.items);
      c.push(business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      c.push(items.length ? { level: "ok", id: "items_ok" } : { level: "bad", id: "items_missing" });
      if (items.some((i) => !i.price))
          c.push({ level: "warn", id: "price_missing" });
      if (items.length && base < minBase)
          c.push({ level: "warn", id: "too_many" });
      else if (items.length)
          c.push({ level: "ok", id: "fits" });
      return c;
  }

  const API = { FORMATS, priceText, clean, layout, checks };
  root.PriceList = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pl-app");
  const dataEl = document.getElementById("pl-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const RTL = !!UI.rtl;

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const button = (cls, txt) => { const b = el("button", cls, txt); b.type = "button"; return b; };
  let uid = 0;
  function wrapField(label, control, cls) {
    const w = el("div", "ft-field gp-field" + (cls ? " " + cls : ""));
    const lab = el("label", null, label);
    control.id = control.id || "pl-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab, control);
    return w;
  }
  const input = (ph, max, value) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (ph) c.placeholder = ph; c.maxLength = max || 80; if (value != null) c.value = value; return c; };
  const select = (o) => { const s = el("select"); o.options.forEach(([v, l]) => { const x = el("option", null, l); x.value = v; s.append(x); }); return s; };

  // Form.
  const business = input(UI.business.placeholder, UI.business.max);
  const title = input("", UI.title.max, UI.title.value);
  const footer = input(UI.footer.placeholder, UI.footer.max);
  const format = select(UI.format);
  const currency = select(UI.currency);
  const rowF = el("div", "pl-row"); rowF.append(wrapField(UI.format.label, format), wrapField(UI.currency.label, currency));
  const themes = el("fieldset", "pl-themes");
  themes.append(el("legend", null, UI.theme));
  let theme = UI.themes[0];
  UI.themes.forEach((t, i) => {
    const lab = el("label", "pl-sw");
    const r = el("input"); r.type = "radio"; r.name = "pl-theme"; r.value = t.id; r.checked = i === 0; r.setAttribute("aria-label", t.label);
    const sw = el("span"); sw.style.background = "linear-gradient(135deg, " + t.bg + " 0 55%, " + t.accent + " 55% 100%)";
    lab.title = t.label; lab.append(r, sw); themes.append(lab);
  });
  let sections = [];
  const secBox = el("div", "pl-secs");
  const addSec = button("try-btn gp-ghost pl-add", UI.addSection);
  function drawSections() {
    secBox.textContent = "";
    sections.forEach((s, si) => {
      const box = el("div", "pl-sec");
      const top = el("div", "pl-sec-top");
      const st = input(UI.sectionPh, 40, s.title);
      st.addEventListener("input", () => { s.title = st.value; render(); });
      const xs = button("try-btn gp-ghost pl-x", "✕");
      xs.setAttribute("aria-label", UI.removeSection.replace("{n}", String(si + 1)));
      xs.addEventListener("click", () => { sections.splice(si, 1); if (!sections.length) sections.push({ title: "", items: [{ name: "", price: "", note: "" }] }); drawSections(); render(); });
      top.append(wrapField(UI.section.replace("{n}", String(si + 1)), st), xs);
      box.append(top);
      s.items.forEach((it, ii) => {
        const row = el("div", "pl-item");
        const n = input(UI.itemPh, 60, it.name), p = input(UI.pricePh, 24, it.price), no = input(UI.notePh, 60, it.note);
        n.addEventListener("input", () => { it.name = n.value; render(); });
        p.addEventListener("input", () => { it.price = p.value; render(); });
        no.addEventListener("input", () => { it.note = no.value; render(); });
        const x = button("try-btn gp-ghost pl-x", "✕");
        x.setAttribute("aria-label", UI.removeItem.replace("{name}", it.name.trim() || UI.untitled.replace("{n}", String(ii + 1))));
        x.addEventListener("click", () => { s.items.splice(ii, 1); drawSections(); render(); });
        row.append(wrapField(UI.item, n), wrapField(UI.price, p), x, wrapField(UI.note, no, "pl-note"));
        box.append(row);
      });
      const ai = button("try-btn gp-ghost pl-add", UI.addItem);
      ai.addEventListener("click", () => { s.items.push({ name: "", price: "", note: "" }); drawSections(); render(); const rows = secBox.children[si].querySelectorAll(".pl-item input"); rows[rows.length - 3].focus(); });
      ai.hidden = s.items.length >= 20;
      box.append(ai);
      secBox.append(box);
    });
    addSec.hidden = sections.length >= 6;
  }
  addSec.addEventListener("click", () => { sections.push({ title: "", items: [{ name: "", price: "", note: "" }] }); drawSections(); render(); const ins = secBox.lastChild.querySelector("input"); if (ins) ins.focus(); });

  const tryBtn = button("try-btn", UI.exampleBtn);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const secH = el("h3", "gp-h", UI.sectionsTitle); secH.style.marginTop = "0.8rem";
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.business.label, business), wrapField(UI.title.label, title), rowF, themes, secH, secBox, addSec, wrapField(UI.footer.label, footer), checksH, checkList);

  // Preview.
  const canvas = el("canvas");
  canvas.setAttribute("role", "img");
  const stage = el("div", "pl-stage"); stage.append(canvas);
  const dl = button("try-btn try-btn-primary", UI.download);
  const pr = button("try-btn", UI.print);
  const acts = el("div", "pl-acts"); acts.append(dl, pr);
  const card = el("section", "gp-card"); card.append(el("h2", "gp-h", UI.previewTitle), stage, acts);
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const ctx = canvas.getContext("2d");
  function fitText(s, x, y, size, weight, color, align, max) {
    let f = size;
    ctx.font = weight + " " + f + "px " + FONT;
    while (f > size * 0.6 && ctx.measureText(s).width > max) { f -= 1; ctx.font = weight + " " + f + "px " + FONT; }
    ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y, max);
    return Math.min(ctx.measureText(s).width, max);
  }
  function draw() {
    const fmt = API.FORMATS[format.value] || API.FORMATS.a4;
    const W = fmt.w, H = fmt.h;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const t = theme, P = Math.round(W * 0.085);
    ctx.direction = RTL ? "rtl" : "ltr";
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.1; ctx.fillStyle = t.accent;
    ctx.beginPath(); ctx.arc(RTL ? W * 0.08 : W * 0.92, H * 0.04, W * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(RTL ? W * 0.95 : W * 0.05, H * 1.02, W * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = t.accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.strokeRect(P * 0.45, P * 0.45, W - P * 0.9, H - P * 0.9); ctx.globalAlpha = 1;
    const cx = W / 2, maxW = W - 2 * P;
    let y = P + W * 0.05;
    ctx.textBaseline = "alphabetic";
    if (business.value.trim()) { fitText(business.value.trim(), cx, y, W * 0.034, 700, t.soft, "center", maxW); y += W * 0.075; }
    fitText(title.value.trim() || " ", cx, y + W * 0.02, W * 0.075, 800, t.ink, "center", maxW);
    y += W * 0.065;
    ctx.fillStyle = t.accent; ctx.fillRect(cx - W * 0.05, y, W * 0.1, Math.max(4, W * 0.005));
    const top = y + W * 0.03;
    const bottom = H - P - (footer.value.trim() ? W * 0.07 : W * 0.02);
    const secs = sections.map((s) => ({ title: s.title, items: s.items.map((i) => ({ name: i.name, price: API.priceText(i.price, currency.value, UI.money), note: i.note })) }));
    const L = API.layout(secs, top, bottom, Math.round(W * 0.046));
    const b = L.base;
    const xs = RTL ? W - P : P, xe = RTL ? P : W - P;
    for (const r of L.rows) {
      if (r.kind === "section") {
        fitText(r.text, xs, r.y, b * 1.18, 800, t.accent, RTL ? "right" : "left", maxW);
      } else if (r.kind === "item") {
        ctx.font = "800 " + b + "px " + FONT;
        const pw = r.price ? Math.min(ctx.measureText(r.price).width, maxW * 0.4) : 0;
        if (r.price) { ctx.fillStyle = t.ink; ctx.textAlign = RTL ? "left" : "right"; ctx.fillText(r.price, xe, r.y, maxW * 0.4); }
        const nw = fitText(r.text, xs, r.y, b, 600, t.ink, RTL ? "right" : "left", maxW - pw - b * 1.2);
        // Dotted leader between the name and the price.
        const from = nw + b * 0.5, to = maxW - pw - b * 0.5;
        ctx.fillStyle = t.soft; ctx.globalAlpha = 0.7;
        for (let d = from; d < to; d += b * 0.36) { const dx = RTL ? xs - d : xs + d; ctx.beginPath(); ctx.arc(dx, r.y - b * 0.12, Math.max(1.5, b * 0.055), 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else {
        ctx.font = "italic 400 " + Math.round(b * 0.78) + "px " + FONT;
        ctx.fillStyle = t.soft; ctx.textAlign = RTL ? "right" : "left";
        ctx.fillText(r.text, xs, r.y, maxW * 0.8);
      }
    }
    if (footer.value.trim()) fitText(footer.value.trim(), cx, H - P - W * 0.01, W * 0.03, 600, t.soft, "center", maxW);
    return L;
  }
  let lastFormat = "";
  function render() {
    const L = draw();
    if (lastFormat && lastFormat !== format.value) { canvas.classList.remove("swap"); void canvas.offsetWidth; canvas.classList.add("swap"); }
    lastFormat = format.value;
    stage.dataset.format = format.value;
    const list = API.clean(sections);
    canvas.setAttribute("aria-label", UI.canvasLabel.replace("{summary}", [business.value.trim(), title.value.trim(), ...list.map((s) => [s.title, ...s.items.map((i) => i.name + (i.price ? " " + API.priceText(i.price, currency.value, UI.money) : ""))].filter(Boolean).join(", "))].filter(Boolean).join(". ")));
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(business.value, sections, L.base, Math.round((API.FORMATS[format.value] || API.FORMATS.a4).w * 0.024)).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx); checkList.append(li);
    });
  }
  for (const c of [business, title, footer]) c.addEventListener("input", render);
  for (const c of [format, currency]) c.addEventListener("change", render);
  themes.addEventListener("change", (e) => { theme = UI.themes.find((t) => t.id === e.target.value) || theme; render(); });
  dl.addEventListener("click", () => canvas.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = el("a"); a.href = url; a.download = UI.fileName; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png"));
  pr.addEventListener("click", () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const img = canvas.toDataURL("image/png");
    w.document.write('<!doctype html><title>' + (title.value || "Price list") + '</title><style>@page{size:A4;margin:10mm}body{margin:0;display:grid;place-items:center}img{max-width:100%;max-height:277mm}</style><img alt="" src="' + img + '" onload="setTimeout(function(){window.focus();window.print()},150)">');
    w.document.close();
  });
  function reset() { business.value = ""; title.value = UI.title.value; footer.value = ""; format.value = "a4"; currency.value = UI.defaultCurrency; sections = [{ title: "", items: [{ name: "", price: "", note: "" }, { name: "", price: "", note: "" }] }]; }
  tryBtn.addEventListener("click", () => {
    const e = UI.example;
    reset();
    business.value = e.business; title.value = e.title; footer.value = e.footer;
    sections = e.sections.map((s) => ({ title: s.title, items: s.items.map(([name, price, note]) => ({ name, price, note })) }));
    const r = themes.querySelector('input[value="' + e.theme + '"]');
    if (r) { r.checked = true; theme = UI.themes.find((t) => t.id === e.theme) || theme; }
    drawSections(); render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); drawSections(); render(); business.focus(); });
  reset();
  drawSections();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})(typeof globalThis !== "undefined" ? globalThis : this);
