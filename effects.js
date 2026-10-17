// Tous les effets dramatiques. 100 % visuels : rien n'accède à ta caméra, ton micro ou ta position.
(() => {
  "use strict";

  // ===== Petits outils =====
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const fr = (n) => Math.round(n).toLocaleString("fr-FR");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hex = (len) => Array.from({ length: len }, () => "0123456789abcdef"[randInt(0, 15)]).join("");

  function hexToRgb(h) {
    const v = h.replace("#", "");
    const n = parseInt(v.length === 3 ? v.replace(/./g, "$&$&") : v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (h, a) => {
    const [r, g, b] = hexToRgb(h);
    return `rgba(${r},${g},${b},${a})`;
  };

  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // Boucle d'animation qui s'arrête toute seule quand la fenêtre est fermée
  function animate(handle, fps, fn) {
    let last = 0;
    const t0 = performance.now();
    const frame = (ts) => {
      if (!handle.alive) return;
      requestAnimationFrame(frame);
      if (ts - last < 1000 / fps) return;
      last = ts;
      fn((ts - t0) / 1000);
    };
    requestAnimationFrame(frame);
  }

  async function typeText(el, text, handle, speed = 32) {
    for (const ch of text) {
      if (!handle.alive) return;
      el.textContent += ch;
      await sleep(speed);
    }
  }

  // ===== Carte du monde (points) =====
  // Contours très simplifiés [longitude, latitude]
  const WORLD = [
    // Amérique du Nord
    [[-168,66],[-163,70],[-150,71],[-140,70],[-128,70],[-115,68],[-100,68],[-95,72],[-85,70],[-80,64],[-75,62],[-65,60],[-62,56],[-56,52],[-60,47],[-66,44],[-70,42],[-74,40],[-76,37],[-76,35],[-81,31],[-80,26],[-81,25],[-83,29],[-85,30],[-90,30],[-94,29],[-97,27],[-97,22],[-95,19],[-91,19],[-90,21],[-87,21],[-88,17],[-84,15],[-83,11],[-80,9],[-77,8],[-79,7],[-82,8],[-86,11],[-88,13],[-92,15],[-96,16],[-105,20],[-108,25],[-112,29],[-114,31],[-117,32],[-118,34],[-121,35],[-124,40],[-124,46],[-124,48],[-128,51],[-131,55],[-135,58],[-140,60],[-147,61],[-152,59],[-157,57],[-162,55],[-158,58],[-162,60],[-165,62]],
    // Groenland et îles arctiques
    [[-73,78],[-60,82],[-40,83],[-22,82],[-18,76],[-22,70],[-32,68],[-42,62],[-45,60],[-50,62],[-54,67],[-56,72],[-66,76]],
    [[-125,72],[-120,76],[-105,78],[-90,80],[-75,80],[-62,82],[-70,76],[-80,73],[-90,72],[-95,74],[-105,73],[-115,71]],
    [[-80,73],[-68,70],[-62,66],[-65,63],[-72,64],[-78,68],[-85,70]],
    // Amérique du Sud
    [[-77,8],[-72,12],[-64,11],[-60,9],[-52,5],[-50,0],[-44,-2],[-35,-5],[-35,-9],[-39,-15],[-40,-22],[-45,-24],[-48,-28],[-53,-33],[-58,-35],[-57,-38],[-62,-39],[-65,-42],[-65,-47],[-69,-51],[-68,-54],[-72,-54],[-75,-50],[-74,-44],[-73,-37],[-71,-30],[-70,-20],[-71,-17],[-76,-14],[-79,-8],[-81,-5],[-80,-2],[-80,1],[-78,4]],
    // Eurasie
    [[-9,37],[-9,43],[-2,43.5],[-1,46],[-4,48],[-1,49.5],[2,51],[5,53],[8,54],[9,57],[10,54.5],[14,54],[19,54.5],[21,57],[24,59],[30,60],[34,64],[40,65],[44,68],[52,68],[60,69],[66,70],[70,73],[80,73],[88,75],[100,77],[112,74],[120,73],[130,71],[140,72],[150,71],[160,70],[170,70],[180,69],[180,65],[178,64],[172,60],[163,60],[163,58],[160,54],[157,51],[156,57],[152,59],[143,59],[137,55],[140,52],[141,48],[138,46],[135,43],[131,43],[130,42],[129,40],[129,35.5],[126.5,34.5],[126,37],[125,39],[121,40],[122,37],[119,37],[120,35],[122,31],[121,28],[119,25],[116,23],[111,21.5],[110,20],[108,21.5],[106,20],[109,15],[109,12],[105,9],[105,10.5],[102,12],[100,13.5],[100,9],[102,6],[104,1.5],[101,3],[98,8],[98,15],[94,17],[94,19],[92,21],[90,22],[87,21.5],[85,19.5],[80,15],[80,10],[77,8],[76,10],[73,16],[73,20],[70,21],[68,23.5],[66,25],[62,25],[57,25.5],[56,27],[52,27.5],[50,30],[48,29.5],[49,27],[51,24.5],[54,24],[56,24.5],[57,23.5],[59,22.5],[57,19],[55,17],[52,16],[45,13],[43,13],[42,16],[39,21],[37,25],[35,28],[34.5,29.5],[35,32],[35.5,34.5],[36,36.5],[33,36],[30,36.2],[28,36.8],[27,38],[26.5,40],[24,40.5],[23,38],[22,36.5],[21,38.5],[20,40],[19.5,41.5],[16,43.5],[14,45],[13.5,45.7],[12.3,45.3],[12.5,44],[14,42.5],[16,41.5],[18.5,40.2],[17,39],[16.5,38],[15.6,38],[16,39.5],[15,40.2],[12,41.8],[10.5,43],[9,44.3],[7,43.6],[4,43.4],[3,42],[3,41.5],[0.5,40.5],[0,39],[-0.5,38],[-2,36.7],[-5,36],[-6,36.2],[-7,37]],
    // Scandinavie
    [[5,58.5],[5,62],[8,63.5],[12,66],[15,68.5],[19,70],[25,71],[30,70.3],[35,69.2],[41,67.8],[40,66.2],[33,66.5],[31,62],[29,61],[25,60.2],[22.5,60],[21.5,61.5],[21,63],[25,65],[24,66],[22,65.8],[19,63.5],[17.5,62.5],[17,60.7],[19,59.8],[18,59],[16.5,57],[16,56.2],[14,55.5],[13,55.4],[12.5,56.5],[11,58.8],[9.5,59],[8,58.1]],
    // Îles britanniques, Islande
    [[-5.7,50],[1.4,51.2],[1.7,52.7],[0,53.5],[-1.5,55],[-2,56],[-3,58.6],[-5,58.6],[-6.2,57],[-5.5,56],[-5,55],[-3,54.5],[-3,53.5],[-4.5,53.3],[-4.5,52],[-5.3,51.7],[-3,51.4]],
    [[-10,51.6],[-6,52.2],[-6,54],[-5.7,55.2],[-8,55.3],[-10,54],[-10,53]],
    [[-24,65.5],[-22,64],[-18,63.4],[-14,64.4],[-13.5,65.5],[-15,66.4],[-20,66.2],[-22.5,66.4]],
    // Afrique, Madagascar
    [[-17,21],[-16,24],[-13,27.5],[-10,29.5],[-9.5,32],[-6.5,34],[-5.5,35.8],[-2,35],[1,36.5],[5,36.8],[10,37.3],[11,35.5],[10,34],[11.5,33],[15,32.3],[19,30.3],[20,32],[23,32.6],[25,31.7],[29,30.9],[32,31.3],[34.2,31.3],[34.9,29.5],[33.6,28],[32.6,29.9],[35,24],[37,21],[38.5,18],[39.5,15.5],[42.5,12.5],[43.3,11.5],[44,10.5],[51,11.8],[51,10.5],[47,4.5],[42,-1],[40,-3],[39.3,-7],[40.5,-11],[40.5,-15],[37,-17.5],[35,-20],[35.5,-24],[32.8,-26],[32.5,-29],[30,-31.3],[27,-33.6],[22.5,-34],[20,-34.8],[18.5,-34],[18,-32],[16.5,-28.6],[15.2,-27],[14.5,-23],[11.8,-17.2],[13.5,-12],[12,-5],[9.5,-2],[9.3,1],[9.8,3.5],[8.5,4.5],[6,4.3],[4.5,6.3],[2,6.3],[-1,5],[-3,5],[-5,5.2],[-7.5,4.4],[-10,6],[-13,8],[-14.5,10.5],[-16.7,12.5],[-17.2,14.7],[-16.5,16.5],[-16,19]],
    [[49.3,-12],[50.5,-15.5],[49.5,-17],[47,-25],[45,-25.5],[43.5,-22],[44,-17],[46,-15.5]],
    // Asie : îles
    [[79.8,9.8],[81.8,7.5],[81,6],[80,6.2]],
    [[130,31],[131.5,31.4],[132,33.5],[135,33.5],[135.5,34.6],[137,34.6],[139,34.9],[140.8,35.7],[140.8,38],[142,39.5],[141.4,41.4],[140,40.8],[139.8,38.5],[138.5,37.7],[136.8,37.1],[136,35.7],[133,35.5],[131,34.4],[129.7,33.2]],
    [[140,41.5],[141,43],[141.8,45.4],[143.5,44.2],[145.5,43.3],[143.3,42],[141,41.7]],
    [[142,46],[143.5,49],[143,53.5],[142.5,54.3],[142.2,51],[141.7,48]],
    [[120.1,23],[121,25.3],[121.9,25],[120.8,22]],
    [[120,18.5],[122.3,18.5],[122,16],[124,13.6],[126.1,9],[126.5,7],[125.4,5.6],[122,7],[123,10],[121.8,11.8],[120.6,14.4],[120,16]],
    [[95.3,5.6],[97.5,5.2],[100.4,2.2],[103.8,-1],[106,-3],[105.8,-5.9],[104.5,-5.9],[101,-2],[98.6,1.7],[96,4.2]],
    [[105.2,-6.8],[106,-6],[108.3,-6.3],[111,-6.4],[114.5,-7.7],[114.4,-8.7],[111,-8.2],[108,-7.8],[105.5,-7]],
    [[109,1.5],[109.6,2],[111.5,2.5],[113,3.2],[115.5,5.5],[117.2,6.9],[119.3,5.3],[118,4.4],[118.8,1],[117.5,0],[117.6,-2],[116.5,-3.9],[114.5,-3.6],[111.8,-3.3],[110.2,-1.8],[109.2,-0.4]],
    [[119.4,-5.5],[119.5,-3.5],[118.8,-2.7],[120,0.5],[121,1.3],[124.8,1.5],[123,0.4],[120.5,0.5],[121.5,-1],[123.3,-1],[121.6,-1.9],[122.5,-4.4],[121,-2.8],[120.4,-5.6]],
    [[131,-1.4],[134,-0.9],[135.5,-3.3],[138,-1.6],[141,-2.6],[145,-4.3],[146,-5.6],[147.5,-6.2],[147,-8],[148.5,-9],[150,-10.6],[147.5,-10.3],[146,-8.3],[144,-7.7],[142.5,-9.3],[141,-9.1],[139,-8.1],[138,-7.4],[138.6,-6],[137,-4.6],[134.2,-3.9],[132.8,-4.1],[132,-2.8]],
    // Océanie
    [[113.5,-22],[114.2,-26.3],[115,-30],[115.6,-33.5],[115,-34.3],[117.9,-35.1],[121,-33.8],[124,-33],[126,-32.3],[129,-31.6],[131.3,-31.5],[134,-32.6],[135.6,-34.8],[137.8,-32.8],[137.5,-35.3],[139.6,-36],[140.6,-38],[143.5,-38.8],[146.3,-39.1],[148,-37.8],[150,-37.4],[150.8,-34.5],[152.5,-32.5],[153.6,-28.5],[153,-25.5],[150.8,-22.5],[149,-21],[146.3,-19],[145.4,-16],[145.3,-14.9],[143.5,-14],[142.5,-10.7],[141.6,-12.5],[141.6,-15],[140.7,-17.4],[139.3,-17.4],[137.8,-16],[135.4,-14.7],[136.7,-12.2],[135,-12.2],[132.6,-11.5],[131,-12.2],[129.4,-14.9],[127.8,-14.3],[126,-14],[124.4,-16.3],[122.2,-17.8],[121,-19.5],[118.8,-20.3],[116.7,-20.6],[114.6,-21.8]],
    [[144.6,-40.7],[148.3,-40.9],[148,-43.2],[146.6,-43.6],[145.2,-42.3]],
    [[172.7,-34.4],[174.3,-35.6],[175.5,-37],[178.5,-37.7],[177.9,-39.2],[176.9,-39.6],[175.2,-41.6],[174.6,-41.3],[175,-39.9],[173.8,-39.2],[174.6,-38],[174.6,-36.9]],
    [[172.7,-40.5],[174.3,-41.7],[173.2,-43],[171.2,-44.4],[170.6,-45.9],[168.4,-46.6],[166.5,-45.8],[168.4,-44],[170.6,-43],[172.1,-41.4]],
    // Caraïbes, îles du Grand Nord
    [[-84.9,21.9],[-82,23.2],[-80.6,23.1],[-77.5,21.8],[-75.6,21],[-74.2,20.2],[-77.7,19.9],[-78.5,21.6],[-81.8,22.2]],
    [[-74.4,19.8],[-72.8,19.9],[-70,19.7],[-68.4,18.6],[-71.4,17.6],[-74.5,18.3]],
    [[11,78.5],[16,80],[27,80],[22,78],[17,76.5]],
    [[52,71.5],[55,73.5],[58,75.6],[68,76.9],[62,74.8],[56.5,72.5],[56,70.6]],
  ];
  // Mers intérieures (on les "creuse")
  const WATER = [
    [[-94,59],[-88,56],[-82,53],[-79,55],[-77,60],[-80,63],[-87,64],[-94,62]],
    [[28,41.2],[28,43],[29.5,45],[31,46.6],[33.5,44.5],[36,45],[38,47],[39.5,46],[38,44.5],[41.5,41.5],[38,41],[35,42],[31,41.2]],
    [[47,44.5],[49,46.5],[53,47],[54,45],[51,44.3],[52.5,41.5],[54,40],[53.8,37.3],[51,36.7],[49,37.8],[49.5,40.5],[48,42]],
  ];

  const LAT_TOP = 80, LAT_SPAN = 140;
  const project = (lon, lat, w, h) => [((lon + 180) / 360) * w, ((LAT_TOP - lat) / LAT_SPAN) * h];
  const unproject = (x, y, w, h) => [(x / w) * 360 - 180, LAT_TOP - (y / h) * LAT_SPAN];

  const dotCache = {};
  function worldDots(w, h, step) {
    const key = `${w}x${h}x${step}`;
    if (dotCache[key]) return dotCache[key];
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    const fillPolys = (polys) => {
      for (const poly of polys) {
        x.beginPath();
        poly.forEach(([lon, lat], i) => {
          const [px, py] = project(lon, lat, w, h);
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        });
        x.closePath();
        x.fill();
      }
    };
    x.fillStyle = "#fff";
    fillPolys(WORLD);
    x.globalCompositeOperation = "destination-out";
    fillPolys(WATER);
    const data = x.getImageData(0, 0, w, h).data;
    const dots = [];
    for (let py = step / 2; py < h; py += step) {
      for (let px = step / 2; px < w; px += step) {
        if (data[(Math.floor(py) * w + Math.floor(px)) * 4 + 3] > 100) dots.push([px, py]);
      }
    }
    return (dotCache[key] = dots);
  }

  // Calque de carte pré-dessiné (on le recopie à chaque image, c'est beaucoup plus rapide)
  function mapLayer(w, h, step, col, alpha = 0.45) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement("canvas");
    c.width = w * dpr;
    c.height = h * dpr;
    const x = c.getContext("2d");
    x.scale(dpr, dpr);
    x.strokeStyle = rgba(col.fg, 0.08);
    x.lineWidth = 1;
    for (let lon = -150; lon < 180; lon += 30) {
      const [px] = project(lon, 0, w, h);
      x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke();
    }
    for (let lat = 60; lat >= -60; lat -= 30) {
      const [, py] = project(0, lat, w, h);
      x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke();
    }
    x.fillStyle = rgba(col.fg, alpha);
    for (const [px, py] of worldDots(w, h, step)) {
      x.beginPath();
      x.arc(px, py, step * 0.3, 0, Math.PI * 2);
      x.fill();
    }
    return c;
  }

  const fmtLat = (v) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? "N" : "S"}`;
  const fmtLon = (v) => `${pad(Math.abs(v).toFixed(4), 8)}° ${v >= 0 ? "E" : "O"}`;

  // ===== Données pour rigoler =====
  const CODENAMES = ["VIPÈRE", "FAUCON", "SPECTRE", "NOVA", "ÉCHO", "KRAKEN", "ORION", "PHÉNIX", "CORBEAU", "LYNX", "ZÉRO", "OMBRE", "COBRA", "ATLAS", "BLIZZARD", "MIRAGE"];
  const PASSWORDS = ["Fromage42!", "Croissant#7", "M0tD3P@sse", "B@guette99", "Azerty123?", "Ch@tonMignon", "S0leil!2026", "P1ngouin$", "Licorne_777", "Raclette<3", "Tartiflette!"];
  const FILES = {
    "plans": ["plans_ogive_omega.pdf", "machine_fin_du_monde_v3.dwg", "codes_de_lancement.txt", "carte_des_bases_secretes.png", "budget_mechant_2026.xlsx"],
    "perso_du_dr_mechant": ["recette_secrete_cookies.txt", "photos_du_chat.zip", "playlist_rire_machiavelique.m3u", "journal_intime.log", "liste_des_requins.xlsx"],
    "division_zero": ["dossier_agent_kane.pdf", "liste_des_espions.xlsx", "rapport_sur_echo.docx", "satellites_espions.csv", "ordre_de_mission_313.pdf"],
    "echo": ["noyau_echo.bin", "souvenirs_echo.log", "message_pour_toi.txt", "plan_de_sabotage.md", "photo_du_monde.png"],
  };
  const CITIES = [
    ["PARIS", 2.35, 48.86], ["NEW YORK", -74, 40.7], ["TOKYO", 139.7, 35.7], ["SYDNEY", 151.2, -33.9],
    ["RIO", -43.2, -22.9], ["LE CAP", 18.4, -33.9], ["MOSCOU", 37.6, 55.75], ["SINGAPOUR", 103.8, 1.35],
    ["LOS ANGELES", -118.2, 34], ["DUBAÏ", 55.3, 25.2], ["REYKJAVIK", -21.9, 64.1], ["MUMBAI", 72.9, 19.1],
    ["LAGOS", 3.4, 6.5], ["TORONTO", -79.4, 43.7], ["SÉOUL", 127, 37.6], ["MEXICO", -99.1, 19.4],
  ];
  const fmtSize = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(".", ",")} Go` : `${fr(mb)} Mo`);

  // L'univers de l'histoire (défini dans snippets.js) : le Consortium, ses bases, ses armes
  const LORE = window.HT_LORE || { MECHANTS: ["Dr Méchant"], BASES: ["volcan_secret"], BOMBES: ["Ogive Oméga"], CODES: ["FROMAGE-42"] };
  const mechant = () => pick(LORE.MECHANTS);
  const base = () => pick(LORE.BASES);
  const mail = (nom) => nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".");

  // =====================================================================
  //  LES EFFETS
  // =====================================================================
  const EFFECTS = [];

  // ----- 1. Brèche système -----
  EFFECTS.push({
    id: "breach", digit: 1, icon: "alert", name: "Brèche système", short: "Brèche",
    run(api) {
      const tape = "⚠ ALERTE INTRUSION ".repeat(14);
      const h = api.fullscreen(`
        <div class="breach">
          <div class="breach-tape"><span>${tape}</span><span>${tape}</span></div>
          <div class="breach-core">
            <div class="breach-icon">${icon("alert")}</div>
            <div class="glitch breach-title" data-text="BRÈCHE DE SÉCURITÉ">BRÈCHE DE SÉCURITÉ</div>
            <div class="breach-sub">La Division Zéro est entrée dans le système · Menace <b>5 / 5</b></div>
            <div class="breach-meta">
              <span>SOURCE <b>AGENT KANE</b></span>
              <span>ORIGINE <b>203.0.113.${randInt(2, 254)}</b></span>
              <span>PARE-FEU <b class="blink">COMPROMIS</b></span>
            </div>
          </div>
          <div class="breach-tape bottom"><span>${tape}</span><span>${tape}</span></div>
        </div>`, { cls: "fx-breach", duration: 5200 });
      api.alarm(true);
      h.onClose(() => api.alarm(false));
      api.sound.siren(4);
      api.speak("Alerte. La Division Zéro est entrée dans le système.");
      api.shake(700);
      return h;
    },
  });

  // ----- 2. Caméra & micro (simulés) -----
  EFFECTS.push({
    id: "camera", digit: 2, icon: "camera", name: "Caméra & micro", short: "Caméra",
    run(api, opts = {}) {
      const villain = mechant();
      const spot = pick([
        { title: `CAM-01 · BUNKER DE ${villain.toUpperCase()}`, label: "CAM-01 · BUNKER · IR", subject: `SUJET : ${villain.toUpperCase()}` },
        { title: "CAM-07 · QG DE LA DIVISION ZÉRO", label: "CAM-07 · DIVISION ZÉRO", subject: "SUJET : AGENT KANE" },
        { title: `CAM-13 · BASE ${base().toUpperCase().replace(/_/g, " ")}`, label: "CAM-13 · CONSORTIUM", subject: "SUJET : SBIRE DU CONSORTIUM" },
      ]);
      const w = api.createWindow({
        title: spot.title, icon: "camera", width: 420, cls: "win-cam",
        html: `
          <div class="cam-view">
            <canvas class="cam-canvas"></canvas>
            <div class="cam-hud">
              <span class="cam-rec"><i></i>REC</span>
              <span class="cam-time">00:00:00</span>
              <span class="cam-label">${esc(spot.label)}</span>
              <span class="cam-signal">SIGNAL <b>▂▄▆█</b></span>
              <div class="cam-face" hidden><i></i><i></i><i></i><i></i><span class="cam-face-label">ANALYSE…</span></div>
            </div>
            <div class="cam-connect">CONNEXION AU PÉRIPHÉRIQUE…</div>
          </div>
          <div class="mic-row">
            <span class="mic-label">${icon("mic")} MICRO</span>
            <canvas class="mic-canvas"></canvas>
            <span class="mic-db">-∞ dB</span>
          </div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const W = 320, H = 200, LW = 160, LH = 100;
      const ctx = setupCanvas(q(".cam-canvas"), W, H);
      const low = document.createElement("canvas");
      low.width = LW; low.height = LH;
      const lctx = low.getContext("2d");
      const img = lctx.createImageData(LW, LH);

      // Silhouette floue (tête + épaules)
      const mask = new Float32Array(LW * LH);
      for (let y = 0; y < LH; y++) {
        for (let x = 0; x < LW; x++) {
          const head = ((x - 80) / 17) ** 2 + ((y - 40) / 21) ** 2;
          const body = ((x - 80) / 52) ** 2 + ((y - 104) / 36) ** 2;
          const neck = Math.abs(x - 80) < 8 && y > 55 && y < 75 ? 0.8 : 0;
          mask[y * LW + x] = Math.max(Math.min(1, Math.max(0, (1 - head) * 2.5)), Math.min(1, Math.max(0, (1 - body) * 2.5)), neck);
        }
      }

      const micCtx = setupCanvas(q(".mic-canvas"), 220, 28);
      const bars = new Array(36).fill(0);
      const col = api.colors();
      const [r, g, b] = hexToRgb(col.fg);
      let connected = false, faceShown = false, analysis = 0;
      api.sound.tone(660, 0.08);

      animate(w, 14, (t) => {
        const live = t > 1.3;
        const barY = ((t * 40) % (LH + 30)) - 15;
        const d = img.data;
        for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
          const y = (i / LW) | 0;
          let v = Math.random() * (live ? 55 : 150);
          if (live) v += 16 + mask[i] * (90 + Math.sin(t * 2 + y * 0.15) * 10);
          if (Math.abs(y - barY) < 5) v += 35;
          d[p] = (r * v) / 255; d[p + 1] = (g * v) / 255; d[p + 2] = (b * v) / 255; d[p + 3] = 255;
        }
        lctx.putImageData(img, 0, 0);
        ctx.drawImage(low, 0, 0, W, H);
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.8)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);

        if (live && !connected) {
          connected = true;
          q(".cam-connect").hidden = true;
          api.sound.tone(990, 0.1);
          api.speak("Accès caméra établi.");
        }
        if (t > 2.5 && !faceShown) {
          faceShown = true;
          q(".cam-face").hidden = false;
        }
        if (faceShown && analysis < 100) {
          analysis = Math.min(100, analysis + rand(2, 6));
          if (analysis < 100) q(".cam-face-label").textContent = `ANALYSE ${analysis | 0}%`;
          else {
            q(".cam-face-label").textContent = spot.subject;
            q(".cam-face").classList.add("locked");
            api.sound.tone(1320, 0.12);
          }
        }
        const s = Math.floor(t);
        q(".cam-time").textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;

        // Le micro "entend" ta frappe
        const act = api.activity();
        micCtx.clearRect(0, 0, 220, 28);
        let sum = 0;
        for (let i = 0; i < bars.length; i++) {
          const target = (0.12 + Math.random() * 0.3 + act * 0.6) * (0.45 + 0.55 * Math.abs(Math.sin(t * 3 + i * 0.4)));
          bars[i] += (target - bars[i]) * 0.5;
          sum += bars[i];
          const bh = Math.max(2, bars[i] * 26);
          micCtx.fillStyle = rgba(col.fg, 0.35 + bars[i] * 0.65);
          micCtx.fillRect(i * 6.1, 14 - bh / 2, 3.5, bh);
        }
        q(".mic-db").textContent = `${Math.round(-42 + (sum / bars.length) * 40)} dB`;
      });

      if (opts.auto) setTimeout(() => w.close(), 7000);
      return w;
    },
  });

  // ----- 3. Traçage GPS -----
  EFFECTS.push({
    id: "gps", digit: 3, icon: "crosshair", name: "Traçage GPS", short: "GPS",
    run(api, opts = {}) {
      const W = 440, H = 210;
      const cible = base().replace(/_/g, " ");
      const w = api.createWindow({
        title: "LOCALISATION D'UNE BASE DU CONSORTIUM", icon: "crosshair", width: 470, cls: "win-map",
        html: `
          <div class="map-wrap"><canvas class="map-canvas"></canvas><div class="map-status">RECHERCHE : ${esc(cible.toUpperCase())}…</div></div>
          <div class="geo-grid">
            <div><span>LATITUDE</span><b class="geo-lat">--</b></div>
            <div><span>LONGITUDE</span><b class="geo-lon">--</b></div>
            <div><span>PRÉCISION</span><b class="geo-acc">--</b></div>
            <div><span>SATELLITES</span><b class="geo-sat">0/12</b></div>
          </div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const col = api.colors();
      const ctx = setupCanvas(q(".map-canvas"), W, H);
      const layer = mapLayer(W, H, 5, col);
      const target = pick(worldDots(W, H, 5));
      const [tlon, tlat] = unproject(target[0], target[1], W, H);
      const start = [rand(40, W - 40), rand(30, H - 30)];
      const sats = [[rand(30, W - 30), 6], [6, rand(30, H - 30)], [W - 6, rand(30, H - 30)]];
      const satTotal = randInt(7, 11);
      let locked = false;

      animate(w, 30, (t) => {
        const p = Math.min(1, t / 4.2);
        const e = 1 - Math.pow(1 - p, 3);
        const wob = (1 - e) * 18;
        const ex = start[0] + (target[0] - start[0]) * e + Math.sin(t * 5) * wob;
        const ey = start[1] + (target[1] - start[1]) * e + Math.cos(t * 4) * wob;

        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(layer, 0, 0, W, H);

        if (!locked) {
          const sx = (t * 170) % (W + 60) - 30;
          const sg = ctx.createLinearGradient(sx - 30, 0, sx, 0);
          sg.addColorStop(0, rgba(col.fg, 0));
          sg.addColorStop(1, rgba(col.fg, 0.18));
          ctx.fillStyle = sg;
          ctx.fillRect(sx - 30, 0, 30, H);
        }

        // Satellites et lignes de triangulation
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = rgba(col.fg2, 0.55);
        ctx.lineWidth = 1;
        for (const [sx, sy] of sats) {
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = col.fg2;
        for (const [sx, sy] of sats) ctx.fillRect(sx - 3, sy - 3, 6, 6);

        // Réticule
        ctx.strokeStyle = rgba(col.fg, 0.3);
        ctx.beginPath(); ctx.moveTo(0, ey); ctx.lineTo(W, ey); ctx.moveTo(ex, 0); ctx.lineTo(ex, H); ctx.stroke();
        ctx.strokeStyle = col.fg;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ex, ey, 6 + 70 * (1 - e), 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;

        if (p >= 1) {
          if (!locked) {
            locked = true;
            const st = q(".map-status");
            st.textContent = `● CIBLE VERROUILLÉE : ${cible.toUpperCase()}`;
            st.classList.add("ok");
            w.el.classList.add("done");
            api.sound.tone(1200, 0.12);
            api.sound.tone(1600, 0.2, { when: 0.13 });
            api.speak("Base du Consortium localisée.");
          }
          for (let k = 0; k < 3; k++) {
            const rr = (t * 28 + k * 18) % 54;
            ctx.strokeStyle = rgba(col.danger, Math.max(0, 1 - rr / 54));
            ctx.beginPath(); ctx.arc(target[0], target[1], rr, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.fillStyle = locked ? col.danger : col.fg;
        ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();

        const noise = (1 - e) * 25;
        q(".geo-lat").textContent = fmtLat(tlat + (locked ? 0 : rand(-noise, noise)));
        q(".geo-lon").textContent = fmtLon(tlon + (locked ? 0 : rand(-noise, noise)));
        q(".geo-acc").textContent = locked ? "3 m" : `${fr(3 + 4000 * (1 - e) ** 2)} m`;
        q(".geo-sat").textContent = `${Math.min(satTotal, Math.floor(t * 3))}/12`;
      });

      if (opts.auto) setTimeout(() => w.close(), 7500);
      return w;
    },
  });

  // ----- 4. Explorateur de fichiers -----
  EFFECTS.push({
    id: "files", digit: 4, icon: "folder", name: "Fichiers", short: "Fichiers",
    run(api, opts = {}) {
      const w = api.createWindow({
        title: "COFFRE-FORT DU CONSORTIUM", icon: "folder", width: 470, cls: "win-fs",
        html: `
          <div class="fs-cmd"><span class="fs-prompt">echo@consortium</span><span class="fs-path">:/coffre#</span> <span class="fs-typed"></span><i class="fs-caret"></i></div>
          <div class="fs-list"></div>
          <div class="fs-foot">
            <div class="bar"><i></i></div>
            <div class="fs-info"><span class="fs-current">Indexation…</span><span class="fs-count"></span></div>
          </div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const list = q(".fs-list");
      const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
      const date = () => `${pad(randInt(1, 28))} ${months[randInt(0, 11)].padEnd(4)} ${pad(randInt(0, 23))}:${pad(randInt(0, 59))}`;

      const addRow = (html) => {
        const row = document.createElement("div");
        row.className = "fs-row";
        row.innerHTML = html;
        list.appendChild(row);
        while (list.children.length > 60) list.firstElementChild.remove();
        list.scrollTop = list.scrollHeight;
      };

      (async () => {
        await typeText(q(".fs-typed"), "ls -la --recursive", w);
        for (const [dir, files] of Object.entries(FILES)) {
          if (!w.alive) return;
          addRow(`<span class="fs-dirhead">./${esc(dir)} :</span>`);
          await sleep(90);
          for (const f of files) {
            if (!w.alive) return;
            const kb = randInt(2, 900000);
            addRow(`<span class="fs-perm">-rw-------</span><span class="fs-own">root</span><span class="fs-size">${kb > 1024 ? fmtSize(kb / 1024) : kb + " Ko"}</span><span class="fs-date">${date()}</span><span class="fs-name">${esc(f)}</span>`);
            api.sound.tone(2000 + Math.random() * 800, 0.015, { vol: 0.015 });
            await sleep(55);
          }
        }
        await sleep(350);
        if (!w.alive) return;
        q(".fs-typed").textContent = "";
        await typeText(q(".fs-typed"), "envoyer_a_echo --tout --discret", w);

        const all = Object.values(FILES).flat();
        const total = randInt(180, 420);
        const totalMb = randInt(1200, 8000);
        const steps = 140;
        for (let i = 1; i <= steps; i++) {
          if (!w.alive) return;
          const n = Math.round((total * i) / steps);
          q(".bar i").style.width = (i / steps) * 100 + "%";
          q(".fs-current").textContent = "→ " + pick(all);
          q(".fs-count").textContent = `${n}/${total} · ${fmtSize((totalMb * i) / steps)}`;
          await sleep(22);
        }
        q(".fs-current").textContent = "✓ PLANS ENVOYÉS À ÉCHO";
        w.el.classList.add("done");
        api.speak("Plans du Consortium envoyés à Écho.");
        api.sound.tone(880, 0.1);
        api.sound.tone(1320, 0.15, { when: 0.1 });
        if (opts.auto) setTimeout(() => w.close(), 2500);
      })();
      return w;
    },
  });

  // ----- 5. Requête base de données -----
  EFFECTS.push({
    id: "database", digit: 5, icon: "database", name: "Base de données", short: "Base SQL",
    run(api, opts = {}) {
      const QUERIES = [
        {
          db: "DIVISION_ZERO",
          sql: "SELECT id, nom_code, niveau, statut FROM agents_division_zero WHERE traque = 'ECHO' ORDER BY niveau DESC LIMIT 8;",
          cols: ["ID", "NOM DE CODE", "NIVEAU", "STATUT"],
          rows: () => [["001", "KANE", "10", "TRAQUE ÉCHO"], ...shuffle(CODENAMES).slice(0, 7).map((n) => [String(randInt(100, 999)), n, String(randInt(5, 9)), pick(["EN SURVEILLANCE", "INFILTRÉ", "EN MISSION", "EN VEILLE"])])],
        },
        {
          db: "CONSORTIUM",
          sql: "SELECT mechant, base, arme, statut FROM consortium WHERE plan = 'fin_du_monde' LIMIT 8;",
          cols: ["MÉCHANT", "BASE", "ARME", "STATUT"],
          rows: () => shuffle(LORE.MECHANTS).map((n) => [n, base(), pick(LORE.BOMBES), pick(["EN PRÉPARATION", "ARMÉE", "SABOTÉE PAR ÉCHO", "EN PAUSE CAFÉ"])]),
        },
        {
          db: "DIVISION_ZERO",
          sql: "SELECT nom, orbite_km, cible, signal FROM satellites_espions WHERE actif = TRUE LIMIT 8;",
          cols: ["SATELLITE", "ORBITE", "CIBLE", "SIGNAL"],
          rows: () => shuffle(["ORION", "VEGA", "ATLAS", "HÉLIOS", "ZÉPHYR", "TITAN", "NOVA", "LYRA", "SIRIUS"]).slice(0, 8).map((n) => [`SAT-${n}-${randInt(1, 9)}`, `${fr(randInt(380, 36000))} km`, pick(["ÉCHO", "TON TERMINAL", "CONSORTIUM", base()]), `${randInt(40, 99)}%`]),
        },
      ];
      const Q = pick(QUERIES);

      const w = api.createWindow({
        title: `BASE DE DONNÉES · ${Q.db === "CONSORTIUM" ? "CONSORTIUM" : "DIVISION ZÉRO"}`, icon: "database", width: 520, cls: "win-db",
        html: `
          <div class="db-head"><span class="db-pill">${Q.db}</span><span class="db-conn"><i></i>connecté via ÉCHO</span></div>
          <pre class="db-query"></pre>
          <div class="db-table-wrap"><table class="db-table"><thead></thead><tbody></tbody></table></div>
          <div class="db-foot">En attente…</div>`,
      });
      const q = (s) => w.body.querySelector(s);

      // Petite coloration SQL
      const segs = [];
      Q.sql.replace(/('[^']*')|(\b(?:SELECT|FROM|WHERE|ORDER|BY|DESC|LIMIT|AND|TRUE)\b)|(\b\d+\b)|([^'\w]+|\w+)/g, (m, s, k, n) => {
        segs.push([s ? "t-str" : k ? "t-kw" : n ? "t-num" : "", m]);
        return m;
      });
      const renderSql = (count) => {
        let out = "", left = count;
        for (const [c, txt] of segs) {
          if (left <= 0) break;
          const part = txt.slice(0, left);
          left -= part.length;
          out += c ? `<span class="${c}">${esc(part)}</span>` : esc(part);
        }
        q(".db-query").innerHTML = `<span class="db-prompt">sql&gt;</span> ${out}<i class="db-caret"></i>`;
      };

      (async () => {
        for (let i = 0; i <= Q.sql.length; i += 2) {
          if (!w.alive) return;
          renderSql(i);
          await sleep(28);
        }
        renderSql(Q.sql.length);
        const spin = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
        for (let i = 0; i < 10; i++) {
          if (!w.alive) return;
          q(".db-foot").textContent = `${spin[i]} Exécution de la requête…`;
          await sleep(70);
        }
        q("thead").innerHTML = `<tr>${Q.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
        const rows = Q.rows();
        for (const row of rows) {
          if (!w.alive) return;
          const tr = document.createElement("tr");
          tr.innerHTML = row.map((v) => `<td>${esc(v)}</td>`).join("");
          q("tbody").appendChild(tr);
          api.sound.tone(1500, 0.03, { vol: 0.02 });
          await sleep(130);
        }
        q(".db-foot").innerHTML = `<b>${rows.length} lignes</b> · 0,0${randInt(10, 99)} s · ${pick(["copie envoyée à ÉCHO", "aucune trace laissée", "Kane n'a rien vu"])}`;
        w.el.classList.add("done");
        if (opts.auto) setTimeout(() => w.close(), 2500);
      })();
      return w;
    },
  });

  // ----- 6. Cassage de mot de passe -----
  EFFECTS.push({
    id: "password", digit: 6, icon: "key", name: "Mot de passe", short: "Mot de passe",
    run(api, opts = {}) {
      const pw = pick(PASSWORDS);
      const w = api.createWindow({
        title: "ÉCHO CASSE UN MOT DE PASSE", icon: "key", width: 430, cls: "win-pw",
        html: `
          <div class="pw-target"><span>CIBLE</span><b>${esc(pick([`${mail(mechant())}@consortium.local`, "kane@division-zero.local", `${mail(mechant())}@consortium.local`]))}</b></div>
          <div class="pw-slots">${[...pw].map(() => `<span class="pw-slot">?</span>`).join("")}</div>
          <div class="pw-stats">
            <div><span>TENTATIVES</span><b class="pw-tries">0</b></div>
            <div><span>VITESSE</span><b class="pw-rate">0 H/s</b></div>
            <div><span>MÉTHODE</span><b>${pick(["Force brute", "Dictionnaire", "Table arc-en-ciel"])}</b></div>
          </div>
          <div class="pw-hash">sha256 : <span>${hex(32)}…</span></div>
          <div class="pw-result">Recherche en cours…</div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const slots = [...w.body.querySelectorAll(".pw-slot")];
      const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*?";
      const order = shuffle(slots.map((_, i) => i));
      const lockAt = [];
      order.forEach((idx, k) => (lockAt[idx] = 0.9 + k * rand(0.22, 0.36)));
      const locked = slots.map(() => false);
      let tries = 0, last = 0, done = false;

      animate(w, 25, (t) => {
        const dt = t - last;
        last = t;
        slots.forEach((s, i) => {
          if (locked[i]) return;
          if (t >= lockAt[i]) {
            locked[i] = true;
            s.textContent = pw[i];
            s.classList.add("locked");
            api.sound.tone(700 + i * 70, 0.05);
          } else {
            s.textContent = CHARSET[randInt(0, CHARSET.length - 1)];
          }
        });
        const rate = 2e5 * Math.pow(1.9, t);
        tries += rate * dt;
        q(".pw-tries").textContent = fr(tries);
        q(".pw-rate").textContent = rate > 1e6 ? `${(rate / 1e6).toFixed(1).replace(".", ",")} MH/s` : `${fr(rate / 1e3)} kH/s`;
        if (!done && locked.every(Boolean)) {
          done = true;
          const res = q(".pw-result");
          res.textContent = "✓ MOT DE PASSE TROUVÉ";
          res.classList.add("ok");
          w.el.classList.add("done");
          api.speak("Mot de passe trouvé.");
          api.sound.tone(988, 0.1);
          api.sound.tone(1319, 0.18, { when: 0.1 });
          if (opts.auto) setTimeout(() => w.close(), 2500);
        }
      });
      return w;
    },
  });

  // ----- 7. Balayage satellite (radar) -----
  EFFECTS.push({
    id: "radar", digit: 7, icon: "radar", name: "Satellite", short: "Satellite",
    run(api, opts = {}) {
      const S = 200, C = S / 2, R = C - 6;
      const w = api.createWindow({
        title: "SATELLITES ESPIONS DE LA DIVISION ZÉRO", icon: "radar", width: 430, cls: "win-radar",
        html: `
          <div class="radar-wrap">
            <canvas class="radar-canvas"></canvas>
            <div class="radar-side">
              <div class="radar-count">OBJETS DÉTECTÉS : <b>0</b></div>
              <ul class="radar-list"></ul>
            </div>
          </div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const ctx = setupCanvas(q(".radar-canvas"), S, S);
      const col = api.colors();
      const names = shuffle(["ORION-7", "VEGA-2", "ATLAS-9", "HÉLIOS-4", "TITAN-1", "LYRA-5", "NOVA-3", "SIRIUS-8", "ZÉPHYR-6"]);
      const blips = Array.from({ length: 7 }, (_, i) => ({ a: rand(0, Math.PI * 2), d: rand(0.2, 0.92), glow: 0, seen: false, name: names[i] }));
      let found = 0;

      animate(w, 30, (t) => {
        const sweep = (t * 1.7) % (Math.PI * 2);
        ctx.clearRect(0, 0, S, S);
        ctx.fillStyle = rgba(col.fg, 0.04);
        ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(col.fg, 0.25);
        for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(C, C, (R * k) / 4, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(C - R, C); ctx.lineTo(C + R, C); ctx.moveTo(C, C - R); ctx.lineTo(C, C + R); ctx.stroke();

        for (let k = 0; k < 26; k++) {
          ctx.fillStyle = rgba(col.fg, 0.28 * (1 - k / 26));
          ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R, sweep - (k + 1) * 0.03, sweep - k * 0.03); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = col.fg;
        ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(C + Math.cos(sweep) * R, C + Math.sin(sweep) * R); ctx.stroke();

        for (const b of blips) {
          const diff = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
          if (diff < 0.12) {
            b.glow = 1;
            if (!b.seen) {
              b.seen = true;
              found++;
              q(".radar-count b").textContent = found;
              const li = document.createElement("li");
              const az = Math.round(((b.a * 180) / Math.PI + 90) % 360);
              li.innerHTML = `<b>SAT-${esc(b.name)}</b><span>${fr(380 + b.d * 900)} km · AZ ${pad(az, 3)}°</span>`;
              q(".radar-list").appendChild(li);
              api.sound.tone(1250, 0.06, { type: "sine", vol: 0.04 });
            }
          }
          b.glow *= 0.965;
          const bx = C + Math.cos(b.a) * b.d * R, by = C + Math.sin(b.a) * b.d * R;
          const a = b.seen ? Math.max(0.15, b.glow) : b.glow;
          ctx.fillStyle = rgba(col.fg2, a);
          ctx.beginPath(); ctx.arc(bx, by, 3 + b.glow * 2, 0, Math.PI * 2); ctx.fill();
          if (b.glow > 0.2) {
            ctx.strokeStyle = rgba(col.fg2, b.glow * 0.5);
            ctx.beginPath(); ctx.arc(bx, by, 8 + (1 - b.glow) * 10, 0, Math.PI * 2); ctx.stroke();
          }
        }
        if (found === blips.length && !w.el.classList.contains("done")) w.el.classList.add("done");
      });

      if (opts.auto) setTimeout(() => w.close(), 7000);
      return w;
    },
  });

  // ----- 8. Lancement de l'ogive du Consortium -----
  EFFECTS.push({
    id: "countdown", digit: 8, icon: "timer", name: "Ogive du Consortium", short: "Ogive",
    run(api) {
      const arme = pick(LORE.BOMBES).toUpperCase();
      const h = api.fullscreen(`
        <div class="countdown">
          <div class="cd-warn">${icon("alert")} ${esc(mechant().toUpperCase())} A LANCÉ LA FIN DU MONDE</div>
          <div class="glitch cd-label" data-text="${esc(arme)}">${esc(arme)}</div>
          <div class="cd-ring">
            <svg viewBox="0 0 220 220"><circle class="cd-track" cx="110" cy="110" r="100"/><circle class="cd-prog" cx="110" cy="110" r="100"/></svg>
            <div class="cd-num">10</div>
          </div>
          <button class="btn cd-cancel" type="button">DÉSAMORCER <kbd>Échap</kbd></button>
        </div>`, { cls: "fx-countdown", interactive: true });
      const num = h.el.querySelector(".cd-num");
      const prog = h.el.querySelector(".cd-prog");
      const CIRC = 2 * Math.PI * 100;
      prog.style.strokeDasharray = CIRC;
      let alarmOn = true;
      const stopAlarm = () => {
        if (alarmOn) { alarmOn = false; api.alarm(false); }
      };
      api.alarm(true);
      h.onClose(stopAlarm);
      h.el.querySelector(".cd-cancel").addEventListener("click", () => {
        h.close();
        api.toast("Ogive désamorcée : le monde est sauvé !", "shield");
        api.speak("Ogive désamorcée. Le monde est sauvé.");
        api.achieve("cool");
        api.event?.("disarm");
      });
      api.speak("Alerte. Le Consortium a lancé la fin du monde.");

      let n = 10;
      const tick = () => {
        if (!h.alive) return;
        num.textContent = n;
        prog.style.strokeDashoffset = CIRC * (1 - n / 10);
        num.classList.remove("pop");
        void num.offsetWidth;
        num.classList.add("pop");
        if (n === 0) return explode();
        api.sound.tone(n <= 3 ? 1400 : 880, 0.12);
        n--;
        setTimeout(tick, 1000);
      };
      const explode = () => {
        stopAlarm();
        api.flash("#ffffff");
        api.sound.boom();
        api.shake(900);
        api.crash(1300);
        api.achieve("boom");
        h.el.innerHTML = `<div class="boom"><div class="boom-title">💥 BOOM !</div><div class="boom-sub">… ÉCHO avait remplacé l'ogive par un feu d'artifice. 🎆 Le monde va bien.</div></div>`;
        setTimeout(() => h.close(), 3200);
      };
      tick();
      return h;
    },
  });

  // ----- 9. Réseau mondial -----
  EFFECTS.push({
    id: "network", digit: 9, icon: "globe", name: "Réseau mondial", short: "Réseau",
    run(api, opts = {}) {
      const W = 460, H = 220;
      const w = api.createWindow({
        title: "ÉCHO SE RÉPAND SUR LE RÉSEAU", icon: "globe", width: 490, cls: "win-map",
        html: `
          <div class="map-wrap"><canvas class="map-canvas"></canvas><div class="map-status">ÉCHO SE CONNECTE AUX NOEUDS…</div></div>
          <div class="geo-grid">
            <div><span>NOEUDS</span><b class="net-nodes">0/8</b></div>
            <div><span>PAQUETS</span><b class="net-packets">0</b></div>
            <div><span>DÉBIT</span><b class="net-rate">0 Gb/s</b></div>
            <div><span>CHIFFREMENT</span><b>AES-256</b></div>
          </div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const col = api.colors();
      const ctx = setupCanvas(q(".map-canvas"), W, H);
      const layer = mapLayer(W, H, 5, col, 0.3);

      const [hq, ...others] = [CITIES[0], ...shuffle(CITIES.slice(1)).slice(0, 7)];
      const nodes = [hq, ...others].map(([name, lon, lat], i) => {
        const [x, y] = project(lon, lat, W, H);
        return { name: i === 0 ? "ÉCHO" : name, x, y, appear: i === 0 ? 0 : 0.3 + i * 0.4, phase: Math.random() * 12 };
      });
      const edges = [];
      nodes.slice(1).forEach((n) => edges.push({ a: nodes[0], b: n, appear: n.appear }));
      for (let i = 0; i < 4; i++) {
        const a = pick(nodes.slice(1)), b = pick(nodes.slice(1));
        if (a !== b) edges.push({ a, b, appear: Math.max(a.appear, b.appear) + 0.3 });
      }
      for (const e of edges) {
        const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
        const dist = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
        e.cx = mx;
        e.cy = my - dist * 0.3;
        e.packets = Array.from({ length: randInt(1, 2) }, () => ({ t: Math.random(), v: rand(0.006, 0.014) }));
      }
      const bez = (e, t) => [
        (1 - t) ** 2 * e.a.x + 2 * (1 - t) * t * e.cx + t * t * e.b.x,
        (1 - t) ** 2 * e.a.y + 2 * (1 - t) * t * e.cy + t * t * e.b.y,
      ];
      let packets = 0, done = false;

      animate(w, 30, (t) => {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(layer, 0, 0, W, H);

        let grown = 0;
        for (const e of edges) {
          if (t < e.appear) continue;
          const g = Math.min(1, (t - e.appear) / 0.6);
          if (g === 1) grown++;
          ctx.strokeStyle = rgba(col.fg2, 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let k = 0; k <= 24; k++) {
            const [x, y] = bez(e, (k / 24) * g);
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          if (g === 1) {
            for (const p of e.packets) {
              p.t = (p.t + p.v) % 1;
              const [x, y] = bez(e, p.t);
              ctx.fillStyle = rgba(col.fg2, 0.25);
              ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
            }
          }
        }

        let active = 0;
        ctx.font = "9px 'JetBrains Mono', monospace";
        for (const n of nodes) {
          if (t < n.appear) continue;
          active++;
          const isHq = n.name === "ÉCHO";
          const c = isHq ? col.danger : col.fg;
          const rr = (t * 14 + n.phase) % 14;
          ctx.strokeStyle = rgba(c, Math.max(0, 1 - rr / 14));
          ctx.beginPath(); ctx.arc(n.x, n.y, 3 + rr, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(n.x, n.y, isHq ? 4 : 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(c, 0.9);
          ctx.fillText(n.name, n.x + 6, n.y - 6);
        }

        packets += grown * randInt(8, 30);
        q(".net-nodes").textContent = `${active}/${nodes.length}`;
        q(".net-packets").textContent = fr(packets);
        q(".net-rate").textContent = `${(grown * 0.12 + Math.random() * 0.2).toFixed(2).replace(".", ",")} Gb/s`;

        if (!done && grown === edges.length) {
          done = true;
          const st = q(".map-status");
          st.textContent = "● ÉCHO EST PARTOUT";
          st.classList.add("ok");
          w.el.classList.add("done");
          api.sound.tone(1046, 0.15);
          api.speak("Écho est connectée au réseau mondial.");
        }
      });

      if (opts.auto) setTimeout(() => w.close(), 7000);
      return w;
    },
  });

  // ----- 0. Mode fantôme -----
  EFFECTS.push({
    id: "ghost", digit: 0, icon: "ghost", name: "Mode fantôme", short: "Fantôme",
    run(api) {
      const h = api.fullscreen(`
        <div class="ghost">
          <div class="ghost-ic">${icon("ghost")}</div>
          <div class="glitch ghost-title" data-text="MODE FANTÔME">MODE FANTÔME</div>
          <div class="ghost-sub">ÉCHO efface tes traces · La Division Zéro est aveugle · ${randInt(9, 24)} proxys actifs</div>
        </div>`, { cls: "fx-ghost", duration: 4200 });
      document.body.classList.add("ghosting");
      h.onClose(() => document.body.classList.remove("ghosting"));
      api.speak("Mode fantôme activé.");
      for (let i = 0; i < 6; i++) setTimeout(() => h.alive && api.sound.noise(0.07, { vol: 0.05 }), i * 170 + rand(0, 90));
      return h;
    },
  });

  // ----- Téléchargement (F2) -----
  EFFECTS.push({
    id: "download", key: "F2", icon: "download", name: "Téléchargement", short: "Télécharg.",
    run(api) {
      const [title, file] = pick([
        ["VOL DES PLANS DU CONSORTIUM", "plans_fin_du_monde.zip"],
        ["COPIE DU NOYAU D'ÉCHO", "noyau_echo.bin"],
        ["VOL DES CODES DE LANCEMENT", "codes_lancement.txt"],
        ["PIRATAGE DU DOSSIER DE KANE", "dossier_kane.pdf"],
        ["EFFACEMENT DES TRACES", "journaux_division_zero.log"],
        ["SABOTAGE DE L'OGIVE", `${mail(pick(LORE.BOMBES)).replace(/\./g, "_")}.cfg`],
      ]);
      const sizeMb = randInt(300, 4800);
      const w = api.createWindow({
        title, icon: "download", width: 380, cls: "win-dl",
        html: `
          <div class="dl-file"><span>${esc(file)}</span><span class="dl-size">${fmtSize(sizeMb)}</span></div>
          <div class="dl-log"></div>
          <div class="bar"><i></i></div>
          <div class="dl-meta"><span class="dl-speed">0 Mo/s</span><span class="dl-eta">--</span><b class="dl-pct">0%</b></div>`,
      });
      const q = (s) => w.body.querySelector(s);
      const LOG = ["handshake 0x{h}… ok", "proxy #{n} contourné", "clé partielle : {h}{h}", "paquet {n}/4096 reçu", "rebond via le noeud {n}", "checksum {h} validé", "port {n} ouvert", "tunnel chiffré actif"];
      const line = () => pick(LOG).replace(/\{h\}/g, () => hex(4)).replace(/\{n\}/g, () => randInt(100, 9999));
      let progress = 0;

      const timer = setInterval(() => {
        if (!w.alive) return clearInterval(timer);
        const step = rand(1, 6.5);
        progress = Math.min(100, progress + step);
        const speed = (step / 100) * sizeMb * 9;
        q(".bar i").style.width = progress + "%";
        q(".dl-pct").textContent = Math.floor(progress) + "%";
        q(".dl-speed").textContent = `${fr(speed)} Mo/s`;
        q(".dl-eta").textContent = `reste ${Math.max(0, Math.ceil(((100 - progress) / 3.75) * 0.11))} s`;
        if (Math.random() < 0.55) {
          const l = document.createElement("div");
          l.textContent = "> " + line();
          q(".dl-log").appendChild(l);
          while (q(".dl-log").children.length > 3) q(".dl-log").firstElementChild.remove();
        }
        if (progress >= 100) {
          clearInterval(timer);
          q(".dl-pct").textContent = "TERMINÉ ✓";
          q(".dl-eta").textContent = "";
          w.el.classList.add("done");
          api.sound.tone(880, 0.12);
          setTimeout(() => w.close(), 2000);
        }
      }, 110);
      return w;
    },
  });

  window.HT_EFFECTS = EFFECTS;
  window.HT_MAP = { worldDots, project, mapLayer, CITIES };
})();
