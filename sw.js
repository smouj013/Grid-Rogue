/* sw.js — Grid Runner (v0.1.1) [FIXED]
   ✅ Core assets: cache-first desde CORE_CACHE (evita “botones rotos” por JS viejo)
   ✅ Navegación: network-first + fallback index.html (offline)
   ✅ Runtime: stale-while-revalidate
   ✅ Update: SKIP_WAITING por mensaje + clients.claim
   ✅ GitHub Pages/subcarpetas: URLs basadas en registration.scope
*/

const VERSION = "v0.1.1";
const CACHE_PREFIX = "gridrunner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

// Importante para GH Pages (repo en subcarpeta): la scope es la base real de la app
const SCOPE = self.registration.scope;

// App shell (siempre index.html dentro del scope)
const APP_SHELL = new URL("index.html", SCOPE).toString();

// Lista “core” (lo mínimo para que la app funcione)
const CORE_ASSETS = [
  APP_SHELL,
  new URL("styles.css", SCOPE).toString(),
  new URL("app.js", SCOPE).toString(),
  new URL("auth.js", SCOPE).toString(),
  new URL("manifest.webmanifest", SCOPE).toString(),

  // ICONS (tu estructura)
  new URL("assets/icons/icon-192.png", SCOPE).toString(),
  new URL("assets/icons/icon-512.png", SCOPE).toString(),
  new URL("assets/icons/apple-touch-icon-180.png", SCOPE).toString(),
  new URL("assets/icons/favicon-32.png", SCOPE).toString(),
];

// Para detectar rápidamente si una request es “core”
const CORE_SET = new Set(CORE_ASSETS.map((u) => stripSearch(u)));

// --- Helpers ----------------------------------------------------

function stripSearch(inputUrl) {
  const u = new URL(inputUrl);
  u.search = "";
  u.hash = "";
  return u.toString();
}

function isSameOrigin(reqUrl) {
  return new URL(reqUrl).origin === self.location.origin;
}

// Ignorar query SOLO para archivos estáticos típicos (cache-busting ?v=...)
function shouldIgnoreSearch(urlObj) {
  const p = urlObj.pathname.toLowerCase();
  return (
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".png") ||
    p.endsWith(".jpg") ||
    p.endsWith(".jpeg") ||
    p.endsWith(".webp") ||
    p.endsWith(".gif") ||
    p.endsWith(".svg") ||
    p.endsWith(".ico") ||
    p.endsWith(".json") ||
    p.endsWith(".webmanifest") ||
    p.endsWith(".woff2") ||
    p.endsWith(".woff") ||
    p.endsWith(".ttf") ||
    p.endsWith(".otf") ||
    p.endsWith(".map")
  );
}

async function precacheCore() {
  const cache = await caches.open(CORE_CACHE);

  // Precache tolerante: no aborta todo si un icono 404
  const results = await Promise.allSettled(
    CORE_ASSETS.map(async (url) => {
      const req = new Request(url, { cache: "reload" });
      const res = await fetch(req);
      if (!res || !res.ok) throw new Error(`Precache failed: ${url} (${res?.status})`);
      await cache.put(stripSearch(url), res);
    })
  );

  // Garantiza que index.html esté sí o sí (si falla, mejor fallar install)
  const indexOk = results[0].status === "fulfilled";
  if (!indexOk) throw new Error("No se pudo precachear index.html (APP_SHELL).");
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((k) => {
      if (!k.startsWith(CACHE_PREFIX)) return;
      if (k === CORE_CACHE || k === RUNTIME_CACHE) return;
      return caches.delete(k);
    })
  );
}

// --- Lifecycle --------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheCore();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches();

      // navigation preload (si existe) acelera navegación mientras el SW arranca
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (_) {}
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "SKIP_WAITING") self.skipWaiting();
});

// --- Fetch strategies -------------------------------------------

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin: no lo tocamos (Google Fonts, etc.)
  if (!isSameOrigin(req.url)) return;

  const accept = (req.headers.get("accept") || "").toLowerCase();
  const isNav =
    req.mode === "navigate" ||
    req.destination === "document" ||
    accept.includes("text/html");

  // Clave normalizada (para ?v=... en estáticos)
  const normalizedKey = shouldIgnoreSearch(url) ? stripSearch(req.url) : req.url;

  // 1) Navegación: network-first + fallback a APP_SHELL
  if (isNav) {
    event.respondWith(
      (async () => {
        const core = await caches.open(CORE_CACHE);

        try {
          // Si navigation preload está activo, úsalo
          const preload = await event.preloadResponse;
          if (preload && preload.ok) {
            core.put(stripSearch(APP_SHELL), preload.clone()).catch(() => {});
            return preload;
          }

          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            // Guardamos siempre el último index.html
            core.put(stripSearch(APP_SHELL), fresh.clone()).catch(() => {});
            return fresh;
          }
          throw new Error("Nav fetch not ok");
        } catch (_) {
          const cached = await core.match(stripSearch(APP_SHELL));
          return (
            cached ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // 2) CORE assets: cache-first desde CORE_CACHE + refresh en background
  //    (Esto evita que se te queden botones rotos por cargar JS/CSS viejo o inexistente)
  const coreKey = stripSearch(req.url);
  const looksCore = CORE_SET.has(coreKey);

  if (looksCore) {
    event.respondWith(
      (async () => {
        const core = await caches.open(CORE_CACHE);
        const cached = await core.match(coreKey);

        const refresh = fetch(req)
          .then((res) => {
            if (res && res.ok) core.put(coreKey, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);

        // Cache-first, pero intentamos refrescar
        return cached || (await refresh) || new Response("", { status: 504 });
      })()
    );
    return;
  }

  // 3) Resto: stale-while-revalidate en RUNTIME_CACHE
  event.respondWith(
    (async () => {
      const runtime = await caches.open(RUNTIME_CACHE);

      const cached = await runtime.match(normalizedKey);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            runtime.put(normalizedKey, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })()
  );
});
