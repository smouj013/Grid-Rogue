/* auth.js — Grid Rogue v0.1.8
   ✅ Perfiles locales (robusto)
   ✅ Migración:
      - gridrunner_auth_v1  -> gridrogue_auth_v1 (sin perder datos)
      - gridrunner_name_v1 + gridrunner_best_v1 (solo si NO hay perfiles)
   ✅ Validación + saneado de estado (corrige ids/valores raros)
   ✅ API estable (no rompe app.js): list/get/set/create/best + rename/delete/export/import/prefs
   ✅ Prefs por perfil ampliadas (opcional): particles / reduceMotion / uiHue / mobileControls / mobileGridRows
   ✅ Best-effort: si localStorage falla, NO explota
   ✅ Compatible con utils.js (GRUtils o Utils) si existe (fallback interno si no)
*/

(() => {
  "use strict";

  const VERSION = "0.1.8";

  // ───────────────────────── Utils (best-effort) ─────────────────────────
  // Preferimos GRUtils (nuevo), luego Utils (legacy), luego fallback interno.
  const U = window.GRUtils || window.Utils || null;

  const now = U?.now || (() => Date.now());

  const safeParse =
    U?.safeParse ||
    ((raw, fallback) => {
      try { return JSON.parse(raw); } catch { return fallback; }
    });

  const safeStringify =
    U?.safeStringify ||
    ((obj, fallback = "") => {
      try { return JSON.stringify(obj); } catch { return fallback; }
    });

  const safeString = (v) => (v == null ? "" : String(v));

  const clamp =
    U?.clamp ||
    ((v, a, b) => {
      v = Number(v);
      if (!Number.isFinite(v)) v = a;
      return Math.max(a, Math.min(b, v));
    });

  const clampInt =
    U?.clampInt ||
    ((v, a, b) => {
      v = Number(v);
      if (!Number.isFinite(v)) v = a;
      v = v | 0;
      return Math.max(a, Math.min(b, v));
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
  function removeLS(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  }

  // ───────────────────────── Keys ─────────────────────────
  const AUTH_KEY = "gridrogue_auth_v1";

  // Compat (Grid Runner)
  const AUTH_KEY_OLD = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  // ───────────────────────── UID ─────────────────────────
  const hasCrypto = () => {
    try { return !!(globalThis.crypto && crypto.getRandomValues); } catch { return false; }
  };

  const uid = () => {
    if (hasCrypto()) {
      const buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return "p_" + Array.from(buf).map(n => n.toString(16).padStart(8, "0")).join("_");
    }
    return "p_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
  };

  // ───────────────────────── Helpers ─────────────────────────
  function normalizeName(name) {
    return safeString(name).trim().slice(0, 16);
  }

  function safeObj(v) {
    return (v && typeof v === "object") ? v : null;
  }

  // ───────────────────────── Prefs (opcional por perfil) ─────────────────────────
  // Compat: si prefs no existe, OK.
  // v0.1.7:
  // - particles (bool)
  // - reduceMotion (bool)
  // - uiHue (0..360)
  //
  // v0.1.8:
  // - mobileControls: "auto" | "on" | "off"
  // - mobileGridRows: 16..32 (por defecto lo decide app.js; aquí solo guardamos)
  function sanitizePrefs(prefs) {
    const o = safeObj(prefs);
    if (!o) return null;

    const out = {};

    // Gameplay/UI (existente)
    if ("useSprites" in o) out.useSprites = !!o.useSprites;
    if ("vibration" in o) out.vibration = !!o.vibration;
    if ("showDpad" in o) out.showDpad = !!o.showDpad;
    if ("fx" in o) out.fx = clamp(o.fx, 0.4, 1.25);

    // Audio
    if ("musicOn" in o) out.musicOn = !!o.musicOn;
    if ("sfxOn" in o) out.sfxOn = !!o.sfxOn;
    if ("musicVol" in o) out.musicVol = clamp(o.musicVol, 0, 1);
    if ("sfxVol" in o) out.sfxVol = clamp(o.sfxVol, 0, 1);
    if ("muteAll" in o) out.muteAll = !!o.muteAll;

    // Idioma
    if ("lang" in o) {
      const s = safeString(o.lang).trim().toLowerCase();
      const code = s.includes("-") ? s.split("-")[0] : (s.includes("_") ? s.split("_")[0] : s);
      if (code) out.lang = code.slice(0, 8);
    }

    // v0.1.7
    if ("particles" in o) out.particles = !!o.particles;
    if ("reduceMotion" in o) out.reduceMotion = !!o.reduceMotion;
    if ("uiHue" in o) out.uiHue = clampInt(o.uiHue, 0, 360);

    // v0.1.8 (controles / grid móvil)
    if ("mobileControls" in o) {
      const mc = safeString(o.mobileControls).trim().toLowerCase();
      out.mobileControls = (mc === "on" || mc === "off" || mc === "auto") ? mc : "auto";
    }
    if ("mobileGridRows" in o) {
      out.mobileGridRows = clampInt(o.mobileGridRows, 16, 32);
    }

    return Object.keys(out).length ? out : null;
  }

  // ───────────────────────── State sanitize ─────────────────────────
  function sanitizeProfile(p) {
    if (!p || typeof p !== "object") return null;

    let id = (typeof p.id === "string" && p.id.trim()) ? p.id.trim() : uid();
    const name = normalizeName(p.name) || "Jugador";

    const createdAt = Number.isFinite(+p.createdAt) ? +p.createdAt : now();
    const lastLoginAt = Number.isFinite(+p.lastLoginAt) ? +p.lastLoginAt : createdAt;

    const best = Math.max(0, (p.best | 0));
    const prefs = sanitizePrefs(p.prefs);

    return { id, name, createdAt, lastLoginAt, best, ...(prefs ? { prefs } : {}) };
  }

  function sanitizeState(st) {
    const rawProfiles = Array.isArray(st?.profiles) ? st.profiles : [];
    const cleaned = [];
    const seen = new Set();

    for (const p of rawProfiles) {
      const sp = sanitizeProfile(p);
      if (!sp) continue;

      if (seen.has(sp.id)) sp.id = uid();
      seen.add(sp.id);

      cleaned.push(sp);
    }

    cleaned.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

    let activeId = (typeof st?.activeId === "string" ? st.activeId : null);
    if (activeId && !cleaned.some(p => p.id === activeId)) {
      activeId = cleaned[0]?.id || null;
    }

    return { v: clampInt(st?.v ?? 1, 1, 99), activeId, profiles: cleaned };
  }

  function loadStateFromKey(key) {
    const raw = readLS(key);
    const st = raw ? safeParse(raw, null) : null;

    if (!st || typeof st !== "object") return null;
    if (!Array.isArray(st.profiles)) return null;

    return sanitizeState(st);
  }

  function loadState() {
    // 1) key nuevo
    const fresh = loadStateFromKey(AUTH_KEY);
    if (fresh) return { st: fresh, loadedFrom: AUTH_KEY };

    // 2) key viejo
    const old = loadStateFromKey(AUTH_KEY_OLD);
    if (old) return { st: old, loadedFrom: AUTH_KEY_OLD };

    // 3) vacío
    return { st: { v: 1, activeId: null, profiles: [] }, loadedFrom: null };
  }

  function saveState(st) {
    if (!canLS()) return false;

    const json = safeStringify(st, "");
    if (!json) return false;

    // ✅ Guardamos siempre en el nuevo
    const okNew = writeLS(AUTH_KEY, json);

    // ✅ Compat: también en el viejo (best-effort)
    writeLS(AUTH_KEY_OLD, json);

    return okNew;
  }

  function ensureMigration(st, loadedFrom) {
    // Si venimos del key viejo, persistimos en el nuevo
    if (loadedFrom === AUTH_KEY_OLD) saveState(st);

    // Si ya hay perfiles, ok
    if (st.profiles.length > 0) return st;

    // Migración legacy (solo si NO hay perfiles)
    const legacyName = normalizeName(readLS(LEGACY_NAME_KEY) || "");
    const legacyBest = parseInt(readLS(LEGACY_BEST_KEY) || "0", 10) || 0;

    const name = legacyName.length >= 2 ? legacyName : "Jugador";
    const id = uid();

    st.profiles.push({
      id,
      name,
      createdAt: now(),
      lastLoginAt: now(),
      best: Math.max(0, legacyBest | 0),
    });

    st.activeId = id;
    saveState(st);
    return st;
  }

  // ───────────────────────── Boot ─────────────────────────
  const loaded = loadState();
  const state = ensureMigration(loaded.st, loaded.loadedFrom);

  // ───────────────────────── Core API ─────────────────────────
  function listProfiles() {
    return state.profiles
      .slice()
      .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))
      .map(p => ({ ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) }));
  }

  function getActiveProfile() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    return p ? { ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) } : null;
  }

  function setActiveProfile(id) {
    const p = state.profiles.find(x => x.id === id);
    if (!p) return null;

    state.activeId = p.id;
    p.lastLoginAt = now();
    saveState(state);

    return { ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) };
  }

  function touchActiveLogin() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  function createProfile(name) {
    const nm = normalizeName(name);
    if (nm.length < 2) return null;

    const existing = state.profiles.find(p => p.name.toLowerCase() === nm.toLowerCase());
    if (existing) return setActiveProfile(existing.id);

    const id = uid();
    const p = { id, name: nm, createdAt: now(), lastLoginAt: now(), best: 0 };
    state.profiles.push(p);
    state.activeId = id;
    saveState(state);
    return { ...p };
  }

  function renameProfile(id, newName) {
    const nm = normalizeName(newName);
    if (nm.length < 2) return null;

    const p = state.profiles.find(x => x.id === id);
    if (!p) return null;

    p.name = nm;
    p.lastLoginAt = now();
    saveState(state);

    return { ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) };
  }

  function deleteProfile(id) {
    const idx = state.profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;

    const wasActive = (state.activeId === id);
    state.profiles.splice(idx, 1);

    if (state.profiles.length === 0) {
      state.activeId = null;
    } else if (wasActive) {
      state.activeId = state.profiles
        .slice()
        .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))[0].id;
    }

    saveState(state);
    return true;
  }

  function getBestForActive() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    return p ? (p.best | 0) : 0;
  }

  function setBestForActive(best) {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;

    const b = Math.max(0, best | 0);
    if (b > (p.best | 0)) {
      p.best = b;
      p.lastLoginAt = now();
      saveState(state);
      return true;
    }
    return false;
  }

  // ───────────────────────── Prefs API (opcional) ─────────────────────────
  function getPrefsForActive() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    return p && p.prefs ? { ...p.prefs } : null;
  }

  function setPrefsForActive(prefs) {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;

    const sp = sanitizePrefs(prefs);

    if (!sp) {
      if ("prefs" in p) delete p.prefs;
      p.lastLoginAt = now();
      saveState(state);
      return true;
    }

    p.prefs = sp;
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  function patchPrefsForActive(partialPrefs) {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;

    const current = p.prefs ? { ...p.prefs } : {};
    const merged = { ...current, ...(safeObj(partialPrefs) || {}) };
    return setPrefsForActive(merged);
  }

  function clearPrefsForActive() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;
    if ("prefs" in p) delete p.prefs;
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  // ───────────────────────── Export/Import ─────────────────────────
  function exportAuth() {
    const snap = sanitizeState({
      v: state.v || 1,
      activeId: state.activeId,
      profiles: state.profiles,
    });
    return safeStringify(snap, "{}") || "{}";
  }

  function importAuth(json, { merge = true } = {}) {
    const incoming = safeParse(json, null);
    if (!incoming || typeof incoming !== "object") return { ok: false, reason: "JSON inválido" };

    const inc = sanitizeState(incoming);
    if (!inc.profiles.length) return { ok: false, reason: "No hay perfiles" };

    if (!merge) {
      state.v = inc.v;
      state.profiles = inc.profiles.slice();
      state.activeId =
        (inc.activeId && inc.profiles.some(p => p.id === inc.activeId))
          ? inc.activeId
          : inc.profiles[0].id;

      saveState(state);
      return { ok: true, mode: "replace", count: state.profiles.length };
    }

    const existingIds = new Set(state.profiles.map(p => p.id));
    for (const p of inc.profiles) {
      let id = p.id;
      if (existingIds.has(id)) id = uid();
      existingIds.add(id);
      state.profiles.push({ ...p, id });
    }

    const merged = sanitizeState({
      v: Math.max(state.v || 1, inc.v || 1),
      activeId: state.activeId,
      profiles: state.profiles,
    });

    state.v = merged.v;
    state.profiles = merged.profiles;

    if (!state.activeId || !state.profiles.some(p => p.id === state.activeId)) {
      state.activeId = merged.activeId || state.profiles[0]?.id || null;
    }

    saveState(state);
    return { ok: true, mode: "merge", count: state.profiles.length };
  }

  function clearAuth() {
    state.activeId = null;
    state.profiles = [];
    saveState(state);

    // Limpieza keys (best-effort)
    removeLS(AUTH_KEY);
    removeLS(AUTH_KEY_OLD);
    return true;
  }

  function clearLegacyKeys() {
    removeLS(LEGACY_NAME_KEY);
    removeLS(LEGACY_BEST_KEY);
    return true;
  }

  // ───────────────────────── Public API ─────────────────────────
  window.Auth = {
    VERSION,

    // perfiles
    listProfiles,
    getActiveProfile,
    setActiveProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    touchActiveLogin,

    // best
    getBestForActive,
    setBestForActive,

    // export/import
    exportAuth,
    importAuth,
    clearAuth,
    clearLegacyKeys,

    // prefs (opcional)
    getPrefsForActive,
    setPrefsForActive,
    patchPrefsForActive,
    clearPrefsForActive,
  };
})();
