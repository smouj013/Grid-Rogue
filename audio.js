/* audio.js — Grid Rogue v0.1.9
   ✅ UI/Bindings de opciones de audio (Music/SFX + volúmenes + Mute All + Test)
   ✅ Compatible con app.js v0.1.9 y AudioSys (audio_sys.js)
   ✅ Compatible con auth.js (prefs por perfil) SIN romper si no existe Auth
   ✅ Best-effort: si faltan DOM / AudioSys no listo / localStorage falla -> NO explota
   ✅ Guarda en:
      - gridrogue_settings_v1 (nuevo)
      - gridrunner_settings_v1 (legacy compat)
      - prefs del perfil activo (si Auth disponible)
   ✅ Watcher ligero: cambio de perfil => re-sync audio/UI
   ✅ v0.1.9:
      - “NO música procedural” reforzado: pide al AudioSys interno desactivar fallback procedural.
      - Alias SFX extra para gameplay/UI: hurt/heal/heart/magnet_on/magnet_off/upgrade_open/upgrade_pick/...
*/

(() => {
  "use strict";

  const VERSION = "0.1.9";

  // ───────────────────────── Utils (best-effort) ─────────────────────────
  const U = window.GRUtils || window.Utils || null;

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
      try { return JSON.parse(raw); } catch { return fallback; }
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

  function readLS(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function writeLS(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }

  // ───────────────────────── Keys ─────────────────────────
  const SETTINGS_KEY = "gridrogue_settings_v1";
  const LEGACY_SETTINGS_KEY = "gridrunner_settings_v1";

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

  function getAudioSys() { return window.AudioSys || null; }
  function getAuth() { return window.Auth || null; }

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

  // ───────────────────────── Helpers: “No procedural music” ─────────────────────────
  let musicAttempted = false;

  function canTryMusicStart(A) {
    try {
      const st = A?.getState?.() || {};
      // si no expone musicMode, asumimos engine externo o wrapper => OK
      if (!("musicMode" in st)) return true;

      // motor interno:
      if (st.musicMode === "procedural") return false;
      if (st.musicMode === "html" || st.musicMode === "none") return true;

      return true;
    } catch {
      return true;
    }
  }

  // ───────────────────────── Apply ─────────────────────────
  function applyAudioSettingsNow() {
    const A = getAudioSys();
    if (!A) return;

    try {
      // v0.1.9: fuerza NO procedural si el AudioSys interno soporta el flag
      A.setAllowProceduralMusic?.(false);
    } catch {}

    try {
      A.setMute?.(!!settings.muteAll);
      A.setSfxOn?.(settings.sfxOn !== false);
      A.setMusicOn?.(!!settings.musicOn);
      A.setVolumes?.({ music: settings.musicVol, sfx: settings.sfxVol });

      if (settings.muteAll || !settings.musicOn || settings.musicVol <= 0.001) {
        A.stopMusic?.();
      }
    } catch {}
  }

  async function unlockGesture() {
    const A = getAudioSys();
    try { await A?.unlock?.(); } catch {}
  }

  async function maybeStartMusic() {
    const A = getAudioSys();
    if (!A) return;

    if (!settings.musicOn || settings.muteAll || settings.musicVol <= 0.001) return;

    // NO insistimos si vemos que caería a procedural.
    if (!canTryMusicStart(A)) return;

    if (musicAttempted) return;
    musicAttempted = true;

    try {
      await A.startMusic?.();

      // Re-check: si tras startMusic el motor cae a procedural, paramos y silencio.
      if (!canTryMusicStart(A)) {
        try { A.stopMusic?.(); } catch {}
      }
    } catch {
      try { A.stopMusic?.(); } catch {}
    }
  }

  // ✅ Auto-unlock en primer gesto (pero NO “consume” el gesto si AudioSys aún no existe)
  let didAutoUnlock = false;
  function bindGlobalUnlock() {
    const handler = async () => {
      if (didAutoUnlock) return;

      const A = getAudioSys();
      if (!A) return; // aún no cargó -> esperamos a otro gesto

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

  async function playUiClick() {
    const A = getAudioSys();
    try {
      if (settings.sfxOn && !settings.muteAll) await A?.sfx?.("ui");
    } catch {}
  }

  // ───────────────────────── Binds ─────────────────────────
  function bind() {
    // Music ON/OFF
    optMusic?.addEventListener("change", async () => {
      await unlockGesture();

      settings.musicOn = !!optMusic.checked;
      musicAttempted = false; // permitir reintento si se vuelve a activar
      saveSettingsEverywhere();
      applyAudioSettingsNow();

      const A = getAudioSys();
      try {
        if (settings.musicOn && !settings.muteAll && settings.musicVol > 0.001) {
          await maybeStartMusic();
        } else {
          A?.stopMusic?.();
        }
      } catch {}

      await playUiClick();
    });

    // SFX ON/OFF
    optSfx?.addEventListener("change", async () => {
      await unlockGesture();

      settings.sfxOn = !!optSfx.checked;
      saveSettingsEverywhere();
      applyAudioSettingsNow();

      await playUiClick();
    });

    // Music volume
    optMusicVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.60"), 0, 1);
      if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);

      saveSettingsEverywhere();
      applyAudioSettingsNow();

      // si sube desde 0, intentamos una vez (sin procedural)
      if (settings.musicVol > 0.001) {
        musicAttempted = false;
        await maybeStartMusic();
      }
    });

    // SFX volume
    optSfxVol?.addEventListener("input", async () => {
      await unlockGesture();

      settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.90"), 0, 1);
      if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);

      saveSettingsEverywhere();
      applyAudioSettingsNow();

      await playUiClick();
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

      // Música: solo si se puede sin procedural
      musicAttempted = false;
      await maybeStartMusic();

      const A = getAudioSys();
      try {
        if (settings.sfxOn && !settings.muteAll) {
          await A?.sfx?.("coin");
          await A?.sfx?.("ui");
          await A?.sfx?.("hurt"); // nuevo alias (vida/corazones)
          await A?.sfx?.("heal"); // nuevo alias (vida/corazones)
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

      musicAttempted = false;

      syncUIFromSettings();
      applyAudioSettingsNow();
      // no autostart aquí; esperamos gesto o botón
    }, 1500);
  }

  // ───────────────────────── Public API ─────────────────────────
  window.AudioUI = {
    VERSION,
    getSettings: () => ({ ...settings }),
    setSettings: (partial) => {
      settings = sanitizeSettings({ ...settings, ...(partial || {}) });
      musicAttempted = false;
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
      musicAttempted = false;
      await maybeStartMusic();
    },

    // sfx general (mantiene compat)
    sfx: async (name) => {
      await unlockGesture();
      const A = getAudioSys();
      try { if (settings.sfxOn && !settings.muteAll) return await A?.sfx?.(name); } catch {}
      return false;
    },

    // helpers (opcionales) para gameplay/UI v0.1.9
    hurt: async () => window.AudioUI.sfx("hurt"),
    heal: async () => window.AudioUI.sfx("heal"),
    magnetOn: async () => window.AudioUI.sfx("magnet_on"),
    magnetOff: async () => window.AudioUI.sfx("magnet_off"),
    upgradeOpen: async () => window.AudioUI.sfx("upgrade_open"),
    upgradePick: async () => window.AudioUI.sfx("upgrade_pick"),
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
