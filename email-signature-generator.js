// /en/email-signature-generator/ client logic. Progressive enhancement: the page already explains the steps and shows an example without JS.
// No dependencies, no cookies or storage, and nothing typed here is sent anywhere (the optional photo or logo link is loaded by the browser, as any image would be).
// PART 1 is src/app/landing/data/tools/email-signature.ts with the types removed (keep identical).
// tests/email-signature-generator.test.ts loads this file in a sandbox and checks both copies give identical output.
(function (root) {
  "use strict";

  // ---------- PART 1: pure builder (keep identical to email-signature.ts) ----------
  // Pure HTML builder behind /en/email-signature-generator/. No DOM, no network. The browser gets the same code:
  // public/email-signature-generator.js PART 1 is this file's functions with the types removed (tests/email-signature-generator.test.ts
  // loads that file in a sandbox and checks both copies give identical output).
  // Output is email-safe: nested tables, inline styles only, no CSS classes, no scripts, web-safe fonts. Every value is escaped,
  // links are limited to http(s), mailto and tel, and the colour is checked, so nothing typed can inject markup.
  const DEFAULT_COLOUR = "#1a56db";
  const DEFAULT_BOOKING_LABEL = "Book a call";
  const LAYOUTS = [
      { id: "classic", label: "Classic", hint: "Photo or logo on the left, details on the right, with a coloured line between." },
      { id: "stacked", label: "Stacked", hint: "Everything in one column, photo or logo on top. Works well on narrow screens." },
      { id: "compact", label: "Compact", hint: "Short and light: name and role, then one line of contact details." },
  ];
  const COLOURS = [
      { value: "#1a56db", label: "Blue" },
      { value: "#0e7c66", label: "Green" },
      { value: "#b42318", label: "Red" },
      { value: "#6941c6", label: "Purple" },
      { value: "#c2410c", label: "Orange" },
      { value: "#1f2937", label: "Charcoal" },
  ];
  function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /** One line of plain text: collapsed whitespace, trimmed, capped. */
  function cleanText(s, max = 200) {
      return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
  }
  /** A #rrggbb colour, or the default when the input is not a hex colour. */
  function normaliseColour(raw) {
      const t = String(raw == null ? "" : raw).trim();
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
      if (!m)
          return DEFAULT_COLOUR;
      let h = m[1].toLowerCase();
      if (h.length === 3)
          h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return "#" + h;
  }
  /** White or near-black text, whichever reads better on this background colour. */
  function contrastText(hex) {
      const n = normaliseColour(hex).slice(1);
      const ch = (i) => {
          const v = parseInt(n.slice(i, i + 2), 16) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
      return lum > 0.4 ? "#111111" : "#ffffff";
  }
  /** An http(s) link, or null. A bare "example.com/page" gets https://. Other schemes (javascript:, data: ...) are refused. */
  function safeUrl(raw) {
      let t = String(raw == null ? "" : raw).trim();
      if (!t)
          return null;
      if (!/^https?:\/\//i.test(t))
          t = "https://" + t;
      return /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?([/?#][^\s"'<>]*)?$/i.test(t) ? t : null;
  }
  function displayUrl(url) {
      return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
  /** tel: link target, or null when there are too few digits. */
  function telHref(raw) {
      const t = String(raw == null ? "" : raw).trim();
      const digits = t.replace(/[^\d]/g, "");
      if (digits.length < 5)
          return null;
      return "tel:" + (t.startsWith("+") ? "+" : "") + digits;
  }
  function isEmail(raw) {
      return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(raw == null ? "" : raw).trim());
  }
  const FONT = "Arial,Helvetica,sans-serif";
  const GREY = "#555555";
  function cleanFields(f) {
      return {
          name: cleanText(f.name, 80),
          title: cleanText(f.title, 80),
          business: cleanText(f.business, 100),
          phone: cleanText(f.phone, 40),
          website: cleanText(f.website, 120),
          email: cleanText(f.email, 120),
          address: cleanText(f.address, 160),
          image: safeUrl(f.imageUrl),
          booking: safeUrl(f.bookingUrl),
          bookingLabel: cleanText(f.bookingLabel, 40) || DEFAULT_BOOKING_LABEL,
          colour: normaliseColour(f.colour),
      };
  }
  /** True when there is anything worth showing. */
  function hasContent(f) {
      const c = cleanFields(f);
      return !!(c.name || c.title || c.business || c.phone || c.website || c.email || c.address || c.image || c.booking);
  }
  const link = (href, text, colour) => `<a href="${escapeHtml(href)}" style="color:${colour};text-decoration:none;">${escapeHtml(text)}</a>`;
  function phoneHtml(c) {
      if (!c.phone)
          return "";
      const href = telHref(c.phone);
      return href ? link(href, c.phone, c.colour) : escapeHtml(c.phone);
  }
  function emailHtml(c) {
      if (!c.email)
          return "";
      return isEmail(c.email) ? link("mailto:" + c.email, c.email, c.colour) : escapeHtml(c.email);
  }
  function websiteHtml(c) {
      if (!c.website)
          return "";
      const url = safeUrl(c.website);
      return url ? link(url, displayUrl(url), c.colour) : escapeHtml(c.website);
  }
  function imageHtml(c, size) {
      if (!c.image)
          return "";
      const alt = c.business || c.name;
      return `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(alt)}" width="${size}" height="${size}" style="display:block;border:0;width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;">`;
  }
  function buttonHtml(c) {
      if (!c.booking)
          return "";
      const text = contrastText(c.colour);
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:10px;"><tr><td bgcolor="${c.colour}" style="background-color:${c.colour};border-radius:4px;padding:8px 14px;"><a href="${escapeHtml(c.booking)}" style="font-family:${FONT};font-size:13px;line-height:16px;font-weight:bold;color:${text};text-decoration:none;display:inline-block;">${escapeHtml(c.bookingLabel)}</a></td></tr></table>`;
  }
  const row = (inner, style = "") => (inner ? `<tr><td style="font-family:${FONT};padding:0;${style}">${inner}</td></tr>` : "");
  function nameLines(c, nameSize) {
      const role = [c.title, c.business].filter(Boolean).map(escapeHtml).join(" | ");
      return (row(c.name ? `<span style="font-size:${nameSize}px;line-height:${nameSize + 4}px;font-weight:bold;color:${c.colour};">${escapeHtml(c.name)}</span>` : "") +
          row(role ? `<span style="font-size:14px;line-height:20px;color:${GREY};">${role}</span>` : ""));
  }
  function contactLines(c) {
      const lab = (l, v) => (v ? `<span style="color:${GREY};">${l}&nbsp;</span>${v}` : "");
      return (row(lab("Phone", phoneHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(lab("Email", emailHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(lab("Web", websiteHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(c.address ? `<span style="color:${GREY};">${escapeHtml(c.address)}</span>` : "", "font-size:13px;line-height:20px;"));
  }
  const outer = (inner) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${FONT};font-size:14px;line-height:20px;color:#333333;">${inner}</table>`;
  const inner = (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
  /** The signature as one HTML fragment, or "" when nothing has been filled in. */
  function buildSignature(f, layout = "classic") {
      if (!hasContent(f))
          return "";
      const c = cleanFields(f);
      if (layout === "stacked") {
          const photo = c.image ? row(imageHtml(c, 72), "padding-bottom:10px;") : "";
          const head = nameLines(c, 18);
          const contacts = contactLines(c);
          const sep = head && contacts ? `<tr><td style="padding:8px 0 8px 0;font-size:0;line-height:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="48"><tr><td height="2" bgcolor="${c.colour}" style="height:2px;font-size:0;line-height:0;background-color:${c.colour};">&nbsp;</td></tr></table></td></tr>` : "";
          const btn = c.booking ? `<tr><td style="padding:0;">${buttonHtml(c)}</td></tr>` : "";
          return outer(photo + head + sep + contacts + btn);
      }
      if (layout === "compact") {
          const role = [c.title, c.business].filter(Boolean).map(escapeHtml).join(" | ");
          const line1 = [c.name ? `<span style="font-size:15px;font-weight:bold;color:${c.colour};">${escapeHtml(c.name)}</span>` : "", role ? `<span style="color:${GREY};">${role}</span>` : ""].filter(Boolean).join(`<span style="color:#999999;"> &middot; </span>`);
          const bits = [phoneHtml(c), emailHtml(c), websiteHtml(c)].filter(Boolean).join(`<span style="color:#999999;"> | </span>`);
          const rows = row(line1) + row(bits, "font-size:13px;line-height:20px;") + row(c.address ? `<span style="color:${GREY};">${escapeHtml(c.address)}</span>` : "", "font-size:13px;line-height:20px;") + (c.booking ? `<tr><td style="padding:0;">${buttonHtml(c)}</td></tr>` : "");
          if (!c.image)
              return outer(rows);
          return outer(`<tr><td style="padding:0 12px 0 0;vertical-align:top;">${imageHtml(c, 48)}</td><td style="padding:0;vertical-align:top;">${inner(rows)}</td></tr>`);
      }
      // classic
      const details = nameLines(c, 18) + (c.name || c.title || c.business ? `<tr><td style="padding:0;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>` : "") + contactLines(c) + (c.booking ? `<tr><td style="padding:0;">${buttonHtml(c)}</td></tr>` : "");
      const photoCell = c.image ? `<td style="padding:0 16px 0 0;vertical-align:top;">${imageHtml(c, 80)}</td>` : "";
      const detailCell = `<td style="padding:0 0 0 ${c.image ? "16" : "14"}px;border-left:3px solid ${c.colour};vertical-align:top;">${inner(details)}</td>`;
      return outer(`<tr>${photoCell}${detailCell}</tr>`);
  }
  /** Plain-text version, used as the text/plain flavour when the signature is copied. */
  function buildSignatureText(f) {
      const c = cleanFields(f);
      const lines = [
          c.name,
          [c.title, c.business].filter(Boolean).join(" | "),
          c.phone ? "Phone: " + c.phone : "",
          c.email ? "Email: " + c.email : "",
          c.website ? "Web: " + (safeUrl(c.website) ? displayUrl(safeUrl(c.website)) : c.website) : "",
          c.address,
          c.booking ? c.bookingLabel + ": " + c.booking : "",
      ];
      return lines.filter(Boolean).join("\n");
  }

  const API = { escapeHtml, cleanText, normaliseColour, contrastText, safeUrl, displayUrl, telHref, isEmail, hasContent, buildSignature, buildSignatureText, DEFAULT_COLOUR, DEFAULT_BOOKING_LABEL, LAYOUTS, COLOURS };
  root.EmailSignature = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("es-app");
  if (!app) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  let uid = 0;
  const state = { layout: "classic", colour: DEFAULT_COLOUR };

  const FIELDS = [
    ["name", "Your name", "text", "Sam Example", "name"],
    ["title", "Job title", "text", "Owner", "organization-title"],
    ["business", "Business", "text", "Example Plumbing", "organization"],
    ["phone", "Phone", "tel", "01234 567890", "tel"],
    ["email", "Email", "email", "sam@example.com", "email"],
    ["website", "Website", "text", "example.com", "url"],
    ["address", "Address (optional)", "text", "1 High Street, Sheffield S1 1AA", "off"],
    ["imageUrl", "Photo or logo link (optional)", "url", "https://example.com/logo.png", "off"],
    ["bookingUrl", "Booking link (optional)", "text", "example.com/book", "off"],
    ["bookingLabel", "Booking button text", "text", DEFAULT_BOOKING_LABEL, "off"],
  ];
  const HINTS = {
    imageUrl: "Must be a public web address (https). Upload the image to your website first. Many email apps hide images until the reader allows them.",
    bookingUrl: "Adds a button. Leave blank for no button.",
  };

  const inputs = {};
  const form = el("section", "es-box");
  form.setAttribute("aria-labelledby", "es-form-h");
  const fh = el("h2", "lx-h3", "Your details");
  fh.id = "es-form-h";
  form.append(fh);

  const grid = el("div", "es-grid");
  FIELDS.forEach(([key, label, type, ph, ac]) => {
    const id = "es-f" + ++uid;
    const wrap = el("div", "es-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = type;
    input.placeholder = ph;
    input.autocomplete = ac;
    input.spellcheck = false;
    wrap.append(lab, input);
    if (HINTS[key]) { const h = el("span", "es-hint", HINTS[key]); h.id = id + "-h"; input.setAttribute("aria-describedby", h.id); wrap.append(h); }
    inputs[key] = input;
    grid.append(wrap);
  });
  form.append(grid);

  // layout
  const layoutSet = el("fieldset", "es-set");
  layoutSet.append(el("legend", null, "Layout"));
  const layoutRow = el("div", "es-choices");
  LAYOUTS.forEach((l, i) => {
    const id = "es-l" + ++uid;
    const wrap = el("div", "es-choice");
    const r = el("input");
    r.type = "radio"; r.name = "es-layout"; r.id = id; r.value = l.id; r.checked = i === 0;
    const lab = el("label", null, l.label);
    lab.htmlFor = id;
    const hint = el("span", "es-hint", l.hint);
    hint.id = id + "-h";
    r.setAttribute("aria-describedby", hint.id);
    r.addEventListener("change", () => { state.layout = l.id; render(); });
    wrap.append(r, lab, hint);
    layoutRow.append(wrap);
  });
  layoutSet.append(layoutRow);

  // colour
  const colourSet = el("fieldset", "es-set");
  colourSet.append(el("legend", null, "Colour"));
  const colourRow = el("div", "es-swatches");
  const hex = el("input");
  const hexId = "es-c" + ++uid;
  const colourErr = el("span", "es-error");
  colourErr.setAttribute("role", "alert");
  COLOURS.forEach((c, i) => {
    const id = "es-s" + ++uid;
    const wrap = el("div", "es-swatch");
    const r = el("input");
    r.type = "radio"; r.name = "es-colour"; r.id = id; r.value = c.value; r.checked = i === 0;
    const lab = el("label", null, c.label);
    lab.htmlFor = id;
    const dot = el("span", "es-dot");
    dot.style.backgroundColor = c.value;
    dot.setAttribute("aria-hidden", "true");
    lab.prepend(dot);
    r.addEventListener("change", () => { state.colour = c.value; hex.value = ""; colourErr.textContent = ""; render(); });
    wrap.append(r, lab);
    colourRow.append(wrap);
  });
  const hexWrap = el("div", "es-field");
  const hexLab = el("label", null, "Or type a hex colour");
  hexLab.htmlFor = hexId;
  hex.id = hexId; hex.type = "text"; hex.placeholder = "#1a56db"; hex.maxLength = 7; hex.spellcheck = false;
  hex.addEventListener("input", () => {
    const v = hex.value.trim();
    if (!v) { colourErr.textContent = ""; return; }
    if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
      colourErr.textContent = "";
      state.colour = normaliseColour(v);
      colourRow.querySelectorAll("input[type=radio]").forEach((x) => { x.checked = false; });
      render();
    } else colourErr.textContent = "Use a hex colour like #1a56db.";
  });
  hexWrap.append(hexLab, hex, colourErr);
  colourSet.append(colourRow, hexWrap);

  form.append(layoutSet, colourSet);

  // example + clear
  const tools = el("div", "try-controls");
  const example = el("button", "try-btn", "Fill in an example");
  example.type = "button";
  example.addEventListener("click", () => {
    const ex = { name: "Sam Example", title: "Owner", business: "Example Plumbing", phone: "01234 567890", email: "sam@example.com", website: "example.com", address: "", imageUrl: "", bookingUrl: "example.com/book", bookingLabel: "Book a call" };
    Object.keys(ex).forEach((k) => { inputs[k].value = ex[k]; });
    render();
  });
  const clear = el("button", "try-btn", "Clear all");
  clear.type = "button";
  clear.addEventListener("click", () => { Object.keys(inputs).forEach((k) => { inputs[k].value = ""; }); render(); inputs.name.focus(); });
  tools.append(example, clear);
  form.append(tools);

  // preview + copy
  const out = el("section", "es-box");
  out.setAttribute("aria-labelledby", "es-prev-h");
  const oh = el("h2", "lx-h3", "Live preview");
  oh.id = "es-prev-h";
  const preview = el("div", "es-preview");
  preview.id = "es-preview";
  const note = el("p", "es-hint", "Your photo or logo is loaded from the link you give. Nothing else leaves your device.");
  const copyRow = el("div", "try-controls");
  const copyBtn = el("button", "try-btn try-btn-primary", "Copy signature");
  copyBtn.type = "button";
  const codeBtn = el("button", "try-btn", "Copy HTML code");
  codeBtn.type = "button";
  const status = el("p", "es-status");
  status.setAttribute("role", "status");
  copyRow.append(copyBtn, codeBtn);
  out.append(oh, preview, note, copyRow, status);

  function fieldsNow() {
    const v = {};
    Object.keys(inputs).forEach((k) => { v[k] = inputs[k].value; });
    v.colour = state.colour;
    return v;
  }

  function render() {
    const html = buildSignature(fieldsNow(), state.layout);
    preview.textContent = "";
    if (!html) {
      preview.append(el("p", "es-empty", "Fill in the form and your signature appears here."));
      copyBtn.disabled = true;
      codeBtn.disabled = true;
      return;
    }
    preview.innerHTML = html;
    copyBtn.disabled = false;
    codeBtn.disabled = false;
  }

  function selectPreview() {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(preview);
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    status.textContent = ok ? "Copied. Now paste it into your email settings." : "Selected. Press Ctrl+C (Cmd+C on a Mac) to copy, then paste it into your email settings.";
  }

  copyBtn.addEventListener("click", async () => {
    status.textContent = "";
    const f = fieldsNow();
    const html = buildSignature(f, state.layout);
    if (!html) return;
    if (navigator.clipboard && typeof window.ClipboardItem === "function" && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([buildSignatureText(f)], { type: "text/plain" }),
        })]);
        status.textContent = "Copied. Now paste it into your email settings.";
        return;
      } catch (e) { /* fall through to selecting the preview */ }
    }
    selectPreview();
  });

  codeBtn.addEventListener("click", async () => {
    const html = buildSignature(fieldsNow(), state.layout);
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      status.textContent = "HTML code copied.";
    } catch (e) {
      const ta = el("textarea", "es-code");
      ta.value = html;
      ta.readOnly = true;
      ta.setAttribute("aria-label", "Signature HTML code");
      out.append(ta);
      ta.select();
      status.textContent = "Press Ctrl+C (Cmd+C on a Mac) to copy the code.";
    }
  });

  Object.keys(inputs).forEach((k) => inputs[k].addEventListener("input", render));

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "Generator"), document.createTextNode(" Works in your browser. Nothing you type is sent to us."));
  app.append(intro, form, out);
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
