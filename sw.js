// Service worker : permet d'installer Ghost Terminal et de l'utiliser hors ligne.
// Stratégie "réseau d'abord" : toujours la dernière version en ligne, la copie en cache sinon.
const CACHE = "ghost-terminal-v8";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "security.js",
  "icons.js",
  "filtre.js",
  "mots.js",
  "snippets.js",
  "highlight.js",
  "effects.js",
  "story.js",
  "survie.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // « no-cache » : on revérifie toujours auprès du serveur, pour ne jamais mélanger
    // une page récente avec un ancien script gardé dans le cache du navigateur
    const fresh = req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" });
    e.respondWith(
      fetch(fresh)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
