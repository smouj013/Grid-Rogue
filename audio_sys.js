/* audio_sys.js — Grid Rogue v0.1.7
   window.AudioSys
   - Si detecta un motor externo (tu audio.js) lo envuelve.
   - Si no, usa el motor interno (HTMLAudio + WebAudio SFX + fallback).
*/
(() => {
  "use strict";

  // Si ya existe AudioSys (por tu audio.js), no lo tocamos.
  if (window.AudioSys && typeof window.AudioSys.sfx === "function") return;

  const U = window.GRUtils || {};
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : a));

  function pickExternalEngine() {
    const cands = [
      window.AudioEngine,
      window.AudioManager,
      window.GRAudio,
      window.AudioSystem,
      window.Audio,        // a veces audio.js exporta window.Audio
    ].filter(Boolean);

    for (const e of cands) {
      const hasSfx = typeof e.sfx === "function" || typeof e.playSfx === "function" || typeof e.play === "function";
      const hasMusic = typeof e.startMusic === "function" || typeof e.playMusic === "function" || typeof e.musicStart === "function";
      if (hasSfx || hasMusic) return e;
    }
    return null;
  }

  const ext = pickExternalEngine();
  if (ext) {
    const api = {
      supports: true,
      unlock: async () => {
        try {
          if (typeof ext.unlock === "function") return await ext.unlock();
          if (typeof ext.resume === "function") return await ext.resume();
        } catch {}
        return true;
      },
      sfx: async (name) => {
        try {
          if (typeof ext.sfx === "function") return await ext.sfx(name);
          if (typeof ext.playSfx === "function") return await ext.playSfx(name);
          if (typeof ext.play === "function") return await ext.play(name);
        } catch {}
        return false;
      },
      startMusic: async () => {
        try {
          if (typeof ext.startMusic === "function") return await ext.startMusic();
          if (typeof ext.playMusic === "function") return await ext.playMusic();
          if (typeof ext.musicStart === "function") return await ext.musicStart();
        } catch {}
      },
      stopMusic: () => {
        try {
          if (typeof ext.stopMusic === "function") return ext.stopMusic();
          if (typeof ext.musicStop === "function") return ext.musicStop();
          if (typeof ext.stop === "function") return ext.stop();
        } catch {}
      },
      duckMusic: (on) => {
        try {
          if (typeof ext.duckMusic === "function") return ext.duckMusic(on);
          if (typeof ext.duck === "function") return ext.duck(on);
          if (typeof ext.setDuck === "function") return ext.setDuck(on ? 0.35 : 1.0);
        } catch {}
      },
      setMute: (v) => {
        try {
          if (typeof ext.setMute === "function") return ext.setMute(v);
          if (typeof ext.mute === "function") return ext.mute(v);
        } catch {}
      },
      setMusicOn: (v) => {
        try {
          if (typeof ext.setMusicOn === "function") return ext.setMusicOn(v);
          if (typeof ext.enableMusic === "function") return ext.enableMusic(v);
        } catch {}
      },
      setSfxOn: (v) => {
        try {
          if (typeof ext.setSfxOn === "function") return ext.setSfxOn(v);
          if (typeof ext.enableSfx === "function") return ext.enableSfx(v);
        } catch {}
      },
      setVolumes: (o) => {
        try {
          if (typeof ext.setVolumes === "function") return ext.setVolumes(o);
          if (typeof ext.setVolume === "function") return ext.setVolume(o);
        } catch {}
      },
      getState: () => {
        try {
          if (typeof ext.getState === "function") return ext.getState();
        } catch {}
        return {};
      },
    };

    window.AudioSys = Object.freeze(api);
    return;
  }

  // ───────────────────────── Motor interno ─────────────────────────
  const supportsCtx = (() => {
    try { return !!(window.AudioContext || window.webkitAudioContext); } catch { return false; }
  })();

  const FILES = {
    bgm:   "assets/audio/bgm_loop.mp3",
    coin:  "assets/audio/sfx_coin.wav",
    gem:   "assets/audio/sfx_gem.wav",
    bonus: "assets/audio/sfx_bonus.wav",
    trap:  "assets/audio/sfx_trap.wav",
    ko:    "assets/audio/sfx_ko.wav",
    level: "assets/audio/sfx_levelup.wav",
    pick:  "assets/audio/sfx_pick.wav",
    reroll:"assets/audio/sfx_reroll.wav",
    ui:    "assets/audio/sfx_ui_click.wav",
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
  let proceduralNode = null;

  const urlOf = (rel) => new URL(rel, location.href).toString();

  function ensureCtx() {
    if (!supportsCtx) return null;
    if (ctx) return ctx;

    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });

    master = ctx.createGain();
    sfxGain = ctx.createGain();

    master.gain.value = muted ? 0 : 1;
    sfxGain.gain.value = sfxOn ? sfxVol : 0;

    sfxGain.connect(master);
    master.connect(ctx.destination);
    return ctx;
  }

  function ensureMusicEl() {
    if (musicEl) return musicEl;
    try {
      const el = new Audio();
      el.src = urlOf(FILES.bgm);
      el.loop = true;
      el.preload = "auto";
      el.autoplay = false;
      el.playsInline = true;
      try { el.setAttribute("playsinline", ""); } catch {}
      try { el.setAttribute("webkit-playsinline", ""); } catch {}
      el.muted = true;
      el.volume = 0;
      musicEl = el;
      musicMode = "html";
      return musicEl;
    } catch {
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
    } catch {}
  }

  function setMusicVolumeSmooth(target, ms = 140) {
    const el = ensureMusicEl();
    if (!el) return;

    if (volAnimRaf) cancelAnimationFrame(volAnimRaf);
    const t0 = performance.now();
    let from = 0;
    try { from = Number.isFinite(el.volume) ? el.volume : 0; } catch { from = 0; }
    const to = clamp(target, 0, 1);

    const step = () => {
      const t = performance.now();
      const k = clamp((t - t0) / Math.max(1, ms), 0, 1);
      const e = 1 - Math.pow(1 - k, 2);
      const v = from + (to - from) * e;
      setMusicVolumeImmediate(v);
      if (k < 1) volAnimRaf = requestAnimationFrame(step);
      else volAnimRaf = 0;
    };
    volAnimRaf = requestAnimationFrame(step);
  }

  async function unlock() {
    unlocked = true;
    if (supportsCtx) {
      const c = ensureCtx();
      if (c) { try { if (c.state !== "running") await c.resume(); } catch {} }
    }
    return true;
  }

  function stopProceduralMusic() {
    if (!proceduralNode) return;
    try { proceduralNode.stop?.(); } catch {}
    try { proceduralNode.disconnect?.(); } catch {}
    proceduralNode = null;
    if (musicMode === "procedural") musicMode = "none";
  }

  function stopMusic() {
    if (musicEl) {
      try { musicEl.pause(); musicEl.currentTime = 0; } catch {}
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
        const p = el.play();
        if (p && typeof p.then === "function") await p;
        musicMode = "html";
        return;
      } catch {
        // cae a procedural
      }
    }

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
          try { o1.stop(); o2.stop(); lfo.stop(); } catch {}
          try { o1.disconnect(); o2.disconnect(); lfo.disconnect(); lfoG.disconnect(); g.disconnect(); } catch {}
        },
        disconnect() {},
      };

      musicMode = "procedural";
      step();
    } catch {}
  }

  function setMute(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 1;
    if (muted) stopMusic();
    else setMusicVolumeImmediate(effectiveMusicVolume());
  }

  function setMusicOn(v) {
    musicOn = !!v;
    if (!musicOn) stopMusic();
    else startMusic();
  }

  function setSfxOn(v) {
    sfxOn = !!v;
    if (sfxGain) sfxGain.gain.value = sfxOn ? sfxVol : 0;
  }

  function setVolumes({ music, sfx }) {
    if (Number.isFinite(music)) musicVol = clamp(music, 0, 1);
    if (Number.isFinite(sfx)) sfxVol = clamp(sfx, 0, 1);
    if (sfxGain) sfxGain.gain.value = sfxOn ? sfxVol : 0;
    setMusicVolumeImmediate(effectiveMusicVolume());
  }

  function duckMusic(on) {
    duckFactor = on ? 0.35 : 1.0;
    setMusicVolumeSmooth(effectiveMusicVolume(), 140);
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
    } catch {
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
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch {} };
      return true;
    } catch {
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

    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch {} };
    return true;
  }

  async function sfx(name) {
    await unlock();
    if (!supportsCtx) return false;

    const map = {
      coin: "coin", gem: "gem", bonus: "bonus", trap: "trap", ko: "ko",
      level: "level", pick: "pick", reroll: "reroll", ui: "ui",
    };

    const k = map[name] || "ui";
    const file = FILES[k];
    if (file) {
      const buf = await loadBuffer(k, file);
      if (buf) {
        const rate = 0.94 + Math.random() * 0.12;
        const gain = (k === "ko" || k === "trap") ? 0.95 : 0.70;
        return playBuffer(buf, { gain, rate, pan: (Math.random() * 2 - 1) * 0.15 });
      }
    }

    if (k === "coin")  return beep({ f: 820, ms: 60, type: "square", gain: 0.14, slideTo: 980 });
    if (k === "gem")   return beep({ f: 620, ms: 85, type: "triangle", gain: 0.16, slideTo: 920 });
    if (k === "bonus") return beep({ f: 520, ms: 120, type: "sawtooth", gain: 0.12, slideTo: 1040 });
    if (k === "trap")  return beep({ f: 220, ms: 140, type: "square", gain: 0.16, slideTo: 110 });
    if (k === "ko")    return beep({ f: 150, ms: 220, type: "sawtooth", gain: 0.18, slideTo: 60 });
    if (k === "level") return beep({ f: 440, ms: 140, type: "triangle", gain: 0.14, slideTo: 880 });
    if (k === "pick")  return beep({ f: 520, ms: 80, type: "square", gain: 0.12, slideTo: 700 });
    if (k === "reroll")return beep({ f: 360, ms: 90, type: "triangle", gain: 0.12, slideTo: 520 });
    return beep({ f: 520, ms: 55, type: "square", gain: 0.09, slideTo: 610 });
  }

  window.AudioSys = Object.freeze({
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
    getState: () => ({ muted, musicOn, sfxOn, musicVol, sfxVol, unlocked, musicMode }),
  });
})();
