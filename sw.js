/* sw.js — Grid Rogue (v1.0.0) — STABLE (FIX updates)
   ✅ GH Pages / subcarpetas (scope estable)
   ✅ Precache core (index.html obligatorio + resto best-effort)
   ✅ Navegación offline -> APP_SHELL
   ✅ Core/runtime: stale-while-revalidate (claves normalizadas sin query)
   ✅ Audio Range (206) desde 200 (slice) para iOS/Android
   ✅ Limpieza agresiva de caches antiguos (gridrunner/gridrogue)
   ✅ Update “atómico”: al activar nueva versión, si hay red, recarga clientes (evita mix de versiones)
   ✅ Mensajes: SKIP_WAITING / CLEAR_ALL_CACHES / GET_VERSION
*/
"use strict";

const VERSION = "v1.0.0";

const CACHE_PREFIX = "gridrogue-";
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;

// Borra builds antiguos (incluye proyecto viejo gridrunner- si existía)
const OLD_PREFIXES = ["gridrunner-", "gridrogue-"];

// GH Pages / subcarpetas: scope absoluto (clave estable)
const SCOPE = self.registration.scope;
const APP_SHELL = new URL("index.html", SCOPE).toString();

// Core assets (sin query, porque stripSearch normaliza)
// IMPORTANTE: index.html es obligatorio; el resto es best-effort.
const CORE_ASSETS = [
  // App shell
  APP_SHELL,
  new URL("styles.css", SCOPE).toString(),

  // Main
  new URL("app.js", SCOPE).toString(),

  // Opcionales (best-effort)
  new URL("utils.js", SCOPE).toString(),
  new URL("localization.js", SCOPE).toString(),
  new URL("audio_sys.js", SCOPE).toString(),
  new URL("audio.js", SCOPE).toString(),
  new URL("auth.js", SCOPE).toString(),
  new URL("rendiment.js", SCOPE).toString(),

  // Manifest
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

  // Audio (best-effort)
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
  new URL("assets/audio/sfx_block.wav", SCOPE).toString(),
  new URL("assets/audio/sfx_upgrade.wav", SCOPE).toString(),

  // Sprites (best-effort)
  new URL("assets/sprites/tile_block.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_bonus.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_coin.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_gem.svg", SCOPE).toString(),
  new URL("assets/sprites/tile_trap.svg", SCOPE).toString(),
];

function stripSearch(inputUrl) {
  const u = new URL(inputUrl, self.location.href);
  u.search = "";
  u.hash = "";
  return u.toString();
}

const CORE_SET = new Set(CORE_ASSETS.map(stripSearch));
const META_KEY = stripSearch(new URL("__sw_meta__.json", SCOPE).toString());

function isSameOrigin(reqUrl) {
  return new URL(reqUrl, self.location.href).origin === self.location.origin;
}

function isHtmlNavigation(req) {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return req.mode === "navigate" || req.destination === "document" || accept.includes("text/html");
}

function shouldIgnoreSearch(urlObj) {
  const p = (urlObj.pathname || "").toLowerCase();
  return (
    p.endsWith(".js") || p.endsWith(".css") ||
    p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") ||
    p.endsWith(".webp") || p.endsWith(".gif") || p.endsWith(".svg") ||
    p.endsWith(".ico") || p.endsWith(".json") || p.endsWith(".webmanifest") ||
    p.endsWith(".woff2") || p.endsWith(".woff") || p.endsWith(".ttf") || p.endsWith(".otf") ||
    p.endsWith(".mp3") || p.endsWith(".wav") || p.endsWith(".ogg")
  );
}

function isAudioPath(urlObj) {
  const p = (urlObj.pathname || "").toLowerCase();
  return p.endsWith(".mp3") || p.endsWith(".wav") || p.endsWith(".ogg");
}

function canCacheResponse(res) {
  if (!res) return false;
  if (!res.ok) return false;
  if (res.type === "opaque") return false;
  return true;
}

// ───────────────────────── Range support (audio) ─────────────────────────
function parseRange(rangeHeader, size) {
  const m = String(rangeHeader || "").match(/bytes=(\d*)-(\d*)/i);
  if (!m) return null;

  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : (size - 1);

  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = size - 1;

  if (start < 0) start = 0;
  if (end >= size) end = size - 1;
  if (end < start) return null;

  return { start, end };
}

async function makeRangedResponse(fullResponse, rangeHeader) {
  const buf = await fullResponse.arrayBuffer();
  const size = buf.byteLength;

  const r = parseRange(rangeHeader, size);
  if (!r) return fullResponse;

  const { start, end } = r;
  const sliced = buf.slice(start, end + 1);

  const headers = new Headers(fullResponse.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(sliced.byteLength));

  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }

  return new Response(sliced, { status: 206, statusText: "Partial Content", headers });
}

// ───────────────────────── Helpers ─────────────────────────
async function broadcast(msg) {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try { c.postMessage(msg); } catch (_) {}
    }
  } catch (_) {}
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((k) => {
      const isKnownPrefix = OLD_PREFIXES.some((p) => k.startsWith(p));
      if (!isKnownPrefix) return null;
      if (k === CORE_CACHE || k === RUNTIME_CACHE) return null;
      return caches.delete(k);
    })
  );
}

async function clearAllKnownCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((k) => {
      const isKnownPrefix = OLD_PREFIXES.some((p) => k.startsWith(p));
      if (!isKnownPrefix) return null;
      return caches.delete(k);
    })
  );
}

// ───────────────────────── Core precache ─────────────────────────
async function precacheCore() {
  const cache = await caches.open(CORE_CACHE);

  // index.html obligatorio (si falla, aborta install)
  // IMPORTANTE: cache:"no-store" evita que te devuelva HTML viejo desde caché HTTP del navegador
  const shellReq = new Request(APP_SHELL, { cache: "no-store" });
  const shellRes = await fetch(shellReq);

  if (!shellRes || !shellRes.ok) {
    throw new Error(`No se pudo precachear index.html (APP_SHELL). (${shellRes?.status || "?"})`);
  }

  await cache.put(stripSearch(APP_SHELL), shellRes.clone());

  // meta (útil para debug/diagnóstico)
  try {
    const meta = JSON.stringify({ version: VERSION, scope: SCOPE, ts: Date.now() });
    await cache.put(META_KEY, new Response(meta, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    }));
  } catch (_) {}

  // resto best-effort
  await Promise.allSettled(
    CORE_ASSETS
      .filter((u) => stripSearch(u) !== stripSearch(APP_SHELL))
      .map(async (url) => {
        try {
          const res = await fetch(new Request(url, { cache: "no-store" }));
          if (!canCacheResponse(res)) throw new Error(`Precache failed: ${url} (${res?.status})`);
          await cache.put(stripSearch(url), res.clone());
        } catch (_) {
          // best-effort
        }
      })
  );
}

// ───────────────────────── Lifecycle ─────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheCore();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Limpia TODO lo viejo (incluye runtime antiguo)
    await cleanupOldCaches();

    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }

    await self.clients.claim();

    // Aviso a la app
    broadcast({ type: "SW_ACTIVATED", version: VERSION }).catch(() => {});

    // UPDATE ATÓMICO:
    // si hay red y el shell responde OK, recargamos las pestañas para evitar mezclar JS viejo + HTML nuevo
    // (esto es lo que suele causar “error infinito” tras update).
    try {
      const ok = await fetch(new Request(APP_SHELL, { cache: "no-store" })).then(r => !!(r && r.ok)).catch(() => false);
      if (ok) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clients) {
          try {
            // evita recargar pestañas “raras”
            if (!c.url || c.url.startsWith("about:")) continue;
            await c.navigate(c.url);
          } catch (_) {}
        }
      }
    } catch (_) {}
  })());
});

self.addEventListener("message", (event) => {
  const msg = event.data;

  if (msg && msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (msg && msg.type === "CLEAR_ALL_CACHES") {
    event.waitUntil((async () => {
      await clearAllKnownCaches();
      // recarga clientes si quieres (normalmente usado por “Reparar PWA”)
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clients) { try { await c.navigate(c.url); } catch (_) {} }
      } catch (_) {}
    })());
    return;
  }

  if (msg && msg.type === "GET_VERSION") {
    // responde con la versión del SW
    try { event.source?.postMessage?.({ type: "SW_VERSION", version: VERSION }); } catch (_) {}
  }
});

// ───────────────────────── Fetch strategy ─────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!req || req.method !== "GET") return;
  if (!isSameOrigin(req.url)) return;

  const url = new URL(req.url, self.location.href);
  const isNav = isHtmlNavigation(req);

  // Clave normalizada (evita duplicidades por ?v=...)
  const normalizedKey = shouldIgnoreSearch(url) ? stripSearch(req.url) : req.url;
  const looksCore = CORE_SET.has(stripSearch(req.url)) || stripSearch(req.url) === META_KEY;

  // ── Audio RANGE (iOS/Android) ────────────────────────────────
  if (isAudioPath(url) && req.headers.has("range")) {
    event.respondWith((async () => {
      const key = stripSearch(req.url);

      // 1) intenta cache (core -> runtime)
      const core = await caches.open(CORE_CACHE);
      let cached = await core.match(key);

      if (!cached) {
        const runtime = await caches.open(RUNTIME_CACHE);
        cached = await runtime.match(key);
      }

      if (cached) {
        try {
          return await makeRangedResponse(cached.clone(), req.headers.get("range"));
        } catch (_) {
          return cached;
        }
      }

      // 2) si no hay cache, pedimos COMPLETO (sin Range) y luego cortamos
      try {
        const full = await fetch(new Request(key, { cache: "no-store" }));
        if (!full || !full.ok) return fetch(req);

        // guarda best-effort en runtime (clave sin query)
        try {
          const runtime = await caches.open(RUNTIME_CACHE);
          if (canCacheResponse(full)) runtime.put(key, full.clone()).catch(() => {});
        } catch (_) {}

        return await makeRangedResponse(full, req.headers.get("range"));
      } catch (_) {
        return fetch(req);
      }
    })());
    return;
  }

  // ── Navegación (HTML) -> network-first + fallback a APP_SHELL ──
  if (isNav) {
    event.respondWith((async () => {
      const core = await caches.open(CORE_CACHE);

      try {
        const preload = await event.preloadResponse;
        if (preload && preload.ok) {
          core.put(stripSearch(APP_SHELL), preload.clone()).catch(() => {});
          return preload;
        }

        // IMPORTANTÍSIMO: no-store para evitar HTML viejo del caché HTTP
        const fresh = await fetch(new Request(req.url, { cache: "no-store" }));
        if (fresh && fresh.ok) {
          core.put(stripSearch(APP_SHELL), fresh.clone()).catch(() => {});
          return fresh;
        }

        throw new Error("Nav fetch not ok");
      } catch (_) {
        const cachedShell = await core.match(stripSearch(APP_SHELL));
        return cachedShell || new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  // ── Core assets: stale-while-revalidate (con stripSearch) ──────
  if (looksCore) {
    event.respondWith((async () => {
      const core = await caches.open(CORE_CACHE);
      const key = stripSearch(req.url);

      const cached = await core.match(key);

      // IMPORTANTÍSIMO: no-store para que la revalidación no quede “atrapada” en caché HTTP
      const refresh = fetch(new Request(req.url, { cache: "no-store" }))
        .then((res) => {
          if (canCacheResponse(res)) core.put(key, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);

      return cached || (await refresh) || new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })());
    return;
  }

  // ── Runtime: stale-while-revalidate suave ──────────────────────
  event.respondWith((async () => {
    const runtime = await caches.open(RUNTIME_CACHE);
    const cached = await runtime.match(normalizedKey);

    const refresh = fetch(new Request(req.url, { cache: "no-store" }))
      .then((res) => {
        if (canCacheResponse(res)) runtime.put(normalizedKey, res.clone()).catch(() => {});
        return res;
      })
      .catch(() => null);

    if (cached) {
      refresh.catch(() => {});
      return cached;
    }

    return (await refresh) || new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  })());
});
