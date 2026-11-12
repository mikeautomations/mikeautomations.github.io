// /en/self-assessment-checklist/ client logic. Progressive enhancement: the page already shows the full checklist
// without JS. No dependencies, no network requests, no cookies or storage: nothing typed here leaves the device. The
// only state is the page address (?s=emp,landlord&p=...&by=...), so an accountant can share a pre-filled link.
// PART 1 is a copy of the pure functions at the end of src/app/landing/data/tools/sa-checklist.ts with the types
// removed. tests/sa-checklist.test.ts loads this file in a sandbox and checks both copies give identical results.
// PART 2 reads the checklist from <script id="sac-data"> (the same data module) and drives the page.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to sa-checklist.ts) ----------
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function validDate(s) {
    const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!r) return "";
    const y = +r[1], m = +r[2], d = +r[3];
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return "";
    return `${r[1]}-${r[2]}-${r[3]}`;
  }

  function longDate(iso) {
    return `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
  }

  function cleanPractice(s) {
    return String(s || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function parseState(search, data) {
    const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    const want = new Set((q.get("s") || "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean));
    const codes = data.situations.map((s) => s.code).filter((c) => want.has(c));
    return { codes, practice: cleanPractice(q.get("p") || ""), by: validDate(q.get("by") || "") };
  }

  function stateQuery(state) {
    const parts = [];
    if (state.codes.length) parts.push(`s=${state.codes.join(",")}`);
    if (state.practice) parts.push(`p=${encodeURIComponent(state.practice)}`);
    if (state.by) parts.push(`by=${state.by}`);
    return parts.length ? `?${parts.join("&")}` : "";
  }

  function buildChecklist(data, codes) {
    const urls = new Map(data.sources.map((s) => [s.id, s.url]));
    const chosen = codes.length ? data.situations.filter((s) => codes.includes(s.code)) : data.situations;
    return [data.everyone, ...chosen].map((s) => ({
      code: s.code,
      heading: s.heading,
      intro: s.intro,
      items: s.items.map((i) => ({ ...i, url: urls.get(i.source) || "" })),
    }));
  }

  function emailText(data, state, ticked = []) {
    const ty = data.taxYear;
    const groups = buildChecklist(data, state.codes)
      .map((g) => ({ ...g, items: g.items.filter((i) => !ticked.includes(i.id)) }))
      .filter((g) => g.items.length);
    const left = buildChecklist(data, state.codes).reduce((n, g) => n + g.items.length, 0) - groups.reduce((n, g) => n + g.items.length, 0);
    const L = [];
    const list = () => {
      for (const g of groups) {
        L.push("", g.heading.toUpperCase());
        for (const i of g.items) L.push(`- ${i.text}. Where: ${i.where}.`);
      }
      if (left) L.push("", `(${left} item${left === 1 ? " is" : "s are"} already ticked off and left out.)`);
    };
    if (state.practice) {
      L.push(`Subject: Your ${ty.label} tax return: documents we need`, "", "Hi [client name],", "");
      L.push(`We are getting ready to prepare your Self Assessment tax return for the ${ty.label} tax year (${ty.start} to ${ty.end}). HMRC's deadline for online returns is ${ty.onlineDue}.`);
      L.push("", state.by ? `Please send the documents below by ${longDate(state.by)}.` : "Please send the documents below as soon as you can.");
      list();
      L.push("", "If something on the list does not apply to you this year, reply and tell us. That is just as useful as the document.", "", "Thanks,", state.practice);
    } else {
      L.push(`Subject: Self Assessment ${ty.label}: documents checklist`, "");
      L.push(`Tax year ${ty.start} to ${ty.end}. HMRC must receive the online return and any tax owed by ${ty.onlineDue}.`);
      if (state.by) L.push(`Please send by ${longDate(state.by)}.`);
      list();
      L.push("", "This is a guide, not advice. Check GOV.UK or ask your accountant.", `Checklist: ${data.site}${stateQuery({ codes: state.codes, practice: "", by: "" })}`);
    }
    return L.join("\n") + "\n";
  }

  const csvCell = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  function toCsv(data, codes, ticked = []) {
    const lines = [["section", "document", "where to get it", "gov.uk source", "received", "date received", "notes"].join(",")];
    for (const g of buildChecklist(data, codes)) {
      for (const i of g.items) lines.push([g.heading, i.text, i.where, i.url, ticked.includes(i.id) ? "yes" : "", "", ""].map(csvCell).join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }

  const API = { validDate, longDate, cleanPractice, parseState, stateQuery, buildChecklist, emailText, toCsv };
  root.SaChecklist = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("sac-app");
  const dataEl = document.getElementById("sac-data");
  const listEl = document.getElementById("sac-checklist");
  if (!app || !dataEl || !listEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }

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

  let state = parseState(location.search, DATA);
  let accountant = !!(state.practice || state.by);
  const groups = Array.from(listEl.querySelectorAll(".sac-group"));
  const itemBoxes = Array.from(listEl.querySelectorAll("input[data-item]"));
  const ticked = () => itemBoxes.filter((b) => b.checked && !b.closest(".sac-group").hidden).map((b) => b.dataset.item);
  const printHead = document.getElementById("sac-print-head");
  const listHeading = document.getElementById("sac-list-h");

  // Situation picker.
  const box = el("section", "sac-box");
  box.setAttribute("aria-labelledby", "sac-pick-h");
  const h = el("h2", "lx-h3", "What applied to you in the tax year?");
  h.id = "sac-pick-h";
  const fs = el("fieldset");
  const legend = el("legend", null, `Tick every situation from ${DATA.taxYear.start} to ${DATA.taxYear.end}. Leave all unticked to see the full list.`);
  const picks = el("div", "sac-picks");
  const pickBoxes = DATA.situations.map((s) => {
    const lab = el("label", "sac-pick");
    const cb = el("input");
    cb.type = "checkbox";
    cb.value = s.code;
    cb.checked = state.codes.includes(s.code);
    lab.append(cb, el("span", null, s.label));
    picks.append(lab);
    return cb;
  });
  fs.append(legend, picks);

  // Accountant mode.
  const accWrap = el("div", "sac-acc");
  const accLab = el("label", "sac-pick");
  const accCb = el("input");
  accCb.type = "checkbox";
  accCb.checked = accountant;
  accLab.append(accCb, el("span", null, "Accountant mode: add your practice name and a \"please send by\" date"));
  const accFields = el("div", "sac-fields");
  const mkField = (label, type, hint) => {
    const id = "sac-f-" + type;
    const wrap = el("div", "sac-field");
    const lab = el("label", null, label);
    lab.htmlFor = id;
    const input = el("input");
    input.id = id;
    input.type = type;
    wrap.append(lab);
    if (hint) { const hh = el("span", "sac-hint", hint); hh.id = id + "-h"; input.setAttribute("aria-describedby", hh.id); wrap.append(hh); }
    wrap.append(input);
    accFields.append(wrap);
    return input;
  };
  const practice = mkField("Practice name", "text", "Signs the email and goes into the shared link.");
  practice.maxLength = 80;
  practice.autocomplete = "organization";
  practice.value = state.practice;
  const by = mkField("Please send by", "date", "Goes into the email text and the shared link.");
  by.min = "2026-04-06";
  by.max = "2027-12-31";
  by.value = state.by;
  accWrap.append(accLab, accFields);

  // Actions.
  const status = el("p", "sac-status");
  status.setAttribute("role", "status");
  const actions = el("div", "try-controls");
  const bPrint = button("Print or save as PDF", true);
  const bEmail = button("Copy as email text");
  const bCsv = button("Download CSV tracker");
  const bLink = button("Copy link to this list");
  const bClear = button("Clear");
  actions.append(bPrint, bEmail, bCsv, bLink, bClear);
  const guide = el("p", "sac-hint", "This is a guide, not advice. Check GOV.UK or ask your accountant. Nothing you type leaves your device.");

  box.append(h, fs, accWrap, actions, status, guide);
  app.textContent = "";
  app.append(box);

  function read() {
    const codes = pickBoxes.filter((b) => b.checked).map((b) => b.value);
    accountant = accCb.checked;
    accFields.hidden = !accountant;
    state = { codes, practice: accountant ? cleanPractice(practice.value) : "", by: accountant ? validDate(by.value) : "" };
  }

  function render() {
    read();
    const show = new Set(buildChecklist(DATA, state.codes).map((g) => g.code));
    groups.forEach((g) => { g.hidden = !show.has(g.dataset.code); });
    const n = buildChecklist(DATA, state.codes).reduce((k, g) => k + g.items.length, 0);
    listHeading.textContent = state.codes.length ? `Your checklist: ${n} items for the ${DATA.taxYear.label} tax year` : `The full checklist: ${DATA.taxYear.label} tax year`;
    const head = [];
    if (state.practice) head.push(`From ${state.practice}.`);
    if (state.by) head.push(`Please send by ${longDate(state.by)}.`);
    printHead.textContent = head.join(" ");
    const url = location.pathname + stateQuery(state) + location.hash;
    try { history.replaceState(null, "", url); } catch (e) { /* file:// or sandboxed: the list still works */ }
  }

  function say(msg) {
    status.textContent = "";
    setTimeout(() => { status.textContent = msg; }, 30);
  }

  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch (e) {
      const ta = el("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      say(ok ? done : "Copying is blocked in this browser. Select the list on the page and copy it instead.");
    }
  }

  function download(name, type, text) {
    const href = URL.createObjectURL(new Blob([text], { type }));
    const a = el("a");
    a.href = href;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  pickBoxes.forEach((b) => b.addEventListener("change", render));
  accCb.addEventListener("change", render);
  practice.addEventListener("input", render);
  by.addEventListener("change", render);
  bPrint.addEventListener("click", () => { render(); window.print(); });
  bEmail.addEventListener("click", () => { render(); copy(emailText(DATA, state, ticked()), "Email text copied. Paste it into a new email."); });
  bCsv.addEventListener("click", () => { render(); download("self-assessment-checklist.csv", "text/csv;charset=utf-8", "﻿" + toCsv(DATA, state.codes, ticked())); say("CSV tracker downloaded."); });
  bLink.addEventListener("click", () => { render(); copy(location.origin + location.pathname + stateQuery(state), "Link copied. Anyone who opens it sees this list."); });
  bClear.addEventListener("click", () => {
    pickBoxes.forEach((b) => { b.checked = false; });
    itemBoxes.forEach((b) => { b.checked = false; });
    render();
    say("Cleared. Showing the full checklist.");
  });

  render();
})(typeof globalThis !== "undefined" ? globalThis : this);
