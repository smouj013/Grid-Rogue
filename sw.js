/* sw.js — Grid Runner (v0.1.6)
   ✅ Core cache-first + refresh en background (sin romper cache-bust ?v=)
   ✅ Navegación: network-first + fallback index.html (APP_SHELL)
   ✅ Runtime: stale-while-revalidate (assets)
   ✅ Update: SKIP_WAITING por mensaje + clients.claim + navigationPreload
   ✅ GH Pages/subcarpetas: usa registration.scope (claves absolutas)
   ✅ Audio/Sprites: añadidos a CORE_ASSETS como best-effort (no rompe si falta)
*/

const VERSION = "v0.1.6";
const CACHE_PREFIX = "gridrunner-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

const SCOPE = self.registration.scope;
const APP_SHELL = new URL("index.html", SCOPE).toString();

const CORE_ASSETS = [
  // App shell
  APP_SHELL,
  new URL("styles.css", SCOPE).toString(),
  new URL("app.js", SCOPE).toString(),
  new URL("auth.js", SCOPE).toString(),
  new URL("manifest.webmanifest", SCOPE).toString(),

  // Icons
  new URL("assets/icons/icon-192.png", SCOPE).toString(),
  new URL("assets/icons/icon-512.png", SCOPE).toString(),
  new URL("assets/icons/icon-192-maskable.png", SCOPE).toString(),
  new URL("assets/icons/icon-512-maskable.png", SCOPE).toString(),
  new URL("assets/icons/apple-touch-icon-152.png", SCOPE).toString(),
  new URL("assets/icons/apple-touch-icon-167.png", SCOPE).toString(),
  new URL("assets/icons/apple-touch-icon-180.png", SCOPE).toString(),
  new URL("assets/icons/favicon-32.png", SCOPE).toString(),

  // ✅ Audio (best-effort)
  new URL("assets/audio/bgm_loop.mp3", SCOPE).toString(),
  new URL("assets/audio/music_loop.mp3", SCOPE).toString(),
  new URL("assets/audio/sfx_coin.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_gem.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_bonus.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_trap.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_ko.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_levelup.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_pick.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_reroll.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_ui_click.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_gameover.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_combo.wav", SCOPE).toString(),

  // ✅ Sprites (best-effort)
  new URL("assets/sprites/tile_block.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_bonus.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_coin.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_gem.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_trap.svg", SCOPE).toString(),
];

const CORE_SET = new Set(CORE_ASSETS.map(stripSearch));

function stripSearch(inputUrl) {
  const u = new URL(inputUrl);
  u.search = "";
  u.hash = "";
  return u.toString();
}

function isSameOrigin(reqUrl) {
  return new URL(reqUrl).origin === self.location.origin;
}

function isHtmlNavigation(req) {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return req.mode === "navigate" || req.destination === "document" || accept.includes("text/html");
}

function shouldIgnoreSearch(urlObj) {
  const p = urlObj.pathname.toLowerCase();
  return (
    p.endsWith(".js") || p.endsWith(".css") ||
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".svg") ||
    p.endsWith(".ico") || p.endsWith(".json") || p.endsWith(".webmanifest") ||
    p.endsWith(".woff2") || p.endsWith(".woff") || p.endsWith(".ttf") || p.endsWith(".otf") ||
    p.endsWith(".mp3") || p.endsWith(".wav") || p.endsWith(".ogg")
  );
}

async function precacheCore() {
  const cache = await caches.open(CORE_CACHE);

  // 1) APP_SHELL (obligatorio)
  const shellRes = await fetch(new Request(APP_SHELL, { cache: "reload" }));
  if (!shellRes || !shellRes.ok) {
    throw new Error(`No se pudo precachear index.html (APP_SHELL). (${shellRes?.status || "?"})`);
  }
  await cache.put(stripSearch(APP_SHELL), shellRes);

  // 2) resto best-effort
  await Promise.allSettled(
    CORE_ASSETS
      .filter((u) => stripSearch(u) !== stripSearch(APP_SHELL))
      .map(async (url) => {
        try {
          const res = await fetch(new Request(url, { cache: "reload" }));
          if (!res || !res.ok) throw new Error(`Precache failed: ${url} (${res?.status})`);
          await cache.put(stripSearch(url), res);
        } catch (_) {}
      })
  );
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((k) => {
      if (!k.startsWith(CACHE_PREFIX)) return null;
      if (k === CORE_CACHE || k === RUNTIME_CACHE) return null;
      return caches.delete(k);
    })
  );
}

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

      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (_) {}
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!isSameOrigin(req.url)) return;

  const url = new URL(req.url);
  const isNav = isHtmlNavigation(req);

  // normaliza clave cuando hay cache-bust ?v=
  const normalizedKey = shouldIgnoreSearch(url) ? stripSearch(req.url) : req.url;
  const looksCore = CORE_SET.has(stripSearch(req.url));

  // ───────────── Navegación: network-first + fallback shell ─────────────
  if (isNav) {
    event.respondWith(
      (async () => {
        const core = await caches.open(CORE_CACHE);

        try {
          const preload = await event.preloadResponse;
          if (preload && preload.ok) {
            core.put(stripSearch(APP_SHELL), preload.clone()).catch(() => {});
            return preload;
          }

          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
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

  // ───────────── Core: cache-first + refresh en background ─────────────
  if (looksCore) {
    event.respondWith(
      (async () => {
        const core = await caches.open(CORE_CACHE);
        const key = stripSearch(req.url);

        const cached = await core.match(key);

        const refresh = fetch(req)
          .then((res) => {
            if (res && res.ok) core.put(key, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);

        // Devuelve cached rápido, pero refresca si puede
        return cached || (await refresh) || new Response("", { status: 504 });
      })()
    );
    return;
  }

  // ───────────── Runtime: stale-while-revalidate ─────────────
  event.respondWith(
    (async () => {
      const runtime = await caches.open(RUNTIME_CACHE);
      const cached = await runtime.match(normalizedKey);

      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) runtime.put(normalizedKey, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise || new Response("", { status: 504 });
    })()
  );
});
