/* sw.js — Grid Runner PWA v0.1.0
   - App Shell precache
   - Navegación offline -> index.html
   - Assets -> stale-while-revalidate
   - Update -> SKIP_WAITING por mensaje
*/

const VERSION = "0.1.0";
const CACHE_PREFIX = "grid-runner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}rt-${VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS.map(p => new URL(p, self.location).toString()));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith(CACHE_PREFIX) && ![CORE_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // solo same-origin
  if (url.origin !== self.location.origin) return;

  // navegación: siempre index offline
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try{
        const res = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone()).catch(()=>{});
        return res;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        const cached = await cache.match(new URL("./index.html", self.location).toString());
        return cached || new Response("Offline", { status: 200, headers: { "content-type":"text/plain" } });
      }
    })());
    return;
  }

  // assets: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(()=>{});
      return res;
    }).catch(() => cached);

    return cached || fetchPromise;
  })());
});
