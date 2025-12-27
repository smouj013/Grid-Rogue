/* sw.js — Grid Rogue v1.1.1 (FIX)
   - SIN DUPLICADOS (esto era tu bug)
   - Cache versioned + claves consistentes
   - Precaching tolerante (no falla si falta un asset)
   - Navegación: network-first + fallback cache
   - Assets: cache-first + revalidate
   - Message API:
     - {type:"SKIP_WAITING"}
     - {type:"CLEAR_ALL_CACHES"}
     - {type:"GET_VERSION"} -> {type:"SW_VERSION", version}
*/
(() => {
  "use strict";

  const url = new URL(self.location.href);
  const VERSION = url.searchParams.get("v") || "1.1.1";
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
    "./skills.js",
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

  const strip = (u) => {
    try {
      const x = new URL(u, self.location.origin);
      x.search = "";
      x.hash = "";
      return x.toString();
    } catch {
      return u;
    }
  };

  async function postToAll(msg) {
    const clientsAll = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsAll) {
      try { c.postMessage(msg); } catch (_) {}
    }
  }

  async function safePrecache(cache) {
    const jobs = APP_SHELL.map(async (p) => {
      const abs = strip(p);
      try {
        const res = await fetch(abs, { cache: "no-cache" });
        if (res && res.ok) await cache.put(abs, res.clone());
      } catch (_) {}
    });
    await Promise.allSettled(jobs);
  }

  self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await safePrecache(cache);
      await self.skipWaiting();
    })());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => {
        if (k.startsWith("gridrogue-") && k !== CACHE && k !== RUNTIME) return caches.delete(k);
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
      try { event.source?.postMessage?.({ type: "SW_VERSION", version: VERSION }); } catch (_) {}
      return;
    }
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (!req || req.method !== "GET") return;

    const u = new URL(req.url);
    if (u.origin !== self.location.origin) return;

    const isNav = (req.mode === "navigate") || (req.destination === "document");

    event.respondWith((async () => {
      // NAV: network-first, fallback cache(index)
      if (isNav) {
        const cache = await caches.open(CACHE);
        try {
          const net = await fetch(req);
          if (net && net.ok) {
            await cache.put(strip("./index.html"), net.clone());
          }
          return net;
        } catch (_) {
          const cached = await cache.match(strip("./index.html"));
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      }

      // ASSETS: cache-first + revalidate
      const key = strip(req.url);
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key);

      if (hit) {
        event.waitUntil((async () => {
          try {
            const net = await fetch(req);
            if (net && net.ok) await cache.put(key, net.clone());
          } catch (_) {}
        })());
        return hit;
      }

      try {
        const net = await fetch(req);
        if (net && net.ok) await cache.put(key, net.clone());
        return net;
      } catch (_) {
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
  });
})();
