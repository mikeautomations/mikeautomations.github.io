// /en/opening-hours-widget/ and /he/opening-hours-widget/ client logic. Progressive enhancement: without JS the
// page explains the badge. No dependencies, no requests to us, no storage.
// PART 1 is a copy of src/app/landing/data/tools/open-hours.ts with the types removed (made with the TypeScript
// compiler). tests/opening-hours-widget.test.ts checks both copies give identical results.
// PART 2 reads its texts (English or Hebrew) from <script id="oh-data">.
(function (root) {
  "use strict";

  // ---------- PART 1: pure functions (keep identical to open-hours.ts) ----------
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const toMin = (t) => (TIME.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : -1);
  const fromMin = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  /** Every open interval in minutes since Monday 00:00, wrapping past Sunday night. */
  function intervals(week) {
      const out = [];
      (week || []).slice(0, 7).forEach((d, i) => {
          if (!d || !d.open)
              return;
          for (const r of d.ranges || []) {
              const a = toMin(r.from), b = toMin(r.to);
              if (a < 0 || b < 0 || a === b)
                  continue;
              const start = i * 1440 + a, end = i * 1440 + (b > a ? b : b + 1440);
              out.push([start, end]);
          }
      });
      return out.sort((x, y) => x[0] - y[0]);
  }
  /**
   * Open or closed at `day` (0 = Monday) and `minute` (0-1439), and when that changes next: the time and the day.
   * minutesToChange is -1 when the business is never open (or never closes) in the week.
   */
  function status(week, day, minute) {
      const now = day * 1440 + minute, W = 10080;
      const iv = intervals(week);
      if (!iv.length)
          return { open: false, minutesToChange: -1, changeAt: "", changeDay: -1 };
      for (const [s, e] of iv) {
          for (const off of [0, -W]) {
              if (now >= s + off && now < e + off) {
                  const end = e + off;
                  // Joined ranges (one ends when the next starts) count as one.
                  let close = end;
                  for (const [s2, e2] of iv)
                      for (const o2 of [0, W, -W])
                          if (s2 + o2 === close)
                              close = e2 + o2;
                  if (close - now >= W)
                      return { open: true, minutesToChange: -1, changeAt: "", changeDay: -1 };
                  return { open: true, minutesToChange: close - now, changeAt: fromMin(((close % 1440) + 1440) % 1440), changeDay: Math.floor((((close % W) + W) % W) / 1440) };
              }
          }
      }
      let best = Infinity;
      for (const [s] of iv) {
          const d = s >= now ? s - now : s + W - now;
          if (d < best)
              best = d;
      }
      const at = now + best;
      return { open: false, minutesToChange: best, changeAt: fromMin(at % 1440), changeDay: Math.floor((at % W) / 1440) };
  }
  /** Days with the same hours grouped for a short table: [[first day, last day], "08:00-12:00, 13:00-18:00" | ""]. */
  function groupWeek(week) {
      const text = (d) => (!d || !d.open ? "" : (d.ranges || []).filter((r) => toMin(r.from) >= 0 && toMin(r.to) >= 0 && r.from !== r.to).map((r) => r.from + "-" + r.to).join(", "));
      const out = [];
      (week || []).slice(0, 7).forEach((d, i) => {
          const t = text(d);
          const last = out[out.length - 1];
          if (last && last.text === t && last.days[last.days.length - 1] === i - 1)
              last.days.push(i);
          else
              out.push({ days: [i], text: t });
      });
      return out;
  }
  /** The status function as it is written into the website code (plain ES5 so it runs in any browser). */
  const WIDGET_STATUS_SRC = "function st(I,day,m){var now=day*1440+m,W=10080,i,j,o,s,e,c,b=1e9;if(!I.length)return{o:0,t:-1};" +
      "for(i=0;i<I.length;i++){for(o=0;o>=-W;o-=W){s=I[i][0]+o;e=I[i][1]+o;if(now>=s&&now<e){c=e;" +
      "for(j=0;j<I.length;j++){if(I[j][0]===c||I[j][0]+W===c||I[j][0]-W===c){c=I[j][1]+(c-I[j][0]);}}" +
      "if(c-now>=W)return{o:1,t:-1};return{o:1,t:c-now,a:c};}}}" +
      "for(i=0;i<I.length;i++){s=I[i][0];var d=s>=now?s-now:s+W-now;if(d<b)b=d;}return{o:0,t:b,a:now+b};}";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  /** A self-contained snippet: a badge that says open or closed, and until when, in the business's time zone. */
  function widgetHtml(o) {
      const iv = intervals(o.week);
      const color = /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color : "#16a34a";
      const cfg = JSON.stringify({ i: iv, z: o.tz, l: o.labels, c: color }).replace(/</g, "\\u003c");
      const dir = o.lang === "he" ? ' dir="rtl"' : "";
      return `<div class="open-now"${dir} style="display:inline-flex;align-items:center;gap:8px;font:600 15px/1.3 system-ui,sans-serif;padding:8px 14px;border-radius:999px;background:#f4f6fb;color:#14213d"><span class="open-now-dot" style="width:10px;height:10px;border-radius:50%;background:#9aa3b2"></span><span class="open-now-text">${esc(o.labels.closed)}</span></div>
  <script>(function(){var C=${cfg};${WIDGET_STATUS_SRC}
  var p=new Intl.DateTimeFormat("en-GB",{timeZone:C.z,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),v={};
  p.forEach(function(x){v[x.type]=x.value});var day=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(v.weekday),m=(+v.hour)*60+(+v.minute);
  var r=st(C.i,day,m),el=document.currentScript.previousElementSibling,dot=el.querySelector(".open-now-dot"),tx=el.querySelector(".open-now-text");
  function hm(a){a=((a%1440)+1440)%1440;return ("0"+Math.floor(a/60)).slice(-2)+":"+("0"+a%60).slice(-2)}
  function when(a){var d=Math.floor((((a%10080)+10080)%10080)/1440);return d===day?"":(d===(day+1)%7?C.l.tomorrow:C.l.days[d])+" "}
  dot.style.background=r.o?C.c:"#dc2626";tx.textContent=r.o?C.l.open+(r.t>=0?" · "+C.l.closes+" "+when(r.a)+hm(r.a):""):C.l.closed+(r.t>=0?" · "+C.l.opens+" "+when(r.a)+hm(r.a):"");
  })();</script>`;
  }

  const API = { toMin, fromMin, intervals, status, groupWeek, WIDGET_STATUS_SRC, widgetHtml };
  root.OpenHours = API;

  // ---------- PART 2: the page ----------
  if (typeof document === "undefined") return;
  const app = document.getElementById("oh-app");
  const dataEl = document.getElementById("oh-data");
  if (!app || !dataEl) return;
  let DATA;
  try { DATA = JSON.parse(dataEl.textContent || ""); } catch (e) { return; }
  const UI = DATA.ui;
  const LANG = DATA.rtl ? "he" : "en";

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (cls, text) => { const b = el("button", cls, text); b.type = "button"; return b; };
  const time = (v, label) => { const i = el("input"); i.type = "time"; i.value = v; i.setAttribute("aria-label", label); return i; };

  let week = JSON.parse(JSON.stringify(DATA.week));
  let color = "#16a34a";

  // Day rows.
  const daysBox = el("div", "oh-days");
  function drawDays() {
    daysBox.textContent = "";
    week.forEach((d, i) => {
      const row = el("div", "oh-day");
      row.dataset.open = d.open ? "1" : "0";
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = d.open;
      const name = el("label", "oh-name");
      name.append(cb, document.createTextNode(UI.days[i]));
      cb.addEventListener("change", () => { d.open = cb.checked; if (d.open && !d.ranges.length) d.ranges.push({ from: "09:00", to: "17:00" }); drawDays(); render(); });
      const ranges = el("div", "oh-ranges");
      d.ranges.forEach((r, k) => {
        const rr = el("div", "oh-range");
        const a = time(r.from, UI.days[i] + " " + (k + 1) + " from"), b = time(r.to, UI.days[i] + " " + (k + 1) + " to");
        a.addEventListener("input", () => { r.from = a.value; render(); });
        b.addEventListener("input", () => { r.to = b.value; render(); });
        rr.append(a, el("span", null, "–"), b);
        if (k > 0) { const x = button("oh-link", "✕"); x.setAttribute("aria-label", UI.removeBreak); x.addEventListener("click", () => { d.ranges.splice(k, 1); drawDays(); render(); }); rr.append(x); }
        else rr.append(el("span"));
        ranges.append(rr);
      });
      if (d.ranges.length < 3) {
        const add = button("oh-link", UI.addBreak);
        add.addEventListener("click", () => {
          const last = d.ranges[d.ranges.length - 1];
          if (last) { const end = API.toMin(last.to); const mid = API.toMin(last.from) + 240; d.ranges.push({ from: API.fromMin(mid + 30), to: last.to }); last.to = API.fromMin(mid); if (end < 0) last.to = "12:00"; }
          drawDays(); render();
        });
        ranges.append(add);
      }
      ranges.append(el("span", "oh-closed", UI.closed));
      row.append(name, ranges);
      daysBox.append(row);
    });
  }
  const copyMon = button("try-btn gp-ghost ic-small", UI.copyMon);
  copyMon.addEventListener("click", () => { for (let i = 1; i < 5; i++) week[i] = JSON.parse(JSON.stringify(week[0])); drawDays(); render(); });

  // Options.
  const tzSel = el("select");
  tzSel.id = "oh-tz";
  const zones = UI.zones.slice();
  let local = "";
  try { local = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  if (local && !zones.some((z) => z[0] === local)) zones.unshift([local, local]);
  zones.forEach(([v, l]) => { const o = el("option", null, l); o.value = v; tzSel.append(o); });
  tzSel.value = DATA.tz;
  const tzLab = el("label", null, UI.tz);
  tzLab.htmlFor = "oh-tz";
  const tzW = el("div", "ft-field gp-field");
  tzW.append(tzLab, tzSel);
  const colIn = el("input", "oh-color");
  colIn.type = "color";
  colIn.value = color;
  colIn.id = "oh-col";
  const colLab = el("label", null, UI.color);
  colLab.htmlFor = "oh-col";
  const colW = el("div", "ft-field gp-field");
  colW.append(colLab, colIn);
  const opts = el("div", "oh-opts");
  opts.append(tzW, colW);
  tzSel.addEventListener("change", render);
  colIn.addEventListener("input", () => { color = colIn.value; render(); });

  const tryBtn = button("try-btn", UI.example);
  const formTop = el("div", "gp-form-top");
  const btns = el("div", "try-controls");
  btns.append(tryBtn);
  formTop.append(el("h2", "gp-h", UI.formTitle), btns);
  const form = el("div", "ft-box gp-form");
  form.append(formTop, daysBox, copyMon, opts);

  // Preview.
  const dot = el("span", "oh-dot");
  const txt = el("span");
  const badge = el("span", "oh-badge");
  badge.dir = DATA.rtl ? "rtl" : "ltr";
  badge.append(dot, txt);
  const nowNote = el("span", "oh-now");
  const stage = el("div", "oh-badge-stage");
  stage.setAttribute("aria-live", "polite");
  stage.append(nowNote, badge);
  const daySel = el("select");
  daySel.setAttribute("aria-label", UI.tryTime);
  const nowOpt = el("option", null, "—");
  nowOpt.value = "";
  daySel.append(nowOpt);
  UI.days.forEach((d, i) => { const o = el("option", null, d); o.value = String(i); daySel.append(o); });
  const timeIn = time("", UI.tryTime);
  const tryRow = el("div", "oh-try");
  tryRow.append(el("span", null, UI.tryTime + ":"), daySel, timeIn);
  daySel.addEventListener("change", render);
  timeIn.addEventListener("input", render);
  const table = el("table", "oh-table");
  const prev = el("section", "gp-card");
  prev.append(el("h2", "gp-h", UI.previewTitle), stage, tryRow, el("h3", "gp-h", UI.tableTitle), table);
  prev.lastChild.previousSibling.style.marginTop = "1.1rem";

  const code = el("textarea", "gp-code-box");
  code.readOnly = true; code.rows = 8; code.dir = "ltr"; code.spellcheck = false; code.setAttribute("aria-label", UI.codeTitle);
  const copyBtn = button("try-btn try-btn-primary", UI.copy);
  const statusEl = el("p", "gp-status");
  statusEl.setAttribute("role", "status");
  const row = el("div", "try-controls");
  row.append(copyBtn, statusEl);
  const codeCard = el("section", "gp-card gp-code");
  codeCard.append(el("h2", "gp-h", UI.codeTitle), el("p", "gp-hint", UI.codeHint), code, row);

  const side = el("div", "gp-side");
  side.append(prev, codeCard);
  const grid = el("div", "gp-grid");
  grid.append(form, side);
  app.textContent = "";
  app.append(grid);

  function nowIn(tz) {
    try {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const v = {};
      p.forEach((x) => { v[x.type] = x.value; });
      const dd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(v.weekday);
      return { day: dd, min: Number(v.hour) * 60 + Number(v.minute), label: (UI.days[dd] || v.weekday) + " " + v.hour + ":" + v.minute };
    } catch (e) { const d = new Date(); return { day: (d.getDay() + 6) % 7, min: d.getHours() * 60 + d.getMinutes(), label: "" }; }
  }
  function render() {
    const tz = tzSel.value;
    let day, min;
    if (daySel.value !== "" && API.toMin(timeIn.value) >= 0) { day = Number(daySel.value); min = API.toMin(timeIn.value); nowNote.textContent = UI.days[day] + " " + timeIn.value; }
    else { const n = nowIn(tz); day = n.day; min = n.min; nowNote.textContent = UI.previewNow + " " + n.label; }
    const s = API.status(week, day, min);
    const L = UI.badge;
    const when = (d) => (d === day ? "" : (d === (day + 1) % 7 ? L.tomorrow : L.days[d]) + " ");
    dot.style.background = s.open ? color : "#dc2626";
    txt.textContent = s.open ? L.open + (s.minutesToChange >= 0 ? " · " + L.closes + " " + when(s.changeDay) + s.changeAt : "") : L.closed + (s.minutesToChange >= 0 ? " · " + L.opens + " " + when(s.changeDay) + s.changeAt : "");
    table.textContent = "";
    API.groupWeek(week).forEach((g) => {
      const tr = el("tr");
      const name = g.days.length > 2 ? UI.days[g.days[0]] + " – " + UI.days[g.days[g.days.length - 1]] : g.days.map((i) => UI.days[i]).join(", ");
      tr.append(el("th", null, name), el("td", null, g.text || UI.closedDay));
      table.append(tr);
    });
    code.value = API.widgetHtml({ week, tz, lang: LANG, color, labels: UI.badge });
  }

  tryBtn.addEventListener("click", () => { week = JSON.parse(JSON.stringify(DATA.example.week)); tzSel.value = DATA.example.tz; drawDays(); render(); });
  copyBtn.addEventListener("click", () => {
    const done = () => { statusEl.textContent = UI.copied; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, () => {});
    else { code.select(); try { if (document.execCommand("copy")) done(); } catch (e) {} }
  });
  drawDays();
  render();
  setInterval(() => { if (daySel.value === "") render(); }, 30000);
})(typeof globalThis !== "undefined" ? globalThis : this);
