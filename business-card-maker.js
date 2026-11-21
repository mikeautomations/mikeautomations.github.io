// /en/business-card-maker/ and /he/business-card/ client logic. Progressive enhancement: without JS the page explains
// the tool. The card is drawn on canvases in the browser; public/qr-encoder.js (root.QREncoder) loads first for the QR
// code. No requests to us, no storage, and the logo never leaves the device.
// PART 1 is a copy of src/app/landing/data/tools/card.ts with the types removed (made with the TypeScript compiler).
// tests/business-card-maker.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="bc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to card.ts) ----------
  const SIZES = { eu: { w: 85, h: 55 }, us: { w: 88.9, h: 50.8 } };
  /** Millimetres to pixels at a resolution in dots per inch. */
  const px = (mm, dpi = 300) => Math.round((mm / 25.4) * dpi);
  /** Adds https:// when the scheme is missing; empty stays empty. */
  function normalizeUrl(s) {
      const t = (s || "").trim();
      if (!t)
          return "";
      return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : "https://" + t;
  }
  /** The web address as people read it: no https://, no trailing slash. */
  function displayUrl(s) {
      return (s || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
  const vEsc = (s) => (s || "").trim().replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  /** A vCard 3.0 contact. The name is split at the last space into first and last name. */
  function vcard(c) {
      const name = (c.name || "").trim();
      const i = name.lastIndexOf(" ");
      const first = i > 0 ? name.slice(0, i) : name;
      const last = i > 0 ? name.slice(i + 1) : "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc(name || c.business)}`];
      if (c.business.trim())
          lines.push(`ORG:${vEsc(c.business)}`);
      if (c.title.trim())
          lines.push(`TITLE:${vEsc(c.title)}`);
      if (c.phone.trim())
          lines.push(`TEL;TYPE=CELL:${c.phone.trim().replace(/[^\d+]/g, "")}`);
      if (c.email.trim())
          lines.push(`EMAIL;TYPE=INTERNET:${c.email.trim()}`);
      if (c.website.trim())
          lines.push(`URL:${normalizeUrl(c.website)}`);
      if (c.address.trim())
          lines.push(`ADR;TYPE=WORK:;;${vEsc(c.address)};;;;`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
  }
  /** What the QR code on the back holds: the website, the contact card, or nothing. */
  function qrText(c, mode) {
      if (mode === "website")
          return normalizeUrl(c.website);
      if (mode === "contact")
          return c.name.trim() || c.business.trim() ? vcard(c) : "";
      return "";
  }
  /** How many cards fit on a page, and where the grid starts so it sits in the middle. All in millimetres. */
  function sheet(card, page = { w: 210, h: 297 }, margin = 10) {
      const cols = Math.max(0, Math.floor((page.w - 2 * margin) / card.w));
      const rows = Math.max(0, Math.floor((page.h - 2 * margin) / card.h));
      return { cols, rows, count: cols * rows, x: (page.w - cols * card.w) / 2, y: (page.h - rows * card.h) / 2 };
  }
  /** Initials for the logo spot: up to two letters, from the business or the name. */
  function initials(c) {
      const src = (c.business.trim() || c.name.trim()).split(/\s+/).filter(Boolean);
      return src.slice(0, 2).map((w) => Array.from(w)[0]).join("").toUpperCase();
  }
  function checks(c, mode) {
      const out = [];
      out.push(c.name.trim() || c.business.trim() ? { level: "ok", id: "name_ok" } : { level: "bad", id: "name_missing" });
      out.push(c.phone.trim() || c.email.trim() ? { level: "ok", id: "contact_ok" } : { level: "bad", id: "contact_missing" });
      if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))
          out.push({ level: "warn", id: "email_bad" });
      if ([c.name, c.title, c.business, c.email, displayUrl(c.website), c.address].some((s) => Array.from((s || "").trim()).length > 42))
          out.push({ level: "warn", id: "too_long" });
      if (mode === "website" && !c.website.trim())
          out.push({ level: "warn", id: "qr_no_site" });
      else if (mode === "contact" && vcard(c).length > 330)
          out.push({ level: "warn", id: "qr_dense" });
      else if (mode !== "none")
          out.push({ level: "ok", id: "qr_ok" });
      return out;
  }

  const API = { SIZES, px, normalizeUrl, displayUrl, vcard, qrText, sheet, initials, checks };
  root.BusinessCard = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("bc-app");
  const dataEl = document.getElementById("bc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const RTL = !!DATA.rtl;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  function wrapField(label, control, hint) {
    const w = el("div", "ft-field gp-field");
    const lab = el("label", null, label);
    control.id = control.id || "bc-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const select = (o) => { const s = el("select"); o.options.forEach(([v, l]) => { const x = el("option", null, l); x.value = v; s.append(x); }); return s; };
  const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = el("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };

  // Form.
  const inputs = {};
  const fieldsBox = el("div");
  for (const k of ["name", "title", "business", "phone", "email", "website", "address"]) {
    const f = UI.fields[k];
    const c = el("input");
    c.type = k === "email" ? "email" : k === "phone" ? "tel" : k === "website" ? "url" : "text";
    if (f.placeholder) c.placeholder = f.placeholder;
    c.maxLength = f.max;
    c.dir = f.ltr ? "ltr" : "auto";
    c.autocomplete = { name: "name", title: "organization-title", business: "organization", phone: "tel", email: "email", website: "url", address: "street-address" }[k];
    inputs[k] = c;
    fieldsBox.append(wrapField(f.label, c));
  }
  const layout = select(UI.layout), size = select(UI.size), qrMode = select(UI.qr);
  const row1 = el("div", "bc-row"); row1.append(wrapField(UI.layout.label, layout), wrapField(UI.size.label, size));
  const logoIn = el("input"); logoIn.type = "file"; logoIn.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
  const removeLogo = button("try-btn gp-ghost", UI.removeLogo); removeLogo.hidden = true;
  const logoRow = el("div", "bc-logo");
  const logoField = wrapField(UI.logo, logoIn, UI.logoHint);
  logoRow.append(logoField, removeLogo);
  const themes = el("fieldset", "bc-themes");
  themes.append(el("legend", null, UI.theme));
  let theme = UI.themes[0];
  UI.themes.forEach((t, i) => {
    const lab = el("label", "bc-sw");
    const r = el("input"); r.type = "radio"; r.name = "bc-theme"; r.value = t.id; r.checked = i === 0; r.setAttribute("aria-label", t.label);
    const sw = el("span"); sw.style.background = "linear-gradient(135deg, " + t.bg + " 0 55%, " + t.accent + " 55% 100%)";
    lab.title = t.label; lab.append(r, sw); themes.append(lab);
  });
  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls"); btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle); checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, fieldsBox, row1, wrapField(UI.qr.label, qrMode), logoRow, themes, checksH, checkList);

  // Preview.
  const front = el("canvas"), back = el("canvas");
  front.setAttribute("role", "img"); back.setAttribute("role", "img");
  const sides = el("div", "bc-sides");
  for (const [title, c] of [[UI.front, front], [UI.back, back]]) {
    const s = el("div", "bc-side"); const box = el("div", "bc-card"); box.append(c); s.append(el("h3", null, title), box); sides.append(s);
  }
  const dlF = button("try-btn try-btn-primary", UI.downloadFront);
  const dlB = button("try-btn", UI.downloadBack);
  const pr = button("try-btn", UI.print);
  const vcf = button("try-btn gp-ghost", UI.vcf);
  const acts = el("div", "bc-acts"); acts.append(dlF, dlB, pr, vcf);
  const prev = el("section", "gp-card");
  prev.append(sides, acts);
  const side = el("div", "gp-side"); side.append(prev);
  const grid = el("div", "gp-grid"); grid.append(form, side);
  app.textContent = ""; app.append(grid);

  // Drawing.
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  let logo = null;
  const contact = () => { const c = {}; for (const k in inputs) c[k] = inputs[k].value; return c; };
  function setup(canvas) {
    const s = DATA.sizes[size.value] || DATA.sizes.eu;
    canvas.width = API.px(s.w); canvas.height = API.px(s.h);
    const ctx = canvas.getContext("2d");
    return { ctx, W: canvas.width, H: canvas.height, u: canvas.height / 650 };
  }
  function bg(ctx, W, H, t) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // Draws one line. ltr: the text is a phone, email or web address and keeps left-to-right order inside Hebrew.
  function line(ctx, s, x, y, o) {
    if (!s) return;
    let size = o.size;
    ctx.font = o.weight + " " + size + "px " + FONT;
    while (size > o.size * 0.62 && ctx.measureText(s).width > o.max) { size -= 1; ctx.font = o.weight + " " + size + "px " + FONT; }
    ctx.direction = o.ltr ? "ltr" : RTL ? "rtl" : "ltr";
    ctx.textAlign = o.align === "center" ? "center" : (o.align === "end") !== RTL ? "right" : "left";
    ctx.fillStyle = o.color;
    ctx.fillText(s, x, y, o.max);
  }
  function logoBox(ctx, x, y, w, h, align) {
    if (!logo) return false;
    const r = Math.min(w / logo.width, h / logo.height);
    const lw = logo.width * r, lh = logo.height * r;
    const lx = align === "center" ? x - lw / 2 : align === "right" ? x - lw : x;
    ctx.drawImage(logo, lx, y + (h - lh) / 2, lw, lh);
    return true;
  }
  function contactLines(c) {
    return [[c.phone.trim(), true], [c.email.trim(), true], [API.displayUrl(c.website), true], [c.address.trim(), false]].filter((l) => l[0]);
  }
  function drawFront(c) {
    const { ctx, W, H, u } = setup(front);
    const t = theme;
    ctx.clearRect(0, 0, W, H);
    bg(ctx, W, H, t);
    const P = 70 * u;
    const lines = contactLines(c);
    const ini = API.initials(c);
    const kind = layout.value;
    if (kind === "centered") {
      const cx = W / 2;
      if (!logoBox(ctx, cx, 50 * u, 300 * u, 110 * u, "center") && ini) {
        ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(cx, 105 * u, 52 * u, 0, Math.PI * 2); ctx.fill();
        line(ctx, ini, cx, 122 * u, { size: 46 * u, weight: 800, color: t.onAccent, align: "center", max: 90 * u });
      }
      line(ctx, c.name.trim() || c.business.trim(), cx, 265 * u, { size: 64 * u, weight: 800, color: t.ink, align: "center", max: W - 2 * P });
      line(ctx, c.title.trim(), cx, 315 * u, { size: 32 * u, weight: 500, color: t.soft, align: "center", max: W - 2 * P });
      if (c.name.trim()) line(ctx, c.business.trim(), cx, 370 * u, { size: 34 * u, weight: 700, color: t.accent, align: "center", max: W - 2 * P });
      ctx.fillStyle = t.accent; ctx.fillRect(cx - 40 * u, 400 * u, 80 * u, 4 * u);
      const both = [c.phone.trim(), c.email.trim()].filter(Boolean).join("   ·   ");
      line(ctx, both, cx, 480 * u, { size: 30 * u, weight: 600, color: t.ink, align: "center", max: W - 2 * P, ltr: true });
      line(ctx, API.displayUrl(c.website), cx, 528 * u, { size: 30 * u, weight: 500, color: t.soft, align: "center", max: W - 2 * P, ltr: true });
      line(ctx, c.address.trim(), cx, 574 * u, { size: 26 * u, weight: 500, color: t.soft, align: "center", max: W - 2 * P });
      return;
    }
    let x0 = P, maxW = W - 2 * P;
    if (kind === "band") {
      const bw = Math.round(W * 0.32);
      const bx = RTL ? W - bw : 0;
      ctx.fillStyle = t.accent; ctx.fillRect(bx, 0, bw, H);
      const bcx = bx + bw / 2;
      if (!logoBox(ctx, bcx, H / 2 - 120 * u, bw - 60 * u, 170 * u, "center") && ini) line(ctx, ini, bcx, H / 2 + 20 * u, { size: 120 * u, weight: 800, color: t.onAccent, align: "center", max: bw - 40 * u });
      line(ctx, c.business.trim(), bcx, H / 2 + 120 * u, { size: 28 * u, weight: 700, color: t.onAccent, align: "center", max: bw - 40 * u });
      x0 = bw + 60 * u; maxW = W - bw - 60 * u - P;
    } else {
      // Classic: logo or business name at the top, a thin accent line on the side.
      ctx.fillStyle = t.accent; ctx.fillRect(RTL ? W - 14 * u : 0, 0, 14 * u, H);
      if (!logoBox(ctx, RTL ? W - P : P, 50 * u, 360 * u, 100 * u, RTL ? "right" : "left")) line(ctx, c.business.trim(), RTL ? W - P : P, 120 * u, { size: 36 * u, weight: 800, color: t.accent, align: "start", max: maxW });
    }
    const X = RTL ? W - x0 : x0;
    const nameY = kind === "band" ? 200 * u : 270 * u;
    line(ctx, c.name.trim() || (kind === "band" ? "" : c.business.trim()), X, nameY, { size: 60 * u, weight: 800, color: t.ink, align: "start", max: maxW });
    line(ctx, c.title.trim(), X, nameY + 50 * u, { size: 30 * u, weight: 500, color: t.soft, align: "start", max: maxW });
    const step = 50 * u;
    let y = H - P - (lines.length - 1) * step + 8 * u;
    for (const [s, ltr] of lines) {
      ctx.fillStyle = t.accent;
      ctx.beginPath(); ctx.arc(RTL ? X - 8 * u : X + 8 * u, y - 10 * u, 7 * u, 0, Math.PI * 2); ctx.fill();
      line(ctx, s, RTL ? X - 32 * u : X + 32 * u, y, { size: 29 * u, weight: 600, color: t.ink, align: "start", max: maxW - 32 * u, ltr });
      y += step;
    }
  }
  function drawBack(c) {
    const { ctx, W, H, u } = setup(back);
    const t = theme;
    ctx.clearRect(0, 0, W, H);
    bg(ctx, W, H, t);
    ctx.globalAlpha = 0.12; ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(RTL ? W * 0.85 : W * 0.15, H * 1.05, H * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const text = API.qrText(c, qrMode.value);
    let qr = null;
    if (text && root.QREncoder) { try { qr = root.QREncoder.create(text, "M"); } catch (e) { qr = null; } }
    const label = c.business.trim() || c.name.trim();
    if (!qr) {
      line(ctx, label, W / 2, H / 2 + 10 * u, { size: 70 * u, weight: 800, color: t.ink, align: "center", max: W - 140 * u });
      ctx.fillStyle = t.accent; ctx.fillRect(W / 2 - 50 * u, H / 2 + 50 * u, 100 * u, 5 * u);
      line(ctx, API.displayUrl(c.website), W / 2, H / 2 + 120 * u, { size: 30 * u, weight: 500, color: t.soft, align: "center", max: W - 140 * u, ltr: true });
      return qr;
    }
    const box = Math.round(H * 0.72);
    const bx = RTL ? 70 * u : W - 70 * u - box, by = (H - box) / 2;
    ctx.fillStyle = "#ffffff";
    const r = 24 * u;
    ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.arcTo(bx + box, by, bx + box, by + box, r); ctx.arcTo(bx + box, by + box, bx, by + box, r); ctx.arcTo(bx, by + box, bx, by, r); ctx.arcTo(bx, by, bx + box, by, r); ctx.fill();
    const n = qr.size, quiet = 3, cell = (box - 2 * 14 * u) / (n + 2 * quiet), ox = bx + 14 * u + quiet * cell, oy = by + 14 * u + quiet * cell;
    ctx.fillStyle = "#000000";
    for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) if (qr.data[rr * n + cc]) ctx.fillRect(ox + cc * cell, oy + rr * cell, Math.ceil(cell), Math.ceil(cell));
    const tx = RTL ? W - 80 * u : 80 * u, maxW = W - box - 220 * u;
    line(ctx, label, tx, H / 2 - 10 * u, { size: 54 * u, weight: 800, color: t.ink, align: "start", max: maxW });
    ctx.fillStyle = t.accent; ctx.fillRect(RTL ? tx - 70 * u : tx, H / 2 + 20 * u, 70 * u, 5 * u);
    line(ctx, API.displayUrl(c.website) || c.phone.trim(), tx, H / 2 + 85 * u, { size: 28 * u, weight: 500, color: t.soft, align: "start", max: maxW, ltr: true });
    return qr;
  }
  function render() {
    const c = contact();
    drawFront(c);
    drawBack(c);
    const sum = [c.name, c.title, c.business, c.phone, c.email, API.displayUrl(c.website), c.address].filter((s) => String(s).trim()).join(", ");
    front.setAttribute("aria-label", UI.frontLabel.replace("{summary}", sum));
    back.setAttribute("aria-label", UI.backLabel.replace("{summary}", [c.business.trim() || c.name.trim(), qrMode.value !== "none" ? UI.qrLabel : ""].filter(Boolean).join(", ")));
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(c, qrMode.value).sort((x, y) => order[x.level] - order[y.level]).forEach((k) => {
      const li = el("li", "gp-check gp-" + k.level);
      const icn = el("span", "gp-ic", k.level === "ok" ? "✓" : k.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[k.level] + ": "), document.createTextNode(UI.checks[k.id] || k.id));
      li.append(icn, tx); checkList.append(li);
    });
  }

  themes.addEventListener("change", (e) => { theme = UI.themes.find((t) => t.id === e.target.value) || theme; render(); });
  logoIn.addEventListener("change", () => {
    const f = logoIn.files && logoIn.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { logo = img; removeLogo.hidden = false; render(); };
    img.src = url;
  });
  removeLogo.addEventListener("click", () => { logo = null; logoIn.value = ""; removeLogo.hidden = true; render(); logoIn.focus(); });
  form.addEventListener("input", (e) => { if (e.target !== logoIn) render(); });
  form.addEventListener("change", (e) => { if (e.target !== logoIn && e.target.name !== "bc-theme") render(); });
  dlF.addEventListener("click", () => front.toBlob((b) => b && download(b, UI.fileFront), "image/png"));
  dlB.addEventListener("click", () => back.toBlob((b) => b && download(b, UI.fileBack), "image/png"));
  vcf.addEventListener("click", () => download(new Blob([API.vcard(contact()) + "\r\n"], { type: "text/vcard;charset=utf-8" }), UI.fileVcf));
  pr.addEventListener("click", () => {
    const s = DATA.sizes[size.value] || DATA.sizes.eu;
    const g = API.sheet(s);
    const f = front.toDataURL("image/png"), b = back.toDataURL("image/png");
    // The back page mirrors the columns, so double-sided printing lines up.
    const page = (src, mirror) => {
      let h = '<div class="pg">';
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const col = mirror ? g.cols - 1 - c : c;
        h += '<img alt="" src="' + src + '" style="left:' + (g.x + col * s.w) + "mm;top:" + (g.y + r * s.h) + "mm;width:" + s.w + "mm;height:" + s.h + 'mm">';
      }
      return h + "</div>";
    };
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write("<!doctype html><title>" + UI.printTitle + "</title><style>@page{size:A4;margin:0}body{margin:0}.pg{position:relative;width:210mm;height:297mm;page-break-after:always;overflow:hidden}.pg img{position:absolute;outline:0.1mm solid #bbb}</style>" + page(f, false) + page(b, true) + '<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},200)}<\/script>');
    w.document.close();
  });
  function reset() { for (const k in inputs) inputs[k].value = ""; layout.value = "classic"; size.value = UI.defaultSize; qrMode.value = "contact"; }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    reset();
    for (const k in inputs) inputs[k].value = e[k] || "";
    layout.value = e.layout;
    const r = themes.querySelector('input[value="' + e.theme + '"]');
    if (r) { r.checked = true; theme = UI.themes.find((t) => t.id === e.theme) || theme; }
    render(); inputs.name.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); render(); inputs.name.focus(); });
  reset();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})(typeof globalThis !== "undefined" ? globalThis : this);
