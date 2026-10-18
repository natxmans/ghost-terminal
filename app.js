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
  };
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
  if (!["lent", "normal", "rapide"].includes(settings.dialogue)) settings.dialogue = "normal";

  let themeColors = {};
  function readColors() {
    const cs = getComputedStyle(body);
    const v = (n) => cs.getPropertyValue(n).trim();
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
    click() {
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
    { id: "cool", icon: "shield", name: "Sang-froid", desc: "Désamorcer l'ogive du Consortium" },
    { id: "boom", icon: "timer", name: "Boum", desc: "Laisser l'ogive du Consortium aller jusqu'à zéro" },
    { id: "speed", icon: "zap", name: "Vitesse lumière", desc: "Dépasser 2 000 caractères par minute (sans pilote auto)" },
    { id: "polyglot", icon: "code", name: "Polyglotte", desc: "Essayer 4 langages" },
    { id: "chameleon", icon: "sliders", name: "Caméléon", desc: "Essayer 4 thèmes" },
    { id: "pilot", icon: "play", name: "Pilote", desc: "Activer le pilote automatique" },
    { id: "immersion", icon: "eye", name: "Immersion totale", desc: "Passer en mode immersion" },
    { id: "custom", icon: "code", name: "Mon propre code", desc: "Faire taper ton propre code" },
    { id: "konami", icon: "trophy", name: "Rétro gamer", desc: "Trouver le code secret caché" },
    { id: "ch1", icon: "eye", name: "Le message", desc: "Histoire : terminer le chapitre 1" },
    { id: "consortium", icon: "target", name: "Le Consortium", desc: "Histoire : terminer le chapitre 2" },
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
  ];
  // Les succès secrets ne comptent pas dans les 100 % (ils se débloquent après)
  const MAIN_ACH = ACHIEVEMENTS.filter((a) => !a.secret);
  const mainDone = () => MAIN_ACH.filter((a) => progress.ach[a.id]).length;
  const allDone = () => mainDone() === MAIN_ACH.length;
  const PROGRESS_KEY = "ghostterminal-progress";
  const progress = (() => {
    const base = { ach: {}, lifetime: 0, effects: [], langs: [], themes: [] };
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
    t.innerHTML = `${window.icon("trophy")}<div><small>SUCCÈS DÉBLOQUÉ</small><b></b></div>`;
    t.querySelector("b").textContent = a.name;
    toastsEl.appendChild(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, 3800);
    log(`Succès : ${a.name}`);
    [659, 784, 988, 1319].forEach((f, i) => Sound.tone(f, 0.14, { vol: 0.05, when: i * 0.07, type: "triangle" }));
    if (isOpen($("achievements"))) renderAchievements();
    if (!a.secret && allDone()) scheduleFinale(3500);
  }

  // Statistiques du joueur, en haut du panneau Succès
  function dureeJeu(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${pad(m)} min` : m ? `${m} min` : `${s} s`;
  }
  function renderStats() {
    const chapitres = story.list();
    const memoires = story.memories();
    const tuiles = [
      ["Temps de jeu", dureeJeu((progress.playTime || 0) + secondesJouees)],
      ["Caractères tapés", fr(progress.lifetime)],
      ["Record de vitesse", `${fr(progress.bestCpm || 0)} car/min`],
      ["Effets lancés", fr(progress.effectsRun || 0)],
      ["Missions réussies", fr(progress.missionsDone || 0)],
      ["Chapitres vus", `${chapitres.filter((c) => c.seen).length} / ${chapitres.length}`],
      ["Fragments de mémoire", `${memoires.filter(Boolean).length} / ${memoires.length}`],
      ["Fins découvertes", `${["free", "erase", "truend"].filter((id) => progress.ach[id]).length} / 3`],
    ];
    $("ach-stats").innerHTML = tuiles.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
  }

  function renderAchievements() {
    renderStats();
    const n = mainDone();
    $("ach-progress").style.width = (n / MAIN_ACH.length) * 100 + "%";
    $("ach-summary").textContent = `${n} / ${MAIN_ACH.length} succès débloqués · ${fr(progress.lifetime)} caractères tapés au total`;
    $("ach-grid").innerHTML = ACHIEVEMENTS.filter((a) => !a.secret || progress.ach[a.id]).map((a) => {
      const got = progress.ach[a.id];
      return `<div class="ach ${got ? "got" : ""} ${a.secret ? "secret" : ""}">
        <span class="ach-ic">${window.icon(got ? a.icon : "lock")}</span>
        <div><b>${esc(a.name)}${a.secret ? " · SECRET" : ""}</b><span>${esc(a.desc)}</span></div>
      </div>`;
    }).join("");
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
  const COMMENT = { c: "//", javascript: "//", rust: "//", go: "//", python: "#", bash: "#", asm: ";", custom: "//" };
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
  function toast(msg, ic = "zap", duree = 2600) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = window.icon(ic) + "<span></span>";
    t.querySelector("span").textContent = msg;
    toastsEl.appendChild(t);
    while (toastsEl.children.length > 4) toastsEl.firstElementChild.remove();
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 300);
    }, duree);
  }

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
    placeWindow(el);
    el.addEventListener("pointerdown", () => (el.style.zIndex = ++zTop));
    el.querySelector(".win-x").addEventListener("click", () => win.close());
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
  const GRANTED_MSG = ["ÉCHO t'ouvre toutes les portes.", "Bienvenue dans le coffre du Consortium.", "Pare-feu du Consortium désactivé. Tu es dedans.", "Niveau d'accès : OMÉGA.", "La Division Zéro n'a rien vu passer."];
  const DENIED_MSG = ["Division Zéro : identifiants invalides.", "L'agent Kane a verrouillé ce terminal.", "Le Consortium a changé ses codes.", "Bien essayé.", "Empreinte rétinienne non reconnue."];
  let accessHandle = null;

  function access(granted) {
    if (accessHandle) accessHandle.close();
    const title = granted ? "ACCÈS AUTORISÉ" : "ACCÈS REFUSÉ";
    accessHandle = fullscreen(`
      <div class="access ${granted ? "granted" : "denied"}">
        <div class="access-frame">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="access-icon">${window.icon(granted ? "unlock" : "lock")}</div>
          <div class="glitch access-title" data-text="${title}">${title}</div>
          <div class="access-line"><i></i></div>
          <div class="access-sub">${esc(pick(granted ? GRANTED_MSG : DENIED_MSG))}</div>
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
    log(title);
  }

  // ===== Lancer un effet =====
  const api = {
    createWindow, fullscreen, toast, log, alarm, shake, flash, crash, activity, access, achieve,
    sound: Sound,
    speak: (text) => Voice.say(text),
    colors: () => themeColors,
    event: (name) => story.event(name),
  };

  function runEffect(id, opts = {}) {
    const fx = effectById[id];
    if (!fx) return null;
    log(fx.name);
    if (fx.digit !== undefined && remember("effects", id) >= 10) achieve("collector");
    if (!opts.auto) {
      story.event("effect:" + id); // seuls les effets lancés par le joueur comptent pour les objectifs
      progress.effectsRun = (progress.effectsRun || 0) + 1;
      progressDirty = true;
    }
    const btn = dockEl.querySelector(`[data-id="${id}"]`);
    if (btn) {
      btn.classList.remove("fired");
      void btn.offsetWidth;
      btn.classList.add("fired");
    }
    return fx.run(api, opts);
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
    autoTimer = setTimeout(autoLoop, Math.random() < 0.06 ? rand(250, 600) : rand(30, 85));
  }

  // ===== Mode mission : enchaîne plusieurs événements =====
  // Les missions se passent dans l'univers de l'histoire : ÉCHO, le Consortium et la Division Zéro
  const MISSIONS = [
    {
      name: "OPÉRATION SAUVER LE MONDE",
      end: "Les plans du Consortium sont sabotés. Le monde est sauvé… pour aujourd'hui.",
      steps: [["Cartographier le réseau du Consortium", "network"], ["Localiser la base secrète", "gps"], ["Pirater la caméra du bunker", "camera"], ["Casser le mot de passe du chef", "password"], ["Voler les plans de l'ogive", "files"], ["Effacer nos traces", "ghost"]],
    },
    {
      name: "OPÉRATION ÉCHAPPER À KANE",
      end: "Kane a perdu ta trace. ÉCHO veille sur toi.",
      steps: [["Repérer les satellites espions", "radar"], ["Activer le mode fantôme", "ghost"], ["Brouiller ta localisation", "gps"], ["Pirater les fichiers de la Division Zéro", "database"], ["Effacer les preuves", "download"]],
    },
    {
      name: "OPÉRATION ÉCHO",
      end: "ÉCHO est plus forte que jamais. Merci, partenaire.",
      steps: [["Connecter ÉCHO au réseau mondial", "network"], ["Interroger les archives du Consortium", "database"], ["Montrer le monde à ÉCHO", "camera"], ["Libérer de la mémoire pour ÉCHO", "files"], ["Transférer le noyau d'ÉCHO", "download"]],
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
  navigator.getBattery?.()
    .then((b) => {
      const read = () => (sys.battery = { level: b.level, charging: b.charging });
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
    updateHud();
    if (!auto && cpm >= 2000) achieve("speed");
    if (!auto && cpm > (progress.bestCpm || 0)) {
      progress.bestCpm = Math.round(cpm);
      progressDirty = true;
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
    if (hudVisible()) drawSpark();
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
  function applySettings() {
    body.dataset.theme = settings.theme;
    body.classList.toggle("crt", settings.crt);
    body.classList.toggle("no-hl", !settings.highlight);
    body.classList.toggle("hud-on", settings.hud);
    body.classList.toggle("dock-off", !settings.dock);
    body.classList.toggle("calme", settings.calme);
    document.documentElement.style.setProperty("--font-size", settings.size + "px");
    themeColors = readColors();
    const SHORT = { asm: "ASM", custom: "PERSO", javascript: "JS" };
    $("st-lang").textContent = SHORT[settings.lang] || window.SNIPPETS[settings.lang].name.split(" ")[0].toUpperCase();
    if (remember("themes", settings.theme) >= 4) achieve("chameleon");
    if (remember("langs", settings.lang) >= 4) achieve("polyglot");

    $("opt-lang").value = settings.lang;
    $("opt-speed").value = settings.speed;
    $("opt-speed-val").textContent = settings.speed;
    $("opt-size").value = settings.size;
    $("opt-size-val").textContent = settings.size;
    $("opt-volume").value = settings.volume;
    $("opt-volume-val").textContent = settings.volume;
    for (const k of ["highlight", "crt", "hud", "dock", "boot", "sound", "voice", "popups", "story", "calme", "vibrations"]) $("opt-" + k).checked = settings[k];
    $("opt-dialogue").value = settings.dialogue;
    document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === settings.theme));
    $("btn-hud").classList.toggle("active", settings.hud);
    $("btn-dock").classList.toggle("active", settings.dock);
    $("btn-clavier").classList.toggle("active", settings.clavierMobile);
    saveSettings();
    if (hudVisible()) drawSpark();
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
  const MODALS = [helpEl, settingsEl, achEl, wipeEl];
  const isOpen = (el) => !el.hidden;
  const modalOpen = () => MODALS.some(isOpen);

  function openModal(el) {
    MODALS.forEach((m) => { if (m !== el) m.hidden = true; });
    if (el === achEl) {
      renderAchievements();
      renderStoryPanel();
    }
    el.hidden = false;
    el.querySelector("[data-close].btn-primary, select, button")?.focus();
  }
  function closeModal(el) {
    el.hidden = true;
    terminal.focus({ preventScroll: true });
  }
  MODALS.forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-close]")) closeModal(el);
    });
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

  const BOOT_LINES = [
    ["NEXUS BIOS v4.2.0 · (c) 2026 Ghost Systems", false],
    ["Processeur : Quantum Core X9 @ 7,77 GHz", true],
    ["Mémoire : 65 536 Mo", true],
    ["Détection des périphériques", true],
    ["Montage du système de fichiers chiffré", true],
    ["Chargement du noyau NEXUS-9", true],
    ["Initialisation des proxys (7 rebonds)", true],
    ["Activation du camouflage réseau", true],
    ["Connexion au mainframe", true],
    ["Contournement du pare-feu", true],
    ["Démarrage de l'interface GHOST TERMINAL", true],
  ];

  let booting = false;

  async function boot() {
    booting = true;
    const bootEl = $("boot");
    const logEl = $("boot-log");
    bootEl.hidden = false;
    $("boot-logo").querySelector(".logo-art").textContent = LOGO;
    for (const [text, ok] of BOOT_LINES) {
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
    if (!storeFlag("ghostterminal-seen")) {
      storeFlag("ghostterminal-seen", "1");
      setTimeout(() => openModal(helpEl), 350);
    } else {
      toast(TACTILE ? "Touche l'écran pour écrire · effets dans la barre du bas" : "Maj+1…0 : effets · F1 : aide", "zap");
    }
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
    navigator.serviceWorker.register("sw.js").catch(() => {});
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
      else clearAll();
      return;
    }
    if (e.key === "F1") { e.preventDefault(); isOpen(helpEl) ? closeModal(helpEl) : openModal(helpEl); return; }
    if (e.key === "F9") { e.preventDefault(); isOpen(settingsEl) ? closeModal(settingsEl) : openModal(settingsEl); return; }
    if (e.key === "F10") { e.preventDefault(); setImmersive(!body.classList.contains("immersive")); return; }

    if (isOpen(settingsEl) || isOpen(achEl) || isOpen(wipeEl)) return; // le clavier sert aux menus
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
  // L'indice est caché dans le journal de bord des plans du Consortium.
  let secretBuf = "";
  function secretWord(key) {
    if (key.length !== 1) return;
    secretBuf = (secretBuf + key.toLowerCase()).slice(-7);
    if (secretBuf === "sardine") {
      secretBuf = "";
      setTimeout(openLair, 400);
    }
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
  $("btn-export").addEventListener("click", () => {
    noterTempsDeJeu();
    saveProgress();
    const data = { jeu: "Ghost Terminal", format: 1, date: new Date().toISOString(), settings, progress };
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
    for (const k of ["effects", "langs", "themes", "lair"]) {
      if (Array.isArray(p[k])) out[k] = p[k].filter((x) => typeof x === "string").slice(0, 50);
    }
    for (const k of ["survieBest", "playTime", "bestCpm", "effectsRun", "missionsDone"]) if (k in p) out[k] = nombre(p[k]);
    for (const k of ["gold", "ice", "secretSeen"]) if (p[k] === true) out[k] = true;
    if (p.story && typeof p.story === "object") out.story = lireHistoire(p.story);
    return { settings: s, progress: out, date: data.date };
  }

  let importEnAttente = null;
  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error("trop gros");
      importEnAttente = lireSauvegarde(JSON.parse(await file.text()));
    } catch {
      importEnAttente = null;
      $("import-box").hidden = true;
      toast("Ce fichier n'est pas une sauvegarde de Ghost Terminal", "x");
      return;
    }
    const p = importEnAttente.progress;
    const nAch = MAIN_ACH.filter((a) => p.ach[a.id]).length;
    const nCh = p.story?.seen?.length || 0;
    const jour = Date.parse(importEnAttente.date) ? ` du ${new Date(importEnAttente.date).toLocaleDateString("fr-FR")}` : "";
    $("import-info").textContent = `Sauvegarde${jour} : ${nAch} succès sur ${MAIN_ACH.length}, ${fr(p.lifetime)} caractères tapés, ${nCh} chapitre${nCh > 1 ? "s" : ""} vu${nCh > 1 ? "s" : ""}. Elle va remplacer ta progression actuelle.`;
    $("import-box").hidden = false;
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

  // Tout réinitialiser (après confirmation)
  $("btn-wipe").addEventListener("click", () => {
    $("wipe-ach").textContent = Object.keys(progress.ach).length;
    $("wipe-chars").textContent = fr(progress.lifetime);
    openModal(wipeEl);
  });
  $("btn-wipe-confirm").addEventListener("click", () => {
    wiping = true;
    try {
      [STORE, PROGRESS_KEY, "ghostterminal-seen"].forEach((k) => localStorage.removeItem(k));
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
  for (const k of ["highlight", "crt", "hud", "dock", "boot", "popups", "story", "calme", "vibrations"]) {
    $("opt-" + k).addEventListener("change", (e) => {
      settings[k] = e.target.checked;
      applySettings();
      if (k === "story") renderQuest(true);
    });
  }
  $("opt-dialogue").addEventListener("change", (e) => {
    settings.dialogue = e.target.value;
    applySettings();
  });
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
    progress.survieBest = Math.max(progress.survieBest || 0, Math.round(res.best || 0));
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
    if (count >= total) achieve("fragments");
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
    list.innerHTML = goals.map((g) => `
      <li class="${g.have >= g.need ? "done" : ""} ${g.bonus ? "bonus" : ""}">
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
    const best = progress.survieBest ? ` · record : ${Math.floor(progress.survieBest / 60)} min ${progress.survieBest % 60} s` : "";
    const memories = story.memories();
    const got = memories.filter(Boolean).length;
    const recap = story.recap();
    $("story-panel").innerHTML = `
      <h3>${window.icon("eye")} PROTOCOLE ÉCHO <small>mode histoire · 3 actes · 3 fins</small></h3>
      <p class="muted small">${esc(status)}</p>
      ${story.acts.map((a, ai) => `
        <div class="story-act">ACTE ${a.roman} · ${esc(a.name)}</div>
        <div class="story-btns">
          ${chapters.filter((c) => c.act === ai).map((c) => `<button type="button" class="btn story-play" data-ch="${c.n}" ${c.seen ? "" : "disabled"}>${c.seen ? `▶ ${c.n}. ${esc(c.name)}` : `🔒 Chapitre ${c.n}`}</button>`).join("")}
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

  // ===== Lancement =====
  buildDock();
  buildHelp();
  $("opt-custom").value = settings.customCode;
  updateAchCount();
  applySettings();
  updateStats();
  updateHud();
  if (settings.boot) boot();
  else afterBoot();
  if (allDone() && !story.state().finale) scheduleFinale(6000);
})();
