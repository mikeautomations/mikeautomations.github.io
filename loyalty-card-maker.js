// /en/loyalty-card-maker/ and /he/loyalty-card/ client logic. Progressive enhancement: without JS the page explains
// the tool. The card is drawn on canvases in the browser; public/qr-encoder.js (root.QREncoder) loads first for the QR
// code. No requests to us, no storage, and the logo never leaves the device.
// PART 1 is a copy of src/app/landing/data/tools/loyalty.ts with the types removed (made with the TypeScript compiler).
// tests/loyalty-card-maker.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="lc-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to loyalty.ts) ----------
  const STAMP_COUNTS = [5, 6, 8, 10, 12];
  /** Keeps the number of stamps to one of the counts the card can lay out. */
  function clampStamps(n) {
      const v = Math.round(Number(n) || 0);
      return STAMP_COUNTS.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), STAMP_COUNTS[0]);
  }
  /** Up to 6 stamps sit in one row, more go in two equal rows. */
  function grid(count) {
      const n = clampStamps(count);
      return n <= 6 ? { cols: n, rows: 1 } : { cols: Math.ceil(n / 2), rows: 2 };
  }
  /**
   * Where each stamp goes inside a box, in reading order: stamp 1 first, the reward last. In Hebrew the order runs from
   * right to left. Returns centres and a radius that leaves a gap between stamps.
   */
  function stampPositions(count, box, rtl = false) {
      const n = clampStamps(count);
      const { cols, rows } = grid(n);
      const cw = box.w / cols, ch = box.h / rows;
      const r = Math.min(cw, ch) * 0.4;
      const out = [];
      for (let i = 0; i < n; i++) {
          const row = Math.floor(i / cols), col = i % cols;
          const c = rtl ? cols - 1 - col : col;
          out.push({ x: box.x + cw * (c + 0.5), y: box.y + ch * (row + 0.5), r });
      }
      return out;
  }
  /** Fills {name} slots in a text. */
  function fill(t, vars) {
      return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  /** The rules printed on the back, in order. Empty ones are left out. */
  function terms(o, T) {
      const out = [];
      const per = (o.perVisit || "").trim();
      if (per)
          out.push(fill(T.perVisit, { what: per }));
      if (o.expiryMonths > 0)
          out.push(fill(T.expiry, { months: o.expiryMonths }));
      if (o.noCash)
          out.push(T.noCash);
      out.push(T.keep);
      return out;
  }
  function checks(o) {
      const out = [];
      out.push(o.business.trim() ? { level: "ok", id: "name_ok" } : { level: "bad", id: "name_missing" });
      const reward = o.reward.trim();
      if (!reward)
          out.push({ level: "bad", id: "reward_missing" });
      else if (Array.from(reward).length > 40)
          out.push({ level: "warn", id: "reward_long" });
      else
          out.push({ level: "ok", id: "reward_ok" });
      if (clampStamps(o.stamps) >= 10)
          out.push({ level: "ok", id: "count_long" });
      else
          out.push({ level: "ok", id: "count_short" });
      out.push(o.phone.trim() || o.website.trim() ? { level: "ok", id: "contact_ok" } : { level: "warn", id: "contact_missing" });
      if (!(o.perVisit || "").trim())
          out.push({ level: "warn", id: "per_missing" });
      return out;
  }

  const API = { STAMP_COUNTS, clampStamps, grid, stampPositions, fill, terms, checks };
  root.LoyaltyCard = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("lc-app");
  const dataEl = document.getElementById("lc-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const RTL = !!DATA.rtl;
  const HEB = /[֐-׿]/;
  const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    control.id = control.id || "lc-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab);
    if (hint) { const h = el("span", "ft-hint gp-hint", hint); h.id = control.id + "-h"; control.setAttribute("aria-describedby", h.id); w.append(h); }
    w.append(control);
    return w;
  }
  const select = (o) => { const s = el("select"); o.options.forEach(([v, l]) => { const x = el("option", null, l); x.value = String(v); s.append(x); }); return s; };
  const text = (f, type) => { const c = el("input"); c.type = type || "text"; if (f.placeholder) c.placeholder = f.placeholder; c.maxLength = f.max; c.dir = f.ltr ? "ltr" : "auto"; return c; };
  const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = el("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };

  // Form.
  const F = UI.fields;
  const business = text(F.business), reward = text(F.reward), perVisit = text(F.perVisit);
  const phone = text(F.phone, "tel"), website = text(F.website, "url");
  business.autocomplete = "organization"; phone.autocomplete = "tel"; website.autocomplete = "url";
  const stamps = select(UI.stamps), icon = select(UI.icon), expiry = select(UI.expiry), size = select(UI.size), qrMode = select(UI.qr);
  const row1 = el("div", "bc-row"); row1.append(wrapField(UI.stamps.label, stamps), wrapField(UI.icon.label, icon));
  const row2 = el("div", "bc-row"); row2.append(wrapField(UI.expiry.label, expiry), wrapField(UI.size.label, size));
  const row3 = el("div", "bc-row"); row3.append(wrapField(F.phone.label, phone), wrapField(F.website.label, website));
  const cashLab = el("label", "ct-opt"); const noCash = el("input"); noCash.type = "checkbox"; cashLab.append(noCash, document.createTextNode(UI.noCash));
  const logoIn = el("input"); logoIn.type = "file"; logoIn.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
  const removeLogo = button("try-btn gp-ghost", UI.removeLogo); removeLogo.hidden = true;
  const logoRow = el("div", "bc-logo"); logoRow.append(wrapField(UI.logo, logoIn, UI.logoHint), removeLogo);
  const themes = el("fieldset", "bc-themes");
  themes.append(el("legend", null, UI.theme));
  let theme = UI.themes[0];
  UI.themes.forEach((t, i) => {
    const lab = el("label", "bc-sw");
    const r = el("input"); r.type = "radio"; r.name = "lc-theme"; r.value = t.id; r.checked = i === 0; r.setAttribute("aria-label", t.label);
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
  form.append(formTop, wrapField(F.business.label, business), wrapField(F.reward.label, reward, F.reward.hint), row1,
    wrapField(F.perVisit.label, perVisit, F.perVisit.hint), row2, cashLab, row3, wrapField(UI.qr.label, qrMode), logoRow, themes, checksH, checkList);

  // Preview.
  const front = el("canvas"), back = el("canvas");
  front.setAttribute("role", "img"); back.setAttribute("role", "img");
  const sides = el("div", "bc-sides");
  for (const [title, c] of [[UI.front, front], [UI.back, back]]) {
    const s = el("div", "bc-side"); const box = el("div", "bc-card"); box.append(c); s.append(el("h3", null, title), box); sides.append(s);
  }
  const shown = el("input"); shown.type = "range"; shown.min = "0"; shown.step = "1"; shown.value = "0";
  const shownOut = el("output", "lc-out"); shownOut.setAttribute("aria-hidden", "true");
  const shownField = wrapField(UI.shown, shown, UI.shownHint); shownField.classList.add("lc-shown"); shownField.querySelector("label").append(" ", shownOut);
  const dlF = button("try-btn try-btn-primary", UI.downloadFront);
  const dlB = button("try-btn", UI.downloadBack);
  const pr = button("try-btn", UI.print);
  const acts = el("div", "bc-acts"); acts.append(dlF, dlB, pr);
  const prev = el("section", "gp-card");
  prev.append(sides, shownField, acts);
  const side = el("div", "gp-side"); side.append(prev);
  const layoutGrid = el("div", "gp-grid"); layoutGrid.append(form, side);
  app.textContent = ""; app.append(layoutGrid);

  // Stamp pictures, drawn from 24 x 24 outlines.
  const ICONS = {
    star: "M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z",
    cup: "M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M7.5 3.5c-.8 1 .8 2 0 3M11.5 3.5c-.8 1 .8 2 0 3",
    scissors: "M3 6.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 17.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM8.3 8.5L20 20M8.3 15.5L20 4",
    heart: "M12 20.3s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.7c0 5.5-7.6 10.1-7.6 10.1z",
    paw: "M12 12.8c-3 0-5.4 3-5.4 5 0 1.5 1.4 2 2.8 1.6.9-.3 1.7-.6 2.6-.6s1.7.3 2.6.6c1.4.4 2.8-.1 2.8-1.6 0-2-2.4-5-5.4-5zM7.6 6.2a1.8 2.2 0 1 0 3.6 0a1.8 2.2 0 1 0-3.6 0zM12.8 6.2a1.8 2.2 0 1 0 3.6 0a1.8 2.2 0 1 0-3.6 0zM3.4 10.6a1.9 2.3 0 1 0 3.8 0a1.9 2.3 0 1 0-3.8 0zM16.8 10.6a1.9 2.3 0 1 0 3.8 0a1.9 2.3 0 1 0-3.8 0z",
    check: "M5 12.5l4.5 4.5L19 7.5",
    gift: "M4 9.5h16v4H4zM5.5 13.5h13v7h-13zM12 9.5v11M12 9.5C10.5 6.5 7 5.5 6.6 7.4S9 9.5 12 9.5c3 0 5.8 0 5.4-2.1S13.5 6.5 12 9.5",
  };
  const PATHS = {};
  const path = (k) => PATHS[k] || (PATHS[k] = new Path2D(ICONS[k] || ICONS.star));
  function drawIcon(ctx, k, cx, cy, s, color, width, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    if (angle) ctx.rotate(angle);
    ctx.scale(s / 24, s / 24);
    ctx.translate(-12, -12);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.stroke(path(k));
    ctx.restore();
  }

  // Drawing.
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  let logo = null;
  const opts = () => ({ business: business.value, reward: reward.value, stamps: Number(stamps.value), phone: phone.value, website: website.value, perVisit: perVisit.value, expiryMonths: Number(expiry.value), noCash: noCash.checked });
  const site = (s) => (s || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  function setup(canvas) {
    const s = DATA.sizes[size.value] || DATA.sizes.eu;
    canvas.width = Math.round((s.w / 25.4) * 300); canvas.height = Math.round((s.h / 25.4) * 300);
    const ctx = canvas.getContext("2d");
    return { ctx, W: canvas.width, H: canvas.height, u: canvas.height / 650 };
  }
  function bg(ctx, W, H, t) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // One line of text. Text without Hebrew letters (phone numbers, web addresses) keeps left-to-right order.
  function line(ctx, s, x, y, o) {
    if (!s) return;
    let sz = o.size;
    ctx.font = o.weight + " " + sz + "px " + FONT;
    while (sz > o.size * 0.6 && ctx.measureText(s).width > o.max) { sz -= 1; ctx.font = o.weight + " " + sz + "px " + FONT; }
    ctx.direction = RTL && HEB.test(s) ? "rtl" : "ltr";
    ctx.textAlign = o.align === "center" ? "center" : (o.align === "end") !== RTL ? "right" : "left";
    ctx.fillStyle = o.color;
    ctx.fillText(s, x, y, o.max);
  }
  function drawFront(o, filled) {
    const { ctx, W, H, u } = setup(front);
    const t = theme;
    ctx.clearRect(0, 0, W, H);
    bg(ctx, W, H, t);
    const P = 60 * u;
    const S = RTL ? W - P : P, E = RTL ? P : W - P;
    const name = o.business.trim();
    if (logo) {
      const r = Math.min((260 * u) / logo.width, (90 * u) / logo.height);
      const lw = logo.width * r, lh = logo.height * r;
      ctx.drawImage(logo, RTL ? W - P - lw : P, 40 * u + (90 * u - lh) / 2, lw, lh);
      line(ctx, name, E, 98 * u, { size: 32 * u, weight: 700, color: t.soft, align: "end", max: W - 2 * P - lw - 30 * u });
    } else {
      line(ctx, name, S, 100 * u, { size: 50 * u, weight: 800, color: t.ink, align: "start", max: W - 2 * P });
    }
    const n = API.clampStamps(o.stamps);
    line(ctx, API.fill(UI.collect, { n: n - 1 }), S, 165 * u, { size: 28 * u, weight: 600, color: t.soft, align: "start", max: W - 2 * P });
    line(ctx, o.reward.trim() || UI.rewardFallback, S, 215 * u, { size: 42 * u, weight: 800, color: t.accent, align: "start", max: W - 2 * P });
    const spots = API.stampPositions(n, { x: P - 10 * u, y: 250 * u, w: W - 2 * P + 20 * u, h: H - 290 * u }, RTL);
    spots.forEach((p, i) => {
      const last = i === n - 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (last) {
        ctx.fillStyle = t.accent; ctx.fill();
        drawIcon(ctx, "gift", p.x, p.y - p.r * 0.2, p.r * 0.95, t.onAccent, 2, 0);
        line(ctx, UI.free, p.x, p.y + p.r * 0.62, { size: p.r * 0.3, weight: 800, color: t.onAccent, align: "center", max: p.r * 1.6 });
        return;
      }
      ctx.lineWidth = 4 * u; ctx.strokeStyle = t.soft; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
      if (i < filled) {
        ctx.globalAlpha = 0.16; ctx.fillStyle = t.accent; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.86, 0, Math.PI * 2); ctx.lineWidth = 5 * u; ctx.strokeStyle = t.accent; ctx.stroke();
        drawIcon(ctx, icon.value, p.x, p.y, p.r * 1.05, t.accent, 2.4, ((i * 37) % 30 - 15) * Math.PI / 180);
      } else {
        ctx.globalAlpha = 0.3; drawIcon(ctx, icon.value, p.x, p.y, p.r * 0.9, t.soft, 1.6, 0); ctx.globalAlpha = 1;
      }
    });
  }
  function drawBack(o) {
    const { ctx, W, H, u } = setup(back);
    const t = theme;
    ctx.clearRect(0, 0, W, H);
    bg(ctx, W, H, t);
    const P = 64 * u;
    const url = qrMode.value === "website" && o.website.trim() ? (/^[a-z][a-z0-9+.-]*:\/\//i.test(o.website.trim()) ? o.website.trim() : "https://" + o.website.trim()) : "";
    let qr = null;
    if (url && root.QREncoder) { try { qr = root.QREncoder.create(url, "M"); } catch (e) { qr = null; } }
    const box = qr ? Math.round(H * 0.46) : 0;
    const textW = W - 2 * P - (qr ? box + 40 * u : 0);
    const S = RTL ? W - P : P;
    // Name line for the customer.
    line(ctx, UI.nameLine, S, 100 * u, { size: 30 * u, weight: 700, color: t.ink, align: "start", max: textW });
    ctx.font = "700 " + 30 * u + "px " + FONT;
    const lw = Math.min(ctx.measureText(UI.nameLine).width, textW) + 18 * u;
    ctx.fillStyle = t.soft; ctx.globalAlpha = 0.7;
    if (RTL) ctx.fillRect(P + (qr ? box + 40 * u : 0), 104 * u, textW - lw, 3 * u); else ctx.fillRect(P + lw, 104 * u, textW - lw, 3 * u);
    ctx.globalAlpha = 1;
    const list = API.terms(o, UI.terms);
    let y = 180 * u;
    for (const s of list) {
      ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(RTL ? S - 8 * u : S + 8 * u, y - 10 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
      line(ctx, s, RTL ? S - 30 * u : S + 30 * u, y, { size: 27 * u, weight: 500, color: t.ink, align: "start", max: textW - 30 * u });
      y += 50 * u;
    }
    ctx.fillStyle = t.accent; ctx.fillRect(RTL ? S - 70 * u : S, H - 150 * u, 70 * u, 5 * u);
    line(ctx, o.business.trim(), S, H - 95 * u, { size: 34 * u, weight: 800, color: t.ink, align: "start", max: textW });
    line(ctx, [o.phone.trim(), site(o.website)].filter(Boolean).join("   ·   "), S, H - 50 * u, { size: 26 * u, weight: 600, color: t.soft, align: "start", max: textW });
    if (!qr) return;
    const bx = RTL ? P : W - P - box, by = H - P - box;
    ctx.fillStyle = "#ffffff";
    const r = 20 * u;
    ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.arcTo(bx + box, by, bx + box, by + box, r); ctx.arcTo(bx + box, by + box, bx, by + box, r); ctx.arcTo(bx, by + box, bx, by, r); ctx.arcTo(bx, by, bx + box, by, r); ctx.fill();
    const q = qr.size, quiet = 3, cell = (box - 24 * u) / (q + 2 * quiet), ox = bx + 12 * u + quiet * cell, oy = by + 12 * u + quiet * cell;
    ctx.fillStyle = "#000000";
    for (let rr = 0; rr < q; rr++) for (let cc = 0; cc < q; cc++) if (qr.data[rr * q + cc]) ctx.fillRect(ox + cc * cell, oy + rr * cell, Math.ceil(cell), Math.ceil(cell));
    line(ctx, UI.scan, bx + box / 2, by - 16 * u, { size: 22 * u, weight: 700, color: t.soft, align: "center", max: box + 20 * u });
  }
  function render() {
    const o = opts();
    const n = API.clampStamps(o.stamps);
    shown.max = String(n - 1);
    if (Number(shown.value) > n - 1) shown.value = String(n - 1);
    const filled = Number(shown.value);
    shownOut.textContent = API.fill(UI.shownOut, { k: filled, n: n - 1 });
    shown.setAttribute("aria-valuetext", shownOut.textContent);
    drawFront(o, filled);
    drawBack(o);
    front.setAttribute("aria-label", API.fill(UI.frontLabel, { business: o.business.trim(), reward: o.reward.trim() || UI.rewardFallback, n }));
    back.setAttribute("aria-label", API.fill(UI.backLabel, { terms: API.terms(o, UI.terms).join(" ") }));
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(o).sort((x, y) => order[x.level] - order[y.level]).forEach((k) => {
      const li = el("li", "gp-check gp-" + k.level);
      const icn = el("span", "gp-ic", k.level === "ok" ? "✓" : k.level === "warn" ? "!" : "✕"); icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[k.level] + ": "), document.createTextNode(API.fill(UI.checks[k.id] || k.id, { n })));
      li.append(icn, tx); checkList.append(li);
    });
  }
  // Fills the preview stamps one by one, like a customer's first visits.
  let timer = 0;
  function stampTo(k) {
    clearInterval(timer);
    if (calm) { shown.value = String(k); render(); return; }
    shown.value = "0"; render();
    timer = setInterval(() => {
      const v = Number(shown.value) + 1;
      if (v > k) { clearInterval(timer); return; }
      shown.value = String(v); render();
    }, 220);
  }

  themes.addEventListener("change", (e) => { theme = UI.themes.find((t) => t.id === e.target.value) || theme; render(); });
  logoIn.addEventListener("change", () => {
    const f = logoIn.files && logoIn.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { logo = img; removeLogo.hidden = false; render(); };
    img.src = URL.createObjectURL(f);
  });
  removeLogo.addEventListener("click", () => { logo = null; logoIn.value = ""; removeLogo.hidden = true; render(); logoIn.focus(); });
  form.addEventListener("input", (e) => { if (e.target !== logoIn) render(); });
  form.addEventListener("change", (e) => { if (e.target !== logoIn && e.target.name !== "lc-theme") render(); });
  shown.addEventListener("input", () => { clearInterval(timer); render(); });
  // Downloads and printing always use an empty card.
  const blank = (fn) => { const k = shown.value; shown.value = "0"; render(); fn(); shown.value = k; render(); };
  dlF.addEventListener("click", () => blank(() => front.toBlob((b) => b && download(b, UI.fileFront), "image/png")));
  dlB.addEventListener("click", () => back.toBlob((b) => b && download(b, UI.fileBack), "image/png"));
  pr.addEventListener("click", () => {
    const s = DATA.sizes[size.value] || DATA.sizes.eu;
    const cols = Math.floor((210 - 20) / s.w), rows = Math.floor((297 - 20) / s.h);
    const gx = (210 - cols * s.w) / 2, gy = (297 - rows * s.h) / 2;
    let f = "";
    blank(() => { f = front.toDataURL("image/png"); });
    const b = back.toDataURL("image/png");
    // The back page mirrors the columns, so double-sided printing lines up.
    const page = (src, mirror) => {
      let h = '<div class="pg">';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const col = mirror ? cols - 1 - c : c;
        h += '<img alt="" src="' + src + '" style="left:' + (gx + col * s.w) + "mm;top:" + (gy + r * s.h) + "mm;width:" + s.w + "mm;height:" + s.h + 'mm">';
      }
      return h + "</div>";
    };
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write("<!doctype html><title>" + UI.printTitle + "</title><style>@page{size:A4;margin:0}body{margin:0}.pg{position:relative;width:210mm;height:297mm;page-break-after:always;overflow:hidden}.pg img{position:absolute;outline:0.1mm solid #bbb}</style>" + page(f, false) + page(b, true) + '<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},200)}<\/script>');
    w.document.close();
  });
  function reset() {
    for (const c of [business, reward, perVisit, phone, website]) c.value = "";
    stamps.value = "10"; icon.value = "star"; expiry.value = "12"; size.value = UI.defaultSize; qrMode.value = "website"; noCash.checked = true; shown.value = "0";
  }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    reset();
    business.value = e.business; reward.value = e.reward; perVisit.value = e.perVisit; phone.value = e.phone; website.value = e.website;
    stamps.value = String(e.stamps); icon.value = e.icon;
    const r = themes.querySelector('input[value="' + e.theme + '"]');
    if (r) { r.checked = true; theme = UI.themes.find((t) => t.id === e.theme) || theme; }
    business.focus();
    stampTo(e.shown);
  });
  clearBtn.addEventListener("click", () => { clearInterval(timer); reset(); render(); business.focus(); });
  reset();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})(typeof globalThis !== "undefined" ? globalThis : this);
