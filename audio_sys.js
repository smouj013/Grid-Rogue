/* audio_sys.js — Grid Rogue v1.0.1
   window.AudioSys
   ✅ Compatible con app.js v1.x:
   - unlock(...): acepta args (se ignoran) y NO se “bloquea” si falla una vez (reintenta)
   - sfx(name): WebAudio con WAV + fallback a HTMLAudio + fallback procedural (beeps)
   - Música: HTMLAudio loop + ducking + prime iOS
   - setAllowProceduralMusic(false): por defecto false
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_AUDIOSYS_LOADED_V1010";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.0.1");

  const U = window.GRUtils || window.Utils || {};
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0)));

  const pNow = (() => {
    try { if (typeof performance !== "undefined" && typeof performance.now === "function") return () => performance.now(); } catch {}
    return () => Date.now();
  })();

  const BASE = (() => {
    try { return new URL("./", location.href); } catch (_) { return null; }
  })();

  const urlOf = (rel) => {
    try {
      if (!rel) return "";
      if (/^https?:\/\//i.test(rel)) return rel;
      return new URL(rel, BASE || location.href).toString();
    } catch (_) {
      return String(rel || "");
    }
  };

  // ───────────────────────── Wrapper engine externo ─────────────────────────
  // Si ya hay AudioSys de terceros, lo envolvemos (no lo rompemos).
  // Si hay AudioSys nuestro antiguo (marcado), lo reemplazamos.
  function isOurAudioSys(obj) {
    try { return !!(obj && typeof obj === "object" && obj.__isGridRogueAudioSys); } catch { return false; }
  }

  function pickExternalEngine() {
    const cands = [
      // Si existe AudioSys pero NO es el nuestro, se considera externo
      (window.AudioSys && !isOurAudioSys(window.AudioSys)) ? window.AudioSys : null,
      window.AudioEngine,
      window.AudioManager,
      window.GRAudio,
      window.AudioSystem,
    ].filter(Boolean);

    for (const e of cands) {
      if (!e || typeof e !== "object") continue;

      const hasSfx =
        typeof e.sfx === "function" ||
        typeof e.playSfx === "function" ||
        typeof e.play === "function";

      const hasMusic =
        typeof e.startMusic === "function" ||
        typeof e.playMusic === "function" ||
        typeof e.musicStart === "function";

      if (hasSfx || hasMusic) return e;
    }
    return null;
  }

  const ext = pickExternalEngine();
  if (ext) {
    const api = Object.freeze({
      __isGridRogueAudioSys: true,
      __externalWrapped: true,
      VERSION,
      supports: true,

      unlock: async (..._args) => {
        try {
          if (typeof ext.unlock === "function") return await ext.unlock();
          if (typeof ext.resume === "function") return await ext.resume();
        } catch (_) {}
        return true;
      },

      sfx: async (name) => {
        try {
          if (typeof ext.sfx === "function") return await ext.sfx(name);
          if (typeof ext.playSfx === "function") return await ext.playSfx(name);
          if (typeof ext.play === "function") return await ext.play(name);
        } catch (_) {}
        return false;
      },

      startMusic: async () => {
        try {
          if (typeof ext.startMusic === "function") return await ext.startMusic();
          if (typeof ext.playMusic === "function") return await ext.playMusic();
          if (typeof ext.musicStart === "function") return await ext.musicStart();
        } catch (_) {}
      },

      stopMusic: () => {
        try {
          if (typeof ext.stopMusic === "function") return ext.stopMusic();
          if (typeof ext.musicStop === "function") return ext.musicStop();
          if (typeof ext.stop === "function") return ext.stop();
        } catch (_) {}
      },

      duckMusic: (on) => {
        try {
          if (typeof ext.duckMusic === "function") return ext.duckMusic(on);
          if (typeof ext.duck === "function") return ext.duck(on);
          if (typeof ext.setDuck === "function") return ext.setDuck(on ? 0.35 : 1.0);
        } catch (_) {}
      },

      setMute: (v) => {
        try {
          if (typeof ext.setMute === "function") return ext.setMute(v);
          if (typeof ext.mute === "function") return ext.mute(v);
        } catch (_) {}
      },

      setMusicOn: (v) => {
        try {
          if (typeof ext.setMusicOn === "function") return ext.setMusicOn(v);
          if (typeof ext.enableMusic === "function") return ext.enableMusic(v);
        } catch (_) {}
      },

      setSfxOn: (v) => {
        try {
          if (typeof ext.setSfxOn === "function") return ext.setSfxOn(v);
          if (typeof ext.enableSfx === "function") return ext.enableSfx(v);
        } catch (_) {}
      },

      setVolumes: (o) => {
        try {
          if (typeof ext.setVolumes === "function") return ext.setVolumes(o);
          if (typeof ext.setVolume === "function") return ext.setVolume(o);
        } catch (_) {}
      },

      setAllowProceduralMusic: (_v) => {},

      getState: () => {
        try { if (typeof ext.getState === "function") return ext.getState(); } catch (_) {}
        return { VERSION, wrapped: true };
      },
    });

    window.AudioSys = api;
    return;
  }

  // ───────────────────────── Motor interno ─────────────────────────
  const supportsCtx = (() => {
    try { return !!(window.AudioContext || window.webkitAudioContext); } catch (_) { return false; }
  })();

  const supportsHtmlAudio = (() => {
    try { return typeof Audio === "function"; } catch (_) { return false; }
  })();

  const FILES = {
    // Música
    bgm:    "assets/audio/bgm_loop.mp3",
    music:  "assets/audio/music_loop.mp3",

    // SFX
    coin:   "assets/audio/sfx_coin.wav",
    gem:    "assets/audio/sfx_gem.wav",
    bonus:  "assets/audio/sfx_bonus.wav",
    trap:   "assets/audio/sfx_trap.wav",
    ko:     "assets/audio/sfx_ko.wav",
    level:  "assets/audio/sfx_levelup.wav",
    pick:   "assets/audio/sfx_pick.wav",
    reroll: "assets/audio/sfx_reroll.wav",
    ui:     "assets/audio/sfx_ui_click.wav",

    gameover: "assets/audio/sfx_gameover.wav",
    combo:    "assets/audio/sfx_combo.wav",
    block:    "assets/audio/sfx_block.wav",
    upgrade:  "assets/audio/sfx_upgrade.wav",
  };

  let ctx = null, master = null, sfxGain = null;
  let musicEl = null, musicMode = "none";
  let duckFactor = 1.0, volAnimRaf = 0;

  let muted = false;
  let musicOn = true;
  let sfxOn = true;

  let musicVol = 0.60;
  let sfxVol = 0.90;

  // Buffers: key -> AudioBuffer | null | Promise<AudioBuffer|null>
  const buffers = new Map();

  // HTMLAudio fallback pool (para SFX si no hay WebAudio o está bloqueado)
  const htmlPools = new Map(); // key -> Audio[]
  const HTML_POOL_MAX = 5;

  // Música procedural fallback: por defecto DESACTIVADA
  let allowProceduralMusic = false;
  let procedural = null;

  // Unlock state (NO se queda “true” si falla; reintenta)
  let unlockedOnce = false;
  let unlocking = null;
  let lastUnlockTryAt = 0;

  function ensureCtx() {
    if (!supportsCtx) return null;
    if (ctx) return ctx;

    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });

    master = ctx.createGain();
    sfxGain = ctx.createGain();

    master.gain.value = muted ? 0 : 1;
    sfxGain.gain.value = (sfxOn && !muted) ? sfxVol : 0;

    sfxGain.connect(master);
    master.connect(ctx.destination);

    return ctx;
  }

  function musicSrc() {
    return FILES.bgm || FILES.music || "";
  }

  function ensureMusicEl() {
    if (!supportsHtmlAudio) return null;
    if (musicEl) return musicEl;

    try {
      const el = new Audio();
      el.src = urlOf(musicSrc());
      el.loop = true;
      el.preload = "auto";
      el.autoplay = false;
      el.playsInline = true;
      try { el.setAttribute("playsinline", ""); } catch (_) {}
      try { el.setAttribute("webkit-playsinline", ""); } catch (_) {}
      try { el.crossOrigin = "anonymous"; } catch (_) {}

      // Arranca silenciado (iOS)
      el.muted = true;
      el.volume = 0;

      musicEl = el;
      musicMode = "html";
      return musicEl;
    } catch (_) {
      musicEl = null;
      return null;
    }
  }

  function effectiveMusicVolume() {
    if (muted || !musicOn) return 0;
    return clamp(musicVol * duckFactor, 0, 1);
  }

  function setMusicVolumeImmediate(v) {
    const el = ensureMusicEl();
    if (!el) return;
    const vv = clamp(v, 0, 1);
    try {
      el.muted = vv <= 0.0001;
      el.volume = vv;
    } catch (_) {}
  }

  function setMusicVolumeSmooth(target, ms = 140) {
    const el = ensureMusicEl();
    if (!el) return;

    if (volAnimRaf) cancelAnimationFrame(volAnimRaf);
    const t0 = pNow();

    let from = 0;
    try { from = Number.isFinite(el.volume) ? el.volume : 0; } catch (_) { from = 0; }

    const to = clamp(target, 0, 1);

    const step = () => {
      const t = pNow();
      const k = clamp((t - t0) / Math.max(1, ms), 0, 1);
      const e = 1 - Math.pow(1 - k, 2);
      setMusicVolumeImmediate(from + (to - from) * e);
      if (k < 1) volAnimRaf = requestAnimationFrame(step);
      else volAnimRaf = 0;
    };
    volAnimRaf = requestAnimationFrame(step);
  }

  function isCtxRunning() {
    try { return !!(ctx && ctx.state === "running"); } catch { return false; }
  }

  async function unlock(..._args) {
    // throttle suave (evita spamear)
    const now = pNow();
    if (unlocking) return unlocking;
    if (unlockedOnce && (isCtxRunning() || !supportsCtx)) return true;
    if ((now - lastUnlockTryAt) < 120) return (isCtxRunning() || unlockedOnce);

    lastUnlockTryAt = now;

    unlocking = (async () => {
      let ok = false;

      // WebAudio resume
      if (supportsCtx) {
        const c = ensureCtx();
        if (c) {
          try { if (c.state !== "running") await c.resume(); } catch (_) {}
          ok = ok || (c.state === "running");
          // “tick” muy corto para “despertar” algunos móviles
          if (c.state === "running") {
            try {
              const o = c.createOscillator();
              const g2 = c.createGain();
              g2.gain.value = 0.0001;
              o.connect(g2);
              g2.connect(master);
              o.start();
              o.stop(c.currentTime + 0.01);
              o.onended = () => { try { o.disconnect(); g2.disconnect(); } catch (_) {} };
              ok = true;
            } catch (_) {}
          }
        }
      }

      // Prime música HTMLAudio (iOS)
      if (supportsHtmlAudio) {
        try {
          const el = ensureMusicEl();
          if (el) {
            el.muted = true;
            el.volume = 0;
            const p = el.play();
            if (p && typeof p.then === "function") await p.catch(() => {});
            try { el.pause(); } catch (_) {}
            try { el.currentTime = 0; } catch (_) {}
            ok = true; // aunque “play” falle, a veces no rompe; pero el intento cuenta
          }
        } catch (_) {}
      }

      if (ok) unlockedOnce = true;
      unlocking = null;
      return ok;
    })();

    return unlocking;
  }

  function stopProceduralMusic() {
    if (!procedural) return;
    try { procedural.stop?.(); } catch (_) {}
    try { procedural.disconnect?.(); } catch (_) {}
    procedural = null;
    if (musicMode === "procedural") musicMode = "none";
  }

  function stopMusic() {
    if (musicEl) {
      try { musicEl.pause(); } catch (_) {}
      try { musicEl.currentTime = 0; } catch (_) {}
    }
    stopProceduralMusic();
  }

  async function startMusic() {
    if (!musicOn || muted) return;
    const ok = await unlock();
    if (!ok) return;

    const el = ensureMusicEl();
    if (el) {
      const vv = effectiveMusicVolume();
      setMusicVolumeImmediate(vv);
      if (vv <= 0.0001) return;

      try {
        if (!el.paused) return;
        el.muted = false;
        const p = el.play();
        if (p && typeof p.then === "function") await p;
        musicMode = "html";
        return;
      } catch (_) {
        // Si falla, intentamos procedural solo si está permitido
      }
    }

    if (!allowProceduralMusic) return;
    if (!supportsCtx) return;

    const c = ensureCtx();
    if (!c || procedural) return;
    if (c.state !== "running") return;

    try {
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const g2 = c.createGain();

      o1.type = "sine";
      o2.type = "triangle";
      o1.frequency.value = 110;
      o2.frequency.value = 220;

      const lfo = c.createOscillator();
      const lfoG = c.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 0.15;
      lfoG.gain.value = 12;

      lfo.connect(lfoG);
      lfoG.connect(o2.frequency);

      g2.gain.value = 0.10;

      o1.connect(g2);
      o2.connect(g2);
      g2.connect(master);

      o1.start(); o2.start(); lfo.start();

      const notes = [110, 123.47, 130.81, 146.83, 164.81, 146.83, 130.81, 123.47];
      let idx = 0;

      const step = () => {
        if (!ctx || !procedural || !musicOn || muted) return;
        const f = notes[idx++ % notes.length];
        const t = ctx.currentTime;
        o1.frequency.setTargetAtTime(f, t, 0.12);
        o2.frequency.setTargetAtTime(f * 2, t, 0.12);
        setTimeout(step, 680);
      };

      procedural = {
        stop() {
          try { o1.stop(); o2.stop(); lfo.stop(); } catch (_) {}
          try { o1.disconnect(); o2.disconnect(); lfo.disconnect(); lfoG.disconnect(); g2.disconnect(); } catch (_) {}
        },
        disconnect() {},
      };

      musicMode = "procedural";
      step();
    } catch (_) {}
  }

  function setMute(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 1;

    if (muted) stopMusic();
    else setMusicVolumeImmediate(effectiveMusicVolume());

    if (sfxGain) sfxGain.gain.value = (sfxOn && !muted) ? sfxVol : 0;
  }

  function setMusicOn(v) {
    musicOn = !!v;
    if (!musicOn) stopMusic();
    else startMusic();
  }

  function setSfxOn(v) {
    sfxOn = !!v;
    if (sfxGain) sfxGain.gain.value = (sfxOn && !muted) ? sfxVol : 0;
  }

  function setVolumes({ music, sfx } = {}) {
    if (Number.isFinite(music)) musicVol = clamp(music, 0, 1);
    if (Number.isFinite(sfx)) sfxVol = clamp(sfx, 0, 1);
    if (sfxGain) sfxGain.gain.value = (sfxOn && !muted) ? sfxVol : 0;
    setMusicVolumeImmediate(effectiveMusicVolume());
  }

  function duckMusic(on) {
    duckFactor = on ? 0.35 : 1.0;
    setMusicVolumeSmooth(effectiveMusicVolume(), 140);
  }

  function setAllowProceduralMusic(v) {
    allowProceduralMusic = (v !== false);
    if (!allowProceduralMusic && musicMode === "procedural") stopProceduralMusic();
  }

  // ───────────────────────── WebAudio SFX ─────────────────────────
  async function loadBuffer(key, relPath) {
    if (!supportsCtx) return null;

    const prev = buffers.get(key);
    if (prev instanceof AudioBuffer) return prev;
    if (prev === null) return null;
    if (prev && typeof prev.then === "function") return await prev;

    const c = ensureCtx();
    if (!c) { buffers.set(key, null); return null; }

    const prom = (async () => {
      try {
        const res = await fetch(urlOf(relPath), { cache: "force-cache" });
        if (!res || !res.ok) throw new Error("fetch audio fail");
        const arr = await res.arrayBuffer();
        const buf = await c.decodeAudioData(arr.slice(0));
        return buf || null;
      } catch (_) {
        return null;
      }
    })();

    buffers.set(key, prom);
    const done = await prom;
    buffers.set(key, done);
    return done;
  }

  function playBuffer(buf, { gain = 1, rate = 1, pan = 0 } = {}) {
    if (!buf) return false;
    const c = ensureCtx();
    if (!c || c.state !== "running") return false;
    if (!sfxOn || muted) return false;

    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = clamp(rate, 0.5, 2.0);

      const g2 = c.createGain();
      g2.gain.value = clamp(gain, 0, 2.0);

      // graph: src -> (panner?) -> gain -> sfxGain
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = clamp(pan, -1, 1);
        src.connect(p);
        p.connect(g2);
      } else {
        src.connect(g2);
      }

      g2.connect(sfxGain);

      src.start();
      src.onended = () => { try { src.disconnect(); g2.disconnect(); } catch (_) {} };
      return true;
    } catch (_) {
      return false;
    }
  }

  function beep({ f = 440, ms = 90, type = "square", gain = 0.18, slideTo = null } = {}) {
    const c = ensureCtx();
    if (!c || c.state !== "running") return false;
    if (!sfxOn || muted) return false;

    const t0 = c.currentTime;
    const t1 = t0 + clamp(ms, 20, 600) / 1000;

    const o = c.createOscillator();
    const g2 = c.createGain();

    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slideTo != null) {
      try { o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t1); } catch (_) {}
    }

    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, t1);

    o.connect(g2);
    g2.connect(sfxGain);

    o.start(t0);
    o.stop(t1);

    o.onended = () => { try { o.disconnect(); g2.disconnect(); } catch (_) {} };
    return true;
  }

  // ───────────────────────── HTMLAudio SFX fallback ─────────────────────────
  function getHtmlSfxEl(key, src) {
    if (!supportsHtmlAudio) return null;

    let pool = htmlPools.get(key);
    if (!pool) { pool = []; htmlPools.set(key, pool); }

    // Reutiliza uno que esté parado
    for (const el of pool) {
      try { if (el.paused || el.ended) return el; } catch (_) {}
    }

    // Crea nuevo si hay hueco
    if (pool.length < HTML_POOL_MAX) {
      try {
        const el = new Audio();
        el.src = urlOf(src);
        el.preload = "auto";
        el.loop = false;
        el.autoplay = false;
        el.playsInline = true;
        try { el.setAttribute("playsinline", ""); } catch (_) {}
        try { el.setAttribute("webkit-playsinline", ""); } catch (_) {}
        pool.push(el);
        return el;
      } catch (_) {
        return null;
      }
    }

    // Si no, recicla el primero
    return pool[0] || null;
  }

  async function playHtmlSfx(key, src, gain = 0.7) {
    if (!supportsHtmlAudio) return false;
    if (!sfxOn || muted) return false;

    const el = getHtmlSfxEl(key, src);
    if (!el) return false;

    try {
      el.currentTime = 0;
    } catch (_) {}

    try {
      el.muted = false;
      el.volume = clamp(sfxVol * clamp(gain, 0, 2), 0, 1);
    } catch (_) {}

    try {
      const p = el.play();
      if (p && typeof p.then === "function") await p.catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  // ───────────────────────── API pública: sfx(name) ─────────────────────────
  function normalizeSfxName(name) {
    const n = String(name || "ui").trim().toLowerCase();

    const alias = {
      click: "ui",
      button: "ui",
      tap: "ui",
      ui_click: "ui",
      ui: "ui",

      coin: "coin",
      gem: "gem",
      bonus: "bonus",
      trap: "trap",
      ko: "ko",
      level: "level",
      levelup: "level",
      pick: "pick",
      reroll: "reroll",
      gameover: "gameover",
      over: "gameover",
      combo: "combo",
      block: "block",
      upgrade: "upgrade",

      hurt: "trap",
      damage: "trap",
      hit: "trap",
      heart: "bonus",
      heal: "bonus",
      life: "bonus",
      revive: "bonus",

      magnet: "pick",
      magnet_on: "pick",
      magnet_off: "ui",

      upgrade_open: "ui",
      upgrade_pick: "upgrade",
      upgrades: "upgrade",
    };

    return alias[n] || n || "ui";
  }

  async function sfx(name) {
    await unlock();

    const k = normalizeSfxName(name);
    const file = FILES[k] || FILES.ui;

    // Ganancias por tipo
    let gain = 0.70;
    if (k === "ko" || k === "trap" || k === "gameover") gain = 0.95;
    else if (k === "ui") gain = 0.55;
    else if (k === "upgrade" || k === "combo") gain = 0.80;
    else if (k === "pick") gain = 0.72;

    // 1) WebAudio WAV (si disponible y ctx running)
    if (supportsCtx) {
      const c = ensureCtx();
      if (c && c.state === "running" && file) {
        // timeout pequeño: si tarda, hace beep ahora y la próxima ya sonará el wav
        const timeoutMs = 130;
        const bufP = loadBuffer(k, file);
        let buf = null;

        try {
          buf = await Promise.race([
            bufP,
            new Promise((res) => setTimeout(() => res(null), timeoutMs)),
          ]);
        } catch (_) { buf = null; }

        if (buf) {
          const rate = 0.94 + Math.random() * 0.12;
          const pan = (Math.random() * 2 - 1) * 0.15;
          if (playBuffer(buf, { gain, rate, pan })) return true;
        }
      }
    }

    // 2) HTMLAudio fallback SFX (si WebAudio no está o está bloqueado)
    if (file && supportsHtmlAudio) {
      const ok = await playHtmlSfx(k, file, gain);
      if (ok) return true;
    }

    // 3) Procedural beep fallback (WebAudio)
    if (k === "coin")     return beep({ f: 820, ms: 60,  type: "square",   gain: 0.14, slideTo: 980 });
    if (k === "gem")      return beep({ f: 620, ms: 85,  type: "triangle", gain: 0.16, slideTo: 920 });
    if (k === "bonus")    return beep({ f: 520, ms: 120, type: "sawtooth", gain: 0.12, slideTo: 1040 });
    if (k === "trap")     return beep({ f: 220, ms: 140, type: "square",   gain: 0.16, slideTo: 110 });
    if (k === "ko")       return beep({ f: 150, ms: 220, type: "sawtooth", gain: 0.18, slideTo: 60 });
    if (k === "level")    return beep({ f: 440, ms: 140, type: "triangle", gain: 0.14, slideTo: 880 });
    if (k === "pick")     return beep({ f: 520, ms: 80,  type: "square",   gain: 0.12, slideTo: 700 });
    if (k === "reroll")   return beep({ f: 360, ms: 90,  type: "triangle", gain: 0.12, slideTo: 520 });
    if (k === "combo")    return beep({ f: 740, ms: 120, type: "triangle", gain: 0.12, slideTo: 980 });
    if (k === "block")    return beep({ f: 260, ms: 90,  type: "square",   gain: 0.12, slideTo: 220 });
    if (k === "upgrade")  return beep({ f: 480, ms: 140, type: "sawtooth", gain: 0.12, slideTo: 960 });
    if (k === "gameover") return beep({ f: 190, ms: 260, type: "sawtooth", gain: 0.16, slideTo: 70 });

    return beep({ f: 520, ms: 55, type: "square", gain: 0.09, slideTo: 610 });
  }

  // ───────────────────────── Export ─────────────────────────
  window.AudioSys = Object.freeze({
    __isGridRogueAudioSys: true,
    VERSION,
    supports: true,

    unlock,
    sfx,
    startMusic,
    stopMusic,
    duckMusic,
    setMute,
    setMusicOn,
    setSfxOn,
    setVolumes,
    setAllowProceduralMusic,

    getState: () => ({
      VERSION,
      muted, musicOn, sfxOn,
      musicVol, sfxVol,
      duckFactor,
      unlockedOnce,
      supportsCtx,
      supportsHtmlAudio,
      musicMode,
      hasMusicEl: !!musicEl,
      buffered: buffers.size,
      allowProceduralMusic,
      htmlPools: (() => {
        try {
          let n = 0;
          for (const arr of htmlPools.values()) n += (arr?.length || 0);
          return n;
        } catch { return 0; }
      })(),
      ctxState: (() => { try { return ctx ? ctx.state : "none"; } catch { return "none"; } })(),
    }),
  });
})();
