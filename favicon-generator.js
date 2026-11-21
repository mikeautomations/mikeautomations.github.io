// /en/favicon-generator/ and /he/favicon-generator/ client logic. Progressive enhancement: without JS the page
// explains favicons. No dependencies and no uploads: icons are drawn with <canvas> and packaged (ICO, ZIP) here.
// PART 1 is a copy of src/app/landing/data/tools/favicon.ts with the types removed (made with the TypeScript
// compiler). tests/favicon-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="fv-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to favicon.ts) ----------
  /** PNG sizes in the download: browsers, Google results, Apple home screen and Android/PWA. */
  const SIZES = [16, 32, 48, 96, 180, 192, 512];
  const ICO_SIZES = [16, 32, 48];
  let CRC_TABLE = null;
  /** CRC-32 (the checksum ZIP files use). */
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
  const ascii = (s) => Array.from(s).map((c) => c.charCodeAt(0) & 0x7f);
  /** A ZIP file with the files stored as they are (PNG is already compressed). Names must be plain ASCII. */
  function makeZip(files) {
      const local = [];
      const central = [];
      let offset = 0;
      // A fixed date (1 January 2026, 00:00) so the same icons always give the same file.
      const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;
      for (const f of files) {
          const name = ascii(f.name);
          const crc = crc32(f.data);
          const head = bytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), name]);
          local.push(head, f.data);
          central.push(bytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
          offset += head.length + f.data.length;
      }
      const cd = bytes(central);
      return bytes([...local, cd, bytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])]);
  }
  /** A .ico file holding PNG images (supported by all current browsers). */
  function makeIco(images) {
      const head = [...u16(0), ...u16(1), ...u16(images.length)];
      let offset = 6 + 16 * images.length;
      const dir = [];
      for (const im of images) {
          dir.push(im.size >= 256 ? 0 : im.size, im.size >= 256 ? 0 : im.size, 0, 0, ...u16(1), ...u16(32), ...u32(im.png.length), ...u32(offset));
          offset += im.png.length;
      }
      return bytes([head, dir, ...images.map((i) => i.png)]);
  }
  /** One or two letters for a text icon: "Smith Plumbing" -> "SP", "acme" -> "A", "כהן אינסטלציה" -> "כא". */
  function initials(text, max = 2) {
      const words = String(text || "").trim().split(/[\s\-_.]+/).filter(Boolean);
      if (!words.length)
          return "";
      const letters = words.map((w) => Array.from(w)[0]).filter((c) => /[\p{L}\p{N}]/u.test(c));
      return letters.slice(0, Math.max(1, Math.min(3, max))).join("").toUpperCase();
  }
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : "#ffffff");
  const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  /** The site.webmanifest for Android home screens and installable sites. */
  function manifest(name, color, path = "/") {
      const p = path.endsWith("/") ? path : path + "/";
      return JSON.stringify({
          name: String(name || "").trim() || "My website",
          short_name: (String(name || "").trim() || "Website").slice(0, 12),
          icons: [
              { src: p + "favicon-192.png", sizes: "192x192", type: "image/png" },
              { src: p + "favicon-512.png", sizes: "512x512", type: "image/png" },
          ],
          theme_color: hex(color),
          background_color: hex(color),
          display: "standalone",
      }, null, 2);
  }
  /** The lines to paste into <head>. */
  function headTags(color, path = "/", name = "") {
      const p = path.endsWith("/") ? path : path + "/";
      const lines = [
          `<link rel="icon" href="${p}favicon.ico" sizes="48x48">`,
          `<link rel="icon" type="image/png" sizes="96x96" href="${p}favicon-96.png">`,
          `<link rel="apple-touch-icon" href="${p}apple-touch-icon.png">`,
          `<link rel="manifest" href="${p}site.webmanifest">`,
          `<meta name="theme-color" content="${hex(color)}">`,
      ];
      if (String(name || "").trim())
          lines.push(`<meta name="apple-mobile-web-app-title" content="${attr(String(name).trim().slice(0, 30))}">`);
      return lines.join("\n");
  }
  function lum(h) {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  /** Contrast between two #rrggbb colours (1 to 21). */
  function contrast(a, b) {
      if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b))
          return 21;
      const x = lum(a), y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /** Things that make a favicon hard to read at 16 pixels, or unusable. */
  function checkIcon(o) {
      const c = [];
      if (o.mode === "image") {
          if (!o.imgW || !o.imgH)
              return [{ id: "no_image", level: "bad" }];
          if (Math.abs(o.imgW - o.imgH) > Math.max(o.imgW, o.imgH) * 0.02)
              c.push({ id: "not_square", level: "warn" });
          if (Math.min(o.imgW, o.imgH) < 512)
              c.push({ id: "small_image", level: "warn" });
          else
              c.push({ id: "image_ok", level: "ok" });
          return c;
      }
      const t = Array.from(String(o.text || "").trim());
      if (!t.length)
          return [{ id: "no_text", level: "bad" }];
      if (o.mode === "text" && t.length > 2)
          c.push({ id: "long_text", level: "warn" });
      else
          c.push({ id: "text_ok", level: "ok" });
      if (o.mode === "text" && !o.transparent) {
          const k = contrast(o.fg || "#000000", o.bg || "#ffffff");
          c.push(k < 3 ? { id: "contrast_bad", level: "bad" } : k < 4.5 ? { id: "contrast_low", level: "warn" } : { id: "contrast_ok", level: "ok" });
      }
      if (o.transparent)
          c.push({ id: "transparent", level: "warn" });
      return c;
  }

  const API = { SIZES, ICO_SIZES, crc32, makeZip, makeIco, initials, manifest, headTags, contrast, checkIcon };
  root.Favicon = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("fv-app");
  const dataEl = document.getElementById("fv-data");
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
  let uid = 0;
  const inputs = {};
  function field(key, kind) {
    const f = UI.fields[key];
    const id = "fv-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    const c = el("input");
    c.type = kind || "text";
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    c.dir = key === "path" ? "ltr" : "auto";
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }
  const chipGroup = (label, opts, onPick) => {
    const box = el("div", "fv-chips");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", label);
    const btns = opts.map(([v, l]) => { const b = button("fv-chip", l); b.addEventListener("click", () => onPick(v)); box.append(b); return [v, b]; });
    return { box, set: (val) => btns.forEach(([v, b]) => b.setAttribute("aria-pressed", v === val ? "true" : "false")) };
  };
  const labelled = (text, ...kids) => { const w = el("div", "ft-field"); w.append(el("span", "fv-label", text), ...kids); return w; };
  const step = (title, ...kids) => { const f = el("fieldset", "fv-step"); f.append(el("legend", null, title), ...kids); return f; };

  const S = { source: "text", shape: "rounded", font: "sans", bg: UI.presets[0][0], fg: UI.presets[0][1], pad: 12, img: null, textTouched: false };

  // Step 1: where the icon comes from.
  const srcBox = el("div", "fv-sources");
  const srcBtns = UI.sources.map(([v, l, ic]) => {
    const b = button("fv-source");
    const i = el("span", "fv-source-ic", ic);
    i.setAttribute("aria-hidden", "true");
    b.append(i, el("span", null, l));
    b.addEventListener("click", () => { S.source = v; render(); });
    srcBox.append(b);
    return [v, b];
  });
  const nameWrap = field("name");
  const textWrap = field("text");
  const fontPick = chipGroup(UI.font, UI.fonts, (v) => { S.font = v; render(); });
  const paneText = el("div", "fv-pane");
  paneText.append(textWrap, labelled(UI.font, fontPick.box));
  const emojiWrap = field("emoji");
  const emojis = el("div", "fv-emojis");
  UI.emojiPicks.forEach((e) => { const b = button("fv-emoji", e); b.setAttribute("aria-label", e); b.addEventListener("click", () => { inputs.emoji.value = e; render(); }); emojis.append(b); });
  const paneEmoji = el("div", "fv-pane");
  paneEmoji.append(emojiWrap, emojis);
  const file = el("input");
  file.type = "file";
  file.accept = "image/*";
  file.id = "fv-file";
  const fileLab = el("label", null, UI.upload);
  fileLab.htmlFor = "fv-file";
  const fileWrap = el("div", "ft-field gp-field");
  fileWrap.append(fileLab, el("span", "ft-hint gp-hint", UI.uploadHint), file);
  const pad = el("input");
  pad.type = "range";
  pad.min = "0";
  pad.max = "30";
  pad.value = String(S.pad);
  pad.setAttribute("aria-label", UI.padding);
  const padOut = el("output", null, S.pad + "%");
  const padRow = el("div", "fv-range");
  padRow.append(pad, padOut);
  const paneImage = el("div", "fv-pane");
  paneImage.append(fileWrap, labelled(UI.padding, padRow));
  pad.addEventListener("input", () => { S.pad = Number(pad.value); padOut.textContent = S.pad + "%"; render(); });
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { S.img = img; render(); };
    img.onerror = () => { S.img = null; render(); };
    img.src = URL.createObjectURL(f);
  });

  // Step 2: the look.
  const shapePick = chipGroup(UI.shape, UI.shapes, (v) => { S.shape = v; render(); });
  const swatches = el("div", "fv-swatches");
  const sw = UI.presets.map(([bg, fg]) => {
    const b = button("fv-swatch", "A");
    b.style.background = bg;
    b.style.color = fg;
    b.setAttribute("aria-label", bg + " / " + fg);
    b.addEventListener("click", () => { S.bg = bg; S.fg = fg; bgIn.value = bg; fgIn.value = fg; render(); });
    swatches.append(b);
    return [b, bg, fg];
  });
  const picker = (label, val, on) => { const l = el("label", "fv-picker"); const i = el("input"); i.type = "color"; i.value = val; i.addEventListener("input", () => on(i.value)); l.append(i, document.createTextNode(label)); return [l, i]; };
  const [bgLab, bgIn] = picker(UI.colourBg, S.bg, (v) => { S.bg = v; render(); });
  const [fgLab, fgIn] = picker(UI.colourFg, S.fg, (v) => { S.fg = v; render(); });
  const pickers = el("div", "fv-pickers");
  pickers.append(bgLab, fgLab);

  const tryBtn = button("try-btn", UI.example);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn);
  formTop.append(el("h2", "gp-h", UI.stepSource), btns);
  const form = el("div", "ft-box gp-form");
  form.append(formTop, srcBox, nameWrap, paneText, paneEmoji, paneImage,
    step(UI.stepStyle, labelled(UI.shape, shapePick.box), labelled(UI.colours, swatches, pickers)),
    step(UI.stepDetails, field("path")));
  inputs.path.value = "/";

  // Previews.
  const cv = (size, css) => { const c = document.createElement("canvas"); c.width = size; c.height = size; c.setAttribute("aria-hidden", "true"); if (css) c.style.cssText = css; return c; };
  const hero = cv(288);
  const heroBox = el("div", "fv-hero");
  heroBox.append(hero);
  heroBox.setAttribute("role", "img");
  const tabL = el("div", "fv-tab");
  tabL.dataset.theme = "light";
  const tabD = el("div", "fv-tab");
  tabD.dataset.theme = "dark";
  const tabCv = [cv(32), cv(32)];
  const tabTxt = [el("span"), el("span")];
  tabL.append(tabCv[0], tabTxt[0]);
  tabD.append(tabCv[1], tabTxt[1]);
  const tabs = el("div", "fv-tabs");
  tabs.append(tabL, tabD);
  const gIc = cv(48);
  const gIcBox = el("span", "fv-google-ic");
  gIcBox.append(gIc);
  const gName = el("div", "fv-google-name");
  const gUrl = el("div", "fv-google-url");
  const gText = el("div");
  gText.append(gName, gUrl);
  const gRow = el("div");
  gRow.style.cssText = "display:flex;align-items:center;gap:10px";
  gRow.append(gIcBox, gText);
  const google = el("div", "fv-google");
  google.style.display = "block";
  const gTitle = el("div", "fv-google-title", UI.googleDesc);
  google.append(gRow, gTitle);
  const homeCv = cv(180);
  const homeName = el("span");
  const app1 = el("div", "fv-app");
  app1.append(homeCv, homeName);
  const ghost = () => { const a = el("div", "fv-app"); a.append(el("i"), el("span", null, "")); a.setAttribute("aria-hidden", "true"); return a; };
  const home = el("div", "fv-home");
  home.append(ghost(), app1, ghost());
  const mock = (label, node) => { const w = el("div"); w.append(el("p", "fv-mock-label", label), node); return w; };
  const mocks = el("div", "fv-mocks");
  mocks.append(mock(UI.tabLight + " · " + UI.tabDark, tabs), mock(UI.googleTitle, google), mock(UI.homeTitle, home));
  const prev = el("section", "gp-card");
  prev.setAttribute("aria-label", UI.previewTitle);
  prev.append(el("h2", "gp-h", UI.previewTitle), heroBox, mocks);

  const checks = el("ul", "gp-checks");
  checks.style.marginTop = "0.9rem";
  const zipBtn = button("try-btn try-btn-primary", UI.zip);
  const icoBtn = button("try-btn", UI.ico);
  const pngBtn = button("try-btn", UI.png512);
  const acts = el("div", "fv-actions");
  acts.append(zipBtn, icoBtn, pngBtn);
  const code = el("textarea", "gp-code-box");
  code.readOnly = true;
  code.rows = 6;
  code.dir = "ltr";
  code.spellcheck = false;
  code.setAttribute("aria-label", UI.codeTitle);
  code.style.minHeight = "8rem";
  const copyBtn = button("try-btn", UI.copy);
  const status = el("p", "gp-status");
  status.setAttribute("role", "status");
  const dlCard = el("section", "gp-card gp-code");
  dlCard.append(el("h2", "gp-h", UI.downloadTitle), checks, acts, el("p", "gp-hint", UI.zipHint), el("h3", "gp-h", UI.codeTitle), code, copyBtn, status);

  const side = el("div", "gp-side");
  side.append(prev, dlCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  // Drawing one icon at any size.
  const FONTS = { sans: "800 {s}px system-ui, -apple-system, 'Segoe UI', Arial, sans-serif", round: "800 {s}px 'Arial Rounded MT Bold', 'Varela Round', 'Nunito', system-ui, sans-serif", serif: "700 {s}px Georgia, 'Times New Roman', serif" };
  const content = () => (S.source === "emoji" ? inputs.emoji.value.trim() : inputs.text.value.trim());
  function shapePath(g, n) {
    g.beginPath();
    if (S.shape === "circle") g.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2);
    else if (S.shape === "rounded") { const r = n * 0.22; g.moveTo(r, 0); g.arcTo(n, 0, n, n, r); g.arcTo(n, n, 0, n, r); g.arcTo(0, n, 0, 0, r); g.arcTo(0, 0, n, 0, r); g.closePath(); }
    else g.rect(0, 0, n, n);
  }
  function draw(c, n) {
    if (c.width !== n) { c.width = n; c.height = n; }
    const g = c.getContext("2d");
    g.clearRect(0, 0, n, n);
    const bgOn = S.shape !== "none";
    if (bgOn) { shapePath(g, n); g.fillStyle = S.bg; g.fill(); }
    g.save();
    if (bgOn) { shapePath(g, n); g.clip(); }
    if (S.source === "image") {
      if (S.img) {
        const inset = S.shape === "circle" ? 0.08 : 0;
        const box = n * (1 - 2 * (S.pad / 100 + inset));
        const k = Math.min(box / S.img.naturalWidth, box / S.img.naturalHeight);
        const w = S.img.naturalWidth * k, h = S.img.naturalHeight * k;
        g.imageSmoothingQuality = "high";
        g.drawImage(S.img, (n - w) / 2, (n - h) / 2, w, h);
      }
    } else {
      const t = content();
      if (t) {
        const len = Array.from(t).length;
        const emoji = S.source === "emoji";
        const size = n * (emoji ? 0.68 : len === 1 ? 0.62 : len === 2 ? 0.5 : 0.38) * (S.shape === "circle" ? 0.92 : 1);
        g.font = emoji ? size + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" : FONTS[S.font].replace("{s}", String(size));
        g.fillStyle = S.fg;
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        const m = g.measureText(t);
        const asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
        const scale = Math.min(1, (n * 0.86) / Math.max(1, m.width));
        g.translate(n / 2, n / 2);
        g.scale(scale, scale);
        g.fillText(t, 0, (asc - desc) / 2);
      }
    }
    g.restore();
    return c;
  }

  const siteName = () => inputs.name.value.trim();
  function render() {
    srcBtns.forEach(([v, b]) => b.setAttribute("aria-pressed", v === S.source ? "true" : "false"));
    paneText.hidden = S.source !== "text";
    paneEmoji.hidden = S.source !== "emoji";
    paneImage.hidden = S.source !== "image";
    if (!S.textTouched) inputs.text.value = API.initials(siteName());
    shapePick.set(S.shape);
    fontPick.set(S.font);
    sw.forEach(([b, bg, fg]) => b.setAttribute("aria-pressed", bg === S.bg && fg === S.fg ? "true" : "false"));
    draw(hero, 288);
    tabCv.forEach((c) => draw(c, 32));
    draw(gIc, 48);
    draw(homeCv, 180);
    const nm = siteName() || UI.fallbackName;
    tabTxt[0].textContent = tabTxt[1].textContent = UI.tabTitle.replace("{name}", nm);
    gName.textContent = nm;
    gUrl.textContent = "https://" + (nm.toLowerCase().replace(/[^a-z0-9]+/g, "") || "yourwebsite") + ".com";
    homeName.textContent = nm.slice(0, 12);
    heroBox.setAttribute("aria-label", UI.previewTitle);
    const r = API.checkIcon({ mode: S.source, text: content(), fg: S.fg, bg: S.bg, transparent: S.shape === "none", imgW: S.img ? S.img.naturalWidth : 0, imgH: S.img ? S.img.naturalHeight : 0 });
    checks.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    r.slice().sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const ic = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      ic.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(ic, tx);
      checks.append(li);
    });
    const ready = !r.some((c) => c.level === "bad");
    [zipBtn, icoBtn, pngBtn].forEach((b) => { b.disabled = !ready; });
    code.value = API.headTags(S.shape === "none" ? "#ffffff" : S.bg, inputs.path.value.trim() || "/", siteName());
  }

  // Files.
  const pngOf = (n) => new Promise((res) => draw(document.createElement("canvas"), n).toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), "image/png"));
  async function icoBytes() { const ims = []; for (const s of API.ICO_SIZES) ims.push({ size: s, png: await pngOf(s) }); return API.makeIco(ims); }
  function save(data, name, type) {
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  zipBtn.addEventListener("click", async () => {
    const files = [{ name: "favicon.ico", data: await icoBytes() }];
    for (const s of API.SIZES) files.push({ name: s === 180 ? "apple-touch-icon.png" : "favicon-" + s + ".png", data: await pngOf(s) });
    const enc = new TextEncoder();
    const color = S.shape === "none" ? "#ffffff" : S.bg;
    files.push({ name: "site.webmanifest", data: enc.encode(API.manifest(siteName(), color, inputs.path.value.trim() || "/")) });
    files.push({ name: "head-tags.html", data: enc.encode(code.value + "\n") });
    save(API.makeZip(files), "favicon.zip", "application/zip");
  });
  icoBtn.addEventListener("click", async () => save(await icoBytes(), "favicon.ico", "image/x-icon"));
  pngBtn.addEventListener("click", async () => save(await pngOf(512), "favicon-512.png", "image/png"));
  copyBtn.addEventListener("click", () => {
    const done = () => { status.textContent = UI.copied; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, () => { status.textContent = UI.copyFailed; });
    else { code.select(); try { document.execCommand("copy") ? done() : (status.textContent = UI.copyFailed); } catch (e) { status.textContent = UI.copyFailed; } }
  });
  inputs.text.addEventListener("input", () => { S.textTouched = inputs.text.value.trim() !== ""; });
  form.addEventListener("input", () => { status.textContent = ""; render(); });
  tryBtn.addEventListener("click", () => {
    const x = DATA.example;
    inputs.name.value = x.name;
    S.textTouched = false;
    S.source = x.source; S.bg = x.bg; S.fg = x.fg; S.shape = x.shape; S.font = x.font;
    bgIn.value = x.bg; fgIn.value = x.fg;
    render();
  });
  inputs.name.value = DATA.defaultName || "";
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})(typeof globalThis !== "undefined" ? globalThis : this);
