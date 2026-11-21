// /en/ai-search-visibility-checker/ and /he/ai-search-visibility/ client logic. Progressive enhancement: without JS
// the page lists what matters. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/geo-check.ts with the types removed (made with the TypeScript
// compiler). tests/ai-search-visibility-checker.test.ts checks both copies give identical results.
// PART 2 reads its texts and questions (English or Hebrew) from <script id="gc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to geo-check.ts) ----------
  const VALUE = { yes: 1, partly: 0.5, no: 0, "": 0 };
  /** 0-100: the weighted share of the questions answered yes (partly counts half). */
  function score(qs, answers) {
      const total = qs.reduce((s, q) => s + q.weight, 0);
      if (!total)
          return 0;
      const got = qs.reduce((s, q) => s + q.weight * VALUE[answers[q.id] || ""], 0);
      return Math.round((got / total) * 100);
  }
  function answered(qs, answers) {
      return qs.filter((q) => answers[q.id]).length;
  }
  /** The fixes worth most points, biggest first; ties keep the question order. Unanswered questions are not listed. */
  function topFixes(qs, answers, n) {
      return qs
          .map((q, i) => ({ id: q.id, i, gain: answers[q.id] ? q.weight * (1 - VALUE[answers[q.id]]) : 0 }))
          .filter((x) => x.gain > 0)
          .sort((a, b) => b.gain - a.gain || a.i - b.i)
          .slice(0, n)
          .map((x) => x.id);
  }
  /** The band for a score: 0 weak, 1 fair, 2 good, 3 strong. */
  function band(s) {
      return s >= 85 ? 3 : s >= 65 ? 2 : s >= 40 ? 1 : 0;
  }
  /** Questions to ask ChatGPT, Gemini or Perplexity, to see whether they mention the business. */
  function prompts(templates, v) {
      const service = v.service.trim(), city = v.city.trim(), business = v.business.trim();
      return templates
          .filter((t) => (!t.includes("{service}") || service) && (!t.includes("{city}") || city) && (!t.includes("{business}") || business))
          .map((t) => t.replace(/\{service\}/g, service).replace(/\{city\}/g, city).replace(/\{business\}/g, business));
  }

  const API = { score, answered, topFixes, band, prompts };
  root.GeoCheck = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("gc-app");
  const dataEl = document.getElementById("gc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const QS = UI.questions;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  function field(f) {
    const w = el("div", "ft-field gp-field");
    const c = el("input"); c.type = "text"; c.dir = "auto"; c.placeholder = f.placeholder; c.maxLength = f.max; c.id = "gc-f" + ++uid;
    const lab = el("label", null, f.label); lab.htmlFor = c.id;
    w.append(lab, c);
    return { w, c };
  }
  const reduce = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();

  // Form: the business, then the questions.
  const fb = field(UI.business), fs = field(UI.service), fc = field(UI.city);
  const about = el("div", "gc-about"); about.append(fb.w, fs.w, fc.w);
  const answers = {};
  const qBox = el("div", "gc-qs");
  const sets = {};
  QS.forEach((q) => {
    const set = el("fieldset", "gc-q");
    set.append(el("legend", null, q.q), el("span", "gc-help", q.help));
    const seg = el("div", "gc-seg");
    UI.answers.forEach(([v, l]) => {
      const lab = el("label");
      const r = el("input"); r.type = "radio"; r.name = "gc-" + q.id; r.value = v;
      lab.append(r, el("span", null, l));
      seg.append(lab);
    });
    set.append(seg);
    sets[q.id] = set;
    qBox.append(set);
  });
  const tryBtn = button("try-btn", UI.exampleBtn);
  const resetBtn = button("try-btn gp-ghost", UI.reset);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, resetBtn);
  formTop.append(el("h2", "gp-h", UI.aboutTitle), btns);
  const qH = el("h3", "gp-h", UI.questionsTitle); qH.style.marginTop = "1rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, about, qH, qBox);

  // Results.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 128 128"); svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(NS, "circle"), arc = document.createElementNS(NS, "circle");
  for (const c of [track, arc]) { c.setAttribute("cx", "64"); c.setAttribute("cy", "64"); c.setAttribute("r", "52"); svg.append(c); }
  track.setAttribute("class", "gc-track"); arc.setAttribute("class", "gc-arc");
  const num = el("div", "gc-num", "–");
  const ring = el("div", "gc-ring"); ring.append(svg, num);
  const bandEl = el("p", "gc-band", ""), hintEl = el("p", "gc-bandhint", UI.start), countEl = el("p", "gc-count", "");
  const txt = el("div"); txt.append(bandEl, hintEl, countEl);
  const scoreBox = el("div", "gc-score"); scoreBox.append(ring, txt);
  const live = el("p", "gp-sr"); live.setAttribute("aria-live", "polite");
  const scoreCard = el("section", "gp-card"); scoreCard.append(el("h2", "gp-h", UI.scoreTitle), scoreBox, live);
  const fixes = el("ol", "gc-fixes");
  const fixCard = el("section", "gp-card"); fixCard.append(el("h2", "gp-h", UI.fixesTitle), fixes);
  const plist = el("ul", "gc-prompts");
  const pEmpty = el("p", "gp-hint", UI.promptsEmpty);
  const promptCard = el("section", "gp-card"); promptCard.append(el("h2", "gp-h", UI.promptsTitle), el("p", "gp-hint", UI.promptsHint), pEmpty, plist);
  const side = el("div", "gp-side gc-side"); side.append(scoreCard, fixCard, promptCard);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  let shown = 0, anim = 0, lastFixes = "", lastPrompts = "";
  function countTo(target) {
    cancelAnimationFrame(anim);
    if (reduce) { shown = target; num.textContent = String(target); return; }
    const from = shown, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      num.textContent = String(shown);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function render() {
    const n = API.answered(QS, answers);
    countEl.textContent = UI.answered.replace("{n}", String(n)).replace("{total}", String(QS.length));
    for (const q of QS) sets[q.id].dataset.a = answers[q.id] || "";
    if (!n) { num.textContent = "–"; shown = 0; arc.style.strokeDashoffset = "327"; bandEl.textContent = ""; hintEl.textContent = UI.start; fixes.textContent = ""; lastFixes = ""; }
    else {
      const s = API.score(QS, answers);
      const b = API.band(s);
      countTo(s);
      arc.style.strokeDashoffset = String(327 - (327 * s) / 100);
      arc.style.stroke = ["#b42318", "#b45309", "#0c6b45", "#0c6b45"][b];
      bandEl.textContent = UI.bands[b];
      hintEl.textContent = UI.bandHints[b];
      live.textContent = s + "/100. " + UI.bands[b] + ".";
      const ids = API.topFixes(QS, answers, 3);
      const key = ids.join(",");
      if (key !== lastFixes) {
        lastFixes = key;
        fixes.textContent = "";
        if (!ids.length) fixes.append(el("li", null, UI.noFixes));
        ids.forEach((id) => {
          const q = QS.find((x) => x.id === id);
          const li = el("li", null, q.fix);
          if (q.link) { li.append(el("br")); const a = el("a", null, UI.freeTool.replace("{name}", q.link[1])); a.href = q.link[0]; li.append(a); }
          fixes.append(li);
        });
      }
    }
    const ps = API.prompts(UI.templates, { service: fs.c.value, city: fc.c.value, business: fb.c.value });
    const pkey = ps.join("|");
    if (pkey !== lastPrompts) {
      lastPrompts = pkey;
      pEmpty.hidden = ps.length > 0;
      plist.textContent = "";
      ps.forEach((p) => {
        const li = el("li");
        const acts = el("div", "gc-pa");
        const links = [[UI.chatgpt, "https://chatgpt.com/?q="], [UI.perplexity, "https://www.perplexity.ai/search?q="]];
        for (const [label, base] of links) {
          const a = el("a", "try-btn gc-btn", label);
          a.href = base + encodeURIComponent(p); a.target = "_blank"; a.rel = "noopener noreferrer";
          a.setAttribute("aria-label", UI.askLabel.replace("{tool}", label).replace("{q}", p));
          acts.append(a);
        }
        const cp = button("try-btn gp-ghost gc-btn", UI.copy);
        cp.setAttribute("aria-label", UI.copy + ": " + p);
        cp.addEventListener("click", () => {
          const done = () => { cp.dataset.done = "1"; cp.textContent = "✓ " + UI.copied; setTimeout(() => { cp.dataset.done = ""; cp.textContent = UI.copy; }, 1600); };
          if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(p).then(done, () => {});
        });
        acts.append(cp);
        const pq = el("p", "gc-pq", p); pq.dir = "auto";
        li.append(pq, acts);
        plist.append(li);
      });
    }
  }
  qBox.addEventListener("change", (e) => { const t = e.target; if (t && t.name && t.name.startsWith("gc-")) { answers[t.name.slice(3)] = t.value; render(); } });
  about.addEventListener("input", render);
  function setAll(a) {
    for (const q of QS) { answers[q.id] = a[q.id] || ""; for (const r of sets[q.id].querySelectorAll("input")) r.checked = r.value === answers[q.id]; }
  }
  tryBtn.addEventListener("click", () => { const e = UI.example; fb.c.value = e.business; fs.c.value = e.service; fc.c.value = e.city; setAll(e.answers); render(); fs.c.focus(); });
  resetBtn.addEventListener("click", () => { fb.c.value = ""; fs.c.value = ""; fc.c.value = ""; setAll({}); render(); fs.c.focus(); });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
