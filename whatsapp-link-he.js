// /he/whatsapp-link/ client logic (Hebrew, RTL). Progressive enhancement: the page already explains the link format without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of src/app/landing/he-tools/whatsapp-link-logic.ts with the types removed (keep identical).
// tests/he-tools-b.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the country list and the texts from <script id="wl-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to whatsapp-link-logic.ts) ----------
  const DEFAULT_BUTTON_LABEL = "דברו איתנו בוואטסאפ";

  function normalizeNumberHe(dial, input) {
    const code = String(dial || "").replace(/\D/g, "");
    if (!code) return { ok: false, error: "בחרו קידומת מדינה." };
    let raw = String(input || "").trim();
    if (!raw) return { ok: false, error: "הזינו את מספר הטלפון של העסק." };
    if (/[^\d\s().+\-]/.test(raw)) return { ok: false, error: "אפשר להקליד ספרות בלבד. רווחים, מקפים וסוגריים בסדר." };
    raw = raw.replace(/\(\s*0\s*\)/g, "");
    let digits = raw.replace(/\D/g, "");
    const international = raw.startsWith("+") || digits.startsWith("00");
    if (digits.startsWith("00")) digits = digits.replace(/^0+/, "");
    let national;
    if (international) {
      if (!digits.startsWith(code)) return { ok: false, error: "המספר מתחיל בקידומת של מדינה אחרת. בחרו את המדינה המתאימה, או הקלידו את המספר המקומי בלי +." };
      national = digits.slice(code.length).replace(/^0+/, "");
    } else if (code === "972" && digits.startsWith("972") && digits.length >= 11) {
      national = digits.slice(3).replace(/^0+/, "");
    } else {
      national = digits.replace(/^0+/, "");
      if (code === "1" && national.length === 11 && national.startsWith("1")) national = national.slice(1);
    }
    if (code === "972" && (national.length < 8 || national.length > 9)) return { ok: false, error: "מספר ישראלי תקין הוא 10 ספרות כולל ה-0 (למשל 052-1234567), או 9 ספרות בקו נייח." };
    if (national.length < 6) return { ok: false, error: "המספר נראה קצר מדי. הקלידו את המספר המלא, כולל קידומת האזור." };
    if (code.length + national.length > 15) return { ok: false, error: "המספר נראה ארוך מדי. מספר בינלאומי מלא כולל עד 15 ספרות." };
    return { ok: true, number: code + national, national };
  }

  function buildLinkHe(number, message) {
    const n = String(number || "").replace(/\D/g, "");
    const m = String(message == null ? "" : message).trim();
    return `https://wa.me/${n}${m ? `?text=${encodeURIComponent(m)}` : ""}`;
  }

  function escapeHtmlHe(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function buildSnippetHe(link, label) {
    const text = String(label == null ? "" : label).trim() || DEFAULT_BUTTON_LABEL;
    const style = "display:inline-block;padding:12px 20px;background:#128c7e;color:#ffffff;font:600 16px/1.2 Arial,sans-serif;text-decoration:none;border-radius:8px";
    return `<a href="${escapeHtmlHe(link)}" target="_blank" rel="noopener noreferrer" style="${style}">${escapeHtmlHe(text)}</a>`;
  }

  root.WhatsappLinkHe = { normalizeNumberHe, buildLinkHe, escapeHtmlHe, buildSnippetHe };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("wl-app");
  const dataEl = document.getElementById("wl-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const T = DATA.ui;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  function field(label, hint, control) {
    const id = "wl-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
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
  phone.dir = "ltr";
  phone.autocomplete = "tel-national";
  phone.inputMode = "tel";
  phone.placeholder = T.phonePlaceholder;
  const message = el("textarea");
  message.rows = 3;
  message.placeholder = T.messagePlaceholder + DATA.defaultMessage;
  message.maxLength = 500;
  const label = el("input");
  label.type = "text";
  label.value = DATA.defaultLabel;
  label.maxLength = 60;

  const form = el("div", "ft-box");
  form.append(
    field(T.country, null, country),
    field(T.phone, T.phoneHint, phone),
    field(T.message, T.messageHint, message),
    field(T.label, T.labelHint, label),
  );

  const error = el("p", "ft-error");
  error.setAttribute("role", "alert");
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");

  const linkInput = el("input");
  linkInput.type = "text";
  linkInput.dir = "ltr";
  linkInput.readOnly = true;
  const copyLink = button(T.copyLink, true);
  const test = el("a", "try-btn", T.test);
  test.target = "_blank";
  test.rel = "noopener noreferrer";
  test.style.textDecoration = "none";
  const linkRow = el("div", "try-controls");
  linkRow.append(copyLink, test);

  const snippet = el("textarea");
  snippet.dir = "ltr";
  snippet.readOnly = true;
  snippet.rows = 5;
  const copySnippet = button(T.copySnippet);
  const snippetRow = el("div", "try-controls");
  snippetRow.append(copySnippet);
  const preview = el("div", "ft-preview");

  const out = el("div", "ft-box");
  out.hidden = true;
  out.append(
    field(T.linkTitle, null, linkInput),
    linkRow,
    field(T.snippetTitle, T.snippetHint, snippet),
    snippetRow,
    preview,
  );

  function copy(text, what) {
    const done = () => { status.textContent = what; };
    const fail = () => { status.textContent = T.copyFail; };
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
    const r = normalizeNumberHe(c.dial, phone.value);
    if (!r.ok) { error.textContent = r.error; out.hidden = true; return; }
    error.textContent = "";
    const link = buildLinkHe(r.number, message.value);
    linkInput.value = link;
    test.href = link;
    const code = buildSnippetHe(link, label.value);
    snippet.value = code;
    preview.innerHTML = code; // built by buildSnippetHe: every value is escaped
    out.hidden = false;
  }
  [country, phone, message, label].forEach((n) => n.addEventListener("input", update));
  country.addEventListener("change", update);
  copyLink.addEventListener("click", () => copy(linkInput.value, T.linkDone));
  copySnippet.addEventListener("click", () => copy(snippet.value, T.snippetDone));
  [linkInput, snippet].forEach((n) => n.addEventListener("focus", () => n.select()));

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", T.generator), document.createTextNode(" " + T.intro));
  app.append(intro, form, error, out, status);
})(typeof globalThis !== "undefined" ? globalThis : this);
