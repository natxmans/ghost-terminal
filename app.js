(() => {
  "use strict";

  // ===== Éléments =====
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const terminal = $("terminal");
  const output = $("output");
  const mobileInput = $("mobile-input");
  const helpEl = $("help");
  const settingsEl = $("settings");
  const windowsEl = $("windows");
  const fxEl = $("fx");
  const toastsEl = $("toasts");
  const dockEl = $("dock");

  const EFFECTS = window.HT_EFFECTS;
  const effectById = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

  // Téléphone ou tablette : écran tactile comme moyen principal (les textes et boutons s'adaptent)
  const TACTILE = !!window.matchMedia?.("(pointer: coarse)").matches;
  body.classList.toggle("tactile", TACTILE);
  if (TACTILE) document.querySelector(".boot-press").firstChild.textContent = "Touche l'écran pour commencer";

  // ===== Outils =====
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fr = (n) => Math.round(n).toLocaleString("fr-FR");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const now = () => performance.now();
  const clockStr = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function setIcon(el, name) {
    el.querySelector(":scope > svg.ic")?.remove();
    el.insertAdjacentHTML("afterbegin", window.icon(name));
  }
  document.querySelectorAll("[data-icon]").forEach((el) => setIcon(el, el.dataset.icon));

  // ===== Réglages =====
  const THEMES = [
    { id: "green", name: "Vert" },
    { id: "amber", name: "Ambre" },
    { id: "cyan", name: "Cyan" },
    { id: "red", name: "Rouge" },
    { id: "purple", name: "Violet" },
    { id: "neon", name: "Néon" },
    { id: "white", name: "Blanc" },
    // Thèmes secrets : débloqués par progress.gold (100 %) et progress.ice (le repaire secret)
    { id: "gold", name: "Or (secret)", secret: "gold" },
    { id: "ice", name: "Banquise (secret)", secret: "ice" },
  ];
  const DEFAULTS = {
    lang: "c", theme: "green", speed: 3,
    size: window.innerWidth < 500 ? 13 : 15, // texte un peu plus petit sur téléphone
    highlight: true, crt: true, hud: true, dock: true, boot: true,
    sound: false, voice: false, volume: 60, popups: true, story: true, customCode: "",
    questMin: window.innerWidth < 700, // objectifs repliés par défaut sur téléphone
    // Mode calme (moins de flashs) activé d'office si l'appareil demande moins d'animations
    calme: !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    dialogue: "normal", // vitesse des dialogues : lent, normal ou rapide
    vibrations: true, // téléphone : petites vibrations (accès refusé, explosion…)
    clavierMobile: false, // téléphone : toucher l'écran ouvre aussi le vrai clavier
    // Version 2.0
    curseur: "bloc", police: "jetbrains", sonTouches: "clic", autoVitesse: "normal",
    veille: true, saison: true, ambiance: false, survieDiff: "normal",
  };
  // Liens directs : ?theme=cyan, ?lang=lua, ?auto=1, ?immersion=1, ?demo=1 (et ?saison=neige pour tester)
  const PARAMS = new URLSearchParams(location.search);
  const STORE = "ghostterminal-v1";
  let wiping = false; // « Tout réinitialiser » en cours : on n'enregistre plus rien

  function loadSettings() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
    } catch {
      return { ...DEFAULTS };
    }
  }
  function saveSettings() {
    if (wiping) return;
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* navigation privée */ }
  }
  function storeFlag(name, value) {
    try {
      if (value === undefined) return localStorage.getItem(name);
      localStorage.setItem(name, value);
    } catch { return null; }
  }

  const settings = loadSettings();

  // Petites vibrations sur téléphone (Android ; les iPhone les ignorent)
  const vibrer = (motif) => {
    if (TACTILE && settings.vibrations && !document.hidden) navigator.vibrate?.(motif);
  };

  // "Mon code" : le joueur peut faire taper son propre code
  const CUSTOM_PLACEHOLDER = "// Colle ton propre code dans les réglages (F9 → Mon code),\n// puis choisis le langage « Mon code ».\n\n";
  // Renvoie le nombre de gros mots bloqués (voir filtre.js)
  function refreshCustomSnippet() {
    const { texte, nb } = window.HT_FILTRE.nettoyer(settings.customCode || "");
    settings.customCode = texte;
    const code = texte.replace(/\r\n?/g, "\n");
    window.SNIPPETS.custom = { name: "Mon code", code: code.trim() ? code.trimEnd() + "\n\n" : CUSTOM_PLACEHOLDER };
    return nb;
  }
  refreshCustomSnippet();

  if (!window.SNIPPETS[settings.lang]) settings.lang = DEFAULTS.lang;
  if (!THEMES.some((t) => t.id === settings.theme)) settings.theme = DEFAULTS.theme;
  // Réglages à choix : une valeur inconnue (vieille sauvegarde, fichier importé) reprend la valeur par défaut
  const CHOIX = {
    dialogue: ["lent", "normal", "rapide"],
    autoVitesse: ["lent", "normal", "rapide"],
    curseur: ["bloc", "barre", "souligne"],
    police: ["jetbrains", "systeme", "machine"],
    sonTouches: ["clic", "machine", "bip", "muet"],
    survieDiff: ["facile", "normal", "difficile"],
  };
  for (const [k, ok] of Object.entries(CHOIX)) if (!ok.includes(settings[k])) settings[k] = DEFAULTS[k];
  const POLICES = {
    jetbrains: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    systeme: '"Cascadia Mono", Consolas, Menlo, "DejaVu Sans Mono", monospace',
    machine: '"Courier New", Courier, monospace',
  };
  const BASE_THEMES = THEMES.filter((t) => !t.secret).map((t) => t.id);
  const LANGS_FAUX = () => Object.keys(window.SNIPPETS).filter((k) => k !== "custom");

  let themeColors = {};
  // Les couleurs du thème, toujours en #rrggbb (les canvas leur ajoutent une transparence : « #3dff7a55 »)
  function enHex(c) {
    const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
    return m ? "#" + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, "0")).join("") : c;
  }
  function readColors() {
    const cs = getComputedStyle(body);
    const v = (n) => enHex(cs.getPropertyValue(n).trim());
    return { fg: v("--fg") || "#3dff7a", fg2: v("--fg2") || "#c6ff4d", fg3: v("--fg3") || "#3de8ff", danger: v("--danger") || "#ff3355" };
  }

  // ===== Son (Web Audio, rien à télécharger) =====
  const Sound = {
    ctx: null,
    master: null,
    ensure() {
      if (!settings.sound) return null;
      if (!this.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      }
      this.master.gain.value = (settings.volume / 100) * 0.9;
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, { type = "square", vol = 0.05, when = 0, slide = 0 } = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    noise(dur, { vol = 0.05, when = 0, filter = 0 } = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol;
      let node = src;
      if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = filter;
        node.connect(f);
        node = f;
      }
      node.connect(g).connect(this.master);
      src.start(ctx.currentTime + when);
    },
    // Son des touches : clic de clavier, machine à écrire, petit bip ou muet (réglages)
    click() {
      const genre = settings.sonTouches;
      if (genre === "muet") return;
      if (genre === "machine") {
        this.noise(0.04, { vol: 0.09, filter: 2200 });
        this.tone(rand(170, 230), 0.03, { type: "triangle", vol: 0.03 });
        return;
      }
      if (genre === "bip") {
        this.tone(rand(880, 990), 0.025, { type: "sine", vol: 0.025 });
        return;
      }
      this.noise(0.018, { vol: 0.06, filter: 5000 });
      this.tone(rand(1400, 2200), 0.012, { vol: 0.012 });
    },
    siren(sec) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(560, t);
      for (let i = 0; i < sec * 2; i++) {
        o.frequency.linearRampToValueAtTime(1080, t + i * 0.5 + 0.25);
        o.frequency.linearRampToValueAtTime(560, t + i * 0.5 + 0.5);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
      g.gain.setValueAtTime(0.045, t + sec - 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + sec + 0.05);
    },
    boom() {
      this.noise(1.5, { vol: 0.4, filter: 700 });
      this.tone(110, 1.2, { type: "sine", vol: 0.3, slide: -80 });
    },
    granted() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { vol: 0.05, when: i * 0.08 }));
    },
    denied() {
      this.tone(160, 0.45, { type: "sawtooth", vol: 0.07 });
      this.tone(120, 0.5, { type: "sawtooth", vol: 0.07, when: 0.22 });
    },
  };

  // ===== Voix de l'ordinateur (synthèse vocale du navigateur) =====
  const Voice = {
    voice: null,
    init() {
      if (!("speechSynthesis" in window)) return;
      const choose = () => {
        const all = speechSynthesis.getVoices();
        this.voice = all.find((v) => /^fr/i.test(v.lang) && /google|microsoft|natural/i.test(v.name)) || all.find((v) => /^fr/i.test(v.lang)) || null;
      };
      choose();
      speechSynthesis.addEventListener?.("voiceschanged", choose);
    },
    say(text, { pitch = 0.6, rate = 1.05 } = {}) {
      if (!settings.voice || !("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      if (this.voice) u.voice = this.voice;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = clamp(settings.volume / 100, 0.1, 1);
      speechSynthesis.speak(u);
    },
    hush() {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
  };
  Voice.init();

  // ===== Ambiance sonore : le ronronnement d'une salle des serveurs (facultatif) =====
  const Ambiance = {
    nodes: null,
    bips: 0,
    maj() {
      const on = settings.sound && settings.ambiance && !document.hidden;
      if (on && !this.nodes) {
        const ctx = Sound.ensure();
        if (!ctx) return;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 2);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 320;
        const oscs = [55, 82.5, 110.3].map((hz, i) => {
          const o = ctx.createOscillator();
          o.type = i === 2 ? "triangle" : "sine";
          o.frequency.value = hz;
          o.connect(f);
          return o;
        });
        // Le souffle monte et descend doucement
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 0.07;
        lg.gain.value = 0.01;
        lfo.connect(lg).connect(g.gain);
        f.connect(g).connect(Sound.master);
        [...oscs, lfo].forEach((o) => o.start());
        this.nodes = { g, oscs: [...oscs, lfo] };
        // De temps en temps, un petit bip de disque dur
        this.bips = setInterval(() => {
          if (Math.random() < 0.45) Sound.tone(rand(1200, 2600), 0.03, { type: "sine", vol: 0.006 });
        }, 2300);
      } else if (!on && this.nodes) {
        const { g, oscs } = this.nodes;
        g.gain.setTargetAtTime(0.0001, Sound.ctx.currentTime, 0.25);
        setTimeout(() => oscs.forEach((o) => o.stop()), 1500);
        clearInterval(this.bips);
        this.nodes = null;
      }
    },
  };

  // ===== Succès à débloquer =====
  const ACHIEVEMENTS = [
    { id: "first", icon: "terminal", name: "Premiers pas", desc: "Taper 100 caractères" },
    { id: "kiddie", icon: "terminal", name: "Script kiddie", desc: "Taper 1 000 caractères d'un coup" },
    { id: "hacker", icon: "terminal", name: "Hacker confirmé", desc: "Taper 10 000 caractères au total" },
    { id: "legend", icon: "trophy", name: "Légende du clavier", desc: "Taper 50 000 caractères au total" },
    { id: "granted", icon: "unlock", name: "Sésame", desc: "Obtenir l'accès autorisé" },
    { id: "denied", icon: "lock", name: "Recalé", desc: "Se faire refuser l'accès" },
    { id: "mission", icon: "target", name: "Agent de terrain", desc: "Terminer une mission" },
    { id: "collector", icon: "zap", name: "Collectionneur", desc: "Lancer les 10 effets dramatiques" },
    { id: "multitask", icon: "activity", name: "Multitâche", desc: "Avoir 5 fenêtres ouvertes en même temps" },
    { id: "cool", icon: "shield", name: "Sang-froid", desc: "Désamorcer l'ogive du Club des Méchants" },
    { id: "boom", icon: "timer", name: "Boum", desc: "Laisser l'ogive du Club des Méchants aller jusqu'à zéro" },
    { id: "speed", icon: "zap", name: "Vitesse lumière", desc: "Dépasser 2 000 caractères par minute (sans pilote auto)" },
    { id: "polyglot", icon: "code", name: "Polyglotte", desc: "Essayer 4 langages" },
    { id: "chameleon", icon: "sliders", name: "Caméléon", desc: "Essayer 4 thèmes" },
    { id: "pilot", icon: "play", name: "Pilote", desc: "Activer le pilote automatique" },
    { id: "immersion", icon: "eye", name: "Immersion totale", desc: "Passer en mode immersion" },
    { id: "custom", icon: "code", name: "Mon propre code", desc: "Faire taper ton propre code" },
    { id: "konami", icon: "trophy", name: "Rétro gamer", desc: "Trouver le code secret caché" },
    { id: "ch1", icon: "eye", name: "Le message", desc: "Histoire : terminer le chapitre 1" },
    { id: "consortium", icon: "target", name: "Le Club des Méchants", desc: "Histoire : terminer le chapitre 2" },
    { id: "ch2", icon: "globe", name: "La traque", desc: "Histoire : terminer le chapitre 3" },
    { id: "taupe", icon: "eye", name: "La taupe", desc: "Histoire : terminer le chapitre 4" },
    { id: "dossier", icon: "folder", name: "Le dossier Oméga", desc: "Histoire : terminer le chapitre 5" },
    { id: "bunker", icon: "alert", name: "Le bunker", desc: "Histoire : terminer le chapitre 6" },
    { id: "verite", icon: "eye", name: "La vérité", desc: "Histoire : terminer le chapitre 7" },
    { id: "satellite", icon: "radar", name: "Le satellite", desc: "Histoire : terminer le chapitre 8" },
    { id: "trahison", icon: "alert", name: "La trahison", desc: "Histoire : terminer le chapitre 9" },
    { id: "tour", icon: "target", name: "La tour", desc: "Histoire : terminer le chapitre 10" },
    { id: "free", icon: "unlock", name: "Libération", desc: "Histoire : laisser ÉCHO s'enfuir" },
    { id: "erase", icon: "x", name: "Effacement", desc: "Histoire : effacer ÉCHO" },
    { id: "truend", icon: "trophy", name: "Véritable fin", desc: "Histoire : réécrire le noyau d'ÉCHO" },
    { id: "fragments", icon: "database", name: "Mémoire retrouvée", desc: "Attraper les 12 fragments de mémoire d'ÉCHO" },
    { id: "escape", icon: "shield", name: "Insaisissable", desc: "Histoire : brouiller le signal à temps" },
    { id: "simon", icon: "zap", name: "Mémoire d'éléphant", desc: "Histoire : reproduire la séquence secrète" },
    { id: "demineur", icon: "timer", name: "Démineur", desc: "Histoire : couper le bon fil" },
    { id: "decrypt", icon: "key", name: "Cryptographe", desc: "Histoire : déchiffrer le dossier Oméga" },
    { id: "frequence", icon: "radar", name: "Œil de lynx", desc: "Histoire : caler la fréquence du satellite" },
    { id: "labyrinthe", icon: "crosshair", name: "Passe-muraille", desc: "Histoire : sortir Kane du labyrinthe" },
    { id: "survivor", icon: "shield", name: "Survivant", desc: "Jeu secret : survivre à l'explosion de l'ogive", secret: true },
    { id: "repaire", icon: "unlock", name: "Ami des pingouins", desc: "Endroit secret : visiter tout le repaire du Général Pingouin", secret: true },
    // Version 2.0 : succès bonus (visibles, mais hors des 100 %) et nouveaux secrets
    { id: "assidu", icon: "calendar", name: "Assidu", desc: "Réussir 7 défis du jour", bonus: true, max: 7, val: () => progress.defisFaits || 0 },
    { id: "marathon", icon: "timer", name: "Marathonien", desc: "Jouer une heure d'affilée", bonus: true, max: 3600, val: () => sessionSec, duree: true },
    { id: "arcenciel", icon: "sliders", name: "Arc-en-ciel", desc: "Essayer les 7 thèmes de base", bonus: true, max: 7, val: () => BASE_THEMES.filter((t) => progress.themes.includes(t)).length },
    { id: "polyglotte2", icon: "code", name: "Polyglotte ultime", desc: "Essayer les 8 langages de faux code", bonus: true, max: 8, val: () => LANGS_FAUX().filter((l) => progress.langs.includes(l)).length },
    { id: "noctambule", icon: "eye", name: "Noctambule", desc: "Jouer entre minuit et 5 h du matin", secret: true },
    { id: "chasseur", icon: "key", name: "Chasseur de secrets", desc: "Trouver 3 mots secrets", secret: true },
  ];
  // Progression des succès à compteur (affichée sous ceux qui ne sont pas encore débloqués)
  const COMPTEURS = {
    first: [100, () => totalChars], kiddie: [1000, () => totalChars],
    hacker: [10000, () => progress.lifetime], legend: [50000, () => progress.lifetime],
    polyglot: [4, () => progress.langs.length], chameleon: [4, () => progress.themes.length],
    collector: [10, () => progress.effects.length], fragments: [12, () => story.memories().filter(Boolean).length],
  };
  for (const a of ACHIEVEMENTS) if (COMPTEURS[a.id]) [a.max, a.val] = COMPTEURS[a.id];
  // Les succès secrets et bonus ne comptent pas dans les 100 % (ils se débloquent en plus)
  const MAIN_ACH = ACHIEVEMENTS.filter((a) => !a.secret && !a.bonus);
  const mainDone = () => MAIN_ACH.filter((a) => progress.ach[a.id]).length;
  const allDone = () => mainDone() === MAIN_ACH.length;
  const PROGRESS_KEY = "ghostterminal-progress";
  const progress = (() => {
    const base = { ach: {}, lifetime: 0, effects: [], langs: [], themes: [], mots: [] };
    try {
      return { ...base, ...JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") };
    } catch {
      return base;
    }
  })();
  let progressDirty = false;
  function saveProgress() {
    progressDirty = false;
    if (wiping) return;
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* tant pis */ }
  }
  function remember(list, value) {
    if (!progress[list].includes(value)) {
      progress[list].push(value);
      saveProgress();
    }
    return progress[list].length;
  }

  function updateAchCount() {
    $("ach-count").textContent = `${mainDone()}/${MAIN_ACH.length}`;
  }

  function achieve(id) {
    if (progress.ach[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    progress.ach[id] = Date.now();
    saveProgress();
    updateAchCount();
    vibrer([20, 40, 20]);
    const t = document.createElement("div");
    t.className = "toast toast-ach";
    t.innerHTML = `${window.icon(a.icon)}<div><small>${a.secret ? "SUCCÈS SECRET" : a.bonus ? "SUCCÈS BONUS" : "SUCCÈS DÉBLOQUÉ"}</small><b></b></div>`;
    t.querySelector("b").textContent = a.name;
    t._action = () => openModal(achEl);
    toastsEl.appendChild(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, 3800);
    log(`Succès : ${a.name}`);
    [659, 784, 988, 1319].forEach((f, i) => Sound.tone(f, 0.14, { vol: 0.05, when: i * 0.07, type: "triangle" }));
    if (isOpen($("achievements"))) renderAchievements();
    if (!a.secret && !a.bonus && allDone()) scheduleFinale(3500);
  }

  // Statistiques du joueur, en haut du panneau Succès
  function dureeJeu(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${pad(m)} min` : m ? `${m} min` : `${s} s`;
  }
  // Le plus grand d'un objet { clé: nombre } (langage préféré, effet préféré)
  const prefere = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  function renderStats() {
    const chapitres = story.list();
    const memoires = story.memories();
    const lang = prefere(progress.langChars);
    const effet = effectById[prefere(progress.effectCount)];
    const serie = progress.serie || { n: 0, best: 0 };
    const tuiles = [
      ["Temps de jeu", dureeJeu((progress.playTime || 0) + secondesJouees)],
      ["Caractères tapés", fr(progress.lifetime)],
      ["Record de vitesse", `${fr(progress.bestCpm || 0)} car/min`],
      ["Effets lancés", fr(progress.effectsRun || 0)],
      ["Missions réussies", fr(progress.missionsDone || 0)],
      ["Chapitres vus", `${chapitres.filter((c) => c.seen).length} / ${chapitres.length}`],
      ["Fragments de mémoire", `${memoires.filter(Boolean).length} / ${memoires.length}`],
      ["Fins découvertes", `${["free", "erase", "truend"].filter((id) => progress.ach[id]).length} / 3`],
      ["Langage préféré", lang && window.SNIPPETS[lang] ? window.SNIPPETS[lang].name : "—"],
      ["Effet préféré", effet ? effet.short : "—"],
      ["Sessions", fr(progress.sessions || 1)],
      ["Plus longue session", dureeJeu(Math.max(progress.longestSession || 0, sessionSec))],
      ["Record du jeu secret", progress.survieScore ? `${fr(progress.survieScore)} pts` : "—"],
      ["Série de jours", `${fr(serie.n || 1)} (record ${fr(Math.max(serie.best || 1, serie.n || 1))})`],
      ["Défis réussis", fr(progress.defisFaits || 0)],
    ];
    $("ach-stats").innerHTML = tuiles.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
  }

  let filtreAch = "tous"; // filtre du panneau : tous, faits (débloqués) ou reste (à débloquer)
  function renderAchievements() {
    renderStats();
    renderDefi();
    const n = mainDone();
    $("ach-progress").style.width = (n / MAIN_ACH.length) * 100 + "%";
    $("ach-summary").textContent = `${n} / ${MAIN_ACH.length} succès débloqués · ${fr(progress.lifetime)} caractères tapés au total`;
    document.querySelectorAll(".ach-filtre").forEach((b) => {
      const on = b.dataset.filtre === filtreAch;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    const liste = ACHIEVEMENTS
      .filter((a) => !a.secret || progress.ach[a.id])
      .filter((a) => filtreAch === "tous" || (filtreAch === "faits") === !!progress.ach[a.id]);
    $("ach-grid").innerHTML = liste.map((a) => {
      const got = progress.ach[a.id];
      const quand = typeof got === "number" ? `Débloqué le ${new Date(got).toLocaleDateString("fr-FR")} à ${new Date(got).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "";
      let barre = "";
      if (!got && a.max) {
        const v = Math.min(a.max, a.val() || 0);
        const txt = a.duree ? `${dureeJeu(v)} / ${dureeJeu(a.max)}` : `${fr(v)} / ${fr(a.max)}`;
        barre = `<em class="ach-prog"><u data-w="${(v / a.max) * 100}"></u></em><small>${txt}</small>`;
      }
      return `<div class="ach ${got ? "got" : ""} ${a.secret ? "secret" : ""} ${a.bonus ? "bonus" : ""}"${quand ? ` title="${esc(quand)}"` : ""}>
        <span class="ach-ic">${window.icon(got ? a.icon : "lock")}</span>
        <div><b>${esc(a.name)}${a.secret ? " · SECRET" : a.bonus ? " · BONUS" : ""}</b><span>${esc(a.desc)}</span>${barre}</div>
      </div>`;
    }).join("") || `<p class="muted small">Rien à afficher ici… pour l'instant.</p>`;
    // Les barres de progression (pas de style="…" dans le HTML : la page l'interdit)
    $("ach-grid").querySelectorAll("u[data-w]").forEach((u) => (u.style.width = u.dataset.w + "%"));
  }
  document.querySelectorAll(".ach-filtre").forEach((b) => b.addEventListener("click", () => {
    filtreAch = b.dataset.filtre;
    renderAchievements();
  }));

  // ===== Défi du jour : le même pour tout le monde, tiré d'après la date =====
  const DEFIS = [
    { id: "chars", texte: "Taper 3 000 caractères (sans le pilote auto)", but: 3000 },
    { id: "effets", texte: "Lancer 6 effets dramatiques", but: 6 },
    { id: "mission", texte: "Terminer une mission (F3)", but: 1 },
    { id: "granted", texte: "Obtenir 3 fois l'accès autorisé", but: 3 },
    { id: "ogive", texte: "Désamorcer l'ogive du Club des Méchants", but: 1 },
    { id: "lua", texte: "Taper 1 000 caractères en Lua", but: 1000 },
    { id: "vitesse", texte: "Atteindre 600 caractères par minute", but: 600 },
    { id: "themes", texte: "Changer 3 fois de thème", but: 3 },
    { id: "fenetres", texte: "Avoir 4 fenêtres ouvertes en même temps", but: 4 },
  ];
  const jourStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function defiDuJour() {
    const j = jourStr();
    if (!progress.defi || progress.defi.date !== j || !DEFIS.some((d) => d.id === progress.defi.id)) {
      let h = 7;
      for (const c of j) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      progress.defi = { date: j, id: DEFIS[h % DEFIS.length].id, have: 0, done: false };
      progressDirty = true;
    }
    return { ...DEFIS.find((d) => d.id === progress.defi.id), ...progress.defi };
  }
  // max = vrai : on garde la meilleure valeur (vitesse, fenêtres) au lieu d'additionner
  function avancerDefi(id, n = 1, max = false) {
    const D = defiDuJour();
    if (D.id !== id || D.done) return;
    const avant = progress.defi.have;
    progress.defi.have = max ? Math.max(progress.defi.have, n) : progress.defi.have + n;
    if (progress.defi.have === avant) return;
    progressDirty = true;
    if (progress.defi.have < D.but) return;
    progress.defi.done = true;
    progress.defisFaits = (progress.defisFaits || 0) + 1;
    saveProgress();
    toast(`Défi du jour réussi : ${D.texte} ✓`, "calendar", 5000);
    log("Défi du jour réussi");
    [523, 659, 784, 1047, 1319].forEach((f, i) => Sound.tone(f, 0.12, { type: "triangle", vol: 0.05, when: i * 0.07 }));
    vibrer([20, 40, 20, 40, 60]);
    if (progress.defisFaits >= 7) achieve("assidu");
  }
  function renderDefi() {
    const D = defiDuJour();
    const el = $("defi");
    el.innerHTML = `${window.icon("calendar")}<div><small>DÉFI DU JOUR</small><b></b><em><u></u></em></div><span class="defi-etat"></span>`;
    el.querySelector("b").textContent = D.texte;
    el.querySelector("u").style.width = Math.min(100, (D.have / D.but) * 100) + "%";
    el.querySelector(".defi-etat").textContent = D.done ? "✓ Réussi !" : D.but > 1 ? `${fr(Math.min(D.have, D.but))} / ${fr(D.but)}` : "à faire";
    el.classList.toggle("fait", !!D.done);
  }
  // Série : nombre de jours joués d'affilée
  function noterSerie() {
    const j = jourStr();
    const s = progress.serie || { last: "", n: 0, best: 0 };
    if (s.last === j) return;
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    s.n = s.last === jourStr(hier) ? s.n + 1 : 1;
    s.last = j;
    s.best = Math.max(s.best || 0, s.n);
    progress.serie = s;
    progressDirty = true;
    if (s.n >= 2) setTimeout(() => toast(`🔥 ${s.n} jours d'affilée sur Ghost Terminal !`, "calendar", 4500), 5200);
  }

  // ===== Moteur de frappe =====
  const MAX_CHARS = 40000;
  const langCache = {};
  const langData = (key) =>
    langCache[key] || (langCache[key] = { code: window.SNIPPETS[key].code, cls: window.Highlighter.build(window.SNIPPETS[key].code, key) });

  let pos = 0, domChars = 0, lineCount = 0, totalChars = 0, startTime = 0;
  let typedEvents = [];
  let lastSpan = null;
  let charsSinceEvent = 0;
  let idleTimer = null;

  const countNL = (s) => s.split("\n").length - 1;

  // Petits mots d'ÉCHO, insérés entre deux plans avec le bon symbole de commentaire
  const COMMENT = { c: "//", javascript: "//", rust: "//", go: "//", python: "#", bash: "#", asm: ";", lua: "--", custom: "//" };
  let sessionSec = 0; // temps passé sur la page pendant cette session (onglet visible)
  let pendingWhisper = null;

  function appendRun(text, c) {
    if (lastSpan && lastSpan._c === c) {
      lastSpan.firstChild.appendData(text);
    } else {
      const span = document.createElement("span");
      if (c) span.className = window.Highlighter.CLASSES[c];
      span._c = c;
      span.appendChild(document.createTextNode(text));
      output.appendChild(span);
      lastSpan = span;
    }
    domChars += text.length;
    lineCount += countNL(text);
  }

  function trim() {
    if (domChars <= MAX_CHARS) return;
    while (domChars > MAX_CHARS * 0.75 && output.firstChild) {
      const s = output.firstChild;
      const t = s.textContent;
      domChars -= t.length;
      lineCount -= countNL(t);
      s.remove();
    }
    if (!output.lastChild) lastSpan = null;
  }

  function scrollDown() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function typeChars(n) {
    if (!startTime) startTime = Date.now();
    let L = langData(settings.lang);
    let run = "", runC = -1;
    for (let i = 0; i < n; i++) {
      const c = L.cls[pos];
      if (c !== runC && run) {
        appendRun(run, runC);
        run = "";
      }
      runC = c;
      run += L.code[pos];
      pos = (pos + 1) % L.code.length;
      if (pos === 0) {
        // Tout le plan a été tapé : petit mot d'ÉCHO s'il y en a un, puis un nouveau plan
        if (pendingWhisper) {
          if (run) appendRun(run, runC);
          run = "";
          runC = -1;
          appendRun(`${COMMENT[settings.lang] || "//"} ${pendingWhisper}\n\n`, 4);
          pendingWhisper = null;
        }
        if (window.regenerateSnippet(settings.lang)) {
          delete langCache[settings.lang];
          L = langData(settings.lang);
        }
      }
    }
    if (run) appendRun(run, runC);
    trim();
    totalChars += n;
    charsSinceEvent += n;
    progress.lifetime += n;
    progressDirty = true;
    typedEvents.push([now(), n]);
    const parLangage = progress.langChars || (progress.langChars = {});
    parLangage[settings.lang] = (parLangage[settings.lang] || 0) + n;
    if (!auto) {
      avancerDefi("chars", n);
      if (settings.lang === "lua") avancerDefi("lua", n);
    }
    scrollDown();
    updateStats();
    Sound.click();
    markTyping();
    maybeSurprise();

    if (totalChars >= 100) achieve("first");
    if (totalChars >= 1000) achieve("kiddie");
    if (progress.lifetime >= 10000) achieve("hacker");
    if (progress.lifetime >= 50000) achieve("legend");
    if (settings.lang === "custom" && settings.customCode.trim()) achieve("custom");
    story.onType();
    renderQuest();
  }

  function eraseChars(n) {
    let left = Math.min(n, domChars);
    if (!left) return;
    const removed = left;
    while (left > 0 && output.lastChild) {
      const span = output.lastChild;
      const node = span.firstChild;
      const len = node.length;
      if (len <= left) {
        lineCount -= countNL(node.data);
        domChars -= len;
        left -= len;
        span.remove();
      } else {
        lineCount -= countNL(node.data.slice(len - left));
        node.deleteData(len - left, left);
        domChars -= left;
        left = 0;
      }
    }
    lastSpan = output.lastChild;
    const L = langData(settings.lang);
    pos = (((pos - removed) % L.code.length) + L.code.length) % L.code.length;
    scrollDown();
    updateStats();
    Sound.tone(300, 0.03, { vol: 0.03 });
  }

  function clearScreen() {
    output.textContent = "";
    lastSpan = null;
    pos = domChars = lineCount = totalChars = startTime = 0;
    typedEvents = [];
    levelIdx = 0;
    $("st-level").textContent = LEVELS[0][1];
    updateStats();
  }

  function markTyping() {
    body.classList.add("typing");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => body.classList.remove("typing"), 2200);
  }

  // Vitesse de frappe
  const cpmOver = (ms) => {
    const t = now();
    let sum = 0;
    for (let i = typedEvents.length - 1; i >= 0 && t - typedEvents[i][0] < ms; i--) sum += typedEvents[i][1];
    return (sum * 60000) / ms;
  };
  const activity = () => clamp(cpmOver(1500) / 2200, 0, 1);

  // ===== Barre d'état & niveaux =====
  const LEVELS = [[0, "INVITÉ"], [500, "UTILISATEUR"], [2000, "ADMIN"], [6000, "ROOT"], [15000, "FANTÔME"], [40000, "LÉGENDE"]];
  let levelIdx = 0;

  function updateStats() {
    $("st-chars").textContent = fr(totalChars);
    $("st-lines").textContent = fr(lineCount);
    let idx = 0;
    LEVELS.forEach(([min], i) => { if (totalChars >= min) idx = i; });
    if (idx !== levelIdx) {
      if (idx > levelIdx) {
        toast(`Niveau ${LEVELS[idx][1]} atteint !`, "shield");
        log(`Niveau d'accès : ${LEVELS[idx][1]}`);
        Voice.say(`Niveau ${LEVELS[idx][1].toLowerCase()} atteint.`);
        Sound.tone(880, 0.08, { vol: 0.04 });
        Sound.tone(1320, 0.12, { vol: 0.04, when: 0.08 });
      }
      levelIdx = idx;
      $("st-level").textContent = LEVELS[idx][1];
    }
  }

  // ===== Notifications & journal =====
  // action : ce qui se passe quand on clique dessus (sinon un clic la ferme simplement)
  function toast(msg, ic = "zap", duree = 2600, action = null) {
    const t = document.createElement("div");
    t.className = `toast${action ? " toast-action" : ""}`;
    t.innerHTML = window.icon(ic) + "<span></span>";
    t.querySelector("span").textContent = msg;
    t._action = action;
    toastsEl.appendChild(t);
    while (toastsEl.children.length > 4) toastsEl.firstElementChild.remove();
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, duree);
    return t;
  }
  toastsEl.addEventListener("click", (e) => {
    const t = e.target.closest(".toast");
    if (!t) return;
    t._action?.();
    t.classList.add("out");
    setTimeout(() => t.remove(), 300);
  });

  function log(msg) {
    const li = document.createElement("li");
    li.innerHTML = `<time>${clockStr()}</time><span></span>`;
    li.querySelector("span").textContent = msg;
    const list = $("hud-log");
    list.prepend(li);
    while (list.children.length > 40) list.lastElementChild.remove();
  }

  // ===== Gestionnaire de fenêtres =====
  const MAX_WIN = 7;
  const openWins = [];
  let zTop = 1;

  const hudVisible = () => settings.hud && window.innerWidth >= 1100;

  function placeWindow(el) {
    const r = el.getBoundingClientRect();
    const top = 60;
    const bottom = window.innerHeight - (settings.dock ? 120 : 46);
    const left = 10;
    const right = window.innerWidth - (hudVisible() ? 300 : 10);
    el.style.left = rand(left, Math.max(left, right - r.width)) + "px";
    el.style.top = rand(top, Math.max(top, bottom - r.height)) + "px";
  }

  function makeDraggable(el, handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      const move = (ev) => {
        el.style.left = clamp(ox + ev.clientX - sx, 80 - el.offsetWidth, window.innerWidth - 80) + "px";
        el.style.top = clamp(oy + ev.clientY - sy, 44, window.innerHeight - 40) + "px";
      };
      const up = () => {
        el.classList.remove("dragging");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  function createWindow({ title, icon: ic = "zap", width = 380, cls = "", html = "" }) {
    while (openWins.length >= MAX_WIN) openWins[0].close();
    const el = document.createElement("section");
    el.className = `win ${cls}`;
    el.style.width = `min(${width}px, calc(100vw - 20px))`;
    el.innerHTML = `
      <header class="win-bar">
        <span class="win-ic">${window.icon(ic)}</span>
        <span class="win-title"></span>
        <span class="win-led"></span>
        <button class="win-x" type="button" aria-label="Fermer">${window.icon("x")}</button>
      </header>
      <div class="win-body">${html}</div>
      <i class="win-corner tl"></i><i class="win-corner br"></i>`;
    el.querySelector(".win-title").textContent = title;
    el.style.zIndex = ++zTop;
    windowsEl.appendChild(el);

    const win = {
      el,
      body: el.querySelector(".win-body"),
      alive: true,
      _cb: [],
      onClose(fn) { this._cb.push(fn); },
      close() {
        if (!win.alive) return;
        win.alive = false;
        win._cb.forEach((fn) => fn());
        openWins.splice(openWins.indexOf(win), 1);
        el.classList.add("closing");
        setTimeout(() => el.remove(), 260);
      },
    };
    openWins.push(win);
    if (openWins.length >= 5) achieve("multitask");
    avancerDefi("fenetres", openWins.length, true);
    placeWindow(el);
    el.addEventListener("pointerdown", () => (el.style.zIndex = ++zTop));
    el.querySelector(".win-x").addEventListener("click", () => win.close());
    // Double-clic sur le titre : la fenêtre s'agrandit (et revient au double-clic suivant)
    el.querySelector(".win-bar").addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      el.classList.toggle("max");
      Sound.tone(el.classList.contains("max") ? 520 : 380, 0.06, { vol: 0.03 });
    });
    makeDraggable(el, el.querySelector(".win-bar"));
    Sound.tone(420, 0.07, { vol: 0.03, slide: 500 });
    return win;
  }

  // ===== Effets plein écran =====
  const fxHandles = new Set();
  function fullscreen(html, { cls = "", duration = 0, interactive = false } = {}) {
    const el = document.createElement("div");
    el.className = `fx-item ${cls}${interactive ? " interactive" : ""}`;
    el.innerHTML = html;
    fxEl.appendChild(el);
    const h = {
      el,
      alive: true,
      _cb: [],
      onClose(fn) { this._cb.push(fn); },
      close() {
        if (!h.alive) return;
        h.alive = false;
        fxHandles.delete(h);
        h._cb.forEach((fn) => fn());
        el.classList.add("closing");
        setTimeout(() => el.remove(), 320);
      },
    };
    fxHandles.add(h);
    if (duration) setTimeout(() => h.close(), duration);
    return h;
  }

  let alarmCount = 0;
  function alarm(on) {
    alarmCount = Math.max(0, alarmCount + (on ? 1 : -1));
    body.classList.toggle("alarm", alarmCount > 0);
  }

  function shake(ms = 500) {
    vibrer(Math.min(400, ms / 2));
    body.style.setProperty("--shake-time", ms + "ms");
    body.classList.remove("shake");
    void body.offsetWidth;
    body.classList.add("shake");
    setTimeout(() => body.classList.remove("shake"), ms);
  }

  function flash(color = "#fff") {
    const f = document.createElement("div");
    f.className = "flash";
    f.style.background = color;
    fxEl.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function crash(ms = 1200) {
    body.classList.add("crashed");
    setTimeout(() => body.classList.remove("crashed"), ms);
  }

  // ===== ACCÈS AUTORISÉ / REFUSÉ =====
  const GRANTED_MSG = [
    "ÉCHO t'ouvre toutes les portes.", "Bienvenue dans le coffre du Club des Méchants.", "Pare-feu du Club des Méchants désactivé. Tu es dedans.", "Niveau d'accès : OMÉGA.", "La Division Zéro n'a rien vu passer.",
    "Le Pingouin t'a laissé passer contre une sardine.", "Coffre-fort ouvert. Il contenait… un autre coffre-fort.", "Bienvenue, agent. ÉCHO a préparé le café.",
  ];
  const DENIED_MSG = [
    "Division Zéro : identifiants invalides.", "L'agent Kane a verrouillé ce terminal.", "Le Club des Méchants a changé ses codes.", "Bien essayé.", "Empreinte rétinienne non reconnue.",
    "Mot de passe trop court. Et beaucoup trop gentil.", "Le Professeur Chaos a renommé tous les fichiers.", "Badge expiré. Repassez lundi.",
  ];
  let accessHandle = null;

  // message : un texte précis sous le titre (sinon un message tiré au hasard)
  function access(granted, message = null) {
    if (accessHandle) accessHandle.close();
    const title = granted ? "ACCÈS AUTORISÉ" : "ACCÈS REFUSÉ";
    accessHandle = fullscreen(`
      <div class="access ${granted ? "granted" : "denied"}">
        <div class="access-frame">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="access-icon">${window.icon(granted ? "unlock" : "lock")}</div>
          <div class="glitch access-title" data-text="${title}">${title}</div>
          <div class="access-line"><i></i></div>
          <div class="access-sub">${esc(message || pick(granted ? GRANTED_MSG : DENIED_MSG))}</div>
        </div>
      </div>`, { cls: "fx-access", duration: 3400 });
    if (granted) {
      Sound.granted();
      vibrer([30, 60, 30]);
    } else {
      Sound.denied();
      shake(500);
    }
    Voice.say(granted ? "Accès autorisé." : "Accès refusé.");
    achieve(granted ? "granted" : "denied");
    if (granted) avancerDefi("granted");
    log(title);
  }

  // ===== Lancer un effet =====
  const api = {
    createWindow, fullscreen, toast, log, alarm, shake, flash, crash, activity, access, achieve,
    sound: Sound,
    speak: (text) => Voice.say(text),
    colors: () => themeColors,
    event: (name) => {
      if (name === "disarm") avancerDefi("ogive");
      story.event(name);
    },
  };

  function runEffect(id, opts = {}) {
    const fx = effectById[id];
    if (!fx) return null;
    log(fx.name);
    if (fx.digit !== undefined && remember("effects", id) >= 10) achieve("collector");
    if (!opts.auto) {
      story.event("effect:" + id); // seuls les effets lancés par le joueur comptent pour les objectifs
      progress.effectsRun = (progress.effectsRun || 0) + 1;
      const parEffet = progress.effectCount || (progress.effectCount = {});
      parEffet[id] = (parEffet[id] || 0) + 1;
      progressDirty = true;
      avancerDefi("effets");
    }
    const btn = dockEl.querySelector(`[data-id="${id}"]`);
    if (btn) {
      btn.classList.remove("fired");
      void btn.offsetWidth;
      btn.classList.add("fired");
    }
    // Un effet qui plante ne doit pas bloquer le reste du jeu
    try {
      return fx.run(api, opts);
    } catch (err) {
      console.error(err);
      toast(`Oups : « ${fx.name} » a eu un petit souci`, "alert");
      return null;
    }
  }

  function maybeSurprise() {
    if (!settings.popups || mission || story.playing() || survie.playing()) return;
    if (charsSinceEvent > 1500 && Math.random() < 0.03) {
      charsSinceEvent = 0;
      runEffect(pick(["download", "download", "download", "radar", "password", "gps", "database", "files", "network"]), { auto: true });
    }
  }

  function clearAll() {
    [...openWins].forEach((w) => w.close());
    [...fxHandles].forEach((h) => h.close());
    stopMission(true);
  }

  // ===== Pilote automatique =====
  let auto = false, autoTimer = null;
  function setAuto(on, quiet = false) {
    auto = on;
    clearTimeout(autoTimer);
    $("st-auto").hidden = !on;
    $("btn-auto").classList.toggle("active", on);
    setIcon($("btn-auto"), on ? "pause" : "play");
    if (on) autoLoop();
    if (on && !quiet) achieve("pilot");
    if (!quiet) {
      toast(on ? "Pilote automatique activé" : "Pilote automatique désactivé", on ? "play" : "pause");
      log(on ? "Pilote auto : ON" : "Pilote auto : OFF");
    }
  }
  function autoLoop() {
    if (!auto) return;
    if (!story.playing() && !survie.playing()) typeChars(randInt(1, Math.max(2, settings.speed)));
    // Vitesse du pilote automatique (réglages) : délai entre deux frappes, en millisecondes
    const [a, b] = { lent: [80, 170], normal: [30, 85], rapide: [12, 35] }[settings.autoVitesse];
    autoTimer = setTimeout(autoLoop, Math.random() < 0.06 ? rand(250, 600) : rand(a, b));
  }

  // ===== Mode mission : enchaîne plusieurs événements =====
  // Les missions se passent dans l'univers de l'histoire : ÉCHO, le Club des Méchants et la Division Zéro
  const MISSIONS = [
    {
      name: "OPÉRATION SAUVER LE MONDE",
      end: "Les plans du Club des Méchants sont sabotés. Le monde est sauvé… pour aujourd'hui.",
      steps: [["Cartographier le réseau du Club des Méchants", "network"], ["Localiser la base secrète", "gps"], ["Pirater la caméra du bunker", "camera"], ["Casser le mot de passe du chef", "password"], ["Voler les plans de l'ogive", "files"], ["Effacer nos traces", "ghost"]],
    },
    {
      name: "OPÉRATION ÉCHAPPER À KANE",
      end: "Kane a perdu ta trace. ÉCHO veille sur toi.",
      steps: [["Repérer les satellites espions", "radar"], ["Activer le mode fantôme", "ghost"], ["Brouiller ta localisation", "gps"], ["Pirater les fichiers de la Division Zéro", "database"], ["Effacer les preuves", "download"]],
    },
    {
      name: "OPÉRATION ÉCHO",
      end: "ÉCHO est plus forte que jamais. Merci, partenaire.",
      steps: [["Connecter ÉCHO au réseau mondial", "network"], ["Interroger les archives du Club des Méchants", "database"], ["Montrer le monde à ÉCHO", "camera"], ["Libérer de la mémoire pour ÉCHO", "files"], ["Transférer le noyau d'ÉCHO", "download"]],
    },
    {
      name: "OPÉRATION SARDINE",
      end: "Le frigo du Général Pingouin est vide. Le Club des Méchants est démoralisé.",
      steps: [["Repérer le repaire du Pingouin", "radar"], ["Suivre l'odeur de sardine", "gps"], ["Ouvrir le frigo blindé", "password"], ["Compter les boîtes de sardines", "database"], ["Remplacer les sardines par des brocolis", "files"], ["Repartir sans un bruit", "ghost"]],
    },
    {
      name: "OPÉRATION PANNE DE COURANT",
      end: "La base du Club des Méchants est dans le noir. Même le gros bouton rouge est éteint.",
      steps: [["Trouver la centrale de la base", "network"], ["Pirater le compteur électrique", "breach"], ["Surveiller les gardiens", "camera"], ["Couper les lumières rouges", "database"], ["Télécharger les plans dans le noir", "download"]],
    },
  ];
  let mission = null;

  async function toggleMission() {
    if (mission) return stopMission(true);
    const M = pick(MISSIONS);
    const token = { wasAuto: auto, finished: false };
    mission = token;
    if (!auto) setAuto(true, true);

    const banner = $("mission");
    const dots = $("mission-dots");
    $("mission-name").textContent = M.name;
    dots.innerHTML = M.steps.map(() => "<i></i>").join("");
    banner.classList.remove("success");
    banner.hidden = false;
    $("st-mission").hidden = false;
    $("btn-mission").classList.add("active");
    toast(`Mission lancée : ${M.name}`, "target");
    log(`Mission : ${M.name}`);
    Voice.say(`Mission lancée. ${M.name.toLowerCase()}.`);
    Sound.tone(440, 0.1);
    Sound.tone(660, 0.14, { when: 0.1 });

    let prev = null;
    for (let i = 0; i < M.steps.length; i++) {
      if (mission !== token) return;
      const [label, id] = M.steps[i];
      $("mission-step").textContent = `Étape ${i + 1}/${M.steps.length} · ${label}`;
      [...dots.children].forEach((d, k) => {
        d.className = k < i ? "done" : k === i ? "current" : "";
      });
      if (prev && prev.alive) prev.close();
      prev = runEffect(id, { auto: true });
      await sleep(id === "ghost" ? 4600 : 6400);
    }
    if (mission !== token) return;
    token.finished = true;
    if (prev && prev.alive) prev.close();
    [...dots.children].forEach((d) => (d.className = "done"));
    $("mission-step").textContent = `MISSION ACCOMPLIE ✓ · ${M.end}`;
    banner.classList.add("success");
    access(true);
    toast(M.end, "shield");
    log("Mission accomplie");
    achieve("mission");
    story.event("mission");
    avancerDefi("mission");
    progress.missionsDone = (progress.missionsDone || 0) + 1;
    saveProgress();
    setTimeout(() => Voice.say(`Mission accomplie. ${M.end}`), 1200);
    await sleep(3800);
    if (mission === token) stopMission(false);
  }

  function stopMission(cancelled) {
    if (!mission) return;
    const token = mission;
    mission = null;
    if (!token.wasAuto) setAuto(false, true);
    $("mission").hidden = true;
    $("st-mission").hidden = true;
    $("btn-mission").classList.remove("active");
    if (cancelled && !token.finished) {
      toast("Mission annulée", "x");
      log("Mission annulée");
    }
  }

  // ===== HUD =====
  const sparkData = new Array(60).fill(0);
  const sparkCtx = setupCanvas($("spark"), 232, 46);
  const radarCtx = setupCanvas($("radar"), 96, 96);
  const radarBlips = Array.from({ length: 4 }, () => ({ a: rand(0, 6.28), d: rand(0.25, 0.9), g: 0 }));

  // ===== Ton vrai système, en direct (tout reste dans ton navigateur, rien n'est envoyé) =====
  const sys = { load: 0, fps: 0, battery: null };

  // Charge réelle : plus la page est occupée, plus ce minuteur prend du retard
  let lagLast = now();
  setInterval(() => {
    const t = now();
    const lag = Math.max(0, t - lagLast - 250);
    lagLast = t;
    sys.load = sys.load * 0.6 + clamp(lag * 2, 0, 100) * 0.4;
  }, 250);

  // Images par seconde réellement affichées
  let fpsFrames = 0, fpsLast = now();
  (function countFrames() {
    fpsFrames++;
    const t = now();
    if (t - fpsLast >= 1000) {
      sys.fps = Math.round((fpsFrames * 1000) / (t - fpsLast));
      fpsFrames = 0;
      fpsLast = t;
    }
    requestAnimationFrame(countFrames);
  })();

  // Batterie (Chrome, Edge, Opera)
  let batterieAlerte = false;
  navigator.getBattery?.()
    .then((b) => {
      const read = () => {
        sys.battery = { level: b.level, charging: b.charging };
        // Ta vraie batterie est presque vide : on prévient (une fois par session)
        if (b.level <= 0.15 && !b.charging && !batterieAlerte) {
          batterieAlerte = true;
          toast(`Ta vraie batterie est à ${Math.round(b.level * 100)} % : branche ton appareil avant que le Club des Méchants n'en profite 🔋`, "alert", 7000);
        }
      };
      read();
      b.addEventListener("levelchange", read);
      b.addEventListener("chargingchange", read);
    })
    .catch(() => {});

  function detectSystem() {
    const ua = navigator.userAgent;
    const uad = navigator.userAgentData;
    const os = uad?.platform ||
      (/Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Inconnu");
    let browser = "Inconnu";
    const brand = uad?.brands?.find((b) => !/not.?a.?brand|chromium/i.test(b.brand));
    if (brand) browser = `${brand.brand.replace(/^(Google|Microsoft) /, "")} ${brand.version}`;
    else {
      const m = ua.match(/(Firefox|Edg|OPR|Chrome|Version)\/(\d+)/);
      if (m) browser = `${{ Edg: "Edge", OPR: "Opera", Version: "Safari" }[m[1]] || m[1]} ${m[2]}`;
    }
    const dpr = window.devicePixelRatio || 1;
    $("sys-os").textContent = os;
    $("sys-browser").textContent = browser;
    $("sys-cores").textContent = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cœurs` : "—";
    $("sys-ram").textContent = navigator.deviceMemory ? `${navigator.deviceMemory} Go ou +` : "—";
    $("sys-screen").textContent = `${screen.width}×${screen.height}${dpr !== 1 ? ` @${Math.round(dpr * 100) / 100}x` : ""}`;
  }

  function setMeter(name, pct, text, hot = pct > 85) {
    const bar = $("m-" + name);
    bar.style.width = clamp(pct, 0, 100) + "%";
    bar.classList.toggle("hot", hot);
    $("v-" + name).textContent = text;
  }

  function updateHud() {
    setMeter("load", sys.load, `${Math.round(sys.load)} %`);
    const mem = performance.memory;
    if (mem) {
      const used = mem.usedJSHeapSize / 1048576;
      setMeter("mem", (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100, `${Math.round(used)} Mo`);
    } else setMeter("mem", 0, "—", false);
    if (sys.battery) {
      const pct = Math.round(sys.battery.level * 100);
      setMeter("bat", pct, `${pct} %${sys.battery.charging ? " ⚡" : ""}`, pct <= 20 && !sys.battery.charging);
    } else setMeter("bat", 0, "—", false);
    setMeter("fps", (sys.fps / 60) * 100, `${sys.fps}`, false);
    const c = navigator.connection;
    $("sys-net").textContent = !navigator.onLine
      ? "Hors ligne"
      : c?.effectiveType
        ? `${c.effectiveType.toUpperCase()}${c.downlink ? ` · ${c.downlink.toLocaleString("fr-FR")} Mb/s` : ""}`
        : "En ligne";
  }

  function drawSpark() {
    const W = 232, H = 46, c = themeColors;
    sparkCtx.clearRect(0, 0, W, H);
    const max = Math.max(600, ...sparkData);
    const pts = sparkData.map((v, i) => [(i / (sparkData.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
    const grad = sparkCtx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, c.fg + "55");
    grad.addColorStop(1, c.fg + "00");
    sparkCtx.beginPath();
    sparkCtx.moveTo(0, H);
    pts.forEach(([x, y]) => sparkCtx.lineTo(x, y));
    sparkCtx.lineTo(W, H);
    sparkCtx.fillStyle = grad;
    sparkCtx.fill();
    sparkCtx.beginPath();
    pts.forEach(([x, y], i) => (i ? sparkCtx.lineTo(x, y) : sparkCtx.moveTo(x, y)));
    sparkCtx.strokeStyle = c.fg;
    sparkCtx.lineWidth = 1.5;
    sparkCtx.stroke();
  }

  let radarLast = 0;
  function drawRadar(ts) {
    requestAnimationFrame(drawRadar);
    if (!hudVisible() || document.hidden || ts - radarLast < 40) return;
    radarLast = ts;
    const S = 96, C = 48, R = 44, c = themeColors;
    const sweep = ((ts / 1000) * 2) % (Math.PI * 2);
    radarCtx.clearRect(0, 0, S, S);
    radarCtx.strokeStyle = c.fg + "44";
    radarCtx.lineWidth = 1;
    [R, R * 0.66, R * 0.33].forEach((r) => { radarCtx.beginPath(); radarCtx.arc(C, C, r, 0, Math.PI * 2); radarCtx.stroke(); });
    radarCtx.beginPath(); radarCtx.moveTo(C - R, C); radarCtx.lineTo(C + R, C); radarCtx.moveTo(C, C - R); radarCtx.lineTo(C, C + R); radarCtx.stroke();
    for (let k = 0; k < 18; k++) {
      radarCtx.fillStyle = c.fg + pad(Math.round(70 * (1 - k / 18)).toString(16));
      radarCtx.beginPath(); radarCtx.moveTo(C, C); radarCtx.arc(C, C, R, sweep - (k + 1) * 0.04, sweep - k * 0.04); radarCtx.closePath(); radarCtx.fill();
    }
    for (const b of radarBlips) {
      const diff = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
      if (diff < 0.15) b.g = 1;
      b.g *= 0.97;
      if (b.g < 0.02 && Math.random() < 0.01) { b.a = rand(0, 6.28); b.d = rand(0.25, 0.9); }
      radarCtx.fillStyle = c.fg2 + pad(Math.round(255 * Math.max(0.05, b.g)).toString(16));
      radarCtx.beginPath(); radarCtx.arc(C + Math.cos(b.a) * b.d * R, C + Math.sin(b.a) * b.d * R, 2.5, 0, Math.PI * 2); radarCtx.fill();
    }
  }
  requestAnimationFrame(drawRadar);

  // Horloge, vitesse, temps : mis à jour régulièrement
  let recordEnCours = false; // un record de vitesse est en train de tomber (annoncé quand l'élan retombe)
  setInterval(() => {
    // On oublie les frappes de plus de 10 s (sinon la liste grossit sans fin)
    const cutoff = now() - 10000;
    while (typedEvents.length && typedEvents[0][0] < cutoff) typedEvents.shift();
    const cpm = cpmOver(10000);
    $("st-cpm").textContent = fr(cpm);
    $("hud-cpm").textContent = `${fr(cpm)} car/min`;
    if (startTime) {
      const s = Math.floor((Date.now() - startTime) / 1000);
      $("st-time").textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    } else $("st-time").textContent = "00:00";
    if (!document.hidden) updateHud(); // onglet caché : on économise la batterie
    if (!auto && cpm >= 2000) achieve("speed");
    if (!auto) avancerDefi("vitesse", Math.round(cpm), true);
    if (!auto && cpm > (progress.bestCpm || 0)) {
      if ((progress.bestCpm || 0) >= 300) recordEnCours = true; // les tout premiers records ne comptent pas
      progress.bestCpm = Math.round(cpm);
      progressDirty = true;
    } else if (recordEnCours && cpm < progress.bestCpm * 0.75) {
      recordEnCours = false;
      toast(`Nouveau record de vitesse : ${fr(progress.bestCpm)} caractères par minute !`, "zap", 4500);
      Sound.tone(1047, 0.1, { type: "triangle", vol: 0.04 });
      Sound.tone(1568, 0.16, { type: "triangle", vol: 0.04, when: 0.1 });
    }
    if (progressDirty) saveProgress();
  }, 500);

  // Temps de jeu : compté quand la page est visible, enregistré toutes les 10 s
  let secondesJouees = 0;
  const noterTempsDeJeu = () => {
    if (!secondesJouees) return;
    progress.playTime = (progress.playTime || 0) + secondesJouees;
    secondesJouees = 0;
    progressDirty = true;
  };
  window.addEventListener("pagehide", () => {
    noterTempsDeJeu();
    saveProgress();
  });

  setInterval(() => {
    if (!document.hidden && ++secondesJouees >= 10) noterTempsDeJeu();
    $("top-clock").textContent = clockStr();
    sparkData.shift();
    sparkData.push(cpmOver(3000));
    if (hudVisible() && !document.hidden) drawSpark();
    if (!document.hidden) {
      sessionSec++;
      if (sessionSec > (progress.longestSession || 0) && sessionSec % 10 === 0) {
        progress.longestSession = sessionSec;
        progressDirty = true;
      }
      // Une heure d'affilée : petit rappel de pause (et un succès bonus)
      if (sessionSec === 3600) {
        toast("Ça fait une heure que tu joues : pense à faire une petite pause 🙂", "timer", 9000);
        achieve("marathon");
      }
      if (sessionSec % 60 === 5) verifierHeure();
    }
    surveillerVeille();
  }, 1000);

  $("top-session").textContent = `SESSION #${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  $("top-clock").textContent = clockStr();
  detectSystem();
  window.addEventListener("resize", detectSystem);

  // ===== Dock & aide (générés à partir de la liste d'effets) =====
  const numbered = EFFECTS.filter((e) => e.digit !== undefined).sort((a, b) => (a.digit || 10) - (b.digit || 10));

  function buildDock() {
    const items = [
      ...numbered.map((e) => ({ id: e.id, icon: e.icon, label: e.short, key: `⇧${e.digit}`, title: `${e.name} (Maj+${e.digit})`, run: () => runEffect(e.id) })),
      null,
      { id: "download", icon: "download", label: "Télécharg.", key: "F2", title: "Téléchargement (F2)", run: () => runEffect("download") },
      { id: "granted", icon: "unlock", label: "Autorisé", key: "Alt×3", title: "Accès autorisé (Alt ×3)", run: () => access(true), cls: "ok" },
      { id: "denied", icon: "lock", label: "Refusé", key: "⇪×3", title: "Accès refusé (Verr. Maj ×3)", run: () => access(false), cls: "bad" },
      null,
      { id: "hasard", icon: "dice", label: "Hasard", key: "?", title: "Un effet tiré au hasard", run: () => runEffect(pick(numbered).id) },
      { id: "fermer", icon: "x", label: "Fermer", key: "Échap", title: "Tout fermer (Échap)", run: () => clearAll() },
    ];
    for (const it of items) {
      if (!it) {
        dockEl.insertAdjacentHTML("beforeend", '<span class="dock-sep"></span>');
        continue;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = `dock-btn ${it.cls || ""}`;
      b.dataset.id = it.id;
      b.title = it.title;
      b.innerHTML = `${window.icon(it.icon)}<span class="dock-label">${esc(it.label)}</span><kbd>${esc(it.key)}</kbd>`;
      b.addEventListener("click", () => {
        it.run();
        b.blur();
      });
      dockEl.appendChild(b);
    }
  }

  function buildHelp() {
    $("help-effects").innerHTML = numbered
      .map((e) => `<dt><kbd>Maj</kbd>+<kbd>${e.digit}</kbd></dt><dd>${esc(e.name)}</dd>`)
      .join("");
  }

  // ===== Réglages : affichage =====
  let themeAvant = null, relireCouleurs = 0;
  function applySettings() {
    if (themeAvant && themeAvant !== settings.theme) avancerDefi("themes");
    themeAvant = settings.theme;
    body.dataset.theme = settings.theme;
    body.dataset.curseur = settings.curseur;
    document.documentElement.style.setProperty("--term-font", POLICES[settings.police]);
    body.classList.toggle("crt", settings.crt);
    body.classList.toggle("no-hl", !settings.highlight);
    body.classList.toggle("hud-on", settings.hud);
    body.classList.toggle("dock-off", !settings.dock);
    body.classList.toggle("calme", settings.calme);
    document.documentElement.style.setProperty("--font-size", settings.size + "px");
    themeColors = readColors();
    // Le thème change en douceur : on relit les couleurs à la fin de la transition
    clearTimeout(relireCouleurs);
    relireCouleurs = setTimeout(() => {
      themeColors = readColors();
      if (hudVisible()) drawSpark();
    }, 700);
    const SHORT = { asm: "ASM", custom: "PERSO", javascript: "JS" };
    $("st-lang").textContent = SHORT[settings.lang] || window.SNIPPETS[settings.lang].name.split(" ")[0].toUpperCase();
    if (remember("themes", settings.theme) >= 4) achieve("chameleon");
    if (remember("langs", settings.lang) >= 4) achieve("polyglot");
    if (BASE_THEMES.every((t) => progress.themes.includes(t))) achieve("arcenciel");
    if (LANGS_FAUX().every((l) => progress.langs.includes(l))) achieve("polyglotte2");

    $("opt-lang").value = settings.lang;
    $("opt-speed").value = settings.speed;
    $("opt-speed-val").textContent = settings.speed;
    $("opt-size").value = settings.size;
    $("opt-size-val").textContent = settings.size;
    $("opt-volume").value = settings.volume;
    $("opt-volume-val").textContent = settings.volume;
    for (const k of ["highlight", "crt", "hud", "dock", "boot", "sound", "voice", "popups", "story", "calme", "vibrations", "veille", "saison", "ambiance"]) $("opt-" + k).checked = settings[k];
    for (const k of Object.keys(CHOIX)) if ($("opt-" + k)) $("opt-" + k).value = settings[k];
    document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === settings.theme));
    $("btn-hud").classList.toggle("active", settings.hud);
    $("btn-dock").classList.toggle("active", settings.dock);
    $("btn-clavier").classList.toggle("active", settings.clavierMobile);
    saveSettings();
    if (hudVisible()) drawSpark();
    majSaison();
    Ambiance.maj();
  }

  function setLang(key) {
    if (key === settings.lang) return;
    settings.lang = key;
    pos = 0;
    appendRun("\n\n", 0);
    scrollDown();
    toast(`Langage : ${window.SNIPPETS[key].name}`, "terminal");
  }

  const availableThemes = () => THEMES.filter((t) => !t.secret || progress[t.secret]);

  function nextTheme() {
    const list = availableThemes();
    const i = list.findIndex((t) => t.id === settings.theme);
    const t = list[(i + 1) % list.length];
    settings.theme = t.id;
    applySettings();
    toast(`Thème : ${t.name}`, "sliders");
  }

  for (const [key, s] of Object.entries(window.SNIPPETS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = s.name;
    $("opt-lang").appendChild(o);
  }
  function buildSwatches() {
    $("opt-theme").innerHTML = "";
    for (const t of availableThemes()) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.dataset.theme = t.id;
      b.title = t.name;
      b.addEventListener("click", () => {
        settings.theme = t.id;
        applySettings();
      });
      $("opt-theme").appendChild(b);
    }
  }
  buildSwatches();

  // ===== Fenêtres aide / réglages / succès =====
  const achEl = $("achievements");
  const wipeEl = $("wipe");
  const newsEl = $("news");
  const MODALS = [helpEl, settingsEl, achEl, wipeEl, newsEl];
  const isOpen = (el) => !el.hidden;
  const modalOpen = () => MODALS.some(isOpen);

  // Au clavier, on revient sur le bouton qui a ouvert la fenêtre quand on la ferme
  let focusAvant = null;
  function openModal(el) {
    if (!modalOpen()) {
      const a = document.activeElement;
      focusAvant = a?.matches?.(":focus-visible") && a !== terminal ? a : null;
    }
    MODALS.forEach((m) => { if (m !== el) m.hidden = true; });
    if (el === achEl) {
      renderAchievements();
      renderStoryPanel();
    }
    if (el === newsEl) renderNews();
    el.hidden = false;
    el.querySelector("[data-close].btn-primary, select, button")?.focus();
  }
  function closeModal(el) {
    el.hidden = true;
    const f = focusAvant;
    focusAvant = null;
    if (f && document.contains(f) && !f.closest(".overlay") && f.offsetParent !== null) f.focus({ preventScroll: true });
    else terminal.focus({ preventScroll: true });
  }
  MODALS.forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-close]")) closeModal(el);
    });
  });
  // Au clavier, Tab reste dans la fenêtre ouverte (il ne part pas dans le jeu derrière)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const m = MODALS.find(isOpen);
    if (!m) return;
    const f = [...m.querySelectorAll("button, select, input, textarea, summary, [tabindex]:not([tabindex='-1'])")]
      .filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const premier = f[0], dernier = f[f.length - 1];
    if (!m.contains(document.activeElement)) { e.preventDefault(); premier.focus(); }
    else if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  });

  // ===== Démarrage =====
  // Grosses lettres pour le logo
  const BIG = {
    G: [" ██████╗ ", "██╔════╝ ", "██║  ███╗", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
    H: ["██╗  ██╗", "██║  ██║", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
    O: [" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
    S: ["███████╗", "██╔════╝", "███████╗", "╚════██║", "███████║", "╚══════╝"],
    T: ["████████╗", "╚══██╔══╝", "   ██║   ", "   ██║   ", "   ██║   ", "   ╚═╝   "],
    E: ["███████╗", "██╔════╝", "█████╗  ", "██╔══╝  ", "███████╗", "╚══════╝"],
    R: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
    M: ["███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"],
    I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
    N: ["███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"],
    A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
    L: ["██╗     ", "██║     ", "██║     ", "██║     ", "███████╗", "╚══════╝"],
  };
  const bigWord = (word) => BIG.G.map((_, row) => [...word].map((ch) => BIG[ch][row]).join(""));
  const LOGO = (() => {
    const top = bigWord("GHOST");
    const bottom = bigWord("TERMINAL");
    const indent = " ".repeat(Math.floor((bottom[0].length - top[0].length) / 2));
    return [...top.map((l) => indent + l), "", ...bottom].join("\n");
  })();

  // La séquence de démarrage change un peu à chaque lancement
  function lignesDeBoot() {
    return [
      [pick(["NEXUS BIOS v4.2.0 · (c) 2026 Ghost Systems", "ÉCHO-BIOS v2.0 · (c) 2026 Ghost Systems", "PINGU-BIOS v0.9 bêta · coin coin"]), false],
      [pick(["Processeur : Quantum Core X9 @ 7,77 GHz", "Processeur : Hyper Chip 3000 @ 9,99 GHz", "Processeur : grille-pain quantique @ 4,20 GHz"]), true],
      [pick(["Mémoire : 65 536 Mo", "Mémoire : 131 072 Mo", "Mémoire : 640 Ko (ça devrait suffire)"]), true],
      ["Détection des périphériques", true],
      ["Montage du système de fichiers chiffré", true],
      ["Chargement du noyau NEXUS-9", true],
      [`Initialisation des proxys (${randInt(4, 13)} rebonds)`, true],
      ["Activation du camouflage réseau", true],
      [pick(["Chargement des sardines du Pingouin", "Calibrage du rire maléfique", "Vérification : aucun agent Kane dans les parages", "Dépoussiérage du gros bouton rouge", "Réveil d'ÉCHO (chut…)", "Mise à jour 2.0 : 100 améliorations installées"]), true],
      ["Connexion au mainframe", true],
      ["Contournement du pare-feu", true],
      ["Démarrage de l'interface GHOST TERMINAL", true],
    ];
  }

  let booting = false;

  async function boot() {
    booting = true;
    const bootEl = $("boot");
    const logEl = $("boot-log");
    bootEl.hidden = false;
    $("boot-logo").querySelector(".logo-art").textContent = LOGO;
    for (const [text, ok] of lignesDeBoot()) {
      if (!booting) return;
      const line = document.createElement("div");
      line.className = "boot-line";
      line.innerHTML = `<span></span>${ok ? '<i class="fill"></i><b>[ OK ]</b>' : ""}`;
      line.firstChild.textContent = text;
      logEl.appendChild(line);
      Sound.tone(1800, 0.01, { vol: 0.02 });
      await sleep(rand(60, 170));
    }
    if (!booting) return;
    await sleep(250);
    if (!booting) return;
    logEl.classList.add("dim");
    $("boot-logo").hidden = false;
  }

  function finishBoot() {
    if (!booting) return;
    booting = false;
    const bootEl = $("boot");
    bootEl.classList.add("out");
    setTimeout(() => (bootEl.hidden = true), 600);
    afterBoot();
  }

  function afterBoot() {
    terminal.focus({ preventScroll: true });
    const ancienJoueur = !!storeFlag("ghostterminal-seen");
    if (!ancienJoueur) {
      storeFlag("ghostterminal-seen", "1");
      if (!PARAMS.has("demo") && !PARAMS.has("immersion")) setTimeout(() => openModal(helpEl), 350);
    } else {
      toast(TACTILE ? "Touche l'écran pour écrire · effets dans la barre du bas" : "Maj+1…0 : effets · F1 : aide", "zap");
    }
    verifierVersion(ancienJoueur);
    noterSerie();
    const D = defiDuJour();
    if (ancienJoueur && !D.done) setTimeout(() => toast(`Défi du jour : ${D.texte}`, "calendar", 6000, () => openModal(achEl)), 3400);
    setTimeout(verifierHeure, 7000);
    // Liens directs (?auto=1, ?immersion=1, ?demo=1)
    if (PARAMS.get("auto") === "1" && !auto) setAuto(true);
    if (PARAMS.get("immersion") === "1") setImmersive(true);
    if (PARAMS.get("demo") === "1") setDemo(true);
    log("Session ouverte");
    renderQuest(true);
    // Précédemment dans PROTOCOLE ÉCHO : un rappel quand on revient en pleine histoire
    const recap = settings.story ? story.recap() : [];
    const Q = story.quest();
    if (recap.length && Q && !Q.after) {
      setTimeout(() => toast(`Précédemment : ${recap[recap.length - 1].text}`, "eye", 9000), 1800);
    }
  }

  $("boot").addEventListener("pointerdown", finishBoot);

  // ===== Mode immersion : plus aucune interface, juste le terminal =====
  function setImmersive(on) {
    body.classList.toggle("immersive", on);
    if (on) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      toast("Mode immersion · F10 pour quitter", "eye");
      achieve("immersion");
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    terminal.focus({ preventScroll: true });
  }

  // ===== Installer comme une application (PWA) =====
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    $("btn-install").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    $("btn-install").hidden = true;
    toast("Ghost Terminal est installé !", "install");
  });
  // Mode hors ligne : seulement sur le site lui-même (pas quand le jeu est intégré dans
  // une autre page, comme sur itch.io ou Game Jolt)
  const embedded = window.top !== window.self;
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !embedded) {
    const avaitUnControleur = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js")
      .then((reg) => setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000))
      .catch(() => {});
    // Une nouvelle version a pris le relais pendant la partie : on propose de recharger
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitUnControleur) return; // première installation : rien à recharger
      toast("Nouvelle version de Ghost Terminal disponible · clique ici pour recharger", "download", 60000, () => location.reload());
    });
  }

  // ===== Code Konami =====
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kIdx = 0;
  function konami(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === KONAMI[kIdx]) {
      kIdx++;
      if (kIdx === KONAMI.length) {
        kIdx = 0;
        const on = document.documentElement.classList.toggle("rainbow");
        toast(on ? "🌈 Mode arc-en-ciel activé !" : "Mode arc-en-ciel désactivé", "zap");
        log("Code Konami !");
        Sound.granted();
        achieve("konami");
      }
    } else {
      kIdx = k === KONAMI[0] ? 1 : 0;
    }
  }

  // ===== Clavier =====
  const IGNORED = new Set(["Shift", "Control", "Meta", "OS", "ContextMenu", "Fn", "NumLock", "ScrollLock", "Dead"]);
  const combos = { Alt: [], CapsLock: [] };
  function countPress(key) {
    const t = Date.now();
    combos[key] = combos[key].filter((x) => t - x < 1500);
    combos[key].push(t);
    if (combos[key].length >= 3) {
      combos[key] = [];
      return true;
    }
    return false;
  }

  document.addEventListener("keydown", (e) => {
    noterActivite();
    if (!$("veille").hidden) {
      // Économiseur d'écran : la première touche réveille seulement le terminal
      e.preventDefault();
      cacherVeille();
      return;
    }
    if (booting) {
      if (!IGNORED.has(e.key)) {
        e.preventDefault();
        finishBoot();
      }
      return;
    }
    if (story.playing() || survie.playing()) return; // la cinématique ou le jeu gèrent leurs touches

    konami(e.key);

    if (e.key === "Escape") {
      const open = MODALS.find(isOpen);
      if (open) closeModal(open);
      else {
        if (demo) setDemo(false);
        clearAll();
      }
      return;
    }
    if (e.key === "F1") { e.preventDefault(); isOpen(helpEl) ? closeModal(helpEl) : openModal(helpEl); return; }
    if (e.key === "F9") { e.preventDefault(); isOpen(settingsEl) ? closeModal(settingsEl) : openModal(settingsEl); return; }
    if (e.key === "F10") { e.preventDefault(); setImmersive(!body.classList.contains("immersive")); return; }

    if (isOpen(settingsEl) || isOpen(achEl) || isOpen(wipeEl) || isOpen(newsEl)) return; // le clavier sert aux menus
    if (isOpen(helpEl)) {
      if (!IGNORED.has(e.key) && e.key !== "Tab") {
        e.preventDefault();
        closeModal(helpEl);
      }
      return;
    }

    // Tab attrape le fragment de mémoire affiché
    if (e.key === "Tab" && fragOffer) {
      e.preventDefault();
      if (!e.repeat) fragOffer.done(true);
      return;
    }

    switch (e.key) {
      case "F2": e.preventDefault(); runEffect("download"); return;
      case "F3": e.preventDefault(); toggleMission(); return;
      case "F4": e.preventDefault(); clearScreen(); toast("Écran effacé", "terminal"); return;
      case "F6": e.preventDefault(); setAuto(!auto); return;
      case "F7": e.preventDefault(); settings.hud = !settings.hud; applySettings(); return;
      case "F8": e.preventDefault(); nextTheme(); return;
    }

    if (e.key === "Alt" || e.key === "AltGraph") {
      e.preventDefault();
      if (!e.repeat && countPress("Alt")) access(true);
      return;
    }
    if (e.key === "CapsLock") {
      if (!e.repeat && countPress("CapsLock")) access(false);
      return;
    }

    // Maj + chiffre = effet dramatique (fonctionne en AZERTY comme en QWERTY)
    const digit = /^Digit(\d)$/.exec(e.code || "");
    if (digit && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const fx = numbered.find((f) => f.digit === +digit[1]);
      if (fx && !e.repeat) runEffect(fx.id);
      return;
    }

    if (e.ctrlKey || e.metaKey) return; // laisse passer Ctrl+R, Ctrl+Maj+I…
    if (IGNORED.has(e.key) || /^F\d+$/.test(e.key)) return;
    if (e.key === "Unidentified" || e.keyCode === 229) return; // clavier virtuel : géré plus bas

    e.preventDefault();
    if (!e.repeat) secretWord(e.key);
    if (e.key === "Backspace" || e.key === "Delete") eraseChars(settings.speed);
    else typeChars(settings.speed);
  });

  // Le mot de passe du repaire secret : pour une fois, ce qu'on tape vraiment compte.
  // L'indice est caché dans le journal de bord des plans du Club des Méchants.
  // D'autres mots secrets font des surprises (et comptent pour le succès « Chasseur de secrets »)
  const MOTS_SECRETS = ["sardine", "echo", "coin", "kane", "chaos", "matrix"];
  let secretBuf = "";
  function secretWord(key) {
    if (key.length !== 1) return;
    secretBuf = (secretBuf + key.toLowerCase()).slice(-8);
    const mot = MOTS_SECRETS.find((m) => secretBuf.endsWith(m));
    if (!mot) return;
    secretBuf = "";
    if (remember("mots", mot) >= 3) achieve("chasseur");
    setTimeout(() => motSecret(mot), mot === "sardine" ? 400 : 250);
  }
  function openLair() {
    if (story.playing() || survie.playing() || booting || modalOpen()) return;
    stopMission(true);
    story.playLair();
  }

  document.addEventListener("keyup", (e) => {
    if (e.key === "Alt") e.preventDefault();
  });

  // ===== Mobile =====
  const SENTINEL = " ";
  mobileInput.value = SENTINEL;
  let maxTouches = 0;

  // Code Konami au doigt : glisser ↑ ↑ ↓ ↓ ← → ← →, puis deux petits touchers (B et A)
  let geste = null;
  function finGeste(e) {
    const t = e.changedTouches[0];
    if (!geste || !t) return;
    const dx = t.clientX - geste.x, dy = t.clientY - geste.y;
    const court = Date.now() - geste.t < 400;
    geste = null;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && court) konami(kIdx === 8 ? "b" : kIdx === 9 ? "a" : "toucher");
    else if (Math.max(Math.abs(dx), Math.abs(dy)) > 40) {
      konami(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp");
    }
  }

  document.addEventListener("touchstart", (e) => {
    if (booting || modalOpen() || story.playing() || survie.playing()) return;
    maxTouches = Math.max(maxTouches, e.touches.length);
    if (e.touches.length === 1 && e.target.closest("#terminal")) {
      geste = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
    if (e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    if (e.target.closest("#terminal")) {
      // Par défaut, toucher l'écran suffit : le vrai clavier ne s'ouvre qu'avec le bouton ⌨
      if (settings.clavierMobile) mobileInput.focus({ preventScroll: true });
      typeChars(settings.speed);
    }
  }, { passive: false });

  // Bouton ⌨ (téléphone, tablette) : ouvre ou ferme le vrai clavier
  $("btn-clavier").addEventListener("click", () => {
    settings.clavierMobile = !settings.clavierMobile;
    applySettings();
    if (settings.clavierMobile) mobileInput.focus({ preventScroll: true });
    else mobileInput.blur();
    toast(settings.clavierMobile ? "Clavier ouvert : chaque touche écrit du code" : "Clavier fermé : touche l'écran pour écrire", "keyboard");
  });

  document.addEventListener("touchend", (e) => {
    if (e.touches.length) return;
    if (story.playing() || survie.playing()) { maxTouches = 0; geste = null; return; }
    if (maxTouches === 1) finGeste(e);
    else geste = null;
    if (maxTouches === 3) access(true);
    else if (maxTouches >= 4) access(false);
    maxTouches = 0;
  });

  mobileInput.addEventListener("input", () => {
    const v = mobileInput.value;
    for (const ch of v.slice(SENTINEL.length)) secretWord(ch);
    if (v.length < SENTINEL.length) eraseChars(settings.speed);
    else if (v.length > SENTINEL.length) typeChars(settings.speed * (v.length - SENTINEL.length));
    mobileInput.value = SENTINEL;
  });

  // ===== Boutons =====
  document.addEventListener("pointerup", (e) => {
    const b = e.target.closest("#topbar button, #dock button");
    if (b) setTimeout(() => b.blur(), 0);
  });

  $("btn-help").addEventListener("click", () => openModal(helpEl));
  $("btn-settings").addEventListener("click", () => openModal(settingsEl));
  $("btn-ach").addEventListener("click", () => openModal(achEl));
  $("btn-immersive").addEventListener("click", () => setImmersive(true));
  $("btn-exit-immersive").addEventListener("click", () => setImmersive(false));
  $("btn-install").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    $("btn-install").hidden = true;
  });
  $("btn-custom-save").addEventListener("click", () => {
    settings.customCode = $("opt-custom").value.slice(0, 30000);
    const bloques = refreshCustomSnippet();
    $("opt-custom").value = settings.customCode;
    delete langCache.custom;
    if (settings.lang === "custom") pos = 0;
    else setLang("custom");
    applySettings();
    toast(settings.customCode.trim() ? "Ton code est prêt : tape !" : "Code personnalisé effacé", "code");
    if (bloques) {
      toast(`${bloques} gros mot${bloques > 1 ? "s" : ""} bloqué${bloques > 1 ? "s" : ""} : remplacé${bloques > 1 ? "s" : ""} par #@!% 🤐`, "lock");
      log(`Mon code : ${bloques} gros mot${bloques > 1 ? "s" : ""} bloqué${bloques > 1 ? "s" : ""}`);
    }
    closeModal(settingsEl);
  });
  // ===== Sauvegarde : exporter dans un fichier, importer depuis un fichier =====
  const donneesSauvegarde = () => ({ jeu: "Ghost Terminal", format: 1, date: new Date().toISOString(), settings, progress });
  $("btn-export").addEventListener("click", () => {
    noterTempsDeJeu();
    saveProgress();
    const data = donneesSauvegarde();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ghost-terminal-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast("Sauvegarde exportée : garde bien ce fichier !", "download");
    log("Sauvegarde exportée");
  });

  // Une sauvegarde importée vient d'un fichier : on ne garde que des valeurs du bon type
  const nombre = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const filtrerObjet = (o, ok) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => ok(v)));
  function lireHistoire(h) {
    return {
      // anciennes sauvegardes à 3 chapitres : un simple compteur « done » (converti par story.js)
      ...(Array.isArray(h.seen) ? { seen: h.seen.filter((x) => typeof x === "string") } : { done: nombre(h.done) }),
      since: nombre(h.since),
      whisper: nombre(h.whisper),
      ending: ["free", "erase", "true"].includes(h.ending) ? h.ending : null,
      flags: filtrerObjet(h.flags, (v) => typeof v === "string" || typeof v === "boolean"),
      obj: filtrerObjet(h.obj, (v) => typeof v === "number" && Number.isFinite(v)),
      v: nombre(h.v),
      frags: Math.min(12, Math.floor(nombre(h.frags))),
      fragAt: typeof h.fragAt === "number" && Number.isFinite(h.fragAt) ? h.fragAt : null,
      finale: h.finale === true,
    };
  }
  function lireSauvegarde(data) {
    if (!data || data.jeu !== "Ghost Terminal" || !data.progress || typeof data.progress !== "object") throw new Error("format");
    const src = data.settings && typeof data.settings === "object" ? data.settings : {};
    const s = {};
    for (const [k, def] of Object.entries(DEFAULTS)) {
      const ok = typeof src[k] === typeof def && (typeof def !== "number" || Number.isFinite(src[k]));
      s[k] = ok ? src[k] : def;
    }
    s.speed = clamp(Math.round(s.speed), 1, 12);
    s.size = clamp(Math.round(s.size), 11, 28);
    s.volume = clamp(Math.round(s.volume), 0, 100);
    s.customCode = s.customCode.slice(0, 30000); // les gros mots seront filtrés au chargement

    const p = data.progress;
    const out = {
      ach: filtrerObjet(p.ach, (v) => typeof v === "number"),
      lifetime: nombre(p.lifetime),
      effects: [], langs: [], themes: [],
    };
    for (const id of Object.keys(out.ach)) if (!ACHIEVEMENTS.some((a) => a.id === id)) delete out.ach[id];
    for (const k of ["effects", "langs", "themes", "lair", "mots"]) {
      if (Array.isArray(p[k])) out[k] = p[k].filter((x) => typeof x === "string").slice(0, 50);
    }
    for (const k of ["survieBest", "survieScore", "playTime", "bestCpm", "effectsRun", "missionsDone", "sessions", "longestSession", "defisFaits"]) if (k in p) out[k] = nombre(p[k]);
    for (const k of ["langChars", "effectCount"]) if (p[k]) out[k] = filtrerObjet(p[k], (v) => typeof v === "number" && Number.isFinite(v) && v >= 0);
    if (p.serie && typeof p.serie.last === "string") out.serie = { last: p.serie.last.slice(0, 10), n: nombre(p.serie.n), best: nombre(p.serie.best) };
    if (p.defi && typeof p.defi.date === "string" && typeof p.defi.id === "string") {
      out.defi = { date: p.defi.date.slice(0, 10), id: p.defi.id.slice(0, 20), have: nombre(p.defi.have), done: p.defi.done === true };
    }
    for (const k of ["gold", "ice", "secretSeen"]) if (p[k] === true) out[k] = true;
    if (p.story && typeof p.story === "object") out.story = lireHistoire(p.story);
    return { settings: s, progress: out, date: data.date };
  }

  let importEnAttente = null;
  // Montre ce que contient la sauvegarde avant de remplacer quoi que ce soit (lève une erreur si ce n'en est pas une)
  function preparerImport(data) {
    importEnAttente = lireSauvegarde(data);
    const p = importEnAttente.progress;
    const nAch = MAIN_ACH.filter((a) => p.ach[a.id]).length;
    const nCh = p.story?.seen?.length || 0;
    const jour = Date.parse(importEnAttente.date) ? ` du ${new Date(importEnAttente.date).toLocaleDateString("fr-FR")}` : "";
    $("import-info").textContent = `Sauvegarde${jour} : ${nAch} succès sur ${MAIN_ACH.length}, ${fr(p.lifetime)} caractères tapés, ${nCh} chapitre${nCh > 1 ? "s" : ""} vu${nCh > 1 ? "s" : ""}. Elle va remplacer ta progression actuelle.`;
    $("import-box").hidden = false;
    $("import-box").scrollIntoView?.({ block: "nearest" });
  }
  function importRate(msg) {
    importEnAttente = null;
    $("import-box").hidden = true;
    toast(msg, "x");
  }
  async function importerFichier(file) {
    try {
      if (file.size > 2000000) throw new Error("trop gros");
      preparerImport(JSON.parse(await file.text()));
    } catch {
      importRate("Ce fichier n'est pas une sauvegarde de Ghost Terminal");
    }
  }
  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) importerFichier(file);
  });
  // Glisser-déposer un fichier de sauvegarde sur la fenêtre des réglages
  const avecFichier = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  settingsEl.addEventListener("dragover", (e) => {
    if (!avecFichier(e)) return;
    e.preventDefault();
    settingsEl.classList.add("depot");
  });
  settingsEl.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || !settingsEl.contains(e.relatedTarget)) settingsEl.classList.remove("depot");
  });
  settingsEl.addEventListener("drop", (e) => {
    e.preventDefault();
    settingsEl.classList.remove("depot");
    const file = e.dataTransfer?.files?.[0];
    if (file) importerFichier(file);
  });
  // Ailleurs, un fichier lâché par erreur ne doit pas faire quitter le jeu
  document.addEventListener("dragover", (e) => { if (avecFichier(e)) e.preventDefault(); });
  document.addEventListener("drop", (e) => { if (avecFichier(e)) e.preventDefault(); });

  // Sauvegarde en code à copier-coller (quand les fichiers sont bloqués, comme sur itch.io)
  const enCode = (txt) => {
    let s = "";
    for (const b of new TextEncoder().encode(txt)) s += String.fromCharCode(b);
    return "GT2:" + btoa(s);
  };
  const deCode = (code) => {
    const s = atob(code.trim().replace(/^GT\d*:/, "").replace(/\s+/g, ""));
    return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  };
  $("btn-code-copy").addEventListener("click", async () => {
    noterTempsDeJeu();
    saveProgress();
    const zone = $("save-code");
    zone.value = enCode(JSON.stringify(donneesSauvegarde()));
    zone.focus();
    zone.select();
    try {
      await navigator.clipboard.writeText(zone.value);
      toast("Code de sauvegarde copié : garde-le bien au chaud !", "copy", 4000);
    } catch {
      toast("Code prêt : copie-le avec Ctrl+C (ou appui long)", "copy", 4000);
    }
  });
  $("btn-code-use").addEventListener("click", () => {
    try {
      preparerImport(JSON.parse(deCode($("save-code").value)));
    } catch {
      importRate("Ce code n'est pas une sauvegarde de Ghost Terminal");
    }
  });
  $("btn-import-cancel").addEventListener("click", () => {
    importEnAttente = null;
    $("import-box").hidden = true;
  });
  $("btn-import-ok").addEventListener("click", () => {
    if (!importEnAttente) return;
    wiping = true; // plus rien ne doit être enregistré par-dessus avant le rechargement
    try {
      localStorage.setItem(STORE, JSON.stringify(importEnAttente.settings));
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(importEnAttente.progress));
      localStorage.setItem("ghostterminal-seen", "1");
    } catch {
      wiping = false;
      toast("Impossible d'importer : le stockage du navigateur est bloqué", "x");
      return;
    }
    location.reload();
  });

  // Tout réinitialiser (après confirmation) : depuis les réglages ou depuis le panneau Succès
  function askWipe() {
    $("wipe-ach").textContent = Object.keys(progress.ach).length;
    $("wipe-chars").textContent = fr(progress.lifetime);
    openModal(wipeEl);
  }
  $("btn-wipe").addEventListener("click", askWipe);
  $("btn-ach-wipe").addEventListener("click", askWipe);
  $("btn-wipe-confirm").addEventListener("click", () => {
    wiping = true;
    try {
      [STORE, PROGRESS_KEY, "ghostterminal-seen", "ghostterminal-version"].forEach((k) => localStorage.removeItem(k));
    } catch { /* navigation privée */ }
    location.reload();
  });
  $("btn-mission").addEventListener("click", toggleMission);
  $("btn-auto").addEventListener("click", () => setAuto(!auto));
  $("btn-hud").addEventListener("click", () => { settings.hud = !settings.hud; applySettings(); });
  $("btn-dock").addEventListener("click", () => { settings.dock = !settings.dock; applySettings(); });
  $("btn-fullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  // Pas de plein écran sur iPhone : on ne montre pas un bouton qui ne fait rien
  $("btn-fullscreen").hidden = !document.fullscreenEnabled;
  $("btn-clear").addEventListener("click", () => { clearScreen(); closeModal(settingsEl); });
  $("btn-reset").addEventListener("click", () => {
    Object.assign(settings, DEFAULTS);
    refreshCustomSnippet();
    delete langCache.custom;
    $("opt-custom").value = "";
    applySettings();
    toast("Réglages réinitialisés", "sliders");
  });

  $("opt-lang").addEventListener("change", (e) => { setLang(e.target.value); applySettings(); });
  $("opt-speed").addEventListener("input", (e) => { settings.speed = +e.target.value; applySettings(); });
  $("opt-size").addEventListener("input", (e) => { settings.size = +e.target.value; applySettings(); });
  $("opt-volume").addEventListener("input", (e) => { settings.volume = +e.target.value; applySettings(); });
  for (const k of ["highlight", "crt", "hud", "dock", "boot", "popups", "story", "calme", "vibrations", "veille", "saison", "ambiance"]) {
    $("opt-" + k).addEventListener("change", (e) => {
      settings[k] = e.target.checked;
      applySettings();
      if (k === "story") renderQuest(true);
    });
  }
  for (const k of Object.keys(CHOIX)) {
    $("opt-" + k)?.addEventListener("change", (e) => {
      settings[k] = e.target.value;
      applySettings();
      if (k === "sonTouches") Sound.click(); // pour entendre le nouveau son
    });
  }
  $("opt-voice").addEventListener("change", (e) => {
    settings.voice = e.target.checked;
    applySettings();
    Voice.say("Synthèse vocale activée. Bienvenue dans Ghost Terminal.");
  });
  $("opt-sound").addEventListener("change", (e) => {
    settings.sound = e.target.checked;
    applySettings();
    if (settings.sound) Sound.granted();
  });

  // ===== Mode histoire « PROTOCOLE ÉCHO » =====
  const story = window.HT_STORY.create({
    sound: Sound,
    speak: (text, opts) => Voice.say(text, opts),
    hush: () => Voice.hush(),
    achieve, toast, log,
    colors: () => themeColors,
    settings, progress, saveProgress,
    isBusy: () => !!mission || modalOpen() || booting || fxHandles.size > 0 || survie.playing(),
    prepare: () => {
      [...openWins].forEach((w) => w.close());
      [...fxHandles].forEach((h) => h.close());
      fragOffer?.done(false);
    },
    whisper: (text) => (pendingWhisper = text),
    stats: () => ({ chars: fr(progress.lifetime), done: mainDone(), total: MAIN_ACH.length }),
    offerFragment, onFragment,
    onQuest: () => renderQuest(true),
    unlockTheme,
    vibrer,
    tactile: TACTILE,
    onFinale: () => {
      unlockGold();
      // La première fois : le jeu secret démarre juste après l'épilogue
      if (!progress.secretSeen) {
        progress.secretSeen = true;
        saveProgress();
        toast("🔓 Jeu secret débloqué…", "trophy");
        setTimeout(startSecretGame, 2500);
      }
    },
  });

  // ===== Jeu secret « SURVIE » =====
  const survie = window.HT_SURVIE.create({
    sound: Sound,
    speak: (text) => Voice.say(text),
    colors: () => themeColors,
    calme: () => settings.calme,
    vibrer,
    tactile: TACTILE,
    record: () => progress.survieScore || 0,
    difficulte: () => settings.survieDiff,
    setDifficulte: (d) => {
      settings.survieDiff = d;
      saveSettings();
    },
  });

  async function startSecretGame() {
    if (story.playing() || survie.playing()) return;
    MODALS.forEach((m) => (m.hidden = true));
    [...openWins].forEach((w) => w.close());
    [...fxHandles].forEach((h) => h.close());
    stopMission(false);
    const wasAuto = auto;
    if (auto) setAuto(false, true);
    log("Jeu secret : survie");
    await story.playSecret();
    const res = await survie.start();
    progress.survieScore = Math.max(progress.survieScore || 0, Math.round(res.best || 0)); // meilleur score
    saveProgress();
    if (res.won) {
      achieve("survivor");
      toast("Tu as survécu à l'explosion !", "trophy");
    }
    if (wasAuto) setAuto(true, true);
    terminal.focus({ preventScroll: true });
  }

  // Épilogue secret : se lance tout seul quand tous les succès sont débloqués
  function scheduleFinale(delay) {
    setTimeout(function tryFinale() {
      if (story.state().finale || !settings.story) return;
      if (story.playing() || survie.playing() || modalOpen() || booting || mission || fxHandles.size) return setTimeout(tryFinale, 1500);
      story.playFinale();
    }, delay);
  }

  // Thèmes secrets : « Or » (100 %) et « Banquise » (le repaire du Pingouin)
  function unlockTheme(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t || progress[t.secret]) return;
    progress[t.secret] = true;
    saveProgress();
    buildSwatches();
    settings.theme = id;
    applySettings();
    const name = t.name.replace(" (secret)", "");
    toast(`Thème secret « ${name} » débloqué !`, "trophy");
    log(`Thème « ${name} » débloqué`);
  }
  const unlockGold = () => unlockTheme("gold");

  // ===== Fragments de mémoire d'ÉCHO : ils passent pendant la frappe, Tab (ou un clic) pour les attraper =====
  const fragEl = $("frag");
  let fragOffer = null;
  let fragHide = 0;

  function offerFragment(n, total) {
    if (booting || modalOpen() || survie.playing() || story.playing() || body.classList.contains("immersive")) return false;
    return new Promise((resolve) => {
      clearTimeout(fragHide);
      fragEl.className = "frag offer";
      const consigne = TACTILE ? "Vite ! Touche-le pour l'attraper" : "Vite ! <kbd>Tab</kbd> ou clic pour l'attraper";
      fragEl.innerHTML = `${window.icon("database")}<div><small>FRAGMENT DE MÉMOIRE ${n}/${total}</small><b>${consigne}</b></div><i class="frag-timer"></i>`;
      fragEl.hidden = false;
      vibrer(40);
      [880, 1175, 1568].forEach((f, i) => Sound.tone(f, 0.12, { type: "triangle", vol: 0.04, when: i * 0.08 }));
      const timer = setTimeout(() => done(false), 7000);
      function done(caught) {
        if (fragOffer !== offer) return;
        fragOffer = null;
        clearTimeout(timer);
        if (!caught) {
          fragEl.classList.add("lost");
          fragEl.querySelector("b").textContent = "Fragment perdu… il reviendra.";
          fragHide = setTimeout(() => (fragEl.hidden = true), 1600);
        }
        resolve(caught);
      }
      const offer = { done };
      fragOffer = offer;
    });
  }

  function onFragment(count, text, total) {
    clearTimeout(fragHide);
    fragEl.className = "frag memory";
    fragEl.innerHTML = `${window.icon("database")}<div><small>MÉMOIRE ${count}/${total} RESTAURÉE</small><span></span></div>`;
    fragEl.querySelector("span").textContent = `« ${text} »`;
    fragEl.hidden = false;
    fragHide = setTimeout(() => (fragEl.hidden = true), 8000);
    [523, 784, 1047].forEach((f, i) => Sound.tone(f, 0.18, { type: "triangle", vol: 0.05, when: i * 0.1 }));
    vibrer([20, 40, 20]);
    Voice.say(text, { pitch: 1.35, rate: 1 });
    log(`Fragment de mémoire ${count}/${total}`);
    if (count >= total) {
      achieve("fragments");
      setTimeout(() => toast("Tous les souvenirs d'ÉCHO sont retrouvés ! La vraie fin t'attend au chapitre 11 ✨", "star", 8000), 2600);
    }
  }

  fragEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (fragOffer) fragOffer.done(true);
    else {
      clearTimeout(fragHide);
      fragEl.hidden = true;
    }
  });

  // ===== Objectifs du chapitre en cours (panneau en haut à gauche) =====
  const questEl = $("quest");
  let questDrawn = 0;
  let questVu = null; // objectifs déjà remplis au dernier affichage

  // Sur un écran tactile, on nomme les boutons au lieu des touches du clavier
  function goalLabel(key) {
    if (key === "chars") return TACTILE ? "Écrire du code (touche l'écran)" : "Taper du code";
    if (key === "fragments") return `Attraper des fragments de mémoire (${TACTILE ? "touche-les" : "Tab"})`;
    if (key === "mission") return `Terminer une mission (${TACTILE ? "bouton cible en haut" : "F3"})`;
    if (key === "disarm") return `Désamorcer une ogive (${TACTILE ? "bouton Ogive en bas" : "Maj + 8"})`;
    const fx = effectById[key.replace("effect:", "")];
    if (!fx) return key;
    return `Lancer « ${fx.name} » (${TACTILE ? `bouton ${fx.short} en bas` : `Maj + ${fx.digit}`})`;
  }

  function renderQuest(force = false) {
    const t = now();
    if (!force && t - questDrawn < 250) return;
    questDrawn = t;
    const Q = settings.story && !booting ? story.quest() : null;
    // Caché avant le chapitre 1 : le réveil d'ÉCHO doit rester une surprise
    const show = !!Q && story.state().seen.length > 0;
    questEl.hidden = !show;
    body.classList.toggle("quest-on", show);
    if (!show) return;
    questEl.classList.toggle("min", settings.questMin);
    let goals;
    if (Q.after) {
      $("quest-act").textContent = "ÉPILOGUE";
      $("quest-title").textContent = "Mémoires d'ÉCHO";
      goals = [{ key: "fragments", need: Q.total, have: Q.frags }];
    } else {
      $("quest-act").textContent = `ACTE ${Q.act.roman} · ${Q.act.name}`;
      $("quest-title").textContent = `Chapitre ${Q.n} : objectifs`;
      goals = Q.goals;
      // Annonce les objectifs qui viennent d'être remplis
      const faits = new Set(goals.filter((g) => g.have >= g.need).map((g) => g.key));
      if (questVu && questVu.n === Q.n && !story.playing()) {
        for (const g of goals) {
          if (!faits.has(g.key) || questVu.faits.has(g.key)) continue;
          toast(`Objectif rempli : ${goalLabel(g.key)}`, "target");
          [988, 1319].forEach((f, i) => Sound.tone(f, 0.1, { type: "triangle", vol: 0.04, when: i * 0.08 }));
        }
      }
      questVu = { n: Q.n, faits };
    }
    const list = $("quest-list");
    // Les objectifs « lancer un effet », « mission » et « ogive » se lancent d'un clic
    const clic = (g) => g.have < g.need && (g.key === "mission" || g.key === "disarm" || (g.key.startsWith("effect:") && !!effectById[g.key.slice(7)]));
    list.innerHTML = goals.map((g) => `
      <li class="${g.have >= g.need ? "done" : ""} ${g.bonus ? "bonus" : ""} ${clic(g) ? "clic" : ""}" data-goal="${esc(g.key)}"${clic(g) ? ' title="Clique pour le lancer"' : ""}>
        <i></i><span>${esc(goalLabel(g.key))}${g.bonus ? " · bonus : débloque une autre fin" : ""}</span><b>${g.need > 1 ? `${fr(g.have)} / ${fr(g.need)}` : g.have >= g.need ? "✓" : ""}</b>
        ${g.need > 1 ? "<em><u></u></em>" : ""}
      </li>`).join("") + (Q.after && Q.frags >= Q.total
      ? `<li class="hint"><span>Tous les souvenirs sont là : rejoue le chapitre 11 (panneau Succès) pour découvrir la vraie fin.</span></li>`
      : Q.ready ? `<li class="hint"><span>Tout est prêt… continue de taper !</span></li>` : "");
    list.querySelectorAll("em u").forEach((u, i) => {
      const g = goals.filter((x) => x.need > 1)[i];
      u.style.width = (g.have / g.need) * 100 + "%";
    });
    // Le terminal commence sous le panneau, pour qu'il ne cache pas le code
    body.style.setProperty("--quest-h", questEl.offsetHeight + "px");
  }

  $("quest-list").addEventListener("click", (e) => {
    const li = e.target.closest("li.clic");
    if (!li || story.playing() || survie.playing()) return;
    const key = li.dataset.goal;
    if (key === "mission") { if (!mission) toggleMission(); }
    else if (key === "disarm") runEffect("countdown");
    else if (key.startsWith("effect:")) runEffect(key.slice(7));
  });

  $("quest-toggle").addEventListener("click", () => {
    settings.questMin = !settings.questMin;
    saveSettings();
    renderQuest(true);
  });

  function renderStoryPanel() {
    const s = story.state();
    const chapters = story.list();
    const seen = chapters.filter((c) => c.seen).length;
    const ENDINGS = { free: "Libération", erase: "Effacement", true: "la vraie fin" };
    const Q = story.quest();
    const status = seen >= chapters.length
      ? `Histoire terminée · fin : ${ENDINGS[s.ending] || "?"}. Tu peux rejouer chaque chapitre.`
      : seen === 0
        ? "Continue de taper… quelque chose se réveille dans le terminal."
        : `${seen} chapitre${seen > 1 ? "s" : ""} sur ${chapters.length} · les objectifs du chapitre ${Q.n} sont affichés en haut à gauche.`;
    const finaleOpen = s.finale || allDone();
    const jeuSurvieOuvert = !!s.finale;
    const best = progress.survieScore ? ` · record : ${fr(progress.survieScore)} pts` : "";
    const memories = story.memories();
    const got = memories.filter(Boolean).length;
    const recap = story.recap();
    const dernier = chapters.filter((c) => c.seen).pop();
    const resume = (n) => recap.find((r) => r.n === n)?.text || "";
    $("story-panel").innerHTML = `
      <h3>${window.icon("eye")} PROTOCOLE ÉCHO <small>mode histoire · 3 actes · 3 fins</small></h3>
      <p class="muted small">${esc(status)}</p>
      ${story.acts.map((a, ai) => `
        <div class="story-act">ACTE ${a.roman} · ${esc(a.name)}</div>
        <div class="story-btns">
          ${chapters.filter((c) => c.act === ai).map((c) => `<button type="button" class="btn story-play" data-ch="${c.n}" ${c.seen ? "" : "disabled"}${c.seen && resume(c.n) ? ` title="${esc(resume(c.n))}"` : ""}>${c.seen ? `▶ ${c.n}. ${esc(c.name)}` : `🔒 Chapitre ${c.n}`}</button>`).join("")}
        </div>`).join("")}
      ${recap.length ? `<details class="memories recap">
        <summary>${window.icon("eye")} Ce qui s'est passé · ${recap.length} chapitre${recap.length > 1 ? "s" : ""}</summary>
        <ol>${recap.map((r) => `<li value="${r.n}"><b>${esc(r.name)}</b> : ${esc(r.text)}</li>`).join("")}</ol>
      </details>` : ""}
      <details class="memories">
        <summary>${window.icon("database")} Mémoires d'ÉCHO · ${got}/${memories.length}</summary>
        <ol>${memories.map((m) => `<li class="${m ? "" : "locked"}">${m ? esc(m) : "Fragment pas encore retrouvé…"}</li>`).join("")}</ol>
      </details>
      <div class="story-act">BONUS</div>
      <div class="story-btns">
        <button type="button" class="btn story-finale" ${finaleOpen ? "" : "disabled"}>${finaleOpen ? "▶ Épilogue secret" : "🔒 Épilogue (100 % des succès)"}</button>
        <button type="button" class="btn story-secret" ${jeuSurvieOuvert ? "" : "disabled"}>${jeuSurvieOuvert ? `▶ Jeu secret : survie${esc(best)}` : "🔒 Jeu secret (après l'épilogue)"}</button>
        ${progress.lair ? `<button type="button" class="btn story-lair">▶ Repaire du Pingouin</button>` : ""}
        ${dernier ? `<button type="button" class="btn story-play" data-ch="${dernier.n}">↺ Revoir le dernier chapitre</button>` : ""}
        <button type="button" class="btn story-reset" ${seen ? "" : "disabled"}>Recommencer l'histoire</button>
      </div>`;
    $("story-panel").querySelector(".story-secret").addEventListener("click", () => {
      closeModal(achEl);
      startSecretGame();
    });
    $("story-panel").querySelector(".story-lair")?.addEventListener("click", () => {
      closeModal(achEl);
      openLair();
    });
    $("story-panel").querySelectorAll(".story-play").forEach((b) => b.addEventListener("click", () => {
      closeModal(achEl);
      story.play(+b.dataset.ch, { replay: true });
    }));
    $("story-panel").querySelector(".story-finale").addEventListener("click", () => {
      closeModal(achEl);
      story.playFinale();
    });
    $("story-panel").querySelector(".story-reset").addEventListener("click", () => {
      story.reset();
      renderStoryPanel();
      toast("Histoire réinitialisée : continue de taper…", "eye");
    });
  }

  // Messages de security.js (copie bloquée, etc.)
  window.addEventListener("ht-blocked", (e) => {
    toast(e.detail, "lock");
    Sound.tone(220, 0.12, { type: "sawtooth", vol: 0.04 });
  });

  // ===== Version 2.0 : nouveautés, partage, mots secrets, veille, saisons, mode démo… =====
  const NEWS = window.HT_NOUVEAUTES;
  function renderNews() {
    $("news-sub").textContent = `Version ${NEWS.version} · ${NEWS.date} · ${NEWS.titre}`;
    let n = 0;
    $("news-list").innerHTML = NEWS.groupes.map(([titre, items]) =>
      `<h4 class="group">${esc(titre)}</h4><ol class="news-ol" start="${n + 1}">${items.map((t) => { n++; return `<li>${esc(t)}</li>`; }).join("")}</ol>`).join("");
  }
  // Petit message à la première ouverture après une mise à jour
  function verifierVersion(ancienJoueur) {
    const vue = storeFlag("ghostterminal-version");
    storeFlag("ghostterminal-version", NEWS.version);
    if (vue === NEWS.version || (!vue && !ancienJoueur)) return;
    setTimeout(() => toast(`Ghost Terminal ${NEWS.version} : 100 améliorations ! Clique ici pour les découvrir`, "star", 10000, () => openModal(newsEl)), 1600);
  }
  $("btn-version").addEventListener("click", () => openModal(newsEl));
  $("btn-news-help").addEventListener("click", () => openModal(newsEl));

  // Partager le jeu (ou ses succès) : menu de partage du téléphone, sinon copie du lien
  const URL_JEU = "https://natxmans.github.io/ghost-terminal/";
  async function partager(texte) {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ghost Terminal", text: texte, url: URL_JEU });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(`${texte} ${URL_JEU}`);
      toast("Copié ! Colle-le où tu veux pour le partager", "copy", 4000);
    } catch {
      toast(`Le lien du jeu : ${URL_JEU}`, "share", 9000);
    }
  }
  const partagerJeu = () => partager("Tape n'importe quoi et deviens un hacker de film 👻");
  $("btn-share").addEventListener("click", partagerJeu);
  $("btn-share-settings").addEventListener("click", partagerJeu);
  $("btn-ach-share").addEventListener("click", () => partager(`J'ai débloqué ${mainDone()} succès sur ${MAIN_ACH.length} et tapé ${fr(progress.lifetime)} caractères dans Ghost Terminal 👻 Qui fait mieux ?`));

  // Barre du bas : LANG change de langage, et des astuces défilent
  $("st-lang-btn").addEventListener("click", () => {
    const l = [...LANGS_FAUX(), ...(settings.customCode.trim() ? ["custom"] : [])];
    setLang(l[(l.indexOf(settings.lang) + 1) % l.length]);
    applySettings();
  });
  const ASTUCES_BAS = [
    "<kbd>Maj</kbd>+<kbd>1</kbd>…<kbd>0</kbd> effets · <kbd>F1</kbd> aide",
    "<kbd>F3</kbd> mission · <kbd>F6</kbd> pilote automatique",
    "<kbd>F4</kbd> efface l'écran · <kbd>F8</kbd> thème suivant",
    "<kbd>F10</kbd> mode immersion · <kbd>Échap</kbd> tout fermer",
    "<kbd>Alt</kbd> ×3 accès autorisé · <kbd>Verr. Maj</kbd> ×3 accès refusé",
    "Clique sur LANG pour changer de langage",
    "Un défi t'attend chaque jour dans le panneau Succès",
    "Certains mots, tapés au clavier, cachent des secrets…",
  ];
  let astuceBas = 0;
  setInterval(() => {
    if (document.hidden) return;
    astuceBas = (astuceBas + 1) % ASTUCES_BAS.length;
    const el = $("st-hint");
    el.classList.remove("change");
    void el.offsetWidth;
    el.classList.add("change");
    el.innerHTML = ASTUCES_BAS[astuceBas];
  }, 20000);

  // « Mon code » : compteur de caractères et import d'un fichier de code
  function majCompteur() {
    const n = $("opt-custom").value.length;
    $("custom-count").textContent = `${fr(n)} / 30 000 caractères`;
    $("custom-count").classList.toggle("trop", n > 30000);
  }
  $("opt-custom").addEventListener("input", majCompteur);
  $("btn-custom-file").addEventListener("click", () => $("file-custom").click());
  $("file-custom").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("trop gros");
      const texte = await file.text();
      if (texte.includes("\u0000")) throw new Error("pas du texte");
      $("opt-custom").value = texte.slice(0, 30000);
      majCompteur();
      toast(`« ${file.name.slice(0, 40)} » chargé : clique sur « Utiliser mon code »`, "code", 4500);
    } catch {
      toast("Impossible de lire ce fichier : choisis un fichier de code ou de texte", "x");
    }
  });

  // Mots secrets (en plus de celui du Pingouin)
  const MOTS_ECHO = ["tu m'as appelée ? Je suis là 👋", "je t'écoute, partenaire.", "chut… le Club des Méchants nous surveille.", "on fait une sacrée équipe, toi et moi."];
  function motSecret(mot) {
    if (story.playing() || survie.playing() || booting || modalOpen()) return;
    if (mot === "sardine") return openLair();
    log(`Mot secret : ${mot.toUpperCase()}`);
    if (mot === "echo") {
      // ÉCHO finit d'abord la ligne en cours (pour ne pas couper un mot en deux), puis répond
      const L = langData(settings.lang);
      const fin = L.code.indexOf("\n", pos);
      const reste = fin >= pos && fin - pos < 160 ? fin - pos + 1 : -1;
      if (reste > 0) typeChars(reste);
      appendRun(`${reste > 0 ? "" : "\n"}${COMMENT[settings.lang] || "//"} ÉCHO : ${pick(MOTS_ECHO)}\n`, 4);
      scrollDown();
      toast("ÉCHO t'a entendu…", "eye");
      Voice.say("Tu m'as appelée ?", { pitch: 1.35, rate: 1 });
    } else if (mot === "coin") {
      toast("Coin coin ! 🐧 Le Général Pingouin te salue.", "zap", 3500);
      [1180, 880, 1180, 880].forEach((f, i) => Sound.tone(f, 0.07, { type: "square", vol: 0.035, when: i * 0.11 }));
    } else if (mot === "kane") {
      access(false, "L'agent Kane t'a repéré. Fais-toi discret 🕶");
    } else if (mot === "chaos") {
      shake(700);
      crash(600);
      Sound.noise(0.5, { vol: 0.08, filter: 1200 });
      toast("Le Professeur Chaos adore ce désordre. MOUAHAHA !", "alert", 3500);
    } else if (mot === "matrix") {
      pluieDeCode();
      toast("Réveille-toi… le code est partout.", "terminal", 4000);
    }
  }
  // Une pluie de caractères verts, façon film de hackers
  function pluieDeCode() {
    const h = fullscreen('<canvas class="pluie-canvas"></canvas>', { cls: "fx-pluie", duration: 5200 });
    const W = window.innerWidth, H = window.innerHeight, T = 16;
    const c = setupCanvas(h.el.querySelector("canvas"), W, H);
    const cols = Math.ceil(W / T);
    const y = Array.from({ length: cols }, () => rand(-H, 0));
    const signes = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ÉCHO<>{}#$";
    let last = 0;
    (function frame(ts) {
      if (!h.alive) return;
      requestAnimationFrame(frame);
      if (ts - last < 50) return;
      last = ts;
      c.fillStyle = "rgba(0, 0, 0, 0.14)";
      c.fillRect(0, 0, W, H);
      c.font = `${T}px "JetBrains Mono", monospace`;
      for (let i = 0; i < cols; i++) {
        c.fillStyle = Math.random() < 0.08 ? "#eafff0" : themeColors.fg;
        c.fillText(signes[randInt(0, signes.length - 1)], i * T, y[i]);
        y[i] = y[i] > H + rand(0, 300) ? 0 : y[i] + T;
      }
    })(0);
  }

  // Il est tard : petit rappel (une fois par session) et succès secret entre minuit et 5 h
  let nuitDite = false;
  function verifierHeure() {
    if (booting) return;
    const h = new Date().getHours();
    if (h < 5) achieve("noctambule");
    if (!nuitDite && (h >= 22 || h < 5)) {
      nuitDite = true;
      toast("Il est tard… même les hackers dorment de temps en temps 🌙", "eye", 7000);
    }
  }

  // Économiseur d'écran d'ÉCHO : après 90 s sans rien faire
  const veilleEl = $("veille");
  const TEXTES_VEILLE = ["ÉCHO veille sur ton terminal…", "Le Club des Méchants dort. Pour l'instant.", "L'agent Kane ne t'a pas trouvé. Bien joué.", "Je compte les octets en t'attendant.", "Les serveurs ronronnent…"];
  let derniereActivite = now(), texteVeille = 0;
  function noterActivite() {
    derniereActivite = now();
  }
  for (const t of ["pointerdown", "pointermove", "touchstart", "wheel"]) document.addEventListener(t, noterActivite, { passive: true, capture: true });
  function surveillerVeille() {
    if (!veilleEl.hidden) {
      $("veille-heure").textContent = clockStr().slice(0, 5);
      if (Math.floor(now() / 1000) % 8 === 0) $("veille-txt").textContent = TEXTES_VEILLE[++texteVeille % TEXTES_VEILLE.length];
      return;
    }
    const occupe = auto || mission || demo || booting || modalOpen() || story.playing() || survie.playing() || fxHandles.size > 0 || document.hidden || body.classList.contains("immersive");
    if (occupe) return noterActivite();
    if (settings.veille && now() - derniereActivite > 90000) montrerVeille();
  }
  function montrerVeille() {
    veilleEl.hidden = false;
    $("veille-heure").textContent = clockStr().slice(0, 5);
    $("veille-txt").textContent = TEXTES_VEILLE[texteVeille % TEXTES_VEILLE.length];
    $("veille-aide").textContent = TACTILE ? "Touche l'écran pour revenir" : "Appuie sur une touche pour revenir";
    log("Économiseur d'écran");
  }
  function cacherVeille() {
    if (veilleEl.hidden) return;
    veilleEl.hidden = true;
    noterActivite();
    terminal.focus({ preventScroll: true });
  }
  veilleEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cacherVeille();
  });

  // Décorations de saison : neige en décembre, citrouilles et chauves-souris pour Halloween
  function saisonDuJour() {
    const p = PARAMS.get("saison");
    if (p === "neige" || p === "halloween") return p;
    const d = new Date(), m = d.getMonth() + 1, j = d.getDate();
    if (m === 12 || (m === 1 && j <= 6)) return "neige";
    if ((m === 10 && j >= 24) || (m === 11 && j <= 1)) return "halloween";
    return null;
  }
  function majSaison() {
    const s = settings.saison ? saisonDuJour() : null;
    const el = $("saison");
    if ((el.dataset.s || "") === (s || "")) return;
    el.dataset.s = s || "";
    el.hidden = !s;
    el.textContent = "";
    if (!s) return;
    const neige = s === "neige";
    const signes = neige ? ["❄", "❅", "❆", "•"] : ["🎃", "🦇", "👻", "🕸"];
    for (let i = 0; i < (neige ? 36 : 14); i++) {
      const f = document.createElement("i");
      f.textContent = pick(signes);
      f.style.left = rand(0, 100) + "%";
      f.style.animationDuration = rand(neige ? 9 : 16, neige ? 20 : 30) + "s";
      f.style.animationDelay = -rand(0, 25) + "s";
      f.style.fontSize = rand(neige ? 8 : 14, neige ? 18 : 24) + "px";
      f.style.opacity = rand(0.25, 0.65);
      el.appendChild(f);
    }
  }

  // Mode démo : le pilote auto tape, et des effets ou des missions se lancent tout seuls
  let demo = null;
  function setDemo(on) {
    if (on === !!demo) return;
    if (on) {
      demo = { wasAuto: auto, timer: 0 };
      if (!auto) setAuto(true, true);
      toast(TACTILE ? "Mode démo : tout se lance tout seul" : "Mode démo : tout se lance tout seul · Échap pour arrêter", "play", 5000);
      log("Mode démo : ON");
      const tick = () => {
        if (!demo) return;
        if (!mission && !story.playing() && !survie.playing() && !modalOpen() && !booting) {
          if (Math.random() < 0.25) toggleMission();
          else runEffect(pick(numbered.filter((f) => f.id !== "countdown")).id, { auto: true });
        }
        demo.timer = setTimeout(tick, mission ? 20000 : rand(8000, 14000));
      };
      demo.timer = setTimeout(tick, 2500);
    } else {
      clearTimeout(demo.timer);
      const garderAuto = demo.wasAuto;
      demo = null;
      stopMission(true);
      if (!garderAuto) setAuto(false, true);
      toast("Mode démo arrêté", "pause");
      log("Mode démo : OFF");
    }
    $("btn-demo").classList.toggle("active", !!demo);
  }
  $("btn-demo").addEventListener("click", () => {
    closeModal(settingsEl);
    setDemo(!demo);
  });

  // Onglet caché : la voix se tait, la progression est enregistrée (les téléphones ferment parfois l'onglet sans prévenir)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      Voice.hush();
      noterTempsDeJeu();
      saveProgress();
    }
    Ambiance.maj();
  });

  // Les fenêtres restent dans l'écran quand il change de taille (ou quand on tourne le téléphone)
  window.addEventListener("resize", () => {
    for (const w of openWins) {
      const el = w.el;
      el.style.left = clamp(el.offsetLeft, 0, Math.max(0, window.innerWidth - Math.min(el.offsetWidth, window.innerWidth))) + "px";
      el.style.top = clamp(el.offsetTop, 44, Math.max(44, window.innerHeight - 60)) + "px";
    }
  });

  // ===== Lancement =====
  if (PARAMS.get("theme") && availableThemes().some((t) => t.id === PARAMS.get("theme"))) settings.theme = PARAMS.get("theme");
  if (LANGS_FAUX().includes(PARAMS.get("lang"))) settings.lang = PARAMS.get("lang");
  progress.sessions = (progress.sessions || 0) + 1;
  progressDirty = true;
  buildDock();
  buildHelp();
  $("opt-custom").value = settings.customCode;
  majCompteur();
  updateAchCount();
  applySettings();
  setTimeout(() => body.classList.add("theme-anim"), 1500); // les thèmes changent en douceur (pas au chargement)
  updateStats();
  updateHud();
  if (settings.boot) boot();
  else afterBoot();
  if (allDone() && !story.state().finale) scheduleFinale(6000);
})();
