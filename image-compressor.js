// /en/image-compressor/ and /he/image-compressor/ client logic. Progressive enhancement: without JS the page
// explains sizes. No dependencies and no uploads: pictures are resized and compressed in the browser with <canvas>.
// PART 1 is a copy of src/app/landing/data/tools/image-compress.ts with the types removed (made with the TypeScript
// compiler). tests/image-compressor.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="ic-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to image-compress.ts) ----------
  /** Sizes small businesses need most. "fit" keeps the shape inside the box; "cover" fills it exactly and crops. */
  const PRESETS = [
      { id: "website", w: 1920, h: 1920, mode: "fit" },
      { id: "blog", w: 1200, h: 1200, mode: "fit" },
      { id: "gbp", w: 1200, h: 900, mode: "cover" },
      { id: "share", w: 1200, h: 630, mode: "cover" },
      { id: "square", w: 1080, h: 1080, mode: "cover" },
      { id: "story", w: 1080, h: 1920, mode: "cover" },
      { id: "logo", w: 512, h: 512, mode: "fit" },
      { id: "original", w: 0, h: 0, mode: "fit" },
  ];
  /** Output size that fits inside maxW x maxH without enlarging. 0 means no limit on that side. */
  function fitSize(w, h, maxW, maxH) {
      if (!(w > 0) || !(h > 0))
          return { w: 0, h: 0 };
      const s = Math.min(1, maxW > 0 ? maxW / w : 1, maxH > 0 ? maxH / h : 1);
      return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }
  /** The centred part of the source to draw so it fills tw x th exactly, and the output size (never enlarged). */
  function coverCrop(w, h, tw, th) {
      if (!(w > 0) || !(h > 0) || !(tw > 0) || !(th > 0))
          return { sx: 0, sy: 0, sw: w || 0, sh: h || 0, w: w || 0, h: h || 0 };
      const target = tw / th;
      let sw = w, sh = h;
      if (w / h > target)
          sw = Math.round(h * target);
      else
          sh = Math.round(w / target);
      const s = Math.min(1, tw / sw);
      return { sx: Math.round((w - sw) / 2), sy: Math.round((h - sh) / 2), sw, sh, w: Math.max(1, Math.round(sw * s)), h: Math.max(1, Math.round(sh * s)) };
  }
  /** Where to draw from, and the final size, for a preset (or a custom width). */
  function plan(w, h, preset, customW = 0) {
      if (customW > 0) {
          const f = fitSize(w, h, customW, 0);
          return { sx: 0, sy: 0, sw: w, sh: h, ...f };
      }
      if (preset.mode === "cover")
          return coverCrop(w, h, preset.w, preset.h);
      const f = fitSize(w, h, preset.w, preset.h);
      return { sx: 0, sy: 0, sw: w, sh: h, ...f };
  }
  /** 1536 -> "1.5 KB" style sizes. */
  function formatBytes(n) {
      if (!(n >= 0))
          return "";
      if (n < 1024)
          return n + " B";
      if (n < 1024 * 1024)
          return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
      return (n / 1024 / 1024).toFixed(1) + " MB";
  }
  /** How much smaller, in whole percent (negative when the new file is bigger). */
  function saving(before, after) {
      if (!(before > 0) || !(after >= 0))
          return 0;
      return Math.round((1 - after / before) * 100);
  }
  /** A tidy file name for the new picture: "Shop Front (2).JPG" -> "shop-front-2-1200.webp". */
  function outName(name, width, ext) {
      const base = String(name || "image").replace(/\.[^.]*$/, "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
          .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
      return base + (width > 0 ? "-" + width : "") + "." + ext;
  }
  /** Notes on one result: still heavy, smaller than the target, got bigger, or fine. */
  function checkResult(r) {
      const c = [];
      if (r.after > r.before)
          c.push({ id: "bigger", level: "warn" });
      if (r.targetW > 0 && r.srcW < r.targetW && r.srcH < r.targetW)
          c.push({ id: "small_source", level: "warn" });
      if (r.after > 500 * 1024)
          c.push({ id: "heavy", level: "warn" });
      else if (r.after <= 200 * 1024)
          c.push({ id: "light", level: "ok" });
      else
          c.push({ id: "fine", level: "ok" });
      return c;
  }

  const API = { PRESETS, fitSize, coverCrop, plan, formatBytes, saving, outName, checkResult };
  root.ImageCompress = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ic-app");
  const dataEl = document.getElementById("ic-data");
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

  // Drop zone.
  const file = el("input", "ic-file");
  file.type = "file";
  file.accept = "image/*";
  file.multiple = true;
  file.id = "ic-file";
  file.setAttribute("aria-label", UI.choose);
  const pick = el("label", "try-btn try-btn-primary", UI.choose);
  pick.htmlFor = "ic-file";
  pick.setAttribute("role", "button");
  pick.tabIndex = 0;
  pick.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  const icon = el("span", "ic-drop-ic", "🖼️");
  icon.setAttribute("aria-hidden", "true");
  const drop = el("div", "ic-drop");
  drop.append(icon, el("h2", null, UI.drop), el("p", null, UI.dropSub), pick, file, el("p", "ic-privacy", UI.privacy));

  // Settings.
  let preset = API.PRESETS[0];
  const presetBox = el("div", "ic-presets");
  presetBox.setAttribute("role", "group");
  presetBox.setAttribute("aria-label", UI.stepSize);
  const presetBtns = API.PRESETS.map((p) => {
    const b = button("ic-preset");
    b.append(el("b", null, UI.presets[p.id][0]), el("span", null, UI.presets[p.id][1]));
    b.addEventListener("click", () => { preset = p; customW.value = ""; sync(); rerun(); });
    presetBox.append(b);
    return [b, p];
  });
  const customW = el("input");
  customW.type = "number";
  customW.min = "16";
  customW.max = "8000";
  customW.inputMode = "numeric";
  customW.setAttribute("aria-label", UI.custom + " (" + UI.px + ")");
  const custom = el("label", "ic-custom");
  custom.append(document.createTextNode(UI.custom), customW, document.createTextNode(UI.px));
  customW.addEventListener("change", () => { sync(); rerun(); });

  const fmt = el("select");
  UI.formats.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; fmt.append(o); });
  fmt.id = "ic-fmt";
  const fmtLab = el("label", null, UI.stepFormat);
  fmtLab.htmlFor = "ic-fmt";
  const fmtWrap = el("div", "ft-field gp-field");
  fmtWrap.append(fmtLab, fmt);
  const q = el("input");
  q.type = "range";
  q.min = "40";
  q.max = "95";
  q.value = "80";
  q.id = "ic-q";
  const qOut = el("output", null, "80");
  const qLab = el("label", null, UI.quality);
  qLab.htmlFor = "ic-q";
  const qRow = el("div", "ic-q");
  qRow.append(q, qOut);
  const qWrap = el("div", "ft-field gp-field");
  qWrap.append(qLab, el("span", "ft-hint gp-hint", UI.qualityHint), qRow);
  q.addEventListener("input", () => { qOut.textContent = q.value; });
  q.addEventListener("change", rerun);
  fmt.addEventListener("change", () => { qWrap.hidden = fmt.value === "png"; rerun(); });

  const step = (title, ...kids) => { const f = el("fieldset", "ic-step"); f.append(el("legend", null, title), ...kids); return f; };
  const form = el("div", "ft-box gp-form");
  form.append(drop, step(UI.stepSize, presetBox, custom), step(UI.stepFormat, fmtWrap, qWrap));
  fmtWrap.firstChild.className = "gp-sr";

  // Results.
  const totalText = el("p", "ic-total-text");
  totalText.setAttribute("role", "status");
  const allBtn = button("try-btn try-btn-primary ic-small", UI.downloadAll);
  const clearBtn = button("try-btn gp-ghost ic-small", UI.clear);
  const acts = el("div", "ic-row");
  acts.append(allBtn, clearBtn);
  const total = el("div", "ic-total");
  total.append(totalText, acts);
  const list = el("div", "ic-list");
  const card = el("section", "gp-card");
  card.setAttribute("aria-label", UI.resultsTitle);
  card.append(el("h2", "gp-h", UI.resultsTitle), total, list);
  const side = el("div", "gp-side");
  side.append(card);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  function sync() {
    const cw = parseInt(customW.value, 10) > 0;
    presetBtns.forEach(([b, p]) => b.setAttribute("aria-pressed", !cw && p === preset ? "true" : "false"));
  }

  // Each item: the source file, its decoded image, and the latest result.
  let items = [];
  let runId = 0;
  const ext = () => (fmt.value === "jpeg" ? "jpg" : fmt.value);

  function load(f) {
    return new Promise((res) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  function encode(it) {
    const w = it.img.naturalWidth, h = it.img.naturalHeight;
    const cw = parseInt(customW.value, 10);
    const p = API.plan(w, h, preset, cw > 0 ? Math.min(cw, 8000) : 0);
    const cv = document.createElement("canvas");
    cv.width = p.w;
    cv.height = p.h;
    const g = cv.getContext("2d");
    if (fmt.value === "jpeg") { g.fillStyle = "#ffffff"; g.fillRect(0, 0, p.w, p.h); }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(it.img, p.sx, p.sy, p.sw, p.sh, 0, 0, p.w, p.h);
    const type = "image/" + fmt.value;
    return new Promise((res) => cv.toBlob((b) => res({ blob: b, w: p.w, h: p.h, target: cw > 0 ? cw : preset.w }), type, fmt.value === "png" ? undefined : Number(q.value) / 100));
  }

  function row(it) {
    const r = el("div", "ic-item");
    const th = el("img", "ic-thumb");
    th.alt = "";
    const body = el("div", "ic-body");
    const name = el("p", "ic-name", it.file.name);
    name.style.margin = "0";
    const sizes = el("div", "ic-sizes");
    const bar = el("div", "ic-bar");
    const fill = el("i");
    fill.style.width = "0%";
    bar.append(fill);
    const note = el("p", "ic-note", UI.working);
    const dl = button("try-btn try-btn-primary ic-small", UI.download);
    dl.disabled = true;
    const actions = el("div", "ic-row");
    actions.append(dl);
    body.append(name, sizes, bar, note, actions);
    r.append(th, body);
    it.ui = { r, th, sizes, fill, note, dl };
    dl.addEventListener("click", () => save(it));
    return r;
  }

  function show(it) {
    const u = it.ui;
    if (!it.img) { u.note.textContent = UI.failed; u.note.dataset.level = "warn"; u.sizes.textContent = API.formatBytes(it.file.size); return; }
    if (!it.out) return;
    const s = API.saving(it.file.size, it.out.blob.size);
    u.sizes.textContent = "";
    const badge = el("span", "ic-badge", (s >= 0 ? UI.saved : UI.grew).replace("{p}", String(Math.abs(s))));
    if (s < 0) badge.dataset.bad = "1";
    u.sizes.append(document.createTextNode(API.formatBytes(it.file.size) + " → " + API.formatBytes(it.out.blob.size) + " · " + it.out.w + "×" + it.out.h + " "), badge);
    u.fill.style.width = Math.max(2, Math.min(100, 100 - Math.max(0, s))) + "%";
    const checks = API.checkResult({ srcW: it.img.naturalWidth, srcH: it.img.naturalHeight, outW: it.out.w, outH: it.out.h, before: it.file.size, after: it.out.blob.size, targetW: it.out.target });
    const worst = checks.find((c) => c.level !== "ok") || checks[0];
    u.note.textContent = UI.checks[worst.id];
    u.note.dataset.level = worst.level;
    if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    it.outUrl = URL.createObjectURL(it.out.blob);
    u.th.src = it.outUrl;
    u.dl.disabled = false;
  }

  function totals() {
    const done = items.filter((i) => i.out);
    allBtn.hidden = done.length < 2;
    clearBtn.hidden = !items.length;
    total.hidden = !items.length;
    if (!items.length) { list.textContent = ""; list.append(el("p", "ic-empty", UI.empty)); return; }
    const b = done.reduce((a, i) => a + i.file.size, 0), a = done.reduce((s, i) => s + i.out.blob.size, 0);
    totalText.textContent = "";
    totalText.append(document.createTextNode(UI.total.replace("{n}", String(done.length)).replace("{before}", API.formatBytes(b)).replace("{after}", API.formatBytes(a)) + " "));
    const s = API.saving(b, a);
    if (done.length) totalText.append(el("b", null, (s >= 0 ? UI.saved : UI.grew).replace("{p}", String(Math.abs(s)))));
  }

  async function process(it, id) {
    if (!it.img) { show(it); return; }
    it.ui.note.textContent = UI.working;
    it.ui.note.dataset.level = "";
    it.ui.dl.disabled = true;
    const out = await encode(it);
    if (id !== runId || !out.blob) return;
    it.out = out;
    show(it);
    totals();
  }
  async function rerun() {
    const id = ++runId;
    for (const it of items) { if (id !== runId) return; await process(it, id); }
    totals();
  }
  async function add(files) {
    const imgs = Array.from(files).filter((f) => /^image\//.test(f.type) || /\.(heic|heif|avif|jpe?g|png|webp|gif|bmp)$/i.test(f.name));
    if (!imgs.length) return;
    if (!items.length) list.textContent = "";
    const fresh = imgs.map((f) => ({ file: f }));
    fresh.forEach((it) => list.append(row(it)));
    items = items.concat(fresh);
    totals();
    const id = runId;
    for (const it of fresh) {
      const l = await load(it.file);
      if (l) { it.img = l.img; it.srcUrl = l.url; }
      await process(it, id);
    }
    totals();
  }

  function save(it) {
    if (!it.out) return;
    const a = el("a");
    a.href = it.outUrl;
    a.download = API.outName(it.file.name, it.out.w, ext());
    document.body.append(a);
    a.click();
    a.remove();
  }
  allBtn.addEventListener("click", async () => {
    for (const it of items) { if (it.out) { save(it); await new Promise((r) => setTimeout(r, 350)); } }
  });
  clearBtn.addEventListener("click", () => {
    items.forEach((i) => { if (i.srcUrl) URL.revokeObjectURL(i.srcUrl); if (i.outUrl) URL.revokeObjectURL(i.outUrl); });
    items = [];
    runId++;
    totals();
  });
  file.addEventListener("change", () => { add(file.files || []); file.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.dataset.over = "1"; }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.dataset.over = "0"; }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer) add(e.dataTransfer.files); });
  document.addEventListener("paste", (e) => { const f = e.clipboardData && e.clipboardData.files; if (f && f.length) add(f); });
  sync();
  totals();
})(typeof globalThis !== "undefined" ? globalThis : this);
