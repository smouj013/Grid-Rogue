/* sw.js — Grid Runner PWA (v0.0.3)
   - App shell precache + navegación offline (index)
   - Stale-while-revalidate para assets
*/
const VERSION = "v0.0.3";
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
