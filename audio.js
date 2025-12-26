/* audio.js — Grid Rogue v1.0.0
   UI/Bindings de opciones de audio (Music/SFX + volúmenes + Mute + Test)
   - Compatible con AudioSys (audio_sys.js)
   - Compatible con Auth (prefs por perfil) si existe
   - MUY IMPORTANTE: NO sobrescribe gridrogue_settings_v1 completo:
     hace MERGE y solo toca campos de audio.
*/
(() => {
  "use strict";

  const VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.0.0");

  const U = window.GRUtils || window.Utils || null;
  const clamp = U?.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const $ = U?.$ || ((id) => document.getElementById(id));

  const safeNum = U?.safeNum || ((x, fb = 0) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : fb;
  });

  const safeParse = U?.safeParse || ((raw, fb) => {
    try { return JSON.parse(raw); } catch (_) { return fb; }
  });

  const canLS = U?.canLS || (() => {
    try {
      const k = "__ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (_) { return false; }
  });

  function readLS(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function writeLS(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }

  const SETTINGS_KEY = "gridrogue_settings_v1";
  const LEGACY_SETTINGS_KEY = "gridrunner_settings_v1";

  const defaultAudio = () => ({
    musicOn: true,
    sfxOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,
  });

  function sanitizeAudio(s) {
    const base = defaultAudio();
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

  function getAudioSys() { return window.AudioSys || null; }
  function getAuth() { return window.Auth || null; }

  function readFullSettingsFromLS() {
    if (!canLS()) return null;
    const rawNew = readLS(SETTINGS_KEY);
    const rawOld = readLS(LEGACY_SETTINGS_KEY);
    const obj = safeParse(rawNew || rawOld || "null", null);
    return (obj && typeof obj === "object") ? obj : null;
  }

  function writeFullSettingsToLS(obj) {
    if (!canLS()) return false;
    const json = JSON.stringify(obj || {});
    const ok1 = writeLS(SETTINGS_KEY, json);
    const ok2 = writeLS(LEGACY_SETTINGS_KEY, json);
    return !!(ok1 || ok2);
  }

  function extractAudioFromAnySettingsObject(obj) {
    if (!obj || typeof obj !== "object") return null;
    const hasAny = ("musicOn" in obj) || ("sfxOn" in obj) || ("musicVol" in obj) || ("sfxVol" in obj) || ("muteAll" in obj);
    if (!hasAny) return null;
    return sanitizeAudio({
      musicOn: obj.musicOn,
      sfxOn: obj.sfxOn,
      musicVol: obj.musicVol,
      sfxVol: obj.sfxVol,
      muteAll: obj.muteAll,
    });
  }

  function mergeAudioIntoSettingsObject(fullObj, audioObj) {
    const base = (fullObj && typeof fullObj === "object") ? fullObj : {};
    return {
      ...base,
      musicOn: !!audioObj.musicOn,
      sfxOn: audioObj.sfxOn !== false,
      musicVol: clamp(safeNum(audioObj.musicVol, 0.6), 0, 1),
      sfxVol: clamp(safeNum(audioObj.sfxVol, 0.9), 0, 1),
      muteAll: !!audioObj.muteAll,
    };
  }

  function loadAudioFromProfilePrefs() {
    const Auth = getAuth();
    try {
      const prefs = Auth?.getPrefsForActive?.();
      if (!prefs || typeof prefs !== "object") return null;

      const audio = extractAudioFromAnySettingsObject(prefs);
      return audio;
    } catch (_) {
      return null;
    }
  }

  function saveAudioToProfilePrefs(audioObj) {
    const Auth = getAuth();
    if (!Auth?.setPrefsForActive) return false;

    try {
      const prev = Auth.getPrefsForActive?.() || {};
      const merged = mergeAudioIntoSettingsObject(prev, audioObj);
      return !!Auth.setPrefsForActive(merged);
    } catch (_) {
      return false;
    }
  }

  function loadAudioBestEffort() {
    const fromProfile = loadAudioFromProfilePrefs();
    if (fromProfile) return fromProfile;

    const full = readFullSettingsFromLS();
    const fromFull = extractAudioFromAnySettingsObject(full);
    return fromFull || defaultAudio();
  }

  let settings = loadAudioBestEffort();

  let saveT = 0;
  function saveAudioEverywhere() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const full = readFullSettingsFromLS() || {};
      const merged = mergeAudioIntoSettingsObject(full, settings);
      writeFullSettingsToLS(merged);
      saveAudioToProfilePrefs(settings);
    }, 60);
  }

  let musicAttempted = false;

  function applyAudioSettingsNow() {
    const A = getAudioSys();
    if (!A) return;

    try { A.setAllowProceduralMusic?.(false); } catch (_) {}

    try {
      A.setMute?.(!!settings.muteAll);
      A.setSfxOn?.(settings.sfxOn !== false);
      A.setMusicOn?.(!!settings.musicOn);
      A.setVolumes?.({ music: settings.musicVol, sfx: settings.sfxVol });

      if (settings.muteAll || !settings.musicOn || settings.musicVol <= 0.001) {
        A.stopMusic?.();
      }
    } catch (_) {}
  }

  async function unlockGesture() {
    const A = getAudioSys();
    try { await A?.unlock?.(); } catch (_) {}
  }

  function canTryMusicStart(A) {
    try {
      const st = A?.getState?.() || {};
      if (!("musicMode" in st)) return true;
      if (st.musicMode === "procedural") return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  async function maybeStartMusic() {
    const A = getAudioSys();
    if (!A) return;

    if (!settings.musicOn || settings.muteAll || settings.musicVol <= 0.001) return;
    if (!canTryMusicStart(A)) return;
    if (musicAttempted) return;

    musicAttempted = true;

    try {
      await A.startMusic?.();
      if (!canTryMusicStart(A)) {
        try { A.stopMusic?.(); } catch (_) {}
      }
    } catch (_) {
      try { A.stopMusic?.(); } catch (_) {}
    }
  }

  let didAutoUnlock = false;
  function bindGlobalUnlock() {
    const handler = async () => {
      if (didAutoUnlock) return;

      const A = getAudioSys();
      if (!A) return; // aún no cargó

      didAutoUnlock = true;

      await unlockGesture();
      applyAudioSettingsNow();
      await maybeStartMusic();

      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("touchstart", handler, true);
    };

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("keydown", handler, true);
    window.addEventListener("touchstart", handler, true);
  }

  const optMusicOn = $("optMusicOn");
  const optSfxOn = $("optSfxOn");
  const optMusicVol = $("optMusicVol");
  const optMusicVolValue = $("optMusicVolValue");
  const optSfxVol = $("optSfxVol");
  const optSfxVolValue = $("optSfxVolValue");
  const optMuteAll = $("optMuteAll");
  const btnTestAudio = $("btnTestAudio");

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

  async function playUiClick() {
    const A = getAudioSys();
    try {
      if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui");
    } catch (_) {}
  }

  function bind() {
    optMusic?.addEventListener("change", async () => {
      await unlockGesture();

      settings.musicOn = !!optMusic.checked;
      musicAttempted = false;

      saveAudioEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) {
          await maybeStartMusic();
        } else {
          A?.stopMusic?.();
        }
      } catch (_) {}

      await playUiClick();
    });

    optSfx?.addEventListener("change", async () => {
      await unlockGesture();

      settings.sfxOn = !!optSfx.checked;
      saveAudioEverywhere();
      applyAudioSettingsNow();

      await playUiClick();
    });

    optMusicVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.60"), 0, 1);
      if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);

      saveAudioEverywhere();
      applyAudioSettingsNow();

      if (settings.musicVol > 0.001) {
        musicAttempted = false;
        await maybeStartMusic();
      }
    });

    optSfxVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.90"), 0, 1);
      if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);

      saveAudioEverywhere();
      applyAudioSettingsNow();

      await playUiClick();
    });

    optMuteAll?.addEventListener("change", async () => {
      await unlockGesture();

      settings.muteAll = !!optMuteAll.checked;
      saveAudioEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try { if (settings.muteAll) A?.stopMusic?.(); } catch (_) {}
    });

    btnTestAudio?.addEventListener("click", async () => {
      await unlockGesture();

      syncUIFromSettings();
      applyAudioSettingsNow();

      musicAttempted = false;
      await maybeStartMusic();

      const A = getAudioSys();
      try {
        if (settings.sfxOn && !settings.muteAll) {
          await A?.sfx?.("coin");
          await A?.sfx?.("ui");
          await A?.sfx?.("hurt");
          await A?.sfx?.("heal");
        }
      } catch (_) {}
    });
  }

  let lastProfileId = null;
  function getProfileId() {
    const Auth = getAuth();
    try {
      const p = Auth?.getActiveProfile?.();
      return p?.id || null;
    } catch (_) { return null; }
  }

  function startProfileWatcher() {
    lastProfileId = getProfileId();

    setInterval(() => {
      const cur = getProfileId();
      if (cur === lastProfileId) return;
      lastProfileId = cur;

      const fromProfile = loadAudioFromProfilePrefs();
      settings = fromProfile ? fromProfile : loadAudioBestEffort();

      musicAttempted = false;
      syncUIFromSettings();
      applyAudioSettingsNow();
    }, 1500);
  }

  window.AudioUI = {
    VERSION,
    getSettings: () => ({ ...settings }),
    setSettings: (partial) => {
      settings = sanitizeAudio({ ...settings, ...(partial || {}) });
      musicAttempted = false;
      saveAudioEverywhere();
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
      musicAttempted = false;
      await maybeStartMusic();
    },

    sfx: async (name) => {
      await unlockGesture();
      const A = getAudioSys();
      try { if (settings.sfxOn && !settings.muteAll) return await A?.sfx?.(name); } catch (_) {}
      return false;
    },

    hurt: async () => window.AudioUI.sfx("hurt"),
    heal: async () => window.AudioUI.sfx("heal"),
    magnetOn: async () => window.AudioUI.sfx("magnet_on"),
    magnetOff: async () => window.AudioUI.sfx("magnet_off"),
    upgradeOpen: async () => window.AudioUI.sfx("upgrade_open"),
    upgradePick: async () => window.AudioUI.sfx("upgrade_pick"),
  };

  function boot() {
    settings = loadAudioBestEffort();
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
