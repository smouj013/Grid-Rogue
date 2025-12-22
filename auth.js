/* auth.js — Grid Runner (PWA) v0.1.1 (FIXED)
   - Perfiles locales (sin servidor): crear / seleccionar
   - Migra desde gridrunner_name_v1 + gridrunner_best_v1 si existe
   - Estado robusto (si se corrompe, se repara)
*/
(() => {
  "use strict";

  const AUTH_KEY = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  const now = () => Date.now();
  const uid = () =>
    "p_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function normalizeName(name) {
    return String(name || "").trim().slice(0, 16);
  }

  function loadState() {
    const raw = localStorage.getItem(AUTH_KEY);
    const st = raw ? safeParse(raw, null) : null;

    if (!st || typeof st !== "object") return { activeId: null, profiles: [] };
    if (!Array.isArray(st.profiles)) return { activeId: null, profiles: [] };

    // sanea perfiles
    st.profiles = st.profiles
      .filter(p => p && typeof p === "object" && typeof p.id === "string")
      .map(p => ({
        id: p.id,
        name: normalizeName(p.name) || "Jugador",
        createdAt: Number(p.createdAt || now()),
        lastLoginAt: Number(p.lastLoginAt || now()),
        best: Math.max(0, (p.best | 0)),
      }));

    // si activeId apunta a nada, lo arreglamos
    if (st.activeId && !st.profiles.some(p => p.id === st.activeId)) {
      st.activeId = st.profiles[0]?.id || null;
    }

    return st;
  }

  function saveState(st) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(st));
  }

  function ensureMigration(st) {
    if (st.profiles.length > 0) return st;

    const legacyName = normalizeName(localStorage.getItem(LEGACY_NAME_KEY) || "");
    const legacyBest = parseInt(localStorage.getItem(LEGACY_BEST_KEY) || "0", 10) || 0;

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

  const state = ensureMigration(loadState());

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
    state.activeId = id;
    p.lastLoginAt = now();
    saveState(state);
    return p;
  }

  function createProfile(name) {
    const nm = normalizeName(name);
    if (nm.length < 2) return null;

    const id = uid();
    const p = { id, name: nm, createdAt: now(), lastLoginAt: now(), best: 0 };
    state.profiles.push(p);
    state.activeId = id;
    saveState(state);
    return p;
  }

  function deleteProfile(id) {
    const idx = state.profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;

    state.profiles.splice(idx, 1);

    if (state.activeId === id) {
      state.activeId = state.profiles[0]?.id || null;
      if (state.activeId) {
        const p = state.profiles.find(x => x.id === state.activeId);
        if (p) p.lastLoginAt = now();
      }
    }

    saveState(state);
    return true;
  }

  function renameProfile(id, name) {
    const nm = normalizeName(name);
    if (nm.length < 2) return false;
    const p = state.profiles.find(x => x.id === id);
    if (!p) return false;
    p.name = nm;
    p.lastLoginAt = now();
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

  window.Auth = {
    listProfiles,
    getActiveProfile,
    setActiveProfile,
    createProfile,
    deleteProfile,
    renameProfile,
    getBestForActive,
    setBestForActive,
  };
})();
