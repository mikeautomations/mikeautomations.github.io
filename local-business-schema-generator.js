// /en/local-business-schema-generator/ and /he/local-business-schema-generator/ client logic. Progressive enhancement:
// without JS the page explains the fields and shows an example. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/local-schema.ts with the types removed (made with the TypeScript
// compiler). tests/local-business-schema-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="ls-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to local-schema.ts) ----------
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  /** schema.org types a small business can pick from; anything else falls back to LocalBusiness. */
  const TYPES = [
      "LocalBusiness", "Plumber", "Electrician", "HVACBusiness", "RoofingContractor", "GeneralContractor", "HousePainter",
      "Locksmith", "MovingCompany", "HomeAndConstructionBusiness", "AutoRepair", "Dentist", "MedicalClinic", "Optician",
      "Attorney", "AccountingService", "InsuranceAgency", "RealEstateAgent", "HairSalon", "BeautySalon", "DaySpa",
      "HealthClub", "ChildCare", "Restaurant", "CafeOrCoffeeShop", "Store", "ProfessionalService",
  ];
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  /** An address with or without https://, returned with it. Empty when it doesn't look like a web address. */
  function normalizeUrl(input) {
      let u = clean(input);
      if (!u)
          return "";
      if (!/^https?:\/\//i.test(u))
          u = "https://" + u;
      return /^https?:\/\/[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?(\/\S*)?$/iu.test(u) ? u : "";
  }
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  /** Days with the same hours grouped together, the compact way Google reads them. Closed days are left out. */
  function hoursSpec(hours) {
      const out = [];
      (hours || []).slice(0, 7).forEach((d, i) => {
          if (!d || !d.open || !TIME.test(d.from) || !TIME.test(d.to))
              return;
          const same = out.find((g) => g.opens === d.from && g.closes === d.to);
          if (same)
              same.dayOfWeek.push(DAYS[i]);
          else
              out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: [DAYS[i]], opens: d.from, closes: d.to });
      });
      return out;
  }
  const list = (s) => String(s == null ? "" : s).split(/[\n,]+/).map(clean).filter(Boolean);
  /** The JSON-LD object. Empty fields are left out rather than sent blank. */
  function buildSchema(input) {
      const type = TYPES.includes(clean(input.type)) ? clean(input.type) : "LocalBusiness";
      const url = normalizeUrl(input.url || "");
      const o = { "@context": "https://schema.org", "@type": type };
      if (url)
          o["@id"] = url.replace(/#.*$/, "").replace(/^(https?:\/\/[^/]+)$/i, "$1/") + "#business";
      if (clean(input.name))
          o.name = clean(input.name);
      if (clean(input.description))
          o.description = clean(input.description);
      if (url)
          o.url = url;
      if (clean(input.phone))
          o.telephone = clean(input.phone);
      if (clean(input.email))
          o.email = clean(input.email);
      const logo = normalizeUrl(input.logo || "");
      const image = normalizeUrl(input.image || "");
      if (image || logo)
          o.image = image || logo;
      if (logo)
          o.logo = logo;
      if (clean(input.priceRange))
          o.priceRange = clean(input.priceRange);
      const addr = { "@type": "PostalAddress" };
      if (clean(input.street))
          addr.streetAddress = clean(input.street);
      if (clean(input.city))
          addr.addressLocality = clean(input.city);
      if (clean(input.region))
          addr.addressRegion = clean(input.region);
      if (clean(input.postcode))
          addr.postalCode = clean(input.postcode);
      if (clean(input.country))
          addr.addressCountry = clean(input.country).toUpperCase();
      if (Object.keys(addr).length > 1)
          o.address = addr;
      const lat = Number(clean(input.lat)), lng = Number(clean(input.lng));
      if (clean(input.lat) && clean(input.lng) && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          o.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
      }
      const map = normalizeUrl(input.map || "");
      if (map)
          o.hasMap = map;
      const hours = hoursSpec(input.hours);
      if (hours.length)
          o.openingHoursSpecification = hours;
      const areas = list(input.areaServed);
      if (areas.length)
          o.areaServed = areas.map((a) => ({ "@type": "City", name: a }));
      const same = list(input.sameAs).map(normalizeUrl).filter(Boolean);
      if (same.length)
          o.sameAs = same;
      return o;
  }
  /** The snippet to paste into the page: one script tag, with "<" escaped so text can never end the script early. */
  function schemaScript(obj) {
      return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n</script>`;
  }
  /** What is missing, most important first: Google needs a name and an address; the rest helps search and AI tools. */
  function checkSchema(input) {
      const c = [];
      c.push(clean(input.name) ? { id: "name_ok", level: "ok" } : { id: "name_missing", level: "bad" });
      if (!clean(input.street) || !clean(input.city))
          c.push({ id: "address_missing", level: "bad" });
      else if (!clean(input.postcode) || !clean(input.country))
          c.push({ id: "address_partial", level: "warn" });
      else
          c.push({ id: "address_ok", level: "ok" });
      const digits = clean(input.phone).replace(/\D/g, "");
      c.push(!digits ? { id: "phone_missing", level: "warn" } : digits.length < 7 ? { id: "phone_bad", level: "warn" } : { id: "phone_ok", level: "ok" });
      if (!clean(input.url))
          c.push({ id: "url_missing", level: "warn" });
      else
          c.push(normalizeUrl(input.url || "") ? { id: "url_ok", level: "ok" } : { id: "url_bad", level: "bad" });
      c.push(hoursSpec(input.hours).length ? { id: "hours_ok", level: "ok" } : { id: "hours_missing", level: "warn" });
      c.push(normalizeUrl(input.image || "") || normalizeUrl(input.logo || "") ? { id: "image_ok", level: "ok" } : { id: "image_missing", level: "warn" });
      c.push(clean(input.description) ? { id: "desc_ok", level: "ok" } : { id: "desc_missing", level: "warn" });
      const geo = buildSchema(input);
      c.push(geo.geo || geo.hasMap ? { id: "geo_ok", level: "ok" } : { id: "geo_missing", level: "warn" });
      c.push(list(input.sameAs).map(normalizeUrl).filter(Boolean).length ? { id: "sameas_ok", level: "ok" } : { id: "sameas_missing", level: "warn" });
      if (!TYPES.includes(clean(input.type)) || clean(input.type) === "LocalBusiness")
          c.push({ id: "type_generic", level: "warn" });
      const pts = { ok: 1, warn: 0.5, bad: 0 };
      return { score: Math.round((100 * c.reduce((s, x) => s + pts[x.level], 0)) / c.length), checks: c };
  }

  const API = { normalizeUrl, hoursSpec, buildSchema, schemaScript, checkSchema, TYPES, DAYS };
  root.LocalSchema = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ls-app");
  const dataEl = document.getElementById("ls-data");
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
  const svg = (tag, attrs) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  let uid = 0;
  const inputs = {};
  function field(key, kind, opts) {
    const f = UI.fields[key];
    const id = "ls-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    let c;
    if (kind === "select") {
      c = el("select");
      opts.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; c.append(o); });
    } else if (kind === "area") {
      c = el("textarea");
      c.rows = 3;
    } else {
      c = el("input");
      c.type = kind || "text";
    }
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    if (kind !== "select") c.dir = f.ltr ? "ltr" : "auto";
    if (f.auto) c.autocomplete = f.auto;
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }
  function group(title, ...kids) {
    const fs = el("fieldset", "ls-group");
    fs.append(el("legend", null, title), ...kids);
    return fs;
  }
  const row = (...kids) => { const r = el("div", "ls-row"); r.append(...kids); return r; };

  // Opening hours: one row per day.
  const dayRows = DATA.defaultHours.map((d, i) => {
    const r = el("div", "ls-day");
    const cb = el("input");
    cb.type = "checkbox";
    cb.id = "ls-day" + i;
    cb.checked = d.open;
    const lab = el("label", "ls-day-name");
    lab.append(cb, document.createTextNode(UI.days[i]));
    const from = el("input");
    from.type = "time";
    from.value = d.from;
    from.setAttribute("aria-label", UI.days[i] + ": " + UI.opens);
    const to = el("input");
    to.type = "time";
    to.value = d.to;
    to.setAttribute("aria-label", UI.days[i] + ": " + UI.closes);
    const closed = el("span", "ls-closed", UI.closed);
    r.append(lab, from, el("span", "ls-dash", "–"), to, closed);
    return { r, cb, from, to };
  });
  const hoursBox = el("div", "ls-hours");
  dayRows.forEach((d) => hoursBox.append(d.r));
  const copyWeek = el("button", "try-btn gp-ghost", UI.copyWeekdays);
  copyWeek.type = "button";

  const tryBtn = el("button", "try-btn", UI.example);
  tryBtn.type = "button";
  const clearBtn = el("button", "try-btn gp-ghost", UI.clear);
  clearBtn.type = "button";
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);

  const more = el("details", "gp-more");
  more.append(el("summary", null, UI.more), field("areaServed", "text"), row(field("priceRange", "text"), field("lat", "text"), field("lng", "text")));

  const form = el("div", "ft-box gp-form");
  form.append(
    formTop,
    group(UI.groups.business, field("type", "select", UI.types), field("name", "text"), field("description", "area")),
    group(UI.groups.contact, row(field("phone", "tel"), field("email", "email")), field("street", "text"), row(field("city", "text"), field("region", "text")), row(field("postcode", "text"), field("country", "select", UI.countries))),
    group(UI.groups.hours, hoursBox, copyWeek),
    group(UI.groups.online, field("url", "url"), field("logo", "url"), field("image", "url"), field("map", "url"), field("sameAs", "area")),
    more,
  );
  inputs.country.value = DATA.defaultCountry;

  // Preview: a card with what search engines and AI tools can now read.
  const card = el("section", "gp-card ls-preview");
  card.setAttribute("aria-label", UI.previewTitle);
  const cardBody = el("div", "ls-biz");
  card.append(el("h2", "gp-h", UI.previewTitle), el("p", "gp-hint", UI.previewHint), cardBody);

  const R = 34, C = 2 * Math.PI * R;
  const ring = svg("svg", { viewBox: "0 0 80 80", width: "88", height: "88", "aria-hidden": "true", class: "gp-ring" });
  ring.append(svg("circle", { cx: "40", cy: "40", r: String(R), fill: "none", "stroke-width": "8", class: "gp-ring-bg" }));
  const arc = svg("circle", { cx: "40", cy: "40", r: String(R), fill: "none", "stroke-width": "8", "stroke-linecap": "round", class: "gp-ring-arc", transform: "rotate(-90 40 40)", "stroke-dasharray": String(C), "stroke-dashoffset": String(C) });
  ring.append(arc);
  const ringWrap = el("div", "gp-ring-wrap");
  const ringNum = el("span", "gp-ring-num", "–");
  ringWrap.append(ring, ringNum);
  const scoreHead = el("p", "gp-score-head");
  const scoreSub = el("p", "gp-score-sub");
  const st = el("div", "gp-score-text");
  st.append(scoreHead, scoreSub);
  const scoreTop = el("div", "gp-score-top");
  scoreTop.setAttribute("role", "status");
  scoreTop.append(ringWrap, st);
  const checks = el("ul", "gp-checks");
  const scoreCard = el("section", "gp-card gp-score");
  scoreCard.setAttribute("aria-label", UI.scoreTitle);
  scoreCard.append(el("h2", "gp-h", UI.scoreTitle), scoreTop, checks);

  const code = el("textarea", "gp-code-box");
  code.readOnly = true;
  code.rows = 14;
  code.dir = "ltr";
  code.spellcheck = false;
  code.setAttribute("aria-label", UI.codeTitle);
  const copyBtn = el("button", "try-btn try-btn-primary", UI.copy);
  copyBtn.type = "button";
  const test = el("a", "try-btn", UI.test);
  test.href = "https://search.google.com/test/rich-results";
  test.target = "_blank";
  test.rel = "noopener noreferrer";
  const status = el("p", "gp-status");
  status.setAttribute("role", "status");
  const codeRow = el("div", "try-controls");
  codeRow.append(copyBtn, test, status);
  const codeCard = el("section", "gp-card gp-code");
  codeCard.append(el("h2", "gp-h", UI.codeTitle), el("p", "gp-hint", UI.codeHint), code, codeRow);

  const side = el("div", "gp-side");
  side.append(card, scoreCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid, codeCard);

  const values = () => {
    const v = {};
    for (const k in inputs) v[k] = inputs[k].value;
    v.hours = dayRows.map((d) => ({ open: d.cb.checked, from: d.from.value, to: d.to.value }));
    return v;
  };

  function hoursText(spec) {
    return spec.map((g) => {
      const idx = g.dayOfWeek.map((d) => API.DAYS.indexOf(d));
      const run = idx.length > 2 && idx.every((x, i) => !i || x === idx[i - 1] + 1);
      const days = run ? UI.daysShort[idx[0]] + "–" + UI.daysShort[idx[idx.length - 1]] : idx.map((i) => UI.daysShort[i]).join(", ");
      return days + " " + g.opens + "–" + g.closes;
    });
  }
  function line(dl, label, value, ltr) {
    if (!value) return;
    const dt = el("dt", null, label);
    const dd = el("dd", null, value);
    dd.dir = ltr ? "ltr" : "auto";
    dl.append(dt, dd);
  }

  function render() {
    const v = values();
    const s = API.buildSchema(v);
    dayRows.forEach((d) => { d.r.dataset.open = d.cb.checked ? "1" : "0"; d.from.disabled = d.to.disabled = !d.cb.checked; });
    // Preview card.
    cardBody.textContent = "";
    const head = el("div", "ls-biz-head");
    const name = (s.name || "").trim();
    const badge = el("span", "ls-badge", (name[0] || "?").toUpperCase());
    badge.setAttribute("aria-hidden", "true");
    const ht = el("div");
    const nm = el("p", "ls-biz-name", name || UI.emptyName);
    nm.dir = "auto";
    const typeLabel = (UI.types.find((t) => t[0] === s["@type"]) || ["", ""])[1];
    const sub = el("p", "ls-biz-type", [typeLabel, s.address && s.address.addressLocality].filter(Boolean).join(" · "));
    sub.dir = "auto";
    ht.append(nm, sub);
    head.append(badge, ht);
    cardBody.append(head);
    if (s.description) { const d = el("p", "ls-biz-desc", s.description); d.dir = "auto"; cardBody.append(d); }
    const dl = el("dl", "ls-biz-list");
    const a = s.address || {};
    line(dl, UI.labels.address, [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(", "));
    line(dl, UI.labels.phone, s.telephone, true);
    line(dl, UI.labels.website, s.url ? s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", true);
    const ht2 = hoursText(s.openingHoursSpecification || []);
    if (ht2.length) line(dl, UI.labels.hours, ht2.join(" · "), false);
    if (s.areaServed) line(dl, UI.labels.area, s.areaServed.map((x) => x.name).join(", "));
    if (s.sameAs) line(dl, UI.labels.profiles, String(s.sameAs.length));
    if (dl.children.length) cardBody.append(dl);
    else cardBody.append(el("p", "ls-biz-empty", UI.emptyCard));
    // Score.
    const empty = !(v.name || "").trim() && !(v.street || "").trim();
    const r = API.checkSchema(v);
    const score = empty ? 0 : r.score;
    arc.setAttribute("stroke-dashoffset", String(C * (1 - score / 100)));
    const band = score >= 80 ? "ok" : score >= 50 ? "warn" : "bad";
    scoreCard.dataset.level = empty ? "none" : band;
    ringNum.textContent = empty ? "–" : String(score);
    scoreHead.textContent = empty ? UI.scoreEmpty : UI.score[band];
    const todo = r.checks.filter((c) => c.level !== "ok").length;
    scoreSub.textContent = empty ? UI.scoreEmptySub : todo ? UI.todoMany.replace("{n}", String(todo)) : UI.todoNone;
    checks.textContent = "";
    if (!empty) {
      const order = { bad: 0, warn: 1, ok: 2 };
      r.checks.slice().sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
        const li = el("li", "gp-check gp-" + c.level);
        const ic = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
        ic.setAttribute("aria-hidden", "true");
        const tx = el("span", "gp-check-text");
        tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
        li.append(ic, tx);
        checks.append(li);
      });
    }
    code.value = API.schemaScript(s);
  }

  function setAll(x) {
    for (const k in inputs) inputs[k].value = x[k] != null ? x[k] : "";
    if (!x.country) inputs.country.value = DATA.defaultCountry;
    if (!x.type) inputs.type.value = "LocalBusiness";
    const h = x.hours || DATA.defaultHours;
    dayRows.forEach((d, i) => { d.cb.checked = h[i].open; d.from.value = h[i].from; d.to.value = h[i].to; });
    status.textContent = "";
    render();
  }

  form.addEventListener("input", () => { status.textContent = ""; render(); });
  form.addEventListener("change", render);
  copyWeek.addEventListener("click", () => {
    const m = dayRows[0];
    for (let i = 1; i < 5; i++) { dayRows[i].cb.checked = m.cb.checked; dayRows[i].from.value = m.from.value; dayRows[i].to.value = m.to.value; }
    render();
  });
  tryBtn.addEventListener("click", () => { setAll(DATA.example); inputs.name.focus(); });
  clearBtn.addEventListener("click", () => { setAll({}); inputs.name.focus(); });
  copyBtn.addEventListener("click", () => {
    const done = () => { status.textContent = UI.copied; };
    const fallback = () => {
      code.focus();
      code.select();
      try { document.execCommand("copy") ? done() : (status.textContent = UI.copyFailed); } catch (e) { status.textContent = UI.copyFailed; }
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, fallback);
    else fallback();
  });
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
