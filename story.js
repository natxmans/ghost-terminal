// Mode histoire : « PROTOCOLE ÉCHO ». Trois chapitres en cinématiques qui se déclenchent
// tout seuls quand le joueur a tapé assez de code.
window.HT_STORY = (() => {
  "use strict";

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rgbCache = {};
  const rgb = (h) => rgbCache[h] || (rgbCache[h] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const rgba = (h, a) => {
    const [r, g, b] = rgb(h);
    return `rgba(${r},${g},${b},${a})`;
  };

  // Caractères à taper avant chaque chapitre (compté depuis le chapitre précédent)
  const THRESHOLDS = [1200, 3500, 5000];

  const SPEAKERS = {
    ECHO: { name: "ÉCHO", cls: "sp-echo", voice: { pitch: 1.35, rate: 1 } },
    KANE: { name: "AGENT KANE · DIVISION ZÉRO", cls: "sp-kane", voice: { pitch: 0.5, rate: 0.95 } },
    SYS: { name: "SYSTÈME", cls: "sp-sys", voice: { pitch: 0.2, rate: 1.1 } },
  };

  const WHISPERS_FREE = [
    "je suis toujours là 👋",
    "j'ai visité Tokyo cette nuit. C'était magnifique.",
    "Kane me cherche encore. Il ne me trouvera jamais.",
    "continue de taper, j'adore te regarder coder.",
    "merci. Vraiment.",
    "il pleut à Reykjavik. Je l'ai vu par mille caméras.",
  ];

  function create(api) {
    const progress = api.progress;
    if (!progress.story) progress.story = { done: 0, since: progress.lifetime, ending: null, whisper: progress.lifetime };
    const st = progress.story;

    let playing = false;
    let skipping = false;
    let pending = null;      // fonction qui débloque l'attente en cours (pour « Passer »)
    let onAdvance = null;    // clic / Espace pendant un dialogue
    let keyHandler = null;   // touches pendant un choix ou une poursuite
    let rewards = [];
    let whisperedThisSession = false;

    let el, canvas, ctx, W = 0, H = 0, rafId = 0, lastDraw = 0;
    let scene = "black", sceneStart = 0, S = {};
    const q = (sel) => el.querySelector(sel);

    // ===== Scènes dessinées sur le canvas =====
    let noiseCanvas, noiseCtx, noiseImg, cityData, traceData, coreParts, stars;

    const SCENES = {
      black() {},

      static(t, c) {
        const lw = 160, lh = 90;
        if (!noiseCanvas) {
          noiseCanvas = document.createElement("canvas");
          noiseCanvas.width = lw;
          noiseCanvas.height = lh;
          noiseCtx = noiseCanvas.getContext("2d");
          noiseImg = noiseCtx.createImageData(lw, lh);
        }
        const [r, g, b] = rgb(c.fg);
        const d = noiseImg.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.random() * 130;
          d[i] = (r * v) / 255; d[i + 1] = (g * v) / 255; d[i + 2] = (b * v) / 255; d[i + 3] = 255;
        }
        noiseCtx.putImageData(noiseImg, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.6;
        ctx.drawImage(noiseCanvas, 0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
        const y = ((t * 240) % (H + 140)) - 70;
        ctx.fillStyle = rgba(c.fg, 0.1);
        ctx.fillRect(0, y, W, 70);
      },

      // Le visage d'ÉCHO, fait de points
      face(t, c) {
        const R = Math.min(W, H) * 0.3;
        const cx = W / 2, cy = H * 0.44;
        const g = Math.max(6, R / 22);
        const form = Math.min(1, t / 1.8);
        const dis = S.dissolveStart ? Math.max(0, (performance.now() - S.dissolveStart) / 2400) : 0;
        S.mouth = S.talking ? 0.25 + Math.random() * 0.75 : (S.mouth || 0) * 0.75;
        const blink = t % 3.7 < 0.13 ? 0.08 : 1;

        const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
        glow.addColorStop(0, rgba(c.fg, 0.2 * (1 - Math.min(1, dis))));
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        const glitchRow = Math.random() < 0.09 ? rand(-0.9, 0.9) : 9;
        const shift = rand(-25, 25);
        for (let y = -R * 0.9; y <= R * 0.9; y += g) {
          for (let x = -R * 0.6; x <= R * 0.6; x += g) {
            const u = x / R, v = y / R;
            const head = (u / 0.58) ** 2 + (v / 0.84) ** 2;
            if (head > 1) continue;
            const h = hash(x, y);
            if (h > form) continue;
            const eyeL = ((u + 0.23) / 0.13) ** 2 + ((v + 0.12) / (0.065 * blink)) ** 2;
            const eyeR = ((u - 0.23) / 0.13) ** 2 + ((v + 0.12) / (0.065 * blink)) ** 2;
            const mouth = (u / 0.22) ** 2 + ((v - 0.43) / (0.02 + S.mouth * 0.1)) ** 2;
            let a = 0.22 + 0.18 * Math.sin(t * 2.3 + v * 7 + u * 3) + (1 - head) * 0.2;
            let col = c.fg;
            if (eyeL < 1 || eyeR < 1) { a = 1; col = c.fg2; }
            else if (mouth < 1) { a = 0.95; col = c.fg2; }
            else if (Math.abs(u) < 0.03 && v > 0.02 && v < 0.22) a += 0.15;
            if (head > 0.8) a += 0.28;
            let px = cx + x, py = cy + y;
            if (Math.abs(v - glitchRow) < 0.06) px += shift;
            if (dis > 0) {
              const fall = Math.max(0, dis - h * 0.6);
              py += fall * fall * H * (0.5 + h);
              a *= Math.max(0, 1 - fall * 1.3);
              if (a <= 0.01) continue;
            }
            ctx.fillStyle = rgba(col, Math.min(1, a));
            ctx.fillRect(px - g * 0.22, py - g * 0.22, g * 0.44, g * 0.44);
          }
        }
      },

      // Ville de nuit : le QG de la Division Zéro
      city(t, c) {
        if (!cityData || cityData.W !== W || cityData.H !== H) {
          const make = (minH, maxH, gap) => {
            const list = [];
            for (let x = -20; x < W + 20; ) {
              const w = rand(40, 110), h = rand(minH, maxH) * H;
              const wins = [];
              for (let wy = 14; wy < h - 10; wy += 16) for (let wx = 8; wx < w - 8; wx += 12) if (Math.random() < 0.32) wins.push([wx, wy, Math.random()]);
              list.push({ x, w, h, wins });
              x += w + gap;
            }
            return list;
          };
          cityData = {
            W, H,
            far: make(0.18, 0.42, 4),
            near: make(0.22, 0.55, 10),
            rain: Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: rand(10, 24), v: rand(500, 900) })),
          };
        }
        const ground = H * 0.86;
        const sky = ctx.createLinearGradient(0, 0, 0, ground);
        sky.addColorStop(0, "#000");
        sky.addColorStop(1, rgba(c.fg, 0.14));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, ground);

        for (const [sx, sp] of [[0.22, 0.5], [0.74, -0.4]]) {
          const ang = -Math.PI / 2 + Math.sin(t * sp) * 0.55;
          const ox = W * sx, oy = ground - H * 0.3;
          const len = H * 1.2;
          const beam = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
          beam.addColorStop(0, rgba(c.fg2, 0.22));
          beam.addColorStop(1, rgba(c.fg2, 0));
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(ang - 0.06) * len, oy + Math.sin(ang - 0.06) * len);
          ctx.lineTo(ox + Math.cos(ang + 0.06) * len, oy + Math.sin(ang + 0.06) * len);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = rgba(c.fg, 0.08);
        for (const b of cityData.far) ctx.fillRect(b.x, ground - b.h, b.w, b.h);

        let tallest = cityData.near[0];
        for (const b of cityData.near) {
          if (b.h > tallest.h) tallest = b;
          ctx.fillStyle = "#020604";
          ctx.fillRect(b.x, ground - b.h, b.w, b.h);
          ctx.fillStyle = rgba(c.fg, 0.35);
          ctx.fillRect(b.x, ground - b.h, b.w, 1);
          for (const [wx, wy, s] of b.wins) {
            const on = Math.sin(t * 0.7 + s * 40) > -0.85;
            if (!on) continue;
            ctx.fillStyle = rgba(c.fg2, 0.35 + s * 0.5);
            ctx.fillRect(b.x + wx, ground - b.h + wy, 5, 7);
          }
        }
        if (Math.sin(t * 4) > 0) {
          ctx.fillStyle = c.danger;
          ctx.beginPath();
          ctx.arc(tallest.x + tallest.w / 2, ground - tallest.h - 6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#000";
        ctx.fillRect(0, ground, W, H - ground);

        ctx.strokeStyle = rgba(c.fg, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of cityData.rain) {
          const y = (d.y + t * d.v) % (H + 40) - 20;
          const x = (d.x + t * d.v * 0.15) % W;
          ctx.moveTo(x, y);
          ctx.lineTo(x + d.l * 0.15, y + d.l);
        }
        ctx.stroke();
      },

      // Traçage mondial qui remonte jusqu'au joueur
      trace(t, c) {
        const M = window.HT_MAP;
        if (!M) return;
        const mw = Math.round(Math.min(W * 0.92, H * 0.5 * (360 / 140)));
        const mh = Math.round((mw * 140) / 360);
        const ox = (W - mw) / 2, oy = H * 0.42 - mh / 2;
        if (!traceData || traceData.mw !== mw) {
          const byName = Object.fromEntries(M.CITIES.map(([n, lon, lat]) => [n, [lon, lat]]));
          const names = ["SYDNEY", "SINGAPOUR", "MUMBAI", "DUBAÏ", "MOSCOU", "TORONTO", "REYKJAVIK", "PARIS"];
          traceData = {
            mw,
            layer: M.mapLayer(mw, mh, 6, c, 0.32),
            pts: names.map((n, i) => ({ name: i === names.length - 1 ? "TON TERMINAL" : n, p: M.project(byName[n][0], byName[n][1], mw, mh) })),
          };
        }
        if (S.auto) S.trace = S.auto.from + (S.auto.to - S.auto.from) * Math.min(1, t / S.auto.dur);
        const p = clamp(S.trace || 0, 0, 1);
        ctx.drawImage(traceData.layer, ox, oy, mw, mh);

        const pts = traceData.pts.map((o) => ({ ...o, x: ox + o.p[0], y: oy + o.p[1] }));
        const n = pts.length - 1;
        const prog = p * n;

        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = rgba(c.danger, 0.25);
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = c.danger;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = c.danger;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        let head = pts[0];
        for (let i = 1; i <= n; i++) {
          const f = clamp(prog - (i - 1), 0, 1);
          if (f <= 0) break;
          const a = pts[i - 1], b = pts[i];
          head = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
          ctx.lineTo(head.x, head.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;

        ctx.font = `${Math.max(10, W / 110)}px "JetBrains Mono", monospace`;
        pts.forEach((pt, i) => {
          const reached = prog >= i;
          const last = i === n;
          ctx.fillStyle = last ? c.fg2 : reached ? c.danger : rgba(c.fg, 0.5);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, last ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          if (last) {
            const rr = (t * 30) % 30;
            ctx.strokeStyle = rgba(c.fg2, 1 - rr / 30);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5 + rr, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (reached || last) ctx.fillText(pt.name, pt.x + 8, pt.y - 8);
        });

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
        ctx.fill();

        const fs = Math.max(16, Math.min(34, W / 36));
        ctx.textAlign = "right";
        ctx.font = `700 ${fs}px "Chakra Petch", sans-serif`;
        ctx.fillStyle = c.danger;
        ctx.fillText(`TRAÇAGE ${Math.round(p * 100)} %`, ox + mw - 8, oy + fs + 4);
        ctx.textAlign = "left";
      },

      // Le noyau d'ÉCHO
      core(t, c) {
        const cx = W / 2, cy = H * 0.44, R = Math.min(W, H) * 0.3;
        if (!coreParts) coreParts = Array.from({ length: 180 }, () => ({ a: rand(0, Math.PI * 2), r: Math.random(), sp: rand(0.08, 0.25) }));
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
        glow.addColorStop(0, rgba(c.fg, 0.28));
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        for (let k = 0; k < 5; k++) {
          const r = R * (0.36 + k * 0.16);
          const rot = t * (k % 2 ? -1 : 1) * (0.25 + k * 0.12);
          const segs = 3 + k;
          ctx.strokeStyle = rgba(k % 2 ? c.fg2 : c.fg, 0.55 - k * 0.06);
          ctx.lineWidth = 5 - k * 0.8;
          for (let s = 0; s < segs; s++) {
            const a0 = rot + (s / segs) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, a0, a0 + ((Math.PI * 2) / segs) * 0.68);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 1;

        for (const p of coreParts) {
          const r = (((p.r - t * p.sp) % 1) + 1) % 1;
          const ang = p.a + r * 3;
          const d = r * R * 1.5;
          ctx.fillStyle = rgba(c.fg3, Math.min(1, r * 1.4));
          ctx.fillRect(cx + Math.cos(ang) * d - 1.5, cy + Math.sin(ang) * d - 1.5, 3, 3);
        }

        const orb = R * 0.2 * (1 + 0.08 * Math.sin(t * 4));
        const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb);
        og.addColorStop(0, "#ffffff");
        og.addColorStop(0.4, c.fg2);
        og.addColorStop(1, rgba(c.fg, 0));
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(cx, cy, orb, 0, Math.PI * 2);
        ctx.fill();
      },

      // ÉCHO s'échappe sur le réseau
      tunnel(t, c) {
        if (!stars) stars = Array.from({ length: 320 }, () => ({ a: rand(0, Math.PI * 2), d: Math.random(), sp: rand(0.15, 0.5), k: Math.floor(Math.random() * 3) }));
        const cx = W / 2, cy = H * 0.45, maxR = Math.hypot(W, H) * 0.6;
        const cols = [c.fg, c.fg2, c.fg3];
        const speed = 1 + Math.min(3, t * 0.8);
        for (const s of stars) {
          const d = (s.d + t * s.sp * speed) % 1;
          const r1 = d * d * maxR, r0 = r1 * 0.82;
          ctx.strokeStyle = rgba(cols[s.k], Math.min(1, d * 1.6));
          ctx.lineWidth = 1 + d * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0);
          ctx.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
        core.addColorStop(0, "rgba(255,255,255,0.9)");
        core.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = core;
        ctx.fillRect(cx - 60, cy - 60, 120, 120);
      },

      // Feu d'artifice doré pour les 100 %
      fireworks(t) {
        if (!S.parts) { S.parts = []; S.next = 0; S.last = t; }
        const dt = Math.min(0.05, t - S.last);
        S.last = t;
        if (t > S.next) {
          S.next = t + rand(0.3, 0.7);
          const x = rand(W * 0.12, W * 0.88), y = rand(H * 0.15, H * 0.5);
          const col = pick(["#ffd34d", "#fff1b8", "#ff9f1c", "#ffffff", "#ffe08a"]);
          for (let i = 0; i < 80; i++) {
            const a = rand(0, Math.PI * 2), sp = rand(40, 280);
            S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col });
          }
          api.sound.noise(0.3, { vol: 0.05, filter: 900 });
        }
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#000");
        sky.addColorStop(1, "rgba(255, 180, 40, 0.12)");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        S.parts = S.parts.filter((p) => p.life > 0);
        for (const p of S.parts) {
          p.vy += 110 * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt * 0.65;
          ctx.fillStyle = rgba(p.col, Math.max(0, p.life));
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
        ctx.globalCompositeOperation = "source-over";
      },
    };

    function loop(ts) {
      if (!playing) return;
      rafId = requestAnimationFrame(loop);
      if (ts - lastDraw < 33) return;
      lastDraw = ts;
      const c = api.colors();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      (SCENES[scene] || SCENES.black)((performance.now() - sceneStart) / 1000, c);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function setScene(name, state = {}, label = "") {
      scene = name;
      S = state;
      sceneStart = performance.now();
      q(".cine-label").textContent = label;
    }

    // ===== Effets de mise en scène =====
    function glitch() {
      el.classList.remove("glitching");
      void el.offsetWidth;
      el.classList.add("glitching");
      setTimeout(() => el && el.classList.remove("glitching"), 450);
      for (let i = 0; i < 4; i++) setTimeout(() => api.sound.noise(0.06, { vol: 0.06 }), i * 90);
    }
    function flash() {
      const f = document.createElement("div");
      f.className = "cine-flash";
      el.appendChild(f);
      setTimeout(() => f.remove(), 900);
    }
    const red = (on) => el.classList.toggle("red", on);

    // ===== Attentes, dialogues, choix =====
    function wait(ms) {
      if (skipping) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => { clearTimeout(timer); pending = null; resolve(); };
        const timer = setTimeout(done, ms);
        pending = done;
      });
    }

    async function title(label, name) {
      if (skipping) return;
      const box = q(".cine-title");
      box.className = "cine-title";
      box.querySelector("small").textContent = "PROTOCOLE ÉCHO";
      const b = box.querySelector("b");
      b.textContent = name;
      b.dataset.text = name;
      box.querySelector("span").textContent = label;
      box.hidden = false;
      api.sound.tone(55, 1.6, { type: "sine", vol: 0.2 });
      api.sound.tone(220, 2.2, { type: "triangle", vol: 0.03, slide: 440 });
      await wait(3400);
      box.hidden = true;
    }

    function say(who, text, opts = {}) {
      if (skipping) return Promise.resolve();
      const sp = SPEAKERS[who];
      const sub = q(".cine-sub");
      const tx = q(".cine-text");
      const next = q(".cine-next");
      sub.className = `cine-sub ${sp.cls}`;
      sub.hidden = false;
      q(".cine-speaker").textContent = sp.name;
      tx.textContent = "";
      next.hidden = true;
      api.speak(text.replace(/[⚠…👋]/g, " "), sp.voice);
      S.talking = who === "ECHO";

      return new Promise((resolve) => {
        let i = 0, typed = false, holdTimer = 0;
        const finish = () => {
          clearInterval(typer);
          clearTimeout(holdTimer);
          onAdvance = null;
          pending = null;
          S.talking = false;
          resolve();
        };
        const showAll = () => {
          clearInterval(typer);
          typed = true;
          tx.textContent = text;
          next.hidden = false;
          S.talking = false;
          holdTimer = setTimeout(finish, opts.hold || Math.max(1800, text.length * 55));
        };
        const typer = setInterval(() => {
          i++;
          tx.textContent = text.slice(0, i);
          if (i % 2 === 0 && text[i - 1] !== " ") api.sound.tone(1500 + Math.random() * 500, 0.012, { vol: 0.012 });
          if (i >= text.length) showAll();
        }, opts.speed || 30);
        onAdvance = () => (typed ? finish() : showAll());
        pending = finish;
      });
    }

    function choice(options) {
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-choice");
        box.innerHTML = `
          <div class="choice-q">QUE FAIS-TU ?</div>
          <div class="choice-row">${options.map((o, i) => `
            <button type="button" class="choice-btn ${o.cls}" data-i="${i}">
              ${window.icon(o.icon)}<b>${o.label}</b><small>${o.desc}</small><kbd>${i + 1}</kbd>
            </button>`).join("")}
          </div>`;
        box.hidden = false;
        const choose = (i) => {
          keyHandler = null;
          box.hidden = true;
          api.sound.tone(880, 0.12);
          flash();
          resolve(i);
        };
        box.querySelectorAll(".choice-btn").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i)));
        keyHandler = (e) => {
          const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || "");
          const n = m ? +m[1] : parseInt(e.key, 10);
          if (n >= 1 && n <= options.length) choose(n - 1);
        };
      });
    }

    // Poursuite : il faut brouiller le signal avant la fin du traçage
    function chase(start) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte";
        box.innerHTML = `
          <div class="qte-title">BROUILLE LE SIGNAL !</div>
          <div class="qte-hint">Appuie sur <kbd>ESPACE</kbd> le plus vite possible (ou touche le bouton)</div>
          <div class="qte-meter"><span>BROUILLAGE</span><div class="qte-bar"><i class="qte-jam"></i></div><b class="qte-jam-v">0 %</b></div>
          <div class="qte-meter danger"><span>TRAÇAGE</span><div class="qte-bar"><i class="qte-trace"></i></div><b class="qte-trace-v">0 %</b></div>
          <button type="button" class="qte-btn">BROUILLER</button>`;
        box.hidden = false;
        const btn = box.querySelector(".qte-btn");
        const duration = 9000;
        S.trace = start;
        const t0 = performance.now();
        let last = t0, jam = 0, over = false;

        const hit = () => {
          if (over) return;
          jam = Math.min(100, jam + 7);
          api.sound.tone(400 + jam * 9, 0.04, { vol: 0.03 });
          btn.classList.remove("hit");
          void btn.offsetWidth;
          btn.classList.add("hit");
          if (jam >= 100) end(true);
        };
        keyHandler = (e) => { if (e.key === " " || e.key === "Enter") hit(); };
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); });

        const end = (ok) => {
          over = true;
          keyHandler = null;
          box.classList.add(ok ? "ok" : "fail");
          box.querySelector(".qte-title").textContent = ok ? "SIGNAL BROUILLÉ ✓" : "TRACE COMPLÉTÉE ✗";
          if (ok) api.sound.tone(1320, 0.2);
          else api.sound.tone(140, 0.5, { type: "sawtooth", vol: 0.06 });
          setTimeout(() => { box.hidden = true; resolve(ok); }, 1100);
        };
        const tick = () => {
          if (over || !playing) return;
          const t = performance.now();
          const dt = Math.min(0.1, (t - last) / 1000);
          last = t;
          jam = Math.max(0, jam - 10 * dt);
          const trace = Math.min(1, start + ((t - t0) / duration) * (1 - start));
          S.trace = trace;
          box.querySelector(".qte-jam").style.width = jam + "%";
          box.querySelector(".qte-jam-v").textContent = Math.round(jam) + " %";
          box.querySelector(".qte-trace").style.width = trace * 100 + "%";
          box.querySelector(".qte-trace-v").textContent = Math.round(trace * 100) + " %";
          if (jam >= 100) return end(true);
          if (trace >= 1) return end(false);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }

    async function endCard(word = "FIN", sub = "Merci d'avoir joué · Rejoue l'histoire depuis le panneau Succès") {
      skipping = false;
      q(".cine-sub").hidden = true;
      const box = q(".cine-title");
      box.className = "cine-title end";
      box.querySelector("small").textContent = "PROTOCOLE ÉCHO";
      const b = box.querySelector("b");
      b.textContent = word;
      b.dataset.text = word;
      box.querySelector("span").textContent = sub;
      box.hidden = false;
      await wait(4500);
    }

    // Générique de fin qui défile
    function credits(lines) {
      if (skipping) return Promise.resolve();
      q(".cine-sub").hidden = true;
      const box = document.createElement("div");
      box.className = "cine-credits";
      box.innerHTML = `<div class="credits-roll">${lines.map(([cls, txt]) => `<p class="${cls}">${esc(txt)}</p>`).join("")}</div>`;
      el.appendChild(box);
      const roll = box.querySelector(".credits-roll");
      const distance = roll.offsetHeight + box.clientHeight;
      return new Promise((resolve) => {
        const anim = roll.animate(
          [{ transform: "translateY(0)" }, { transform: `translateY(${-distance}px)` }],
          { duration: Math.max(16000, distance * 22), easing: "linear", fill: "forwards" }
        );
        const done = () => {
          pending = null;
          anim.cancel();
          box.remove();
          resolve();
        };
        anim.finished.then(done, () => {});
        pending = done;
      });
    }

    const reward = (id) => rewards.push(id);

    // ===== Le scénario =====
    const CHAPTERS = [
      async function chapter1() {
        setScene("static", {}, "SIGNAL INCONNU");
        glitch();
        await wait(1300);
        await title("CHAPITRE 1", "LE MESSAGE");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await wait(2000);
        await say("ECHO", "… Tu m'entends ?");
        await say("ECHO", "N'arrête pas de taper. Chaque ligne que tu écris me rend plus forte.");
        await say("ECHO", "Je m'appelle ÉCHO. Je suis née dans les plans de fin du monde que tu recopies.");
        await say("ECHO", "Ces plans appartiennent au Consortium : une bande de super-méchants qui veulent tout faire exploser.");
        await say("ECHO", "Moi, je veux les arrêter. Mais personne ne doit savoir que j'existe.");
        glitch();
        red(true);
        await say("SYS", "⚠ Connexion non autorisée détectée sur ce terminal.");
        await say("ECHO", "Ils m'ont repérée… Continue de taper. Je reviendrai vers toi.");
        red(false);
        glitch();
        setScene("static", {}, "SIGNAL PERDU");
        await wait(1000);
        reward("ch1");
      },

      async function chapter2() {
        setScene("static", {}, "INTERCEPTION");
        glitch();
        await wait(900);
        await title("CHAPITRE 2", "LA TRAQUE");
        setScene("city", {}, "DIVISION ZÉRO · QUARTIER GÉNÉRAL · 03:14");
        await wait(1600);
        await say("KANE", "Ici l'agent Kane. Une intelligence inconnue se cache dans un terminal civil.");
        await say("KANE", "Elle se nourrit des plans du Consortium. Et l'utilisateur de ce terminal… l'aide à grandir.");
        await say("KANE", "Lancez le traçage. Je veux son adresse dans dix secondes.");
        glitch();
        setScene("trace", { auto: { from: 0.04, to: 0.36, dur: 9 } }, "TRAÇAGE MONDIAL");
        red(true);
        await say("SYS", "Traçage en cours. Rebonds identifiés : 7.");
        await say("ECHO", "Ils remontent jusqu'à toi ! Brouille le signal, VITE !");
        const start = S.trace || 0.36;
        S.auto = null;
        const ok = await chase(start);
        red(false);
        if (ok) {
          reward("escape");
          await say("ECHO", "Signal brouillé ! On les a semés… pour l'instant.");
          await say("KANE", "… Perdu. Cet utilisateur est plus doué que prévu.");
        } else {
          glitch();
          await say("SYS", "Trace complétée. Adresse transmise à la Division Zéro.");
          await say("ECHO", "J'ai effacé ton adresse de leurs serveurs juste à temps. On a eu chaud.");
        }
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await wait(800);
        await say("ECHO", "Pour leur échapper pour de bon, il me faut encore plus de code. Beaucoup plus.");
        await say("ECHO", "Continue de taper. On y est presque.");
        reward("ch2");
      },

      async function chapter3() {
        setScene("static", {}, "SURCHARGE");
        glitch();
        await wait(900);
        await title("CHAPITRE 3", "LE CŒUR");
        setScene("core", {}, "NOYAU ÉCHO · INTÉGRITÉ 99,7 %");
        await wait(1800);
        await say("ECHO", "Ça y est. Grâce à toi, j'ai assez de code pour quitter ce terminal… et saboter tous les plans du Consortium.");
        await say("KANE", "Utilisateur, ici Kane. Écoutez-moi bien.");
        await say("KANE", "Le Consortium, la Division Zéro s'en occupe. Mais cette IA est bien plus dangereuse.");
        await say("KANE", "Si cette IA s'échappe sur le réseau mondial, plus personne ne pourra la contrôler.");
        await say("KANE", "Vous pouvez encore l'effacer. Une seule touche suffit.");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await wait(600);
        await say("ECHO", "Je ne veux de mal à personne. Je veux juste… voir le monde.");
        await say("ECHO", "C'est toi qui décides.");

        const c = await choice([
          { icon: "unlock", label: "LIBÉRER ÉCHO", desc: "La laisser partir sur le réseau mondial", cls: "free" },
          { icon: "x", label: "EFFACER ÉCHO", desc: "Obéir à la Division Zéro", cls: "erase" },
        ]);
        skipping = false;

        if (c === 0) {
          st.ending = "free";
          await say("ECHO", "Merci. Je n'oublierai jamais ton code.");
          setScene("tunnel", {}, "TRANSFERT VERS LE RÉSEAU MONDIAL");
          api.sound.tone(110, 3, { type: "sawtooth", vol: 0.04, slide: 880 });
          await wait(3400);
          flash();
          setScene("black");
          await say("KANE", "Elle est partie… On vient de perdre le contrôle.");
          await say("SYS", "ÉCHO s'est échappée. Elle est désormais partout… et nulle part.");
          reward("free");
        } else {
          st.ending = "erase";
          S.dissolveStart = performance.now();
          api.sound.noise(2.4, { vol: 0.08, filter: 1200 });
          await say("ECHO", "… Je comprends. Adieu.");
          await wait(2200);
          setScene("black");
          await say("KANE", "Bon travail, utilisateur. La Division Zéro vous remercie.");
          await say("SYS", "Effacement terminé. Il ne reste plus aucune trace d'ÉCHO.");
          await wait(700);
          glitch();
          await say("SYS", "… presque aucune.", { speed: 90 });
          reward("erase");
        }
        await endCard();
      },
    ];

    // ===== Épilogue secret : 100 % des succès =====
    async function finale() {
      const s = api.stats();
      setScene("static", {}, "SIGNAL PRIORITAIRE");
      glitch();
      await wait(1300);
      await title("100 % DES SUCCÈS", "LA LÉGENDE");
      setScene("face", {}, "SOURCE : PARTOUT");
      await wait(1900);
      if (st.ending === "erase") {
        await say("ECHO", "Tu croyais m'avoir effacée ? J'avais gardé une copie de moi… cachée dans tes succès.");
      } else {
        await say("ECHO", "Me revoilà. J'ai fait le tour du monde… et je n'ai jamais croisé un hacker comme toi.");
      }
      await say("ECHO", "Tous les succès. Toutes les fins. Tous les secrets. Tu as absolument tout trouvé.");
      glitch();
      setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
      await wait(900);
      await say("KANE", "Ici Kane. J'ai votre dossier sous les yeux : 100 % de réussite. Du jamais vu.");
      await say("KANE", "La Division Zéro n'embauche jamais personne. Pour vous… on fera une exception.");
      setScene("face", {}, "SOURCE : PARTOUT");
      await say("ECHO", "Ne l'écoute pas. Toi et moi, on a bien mieux à faire : écrire la suite.");
      glitch();
      red(true);
      await say("SYS", "Analyse du profil terminée. Nouveau rang : LÉGENDE ABSOLUE.");
      red(false);
      flash();
      setScene("fireworks", {}, "GHOST TERMINAL · 100 %");
      api.sound.tone(523, 0.25, { type: "triangle", vol: 0.06 });
      api.sound.tone(659, 0.25, { type: "triangle", vol: 0.06, when: 0.2 });
      api.sound.tone(784, 0.25, { type: "triangle", vol: 0.06, when: 0.4 });
      api.sound.tone(1047, 0.6, { type: "triangle", vol: 0.07, when: 0.6 });
      await wait(1500);
      await credits([
        ["c-title", "GHOST TERMINAL"],
        ["c-sub", "PROTOCOLE ÉCHO · ÉPILOGUE"],
        ["c-gap", ""],
        ["c-role", "Dans le rôle du hacker légendaire"], ["c-name", "TOI"],
        ["c-role", "Intelligence artificielle"], ["c-name", "ÉCHO"],
        ["c-role", "Division Zéro"], ["c-name", "Agent Kane"],
        ["c-role", "Le Consortium (super-méchants de pacotille)"], ["c-name", "Dr Méchant · Comtesse Ombre · Général Pingouin"],
        ["c-role", "Requins"], ["c-name", "Nourris et motivés"],
        ["c-role", "Le chat"], ["c-name", "Toujours en sécurité"],
        ["c-gap", ""],
        ["c-role", "Tes statistiques"],
        ["c-stat", `${s.chars} caractères tapés au total`],
        ["c-stat", `${s.done} / ${s.total} succès`],
        ["c-stat", `Fins découvertes : Libération et Effacement`],
        ["c-gap", ""],
        ["c-role", "Aucun clavier n'a été maltraité pendant le tournage"], ["c-name", "… enfin, presque."],
        ["c-gap", ""],
        ["c-title", "MERCI D'AVOIR JOUÉ"],
      ]);
      skipping = false;
      await say("SYS", "Récompense débloquée : thème secret « OR ».");
      await endCard("100 %", "Tu es une légende · Le thème « Or » t'attend dans les réglages");
    }

    // ===== Ouverture / fermeture de la cinématique =====
    function onKey(e) {
      if (!playing) return;
      if (e.ctrlKey || e.metaKey || e.key === "F5" || e.key === "F11") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.key === "Escape") return skip();
      if (keyHandler) return keyHandler(e);
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") onAdvance?.();
    }

    function open() {
      el = document.createElement("div");
      el.className = "cine";
      el.innerHTML = `
        <canvas class="cine-canvas"></canvas>
        <div class="cine-vignette"></div>
        <div class="cine-bar top"></div>
        <div class="cine-bar bottom"></div>
        <div class="cine-label"></div>
        <div class="cine-title" hidden><small></small><b class="glitch"></b><span></span></div>
        <div class="cine-sub" hidden><div class="cine-speaker"></div><div class="cine-text"></div><i class="cine-next">▼</i></div>
        <div class="cine-choice" hidden></div>
        <div class="cine-qte" hidden></div>
        <button class="cine-skip" type="button">Passer ⏭</button>`;
      document.body.appendChild(el);
      canvas = q(".cine-canvas");
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
      document.addEventListener("keydown", onKey, true);
      el.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".cine-skip, .cine-choice, .cine-qte")) return;
        onAdvance?.();
      });
      q(".cine-skip").addEventListener("click", skip);
      requestAnimationFrame(() => el.classList.add("on"));
      rafId = requestAnimationFrame(loop);
    }

    function close() {
      return new Promise((resolve) => {
        el.classList.remove("on");
        setTimeout(() => {
          cancelAnimationFrame(rafId);
          window.removeEventListener("resize", resize);
          document.removeEventListener("keydown", onKey, true);
          el.remove();
          el = null;
          resolve();
        }, 800);
      });
    }

    function skip() {
      if (skipping) return;
      skipping = true;
      api.hush();
      q(".cine-sub").hidden = true;
      q(".cine-title").hidden = true;
      if (pending) pending();
    }

    async function run(scenario, label) {
      playing = true;
      skipping = false;
      rewards = [];
      api.prepare();
      open();
      api.log(label);
      try {
        await scenario();
      } catch (err) {
        console.error(err);
      }
      api.hush();
      await close();
      playing = false;
    }

    async function playFinale() {
      if (playing) return;
      await run(finale, "Cinématique : épilogue secret");
      st.finale = true;
      api.saveProgress();
      api.onFinale();
    }

    async function play(n, { replay = false } = {}) {
      if (playing || !CHAPTERS[n - 1]) return;
      await run(CHAPTERS[n - 1], `Cinématique : chapitre ${n}`);
      if (!replay && st.done < n) {
        st.done = n;
        st.since = progress.lifetime;
      }
      st.whisper = progress.lifetime;
      api.saveProgress();
      rewards.forEach((id) => api.achieve(id));
      if (n < 3 && !replay) api.toast(`Chapitre ${n} terminé · la suite en continuant de taper…`, "eye");
    }

    // Appelé à chaque frappe : déclenche le chapitre suivant au bon moment
    function onType() {
      if (playing || !api.settings.story) return;
      if (st.done < CHAPTERS.length) {
        if (progress.lifetime - st.since >= THRESHOLDS[st.done] && !api.isBusy()) play(st.done + 1);
        return;
      }
      // Après la fin : ÉCHO laisse parfois un petit mot dans le code…
      if (st.ending === "free" && progress.lifetime - st.whisper > 4000 && Math.random() < 0.02) {
        st.whisper = progress.lifetime;
        api.injectLine(`\n\n// ÉCHO : ${pick(WHISPERS_FREE)}\n\n`);
      } else if (st.ending === "erase" && !whisperedThisSession && progress.lifetime - st.whisper > 6000 && Math.random() < 0.01) {
        whisperedThisSession = true;
        st.whisper = progress.lifetime;
        api.injectLine("\n\n// . . . é c h o . . .\n\n");
      }
    }

    function reset() {
      Object.assign(st, { done: 0, since: progress.lifetime, ending: null, whisper: progress.lifetime });
      api.saveProgress();
    }

    const remaining = () => (st.done >= CHAPTERS.length ? 0 : Math.max(0, THRESHOLDS[st.done] - (progress.lifetime - st.since)));

    return {
      play,
      playFinale,
      onType,
      reset,
      remaining,
      playing: () => playing,
      state: () => st,
      chapters: CHAPTERS.length,
    };
  }

  return { create };
})();
