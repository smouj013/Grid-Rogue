/* audio.js — Grid Rogue v0.1.7
   ✅ Binds de opciones de audio (Music/SFX + volúmenes + Mute All + Test)
   ✅ Compatible con app.js v0.1.7 y AudioSys (audio_sys.js)
   ✅ Compatible con auth.js (prefs por perfil) SIN romper si no existe Auth
   ✅ Si existe utils.js (window.Utils), lo aprovecha, si no -> fallback interno
   ✅ No rompe si faltan elementos DOM o si AudioSys aún no está listo
   ✅ No toca playbackRate; solo aplica settings y arranca con gesto
   ✅ v0.1.7:
      - Soporta clave nueva gridrogue_settings_v1 + legacy gridrunner_settings_v1
      - Guarda audio también en prefs del perfil activo (si Auth está disponible)
      - Watcher ligero: si cambias de perfil, re-sincroniza audio/UI automáticamente
*/

(() => {
  "use strict";

  // ───────────────────────── Utils (best-effort) ─────────────────────────
  const U = window.Utils || null;

  const clamp = U?.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const $ = U?.$ || ((id) => document.getElementById(id));

  const safeNum =
    U?.safeNum ||
    ((x, fallback = 0) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : fallback;
    });

  const safeParse =
    U?.safeParse ||
    ((raw, fallback) => {
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    });

  const canLS =
    U?.canLS ||
    (() => {
      try {
        const k = "__ls_test__";
        localStorage.setItem(k, "1");
        localStorage.removeItem(k);
        return true;
      } catch {
        return false;
      }
    });

  function readLS(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }

  // ───────────────────────── Keys ─────────────────────────
  const SETTINGS_KEY = "gridrogue_settings_v1";     // nuevo
  const LEGACY_SETTINGS_KEY = "gridrunner_settings_v1"; // legacy (compat)

  // ───────────────────────── Defaults ─────────────────────────
  const defaultSettings = () => ({
    musicOn: true,
    sfxOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,
  });

  function sanitizeSettings(s) {
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
  }

  function getAudioSys() {
    // audio_sys.js debería exponer window.AudioSys
    return window.AudioSys || null;
  }

  function getAuth() {
    // auth.js debería exponer window.Auth
    return window.Auth || null;
  }

  // ───────────────────────── Perfil (prefs) ─────────────────────────
  function getProfileId() {
    const Auth = getAuth();
    try {
      const p = Auth?.getActiveProfile?.();
      return p?.id || null;
    } catch {
      return null;
    }
  }

  function loadAudioFromProfilePrefs() {
    const Auth = getAuth();
    try {
      const prefs = Auth?.getPrefsForActive?.();
      if (!prefs || typeof prefs !== "object") return null;

      const hasAny =
        ("musicOn" in prefs) || ("sfxOn" in prefs) ||
        ("musicVol" in prefs) || ("sfxVol" in prefs) ||
        ("muteAll" in prefs);

      if (!hasAny) return null;

      return sanitizeSettings({
        musicOn: prefs.musicOn,
        sfxOn: prefs.sfxOn,
        musicVol: prefs.musicVol,
        sfxVol: prefs.sfxVol,
        muteAll: prefs.muteAll,
      });
    } catch {
      return null;
    }
  }

  function saveAudioToProfilePrefs(nextSettings) {
    const Auth = getAuth();
    if (!Auth?.setPrefsForActive) return false;

    try {
      const prev = Auth.getPrefsForActive?.() || {};
      const merged = {
        ...prev,
        musicOn: !!nextSettings.musicOn,
        sfxOn: nextSettings.sfxOn !== false,
        musicVol: clamp(safeNum(nextSettings.musicVol, 0.6), 0, 1),
        sfxVol: clamp(safeNum(nextSettings.sfxVol, 0.9), 0, 1),
        muteAll: !!nextSettings.muteAll,
      };
      return !!Auth.setPrefsForActive(merged);
    } catch {
      return false;
    }
  }

  // ───────────────────────── Load/Save ─────────────────────────
  function loadFromLocalStorage() {
    const base = defaultSettings();
    if (!canLS()) return base;

    const rawNew = readLS(SETTINGS_KEY);
    const rawOld = readLS(LEGACY_SETTINGS_KEY);

    const sNew = rawNew ? safeParse(rawNew, null) : null;
    const sOld = rawOld ? safeParse(rawOld, null) : null;

    return sanitizeSettings(sNew || sOld || base);
  }

  let settings = (() => {
    const fromProfile = loadAudioFromProfilePrefs();
    if (fromProfile) return fromProfile;
    return loadFromLocalStorage();
  })();

  let saveT = 0;
  function saveSettingsGlobal() {
    if (!canLS()) return;

    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const payload = JSON.stringify(settings);
      writeLS(SETTINGS_KEY, payload);
      writeLS(LEGACY_SETTINGS_KEY, payload); // compat
    }, 60);
  }

  function saveSettingsEverywhere() {
    saveSettingsGlobal();
    saveAudioToProfilePrefs(settings); // best-effort
  }

  // ───────────────────────── Apply ─────────────────────────
  function applyAudioSettingsNow() {
    const A = getAudioSys();
    if (!A) return;

    try {
      if (typeof A.applySettings === "function") {
        A.applySettings(settings);
      } else {
        A.setMute?.(!!settings.muteAll);
        A.setSfxOn?.(settings.sfxOn !== false);
        A.setMusicOn?.(!!settings.musicOn);
        A.setVolumes?.({ music: settings.musicVol, sfx: settings.sfxVol });
      }

      if (settings.muteAll || !settings.musicOn || settings.musicVol <= 0.001) {
        A.stopMusic?.();
      }
    } catch {}
  }

  async function unlockGesture() {
    const A = getAudioSys();
    try { await A?.unlock?.(); } catch {}
  }

  function maybeStartMusic() {
    const A = getAudioSys();
    if (!A) return;
    try {
      if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) {
        A.startMusic?.();
      }
    } catch {}
  }

  // ✅ Auto-unlock en primer gesto (pero NO “consume” el gesto si AudioSys aún no existe)
  let didAutoUnlock = false;
  function bindGlobalUnlock() {
    const handler = async () => {
      if (didAutoUnlock) return;

      const A = getAudioSys();
      if (!A) return; // AudioSys aún no cargó -> esperamos a otro gesto

      didAutoUnlock = true;

      await unlockGesture();
      applyAudioSettingsNow();
      maybeStartMusic();

      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("touchstart", handler, true);
    };

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("keydown", handler, true);
    window.addEventListener("touchstart", handler, true);
  }

  // ───────────────────────── DOM refs ─────────────────────────
  const optMusicOn = $("optMusicOn");
  const optSfxOn = $("optSfxOn");
  const optMusicVol = $("optMusicVol");
  const optMusicVolValue = $("optMusicVolValue");
  const optSfxVol = $("optSfxVol");
  const optSfxVolValue = $("optSfxVolValue");
  const optMuteAll = $("optMuteAll");
  const btnTestAudio = $("btnTestAudio");

  // Compat ids viejos
  const optMusic = optMusicOn || $("optMusic");
  const optSfx = optSfxOn || $("optSfx");

  function syncUIFromSettings() {
    if (optMusic) optMusic.checked = !!settings.musicOn;
    if (optSfx) optSfx.checked = (settings.sfxOn !== false);

    if (optMusicVol) optMusicVol.value = String(settings.musicVol);
    if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);

    if (optSfxVol) optSfxVol.value = String(settings.sfxVol);
    if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);

    if (optMuteAll) optMuteAll.checked = !!settings.muteAll;
  }

  // ───────────────────────── Binds ─────────────────────────
  function bind() {
    // Music ON/OFF
    optMusic?.addEventListener("change", async () => {
      await unlockGesture();

      settings.musicOn = !!optMusic.checked;
      saveSettingsEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) A?.startMusic?.();
        else A?.stopMusic?.();
      } catch {}

      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 60 }); } catch {}
    });

    // SFX ON/OFF
    optSfx?.addEventListener("change", async () => {
      await unlockGesture();

      settings.sfxOn = !!optSfx.checked;
      saveSettingsEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 60 }); } catch {}
    });

    // Music volume
    optMusicVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.60"), 0, 1);
      if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);

      saveSettingsEverywhere();
      applyAudioSettingsNow();
      maybeStartMusic();
    });

    // SFX volume
    optSfxVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.90"), 0, 1);
      if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);

      saveSettingsEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try { if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui", { cooldownMs: 80, gain: 0.75 }); } catch {}
    });

    // Mute All
    optMuteAll?.addEventListener("change", async () => {
      await unlockGesture();

      settings.muteAll = !!optMuteAll.checked;
      saveSettingsEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try { if (settings.muteAll) A?.stopMusic?.(); } catch {}
    });

    // Test Audio
    btnTestAudio?.addEventListener("click", async () => {
      await unlockGesture();

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

  // ───────────────────────── Watcher de perfil (ligero) ─────────────────────────
  let lastProfileId = null;

  function startProfileWatcher() {
    lastProfileId = getProfileId();

    setInterval(() => {
      const cur = getProfileId();
      if (cur === lastProfileId) return;
      lastProfileId = cur;

      const fromProfile = loadAudioFromProfilePrefs();
      settings = fromProfile ? fromProfile : loadFromLocalStorage();

      syncUIFromSettings();
      applyAudioSettingsNow();
    }, 1500);
  }

  // ───────────────────────── Public API ─────────────────────────
  window.AudioUI = {
    getSettings: () => ({ ...settings }),
    setSettings: (partial) => {
      settings = sanitizeSettings({ ...settings, ...(partial || {}) });
      saveSettingsEverywhere();
      syncUIFromSettings();
      applyAudioSettingsNow();
      return { ...settings };
    },
    sync: () => {
      syncUIFromSettings();
      applyAudioSettingsNow();
    },
    unlock: async () => {
      await unlockGesture();
      applyAudioSettingsNow();
      maybeStartMusic();
    },
  };

  // ───────────────────────── Boot ─────────────────────────
  function boot() {
    const fromProfile = loadAudioFromProfilePrefs();
    if (fromProfile) settings = fromProfile;

    syncUIFromSettings();
    applyAudioSettingsNow();

    bindGlobalUnlock();
    bind();
    startProfileWatcher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
