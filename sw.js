/* sw.js — Grid Runner (v0.1.1)
   - App Shell precache
   - Offline navegación: devuelve index.html
   - Assets same-origin: stale-while-revalidate
   - Update: SKIP_WAITING por mensaje + clients.claim
*/

const VERSION = "v0.1.1";
const CACHE_PREFIX = "gridrunner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

const APP_SHELL = new URL("./index.html", self.location).toString();

const CORE_ASSETS = [
  APP_SHELL,
  new URL("./styles.css", self.location).toString(),
  new URL("./app.js", self.location).toString(),
  new URL("./auth.js", self.location).toString(),
  new URL("./manifest.webmanifest", self.location).toString(),
  new URL("./assets/icon-192.png", self.location).toString(),
  new URL("./assets/icon-512.png", self.location).toString(),
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k.startsWith(CACHE_PREFIX) && k !== CORE_CACHE && k !== RUNTIME_CACHE){
        return caches.delete(k);
      }
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo same-origin
  if (url.origin !== self.location.origin) return;

  // Navegación: fallback a APP_SHELL
  const isNav = (req.mode === "navigate") ||
    (req.destination === "document") ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNav){
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const cached = await cache.match(APP_SHELL);
      try{
        const fresh = await fetch(req);
        if (fresh && fresh.ok){
          cache.put(APP_SHELL, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Assets: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok){
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => cached);

    return cached || fetchPromise;
  })());
});
