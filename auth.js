/* auth.js — Grid Rogue v1.0.0 (STABLE+HARDENED)
   Perfiles locales + best score + prefs opcionales por perfil.
   ✅ API estable: window.Auth (list/create/rename/delete/setActive/best/prefs/export/import)
   ✅ Migración: gridrunner_* + gridrogue_auth_v1 (sin perder datos)
   ✅ Anti-corrupt: sanitiza/recorta/normaliza y auto-repara estado
   ✅ Storage robusto: localStorage si se puede, fallback RAM si está bloqueado
   ✅ Anti doble carga: guard global
*/
(() => {
  "use strict";

  const g = (typeof globalThis !== "undefined") ? globalThis : (typeof window !== "undefined" ? window : {});
  const LOAD_GUARD = "__GRIDROGUE_AUTHJS_LOADED_V1000";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const VERSION = "1.0.0";

  // Utils opcionales (compat)
  const U = (typeof window !== "undefined" && (window.GRUtils || window.Utils)) ? (window.GRUtils || window.Utils) : null;

  const now = (U && typeof U.now === "function") ? U.now : (() => Date.now());

  const safeParse =
    (U && typeof U.safeParse === "function") ? U.safeParse :
    ((raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } });

  const safeStringify =
    (U && typeof U.safeStringify === "function") ? U.safeStringify :
    ((obj, fallback = "") => { try { return JSON.stringify(obj); } catch { return fallback; } });

  const safeString = (v) => (v == null ? "" : String(v));

  const clamp =
    (U && typeof U.clamp === "function") ? U.clamp :
    ((v, a, b) => {
      v = Number(v);
      if (!Number.isFinite(v)) v = a;
      return Math.max(a, Math.min(b, v));
    });

  const clampInt =
    (U && typeof U.clampInt === "function") ? U.clampInt :
    ((v, a, b) => {
      v = Number(v);
      if (!Number.isFinite(v)) v = a;
      v = v | 0;
      return Math.max(a | 0, Math.min(b | 0, v));
    });

  const canLS =
    (U && typeof U.canLS === "function") ? U.canLS :
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

  // ───────────────────────── Storage (LS + fallback RAM) ─────────────────────────
  const __RAM = Object.create(null);

  function readLS(key) {
    try { return localStorage.getItem(key); } catch { return (__RAM[key] ?? null); }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, value); return true; } catch {
      __RAM[key] = String(value ?? "");
      return false;
    }
  }
  function removeLS(key) {
    try { localStorage.removeItem(key); delete __RAM[key]; return true; } catch {
      delete __RAM[key];
      return false;
    }
  }

  // ───────────────────────── Keys (compat) ─────────────────────────
  const AUTH_KEY = "gridrogue_auth_v1";
  const AUTH_KEY_OLD = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  // ───────────────────────── ID helpers ─────────────────────────
  const hasCrypto = () => {
    try { return !!(g.crypto && g.crypto.getRandomValues); } catch { return false; }
  };

  const uid = () => {
    if (hasCrypto()) {
      const buf = new Uint32Array(4);
      g.crypto.getRandomValues(buf);
      return "p_" + Array.from(buf).map(n => n.toString(16).padStart(8, "0")).join("_");
    }
    return "p_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
  };

  function safeObj(v) {
    return (v && typeof v === "object") ? v : null;
  }

  function normalizeName(name) {
    return safeString(name)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
  }

  function uniqueNameAgainstSet(baseName, usedLowerSet) {
    const base = normalizeName(baseName);
    if (base.length < 2) return null;

    const lower = base.toLowerCase();
    if (!usedLowerSet.has(lower)) return base;

    for (let i = 2; i <= 99; i++) {
      const suf = ` (${i})`;
      const maxLen = Math.max(2, 16 - suf.length);
      const cand = (base.slice(0, maxLen) + suf).slice(0, 16);
      const cLower = cand.toLowerCase();
      if (!usedLowerSet.has(cLower)) return cand;
    }
    return (base.slice(0, 14) + " *").slice(0, 16);
  }

  // ───────────────────────── Sanitizers ─────────────────────────
  function sanitizePrefs(prefs) {
    const o = safeObj(prefs);
    if (!o) return null;

    const out = {};

    // Visual
    if ("useSprites" in o) out.useSprites = !!o.useSprites;
    if ("uiHue" in o) out.uiHue = clampInt(o.uiHue, 0, 360);
    if ("particles" in o) out.particles = !!o.particles;
    if ("reduceMotion" in o) out.reduceMotion = !!o.reduceMotion;

    // Controles
    if ("vibration" in o) out.vibration = !!o.vibration;
    if ("showDpad" in o) out.showDpad = !!o.showDpad;

    if ("mobileControls" in o) {
      const mc = safeString(o.mobileControls).trim().toLowerCase();
      out.mobileControls = (mc === "on" || mc === "off" || mc === "auto") ? mc : "auto";
    }
    if ("mobileGridRows" in o) out.mobileGridRows = clampInt(o.mobileGridRows, 16, 32);

    // FX
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
      const base = s.includes("-") ? s.split("-")[0] : (s.includes("_") ? s.split("_")[0] : s);
      if (base) out.lang = base.slice(0, 8);
    }

    return Object.keys(out).length ? out : null;
  }

  function sanitizeProfile(p, usedIds, usedNamesLower) {
    if (!p || typeof p !== "object") return null;

    let id = (typeof p.id === "string" && p.id.trim()) ? p.id.trim() : uid();
    id = safeString(id).replace(/\s+/g, "").slice(0, 80) || uid();
    if (usedIds.has(id)) id = uid();
    usedIds.add(id);

    const nm0 = normalizeName(p.name) || "Jugador";
    const name = uniqueNameAgainstSet(nm0, usedNamesLower) || "Jugador";
    usedNamesLower.add(name.toLowerCase());

    const createdAt = Number.isFinite(+p.createdAt) ? +p.createdAt : now();
    const lastLoginAt = Number.isFinite(+p.lastLoginAt) ? +p.lastLoginAt : createdAt;

    const best = Math.max(0, (p.best | 0));
    const prefs = sanitizePrefs(p.prefs);

    const out = { id, name, createdAt, lastLoginAt, best };
    if (prefs) out.prefs = prefs;
    return out;
  }

  function sanitizeState(st) {
    const profilesRaw = Array.isArray(st && st.profiles) ? st.profiles : [];
    const usedIds = new Set();
    const usedNamesLower = new Set();

    const cleaned = [];
    const MAX_PROFILES = 32;

    for (let i = 0; i < profilesRaw.length && cleaned.length < MAX_PROFILES; i++) {
      const sp = sanitizeProfile(profilesRaw[i], usedIds, usedNamesLower);
      if (sp) cleaned.push(sp);
    }

    cleaned.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

    let activeId = (typeof st?.activeId === "string" ? st.activeId : null);
    if (activeId && !cleaned.some(p => p.id === activeId)) activeId = null;
    if (!activeId && cleaned.length) activeId = cleaned[0].id;

    return {
      v: clampInt(st?.v ?? 1, 1, 99),
      activeId,
      profiles: cleaned,
    };
  }

  // ───────────────────────── Load / Save / Migration ─────────────────────────
  function loadStateFromKey(key) {
    const raw = readLS(key);
    const st = raw ? safeParse(raw, null) : null;
    if (!st || typeof st !== "object" || !Array.isArray(st.profiles)) return null;
    return sanitizeState(st);
  }

  function loadState() {
    const stNew = loadStateFromKey(AUTH_KEY);
    if (stNew) return { st: stNew, loadedFrom: AUTH_KEY };

    const stOld = loadStateFromKey(AUTH_KEY_OLD);
    if (stOld) return { st: stOld, loadedFrom: AUTH_KEY_OLD };

    return { st: { v: 1, activeId: null, profiles: [] }, loadedFrom: null };
  }

  function saveState(st) {
    const clean = sanitizeState(st);
    const json = safeStringify(clean, "");
    if (!json) return false;

    const okNew = writeLS(AUTH_KEY, json);
    // compat: mantenemos espejo en key antiguo (no rompe builds viejos)
    writeLS(AUTH_KEY_OLD, json);

    return okNew || !canLS();
  }

  function ensureMigration(st, loadedFrom) {
    if (loadedFrom === AUTH_KEY_OLD) saveState(st);

    if (st.profiles.length > 0) return st;

    const legacyName = normalizeName(readLS(LEGACY_NAME_KEY) || "");
    const legacyBest = parseInt(readLS(LEGACY_BEST_KEY) || "0", 10) || 0;

    const p = sanitizeProfile(
      {
        id: uid(),
        name: legacyName.length >= 2 ? legacyName : "Jugador",
        createdAt: now(),
        lastLoginAt: now(),
        best: Math.max(0, legacyBest | 0),
      },
      new Set(),
      new Set()
    );

    st.profiles.push(p);
    st.activeId = p.id;

    saveState(st);
    return st;
  }

  // ───────────────────────── Boot state ─────────────────────────
  const loaded = loadState();
  const state = ensureMigration(loaded.st, loaded.loadedFrom);

  // auto-repair extra
  if (!state.activeId && state.profiles.length) {
    state.activeId = state.profiles[0].id;
    saveState(state);
  }

  // ───────────────────────── Internal helpers ─────────────────────────
  function cloneProfile(p) {
    return p ? { ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) } : null;
  }

  function buildUsedNameSet(exceptId = null) {
    const set = new Set();
    for (const p of state.profiles) {
      if (!p || typeof p !== "object") continue;
      if (exceptId && p.id === exceptId) continue;
      set.add((p.name || "").toLowerCase());
    }
    return set;
  }

  function uniqueName(name, exceptId = null) {
    const used = buildUsedNameSet(exceptId);
    return uniqueNameAgainstSet(name, used);
  }

  // ───────────────────────── Public API ─────────────────────────
  function listProfiles() {
    return state.profiles
      .slice()
      .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))
      .map(cloneProfile);
  }

  function getActiveProfile() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    return cloneProfile(p);
  }

  function setActiveProfile(id) {
    const p = state.profiles.find(x => x.id === id);
    if (!p) return null;

    state.activeId = p.id;
    p.lastLoginAt = now();
    saveState(state);
    return cloneProfile(p);
  }

  function touchActiveLogin() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  function createProfile(name) {
    const nm = uniqueName(name);
    if (!nm) return null;

    const id = uid();
    const p = sanitizeProfile(
      { id, name: nm, createdAt: now(), lastLoginAt: now(), best: 0 },
      new Set(state.profiles.map(x => x.id)),
      buildUsedNameSet(null)
    );

    state.profiles.push(p);
    state.activeId = p.id;
    saveState(state);
    return cloneProfile(p);
  }

  function renameProfile(id, newName) {
    const p = state.profiles.find(x => x.id === id);
    if (!p) return null;

    const nm = uniqueName(newName, id);
    if (!nm) return null;

    p.name = nm;
    p.lastLoginAt = now();
    saveState(state);
    return cloneProfile(p);
  }

  function deleteProfile(id) {
    const idx = state.profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;

    const wasActive = (state.activeId === id);
    state.profiles.splice(idx, 1);

    if (state.profiles.length === 0) {
      state.activeId = null;
    } else if (wasActive) {
      state.profiles.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
      state.activeId = state.profiles[0].id;
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
    const usedNamesLower = buildUsedNameSet(null);

    for (const p of inc.profiles) {
      let id = p.id;
      if (existingIds.has(id)) id = uid();
      existingIds.add(id);

      const name = uniqueNameAgainstSet(p.name || "Jugador", usedNamesLower) || "Jugador";
      usedNamesLower.add(name.toLowerCase());

      state.profiles.push({
        id,
        name,
        createdAt: Number.isFinite(+p.createdAt) ? +p.createdAt : now(),
        lastLoginAt: Number.isFinite(+p.lastLoginAt) ? +p.lastLoginAt : now(),
        best: Math.max(0, (p.best | 0)),
        ...(p.prefs ? { prefs: sanitizePrefs(p.prefs) || undefined } : {}),
      });
      // limpia undefined si lo hubiera
      const last = state.profiles[state.profiles.length - 1];
      if (last && last.prefs === undefined) delete last.prefs;
    }

    const merged = sanitizeState({
      v: Math.max(state.v || 1, inc.v || 1),
      activeId: state.activeId,
      profiles: state.profiles,
    });

    state.v = merged.v;
    state.profiles = merged.profiles;
    state.activeId = merged.activeId || state.profiles[0]?.id || null;

    saveState(state);
    return { ok: true, mode: "merge", count: state.profiles.length };
  }

  function clearAuth() {
    state.activeId = null;
    state.profiles = [];
    saveState(state);

    removeLS(AUTH_KEY);
    removeLS(AUTH_KEY_OLD);
    return true;
  }

  function clearLegacyKeys() {
    removeLS(LEGACY_NAME_KEY);
    removeLS(LEGACY_BEST_KEY);
    return true;
  }

  // ───────────────────────── Expose ─────────────────────────
  const api = {
    VERSION,

    listProfiles,
    getActiveProfile,
    setActiveProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    touchActiveLogin,

    getBestForActive,
    setBestForActive,

    exportAuth,
    importAuth,
    clearAuth,
    clearLegacyKeys,

    getPrefsForActive,
    setPrefsForActive,
    patchPrefsForActive,
    clearPrefsForActive,
  };

  try {
    if (typeof window !== "undefined") window.Auth = api;
    else g.Auth = api;
  } catch (_) {
    try { g.Auth = api; } catch (_) {}
  }
})();
