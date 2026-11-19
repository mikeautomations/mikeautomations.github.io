// /en/price-increase-letter-generator/ client logic. Progressive enhancement: the page already explains the letter and shows a worked example without JS.
// No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device.
// PART 1 is a copy of clean(), money(), parseIso(), longDate() and priceIncrease() in
// src/app/landing/data/tools/price-increase-letter.ts with the types removed.
// tests/tools-c-price-increase.test.ts loads this file in a sandbox and checks both copies give identical results.
(function (root) {
  "use strict";

  // ---------- PART 1: pure logic (keep identical to price-increase-letter.ts) ----------
  const CURRENCIES = ["£", "$", "€"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const clean = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");

  function money(n, cur) {
    const r = round2(n);
    const s = Number.isInteger(r) ? String(r) : r.toFixed(2);
    const [whole, frac] = s.split(".");
    return `${cur}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac ? "." + frac : ""}`;
  }

  function parseIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const back = new Date(Date.UTC(y, mo - 1, d));
    return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? [y, mo, d] : null;
  }

  function longDate(iso) {
    const p = parseIso(iso);
    return p ? `${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}` : "";
  }

  function priceIncrease(i) {
    const cur = CURRENCIES.indexOf(i.currency) >= 0 ? i.currency : "£";
    const oldPrice = i.oldPrice;
    if (typeof oldPrice !== "number" || !Number.isFinite(oldPrice) || oldPrice <= 0) return { ok: false, error: "Enter the old price, a number above 0." };
    let newPrice;
    let pct;
    if (i.mode === "pct") {
      if (typeof i.pct !== "number" || !Number.isFinite(i.pct) || i.pct <= 0) return { ok: false, error: "Enter the increase as a percentage above 0." };
      if (i.pct > 300) return { ok: false, error: "The increase must be 300 percent or less." };
      newPrice = round2(oldPrice * (1 + i.pct / 100));
      pct = round1(i.pct);
    } else {
      if (typeof i.newPrice !== "number" || !Number.isFinite(i.newPrice) || i.newPrice <= 0) return { ok: false, error: "Enter the new price, a number above 0." };
      if (i.newPrice <= oldPrice) return { ok: false, error: "The new price must be higher than the old price. This tool is for price increases." };
      newPrice = round2(i.newPrice);
      pct = round1(((newPrice - oldPrice) / oldPrice) * 100);
    }
    if (pct <= 0) return { ok: false, error: "That increase is too small to show as a percentage. Check the two prices." };
    if (newPrice <= oldPrice) return { ok: false, error: "The new price must be higher than the old price. This tool is for price increases." };
    const dateIn = clean(i.startDate);
    if (dateIn && !parseIso(dateIn)) return { ok: false, error: "Enter a real start date." };
    const dateText = dateIn ? longDate(dateIn) : "[start date]";
    const business = clean(i.business) || "[your business name]";
    const client = clean(i.client);
    const service = clean(i.service) || "our service";
    const oldText = money(oldPrice, cur);
    const newText = money(newPrice, cur);
    const pctText = String(pct);
    const tone = i.tone === "brief" || i.tone === "formal" ? i.tone : "warm";
    const reason = i.reason === "costs" || i.reason === "value" || i.reason === "review" ? i.reason : "none";

    const change = `${oldText} to ${newText}`;
    const longReason = {
      costs: "Our costs have risen over the past year, and this change lets us keep the same standard of service.",
      value: `We have added more to ${service} over the past year, and the new price reflects that.`,
      review: "We review our prices once a year, and this is the result of this year's review.",
      none: "",
    };
    const shortReason = {
      costs: "Our costs have gone up.",
      value: "It reflects the extra value we now include.",
      review: "It follows our annual price review.",
      none: "",
    };
    const hi = tone === "formal" ? (client ? `Dear ${client},` : "Dear client,") : client ? `Hi ${client},` : "Hello,";

    let subject;
    let paras;
    if (tone === "brief") {
      subject = `Price update from ${dateText}`;
      paras = [hi, `From ${dateText}, ${service} will go from ${change} (${pctText}% more). ${shortReason[reason]} Questions? Just reply.`.replace(/ {2,}/g, " "), `Thanks,\n${business}`];
    } else if (tone === "formal") {
      subject = `Notice of price change effective ${dateText}`;
      paras = [
        hi,
        `I am writing to inform you that, with effect from ${dateText}, the price of ${service} will increase from ${change}, an increase of ${pctText}%.`,
        ...(reason === "none" ? [] : [longReason[reason]]),
        "Please contact us if you would like to discuss this. We value your custom and thank you for your understanding.",
        `Yours sincerely,\n${business}`,
      ];
    } else {
      subject = `A change to our prices from ${dateText}`;
      paras = [
        hi,
        `Thank you for being a client of ${business}. We wanted to tell you about a change to our prices in good time, so there are no surprises.`,
        `From ${dateText}, the price of ${service} will change from ${change}, an increase of ${pctText}%.`,
        ...(reason === "none" ? [] : [longReason[reason]]),
        "If you have any questions, just reply to this message and we will be happy to talk it through. Thank you for your understanding.",
        `Best wishes,\n${business}`,
      ];
    }
    const body = paras.join("\n\n");
    const short = [
      `${hi} a quick heads-up from ${business}: from ${dateText}, ${service} goes from ${change} (${pctText}% more).`,
      tone === "brief" || reason === "none" ? "" : shortReason[reason],
      tone === "brief" ? "Questions? Just reply." : "Happy to talk it through if you have any questions.",
    ].filter(Boolean).join(" ");
    return { ok: true, oldPrice, newPrice, pct, pctText, oldText, newText, dateText, subject, body, short, showEmail: i.channel !== "message" };
  }

  root.PriceIncrease = { clean, money, parseIso, longDate, priceIncrease };

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("pil-app");
  if (!app) return;

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
  function field(label, hint, control) {
    const id = "pil-f" + ++uid;
    const wrap = el("div", "ft-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    control.id = id;
    wrap.append(lab);
    if (hint) { const h = el("p", "ft-hint", hint); h.id = id + "-h"; control.setAttribute("aria-describedby", h.id); wrap.append(h); }
    wrap.append(control);
    return wrap;
  }
  const textInput = (extra) => { const i = el("input"); i.type = "text"; i.autocomplete = "off"; if (extra) Object.assign(i, extra); return i; };
  const numInput = () => { const i = el("input"); i.type = "number"; i.inputMode = "decimal"; i.min = "0"; i.step = "any"; return i; };
  const select = (options, value) => {
    const s = el("select");
    for (const o of options) { const opt = el("option", null, o[1]); opt.value = o[0]; s.append(opt); }
    s.value = value;
    return s;
  };

  const business = textInput();
  const client = textInput();
  const service = textInput();
  const currency = select([["£", "£ pound"], ["$", "$ dollar"], ["€", "€ euro"]], "£");
  const mode = select([["price", "I know the old and new price"], ["pct", "I know the old price and the % increase"]], "price");
  const oldP = numInput();
  const newP = numInput();
  const pctI = numInput();
  const start = el("input");
  start.type = "date";
  const reason = select([["costs", "Rising costs"], ["value", "More value in the service"], ["review", "Annual price review"], ["none", "No reason given"]], "costs");
  const tone = select([["warm", "Warm"], ["brief", "Brief"], ["formal", "Formal"]], "warm");
  const channel = select([["email", "Email (with a short version too)"], ["message", "Short message only (WhatsApp or SMS)"]], "email");

  const fNew = field("New price", null, newP);
  const fPct = field("Increase (%)", "For example 8 for an 8 percent increase.", pctI);
  fPct.hidden = true;

  const form = el("section", "ft-box");
  form.setAttribute("aria-labelledby", "pil-h-form");
  const hForm = el("h2", "lx-h3", "The price change");
  hForm.id = "pil-h-form";
  const g1 = el("div", "ft-grid");
  g1.append(field("Your business name", null, business), field("Client name (optional)", "First name is fine. Left empty, the letter says \"Hello\".", client), field("The service", "For example monthly bookkeeping.", service), field("Currency", null, currency));
  const g2 = el("div", "ft-grid");
  g2.append(field("How do you want to enter it?", null, mode), field("Old price", null, oldP), fNew, fPct, field("Date the new price starts", "Left empty, the letter shows [start date].", start));
  const g3 = el("div", "ft-grid");
  g3.append(field("Reason (optional)", null, reason), field("Tone", null, tone), field("Channel", null, channel));
  form.append(hForm, g1, g2, g3);

  const err = el("p", "ft-error");
  err.setAttribute("role", "alert");

  const out = el("div", "pil-out");
  out.setAttribute("aria-live", "polite");
  const status = el("p", "ft-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  app.textContent = "";
  app.append(form, err, out, status);

  async function copy(text, what) {
    status.textContent = "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else throw new Error("no clipboard");
      status.textContent = `${what} copied.`;
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
      status.textContent = ok ? `${what} copied.` : "Could not copy. Select the text above and copy it yourself.";
    }
  }

  const num = (i) => (i.value.trim() === "" ? NaN : Number(i.value));

  function render() {
    const byPct = mode.value === "pct";
    fNew.hidden = byPct;
    fPct.hidden = !byPct;
    err.textContent = "";
    out.textContent = "";
    status.textContent = "";
    if (oldP.value.trim() === "" || (byPct ? pctI.value.trim() === "" : newP.value.trim() === "")) return;
    const r = priceIncrease({
      business: business.value, client: client.value, service: service.value, currency: currency.value, mode: mode.value,
      oldPrice: num(oldP), newPrice: num(newP), pct: num(pctI), startDate: start.value, reason: reason.value, tone: tone.value, channel: channel.value,
    });
    if (!r.ok) { err.textContent = r.error; return; }
    out.append(el("p", "pil-headline", `Increase: ${r.pctText}% (from ${r.oldText} to ${r.newText})`));
    if (r.showEmail) {
      const box = el("section", "ft-box");
      box.setAttribute("aria-labelledby", "pil-h-email");
      const h = el("h2", "lx-h3", "Your email");
      h.id = "pil-h-email";
      const row = el("div", "try-controls");
      const b1 = button("Copy email", true);
      const b2 = button("Copy subject only");
      b1.addEventListener("click", () => copy(`Subject: ${r.subject}\n\n${r.body}`, "Email"));
      b2.addEventListener("click", () => copy(r.subject, "Subject"));
      row.append(b1, b2);
      const body = el("pre", "ft-out", r.body);
      body.style.fontFamily = "inherit";
      box.append(h, el("p", "ft-hint", "Subject"), el("p", "ft-out ft-subject", r.subject), el("p", "ft-hint", "Letter"), body, row);
      out.append(box);
    }
    const box2 = el("section", "ft-box");
    box2.setAttribute("aria-labelledby", "pil-h-short");
    const h2 = el("h2", "lx-h3", "Short version for WhatsApp or SMS");
    h2.id = "pil-h-short";
    const row2 = el("div", "try-controls");
    const b3 = button(r.showEmail ? "Copy short message" : "Copy message", !r.showEmail);
    b3.addEventListener("click", () => copy(r.short, "Short message"));
    row2.append(b3);
    box2.append(h2, el("p", "ft-out", r.short), row2);
    out.append(box2);
  }

  for (const c of [business, client, service, currency, mode, oldP, newP, pctI, start, reason, tone, channel]) {
    c.addEventListener("input", render);
    c.addEventListener("change", render);
  }
  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
