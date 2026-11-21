// /en/social-post-maker/ and /he/social-post/ client logic. Progressive enhancement: without JS the page explains
// the tool. The post is drawn on a canvas in the browser. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/social-post.ts with the types removed (made with the TypeScript
// compiler). tests/social-post-maker.test.ts checks both copies give identical results.
// PART 2 reads its texts and templates (English or Hebrew) from <script id="sp-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to social-post.ts) ----------
  const SIZES = { post: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 } };
  /** Splits text into lines no wider than max (measure gives the width of a string at the current size). */
  function wrap(text, max, measure) {
      const out = [];
      for (const para of String(text || "").split(/\r?\n/)) {
          const words = para.trim().split(/\s+/).filter(Boolean);
          if (!words.length)
              continue;
          let cur = "";
          for (const w of words) {
              const next = cur ? cur + " " + w : w;
              if (!cur || measure(next) <= max)
                  cur = next;
              else {
                  out.push(cur);
                  cur = w;
              }
          }
          out.push(cur);
      }
      return out;
  }
  /**
   * The biggest font size, from start down to min in steps of 2, at which the text fits in maxLines lines of max width.
   * measure(s, size) gives the width of s at that size. If nothing fits, min is used and the lines are cut to maxLines.
   */
  function fit(text, max, maxLines, start, min, measure) {
      for (let size = start; size >= min; size -= 2) {
          const lines = wrap(text, max, (s) => measure(s, size));
          if (lines.length <= maxLines && lines.every((l) => measure(l, size) <= max))
              return { size, lines, cut: false };
      }
      const lines = wrap(text, max, (s) => measure(s, min));
      return { size: min, lines: lines.slice(0, maxLines), cut: lines.length > maxLines };
  }
  function checks(v, cut) {
      const c = [];
      const h = v.headline.trim();
      c.push(!h ? { level: "bad", id: "headline_missing" } : Array.from(h).length > 40 ? { level: "warn", id: "headline_long" } : { level: "ok", id: "headline_ok" });
      if (cut)
          c.push({ level: "warn", id: "too_long" });
      c.push(v.business.trim() ? { level: "ok", id: "business_ok" } : { level: "warn", id: "business_missing" });
      c.push(v.contact.trim() ? { level: "ok", id: "contact_ok" } : { level: "warn", id: "contact_missing" });
      return c;
  }

  const API = { SIZES, wrap, fit, checks };
  root.SocialPost = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("sp-app");
  const dataEl = document.getElementById("sp-data");
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
  function wrapField(label, control, hint) {
    const w = el("div", "ft-field gp-field");
    const lab = el("label", null, label);
    control.id = control.id || "sp-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const input = (f) => { const c = el("input"); c.type = "text"; c.dir = "auto"; c.placeholder = f.placeholder; c.maxLength = f.max; return c; };

  // Form.
  const tpls = el("fieldset", "sp-tpls");
  tpls.append(el("legend", null, UI.template.label));
  UI.templates.forEach((t, i) => {
    const lab = el("label", "sp-tpl");
    const r = el("input"); r.type = "radio"; r.name = "sp-tpl"; r.value = t.id; r.checked = i === 0;
    lab.append(r, el("span", null, t.label));
    tpls.append(lab);
  });
  const headline = input(UI.headline), sub = input(UI.sub), badge = input(UI.badge), business = input(UI.business), contact = input(UI.contact);
  const body = el("textarea"); body.rows = 4; body.dir = "auto"; body.placeholder = UI.body.placeholder; body.maxLength = UI.body.max;
  const size = el("select");
  UI.size.options.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; size.append(o); });
  const themes = el("fieldset", "sp-themes");
  themes.append(el("legend", null, UI.theme));
  let theme = UI.themes[0];
  UI.themes.forEach((t, i) => {
    const lab = el("label", "sp-sw");
    const r = el("input"); r.type = "radio"; r.name = "sp-theme"; r.value = t.id; r.checked = i === 0; r.setAttribute("aria-label", t.label);
    const sw = el("span"); sw.style.background = "linear-gradient(135deg, " + t.bg + " 0 55%, " + t.accent + " 55% 100%)";
    lab.title = t.label; lab.append(r, sw); themes.append(lab);
  });
  const rowB = el("div", "sp-row"); rowB.append(wrapField(UI.business.label, business), wrapField(UI.contact.label, contact));
  const tryBtn = button("try-btn", UI.exampleBtn);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, tpls, wrapField(UI.headline.label, headline), wrapField(UI.sub.label, sub), wrapField(UI.body.label, body, UI.body.hint),
    wrapField(UI.badge.label, badge, UI.badge.hint), rowB, wrapField(UI.size.label, size), themes, checksH, checkList);

  // Preview, in a phone frame.
  const canvas = el("canvas");
  canvas.setAttribute("role", "img");
  const phone = el("div", "sp-phone"); phone.append(canvas);
  const stage = el("div", "sp-stage"); stage.append(phone);
  const dl = button("try-btn try-btn-primary", UI.download);
  const acts = el("div", "sp-acts"); acts.append(dl);
  const card = el("section", "gp-card"); card.append(el("h2", "gp-h", UI.previewTitle), stage, acts);
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const ctx = canvas.getContext("2d");
  const measurer = (weight) => (s, px) => { ctx.font = weight + " " + px + "px " + FONT; return ctx.measureText(s).width; };
  let cut = false;
  function draw() {
    const s = API.SIZES[size.value] || API.SIZES.post;
    const W = s.w, H = s.h, k = W / 1080, t = theme;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.direction = RTL ? "rtl" : "ltr";
    ctx.textBaseline = "alphabetic";
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.12; ctx.fillStyle = t.accent;
    ctx.beginPath(); ctx.arc(RTL ? 60 * k : W - 60 * k, 80 * k, 330 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.strokeStyle = t.accent; ctx.lineWidth = 18 * k;
    ctx.beginPath(); ctx.arc(RTL ? W - 40 * k : 40 * k, H - 30 * k, 190 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    const P = 90 * k, maxW = W - 2 * P, cx = W / 2;
    // Business name at the top.
    if (business.value.trim()) {
      ctx.font = "700 " + Math.round(38 * k) + "px " + FONT; ctx.fillStyle = t.soft; ctx.textAlign = "center";
      ctx.fillText(business.value.trim(), cx, P + 30 * k, maxW * 0.7);
    }
    // Measure the blocks, then centre them between the top and the contact line.
    const story = size.value === "story", square = size.value === "square";
    const h = API.fit(headline.value.trim() || " ", maxW, 3, Math.round(150 * k), Math.round(72 * k), measurer(900));
    const sb = sub.value.trim() ? API.fit(sub.value.trim(), maxW, 2, Math.round(64 * k), Math.round(40 * k), measurer(700)) : null;
    const bodyLines = story ? 9 : square ? 4 : 6;
    const bd = body.value.trim() ? API.fit(body.value.trim(), maxW * 0.92, bodyLines, Math.round(50 * k), Math.round(32 * k), measurer(500)) : null;
    cut = !!(h.cut || (sb && sb.cut) || (bd && bd.cut));
    const gap = 40 * k;
    const blockH = h.lines.length * h.size * 1.08 + (sb ? gap * 0.7 + sb.lines.length * sb.size * 1.2 : 0) + (bd ? gap * 1.3 + bd.lines.length * bd.size * 1.45 : 0);
    const top = P + 110 * k, bottom = H - P - 110 * k;
    let y = Math.max(top, top + (bottom - top - blockH) / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = t.ink; ctx.font = "900 " + h.size + "px " + FONT;
    for (const l of h.lines) { y += h.size; ctx.fillText(l, cx, y, maxW); y += h.size * 0.08; }
    if (sb) {
      y += gap * 0.7;
      ctx.fillStyle = t.accent; ctx.font = "700 " + sb.size + "px " + FONT;
      for (const l of sb.lines) { y += sb.size; ctx.fillText(l, cx, y, maxW); y += sb.size * 0.2; }
    }
    if (bd) {
      y += gap * 0.5;
      ctx.fillStyle = t.accent; ctx.fillRect(cx - 50 * k, y, 100 * k, 6 * k);
      y += gap * 0.8;
      ctx.fillStyle = t.ink; ctx.font = "500 " + bd.size + "px " + FONT;
      for (const l of bd.lines) { y += bd.size; ctx.fillText(l, cx, y, maxW); y += bd.size * 0.45; }
    }
    // The badge, tilted, in the top corner.
    const b = badge.value.trim();
    if (b) {
      const r = 118 * k, bx = RTL ? P + r * 0.55 : W - P - r * 0.55, by = P + r * 1.35;
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(RTL ? 0.2 : -0.2);
      ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = t.onAccent; ctx.globalAlpha = 0.5; ctx.lineWidth = 4 * k; ctx.setLineDash([10 * k, 8 * k]);
      ctx.beginPath(); ctx.arc(0, 0, r - 14 * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const bf = API.fit(b, r * 1.5, 1, Math.round(84 * k), Math.round(34 * k), measurer(900));
      ctx.fillStyle = t.onAccent; ctx.font = "900 " + bf.size + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.direction = /[\u0590-\u05FF]/.test(b) ? "rtl" : "ltr";
      ctx.fillText(bf.lines[0] || b, 0, 4 * k, r * 1.6);
      ctx.restore();
      ctx.textBaseline = "alphabetic";
    }
    // Contact line at the bottom.
    if (contact.value.trim()) {
      const cy = H - P - 10 * k;
      ctx.fillStyle = t.accent; ctx.fillRect(cx - 160 * k, cy - 78 * k, 320 * k, 4 * k);
      ctx.font = "700 " + Math.round(40 * k) + "px " + FONT; ctx.fillStyle = t.ink; ctx.textAlign = "center";
      // Phone numbers, web addresses and @handles keep left-to-right order on a Hebrew post.
      ctx.direction = /[\u0590-\u05FF]/.test(contact.value) ? "rtl" : "ltr";
      ctx.fillText(contact.value.trim(), cx, cy, maxW);
      ctx.direction = RTL ? "rtl" : "ltr";
    }
  }
  let lastSize = "";
  function render() {
    draw();
    if (lastSize && lastSize !== size.value) { phone.classList.remove("swap"); void phone.offsetWidth; phone.classList.add("swap"); }
    lastSize = size.value;
    stage.dataset.size = size.value;
    canvas.setAttribute("aria-label", UI.canvasLabel.replace("{summary}", [business.value, badge.value, headline.value, sub.value, body.value.replace(/\n/g, ", "), contact.value].map((x) => x.trim()).filter(Boolean).join(". ")));
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks({ headline: headline.value, body: body.value, business: business.value, contact: contact.value }, cut).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx); checkList.append(li);
    });
  }
  function applyTemplate(id) {
    const t = UI.templates.find((x) => x.id === id) || UI.templates[0];
    headline.value = t.headline; sub.value = t.sub; body.value = t.body; badge.value = t.badge;
  }
  tpls.addEventListener("change", (e) => { applyTemplate(e.target.value); render(); });
  themes.addEventListener("change", (e) => { theme = UI.themes.find((t) => t.id === e.target.value) || theme; render(); });
  form.addEventListener("input", render);
  size.addEventListener("change", render);
  dl.addEventListener("click", () => canvas.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = el("a"); a.href = url; a.download = UI.fileName.replace("{size}", size.value); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png"));
  function setRadio(set, v) { const r = set.querySelector('input[value="' + v + '"]'); if (r) r.checked = true; }
  tryBtn.addEventListener("click", () => {
    const e = UI.example;
    setRadio(tpls, e.template); applyTemplate(e.template);
    business.value = e.business; contact.value = e.contact;
    setRadio(themes, e.theme); theme = UI.themes.find((t) => t.id === e.theme) || theme;
    render(); headline.focus();
  });
  clearBtn.addEventListener("click", () => { setRadio(tpls, "custom"); applyTemplate("custom"); business.value = ""; contact.value = ""; render(); headline.focus(); });
  applyTemplate(UI.templates[0].id);
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})(typeof globalThis !== "undefined" ? globalThis : this);
