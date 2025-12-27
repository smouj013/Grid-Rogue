/* audio.js — Grid Rogue v1.0.0 (AudioSys)
   - WebAudio + fallback básico
   - unlock() móvil
   - sfx(name), startMusic(), stopMusic()
   - setMute / setMusicOn / setSfxOn / setVolumes
*/
(() => {
  "use strict";

  const BASE = new URL("./assets/audio/", location.href);

  const SFX_MAP = {
    ui: "sfx_ui_click.wav",
    coin: "sfx_coin.wav",
    gem: "sfx_gem.wav",
    bonus: "sfx_bonus.wav",
    trap: "sfx_trap.wav",
    ko: "sfx_ko.wav",
    gameover: "sfx_gameover.wav",
    level: "sfx_levelup.wav",
    pick: "sfx_pick.wav",
    reroll: "sfx_reroll.wav"
  };

  const MUSIC_FILES = ["music_loop.mp3", "bgm_loop.mp3"];

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;

  let muteAll = false;
  let musicOn = true;
  let sfxOn = true;
  let musicVol = 0.60;
  let sfxVol = 0.90;

  let unlocked = false;
  let musicSource = null;
  let musicBuf = null;

  const bufCache = new Map();

  function canWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  function ensureCtx() {
    if (!canWebAudio()) return false;
    if (ctx) return true;

    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();

    musicGain.connect(master);
    sfxGain.connect(master);
    master.connect(ctx.destination);

    applyGains();
    return true;
  }

  function applyGains() {
    if (!master) return;
    const m = muteAll ? 0 : 1;
    master.gain.value = m;

    if (musicGain) musicGain.gain.value = (musicOn ? musicVol : 0);
    if (sfxGain) sfxGain.gain.value = (sfxOn ? sfxVol : 0);
  }

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("audio fetch failed");
    return await res.arrayBuffer();
  }

  async function decodeToBuffer(url) {
    if (!ensureCtx()) return null;
    if (bufCache.has(url)) return bufCache.get(url);

    const ab = await fetchArrayBuffer(url);
    const b = await ctx.decodeAudioData(ab.slice(0));
    bufCache.set(url, b);
    return b;
  }

  function playBeep(freq = 440, dur = 0.06, gain = 0.15) {
    try {
      if (!ensureCtx()) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = gain * (muteAll ? 0 : 1);
      o.connect(g);
      g.connect(sfxGain || ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {}
  }

  async function unlock(force = false) {
    try {
      if (!ensureCtx()) { unlocked = true; return true; }
      if (unlocked && !force) return true;

      // iOS: resume en gesto
      if (ctx.state !== "running") await ctx.resume();

      // pequeño "silence ping"
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(master);
      s.start(0);

      unlocked = true;
      return true;
    } catch {
      unlocked = true;
      return true;
    }
  }

  async function sfx(name) {
    try {
      if (!sfxOn || muteAll) return false;
      await unlock();

      const file = SFX_MAP[name] || null;
      if (!file) { playBeep(520, 0.05, 0.12); return false; }

      const url = new URL(file, BASE).toString();
      const b = await decodeToBuffer(url);
      if (!b) { playBeep(520, 0.05, 0.12); return false; }

      const src = ctx.createBufferSource();
      src.buffer = b;

      const g = ctx.createGain();
      g.gain.value = 1;

      src.connect(g);
      g.connect(sfxGain);

      src.start();
      return true;
    } catch {
      playBeep(520, 0.05, 0.10);
      return false;
    }
  }

  async function loadMusic() {
    if (musicBuf) return musicBuf;
    if (!ensureCtx()) return null;

    for (const file of MUSIC_FILES) {
      try {
        const url = new URL(file, BASE).toString();
        musicBuf = await decodeToBuffer(url);
        if (musicBuf) return musicBuf;
      } catch {}
    }
    return null;
  }

  async function startMusic() {
    try {
      if (!musicOn || muteAll) return;
      await unlock();

      if (!ensureCtx()) return;
      if (musicSource) return;

      const b = await loadMusic();
      if (!b) return;

      const src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;

      const g = ctx.createGain();
      g.gain.value = 1;

      src.connect(g);
      g.connect(musicGain);

      src.start(0);
      musicSource = src;
    } catch {}
  }

  function stopMusic() {
    try {
      if (musicSource) {
        musicSource.stop();
        musicSource.disconnect();
      }
    } catch {}
    musicSource = null;
  }

  function duckMusic(on) {
    try {
      if (!musicGain) return;
      musicGain.gain.value = on ? (musicOn ? musicVol * 0.35 : 0) : (musicOn ? musicVol : 0);
    } catch {}
  }

  function setMute(v) { muteAll = !!v; applyGains(); }
  function setMusicOn(v) { musicOn = !!v; applyGains(); if (!musicOn) stopMusic(); }
  function setSfxOn(v) { sfxOn = !!v; applyGains(); }
  function setVolumes(o = {}) {
    if (Number.isFinite(o.music)) musicVol = Math.max(0, Math.min(1, o.music));
    if (Number.isFinite(o.sfx)) sfxVol = Math.max(0, Math.min(1, o.sfx));
    applyGains();
  }

  function getState() {
    return { muteAll, musicOn, sfxOn, musicVol, sfxVol, unlocked };
  }

  window.AudioSys = {
    unlock,
    sfx,
    startMusic,
    stopMusic,
    duckMusic,
    setMute,
    setMusicOn,
    setSfxOn,
    setVolumes,
    getState
  };
})();
