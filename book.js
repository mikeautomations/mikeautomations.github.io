// /en/book/ and /he/book/ (src/app/landing/book-page.tsx): free times from Michael's calendar, then the booking.
// Talks only to Michael's own Apps Script web app (apps-script/lead-booking.gs). No cookies, no other services.
(() => {
  const form = document.getElementById("bk-form");
  if (!form) return;
  const endpoint = form.dataset.endpoint;
  const lang = form.dataset.lang === "he" ? "he" : "en";
  const t = JSON.parse(form.dataset.i18n || "{}");
  const list = document.getElementById("bk-slot-list");
  const err = document.getElementById("bk-error");
  const done = document.getElementById("bk-done");
  const btn = form.querySelector("button[type=submit]");
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const SHOW_DAYS = 5;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function render(slots, tz) {
    list.textContent = "";
    if (!slots.length) { list.textContent = t.noSlots; return; }
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
    const days = new Map();
    for (const s of slots) {
      const d = new Date(s.start);
      const key = dayFmt.format(d);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push({ iso: s.start, time: timeFmt.format(d), label: key + ", " + timeFmt.format(d) });
    }
    let i = 0;
    const groups = [];
    for (const [day, times] of days) {
      const g = el("div", "bk-day");
      const id = "bk-d" + i;
      const h = el("h3", null, day); h.id = id;
      const row = el("div", "bk-times"); row.setAttribute("role", "radiogroup"); row.setAttribute("aria-labelledby", id);
      for (const s of times) {
        const lab = el("label");
        const r = el("input"); r.type = "radio"; r.name = "slot"; r.value = s.iso; r.dataset.label = s.label;
        lab.append(r, document.createTextNode(s.time));
        row.append(lab);
      }
      g.append(h, row);
      if (i >= SHOW_DAYS) g.hidden = true;
      groups.push(g);
      list.append(g);
      i++;
    }
    if (groups.length > SHOW_DAYS) {
      const more = el("button", "try-btn bk-more", lang === "he" ? "עוד ימים" : "More days");
      more.type = "button";
      more.addEventListener("click", () => { groups.forEach((g) => (g.hidden = false)); more.remove(); });
      list.append(more);
    }
  }

  if (endpoint) {
    fetch(endpoint + "?slots=1&lang=" + lang)
      .then((r) => r.json())
      .then((j) => { if (j && j.ok && Array.isArray(j.slots)) render(j.slots, j.tz); else render([], ""); })
      .catch(() => render([], ""));
  } else render([], "");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const v = (n) => ((form.elements[n] && form.elements[n].value) || "").trim();
    for (const f of [form.elements.name, form.elements.email, form.elements.phone]) {
      if (f && !f.checkValidity()) { f.reportValidity(); f.focus(); return; }
    }
    const picked = form.querySelector("input[name=slot]:checked");
    const payload = {
      name: v("name"), email: v("email"), phone: v("phone"), business: v("business"), pain: v("pain"),
      prefs: picked ? picked.dataset.label : v("prefs"), slot: picked ? picked.value : "",
      page: location.pathname, lang, website: v("website"),
    };
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = t.sending;
    let res = null;
    try {
      // text/plain: no CORS preflight; the script reads the JSON body itself.
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      res = await r.json().catch(() => null);
    } catch {}
    btn.disabled = false;
    btn.textContent = label;
    if (!res || res.ok !== true) {
      err.textContent = t.fail + " ";
      const a = el("a", "underline", lang === "he" ? "וואטסאפ" : form.dataset.fallback.replace(/^mailto:/, ""));
      a.href = form.dataset.fallback;
      err.append(a);
      return;
    }
    for (const fs of form.querySelectorAll("fieldset")) fs.hidden = true;
    done.hidden = false;
    done.textContent = res.booked ? t.okBooked.replace("{when}", picked ? picked.dataset.label : res.booked) : t.okNoSlot;
    done.setAttribute("tabindex", "-1");
    done.focus();
  });
})();
