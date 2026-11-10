// /en/agreement/ client logic (src/app/landing/en/agreement-page.tsx). Vanilla JS, no dependencies, no requests.
// Turns the static template into a live draft: a form fills the clauses, the state lives in the URL (?n=&c=&w=...),
// and the actions print, copy the link, book a call or open the "Send to Michael" dialog. The send itself is done by
// the site's shared form script (site.js handles every <dialog><form>), so the draft goes to the same endpoint as
// every other enquiry on the site, and only when the visitor presses Send.
(() => {
  const $ = (id) => document.getElementById(id);
  const dataEl = $("agr-data"), form = $("agr-form"), doc = $("agr-doc");
  if (!dataEl || !form || !doc) return;
  let D;
  try { D = JSON.parse(dataEl.textContent || "{}"); } catch { return; }
  const catalog = Array.isArray(D.catalog) ? D.catalog : [];
  const byId = (id) => catalog.find((w) => w.id === id);

  // ---- State, from the URL (plan builder: ?w=<id>&b=<business>&t=<tools>; this page adds the rest) ----
  const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const toolName = (id) => (D.toolMap || {})[String(id).trim()] || (D.tools || []).find((t) => slug(t) === slug(id)) || String(id).trim();
  const q = new URLSearchParams(location.search);
  const clip = (s, n) => String(s || "").slice(0, n);
  const S = {
    client: clip(q.get("n"), 120),
    contact: clip(q.get("c"), 80),
    w: clip(q.get("w"), 60),
    b: clip(q.get("b"), 60),
    workflow: clip(q.get("wl"), 160),
    steps: q.getAll("s").map((s) => clip(s, 300)).filter(Boolean).slice(0, 20),
    tools: q.has("tl") ? clip(q.get("tl"), 200) : (q.get("t") || "").split(",").filter(Boolean).map(toolName).join(", "),
    working: q.getAll("k").map((s) => clip(s, 300)).slice(0, 20),
    founding: q.get("f") === "1",
    support: q.get("sp") === "1",
  };
  const preset = byId(S.w);
  if (preset) {
    if (!S.workflow) S.workflow = preset.label || "";
    if (!S.steps.length) S.steps = (preset.steps || []).slice();
    if (!S.working.length) S.working = [].concat(preset.working || []).filter(Boolean);
  } else if (S.w && !S.workflow) {
    // A workflow id with no catalog entry: show it in plain words so the visitor can correct it.
    S.workflow = S.w.replace(/-/g, " ");
  }
  if (!S.working.length) S.working = [""];

  // ---- Form wiring ----
  form.hidden = false;
  const nojs = $("agr-nojs");
  if (nojs) nojs.textContent = "Fill in the form and the draft updates as you type. You can still print the blank template.";
  const f = {
    client: $("agr-client"), contact: $("agr-contact"), workflow: $("agr-workflow"), steps: $("agr-steps"),
    tools: $("agr-tools"), founding: $("agr-founding"), support: $("agr-support"),
  };
  f.client.value = S.client; f.contact.value = S.contact; f.workflow.value = S.workflow;
  f.steps.value = S.steps.join("\n"); f.tools.value = S.tools;
  f.founding.checked = S.founding; f.support.checked = S.support;

  const pickWrap = $("agr-wf-pick-wrap"), pick = $("agr-wf-pick");
  if (catalog.length && pickWrap && pick) {
    pickWrap.hidden = false;
    for (const w of catalog) {
      const o = document.createElement("option");
      o.value = w.id; o.textContent = w.label;
      pick.append(o);
    }
    pick.value = preset ? S.w : "";
    pick.addEventListener("change", () => {
      const w = byId(pick.value);
      S.w = w ? w.id : "";
      if (w) {
        S.workflow = w.label || ""; S.steps = (w.steps || []).slice();
        S.working = [].concat(w.working || []).filter(Boolean);
        if (!S.working.length) S.working = [""];
        f.workflow.value = S.workflow; f.steps.value = S.steps.join("\n"); f.tools.value = S.tools;
        drawWorking();
        say("Filled in from the plan builder: " + S.workflow + ". Edit anything you like.");
      }
      update();
    });
  }

  const read = () => {
    S.client = f.client.value.trim(); S.contact = f.contact.value.trim(); S.workflow = f.workflow.value.trim();
    S.steps = f.steps.value.split("\n").map((s) => s.trim()).filter(Boolean);
    S.tools = f.tools.value.trim(); S.founding = f.founding.checked; S.support = f.support.checked;
  };
  form.addEventListener("input", (e) => { if (!e.target.closest("#agr-working")) { read(); update(); } });
  form.addEventListener("change", () => { read(); update(); });
  form.addEventListener("submit", (e) => e.preventDefault());

  // ---- "Working means..." checklist: add, edit, remove ----
  const list = $("agr-working");
  function drawWorking(focusIndex) {
    list.replaceChildren();
    S.working.forEach((text, i) => {
      const li = document.createElement("li");
      li.className = "agr-row";
      const id = "agr-k-" + i;
      const label = document.createElement("label");
      label.className = "agr-sr"; label.htmlFor = id; label.textContent = "Check " + (i + 1);
      const input = document.createElement("input");
      input.type = "text"; input.id = id; input.value = text; input.maxLength = 300;
      input.placeholder = i === 0 ? "e.g. every client with items outstanding gets a reminder" : "Another check";
      input.addEventListener("input", () => { S.working[i] = input.value; update(); });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(""); } });
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "agr-btn agr-btn-small"; rm.textContent = "Remove";
      rm.setAttribute("aria-label", "Remove check " + (i + 1) + (text ? ": " + text : ""));
      rm.addEventListener("click", () => {
        S.working.splice(i, 1);
        if (!S.working.length) S.working = [""];
        drawWorking(Math.min(i, S.working.length - 1));
        update();
        say("Check removed.");
      });
      li.append(label, input, rm);
      list.append(li);
    });
    if (focusIndex !== undefined) { const el = $("agr-k-" + focusIndex); if (el) el.focus(); }
  }
  function add(text) {
    if (S.working.length >= 20) { say("That's 20 checks. Keep the list short enough to test."); return; }
    const empty = text ? S.working.findIndex((s) => !s.trim()) : -1;
    if (empty >= 0) S.working[empty] = text; else S.working.push(text);
    drawWorking(text ? undefined : S.working.length - 1);
    update();
  }
  $("agr-add").addEventListener("click", () => add(""));
  drawWorking();

  // The examples list gets an "Add" button each.
  document.querySelectorAll("#agr-examples li[data-example]").forEach((li) => {
    const text = li.getAttribute("data-example");
    const b = document.createElement("button");
    b.type = "button"; b.className = "agr-btn agr-btn-small"; b.textContent = "Add";
    b.setAttribute("aria-label", "Add to my checks: " + text);
    b.addEventListener("click", () => { add(text); say("Added to your checks: " + text); });
    li.append(b);
  });

  // ---- The draft ----
  const isCustom = () => { const w = byId(S.w); return !!(w && w.offer === "custom"); };
  const foundingWrap = $("agr-founding-wrap");
  const val = (k) => {
    if (k === "client") return S.client;
    if (k === "contact") return S.contact;
    if (k === "workflow") return S.workflow;
    if (k === "tools") return S.tools;
    if (k === "price") return isCustom() ? D.price.custom : S.founding ? D.price.founding : D.price.standard;
    if (k === "support") return S.support ? D.support.yes : D.support.no;
    return "";
  };
  const listOf = (name) => {
    const items = name === "steps" ? S.steps : S.working.map((s) => s.trim()).filter(Boolean);
    return items.length ? items : null;
  };
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const blankSpan = (t) => { const s = document.createElement("span"); s.className = "agr-blank"; s.textContent = t; return s; };
  function fillInto(el, text) {
    for (const bit of text.split(/(\{[a-z]+\})/g)) {
      const m = /^\{([a-z]+)\}$/.exec(bit);
      if (!m) { if (bit) el.append(bit); continue; }
      const v = val(m[1]);
      el.append(v ? v : blankSpan(D.blanks[m[1]] || "[ ]"));
    }
  }
  function render() {
    if (foundingWrap) foundingWrap.hidden = isCustom();
    const nodes = [];
    const note = document.createElement("p"); note.className = "agr-draft"; note.setAttribute("role", "note"); note.textContent = D.draftNote;
    const h = document.createElement("h3"); h.className = "agr-doc-title"; h.id = "agr-doc-title";
    h.textContent = "Workflow automation agreement" + (S.client ? ": " + S.client : "");
    const meta = document.createElement("p"); meta.className = "lx-fine";
    meta.textContent = "Prepared from the template at mikeautomations.github.io/en/agreement/. Date: " + today + ".";
    nodes.push(note, h, meta);
    for (const c of D.clauses) {
      const box = document.createElement("div"); box.className = "agr-clause";
      const h4 = document.createElement("h4"); h4.textContent = c.h; box.append(h4);
      for (const part of c.parts) {
        if (part.p !== undefined) { const p = document.createElement("p"); fillInto(p, part.p); box.append(p); }
        else if (part.ul) { const ul = document.createElement("ul"); for (const s of part.ul) { const li = document.createElement("li"); li.textContent = s; ul.append(li); } box.append(ul); }
        else if (part.list) {
          const items = listOf(part.list);
          if (!items && part.list === "steps" && S.workflow) continue; // steps are optional once the workflow is named
          const ol = document.createElement("ol");
          for (const s of items || D.blankLists[part.list]) { const li = document.createElement("li"); li.append(items ? s : blankSpan(s)); ol.append(li); }
          box.append(ol);
        }
      }
      nodes.push(box);
    }
    doc.replaceChildren(...nodes);
  }
  function asText() {
    const fill = (t) => t.replace(/\{([a-z]+)\}/g, (_, k) => val(k) || D.blanks[k] || "[ ]");
    const out = [D.draftNote, "", "Workflow automation agreement" + (S.client ? ": " + S.client : ""), "Date: " + today, ""];
    for (const c of D.clauses) {
      out.push(c.h);
      for (const part of c.parts) {
        if (part.p !== undefined) out.push(fill(part.p));
        else if (part.ul) for (const s of part.ul) out.push("- " + s);
        else if (part.list) {
          const items = listOf(part.list);
          if (!items && part.list === "steps" && S.workflow) continue;
          (items || D.blankLists[part.list]).forEach((s, i) => out.push((i + 1) + ". " + s));
        }
      }
      out.push("");
    }
    out.push("Link to this draft: " + link());
    return out.join("\n");
  }

  // ---- URL state ----
  function link() {
    const p = new URLSearchParams();
    if (S.client) p.set("n", S.client);
    if (S.contact) p.set("c", S.contact);
    if (S.b) p.set("b", S.b);
    if (S.w) p.set("w", S.w);
    const preset = byId(S.w);
    if (S.workflow && (!preset || preset.label !== S.workflow)) p.set("wl", S.workflow);
    if (!preset || S.steps.join("\n") !== (preset.steps || []).join("\n")) for (const s of S.steps) p.append("s", s);
    if (S.tools) p.set("tl", S.tools);
    const work = S.working.map((s) => s.trim()).filter(Boolean);
    if (!preset || work.join("\n") !== [].concat(preset.working || []).join("\n")) for (const s of work) p.append("k", s);
    if (S.founding) p.set("f", "1");
    if (S.support) p.set("sp", "1");
    const qs = p.toString();
    return location.origin + location.pathname + (qs ? "?" + qs : "");
  }
  let urlTimer = 0;
  function update() {
    render();
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => { try { history.replaceState(null, "", link()); } catch {} }, 300);
  }

  // ---- Actions ----
  const status = $("agr-status");
  let sayTimer = 0;
  function say(t) {
    status.textContent = "";
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { status.textContent = t; }, 50); // re-announce the same message
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
  $("agr-print").addEventListener("click", () => window.print());
  $("agr-copy").addEventListener("click", async () => {
    const url = link();
    say(await copy(url) ? "Link copied. It opens this draft with everything you typed." : "Copy this link: " + url);
  });
  const book = $("agr-book");
  if (D.booking && /^https:\/\//.test(D.booking)) book.href = D.booking;
  book.addEventListener("click", () => {
    copy(link()).then((ok) => say(ok
      ? "The booking page opens in a new tab. The link to your draft is copied: paste it into the booking notes so Michael can read it first."
      : "The booking page opens in a new tab. Use \"Copy link\" to share your draft with Michael."));
  });

  const dialog = $("agr-dialog");
  $("agr-send").addEventListener("click", () => {
    if (!dialog || typeof dialog.showModal !== "function") { location.href = mailto(); return; }
    const df = dialog.querySelector("form");
    if (df) {
      const set = (n, v) => { const el = df.elements[n]; if (el && !el.value) el.value = v; };
      set("name", S.contact); set("business", S.client);
      if (df.elements.pain) df.elements.pain.value = asText(); // always the latest draft
      const m = $("agr-mailto"); if (m) m.href = mailto();
    }
    dialog.showModal();
    const first = df && [df.elements.name, df.elements.email].find((el) => el && !el.value);
    if (first) first.focus();
  });
  function mailto() {
    const subject = "Draft agreement" + (S.client ? ": " + S.client : "");
    let body = asText();
    // Email apps cut long mailto: links; keep it short and point to the full draft.
    if (body.length > 1800) body = body.slice(0, 1700) + "\n...\n(cut short here. The full draft: " + link() + ")";
    return "mailto:" + D.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  render();
})();
