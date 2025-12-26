/* sw.js — Grid Rogue v1.0.0 */
const VERSION = "1.0.0";
const CACHE = `gridrogue_cache_${VERSION}`;

const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./utils.js",
  "./auth.js",
  "./manifest.webmanifest",

  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/apple-touch-icon-180.png",

  "./assets/sprites/tile_block.svg",
  "./assets/sprites/tile_bonus.svg",
  "./assets/sprites/tile_coin.svg",
  "./assets/sprites/tile_gem.svg",
  "./assets/sprites/tile_trap.svg",

  "./assets/audio/bgm_loop.mp3",
  "./assets/audio/music_loop.mp3",
  "./assets/audio/sfx_block.wav",
  "./assets/audio/sfx_bonus.wav",
  "./assets/audio/sfx_coin.wav",
  "./assets/audio/sfx_combo.wav",
  "./assets/audio/sfx_gameover.wav",
  "./assets/audio/sfx_gem.wav",
  "./assets/audio/sfx_ko.wav",
  "./assets/audio/sfx_levelup.wav",
  "./assets/audio/sfx_pick.wav",
  "./assets/audio/sfx_reroll.wav",
  "./assets/audio/sfx_trap.wav",
  "./assets/audio/sfx_ui_click.wav",
  "./assets/audio/sfx_upgrade.wav"
];

// opcionales (si existen en tu repo; no rompe si faltan)
const OPTIONAL = [
  "./rendiment.js",
  "./audio.js",
  "./localization.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);

    for (const url of OPTIONAL) {
      try { await cache.add(url); } catch (_) {}
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      try { cache.put(req, res.clone()); } catch (_) {}
      return res;
    } catch (e) {
      const fallback = await caches.match("./index.html", { ignoreSearch: true });
      return fallback || new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
