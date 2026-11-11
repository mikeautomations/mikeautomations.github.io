
(() => {
  const waNumber = "972546980558";
  const lang = document.documentElement.lang.slice(0, 2) === "en" ? "en" : "he";
  const T = {"he":{"cta":"לקביעת שיחת מיפוי של 15 דקות","title":"שיחת מיפוי של 15 דקות","close":"סגירה","name":"שם","phone":"טלפון","email":"מייל","consent":"נשתמש בפרטים רק כדי לחזור אליכם על הפנייה הזו.","submit":"שליחה","sending":"שולח...","thanksTitle":"תודה, קיבלתי.","thanksBody":"אחזור אליכם תוך יום עסקים לתיאום השיחה.","thanksWhatsapp":"רוצים לזרז? שלחו לי הודעה בוואטסאפ","errorTitle":"השליחה לא הצליחה","errorBody":"אפשר לשלוח לי את הפרטים בוואטסאפ בלחיצה אחת:","errorWhatsapp":"שליחה בוואטסאפ","waGreeting":"היי מיכאל, השארתי פרטים באתר לשיחת מיפוי."},"en":{"cta":"Book a 15-minute call","title":"Book a 15-minute call","close":"Close","name":"Name","phone":"Phone","email":"Email","consent":"We'll only use this to get back to you about your request.","submit":"Send","sending":"Sending...","thanksTitle":"Got it. Thanks!","thanksBody":"I'll email you to find a time, usually the same working day.","thanksWhatsapp":"In a hurry? Email me","errorTitle":"That didn't go through","errorBody":"You can email me your details instead:","errorWhatsapp":"Email me","waGreeting":"Hi Michael, I left my details on your site for a 15-minute call."}}[lang];
  // The EN / עב switch remembers the choice; the Hebrew home page reopens in English for those who picked it.
  document.querySelectorAll("a[data-lang]").forEach((a) => a.addEventListener("click", () => { try { localStorage.setItem("site-lang", a.dataset.lang); } catch {} }));
  document.querySelectorAll("button.landing-cta").forEach((b) => {
    const d = b.nextElementSibling;
    if (d && d.tagName === "DIALOG") b.addEventListener("click", () => d.showModal());
  });
  document.querySelectorAll("dialog form button[type=button][aria-label]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  // Every submission is emailed to Michael through FormSubmit (free, no server needed).
  const endpoint = "https://script.google.com/macros/s/AKfycbwh8GhUq0JYhJmF-F_FXLD4jeKJQtCeXOL7AOQG6fAf1lKcs7pZz_xwYFyf3d_V5RJY/exec";
  const accessKey = "";
  const viaScript = true;
  document.querySelectorAll("dialog form").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = (n) => (f.elements[n] && f.elements[n].value || "").trim();
    if (v("website")) return;
    const btn = f.querySelector("button[type=submit]");
    const prefs = ["pref1", "pref2", "pref3"].map(v).filter(Boolean);
    const data = {
      ...(accessKey ? { access_key: accessKey, subject: "ליד חדש מהאתר: " + v("name"), from_name: "האתר של מייק אוטומציות", replyto: v("email"), botcheck: "" } : {}),
      _subject: "ליד חדש מהאתר: " + v("name"),
      _template: "table",
      _captcha: "false",
      "שם": v("name"),
      "טלפון": v("phone"),
      "מייל": v("email"),
      "עסק": v("business") || "-",
      "זמנים נוחים": prefs.join(" / ") || "-",
      "מה הכי גוזל זמן": v("pain") || "-",
      "שפה": lang,
      _replyto: v("email"),
    };
    btn.disabled = true; btn.textContent = T.sending;
    let ok = false;
    try {
      // Apps Script: text/plain avoids a CORS preflight; it reads the JSON body itself.
      const payload = viaScript
        ? { name: v("name"), phone: v("phone"), email: v("email"), business: v("business"), prefs: prefs.join(" / "), pain: v("pain"), page: location.pathname, lang, website: v("website") }
        : data;
      const r = await fetch(endpoint, viaScript
        ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }
        : { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      ok = r.ok && (viaScript ? j.ok === true : String(j.success) === "true");
    } catch {}
    const waText = [T.waGreeting, T.name + ": " + v("name"), T.phone + ": " + v("phone"), prefs.length && prefs.join(" / ")].filter(Boolean).join("\n");
    const wa = lang === "en"
      ? "mailto:" + "mikelgershman@gmail.com" + "?subject=" + encodeURIComponent("Call request: " + v("name")) + "&body=" + encodeURIComponent(waText)
      : "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(waText);
    const box = document.createElement("div");
    box.className = "flex flex-col gap-4";
    box.setAttribute("role", "status");
    const h = document.createElement("h2"); h.className = "text-xl font-bold"; h.id = "lead-form-title";
    const p = document.createElement("p");
    const a = document.createElement("a"); a.className = "btn justify-center"; a.href = wa; a.target = "_blank"; a.rel = "noopener noreferrer";
    const c = document.createElement("button"); c.type = "button"; c.className = "btn"; c.textContent = T.close;
    c.addEventListener("click", () => f.closest("dialog").close());
    if (ok) {
      h.textContent = T.thanksTitle;
      p.textContent = T.thanksBody;
      a.textContent = T.thanksWhatsapp;
    } else {
      h.textContent = T.errorTitle;
      p.textContent = T.errorBody;
      a.textContent = T.errorWhatsapp;
    }
    box.append(h, p, a, c);
    f.replaceWith(box);
  }));
})();
