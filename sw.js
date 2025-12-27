/* sw.js — Grid Rogue v1.0.0
   - Cache versioned
   - Message API:
     - {type:"SKIP_WAITING"}
     - {type:"CLEAR_ALL_CACHES"}
     - {type:"GET_VERSION"} -> replies {type:"SW_VERSION", version}
   - Notifies activation: {type:"SW_ACTIVATED", version}
*/
(() => {
  "use strict";

  const url = new URL(self.location.href);
  const VERSION = url.searchParams.get("v") || "1.0.0";
  const CACHE = `gridrogue-cache-${VERSION}`;
  const RUNTIME = `gridrogue-runtime-${VERSION}`;

  const APP_SHELL = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./utils.js",
    "./audio.js",
    "./localization.js",
    "./auth.js",
    "./manifest.webmanifest",
    "./assets/icons/favicon-32.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/icon-192-maskable.png",
    "./assets/icons/icon-512-maskable.png",
    "./assets/icons/apple-touch-icon-180.png",
    "./assets/sprites/tile_block.svg",
    "./assets/sprites/tile_bonus.svg",
    "./assets/sprites/tile_coin.svg",
    "./assets/sprites/tile_gem.svg",
    "./assets/sprites/tile_trap.svg",
    "./assets/audio/bgm_loop.mp3",
    "./assets/audio/music_loop.mp3",
    "./assets/audio/sfx_ui_click.wav",
    "./assets/audio/sfx_coin.wav",
    "./assets/audio/sfx_gem.wav",
    "./assets/audio/sfx_bonus.wav",
    "./assets/audio/sfx_trap.wav",
    "./assets/audio/sfx_ko.wav",
    "./assets/audio/sfx_gameover.wav",
    "./assets/audio/sfx_levelup.wav",
    "./assets/audio/sfx_pick.wav",
    "./assets/audio/sfx_reroll.wav"
  ];

  function stripSearch(reqUrl) {
    try {
      const u = new URL(reqUrl, self.location.origin);
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch {
      return reqUrl;
    }
  }

  async function postToAll(msg) {
    const clientsAll = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsAll) {
      try { c.postMessage(msg); } catch {}
    }
  }

  self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      // Cachea usando URLs sin query para evitar duplicados por ?v=
      await cache.addAll(APP_SHELL.map(p => stripSearch(p)));
      await self.skipWaiting();
    })());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => {
        if (k !== CACHE && k !== RUNTIME && k.startsWith("gridrogue-")) return caches.delete(k);
      }));
      await self.clients.claim();
      await postToAll({ type: "SW_ACTIVATED", version: VERSION });
    })());
  });

  self.addEventListener("message", (event) => {
    const d = event.data || null;
    if (!d || !d.type) return;

    if (d.type === "SKIP_WAITING") {
      self.skipWaiting();
      return;
    }

    if (d.type === "CLEAR_ALL_CACHES") {
      event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        await postToAll({ type: "SW_CLEARED" });
      })());
      return;
    }

    if (d.type === "GET_VERSION") {
      try { event.source?.postMessage?.({ type: "SW_VERSION", version: VERSION }); } catch {}
      return;
    }
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);

    // Solo mismo origen
    if (url.origin !== self.location.origin) return;

    const isNav = req.mode === "navigate" || (req.destination === "document");

    event.respondWith((async () => {
      // Navegación: app-shell offline-first
      if (isNav) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match("./index.html", { ignoreSearch: true });
        try {
          const net = await fetch(req);
          // Actualiza index en cache
          cache.put("./index.html", net.clone());
          return net;
        } catch {
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      }

      // Assets: cache-first + revalidate
      const cacheKey = stripSearch(req.url);
      const cache = await caches.open(CACHE);
      const hit = await cache.match(cacheKey, { ignoreSearch: true });
      if (hit) {
        event.waitUntil((async () => {
          try {
            const net = await fetch(req);
            if (net && net.ok) await cache.put(cacheKey, net.clone());
          } catch {}
        })());
        return hit;
      }

      try {
        const net = await fetch(req);
        if (net && net.ok) await cache.put(cacheKey, net.clone());
        return net;
      } catch {
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
  });
})();
