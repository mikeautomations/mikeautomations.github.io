// /en/directions-link-generator/ and /he/directions-link-generator/ client logic. Progressive enhancement:
// without JS the page shows example links. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/directions.ts with the types removed (made with the TypeScript
// compiler). tests/directions-link-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="dl-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to directions.ts) ----------
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  /**
   * Latitude and longitude from "32.0853, 34.7818", "32.0853 34.7818" or a Google Maps link with "@32.08,34.78" or
   * "?q=32.08,34.78". Null when there are none or they're out of range.
   */
  function parseCoords(input) {
      const s = clean(input);
      const m = s.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|ll|query|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i) || s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (!m)
          return null;
      const lat = Number(m[1]), lng = Number(m[2]);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          return null;
      return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }
  /** What to search for: name and address together (finds the business listing), or the coordinates. */
  function query(p) {
      return [clean(p.name), clean(p.address)].filter(Boolean).join(", ");
  }
  /** Links that open each map app on the place (or start directions to it). Empty strings when there's nothing to find. */
  function links(p) {
      const c = parseCoords(p.coords || "");
      const q = query(p);
      if (!c && !q)
          return { google: "", googleDir: "", waze: "", apple: "", embed: "" };
      const enc = encodeURIComponent;
      const ll = c ? c.lat + "," + c.lng : "";
      const target = q || ll;
      return {
          google: "https://www.google.com/maps/search/?api=1&query=" + enc(target),
          googleDir: "https://www.google.com/maps/dir/?api=1&destination=" + enc(c && !q ? ll : target),
          waze: "https://waze.com/ul?" + (c ? "ll=" + ll : "q=" + enc(q)) + "&navigate=yes",
          apple: "https://maps.apple.com/?" + (c ? "ll=" + ll + (q ? "&q=" + enc(q) : "") : "q=" + enc(q)),
          embed: "https://maps.google.com/maps?q=" + enc(c ? ll : q) + "&z=15&output=embed",
      };
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  /** Ready HTML: three "open in" buttons, plain links that work on any website. */
  function buttonsHtml(l, labels) {
      if (!l.google)
          return "";
      const a = (href, text) => `  <a href="${esc(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;margin:4px;border-radius:8px;background:#14213d;color:#fff;text-decoration:none;font-weight:600">${esc(text)}</a>`;
      return `<p class="directions">\n${a(l.googleDir, labels.google)}\n${a(l.waze, labels.waze)}\n${a(l.apple, labels.apple)}\n</p>`;
  }
  /** A map to paste into a page. This simple embed needs no API key; Google's Maps Embed API is the official option. */
  function embedHtml(l, title) {
      if (!l.embed)
          return "";
      return `<iframe src="${esc(l.embed)}" title="${esc(title)}" width="100%" height="350" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
  }
  /** Notes on how precise the links will be. */
  function checkPlace(p) {
      const c = [];
      const coordsText = clean(p.coords);
      const coords = parseCoords(coordsText);
      const name = clean(p.name), address = clean(p.address);
      if (!name && !address && !coords)
          return [{ id: "empty", level: "bad" }];
      if (coordsText && !coords)
          c.push({ id: "coords_bad", level: "bad" });
      if (coords)
          c.push({ id: "coords_ok", level: "ok" });
      if (address) {
          if (!/\d/.test(address))
              c.push({ id: "address_no_number", level: "warn" });
          else
              c.push({ id: "address_ok", level: "ok" });
      }
      else if (!coords)
          c.push({ id: "address_missing", level: "warn" });
      if (!name)
          c.push({ id: "name_missing", level: "warn" });
      if (!coords && address)
          c.push({ id: "coords_tip", level: "warn" });
      return c;
  }

  const API = { parseCoords, links, buttonsHtml, embedHtml, checkPlace };
  root.Directions = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("dl-app");
  const dataEl = document.getElementById("dl-data");
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
    const id = "dl-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    const c = el("input");
    c.type = "text";
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    c.dir = f.ltr ? "ltr" : "auto";
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }
  function copyText(text, btn, label) {
    const done = () => { btn.dataset.done = "1"; btn.textContent = "✓ " + UI.copied; setTimeout(() => { btn.dataset.done = ""; btn.textContent = label; }, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => {});
    else {
      const t = el("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.append(t); t.select();
      try { if (document.execCommand("copy")) done(); } catch (e) {} t.remove();
    }
  }

  // Form.
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const checks = el("ul", "gp-checks");
  const form = el("div", "ft-box gp-form");
  form.append(formTop, field("name"), field("address"), field("coords"), field("note"), checks);

  // Links.
  const COLORS = { googleDir: ["#1a73e8", "G"], waze: ["#33ccff", "W"], apple: ["#1d1d1f", "A"], google: ["#34a853", "★"] };
  const appBox = el("div", "dl-apps");
  const linksCard = el("section", "gp-card");
  linksCard.append(el("h2", "gp-h", UI.linksTitle), appBox);

  const msg = el("textarea", "dl-msg");
  msg.readOnly = true;
  msg.rows = 7;
  msg.dir = "auto";
  msg.setAttribute("aria-label", UI.messageTitle);
  const msgBtn = button("try-btn try-btn-primary dl-btn", UI.copyMessage);
  const msgCard = el("section", "gp-card gp-code");
  msgCard.append(el("h2", "gp-h", UI.messageTitle), el("p", "gp-hint", UI.messageHint), msg, msgBtn);

  const side = el("div", "gp-side");
  side.append(linksCard, msgCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);

  const codeBox = (title, hint) => {
    const ta = el("textarea", "gp-code-box");
    ta.readOnly = true; ta.rows = 6; ta.dir = "ltr"; ta.spellcheck = false; ta.setAttribute("aria-label", title);
    ta.style.minHeight = "7rem";
    const b = button("try-btn dl-btn", UI.copyCode);
    b.addEventListener("click", () => copyText(ta.value, b, UI.copyCode));
    const card = el("section", "gp-card gp-code");
    card.append(el("h2", "gp-h", title), el("p", "gp-hint", hint), ta, b);
    return { card, ta };
  };
  const btnCode = codeBox(UI.buttonsTitle, UI.buttonsHint);
  const embCode = codeBox(UI.embedTitle, UI.embedHint);
  const showMap = button("try-btn gp-ghost dl-btn", UI.showMap);
  const mapBox = el("div", "dl-map");
  mapBox.hidden = true;
  embCode.card.append(showMap, mapBox);
  const bottom = el("div", "ut-bottom");
  bottom.style.display = "grid";
  bottom.style.gap = "1.25rem";
  bottom.append(btnCode.card, embCode.card);

  app.textContent = "";
  app.append(grid, bottom);

  const values = () => ({ name: inputs.name.value, address: inputs.address.value, coords: inputs.coords.value });
  let current = null;
  function render() {
    const v = values();
    const l = API.links(v);
    current = l;
    appBox.textContent = "";
    if (!l.google) appBox.append(el("p", "dl-empty", UI.empty));
    else ["googleDir", "waze", "apple", "google"].forEach((k) => {
      const row = el("div", "dl-app");
      const ic = el("span", "dl-ic", COLORS[k][1]);
      ic.style.background = COLORS[k][0];
      ic.setAttribute("aria-hidden", "true");
      const txt = el("div");
      txt.style.minWidth = "0";
      txt.append(el("div", "dl-name", UI.apps[k][0]), el("div", "dl-sub", UI.apps[k][1]), el("div", "dl-url", l[k]));
      const acts = el("div", "dl-acts");
      const open = el("a", "try-btn dl-btn", UI.open);
      open.href = l[k]; open.target = "_blank"; open.rel = "noopener noreferrer";
      const cp = button("try-btn try-btn-primary dl-btn", UI.copy);
      cp.addEventListener("click", () => copyText(l[k], cp, UI.copy));
      acts.append(open, cp);
      row.append(ic, txt, acts);
      appBox.append(row);
    });
    const name = v.name.trim() || v.address.trim() || "us";
    let m = "";
    if (l.google) {
      m = UI.message.replace("{name}", name).replace("{address}", v.address.trim() || v.coords.trim()).replace("{google}", l.googleDir).replace("{waze}", l.waze).replace("{apple}", l.apple);
      if (!v.address.trim() && !v.coords.trim()) m = m.replace(/^📍.*\n/m, "");
      if (inputs.note.value.trim()) m += "\n" + UI.messageNote.replace("{note}", inputs.note.value.trim());
    }
    msg.value = m;
    msgBtn.disabled = !m;
    btnCode.ta.value = API.buttonsHtml(l, UI.buttonLabels);
    embCode.ta.value = API.embedHtml(l, UI.mapTitle.replace("{name}", name));
    showMap.disabled = !l.embed;
    if (!mapBox.hidden) drawMap();
    checks.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checkPlace(v).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx);
      checks.append(li);
    });
  }
  let mapSrc = "";
  function drawMap() {
    if (!current || !current.embed || current.embed === mapSrc) return;
    mapSrc = current.embed;
    mapBox.textContent = "";
    const f = el("iframe");
    f.src = current.embed; f.title = UI.mapTitle.replace("{name}", inputs.name.value.trim()); f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade";
    mapBox.append(f);
  }
  showMap.addEventListener("click", () => { mapBox.hidden = false; showMap.hidden = true; drawMap(); });
  msgBtn.addEventListener("click", () => copyText(msg.value, msgBtn, UI.copyMessage));
  form.addEventListener("input", render);
  tryBtn.addEventListener("click", () => { for (const k in inputs) inputs[k].value = DATA.example[k] || ""; render(); inputs.name.focus(); });
  clearBtn.addEventListener("click", () => { for (const k in inputs) inputs[k].value = ""; render(); inputs.name.focus(); });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
