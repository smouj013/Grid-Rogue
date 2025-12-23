/* audio.js — Grid Runner (PWA) v0.1.6
   - Binds de opciones de audio (Music/SFX + volúmenes + Mute All + Test)
   - 100% compatible con app.js v0.1.5+ y AudioSys (si existe)
   - No rompe si faltan elementos DOM o si AudioSys no está aún listo
   - Evita “música rara”: no toca playbackRate; solo aplica settings y arranca con gesto
*/

(() => {
  "use strict";

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = (id) => document.getElementById(id);

  const safeNum = (x, fallback = 0) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  };

  // ───────────────────────── Keys (mismos que app.js) ─────────────────────────
  const SETTINGS_KEY = "gridrunner_settings_v1";

  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };

  const defaultSettings = () => ({
    // audio v0.1.6
    musicOn: true,
    sfxOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,
  });

  let settings = (() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? safeParse(raw, null) : null;
    const base = defaultSettings();
    if (!s || typeof s !== "object") return base;

    return {
      ...base,
      ...s,
      musicOn: (s.musicOn ?? base.musicOn) !== false,
      sfxOn: (s.sfxOn ?? base.sfxOn) !== false,
      musicVol: clamp(safeNum(s.musicVol, base.musicVol), 0, 1),
      sfxVol: clamp(safeNum(s.sfxVol, base.sfxVol), 0, 1),
      muteAll: !!(s.muteAll ?? base.muteAll),
    };
  })();

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function getAudioSys() {
    return window.AudioSys || null;
  }

  function applyAudioSettingsNow() {
    const A = getAudioSys();
    if (!A) return;

    try {
      // v0.1.6 preferido
      if (typeof A.applySettings === "function") {
        A.applySettings(settings);
        return;
      }

      // fallback compatible con v0.1.5
      A.setMute?.(!!settings.muteAll);
      A.setSfxOn?.(settings.sfxOn !== false);
      A.setMusicOn?.(!!settings.musicOn);
      A.setVolumes?.({ music: settings.musicVol, sfx: settings.sfxVol });
    } catch {}
  }

  async function unlockGesture() {
    const A = getAudioSys();
    try { await A?.unlock?.(); } catch {}
  }

  // ───────────────────────── DOM refs ─────────────────────────
  // IDs esperados (si alguno no existe, no pasa nada)
  const optMusicOn = $("optMusicOn");           // checkbox
  const optSfxOn = $("optSfxOn");               // checkbox (nuevo)
  const optMusicVol = $("optMusicVol");         // range
  const optMusicVolValue = $("optMusicVolValue"); // span
  const optSfxVol = $("optSfxVol");             // range
  const optSfxVolValue = $("optSfxVolValue");   // span
  const optMuteAll = $("optMuteAll");           // checkbox
  const btnTestAudio = $("btnTestAudio");       // button

  // Compat: si tu HTML viejo usa ids diferentes (v0.1.5)
  // optMusic / optSfx como alias
  const optMusic = optMusicOn || $("optMusic");
  const optSfx = optSfxOn || $("optSfx");

  // ───────────────────────── UI sync ─────────────────────────
  function syncUIFromSettings() {
    if (optMusic) optMusic.checked = !!settings.musicOn;
    if (optSfx) optSfx.checked = (settings.sfxOn !== false);

    if (optMusicVol) optMusicVol.value = String(settings.musicVol);
    if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);

    if (optSfxVol) optSfxVol.value = String(settings.sfxVol);
    if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);

    if (optMuteAll) optMuteAll.checked = !!settings.muteAll;
  }

  // ───────────────────────── Binds v0.1.6 ─────────────────────────
  function bind() {
    // Music ON/OFF
    optMusic?.addEventListener("change", async () => {
      await unlockGesture();
      settings.musicOn = !!optMusic.checked;
      saveSettings();

      applyAudioSettingsNow();

      // Solo arranca/para si existe AudioSys
      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) A?.startMusic?.();
        else A?.stopMusic?.();
      } catch {}

      // UI click (si SFX ON)
      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 60 }); } catch {}
    });

    // SFX ON/OFF
    optSfx?.addEventListener("change", async () => {
      await unlockGesture();
      settings.sfxOn = !!optSfx.checked;
      saveSettings();

      applyAudioSettingsNow();

      const A = getAudioSys();
      // Si acabas de activar SFX, prueba un click
      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 60 }); } catch {}
    });

    // Music volume
    optMusicVol?.addEventListener("input", async () => {
      await unlockGesture();
      settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.60"), 0, 1);
      if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
      saveSettings();

      applyAudioSettingsNow();

      // si música ON, asegura play (con gesto ya hecho)
      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) A?.startMusic?.();
      } catch {}
    });

    // SFX volume
    optSfxVol?.addEventListener("input", async () => {
      await unlockGesture();
      settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.90"), 0, 1);
      if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
      saveSettings();

      applyAudioSettingsNow();

      const A = getAudioSys();
      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 80, gain: 0.75 }); } catch {}
    });

    // Mute All
    optMuteAll?.addEventListener("change", async () => {
      await unlockGesture();
      settings.muteAll = !!optMuteAll.checked;
      saveSettings();

      applyAudioSettingsNow();

      // Si muteAll => música parada por AudioSys (según tu implementación)
    });

    // Test Audio
    btnTestAudio?.addEventListener("click", async () => {
      await unlockGesture();

      // refresca desde settings actuales por si el usuario tocó cosas sin listener
      syncUIFromSettings();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) A?.startMusic?.();
      } catch {}

      try {
        if (settings.sfxOn && !settings.muteAll) {
          await A?.sfx?.("coin", { cooldownMs: 120 });
          await A?.sfx?.("ui", { cooldownMs: 120 });
        }
      } catch {}
    });
  }

  // ───────────────────────── Boot local ─────────────────────────
  function boot() {
    syncUIFromSettings();
    applyAudioSettingsNow();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
