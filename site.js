
(() => {
  const waNumber = "972546980558";
  document.querySelectorAll("button.landing-cta").forEach((b) => {
    const d = b.nextElementSibling;
    if (d && d.tagName === "DIALOG") b.addEventListener("click", () => d.showModal());
  });
  document.querySelectorAll("dialog button[aria-label='סגירה']").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
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
      _replyto: v("email"),
    };
    btn.disabled = true; btn.textContent = "שולח...";
    let ok = false;
    try {
      // Apps Script: text/plain avoids a CORS preflight; it reads the JSON body itself.
      const payload = viaScript
        ? { name: v("name"), phone: v("phone"), email: v("email"), business: v("business"), prefs: prefs.join(" / "), pain: v("pain"), page: location.pathname, website: v("website") }
        : data;
      const r = await fetch(endpoint, viaScript
        ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }
        : { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      ok = r.ok && (viaScript ? j.ok === true : String(j.success) === "true");
    } catch {}
    const waText = ["היי מיכאל, השארתי פרטים באתר לשיחת מיפוי.", "שם: " + v("name"), "טלפון: " + v("phone"), prefs.length && "זמנים נוחים: " + prefs.join(" / ")].filter(Boolean).join("\n");
    const wa = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(waText);
    const box = document.createElement("div");
    box.className = "flex flex-col gap-4";
    box.setAttribute("role", "status");
    const h = document.createElement("h2"); h.className = "text-xl font-bold"; h.id = "lead-form-title";
    const p = document.createElement("p");
    const a = document.createElement("a"); a.className = "btn justify-center"; a.href = wa; a.target = "_blank"; a.rel = "noopener noreferrer";
    const c = document.createElement("button"); c.type = "button"; c.className = "btn"; c.textContent = "סגירה";
    c.addEventListener("click", () => f.closest("dialog").close());
    if (ok) {
      h.textContent = "תודה, קיבלתי.";
      p.textContent = "אחזור אליכם תוך יום עסקים לתיאום השיחה.";
      a.textContent = "רוצים לזרז? שלחו לי הודעה בוואטסאפ";
    } else {
      h.textContent = "השליחה לא הצליחה";
      p.textContent = "אפשר לשלוח לי את הפרטים בוואטסאפ בלחיצה אחת:";
      a.textContent = "שליחה בוואטסאפ";
    }
    box.append(h, p, a, c);
    f.replaceWith(box);
  }));
})();
