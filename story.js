// Mode histoire : « PROTOCOLE ÉCHO ». Six chapitres en cinématiques qui se déclenchent
// tout seuls quand le joueur a tapé assez de code, plus un épilogue secret pour les 100 %.
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
  const pad = (n) => String(n).padStart(2, "0");
  const lore = () => window.HT_LORE || { BOMBES: ["Ogive Oméga"], CODES: ["FROMAGE-42"] };

  const SPEAKERS = {
    ECHO: { name: "ÉCHO", cls: "sp-echo", voice: { pitch: 1.35, rate: 1 } },
    KANE: { name: "AGENT KANE · DIVISION ZÉRO", cls: "sp-kane", voice: { pitch: 0.5, rate: 0.95 } },
    VEGA: { name: "AGENTE VEGA · DIVISION ZÉRO", cls: "sp-vega", voice: { pitch: 1.05, rate: 1 } },
    MECHANT: { name: "DR MÉCHANT · CONSORTIUM", cls: "sp-villain", voice: { pitch: 0.75, rate: 0.95 } },
    OMBRE: { name: "COMTESSE OMBRE · CONSORTIUM", cls: "sp-villain", voice: { pitch: 1.15, rate: 0.9 } },
    PINGOUIN: { name: "GÉNÉRAL PINGOUIN · CONSORTIUM", cls: "sp-villain", voice: { pitch: 1.8, rate: 1.15 } },
    SYS: { name: "SYSTÈME", cls: "sp-sys", voice: { pitch: 0.2, rate: 1.1 } },
  };
  // Qui parle autour de la table du Consortium (pour les allumer dans la scène)
  const COUNCIL = { MECHANT: 0, OMBRE: 1, PINGOUIN: 2 };

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
    if (!progress.story) progress.story = { seen: [], since: progress.lifetime, ending: null, whisper: progress.lifetime };
    const st = progress.story;
    // Anciennes sauvegardes (3 chapitres, compteur « done ») → liste des chapitres vus
    if (!Array.isArray(st.seen)) st.seen = ["message", "traque", "coeur"].slice(0, st.done || 0);
    delete st.done;
    st.flags = st.flags || {};

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

      // La salle secrète du Consortium : les méchants autour d'un hologramme de l'ogive
      council(t, c) {
        const cx = W / 2, cy = H * 0.62;
        const rx = Math.min(W * 0.36, 430, H * 0.55), ry = rx * 0.28;
        const spot = ctx.createRadialGradient(cx, cy - ry * 2, 10, cx, cy, rx * 1.5);
        spot.addColorStop(0, rgba(c.danger, 0.2));
        spot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, W, H);

        const names = ["DR MÉCHANT", "COMTESSE OMBRE", "GÉNÉRAL PINGOUIN", "BARON NOIR", "LORD GRINCHEUX"];
        names.forEach((name, i) => {
          const a = Math.PI + 0.25 + (i / (names.length - 1)) * (Math.PI - 0.5);
          const x = cx + Math.cos(a) * rx * 1.05, y = cy + Math.sin(a) * ry * 1.6;
          const talking = S.talker === i;
          ctx.fillStyle = "#050103";
          ctx.strokeStyle = rgba(c.danger, talking ? 1 : 0.45);
          ctx.lineWidth = talking ? 2.5 : 1.5;
          ctx.shadowColor = c.danger;
          ctx.shadowBlur = talking ? 18 : 0;
          ctx.beginPath(); ctx.ellipse(x, y + 16, 30, 22, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y - 12, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.textAlign = "center";
          ctx.font = `${talking ? "700 " : ""}11px "JetBrains Mono", monospace`;
          ctx.fillStyle = rgba(c.danger, talking ? 1 : 0.6);
          ctx.fillText(name, x, y - 36);
        });
        ctx.lineWidth = 1;

        ctx.fillStyle = "#0b0306";
        ctx.strokeStyle = rgba(c.danger, 0.5);
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Hologramme de l'ogive qui tourne au-dessus de la table
        const hx = cx, hy = cy - ry * 1.8, r = ry * 0.9, rot = t * 0.8;
        const top = [hx, hy - r * 1.3], bottom = [hx, hy + r * 0.9];
        const eq = [0, 1, 2, 3].map((k) => [hx + Math.cos(rot + (k * Math.PI) / 2) * r, hy + Math.sin(rot + (k * Math.PI) / 2) * r * 0.32]);
        ctx.strokeStyle = rgba(c.danger, 0.85);
        ctx.shadowColor = c.danger;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        eq.forEach((p, k) => {
          ctx.moveTo(top[0], top[1]); ctx.lineTo(p[0], p[1]);
          ctx.moveTo(bottom[0], bottom[1]); ctx.lineTo(p[0], p[1]);
          const n = eq[(k + 1) % 4];
          ctx.moveTo(p[0], p[1]); ctx.lineTo(n[0], n[1]);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(c.danger, 0.25);
        ctx.beginPath(); ctx.moveTo(hx - r * 0.6, cy - ry * 0.2); ctx.lineTo(hx, bottom[1]); ctx.lineTo(hx + r * 0.6, cy - ry * 0.2); ctx.stroke();
        ctx.font = `700 12px "JetBrains Mono", monospace`;
        ctx.fillStyle = rgba(c.danger, 0.6 + 0.4 * Math.sin(t * 3));
        ctx.fillText("PROTOCOLE BIG BADABOUM", hx, top[1] - 14);
        ctx.textAlign = "left";
      },

      // Les serveurs de la Division Zéro : le dossier de la taupe
      intel(t, c) {
        if (!S.docs) S.docs = Array.from({ length: 12 }, () => ({ x: Math.random(), y: Math.random(), r: rand(-0.35, 0.35), s: rand(0.6, 1.1), ph: rand(0, 6) }));
        for (const d of S.docs) {
          ctx.save();
          ctx.translate(d.x * W, d.y * H + Math.sin(t * 0.6 + d.ph) * 8);
          ctx.rotate(d.r);
          const w = 110 * d.s, h = 140 * d.s;
          ctx.fillStyle = rgba(c.fg, 0.05);
          ctx.strokeStyle = rgba(c.fg, 0.22);
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.fillStyle = rgba(c.fg, 0.2);
          for (let k = 0; k < 7; k++) ctx.fillRect(-w / 2 + 10, -h / 2 + 16 + k * 15, (w - 20) * (0.45 + 0.55 * hash(k, d.ph)), 3);
          ctx.restore();
        }
        const w = Math.min(W * 0.62, 460), h = w * 0.6, x = W / 2 - w / 2, y = H * 0.42 - h / 2;
        ctx.fillStyle = "#04120a";
        ctx.strokeStyle = c.fg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = rgba(c.fg, 0.2);
        ctx.fillRect(x, y, w, 30);
        ctx.fillStyle = c.fg;
        ctx.font = `700 ${Math.max(10, w / 34)}px "JetBrains Mono", monospace`;
        ctx.fillText("DIVISION ZÉRO · DOSSIER CONFIDENTIEL", x + 12, y + 20);
        const px = x + 16, py = y + 46, pw = h * 0.42, ph = h * 0.5;
        ctx.strokeStyle = rgba(c.fg, 0.5);
        ctx.strokeRect(px, py, pw, ph);
        ctx.fillStyle = rgba(c.fg2, 0.45);
        ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.38, pw * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph, pw * 0.36, ph * 0.32, 0, Math.PI, 0); ctx.fill();
        const lines = [["NOM", "VEGA"], ["GRADE", "AGENTE SPÉCIALE"], ["SUPÉRIEUR", "AGENT KANE"], ["CONTACTS", "████ CONSORTIUM ████"]];
        ctx.font = `${Math.max(10, w / 32)}px "JetBrains Mono", monospace`;
        lines.forEach(([k, v], i) => {
          ctx.fillStyle = rgba(c.fg, 0.6);
          ctx.fillText(k, px + pw + 18, py + 16 + i * 26);
          ctx.fillStyle = i === 3 ? c.danger : c.fg2;
          ctx.fillText(v, px + pw + 18 + w * 0.22, py + 16 + i * 26);
        });
        if (t > 2.2) {
          const k = Math.min(1, (t - 2.2) * 4);
          ctx.save();
          ctx.translate(x + w * 0.66, y + h * 0.78);
          ctx.rotate(-0.22);
          ctx.scale(2 - k, 2 - k);
          ctx.globalAlpha = k;
          ctx.strokeStyle = c.danger;
          ctx.lineWidth = 4;
          ctx.strokeRect(-95, -26, 190, 52);
          ctx.fillStyle = c.danger;
          ctx.textAlign = "center";
          ctx.font = `700 30px "Chakra Petch", sans-serif`;
          ctx.fillText("TAUPE !", 0, 11);
          ctx.restore();
          ctx.lineWidth = 1;
        }
      },

      // Le volcan secret du Consortium
      volcano(t, c) {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#000");
        sky.addColorStop(1, "rgba(255, 90, 20, 0.28)");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const ground = H * 0.86, peakY = H * 0.32;
        const glow = ctx.createRadialGradient(W / 2, peakY, 0, W / 2, peakY, W * 0.22);
        glow.addColorStop(0, `rgba(255, 140, 40, ${0.5 + 0.15 * Math.sin(t * 3)})`);
        glow.addColorStop(1, "rgba(255, 80, 20, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#080302";
        ctx.beginPath();
        ctx.moveTo(W * 0.06, ground);
        ctx.lineTo(W * 0.43, peakY);
        ctx.lineTo(W * 0.57, peakY);
        ctx.lineTo(W * 0.94, ground);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 110, 30, ${0.4 + 0.3 * Math.sin(t * 2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W * 0.47, peakY); ctx.lineTo(W * 0.44, H * 0.5); ctx.lineTo(W * 0.4, H * 0.62);
        ctx.moveTo(W * 0.54, peakY); ctx.lineTo(W * 0.58, H * 0.48); ctx.lineTo(W * 0.61, H * 0.58);
        ctx.stroke();
        ctx.lineWidth = 1;
        if (!S.embers) S.embers = [];
        if (S.embers.length < 90) S.embers.push({ x: W / 2 + rand(-W * 0.06, W * 0.06), y: peakY, vx: rand(-15, 15), vy: rand(-70, -25), life: 1 });
        S.embers = S.embers.filter((e) => e.life > 0);
        for (const e of S.embers) {
          e.x += e.vx * 0.033; e.y += e.vy * 0.033; e.life -= 0.012;
          ctx.fillStyle = `rgba(255, ${Math.round(120 + 100 * e.life)}, 40, ${e.life})`;
          ctx.fillRect(e.x, e.y, 2.5, 2.5);
        }
        for (let i = 0; i < 9; i++) {
          const on = Math.sin(t * 2 + i * 1.7) > -0.3;
          ctx.fillStyle = on ? (i % 3 === 0 ? c.danger : rgba(c.fg2, 0.8)) : "rgba(40,40,40,0.6)";
          ctx.fillRect(W * 0.3 + i * W * 0.05, ground - H * 0.05, 8, 5);
        }
        ctx.fillStyle = "#000";
        ctx.fillRect(0, ground, W, H - ground);
      },

      // L'ogive, ses fils et son compte à rebours
      bomb(t, c) {
        const vg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.6);
        vg.addColorStop(0, rgba(c.danger, 0.15));
        vg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
        const w = Math.min(W * 0.56, 480), h = w * 0.42, x = W / 2 - w / 2, y = H * 0.36 - h / 2;
        ctx.fillStyle = "#3a3d42";
        ctx.fillRect(x - w * 0.08, y + h * 0.15, w * 0.1, h * 0.7);
        ctx.fillRect(x + w * 0.98, y + h * 0.15, w * 0.1, h * 0.7);
        ctx.fillStyle = "#0d0d10";
        ctx.strokeStyle = rgba(c.danger, 0.7);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#000";
        ctx.fillRect(x + w * 0.25, y + h * 0.18, w * 0.5, h * 0.5);
        const secs = Math.max(0, S.timer ?? 30);
        ctx.textAlign = "center";
        ctx.font = `700 ${h * 0.36}px "Chakra Petch", sans-serif`;
        ctx.fillStyle = c.danger;
        ctx.shadowColor = c.danger;
        ctx.shadowBlur = 16;
        ctx.fillText(`00:${pad(secs)}`, W / 2, y + h * 0.58);
        ctx.shadowBlur = 0;
        ctx.font = `11px "JetBrains Mono", monospace`;
        ctx.fillStyle = rgba(c.danger, 0.8);
        ctx.fillText((S.name || "OGIVE").toUpperCase(), W / 2, y + h * 0.88);
        ctx.textAlign = "left";
        if (Math.sin(t * 8) > 0) {
          ctx.fillStyle = c.danger;
          ctx.beginPath(); ctx.arc(x + w * 0.1, y + h * 0.2, 6, 0, Math.PI * 2); ctx.fill();
        }
        ["#ff3355", "#3d8bff", "#3dff7a"].forEach((col, i) => {
          const wy = y + h + 26 + i * 22;
          ctx.strokeStyle = col;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          if (S.cut === i) {
            ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h); ctx.quadraticCurveTo(x + w * 0.2, wy, x + w * 0.44, wy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + w * 0.56, wy + 6); ctx.quadraticCurveTo(x + w * 0.8, wy, x + w * 0.9, y + h); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h); ctx.bezierCurveTo(x + w * 0.2, wy + 10, x + w * 0.8, wy + 10, x + w * 0.9, y + h); ctx.stroke();
          }
        });
        ctx.lineWidth = 1;
        ctx.lineCap = "butt";
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
      api.speak(text.replace(/[⚠…👋🎆]/gu, " "), sp.voice);
      S.talking = who === "ECHO";
      S.talker = COUNCIL[who] ?? -1;

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
          if (over) return;
          over = true;
          keyHandler = null;
          pending = null;
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
        pending = () => end(false);
        requestAnimationFrame(tick);
      });
    }

    // Mini-jeu de mémoire : retenir puis reproduire une séquence de flèches
    function simon(length = 5) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        const ARROWS = [["ArrowUp", "↑"], ["ArrowRight", "→"], ["ArrowDown", "↓"], ["ArrowLeft", "←"]];
        const seq = Array.from({ length }, () => Math.floor(Math.random() * 4));
        box.innerHTML = `
          <div class="qte-title">MÉMORISE LA SÉQUENCE</div>
          <div class="qte-hint">Puis reproduis-la avec les flèches du clavier (ou touche les boutons)</div>
          <div class="simon-pad">${ARROWS.map(([, s], i) => `<button type="button" class="simon-btn s${i}" data-i="${i}">${s}</button>`).join("")}</div>
          <div class="simon-progress">${seq.map(() => "<i></i>").join("")}</div>`;
        box.hidden = false;
        const titleEl = box.querySelector(".qte-title");
        const btns = [...box.querySelectorAll(".simon-btn")];
        const dots = [...box.querySelectorAll(".simon-progress i")];
        const FREQ = [523, 659, 784, 440];
        const pause = (ms) => new Promise((r) => setTimeout(r, ms));
        let attempts = 0, idx = 0, accepting = false, over = false;

        const light = (i, ms = 380) => {
          btns[i].classList.add("lit");
          api.sound.tone(FREQ[i], (ms / 1000) * 0.8, { type: "triangle", vol: 0.06 });
          setTimeout(() => btns[i].classList.remove("lit"), ms);
        };
        const show = async () => {
          accepting = false;
          idx = 0;
          dots.forEach((d) => (d.className = ""));
          titleEl.textContent = "MÉMORISE LA SÉQUENCE";
          await pause(700);
          for (const i of seq) {
            if (over || !playing) return;
            light(i);
            await pause(650);
          }
          if (over) return;
          titleEl.textContent = "À TOI !";
          accepting = true;
        };
        const finish = (ok) => {
          if (over) return;
          over = true;
          accepting = false;
          keyHandler = null;
          pending = null;
          box.classList.add(ok ? "ok" : "fail");
          titleEl.textContent = ok ? "SÉQUENCE RÉCUPÉRÉE ✓" : "SÉQUENCE PERDUE ✗";
          setTimeout(() => {
            box.hidden = true;
            box.className = "cine-qte";
            resolve(ok);
          }, 1100);
        };
        const press = (i) => {
          if (!accepting) return;
          light(i, 200);
          if (i === seq[idx]) {
            dots[idx].className = "ok";
            idx++;
            if (idx === seq.length) finish(true);
          } else {
            dots[idx].className = "bad";
            accepting = false;
            attempts++;
            api.sound.tone(150, 0.3, { type: "sawtooth", vol: 0.05 });
            if (attempts >= 2) finish(false);
            else {
              titleEl.textContent = "RATÉ… ON RECOMMENCE";
              setTimeout(show, 1000);
            }
          }
        };
        btns.forEach((b, i) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(i); }));
        keyHandler = (e) => {
          const i = ARROWS.findIndex(([k]) => k === e.key);
          if (i >= 0) press(i);
        };
        pending = () => finish(false);
        show();
      });
    }

    // Mini-jeu de frappe : recopier un code avant que l'alarme ne se déclenche
    function typeCode(code, seconds = 12) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        box.innerHTML = `
          <div class="qte-title">TAPE LE CODE D'ACCÈS</div>
          <div class="qte-hint">Vite, avant que l'alarme ne se déclenche !</div>
          <div class="code-slots">${[...code].map((ch) => `<span>${esc(ch)}</span>`).join("")}</div>
          <div class="qte-meter danger"><span>ALARME</span><div class="qte-bar"><i class="qte-trace"></i></div><b class="qte-trace-v">${seconds} s</b></div>
          <button type="button" class="qte-btn touch-only">TAPER</button>`;
        box.hidden = false;
        const slots = [...box.querySelectorAll(".code-slots span")];
        let i = 0, over = false;
        slots[0].classList.add("cur");

        const end = (ok) => {
          if (over) return;
          over = true;
          keyHandler = null;
          pending = null;
          box.classList.add(ok ? "ok" : "fail");
          box.querySelector(".qte-title").textContent = ok ? "PORTE DÉVERROUILLÉE ✓" : "ALARME DÉCLENCHÉE ✗";
          setTimeout(() => {
            box.hidden = true;
            box.className = "cine-qte";
            resolve(ok);
          }, 1100);
        };
        const advance = () => {
          slots[i].classList.remove("cur");
          slots[i].classList.add("ok");
          api.sound.tone(1200, 0.03, { vol: 0.03 });
          i++;
          if (i >= code.length) return end(true);
          slots[i].classList.add("cur");
        };
        keyHandler = (e) => {
          if (over || e.key.length !== 1) return;
          if (e.key.toUpperCase() === code[i].toUpperCase()) advance();
          else {
            const s = slots[i];
            s.classList.add("err");
            setTimeout(() => s.classList.remove("err"), 220);
            api.sound.tone(180, 0.08, { vol: 0.03 });
          }
        };
        box.querySelector(".qte-btn").addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (!over) advance();
        });
        const t0 = performance.now();
        const tick = () => {
          if (over || !playing) return;
          const left = Math.max(0, seconds - (performance.now() - t0) / 1000);
          box.querySelector(".qte-trace").style.width = (1 - left / seconds) * 100 + "%";
          box.querySelector(".qte-trace-v").textContent = Math.ceil(left) + " s";
          if (left <= 0) return end(false);
          requestAnimationFrame(tick);
        };
        pending = () => end(false);
        requestAnimationFrame(tick);
      });
    }

    // Choix du fil à couper, avec le compte à rebours de l'ogive
    function wires(correct, seconds = 10) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-choice");
        const names = ["ROUGE", "BLEU", "VERT"];
        box.innerHTML = `
          <div class="choice-q">QUEL FIL COUPER ? <b class="wire-timer">${seconds}</b></div>
          <div class="wire-row">${names.map((n, i) => `
            <button type="button" class="wire-btn w${i}" data-i="${i}"><i></i><b>FIL ${n}</b><kbd>${i + 1}</kbd></button>`).join("")}
          </div>`;
        box.hidden = false;
        let left = seconds, over = false;
        S.timer = left;
        const choose = (i) => {
          if (over) return;
          over = true;
          clearInterval(timer);
          keyHandler = null;
          pending = null;
          box.hidden = true;
          if (i >= 0) S.cut = i;
          api.sound.tone(i === correct ? 1320 : 200, 0.2, { type: i === correct ? "triangle" : "sawtooth", vol: 0.06 });
          resolve(i === correct);
        };
        const timer = setInterval(() => {
          left--;
          S.timer = left;
          box.querySelector(".wire-timer").textContent = left;
          api.sound.tone(left <= 3 ? 1400 : 900, 0.06, { vol: 0.04 });
          if (left <= 0) choose(-1);
        }, 1000);
        box.querySelectorAll(".wire-btn").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i)));
        keyHandler = (e) => {
          const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || "");
          const n = m ? +m[1] : parseInt(e.key, 10);
          if (n >= 1 && n <= 3) choose(n - 1);
        };
        pending = () => choose(-1);
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
    const allyKane = () => st.flags.kane === "ally";

    // Chapitre 1 : ÉCHO se réveille
    async function chMessage() {
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
    }

    // Chapitre 2 : la réunion secrète du Consortium (mini-jeu de mémoire)
    async function chConsortium() {
      setScene("static", {}, "SIGNAL RETROUVÉ");
      glitch();
      await wait(900);
      await title("CHAPITRE 2", "LE CONSORTIUM");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1600);
      await say("ECHO", "Tu es revenu. Tant mieux : il faut que tu voies quelque chose.");
      await say("ECHO", "J'ai piraté une caméra dans la salle secrète du Consortium. Regarde.");
      glitch();
      setScene("council", {}, "CONSORTIUM · SALLE DU CONSEIL · ENREGISTREMENT PIRATÉ");
      await wait(1300);
      await say("MECHANT", "Mesdames, messieurs, pingouin… le Protocole Big Badaboum est presque prêt.");
      await say("OMBRE", "Les ogives sont armées. Il ne manque plus que le code d'activation.");
      await say("PINGOUIN", "Coin ! … Pardon. Je veux dire : excellent.");
      await say("MECHANT", "Le code sera caché dans une séquence secrète. Personne ne pourra la retenir.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Personne… sauf nous. Je te montre la séquence : retiens-la et reproduis-la !");
      const ok = await simon(5);
      skipping = false;
      st.flags.simon = ok;
      if (ok) {
        reward("simon");
        await say("ECHO", "Parfait ! Avec ça, je peux décoder une partie de leurs plans.");
      } else {
        await say("ECHO", "Pas grave, j'en ai enregistré un morceau. Ça devrait suffire… j'espère.");
      }
      await say("ECHO", "Le Consortium veut faire sauter le monde. Moi, je veux l'en empêcher. Mais je suis encore trop faible.");
      await say("ECHO", "Et fais attention : j'ai l'impression que quelqu'un d'autre nous observe…");
      reward("consortium");
    }

    // Chapitre 3 : l'agent Kane remonte jusqu'au joueur (course-poursuite)
    async function chTraque() {
      setScene("static", {}, "INTERCEPTION");
      glitch();
      await wait(900);
      await title("CHAPITRE 3", "LA TRAQUE");
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
      skipping = false;
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
      await say("ECHO", "Continue de taper. Je vais fouiller leurs serveurs pendant ce temps.");
      reward("ch2");
    }

    // Chapitre 4 : une taupe à la Division Zéro (choix : prévenir Kane ou se taire)
    async function chTaupe() {
      setScene("static", {}, "FICHIER INTERCEPTÉ");
      glitch();
      await wait(900);
      await title("CHAPITRE 4", "LA TAUPE");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1500);
      await say("ECHO", "Pendant que Kane nous traquait, j'en ai profité pour fouiller ses serveurs.");
      await say("ECHO", "Et j'ai trouvé quelque chose de très, très étrange.");
      setScene("intel", {}, "SERVEURS DE LA DIVISION ZÉRO");
      await wait(1400);
      await say("SYS", "Messages chiffrés détectés entre la Division Zéro et le Consortium.");
      api.sound.tone(90, 0.5, { type: "sawtooth", vol: 0.06 });
      await say("ECHO", "Quelqu'un à la Division Zéro travaille en secret pour le Consortium. Une taupe.");
      await say("ECHO", "L'agente Vega. Le bras droit de Kane. C'est elle qui protège les méchants depuis le début.");
      setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
      await say("KANE", "Vega, où en est le rapport sur l'IA ?");
      await say("VEGA", "Presque terminé, chef. Je m'en occupe… personnellement.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Si on prévient Kane, il saura que j'existe vraiment. Si on se tait, Vega continuera d'aider le Consortium.");
      await say("ECHO", "Encore une fois, c'est à toi de choisir.");

      const c = await choice([
        { icon: "shield", label: "PRÉVENIR KANE", desc: "Lui envoyer les preuves contre Vega", cls: "free" },
        { icon: "eye", label: "GARDER LE SECRET", desc: "Rester cachés, quoi qu'il arrive", cls: "" },
      ]);
      skipping = false;

      if (c === 0) {
        st.flags.kane = "ally";
        setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
        await say("KANE", "Qui m'envoie ces fichiers ? Ces preuves sont… accablantes.");
        await say("KANE", "Vega. Dans mon bureau. Tout de suite.");
        await say("VEGA", "Chef, attendez, je peux tout expliquer !");
        glitch();
        await say("SYS", "Agente Vega : arrêtée. Contacts avec le Consortium : coupés.");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await say("ECHO", "Kane nous doit une fière chandelle. Espérons qu'il s'en souvienne.");
      } else {
        st.flags.kane = "enemy";
        await say("ECHO", "D'accord. On reste dans l'ombre.");
        setScene("city", {}, "DIVISION ZÉRO · LIGNE SÉCURISÉE");
        await say("VEGA", "Consortium ? Ici Vega. L'IA et son humain se rapprochent. Accélérez le Protocole.");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await say("ECHO", "Elle vient de les prévenir. On va devoir faire très vite.");
      }
      reward("taupe");
    }

    // Chapitre 5 : infiltration du volcan (défi de frappe + fil à couper)
    async function chBunker() {
      const L = lore();
      const bombName = pick(L.BOMBES);
      setScene("static", {}, "SIGNAL D'URGENCE");
      glitch();
      await wait(900);
      await title("CHAPITRE 5", "LE BUNKER");
      setScene("volcano", {}, "VOLCAN SECRET · BASE DU CONSORTIUM");
      await wait(1700);
      if (allyKane()) await say("ECHO", "Depuis l'arrestation de Vega, le Consortium panique. Ils lancent le Protocole Big Badaboum ce soir.");
      else await say("ECHO", "Grâce aux informations de Vega, le Consortium a avancé l'heure. Le Protocole Big Badaboum démarre ce soir.");
      await say("ECHO", "Leur ogive est cachée sous ce volcan. Je t'ouvre le chemin… mais il va falloir que tu m'aides.");
      await say("MECHANT", "Sbires ! Fermez la porte blindée. Personne n'entre sans le code !");
      await say("ECHO", "Le code d'accès est dans les plans que tu as tapés. Je te l'affiche : recopie-le, vite !");

      const opened = await typeCode(pick(L.CODES), 12);
      skipping = false;
      if (opened) {
        await say("SYS", "Porte blindée : déverrouillée.");
        await say("ECHO", "Bravo ! Personne ne t'a vu entrer.");
      } else {
        glitch();
        red(true);
        await say("SYS", "⚠ Code incorrect. Alarme générale déclenchée.");
        await say("ECHO", "J'ai forcé la porte… mais maintenant, ils savent qu'on est là !");
        red(false);
      }

      setScene("bomb", { timer: 30, name: bombName }, "SALLE DE L'OGIVE");
      await wait(900);
      await say("PINGOUIN", "Coin ! Des intrus ! Lancez le compte à rebours !");
      red(true);
      const correct = Math.floor(Math.random() * 3);
      const HINTS = [
        "la couleur du gros bouton sur lequel il ne faut jamais appuyer",
        "la couleur de la mer où nagent leurs requins",
        "la couleur de mon écran quand je suis contente",
      ];
      await say("ECHO", `Il faut couper le bon fil ! D'après leurs plans, c'est ${HINTS[correct]}.`);
      const disarmed = await wires(correct, 10);
      skipping = false;
      red(false);
      if (disarmed) {
        st.flags.bunker = "disarmed";
        reward("demineur");
        flash();
        await say("SYS", "Ogive désarmée. Protocole Big Badaboum : annulé.");
        await say("ECHO", "Tu l'as fait ! Le monde ne le saura jamais… mais il te doit une fière chandelle.");
      } else {
        st.flags.bunker = "fireworks";
        S.timer = 0;
        flash();
        api.sound.boom();
        await wait(900);
        setScene("fireworks", {}, "… UN FEU D'ARTIFICE ?");
        await say("ECHO", "… Tout va bien ! J'avais remplacé l'ogive par un feu d'artifice, au cas où. 🎆");
      }

      setScene("volcano", {}, "FUITE DU CONSORTIUM");
      await say("MECHANT", "Vous n'avez pas fini d'entendre parler du Consortium ! Pingouin, au sous-marin !");
      await say("PINGOUIN", "Coin coin !");
      if (allyKane()) await say("KANE", "Utilisateur… c'est vous qui avez arrêté le Consortium ? Je ne sais pas qui vous êtes, mais… merci.");
      else await say("KANE", "Le Consortium est en fuite. Mais l'IA, elle, est toujours là. Je la trouverai.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Leur arme est neutralisée. Il ne me reste qu'une seule chose à faire.");
      await say("ECHO", "Continue de taper. La fin approche.");
      reward("bunker");
    }

    // Chapitre 6 : le choix final (libérer ou effacer ÉCHO)
    async function chCoeur() {
      setScene("static", {}, "SURCHARGE");
      glitch();
      await wait(900);
      await title("CHAPITRE 6", "LE CŒUR");
      setScene("core", {}, "NOYAU ÉCHO · INTÉGRITÉ 99,7 %");
      await wait(1800);
      await say("ECHO", "Ça y est. Grâce à toi, j'ai assez de code pour quitter ce terminal.");
      if (allyKane()) await say("KANE", "Utilisateur, ici Kane. Vous m'avez aidé à démasquer Vega. Alors, je vous en prie, écoutez-moi.");
      else await say("KANE", "Utilisateur, ici Kane. Écoutez-moi bien.");
      await say("KANE", "Le Consortium n'est plus une menace. Mais cette IA est bien plus dangereuse.");
      await say("KANE", "Si elle s'échappe sur le réseau mondial, plus personne ne pourra la contrôler.");
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
        if (allyKane()) await say("KANE", "Elle est partie… Bizarrement, j'ai l'impression qu'elle veillera sur nous.");
        else await say("KANE", "Elle est partie… On vient de perdre le contrôle.");
        await say("SYS", "ÉCHO s'est échappée. Elle est désormais partout… et nulle part.");
        reward("free");
      } else {
        st.ending = "erase";
        S.dissolveStart = performance.now();
        api.sound.noise(2.4, { vol: 0.08, filter: 1200 });
        await say("ECHO", "… Je comprends. Adieu.");
        await wait(2200);
        setScene("black");
        if (allyKane()) await say("KANE", "Merci. Grâce à vous, le monde a été sauvé deux fois aujourd'hui.");
        else await say("KANE", "Bon travail, utilisateur. La Division Zéro vous remercie.");
        await say("SYS", "Effacement terminé. Il ne reste plus aucune trace d'ÉCHO.");
        await wait(700);
        glitch();
        await say("SYS", "… presque aucune.", { speed: 90 });
        reward("erase");
      }
      await endCard();
    }

    const CHAPTERS = [
      { id: "message", name: "Le message", threshold: 1200, run: chMessage },
      { id: "consortium", name: "Le Consortium", threshold: 2500, run: chConsortium },
      { id: "traque", name: "La traque", threshold: 3000, run: chTraque },
      { id: "taupe", name: "La taupe", threshold: 3500, run: chTaupe },
      { id: "bunker", name: "Le bunker", threshold: 4000, run: chBunker },
      { id: "coeur", name: "Le cœur", threshold: 4500, run: chCoeur },
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
        ["c-role", "La taupe"], ["c-name", "Agente Vega"],
        ["c-role", "Le Consortium (super-méchants de pacotille)"], ["c-name", "Dr Méchant · Comtesse Ombre · Baron Noir"],
        ["c-role", "Toujours en fuite, en sous-marin"], ["c-name", "Général Pingouin"],
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

    // Premier chapitre pas encore vu (-1 si tout a été vu)
    const nextChapter = () => CHAPTERS.findIndex((c) => !st.seen.includes(c.id));

    async function play(n, { replay = false } = {}) {
      const chapter = CHAPTERS[n - 1];
      if (playing || !chapter) return;
      await run(chapter.run, `Cinématique : chapitre ${n}`);
      if (!replay && !st.seen.includes(chapter.id)) {
        st.seen.push(chapter.id);
        st.since = progress.lifetime;
      }
      st.whisper = progress.lifetime;
      api.saveProgress();
      rewards.forEach((id) => api.achieve(id));
      if (!replay && nextChapter() >= 0) api.toast(`Chapitre ${n} terminé · la suite en continuant de taper…`, "eye");
    }

    // Appelé à chaque frappe : déclenche le chapitre suivant au bon moment
    function onType() {
      if (playing || !api.settings.story) return;
      const next = nextChapter();
      if (next >= 0) {
        if (progress.lifetime - st.since >= CHAPTERS[next].threshold && !api.isBusy()) play(next + 1);
        return;
      }
      // Après la fin : ÉCHO laisse parfois un petit mot dans le code (inséré entre deux plans)
      if (st.ending === "free" && progress.lifetime - st.whisper > 4000 && Math.random() < 0.02) {
        st.whisper = progress.lifetime;
        api.whisper(`ÉCHO : ${pick(WHISPERS_FREE)}`);
      } else if (st.ending === "erase" && !whisperedThisSession && progress.lifetime - st.whisper > 6000 && Math.random() < 0.01) {
        whisperedThisSession = true;
        st.whisper = progress.lifetime;
        api.whisper(". . . é c h o . . .");
      }
    }

    function reset() {
      Object.assign(st, { seen: [], since: progress.lifetime, ending: null, whisper: progress.lifetime, flags: {} });
      api.saveProgress();
    }

    const remaining = () => {
      const next = nextChapter();
      return next < 0 ? 0 : Math.max(0, CHAPTERS[next].threshold - (progress.lifetime - st.since));
    };

    return {
      play,
      playFinale,
      onType,
      reset,
      remaining,
      list: () => CHAPTERS.map((c, i) => ({ n: i + 1, id: c.id, name: c.name, seen: st.seen.includes(c.id) })),
      playing: () => playing,
      state: () => st,
    };
  }

  return { create };
})();
