/* auth.js — Grid Rogue v0.1.7
   ✅ Perfiles locales (robusto)
   ✅ Migración:
      - gridrunner_auth_v1  -> gridrogue_auth_v1 (sin perder datos)
      - gridrunner_name_v1 + gridrunner_best_v1 (solo si NO hay perfiles)
   ✅ Validación + saneado de estado (corrige ids/valores raros)
   ✅ API estable (no rompe app.js): list/get/set/create/best + rename/delete/export/import/prefs
   ✅ Prefs por perfil ampliadas (opcional): incluye flags pensados para v0.1.7 (particles / reduceMotion / uiHue)
   ✅ Best-effort: si localStorage falla, NO explota
*/

(() => {
  "use strict";

  // ───────────────────────── Keys ─────────────────────────
  // Nuevo namespace (Grid Rogue)
  const AUTH_KEY = "gridrogue_auth_v1";

  // Compat: versiones antiguas (Grid Runner)
  const AUTH_KEY_OLD = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  const now = () => Date.now();

  const hasCrypto = () => {
    try { return !!(globalThis.crypto && crypto.getRandomValues); } catch { return false; }
  };

  const uid = () => {
    // Preferimos crypto para IDs más estables/únicos
    if (hasCrypto()) {
      const buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return "p_" + Array.from(buf).map(n => n.toString(16).padStart(8, "0")).join("_");
    }
    return (
      "p_" +
      Math.random().toString(16).slice(2) +
      "_" +
      Math.random().toString(16).slice(2)
    );
  };

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function safeString(v) { return (v == null) ? "" : String(v); }
  function normalizeName(name) { return safeString(name).trim().slice(0, 16); }

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function clampInt(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  }

  function readLS(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function writeLS(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function removeLS(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }

  function safeObj(v) { return (v && typeof v === "object") ? v : null; }

  // ───────────────────────── Prefs (opcional por perfil) ─────────────────────────
  // Mantiene compatibilidad: si prefs no existe, OK.
  // v0.1.7 añade:
  // - particles (bool)  -> para overlays “juicy” (confetti/partículas)
  // - reduceMotion (bool) -> permite respetar preferencia manual además de prefers-reduced-motion
  // - uiHue (0..360) -> permitir variar acento visual si lo implementas en app.js/styles
  function sanitizePrefs(prefs) {
    const o = safeObj(prefs);
    if (!o) return null;

    const out = {};

    // Gameplay/UI (existente)
    if ("useSprites" in o) out.useSprites = !!o.useSprites;
    if ("vibration" in o) out.vibration = !!o.vibration;
    if ("showDpad" in o) out.showDpad = !!o.showDpad;
    if ("fx" in o) out.fx = clamp(o.fx, 0.4, 1.25);

    // Audio (existente)
    if ("musicOn" in o) out.musicOn = !!o.musicOn;
    if ("sfxOn" in o) out.sfxOn = !!o.sfxOn;
    if ("musicVol" in o) out.musicVol = clamp(o.musicVol, 0, 1);
    if ("sfxVol" in o) out.sfxVol = clamp(o.sfxVol, 0, 1);
    if ("muteAll" in o) out.muteAll = !!o.muteAll;

    // Idioma (existente)
    if ("lang" in o) {
      const s = safeString(o.lang).trim().toLowerCase();
      const code = s.includes("-") ? s.split("-")[0] : (s.includes("_") ? s.split("_")[0] : s);
      if (code) out.lang = code.slice(0, 8);
    }

    // v0.1.7 (opcional)
    if ("particles" in o) out.particles = !!o.particles;
    if ("reduceMotion" in o) out.reduceMotion = !!o.reduceMotion;
    if ("uiHue" in o) out.uiHue = clampInt(o.uiHue, 0, 360);

    return Object.keys(out).length ? out : null;
  }

  // ───────────────────────── State load/save ─────────────────────────
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
    const rawProfiles = Array.isArray(st.profiles) ? st.profiles : [];
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

    let activeId = (typeof st.activeId === "string" ? st.activeId : null);
    if (activeId && !cleaned.some(p => p.id === activeId)) {
      activeId = cleaned[0]?.id || null;
    }

    return { v: st.v || 1, activeId, profiles: cleaned };
  }

  function loadStateFromKey(key) {
    const raw = readLS(key);
    const st = raw ? safeParse(raw, null) : null;

    if (!st || typeof st !== "object") return null;
    if (!Array.isArray(st.profiles)) return null;

    return sanitizeState({
      v: clampInt(st.v ?? 1, 1, 99),
      activeId: (typeof st.activeId === "string" ? st.activeId : null),
      profiles: st.profiles,
    });
  }

  function loadState() {
    // 1) intenta el key nuevo
    const fresh = loadStateFromKey(AUTH_KEY);
    if (fresh) return { st: fresh, loadedFrom: AUTH_KEY };

    // 2) fallback: key antiguo (Grid Runner)
    const old = loadStateFromKey(AUTH_KEY_OLD);
    if (old) return { st: old, loadedFrom: AUTH_KEY_OLD };

    // 3) vacío
    return { st: { v: 1, activeId: null, profiles: [] }, loadedFrom: null };
  }

  function saveState(st) {
    const json = JSON.stringify(st);

    // ✅ Guardamos SIEMPRE en el nuevo key
    const okNew = writeLS(AUTH_KEY, json);

    // ✅ Compat: también escribimos el key viejo (así si queda cacheado app.js viejo, no “pierde” perfiles)
    // Puedes quitarlo en futuras versiones cuando estés 100% en Grid Rogue.
    writeLS(AUTH_KEY_OLD, json);

    return okNew;
  }

  function ensureMigration(st, loadedFrom) {
    // Si venimos del key viejo, persistimos inmediatamente en el nuevo (ya lo hace saveState, pero lo dejamos explícito)
    if (loadedFrom === AUTH_KEY_OLD) {
      saveState(st);
    }

    if (st.profiles.length > 0) return st;

    // Migración legacy (solo si NO hay perfiles):
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
      .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
  }

  function getActiveProfile() {
    return state.profiles.find(p => p.id === state.activeId) || null;
  }

  function setActiveProfile(id) {
    const p = state.profiles.find(x => x.id === id);
    if (!p) return null;
    state.activeId = p.id;
    p.lastLoginAt = now();
    saveState(state);
    return { ...p };
  }

  function touchActiveLogin() {
    const p = getActiveProfile();
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
    return { ...p };
  }

  function deleteProfile(id) {
    const idx = state.profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;

    const wasActive = state.activeId === id;
    state.profiles.splice(idx, 1);

    if (state.profiles.length === 0) state.activeId = null;
    else if (wasActive) {
      state.activeId = state.profiles
        .slice()
        .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))[0].id;
    }

    saveState(state);
    return true;
  }

  function getBestForActive() {
    const p = getActiveProfile();
    return p ? (p.best | 0) : 0;
  }

  function setBestForActive(best) {
    const p = getActiveProfile();
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
    const p = getActiveProfile();
    return p && p.prefs ? { ...p.prefs } : null;
  }

  function setPrefsForActive(prefs) {
    const p = getActiveProfile();
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

  function clearPrefsForActive() {
    const p = getActiveProfile();
    if (!p) return false;
    if ("prefs" in p) delete p.prefs;
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  // ───────────────────────── Export/Import ─────────────────────────
  function exportAuth() {
    const snap = sanitizeState({ v: state.v || 1, activeId: state.activeId, profiles: state.profiles });
    return JSON.stringify(snap);
  }

  function importAuth(json, { merge = true } = {}) {
    const incoming = safeParse(json, null);
    if (!incoming || typeof incoming !== "object") return { ok: false, reason: "JSON inválido" };

    const inc = sanitizeState({
      v: clampInt(incoming.v ?? 1, 1, 99),
      activeId: (typeof incoming.activeId === "string" ? incoming.activeId : null),
      profiles: Array.isArray(incoming.profiles) ? incoming.profiles : [],
    });

    if (!inc.profiles.length) return { ok: false, reason: "No hay perfiles" };

    if (!merge) {
      state.v = inc.v;
      state.profiles = inc.profiles.slice();
      state.activeId = inc.activeId && inc.profiles.some(p => p.id === inc.activeId)
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

    // además intentamos limpiar keys antiguos por si acaso
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
    clearPrefsForActive,
  };
})();
