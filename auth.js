/* auth.js — Grid Runner (PWA) v0.1.3
   ✅ Perfiles locales (robusto)
   ✅ Migración desde gridrunner_name_v1 + gridrunner_best_v1 (solo si NO hay perfiles)
   ✅ Validación + saneado de estado (corrige ids/valores raros)
   ✅ API ampliada: rename / delete / export / import / touchLogin
   ✅ Nunca rompe si localStorage falla (best-effort)
*/

(() => {
  "use strict";

  const AUTH_KEY = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  const now = () => Date.now();

  const uid = () =>
    "p_" +
    Math.random().toString(16).slice(2) +
    "_" +
    Math.random().toString(16).slice(2);

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function safeString(v) {
    return (v == null) ? "" : String(v);
  }

  function normalizeName(name) {
    return safeString(name).trim().slice(0, 16);
  }

  function clampInt(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  }

  function readLS(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeLS(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function removeLS(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  }

  function loadState() {
    const raw = readLS(AUTH_KEY);
    const st = raw ? safeParse(raw, null) : null;

    if (!st || typeof st !== "object") return { v: 1, activeId: null, profiles: [] };
    if (!Array.isArray(st.profiles)) return { v: 1, activeId: null, profiles: [] };

    return sanitizeState({
      v: clampInt(st.v ?? 1, 1, 99),
      activeId: (typeof st.activeId === "string" ? st.activeId : null),
      profiles: st.profiles,
    });
  }

  function saveState(st) {
    return writeLS(AUTH_KEY, JSON.stringify(st));
  }

  function sanitizeProfile(p) {
    if (!p || typeof p !== "object") return null;

    const id = (typeof p.id === "string" && p.id.trim()) ? p.id.trim() : uid();
    const name = normalizeName(p.name) || "Jugador";

    const createdAt = Number.isFinite(+p.createdAt) ? +p.createdAt : now();
    const lastLoginAt = Number.isFinite(+p.lastLoginAt) ? +p.lastLoginAt : createdAt;

    const best = Math.max(0, (p.best | 0));

    return { id, name, createdAt, lastLoginAt, best };
  }

  function sanitizeState(st) {
    // profiles -> array limpia
    const rawProfiles = Array.isArray(st.profiles) ? st.profiles : [];
    const cleaned = [];

    const seen = new Set();
    for (const p of rawProfiles) {
      const sp = sanitizeProfile(p);
      if (!sp) continue;
      // evita ids duplicados
      if (seen.has(sp.id)) sp.id = uid();
      seen.add(sp.id);
      cleaned.push(sp);
    }

    // orden base: más reciente arriba
    cleaned.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

    // activeId válido
    let activeId = (typeof st.activeId === "string" ? st.activeId : null);
    if (activeId && !cleaned.some(p => p.id === activeId)) {
      activeId = cleaned[0]?.id || null;
    }

    return { v: st.v || 1, activeId, profiles: cleaned };
  }

  function ensureMigration(st) {
    // Solo migra si NO hay perfiles
    if (st.profiles.length > 0) return st;

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

  // ───────────────────────── State live ─────────────────────────
  const state = ensureMigration(loadState());

  // ───────────────────────── Core API ─────────────────────────
  function listProfiles() {
    // siempre devuelve copia ordenada por lastLoginAt desc
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

    // evita nombres duplicados exactos (opcional): si existe, activa ese
    const existing = state.profiles.find(p => p.name.toLowerCase() === nm.toLowerCase());
    if (existing) {
      return setActiveProfile(existing.id);
    }

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

  // ───────────────────────── Import / Export ─────────────────────────
  function exportAuth() {
    // export minimal y estable
    const snap = sanitizeState({
      v: state.v || 1,
      activeId: state.activeId,
      profiles: state.profiles,
    });
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

    // merge: añade perfiles nuevos, y si id colisiona, genera id nuevo
    const existingIds = new Set(state.profiles.map(p => p.id));
    for (const p of inc.profiles) {
      let id = p.id;
      if (existingIds.has(id)) id = uid();
      existingIds.add(id);
      state.profiles.push({ ...p, id });
    }

    // re-sanitiza + orden + active
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

  // ───────────────────────── Reset / Clear ─────────────────────────
  function clearAuth() {
    state.activeId = null;
    state.profiles = [];
    saveState(state);
    return true;
  }

  function clearLegacyKeys() {
    // opcional: limpia legacy (no es obligatorio)
    removeLS(LEGACY_NAME_KEY);
    removeLS(LEGACY_BEST_KEY);
    return true;
  }

  // ───────────────────────── Expose ─────────────────────────
  window.Auth = {
    // existentes
    listProfiles,
    getActiveProfile,
    setActiveProfile,
    createProfile,
    getBestForActive,
    setBestForActive,

    // nuevos (opcionales)
    renameProfile,
    deleteProfile,
    touchActiveLogin,
    exportAuth,
    importAuth,
    clearAuth,
    clearLegacyKeys,
  };
})();
