// Jeu secret « SURVIE » (débloqué à 100 % des succès) : l'ogive Oméga a explosé.
// Il faut survivre dans les ruines, trouver 5 pièces de radio, puis rejoindre l'hélicoptère d'ÉCHO.
window.HT_SURVIE = (() => {
  "use strict";

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;

  const PARTS_NEEDED = 5;
  const HELI_WAIT = 30;

  function create(api) {
    let playing = false;
    let el, canvas, ctx, W = 0, H = 0, rafId = 0, lastTs = 0;
    let G = null;              // état de la partie
    let ruins = [];            // décor fixe
    const keys = new Set();
    let stick = null;          // joystick tactile / souris : { sx, sy, x, y }
    let finish = null;         // résout la promesse de start()
    let best = 0;

    const q = (s) => el.querySelector(s);

    // ===== Préparation d'une partie =====
    function newGame() {
      G = {
        phase: "play",
        t: 0,
        hp: 100,
        rad: 0,
        parts: 0,
        player: { x: W / 2, y: H / 2, inv: 0, face: 1 },
        debris: [],
        clouds: [],
        sharks: [],
        items: [],
        fx: [],
        ash: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(15, 45), s: rand(1, 2.5) })),
        part: null,
        partDelay: 1,
        heli: null,
        nextDebris: 2.5,
        nextShark: 8,
        nextItem: 4,
        shake: 0,
        msg: "Trouve les pièces de radio 🔧",
        msgT: 3.5,
        geiger: 0,
      };
      for (let i = 0; i < 3; i++) addCloud();
      buildRuins();
      showPanel(null);
    }

    function buildRuins() {
      ruins = Array.from({ length: Math.round((W * H) / 26000) }, () => ({
        x: rand(0, W), y: rand(0, H), w: rand(20, 70), h: rand(10, 40), r: rand(-0.4, 0.4),
      }));
    }

    function addCloud() {
      const r = rand(70, 140);
      G.clouds.push({ x: rand(0, W), y: rand(0, H), r, vx: rand(-30, 30), vy: rand(-20, 20), ph: rand(0, 6) });
    }

    // Un point loin du joueur (pour les pièces et la zone d'atterrissage)
    function farPoint(min) {
      const m = 60;
      for (let k = 0; k < 30; k++) {
        const p = { x: rand(m, W - m), y: rand(m + 30, H - m) };
        if (dist(p, G.player) >= min) return p;
      }
      return { x: rand(m, W - m), y: rand(m + 30, H - m) };
    }

    const say = (text, t = 2.6) => {
      G.msg = text;
      G.msgT = t;
    };

    function hurt(amount, cause) {
      if (G.player.inv > 0 || G.phase !== "play") return;
      G.hp -= amount;
      G.player.inv = 1;
      G.shake = 0.35;
      api.sound.tone(140, 0.2, { type: "sawtooth", vol: 0.07 });
      if (G.hp <= 0) gameOver(cause);
    }

    // ===== Mise à jour =====
    function update(dt) {
      const d = Math.min(1, G.t / 150); // la difficulté monte pendant 2 min 30
      G.t += dt;
      G.msgT -= dt;
      G.shake = Math.max(0, G.shake - dt);
      const P = G.player;
      P.inv = Math.max(0, P.inv - dt);

      // Déplacement (clavier ou joystick)
      let mx = 0, my = 0;
      if (keys.has("left")) mx -= 1;
      if (keys.has("right")) mx += 1;
      if (keys.has("up")) my -= 1;
      if (keys.has("down")) my += 1;
      if (stick) {
        const dx = stick.x - stick.sx, dy = stick.y - stick.sy, len = Math.hypot(dx, dy);
        if (len > 8) { mx = dx / Math.max(len, 50); my = dy / Math.max(len, 50); }
      }
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      const speed = 230;
      P.x = clamp(P.x + mx * speed * dt, 12, W - 12);
      P.y = clamp(P.y + my * speed * dt, 50, H - 12);
      if (mx) P.face = Math.sign(mx);

      // Débris qui tombent : une cible rouge prévient avant l'impact
      G.nextDebris -= dt;
      if (G.nextDebris <= 0) {
        G.nextDebris = 1.8 - 1.15 * d;
        const near = Math.random() < 0.45;
        G.debris.push({
          x: near ? P.x + rand(-80, 80) : rand(20, W - 20),
          y: near ? P.y + rand(-80, 80) : rand(60, H - 20),
          r: rand(38, 70),
          t: 1.3,
        });
      }
      G.debris = G.debris.filter((b) => {
        b.t -= dt;
        if (b.t > 0) return true;
        if (dist(b, P) < b.r) hurt(24, "un débris");
        G.fx.push({ x: b.x, y: b.y, r: b.r, t: 0.5 });
        if (dist(b, P) < 260) G.shake = Math.max(G.shake, 0.18);
        api.sound.noise(0.25, { vol: 0.06, filter: 600 });
        return false;
      });
      G.fx = G.fx.filter((f) => (f.t -= dt) > 0);

      // Nuages radioactifs
      while (G.clouds.length < 3 + Math.floor(3 * d)) addCloud();
      let inCloud = false;
      for (const c of G.clouds) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < -c.r) c.x = W + c.r;
        if (c.x > W + c.r) c.x = -c.r;
        if (c.y < -c.r) c.y = H + c.r;
        if (c.y > H + c.r) c.y = -c.r;
        if (dist(c, P) < c.r * 0.8) inCloud = true;
      }
      G.rad = clamp(G.rad + (inCloud ? 24 : -6) * dt, 0, 100);
      if (inCloud) {
        G.geiger -= dt;
        if (G.geiger <= 0) {
          G.geiger = rand(0.03, 0.15);
          api.sound.noise(0.01, { vol: 0.08, filter: 6000 });
        }
      }
      if (G.rad >= 100) {
        G.hp -= 9 * dt;
        if (G.hp <= 0) return gameOver("la radiation");
      }

      // Requins mutants : ils te poursuivent… sur la terre ferme
      G.nextShark -= dt;
      if (G.nextShark <= 0 && G.sharks.length < 2 + Math.floor(4 * d)) {
        G.nextShark = Math.max(3.5, 9 - 5 * d);
        const side = Math.floor(Math.random() * 4);
        G.sharks.push({
          x: side === 0 ? -30 : side === 1 ? W + 30 : rand(0, W),
          y: side === 2 ? 20 : side === 3 ? H + 30 : rand(60, H),
          v: 70 + 70 * d,
          flee: 0,
          face: 1,
        });
      }
      for (const s of G.sharks) {
        const dx = P.x - s.x, dy = P.y - s.y, l = Math.hypot(dx, dy) || 1;
        const dir = s.flee > 0 ? -1 : 1;
        s.flee = Math.max(0, s.flee - dt);
        s.x += (dx / l) * s.v * dir * dt;
        s.y += (dy / l) * s.v * dir * dt;
        s.face = dx * dir > 0 ? 1 : -1;
        if (l < 24 && s.flee <= 0) {
          hurt(18, "un requin mutant");
          s.flee = 1.6;
        }
      }

      // Objets : conserves (vie) et pastilles d'iode (radiation)
      G.nextItem -= dt;
      if (G.nextItem <= 0) {
        G.nextItem = 5;
        if (G.items.length < 3) G.items.push({ ...farPoint(120), kind: Math.random() < 0.6 ? "food" : "iode", t: 0 });
      }
      G.items = G.items.filter((it) => {
        it.t += dt;
        if (dist(it, P) > 24) return true;
        if (it.kind === "food") {
          G.hp = Math.min(100, G.hp + 25);
          say("Une conserve ! +25 de vie 🥫", 1.8);
        } else {
          G.rad = Math.max(0, G.rad - 50);
          say("Pastille d'iode : radiation −50 💊", 1.8);
        }
        api.sound.tone(880, 0.08, { type: "triangle", vol: 0.05 });
        api.sound.tone(1320, 0.1, { type: "triangle", vol: 0.05, when: 0.08 });
        return false;
      });

      // Pièces de radio, puis hélicoptère
      if (G.parts < PARTS_NEEDED) {
        if (!G.part) {
          G.partDelay -= dt;
          if (G.partDelay <= 0) G.part = farPoint(220);
        } else if (dist(G.part, P) < 24) {
          G.parts++;
          G.part = null;
          G.partDelay = 1.5;
          api.sound.tone(660, 0.1, { type: "triangle", vol: 0.06 });
          api.sound.tone(990, 0.16, { type: "triangle", vol: 0.06, when: 0.1 });
          if (G.parts < PARTS_NEEDED) say(`Pièce de radio ${G.parts}/${PARTS_NEEDED} 🔧`);
          else {
            G.heli = { wait: HELI_WAIT, zone: null };
            say(`Radio réparée ! ÉCHO envoie un hélicoptère : tiens ${HELI_WAIT} secondes 🚁`, 4);
            api.speak("Radio réparée. J'envoie un hélicoptère. Tiens bon !");
          }
        }
      } else if (G.heli) {
        if (!G.heli.zone) {
          G.heli.wait -= dt;
          if (G.heli.wait <= 0) {
            G.heli.zone = { ...farPoint(200), r: 58 };
            say("L'hélicoptère s'est posé : rejoins-le ! 🚁", 3);
            api.sound.tone(520, 0.3, { type: "triangle", vol: 0.06 });
          }
        } else if (dist(G.heli.zone, P) < G.heli.zone.r) {
          return victory();
        }
      }

      // Cendres
      for (const a of G.ash) {
        a.y += a.v * dt;
        a.x += Math.sin(G.t + a.y * 0.02) * 8 * dt;
        if (a.y > H) { a.y = -5; a.x = Math.random() * W; }
      }
    }

    // ===== Dessin =====
    function draw() {
      const c = api.colors();
      const P = G.player;
      ctx.save();
      if (G.shake > 0) ctx.translate(rand(-8, 8) * G.shake * 3, rand(-8, 8) * G.shake * 3);

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#2a0a02");
      sky.addColorStop(1, "#0d0603");
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // Champignon au loin
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.15, 10, W * 0.5, H * 0.15, W * 0.4);
      glow.addColorStop(0, "rgba(255, 120, 40, 0.18)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Ruines
      ctx.fillStyle = "#1c120d";
      ctx.strokeStyle = "rgba(255, 140, 60, 0.12)";
      for (const r of ruins) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.r);
        ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
        ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
        ctx.restore();
      }

      // Nuages radioactifs
      for (const cl of G.clouds) {
        const pulse = 1 + 0.05 * Math.sin(G.t * 2 + cl.ph);
        const g = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r * pulse);
        g.addColorStop(0, "rgba(120, 255, 60, 0.32)");
        g.addColorStop(1, "rgba(120, 255, 60, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, cl.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cibles des débris + impacts
      for (const b of G.debris) {
        const k = 1 - b.t / 1.3;
        ctx.strokeStyle = `rgba(255, 51, 85, ${0.4 + 0.6 * k})`;
        ctx.fillStyle = `rgba(255, 51, 85, ${0.08 + 0.22 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - k), 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }
      for (const f of G.fx) {
        const k = f.t / 0.5;
        ctx.fillStyle = `rgba(255, 170, 60, ${0.6 * k})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - k * 0.4), 0, Math.PI * 2); ctx.fill();
      }

      // Objets, pièce de radio, zone de l'hélicoptère
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "24px sans-serif";
      for (const it of G.items) ctx.fillText(it.kind === "food" ? "🥫" : "💊", it.x, it.y + Math.sin(it.t * 4) * 3);
      if (G.part) {
        ctx.strokeStyle = c.fg;
        ctx.shadowColor = c.fg;
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(G.part.x, G.part.y, 18 + 4 * Math.sin(G.t * 5), 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillText("🔧", G.part.x, G.part.y);
      }
      if (G.heli?.zone) {
        const z = G.heli.zone;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = c.fg2;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 3 * Math.sin(G.t * 4), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.font = "40px sans-serif";
        ctx.fillText("🚁", z.x, z.y - 6 + Math.sin(G.t * 6) * 3);
        ctx.font = "24px sans-serif";
      }

      // Requins mutants
      ctx.font = "30px sans-serif";
      for (const s of G.sharks) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(-s.face, 1);
        ctx.globalAlpha = s.flee > 0 ? 0.55 : 1;
        ctx.fillText("🦈", 0, 0);
        ctx.restore();
      }

      // Le joueur
      if (!(P.inv > 0 && Math.floor(G.t * 12) % 2)) {
        ctx.fillStyle = c.fg;
        ctx.shadowColor = c.fg;
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(P.x, P.y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000";
        ctx.font = "700 10px 'JetBrains Mono', monospace";
        ctx.fillText(">_", P.x, P.y + 1);
      }

      // Cendres
      ctx.fillStyle = "rgba(220, 200, 190, 0.5)";
      for (const a of G.ash) ctx.fillRect(a.x, a.y, a.s, a.s);
      ctx.restore();

      // Flèche vers l'objectif s'il est hors de vue proche
      const goal = G.part || G.heli?.zone;
      if (goal && dist(goal, P) > 120) {
        const ang = Math.atan2(goal.y - P.y, goal.x - P.x);
        ctx.save();
        ctx.translate(P.x + Math.cos(ang) * 34, P.y + Math.sin(ang) * 34);
        ctx.rotate(ang);
        ctx.fillStyle = c.fg2;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Joystick tactile
      if (stick) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(stick.sx, stick.sy, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        const dx = stick.x - stick.sx, dy = stick.y - stick.sy, l = Math.hypot(dx, dy), k = l > 50 ? 50 / l : 1;
        ctx.beginPath(); ctx.arc(stick.sx + dx * k, stick.sy + dy * k, 20, 0, Math.PI * 2); ctx.fill();
      }

      if (G.rad > 60) {
        ctx.fillStyle = `rgba(120, 255, 60, ${((G.rad - 60) / 40) * 0.18})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      drawHud(c);
    }

    function bar(x, y, w, label, value, color) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y, w, 16);
      ctx.fillStyle = color;
      ctx.fillRect(x + 2, y + 2, ((w - 4) * clamp(value, 0, 100)) / 100, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillText(`${label} ${Math.round(value)}`, x + 6, y + 12);
    }

    function drawHud(c) {
      const w = Math.min(180, W * 0.3);
      bar(14, 14, w, "VIE", G.hp, G.hp < 30 ? c.danger : c.fg);
      bar(14, 36, w, "RADIATION", G.rad, G.rad >= 100 ? c.danger : "#78ff3c");
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "700 14px 'JetBrains Mono', monospace";
      ctx.fillText(fmtTime(G.t), W - 14, 26);
      ctx.fillStyle = c.fg;
      ctx.fillText(`🔧 ${G.parts}/${PARTS_NEEDED}`, W - 14, 48);
      ctx.textAlign = "center";
      let objective = "Trouve les pièces de radio";
      if (G.heli) objective = G.heli.zone ? "Rejoins l'hélicoptère !" : `Hélicoptère dans ${Math.ceil(G.heli.wait)} s : survis !`;
      ctx.fillStyle = c.fg2;
      ctx.font = "700 13px 'Chakra Petch', sans-serif";
      ctx.fillText(objective.toUpperCase(), W / 2, 24);
      if (G.msgT > 0) {
        ctx.globalAlpha = Math.min(1, G.msgT);
        ctx.font = "700 18px 'Chakra Petch', sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText(G.msg, W / 2, H * 0.18);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "left";
    }

    // ===== Boucle =====
    function loop(ts) {
      if (!playing) return;
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
      lastTs = ts;
      if (G.phase === "play") update(dt);
      draw();
    }

    // ===== Fin de partie, pause =====
    function showPanel(html) {
      const p = q(".game-panel");
      p.hidden = !html;
      p.innerHTML = html || "";
      p.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
    }

    function act(what) {
      if (what === "retry") newGame();
      else if (what === "resume") { G.phase = "play"; showPanel(null); }
      else if (what === "quit") stop(G.phase === "win");
    }

    function gameOver(cause) {
      G.phase = "over";
      G.hp = 0;
      best = Math.max(best, G.t);
      api.sound.tone(200, 0.6, { type: "sawtooth", vol: 0.07, slide: -150 });
      showPanel(`
        <h2 class="game-title bad">TU N'AS PAS SURVÉCU</h2>
        <p>Vaincu par ${cause} après ${fmtTime(G.t)} · ${G.parts}/${PARTS_NEEDED} pièces de radio</p>
        <p class="muted small">ÉCHO : « On recommence ? Je garde une sauvegarde de toi, au cas où. »</p>
        <div class="game-btns"><button class="btn btn-primary" data-act="retry" type="button">Réessayer (Entrée)</button><button class="btn" data-act="quit" type="button">Quitter (Échap)</button></div>`);
      q(".game-panel .btn-primary").focus();
    }

    function victory() {
      G.phase = "win";
      api.sound.granted();
      api.speak("Tu as survécu. Bienvenue à bord, partenaire.");
      showPanel(`
        <h2 class="game-title">TU AS SURVÉCU 🚁</h2>
        <p>Temps : ${fmtTime(G.t)} · Vie restante : ${Math.round(G.hp)} · 5/5 pièces de radio</p>
        <p class="muted small">ÉCHO : « Bienvenue à bord, partenaire. La prochaine fois… on ne touche pas au bouton. »</p>
        <div class="game-btns"><button class="btn btn-primary" data-act="quit" type="button">Retour au terminal (Entrée)</button><button class="btn" data-act="retry" type="button">Rejouer</button></div>`);
      q(".game-panel .btn-primary").focus();
    }

    function togglePause() {
      if (G.phase === "play") {
        G.phase = "pause";
        showPanel(`
          <h2 class="game-title">PAUSE</h2>
          <div class="game-btns"><button class="btn btn-primary" data-act="resume" type="button">Reprendre (Échap)</button><button class="btn" data-act="quit" type="button">Quitter la partie</button></div>`);
      } else if (G.phase === "pause") act("resume");
    }

    // ===== Contrôles =====
    const DIRS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };

    function onKeyDown(e) {
      if (!playing) return;
      if (e.ctrlKey || e.metaKey || e.key === "F5" || e.key === "F11") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dir = DIRS[e.code] || DIRS[e.key];
      if (dir) return keys.add(dir);
      if (e.repeat) return;
      if (e.key === "Escape") {
        if (G.phase === "over") act("quit");
        else if (G.phase === "win") act("quit");
        else togglePause();
      } else if (e.key === "Enter" || e.key === " ") {
        if (G.phase === "over") act("retry");
        else if (G.phase === "win") act("quit");
        else if (G.phase === "pause") act("resume");
      } else if ((e.key === "r" || e.key === "R") && G.phase === "over") act("retry");
    }
    function onKeyUp(e) {
      const dir = DIRS[e.code] || DIRS[e.key];
      if (dir) keys.delete(dir);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const oldW = W || window.innerWidth, oldH = H || window.innerHeight;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (G) {
        G.player.x = clamp((G.player.x / oldW) * W, 12, W - 12);
        G.player.y = clamp((G.player.y / oldH) * H, 50, H - 12);
        buildRuins();
      }
    }

    // ===== Lancement / arrêt =====
    function start() {
      if (playing) return Promise.resolve(false);
      playing = true;
      el = document.createElement("div");
      el.className = "game";
      el.innerHTML = `
        <canvas class="game-canvas"></canvas>
        <button class="game-pause" type="button" aria-label="Pause">II</button>
        <div class="game-panel" hidden></div>`;
      document.body.appendChild(el);
      canvas = q(".game-canvas");
      ctx = canvas.getContext("2d");
      W = H = 0;
      resize();
      newGame();
      window.addEventListener("resize", resize);
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("keyup", onKeyUp, true);
      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        stick = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener("pointermove", (e) => {
        if (stick) { stick.x = e.clientX; stick.y = e.clientY; }
      });
      const release = () => (stick = null);
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
      q(".game-pause").addEventListener("click", togglePause);
      requestAnimationFrame(() => el.classList.add("on"));
      lastTs = 0;
      rafId = requestAnimationFrame(loop);
      return new Promise((resolve) => (finish = resolve));
    }

    function stop(won) {
      if (!playing) return;
      playing = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      keys.clear();
      stick = null;
      el.classList.remove("on");
      const node = el;
      setTimeout(() => node.remove(), 500);
      finish?.({ won, time: G.t, best: Math.max(best, G.t) });
      finish = null;
    }

    return { start, playing: () => playing };
  }

  return { create };
})();
