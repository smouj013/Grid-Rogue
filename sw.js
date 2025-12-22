/* sw.js — Grid Runner PWA (v1.0.0)
   - App shell cache + navegación offline devolviendo index.html
   - Stale-while-revalidate para assets
*/
const VERSION = "v1.0.0";
const CACHE_PREFIX = "grid-runner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS);
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

// Offline navigation fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigations: return index.html for SPA-like navigation
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const cached = await cache.match("./index.html");
      try {
        const net = await fetch(req);
        // Optionally update index in cache
        cache.put("./index.html", net.clone());
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
      cache.put(req, net.clone());
      return net;
    }).catch(() => null);

    return cached || (await fetchPromise) || Response.error();
  })());
});
