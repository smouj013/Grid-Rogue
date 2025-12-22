/* sw.js — Grid Runner PWA (v0.0.9)
   - App shell precache + navegación offline (index)
   - Stale-while-revalidate para assets
   - Mensaje SKIP_WAITING para auto-actualizar
*/
const VERSION = "v0.0.9";
const CACHE_PREFIX = "grid-runner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",

  // icons (si faltan, no rompe)
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/apple-touch-icon-167.png",
  "./assets/icons/apple-touch-icon-152.png",
  "./assets/icons/favicon-32.png",

  // sprites opcionales
  "./assets/sprites/player.svg",
  "./assets/sprites/tile_empty.svg",
  "./assets/sprites/tile_block.svg",
  "./assets/sprites/tile_coin.svg",
  "./assets/sprites/tile_gem.svg",
  "./assets/sprites/tile_trap.svg",
  "./assets/sprites/tile_bonus.svg",
];

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(async (u) => {
      try {
        const res = await fetch(u, { cache: "no-cache" });
        if (res.ok) await cache.put(u, res);
      } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith(CACHE_PREFIX) && k !== CORE_CACHE && k !== RUNTIME_CACHE) {
        return caches.delete(k);
      }
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Navegación: fallback a index.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const cached = await cache.match("./index.html");
      try {
        const net = await fetch(req);
        if (net && net.ok) cache.put("./index.html", net.clone());
        return net;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Assets: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);

    const fetchPromise = fetch(req).then((net) => {
      if (net && net.ok) cache.put(req, net.clone());
      return net;
    }).catch(() => null);

    return cached || (await fetchPromise) || Response.error();
  })());
});
