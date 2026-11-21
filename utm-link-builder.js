// /en/utm-link-builder/ and /he/utm-link-builder/ client logic. Progressive enhancement: without JS the page
// explains UTM links and shows examples. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/utm-builder.ts with the types removed (made with the TypeScript
// compiler). tests/utm-link-builder.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="ut-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to utm-builder.ts) ----------
  /** Ready-made source and medium pairs for the places a small business shares links. */
  const CHANNELS = [
      { id: "facebook", source: "facebook", medium: "social" },
      { id: "instagram", source: "instagram", medium: "social" },
      { id: "linkedin", source: "linkedin", medium: "social" },
      { id: "whatsapp", source: "whatsapp", medium: "social" },
      { id: "tiktok", source: "tiktok", medium: "social" },
      { id: "youtube", source: "youtube", medium: "social" },
      { id: "email", source: "newsletter", medium: "email" },
      { id: "gbp", source: "google", medium: "organic" },
      { id: "sms", source: "sms", medium: "sms" },
      { id: "facebook_ads", source: "facebook", medium: "paid_social" },
      { id: "qr", source: "flyer", medium: "qr" },
  ];
  /** Mediums Google Analytics 4 recognises for its default channel groups. Anything else usually lands in "Unassigned". */
  const KNOWN_MEDIUMS = ["social", "social-network", "social-media", "sm", "social network", "social media", "email", "e-mail", "e_mail", "e mail", "organic", "sms", "cpc", "ppc", "paid_social", "paid-social", "paidsocial", "retargeting", "referral", "affiliate", "display", "banner", "cpm", "video", "audio", "push", "mobile", "notification"];
  const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  /** A value as it should go in a link: lower case, spaces as dashes, no punctuation that breaks reports. */
  function slug(input) {
      return clean(input).toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  }
  /** The page address as a URL object, adding https:// when it was left out. Null when it isn't a web address. */
  function parsePage(input) {
      let u = clean(input);
      if (!u)
          return null;
      if (!/^https?:\/\//i.test(u))
          u = "https://" + u;
      if (!/^https?:\/\/[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?([/?#]\S*)?$/iu.test(u))
          return null;
      try {
          return new URL(u);
      }
      catch (e) {
          return null;
      }
  }
  const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  /** The tracked link: the page with any old utm_ values replaced, other parameters kept, and #section left at the end. */
  function buildLink(input) {
      const page = parsePage(input.url || "");
      if (!page)
          return "";
      const keep = [];
      page.search.replace(/^\?/, "").split("&").filter(Boolean).forEach((p) => {
          if (!UTM.includes(decodeURIComponent(p.split("=")[0]).toLowerCase()))
              keep.push(p);
      });
      const vals = [slug(input.source || ""), slug(input.medium || ""), slug(input.campaign || ""), slug(input.content || ""), slug(input.term || "")];
      UTM.forEach((k, i) => { if (vals[i])
          keep.push(k + "=" + encodeURIComponent(vals[i])); });
      return page.origin + page.pathname + (keep.length ? "?" + keep.join("&") : "") + page.hash;
  }
  /** The utm_ values in a link someone already has, so they can see what it will report. */
  function readLink(input) {
      const page = parsePage(input);
      const out = {};
      if (!page)
          return out;
      page.searchParams.forEach((v, k) => { if (UTM.includes(k.toLowerCase()))
          out[k.toLowerCase().slice(4)] = v; });
      return out;
  }
  /** What to fix before sharing, most important first. */
  function checkLink(input) {
      const c = [];
      const page = parsePage(input.url || "");
      if (!clean(input.url))
          c.push({ id: "url_missing", level: "bad" });
      else if (!page)
          c.push({ id: "url_bad", level: "bad" });
      else {
          c.push({ id: "url_ok", level: "ok" });
          if (Object.keys(readLink(input.url || "")).length)
              c.push({ id: "old_utm", level: "warn" });
          if (page.protocol === "http:")
              c.push({ id: "http", level: "warn" });
      }
      const camp = clean(input.campaign);
      if (!camp)
          c.push({ id: "campaign_missing", level: "bad" });
      else {
          c.push({ id: "campaign_ok", level: "ok" });
          if (slug(camp) !== camp)
              c.push({ id: "campaign_tidied", level: "ok" });
          if (/[^\x00-\x7F]/.test(camp))
              c.push({ id: "campaign_non_latin", level: "warn" });
      }
      if (input.source !== undefined && !slug(input.source))
          c.push({ id: "source_missing", level: "bad" });
      if (input.medium !== undefined) {
          const m = slug(input.medium);
          if (!m)
              c.push({ id: "medium_missing", level: "bad" });
          else if (!KNOWN_MEDIUMS.includes(m) && m !== "qr")
              c.push({ id: "medium_unknown", level: "warn" });
      }
      return c;
  }

  const API = { slug, parsePage, buildLink, readLink, checkLink, CHANNELS, KNOWN_MEDIUMS };
  root.UtmBuilder = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("ut-app");
  const dataEl = document.getElementById("ut-data");
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
    const id = "ut-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    const c = el("input");
    c.type = key === "url" ? "url" : "text";
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    c.dir = f.ltr ? "ltr" : "auto";
    c.autocomplete = f.auto || "off";
    c.spellcheck = false;
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    return wrap;
  }
  let stepNo = 0;
  function step(title, ...kids) {
    const fs = el("fieldset", "ut-step");
    const lg = el("legend");
    lg.append(el("span", "ut-num", String(++stepNo)), document.createTextNode(title));
    fs.append(lg, ...kids);
    return fs;
  }
  const dot = (id) => {
    const c = DATA.colors[id] || ["#7a869a", "?"];
    const d = el("span", "ut-dot", c[1]);
    d.style.background = c[0];
    d.setAttribute("aria-hidden", "true");
    return d;
  };

  // Step 2 ideas: one click fills the campaign name.
  const now = new Date();
  const ideas = el("div", "ut-ideas");
  ideas.append(el("span", null, UI.ideas));
  UI.campaignIdeas.forEach((t) => {
    const v = t.replace("{month}", UI.months[now.getMonth()] + "-" + now.getFullYear());
    const b = button("ut-idea", v);
    b.addEventListener("click", () => { inputs.campaign.value = v; render(); inputs.campaign.focus(); });
    ideas.append(b);
  });

  // Step 3: channel chips.
  const ids = API.CHANNELS.map((c) => c.id).concat("custom");
  const chips = el("div", "ut-chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", UI.steps.channels);
  const chipEls = {};
  ids.forEach((id) => {
    const b = button("ut-chip");
    b.setAttribute("aria-pressed", "false");
    const tick = el("span", "ut-tick", "✓");
    tick.setAttribute("aria-hidden", "true");
    b.append(dot(id), el("span", null, UI.channels[id]), tick);
    b.addEventListener("click", () => { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); render(); });
    chipEls[id] = b;
    chips.append(b);
  });
  const custom = el("div", "ut-custom");
  custom.append(el("p", "ut-custom-title", UI.customTitle), field("source"), field("medium"));

  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const more = el("details", "gp-more");
  more.append(el("summary", null, UI.more), field("content"), field("term"));

  const form = el("div", "ft-box gp-form");
  form.append(
    formTop,
    step(UI.steps.page, field("url")),
    step(UI.steps.campaign, field("campaign"), ideas),
    step(UI.steps.channels, el("p", "gp-hint", UI.channelsHint), chips, custom),
    more,
  );
  form.querySelector(".ut-step:nth-of-type(3) .gp-hint").style.margin = "0";

  // The links.
  const copyAll = button("try-btn try-btn-primary ut-small", UI.copyAll);
  const status = el("p", "gp-status");
  status.setAttribute("role", "status");
  const linksTop = el("div", "ut-links-top");
  linksTop.append(el("h2", "gp-h", UI.linksTitle), copyAll);
  const list = el("div", "ut-links");
  const linksCard = el("section", "gp-card");
  linksCard.setAttribute("aria-label", UI.linksTitle);
  linksCard.append(linksTop, el("p", "gp-hint", UI.linksHint), status, list);

  const checks = el("ul", "gp-checks");
  const checksCard = el("section", "gp-card");
  checksCard.append(el("h2", "gp-h", UI.checksTitle), checks);
  checks.style.marginTop = "0.9rem";

  const side = el("div", "gp-side");
  side.append(linksCard, checksCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);

  // Read an existing link.
  const readIn = el("input");
  readIn.type = "url";
  readIn.dir = "ltr";
  readIn.placeholder = UI.readPlaceholder;
  readIn.spellcheck = false;
  readIn.setAttribute("aria-label", UI.readTitle);
  const readOut = el("div", "ut-read-out");
  readOut.setAttribute("aria-live", "polite");
  const readCard = el("section", "gp-card ft-field");
  readCard.append(el("h2", "gp-h", UI.readTitle), el("p", "gp-hint", UI.readHint), readIn, readOut);
  readCard.style.display = "grid";
  readCard.style.gap = "0.6rem";
  const where = el("section", "gp-card ut-where");
  const ol = el("ol");
  UI.where.steps.forEach((s) => ol.append(el("li", null, s)));
  where.append(el("h2", "gp-h", UI.where.title), ol);
  const bottom = el("div", "ut-bottom");
  bottom.append(readCard, where);

  app.textContent = "";
  app.append(grid, bottom);

  const selected = () => ids.filter((id) => chipEls[id].getAttribute("aria-pressed") === "true");

  function copyText(text, onDone) {
    const fallback = () => {
      const t = el("textarea");
      t.value = text;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.append(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      t.remove();
      ok ? onDone() : (status.textContent = UI.copyFailed);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(onDone, fallback);
    else fallback();
  }

  function pretty(link) {
    const box = el("div", "ut-url");
    const q = link.indexOf("?");
    if (q < 0) { box.textContent = link; return box; }
    const hash = link.indexOf("#", q);
    box.append(document.createTextNode(link.slice(0, q + 1)));
    const qs = link.slice(q + 1, hash < 0 ? undefined : hash);
    qs.split("&").forEach((p, i) => {
      if (i) box.append(el("span", "ut-k", "&"));
      const [k, v] = p.split("=");
      if (/^utm_/.test(k)) { box.append(el("span", "ut-k", k + "="), el("span", "ut-v", decodeURIComponent(v || ""))); }
      else box.append(document.createTextNode(p));
    });
    if (hash >= 0) box.append(document.createTextNode(link.slice(hash)));
    return box;
  }

  let current = [];
  function render() {
    const base = { url: inputs.url.value, campaign: inputs.campaign.value, content: inputs.content.value, term: inputs.term.value };
    const sel = selected();
    custom.hidden = !sel.includes("custom");
    const ok = API.parsePage(base.url) && API.slug(base.campaign);
    list.textContent = "";
    current = [];
    if (!ok || !sel.length) {
      const e = el("p", "ut-empty");
      e.append(el("span", "ut-empty-ic", "🔗"), document.createTextNode(ok ? UI.linksNoChannel : UI.linksEmpty));
      list.append(e);
    } else {
      sel.forEach((id) => {
        const ch = id === "custom" ? { id, source: inputs.source.value, medium: inputs.medium.value } : API.CHANNELS.find((c) => c.id === id);
        if (!API.slug(ch.source) || !API.slug(ch.medium)) return;
        const link = API.buildLink({ ...base, source: ch.source, medium: ch.medium });
        current.push([UI.channels[id], link]);
        const row = el("div", "ut-link");
        const head = el("div", "ut-link-head");
        const tags = el("div", "ut-tags");
        tags.append(el("span", "ut-tag", API.slug(ch.source)), el("span", "ut-tag", API.slug(ch.medium)));
        head.append(dot(id), el("span", "ut-link-name", UI.channels[id]), tags);
        const acts = el("div", "ut-link-actions");
        const cp = button("try-btn try-btn-primary ut-small", UI.copy);
        cp.addEventListener("click", () => copyText(link, () => {
          cp.dataset.done = "1";
          cp.textContent = "✓ " + UI.copied;
          setTimeout(() => { cp.dataset.done = ""; cp.textContent = UI.copy; }, 1800);
        }));
        const op = el("a", "try-btn ut-small", UI.open);
        op.href = link;
        op.target = "_blank";
        op.rel = "noopener noreferrer";
        acts.append(cp, op);
        row.append(head, pretty(link), acts);
        list.append(row);
      });
    }
    copyAll.hidden = current.length < 2;
    // Checks.
    const r = API.checkLink(sel.includes("custom") ? { ...base, source: inputs.source.value, medium: inputs.medium.value } : base);
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
  }

  function readRender() {
    readOut.textContent = "";
    const v = readIn.value.trim();
    if (!v) return;
    const r = API.readLink(v);
    const keys = Object.keys(r);
    if (!keys.length) { readOut.append(el("p", "gp-hint", UI.readNone)); return; }
    ["source", "medium", "campaign", "content", "term"].filter((k) => r[k]).forEach((k) => {
      const p = el("span", "ut-pill");
      p.append(document.createTextNode(UI.readLabels[k] + ":"), el("b", null, r[k]));
      readOut.append(p);
    });
  }

  function setAll(x, chans) {
    for (const k in inputs) inputs[k].value = x[k] != null ? x[k] : "";
    ids.forEach((id) => chipEls[id].setAttribute("aria-pressed", chans.includes(id) ? "true" : "false"));
    status.textContent = "";
    render();
  }

  form.addEventListener("input", () => { status.textContent = ""; render(); });
  readIn.addEventListener("input", readRender);
  tryBtn.addEventListener("click", () => { setAll(DATA.example, DATA.exampleChannels); inputs.url.focus(); });
  clearBtn.addEventListener("click", () => { setAll({}, DATA.defaultChannels); inputs.url.focus(); });
  copyAll.addEventListener("click", () => copyText(current.map(([n, l]) => n + ":\n" + l).join("\n\n"), () => { status.textContent = UI.copiedAll; }));
  setAll({}, DATA.defaultChannels);
})(typeof globalThis !== "undefined" ? globalThis : this);
