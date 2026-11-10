// /en/plan/ client logic: turns #plan-app into the 3-step plan builder (business, job, tools) and the plan view.
// Vanilla JS, no dependencies, no third-party requests. The catalog comes from the page's #plan-data JSON block
// (built from src/app/landing/plan-catalog.ts). Nothing is sent anywhere: the only outbound action is opening the
// booking page when the visitor presses "Book a call with this plan".
// URL state: ?b=<business>&w=<workflow>&t=<tool,tool>. ?g=<guide slug> preselects that guide's workflows.
(() => {
  const dataEl = document.getElementById("plan-data");
  const app = document.getElementById("plan-app");
  if (!dataEl || !app) return;
  let D;
  try { D = JSON.parse(dataEl.textContent); } catch { return; }

  const byId = (list, id) => list.find((x) => x.id === id);
  const WF = D.workflows;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return el;
  }

  // ---------- state ----------
  const S = { b: "", w: "", t: new Set(), jobs: null, q: "" };
  const params = new URLSearchParams(location.search);
  const g = params.get("g");
  const w0 = byId(WF, params.get("w") || "");
  if (w0) {
    S.w = w0.id;
    const b = params.get("b");
    S.b = b && w0.businesses.includes(b) ? b : w0.businesses[0];
  } else if (g) {
    const list = WF.filter((x) => x.guide === g);
    if (list.length) {
      S.w = list[0].id;
      S.b = list[0].businesses[0];
      if (list.length > 1) S.jobs = list.map((x) => x.id);
    }
  }
  if (!S.b && byId(D.businesses, params.get("b") || "")) S.b = params.get("b");
  for (const t of (params.get("t") || "").split(",")) if (byId(D.tools, t)) S.t.add(t);

  // ---------- sentence matching ----------
  const STOP = new Set("a an the and or of to for in on at by with from my our we i me us is are be it its this that they them their our you your have has do does get got so too very just can cant can't dont don't not no all every each when what who how which about into than then there here out up keep always never really lot lots much more most some any still".split(" "));
  const stem = (w) => w.replace(/(ing|ers|er|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
  const toks = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((x) => x.length > 1 && !STOP.has(x)).map(stem).filter((x) => x.length > 1);
  const norm = (s) => " " + toks(s).join(" ") + " ";
  function match(q) {
    const qt = new Set(toks(q));
    if (!qt.size) return [];
    const qn = norm(q);
    // Search every workflow, nudging the ones for the chosen business up: owners don't always pick the "right" type.
    const scored = WF.map((x) => {
      let s = S.b && x.businesses.includes(S.b) ? 1 : 0;
      let hit = 0;
      for (const k of x.keywords) {
        const kn = norm(k);
        if (kn.trim() && qn.includes(kn)) hit += 4;
        else for (const t of toks(k)) if (qt.has(t)) hit += 1;
      }
      for (const t of new Set(toks(x.label + " " + x.summary))) if (qt.has(t)) hit += 0.5;
      return { x, s: hit ? s + hit : 0 };
    }).filter((r) => r.s >= 1.5);
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 3).map((r) => r.x);
  }

  // ---------- URL ----------
  // Ids are [a-z0-9-] only, so the query is written by hand to keep commas readable in shared links.
  const qs = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v).replace(/%2C/g, ",")).join("&");
  function query() {
    const s = qs({ b: S.b, w: S.w, t: [...S.t].join(",") });
    return s ? "?" + s : "";
  }
  function syncUrl() {
    try { history.replaceState(null, "", location.pathname + query() + location.hash); } catch {}
  }
  const shareUrl = () => location.origin + location.pathname + query();

  // ---------- clipboard ----------
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = h("textarea", { readonly: true, style: "position:fixed;left:-9999px;top:0" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }

  // ---------- layout ----------
  const live = h("p", { class: "pl-sr", role: "status", "aria-live": "polite" });
  const step1 = h("section", { class: "pl-step", "aria-labelledby": "pl-s1" });
  const step2 = h("section", { class: "pl-step", "aria-labelledby": "pl-s2" });
  const step3 = h("section", { class: "pl-step", "aria-labelledby": "pl-s3", tabindex: "-1" });
  const out = h("section", { class: "pl-plan", "aria-labelledby": "pl-title", tabindex: "-1" });
  app.textContent = "";
  app.append(step1, step2, step3, live);
  // The plan sits outside the builder wrapper so it still prints when the builder is hidden.
  app.after(out);
  let announce = "";

  function chip(label, pressed, onclick) {
    return h("li", null, h("button", { type: "button", class: "pl-chip", "aria-pressed": pressed ? "true" : "false", onclick }, label));
  }

  function renderStep1() {
    step1.replaceChildren(
      h("h2", { id: "pl-s1" }, "1. Your business"),
      h("ul", { class: "pl-chips", "aria-label": "Business type" }, D.businesses.map((b) => chip(b.label, S.b === b.id, () => {
        if (S.b === b.id) return;
        S.b = b.id; S.jobs = null;
        if (S.w && !byId(WF, S.w).businesses.includes(b.id)) S.w = "";
        announce = b.label + " selected. " + jobsFor().length + " workflows to choose from.";
        render();
        const first = step2.querySelector("button");
        if (first) first.focus();
      }))),
    );
  }

  function jobsFor() {
    if (S.jobs) return S.jobs.map((id) => byId(WF, id)).filter(Boolean);
    return S.b ? WF.filter((x) => x.businesses.includes(S.b)) : [];
  }

  function pickJob(id, how) {
    S.w = id;
    const x = byId(WF, id);
    if (!S.b || !x.businesses.includes(S.b)) S.b = x.businesses[0];
    announce = (how || "") + "Plan ready: " + x.label + ". Step 3, tools, is optional; the plan is below it.";
    render();
    step3.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  function renderStep2() {
    const kids = [h("h2", { id: "pl-s2" }, "2. The job that eats your week")];
    const jobs = jobsFor();
    if (jobs.length) {
      kids.push(h("ul", { class: "pl-chips", "aria-label": "Workflow" }, jobs.map((x) => chip(x.label, S.w === x.id, () => pickJob(x.id)))));
      if (S.jobs) kids.push(h("p", { class: "pl-hint" }, h("button", { type: "button", class: "pl-btn", onclick: () => { S.jobs = null; render(); } }, "Show every workflow for this business")));
    } else {
      kids.push(h("p", { class: "pl-hint" }, "Pick your business above to see its workflows, or describe the job below."));
    }
    const input = h("input", { id: "pl-q", type: "text", autocomplete: "off", placeholder: "For example: clients never send their bank statements on time" });
    input.value = S.q;
    const results = h("div", { "aria-live": "polite" });
    const find = () => {
      S.q = input.value.trim();
      results.replaceChildren();
      if (!S.q) return;
      const found = match(S.q);
      if (!found.length) {
        results.append(h("p", { class: "pl-hint" }, "No close match. Pick from the list above, or book a call and describe it in your own words."));
        return;
      }
      results.append(
        h("p", { class: "pl-hint" }, "Closest matches for “" + S.q + "”:"),
        h("ol", { class: "pl-matches" }, found.map((x, i) => h("li", null,
          h("button", { type: "button", class: "pl-chip", "aria-pressed": S.w === x.id ? "true" : "false", onclick: () => pickJob(x.id, "Closest match chosen. ") },
            h("span", { class: "pl-match-tag" }, i === 0 ? "Closest match:" : "Also close:"), x.label),
        ))),
      );
    };
    kids.push(
      h("label", { for: "pl-q", class: "pl-hint" }, "Or describe it in one sentence, in your own words:"),
      h("form", { class: "pl-row", onsubmit: (e) => { e.preventDefault(); find(); } },
        input,
        h("button", { type: "submit", class: "pl-btn" }, "Find matches"),
      ),
      results,
    );
    step2.replaceChildren(...kids);
    if (S.q) find();
  }

  function renderStep3() {
    const x = byId(WF, S.w);
    step3.hidden = !x;
    if (!x) { step3.replaceChildren(); return; }
    const ids = [...new Set(["gmail", "outlook", "sheets", "excel", ...x.tools])];
    step3.replaceChildren(
      h("h2", { id: "pl-s3" }, "3. Tools you use (optional)"),
      h("p", { class: "pl-hint" }, "Tick what you already use. The plan is built on these, in your own accounts."),
      h("ul", { class: "pl-chips", "aria-label": "Tools you use" }, ids.map((id) => byId(D.tools, id)).filter(Boolean).map((t) => chip(t.label, S.t.has(t.id), (e) => {
        if (S.t.has(t.id)) S.t.delete(t.id); else S.t.add(t.id);
        const on = S.t.has(t.id);
        e.currentTarget.setAttribute("aria-pressed", on ? "true" : "false");
        announce = t.label + (on ? " added to" : " removed from") + " your plan.";
        renderPlan();
        syncUrl();
        live.textContent = announce;
      }))),
    );
  }

  const toolLabel = (id) => (byId(D.tools, id) || { label: id }).label;
  const bizLabel = (id) => (byId(D.businesses, id) || { label: "" }).label;

  function summaryText(x) {
    const used = [...S.t].map(toolLabel);
    return "Plan from the Mike Automations plan builder: " + x.label + (S.b ? " (" + bizLabel(S.b) + ")" : "") + "." +
      (used.length ? " Tools: " + used.join(", ") + "." : "") + " Plan link: " + shareUrl();
  }

  function renderPlan() {
    const x = byId(WF, S.w);
    out.hidden = !x;
    if (!x) { out.replaceChildren(); return; }
    const offer = D.offer[x.offer] || D.offer.workflow;
    const mine = [...S.t].filter((t) => x.tools.includes(t));
    const others = x.tools.filter((t) => !S.t.has(t));
    const unknown = [...S.t].filter((t) => !x.tools.includes(t));
    const note = h("p", { class: "pl-note", role: "status", "aria-live": "polite" });
    const agreeHref = "/en/agreement/?" + qs({ w: x.id, b: S.b || x.businesses[0], t: [...S.t].join(",") });
    const auto = x.steps.filter((s) => s.by === "auto").length;
    const you = x.steps.length - auto;

    out.replaceChildren(
      h("p", { class: "pl-hint" }, "Your plan" + (S.b ? " for " + bizLabel(S.b).toLowerCase() : "")),
      h("h2", { id: "pl-title" }, x.label),
      h("p", null, x.summary),
      h("p", null, h("strong", null, "Starts when: "), x.trigger),

      h("div", null,
        h("h3", null, "The workflow, step by step"),
        h("p", { class: "pl-hint" }, (auto === 1 ? "1 step runs on its own. " : auto + " steps run on their own. ") + (you === 1 ? "1 stays" : you + " stay") + " with you or your team, marked “You approve”."),
        h("ol", { class: "pl-flow" }, x.steps.map((s) => h("li", { class: s.by === "you" ? "pl-you" : "pl-auto" },
          h("span", { class: "pl-by" }, s.by === "you" ? "You approve" : "Runs on its own"),
          s.text,
        ))),
      ),

      h("div", null,
        h("h3", null, "Your tools"),
        mine.length
          ? h("p", null, "Built on what you use: " + mine.map(toolLabel).join(", ") + ".")
          : h("p", null, "Built on the tools you already use. Tick yours in step 3 to see them here."),
        others.length ? h("p", { class: "pl-hint" }, "Also works with: " + others.map(toolLabel).join(", ") + ".") : null,
        unknown.length ? h("p", { class: "pl-hint" }, "How " + unknown.map(toolLabel).join(", ") + " fits in is checked on the call.") : null,
      ),

      h("div", null,
        h("h3", null, "What stays with you"),
        h("ul", null, x.stays.map((s) => h("li", null, s))),
        h("p", { class: "pl-hint" }, "If AI drafts anything, a person approves it before it reaches a customer."),
      ),

      h("div", null,
        h("h3", null, "Price and timing"),
        h("p", null, h("strong", null, offer.label + ": " + offer.price + ". "), offer.timing + "."),
        h("ul", null, D.offer.facts.map((f) => h("li", null, f))),
      ),

      h("div", null,
        h("h3", null, "What “working” means (draft)"),
        h("p", { class: "pl-hint" }, "You pay once these are true and you're happy with it. You can edit this list on the agreement page."),
        h("ul", { class: "pl-check" }, x.working.map((s) => h("li", null, s))),
      ),

      h("div", null,
        h("h3", null, "Read more"),
        h("ul", null,
          h("li", null, "Guide: ", h("a", { class: "underline", href: "/en/" + x.guide + "/" }, x.guideTitle)),
          x.reading.map((r) => h("li", null, h("a", { class: "underline", href: "/en/blog/" + r.slug + "/" }, r.title))),
        ),
      ),

      h("div", { class: "pl-actions" },
        h("button", { type: "button", class: "pl-btn pl-btn-primary", onclick: async () => {
          const text = summaryText(x);
          const copied = await copy(text);
          if (D.booking) {
            const url = D.booking + (D.booking.includes("?") ? "&" : "?") + "notes=" + encodeURIComponent(text);
            const win = window.open(url, "_blank");
            if (win) win.opener = null; else location.href = url;
            note.textContent = "The booking page opened with this plan in its notes field" + (copied ? ", and the summary is also copied to your clipboard" : "") + ". Nothing is sent until you confirm a time.";
          } else {
            note.textContent = copied ? "Plan summary copied. Paste it into your message on the contact page." : "Copy this plan link: " + shareUrl();
          }
        } }, "Book a call with this plan"),
        h("button", { type: "button", class: "pl-btn", onclick: async () => {
          note.textContent = (await copy(shareUrl())) ? "Link copied. Anyone who opens it sees this plan." : "Copy this link: " + shareUrl();
        } }, "Copy share link"),
        h("button", { type: "button", class: "pl-btn", onclick: () => window.print() }, "Print or save as PDF"),
        h("a", { class: "pl-btn", href: agreeHref }, "Turn it into an agreement"),
      ),
      note,
      h("p", { class: "pl-note" }, D.booking
        ? "Booking opens cal.com with the plan name, your business type, the tools you ticked and this plan's link in the notes. Nothing else is sent, and nothing at all until you press the button."
        : "Nothing is sent anywhere from this page."),
      h("p", { class: "pl-note" }, "This plan is drawn from the guide linked above. Timings are suggestions you can change. The fixed price and exact steps are confirmed in your written plan after the call."),
    );
  }

  function render() {
    renderStep1();
    renderStep2();
    renderStep3();
    renderPlan();
    syncUrl();
    if (announce) { live.textContent = announce; announce = ""; }
  }

  render();
  if (S.w) {
    live.textContent = "Plan loaded: " + byId(WF, S.w).label + ".";
  }
})();
