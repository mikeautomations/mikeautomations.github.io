// /en/open-graph-generator/ and /he/open-graph-generator/ client logic. Progressive enhancement: without JS the
// page shows example tags. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/open-graph.ts with the types removed (made with the TypeScript
// compiler). tests/open-graph-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="og-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to open-graph.ts) ----------
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  /** An address with or without https://, returned with it. Empty when it doesn't look like a web address. */
  function normalizeUrl(input) {
      let u = clean(input);
      if (!u)
          return "";
      if (!/^https?:\/\//i.test(u))
          u = "https://" + u;
      return /^https?:\/\/[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?([/?#]\S*)?$/iu.test(u) ? u : "";
  }
  /** "https://www.shop.co.uk/a/b" -> "shop.co.uk" (what most platforms show under the title). */
  function domainOf(url) {
      const m = normalizeUrl(url).match(/^https?:\/\/(?:www\.)?([^/:?#]+)/i);
      return m ? m[1].toLowerCase() : "";
  }
  function escapeAttr(s) {
      return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /** The <meta> tags to paste into <head>. Empty fields are left out. */
  function ogTags(o) {
      const lines = [];
      const add = (attr, key, value) => { if (value)
          lines.push(`<meta ${attr}="${key}" content="${escapeAttr(value)}">`); };
      const url = normalizeUrl(o.url || "");
      const image = normalizeUrl(o.image || "");
      const title = clean(o.title), desc = clean(o.description);
      add("property", "og:type", clean(o.type) || "website");
      add("property", "og:title", title);
      add("property", "og:description", desc);
      add("property", "og:url", url);
      add("property", "og:site_name", clean(o.siteName));
      add("property", "og:locale", clean(o.locale));
      add("property", "og:image", image);
      if (image)
          add("property", "og:image:alt", clean(o.imageAlt));
      add("name", "twitter:card", image ? "summary_large_image" : "summary");
      add("name", "twitter:title", title);
      add("name", "twitter:description", desc);
      add("name", "twitter:image", image);
      const handle = clean(o.twitter).replace(/^@?/, "");
      if (/^[A-Za-z0-9_]{1,15}$/.test(handle))
          add("name", "twitter:site", "@" + handle);
      return lines.join("\n");
  }
  /** What to fix before sharing. imageW/imageH are the image's real size when the browser could load it. */
  function checkOg(o) {
      const c = [];
      const title = clean(o.title), desc = clean(o.description);
      const tl = Array.from(title).length, dl = Array.from(desc).length;
      c.push(!tl ? { id: "title_missing", level: "bad" } : tl > 65 ? { id: "title_long", level: "warn" } : tl < 15 ? { id: "title_short", level: "warn" } : { id: "title_ok", level: "ok" });
      c.push(!dl ? { id: "desc_missing", level: "warn" } : dl > 160 ? { id: "desc_long", level: "warn" } : dl < 50 ? { id: "desc_short", level: "warn" } : { id: "desc_ok", level: "ok" });
      if (!clean(o.url))
          c.push({ id: "url_missing", level: "warn" });
      else if (!normalizeUrl(o.url || ""))
          c.push({ id: "url_bad", level: "bad" });
      const rawImg = clean(o.image);
      if (!rawImg)
          c.push({ id: "image_missing", level: "bad" });
      else if (!/^https?:\/\//i.test(rawImg) && !/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+\//u.test(rawImg))
          c.push({ id: "image_relative", level: "bad" });
      else {
          if (/^http:\/\//i.test(rawImg))
              c.push({ id: "image_http", level: "warn" });
          const w = o.imageW || 0, h = o.imageH || 0;
          if (w && h) {
              if (w < 600 || h < 315)
                  c.push({ id: "image_tiny", level: "bad" });
              else if (w < 1200 || h < 630)
                  c.push({ id: "image_small", level: "warn" });
              const r = w / h;
              if (Math.abs(r - 1.91) > 0.15)
                  c.push({ id: "image_ratio", level: "warn" });
              if (w >= 1200 && h >= 630 && Math.abs(r - 1.91) <= 0.15)
                  c.push({ id: "image_ok", level: "ok" });
          }
          if (!clean(o.imageAlt))
              c.push({ id: "alt_missing", level: "warn" });
      }
      if (!clean(o.siteName))
          c.push({ id: "site_missing", level: "warn" });
      return c;
  }
  /** Shortens text for a preview card the way most platforms do: whole characters, ending with "…". */
  function clip(text, max) {
      const a = Array.from(clean(text));
      return a.length <= max ? a.join("") : a.slice(0, Math.max(1, max - 1)).join("").replace(/\s+\S*$/, "") + "…";
  }

  const API = { normalizeUrl, domainOf, escapeAttr, ogTags, checkOg, clip };
  root.OpenGraph = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("og-app");
  const dataEl = document.getElementById("og-data");
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
  function field(key) {
    const f = UI.fields[key];
    const id = "og-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    const c = f.area ? el("textarea") : el("input");
    if (f.area) c.rows = 3; else c.type = "text";
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    c.dir = f.ltr ? "ltr" : "auto";
    c.spellcheck = !f.ltr;
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }

  // Form.
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const file = el("input");
  file.type = "file";
  file.accept = "image/*";
  file.id = "og-file";
  const fileLab = el("label", null, UI.orUpload);
  fileLab.htmlFor = "og-file";
  const upload = el("div", "og-upload");
  upload.append(fileLab, file, el("span", "gp-hint", UI.uploadNote));
  const more = el("details", "gp-more");
  more.append(el("summary", null, UI.more), field("siteName"), field("imageAlt"), field("twitter"));
  const form = el("div", "ft-box gp-form");
  form.append(formTop, field("title"), field("description"), field("url"), field("image"), upload, more);

  // Previews.
  const tabsBox = el("div", "gp-tabs");
  tabsBox.setAttribute("role", "tablist");
  let tab = "facebook";
  const tabBtns = UI.tabs.map(([k, l]) => {
    const b = button("gp-tab", l);
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => { tab = k; render(); });
    tabsBox.append(b);
    return [k, b];
  });
  const stage = el("div", "og-stage");
  stage.setAttribute("role", "tabpanel");
  const head = el("div", "gp-card-head");
  head.append(el("h2", "gp-h", UI.previewTitle), tabsBox);
  const prevCard = el("section", "gp-card");
  prevCard.append(head, stage, el("p", "gp-note", UI.approx));

  const checks = el("ul", "gp-checks");
  checks.style.marginTop = "0.9rem";
  const checksCard = el("section", "gp-card");
  checksCard.append(el("h2", "gp-h", UI.checksTitle), checks);

  const code = el("textarea", "gp-code-box");
  code.readOnly = true;
  code.rows = 12;
  code.dir = "ltr";
  code.spellcheck = false;
  code.setAttribute("aria-label", UI.codeTitle);
  const copyBtn = button("try-btn try-btn-primary", UI.copy);
  const status = el("p", "gp-status");
  status.setAttribute("role", "status");
  const dbg = el("p", "og-dbg");
  const a1 = el("a", null, UI.fbDebug);
  a1.href = "https://developers.facebook.com/tools/debug/";
  const a2 = el("a", null, UI.liDebug);
  a2.href = "https://www.linkedin.com/post-inspector/";
  [a1, a2].forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
  dbg.append(document.createTextNode(UI.debuggers), a1, document.createTextNode(" · "), a2);
  const row = el("div", "try-controls");
  row.append(copyBtn, status);
  const codeCard = el("section", "gp-card gp-code");
  codeCard.append(el("h2", "gp-h", UI.codeTitle), el("p", "gp-hint", UI.codeHint), code, row, dbg);

  const side = el("div", "gp-side");
  side.append(prevCard, checksCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid, codeCard);

  // The image: either the address typed (loaded to read its size) or a local file shown only here.
  let img = { src: "", w: 0, h: 0, local: false };
  let loadId = 0;
  function loadImage(src, local) {
    const id = ++loadId;
    if (!src) { img = { src: "", w: 0, h: 0, local: false }; render(); return; }
    const im = new Image();
    im.onload = () => { if (id === loadId) { img = { src, w: im.naturalWidth, h: im.naturalHeight, local }; render(); } };
    im.onerror = () => { if (id === loadId) { img = { src: "", w: 0, h: 0, local: false }; render(); } };
    im.src = src;
  }
  function demoImage() {
    const c = document.createElement("canvas");
    c.width = 1200; c.height = 630;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 1200, 630);
    gr.addColorStop(0, "#14213d"); gr.addColorStop(1, "#1f6fd1");
    g.fillStyle = gr; g.fillRect(0, 0, 1200, 630);
    const rtl = !!DATA.rtl, x = rtl ? 1120 : 80;
    g.direction = rtl ? "rtl" : "ltr";
    g.textAlign = rtl ? "right" : "left";
    g.fillStyle = "#2fd38a"; g.fillRect(rtl ? 1000 : 80, 120, 120, 12);
    g.fillStyle = "#ffffff"; g.font = "800 76px system-ui, Arial, sans-serif";
    g.fillText(rtl ? "שירות שנתי לדוד" : "Annual boiler service", x, 260);
    g.font = "600 44px system-ui, Arial, sans-serif"; g.fillStyle = "#cfe0ff";
    g.fillText(rtl ? "טכנאים מוסמכים, תור השבוע" : "From £75 · same-week visits", x, 340);
    return c.toDataURL("image/jpeg", 0.85);
  }

  const values = () => { const v = {}; for (const k in inputs) v[k] = inputs[k].value; return v; };
  function card(v) {
    const title = (v.title || "").trim() || UI.emptyTitle;
    const desc = (v.description || "").trim();
    const domain = API.domainOf(v.url) || "yourbusiness.com";
    const media = () => {
      if (img.src) { const i = el("img", "og-img"); i.src = img.src; i.alt = v.imageAlt || ""; return i; }
      return el("div", "og-noimg", UI.noImage);
    };
    const t = el("div", "og-title", title); t.dir = "auto";
    const d = el("div", "og-desc", desc); d.dir = "auto";
    if (tab === "facebook") {
      const c = el("div", "og-card og-fb"); const b = el("div", "og-body");
      b.append(el("div", "og-domain", domain), t); if (desc) b.append(d);
      c.append(media(), b); return c;
    }
    if (tab === "linkedin") {
      const c = el("div", "og-card og-li"); const b = el("div", "og-body");
      b.append(t, el("div", "og-domain", domain)); c.append(media(), b); return c;
    }
    if (tab === "x") {
      const c = el("div", "og-card og-x");
      c.append(media());
      if (img.src) { const xt = el("div", "og-xtitle", API.clip(title, 70)); xt.dir = "auto"; c.append(xt); }
      else { const b = el("div", "og-body"); b.style.padding = "10px 12px 0"; b.append(t); c.append(b); }
      c.append(el("div", "og-domain", (DATA.rtl ? "מ-" : "From ") + domain)); return c;
    }
    const wrap = el("div", "og-card og-wa"); wrap.style.background = "#efeae2";
    const bubble = el("div", "og-wa-bubble"); const wc = el("div", "og-wa-card"); const b = el("div", "og-body");
    b.append(t); if (desc) b.append(d); b.append(el("div", "og-domain", domain));
    wc.append(media(), b);
    bubble.append(wc, el("div", "og-wa-link", API.normalizeUrl(v.url) || "https://" + domain));
    wrap.append(bubble); return wrap;
  }

  function render() {
    const v = values();
    tabBtns.forEach(([k, b]) => b.setAttribute("aria-selected", k === tab ? "true" : "false"));
    stage.textContent = "";
    stage.append(card(v));
    const r = API.checkOg({ ...v, imageW: img.w, imageH: img.h });
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
    code.value = API.ogTags(v);
  }

  let timer = 0;
  inputs.image.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { const u = API.normalizeUrl(inputs.image.value); file.value = ""; loadImage(u, false); }, 400);
  });
  file.addEventListener("change", () => { const f = file.files && file.files[0]; if (f) loadImage(URL.createObjectURL(f), true); });
  form.addEventListener("input", () => { status.textContent = ""; render(); });
  tryBtn.addEventListener("click", () => {
    for (const k in inputs) inputs[k].value = DATA.example[k] || "";
    inputs.image.value = (API.normalizeUrl(DATA.example.url) || "").replace(/\/[^/]*\/?$/, "") + "/images/share.jpg";
    loadImage(demoImage(), true);
    inputs.title.focus();
  });
  clearBtn.addEventListener("click", () => { for (const k in inputs) inputs[k].value = ""; file.value = ""; loadImage("", false); inputs.title.focus(); });
  copyBtn.addEventListener("click", () => {
    const done = () => { status.textContent = UI.copied; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, () => { status.textContent = UI.copyFailed; });
    else { code.select(); try { document.execCommand("copy") ? done() : (status.textContent = UI.copyFailed); } catch (e) { status.textContent = UI.copyFailed; } }
  });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
