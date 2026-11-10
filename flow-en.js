// English home page only (built as flow-en.js). Plain canvas 2D, no libraries.
// 1. The page background (.flow-canvas): the same quiet dotted grid with request chips drifting across.
// 2. The sorting panel (.flow-panel): requests (message, email, web form, file) travel to an AI hub that
//    visibly reads each one, then sends it as a comet to the right tray: client file, documents, letter.
// Reduced motion: both draw one still frame. The panel pauses off screen and has its own pause button.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ACCENT = "93, 240, 168";
  const KINDS = {
    wa: { color: "37, 211, 102", bin: 0 },
    form: { color: "180, 140, 255", bin: 0 },
    file: { color: "255, 210, 122", bin: 1 },
    mail: { color: "106, 168, 255", bin: 2 },
  };
  const KIND_LIST = ["wa", "mail", "form", "file", "wa", "mail"];
  const cfg = Object.assign({ bins: ["Client file", "Documents", "Letter"], hub: "Reads & sorts", pause: "Pause", play: "Play", dir: "ltr" }, JSON.parse(document.querySelector(".as")?.dataset.flow || "{}"));
  const LTR = cfg.dir !== "rtl";
  const FONT = '"Geist", system-ui, sans-serif';
  const pick = () => KIND_LIST[Math.floor(Math.random() * KIND_LIST.length)];
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const spring = (t) => 1 - Math.exp(-6 * t) * Math.cos(9 * t);

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glyph(ctx, kind, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (kind === "wa") {
      ctx.arc(0, -1, s * 0.42, 0.7, Math.PI * 2 + 0.3);
      ctx.lineTo(-s * 0.36, s * 0.42);
      ctx.closePath();
    } else if (kind === "mail") {
      ctx.rect(-s * 0.45, -s * 0.3, s * 0.9, s * 0.6);
      ctx.moveTo(-s * 0.45, -s * 0.3); ctx.lineTo(0, s * 0.06); ctx.lineTo(s * 0.45, -s * 0.3);
    } else if (kind === "form") {
      ctx.rect(-s * 0.36, -s * 0.44, s * 0.72, s * 0.88);
      for (const k of [-0.2, 0.02, 0.24]) { ctx.moveTo(-s * 0.2, s * k); ctx.lineTo(s * 0.2, s * k); }
    } else {
      ctx.moveTo(-s * 0.32, -s * 0.44); ctx.lineTo(s * 0.12, -s * 0.44); ctx.lineTo(s * 0.32, -s * 0.24);
      ctx.lineTo(s * 0.32, s * 0.44); ctx.lineTo(-s * 0.32, s * 0.44); ctx.closePath();
      ctx.moveTo(s * 0.12, -s * 0.44); ctx.lineTo(s * 0.12, -s * 0.24); ctx.lineTo(s * 0.32, -s * 0.24);
    }
    ctx.stroke();
    ctx.restore();
  }

  // A glass chip: dark body, a top highlight and the kind's colour on its edge.
  function chip(ctx, kind, x, y, s, alpha, lift = 0) {
    const color = KINDS[kind].color;
    const r = s * 0.28;
    roundRect(ctx, x - s / 2, y - s / 2 + 2 + lift, s, s, r);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * alpha})`;
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
    g.addColorStop(0, `rgba(34, 46, 84, ${0.96 * alpha})`);
    g.addColorStop(1, `rgba(12, 18, 40, ${0.96 * alpha})`);
    roundRect(ctx, x - s / 2, y - s / 2, s, s, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${color}, ${0.7 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s / 2 + r, y - s / 2 + 0.5); ctx.lineTo(x + s / 2 - r, y - s / 2 + 0.5);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * alpha})`;
    ctx.stroke();
    glyph(ctx, kind, x, y, s * 0.55, color, alpha);
  }

  function surface(canvas, sizeOf) {
    const ctx = canvas.getContext("2d");
    const s = { ctx, w: 0, h: 0 };
    s.resize = () => {
      const [w, h] = sizeOf();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      s.w = w; s.h = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    s.resize();
    return s;
  }

  // ---- 1. background (unchanged from the shared drawing) ----
  function background(canvas) {
    const s = surface(canvas, () => [innerWidth, innerHeight]);
    const { ctx } = s;
    let grid = [];
    const drifters = [];
    const layout = () => {
      grid = [];
      const step = s.w < 720 ? 40 : 52;
      for (let x = step / 2; x < s.w; x += step) for (let y = step / 2; y < s.h; y += step) grid.push(x, y);
      drifters.length = 0;
      const n = s.w < 720 ? 5 : 9;
      for (let i = 0; i < n; i++) drifters.push({ kind: pick(), x: Math.random() * s.w, y: Math.random() * s.h, vx: -(8 + Math.random() * 12), vy: (Math.random() - 0.5) * 6, depth: 0.4 + Math.random() * 0.6 });
    };
    layout();
    addEventListener("resize", () => { s.resize(); layout(); });
    return (dt) => {
      ctx.clearRect(0, 0, s.w, s.h);
      const shift = (scrollY * 0.15) % 52;
      ctx.fillStyle = "rgba(150, 175, 230, 0.07)";
      for (let i = 0; i < grid.length; i += 2) ctx.fillRect(grid[i] - 1, ((grid[i + 1] - shift + s.h) % s.h) - 1, 2, 2);
      for (const d of drifters) {
        d.x += d.vx * dt * d.depth;
        d.y += d.vy * dt;
        if (d.x < -40) { d.x = s.w + 40; d.y = Math.random() * s.h; d.kind = pick(); }
        const y = ((d.y - scrollY * 0.08 * d.depth) % (s.h + 80) + s.h + 80) % (s.h + 80) - 40;
        chip(ctx, d.kind, LTR ? s.w - d.x : d.x, y, 22 + d.depth * 12, 0.22 * d.depth);
      }
    };
  }

  // ---- 2. the sorting panel ----
  function panel(canvas) {
    const box = canvas.parentElement;
    const s = surface(canvas, () => [box.clientWidth, box.clientHeight]);
    const { ctx } = s;
    const bins = [{ label: cfg.bins[0], n: 12, flash: 0, bump: 0 }, { label: cfg.bins[1], n: 31, flash: 0, bump: 0 }, { label: cfg.bins[2], n: 7, flash: 0, bump: 0 }];
    const tokens = [], sparks = [], floats = [];
    let pulse = 0, spin = 0, dash = 0, sinceSpawn = 0, reading = null, time = 0;
    addEventListener("resize", s.resize);

    const narrow = () => s.w < 560;
    const hub = () => (narrow() ? { x: s.w * 0.5, y: s.h * 0.4, r: 46 } : { x: s.w * 0.5, y: s.h * 0.46, r: 62 });
    const mx = (x) => (LTR ? s.w - x : x);
    const binPos = (i) => {
      if (narrow()) return { x: mx(s.w * (0.8 - i * 0.3)), y: s.h - 92, w: Math.min(118, s.w * 0.29), h: 54 };
      const h = hub();
      return { x: mx(Math.max(100, h.x - h.r - 230)), y: h.y + (i - 1) * 84, w: 168, h: 50 };
    };
    const trayEnd = (b) => (narrow() ? { x: b.x, y: b.y - b.h / 2 } : { x: b.x + (LTR ? -b.w / 2 : b.w / 2), y: b.y });
    const curve = (p0, c, p1, t) => { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y }; };

    function spawn() {
      const h = hub();
      const x = narrow() ? s.w * (0.1 + Math.random() * 0.8) : mx(s.w + 30);
      const y = narrow() ? -30 : s.h * (0.08 + Math.random() * 0.8);
      tokens.push({ kind: pick(), p0: { x, y }, c: { x: (x + h.x) / 2 + (Math.random() - 0.5) * 180, y: (y + h.y) / 2 + (Math.random() - 0.5) * 180 }, t: 0, dur: 2 + Math.random() * 0.8, trail: [] });
    }

    function tray(b, bin, i) {
      const k = 1 + bin.bump * 0.06;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(k, k);
      roundRect(ctx, -b.w / 2, -b.h / 2 + 3, b.w, b.h, 14);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();
      const g = ctx.createLinearGradient(0, -b.h / 2, 0, b.h / 2);
      g.addColorStop(0, `rgba(30, 42, 78, 0.95)`);
      g.addColorStop(1, `rgba(12, 18, 40, 0.95)`);
      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 14);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(${ACCENT}, ${0.28 + bin.flash * 0.7})`;
      ctx.lineWidth = 1 + bin.flash;
      ctx.stroke();
      if (bin.flash > 0) {
        const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, b.w * 0.7);
        gl.addColorStop(0, `rgba(${ACCENT}, ${0.35 * bin.flash})`);
        gl.addColorStop(1, `rgba(${ACCENT}, 0)`);
        ctx.fillStyle = gl;
        ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(-b.w / 2 + 14, -b.h / 2 + 0.5); ctx.lineTo(b.w / 2 - 14, -b.h / 2 + 0.5);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)"; ctx.lineWidth = 1; ctx.stroke();
      // Narrow screens: label above the count; wide: label at the reading start, count at the end.
      const pad = narrow() ? 11 : 14, lx = LTR ? -b.w / 2 + pad : b.w / 2 - pad, cx = LTR ? b.w / 2 - pad : -b.w / 2 + pad;
      ctx.textBaseline = "middle";
      ctx.direction = cfg.dir;
      ctx.textAlign = LTR ? "left" : "right";
      ctx.font = `600 ${narrow() ? 11.5 : 14.5}px ${FONT}`;
      ctx.fillStyle = "rgba(243, 246, 255, 0.94)";
      ctx.fillText(bin.label, lx, narrow() ? -9 : 0);
      ctx.direction = "ltr";
      ctx.textAlign = narrow() ? (LTR ? "left" : "right") : (LTR ? "right" : "left");
      ctx.font = `700 ${narrow() ? 12.5 : 14.5}px ${FONT}`;
      ctx.fillStyle = `rgba(${ACCENT}, 1)`;
      ctx.fillText(String(bin.n), narrow() ? lx : cx, narrow() ? 10 : 0);
      ctx.restore();
    }

    function draw(dt) {
      ctx.clearRect(0, 0, s.w, s.h);
      const h = hub();

      // links hub → trays, dashes flowing outward
      ctx.save();
      ctx.setLineDash([3, 9]);
      ctx.lineDashOffset = -dash;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const b = binPos(i), e = trayEnd(b);
        ctx.strokeStyle = `rgba(${ACCENT}, ${0.22 + bins[i].flash * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.quadraticCurveTo(narrow() ? b.x : (h.x + e.x) / 2, narrow() ? (h.y + e.y) / 2 : e.y, e.x, e.y);
        ctx.stroke();
      }
      ctx.restore();

      // incoming requests, each with a short comet trail
      for (let i = tokens.length - 1; i >= 0; i--) {
        const k = tokens[i];
        k.t += dt / k.dur;
        if (k.t >= 1) { tokens.splice(i, 1); pulse = 1; reading = { kind: k.kind, t: 0 }; continue; }
        const t = easeOut(k.t);
        const p = curve(k.p0, k.c, h, t);
        k.trail.push(p.x, p.y);
        if (k.trail.length > 28) k.trail.splice(0, 2);
        const fade = Math.min(1, k.t * 5) * (k.t > 0.86 ? (1 - k.t) / 0.14 : 1);
        ctx.lineCap = "round";
        for (let j = 2; j < k.trail.length; j += 2) {
          const a = (j / k.trail.length) * 0.45 * fade;
          ctx.strokeStyle = `rgba(${KINDS[k.kind].color}, ${a})`;
          ctx.lineWidth = 1 + (j / k.trail.length) * 2.5;
          ctx.beginPath(); ctx.moveTo(k.trail[j - 2], k.trail[j - 1]); ctx.lineTo(k.trail[j], k.trail[j + 1]); ctx.stroke();
        }
        chip(ctx, k.kind, p.x, p.y, (narrow() ? 30 : 36) * (0.85 + 0.15 * (1 - k.t)), fade);
      }

      // the hub reads the request: its glyph shows inside for a moment, then a result leaves as a comet
      if (reading) {
        reading.t += dt / 0.55;
        if (reading.t >= 1) { sparks.push({ bin: KINDS[reading.kind].bin, kind: reading.kind, t: 0, trail: [] }); reading = null; }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.t += dt / 0.85;
        const b = binPos(sp.bin), e = trayEnd(b);
        if (sp.t >= 1) { bins[sp.bin].n++; bins[sp.bin].flash = 1; bins[sp.bin].bump = 1; floats.push({ x: b.x, y: b.y - b.h / 2, t: 0 }); sparks.splice(i, 1); continue; }
        const c = { x: narrow() ? b.x : (h.x + e.x) / 2, y: narrow() ? (h.y + e.y) / 2 : e.y };
        const p = curve(h, c, e, easeOut(sp.t));
        sp.trail.push(p.x, p.y);
        if (sp.trail.length > 24) sp.trail.splice(0, 2);
        ctx.lineCap = "round";
        for (let j = 2; j < sp.trail.length; j += 2) {
          ctx.strokeStyle = `rgba(${KINDS[sp.kind].color}, ${(j / sp.trail.length) * 0.7})`;
          ctx.lineWidth = 1 + (j / sp.trail.length) * 4;
          ctx.beginPath(); ctx.moveTo(sp.trail[j - 2], sp.trail[j - 1]); ctx.lineTo(sp.trail[j], sp.trail[j + 1]); ctx.stroke();
        }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
        g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        g.addColorStop(0.35, `rgba(${KINDS[sp.kind].color}, 0.9)`);
        g.addColorStop(1, `rgba(${KINDS[sp.kind].color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      }

      // trays, with a bump and a floating +1 when something lands
      for (let i = 0; i < 3; i++) {
        const bin = bins[i];
        bin.flash = Math.max(0, bin.flash - dt * 1.4);
        bin.bump = bin.bump > 0 ? Math.max(0, bin.bump - dt * 2.2) : 0;
        const b = binPos(i);
        const bump = bin.bump > 0 ? Math.sin(bin.bump * Math.PI) : 0;
        tray(b, { ...bin, bump }, i);
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.t += dt / 0.9;
        if (f.t >= 1) { floats.splice(i, 1); continue; }
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "ltr";
        ctx.font = `700 13px ${FONT}`;
        ctx.fillStyle = `rgba(${ACCENT}, ${1 - f.t})`;
        ctx.fillText("+1", f.x, f.y - 10 - easeOut(f.t) * 26);
      }

      // the hub: glow, glass disc, rotating ring, and the request it is reading
      pulse = Math.max(0, pulse - dt * 1.6);
      const glow = ctx.createRadialGradient(h.x, h.y, h.r * 0.5, h.x, h.y, h.r * (2.6 + pulse * 0.8));
      glow.addColorStop(0, `rgba(${ACCENT}, ${0.22 + pulse * 0.3})`);
      glow.addColorStop(1, `rgba(${ACCENT}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 3.4, 0, Math.PI * 2); ctx.fill();
      const disc = ctx.createRadialGradient(h.x - h.r * 0.3, h.y - h.r * 0.4, h.r * 0.2, h.x, h.y, h.r);
      disc.addColorStop(0, "rgba(30, 44, 82, 0.98)");
      disc.addColorStop(1, "rgba(6, 10, 24, 0.98)");
      ctx.fillStyle = disc;
      ctx.strokeStyle = `rgba(${ACCENT}, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1 + pulse * 0.04), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(spin);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.35)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.arc(0, 0, h.r + 13, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.95)`;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, h.r + 13, 0, Math.PI * (reading ? 0.9 : 0.35)); ctx.stroke();
      ctx.restore();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.direction = "ltr";
      if (reading) {
        // the request fills the hub while it is read; a scan line passes over it
        const a = Math.sin(reading.t * Math.PI);
        glyph(ctx, reading.kind, h.x, h.y - h.r * 0.22, h.r * 0.8, KINDS[reading.kind].color, a);
        const sy = h.y - h.r * 0.6 + reading.t * h.r * 1.2;
        const sg = ctx.createLinearGradient(h.x - h.r, 0, h.x + h.r, 0);
        sg.addColorStop(0, `rgba(${ACCENT}, 0)`); sg.addColorStop(0.5, `rgba(${ACCENT}, ${a})`); sg.addColorStop(1, `rgba(${ACCENT}, 0)`);
        ctx.strokeStyle = sg; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(h.x - h.r * 0.8, sy); ctx.lineTo(h.x + h.r * 0.8, sy); ctx.stroke();
        ctx.fillStyle = `rgba(${ACCENT}, ${1 - a})`;
      } else ctx.fillStyle = `rgba(${ACCENT}, 1)`;
      ctx.font = `700 ${narrow() ? 24 : 32}px ${FONT}`;
      ctx.fillText("AI", h.x, h.y - (narrow() ? 5 : 7));
      ctx.direction = cfg.dir;
      ctx.fillStyle = `rgba(170, 182, 210, ${reading ? 0.6 : 1})`;
      ctx.font = `500 ${narrow() ? 10.5 : 12.5}px ${FONT}`;
      ctx.fillText(cfg.hub, h.x, h.y + (narrow() ? 15 : 19));
    }

    let visible = false, paused = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
    const btn = box.querySelector(".as-flow-pause");
    if (btn) btn.addEventListener("click", () => {
      paused = !paused;
      btn.setAttribute("aria-pressed", String(paused));
      btn.textContent = paused ? cfg.play : cfg.pause;
    });
    for (let i = 0; i < 3; i++) { spawn(); tokens[i].t = 0.15 + i * 0.25; }
    if (still) { for (let i = 0; i < 3; i++) for (let j = 0; j < 20; j++) { const k = tokens[i]; k.trail.push(curve(k.p0, k.c, hub(), easeOut(k.t - 0.1 + j * 0.005)).x, curve(k.p0, k.c, hub(), easeOut(k.t - 0.1 + j * 0.005)).y); } draw(0); return () => {}; }
    return (dt) => {
      if (!visible || paused) return;
      if (box.clientWidth !== s.w || box.clientHeight !== s.h) s.resize();
      time += dt;
      spin += dt * 0.8;
      dash += dt * 24;
      sinceSpawn += dt;
      if (sinceSpawn > 0.75 && tokens.length < 8) { spawn(); sinceSpawn = 0; }
      draw(dt);
    };
  }

  const loops = [];
  const bg = document.querySelector(".flow-canvas");
  if (bg && bg.getContext) {
    const step = background(bg);
    if (still) step(0);
    else loops.push(step);
  }
  const pn = document.querySelector(".flow-panel");
  if (pn && pn.getContext) loops.push(panel(pn));
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const step of loops) step(dt);
  };
  requestAnimationFrame(frame);
})();
