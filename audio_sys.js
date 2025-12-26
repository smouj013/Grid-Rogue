/* audio_sys.js — Grid Rogue v1.0.0
   window.AudioSys
   - Si detecta motor externo: lo envuelve (wrapper) sin romper compat.
   - Si no: motor interno (HTMLAudio música + WebAudio SFX + fallback procedural SFX)
   - unlock() idempotente (iOS/Android friendly)
   - setAllowProceduralMusic(false): permite desactivar música procedural fallback (por defecto: false)
*/
(() => {
  "use strict";

  const VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.0.0");

  // Si ya existe AudioSys (motor externo / ya cargado), no lo tocamos.
  if (window.AudioSys && typeof window.AudioSys.sfx === "function") return;

  const U = window.GRUtils || window.Utils || {};
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0)));

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
  function pickExternalEngine() {
    const cands = [
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
    const api = {
      VERSION,
      supports: true,

      unlock: async () => {
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
        return {};
      },
    };

    window.AudioSys = Object.freeze(api);
    return;
  }

  // ───────────────────────── Motor interno ─────────────────────────
  const supportsCtx = (() => {
    try { return !!(window.AudioContext || window.webkitAudioContext); } catch (_) { return false; }
  })();

  const FILES = {
    bgm:    "assets/audio/bgm_loop.mp3",
    music:  "assets/audio/music_loop.mp3",

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

  let unlocked = false;
  let muted = false;
  let musicOn = true;
  let sfxOn = true;

  let musicVol = 0.60;
  let sfxVol = 0.90;

  const buffers = new Map();

  // Música procedural fallback: por defecto DESACTIVADA (tu audio.js la fuerza a false)
  let allowProceduralMusic = false;
  let proceduralNode = null;

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

  function ensureMusicEl() {
    if (musicEl) return musicEl;
    try {
      const el = new Audio();
      el.src = urlOf(FILES.music || FILES.bgm);
      el.loop = true;
      el.preload = "auto";
      el.autoplay = false;
      el.playsInline = true;
      try { el.setAttribute("playsinline", ""); } catch (_) {}
      try { el.setAttribute("webkit-playsinline", ""); } catch (_) {}

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
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

    let from = 0;
    try { from = Number.isFinite(el.volume) ? el.volume : 0; } catch (_) { from = 0; }

    const to = clamp(target, 0, 1);

    const step = () => {
      const t = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const k = clamp((t - t0) / Math.max(1, ms), 0, 1);
      const e = 1 - Math.pow(1 - k, 2);
      setMusicVolumeImmediate(from + (to - from) * e);
      if (k < 1) volAnimRaf = requestAnimationFrame(step);
      else volAnimRaf = 0;
    };
    volAnimRaf = requestAnimationFrame(step);
  }

  async function unlock() {
    if (unlocked) return true;
    unlocked = true;

    if (supportsCtx) {
      const c = ensureCtx();
      if (c) {
        try { if (c.state !== "running") await c.resume(); } catch (_) {}
      }
    }

    // Prime música en silencio (iOS)
    try {
      const el = ensureMusicEl();
      if (el) {
        el.muted = true;
        el.volume = 0;
        const p = el.play();
        if (p && typeof p.then === "function") await p.catch(() => {});
        try { el.pause(); } catch (_) {}
        try { el.currentTime = 0; } catch (_) {}
      }
    } catch (_) {}

    return true;
  }

  function stopProceduralMusic() {
    if (!proceduralNode) return;
    try { proceduralNode.stop?.(); } catch (_) {}
    try { proceduralNode.disconnect?.(); } catch (_) {}
    proceduralNode = null;
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
    await unlock();

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
        // Si falla, intentaremos procedural solo si está permitido
      }
    }

    if (!allowProceduralMusic) return;
    if (!supportsCtx) return;

    const c = ensureCtx();
    if (!c || proceduralNode) return;

    try {
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const g = c.createGain();

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

      g.gain.value = 0.10;

      o1.connect(g);
      o2.connect(g);
      g.connect(master);

      o1.start(); o2.start(); lfo.start();

      const notes = [110, 123.47, 130.81, 146.83, 164.81, 146.83, 130.81, 123.47];
      let idx = 0;

      const step = () => {
        if (!ctx || !proceduralNode || !musicOn || muted) return;
        const f = notes[idx++ % notes.length];
        const t = ctx.currentTime;
        o1.frequency.setTargetAtTime(f, t, 0.12);
        o2.frequency.setTargetAtTime(f * 2, t, 0.12);
        setTimeout(step, 680);
      };

      proceduralNode = {
        stop() {
          try { o1.stop(); o2.stop(); lfo.stop(); } catch (_) {}
          try { o1.disconnect(); o2.disconnect(); lfo.disconnect(); lfoG.disconnect(); g.disconnect(); } catch (_) {}
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

  async function loadBuffer(key, relPath) {
    if (!supportsCtx) return null;
    if (buffers.has(key)) return buffers.get(key);

    const c = ensureCtx();
    if (!c) return null;

    try {
      const res = await fetch(urlOf(relPath), { cache: "force-cache" });
      if (!res || !res.ok) throw new Error("fetch audio fail");
      const arr = await res.arrayBuffer();
      const buf = await c.decodeAudioData(arr.slice(0));
      buffers.set(key, buf);
      return buf;
    } catch (_) {
      buffers.set(key, null);
      return null;
    }
  }

  function playBuffer(buf, { gain = 1, rate = 1, pan = 0 } = {}) {
    if (!buf) return false;
    const c = ensureCtx();
    if (!c || !unlocked) return false;
    if (!sfxOn || muted) return false;

    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = clamp(rate, 0.5, 2.0);

      const g = c.createGain();
      g.gain.value = clamp(gain, 0, 2.0);

      let node = src;
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = clamp(pan, -1, 1);
        node.connect(p);
        node = p;
      }
      node.connect(g);
      g.connect(sfxGain);

      src.start();
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (_) {} };
      return true;
    } catch (_) {
      return false;
    }
  }

  function beep({ f = 440, ms = 90, type = "square", gain = 0.18, slideTo = null } = {}) {
    const c = ensureCtx();
    if (!c || !unlocked) return false;
    if (!sfxOn || muted) return false;

    const t0 = c.currentTime;
    const t1 = t0 + clamp(ms, 20, 600) / 1000;

    const o = c.createOscillator();
    const g = c.createGain();

    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t1);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    o.connect(g);
    g.connect(sfxGain);
    o.start(t0);
    o.stop(t1);

    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_) {} };
    return true;
  }

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
    if (!supportsCtx) return false;

    const k = normalizeSfxName(name);
    const file = FILES[k] || FILES.ui;

    if (file) {
      const buf = await loadBuffer(k, file);
      if (buf) {
        const rate = 0.94 + Math.random() * 0.12;

        let gain = 0.70;
        if (k === "ko" || k === "trap" || k === "gameover") gain = 0.95;
        else if (k === "ui") gain = 0.55;
        else if (k === "upgrade" || k === "combo") gain = 0.80;
        else if (k === "pick") gain = 0.72;

        return playBuffer(buf, { gain, rate, pan: (Math.random() * 2 - 1) * 0.15 });
      }
    }

    if (k === "coin")    return beep({ f: 820, ms: 60,  type: "square",   gain: 0.14, slideTo: 980 });
    if (k === "gem")     return beep({ f: 620, ms: 85,  type: "triangle", gain: 0.16, slideTo: 920 });
    if (k === "bonus")   return beep({ f: 520, ms: 120, type: "sawtooth", gain: 0.12, slideTo: 1040 });
    if (k === "trap")    return beep({ f: 220, ms: 140, type: "square",   gain: 0.16, slideTo: 110 });
    if (k === "ko")      return beep({ f: 150, ms: 220, type: "sawtooth", gain: 0.18, slideTo: 60 });
    if (k === "level")   return beep({ f: 440, ms: 140, type: "triangle", gain: 0.14, slideTo: 880 });
    if (k === "pick")    return beep({ f: 520, ms: 80,  type: "square",   gain: 0.12, slideTo: 700 });
    if (k === "reroll")  return beep({ f: 360, ms: 90,  type: "triangle", gain: 0.12, slideTo: 520 });
    if (k === "combo")   return beep({ f: 740, ms: 120, type: "triangle", gain: 0.12, slideTo: 980 });
    if (k === "block")   return beep({ f: 260, ms: 90,  type: "square",   gain: 0.12, slideTo: 220 });
    if (k === "upgrade") return beep({ f: 480, ms: 140, type: "sawtooth", gain: 0.12, slideTo: 960 });
    if (k === "gameover")return beep({ f: 190, ms: 260, type: "sawtooth", gain: 0.16, slideTo: 70 });

    return beep({ f: 520, ms: 55, type: "square", gain: 0.09, slideTo: 610 });
  }

  window.AudioSys = Object.freeze({
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
      unlocked,
      supportsCtx,
      musicMode,
      hasMusicEl: !!musicEl,
      buffered: buffers.size,
      allowProceduralMusic,
    }),
  });
})();
