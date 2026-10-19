// Jeu secret « SURVIE » (débloqué après l'épilogue des 100 %) : l'ogive Oméga a explosé.
// Trois zones en ruines à traverser en ramassant les pièces de la radio d'ÉCHO, en se défendant
// contre les créatures mutantes (le tir est automatique), puis le Méga-Requin du Dr Méchant…
// et enfin l'hélicoptère.
window.HT_SURVIE = (() => {
  "use strict";

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
  const fr = (n) => Math.round(n).toLocaleString("fr-FR");
  const TOP = 66;        // bandeau du haut (vie, score…) : le joueur ne passe pas dessous
  const VITESSE = 235;   // vitesse du joueur (pixels par seconde)

  // Les trois zones à traverser
  const ZONES = [
    {
      nom: "LES RUINES", but: "Trouve 3 pièces de radio", parts: 3,
      ennemis: ["rat", "rat", "requin"], spawn: 1.9, max: 7, debris: 2.6, nuages: 0,
      sol: ["#2e1c11", "#170d07"], tache: "rgba(255, 140, 60, 0.07)", lueur: "rgba(255, 120, 40, 0.18)",
    },
    {
      nom: "LA ZONE RADIOACTIVE", but: "3 pièces de plus · évite les nuages verts", parts: 3,
      ennemis: ["rat", "requin", "drone"], spawn: 1.5, max: 10, debris: 2.1, nuages: 3,
      sol: ["#17260f", "#0a1306"], tache: "rgba(120, 255, 60, 0.08)", lueur: "rgba(120, 255, 60, 0.13)",
    },
    {
      nom: "LE PORT", but: "Dernières pièces · puis le Méga-Requin !", parts: 2,
      ennemis: ["rat", "requin", "requin", "drone"], spawn: 1.25, max: 12, debris: 1.8, nuages: 2,
      sol: ["#172230", "#0a1018"], tache: "rgba(90, 170, 255, 0.07)", lueur: "rgba(80, 160, 255, 0.16)",
      eau: true, boss: true,
    },
  ];

  const ENNEMIS = {
    rat: { emoji: "🐀", nom: "un rat mutant", pv: 1, vitesse: 150, r: 12, degats: 8, points: 50, taille: 24 },
    requin: { emoji: "🦈", nom: "un requin mutant", pv: 3, vitesse: 95, r: 17, degats: 16, points: 100, taille: 32 },
    drone: { emoji: "🤖", nom: "un robot-sbire", pv: 4, vitesse: 75, r: 16, degats: 12, points: 150, taille: 28, tireur: true },
  };

  const BONUS = {
    soin: { emoji: "🥫", texte: "+30 de vie", poids: 4 },
    iode: { emoji: "💊", texte: "Radiation −60", poids: 2 },
    rapide: { emoji: "⚡", texte: "Tir rapide !", poids: 2 },
    triple: { emoji: "🔱", texte: "Tir triple !", poids: 2 },
    bouclier: { emoji: "🛡️", texte: "Bouclier !", poids: 2 },
    bombe: { emoji: "💣", texte: "BOUM !", poids: 1 },
  };
  function bonusAuHasard(zone) {
    const liste = Object.entries(BONUS).filter(([k]) => k !== "iode" || zone.nuages > 0);
    let r = Math.random() * liste.reduce((s, [, b]) => s + b.poids, 0);
    for (const [k, b] of liste) if ((r -= b.poids) <= 0) return k;
    return "soin";
  }

  function create(api) {
    let playing = false;
    let el, canvas, ctx, W = 0, H = 0, rafId = 0, lastTs = 0;
    let G = null;          // état de la partie
    let sol = null;        // le décor du sol, dessiné une seule fois par zone
    const keys = new Set();
    let stick = null;      // joystick tactile / souris : { sx, sy, x, y }
    let finish = null;     // résout la promesse de start()
    let meilleur = 0;      // meilleur score de la session (le record permanent est gardé par app.js)
    const calme = () => !!api.calme?.();
    const q = (s) => el.querySelector(s);

    // ===== Partie, zones =====
    function newGame() {
      G = { phase: "tuto", score: 0, t: 0, kills: 0, morts: 0, msg: "", msgT: 0, player: null };
      startZone(0);
      G.phase = "tuto";
      showTuto();
    }

    // garderVie : en passant à la zone suivante, on garde sa vie (on repart à 100 en réessayant)
    function startZone(i, garderVie = false) {
      const Z = ZONES[i];
      const hp = garderVie && G.player ? G.player.hp : 100;
      Object.assign(G, {
        phase: "play",
        zone: i,
        zoneT: 0,
        scoreZone: G.score,
        player: {
          x: W / 2, y: (H + TOP) / 2, hp, rad: 0, inv: 2, face: 0, vise: -Math.PI / 2, marche: 0,
          dash: 0, dashCd: 0, dvx: 0, dvy: 0, tir: 0.5, rapide: 0, triple: 0, bouclier: 0,
        },
        ennemis: [], balles: [], ballesEnnemies: [], bonus: [], debris: [], particules: [], textes: [],
        nuages: [], parts: 0, part: null, partDelai: 1.5,
        boss: null, bossBattu: false, heli: null, transition: 0,
        prochainEnnemi: 2.8, prochainDebris: Z.debris + 1, prochaineCaisse: 10,
        combo: 0, comboT: 0, shake: 0, flashBlanc: 0, flashRouge: 0, titre: 3.2,
        cendres: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(15, 45), s: rand(1, 2.5) })),
      });
      for (let k = 0; k < Z.nuages; k++) addNuage();
      construireSol();
      api.sound.tone(220, 0.5, { type: "triangle", vol: 0.05, slide: 440 });
    }

    function addNuage() {
      const r = rand(70, 130);
      G.nuages.push({ x: rand(0, W), y: rand(TOP, H), r, vx: rand(-28, 28), vy: rand(-18, 18), ph: rand(0, 6) });
    }

    // Un point loin du joueur (pour les pièces, les caisses et l'hélicoptère)
    function pointLoin(min) {
      const m = 50, bas = ZONES[G.zone].eau ? H * 0.8 : H - m;
      for (let k = 0; k < 40; k++) {
        const p = { x: rand(m, W - m), y: rand(TOP + m, bas) };
        if (dist(p, G.player) >= min) return p;
      }
      return { x: rand(m, W - m), y: rand(TOP + m, bas) };
    }

    const say = (texte, t = 2.6) => {
      G.msg = texte;
      G.msgT = t;
    };
    const texte = (x, y, t, couleur = "#fff", taille = 14) => {
      G.textes.push({ x, y, t, couleur, taille, vie: 1 });
      if (G.textes.length > 40) G.textes.shift();
    };
    function eclats(x, y, couleur, n = 14, vitesse = 220, vie = 0.6) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), v = rand(vitesse * 0.3, vitesse);
        G.particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie, vieMax: vie, couleur, taille: rand(2, 4.5) });
      }
      if (G.particules.length > 450) G.particules.splice(0, G.particules.length - 450);
    }
    function explosion(x, y, grande = false) {
      eclats(x, y, "#ffb347", grande ? 40 : 18, grande ? 380 : 240, grande ? 0.9 : 0.6);
      eclats(x, y, "#ff5a3c", grande ? 20 : 8, grande ? 260 : 160, 0.5);
      eclats(x, y, "#666", grande ? 16 : 6, 120, 1);
      api.sound.noise(grande ? 0.6 : 0.2, { vol: grande ? 0.1 : 0.05, filter: grande ? 500 : 900 });
      if (!calme()) G.shake = Math.max(G.shake, grande ? 0.5 : 0.12);
    }

    // ===== Dégâts =====
    function blesser(n, cause) {
      const P = G.player;
      if (P.inv > 0 || P.dash > 0 || G.phase !== "play") return;
      if (P.bouclier > 0) {
        P.bouclier--;
        P.inv = 0.7;
        eclats(P.x, P.y, "#7fd8ff", 16, 200);
        api.sound.tone(1200, 0.12, { type: "triangle", vol: 0.06 });
        say(P.bouclier ? "Le bouclier encaisse !" : "Bouclier détruit !", 1.4);
        return;
      }
      P.hp -= n;
      P.inv = 1;
      G.combo = 0;
      G.shake = Math.max(G.shake, 0.35);
      G.flashRouge = 0.3;
      texte(P.x, P.y - 24, `−${n}`, "#ff5a6e", 16);
      api.vibrer?.(120);
      api.sound.tone(140, 0.2, { type: "sawtooth", vol: 0.07 });
      if (P.hp <= 0) perdu(cause);
    }

    function multiplicateur() {
      return Math.min(5, 1 + Math.floor(G.combo / 4));
    }
    function toucher(e, n) {
      e.pv -= n;
      e.hit = 0.1;
      eclats(e.x, e.y, "#fff3b0", 4, 140, 0.25);
      if (e.pv <= 0) tuer(e);
    }
    function tuer(e) {
      e.mort = true;
      explosion(e.x, e.y);
      G.kills++;
      G.combo++;
      G.comboT = 2.6;
      const pts = e.type.points * multiplicateur();
      G.score += pts;
      texte(e.x, e.y - 18, `+${pts}`, multiplicateur() > 1 ? "#ffd34d" : "#fff", multiplicateur() > 1 ? 16 : 13);
      if (Math.random() < 0.13) G.bonus.push({ x: e.x, y: e.y, k: bonusAuHasard(ZONES[G.zone]), t: 0 });
    }

    function bombe() {
      G.flashBlanc = 0.5;
      for (const e of G.ennemis) if (!e.mort) tuer(e);
      G.ballesEnnemies = [];
      if (G.boss) toucherBoss(10);
      explosion(G.player.x, G.player.y, true);
      api.vibrer?.([150, 60, 150]);
    }

    // ===== Le joueur =====
    function esquive() {
      const P = G.player;
      if (G.phase !== "play" || P.dashCd > 0 || P.dash > 0) return;
      let { mx, my } = direction();
      if (!mx && !my) { mx = Math.cos(P.vise); my = Math.sin(P.vise); }
      const l = Math.hypot(mx, my) || 1;
      P.dvx = (mx / l) * VITESSE * 3.2;
      P.dvy = (my / l) * VITESSE * 3.2;
      P.dash = 0.2;
      P.dashCd = 1.1;
      api.sound.noise(0.15, { vol: 0.05, filter: 3000 });
    }

    function direction() {
      let mx = 0, my = 0;
      if (keys.has("left")) mx -= 1;
      if (keys.has("right")) mx += 1;
      if (keys.has("up")) my -= 1;
      if (keys.has("down")) my += 1;
      if (stick) {
        const dx = stick.x - stick.sx, dy = stick.y - stick.sy, l = Math.hypot(dx, dy);
        if (l > 8) { mx = dx / Math.max(l, 50); my = dy / Math.max(l, 50); }
      }
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      return { mx, my };
    }

    // Tir automatique sur l'ennemi le plus proche
    function cibleProche() {
      const P = G.player;
      let best = null, bd = 460;
      for (const e of G.ennemis) {
        const d = dist(e, P);
        if (!e.mort && d < bd) { bd = d; best = e; }
      }
      if (G.boss && dist(G.boss, P) < 520 && (!best || dist(G.boss, P) < bd + 60)) best = G.boss;
      return best;
    }
    function tirer(cible) {
      const P = G.player;
      const a = Math.atan2(cible.y - P.y, cible.x - P.x);
      P.vise = a;
      const angles = P.triple > 0 ? [a - 0.2, a, a + 0.2] : [a];
      for (const b of angles) {
        G.balles.push({ x: P.x + Math.cos(b) * 14, y: P.y + Math.sin(b) * 14, vx: Math.cos(b) * 640, vy: Math.sin(b) * 640, vie: 0.8 });
      }
      api.sound.tone(P.rapide > 0 ? 1500 : 1100, 0.03, { type: "square", vol: 0.015 });
    }

    // ===== Le boss : le Méga-Requin mécanique du Dr Méchant =====
    function lancerBoss() {
      G.boss = { x: W / 2, y: TOP - 80, vx: 0, vy: 0, pv: 90, pvMax: 90, r: 46, etat: "arrivee", t: 0, angle: Math.PI / 2, hit: 0, rage: false, attaque: 0, cible: null };
      G.ennemis.forEach((e) => (e.fuite = true));
      say("LE MÉGA-REQUIN DU DR MÉCHANT !", 3.5);
      api.speak("Attention ! Le Méga-Requin du docteur Méchant !");
      api.sound.tone(90, 1.2, { type: "sawtooth", vol: 0.08, slide: 40 });
      api.vibrer?.([300, 100, 300]);
    }

    function toucherBoss(n) {
      const B = G.boss;
      if (!B || B.etat === "arrivee") return;
      B.pv -= n;
      B.hit = 0.08;
      eclats(B.x + rand(-20, 20), B.y + rand(-20, 20), "#d8e4ef", 3, 160, 0.3);
      if (!B.rage && B.pv <= B.pvMax / 2) {
        B.rage = true;
        say("Il est en colère : attention !", 2.5);
        api.sound.tone(70, 0.8, { type: "sawtooth", vol: 0.08, slide: 140 });
      }
      if (B.pv <= 0) {
        explosion(B.x, B.y, true);
        for (let i = 0; i < 4; i++) setTimeout(() => G && explosion(B.x + rand(-50, 50), B.y + rand(-40, 40), true), 150 * (i + 1));
        G.score += 3000;
        texte(B.x, B.y - 50, "+3 000", "#ffd34d", 22);
        G.boss = null;
        G.bossBattu = true;
        G.heli = { arrive: 3, zone: null };
        say("Le Méga-Requin est en pièces ! L'hélicoptère arrive 🚁", 4);
        api.speak("Bravo ! L'hélicoptère arrive.");
        api.vibrer?.([200, 80, 200, 80, 400]);
      }
    }

    function updateBoss(dt) {
      const B = G.boss, P = G.player;
      B.t += dt;
      B.hit = Math.max(0, B.hit - dt);
      const vite = B.rage ? 1.3 : 1;
      const aller = (x, y, v) => {
        const dx = x - B.x, dy = y - B.y, l = Math.hypot(dx, dy) || 1;
        B.x += (dx / l) * Math.min(v * dt, l);
        B.y += (dy / l) * Math.min(v * dt, l);
        B.angle = Math.atan2(dy, dx);
      };
      const suivante = () => {
        B.attaque++;
        const liste = ["charge", "anneau", "charge", "renforts"];
        B.etat = liste[B.attaque % liste.length];
        B.t = 0;
      };
      if (B.etat === "arrivee") {
        aller(W / 2, TOP + H * 0.22, 140);
        if (B.t > 2) { B.etat = "tourne"; B.t = 0; }
      } else if (B.etat === "tourne") {
        // Tourne autour du joueur avant d'attaquer
        const a = Math.atan2(B.y - P.y, B.x - P.x) + dt * 0.9 * vite;
        aller(P.x + Math.cos(a) * 230, clamp(P.y + Math.sin(a) * 230, TOP + 50, H - 50), 200 * vite);
        if (B.t > (B.rage ? 1.6 : 2.4)) suivante();
      } else if (B.etat === "charge") {
        // Vise (ligne rouge), puis fonce
        if (!B.cible) { B.cible = { x: P.x, y: P.y }; api.sound.tone(300, 0.5, { type: "sawtooth", vol: 0.05, slide: 600 }); }
        B.angle = Math.atan2(B.cible.y - B.y, B.cible.x - B.x);
        if (B.t > (B.rage ? 0.55 : 0.85)) {
          const v = B.rage ? 780 : 620;
          B.vx = Math.cos(B.angle) * v;
          B.vy = Math.sin(B.angle) * v;
          B.etat = "fonce";
          B.t = 0;
          api.vibrer?.(80);
        }
      } else if (B.etat === "fonce") {
        B.x += B.vx * dt;
        B.y += B.vy * dt;
        const mur = B.x < B.r || B.x > W - B.r || B.y < TOP + B.r || B.y > H - B.r;
        if (mur || B.t > 1) {
          B.x = clamp(B.x, B.r, W - B.r);
          B.y = clamp(B.y, TOP + B.r, H - B.r);
          if (mur) { explosion(B.x, B.y); G.shake = Math.max(G.shake, 0.3); }
          B.cible = null;
          B.etat = "tourne";
          B.t = 0;
        }
      } else if (B.etat === "anneau") {
        // Une ou deux salves de missiles en cercle
        const salves = B.rage ? 2 : 1;
        const n = B.rage ? 20 : 14;
        for (let s = 0; s < salves; s++) {
          if (B.t > 0.4 + s * 0.6 && (B.tirees || 0) <= s) {
            B.tirees = s + 1;
            const decal = rand(0, Math.PI);
            for (let i = 0; i < n; i++) {
              const a = decal + (i / n) * Math.PI * 2;
              G.ballesEnnemies.push({ x: B.x, y: B.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, vie: 4 });
            }
            api.sound.tone(500, 0.2, { type: "square", vol: 0.04, slide: 200 });
          }
        }
        if (B.t > 0.6 + salves * 0.6) { B.tirees = 0; B.etat = "tourne"; B.t = 0; }
      } else if (B.etat === "renforts") {
        if (B.t > 0.3 && !B.appel) {
          B.appel = true;
          const n = B.rage ? 4 : 3;
          for (let i = 0; i < n; i++) ajouterEnnemi("rat", B.x + rand(-40, 40), B.y + rand(-40, 40));
          if (B.rage) ajouterEnnemi("drone", B.x, B.y);
          say("Il appelle des renforts !", 1.6);
        }
        if (B.t > 1) { B.appel = false; B.etat = "tourne"; B.t = 0; }
      }
      if (B.etat !== "arrivee" && dist(B, P) < B.r + 10) blesser(22, "le Méga-Requin");
    }

    // ===== Ennemis =====
    function ajouterEnnemi(nom, x, y) {
      const type = ENNEMIS[nom];
      if (x === undefined) {
        const Z = ZONES[G.zone];
        const cote = Z.eau && nom === "requin" ? 3 : Math.floor(Math.random() * 4);
        x = cote === 0 ? -30 : cote === 1 ? W + 30 : rand(30, W - 30);
        y = cote === 2 ? TOP - 30 : cote === 3 ? H + 30 : rand(TOP + 30, H - 30);
      }
      G.ennemis.push({ nom, type, x, y, pv: type.pv, hit: 0, t: rand(0, 2), tir: rand(1.5, 2.5), face: 1, vise: 0 });
    }

    function updateEnnemis(dt) {
      const P = G.player, Z = ZONES[G.zone];
      // Apparition, de plus en plus fréquente
      if (G.titre < 1.6 && !G.heli && !G.transition && !G.boss) {
        G.prochainEnnemi -= dt;
        const max = Z.max + Math.floor(G.zoneT / 25);
        if (G.prochainEnnemi <= 0 && G.ennemis.length < max) {
          G.prochainEnnemi = Z.spawn * (1 - Math.min(0.35, G.zoneT / 200));
          const nom = pick(Z.ennemis);
          const groupe = nom === "rat" ? 3 : 1;
          for (let i = 0; i < groupe; i++) ajouterEnnemi(nom);
        }
      }
      for (const e of G.ennemis) {
        e.t += dt;
        e.hit = Math.max(0, e.hit - dt);
        const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1;
        let vx = dx / l, vy = dy / l;
        if (e.fuite) { vx = -vx; vy = -vy; }
        else if (e.type.tireur) {
          // Le robot garde ses distances, tourne autour et tire
          if (l < 170) { vx = -vx; vy = -vy; }
          else if (l < 270) { const tmp = vx; vx = -vy; vy = tmp; }
          e.tir -= dt;
          if (e.tir <= 0.35) e.charge = true;
          if (e.tir <= 0) {
            e.tir = rand(2, 2.8);
            e.charge = false;
            G.ballesEnnemies.push({ x: e.x, y: e.y, vx: (dx / l) * 240, vy: (dy / l) * 240, vie: 3 });
            api.sound.tone(700, 0.06, { type: "square", vol: 0.02 });
          }
        } else if (e.nom === "rat") {
          // Les rats zigzaguent
          const z = Math.sin(e.t * 7) * 0.6;
          const tx = vx - vy * z, ty = vy + vx * z;
          vx = tx; vy = ty;
        }
        e.x += vx * e.type.vitesse * dt;
        e.y += vy * e.type.vitesse * dt;
        e.face = dx > 0 ? -1 : 1;
        if (!e.fuite && l < e.type.r + 12) {
          blesser(e.type.degats, e.type.nom);
          // repoussé après une morsure
          e.x -= (dx / l) * 40;
          e.y -= (dy / l) * 40;
        }
      }
      // Ils ne s'empilent pas les uns sur les autres
      for (let i = 0; i < G.ennemis.length; i++) {
        for (let j = i + 1; j < G.ennemis.length; j++) {
          const a = G.ennemis[i], b = G.ennemis[j];
          const d = dist(a, b), m = a.type.r + b.type.r;
          if (d > 0 && d < m) {
            const p = (m - d) / 2 / d;
            a.x -= (b.x - a.x) * p; a.y -= (b.y - a.y) * p;
            b.x += (b.x - a.x) * p; b.y += (b.y - a.y) * p;
          }
        }
      }
      G.ennemis = G.ennemis.filter((e) => !e.mort && !(e.fuite && (e.x < -80 || e.x > W + 80 || e.y < -80 || e.y > H + 80)));
    }

    // ===== Mise à jour =====
    function update(dt) {
      const Z = ZONES[G.zone];
      const P = G.player;
      G.t += dt;
      G.zoneT += dt;
      G.msgT -= dt;
      G.titre = Math.max(0, G.titre - dt);
      G.shake = Math.max(0, G.shake - dt);
      G.flashBlanc = Math.max(0, G.flashBlanc - dt);
      G.flashRouge = Math.max(0, G.flashRouge - dt);
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
      P.inv = Math.max(0, P.inv - dt);
      P.dashCd = Math.max(0, P.dashCd - dt);
      P.rapide = Math.max(0, P.rapide - dt);
      P.triple = Math.max(0, P.triple - dt);
      q(".game-dash")?.classList.toggle("pret", P.dashCd <= 0);

      // Déplacement (et esquive)
      const { mx, my } = direction();
      if (P.dash > 0) {
        P.dash -= dt;
        P.x += P.dvx * dt;
        P.y += P.dvy * dt;
        G.particules.push({ x: P.x, y: P.y, vx: 0, vy: 0, vie: 0.25, vieMax: 0.25, couleur: "#7dffb0", taille: 9 });
      } else {
        P.x += mx * VITESSE * dt;
        P.y += my * VITESSE * dt;
      }
      P.x = clamp(P.x, 14, W - 14);
      P.y = clamp(P.y, TOP + 14, (Z.eau ? H * 0.86 : H) - 14);
      if (mx || my) { P.face = Math.atan2(my, mx); P.marche += dt; }

      // Tir automatique
      P.tir -= dt;
      const cible = cibleProche();
      if (cible && P.tir <= 0 && G.titre < 2.4) {
        tirer(cible);
        P.tir = P.rapide > 0 ? 0.12 : 0.28;
      }
      for (const b of G.balles) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vie -= dt;
        for (const e of G.ennemis) {
          if (!e.mort && b.vie > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.type.r + 5) {
            toucher(e, 1);
            b.vie = 0;
          }
        }
        if (G.boss && b.vie > 0 && dist(b, G.boss) < G.boss.r) {
          toucherBoss(1);
          b.vie = 0;
        }
      }
      G.balles = G.balles.filter((b) => b.vie > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

      updateEnnemis(dt);
      if (G.boss) updateBoss(dt);

      // Tirs ennemis
      for (const b of G.ballesEnnemies) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vie -= dt;
        if (b.vie > 0 && dist(b, P) < 13) {
          blesser(10, G.boss ? "un missile du Méga-Requin" : "un tir de robot");
          b.vie = 0;
        }
      }
      G.ballesEnnemies = G.ballesEnnemies.filter((b) => b.vie > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);

      // Débris qui tombent : un cercle rouge prévient avant l'impact
      G.prochainDebris -= dt;
      if (G.prochainDebris <= 0 && !G.transition) {
        G.prochainDebris = Z.debris * rand(0.7, 1.2);
        const pres = Math.random() < 0.5;
        G.debris.push({
          x: pres ? P.x + rand(-70, 70) : rand(30, W - 30),
          y: pres ? P.y + rand(-70, 70) : rand(TOP + 30, H - 30),
          r: rand(40, 68),
          t: 1.3,
        });
      }
      G.debris = G.debris.filter((d) => {
        d.t -= dt;
        if (d.t > 0) return true;
        if (dist(d, P) < d.r) blesser(22, "un débris");
        for (const e of G.ennemis) if (!e.mort && dist(d, e) < d.r) tuer(e); // les ennemis aussi
        explosion(d.x, d.y);
        return false;
      });

      // Nuages radioactifs
      let dansNuage = false;
      for (const n of G.nuages) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -n.r) n.x = W + n.r;
        if (n.x > W + n.r) n.x = -n.r;
        if (n.y < TOP - n.r) n.y = H + n.r;
        if (n.y > H + n.r) n.y = TOP - n.r;
        if (dist(n, P) < n.r * 0.8) dansNuage = true;
      }
      P.rad = clamp(P.rad + (dansNuage ? 26 : -7) * dt, 0, 100);
      if (dansNuage && Math.random() < dt * 14) api.sound.noise(0.01, { vol: 0.07, filter: 6000 });
      if (P.rad >= 100 && G.phase === "play") {
        P.hp -= 8 * dt;
        if (P.hp <= 0) return perdu("la radiation");
      }

      // Bonus et caisses
      G.prochaineCaisse -= dt;
      if (G.prochaineCaisse <= 0) {
        G.prochaineCaisse = rand(9, 14);
        if (G.bonus.length < 4) G.bonus.push({ ...pointLoin(140), k: bonusAuHasard(Z), t: 0 });
      }
      G.bonus = G.bonus.filter((b) => {
        b.t += dt;
        if (b.t > 14) return false; // disparaît s'il traîne trop
        if (dist(b, P) > 26) return true;
        ramasser(b);
        return false;
      });

      progression(dt);

      // Particules, textes, cendres
      for (const p of G.particules) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vie -= dt;
      }
      G.particules = G.particules.filter((p) => p.vie > 0);
      for (const t of G.textes) { t.y -= 30 * dt; t.vie -= dt; }
      G.textes = G.textes.filter((t) => t.vie > 0);
      for (const a of G.cendres) {
        a.y += a.v * dt;
        a.x += Math.sin(G.t + a.y * 0.02) * 8 * dt;
        if (a.y > H) { a.y = -5; a.x = Math.random() * W; }
      }
    }

    function ramasser(b) {
      const P = G.player, B = BONUS[b.k];
      if (b.k === "soin") P.hp = Math.min(100, P.hp + 30);
      else if (b.k === "iode") P.rad = Math.max(0, P.rad - 60);
      else if (b.k === "rapide") P.rapide = 8;
      else if (b.k === "triple") P.triple = 8;
      else if (b.k === "bouclier") P.bouclier = 2;
      else if (b.k === "bombe") bombe();
      texte(b.x, b.y - 20, `${B.emoji} ${B.texte}`, "#c6ff4d", 14);
      G.score += 25;
      eclats(b.x, b.y, "#c6ff4d", 10, 160, 0.4);
      api.sound.tone(880, 0.08, { type: "triangle", vol: 0.05 });
      api.sound.tone(1320, 0.1, { type: "triangle", vol: 0.05, when: 0.08 });
    }

    // Pièces de radio, zone suivante, boss, hélicoptère
    function progression(dt) {
      const Z = ZONES[G.zone], P = G.player;
      if (G.transition) {
        G.transition -= dt;
        if (G.transition <= 0) {
          G.transition = 0;
          startZone(G.zone + 1, true);
          say(ZONES[G.zone].but, 3);
        }
        return;
      }
      if (G.parts < Z.parts) {
        if (!G.part) {
          G.partDelai -= dt;
          if (G.partDelai <= 0 && G.titre < 1.5) G.part = pointLoin(230);
        } else if (dist(G.part, P) < 26) {
          G.parts++;
          G.part = null;
          G.partDelai = 1.6;
          G.score += 300;
          texte(P.x, P.y - 30, "🔧 +300", "#7dffb0", 16);
          eclats(P.x, P.y, "#7dffb0", 18, 200, 0.5);
          api.sound.tone(660, 0.1, { type: "triangle", vol: 0.06 });
          api.sound.tone(990, 0.16, { type: "triangle", vol: 0.06, when: 0.1 });
          if (G.parts < Z.parts) say(`Pièce de radio ${G.parts}/${Z.parts} 🔧`, 1.8);
          else if (!Z.boss) {
            // Zone terminée : les créatures s'enfuient, un peu de vie en bonus
            G.transition = 3;
            G.ennemis.forEach((e) => (e.fuite = true));
            G.ballesEnnemies = [];
            P.hp = Math.min(100, P.hp + 40);
            say(`ZONE ${G.zone + 1} TERMINÉE ✓ · +40 de vie`, 3);
            api.speak("Zone terminée. On continue.");
          } else lancerBoss();
        }
      } else if (G.heli) {
        if (!G.heli.zone) {
          G.heli.arrive -= dt;
          if (G.heli.arrive <= 0) {
            G.heli.zone = { ...pointLoin(180), r: 58 };
            say("L'hélicoptère s'est posé : rejoins-le ! 🚁", 3);
            api.sound.tone(520, 0.3, { type: "triangle", vol: 0.06 });
          }
        } else if (dist(G.heli.zone, P) < G.heli.zone.r) victoire();
      }
    }

    // ===== Décor du sol (dessiné une fois par zone, sur un canvas à part) =====
    function construireSol() {
      const Z = ZONES[G.zone];
      sol = document.createElement("canvas");
      sol.width = Math.max(1, W);
      sol.height = Math.max(1, H);
      const s = sol.getContext("2d");
      const g = s.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, Z.sol[0]);
      g.addColorStop(1, Z.sol[1]);
      s.fillStyle = g;
      s.fillRect(0, 0, W, H);
      // Dalles de béton
      s.strokeStyle = "rgba(255,255,255,0.035)";
      for (let x = 0; x < W; x += 64) { s.beginPath(); s.moveTo(x, 0); s.lineTo(x, H); s.stroke(); }
      for (let y = 0; y < H; y += 64) { s.beginPath(); s.moveTo(0, y); s.lineTo(W, y); s.stroke(); }
      // Taches et cratères
      for (let i = 0; i < (W * H) / 9000; i++) {
        s.fillStyle = Math.random() < 0.5 ? Z.tache : "rgba(0,0,0,0.18)";
        s.beginPath();
        s.ellipse(rand(0, W), rand(0, H), rand(10, 60), rand(6, 30), rand(0, 3), 0, Math.PI * 2);
        s.fill();
      }
      for (let i = 0; i < (W * H) / 90000; i++) {
        const x = rand(0, W), y = rand(TOP, H), r = rand(18, 40);
        s.fillStyle = "rgba(0,0,0,0.35)";
        s.beginPath(); s.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); s.fill();
        s.strokeStyle = "rgba(255, 200, 150, 0.08)";
        s.lineWidth = 3;
        s.beginPath(); s.ellipse(x, y - 2, r, r * 0.6, 0, Math.PI, 0); s.stroke();
        s.lineWidth = 1;
      }
      // Fissures
      s.strokeStyle = "rgba(0,0,0,0.45)";
      for (let i = 0; i < (W * H) / 40000; i++) {
        let x = rand(0, W), y = rand(0, H);
        s.beginPath();
        s.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rand(-30, 30); y += rand(-30, 30); s.lineTo(x, y); }
        s.stroke();
      }
      // Ruines (blocs de béton cassés)
      for (let i = 0; i < (W * H) / 30000; i++) {
        const x = rand(0, W), y = rand(TOP, H), w = rand(20, 60), h = rand(10, 30);
        s.save();
        s.translate(x, y);
        s.rotate(rand(-0.5, 0.5));
        s.fillStyle = "rgba(0,0,0,0.35)";
        s.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
        s.fillStyle = "#3a3330";
        s.fillRect(-w / 2, -h / 2, w, h);
        s.fillStyle = "rgba(255,255,255,0.06)";
        s.fillRect(-w / 2, -h / 2, w, 3);
        s.restore();
      }
      // Le port : un quai en bois au-dessus de l'eau
      if (Z.eau) {
        s.fillStyle = "#3b2a1c";
        s.fillRect(0, H * 0.84, W, 12);
        s.fillStyle = "rgba(0,0,0,0.3)";
        for (let x = 0; x < W; x += 26) s.fillRect(x, H * 0.84, 2, 12);
      }
    }

    // ===== Dessin =====
    function draw() {
      const c = api.colors();
      const Z = ZONES[G.zone];
      const P = G.player;
      ctx.save();
      if (G.shake > 0 && !calme()) ctx.translate(rand(-7, 7) * G.shake * 3, rand(-7, 7) * G.shake * 3);

      if (sol) ctx.drawImage(sol, 0, 0, W, H);
      const lueur = ctx.createRadialGradient(W * 0.5, H * 0.1, 10, W * 0.5, H * 0.1, W * 0.6);
      lueur.addColorStop(0, Z.lueur);
      lueur.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lueur;
      ctx.fillRect(0, 0, W, H);

      // L'eau du port, avec des vagues
      if (Z.eau) {
        const y0 = H * 0.86;
        const eau = ctx.createLinearGradient(0, y0, 0, H);
        eau.addColorStop(0, "#0d3a5c");
        eau.addColorStop(1, "#04121f");
        ctx.fillStyle = eau;
        ctx.fillRect(0, y0, W, H - y0);
        ctx.strokeStyle = "rgba(140, 210, 255, 0.25)";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + 12 + k * 14 + Math.sin(x * 0.03 + G.t * 2 + k) * 3);
          ctx.stroke();
        }
      }

      // Nuages radioactifs
      for (const n of G.nuages) {
        const pulse = 1 + 0.06 * Math.sin(G.t * 2 + n.ph);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * pulse);
        g.addColorStop(0, "rgba(140, 255, 70, 0.35)");
        g.addColorStop(0.7, "rgba(120, 255, 60, 0.15)");
        g.addColorStop(1, "rgba(120, 255, 60, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.5;
        ctx.fillText("☢️", n.x, n.y);
        ctx.globalAlpha = 1;
      }

      // Cercles des débris qui vont tomber
      for (const d of G.debris) {
        const k = 1 - d.t / 1.3;
        ctx.strokeStyle = `rgba(255, 51, 85, ${0.4 + 0.6 * k})`;
        ctx.fillStyle = `rgba(255, 51, 85, ${0.06 + 0.2 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 - k), 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Pièce de radio
      if (G.part) {
        ctx.strokeStyle = c.fg;
        ctx.shadowColor = c.fg;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(G.part.x, G.part.y, 20 + 4 * Math.sin(G.t * 5), 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.font = "24px sans-serif";
        ctx.fillText("🔧", G.part.x, G.part.y);
      }
      // Bonus (ils clignotent avant de disparaître)
      ctx.font = "24px sans-serif";
      for (const b of G.bonus) {
        if (b.t > 11 && Math.floor(b.t * 8) % 2) continue;
        ctx.fillStyle = "rgba(198, 255, 77, 0.18)";
        ctx.beginPath(); ctx.arc(b.x, b.y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(BONUS[b.k].emoji, b.x, b.y + Math.sin(b.t * 4) * 3);
      }
      // L'hélicoptère
      if (G.heli?.zone) {
        const z = G.heli.zone;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = c.fg2;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 3 * Math.sin(G.t * 4), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.font = "700 20px 'Chakra Petch', sans-serif";
        ctx.fillStyle = c.fg2;
        ctx.fillText("H", z.x, z.y + 30);
        ctx.font = "46px sans-serif";
        ctx.fillText("🚁", z.x, z.y - 8 + Math.sin(G.t * 6) * 3);
      }

      // Ennemis : ombre, emoji, flash quand ils sont touchés, points de vie
      for (const e of G.ennemis) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(e.x, e.y + e.type.r * 0.8, e.type.r, e.type.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(e.x, e.y + Math.sin(e.t * 10) * 1.5);
        ctx.scale(e.face, 1);
        ctx.font = `${e.type.taille}px sans-serif`;
        ctx.globalAlpha = e.fuite ? 0.6 : 1;
        ctx.fillText(e.type.emoji, 0, 0);
        ctx.restore();
        if (e.hit > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath(); ctx.arc(e.x, e.y, e.type.r, 0, Math.PI * 2); ctx.fill();
        }
        if (e.charge) {
          ctx.strokeStyle = "rgba(255, 140, 40, 0.8)";
          ctx.beginPath(); ctx.arc(e.x, e.y, e.type.r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        if (e.type.pv > 1 && e.pv < e.type.pv) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(e.x - 14, e.y - e.type.r - 10, 28, 4);
          ctx.fillStyle = "#ff5a6e";
          ctx.fillRect(e.x - 14, e.y - e.type.r - 10, (28 * e.pv) / e.type.pv, 4);
        }
      }

      if (G.boss) dessinerBoss(c);

      // Tirs
      ctx.strokeStyle = c.fg2;
      ctx.lineWidth = 3;
      ctx.shadowColor = c.fg;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (const b of G.balles) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      for (const b of G.ballesEnnemies) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 9);
        g.addColorStop(0, "#fff3b0");
        g.addColorStop(0.5, "#ff8a3c");
        g.addColorStop(1, "rgba(255, 80, 40, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
      }

      dessinerJoueur(c);

      // Particules
      for (const p of G.particules) {
        ctx.globalAlpha = Math.max(0, p.vie / p.vieMax);
        ctx.fillStyle = p.couleur;
        ctx.fillRect(p.x - p.taille / 2, p.y - p.taille / 2, p.taille, p.taille);
      }
      ctx.globalAlpha = 1;

      // Cendres
      ctx.fillStyle = "rgba(220, 200, 190, 0.45)";
      for (const a of G.cendres) ctx.fillRect(a.x, a.y, a.s, a.s);

      // Textes qui s'envolent (+100, −16…)
      for (const t of G.textes) {
        ctx.globalAlpha = Math.min(1, t.vie * 1.5);
        ctx.font = `700 ${t.taille}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = "#000";
        ctx.fillText(t.t, t.x + 1, t.y + 1);
        ctx.fillStyle = t.couleur;
        ctx.fillText(t.t, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Flèche vers l'objectif quand il est loin
      const but = G.part || G.heli?.zone;
      if (but && dist(but, P) > 110) {
        const ang = Math.atan2(but.y - P.y, but.x - P.x);
        ctx.save();
        ctx.translate(P.x + Math.cos(ang) * 38, P.y + Math.sin(ang) * 38);
        ctx.rotate(ang);
        ctx.fillStyle = c.fg2;
        ctx.shadowColor = c.fg2;
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Joystick tactile
      if (stick) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(stick.sx, stick.sy, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        const dx = stick.x - stick.sx, dy = stick.y - stick.sy, l = Math.hypot(dx, dy), k = l > 50 ? 50 / l : 1;
        ctx.beginPath(); ctx.arc(stick.sx + dx * k, stick.sy + dy * k, 22, 0, Math.PI * 2); ctx.fill();
      }

      // Voiles : radiation, dégâts, bombe
      if (P.rad > 60) {
        ctx.fillStyle = `rgba(120, 255, 60, ${((P.rad - 60) / 40) * 0.18})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (G.flashRouge > 0) {
        const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        v.addColorStop(0, "rgba(255, 30, 60, 0)");
        v.addColorStop(1, `rgba(255, 30, 60, ${G.flashRouge * 1.4})`);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
      }
      if (G.flashBlanc > 0 && !calme()) {
        ctx.fillStyle = `rgba(255, 255, 255, ${G.flashBlanc * 1.4})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      dessinerHud(c);
      dessinerTitre(c);
    }

    // Le joueur : un petit hacker avec sa visière « >_ » et son blaster
    function dessinerJoueur(c) {
      const P = G.player;
      if (P.inv > 0 && P.dash <= 0 && Math.floor(G.t * 12) % 2) return;
      const bob = Math.sin(P.marche * 14) * 2;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(P.x, P.y + 14, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      // Blaster qui suit la visée
      ctx.save();
      ctx.translate(P.x, P.y + bob);
      ctx.rotate(P.vise);
      ctx.fillStyle = "#2b2f36";
      ctx.fillRect(6, -3, 16, 6);
      ctx.fillStyle = c.fg2;
      ctx.fillRect(20, -2, 3, 4);
      ctx.restore();
      // Corps
      ctx.fillStyle = c.fg;
      ctx.shadowColor = c.fg;
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(P.x, P.y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Visière
      ctx.fillStyle = "#03140a";
      ctx.fillRect(P.x - 9, P.y + bob - 5, 18, 9);
      ctx.fillStyle = c.fg2;
      ctx.font = "700 8px 'JetBrains Mono', monospace";
      ctx.fillText(">_", P.x, P.y + bob);
      // Antenne
      ctx.strokeStyle = c.fg;
      ctx.beginPath(); ctx.moveTo(P.x + 5, P.y + bob - 11); ctx.lineTo(P.x + 9, P.y + bob - 19); ctx.stroke();
      ctx.fillStyle = Math.sin(G.t * 6) > 0 ? "#ff3355" : c.fg2;
      ctx.beginPath(); ctx.arc(P.x + 9, P.y + bob - 20, 2, 0, Math.PI * 2); ctx.fill();
      // Bouclier
      if (P.bouclier > 0) {
        ctx.strokeStyle = `rgba(127, 216, 255, ${0.6 + 0.3 * Math.sin(G.t * 8)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(P.x, P.y + bob, 21, 0, Math.PI * 2); ctx.stroke();
        if (P.bouclier > 1) { ctx.beginPath(); ctx.arc(P.x, P.y + bob, 26, 0, Math.PI * 2); ctx.stroke(); }
        ctx.lineWidth = 1;
      }
    }

    // Le Méga-Requin : un requin de métal, œil rouge, dents d'acier
    function dessinerBoss(c) {
      const B = G.boss;
      if (B.etat === "charge" && B.cible) {
        ctx.strokeStyle = `rgba(255, 51, 85, ${0.4 + 0.4 * Math.sin(G.t * 30)})`;
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x + Math.cos(B.angle) * 900, B.y + Math.sin(B.angle) * 900); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(B.x, B.y + 40, 60, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(B.x, B.y);
      ctx.rotate(B.angle);
      const metal = B.hit > 0 ? "#ffffff" : B.rage ? "#7a5a62" : "#5b6470";
      // Queue
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-82, -26 + Math.sin(G.t * 10) * 5); ctx.lineTo(-72, 0); ctx.lineTo(-82, 26 + Math.sin(G.t * 10) * 5); ctx.closePath(); ctx.fill();
      // Corps
      ctx.beginPath(); ctx.ellipse(0, 0, 58, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c9d2da";
      ctx.beginPath(); ctx.ellipse(6, 10, 44, 14, 0, 0, Math.PI); ctx.fill();
      // Aileron
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(2, -54); ctx.lineTo(14, -26); ctx.closePath(); ctx.fill();
      // Rivets
      ctx.fillStyle = "#2b2f36";
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 12, -14, 2, 0, Math.PI * 2); ctx.fill(); }
      // Œil
      ctx.fillStyle = "#ff3355";
      ctx.shadowColor = "#ff3355";
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(34, -8, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Dents
      ctx.fillStyle = "#f2f5f7";
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(26 + i * 5, 8); ctx.lineTo(28.5 + i * 5, 15); ctx.lineTo(31 + i * 5, 8); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    function barre(x, y, w, label, valeur, couleur) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, y, w, 16);
      ctx.fillStyle = couleur;
      ctx.fillRect(x + 2, y + 2, ((w - 4) * clamp(valeur, 0, 100)) / 100, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillText(`${label} ${Math.max(0, Math.round(valeur))}`, x + 6, y + 12);
    }

    function dessinerHud(c) {
      const Z = ZONES[G.zone], P = G.player;
      const fond = ctx.createLinearGradient(0, 0, 0, TOP);
      fond.addColorStop(0, "rgba(0,0,0,0.75)");
      fond.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fond;
      ctx.fillRect(0, 0, W, TOP + 10);

      const w = Math.min(190, W * 0.3);
      barre(12, 10, w, "VIE", P.hp, P.hp < 30 ? c.danger : c.fg);
      if (Z.nuages || P.rad > 0) barre(12, 30, w, "RADIATION", P.rad, P.rad >= 100 ? c.danger : "#78ff3c");
      // Bonus en cours
      const actifs = [];
      if (P.rapide > 0) actifs.push(`⚡${Math.ceil(P.rapide)}`);
      if (P.triple > 0) actifs.push(`🔱${Math.ceil(P.triple)}`);
      if (P.bouclier > 0) actifs.push(`🛡️×${P.bouclier}`);
      ctx.font = "700 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(actifs.join("  "), 12, 62);

      // Au centre : la zone et l'objectif, ou la vie du boss
      ctx.textAlign = "center";
      const cx = W / 2;
      const etroit = W < 560;
      if (G.boss) {
        const bw = Math.min(320, W * (etroit ? 0.42 : 0.4));
        ctx.font = "700 11px 'Chakra Petch', sans-serif";
        ctx.fillStyle = "#ff8a9a";
        ctx.fillText(etroit ? "MÉGA-REQUIN" : "MÉGA-REQUIN DU DR MÉCHANT", cx, 16);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(cx - bw / 2, 22, bw, 12);
        ctx.fillStyle = G.boss.rage ? "#ff3355" : "#ff8a3c";
        ctx.fillRect(cx - bw / 2 + 2, 24, ((bw - 4) * Math.max(0, G.boss.pv)) / G.boss.pvMax, 8);
      } else {
        ctx.font = "700 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`ZONE ${G.zone + 1}/3${etroit ? "" : ` · ${Z.nom}`}`, cx, 16);
        let objectif = `🔧 ${G.parts}/${Z.parts}`;
        if (G.heli) objectif = G.heli.zone ? "🚁 REJOINS L'HÉLICO !" : "🚁 HÉLICO EN APPROCHE";
        else if (G.transition) objectif = "✓ ZONE TERMINÉE";
        ctx.font = "700 16px 'Chakra Petch', sans-serif";
        ctx.fillStyle = c.fg2;
        ctx.fillText(objectif, cx, 36);
      }

      // À droite : score, temps, combo
      ctx.textAlign = "right";
      ctx.font = "700 16px 'Chakra Petch', sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(fr(G.score), W - 58, 22);
      ctx.font = "700 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(fmtTime(G.t), W - 58, 38);
      if (multiplicateur() > 1) {
        ctx.font = `700 ${14 + 2 * Math.sin(G.t * 10)}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = "#ffd34d";
        ctx.fillText(`COMBO ×${multiplicateur()}`, W - 58, 56);
      }

      // Message d'ÉCHO
      ctx.textAlign = "center";
      if (G.msgT > 0 && G.titre <= 0) {
        ctx.globalAlpha = Math.min(1, G.msgT);
        ctx.font = `700 ${etroit ? 15 : 19}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = "#000";
        ctx.fillText(G.msg, cx + 1, H * 0.2 + 1);
        ctx.fillStyle = "#fff";
        ctx.fillText(G.msg, cx, H * 0.2);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "left";
    }

    // Carte de titre au début de chaque zone
    function dessinerTitre(c) {
      if (G.titre <= 0 || G.phase !== "play") return;
      const a = Math.min(1, G.titre, 3.2 - G.titre + 0.3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, H * 0.36, W, H * 0.22);
      ctx.textAlign = "center";
      ctx.fillStyle = c.fg2;
      ctx.font = "700 13px 'JetBrains Mono', monospace";
      ctx.fillText(`ZONE ${G.zone + 1} / 3`, W / 2, H * 0.42);
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.min(44, W / 12)}px 'Chakra Petch', sans-serif`;
      ctx.fillText(ZONES[G.zone].nom, W / 2, H * 0.49);
      ctx.fillStyle = c.fg;
      ctx.font = "700 14px 'Chakra Petch', sans-serif";
      ctx.fillText(ZONES[G.zone].but, W / 2, H * 0.54);
      ctx.globalAlpha = 1;
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

    // ===== Panneaux : explications, pause, défaite, victoire =====
    function showPanel(html) {
      const p = q(".game-panel");
      p.hidden = !html;
      p.innerHTML = html || "";
      p.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
      p.querySelector(".btn-primary")?.focus();
    }

    function showTuto() {
      const t = !!api.tactile;
      showPanel(`
        <h2 class="game-title">APRÈS L'OGIVE</h2>
        <p>ÉCHO t'a protégé de l'explosion. Traverse <b>3 zones en ruines</b>, ramasse les pièces de sa radio… et sors de là en hélicoptère.</p>
        <ul class="game-aide">
          <li>🕹️ <b>Bouger</b> : ${t ? "glisse le doigt sur l'écran" : "flèches ou ZQSD"}</li>
          <li>🔫 <b>Tirer</b> : automatique, sur l'ennemi le plus proche</li>
          <li>💨 <b>Esquiver</b> : ${t ? "bouton ESQUIVE" : "Espace"}, tu es invincible pendant l'esquive</li>
          <li>🎯 Un <b>cercle rouge</b> au sol ? Un débris va tomber : écarte-toi !</li>
          <li>🎁 <b>Bonus</b> : 🥫 vie · 💊 anti-radiation · ⚡ tir rapide · 🔱 tir triple · 🛡️ bouclier · 💣 bombe</li>
          <li>🔥 Enchaîne les ennemis pour monter le <b>combo</b> (jusqu'à ×5)</li>
        </ul>
        <div class="game-btns"><button class="btn btn-primary" data-act="go" type="button">C'est parti !${t ? "" : " (Entrée)"}</button></div>`);
    }

    function act(quoi) {
      if (quoi === "go") { G.phase = "play"; showPanel(null); }
      else if (quoi === "zone") { G.score = G.scoreZone; G.morts++; startZone(G.zone); showPanel(null); }
      else if (quoi === "retry") { const m = G.morts; newGame(); G.morts = m; act("go"); }
      else if (quoi === "resume") { G.phase = "play"; showPanel(null); }
      else if (quoi === "quit") stop(G.phase === "win");
    }

    function perdu(cause) {
      G.phase = "over";
      G.player.hp = 0;
      explosion(G.player.x, G.player.y, true);
      meilleur = Math.max(meilleur, G.score);
      api.sound.tone(200, 0.6, { type: "sawtooth", vol: 0.07, slide: -150 });
      showPanel(`
        <h2 class="game-title bad">TU N'AS PAS SURVÉCU</h2>
        <p>Vaincu par ${cause} dans la zone ${G.zone + 1} (${ZONES[G.zone].nom.toLowerCase()}) · score ${fr(G.score)}</p>
        <p class="muted small">ÉCHO : « Pas de panique : je t'ai gardé une sauvegarde au début de la zone. »</p>
        <div class="game-btns">
          <button class="btn btn-primary" data-act="zone" type="button">Réessayer la zone (Entrée)</button>
          <button class="btn" data-act="retry" type="button">Tout recommencer</button>
          <button class="btn" data-act="quit" type="button">Quitter (Échap)</button>
        </div>`);
    }

    function victoire() {
      G.phase = "win";
      const bonusTemps = Math.max(0, Math.round(6000 - G.t * 12));
      G.score += bonusTemps + Math.round(G.player.hp * 20);
      meilleur = Math.max(meilleur, G.score);
      const rang = G.morts === 0 && G.t < 330 ? "S" : G.morts === 0 ? "A" : G.morts <= 2 ? "B" : "C";
      api.sound.granted();
      api.speak("Tu as survécu. Bienvenue à bord, partenaire.");
      api.vibrer?.([100, 60, 100, 60, 300]);
      showPanel(`
        <h2 class="game-title">TU AS SURVÉCU 🚁</h2>
        <div class="game-rang rang-${rang}">${rang}</div>
        <p><b>Score : ${fr(G.score)}</b> (dont ${fr(bonusTemps)} de bonus de vitesse)</p>
        <p>Temps : ${fmtTime(G.t)} · Ennemis vaincus : ${G.kills} · Tentatives ratées : ${G.morts}</p>
        <p class="muted small">ÉCHO : « Bienvenue à bord, partenaire. La prochaine fois… on ne touche pas au bouton. »</p>
        <div class="game-btns"><button class="btn btn-primary" data-act="quit" type="button">Retour au terminal (Entrée)</button><button class="btn" data-act="retry" type="button">Rejouer</button></div>`);
    }

    function togglePause() {
      if (G.phase === "play") {
        G.phase = "pause";
        showPanel(`
          <h2 class="game-title">PAUSE</h2>
          <p class="muted small">Zone ${G.zone + 1}/3 · score ${fr(G.score)}</p>
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
        if (G.phase === "over" || G.phase === "win") act("quit");
        else if (G.phase !== "tuto") togglePause();
      } else if (e.key === "Enter") {
        if (G.phase === "tuto") act("go");
        else if (G.phase === "over") act("zone");
        else if (G.phase === "win") act("quit");
        else if (G.phase === "pause") act("resume");
      } else if (e.key === " " || e.key === "Shift") {
        if (G.phase === "play") esquive();
        else if (G.phase === "tuto") act("go");
      } else if ((e.key === "r" || e.key === "R") && G.phase === "over") act("zone");
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
      if (G?.player) {
        G.player.x = clamp((G.player.x / oldW) * W, 14, W - 14);
        G.player.y = clamp((G.player.y / oldH) * H, TOP + 14, H - 14);
        construireSol();
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
        <button class="game-dash tactile-only" type="button">ESQUIVE</button>
        <div class="game-panel" hidden></div>`;
      document.body.appendChild(el);
      canvas = q(".game-canvas");
      ctx = canvas.getContext("2d");
      W = H = 0;
      G = null;
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
      q(".game-dash").addEventListener("pointerdown", (e) => {
        e.preventDefault();
        esquive();
      });
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
      meilleur = Math.max(meilleur, G.score);
      finish?.({ won, time: G.t, score: G.score, best: meilleur });
      finish = null;
    }

    return { start, playing: () => playing };
  }

  return { create };
})();
