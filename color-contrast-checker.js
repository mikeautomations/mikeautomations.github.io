// /en/color-contrast-checker/ and /he/color-contrast-checker/ client logic. Progressive enhancement: without JS the
// page shows worked examples. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/contrast.ts with the types removed (made with the TypeScript
// compiler). tests/color-contrast-checker.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="cc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to contrast.ts) ----------
  /** "#abc", "abc", "#aabbcc", "rgb(1,2,3)" -> {r,g,b}. Null when it isn't a colour we understand. */
  function parseColor(input) {
      const s = String(input || "").trim().toLowerCase();
      let m = s.match(/^#?([0-9a-f]{3})$/);
      if (m)
          return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
      m = s.match(/^#?([0-9a-f]{6})$/);
      if (m)
          return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
      m = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/);
      if (m) {
          const v = [m[1], m[2], m[3]].map(Number);
          if (v.every((x) => x <= 255))
              return { r: v[0], g: v[1], b: v[2] };
      }
      return null;
  }
  function toHex(c) {
      return "#" + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  /** WCAG relative luminance (0 black to 1 white). */
  function luminance(c) {
      const f = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  /** WCAG contrast ratio, 1 to 21. */
  function ratio(a, b) {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /** The ratio as people read it: 4.48 -> "4.48", never rounded up past a threshold. */
  function formatRatio(r) {
      return (Math.floor(r * 100) / 100).toFixed(2);
  }
  function grades(r) {
      return { aaNormal: r >= 4.5, aaLarge: r >= 3, aaaNormal: r >= 7, aaaLarge: r >= 4.5, ui: r >= 3 };
  }
  function rgbToHsl(c) {
      const r = c.r / 255, g = c.g / 255, b = c.b / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      if (max === min)
          return [0, 0, l];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [h / 6, s, l];
  }
  function hslToRgb(h, s, l) {
      if (s === 0)
          return { r: l * 255, g: l * 255, b: l * 255 };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const t = (x) => { let v = x; if (v < 0)
          v += 1; if (v > 1)
          v -= 1; return v < 1 / 6 ? p + (q - p) * 6 * v : v < 1 / 2 ? q : v < 2 / 3 ? p + (q - p) * (2 / 3 - v) * 6 : p; };
      return { r: t(h + 1 / 3) * 255, g: t(h) * 255, b: t(h - 1 / 3) * 255 };
  }
  /**
   * The closest colour to `fg` (same hue and saturation, lightness changed as little as possible) that reaches
   * `target` against `bg`. Tries darker and lighter and returns the nearer one. Null if neither direction gets there.
   */
  function suggest(fg, bg, target) {
      if (ratio(fg, bg) >= target)
          return toHex(fg);
      const [h, s, l] = rgbToHsl(fg);
      let best = null;
      for (const dir of [-1, 1]) {
          for (let k = 1; k <= 100; k++) {
              const nl = l + dir * k / 100;
              if (nl < 0 || nl > 1)
                  break;
              const c = hslToRgb(h, s, nl);
              const rounded = parseColor(toHex(c));
              if (ratio(rounded, bg) >= target) {
                  if (!best || k < best.d)
                      best = { hex: toHex(rounded), d: k };
                  break;
              }
          }
      }
      if (!best) {
          const black = { r: 0, g: 0, b: 0 }, white = { r: 255, g: 255, b: 255 };
          const pick = ratio(black, bg) >= ratio(white, bg) ? black : white;
          return ratio(pick, bg) >= target ? toHex(pick) : null;
      }
      return best.hex;
  }
  /** Every text-on-background pair in a palette with its ratio, best first. */
  function paletteMatrix(colors) {
      const list = colors.map(parseColor).map((c, i) => (c ? { hex: toHex(c), c, i } : null)).filter(Boolean);
      const out = [];
      for (const a of list)
          for (const b of list)
              if (a.i !== b.i && a.hex !== b.hex)
                  out.push({ fg: a.hex, bg: b.hex, ratio: Math.round(ratio(a.c, b.c) * 100) / 100 });
      return out.sort((x, y) => y.ratio - x.ratio);
  }

  const API = { parseColor, toHex, luminance, ratio, formatRatio, grades, suggest, paletteMatrix };
  root.Contrast = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("cc-app");
  const dataEl = document.getElementById("cc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  const S = { fg: DATA.fg, bg: DATA.bg, target: 4.5, palette: DATA.palette.slice(0, 3) };

  // Colour inputs: a native picker plus a text field that accepts hex or rgb().
  function picker(label, key) {
    const wrap = el("div", "cc-pick");
    const id = "cc-" + key;
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const sw = el("input", "cc-swatch");
    sw.type = "color";
    sw.setAttribute("aria-label", label);
    const hex = el("input", "cc-hex");
    hex.type = "text";
    hex.id = id;
    hex.spellcheck = false;
    hex.autocomplete = "off";
    hex.maxLength = 32;
    const err = el("p", "cc-err");
    err.setAttribute("role", "status");
    const row = el("div", "cc-pick-row");
    row.append(sw, hex);
    if (window.EyeDropper) {
      const eye = button("try-btn gp-ghost cc-icon-btn", "🎯");
      eye.title = UI.pick;
      eye.setAttribute("aria-label", UI.pick + ": " + label);
      eye.addEventListener("click", () => { new window.EyeDropper().open().then((r) => { S[key] = r.sRGBHex; render(); }, () => {}); });
      row.append(eye);
    }
    wrap.append(lab, row, err);
    sw.addEventListener("input", () => { S[key] = sw.value; render(); });
    hex.addEventListener("input", () => {
      const c = API.parseColor(hex.value);
      hex.setAttribute("aria-invalid", c ? "false" : "true");
      err.textContent = c ? "" : UI.invalid;
      if (c) { S[key] = API.toHex(c); render(true); }
    });
    return { wrap, sw, hex, err };
  }
  const fgP = picker(UI.fg, "fg");
  const bgP = picker(UI.bg, "bg");
  const swap = button("try-btn gp-ghost cc-icon-btn", "⇄ " + UI.swap);
  swap.addEventListener("click", () => { const t = S.fg; S.fg = S.bg; S.bg = t; render(); });
  const pickers = el("div", "cc-pickers");
  pickers.append(fgP.wrap, swap, bgP.wrap);

  // Score.
  const ratioEl = el("div", "cc-ratio");
  ratioEl.setAttribute("aria-label", UI.ratioLabel);
  ratioEl.dir = "ltr";
  const verdict = el("span", "cc-verdict");
  const score = el("div", "cc-score");
  score.setAttribute("role", "status");
  score.append(ratioEl, verdict);
  const gradeList = el("ul", "cc-grades");
  const gradeEls = UI.grades.map(([k, label, need]) => {
    const li = el("li", "cc-grade");
    const b = el("b");
    li.append(b, el("span", null, label + " · " + need));
    gradeList.append(li);
    return [k, li, b];
  });
  const main = el("div", "ft-box gp-form");
  main.append(pickers, score, gradeList);

  // Preview.
  const prev = el("div", "cc-preview");
  const ph = el("h3", null, UI.sample.h);
  const pp = el("p", null, UI.sample.p);
  const ps = el("small", null, UI.sample.small);
  const prow = el("div", "cc-preview-row");
  prow.append(el("span", "cc-btn", UI.sample.btn), el("span", "cc-link", UI.sample.link));
  prev.append(ph, pp, prow, ps);
  const prevCard = el("section", "gp-card");
  prevCard.append(el("h2", "gp-h", UI.previewTitle), prev);

  // Fixes.
  const levels = el("div", "cc-levels");
  levels.append(el("span", null, UI.levelLabel + ":"));
  const levelBtns = UI.levels.map(([v, label]) => {
    const b = button("cc-level", label);
    b.addEventListener("click", () => { S.target = Number(v); render(); });
    levels.append(b);
    return [Number(v), b];
  });
  const fixes = el("div", "cc-fix");
  const fixCard = el("section", "gp-card");
  fixCard.append(el("h2", "gp-h", UI.fixTitle), levels, fixes);

  const side = el("div", "gp-side");
  side.append(prevCard, fixCard);
  const grid = el("div", "gp-grid");
  grid.append(main, side);

  // Palette.
  const pal = el("div", "cc-pal");
  const addBtn = button("try-btn gp-ghost ic-small", "+ " + UI.paletteAdd);
  const exBtn = button("try-btn gp-ghost ic-small", UI.paletteExample);
  const palCount = el("p", "gp-hint");
  const pairs = el("div", "cc-pairs");
  const palCard = el("section", "gp-card");
  palCard.append(el("h2", "gp-h", UI.paletteTitle), el("p", "gp-hint", UI.paletteHint), pal, palCount, pairs);
  addBtn.addEventListener("click", () => { if (S.palette.length < 6) { S.palette.push(S.palette.length % 2 ? "#ffffff" : "#14213d"); renderPalette(); } });
  exBtn.addEventListener("click", () => { S.palette = DATA.palette.slice(); renderPalette(); });

  app.textContent = "";
  app.append(grid, palCard);

  function fixRow(text, hex, onUse) {
    const r = el("div", "cc-fix-row");
    if (hex) { const c = el("span", "cc-chip"); c.style.background = hex; r.append(c); }
    const t = el("span", "cc-fix-text");
    t.append(document.createTextNode(text + " "));
    if (hex) t.append(el("code", null, hex));
    r.append(t);
    if (onUse) { const b = button("try-btn ic-small", UI.use); b.addEventListener("click", onUse); r.append(b); }
    return r;
  }

  function render(fromText) {
    const fg = API.parseColor(S.fg), bg = API.parseColor(S.bg);
    fgP.sw.value = S.fg; bgP.sw.value = S.bg;
    if (!fromText) { fgP.hex.value = S.fg; bgP.hex.value = S.bg; fgP.err.textContent = bgP.err.textContent = ""; fgP.hex.removeAttribute("aria-invalid"); bgP.hex.removeAttribute("aria-invalid"); }
    const r = API.ratio(fg, bg);
    ratioEl.textContent = "";
    ratioEl.append(document.createTextNode(API.formatRatio(r)), el("small", null, ":1"));
    const g = API.grades(r);
    const lvl = g.aaaNormal ? "aaa" : g.aaNormal ? "aa" : g.aaLarge ? "large" : "fail";
    verdict.dataset.level = lvl;
    verdict.textContent = UI.verdict[lvl];
    gradeEls.forEach(([k, li, b]) => { li.dataset.ok = g[k] ? "1" : "0"; b.textContent = (g[k] ? "✓ " : "✕ ") + (g[k] ? UI.pass : UI.fail); });
    prev.style.background = S.bg;
    prev.style.color = S.fg;
    levelBtns.forEach(([v, b]) => b.setAttribute("aria-pressed", v === S.target ? "true" : "false"));
    fixes.textContent = "";
    const levelName = (UI.levels.find(([v]) => Number(v) === S.target) || ["", ""])[1];
    if (r >= S.target) fixes.append(fixRow(UI.fixNone, null, null));
    else {
      const f = API.suggest(fg, bg, S.target), b2 = API.suggest(bg, fg, S.target);
      fixes.append(f ? fixRow(UI.fixFg.replace("{level}", levelName), f, () => { S.fg = f; render(); }) : fixRow(UI.fixImpossible, null, null));
      if (b2) fixes.append(fixRow(UI.fixBg.replace("{level}", levelName), b2, () => { S.bg = b2; render(); }));
    }
  }

  function renderPalette() {
    pal.textContent = "";
    S.palette.forEach((c, i) => {
      const item = el("div", "cc-pal-item");
      const inp = el("input");
      inp.type = "color";
      inp.value = c;
      inp.setAttribute("aria-label", UI.paletteTitle + " " + (i + 1));
      const code = el("code", null, c);
      inp.addEventListener("input", () => { S.palette[i] = inp.value; code.textContent = inp.value; drawPairs(); });
      const x = button("cc-x", "✕");
      x.setAttribute("aria-label", UI.remove + " " + c);
      x.addEventListener("click", () => { S.palette.splice(i, 1); renderPalette(); });
      item.append(inp, code, x);
      pal.append(item);
    });
    if (S.palette.length < 6) pal.append(addBtn);
    pal.append(exBtn);
    drawPairs();
  }
  function drawPairs() {
    const m = API.paletteMatrix(S.palette);
    pairs.textContent = "";
    const ok = m.filter((p) => p.ratio >= 4.5).length;
    palCount.textContent = m.length ? UI.paletteCount.replace("{n}", String(ok)).replace("{t}", String(m.length)) : "";
    const shown = m.filter((p) => p.ratio >= 3);
    if (m.length && !shown.length) { pairs.append(el("p", "gp-hint", UI.paletteNone)); return; }
    shown.slice(0, 12).forEach((p) => {
      const d = el("div", "cc-pair");
      d.style.background = p.bg;
      d.style.color = p.fg;
      if (p.ratio < 4.5) d.dataset.fail = "1";
      d.append(el("b", null, "Aa"), el("span", null, API.formatRatio(p.ratio) + ":1 · " + (p.ratio >= 7 ? "AAA" : p.ratio >= 4.5 ? "AA" : "AA large")));
      d.title = p.fg + " / " + p.bg;
      pairs.append(d);
    });
  }

  render();
  renderPalette();
})(typeof globalThis !== "undefined" ? globalThis : this);
