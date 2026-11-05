// Automation drawings for the landing page, plain canvas 2D, no libraries.
// 1. The page background (.flow-canvas): a quiet dotted grid with request chips drifting across.
// 2. The AI panel (.flow-panel): requests (WhatsApp, mail, website form, files) fly into an AI hub
//    that reads each one and sorts it into the right tray: leads, documents, quotes.
// Reduced motion keeps the background still; the panel plays (it has its own pause button).
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
  const FONT = '"IBM Plex Sans Hebrew", system-ui, sans-serif';
  const pick = () => KIND_LIST[Math.floor(Math.random() * KIND_LIST.length)];

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
    ctx.lineWidth = 1.6;
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

  function chip(ctx, kind, x, y, s, alpha) {
    const color = KINDS[kind].color;
    ctx.fillStyle = `rgba(16, 24, 48, ${0.88 * alpha})`;
    ctx.strokeStyle = `rgba(${color}, ${0.6 * alpha})`;
    ctx.lineWidth = 1;
    roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.26);
    ctx.fill();
    ctx.stroke();
    glyph(ctx, kind, x, y, s * 0.55, color, alpha);
  }

  /** A canvas that tracks its CSS size; returns its 2D context and current size. */
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

  // ---- 1. background ----
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
      for (let i = 0; i < grid.length; i += 2) {
        ctx.fillStyle = "rgba(150, 175, 230, 0.07)";
        ctx.fillRect(grid[i] - 1, ((grid[i + 1] - shift + s.h) % s.h) - 1, 2, 2);
      }
      for (const d of drifters) {
        d.x += d.vx * dt * d.depth;
        d.y += d.vy * dt;
        if (d.x < -40) { d.x = s.w + 40; d.y = Math.random() * s.h; d.kind = pick(); }
        const y = ((d.y - scrollY * 0.08 * d.depth) % (s.h + 80) + s.h + 80) % (s.h + 80) - 40;
        chip(ctx, d.kind, d.x, y, 22 + d.depth * 12, 0.22 * d.depth);
      }
    };
  }

  // ---- 2. the AI sorting panel ----
  function panel(canvas) {
    const box = canvas.parentElement;
    const s = surface(canvas, () => [box.clientWidth, box.clientHeight]);
    const { ctx } = s;
    const bins = [{ label: "תיק לקוח", n: 12 }, { label: "מסמכים", n: 31 }, { label: "הצעת מחיר", n: 7 }];
    const tokens = [], sparks = [];
    let pulse = 0, spin = 0, dash = 0, sinceSpawn = 0;
    addEventListener("resize", s.resize);

    const narrow = () => s.w < 560;
    const hub = () => (narrow() ? { x: s.w * 0.5, y: s.h * 0.4, r: 44 } : { x: s.w * 0.5, y: s.h * 0.46, r: 60 });
    // RTL reading: requests arrive from the right, sorted results leave to the left.
    const binPos = (i) => {
      if (narrow()) return { x: s.w * (0.8 - i * 0.3), y: s.h - 92, w: Math.min(104, s.w * 0.29), h: 40 };
      const h = hub();
      return { x: Math.max(100, h.x - h.r - 230), y: h.y + (i - 1) * 84, w: 160, h: 48 };
    };

    function spawn() {
      const h = hub();
      const x = narrow() ? s.w * (0.1 + Math.random() * 0.8) : s.w + 30;
      const y = narrow() ? -30 : s.h * (0.08 + Math.random() * 0.8);
      tokens.push({ kind: pick(), x0: x, y0: y, cx: (x + h.x) / 2 + (Math.random() - 0.5) * 160, cy: (y + h.y) / 2 + (Math.random() - 0.5) * 160, t: 0, dur: 1.8 + Math.random() * 0.9 });
    }

    function draw(dt) {
      ctx.clearRect(0, 0, s.w, s.h);
      const h = hub();

      // links hub → trays, with flowing dashes
      ctx.save();
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -dash;
      for (let i = 0; i < 3; i++) {
        const b = binPos(i);
        ctx.strokeStyle = `rgba(${ACCENT}, 0.35)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        const ex = narrow() ? b.x : b.x + b.w / 2;
        const ey = narrow() ? b.y - b.h / 2 : b.y;
        ctx.quadraticCurveTo(narrow() ? b.x : (h.x + ex) / 2, narrow() ? (h.y + ey) / 2 : ey, ex, ey);
        ctx.stroke();
      }
      ctx.restore();

      // incoming requests
      for (let i = tokens.length - 1; i >= 0; i--) {
        const k = tokens[i];
        k.t += dt / k.dur;
        if (k.t >= 1) { tokens.splice(i, 1); pulse = 1; sparks.push({ bin: KINDS[k.kind].bin, kind: k.kind, t: 0 }); continue; }
        const t = 1 - Math.pow(1 - k.t, 2), u = 1 - t;
        const x = u * u * k.x0 + 2 * u * t * k.cx + t * t * h.x;
        const y = u * u * k.y0 + 2 * u * t * k.cy + t * t * h.y;
        const fade = Math.min(1, k.t * 5) * (k.t > 0.85 ? (1 - k.t) / 0.15 : 1);
        const tt = Math.max(0, t - 0.14), uu = 1 - tt;
        ctx.strokeStyle = `rgba(${KINDS[k.kind].color}, ${0.3 * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(uu * uu * k.x0 + 2 * uu * tt * k.cx + tt * tt * h.x, uu * uu * k.y0 + 2 * uu * tt * k.cy + tt * tt * h.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        chip(ctx, k.kind, x, y, narrow() ? 30 : 36, fade);
      }

      // sorted results travelling to their tray
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.t += dt / 0.8;
        const b = binPos(sp.bin);
        if (sp.t >= 1) { bins[sp.bin].n++; bins[sp.bin].flash = 1; sparks.splice(i, 1); continue; }
        const ex = narrow() ? b.x : b.x + b.w / 2, ey = narrow() ? b.y - b.h / 2 : b.y;
        const cx = narrow() ? b.x : (h.x + ex) / 2, cy = narrow() ? (h.y + ey) / 2 : ey;
        const t = sp.t, u = 1 - t;
        const x = u * u * h.x + 2 * u * t * cx + t * t * ex;
        const y = u * u * h.y + 2 * u * t * cy + t * t * ey;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
        g.addColorStop(0, `rgba(${KINDS[sp.kind].color}, 0.95)`);
        g.addColorStop(1, `rgba(${KINDS[sp.kind].color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      }

      // trays
      ctx.textBaseline = "middle";
      for (let i = 0; i < 3; i++) {
        const b = binPos(i), bin = bins[i];
        bin.flash = Math.max(0, (bin.flash || 0) - dt * 1.6);
        ctx.fillStyle = "rgba(10, 16, 34, 0.9)";
        ctx.strokeStyle = `rgba(${ACCENT}, ${0.3 + bin.flash * 0.6})`;
        ctx.lineWidth = 1 + bin.flash;
        roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.direction = "rtl";
        ctx.textAlign = "right";
        ctx.font = `600 ${narrow() ? 12 : 14.5}px ${FONT}`;
        ctx.fillStyle = "rgba(243, 246, 255, 0.92)";
        ctx.fillText(bin.label, b.x + b.w / 2 - 12, b.y);
        ctx.direction = "ltr";
        ctx.textAlign = "left";
        ctx.font = `700 ${narrow() ? 12 : 14.5}px ${FONT}`;
        ctx.fillStyle = `rgba(${ACCENT}, 1)`;
        ctx.fillText(String(bin.n), b.x - b.w / 2 + 12, b.y);
      }

      // the AI hub
      pulse = Math.max(0, pulse - dt * 2);
      const glow = ctx.createRadialGradient(h.x, h.y, h.r * 0.4, h.x, h.y, h.r * (2.4 + pulse * 0.6));
      glow.addColorStop(0, `rgba(${ACCENT}, ${0.24 + pulse * 0.22})`);
      glow.addColorStop(1, `rgba(${ACCENT}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(8, 13, 28, 0.96)";
      ctx.strokeStyle = `rgba(${ACCENT}, 0.75)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(spin);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.45)`;
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.arc(0, 0, h.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.95)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, h.r + 12, 0, Math.PI * 0.35); ctx.stroke();
      ctx.restore();
      ctx.textAlign = "center";
      ctx.direction = "ltr";
      ctx.fillStyle = `rgba(${ACCENT}, 1)`;
      ctx.font = `700 ${narrow() ? 24 : 32}px ${FONT}`;
      ctx.fillText("AI", h.x, h.y - (narrow() ? 5 : 7));
      ctx.direction = "rtl";
      ctx.fillStyle = "rgba(170, 182, 210, 1)";
      ctx.font = `500 ${narrow() ? 10.5 : 12.5}px ${FONT}`;
      ctx.fillText("קורא וממיין", h.x, h.y + (narrow() ? 15 : 19));
    }

    let visible = false, paused = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
    const btn = box.querySelector(".as-flow-pause");
    if (btn) btn.addEventListener("click", () => {
      paused = !paused;
      btn.setAttribute("aria-pressed", String(paused));
      btn.textContent = paused ? "הפעל" : "השהה";
    });
    for (let i = 0; i < 3; i++) { spawn(); tokens[i].t = 0.15 + i * 0.25; }
    return (dt) => {
      if (!visible || paused) return;
      if (box.clientWidth !== s.w || box.clientHeight !== s.h) s.resize();
      spin += dt * 0.9;
      dash += dt * 22;
      sinceSpawn += dt;
      if (sinceSpawn > 0.7 && tokens.length < 9) { spawn(); sinceSpawn = 0; }
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
