// /he/google-review-link/ client logic (Hebrew, RTL). Progressive enhancement: the page explains how to find the Place ID
// without JS. No network requests, no cookies, no storage: nothing typed here leaves the device. The QR matrix comes
// from public/qr-encoder.js (loaded first, shared with the English tool); this file draws it on a canvas and offers it
// as a PNG download. Messages, reasons and texts arrive as JSON in <script id="rev-data">.
// PART 1: extractPlaceId and reviewUrl are line-for-line copies of src/app/landing/data/tools/review-link.ts (types
// removed); fillMessageHe is a copy of the one in src/app/landing/he-tools/google-review-link-page.tsx.
// tests/he-tools-b.test.ts loads this file in a sandbox and checks both copies agree.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic ----------
  const ID_RE = /^[A-Za-z0-9_-]{20,}$/;

  function extractPlaceId(input) {
    const raw = String(input == null ? "" : input).trim().replace(/^["'<]+|["'>]+$/g, "");
    if (!raw) return { ok: false, reason: "empty" };
    if (ID_RE.test(raw)) return { ok: true, placeId: raw, from: "id" };

    if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\b/i.test(raw)) return { ok: false, reason: "short-link" };
    if (/^(https?:\/\/)?(g\.page|g\.co)\//i.test(raw)) return { ok: false, reason: "review-link" };

    let text = raw;
    try { text = decodeURIComponent(raw); } catch (e) { /* keep the raw text */ }
    const m = /(?:[?&#]|\b)(?:query_)?place_?id(?:=|:)([A-Za-z0-9_-]{20,})/i.exec(text);
    if (m) return { ok: true, placeId: m[1], from: "link" };

    if (/!1s0x[0-9a-f]+:0x[0-9a-f]+/i.test(text) || /\b0x[0-9a-f]{8,}:0x[0-9a-f]{8,}\b/i.test(text)) return { ok: false, reason: "feature-id" };
    return { ok: false, reason: "not-found" };
  }

  function reviewUrl(placeId) {
    return "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(placeId);
  }

  function fillMessageHe(text, vals) {
    const name = String(vals.name == null ? "" : vals.name).trim();
    const business = String(vals.business == null ? "" : vals.business).trim() || "[שם העסק]";
    const link = String(vals.link == null ? "" : vals.link).trim() || "[קישור הביקורת]";
    return text
      .replace(/\{name\}/g, name)
      .replace(/\{business\}/g, business)
      .replace(/\{link\}/g, link)
      .replace(/(היי|שלום) ([,.])/g, "$1$2")
      .replace(/[ \t]{2,}/g, " ");
  }

  root.ReviewLinkHe = { extractPlaceId, reviewUrl, fillMessageHe };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("rev-app");
  const dataEl = document.getElementById("rev-data");
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
  const button = (text, primary) => {
    const b = el("button", "try-btn" + (primary ? " try-btn-primary" : ""), text);
    b.type = "button";
    return b;
  };
  let uid = 0;
  function field(label, input, hint) {
    const id = "rev-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    input.id = id;
    wrap.append(lab, input);
    if (hint) {
      const h = el("p", "ft-hint", hint);
      h.id = id + "-hint";
      input.setAttribute("aria-describedby", h.id);
      wrap.append(h);
    }
    return { wrap, input };
  }
  const textInput = (extra) => {
    const i = el("input");
    i.type = "text";
    if (extra) Object.assign(i, extra);
    return i;
  };

  async function copy(text, statusEl, done) {
    statusEl.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
      statusEl.textContent = done;
    } catch (e) {
      const ta = el("textarea");
      ta.value = text;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      statusEl.textContent = ok ? done : T.copyFail;
    }
  }

  app.textContent = "";

  // Step 1: the Place ID
  const boxIn = el("section", "ft-box");
  boxIn.setAttribute("aria-labelledby", "rev-h-in");
  const hIn = el("h2", "lx-h3", T.inTitle);
  hIn.id = "rev-h-in";
  const fPlace = field(T.placeLabel, textInput({ autocomplete: "off", spellcheck: false, dir: "ltr" }), T.placeHint);
  const err = el("p", "ft-error");
  err.setAttribute("aria-live", "polite");
  const finderRow = el("p", "ft-hint");
  const finderLink = el("a", null, T.finderLink);
  finderLink.href = DATA.finder;
  finderLink.rel = "noopener";
  finderLink.target = "_blank";
  finderRow.append(finderLink, document.createTextNode(T.finderNote));
  boxIn.append(hIn, fPlace.wrap, err, finderRow);

  // Step 2: link and QR
  const boxOut = el("section", "ft-box");
  boxOut.setAttribute("aria-labelledby", "rev-h-out");
  boxOut.hidden = true;
  const hOut = el("h2", "lx-h3", T.outTitle);
  hOut.id = "rev-h-out";
  const linkLabel = el("p", "ft-hint", T.linkLabel);
  const linkOut = el("p", "ft-link-box");
  linkOut.id = "rev-link";
  linkOut.dir = "ltr";
  const linkRow = el("div", "try-controls");
  const btnCopyLink = button(T.copyLink, true);
  const testLink = el("a", "try-btn", T.test);
  testLink.target = "_blank";
  testLink.rel = "noopener";
  testLink.style.textDecoration = "none";
  testLink.style.display = "inline-flex";
  testLink.style.alignItems = "center";
  linkRow.append(btnCopyLink, testLink);
  const canvas = el("canvas", "ft-qr");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", T.qrAlt);
  const qrRow = el("div", "try-controls");
  const btnPng = button(T.downloadPng);
  qrRow.append(btnPng);
  const qrHint = el("p", "ft-hint", T.qrHint);
  const outStatus = el("p", "ft-status");
  outStatus.setAttribute("role", "status");
  outStatus.setAttribute("aria-live", "polite");
  boxOut.append(hOut, linkLabel, linkOut, linkRow, canvas, qrRow, qrHint, outStatus);

  // Step 3: messages
  const boxMsg = el("section", "ft-box");
  boxMsg.setAttribute("aria-labelledby", "rev-h-msg");
  boxMsg.hidden = true;
  const hMsg = el("h2", "lx-h3", T.msgTitle);
  hMsg.id = "rev-h-msg";
  const msgIntro = el("p", "ft-hint", T.msgIntro);
  const fBiz = field(T.business, textInput({ autocomplete: "organization" }));
  const fCust = field(T.customer, textInput({ autocomplete: "off" }));
  const msgGrid = el("div", "ft-grid");
  msgGrid.append(fBiz.wrap, fCust.wrap);
  boxMsg.append(hMsg, msgIntro, msgGrid);
  const msgViews = DATA.messages.map((m) => {
    const isMail = !!m.subject;
    const wrap = el("div", "ft-msg");
    const h = el("h3", null, m.label);
    const tag = el("span", "ft-tag", m.channel);
    const subject = isMail ? el("p", "ft-subject") : null;
    const out = el("pre", "ft-out");
    out.style.fontFamily = "inherit";
    const row = el("div", "try-controls");
    const b = button(isMail ? T.copyEmail : T.copyMsg);
    const st = el("p", "ft-status");
    st.setAttribute("role", "status");
    st.setAttribute("aria-live", "polite");
    row.append(b);
    wrap.append(h, tag);
    if (subject) wrap.append(subject);
    wrap.append(out, row, st);
    boxMsg.append(wrap);
    b.addEventListener("click", () => copy((isMail ? T.subjectPrefix + m.subject + "\n\n" : "") + out.textContent, st, isMail ? T.emailDone : T.msgDone));
    return { m, out, subject };
  });

  app.append(boxIn, boxOut, boxMsg);

  let url = "";

  function drawQr(text) {
    if (!root.QREncoder) return false;
    let qr;
    try { qr = root.QREncoder.create(text, "M"); } catch (e) { return false; }
    const quiet = 4;
    const total = qr.size + quiet * 2;
    const scale = Math.max(4, Math.floor(1024 / total));
    const px = total * scale;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.data[r * qr.size + c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return true;
  }

  function updateMessages() {
    for (const v of msgViews) {
      const vals = { name: fCust.input.value, business: fBiz.input.value, link: url };
      v.out.textContent = fillMessageHe(v.m.body, vals);
      if (v.subject) v.subject.textContent = T.subjectPrefix + v.m.subject;
    }
  }

  function update(final) {
    const res = extractPlaceId(fPlace.input.value);
    outStatus.textContent = "";
    if (!res.ok) {
      boxOut.hidden = true;
      boxMsg.hidden = true;
      url = "";
      // Do not nag while the box is empty or still being typed.
      err.textContent = res.reason === "empty" || (res.reason === "not-found" && !final) ? "" : DATA.reasons[res.reason] || "";
      return;
    }
    err.textContent = "";
    url = reviewUrl(res.placeId);
    linkOut.textContent = url;
    testLink.href = url;
    const ok = drawQr(url);
    canvas.hidden = !ok;
    btnPng.hidden = !ok;
    if (!ok) outStatus.textContent = T.qrFail;
    boxOut.hidden = false;
    boxMsg.hidden = false;
    updateMessages();
  }

  fPlace.input.addEventListener("input", () => update(false));
  fPlace.input.addEventListener("change", () => update(true));
  fBiz.input.addEventListener("input", updateMessages);
  fCust.input.addEventListener("input", updateMessages);
  btnCopyLink.addEventListener("click", () => copy(url, outStatus, T.linkDone));
  btnPng.addEventListener("click", () => {
    if (!url || !canvas.toBlob) return;
    canvas.toBlob((blob) => {
      if (!blob) { outStatus.textContent = T.pngFail; return; }
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = T.pngName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      outStatus.textContent = T.pngDone;
    }, "image/png");
  });
  update(false);
})(typeof window !== "undefined" ? window : globalThis);
