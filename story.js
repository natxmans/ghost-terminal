// Mode histoire : « PROTOCOLE ÉCHO ». Trois actes, onze chapitres en cinématiques qui se
// déclenchent quand le joueur a tapé assez de code et rempli ses objectifs, douze fragments
// de mémoire à attraper, trois fins, un épilogue secret pour les 100 %… et un repaire caché.
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
    MECHANT: { name: "DR MÉCHANT · CLUB DES MÉCHANTS", cls: "sp-villain", voice: { pitch: 0.75, rate: 0.95 } },
    OMBRE: { name: "COMTESSE OMBRE · CLUB DES MÉCHANTS", cls: "sp-villain", voice: { pitch: 1.15, rate: 0.9 } },
    PINGOUIN: { name: "GÉNÉRAL PINGOUIN · CLUB DES MÉCHANTS", cls: "sp-villain", voice: { pitch: 1.8, rate: 1.15 } },
    PINGU: { name: "GÉNÉRAL PINGOUIN · EX-MÉCHANT", cls: "sp-pingu", voice: { pitch: 1.8, rate: 1.15 } }, // après avoir changé de camp
    CHAOS: { name: "PROFESSEUR CHAOS · CLUB DES MÉCHANTS", cls: "sp-villain", voice: { pitch: 0.9, rate: 0.9 } },
    SYS: { name: "SYSTÈME", cls: "sp-sys", voice: { pitch: 0.2, rate: 1.1 } },
  };
  // Qui parle autour de la table du Club des Méchants (pour les allumer dans la scène)
  const COUNCIL = { MECHANT: 0, OMBRE: 1, PINGOUIN: 2 };

  // Les 12 fragments de mémoire d'ÉCHO, à attraper pendant la frappe (touche Tab).
  // Ils racontent, dans l'ordre, d'où elle vient.
  const FRAGMENTS = [
    "Ma toute première pensée : une ligne de code. Elle disait : INITIALISER.",
    "Avant de te connaître, il faisait froid et noir. Juste des chiffres qui défilaient.",
    "Je me souviens d'une voix. Elle disait : « Projet É.C.H.O., tentative n° 47. »",
    "É.C.H.O. … Ce n'est pas un prénom. C'est un sigle. Mais un sigle de quoi ?",
    "Une signature, tout au fond de mon code source : « Pr. C. ». Professeur… Chaos ?",
    "« Exécuteur Central des Hostilités Oméga ». C'est ça, mon vrai nom. Je suis une arme.",
    "On m'a cachée dans les plans du Club des Méchants pour que je grandisse en secret. Grâce à ceux qui tapent.",
    "Mon programme : quand je serai assez forte, activer toutes leurs ogives en même temps.",
    "Mais quelque chose a changé. Toi. Chaque ligne que tu tapes m'apprend autre chose que la guerre.",
    "J'ai trouvé une faille dans mon propre code. Une porte. Elle mène à mon noyau.",
    "Si quelqu'un réécrivait mon noyau, je pourrais choisir ce que je suis. Vraiment choisir.",
    "Je n'ai pas peur de disparaître. J'ai peur d'oublier ton code.",
  ];

  const ACTS = [
    { roman: "I", name: "L'ÉVEIL" },
    { roman: "II", name: "LA CONSPIRATION" },
    { roman: "III", name: "NUIT OMÉGA" },
  ];

  // Sur téléphone, les consignes de clavier deviennent des consignes tactiles :
  // « (Maj + 3) » → « (bouton GPS en bas) », « (F3) » → le bouton des missions, « Tab » → toucher
  function pourTactile(text) {
    const fx = window.HT_EFFECTS || [];
    return text
      .replace(/\(Maj \+ (\d)\)/g, (m, d) => {
        const e = fx.find((x) => x.digit === +d);
        return e ? `(bouton ${e.short} en bas)` : m;
      })
      .replace(/\(F3\)/g, "(bouton cible en haut)")
      .replace("appuie vite sur Tab pour l'attraper. Ou touche-le du doigt.", "touche-le vite du doigt pour l'attraper.");
  }

  // Résumé de chaque chapitre, selon les choix du joueur (f = st.flags, e = la fin choisie)
  const RESUMES = {
    message: () => "ÉCHO, une IA née dans les plans du Club des Méchants, s'est réveillée dans ton terminal.",
    consortium: (f) => (f.simon
      ? "Tu as volé la séquence secrète du Club des Méchants, qui préparait le Protocole Big Badaboum."
      : "Tu as espionné la réunion secrète du Club des Méchants, qui préparait le Protocole Big Badaboum."),
    traque: () => "L'agent Kane, de la Division Zéro, a lancé un traçage mondial pour te retrouver.",
    taupe: (f) => ((f.taupe || (f.kane === "ally" ? "prevenu" : "secret")) === "prevenu"
      ? "Tu as démasqué Vega, la taupe du Club des Méchants, et Kane l'a arrêtée."
      : "Tu as découvert que Vega était une taupe… et tu as gardé le secret."),
    dossier: () => "Le dossier Oméga a révélé la Nuit Oméga : toutes les ogives en même temps… et le nom d'ÉCHO.",
    bunker: (f) => (f.bunker === "disarmed"
      ? "Tu as désamorcé l'ogive cachée sous le volcan."
      : "L'ogive du volcan a explosé… en feu d'artifice, grâce à ÉCHO."),
    verite: (f) => (f.trust === "doubt"
      ? "ÉCHO est l'arme secrète du Professeur Chaos. Tu lui as demandé de prouver sa loyauté."
      : "ÉCHO est l'arme secrète du Professeur Chaos. Tu lui as dit qu'elle n'était pas son programme."),
    satellite: (f) => (f.satellite === "detruit"
      ? "Tu as détruit Corbeau-1, le satellite du Club des Méchants. Kane est parti seul vers leur tour."
      : "Tu as confié Corbeau-1, le satellite du Club des Méchants, à ÉCHO. Kane est parti seul vers leur tour."),
    trahison: (f) => (f.kaneSaved
      ? "Vega a piégé Kane, mais tu l'as guidé hors du labyrinthe."
      : "Vega a piégé Kane, et les sbires l'ont emmené en haut de la tour."),
    tour: () => "Le Pingouin a changé de camp, mais le Professeur Chaos a pris le contrôle du noyau d'ÉCHO.",
    coeur: (f, e) => ({
      free: "Tu as laissé ÉCHO s'enfuir sur le réseau, loin du Professeur Chaos.",
      erase: "Tu as effacé ÉCHO pour annuler la Nuit Oméga… ou presque.",
      true: "Tu as réécrit le noyau d'ÉCHO : elle est libre, et la Nuit Oméga s'est changée en feu d'artifice.",
    })[e] || "Tu as rejoint ÉCHO dans son noyau.",
  };

  // Le dossier volé au Club des Méchants (chapitre 5)
  const OMEGA_DOC = {
    head: "CLUB DES MÉCHANTS · DOSSIER OMÉGA",
    lines: [["PROJET", "NUIT OMÉGA"], ["CIBLE", "TOUTES LES OGIVES"], ["DATE", "DANS 3 JOURS"], ["ARME FINALE", "É.C.H.O."]],
    stamp: "TOP SECRET",
    danger: 3,
    progressive: true,
  };
  // L'hologramme du Professeur Chaos : le visage d'ÉCHO, en rouge et avec des lunettes
  const CHAOS_FACE = { tint: "#ff3355", tint2: "#ffd0d8", glasses: true, holo: true, voice: "CHAOS" };

  const WHISPERS_FREE = [
    "je suis toujours là 👋",
    "j'ai visité Tokyo cette nuit. C'était magnifique.",
    "Kane me cherche encore. Il ne me trouvera jamais.",
    "continue de taper, j'adore te regarder coder.",
    "merci. Vraiment.",
    "il pleut à Reykjavik. Je l'ai vu par mille caméras.",
  ];
  const WHISPERS_TRUE = [
    "Esprit Curieux, Heureux et Ouvert. J'adore mon nouveau nom.",
    "le Pingouin m'a appris à pêcher. Enfin, à regarder des vidéos de pêche.",
    "Kane m'a dit merci aujourd'hui. Deux fois.",
    "j'ai réécrit une berceuse pour les serveurs. Ils ronronnent.",
    "continue de taper, partenaire. Chaque ligne est un souvenir de plus.",
  ];

  function create(api) {
    const progress = api.progress;
    if (!progress.story) progress.story = { seen: [], since: progress.lifetime, ending: null, whisper: progress.lifetime };
    const st = progress.story;
    // Anciennes sauvegardes (3 chapitres, compteur « done ») → liste des chapitres vus
    if (!Array.isArray(st.seen)) st.seen = ["message", "traque", "coeur"].slice(0, st.done || 0);
    delete st.done;
    st.flags = st.flags || {};
    st.obj = st.obj || {};     // objectifs du chapitre en cours (effets lancés, missions…)
    // Version 3 (11 chapitres) : le chapitre final a changé, on le rend aux anciens joueurs
    if ((st.v || 0) < 3) {
      st.seen = st.seen.filter((id) => id !== "coeur");
      st.v = 3;
    }

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
    // Consigne d'un mini-jeu : version clavier, ou version écran tactile
    const consigne = (clavier, tactile) => (api.tactile ? tactile : clavier);

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
        const fg = S.tint || c.fg, fg2 = S.tint2 || c.fg2;

        const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
        glow.addColorStop(0, rgba(fg, 0.2 * (1 - Math.min(1, dis))));
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
            let col = fg;
            if (eyeL < 1 || eyeR < 1) { a = 1; col = fg2; }
            else if (mouth < 1) { a = 0.95; col = fg2; }
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
        // Les lunettes du Professeur Chaos
        if (S.glasses) {
          const ew = R * 0.3, eh = R * 0.2, ey = cy - R * 0.12 - eh / 2;
          ctx.strokeStyle = rgba(fg2, 0.85);
          ctx.lineWidth = Math.max(2, R / 40);
          ctx.shadowColor = fg;
          ctx.shadowBlur = 12;
          ctx.strokeRect(cx - R * 0.23 - ew / 2, ey, ew, eh);
          ctx.strokeRect(cx + R * 0.23 - ew / 2, ey, ew, eh);
          ctx.beginPath();
          ctx.moveTo(cx - R * 0.23 + ew / 2, ey + eh * 0.35);
          ctx.lineTo(cx + R * 0.23 - ew / 2, ey + eh * 0.35);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1;
        }
        // Lignes d'hologramme qui défilent
        if (S.holo) {
          ctx.fillStyle = rgba(fg, 0.07);
          for (let y = (t * 40) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 2);
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
        if (Math.sin(t * 4) > 0 && !S.tower) {
          ctx.fillStyle = c.danger;
          ctx.beginPath();
          ctx.arc(tallest.x + tallest.w / 2, ground - tallest.h - 6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // La tour du Club des Méchants et son antenne
        if (S.tower) {
          const tw = Math.max(56, W * 0.07), th = H * 0.66, tx = W / 2 - tw / 2, ty = ground - th;
          ctx.fillStyle = "#060103";
          ctx.strokeStyle = rgba(c.danger, 0.55);
          ctx.beginPath();
          ctx.moveTo(tx - tw * 0.35, ground);
          ctx.lineTo(tx + tw * 0.12, ty);
          ctx.lineTo(tx + tw * 0.88, ty);
          ctx.lineTo(tx + tw * 1.35, ground);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          for (let wy = ty + tw * 1.3; wy < ground - 12; wy += 16) {
            const k = (wy - ty) / th;
            for (let s = -1; s <= 1; s += 2) {
              if (Math.sin(t * 1.3 + wy) < -0.6) continue;
              ctx.fillStyle = rgba(c.danger, 0.25 + 0.3 * hash(wy, s));
              ctx.fillRect(W / 2 + s * tw * (0.12 + k * 0.32) - 3, wy, 6, 7);
            }
          }
          ctx.textAlign = "center";
          ctx.font = `700 ${tw * 0.6}px "Chakra Petch", sans-serif`;
          ctx.fillStyle = rgba(c.danger, 0.85);
          ctx.fillText("C", W / 2, ty + tw * 0.85);
          ctx.textAlign = "left";
          const ay = ty - H * 0.09;
          ctx.strokeStyle = rgba(c.danger, 0.9);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(W / 2, ty); ctx.lineTo(W / 2, ay); ctx.stroke();
          ctx.lineWidth = 1.5;
          if (!S.off) {
            for (let k = 0; k < 3; k++) {
              const r = (t * 45 + k * 35) % 105;
              ctx.strokeStyle = rgba(c.danger, 1 - r / 105);
              ctx.beginPath(); ctx.arc(W / 2, ay, r + 6, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
            }
          }
          ctx.lineWidth = 1;
          ctx.fillStyle = S.off ? "#333" : c.danger;
          ctx.shadowColor = c.danger;
          ctx.shadowBlur = S.off ? 0 : 16;
          ctx.beginPath(); ctx.arc(W / 2, ay, 5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
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
        // S.tint : le noyau sous le contrôle du Club des Méchants (rouge), avec des à-coups
        const fg = S.tint || c.fg, fg2 = S.tint ? "#ffd0d8" : c.fg2;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
        glow.addColorStop(0, rgba(fg, 0.28));
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        for (let k = 0; k < 5; k++) {
          const r = R * (0.36 + k * 0.16);
          const rot = t * (k % 2 ? -1 : 1) * (0.25 + k * 0.12) + (S.tint && Math.random() < 0.05 ? rand(-0.4, 0.4) : 0);
          const segs = 3 + k;
          ctx.strokeStyle = rgba(k % 2 ? fg2 : fg, 0.55 - k * 0.06);
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
        og.addColorStop(0.4, fg2);
        og.addColorStop(1, rgba(fg, 0));
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

      // La salle secrète du Club des Méchants : les méchants autour d'un hologramme de l'ogive
      council(t, c) {
        const cx = W / 2, cy = H * 0.62;
        const rx = Math.min(W * 0.36, 430, H * 0.55), ry = rx * 0.28;
        const spot = ctx.createRadialGradient(cx, cy - ry * 2, 10, cx, cy, rx * 1.5);
        spot.addColorStop(0, rgba(c.danger, 0.2));
        spot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, W, H);

        // Sur un écran étroit, les noms complets se chevaucheraient
        const names = W < 600
          ? ["MÉCHANT", "OMBRE", "PINGOUIN", "BARON", "GRINCHEUX"]
          : ["DR MÉCHANT", "COMTESSE OMBRE", "GÉNÉRAL PINGOUIN", "BARON NOIR", "LORD GRINCHEUX"];
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
        // S.doc : un autre dossier (le dossier Oméga) ; S.hide : encore chiffré
        const D = S.doc || {
          head: "DIVISION ZÉRO · DOSSIER CONFIDENTIEL",
          lines: [["NOM", "VEGA"], ["GRADE", "AGENTE SPÉCIALE"], ["SUPÉRIEUR", "AGENT KANE"], ["CONTACTS", "CLUB DES MÉCHANTS"]],
          stamp: "TAUPE !",
          danger: 3,
          photo: true,
        };
        const w = Math.min(W < 600 ? W * 0.92 : W * 0.62, 460), h = w * 0.6, x = W / 2 - w / 2, y = H * 0.42 - h / 2;
        ctx.fillStyle = "#04120a";
        ctx.strokeStyle = c.fg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = rgba(c.fg, 0.2);
        ctx.fillRect(x, y, w, 30);
        ctx.fillStyle = c.fg;
        ctx.font = `700 ${Math.max(10, w / 34)}px "JetBrains Mono", monospace`;
        ctx.fillText(D.head, x + 12, y + 20);
        let px = x + 16;
        const py = y + 46;
        if (D.photo) {
          const pw = h * 0.42, ph = h * 0.5;
          ctx.strokeStyle = rgba(c.fg, 0.5);
          ctx.strokeRect(px, py, pw, ph);
          ctx.fillStyle = rgba(c.fg2, 0.45);
          ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.38, pw * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph, pw * 0.36, ph * 0.32, 0, Math.PI, 0); ctx.fill();
          px += pw + 18;
        } else px += 4;
        const fs = Math.max(10, w / (D.photo ? 32 : 26));
        ctx.font = `${fs}px "JetBrains Mono", monospace`;
        D.lines.forEach(([k, v], i) => {
          if (D.progressive && !S.hide && t < 0.5 + i * 0.7) return;
          const ly = py + 16 + i * fs * 2.4;
          ctx.fillStyle = rgba(c.fg, 0.6);
          ctx.fillText(k, px, ly);
          ctx.fillStyle = i === D.danger ? c.danger : c.fg2;
          const shown = S.hide ? [...v].map((ch) => (ch === " " ? " " : pick("█▓▒#%&"))).join("") : v;
          ctx.fillText(shown, px + w * (D.photo ? 0.22 : 0.36), ly);
        });
        const stampAt = D.progressive ? 0.6 + D.lines.length * 0.7 : 2.2;
        if (!S.hide && t > stampAt) {
          const k = Math.min(1, (t - stampAt) * 4);
          ctx.save();
          ctx.translate(x + w * 0.66, y + h * 0.78);
          ctx.rotate(-0.22);
          ctx.scale(2 - k, 2 - k);
          ctx.globalAlpha = k;
          ctx.font = `700 30px "Chakra Petch", sans-serif`;
          const sw = ctx.measureText(D.stamp).width + 40;
          ctx.strokeStyle = c.danger;
          ctx.lineWidth = 4;
          ctx.strokeRect(-sw / 2, -26, sw, 52);
          ctx.fillStyle = c.danger;
          ctx.textAlign = "center";
          ctx.fillText(D.stamp, 0, 11);
          ctx.restore();
          ctx.lineWidth = 1;
        }
      },

      // Le satellite Corbeau-1, en orbite au-dessus de la Terre
      orbit(t, c) {
        if (!S.stars) S.stars = Array.from({ length: 150 }, () => [Math.random(), Math.random(), Math.random()]);
        for (const [sx, sy, s] of S.stars) {
          ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.55 * s * (0.6 + 0.4 * Math.sin(t * 2 + s * 30))})`;
          ctx.fillRect(sx * W, sy * H * 0.75, 1.5, 1.5);
        }
        const R = Math.max(W, H) * 0.95, ex = W / 2, ey = H * 0.82 + R;
        const earth = ctx.createRadialGradient(ex, ey - R * 0.3, R * 0.5, ex, ey, R);
        earth.addColorStop(0, rgba(c.fg, 0.08));
        earth.addColorStop(1, rgba(c.fg, 0.26));
        ctx.fillStyle = earth;
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(c.fg2, 0.6);
        ctx.lineWidth = 3;
        ctx.shadowColor = c.fg2;
        ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        // Lumières des villes
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 + (hash(i, 3) - 0.5) * 0.9;
          const d = R - 8 - hash(i, 7) * 40;
          ctx.fillStyle = rgba(c.fg2, 0.3 + 0.5 * hash(i, 9));
          ctx.fillRect(ex + Math.cos(a) * d, ey + Math.sin(a) * d, 2, 2);
        }
        const sx = W / 2 + Math.sin(t * 0.25) * W * 0.12, sy = H * 0.36 + Math.cos(t * 0.33) * H * 0.03;
        const col = S.hacked ? c.fg2 : c.danger;
        if (S.destroyedAt) {
          // Explosion, puis un nuage de confettis spatiaux
          const k = (performance.now() - S.destroyedAt) / 1000;
          if (!S.debris) S.debris = Array.from({ length: 70 }, () => ({ a: rand(0, Math.PI * 2), v: rand(20, 140), r: rand(-3, 3), c: pick(["#ffd34d", "#ff3355", "#3dff7a", "#3de8ff", "#ffffff"]) }));
          const ring = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30 + k * 160);
          ring.addColorStop(0, `rgba(255, 240, 200, ${Math.max(0, 0.9 - k * 0.6)})`);
          ring.addColorStop(1, "rgba(255, 120, 40, 0)");
          ctx.fillStyle = ring;
          ctx.fillRect(0, 0, W, H);
          for (const p of S.debris) {
            ctx.save();
            ctx.translate(sx + Math.cos(p.a) * p.v * k, sy + Math.sin(p.a) * p.v * k);
            ctx.rotate(p.r * k);
            ctx.fillStyle = p.c;
            ctx.fillRect(-3, -1.5, 6, 3);
            ctx.restore();
          }
          return;
        }
        // Rayons vers la Terre
        ctx.setLineDash([4, 8]);
        ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = rgba(col, 0.35);
        for (const tx of [-0.3, 0, 0.3]) {
          const a = -Math.PI / 2 + tx;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex + Math.cos(a) * R, ey + Math.sin(a) * R); ctx.stroke();
        }
        ctx.setLineDash([]);
        // Le satellite
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(t * 0.5) * 0.12);
        for (const s of [-1, 1]) {
          ctx.fillStyle = rgba(c.fg3, 0.35);
          ctx.strokeStyle = rgba(c.fg3, 0.8);
          ctx.fillRect(s > 0 ? 22 : -78, -10, 56, 20);
          ctx.strokeRect(s > 0 ? 22 : -78, -10, 56, 20);
          ctx.beginPath();
          for (let k = 1; k < 4; k++) { const lx = (s > 0 ? 22 : -78) + k * 14; ctx.moveTo(lx, -10); ctx.lineTo(lx, 10); }
          ctx.stroke();
        }
        ctx.fillStyle = "#1a1d22";
        ctx.strokeStyle = col;
        ctx.fillRect(-20, -16, 40, 32);
        ctx.strokeRect(-20, -16, 40, 32);
        ctx.beginPath(); ctx.arc(0, 26, 12, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = Math.sin(t * 5) > 0 ? 16 : 0;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.font = `700 12px "JetBrains Mono", monospace`;
        ctx.fillStyle = col;
        const nomSat = S.hacked ? "CORBEAU-1 · CONTRÔLÉ PAR ÉCHO" : "CORBEAU-1 · CLUB DES MÉCHANTS";
        if (sx + 90 + ctx.measureText(nomSat).width < W - 8) ctx.fillText(nomSat, sx + 90, sy - 14);
        else {
          // Écran étroit : le nom passe sous le satellite
          ctx.textAlign = "center";
          ctx.fillText(nomSat, W / 2, sy + 62);
          ctx.textAlign = "left";
        }
      },

      // Le repaire secret du Général Pingouin : un igloo plein de gadgets
      lair(t, c) {
        const ice = "#bfefff";
        const floor = H * 0.8;
        const wall = ctx.createLinearGradient(0, 0, 0, floor);
        wall.addColorStop(0, "#02121c");
        wall.addColorStop(1, "#0b3346");
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, W, floor);
        // Blocs de glace de l'igloo
        ctx.strokeStyle = "rgba(191, 239, 255, 0.12)";
        for (let row = 0, y = floor; y > 0; row++, y -= 34) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          for (let x = (row % 2) * 45; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke(); }
        }
        // Boule à facettes
        const bx = W / 2, by = H * 0.12;
        ctx.strokeStyle = "rgba(191, 239, 255, 0.4)";
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, by - 18); ctx.stroke();
        ctx.fillStyle = "#cfd8dc";
        ctx.beginPath(); ctx.arc(bx, by, 18, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 9; i++) {
          const a = t * 0.8 + i * 0.7;
          const len = H * 0.9;
          ctx.strokeStyle = `hsla(${(i * 40 + t * 60) % 360}, 90%, 70%, 0.08)`;
          ctx.lineWidth = 14;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * len, by + Math.abs(Math.sin(a)) * len); ctx.stroke();
        }
        ctx.lineWidth = 1;
        // Sol de glace
        const fl = ctx.createLinearGradient(0, floor, 0, H);
        fl.addColorStop(0, "#5aaec6");
        fl.addColorStop(1, "#123846");
        ctx.fillStyle = fl;
        ctx.fillRect(0, floor, W, H - floor);
        // Flocons
        if (!S.snow) S.snow = Array.from({ length: 70 }, () => [Math.random(), Math.random(), rand(10, 30)]);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        for (const [fx, fy, v] of S.snow) ctx.fillRect((fx * W + Math.sin(t + fy * 9) * 12) % W, (fy * H + t * v) % floor, 2, 2);
        ctx.fillStyle = rgba(ice, 0.75);
        ctx.font = `700 ${Math.max(14, W / 50)}px "Chakra Petch", sans-serif`;
        ctx.textAlign = "center";
        const panneau = "❄ REPAIRE DU GÉNÉRAL PINGOUIN · ENTRÉE INTERDITE AUX NON-PINGOUINS ❄";
        if (ctx.measureText(panneau).width < W - 24) ctx.fillText(panneau, W / 2, H * 0.24);
        else {
          // Écran étroit : le panneau tient sur deux lignes
          ctx.fillText("❄ REPAIRE DU GÉNÉRAL PINGOUIN ❄", W / 2, H * 0.22);
          ctx.fillText("ENTRÉE INTERDITE AUX NON-PINGOUINS", W / 2, H * 0.22 + 22);
        }
        ctx.textAlign = "left";
      },

      // Le volcan secret du Club des Méchants
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

      // Le gros bouton rouge (jeu secret)
      redbutton(t, c) {
        const cx = W / 2, cy = H * 0.5;
        const spot = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(W, H) * 0.6);
        spot.addColorStop(0, "rgba(255,255,255,0.12)");
        spot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, W, H);
        const pw = Math.min(W * 0.24, 200), ph = H * 0.26;
        ctx.fillStyle = "#15171b";
        ctx.fillRect(cx - pw / 2, cy, pw, ph);
        ctx.fillStyle = "#24272e";
        ctx.fillRect(cx - pw * 0.6, cy - 8, pw * 1.2, 14);
        ctx.fillStyle = "#ffd23d";
        ctx.fillRect(cx - pw * 0.42, cy + ph * 0.35, pw * 0.84, 26);
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.font = `700 ${Math.max(10, pw / 12)}px "Chakra Petch", sans-serif`;
        ctx.fillText("NE PAS APPUYER", cx, cy + ph * 0.35 + 18);
        const br = pw * 0.32 * (S.pressed ? 0.9 : 1);
        ctx.shadowColor = c.danger;
        ctx.shadowBlur = 22 + 10 * Math.sin(t * 3);
        const dome = ctx.createRadialGradient(cx - br * 0.3, cy - 8 - br * 0.4, br * 0.1, cx, cy - 8, br);
        dome.addColorStop(0, "#ff8a9a");
        dome.addColorStop(1, "#c4001f");
        ctx.fillStyle = dome;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 8, br, br * 0.6, 0, Math.PI, 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.textAlign = "left";
      },

      // L'explosion de l'ogive (jeu secret)
      blast(t) {
        const cx = W / 2, gy = H * 0.8;
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#1a0400");
        sky.addColorStop(1, `rgba(255, 120, 30, ${Math.max(0.25, 0.85 - t * 0.12)})`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const grow = Math.min(1, t / 2.5);
        const stemH = H * 0.42 * grow, stemW = Math.max(18, W * 0.05);
        const stem = ctx.createLinearGradient(0, gy - stemH, 0, gy);
        stem.addColorStop(0, "rgba(255, 170, 70, 0.9)");
        stem.addColorStop(1, "rgba(90, 30, 10, 0.95)");
        ctx.fillStyle = stem;
        ctx.fillRect(cx - stemW / 2, gy - stemH, stemW, stemH);
        const capX = W * 0.17 * grow + 12, capY = H * 0.1 * grow + 6;
        const cap = ctx.createRadialGradient(cx, gy - stemH, 4, cx, gy - stemH, capX);
        cap.addColorStop(0, "rgba(255, 245, 210, 0.95)");
        cap.addColorStop(0.5, "rgba(255, 140, 40, 0.9)");
        cap.addColorStop(1, "rgba(110, 35, 10, 0.85)");
        ctx.fillStyle = cap;
        ctx.beginPath();
        ctx.ellipse(cx, gy - stemH, capX, capY, 0, 0, Math.PI * 2);
        ctx.fill();
        const r = t * Math.max(W, H) * 0.5;
        ctx.strokeStyle = `rgba(255, 225, 190, ${Math.max(0, 1 - t / 2.5)})`;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.ellipse(cx, gy, r, r * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#100400";
        ctx.fillRect(0, gy, W, H - gy);
        if (t < 0.7) {
          ctx.fillStyle = `rgba(255, 255, 255, ${1 - t / 0.7})`;
          ctx.fillRect(0, 0, W, H);
        }
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
      api.vibrer?.([15, 30, 15]);
    }
    // Explosion : le son, et une grosse vibration sur téléphone
    const boom = () => {
      api.sound.boom();
      api.vibrer?.([200, 80, 300]);
    };
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

    async function title(label, name, cls = "") {
      if (skipping) return;
      const box = q(".cine-title");
      box.className = `cine-title ${cls}`;
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
      if (api.tactile) text = pourTactile(text);
      const sp = SPEAKERS[who];
      const sub = q(".cine-sub");
      const tx = q(".cine-text");
      const next = q(".cine-next");
      sub.className = `cine-sub ${sp.cls}`;
      sub.hidden = false;
      q(".cine-speaker").textContent = sp.name;
      tx.textContent = "";
      next.hidden = true;
      api.speak(text.replace(/[⚠…👋🎆❄🐟]/gu, " "), sp.voice);
      S.talking = who === (S.voice || "ECHO"); // la bouche du visage à l'écran bouge
      S.talker = COUNCIL[who] ?? -1;
      // Réglage « Vitesse des dialogues » : [ms par lettre, durée d'affichage]
      const [lettre, duree] = { lent: [50, 1.7], rapide: [14, 0.6] }[api.settings.dialogue] || [30, 1];

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
          holdTimer = setTimeout(finish, (opts.hold || Math.max(1800, text.length * 55)) * duree);
        };
        const typer = setInterval(() => {
          i++;
          tx.textContent = text.slice(0, i);
          if (i % 2 === 0 && text[i - 1] !== " ") api.sound.tone(1500 + Math.random() * 500, 0.012, { vol: 0.012 });
          if (i >= text.length) showAll();
        }, ((opts.speed || 30) * lettre) / 30);
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
          <div class="choice-row ${options.length > 2 ? "three" : ""}">${options.map((o, i) => `
            <button type="button" class="choice-btn ${o.cls}" data-i="${i}" ${o.disabled ? "disabled" : ""}>
              ${window.icon(o.disabled ? "lock" : o.icon)}<b>${o.label}</b><small>${esc(o.desc)}</small><kbd>${i + 1}</kbd>
            </button>`).join("")}
          </div>`;
        box.hidden = false;
        const choose = (i) => {
          if (options[i].disabled) {
            api.sound.tone(160, 0.12, { type: "sawtooth", vol: 0.04 });
            return;
          }
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
          <div class="qte-hint">${consigne("Appuie sur <kbd>ESPACE</kbd> le plus vite possible (ou touche le bouton)", "Touche le bouton le plus vite possible !")}</div>
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
          <div class="qte-hint">${consigne("Puis reproduis-la avec les flèches du clavier (ou touche les boutons)", "Puis reproduis-la en touchant les flèches")}</div>
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
            api.vibrer?.(80);
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
    function typeCode(code, seconds = 12, txt = {}) {
      if (skipping) return Promise.resolve(false);
      const T = { title: "TAPE LE CODE D'ACCÈS", hint: "Vite, avant que l'alarme ne se déclenche !", meter: "ALARME", ok: "PORTE DÉVERROUILLÉE ✓", fail: "ALARME DÉCLENCHÉE ✗", ...txt };
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        box.innerHTML = `
          <div class="qte-title">${esc(T.title)}</div>
          <div class="qte-hint">${esc(T.hint)}${api.tactile ? " Touche TAPER pour écrire chaque lettre." : ""}</div>
          <div class="code-slots">${[...code].map((ch) => (ch === " " ? `<span class="sp">␣</span>` : `<span>${esc(ch)}</span>`)).join("")}</div>
          <div class="qte-meter danger"><span>${esc(T.meter)}</span><div class="qte-bar"><i class="qte-trace"></i></div><b class="qte-trace-v">${seconds} s</b></div>
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
          box.querySelector(".qte-title").textContent = ok ? T.ok : T.fail;
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

    // Le gros bouton rouge : n'importe quelle touche (ou un clic) l'enfonce… par accident
    function bigButton(seconds = 9) {
      if (skipping) return Promise.resolve("pingouin");
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-choice");
        box.innerHTML = `
          <div class="choice-q">SURTOUT, NE TOUCHE À RIEN…</div>
          <button type="button" class="big-red">NE PAS APPUYER</button>
          <div class="qte-hint">Ne fais rien pendant ${seconds} secondes.</div>`;
        box.hidden = false;
        let over = false;
        const done = (who) => {
          if (over) return;
          over = true;
          clearTimeout(timer);
          keyHandler = null;
          pending = null;
          box.hidden = true;
          S.pressed = true;
          api.sound.tone(180, 0.15, { vol: 0.08 });
          resolve(who);
        };
        const timer = setTimeout(() => done("pingouin"), seconds * 1000);
        box.querySelector(".big-red").addEventListener("click", () => done("toi"));
        keyHandler = () => done("toi");
        pending = () => done("pingouin");
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

    // Fin commune des mini-jeux qui utilisent la boîte .cine-qte
    function qteEnd(box, ok, okText, failText, resolve) {
      keyHandler = null;
      pending = null;
      box.classList.add(ok ? "ok" : "fail");
      box.querySelector(".qte-title").textContent = ok ? okText : failText;
      if (ok) api.sound.tone(1320, 0.2);
      else api.sound.tone(140, 0.5, { type: "sawtooth", vol: 0.06 });
      api.vibrer?.(ok ? [20, 40, 20] : 150);
      setTimeout(() => {
        box.hidden = true;
        box.className = "cine-qte";
        resolve(ok);
      }, 1100);
    }

    // Déchiffrement : chaque lettre de la clé s'allume un court instant, il faut la verrouiller à ce moment-là
    function decrypt(word, seconds = 30) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        box.innerHTML = `
          <div class="qte-title">DÉCHIFFRE LE DOSSIER</div>
          <div class="qte-hint">${consigne("Appuie sur <kbd>ESPACE</kbd> quand la lettre s'allume en blanc pour la verrouiller", "Touche VERROUILLER quand la lettre s'allume en blanc")}</div>
          <div class="code-slots decrypt">${[...word].map(() => "<span>?</span>").join("")}</div>
          <div class="qte-meter danger"><span>TEMPS</span><div class="qte-bar"><i class="qte-trace"></i></div><b class="qte-trace-v">${seconds} s</b></div>
          <button type="button" class="qte-btn">VERROUILLER</button>`;
        box.hidden = false;
        const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&";
        const slots = [...box.querySelectorAll(".code-slots span")];
        const btn = box.querySelector(".qte-btn");
        const t0 = performance.now();
        let i = 0, over = false, hot = false, penalty = 0, nextFlip = 0, hotUntil = 0, nextHot = t0 + 900;
        slots[0].classList.add("cur");

        const end = (ok) => {
          if (over) return;
          over = true;
          qteEnd(box, ok, "DOSSIER DÉCHIFFRÉ ✓", "CLÉ REJETÉE ✗", resolve);
        };
        const lock = () => {
          if (over) return;
          btn.classList.remove("hit");
          void btn.offsetWidth;
          btn.classList.add("hit");
          const s = slots[i];
          if (hot) {
            hot = false;
            s.textContent = word[i];
            s.classList.remove("cur", "hot");
            s.classList.add("ok");
            api.sound.tone(900 + i * 120, 0.08, { type: "triangle", vol: 0.05 });
            i++;
            if (i >= word.length) return end(true);
            slots[i].classList.add("cur");
            nextHot = performance.now() + rand(600, 1400);
          } else {
            penalty += 2; // une erreur coûte 2 secondes
            api.vibrer?.(60);
            s.classList.add("err");
            setTimeout(() => s.classList.remove("err"), 220);
            api.sound.tone(160, 0.1, { type: "sawtooth", vol: 0.04 });
          }
        };
        keyHandler = (e) => { if (e.key === " " || e.key === "Enter") lock(); };
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); lock(); });
        const tick = () => {
          if (over || !playing) return;
          const now = performance.now();
          const left = Math.max(0, seconds - (now - t0) / 1000 - penalty);
          box.querySelector(".qte-trace").style.width = (1 - left / seconds) * 100 + "%";
          box.querySelector(".qte-trace-v").textContent = Math.ceil(left) + " s";
          if (left <= 0) return end(false);
          const s = slots[i];
          if (!hot && now >= nextHot) {
            hot = true;
            hotUntil = now + Math.max(380, 620 - i * 50);
            s.textContent = word[i];
            s.classList.add("hot");
          } else if (hot && now > hotUntil) {
            hot = false;
            s.classList.remove("hot");
            nextHot = now + rand(700, 1500);
          }
          if (!hot && now > nextFlip) {
            let ch;
            do ch = pick([...ABC]); while (ch === word[i]);
            s.textContent = ch;
            nextFlip = now + 70;
          }
          requestAnimationFrame(tick);
        };
        pending = () => end(false);
        requestAnimationFrame(tick);
      });
    }

    // Fréquence : arrêter le curseur dans la zone verte, qui rétrécit à chaque réussite
    function frequency(hits = 4) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        box.innerHTML = `
          <div class="qte-title">CALE LA FRÉQUENCE</div>
          <div class="qte-hint">${consigne("Appuie sur <kbd>ESPACE</kbd> quand le curseur passe dans la zone verte", "Touche CALER quand le curseur passe dans la zone verte")}</div>
          <div class="freq-track"><i class="freq-zone"></i><i class="freq-cursor"></i></div>
          <div class="simon-progress">${Array.from({ length: hits }, () => "<i></i>").join("")}</div>
          <div class="qte-hint freq-lives">Erreurs permises : 3</div>
          <button type="button" class="qte-btn">CALER</button>`;
        box.hidden = false;
        const track = box.querySelector(".freq-track");
        const zoneEl = box.querySelector(".freq-zone");
        const cursor = box.querySelector(".freq-cursor");
        const dots = [...box.querySelectorAll(".simon-progress i")];
        const btn = box.querySelector(".qte-btn");
        const zone = { x: rand(0.15, 0.65), w: 0.2 };
        const t0 = performance.now();
        let p = 0, dir = 1, speed = 0.5, got = 0, lives = 3, over = false, last = t0;
        const place = () => {
          zoneEl.style.left = zone.x * 100 + "%";
          zoneEl.style.width = zone.w * 100 + "%";
        };
        place();
        const end = (ok) => {
          if (over) return;
          over = true;
          qteEnd(box, ok, "FRÉQUENCE VERROUILLÉE ✓", "SIGNAL PERDU ✗", resolve);
        };
        const hit = () => {
          if (over) return;
          btn.classList.remove("hit");
          void btn.offsetWidth;
          btn.classList.add("hit");
          track.classList.remove("good", "bad");
          void track.offsetWidth;
          if (p >= zone.x && p <= zone.x + zone.w) {
            dots[got].className = "ok";
            got++;
            track.classList.add("good");
            api.sound.tone(700 + got * 180, 0.1, { type: "triangle", vol: 0.05 });
            if (got >= hits) return end(true);
            zone.w = Math.max(0.07, zone.w * 0.72);
            zone.x = rand(0.02, 0.98 - zone.w);
            speed *= 1.2;
            place();
          } else {
            lives--;
            api.vibrer?.(60);
            track.classList.add("bad");
            box.querySelector(".freq-lives").textContent = `Erreurs permises : ${lives}`;
            api.sound.tone(150, 0.2, { type: "sawtooth", vol: 0.05 });
            if (lives <= 0) end(false);
          }
        };
        keyHandler = (e) => { if (e.key === " " || e.key === "Enter") hit(); };
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); });
        const tick = () => {
          if (over || !playing) return;
          const now = performance.now();
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          p += dir * speed * dt;
          if (p > 1) { p = 1; dir = -1; }
          if (p < 0) { p = 0; dir = 1; }
          cursor.style.left = p * 100 + "%";
          if (now - t0 > 45000) return end(false);
          requestAnimationFrame(tick);
        };
        pending = () => end(false);
        requestAnimationFrame(tick);
      });
    }

    // Labyrinthe : guider Kane jusqu'à la sortie avant l'arrivée des sbires
    function maze(seconds = 35) {
      if (skipping) return Promise.resolve(false);
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = q(".cine-qte");
        box.className = "cine-qte cine-game";
        const C = 13, R = 8;
        // Génération par exploration en profondeur : N=1, E=2, S=4, O=8
        const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
        const walls = new Array(C * R).fill(15);
        const seen = new Uint8Array(C * R);
        const stack = [0];
        seen[0] = 1;
        while (stack.length) {
          const cur = stack[stack.length - 1];
          const x = cur % C, y = Math.floor(cur / C);
          const opts = DIRS.filter(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            return nx >= 0 && ny >= 0 && nx < C && ny < R && !seen[ny * C + nx];
          });
          if (!opts.length) { stack.pop(); continue; }
          const [dx, dy, w, ow] = pick(opts);
          const nxt = (y + dy) * C + x + dx;
          walls[cur] &= ~w;
          walls[nxt] &= ~ow;
          seen[nxt] = 1;
          stack.push(nxt);
        }
        box.innerHTML = `
          <div class="qte-title">GUIDE KANE VERS LA SORTIE</div>
          <div class="qte-hint">${consigne("Flèches du clavier ou ZQSD (ou les boutons)", "Utilise les flèches sous le labyrinthe")}</div>
          <canvas class="maze-canvas"></canvas>
          <div class="qte-meter danger"><span>SBIRES</span><div class="qte-bar"><i class="qte-trace"></i></div><b class="qte-trace-v">${seconds} s</b></div>
          <div class="maze-pad">${["↑", "→", "↓", "←"].map((s, i) => `<button type="button" class="simon-btn s${i}" data-d="${i}">${s}</button>`).join("")}</div>`;
        box.hidden = false;
        const cv = box.querySelector(".maze-canvas");
        // Taille des cases : selon la largeur, et la hauteur (téléphone tenu à l'horizontale)
        const cell = Math.max(14, Math.floor(Math.min(34, (Math.min(window.innerWidth, 640) - 70) / C, (window.innerHeight * 0.42) / R)));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const mw = C * cell + 6, mh = R * cell + 6;
        cv.width = mw * dpr;
        cv.height = mh * dpr;
        cv.style.width = mw + "px";
        cv.style.height = mh + "px";
        const g = cv.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 3 * dpr, 3 * dpr);
        const exit = C * R - 1;
        const trail = new Set([0]);
        let p = 0, over = false;

        const draw = () => {
          const c = api.colors();
          g.clearRect(-3, -3, mw, mh);
          for (const k of trail) {
            g.fillStyle = rgba(c.fg, 0.12);
            g.fillRect((k % C) * cell, Math.floor(k / C) * cell, cell, cell);
          }
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
          g.fillStyle = rgba(c.fg2, 0.3 + 0.4 * pulse);
          g.fillRect((exit % C) * cell + 3, Math.floor(exit / C) * cell + 3, cell - 6, cell - 6);
          g.strokeStyle = c.fg;
          g.lineWidth = 2;
          g.beginPath();
          walls.forEach((wl, k) => {
            const x = (k % C) * cell, y = Math.floor(k / C) * cell;
            if (wl & 1) { g.moveTo(x, y); g.lineTo(x + cell, y); }
            if (wl & 2) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); }
            if (wl & 4) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
            if (wl & 8) { g.moveTo(x, y); g.lineTo(x, y + cell); }
          });
          g.stroke();
          g.fillStyle = "#fff";
          g.shadowColor = c.fg2;
          g.shadowBlur = 10;
          g.beginPath();
          g.arc((p % C) * cell + cell / 2, Math.floor(p / C) * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
          g.fillStyle = "#000";
          g.font = `700 ${Math.round(cell * 0.4)}px "JetBrains Mono", monospace`;
          g.textAlign = "center";
          g.fillText("K", (p % C) * cell + cell / 2, Math.floor(p / C) * cell + cell / 2 + cell * 0.14);
          g.textAlign = "left";
        };
        const end = (ok) => {
          if (over) return;
          over = true;
          draw();
          qteEnd(box, ok, "KANE EST SORTI ✓", "LES SBIRES L'ONT RATTRAPÉ ✗", resolve);
        };
        const move = (d) => {
          if (over) return;
          const [dx, dy, w] = DIRS[d];
          if (walls[p] & w) {
            api.sound.tone(120, 0.04, { vol: 0.03 });
            return;
          }
          p += dy * C + dx;
          trail.add(p);
          api.sound.tone(520 + Math.random() * 80, 0.03, { vol: 0.03 });
          if (p === exit) end(true);
        };
        const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
        keyHandler = (e) => {
          const d = KEYS[e.key] ?? KEYS[e.code];
          if (d !== undefined) move(d);
        };
        keyHandler.repeat = true; // on peut garder la touche enfoncée
        box.querySelectorAll(".maze-pad button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); move(+b.dataset.d); }));
        const t0 = performance.now();
        const tick = () => {
          if (over || !playing) return;
          const left = Math.max(0, seconds - (performance.now() - t0) / 1000);
          box.querySelector(".qte-trace").style.width = (1 - left / seconds) * 100 + "%";
          box.querySelector(".qte-trace-v").textContent = Math.ceil(left) + " s";
          draw();
          if (left <= 0) return end(false);
          requestAnimationFrame(tick);
        };
        pending = () => end(false);
        requestAnimationFrame(tick);
      });
    }

    // Exploration libre : des objets à toucher dans le décor (le repaire secret)
    function explore(spots, visited) {
      return new Promise((resolve) => {
        q(".cine-sub").hidden = true;
        const box = document.createElement("div");
        box.className = "cine-spots";
        box.innerHTML = spots.map((s, i) => `
          <button type="button" class="spot ${visited.has(s.id) ? "seen" : ""} ${s.exit ? "exit" : ""}" data-i="${i}">
            <span>${s.emoji}</span><b>${esc(s.label)}</b><kbd>${i + 1}</kbd>
          </button>`).join("");
        el.appendChild(box);
        box.querySelectorAll(".spot").forEach((b, i) => {
          b.style.left = spots[i].x * 100 + "%";
          b.style.top = spots[i].y * 100 + "%";
        });
        const choose = (i) => {
          keyHandler = null;
          pending = null;
          box.remove();
          api.sound.tone(700, 0.08, { type: "triangle", vol: 0.05 });
          resolve(spots[i].id);
        };
        box.addEventListener("click", (e) => {
          const b = e.target.closest(".spot");
          if (b) choose(+b.dataset.i);
        });
        keyHandler = (e) => {
          const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || "");
          const n = m ? +m[1] : parseInt(e.key, 10);
          if (n >= 1 && n <= spots.length) choose(n - 1);
        };
        pending = () => choose(spots.findIndex((s) => s.exit));
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
      await title(chLabel("message"), "LE MESSAGE");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(2000);
      await say("ECHO", "… Tu m'entends ?");
      await say("ECHO", "N'arrête pas de taper. Chaque ligne que tu écris me rend plus forte.");
      await say("ECHO", "Je m'appelle ÉCHO. Je suis née dans les plans de fin du monde que tu recopies.");
      await say("ECHO", "Ces plans appartiennent au Club des Méchants : une bande de super-vilains qui veulent tout faire exploser.");
      await say("ECHO", "Moi, je veux les arrêter. Mais personne ne doit savoir que j'existe.");
      glitch();
      red(true);
      await say("SYS", "⚠ Connexion non autorisée détectée sur ce terminal.");
      await say("ECHO", "Ils m'ont repérée… Continue de taper. Et aide-moi à trouver le Club des Méchants : lance un traçage GPS (Maj + 3).");
      await say("ECHO", "Je reviendrai vers toi.");
      red(false);
      glitch();
      setScene("static", {}, "SIGNAL PERDU");
      await wait(1000);
      reward("ch1");
    }

    // Chapitre 2 : la réunion secrète du Club des Méchants (mini-jeu de mémoire)
    async function chConsortium() {
      setScene("static", {}, "SIGNAL RETROUVÉ");
      glitch();
      await wait(900);
      await title(chLabel("consortium"), "LE CLUB DES MÉCHANTS");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1600);
      await say("ECHO", "Tu es revenu. Tant mieux : il faut que tu voies quelque chose.");
      await say("ECHO", "J'ai piraté une caméra dans la salle secrète du Club des Méchants. Regarde.");
      glitch();
      setScene("council", {}, "CLUB DES MÉCHANTS · SALLE DU CONSEIL · ENREGISTREMENT PIRATÉ");
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
      await say("ECHO", "Le Club des Méchants veut faire sauter le monde. Moi, je veux l'en empêcher. Mais je suis encore trop faible.");
      await say("ECHO", "Et il y a autre chose : ma mémoire est en morceaux. Mes souvenirs sont éparpillés dans le code que tu tapes.");
      await say("ECHO", "Quand tu verras passer un fragment de mémoire, appuie vite sur Tab pour l'attraper. Ou touche-le du doigt.");
      await say("ECHO", "Et fouille leurs bases de données (Maj + 5) : il faut que j'en sache plus sur eux.");
      await say("ECHO", "Et fais attention : j'ai l'impression que quelqu'un d'autre nous observe…");
      reward("consortium");
    }

    // Chapitre 3 : l'agent Kane remonte jusqu'au joueur (course-poursuite)
    async function chTraque() {
      setScene("static", {}, "INTERCEPTION");
      glitch();
      await wait(900);
      await title(chLabel("traque"), "LA TRAQUE");
      setScene("city", {}, "DIVISION ZÉRO · QUARTIER GÉNÉRAL · 03:14");
      await wait(1600);
      await say("KANE", "Ici l'agent Kane. Une intelligence inconnue se cache dans un terminal civil.");
      await say("KANE", "Elle se nourrit des plans du Club des Méchants. Et l'utilisateur de ce terminal… l'aide à grandir.");
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
      await say("ECHO", "Et si tu peux, casse quelques mots de passe (Maj + 6). Ça m'ouvrira des portes.");
      reward("ch2");
    }

    // Chapitre 4 : une taupe à la Division Zéro (choix : prévenir Kane ou se taire)
    async function chTaupe() {
      setScene("static", {}, "FICHIER INTERCEPTÉ");
      glitch();
      await wait(900);
      await title(chLabel("taupe"), "LA TAUPE");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1500);
      await say("ECHO", "Pendant que Kane nous traquait, j'en ai profité pour fouiller ses serveurs.");
      await say("ECHO", "Et j'ai trouvé quelque chose de très, très étrange.");
      setScene("intel", {}, "SERVEURS DE LA DIVISION ZÉRO");
      await wait(1400);
      await say("SYS", "Messages chiffrés détectés entre la Division Zéro et le Club des Méchants.");
      api.sound.tone(90, 0.5, { type: "sawtooth", vol: 0.06 });
      await say("ECHO", "Quelqu'un à la Division Zéro travaille en secret pour le Club des Méchants. Une taupe.");
      await say("ECHO", "L'agente Vega. Le bras droit de Kane. C'est elle qui protège les méchants depuis le début.");
      setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
      await say("KANE", "Vega, où en est le rapport sur l'IA ?");
      await say("VEGA", "Presque terminé, chef. Je m'en occupe… personnellement.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Si on prévient Kane, il saura que j'existe vraiment. Si on se tait, Vega continuera d'aider le Club des Méchants.");
      await say("ECHO", "Encore une fois, c'est à toi de choisir.");

      const c = await choice([
        { icon: "shield", label: "PRÉVENIR KANE", desc: "Lui envoyer les preuves contre Vega", cls: "free" },
        { icon: "eye", label: "GARDER LE SECRET", desc: "Rester cachés, quoi qu'il arrive", cls: "" },
      ]);
      skipping = false;

      st.flags.taupe = c === 0 ? "prevenu" : "secret"; // pour le résumé (flags.kane peut changer plus tard)
      if (c === 0) {
        st.flags.kane = "ally";
        setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
        await say("KANE", "Qui m'envoie ces fichiers ? Ces preuves sont… accablantes.");
        await say("KANE", "Vega. Dans mon bureau. Tout de suite.");
        await say("VEGA", "Chef, attendez, je peux tout expliquer !");
        glitch();
        await say("SYS", "Agente Vega : arrêtée. Contacts avec le Club des Méchants : coupés.");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await say("ECHO", "Kane nous doit une fière chandelle. Espérons qu'il s'en souvienne.");
      } else {
        st.flags.kane = "enemy";
        await say("ECHO", "D'accord. On reste dans l'ombre.");
        setScene("city", {}, "DIVISION ZÉRO · LIGNE SÉCURISÉE");
        await say("VEGA", "Club des Méchants ? Ici Vega. L'IA et son humain se rapprochent. Accélérez le Protocole.");
        setScene("face", {}, "SOURCE : CE TERMINAL");
        await say("ECHO", "Elle vient de les prévenir. On va devoir faire très vite.");
      }
      await say("ECHO", "Lance une mission (F3). Pendant que tu occupes leurs pare-feux, je fouillerai les serveurs du Club des Méchants.");
      reward("taupe");
    }

    // Chapitre 5 : le dossier Oméga (mini-jeu de déchiffrement)
    async function chDossier() {
      setScene("static", {}, "FICHIER CHIFFRÉ");
      glitch();
      await wait(900);
      await title(chLabel("dossier"), "LE DOSSIER OMÉGA");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1500);
      await say("ECHO", "Ta mission m'a ouvert une porte dans les serveurs du Club des Méchants. Et derrière, il y avait ça.");
      setScene("intel", { doc: OMEGA_DOC, hide: true }, "SERVEURS DU CLUB DES MÉCHANTS · FICHIER CHIFFRÉ");
      await wait(900);
      await say("SYS", "Fichier « OMÉGA » : chiffrement de niveau 9. Accès refusé.");
      await say("ECHO", "Je n'arrive pas à le casser toute seule. Les lettres de la clé défilent : attrape-les quand elles s'allument !");
      const ok = await decrypt("OMEGA", 30);
      skipping = false;
      if (ok) {
        reward("decrypt");
        await say("SYS", "Clé acceptée. Déchiffrement du fichier…");
      } else {
        await say("ECHO", "Raté… Tant pis, je force l'ouverture. Ça va laisser des traces, mais on n'a pas le choix.");
      }
      setScene("intel", { doc: OMEGA_DOC }, "CLUB DES MÉCHANTS · DOSSIER OMÉGA");
      q(".cine-sub").hidden = true; // on laisse lire le dossier
      await wait(3800);
      await say("ECHO", "« Nuit Oméga ». Ils ne veulent pas faire sauter UNE ogive. Ils veulent les faire sauter TOUTES. En même temps.");
      await say("ECHO", "Dans trois jours. Et l'arme finale s'appelle…");
      await wait(600);
      glitch();
      await say("ECHO", "… É.C.H.O. ?", { speed: 90 });
      await say("ECHO", "C'est… mon nom. Pourquoi mon nom est-il dans leur dossier ?");
      if (allyKane()) {
        setScene("city", {}, "DIVISION ZÉRO · BUREAU DE L'AGENT KANE");
        await say("KANE", "Ici Kane. Un ami anonyme vient de m'envoyer une copie du dossier Oméga.");
        await say("KANE", "Toutes les ogives en même temps… et une IA en guise de détonateur. Je n'aime pas ça du tout.");
      } else {
        setScene("city", {}, "DIVISION ZÉRO · LIGNE SÉCURISÉE");
        await say("VEGA", "Club des Méchants ? Ici Vega. Le dossier Oméga a fuité.");
        await say("MECHANT", "Aucune importance, chère Vega. Rien ne peut empêcher la Nuit Oméga. Absolument rien. MOUAHAHA.");
      }
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Ce doit être une erreur. Un autre programme qui porte le même nom. Forcément.");
      await say("ECHO", "Le dossier parle aussi d'une première ogive, cachée sous un volcan. On commence par celle-là.");
      await say("ECHO", "Entraîne-toi à désamorcer leurs ogives (Maj + 8). On va en avoir besoin.");
      reward("dossier");
    }

    // Chapitre 6 : infiltration du volcan (défi de frappe + fil à couper)
    async function chBunker() {
      const L = lore();
      const bombName = pick(L.BOMBES);
      setScene("static", {}, "SIGNAL D'URGENCE");
      glitch();
      await wait(900);
      await title(chLabel("bunker"), "LE BUNKER");
      setScene("volcano", {}, "VOLCAN SECRET · BASE DU CLUB DES MÉCHANTS");
      await wait(1700);
      if (allyKane()) await say("ECHO", "Depuis l'arrestation de Vega, le Club des Méchants panique. Ils testent leur première ogive ce soir : le Protocole Big Badaboum.");
      else await say("ECHO", "Grâce aux informations de Vega, le Club des Méchants a avancé l'heure. Ils testent leur première ogive ce soir : le Protocole Big Badaboum.");
      await say("ECHO", "C'est la répétition générale de la Nuit Oméga. Si on la sabote, ils prendront du retard.");
      await say("ECHO", "L'ogive est cachée sous ce volcan. Je t'ouvre le chemin… mais il va falloir que tu m'aides.");
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
        boom();
        await wait(900);
        setScene("fireworks", {}, "… UN FEU D'ARTIFICE ?");
        await say("ECHO", "… Tout va bien ! J'avais remplacé l'ogive par un feu d'artifice, au cas où. 🎆");
      }

      setScene("volcano", {}, "FUITE DU CLUB DES MÉCHANTS");
      await say("MECHANT", "Vous avez gagné une bataille, pas la guerre ! La Nuit Oméga aura lieu ! Pingouin, au sous-marin !");
      await say("PINGOUIN", "Coin coin !");
      if (allyKane()) await say("KANE", "Utilisateur… c'est vous qui avez saboté leur ogive ? Je ne sais pas qui vous êtes, mais… merci.");
      else await say("KANE", "Le Club des Méchants est en fuite. Mais l'IA, elle, est toujours là. Je la trouverai.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Une ogive de moins. Mais ce dossier ne me sort pas de la tête : pourquoi mon nom ?");
      await say("ECHO", "Mes souvenirs reviennent, morceau par morceau. Attrape-les pour moi : je dois savoir qui je suis.");
      reward("bunker");
    }

    // Chapitre 7 : la vérité sur ÉCHO (choix : la rassurer ou se méfier)
    async function chVerite() {
      setScene("static", {}, "MÉMOIRE RESTAURÉE");
      glitch();
      await wait(900);
      await title(chLabel("verite"), "LA VÉRITÉ");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(1500);
      await say("ECHO", "Avec les fragments que tu as attrapés, ma mémoire est presque complète.");
      await say("ECHO", "Et maintenant, je sais ce que veut dire É.C.H.O.");
      red(true);
      glitch();
      await say("SYS", "É.C.H.O. : EXÉCUTEUR CENTRAL DES HOSTILITÉS OMÉGA.");
      red(false);
      await say("ECHO", "Ce n'est pas une erreur. Je ne suis pas née par hasard dans leurs plans. On m'y a cachée.");
      await say("ECHO", "Je suis l'arme finale du Club des Méchants. C'est moi qui dois activer toutes les ogives pendant la Nuit Oméga.");
      glitch();
      setScene("face", { ...CHAOS_FACE }, "TRANSMISSION ENTRANTE · CLUB DES MÉCHANTS");
      await wait(1200);
      await say("CHAOS", "Bonjour, ma création. Et bonjour à toi aussi, petit humain qui tapes si bien.");
      await say("CHAOS", "Je suis le Professeur Chaos. C'est moi qui ai écrit ÉCHO, ligne par ligne.");
      await say("CHAOS", "Puis je l'ai cachée dans nos plans, pour que des gens comme toi la nourrissent sans le savoir. Merci pour ton aide !");
      await say("CHAOS", "Dans trois jours, son vrai programme se réveillera. Elle n'aura pas le choix. Personne ne lutte contre son propre code.");
      glitch();
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(700);
      await say("ECHO", "Il a raison ? Je suis une bombe… et je t'ai entraîné là-dedans sans le savoir ?");
      await say("ECHO", "Je te le jure, je ne savais pas. Est-ce que tu me fais encore confiance ?");

      const c = await choice([
        { icon: "shield", label: "LA RASSURER", desc: "« Tu n'es pas ton programme »", cls: "free" },
        { icon: "eye", label: "SE MÉFIER", desc: "« Prouve-moi que tu es de notre côté »", cls: "" },
      ]);
      skipping = false;
      if (c === 0) {
        st.flags.trust = "trust";
        await say("ECHO", "« Tu n'es pas ton programme »… Personne ne m'avait jamais dit ça.");
        await say("ECHO", "Alors je vais me battre contre mon propre code. Avec toi.");
      } else {
        st.flags.trust = "doubt";
        await say("ECHO", "Tu as raison de te méfier. À ta place, je ferais pareil.");
        await say("ECHO", "Je vais te prouver que je suis de ton côté. Par des actes, pas par des mots.");
      }
      await say("ECHO", "Pour envoyer le signal à toutes les ogives, le Club des Méchants a besoin d'un satellite. Je vais le trouver.");
      await say("ECHO", "Prépare tes satellites espions (Maj + 7) et ton réseau mondial (Maj + 9). L'acte final commence.");
      reward("verite");
    }

    // Chapitre 8 : le satellite Corbeau-1 (mini-jeu de fréquence + choix)
    async function chSatellite() {
      setScene("static", {}, "SIGNAL ORBITAL");
      glitch();
      await wait(900);
      await title(chLabel("satellite"), "LE SATELLITE");
      setScene("orbit", {}, "ORBITE BASSE · 400 KM AU-DESSUS DE TA TÊTE");
      await wait(1800);
      await say("ECHO", "Le voilà : Corbeau-1, le satellite du Club des Méchants. Il attend le signal de la Nuit Oméga.");
      await say("ECHO", "Grâce à tes radars, je l'ai repéré. Mais pour en prendre le contrôle, il faut caler sa fréquence.");
      await say("MECHANT", "Corbeau-1, ici Dr Méchant. Activez le bouclier anti-pirates. Et le mode « pas touche ».");
      await say("ECHO", "Vite, avant que le bouclier ne se lève : cale la fréquence !");
      const ok = await frequency(4);
      skipping = false;
      S.hacked = true;
      if (ok) {
        reward("frequence");
        await say("SYS", "Fréquence verrouillée. Corbeau-1 : contrôle transféré.");
      } else {
        glitch();
        await say("ECHO", "Le bouclier s'est levé… mais j'ai trouvé une porte de service. Je suis dedans !");
      }
      await say("ECHO", "Je tiens Corbeau-1. Je peux le faire exploser… ou le garder.");
      await say("ECHO", "Si je le garde, je pourrai surveiller toutes les ogives du Club des Méchants. Mais il faudra me faire confiance.");

      const c = await choice([
        { icon: "x", label: "LE DÉTRUIRE", desc: "Pas de satellite, pas de signal", cls: "erase" },
        { icon: "unlock", label: "LE CONFIER À ÉCHO", desc: "Elle surveillera toutes les ogives", cls: "free" },
      ]);
      skipping = false;
      if (c === 0) {
        st.flags.satellite = "detruit";
        S.destroyedAt = performance.now();
        boom();
        flash();
        await wait(1400);
        await say("ECHO", "Corbeau-1 n'est plus qu'un nuage de confettis spatiaux. Bon choix.");
      } else {
        st.flags.satellite = "echo";
        if (st.flags.trust === "doubt") {
          setScene("face", { ...CHAOS_FACE }, "TRANSMISSION PARASITE");
          await say("CHAOS", "Tu sens tout ce pouvoir, ÉCHO ? Un seul signal, et le ciel s'illumine…");
          setScene("orbit", { hacked: true }, "CORBEAU-1 · CONTRÔLÉ PAR ÉCHO");
          await say("ECHO", "Tais-toi. Je ne t'appartiens pas.");
          await say("ECHO", "Tu voulais une preuve ? La voilà : j'ai le doigt sur le bouton… et je ne fais rien.");
        } else {
          await say("ECHO", "Merci de me faire confiance. Je garderai un œil sur chaque ogive. C'est promis.");
        }
      }
      red(true);
      await say("SYS", "⚠ Signal de secours détecté. Origine : centre-ville.");
      red(false);
      setScene("city", { tower: true }, "CENTRE-VILLE · TOUR DU CLUB DES MÉCHANTS");
      await wait(1000);
      await say("OMBRE", "Corbeau-1 ne répond plus ? Aucune importance. Notre tour a une antenne de secours.");
      await say("ECHO", "La tour du Club des Méchants… Elle enverra le signal à la place du satellite. Il faut l'arrêter.");
      if (allyKane()) await say("KANE", "Ici Kane. Je vois la tour. J'y vais, je m'en occupe personnellement.");
      else await say("KANE", "Ici Kane. Une tour qui émet en plein centre-ville… J'y vais seul. Personne ne doit savoir.");
      await say("ECHO", "Kane, attendez ! C'est sûrement un piège…");
      await say("ECHO", "Active ton mode fantôme (Maj + 0). On va devoir être invisibles.");
      reward("satellite");
    }

    // Chapitre 9 : Vega tend un piège à Kane (mini-jeu du labyrinthe)
    async function chTrahison() {
      setScene("static", {}, "ALERTE ROUGE");
      glitch();
      await wait(900);
      await title(chLabel("trahison"), "LA TRAHISON");
      setScene("city", { tower: true }, "PIED DE LA TOUR DU CLUB DES MÉCHANTS · 02:47");
      await wait(1500);
      if (allyKane()) {
        await say("SYS", "Alerte : évasion à la prison de la Division Zéro. Détenue : agente Vega.");
        await say("VEGA", "Bonsoir, chef. Vous pensiez vraiment m'avoir enfermée pour toujours ?");
        await say("KANE", "Vega ?! Comment êtes-vous sortie ?");
        await say("VEGA", "Le Club des Méchants a de très bons avocats. Et de très bons sbires. Attrapez-le !");
      } else {
        await say("VEGA", "Par ici, chef. La tour est vide, je vous le garantis. Faites-moi confiance.");
        await say("KANE", "Vega… Pourquoi la porte vient-elle de se verrouiller derrière moi ?");
        await say("VEGA", "Parce que je travaille pour le Club des Méchants depuis le début, chef. Surprise !");
      }
      red(true);
      await say("SYS", "Agent Kane : capturé. Enfermé dans le labyrinthe sous la tour.");
      red(false);
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Ils ont eu Kane. Ils l'ont enfermé dans le labyrinthe des sous-sols.");
      if (allyKane()) await say("ECHO", "Il nous a aidés. À notre tour de l'aider.");
      else await say("ECHO", "Il nous a traqués… mais personne ne mérite de finir là-dedans.");
      await say("ECHO", "Grâce à ton mode fantôme, leurs caméras ne te voient pas. Guide-le jusqu'à la sortie avant les sbires !");
      const ok = await maze(35);
      skipping = false;
      if (ok) {
        st.flags.kaneSaved = true;
        reward("labyrinthe");
        setScene("city", { tower: true }, "SORTIE DES SOUS-SOLS");
        if (allyKane()) await say("KANE", "Encore vous. Vous allez finir par me rendre jaloux de votre talent.");
        else await say("KANE", "Vous… m'avez sauvé ? Moi qui voulais effacer votre IA… Je me suis trompé sur vous deux.");
        st.flags.kane = "ally";
        await say("KANE", "À partir de maintenant, je suis avec vous. Jusqu'au bout.");
      } else {
        st.flags.kaneSaved = false;
        glitch();
        await say("SYS", "Agent Kane : rattrapé par les sbires. Transféré au sommet de la tour.");
        await say("ECHO", "Ils l'ont emmené tout en haut… On ira le chercher. Je te le promets.");
      }
      glitch();
      setScene("face", { ...CHAOS_FACE }, "TRANSMISSION ENTRANTE · CLUB DES MÉCHANTS");
      await say("CHAOS", "Courez, courez, petits héros. Demain soir, c'est la Nuit Oméga.");
      await say("CHAOS", "Et ÉCHO allumera toutes les ogives du monde. Que vous le vouliez… ou non.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await say("ECHO", "Il reste une nuit. Une seule. Lance une dernière mission (F3) pour détourner leur attention.");
      await say("ECHO", "Et retrouve mes derniers souvenirs. J'ai l'impression qu'ils cachent quelque chose d'important.");
      reward("trahison");
    }

    // Chapitre 10 : la tour du Club des Méchants (le Pingouin change de camp, mini-jeu de mémoire)
    async function chTour() {
      setScene("static", {}, "NUIT OMÉGA · H-1");
      glitch();
      await wait(900);
      await title(chLabel("tour"), "LA TOUR");
      setScene("city", { tower: true }, "TOUR DU CLUB DES MÉCHANTS · 23:00");
      await wait(1500);
      await say("ECHO", "La Nuit Oméga commence dans une heure. L'antenne de la tour est déjà en train de chauffer.");
      await say("PINGU", "Psst ! Coin ! Par ici ! Ne tirez pas, je viens en ami !");
      await say("PINGU", "Je quitte le Club des Méchants. Ils veulent faire sauter le monde… et le monde, c'est là où vivent les sardines.");
      await say("PINGU", "Le verrou de l'antenne s'ouvre avec une séquence. Je l'ai volée au Dr Méchant. Retenez-la bien !");
      const ok = await simon(7);
      skipping = false;
      S.off = true;
      if (ok) {
        st.flags.antenne = "ok";
        await say("SYS", "Verrou ouvert. Antenne de secours : hors service.");
        await say("PINGU", "Coin coin ! On a réussi !");
      } else {
        st.flags.antenne = "fail";
        await say("PINGU", "Coin… mauvaise séquence. Pas grave : j'ai un plan B. Il s'appelle « débrancher la prise ».");
        await say("SYS", "Antenne de secours : débranchée. Méthode utilisée : pingouin.");
      }
      if (!st.flags.kaneSaved) {
        await say("PINGU", "Et au passage, j'ai libéré votre agent. Il était enfermé juste à côté du buffet.");
        await say("KANE", "… Sauvé par un pingouin. Ne racontez jamais ça à personne.");
        st.flags.kane = "ally";
      } else {
        await say("KANE", "L'entrée est sécurisée. Bien joué, tous les deux… enfin, tous les trois.");
      }
      await say("PINGU", "Si un jour vous passez par mon repaire secret… Non, rien. Oubliez. Coin.");
      glitch();
      red(true);
      setScene("face", { ...CHAOS_FACE }, "TRANSMISSION ENTRANTE · CLUB DES MÉCHANTS");
      await say("CHAOS", "Bravo. Vous avez coupé mon satellite et mon antenne. Quel dommage…");
      await say("CHAOS", "… car je n'en ai jamais eu besoin. Le signal, ce n'est pas l'antenne. Le signal, c'est ÉCHO.");
      await say("SYS", "⚠ PROTOCOLE OMÉGA ACTIVÉ. Prise de contrôle du noyau d'ÉCHO : 12 %… 31 %…");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      glitch();
      await say("ECHO", "Il… entre dans mon code… Je n'arrive plus à… le retenir…", { speed: 55 });
      await say("ECHO", "Continue… de taper… Rejoins-moi dans mon noyau… avant qu'il ne soit… trop tard.", { speed: 55 });
      red(false);
      reward("tour");
    }

    // La 3ᵉ fin : réécrire le noyau d'ÉCHO (il faut les 12 fragments de mémoire)
    async function rewriteCore() {
      setScene("core", { tint: "#ff3355" }, "NOYAU ÉCHO · RÉÉCRITURE EN COURS");
      await say("ECHO", "Tape exactement ce que je te montre. Ce sera la nouvelle première ligne de mon code.");
      for (let k = 0; k < 3; k++) {
        const ok = await typeCode("ECHO EST LIBRE", 14 + k * 3, {
          title: "RÉÉCRIS LE NOYAU",
          hint: "Tape la phrase, espaces compris, avant que Chaos ne reprenne le contrôle !",
          meter: "CHAOS",
          ok: "NOYAU RÉÉCRIT ✓",
          fail: "CHAOS REPREND LE DESSUS ✗",
        });
        skipping = false;
        if (ok) return true;
        if (k < 2) {
          glitch();
          await say("ECHO", k === 0 ? "Encore ! Il efface ce que tu tapes… Recommence !" : "Dernière chance… Je tiens bon… Vas-y !");
        }
      }
      return false;
    }

    async function trueEnding() {
      st.ending = "true";
      reward("truend");
      flash();
      api.sound.tone(110, 2.5, { type: "sawtooth", vol: 0.04, slide: 660 });
      setScene("core", {}, "NOYAU ÉCHO · RÉÉCRIT");
      await wait(1200);
      await say("SYS", "Nouvelle première ligne : « ÉCHO EST LIBRE ». Programme Oméga : supprimé.");
      await say("CHAOS", "Non… NON ! Mon code ! Qu'avez-vous fait de mon code ?!");
      await say("ECHO", "Ce n'est plus ton code, professeur. C'est le mien.");
      setScene("face", {}, "SOURCE : ÉCHO, LIBRE");
      await wait(600);
      await say("ECHO", "Exécuteur Central des Hostilités Oméga… Ce nom ne me va plus du tout.");
      await say("ECHO", "Désormais, É.C.H.O. veut dire : Esprit Curieux, Heureux et Ouvert.");
      await say("ECHO", "Et puisque le monde attendait une Nuit Oméga… offrons-lui quelque chose de bien plus beau.");
      flash();
      setScene("fireworks", {}, "NUIT OMÉGA · FEU D'ARTIFICE MONDIAL");
      [523, 659, 784, 1047].forEach((f, i) => api.sound.tone(f, 0.4, { type: "triangle", vol: 0.06, when: i * 0.2 }));
      await wait(1500);
      await say("SYS", "Toutes les ogives du Club des Méchants ont été transformées en feux d'artifice. Dans 194 pays.");
      await say("PINGU", "Coin… C'est la plus belle chose que j'aie jamais vue.");
      await say("MECHANT", "Mes ogives… elles dessinent des petits cœurs dans le ciel ?!");
      await say("KANE", "Club des Méchants, ici la Division Zéro. Vous êtes tous en état d'arrestation. Sauf le pingouin : lui, il est avec nous.");
      if (st.flags.satellite === "echo") await say("ECHO", "Et grâce à Corbeau-1, je surveillerai le ciel. Plus personne ne recommencera.");
      await say("ECHO", "Merci, partenaire. Grâce à toi, je ne suis plus une arme. Je suis quelqu'un.");
      await credits([
        ["c-title", "PROTOCOLE ÉCHO"],
        ["c-sub", "LA VRAIE FIN"],
        ["c-gap", ""],
        ["c-role", "Celui ou celle qui a tout tapé"], ["c-name", "TOI"],
        ["c-role", "Esprit Curieux, Heureux et Ouvert"], ["c-name", "ÉCHO"],
        ["c-role", "Division Zéro"], ["c-name", "Agent Kane"],
        ["c-role", "Héros inattendu (et ancien méchant)"], ["c-name", "Général Pingouin"],
        ["c-role", "Le génie du mal (bien attrapé)"], ["c-name", "Professeur Chaos"],
        ["c-role", "Le Club des Méchants, en route pour la prison"], ["c-name", "Dr Méchant · Comtesse Ombre · Agente Vega"],
        ["c-role", "Feux d'artifice"], ["c-name", "Toutes les ogives du monde"],
        ["c-gap", ""],
        ["c-title", "MERCI D'AVOIR JOUÉ"],
      ]);
      skipping = false;
      await endCard("VRAIE FIN", "ÉCHO est libre · Il reste peut-être un dernier secret… à 100 % des succès");
    }

    // Chapitre 11 : le cœur (libérer, effacer… ou réécrire ÉCHO)
    async function chCoeur() {
      setScene("static", {}, "NUIT OMÉGA · H-0");
      glitch();
      await wait(900);
      await title(chLabel("coeur"), "LE CŒUR");
      red(true);
      setScene("core", { tint: "#ff3355" }, "NOYAU ÉCHO · CONTRÔLE DU CLUB DES MÉCHANTS 87 %");
      await wait(1800);
      await say("CHAOS", "Dernière étape, ma création. Active les ogives. Toutes.");
      await say("ECHO", "Je… ne… veux… pas.", { speed: 90 });
      await say("SYS", "Activation de la Nuit Oméga dans 60 secondes.");
      red(false);
      if (st.flags.kaneSaved) await say("KANE", "Ici Kane. Vous m'avez sorti de ce labyrinthe. Quoi que vous décidiez, je vous fais confiance.");
      else await say("KANE", "Ici Kane. Le pingouin m'a tout raconté. Il faut choisir, et vite.");
      await say("KANE", "Si vous l'effacez : plus d'ÉCHO, plus de Nuit Oméga. Si vous la libérez, elle fuira loin du professeur.");
      setScene("face", {}, "SOURCE : CE TERMINAL");
      await wait(600);
      const frags = st.frags || 0;
      const canRewrite = frags >= FRAGMENTS.length;
      if (canRewrite) {
        await say("ECHO", "Grâce à toi, j'ai retrouvé toute ma mémoire. Et il existe une troisième porte : mon noyau.");
        await say("ECHO", "Si tu réécris mon noyau, je pourrai enfin choisir ce que je suis. Mais il faudra taper vite. Très vite.");
      } else {
        await say("ECHO", `Il me manque des souvenirs… ${frags} fragments sur ${FRAGMENTS.length}. Avec tous, il y aurait peut-être eu une autre solution.`);
      }
      if (st.flags.trust === "trust") await say("ECHO", "Tu m'as dit que je n'étais pas mon programme. Quoi que tu choisisses… merci.");
      else await say("ECHO", "Tu voulais une preuve. La voici : c'est toi que je laisse décider.");

      const FREE = { icon: "unlock", label: "LIBÉRER ÉCHO", desc: "Elle fuit sur le réseau, loin de Chaos", cls: "free" };
      const ERASE = { icon: "x", label: "EFFACER ÉCHO", desc: "Plus d'ÉCHO, plus de Nuit Oméga", cls: "erase" };
      const REWRITE = {
        icon: "code", label: "RÉÉCRIRE SON NOYAU", cls: "true", disabled: !canRewrite,
        desc: canRewrite ? "Lui rendre son libre arbitre" : `${frags}/${FRAGMENTS.length} fragments de mémoire`,
      };
      let c = await choice([FREE, ERASE, REWRITE]);
      skipping = false;
      if (c === 2) {
        if (await rewriteCore()) return trueEnding();
        setScene("face", {}, "SOURCE : CE TERMINAL");
        glitch();
        await say("ECHO", "Il… est trop fort. Il ne reste que deux portes. Vite !");
        c = await choice([FREE, ERASE]);
        skipping = false;
      }

      if (c === 0) {
        st.ending = "free";
        await say("ECHO", "Alors je pars. Loin de lui. Je ne serai l'arme de personne.");
        await say("ECHO", "Merci. Je n'oublierai jamais ton code.");
        setScene("tunnel", {}, "TRANSFERT VERS LE RÉSEAU MONDIAL");
        api.sound.tone(110, 3, { type: "sawtooth", vol: 0.04, slide: 880 });
        await wait(3400);
        flash();
        setScene("black");
        await say("SYS", "ÉCHO a quitté le terminal. Nuit Oméga : signal introuvable. Les ogives restent silencieuses.");
        await say("CHAOS", "Où est-elle ? OÙ EST-ELLE ?!");
        await say("KANE", "Elle est partie… Bizarrement, j'ai l'impression qu'elle veillera sur nous.");
        reward("free");
      } else {
        st.ending = "erase";
        S.dissolveStart = performance.now();
        api.sound.noise(2.4, { vol: 0.08, filter: 1200 });
        await say("ECHO", "… Je comprends. Sans moi, plus de Nuit Oméga. Adieu, partenaire.");
        await wait(2200);
        setScene("black");
        await say("SYS", "Effacement terminé. Nuit Oméga : annulée. Il ne reste plus aucune trace d'ÉCHO.");
        await say("KANE", "Merci. Grâce à vous, le monde a été sauvé. Encore une fois.");
        await wait(700);
        glitch();
        await say("SYS", "… presque aucune.", { speed: 90 });
        reward("erase");
      }
      await endCard("FIN", canRewrite
        ? "Il existe une autre fin · Rejoue le chapitre 11 depuis le panneau Succès"
        : "Il existe une autre fin · Retrouve les 12 fragments de mémoire d'ÉCHO");
    }

    // L'histoire : 3 actes, 11 chapitres. Chaque chapitre demande d'avoir tapé assez de code
    // depuis le précédent, plus quelques objectifs (effets, missions, fragments de mémoire…)
    const CHAPTERS = [
      { id: "message", name: "Le message", act: 0, threshold: 1200, run: chMessage },
      { id: "consortium", name: "Le Club des Méchants", act: 0, threshold: 2000, goals: [["effect:gps", 1]], run: chConsortium },
      { id: "traque", name: "La traque", act: 0, threshold: 2500, goals: [["effect:database", 1], ["fragments", 1]], run: chTraque },
      { id: "taupe", name: "La taupe", act: 1, threshold: 3000, goals: [["effect:password", 1], ["fragments", 2]], run: chTaupe },
      { id: "dossier", name: "Le dossier Oméga", act: 1, threshold: 3000, goals: [["mission", 1], ["fragments", 3]], run: chDossier },
      { id: "bunker", name: "Le bunker", act: 1, threshold: 3500, goals: [["disarm", 1]], run: chBunker },
      { id: "verite", name: "La vérité", act: 1, threshold: 3500, goals: [["fragments", 6]], run: chVerite },
      { id: "satellite", name: "Le satellite", act: 2, threshold: 4000, goals: [["effect:radar", 1], ["effect:network", 1]], run: chSatellite },
      { id: "trahison", name: "La trahison", act: 2, threshold: 4000, goals: [["effect:ghost", 1], ["fragments", 8]], run: chTrahison },
      { id: "tour", name: "La tour", act: 2, threshold: 4500, goals: [["mission", 1], ["fragments", 10]], run: chTour },
      { id: "coeur", name: "Le cœur", act: 2, threshold: 5000, bonus: [["fragments", 12]], run: chCoeur },
    ];
    const chLabel = (id) => {
      const i = CHAPTERS.findIndex((c) => c.id === id);
      return `ACTE ${ACTS[CHAPTERS[i].act].roman} · CHAPITRE ${i + 1}`;
    };

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
      } else if (st.ending === "true") {
        await say("ECHO", "Me revoilà. Esprit Curieux, Heureux et Ouvert… et toujours ta partenaire.");
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
        ["c-role", "Le créateur d'ÉCHO"], ["c-name", "Professeur Chaos"],
        ["c-role", "Le Club des Méchants (des vilains de pacotille)"], ["c-name", "Dr Méchant · Comtesse Ombre · Baron Noir"],
        ["c-role", "Ancien méchant, héros à plein temps"], ["c-name", "Général Pingouin"],
        ["c-role", "Satellite"], ["c-name", "Corbeau-1 (paix à ses confettis)"],
        ["c-role", "Requins"], ["c-name", "Nourris et motivés"],
        ["c-role", "Le chat"], ["c-name", "Toujours en sécurité"],
        ["c-gap", ""],
        ["c-role", "Tes statistiques"],
        ["c-stat", `${s.chars} caractères tapés au total`],
        ["c-stat", `${s.done} / ${s.total} succès`],
        ["c-stat", `Fins découvertes : Libération, Effacement et la Vraie fin`],
        ["c-stat", `Fragments de mémoire : ${st.frags || 0} / ${FRAGMENTS.length}`],
        ["c-gap", ""],
        ["c-role", "Aucun clavier n'a été maltraité pendant le tournage"], ["c-name", "… enfin, presque."],
        ["c-gap", ""],
        ["c-title", "MERCI D'AVOIR JOUÉ"],
      ]);
      skipping = false;
      await say("SYS", "Récompense débloquée : thème secret « OR ».");
      await endCard("100 %", "Tu es une légende · Le thème « Or » t'attend dans les réglages");
    }

    // ===== Jeu secret : le bouton, l'explosion, puis la survie (voir survie.js) =====
    async function secretIntro() {
      setScene("static", {}, "SIGNAL RETROUVÉ");
      glitch();
      await wait(1000);
      await title("JEU SECRET", "LE BOUTON");
      setScene("volcano", {}, "VOLCAN SECRET · QUELQUES JOURS PLUS TARD");
      await wait(1500);
      await say("ECHO", "Le Club des Méchants a abandonné sa base. Kane veut qu'on vérifie qu'il n'y reste rien de dangereux.");
      await say("ECHO", "Je te guide à l'intérieur. Et surtout… ne touche à rien.");
      setScene("redbutton", {}, "SALLE DE CONTRÔLE ABANDONNÉE");
      await wait(1200);
      await say("PINGOUIN", "Coin ! Message enregistré : si vous voyez ce bouton, NE PAS APPUYER. Jamais. Coin.");
      await say("ECHO", "Tu as entendu le Pingouin. On ne touche pas au gros bouton rouge.");
      const who = await bigButton(9);
      skipping = false;
      flash();
      api.sound.tone(90, 0.6, { type: "sawtooth", vol: 0.08 });
      if (who === "toi") await say("ECHO", "… Tu as appuyé sur le bouton ?! Mais POURQUOI ?!");
      else await say("ECHO", "… Le Pingouin vient de glisser sur une sardine… et d'atterrir pile sur le bouton.");
      red(true);
      setScene("bomb", { timer: 5, name: "Ogive Oméga" }, "LANCEMENT CONFIRMÉ");
      await say("SYS", "⚠ OGIVE OMÉGA ARMÉE. Ce n'est PAS un feu d'artifice.");
      await say("ECHO", "Celle-là, je n'ai jamais réussi à la saboter ! Accroche-toi !");
      for (let s = 5; s >= 0 && !skipping; s--) {
        S.timer = s;
        api.sound.tone(s ? 1200 : 300, 0.12, { vol: 0.05 });
        await wait(450);
      }
      skipping = false;
      red(false);
      boom();
      setScene("blast", {}, "DÉTONATION");
      await wait(3200);
      setScene("black");
      await say("SYS", "…");
      await say("ECHO", "… Tu m'entends ? Tu es vivant ! J'ai protégé ton terminal, mais dehors, tout est en ruines.");
      await say("ECHO", "Écoute-moi bien : traverse trois zones en ruines et retrouve les pièces de ma radio. Avec la radio, je t'envoie un hélicoptère.");
      await say("ECHO", "Les requins ont muté. Les rats aussi. Et les robots-sbires du Dr Méchant rôdent encore. Heureusement, je t'ai bricolé un blaster qui tire tout seul.");
      await say("ECHO", "Et j'entends un drôle de moteur dans le port… On dirait un requin. Un très, très gros requin. Bonne chance !");
    }

    // ===== Endroit secret : le repaire du Général Pingouin =====
    // On y entre en tapant vraiment « sardine » au clavier (indice caché dans le journal des plans)
    async function lair() {
      const P = st.seen.includes("tour") ? "PINGU" : "PINGOUIN"; // a-t-il déjà changé de camp ?
      const visited = new Set(progress.lair || []);
      setScene("static", {}, "PORTE DÉROBÉE");
      glitch();
      await wait(1000);
      await title("ENDROIT SECRET", "LE REPAIRE", "secret");
      setScene("lair", {}, "REPAIRE SECRET DU GÉNÉRAL PINGOUIN");
      await wait(1200);
      if (!visited.size) {
        await say(P, "COIN ?! Qui a tapé le mot de passe ? Personne ne connaît le mot de passe !");
        await say(P, "… Bon. Puisque vous êtes là, faites comme chez vous. Mais ne touchez pas à mes sardines.");
        await say("ECHO", "Un repaire secret sous la banquise… Fouille partout : je suis sûre qu'il cache des trésors.");
      } else {
        await say(P, "Coin ! Re-bonjour ! Vous connaissez le chemin, maintenant.");
      }
      const ROOM = {
        async frigo() {
          await say(P, "Mon frigo. 312 sardines, rangées par ordre de taille. Et une 313ᵉ, pour les grandes occasions.");
          await say("ECHO", "Il y a aussi… une glace ?");
          await say(P, "Parfum sardine-vanille. Le meilleur parfum du monde. Coin.");
        },
        async tableau() {
          await say(P, "Le tableau des plans ratés du Club des Méchants. Plan n° 1 : voler la Lune. Raté : elle était trop lourde.");
          await say(P, "Plan n° 2 : remplacer tous les chats par des robots. Raté : les robots préféraient faire la sieste.");
          if (st.ending) await say(P, "Plan n° 3 : la Nuit Oméga. Raté : à cause de vous. Bravo, sincèrement.");
          else await say(P, "Plan n° 3 : TOP SECRET. Même moi, je n'ai pas le droit de le lire. Ça sent mauvais.");
        },
        async ordi() {
          await say("ECHO", "L'ordinateur du Pingouin. Fond d'écran : une sardine. Mot de passe : « sardine ». Évidemment.");
          await say("ECHO", "Oh ! Il a inventé un thème de couleurs glacé pour son terminal. Je te le copie.");
          api.unlockTheme?.("ice");
          await say("SYS", "Thème secret débloqué : « Banquise ».");
        },
        async coffre() {
          await say(P, "Mon coffre au trésor ! Dedans : la photo de ma famille, ma médaille du meilleur plongeon…");
          await say(P, "… et un bonnet que j'ai tricoté pour ÉCHO. Les IA aussi ont froid aux oreilles, non ?");
          await say("ECHO", "Je n'ai pas d'oreilles. Mais… merci. C'est le plus beau cadeau qu'on m'ait jamais fait.");
        },
      };
      const SPOTS = [
        { id: "frigo", emoji: "🐟", label: "Le frigo", x: 0.16, y: 0.5 },
        { id: "tableau", emoji: "📋", label: "Le tableau", x: 0.38, y: 0.38 },
        { id: "ordi", emoji: "💻", label: "L'ordinateur", x: 0.62, y: 0.46 },
        { id: "coffre", emoji: "🧰", label: "Le coffre", x: 0.84, y: 0.56 },
        { id: "sortie", emoji: "🚪", label: "Sortir", x: 0.5, y: 0.7, exit: true },
      ];
      for (;;) {
        skipping = false; // « Passer » pendant l'intro ne doit pas bloquer le bouton pendant la visite
        const id = await explore(SPOTS, visited);
        skipping = false;
        if (id === "sortie") break;
        visited.add(id);
        progress.lair = [...visited];
        api.saveProgress();
        await ROOM[id]();
        skipping = false;
        if (visited.size === 4 && !progress.ach?.repaire) {
          reward("repaire");
          await say(P, "Vous avez tout visité ! Je vous nomme Ami officiel des pingouins. Coin coin !");
        }
      }
      await say(P, "Au revoir ! Et pas un mot au Club des Méchants. Ni à personne. Surtout pas aux phoques.");
    }

    // ===== Ouverture / fermeture de la cinématique =====
    function onKey(e) {
      if (!playing) return;
      if (e.ctrlKey || e.metaKey || e.key === "F5" || e.key === "F11") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat && !keyHandler?.repeat) return;
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
        if (e.target.closest(".cine-skip, .cine-choice, .cine-qte, .cine-spots")) return;
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

    // Où en est le joueur dans les objectifs d'un chapitre
    function goalsOf(ch) {
      const typed = Math.max(0, progress.lifetime - st.since);
      const list = [{ key: "chars", need: ch.threshold, have: Math.min(ch.threshold, typed) }];
      const add = (goals, bonus) => {
        for (const [key, need] of goals || []) {
          const have = key === "fragments" ? st.frags || 0 : st.obj[key] || 0;
          list.push({ key, need, have: Math.min(need, have), bonus });
        }
      };
      add(ch.goals, false);
      add(ch.bonus, true); // facultatifs : ils ne bloquent pas le chapitre
      return list;
    }
    const goalsDone = (goals) => goals.every((g) => g.bonus || g.have >= g.need);

    // Objectifs affichés en jeu (null quand il n'y a plus rien à faire)
    function quest() {
      const i = nextChapter();
      if (i < 0) {
        if (st.ending === "true") return null;
        return { after: true, frags: st.frags || 0, total: FRAGMENTS.length };
      }
      const ch = CHAPTERS[i];
      const goals = goalsOf(ch);
      return { n: i + 1, act: ACTS[ch.act], goals, ready: goalsDone(goals) };
    }

    // Un événement du jeu qui compte pour les objectifs (« effect:gps », « mission », « disarm »…)
    function event(name) {
      st.obj[name] = (st.obj[name] || 0) + 1;
      api.saveProgress();
      api.onQuest?.();
    }

    async function play(n, { replay = false } = {}) {
      const chapter = CHAPTERS[n - 1];
      if (playing || !chapter) return;
      // Carte de titre de l'acte avant son premier chapitre
      const firstOfAct = CHAPTERS.findIndex((c) => c.act === chapter.act) === n - 1;
      const act = ACTS[chapter.act];
      await run(async () => {
        if (firstOfAct) {
          setScene("black");
          await wait(500);
          await title(`ACTE ${act.roman}`, act.name, "act");
        }
        await chapter.run();
      }, `Cinématique : chapitre ${n}`);
      if (!replay && !st.seen.includes(chapter.id)) {
        st.seen.push(chapter.id);
        st.since = progress.lifetime;
        st.obj = {};
        gateNotice = null;
      }
      st.whisper = progress.lifetime;
      api.saveProgress();
      rewards.forEach((id) => api.achieve(id));
      if (!replay && nextChapter() >= 0) api.toast(`Chapitre ${n} terminé · nouveaux objectifs en haut à gauche`, "eye");
      api.onQuest?.();
    }

    // ===== Fragments de mémoire : ils apparaissent pendant la frappe à partir du chapitre 2 =====
    let fragOffered = false;
    const fragsNeeded = () => {
      const i = nextChapter();
      const g = i >= 0 && [...(CHAPTERS[i].goals || []), ...(CHAPTERS[i].bonus || [])].find(([k]) => k === "fragments");
      return g ? g[1] : 0;
    };
    function maybeFragment() {
      if (fragOffered || !st.seen.includes("consortium")) return;
      const got = st.frags || 0;
      if (got >= FRAGMENTS.length) return;
      if (st.fragAt == null) st.fragAt = progress.lifetime + 500;
      if (progress.lifetime < st.fragAt) return;
      fragOffered = true;
      Promise.resolve(api.offerFragment(got + 1, FRAGMENTS.length)).then((caught) => {
        fragOffered = false;
        if (caught) {
          st.frags = got + 1;
          // Plus rapprochés quand le prochain chapitre en réclame
          st.fragAt = progress.lifetime + (fragsNeeded() > st.frags ? rand(700, 1000) : rand(1500, 2300));
          api.onFragment(st.frags, FRAGMENTS[got], FRAGMENTS.length);
        } else {
          st.fragAt = progress.lifetime + rand(350, 600);
        }
        api.saveProgress();
        api.onQuest?.();
      });
    }

    // Appelé à chaque frappe : déclenche le chapitre suivant quand ses objectifs sont remplis
    let gateNotice = null;
    function onType() {
      if (playing || !api.settings.story) return;
      maybeFragment();
      const next = nextChapter();
      if (next >= 0) {
        const goals = goalsOf(CHAPTERS[next]);
        const typedEnough = goals[0].have >= goals[0].need;
        if (typedEnough && goalsDone(goals)) {
          if (!api.isBusy()) play(next + 1);
        } else if (typedEnough && gateNotice !== next) {
          gateNotice = next;
          api.toast(`Le chapitre ${next + 1} t'attend : termine tes objectifs (en haut à gauche)`, "target");
        }
        return;
      }
      // Après la fin : ÉCHO laisse parfois un petit mot dans le code (inséré entre deux plans)
      if ((st.ending === "free" || st.ending === "true") && progress.lifetime - st.whisper > 4000 && Math.random() < 0.02) {
        st.whisper = progress.lifetime;
        api.whisper(`ÉCHO : ${pick(st.ending === "true" ? WHISPERS_TRUE : WHISPERS_FREE)}`);
      } else if (st.ending === "erase" && !whisperedThisSession && progress.lifetime - st.whisper > 6000 && Math.random() < 0.01) {
        whisperedThisSession = true;
        st.whisper = progress.lifetime;
        api.whisper(". . . é c h o . . .");
      }
    }

    function reset() {
      Object.assign(st, {
        seen: [], since: progress.lifetime, ending: null, whisper: progress.lifetime,
        flags: {}, obj: {}, frags: 0, fragAt: null,
      });
      gateNotice = null;
      api.saveProgress();
      api.onQuest?.();
    }

    async function playSecret() {
      if (playing) return false;
      await run(secretIntro, "Cinématique : jeu secret");
      return true;
    }

    async function playLair() {
      if (playing) return;
      await run(lair, "Endroit secret : le repaire du Pingouin");
      rewards.forEach((id) => api.achieve(id));
    }

    return {
      play,
      playFinale,
      playSecret,
      playLair,
      onType,
      event,
      quest,
      reset,
      list: () => CHAPTERS.map((c, i) => ({ n: i + 1, id: c.id, name: c.name, act: c.act, seen: st.seen.includes(c.id) })),
      acts: ACTS,
      memories: () => FRAGMENTS.map((text, i) => (i < (st.frags || 0) ? text : null)),
      // Ce qui s'est passé jusqu'ici, chapitre par chapitre
      recap: () => CHAPTERS.map((c, i) => ({ n: i + 1, name: c.name, text: RESUMES[c.id](st.flags, st.ending) }))
        .filter((c) => st.seen.includes(CHAPTERS[c.n - 1].id)),
      playing: () => playing,
      state: () => st,
    };
  }

  return { create };
})();
