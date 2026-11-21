// /en/character-counter/ and /he/character-counter/ client logic. Progressive enhancement: without JS the page
// explains SMS and platform limits. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/char-count.ts with the types removed (made with the TypeScript
// compiler). tests/character-counter.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="ch-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to char-count.ts) ----------
  const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const GSM_EXT = "^{}\\[~]|€\f";
  /** Characters as people count them (code points, so an emoji or Hebrew letter counts once). */
  function chars(text) {
      return Array.from(text || "").length;
  }
  function words(text) {
      const m = String(text || "").trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
      return m ? m.length : 0;
  }
  function lines(text) {
      return text ? String(text).split(/\r\n|\r|\n/).length : 0;
  }
  /** How many SMS parts a message needs, and which characters force Unicode. */
  function sms(text) {
      const cps = Array.from(text || "");
      const bad = [];
      let units = 0;
      for (const c of cps) {
          if (GSM_BASIC.includes(c))
              units += 1;
          else if (GSM_EXT.includes(c))
              units += 2;
          else if (!bad.includes(c))
              bad.push(c);
      }
      if (bad.length) {
          // UCS-2 counts UTF-16 code units: most characters are 1, emoji are 2.
          const u = String(text || "").length;
          const per = u <= 70 ? 70 : 67;
          const seg = u === 0 ? 0 : Math.ceil(u / per);
          return { encoding: "UCS-2", units: u, segments: seg, perSegment: per, left: seg ? seg * per - u : 70, unicodeChars: bad };
      }
      const per = units <= 160 ? 160 : 153;
      const seg = units === 0 ? 0 : Math.ceil(units / per);
      return { encoding: "GSM-7", units, segments: seg, perSegment: per, left: seg ? seg * per - units : 160, unicodeChars: [] };
  }
  /** Common "smart" characters swapped for plain ones, so a message can stay in GSM-7 (cheaper, longer SMS). */
  function plainify(text) {
      return String(text || "")
          .replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"').replace(/[–—―]/g, "-").replace(/…/g, "...")
          .replace(/ /g, " ").replace(/[•·]/g, "-");
  }
  /** Approximate X (Twitter) length: links count 23, most Latin, Hebrew and Arabic characters 1, others (CJK, emoji) 2. */
  function xLength(text) {
      const t = String(text || "").replace(/https?:\/\/\S+/gi, "x".repeat(23));
      let n = 0;
      for (const c of Array.from(t)) {
          const cp = c.codePointAt(0);
          n += (cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)) ? 1 : 2;
      }
      return n;
  }
  /** Limits people hit most. "soft" means a guideline for what's shown, not a hard cut-off. */
  const LIMITS = [
      { id: "meta_title", max: 60, kind: "soft" },
      { id: "meta_desc", max: 155, kind: "soft" },
      { id: "gbp_desc", max: 750 },
      { id: "gbp_post", max: 1500 },
      { id: "ig_bio", max: 150 },
      { id: "ig_caption", max: 2200 },
      { id: "li_headline", max: 220 },
      { id: "li_post", max: 3000 },
      { id: "x_post", max: 280, kind: "x" },
      { id: "yt_title", max: 100 },
      { id: "yt_desc", max: 5000 },
  ];
  /** Count used for one limit, and whether it fits. */
  function against(text, l) {
      const used = l.kind === "x" ? xLength(text) : chars(text);
      return { used, max: l.max, ok: used <= l.max, pct: Math.min(100, Math.round((used / l.max) * 100)) };
  }

  const API = { chars, words, lines, sms, plainify, xLength, LIMITS, against };
  root.CharCount = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ch-app");
  const dataEl = document.getElementById("ch-data");
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
  const fmt = (n) => n.toLocaleString(DATA.rtl ? "he-IL" : "en-GB");

  // Text box and stats.
  const ta = el("textarea", "ch-text");
  ta.id = "ch-text";
  ta.placeholder = UI.placeholder;
  ta.dir = "auto";
  const lab = el("label", null, UI.label);
  lab.htmlFor = "ch-text";
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const copyBtn = button("try-btn gp-ghost", UI.copy);
  const top = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, copyBtn, clearBtn);
  top.append(lab, btns);
  lab.className = "gp-h";
  const statBox = el("div", "ch-stats");
  statBox.setAttribute("aria-live", "polite");
  const stat = (label) => { const d = el("div", "ch-stat"); const b = el("b", null, "0"); d.append(b, el("span", null, label)); statBox.append(d); return b; };
  const sChars = stat(UI.stats.chars), sWords = stat(UI.stats.words), sNoSp = stat(UI.stats.noSpaces), sLines = stat(UI.stats.lines);
  const form = el("div", "ft-box gp-form");
  form.append(top, ta, statBox);

  // SMS.
  const smsN = el("span", "ch-sms-n");
  const enc = el("span", "ch-enc");
  const smsTop = el("div", "ch-sms-top");
  smsTop.append(smsN, enc);
  const segs = el("div", "ch-segs");
  segs.setAttribute("aria-hidden", "true");
  const left = el("p", "gp-hint");
  left.style.margin = "0";
  const uniList = el("div", "ch-uni-list");
  const plainBtn = button("try-btn ic-small", UI.plainify);
  const uni = el("div", "ch-uni");
  uni.append(el("span", null, UI.unicodeWhy), uniList, plainBtn, el("span", "gp-hint", UI.plainifyNote));
  const smsCard = el("section", "gp-card ch-sms");
  smsCard.setAttribute("aria-label", UI.smsTitle);
  smsCard.append(el("h2", "gp-h", UI.smsTitle), smsTop, segs, left, uni);

  // Platform limits.
  const limList = el("ul", "ch-limits");
  const limEls = DATA.limits.map((id) => {
    const l = API.LIMITS.find((x) => x.id === id);
    const li = el("li", "ch-limit");
    const num = el("span", "ch-limit-num");
    const bar = el("div", "ch-bar");
    const fill = el("i");
    bar.append(fill);
    li.append(el("span", "ch-limit-name", UI.limits[id]), num, bar);
    limList.append(li);
    return { l, li, num, fill };
  });
  const limCard = el("section", "gp-card");
  limCard.append(el("h2", "gp-h", UI.limitsTitle), limList);

  const side = el("div", "gp-side");
  side.append(smsCard, limCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  function render() {
    const t = ta.value;
    sChars.textContent = fmt(API.chars(t));
    sWords.textContent = fmt(API.words(t));
    sNoSp.textContent = fmt(API.chars(t.replace(/\s/g, "")));
    sLines.textContent = fmt(API.lines(t));
    const s = API.sms(t);
    smsCard.dataset.multi = s.segments > 1 ? "1" : "0";
    smsN.textContent = s.segments === 0 ? "–" : s.segments === 1 ? UI.smsPart1 : UI.smsParts.replace("{n}", String(s.segments));
    enc.textContent = UI.enc[s.encoding];
    enc.dataset.u = s.encoding === "UCS-2" ? "1" : "0";
    left.textContent = s.segments ? UI.smsLeft.replace("{n}", String(s.left)) : UI.smsNone;
    segs.textContent = "";
    const parts = Math.max(1, s.segments);
    for (let i = 0; i < parts; i++) {
      const seg = el("span", "ch-seg");
      const fill = el("i");
      const used = Math.min(s.perSegment, Math.max(0, s.units - i * s.perSegment));
      fill.style.width = (used / s.perSegment) * 100 + "%";
      seg.append(fill);
      segs.append(seg);
    }
    uni.hidden = !s.unicodeChars.length;
    uniList.textContent = "";
    const letters = s.unicodeChars.filter((c) => /\p{L}/u.test(c));
    const others = s.unicodeChars.filter((c) => !/\p{L}/u.test(c));
    if (letters.length) uniList.append(el("code", null, UI.letters + " (" + letters.slice(0, 3).join("") + (letters.length > 3 ? "…" : "") + ")"));
    others.slice(0, 20).forEach((c) => uniList.append(el("code", null, c === " " ? "⍽" : c)));
    plainBtn.hidden = API.plainify(t) === t;
    limEls.forEach(({ l, li, num, fill }) => {
      const r = API.against(t, l);
      li.dataset.ok = r.ok ? "1" : "0";
      li.dataset.near = r.ok && r.pct >= 90 ? "1" : "0";
      num.textContent = r.ok ? fmt(r.used) + " / " + fmt(r.max) : UI.over.replace("{n}", fmt(r.used - r.max));
      fill.style.width = Math.max(r.used ? 2 : 0, r.pct) + "%";
    });
  }

  ta.addEventListener("input", render);
  tryBtn.addEventListener("click", () => { ta.value = UI.exampleText; render(); ta.focus(); });
  clearBtn.addEventListener("click", () => { ta.value = ""; render(); ta.focus(); });
  plainBtn.addEventListener("click", () => { ta.value = API.plainify(ta.value); render(); ta.focus(); });
  copyBtn.addEventListener("click", () => {
    const done = () => { copyBtn.textContent = "✓ " + UI.copied; setTimeout(() => { copyBtn.textContent = UI.copy; }, 1500); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(ta.value).then(done, () => {});
    else { ta.select(); try { if (document.execCommand("copy")) done(); } catch (e) {} }
  });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
