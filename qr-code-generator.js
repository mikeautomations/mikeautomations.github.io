// /en/qr-code-generator/ and /he/qr-code-generator/ client logic. Progressive enhancement: without JS the page
// shows an example code. No dependencies, no requests to us, no storage. Files are made in the browser.
// PART 1 is a copy of src/app/landing/data/tools/qr-code.ts with the types removed (made with the TypeScript
// compiler). tests/qr-code-generator.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="qr-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to qr-code.ts) ----------
  // Error correction codewords per block, and number of blocks, for each level and version (index 0 unused).
  const ECC_PER_BLOCK = {
      L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
      Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  };
  const BLOCKS = {
      L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
      M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
      Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
      H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  };
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  function rawModules(ver) {
      let r = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
          const n = Math.floor(ver / 7) + 2;
          r -= (25 * n - 10) * n - 55;
          if (ver >= 7)
              r -= 36;
      }
      return r;
  }
  /** How many data bytes fit in a version at a level. */
  function dataCapacity(ver, ecl) {
      return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * BLOCKS[ecl][ver];
  }
  function utf8(text) {
      const out = [];
      const s = unescape(encodeURIComponent(text));
      for (let i = 0; i < s.length; i++)
          out.push(s.charCodeAt(i));
      return out;
  }
  /** The smallest version that holds the bytes, or 0 when even version 40 is too small. */
  function pickVersion(len, ecl) {
      for (let v = 1; v <= 40; v++)
          if (len * 8 + 4 + (v < 10 ? 8 : 16) <= dataCapacity(v, ecl) * 8)
              return v;
      return 0;
  }
  function gfMul(x, y) {
      let z = 0;
      for (let i = 7; i >= 0; i--) {
          z = (z << 1) ^ ((z >>> 7) * 0x11d);
          z ^= ((y >>> i) & 1) * x;
      }
      return z & 0xff;
  }
  function rsRemainder(data, degree) {
      const div = [];
      for (let i = 0; i < degree - 1; i++)
          div.push(0);
      div.push(1);
      let root = 1;
      for (let i = 0; i < degree; i++) {
          for (let j = 0; j < div.length; j++) {
              div[j] = gfMul(div[j], root);
              if (j + 1 < div.length)
                  div[j] ^= div[j + 1];
          }
          root = gfMul(root, 0x02);
      }
      const res = div.map(() => 0);
      for (const b of data) {
          const f = b ^ res.shift();
          res.push(0);
          div.forEach((c, i) => { res[i] ^= gfMul(c, f); });
      }
      return res;
  }
  function codewords(bytes, ver, ecl) {
      const bits = [];
      const put = (val, len) => { for (let i = len - 1; i >= 0; i--)
          bits.push((val >>> i) & 1); };
      put(4, 4);
      put(bytes.length, ver < 10 ? 8 : 16);
      bytes.forEach((b) => put(b, 8));
      const cap = dataCapacity(ver, ecl) * 8;
      put(0, Math.min(4, cap - bits.length));
      put(0, (8 - (bits.length % 8)) % 8);
      for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11)
          put(pad, 8);
      const data = [];
      for (let i = 0; i < bits.length; i += 8)
          data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
      const nBlocks = BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
      const raw = Math.floor(rawModules(ver) / 8);
      const nShort = nBlocks - (raw % nBlocks), shortLen = Math.floor(raw / nBlocks);
      const blocks = [];
      for (let i = 0, k = 0; i < nBlocks; i++) {
          const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
          k += dat.length;
          const ecc = rsRemainder(dat, eccLen);
          if (i < nShort)
              dat.push(0);
          blocks.push(dat.concat(ecc));
      }
      const out = [];
      for (let i = 0; i < blocks[0].length; i++) {
          blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort)
              out.push(b[i]); });
      }
      return out;
  }
  function alignPositions(ver) {
      if (ver === 1)
          return [];
      const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
      const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      const res = [6];
      for (let pos = size - 7; res.length < n; pos -= step)
          res.splice(1, 0, pos);
      return res;
  }
  const MASKS = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  /** Penalty score from the standard (lower is easier to scan): runs, 2x2 blocks, finder-like patterns and dark balance. */
  function penalty(m) {
      const n = m.length;
      let p = 0;
      const lines = [];
      for (let i = 0; i < n; i++) {
          lines.push(m[i]);
          lines.push(m.map((r) => r[i]));
      }
      const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], B = A.slice().reverse();
      for (const l of lines) {
          let run = 1;
          for (let i = 1; i <= n; i++) {
              if (i < n && l[i] === l[i - 1])
                  run++;
              else {
                  if (run >= 5)
                      p += run - 2;
                  run = 1;
              }
          }
          for (let i = 0; i + 11 <= n; i++) {
              let a = true, b = true;
              for (let k = 0; k < 11; k++) {
                  const v = l[i + k] ? 1 : 0;
                  if (v !== A[k])
                      a = false;
                  if (v !== B[k])
                      b = false;
              }
              if (a)
                  p += 40;
              if (b)
                  p += 40;
          }
      }
      let dark = 0;
      for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
              if (m[y][x])
                  dark++;
              if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1])
                  p += 3;
          }
      return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  }
  /** The QR matrix (true = dark) for some text. ver 0 and mask -1 mean "choose". Null when the text is too long. */
  function makeQr(text, ecl = "M", ver = 0, mask = -1) {
      const bytes = utf8(text);
      const v = ver || pickVersion(bytes.length, ecl);
      if (!v || bytes.length * 8 + 4 + (v < 10 ? 8 : 16) > dataCapacity(v, ecl) * 8)
          return null;
      const size = v * 4 + 17;
      const mod = [], fn = [];
      for (let i = 0; i < size; i++) {
          mod.push(new Array(size).fill(false));
          fn.push(new Array(size).fill(false));
      }
      const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
      for (let i = 0; i < size; i++) {
          set(6, i, i % 2 === 0);
          set(i, 6, i % 2 === 0);
      }
      for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
          for (let dy = -4; dy <= 4; dy++)
              for (let dx = -4; dx <= 4; dx++) {
                  const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
                  if (x >= 0 && x < size && y >= 0 && y < size)
                      set(x, y, d !== 2 && d !== 4);
              }
      }
      const al = alignPositions(v), last = al.length - 1;
      al.forEach((ax, i) => al.forEach((ay, j) => {
          if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))
              return;
          for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++)
                  set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
      const drawFormat = (mk) => {
          const data = (ECL_BITS[ecl] << 3) | mk;
          let rem = data;
          for (let i = 0; i < 10; i++)
              rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
          const bits = ((data << 10) | rem) ^ 0x5412;
          const bit = (i) => ((bits >>> i) & 1) !== 0;
          for (let i = 0; i <= 5; i++)
              set(8, i, bit(i));
          set(8, 7, bit(6));
          set(8, 8, bit(7));
          set(7, 8, bit(8));
          for (let i = 9; i < 15; i++)
              set(14 - i, 8, bit(i));
          for (let i = 0; i < 8; i++)
              set(size - 1 - i, 8, bit(i));
          for (let i = 8; i < 15; i++)
              set(8, size - 15 + i, bit(i));
          set(8, size - 8, true);
      };
      drawFormat(0);
      if (v >= 7) {
          let rem = v;
          for (let i = 0; i < 12; i++)
              rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
          const bits = (v << 12) | rem;
          for (let i = 0; i < 18; i++) {
              const b = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3);
              set(a, c, b);
              set(c, a, b);
          }
      }
      const cw = codewords(bytes, v, ecl);
      let i = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
          if (right === 6)
              right = 5;
          for (let vert = 0; vert < size; vert++)
              for (let j = 0; j < 2; j++) {
                  const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
                  if (!fn[y][x] && i < cw.length * 8) {
                      mod[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
                      i++;
                  }
              }
      }
      const apply = (mk) => {
          for (let y = 0; y < size; y++)
              for (let x = 0; x < size; x++)
                  if (!fn[y][x] && MASKS[mk](x, y))
                      mod[y][x] = !mod[y][x];
      };
      let best = mask;
      if (best < 0) {
          let low = Infinity;
          for (let k = 0; k < 8; k++) {
              apply(k);
              drawFormat(k);
              const p = penalty(mod);
              if (p < low) {
                  low = p;
                  best = k;
              }
              apply(k);
          }
      }
      apply(best);
      drawFormat(best);
      return { size, version: v, mask: best, modules: mod };
  }
  /** An SVG of the code: one path for all dark modules, with a quiet zone of `margin` modules. */
  function qrSvg(q, fg = "#000000", bg = "#ffffff", margin = 4) {
      const n = q.size + margin * 2;
      let d = "";
      q.modules.forEach((row, y) => {
          let x = 0;
          while (x < q.size) {
              if (!row[x]) {
                  x++;
                  continue;
              }
              let w = 1;
              while (x + w < q.size && row[x + w])
                  w++;
              d += `M${x + margin} ${y + margin}h${w}v1h-${w}z`;
              x += w;
          }
      });
      const safe = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#000000");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${safe(bg)}"/><path fill="${safe(fg)}" d="${d}"/></svg>`;
  }
  // ---------- What goes inside the code ----------
  const clean = (s) => String(s == null ? "" : s).trim();
  /** Digits for wa.me and tel:, turning a local 0... number into international with the given country code. */
  function intlNumber(input, cc) {
      let d = clean(input).replace(/[^\d+]/g, "");
      if (d.startsWith("+"))
          return d.slice(1).replace(/\D/g, "");
      d = d.replace(/\D/g, "");
      if (d.startsWith("00"))
          return d.slice(2);
      if (d.startsWith("0") && cc)
          return cc + d.slice(1);
      if (cc === "1" && d.length === 10)
          return "1" + d;
      return d;
  }
  const wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");
  const vEsc = (s) => clean(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const tag = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "-").replace(/^-+|-+$/g, "");
  /** The text to encode for each kind of code. Empty when a required field is missing. */
  function payload(p) {
      const cc = clean(p.cc);
      switch (p.kind || "url") {
          case "url": {
              let u = clean(p.url);
              if (!u)
                  return "";
              if (!/^[a-z][a-z0-9+.-]*:/i.test(u))
                  u = "https://" + u;
              if (!p.track || !/^https?:\/\//i.test(u))
                  return u;
              const hash = u.indexOf("#");
              const base = hash < 0 ? u : u.slice(0, hash), frag = hash < 0 ? "" : u.slice(hash);
              const kept = base.replace(/([?&])utm_[a-z]+=[^&]*/gi, "$1").replace(/[?&]+$/, "").replace(/\?&+/, "?").replace(/&&+/g, "&");
              const q = "utm_source=" + encodeURIComponent(tag(p.place || "") || "print") + "&utm_medium=qr&utm_campaign=" + encodeURIComponent(tag(p.campaign || "") || "qr-code");
              return kept + (kept.includes("?") ? "&" : "?") + q + frag;
          }
          case "whatsapp": {
              const n = intlNumber(p.phone || "", cc);
              if (n.length < 7)
                  return "";
              return "https://wa.me/" + n + (clean(p.message) ? "?text=" + encodeURIComponent(clean(p.message)) : "");
          }
          case "phone": {
              const n = intlNumber(p.phone || "", cc);
              return n.length < 7 ? "" : "tel:+" + n;
          }
          case "sms": {
              const n = intlNumber(p.phone || "", cc);
              return n.length < 7 ? "" : "SMSTO:+" + n + ":" + clean(p.message);
          }
          case "email": {
              const e = clean(p.email);
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
                  return "";
              const q = [clean(p.subject) && "subject=" + encodeURIComponent(clean(p.subject)), clean(p.message) && "body=" + encodeURIComponent(clean(p.message))].filter(Boolean);
              return "mailto:" + e + (q.length ? "?" + q.join("&") : "");
          }
          case "wifi": {
              if (!clean(p.ssid))
                  return "";
              const t = p.security === "nopass" ? "nopass" : p.security === "WEP" ? "WEP" : "WPA";
              return "WIFI:T:" + t + ";S:" + wifiEsc(String(p.ssid)) + ";" + (t !== "nopass" ? "P:" + wifiEsc(String(p.password || "")) + ";" : "") + ";";
          }
          case "contact": {
              if (!clean(p.first) && !clean(p.last) && !clean(p.org))
                  return "";
              const n = intlNumber(p.phone || "", cc);
              const lines = ["BEGIN:VCARD", "VERSION:3.0", "N:" + vEsc(p.last || "") + ";" + vEsc(p.first || "") + ";;;", "FN:" + vEsc([clean(p.first), clean(p.last)].filter(Boolean).join(" ") || clean(p.org))];
              if (clean(p.org))
                  lines.push("ORG:" + vEsc(p.org || ""));
              if (clean(p.title))
                  lines.push("TITLE:" + vEsc(p.title || ""));
              if (n.length >= 7)
                  lines.push("TEL;TYPE=CELL:+" + n);
              if (clean(p.email))
                  lines.push("EMAIL:" + vEsc(p.email || ""));
              if (clean(p.site))
                  lines.push("URL:" + vEsc(/^https?:\/\//i.test(clean(p.site)) ? clean(p.site) : "https://" + clean(p.site)));
              lines.push("END:VCARD");
              return lines.join("\n");
          }
          default:
              return clean(p.text);
      }
  }
  /** Relative luminance contrast between two #rrggbb colours (1 to 21). */
  function contrast(a, b) {
      const lum = (h) => {
          const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b))
          return 21;
      const x = lum(a), y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /** What to check before printing. */
  function checkQr(text, version, fg, bg) {
      const c = [];
      if (!text)
          return [{ id: "empty", level: "bad" }];
      if (!version)
          return [{ id: "too_long", level: "bad" }];
      c.push(version <= 6 ? { id: "simple", level: "ok" } : version <= 12 ? { id: "dense", level: "warn" } : { id: "very_dense", level: "warn" });
      const k = contrast(fg, bg);
      if (k < 3)
          c.push({ id: "contrast_bad", level: "bad" });
      else if (k < 7)
          c.push({ id: "contrast_low", level: "warn" });
      else
          c.push({ id: "contrast_ok", level: "ok" });
      // A light code on a dark background fails in many phone camera apps.
      const lighter = (h) => (/^#[0-9a-f]{6}$/i.test(h) ? contrast(h, "#000000") : 0);
      if (lighter(fg) > lighter(bg))
          c.push({ id: "inverted", level: "bad" });
      return c;
  }

  const API = { dataCapacity, utf8, pickVersion, penalty, makeQr, qrSvg, intlNumber, payload, contrast, checkQr };
  root.QrCode = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("qr-app");
  const dataEl = document.getElementById("qr-data");
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
  const inputs = {};
  const wraps = {};
  function field(key, opts) {
    const f = UI.fields[key];
    const id = "qr-f" + ++uid;
    const wrap = el("div", "ft-field gp-field");
    const lab = el("label", null, f.label);
    lab.htmlFor = id;
    wrap.append(lab);
    let c;
    if (opts) {
      c = el("select");
      opts.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; c.append(o); });
    } else if (f.area) {
      c = el("textarea");
      c.rows = 3;
    } else {
      c = el("input");
      c.type = f.type || "text";
    }
    c.id = id;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.max) c.maxLength = f.max;
    if (!opts) c.dir = f.ltr ? "ltr" : "auto";
    if (f.hint) { const h = el("span", "ft-hint gp-hint", f.hint); h.id = id + "-h"; c.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(c);
    inputs[key] = c;
    wraps[key] = wrap;
    return wrap;
  }
  const row = (...kids) => { const r = el("div", "qr-row"); r.append(...kids); return r; };
  let stepNo = 1;
  function step(title, ...kids) {
    const fs = el("fieldset", "qr-step");
    const lg = el("legend");
    lg.append(el("span", "qr-num", String(++stepNo)), document.createTextNode(title));
    fs.append(lg, ...kids);
    return fs;
  }

  // Step 1: what the code opens.
  let kind = "url";
  const kinds = el("div", "qr-kinds");
  kinds.setAttribute("role", "group");
  kinds.setAttribute("aria-label", UI.stepWhat);
  const kindBtns = {};
  UI.kinds.forEach(([k, label, ic]) => {
    const b = button("qr-kind");
    const i = el("span", "qr-kind-ic", ic);
    i.setAttribute("aria-hidden", "true");
    b.append(i, el("span", null, label));
    b.addEventListener("click", () => { setKind(k); const first = fieldsBox.querySelector("input, textarea"); if (first) first.focus(); });
    kindBtns[k] = b;
    kinds.append(b);
  });

  // Step 2: the details. Every field exists once and keeps its value when switching kinds.
  field("url"); field("place", UI.places); field("campaign"); field("cc", UI.countries); field("phone"); field("message");
  field("email"); field("subject"); field("ssid"); field("password"); field("security", UI.securities);
  field("first"); field("last"); field("org"); field("title"); field("site"); field("text");
  inputs.cc.value = DATA.cc;
  inputs.campaign.value = "qr-code";
  const track = el("input");
  track.type = "checkbox";
  track.checked = true;
  const trackLab = el("label", "qr-toggle");
  const tt = el("span");
  tt.append(el("b", null, UI.fields.track.label), el("span", null, UI.fields.track.hint));
  trackLab.append(track, tt);
  const trackBox = el("div", "qr-track qr-row");
  trackBox.append(wraps.place, wraps.campaign);
  const LAYOUT = {
    url: () => [wraps.url, trackLab, trackBox],
    whatsapp: () => [row(wraps.cc, wraps.phone), wraps.message],
    phone: () => [row(wraps.cc, wraps.phone)],
    sms: () => [row(wraps.cc, wraps.phone), wraps.message],
    email: () => [wraps.email, wraps.subject, wraps.message],
    wifi: () => [wraps.ssid, row(wraps.security, wraps.password)],
    contact: () => [row(wraps.first, wraps.last), wraps.org, wraps.title, row(wraps.cc, wraps.phone), wraps.email, wraps.site],
    text: () => [wraps.text],
  };
  const fieldsBox = el("div", "qr-fields");

  // Step 3: the look.
  let fg = UI.presets[0][0], bg = UI.presets[0][1];
  const swatches = el("div", "qr-swatches");
  const swBtns = UI.presets.map(([f, b]) => {
    const s = button("qr-swatch");
    s.style.background = b;
    s.setAttribute("aria-label", f + " / " + b);
    const i = el("i");
    i.style.background = f;
    s.append(i);
    s.addEventListener("click", () => { fg = f; bg = b; fgIn.value = f; bgIn.value = b; render(); });
    swatches.append(s);
    return [s, f, b];
  });
  const picker = (label, val) => {
    const l = el("label", "qr-picker");
    const i = el("input");
    i.type = "color";
    i.value = val;
    l.append(i, document.createTextNode(label));
    return [l, i];
  };
  const [fgLab, fgIn] = picker(UI.colourCode, fg);
  const [bgLab, bgIn] = picker(UI.colourBack, bg);
  fgIn.addEventListener("input", () => { fg = fgIn.value; render(); });
  bgIn.addEventListener("input", () => { bg = bgIn.value; render(); });
  const pickers = el("div", "qr-pickers");
  pickers.append(fgLab, bgLab);
  const colours = el("div", "ft-field");
  colours.append(el("span", null, UI.colours), swatches, pickers);
  colours.firstChild.style.fontWeight = "600";
  const capWrap = field("caption");
  const ideas = el("div", "qr-ideas");
  UI.captionIdeas.forEach((t) => {
    const b = button("qr-idea", t);
    b.addEventListener("click", () => { inputs.caption.value = t; render(); });
    ideas.append(b);
  });
  capWrap.append(ideas);
  const strong = el("input");
  strong.type = "checkbox";
  const strongLab = el("label", "qr-toggle");
  const st = el("span");
  st.append(el("b", null, UI.strong), el("span", null, UI.strongHint));
  strongLab.append(strong, st);

  const tryBtn = button("try-btn", UI.example);
  const clearBtn = button("try-btn gp-ghost", UI.clear);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn, clearBtn);
  const h1 = el("h2", "gp-h qr-h");
  h1.append(el("span", "qr-num", "1"), document.createTextNode(UI.stepWhat));
  formTop.append(h1, btns);
  const form = el("div", "ft-box gp-form");
  const s1 = el("div");
  s1.append(kinds);
  form.append(formTop, s1, step(UI.stepDetails, fieldsBox), step(UI.stepStyle, capWrap, colours, strongLab));

  // Preview.
  const card = el("div", "qr-card");
  const svgBox = el("div", "qr-svg");
  svgBox.setAttribute("role", "img");
  const cap = el("p", "qr-caption");
  cap.dir = "auto";
  card.append(svgBox, cap);
  const stage = el("div", "qr-stage");
  stage.append(card);
  const badges = el("ul", "qr-badges");
  UI.badges.forEach((b) => badges.append(el("li", null, b)));
  const pngBtn = button("try-btn try-btn-primary", UI.png);
  const svgBtn = button("try-btn", UI.svg);
  const printBtn = button("try-btn gp-ghost", UI.print);
  const actions = el("div", "qr-actions");
  actions.append(pngBtn, svgBtn, printBtn);
  const meta = el("p", "qr-meta");
  const inside = el("details", "qr-inside");
  const pre = el("pre");
  inside.append(el("summary", null, UI.inside), pre);
  const prevCard = el("section", "gp-card");
  prevCard.setAttribute("aria-label", UI.previewTitle);
  prevCard.append(el("h2", "gp-h", UI.previewTitle), stage, badges, actions, el("p", "gp-hint qr-tip", UI.pngHint), meta, inside);

  const checks = el("ul", "gp-checks");
  checks.style.marginTop = "0.9rem";
  const checksCard = el("section", "gp-card");
  checksCard.append(el("h2", "gp-h", UI.checksTitle), checks, el("p", "qr-tip", UI.sizeTip));

  const side = el("div", "gp-side");
  side.append(prevCard, checksCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  function setKind(k) {
    kind = k;
    UI.kinds.forEach(([x]) => kindBtns[x].setAttribute("aria-pressed", x === k ? "true" : "false"));
    fieldsBox.textContent = "";
    fieldsBox.append(...LAYOUT[k]());
    render();
  }

  let current = null;
  const values = () => {
    const v = { kind, track: track.checked };
    for (const k in inputs) v[k] = inputs[k].value;
    return v;
  };
  function render() {
    trackBox.hidden = !track.checked;
    swBtns.forEach(([s, f, b]) => s.setAttribute("aria-pressed", f === fg && b === bg ? "true" : "false"));
    const text = API.payload(values());
    const q = text ? API.makeQr(text, strong.checked ? "Q" : "M") : null;
    current = q && { q, text };
    card.style.background = bg;
    cap.style.color = fg;
    cap.textContent = inputs.caption.value.trim();
    svgBox.textContent = "";
    if (q) svgBox.innerHTML = API.qrSvg(q, fg, bg, 0);
    else svgBox.append(el("div", "qr-placeholder", text ? UI.tooLong : UI.empty));
    svgBox.setAttribute("aria-label", UI.previewTitle + (cap.textContent ? ": " + cap.textContent : ""));
    [pngBtn, svgBtn, printBtn].forEach((b) => { b.disabled = !q; });
    meta.textContent = q ? UI.meta.replace("{v}", String(q.version)).split("{n}").join(String(q.size)) : "";
    pre.textContent = text;
    inside.hidden = !text;
    checks.textContent = "";
    const order = { bad: 0, warn: 1, ok: 2 };
    API.checkQr(text, q ? q.version : 0, fg, bg).sort((x, y) => order[x.level] - order[y.level]).forEach((c) => {
      const li = el("li", "gp-check gp-" + c.level);
      const ic = el("span", "gp-ic", c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕");
      ic.setAttribute("aria-hidden", "true");
      const tx = el("span", "gp-check-text");
      tx.append(el("span", "gp-sr", UI.level[c.level] + ": "), document.createTextNode(UI.checks[c.id] || c.id));
      li.append(ic, tx);
      checks.append(li);
    });
  }

  // Files: the code with its caption, on its background, with the standard 4-module quiet zone.
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function fullSvg() {
    const { q } = current;
    const n = q.size + 8, caption = inputs.caption.value.trim();
    const capH = caption ? Math.round(n * 0.16) : 0;
    const inner = API.qrSvg(q, fg, bg, 4).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<rect[^>]*\/>/, "");
    const txt = caption ? `<text x="${n / 2}" y="${n + capH * 0.42}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${(n * 0.075).toFixed(2)}" fill="${fg}"${RTL ? ' direction="rtl"' : ""}>${esc(caption)}</text>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n + capH}" width="${n * 10}" height="${(n + capH) * 10}" shape-rendering="crispEdges"><rect width="${n}" height="${n + capH}" fill="${bg}"/>${inner}${txt}</svg>`;
  }
  function save(blob, name) {
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const fileName = (ext) => {
    const base = (inputs.caption.value.trim() || DATA.file).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || DATA.file;
    return base.slice(0, 40) + "." + ext;
  };
  svgBtn.addEventListener("click", () => { if (current) save(new Blob([fullSvg()], { type: "image/svg+xml" }), fileName("svg")); });
  pngBtn.addEventListener("click", () => {
    if (!current) return;
    const { q } = current;
    const n = q.size + 8, px = Math.max(8, Math.floor(1200 / n)), caption = inputs.caption.value.trim();
    const capH = caption ? Math.round(n * px * 0.16) : 0;
    const cv = document.createElement("canvas");
    cv.width = n * px;
    cv.height = n * px + capH;
    const g = cv.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = fg;
    q.modules.forEach((r, y) => r.forEach((d, x) => { if (d) g.fillRect((x + 4) * px, (y + 4) * px, px, px); }));
    if (caption) {
      g.font = "700 " + Math.round(n * px * 0.075) + "px " + getComputedStyle(cap).fontFamily;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.direction = RTL ? "rtl" : "ltr";
      g.fillText(caption, cv.width / 2, n * px + capH * 0.42, cv.width - 8 * px);
    }
    cv.toBlob((b) => { if (b) save(b, fileName("png")); }, "image/png");
  });
  printBtn.addEventListener("click", () => {
    if (!current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="${RTL ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>QR</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh}svg{width:7cm;height:auto}</style></head><body>${fullSvg()}<script>onload=function(){print()}<\/script></body></html>`);
    w.document.close();
  });

  function setAll(x) {
    for (const k in inputs) inputs[k].value = x[k] != null ? x[k] : "";
    inputs.cc.value = x.cc || DATA.cc;
    inputs.place.value = x.place || UI.places[0][0];
    inputs.security.value = x.security || "WPA";
    if (!x.campaign) inputs.campaign.value = "qr-code";
    track.checked = x.track !== false;
    setKind(x.kind || "url");
  }
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  const focusFirst = () => { const f = fieldsBox.querySelector("input:not([type=checkbox]), textarea"); if (f) f.focus(); };
  tryBtn.addEventListener("click", () => { setAll(DATA.example); focusFirst(); });
  clearBtn.addEventListener("click", () => { setAll({}); focusFirst(); });
  setAll({});
})(typeof globalThis !== "undefined" ? globalThis : this);
