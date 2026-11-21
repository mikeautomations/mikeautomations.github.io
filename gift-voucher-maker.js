// /en/gift-voucher-maker/ and /he/gift-voucher/ client logic. Progressive enhancement: without JS the page explains
// the tool. The voucher is drawn on a canvas in the browser. No requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/voucher.ts with the types removed (made with the TypeScript
// compiler). tests/gift-voucher-maker.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="gv-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to voucher.ts) ----------
  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  /** Up to three Latin letters from the business name, for the start of the code; "GV" when there are none. */
  function prefixFrom(business) {
      const letters = (business || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().match(/\b[A-Z]/g) || [];
      let p = letters.join("").slice(0, 3);
      if (p.length < 2)
          p = ((business || "").toUpperCase().match(/[A-Z]/g) || []).join("").slice(0, 3);
      return p.length >= 2 ? p : "GV";
  }
  /** A code like BHS-7K3P-Q9WX. rand returns numbers in [0, 1), so tests can pass a fixed sequence. */
  function makeCode(prefix, rand) {
      const pick = () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length) % CODE_CHARS.length];
      const part = () => pick() + pick() + pick() + pick();
      return `${prefix}-${part()}-${part()}`;
  }
  function validDate(date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
      if (!m)
          return false;
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  /** The date some months later; the 31st becomes the last day of a shorter month. */
  function addMonths(date, months) {
      const [y, m, d] = date.split("-").map(Number);
      const total = y * 12 + (m - 1) + months;
      const ny = Math.floor(total / 12), nm = total % 12;
      const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
      return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  }
  /** Months from one date to another, counting a part month as a whole one only when the day is reached. */
  function monthsBetween(from, to) {
      const [y1, m1, d1] = from.split("-").map(Number);
      const [y2, m2, d2] = to.split("-").map(Number);
      return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  }
  /** 21/11/2027 (sep "/") or 21.11.2027 (sep "."). */
  function formatDate(date, sep) {
      const [y, m, d] = date.split("-");
      return [d, m, y].join(sep);
  }
  function money(amount, currency, pattern) {
      const n = Math.round(amount * 100) / 100;
      const s = n % 1 === 0 ? String(n) : n.toFixed(2);
      return pattern.replace("{c}", currency).replace("{n}", s);
  }
  /** Splits text into lines no wider than max, using measure for the width (canvas measureText in the page). */
  function wrapLines(text, max, measure, maxLines) {
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      const lines = [];
      let cur = "";
      for (const w of words) {
          const next = cur ? cur + " " + w : w;
          if (measure(next) <= max || !cur)
              cur = next;
          else {
              lines.push(cur);
              cur = w;
          }
      }
      if (cur)
          lines.push(cur);
      if (lines.length > maxLines) {
          const kept = lines.slice(0, maxLines);
          let last = kept[maxLines - 1];
          while (last.length > 1 && measure(last + "…") > max)
              last = last.slice(0, -1).trimEnd();
          kept[maxLines - 1] = last + "…";
          return kept;
      }
      return lines;
  }
  /** One tab-separated line for a spreadsheet of issued vouchers: issued, code, value, for, from, expires. */
  function recordLine(v, value, expiryText) {
      return [v.issued, v.code, value, v.to, v.from, expiryText].map((x) => String(x || "").replace(/[\t\r\n]+/g, " ").trim()).join("\t");
  }
  /** minMonths: the shortest expiry worth suggesting (12 in the UK, 60 in Israel). expiry "" means no expiry. */
  function checks(v, minMonths) {
      const c = [];
      c.push(v.business.trim() ? { level: "ok", id: "business_ok" } : { level: "bad", id: "business_missing" });
      const hasValue = v.kind === "amount" ? v.amount > 0 : !!v.service.trim();
      c.push(hasValue ? { level: "ok", id: "value_ok" } : { level: "bad", id: "value_missing" });
      if (!v.expiry)
          c.push({ level: "ok", id: "no_expiry" });
      else if (!validDate(v.expiry) || v.expiry <= v.issued)
          c.push({ level: "bad", id: "expiry_past" });
      else if (monthsBetween(v.issued, v.expiry) < minMonths)
          c.push({ level: "warn", id: "expiry_short" });
      else
          c.push({ level: "ok", id: "expiry_ok" });
      c.push({ level: "ok", id: "code_ok" });
      return c;
  }

  const API = { CODE_CHARS, prefixFrom, makeCode, validDate, addMonths, monthsBetween, formatDate, money, wrapLines, recordLine, checks };
  root.GiftVoucher = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("gv-app");
  const dataEl = document.getElementById("gv-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const RTL = !!DATA.rtl;
  const D = UI.draw;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  let uid = 0;
  function wrapField(label, control, cls) {
    const w = el("div", "ft-field gp-field" + (cls ? " " + cls : ""));
    const lab = el("label", null, label);
    control.id = control.id || "gv-f" + ++uid;
    lab.htmlFor = control.id;
    w.append(lab, control);
    return w;
  }
  const text = (f) => { const c = el("input"); c.type = "text"; c.dir = "auto"; if (f.placeholder) c.placeholder = f.placeholder; if (f.max) c.maxLength = f.max; return c; };
  const select = (options) => { const s = el("select"); options.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; s.append(o); }); return s; };
  const rand = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } };
  const localDate = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function flash(btn, label) { btn.dataset.done = "1"; btn.textContent = "✓ " + UI.copied; setTimeout(() => { btn.dataset.done = ""; btn.textContent = label; }, 1600); }

  // Form.
  const business = text(UI.business);
  const kind = select(UI.kind.options);
  const amount = el("input"); amount.type = "number"; amount.min = "0"; amount.step = "any"; amount.inputMode = "decimal"; amount.dir = "ltr"; amount.placeholder = UI.amount.placeholder;
  const currency = select(UI.currency.options);
  const service = text(UI.service);
  const to = text(UI.to);
  const from = text(UI.from);
  const message = text(UI.message);
  const expiry = select(UI.expiry.options);
  const code = el("input"); code.type = "text"; code.maxLength = 24; code.spellcheck = false; code.autocomplete = "off";
  const newCode = button("try-btn gp-ghost gv-btn", UI.newCode);
  let codeAuto = true;

  const amountRow = el("div", "gv-row");
  const curField = wrapField(UI.currency.label, currency);
  amountRow.append(wrapField(UI.amount.label, amount), curField);
  if (UI.currency.options.length < 2) { curField.hidden = true; amountRow.style.gridTemplateColumns = "minmax(0, 1fr)"; }
  const serviceField = wrapField(UI.service.label, service);
  const people = el("div", "gv-row");
  people.append(wrapField(UI.to.label, to), wrapField(UI.from.label, from));
  const codeRow = el("div", "gv-code");
  codeRow.append(wrapField(UI.codeLabel, code), newCode);

  const themes = el("fieldset", "gv-themes");
  themes.append(el("legend", null, UI.theme));
  let theme = UI.themes[0];
  UI.themes.forEach((t, i) => {
    const lab = el("label", "gv-sw");
    const r = el("input");
    r.type = "radio"; r.name = "gv-theme"; r.value = t.id; r.checked = i === 0;
    r.setAttribute("aria-label", t.label);
    const sw = el("span");
    sw.style.background = "linear-gradient(135deg, " + t.bg1 + " 0 55%, " + t.accent + " 55% 100%)";
    lab.title = t.label;
    lab.append(r, sw);
    themes.append(lab);
  });

  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const checkList = el("ul", "gp-checks");
  const checksH = el("h3", "gp-h", UI.checksTitle);
  checksH.style.marginTop = "0.9rem";
  const form = el("div", "ft-box gp-form");
  form.append(formTop, wrapField(UI.business.label, business), wrapField(UI.kind.label, kind), amountRow, serviceField, people,
    wrapField(UI.message.label, message), wrapField(UI.expiry.label, expiry), codeRow, themes, checksH, checkList);

  // Preview.
  const W = 1600, H = 800;
  const canvas = el("canvas");
  canvas.width = W; canvas.height = H;
  canvas.setAttribute("role", "img");
  const stage = el("div", "gv-stage");
  stage.append(canvas);
  const dl = button("try-btn try-btn-primary gv-btn", UI.download);
  const pr = button("try-btn gv-btn", UI.print);
  const rec = button("try-btn gp-ghost gv-btn", UI.record);
  const acts = el("div", "gv-acts");
  acts.append(dl, pr, rec);
  const prev = el("section", "gp-card");
  prev.append(el("h2", "gp-h", UI.previewTitle), stage, acts, el("p", "gp-hint", UI.recordHint));
  prev.lastChild.style.marginTop = "0.6rem";

  const side = el("div", "gp-side");
  side.append(prev);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  const ctx = canvas.getContext("2d");
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const X = (x) => (RTL ? W - x : x);

  function voucher() {
    const issued = localDate(new Date());
    const months = Number(expiry.value);
    return {
      business: business.value, kind: kind.value, amount: Number(amount.value) || 0, service: service.value, to: to.value, from: from.value,
      message: message.value, code: code.value.trim(), issued, expiry: months > 0 ? API.addMonths(issued, months) : "",
    };
  }
  const valueText = (v) => (v.kind === "amount" ? (v.amount > 0 ? API.money(v.amount, currency.value, D.money) : "") : v.service.trim());
  const expiryText = (v) => (v.expiry ? D.valid.replace("{date}", API.formatDate(v.expiry, D.dateSep)) : D.noExpiry);

  function draw(v) {
    const t = theme;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.direction = RTL ? "rtl" : "ltr";
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, t.bg1); g.addColorStop(1, t.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Soft circles and a dashed inner edge.
    ctx.globalAlpha = 0.1; ctx.fillStyle = t.accent;
    ctx.beginPath(); ctx.arc(X(1180), 820, 360, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(X(60), -40, 220, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = t.accent; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // Ribbon and bow, on the far side from the text.
    const rx = RTL ? 250 : W - 306;
    ctx.fillStyle = t.accent;
    ctx.fillRect(rx, 0, 56, H);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 18; ctx.strokeStyle = t.accent;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(rx + 28 + s * 62, 230, 70, 38, s * 0.45, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(rx + 20, 250); ctx.lineTo(rx - 40, 360); ctx.moveTo(rx + 36, 250); ctx.lineTo(rx + 96, 360); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(rx + 28, 232, 30, 0, Math.PI * 2); ctx.fill();

    const left = 110, maxW = 1060;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = t.soft;
    ctx.font = "600 38px " + FONT;
    ctx.fillText(v.business.trim() || " ", X(left), 128, maxW);
    ctx.fillStyle = t.ink;
    ctx.font = "800 100px " + FONT;
    ctx.fillText(D.title, X(left), 250, maxW);

    const val = valueText(v);
    ctx.fillStyle = t.accent;
    let y = 420;
    if (v.kind === "amount") { ctx.font = "800 150px " + FONT; ctx.fillText(val || " ", X(left), y, maxW); }
    else {
      ctx.font = "800 78px " + FONT;
      const lines = API.wrapLines(val, maxW, (s) => ctx.measureText(s).width, 2);
      y = lines.length > 1 ? 370 : 410;
      lines.forEach((l, i) => ctx.fillText(l, X(left), y + i * 88, maxW));
      if (lines.length > 1) y += 88;
    }
    y += 90;
    const who = [v.to.trim() ? D.to + " " + v.to.trim() : "", v.from.trim() ? D.from + " " + v.from.trim() : ""].filter(Boolean).join("   ·   ");
    if (who) { ctx.fillStyle = t.ink; ctx.font = "600 40px " + FONT; ctx.fillText(who, X(left), y, maxW); y += 60; }
    if (v.message.trim()) {
      ctx.fillStyle = t.soft; ctx.font = "italic 400 38px " + FONT;
      API.wrapLines(v.message, maxW, (s) => ctx.measureText(s).width, 2).forEach((l, i) => ctx.fillText(l, X(left), y + i * 46, maxW));
    }
    // Bottom row: code and expiry.
    ctx.fillStyle = t.ink;
    ctx.font = "700 42px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(D.code + "  " + (v.code || "—"), X(left), 716, 640);
    ctx.textAlign = "end";
    ctx.fillStyle = t.soft;
    ctx.font = "600 38px " + FONT;
    ctx.fillText(expiryText(v), X(left + maxW), 716, 400);
    ctx.restore();
  }

  function render() {
    if (codeAuto) {
      const p = API.prefixFrom(business.value);
      code.value = code.value ? code.value.replace(/^[A-Z]{2,3}-/, p + "-") : API.makeCode(p, rand);
    }
    amountRow.hidden = kind.value !== "amount";
    serviceField.hidden = kind.value === "amount";
    const v = voucher();
    draw(v);
    canvas.setAttribute("aria-label", UI.canvasLabel.replace("{summary}", [v.business, D.title, valueText(v), v.to, v.from, v.message, v.code, expiryText(v)].filter((x) => String(x).trim()).join(", ")));
    checkList.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checks(v, UI.minMonths).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const icn = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      icn.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(icn, tx);
      checkList.append(li);
    });
  }

  themes.addEventListener("change", (e) => { const id = e.target && e.target.value; theme = UI.themes.find((t) => t.id === id) || theme; render(); });
  code.addEventListener("input", () => { codeAuto = false; });
  newCode.addEventListener("click", () => { codeAuto = true; code.value = ""; render(); });
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  const fileName = () => D.fileName.replace("{code}", (code.value || "voucher").replace(/[^A-Za-z0-9-]/g, ""));
  dl.addEventListener("click", () => {
    canvas.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = el("a"); a.href = url; a.download = fileName(); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  });
  pr.addEventListener("click", () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const img = canvas.toDataURL("image/png");
    w.document.write('<!doctype html><title>' + D.title + '</title><style>@page{size:A4 landscape;margin:12mm}body{margin:0;display:grid;place-items:center;min-height:100vh}img{width:190mm;max-width:100%;height:auto}</style><img alt="" src="' + img + '" onload="setTimeout(function(){window.focus();window.print()},150)">');
    w.document.close();
  });
  rec.addEventListener("click", () => {
    const v = voucher();
    const line = API.recordLine(v, valueText(v), v.expiry ? API.formatDate(v.expiry, D.dateSep) : D.noExpiry);
    const done = () => flash(rec, UI.record);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(line).then(done, () => {});
  });
  function reset() {
    business.value = ""; kind.value = "amount"; amount.value = ""; currency.value = UI.defaultCurrency; service.value = ""; to.value = ""; from.value = ""; message.value = "";
    expiry.value = UI.defaultExpiry; codeAuto = true; code.value = "";
  }
  tryBtn.addEventListener("click", () => {
    const e = DATA.example;
    reset();
    business.value = e.business; kind.value = e.kind; amount.value = e.amount; service.value = e.service; to.value = e.to; from.value = e.from; message.value = e.message;
    const r = themes.querySelector('input[value="' + e.theme + '"]');
    if (r) { r.checked = true; theme = UI.themes.find((t) => t.id === e.theme) || theme; }
    render(); business.focus();
  });
  clearBtn.addEventListener("click", () => { reset(); render(); business.focus(); });
  reset();
  render();
  // Draw again once web fonts settle, so the first preview uses the final font.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})(typeof globalThis !== "undefined" ? globalThis : this);
