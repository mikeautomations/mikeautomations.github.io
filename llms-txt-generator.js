// /en/llms-txt-generator/ and /he/llms-txt/ client logic. Progressive enhancement: without JS the page shows an
// example file. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/llms.ts with the types removed (made with the TypeScript compiler).
// tests/llms-txt-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="lt-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to llms.ts) ----------
  /** https://example.com, without a trailing slash; empty stays empty. */
  function siteRoot(site) {
      const t = (site || "").trim();
      if (!t)
          return "";
      const withScheme = /^https?:\/\//i.test(t) ? t : "https://" + t;
      const m = /^(https?:\/\/[^/?#]+)/i.exec(withScheme);
      return m ? m[1].toLowerCase() : "";
  }
  /** A full address for a link: keeps full URLs, adds https:// to bare domains, puts paths on the site. */
  function absolute(url, site) {
      const u = (url || "").trim();
      if (!u)
          return "";
      if (/^https?:\/\//i.test(u))
          return u;
      if (u.startsWith("/"))
          return siteRoot(site) ? siteRoot(site) + u : u;
      if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(u))
          return "https://" + u;
      return siteRoot(site) ? siteRoot(site) + "/" + u : u;
  }
  const oneLine = (s) => (s || "").replace(/\s+/g, " ").trim();
  const mdText = (s) => oneLine(s).replace(/([[\]])/g, "\\$1");
  /** The llms.txt file. Sections keep the order they first appear in; "Optional" always goes last. */
  function build(i, optionalName) {
      const out = [`# ${oneLine(i.name) || "—"}`];
      if (oneLine(i.summary))
          out.push("", `> ${oneLine(i.summary)}`);
      const details = (i.details || "").split(/\r?\n/).map((l) => l.trimEnd()).join("\n").trim();
      if (details)
          out.push("", details);
      const links = i.links.filter((l) => oneLine(l.title) && (l.url || "").trim());
      const order = [];
      for (const l of links) {
          const s = oneLine(l.section) || "Pages";
          if (!order.includes(s))
              order.push(s);
      }
      order.sort((a, b) => (a === optionalName ? 1 : 0) - (b === optionalName ? 1 : 0));
      for (const s of order) {
          out.push("", `## ${s}`, "");
          for (const l of links.filter((x) => (oneLine(x.section) || "Pages") === s)) {
              out.push(`- [${mdText(l.title)}](${absolute(l.url, i.site)})${oneLine(l.desc) ? ": " + oneLine(l.desc) : ""}`);
          }
      }
      return out.join("\n") + "\n";
  }
  function checks(i) {
      const c = [];
      c.push(oneLine(i.name) ? { level: "ok", id: "name_ok" } : { level: "bad", id: "name_missing" });
      const sum = oneLine(i.summary);
      c.push(!sum ? { level: "bad", id: "summary_missing" } : sum.length > 220 ? { level: "warn", id: "summary_long" } : { level: "ok", id: "summary_ok" });
      if (!siteRoot(i.site))
          c.push({ level: "warn", id: "site_missing" });
      const links = i.links.filter((l) => oneLine(l.title) && (l.url || "").trim());
      c.push(links.length >= 3 ? { level: "ok", id: "links_ok" } : { level: "warn", id: "links_few" });
      if (links.some((l) => !/^https?:\/\//i.test(absolute(l.url, i.site))))
          c.push({ level: "bad", id: "url_relative" });
      const urls = links.map((l) => absolute(l.url, i.site).replace(/\/$/, ""));
      if (new Set(urls).size < urls.length)
          c.push({ level: "warn", id: "url_duplicate" });
      if (links.some((l) => !oneLine(l.desc)))
          c.push({ level: "warn", id: "desc_missing" });
      return c;
  }

  const API = { siteRoot, absolute, build, checks };
  root.LlmsTxt = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("lt-app");
  const dataEl = document.getElementById("lt-data");
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
  function wrapField(label, control, hint, cls) {
    const w = el("div", "ft-field gp-field" + (cls ? " " + cls : ""));
    const lab = el("label", null, label);
    control.id = control.id || "lt-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const text = (f, ltr) => { const c = el("input"); c.type = "text"; c.dir = ltr ? "ltr" : "auto"; if (f.placeholder) c.placeholder = f.placeholder; if (f.max) c.maxLength = f.max; return c; };

  // Form.
  const name = text(UI.name), site = text(UI.site, true), summary = el("textarea"), details = el("textarea");
  summary.rows = 2; summary.dir = "auto"; summary.placeholder = UI.summary.placeholder; summary.maxLength = UI.summary.max;
  details.rows = 4; details.dir = "auto"; details.placeholder = UI.details.placeholder; details.maxLength = UI.details.max;
  let links = [];
  const linksBox = el("div", "lt-links");
  const addBtn = button("try-btn gp-ghost lt-add", UI.addLink);
  let markNew = false;
  function drawLinks() {
    linksBox.textContent = "";
    links.forEach((l, i) => {
      const row = el("div", "lt-link");
      const sec = el("select");
      UI.sections.forEach(([v, lab]) => { const o = el("option", null, lab); o.value = v; sec.append(o); });
      sec.value = l.section;
      const t = text({ placeholder: "", max: 80 }); t.value = l.title;
      const u = text({ placeholder: "/…", max: 300 }, true); u.value = l.url;
      const d = text({ placeholder: "", max: 160 }); d.value = l.desc;
      sec.addEventListener("change", () => { l.section = sec.value; markNew = true; render(); });
      t.addEventListener("input", () => { l.title = t.value; render(); });
      u.addEventListener("input", () => { l.url = u.value; render(); });
      d.addEventListener("input", () => { l.desc = d.value; render(); });
      const x = button("try-btn gp-ghost lt-x", "✕");
      x.setAttribute("aria-label", UI.removeLink.replace("{n}", String(i + 1)));
      x.addEventListener("click", () => { links.splice(i, 1); drawLinks(); render(); });
      row.append(wrapField(UI.section + " " + (i + 1), sec), wrapField(UI.title, t), x, wrapField(UI.url, u, null, "lt-wide"), wrapField(UI.desc, d, null, "lt-wide"));
      linksBox.append(row);
    });
    addBtn.hidden = links.length >= 30;
  }
  addBtn.addEventListener("click", () => { links.push({ section: UI.sections[1][0], title: "", url: "", desc: "" }); drawLinks(); markNew = true; render(); const ins = linksBox.querySelectorAll(".lt-link"); const last = ins[ins.length - 1]; if (last) last.querySelector("input").focus(); });

  const tryBtn = button("try-btn", UI.exampleBtn);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const linksH = el("h3", "gp-h", UI.linksTitle); linksH.style.marginTop = "0.8rem";
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.name.label, name), wrapField(UI.site.label, site), wrapField(UI.summary.label, summary, UI.summary.hint),
    wrapField(UI.details.label, details, UI.details.hint), linksH, el("p", "gp-hint", UI.linksHint), linksBox, addBtn, checksH, checkList);

  // Preview: an editor-style window.
  const bar = el("div", "lt-bar");
  bar.append(el("i"), el("i"), el("i"), document.createTextNode("llms.txt"));
  bar.querySelectorAll("i").forEach((i) => i.setAttribute("aria-hidden", "true"));
  const code = el("pre", "lt-code");
  code.tabIndex = 0;
  code.setAttribute("role", "region");
  code.setAttribute("aria-label", UI.previewTitle);
  const file = el("div", "lt-file"); file.append(bar, code);
  const hint = el("p", "gp-hint");
  const dl = button("try-btn try-btn-primary lt-btn", UI.download);
  const cp = button("try-btn lt-btn", UI.copy);
  const acts = el("div", "lt-acts"); acts.append(dl, cp);
  const card = el("section", "gp-card");
  card.append(el("h2", "gp-h", UI.previewTitle), file, acts, hint);
  const side = el("div", "gp-side"); side.append(card);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  const value = () => ({ name: name.value, site: site.value, summary: summary.value, details: details.value, links: links.map((l) => ({ ...l })) });
  let current = "", prevLines = [];
  function line(s) {
    const n = el("span", "ln");
    if (/^# /.test(s)) n.append(el("span", "h1", s));
    else if (/^## /.test(s)) n.append(el("span", "h2", s));
    else if (/^> /.test(s)) n.append(el("span", "q", s));
    else {
      const m = /^- \[(.*?)\]\((.*?)\)(.*)$/.exec(s);
      if (m) { const k = el("span", "lk"); k.append("- [", el("b", null, m[1]), "](", el("u", null, m[2]), ")" + m[3]); n.append(k); }
      else n.append(s);
    }
    return n;
  }
  function render() {
    const v = value();
    current = API.build(v, UI.optional);
    const lines = current.replace(/\n$/, "").split("\n");
    code.textContent = "";
    lines.forEach((s) => { const n = line(s); if (markNew && s && !prevLines.includes(s)) n.classList.add("new"); code.append(n); });
    prevLines = lines; markNew = false;
    const root2 = API.siteRoot(v.site) || "https://yoursite.com";
    hint.textContent = UI.fileHint.replace("{url}", root2 + "/llms.txt");
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(v).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx); checkList.append(li);
    });
  }
  form.addEventListener("input", (e) => { if (!e.target.closest(".lt-link")) render(); });
  dl.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([current], { type: "text/plain;charset=utf-8" }));
    const a = el("a"); a.href = url; a.download = "llms.txt"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  cp.addEventListener("click", () => {
    const done = () => { cp.dataset.done = "1"; cp.textContent = "✓ " + UI.copied; setTimeout(() => { cp.dataset.done = ""; cp.textContent = UI.copy; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(current).then(done, () => {});
  });
  function reset() { name.value = ""; site.value = ""; summary.value = ""; details.value = ""; links = [{ section: UI.sections[0][0], title: "", url: "/", desc: "" }]; }
  tryBtn.addEventListener("click", () => {
    const e = UI.example;
    name.value = e.name; site.value = e.site; summary.value = e.summary; details.value = e.details;
    links = e.links.map(([section, title, url, desc]) => ({ section, title, url, desc }));
    drawLinks(); markNew = true; render(); name.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); drawLinks(); render(); name.focus(); });
  reset();
  drawLinks();
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
