// /he/email-signature-generator/ client logic. Progressive enhancement: the page already explains everything without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is generated from src/app/landing/he-tools/email-signature-he-data.ts (the HTML builder), types removed.
// tests/he-tools-c.test.ts loads this file in a sandbox and checks it gives the same results as the TypeScript.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (generated from email-signature-he-data.ts) ----------
  // Pure HTML builder behind /he/email-signature-generator/. No DOM, no network, no imports: public/email-signature-generator-he.js
  // PART 1 is generated from this file (tests/he-tools-c.test.ts checks both give identical output).
  // Right-to-left and email-safe: nested tables with dir="rtl" and an inline direction, inline styles only, no classes, no scripts,
  // web-safe fonts. The first cell of a row sits on the right. Phone, email and web values are set left-to-right inside the
  // right-to-left text so numbers and addresses do not flip. Every value is escaped; links are limited to http(s), mailto and tel.
  const DEFAULT_COLOUR = "#1a56db";
  const DEFAULT_BOOKING_LABEL = "לקביעת שיחה";
  const LAYOUTS = [
      { id: "classic", label: "קלאסי", hint: "תמונה או לוגו מימין, הפרטים משמאלם, וקו צבעוני ביניהם." },
      { id: "stacked", label: "טור אחד", hint: "הכול בעמודה אחת, התמונה או הלוגו למעלה. מתאים גם למסכים צרים." },
      { id: "compact", label: "קצר", hint: "קל ותמציתי: שם ותפקיד, ואחריהם שורה אחת של פרטי קשר." },
  ];
  const COLOURS = [
      { value: "#1a56db", label: "כחול" },
      { value: "#0e7c66", label: "ירוק" },
      { value: "#b42318", label: "אדום" },
      { value: "#6941c6", label: "סגול" },
      { value: "#c2410c", label: "כתום" },
      { value: "#1f2937", label: "פחם" },
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
  const RTL = `dir="rtl"`;
  const RTL_STYLE = "direction:rtl;text-align:right;";
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
  // Numbers, addresses and links stay left-to-right inside the right-to-left line.
  const LTR = "direction:ltr;unicode-bidi:embed;";
  const link = (href, text, colour) => `<a dir="ltr" href="${escapeHtml(href)}" style="${LTR}color:${colour};text-decoration:none;">${escapeHtml(text)}</a>`;
  const ltrText = (text) => `<span dir="ltr" style="${LTR}">${escapeHtml(text)}</span>`;
  function phoneHtml(c) {
      if (!c.phone)
          return "";
      const href = telHref(c.phone);
      return href ? link(href, c.phone, c.colour) : ltrText(c.phone);
  }
  function emailHtml(c) {
      if (!c.email)
          return "";
      return isEmail(c.email) ? link("mailto:" + c.email, c.email, c.colour) : ltrText(c.email);
  }
  function websiteHtml(c) {
      if (!c.website)
          return "";
      const url = safeUrl(c.website);
      return url ? link(url, displayUrl(url), c.colour) : ltrText(c.website);
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
      return `<table ${RTL} role="presentation" cellpadding="0" cellspacing="0" border="0" style="${RTL_STYLE}border-collapse:separate;margin-top:10px;"><tr><td ${RTL} bgcolor="${c.colour}" style="${RTL_STYLE}background-color:${c.colour};border-radius:4px;padding:8px 14px;"><a href="${escapeHtml(c.booking)}" style="font-family:${FONT};font-size:13px;line-height:16px;font-weight:bold;color:${text};text-decoration:none;display:inline-block;">${escapeHtml(c.bookingLabel)}</a></td></tr></table>`;
  }
  const row = (inner, style = "") => (inner ? `<tr><td ${RTL} align="right" style="${RTL_STYLE}font-family:${FONT};padding:0;${style}">${inner}</td></tr>` : "");
  function nameLines(c, nameSize) {
      const role = [c.title, c.business].filter(Boolean).map(escapeHtml).join(" | ");
      return (row(c.name ? `<span style="font-size:${nameSize}px;line-height:${nameSize + 4}px;font-weight:bold;color:${c.colour};">${escapeHtml(c.name)}</span>` : "") +
          row(role ? `<span style="font-size:14px;line-height:20px;color:${GREY};">${role}</span>` : ""));
  }
  function contactLines(c) {
      const lab = (l, v) => (v ? `<span style="color:${GREY};">${l}:&nbsp;</span>${v}` : "");
      return (row(lab("טלפון", phoneHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(lab("אימייל", emailHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(lab("אתר", websiteHtml(c)), "font-size:13px;line-height:20px;color:#333333;") +
          row(c.address ? `<span style="color:${GREY};">${escapeHtml(c.address)}</span>` : "", "font-size:13px;line-height:20px;"));
  }
  const outer = (inner) => `<table ${RTL} role="presentation" cellpadding="0" cellspacing="0" border="0" style="${RTL_STYLE}border-collapse:collapse;font-family:${FONT};font-size:14px;line-height:20px;color:#333333;">${inner}</table>`;
  const inner = (rows) => `<table ${RTL} role="presentation" cellpadding="0" cellspacing="0" border="0" style="${RTL_STYLE}border-collapse:collapse;">${rows}</table>`;
  const btnRow = (c) => (c.booking ? `<tr><td ${RTL} align="right" style="${RTL_STYLE}padding:0;">${buttonHtml(c)}</td></tr>` : "");
  /** The signature as one HTML fragment, or "" when nothing has been filled in. */
  function buildSignature(f, layout = "classic") {
      if (!hasContent(f))
          return "";
      const c = cleanFields(f);
      if (layout === "stacked") {
          const photo = c.image ? row(imageHtml(c, 72), "padding-bottom:10px;") : "";
          const head = nameLines(c, 18);
          const contacts = contactLines(c);
          const sep = head && contacts ? `<tr><td ${RTL} align="right" style="${RTL_STYLE}padding:8px 0 8px 0;font-size:0;line-height:0;"><table ${RTL} role="presentation" cellpadding="0" cellspacing="0" border="0" width="48" style="${RTL_STYLE}"><tr><td height="2" bgcolor="${c.colour}" style="height:2px;font-size:0;line-height:0;background-color:${c.colour};">&nbsp;</td></tr></table></td></tr>` : "";
          return outer(photo + head + sep + contacts + btnRow(c));
      }
      if (layout === "compact") {
          const role = [c.title, c.business].filter(Boolean).map(escapeHtml).join(" | ");
          const line1 = [c.name ? `<span style="font-size:15px;font-weight:bold;color:${c.colour};">${escapeHtml(c.name)}</span>` : "", role ? `<span style="color:${GREY};">${role}</span>` : ""].filter(Boolean).join(`<span style="color:#999999;"> &middot; </span>`);
          const bits = [phoneHtml(c), emailHtml(c), websiteHtml(c)].filter(Boolean).join(`<span style="color:#999999;"> | </span>`);
          const rows = row(line1) + row(bits, "font-size:13px;line-height:20px;") + row(c.address ? `<span style="color:${GREY};">${escapeHtml(c.address)}</span>` : "", "font-size:13px;line-height:20px;") + btnRow(c);
          if (!c.image)
              return outer(rows);
          return outer(`<tr><td ${RTL} align="right" style="${RTL_STYLE}padding:0 0 0 12px;vertical-align:top;">${imageHtml(c, 48)}</td><td ${RTL} align="right" style="${RTL_STYLE}padding:0;vertical-align:top;">${inner(rows)}</td></tr>`);
      }
      // classic: the photo is the first cell, so it sits on the right; the coloured line is on the right edge of the details.
      const details = nameLines(c, 18) + (c.name || c.title || c.business ? `<tr><td style="padding:0;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>` : "") + contactLines(c) + btnRow(c);
      const photoCell = c.image ? `<td ${RTL} align="right" style="${RTL_STYLE}padding:0 0 0 16px;vertical-align:top;">${imageHtml(c, 80)}</td>` : "";
      const detailCell = `<td ${RTL} align="right" style="${RTL_STYLE}padding:0 ${c.image ? "16" : "14"}px 0 0;border-right:3px solid ${c.colour};vertical-align:top;">${inner(details)}</td>`;
      return outer(`<tr>${photoCell}${detailCell}</tr>`);
  }
  /** Plain-text version, used as the text/plain flavour when the signature is copied. */
  function buildSignatureText(f) {
      const c = cleanFields(f);
      const lines = [
          c.name,
          [c.title, c.business].filter(Boolean).join(" | "),
          c.phone ? "טלפון: " + c.phone : "",
          c.email ? "אימייל: " + c.email : "",
          c.website ? "אתר: " + (safeUrl(c.website) ? displayUrl(safeUrl(c.website)) : c.website) : "",
          c.address,
          c.booking ? c.bookingLabel + ": " + c.booking : "",
      ];
      return lines.filter(Boolean).join("\n");
  }

  root.EmailSignatureHe = { DEFAULT_COLOUR, DEFAULT_BOOKING_LABEL, LAYOUTS, COLOURS, escapeHtml, cleanText, normaliseColour, contrastText, safeUrl, displayUrl, telHref, isEmail, hasContent, buildSignature, buildSignatureText };

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

  // [key, label, type, placeholder, autocomplete, left-to-right input]
  const FIELDS = [
    ["name", "השם שלכם", "text", "דנה לוי", "name", false],
    ["title", "תפקיד", "text", "בעלת העסק", "organization-title", false],
    ["business", "שם העסק", "text", "דנה לוי שירותי שיווק", "organization", false],
    ["phone", "טלפון", "tel", "050-1234567", "tel", true],
    ["email", "אימייל", "email", "dana@example.com", "email", true],
    ["website", "אתר", "text", "example.co.il", "url", true],
    ["address", "כתובת (רשות)", "text", "הרצל 10, חיפה", "off", false],
    ["imageUrl", "קישור לתמונה או ללוגו (רשות)", "url", "https://example.co.il/logo.png", "off", true],
    ["bookingUrl", "קישור לקביעת שיחה (רשות)", "text", "example.co.il/book", "off", true],
    ["bookingLabel", "טקסט הכפתור", "text", DEFAULT_BOOKING_LABEL, "off", false],
  ];
  const HINTS = {
    imageUrl: "חייבת להיות כתובת ציבורית (https). העלו קודם את התמונה לאתר שלכם. אפליקציות מייל רבות מסתירות תמונות עד שהנמען מאשר.",
    bookingUrl: "מוסיף כפתור. השאירו ריק אם לא צריך כפתור.",
  };

  const inputs = {};
  const form = el("section", "het-box");
  form.setAttribute("aria-labelledby", "es-form-h");
  const fh = el("h2", "lx-h3", "הפרטים שלכם");
  fh.id = "es-form-h";
  form.append(fh);

  const grid = el("div", "het-grid");
  FIELDS.forEach(([key, label, type, ph, ac, ltr]) => {
    const id = "es-f" + ++uid;
    const wrap = el("div", "het-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input", ltr ? "het-ltr" : null);
    input.id = id;
    input.type = type;
    input.placeholder = ph;
    input.autocomplete = ac;
    input.spellcheck = false;
    wrap.append(lab, input);
    if (HINTS[key]) { const hh = el("span", "het-hint", HINTS[key]); hh.id = id + "-h"; input.setAttribute("aria-describedby", hh.id); wrap.append(hh); }
    inputs[key] = input;
    grid.append(wrap);
  });
  form.append(grid);

  // layout
  const layoutSet = el("fieldset", "het-set");
  layoutSet.append(el("legend", null, "עיצוב"));
  const layoutRow = el("div", "het-choices");
  LAYOUTS.forEach((l, i) => {
    const id = "es-l" + ++uid;
    const wrap = el("div", "het-choice");
    const r = el("input");
    r.type = "radio"; r.name = "es-layout"; r.id = id; r.value = l.id; r.checked = i === 0;
    const lab = el("label", null, l.label);
    lab.htmlFor = id;
    const hint = el("span", "het-hint", l.hint);
    hint.id = id + "-h";
    r.setAttribute("aria-describedby", hint.id);
    r.addEventListener("change", () => { state.layout = l.id; render(); });
    wrap.append(r, lab, hint);
    layoutRow.append(wrap);
  });
  layoutSet.append(layoutRow);

  // colour
  const colourSet = el("fieldset", "het-set");
  colourSet.append(el("legend", null, "צבע"));
  const colourRow = el("div", "het-swatches");
  const hex = el("input", "het-ltr");
  const hexId = "es-c" + ++uid;
  const colourErr = el("span", "het-error");
  colourErr.setAttribute("role", "alert");
  COLOURS.forEach((c, i) => {
    const id = "es-s" + ++uid;
    const wrap = el("div", "het-swatch");
    const r = el("input");
    r.type = "radio"; r.name = "es-colour"; r.id = id; r.value = c.value; r.checked = i === 0;
    const lab = el("label", null, c.label);
    lab.htmlFor = id;
    const dot = el("span", "het-dot");
    dot.style.backgroundColor = c.value;
    dot.setAttribute("aria-hidden", "true");
    lab.prepend(dot);
    r.addEventListener("change", () => { state.colour = c.value; hex.value = ""; colourErr.textContent = ""; render(); });
    wrap.append(r, lab);
    colourRow.append(wrap);
  });
  const hexWrap = el("div", "het-field");
  const hexLab = el("label", null, "או הקלידו צבע בקוד hex");
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
    } else colourErr.textContent = "הקלידו קוד צבע כמו #1a56db.";
  });
  hexWrap.append(hexLab, hex, colourErr);
  colourSet.append(colourRow, hexWrap);

  form.append(layoutSet, colourSet);

  // example + clear
  const tools = el("div", "try-controls");
  const example = el("button", "try-btn", "מילוי דוגמה");
  example.type = "button";
  example.addEventListener("click", () => {
    const ex = { name: "דנה לוי", title: "בעלת העסק", business: "דנה לוי שירותי שיווק", phone: "050-1234567", email: "dana@example.com", website: "example.co.il", address: "", imageUrl: "", bookingUrl: "example.co.il/book", bookingLabel: DEFAULT_BOOKING_LABEL };
    Object.keys(ex).forEach((k) => { inputs[k].value = ex[k]; });
    render();
  });
  const clear = el("button", "try-btn", "ניקוי הכול");
  clear.type = "button";
  clear.addEventListener("click", () => { Object.keys(inputs).forEach((k) => { inputs[k].value = ""; }); render(); inputs.name.focus(); });
  tools.append(example, clear);
  form.append(tools);

  // preview + copy
  const out = el("section", "het-box");
  out.setAttribute("aria-labelledby", "es-prev-h");
  const oh = el("h2", "lx-h3", "תצוגה מקדימה");
  oh.id = "es-prev-h";
  const preview = el("div", "het-preview");
  preview.id = "es-preview";
  preview.dir = "rtl";
  const note = el("p", "het-hint", "התמונה או הלוגו נטענים מהקישור שהזנתם. שום דבר אחר לא יוצא מהמכשיר שלכם.");
  const copyRow = el("div", "try-controls");
  const copyBtn = el("button", "try-btn try-btn-primary", "העתקת חתימה");
  copyBtn.type = "button";
  const codeBtn = el("button", "try-btn", "העתקת קוד HTML");
  codeBtn.type = "button";
  const status = el("p", "het-status");
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
      preview.append(el("p", "het-empty", "מלאו את הטופס והחתימה תופיע כאן."));
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
    status.textContent = ok ? "הועתק. עכשיו הדביקו בהגדרות החתימה במייל." : "החתימה מסומנת. לחצו Ctrl+C (Cmd+C ב-Mac) להעתקה, ואז הדביקו בהגדרות החתימה במייל.";
  }

  copyBtn.addEventListener("click", async () => {
    status.textContent = "";
    const f = fieldsNow();
    // The wrapper carries dir="rtl" so a paste that keeps only the outer markup is still right-to-left.
    const html = buildSignature(f, state.layout);
    if (!html) return;
    if (navigator.clipboard && typeof window.ClipboardItem === "function" && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({
          "text/html": new Blob(['<div dir="rtl" style="direction:rtl;text-align:right;">' + html + "</div>"], { type: "text/html" }),
          "text/plain": new Blob([buildSignatureText(f)], { type: "text/plain" }),
        })]);
        status.textContent = "הועתק. עכשיו הדביקו בהגדרות החתימה במייל.";
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
      status.textContent = "קוד ה-HTML הועתק.";
    } catch (e) {
      const ta = el("textarea", "het-code");
      ta.value = html;
      ta.readOnly = true;
      ta.setAttribute("aria-label", "קוד HTML של החתימה");
      out.append(ta);
      ta.select();
      status.textContent = "לחצו Ctrl+C (Cmd+C ב-Mac) כדי להעתיק את הקוד.";
    }
  });

  Object.keys(inputs).forEach((k) => inputs[k].addEventListener("input", render));

  app.textContent = "";
  const intro = el("p");
  intro.append(el("span", "try-label", "מחולל"), document.createTextNode(" עובד בדפדפן שלכם. שום דבר שאתם מקלידים לא נשלח אלינו."));
  app.append(intro, form, out);
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
