// /en/google-search-preview/ and /he/google-search-preview/ client logic. Progressive enhancement: without JS the page
// explains the limits and shows a worked example. No dependencies, no requests to us, no cookies or storage.
// PART 1 is a copy of src/app/landing/data/tools/serp-preview.ts with the types removed (made with the TypeScript
// compiler). tests/google-search-preview.test.ts loads this file in a sandbox and checks both copies give identical
// results. PART 2 reads its texts (English or Hebrew) from <script id="gp-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to serp-preview.ts) ----------
  /** Arial advance widths in 1/1000 em for printable ASCII (space to ~), from the standard Arial metrics. */
  const ASCII_W = [
      278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
      556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
      1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
      667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
      333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
      556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p-z { | } ~
  ];
  /** Width of one character in 1/1000 em. Hebrew letters and anything else fall back to an average. */
  function charWidth(ch) {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126)
          return ASCII_W[c - 32];
      if (c >= 0x0590 && c <= 0x05ff)
          return 560; // Hebrew
      if (c === 0x2014 || c === 0x2026)
          return 1000; // em dash, ellipsis
      if (c === 0x2013)
          return 556; // en dash
      if (c === 0x2018 || c === 0x2019)
          return 222; // curly single quotes
      if (c === 0x201c || c === 0x201d)
          return 333; // curly double quotes
      if (c === 0x00a0)
          return 278;
      if (c >= 0xd800 && c <= 0xdfff)
          return 500; // half of an emoji pair
      return 556;
  }
  /** Width in pixels of a string at a font size in pixels. */
  function textWidth(text, size) {
      let w = 0;
      for (const ch of String(text || ""))
          w += ch.length === 2 ? 1000 : charWidth(ch);
      return Math.round((w * size) / 1000);
  }
  /**
   * Wrap text into lines no wider than `width` pixels, at most `maxLines` lines, breaking at spaces like a browser.
   * When it does not fit, the last line ends with " ..." the way Google cuts a result.
   */
  function fitLines(text, size, width, maxLines) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      const px = textWidth(clean, size);
      if (!clean)
          return { lines: [], cut: false, px: 0 };
      const words = clean.split(" ");
      const lines = [];
      let line = "";
      let idx = 0;
      while (idx < words.length && lines.length < maxLines) {
          const w = words[idx];
          const next = line ? line + " " + w : w;
          if (textWidth(next, size) <= width) {
              line = next;
              idx++;
              continue;
          }
          if (line) {
              lines.push(line);
              line = "";
              continue;
          }
          // One word longer than the whole line: break it by characters.
          let part = "";
          for (const ch of w) {
              if (part && textWidth(part + ch, size) > width)
                  break;
              part += ch;
          }
          lines.push(part);
          words[idx] = w.slice(part.length);
          if (!words[idx])
              idx++;
      }
      if (line && lines.length < maxLines) {
          lines.push(line);
          line = "";
      }
      const cut = idx < words.length || line !== "";
      if (cut && lines.length) {
          let last = lines[lines.length - 1];
          while (last && textWidth(last + " ...", size) > width)
              last = last.slice(0, last.lastIndexOf(" ") > 0 ? last.lastIndexOf(" ") : last.length - 1);
          lines[lines.length - 1] = last.replace(/[\s,;:.\-]+$/, "") + " ...";
      }
      return { lines, cut, px };
  }
  /** Where Google cuts things today, roughly: desktop results are about 600px wide, phone results about 340px. */
  const VIEWS = {
      desktop: { title: { size: 20, width: 600, lines: 1 }, desc: { size: 14, width: 600, lines: 2 } },
      mobile: { title: { size: 18, width: 340, lines: 2 }, desc: { size: 14, width: 340, lines: 3 } },
  };
  /** Split an address into the parts Google shows: the host, then the path as "›" crumbs. Accepts it without https://. */
  function parseUrl(input) {
      let raw = String(input || "").trim();
      if (!raw)
          return { ok: false, https: false, host: "", crumbs: [], query: false, length: 0 };
      const hadScheme = /^https?:\/\//i.test(raw);
      if (!hadScheme)
          raw = "https://" + raw;
      const m = raw.match(/^(https?):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?/i);
      if (!m || !/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?$/iu.test(m[2]))
          return { ok: false, https: false, host: "", crumbs: [], query: false, length: raw.length };
      const host = m[2].toLowerCase().replace(/^www\./, "");
      const crumbs = (m[3] || "").split("/").filter(Boolean).map((p) => { try {
          return decodeURIComponent(p);
      }
      catch (e) {
          return p;
      } });
      return { ok: true, https: !hadScheme || m[1].toLowerCase() === "https", host, crumbs, query: !!m[4] && m[4].length > 1, length: raw.length };
  }
  const words = (s) => String(s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  /** The checklist under the preview. Each check has an id the page turns into a sentence, a level and sometimes a number. */
  function checkSnippet(input) {
      const title = String(input.title || "").replace(/\s+/g, " ").trim();
      const desc = String(input.description || "").replace(/\s+/g, " ").trim();
      const kw = String(input.keyword || "").replace(/\s+/g, " ").trim().toLowerCase();
      const brand = String(input.brand || "").replace(/\s+/g, " ").trim().toLowerCase();
      const titlePx = textWidth(title, VIEWS.desktop.title.size);
      const descFit = fitLines(desc, VIEWS.desktop.desc.size, VIEWS.desktop.desc.width, VIEWS.desktop.desc.lines);
      const checks = [];
      const titleChars = [...title].length;
      const descChars = [...desc].length;
      if (!title)
          checks.push({ id: "title_missing", level: "bad" });
      else if (titlePx > VIEWS.desktop.title.width)
          checks.push({ id: "title_long", level: "bad", n: titleChars });
      else if (titleChars < 30)
          checks.push({ id: "title_short", level: "warn", n: titleChars });
      else
          checks.push({ id: "title_ok", level: "ok", n: titleChars });
      if (!desc)
          checks.push({ id: "desc_missing", level: "bad" });
      else if (descFit.cut)
          checks.push({ id: "desc_long", level: "warn", n: descChars });
      else if (descChars < 70)
          checks.push({ id: "desc_short", level: "warn", n: descChars });
      else
          checks.push({ id: "desc_ok", level: "ok", n: descChars });
      if (kw) {
          const at = title.toLowerCase().indexOf(kw);
          if (at < 0)
              checks.push({ id: "kw_title_missing", level: "warn" });
          else if (at > title.length / 2)
              checks.push({ id: "kw_title_late", level: "warn" });
          else
              checks.push({ id: "kw_title_ok", level: "ok" });
          checks.push(desc.toLowerCase().includes(kw) ? { id: "kw_desc_ok", level: "ok" } : { id: "kw_desc_missing", level: "warn" });
      }
      else
          checks.push({ id: "kw_none", level: "warn" });
      if (brand)
          checks.push(title.toLowerCase().includes(brand) ? { id: "brand_ok", level: "ok" } : { id: "brand_missing", level: "warn" });
      const latin = title.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w));
      const shouty = latin.filter((w) => w === w.toUpperCase()).length;
      if (latin.length >= 3 && shouty / latin.length >= 0.5)
          checks.push({ id: "caps", level: "warn" });
      const counts = {};
      let repeated = 0;
      for (const w of words(title)) {
          counts[w] = (counts[w] || 0) + 1;
          if (counts[w] === 3)
              repeated++;
      }
      if (repeated)
          checks.push({ id: "repeat", level: "warn" });
      if (title && desc && title.toLowerCase() === desc.toLowerCase())
          checks.push({ id: "same", level: "warn" });
      const u = parseUrl(input.url);
      if (!String(input.url || "").trim())
          checks.push({ id: "url_missing", level: "warn" });
      else if (!u.ok)
          checks.push({ id: "url_bad", level: "bad" });
      else {
          checks.push(u.https ? { id: "url_https", level: "ok" } : { id: "url_http", level: "bad" });
          if (u.query || u.length > 90)
              checks.push({ id: "url_messy", level: "warn" });
      }
      const pts = { ok: 1, warn: 0.5, bad: 0 };
      const score = checks.length ? Math.round((100 * checks.reduce((s, c) => s + pts[c.level], 0)) / checks.length) : 0;
      return { score, checks, titlePx, titleChars, descChars, descPx: descFit.px };
  }
  function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /** The tags to paste into the page's <head>: title, description, canonical, and the Open Graph tags for link previews. */
  function buildTags(input) {
      const t = String(input.title || "").replace(/\s+/g, " ").trim();
      const d = String(input.description || "").replace(/\s+/g, " ").trim();
      const u = parseUrl(input.url);
      const url = u.ok ? String(input.url).trim().replace(/^(?!https?:\/\/)/i, "https://") : "";
      const img = String(input.image || "").trim();
      const imgOk = /^https?:\/\/\S+$/i.test(img);
      const brand = String(input.brand || "").replace(/\s+/g, " ").trim();
      const out = [];
      if (t)
          out.push(`<title>${escapeHtml(t)}</title>`);
      if (d)
          out.push(`<meta name="description" content="${escapeHtml(d)}">`);
      if (url)
          out.push(`<link rel="canonical" href="${escapeHtml(url)}">`);
      out.push(`<meta property="og:type" content="website">`);
      if (t)
          out.push(`<meta property="og:title" content="${escapeHtml(t)}">`);
      if (d)
          out.push(`<meta property="og:description" content="${escapeHtml(d)}">`);
      if (url)
          out.push(`<meta property="og:url" content="${escapeHtml(url)}">`);
      if (brand)
          out.push(`<meta property="og:site_name" content="${escapeHtml(brand)}">`);
      if (imgOk)
          out.push(`<meta property="og:image" content="${escapeHtml(img)}">`);
      out.push(`<meta name="twitter:card" content="${imgOk ? "summary_large_image" : "summary"}">`);
      return out.join("\n");
  }

  const API = { charWidth, textWidth, fitLines, parseUrl, checkSnippet, buildTags, escapeHtml, VIEWS };
  root.SerpPreview = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("gp-app");
  const dataEl = document.getElementById("gp-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o && o[k] != null ? String(o[k]) : ""));

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const svg = (tag, attrs) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  let uid = 0;
  function field(f, control) {
    const id = "gp-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  function input(f, type) {
    const n = el(type === "area" ? "textarea" : "input");
    if (type !== "area") n.type = type || "text";
    else n.rows = 3;
    if (f.placeholder) n.placeholder = f.placeholder;
    if (f.max) n.maxLength = f.max;
    if (f.ltr) n.dir = "ltr";
    else n.dir = "auto";
    n.spellcheck = type === "area" || type === "text";
    return n;
  }
  function meter() {
    const wrap = el("div", "gp-meter");
    const bar = el("div", "gp-bar");
    const fillEl = el("span", "gp-bar-fill");
    bar.append(fillEl);
    const text = el("span", "gp-meter-text");
    text.setAttribute("aria-live", "polite");
    wrap.append(bar, text);
    return { wrap, fill: fillEl, text };
  }

  const F = UI.fields;
  const iTitle = input(F.title, "text");
  const iDesc = input(F.desc, "area");
  const iUrl = input(F.url, "url");
  iUrl.inputMode = "url";
  iUrl.autocomplete = "url";
  const iKw = input(F.keyword, "text");
  const iBrand = input(F.brand, "text");
  const iImg = input(F.image, "url");
  const mTitle = meter();
  const mDesc = meter();

  const tryBtn = el("button", "try-btn", UI.example);
  tryBtn.type = "button";
  const clearBtn = el("button", "try-btn gp-ghost", UI.clear);
  clearBtn.type = "button";
  const formTop = el("div", "gp-form-top");
  const formH = el("h2", "gp-h", UI.formTitle);
  const formBtns = el("div", "try-controls");
  formBtns.append(tryBtn, clearBtn);
  formTop.append(formH, formBtns);

  const tf = field(F.title, iTitle);
  tf.append(mTitle.wrap);
  const df = field(F.desc, iDesc);
  df.append(mDesc.wrap);
  const more = el("details", "gp-more");
  const moreSum = el("summary", null, UI.more);
  more.append(moreSum, field(F.brand, iBrand), field(F.image, iImg));
  const form = el("div", "ft-box gp-form");
  form.append(formTop, tf, df, field(F.url, iUrl), field(F.keyword, iKw), more);

  // Preview card with three views.
  const views = [["desktop", UI.tabs.desktop], ["mobile", UI.tabs.mobile], ["share", UI.tabs.share]];
  let view = "desktop";
  const tabs = el("div", "gp-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", UI.tabs.label);
  const stage = el("div", "gp-stage");
  stage.setAttribute("role", "tabpanel");
  stage.id = "gp-stage";
  const tabBtns = views.map(([id, label]) => {
    const b = el("button", "gp-tab", label);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "gp-stage");
    b.dataset.view = id;
    b.addEventListener("click", () => { view = id; render(); });
    b.addEventListener("keydown", (e) => {
      const i = views.findIndex((v) => v[0] === view);
      const dir = DATA.rtl ? -1 : 1;
      let j = -1;
      if (e.key === "ArrowRight") j = (i + dir + views.length) % views.length;
      if (e.key === "ArrowLeft") j = (i - dir + views.length) % views.length;
      if (j >= 0) { e.preventDefault(); view = views[j][0]; render(); tabBtns[j].focus(); }
    });
    tabs.append(b);
    return b;
  });
  const note = el("p", "gp-note", UI.note);
  const prevCard = el("section", "gp-card gp-preview");
  prevCard.setAttribute("aria-label", UI.previewTitle);
  const prevHead = el("div", "gp-card-head");
  prevHead.append(el("h2", "gp-h", UI.previewTitle), tabs);
  prevCard.append(prevHead, stage, note);

  // Score card.
  const R = 34, C = 2 * Math.PI * R;
  const ring = svg("svg", { viewBox: "0 0 80 80", width: "88", height: "88", "aria-hidden": "true", class: "gp-ring" });
  ring.append(svg("circle", { cx: "40", cy: "40", r: String(R), fill: "none", "stroke-width": "8", class: "gp-ring-bg" }));
  const arc = svg("circle", { cx: "40", cy: "40", r: String(R), fill: "none", "stroke-width": "8", "stroke-linecap": "round", class: "gp-ring-arc", transform: "rotate(-90 40 40)", "stroke-dasharray": String(C), "stroke-dashoffset": String(C) });
  ring.append(arc);
  const ringWrap = el("div", "gp-ring-wrap");
  const ringNum = el("span", "gp-ring-num", "0");
  ringWrap.append(ring, ringNum);
  const scoreHead = el("p", "gp-score-head");
  const scoreSub = el("p", "gp-score-sub");
  const scoreText = el("div", "gp-score-text");
  scoreText.append(scoreHead, scoreSub);
  const scoreTop = el("div", "gp-score-top");
  scoreTop.setAttribute("role", "status");
  scoreTop.append(ringWrap, scoreText);
  const list = el("ul", "gp-checks");
  const scoreCard = el("section", "gp-card gp-score");
  scoreCard.setAttribute("aria-label", UI.scoreTitle);
  scoreCard.append(el("h2", "gp-h", UI.scoreTitle), scoreTop, list);

  // Code card.
  const code = el("textarea", "gp-code-box");
  code.readOnly = true;
  code.rows = 9;
  code.dir = "ltr";
  code.spellcheck = false;
  code.setAttribute("aria-label", UI.codeTitle);
  const copyBtn = el("button", "try-btn try-btn-primary", UI.copy);
  copyBtn.type = "button";
  const status = el("p", "gp-status");
  status.setAttribute("role", "status");
  const codeRow = el("div", "try-controls");
  codeRow.append(copyBtn, status);
  const codeCard = el("section", "gp-card gp-code");
  codeCard.append(el("h2", "gp-h", UI.codeTitle), el("p", "gp-hint", UI.codeHint), code, codeRow);

  const side = el("div", "gp-side");
  side.append(prevCard, scoreCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid, codeCard);

  const values = () => ({ title: iTitle.value, description: iDesc.value, url: iUrl.value, keyword: iKw.value, brand: iBrand.value, image: iImg.value });

  function lines(parent, cls, arr, empty) {
    const box = el("div", cls);
    box.dir = "auto";
    if (!arr.length) { box.classList.add("gp-empty"); box.textContent = empty; }
    arr.forEach((l, i) => { if (i) box.append(el("br")); box.append(document.createTextNode(l)); });
    parent.append(box);
    return box;
  }
  function siteRow(v, u) {
    const row = el("div", "gp-g-site");
    const name = (v.brand || "").trim() || (u.ok ? u.host : UI.sampleHost);
    const fav = el("span", "gp-fav", (name.trim()[0] || "?").toUpperCase());
    fav.setAttribute("aria-hidden", "true");
    const txt = el("span", "gp-g-sitetext");
    txt.append(el("span", "gp-g-name", name));
    const crumbs = u.ok ? ["https://" + u.host].concat(u.crumbs) : ["https://" + UI.sampleHost];
    const urlEl = el("span", "gp-g-url", crumbs.join(" › "));
    urlEl.dir = "ltr";
    txt.append(urlEl);
    const dots = el("span", "gp-g-dots", "⋮");
    dots.setAttribute("aria-hidden", "true");
    row.append(fav, txt, dots);
    return row;
  }
  function googleView(v, u, mode) {
    const L = API.VIEWS[mode];
    const t = API.fitLines(v.title, L.title.size, L.title.width, L.title.lines);
    const d = API.fitLines(v.description, L.desc.size, L.desc.width, L.desc.lines);
    const card = el("div", "gp-g gp-g-" + mode);
    card.append(siteRow(v, u));
    lines(card, "gp-g-title", t.lines, UI.emptyTitle);
    lines(card, "gp-g-desc", d.lines, UI.emptyDesc);
    if (mode === "mobile") {
      const phone = el("div", "gp-phone");
      const bar = el("div", "gp-phone-bar");
      { const g = el("span", "gp-desk-g"); g.setAttribute("aria-hidden", "true"); bar.append(g); }
      const q = el("div", "gp-phone-q", (v.keyword || "").trim() || UI.sampleQuery);
      q.dir = "auto";
      bar.append(q);
      phone.append(bar, card);
      return phone;
    }
    const wrap = el("div", "gp-desk");
    const q = el("div", "gp-desk-q");
    { const g = el("span", "gp-desk-g"); g.setAttribute("aria-hidden", "true"); q.append(g); }
    const qb = el("span", "gp-desk-qb", (v.keyword || "").trim() || UI.sampleQuery);
    qb.dir = "auto";
    q.append(qb);
    wrap.append(q, card);
    return wrap;
  }
  function shareView(v, u) {
    const chat = el("div", "gp-wa");
    const bubble = el("div", "gp-wa-bubble");
    const pv = el("div", "gp-wa-card");
    const img = (v.image || "").trim();
    if (/^https?:\/\/\S+$/i.test(img)) {
      const im = el("img", "gp-wa-img");
      im.alt = "";
      im.loading = "lazy";
      im.referrerPolicy = "no-referrer";
      im.src = img;
      im.addEventListener("error", () => { im.replaceWith(el("div", "gp-wa-noimg", UI.imgFailed)); });
      pv.append(im);
    } else pv.append(el("div", "gp-wa-noimg", UI.noImage));
    const body = el("div", "gp-wa-body");
    // Chat apps clamp the text to the card, so the full text goes in and CSS cuts it after two lines.
    const one = (s) => String(s || "").replace(/\s+/g, " ").trim();
    lines(body, "gp-wa-title", one(v.title) ? [one(v.title)] : [], UI.emptyTitle);
    lines(body, "gp-wa-desc", one(v.description) ? [one(v.description)] : [], UI.emptyDesc);
    const host = el("div", "gp-wa-host", u.ok ? u.host : UI.sampleHost);
    host.dir = "ltr";
    body.append(host);
    pv.append(body);
    const link = el("div", "gp-wa-link", u.ok ? (v.url || "").trim() : "https://" + UI.sampleHost);
    link.dir = "ltr";
    const meta = el("div", "gp-wa-meta", "12:04 ✓✓");
    meta.dir = "ltr";
    bubble.append(pv, link, meta);
    chat.append(bubble);
    return chat;
  }

  // The previews are drawn at Google's real widths. When the panel is narrower (a phone, a small window), shrink the
  // whole preview to fit instead of scrolling, so the lines still break exactly where Google breaks them.
  function fit() {
    const inner = stage.firstElementChild;
    if (!inner || view === "share") return;
    inner.style.zoom = "";
    const room = stage.clientWidth - 34;
    const need = inner.scrollWidth + (view === "mobile" ? 14 : 0);
    if (room > 0 && need > room) inner.style.zoom = String(Math.max(0.5, room / need).toFixed(3));
  }
  let lastW = 0;
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if (stage.clientWidth !== lastW) { lastW = stage.clientWidth; fit(); } }).observe(stage);

  function setMeter(m, ratio, level, text) {
    m.fill.style.width = Math.max(2, Math.min(100, Math.round(ratio * 100))) + "%";
    m.wrap.dataset.level = level;
    m.text.textContent = text;
  }

  function render() {
    const v = values();
    const u = API.parseUrl(v.url);
    const rep = API.checkSnippet(v);
    // Meters under the two main fields.
    const tLevel = !rep.titleChars ? "none" : rep.titlePx > API.VIEWS.desktop.title.width ? "bad" : rep.titleChars < 30 ? "warn" : "ok";
    setMeter(mTitle, rep.titlePx / API.VIEWS.desktop.title.width, tLevel, fill(UI.meterTitle, { c: rep.titleChars, px: rep.titlePx, max: API.VIEWS.desktop.title.width }) + (tLevel === "none" ? "" : " · " + UI.level[tLevel]));
    const dFit = API.fitLines(v.description, API.VIEWS.desktop.desc.size, API.VIEWS.desktop.desc.width, API.VIEWS.desktop.desc.lines);
    const dLevel = !rep.descChars ? "none" : dFit.cut ? "bad" : rep.descChars < 70 ? "warn" : "ok";
    setMeter(mDesc, dFit.cut ? 1 : rep.descPx / (API.VIEWS.desktop.desc.width * API.VIEWS.desktop.desc.lines), dLevel, fill(UI.meterDesc, { c: rep.descChars }) + (dLevel === "none" ? "" : " · " + (dLevel === "bad" ? UI.level.cut : UI.level[dLevel])));
    // Preview.
    tabBtns.forEach((b) => { const on = b.dataset.view === view; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
    stage.textContent = "";
    stage.dataset.view = view;
    stage.append(view === "share" ? shareView(v, u) : googleView(v, u, view));
    fit();
    // Score and checks.
    const empty = !v.title.trim() && !v.description.trim();
    const score = empty ? 0 : rep.score;
    arc.setAttribute("stroke-dashoffset", String(C * (1 - score / 100)));
    const band = score >= 80 ? "ok" : score >= 50 ? "warn" : "bad";
    scoreCard.dataset.level = empty ? "none" : band;
    ringNum.textContent = empty ? "–" : String(score);
    scoreHead.textContent = empty ? UI.scoreEmpty : UI.score[band];
    const todo = rep.checks.filter((c) => c.level !== "ok").length;
    scoreSub.textContent = empty ? UI.scoreEmptySub : todo ? fill(todo === 1 ? UI.todoOne : UI.todoMany, { n: todo }) : UI.todoNone;
    list.textContent = "";
    if (!empty) {
      const order = { bad: 0, warn: 1, ok: 2 };
      rep.checks.slice().sort((a, b) => order[a.level] - order[b.level]).forEach((c) => {
        const li = el("li", "gp-check gp-" + c.level);
        const ic = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
        ic.setAttribute("aria-hidden", "true");
        const sr = el("span", "gp-sr", UI.level[c.level] + ": ");
        const tx = el("span", "gp-check-text");
        tx.append(sr, document.createTextNode(fill(UI.checks[c.id] || c.id, { n: c.n })));
        li.append(ic, tx);
        list.append(li);
      });
    }
    code.value = API.buildTags(v);
  }

  function copy(text) {
    const done = () => { status.textContent = UI.copied; };
    const fallback = () => {
      code.focus();
      code.select();
      try { document.execCommand("copy") ? done() : (status.textContent = UI.copyFailed); } catch (e) { status.textContent = UI.copyFailed; }
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  [iTitle, iDesc, iUrl, iKw, iBrand, iImg].forEach((n) => n.addEventListener("input", () => { status.textContent = ""; render(); }));
  tryBtn.addEventListener("click", () => {
    const x = DATA.example;
    iTitle.value = x.title; iDesc.value = x.description; iUrl.value = x.url; iKw.value = x.keyword; iBrand.value = x.brand; iImg.value = "";
    render();
    iTitle.focus();
  });
  clearBtn.addEventListener("click", () => {
    [iTitle, iDesc, iUrl, iKw, iBrand, iImg].forEach((n) => { n.value = ""; });
    status.textContent = "";
    render();
    iTitle.focus();
  });
  copyBtn.addEventListener("click", () => copy(code.value));
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
