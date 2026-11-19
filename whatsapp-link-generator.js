// /en/whatsapp-link-generator/ client logic. Progressive enhancement: the page already explains the link format without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a line-for-line copy of src/app/landing/data/tools/whatsapp-link.ts with the types removed.
// tests/whatsapp-link-generator.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the country list from <script id="wl-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to whatsapp-link.ts) ----------
  const DEFAULT_BUTTON_LABEL = "Chat on WhatsApp";

  function normalizeNumber(dial, input) {
    const code = String(dial || "").replace(/\D/g, "");
    if (!code) return { ok: false, error: "Choose a country code." };
    let raw = String(input || "").trim();
    if (!raw) return { ok: false, error: "Enter your business phone number." };
    if (/[^\d\s().+\-]/.test(raw)) return { ok: false, error: "Use digits only. Spaces, dashes and brackets are fine." };
    raw = raw.replace(/\(\s*0\s*\)/g, "");
    let digits = raw.replace(/\D/g, "");
    const international = raw.startsWith("+") || digits.startsWith("00");
    if (digits.startsWith("00")) digits = digits.replace(/^0+/, "");
    let national;
    if (international) {
      if (!digits.startsWith(code)) return { ok: false, error: "That number starts with a different country code. Pick the matching country, or remove the + and enter the local number." };
      national = digits.slice(code.length).replace(/^0+/, "");
    } else {
      national = digits.replace(/^0+/, "");
      if (code === "1" && national.length === 11 && national.startsWith("1")) national = national.slice(1);
    }
    if (national.length < 6) return { ok: false, error: "That number looks too short. Include the full number, area code first." };
    if (code.length + national.length > 15) return { ok: false, error: "That number looks too long. A full international number has at most 15 digits." };
    return { ok: true, number: code + national, national };
  }

  function buildLink(number, message) {
    const n = String(number || "").replace(/\D/g, "");
    const m = String(message == null ? "" : message).trim();
    return `https://wa.me/${n}${m ? `?text=${encodeURIComponent(m)}` : ""}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function buildSnippet(link, label) {
    const text = String(label == null ? "" : label).trim() || DEFAULT_BUTTON_LABEL;
    const style = "display:inline-block;padding:12px 20px;background:#128c7e;color:#ffffff;font:600 16px/1.2 Arial,sans-serif;text-decoration:none;border-radius:8px";
    return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="${style}">${escapeHtml(text)}</a>`;
  }

  const API = { normalizeNumber, buildLink, escapeHtml, buildSnippet };
  root.WhatsappLink = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("wl-app");
  const dataEl = document.getElementById("wl-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  function field(label, hint, control) {
    const id = "wl-f" + ++uid;
    const wrap = el("div", "wl-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("span", "wl-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  function button(text, primary) {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  }

  const country = el("select");
  DATA.countries.forEach((c, i) => {
    const o = el("option", null, `${c.name} (+${c.dial})`);
    o.value = String(i);
    country.append(o);
  });
  const phone = el("input");
  phone.type = "tel";
  phone.autocomplete = "tel-national";
  phone.inputMode = "tel";
  phone.placeholder = "e.g. 07700 900123";
  const message = el("textarea");
  message.rows = 3;
  message.placeholder = "Optional. e.g. " + DATA.defaultMessage;
  message.maxLength = 500;
  const label = el("input");
  label.type = "text";
  label.value = DATA.defaultLabel;
  label.maxLength = 60;

  const form = el("div", "wl-box");
  form.append(
    field("Country code", null, country),
    field("Business phone number", "The number your customers will message. Spaces and a leading 0 are fine.", phone),
    field("Pre-filled message (optional)", "What the customer sees ready to send. They can edit it.", message),
    field("Button text (optional)", "Used in the website button below.", label),
  );

  const error = el("p", "wl-error");
  error.setAttribute("role", "alert");
  const status = el("p", "wl-status");
  status.setAttribute("role", "status");

  const linkInput = el("input");
  linkInput.type = "text";
  linkInput.readOnly = true;
  const copyLink = button("Copy link", true);
  const test = el("a", "try-btn", "Test link");
  test.target = "_blank";
  test.rel = "noopener noreferrer";
  const linkRow = el("div", "try-controls");
  linkRow.append(copyLink, test);

  const snippet = el("textarea");
  snippet.readOnly = true;
  snippet.rows = 5;
  const copySnippet = button("Copy button code");
  const snippetRow = el("div", "try-controls");
  snippetRow.append(copySnippet);
  const preview = el("div", "wl-preview");

  const out = el("div", "wl-out");
  out.hidden = true;
  out.append(
    field("Your WhatsApp link", null, linkInput),
    linkRow,
    field("Button code for your website", "Paste it into your site's HTML. It is a normal link, with no script.", snippet),
    snippetRow,
    preview,
  );

  function copy(text, what) {
    const done = () => { status.textContent = what + " copied."; };
    const fail = () => { status.textContent = "Copy failed. Select the text and copy it."; };
    const fallback = () => {
      try {
        const t = el("textarea");
        t.value = text;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.append(t);
        t.select();
        const ok = document.execCommand("copy");
        t.remove();
        if (ok) done(); else fail();
      } catch (e) { fail(); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  function update() {
    status.textContent = "";
    if (!phone.value.trim()) { error.textContent = ""; out.hidden = true; return; }
    const c = DATA.countries[+country.value];
    const r = normalizeNumber(c.dial, phone.value);
    if (!r.ok) { error.textContent = r.error; out.hidden = true; return; }
    error.textContent = "";
    const link = buildLink(r.number, message.value);
    linkInput.value = link;
    test.href = link;
    const code = buildSnippet(link, label.value);
    snippet.value = code;
    preview.innerHTML = code; // built by buildSnippet: every value is escaped
    out.hidden = false;
  }
  [country, phone, message, label].forEach((n) => n.addEventListener("input", update));
  country.addEventListener("change", update);
  copyLink.addEventListener("click", () => copy(linkInput.value, "Link"));
  copySnippet.addEventListener("click", () => copy(snippet.value, "Button code"));
  [linkInput, snippet].forEach((n) => n.addEventListener("focus", () => n.select()));

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Generator"), document.createTextNode(" Works in your browser. Nothing you type leaves your device."));
  app.append(intro, form, error, out, status);
})(typeof globalThis !== "undefined" ? globalThis : this);
