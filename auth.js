/* auth.js — Grid Rogue v1.1.0 (MENU-FIRST + HARDENED)
   Perfiles locales + best score + prefs opcionales por perfil.
   ✅ API estable + migración desde gridrunner_* (sin perder datos)
   ✅ MENU-FIRST: no autoselecciona perfil al boot (no salta el menú principal)
   ✅ Guarda lastId (último usado) pero activeId = null hasta confirmar (Start/selección)
   ✅ Guard anti SW: si entra un auth viejo, este lo reemplaza (no bloquea updates)
   ✅ Anti-corrupt: auto-repair si el estado guardado viene roto
   ✅ canLS robusto + fallback en memoria si LS bloqueado (Safari privado / políticas)
   ✅ Export/Import con merge/replace seguro
*/
(() => {
  "use strict";

  const VERSION = "1.1.0";

  // ───────────────────────── Guard inteligente (no bloquea updates) ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;

  function parseVer(v) {
    const s = String(v || "").trim();
    const parts = s.split(".").map(n => parseInt(n, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  function cmpVer(a, b) {
    const A = parseVer(a), B = parseVer(b);
    for (let i = 0; i < 3; i++) {
      if (A[i] > B[i]) return 1;
      if (A[i] < B[i]) return -1;
    }
    return 0;
  }

  try {
    if (g && g.Auth && typeof g.Auth.VERSION === "string") {
      // Si ya hay una versión >= a ésta, no hacemos nada.
      if (cmpVer(g.Auth.VERSION, VERSION) >= 0) return;
      // Si hay una más vieja, seguimos y la reemplazamos.
    }
  } catch (_) {}

  const U = window.GRUtils || window.Utils || null;

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
      return Math.max(a, Math.min(b, v));
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

  // ───────────────────────── Storage layer (LS + fallback RAM) ─────────────────────────
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

  // ───────────────────────── Keys ─────────────────────────
  const AUTH_KEY = "gridrogue_auth_v1";
  const AUTH_KEY_OLD = "gridrunner_auth_v1";

  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  // ───────────────────────── ID helpers ─────────────────────────
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

  function normalizeName(name) {
    const s = safeString(name)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 16);
    return s;
  }

  function safeObj(v) {
    return (v && typeof v === "object") ? v : null;
  }

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

  function sanitizeProfile(p) {
    if (!p || typeof p !== "object") return null;

    let id = (typeof p.id === "string" && p.id.trim()) ? p.id.trim() : uid();
    id = safeString(id).replace(/\s+/g, "").slice(0, 80) || uid();

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

    const lastId = (typeof st?.lastId === "string" && st.lastId.trim()) ? st.lastId.trim() : null;

    // MENU-FIRST: activeId puede ser null aunque exista lastId
    let activeId = (typeof st?.activeId === "string" && st.activeId.trim()) ? st.activeId.trim() : null;

    if (activeId && !cleaned.some(p => p.id === activeId)) activeId = null;

    return {
      v: clampInt(st?.v ?? 1, 1, 99),
      activeId,
      lastId: (lastId && cleaned.some(p => p.id === lastId)) ? lastId : (cleaned[0]?.id || null),
      profiles: cleaned
    };
  }

  function loadStateFromKey(key) {
    const raw = readLS(key);
    const st = raw ? safeParse(raw, null) : null;
    if (!st || typeof st !== "object") return null;
    if (!Array.isArray(st.profiles)) return null;
    return sanitizeState(st);
  }

  function loadState() {
    const fresh = loadStateFromKey(AUTH_KEY);
    if (fresh) return { st: fresh, loadedFrom: AUTH_KEY };

    const old = loadStateFromKey(AUTH_KEY_OLD);
    if (old) return { st: old, loadedFrom: AUTH_KEY_OLD };

    return { st: { v: 1, activeId: null, lastId: null, profiles: [] }, loadedFrom: null };
  }

  function saveState(st) {
    const json = safeStringify(st, "");
    if (!json) return false;

    const okNew = writeLS(AUTH_KEY, json);
    // Compat: viejo key
    writeLS(AUTH_KEY_OLD, json);

    return okNew || !canLS();
  }

  function dispatchChange(type, detail) {
    try {
      window.dispatchEvent(new CustomEvent("gridrogue:auth-changed", {
        detail: { type, ...(detail || {}) }
      }));
    } catch (_) {}
  }

  function ensureMigration(st, loadedFrom) {
    if (loadedFrom === AUTH_KEY_OLD) saveState(st);

    // Migración especial: estados antiguos usaban activeId como “último usado”
    // MENU-FIRST: convertimos activeId -> lastId y dejamos activeId=null para no saltar el menú.
    if (st.activeId && !st.lastId) {
      st.lastId = st.activeId;
      st.activeId = null;
      saveState(st);
    }

    // Si ya hay perfiles, no creamos nada.
    if (st.profiles.length > 0) return st;

    // Migración legacy (name/best sueltos) SOLO si existen datos reales.
    const legacyName = normalizeName(readLS(LEGACY_NAME_KEY) || "");
    const legacyBest = parseInt(readLS(LEGACY_BEST_KEY) || "0", 10) || 0;

    const hasLegacy = (legacyName.length >= 2) || (legacyBest > 0);
    if (!hasLegacy) {
      // Primera vez real: deja vacío para que el menú principal pida perfil.
      saveState(st);
      return st;
    }

    const name = legacyName.length >= 2 ? legacyName : "Jugador";
    const id = uid();

    st.profiles.push({
      id,
      name,
      createdAt: now(),
      lastLoginAt: now(),
      best: Math.max(0, legacyBest | 0),
    });

    // MENU-FIRST: guardamos como lastId pero activeId sigue null (para que salga el menú)
    st.lastId = id;
    st.activeId = null;

    saveState(st);
    return st;
  }

  // ───────────────────────── Boot state ─────────────────────────
  const loaded = loadState();
  const state = ensureMigration(loaded.st, loaded.loadedFrom);

  // Auto-repair mínimo
  if (state.profiles.length && state.lastId && !state.profiles.some(p => p.id === state.lastId)) {
    state.lastId = state.profiles[0].id;
    saveState(state);
  }
  if (state.activeId && !state.profiles.some(p => p.id === state.activeId)) {
    state.activeId = null;
    saveState(state);
  }

  // Helpers internos
  function cloneProfile(p) {
    return p ? { ...p, ...(p.prefs ? { prefs: { ...p.prefs } } : {}) } : null;
  }

  function uniqueName(name, exceptId = null) {
    const base = normalizeName(name);
    if (base.length < 2) return null;

    const lower = base.toLowerCase();
    const dup = state.profiles.find(p => p.id !== exceptId && (p.name || "").toLowerCase() === lower);
    if (!dup) return base;

    for (let i = 2; i <= 99; i++) {
      const suf = ` (${i})`;
      const cand = (base.slice(0, 16 - suf.length) + suf).slice(0, 16);
      const cLower = cand.toLowerCase();
      if (!state.profiles.some(p => p.id !== exceptId && (p.name || "").toLowerCase() === cLower)) {
        return cand;
      }
    }
    return (base.slice(0, 14) + " *").slice(0, 16);
  }

  function getById(id) {
    if (!id) return null;
    return state.profiles.find(p => p.id === id) || null;
  }

  // ───────────────────────── Public API ─────────────────────────
  function listProfiles() {
    return state.profiles
      .slice()
      .sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0))
      .map(cloneProfile);
  }

  // MENU-FIRST: esto devolverá null hasta que el usuario confirme perfil (setActive/create)
  function getActiveProfile() {
    const p = getById(state.activeId);
    return cloneProfile(p);
  }

  function getLastProfileId() {
    return state.lastId || null;
  }

  function getLastProfile() {
    const p = getById(state.lastId);
    return cloneProfile(p);
  }

  // Útil para UI: si aún no hay activeId, te da el lastId para preseleccionar dropdown
  function getActiveOrLastProfile() {
    return getActiveProfile() || getLastProfile();
  }

  function setActiveProfile(id) {
    const p = getById(id);
    if (!p) return null;

    state.activeId = p.id;     // confirma selección => ya puede empezar run
    state.lastId = p.id;       // persiste último usado
    p.lastLoginAt = now();

    saveState(state);
    dispatchChange("setActive", { id: p.id });

    return cloneProfile(p);
  }

  function touchActiveLogin() {
    const p = getById(state.activeId);
    if (!p) return false;
    p.lastLoginAt = now();
    saveState(state);
    dispatchChange("touch", { id: p.id });
    return true;
  }

  function createProfile(name) {
    const nm = uniqueName(name);
    if (!nm) return null;

    const id = uid();
    const p = { id, name: nm, createdAt: now(), lastLoginAt: now(), best: 0 };

    state.profiles.push(p);
    // al crear, sí confirmamos (normalmente el usuario lo acaba de crear en el menú)
    state.activeId = id;
    state.lastId = id;

    saveState(state);
    dispatchChange("create", { id });

    return cloneProfile(p);
  }

  function renameProfile(id, newName) {
    const p = getById(id);
    if (!p) return null;

    const nm = uniqueName(newName, id);
    if (!nm) return null;

    p.name = nm;
    p.lastLoginAt = now();
    saveState(state);
    dispatchChange("rename", { id });

    return cloneProfile(p);
  }

  function deleteProfile(id) {
    const idx = state.profiles.findIndex(p => p.id === id);
    if (idx < 0) return false;

    const wasActive = (state.activeId === id);
    const wasLast = (state.lastId === id);

    state.profiles.splice(idx, 1);

    if (wasActive) state.activeId = null;
    if (wasLast) {
      state.profiles.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
      state.lastId = state.profiles[0]?.id || null;
    }

    saveState(state);
    dispatchChange("delete", { id });

    return true;
  }

  function getBestForActive() {
    const p = getById(state.activeId);
    return p ? (p.best | 0) : 0;
  }

  function setBestForActive(best) {
    const p = getById(state.activeId);
    if (!p) return false;

    const b = Math.max(0, best | 0);
    if (b > (p.best | 0)) {
      p.best = b;
      p.lastLoginAt = now();
      saveState(state);
      dispatchChange("best", { id: p.id, best: b });
      return true;
    }
    return false;
  }

  function getPrefsForActive() {
    const p = getById(state.activeId);
    return p && p.prefs ? { ...p.prefs } : null;
  }

  function setPrefsForActive(prefs) {
    const p = getById(state.activeId);
    if (!p) return false;

    const sp = sanitizePrefs(prefs);

    if (!sp) {
      if ("prefs" in p) delete p.prefs;
      p.lastLoginAt = now();
      saveState(state);
      dispatchChange("prefs", { id: p.id });
      return true;
    }

    p.prefs = sp;
    p.lastLoginAt = now();
    saveState(state);
    dispatchChange("prefs", { id: p.id });
    return true;
  }

  function patchPrefsForActive(partialPrefs) {
    const p = getById(state.activeId);
    if (!p) return false;

    const current = p.prefs ? { ...p.prefs } : {};
    const merged = { ...current, ...(safeObj(partialPrefs) || {}) };
    return setPrefsForActive(merged);
  }

  function clearPrefsForActive() {
    const p = getById(state.activeId);
    if (!p) return false;
    if ("prefs" in p) delete p.prefs;
    p.lastLoginAt = now();
    saveState(state);
    dispatchChange("prefs", { id: p.id });
    return true;
  }

  function exportAuth() {
    const snap = sanitizeState({
      v: state.v || 1,
      activeId: state.activeId,
      lastId: state.lastId,
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

      // MENU-FIRST: tras import, dejamos activeId=null y fijamos lastId seguro
      state.activeId = null;
      state.lastId = inc.lastId || inc.profiles[0].id;

      saveState(state);
      dispatchChange("import", { mode: "replace", count: state.profiles.length });
      return { ok: true, mode: "replace", count: state.profiles.length };
    }

    const existingIds = new Set(state.profiles.map(p => p.id));
    const existingNames = new Set(state.profiles.map(p => (p.name || "").toLowerCase()));

    for (const p of inc.profiles) {
      let id = p.id;
      if (existingIds.has(id)) id = uid();
      existingIds.add(id);

      let name = p.name || "Jugador";
      const lower = name.toLowerCase();
      if (existingNames.has(lower)) {
        name = uniqueName(name, null) || name;
      }
      existingNames.add(name.toLowerCase());

      state.profiles.push({ ...p, id, name });
    }

    const merged = sanitizeState({
      v: Math.max(state.v || 1, inc.v || 1),
      activeId: state.activeId, // se mantiene (probablemente null en menú)
      lastId: state.lastId || inc.lastId,
      profiles: state.profiles,
    });

    state.v = merged.v;
    state.profiles = merged.profiles;

    if (!state.lastId || !state.profiles.some(p => p.id === state.lastId)) {
      state.lastId = merged.lastId || state.profiles[0]?.id || null;
    }

    // MENU-FIRST: no forzamos activeId
    if (state.activeId && !state.profiles.some(p => p.id === state.activeId)) {
      state.activeId = null;
    }

    saveState(state);
    dispatchChange("import", { mode: "merge", count: state.profiles.length });
    return { ok: true, mode: "merge", count: state.profiles.length };
  }

  function clearAuth() {
    state.activeId = null;
    state.lastId = null;
    state.profiles = [];
    saveState(state);

    removeLS(AUTH_KEY);
    removeLS(AUTH_KEY_OLD);

    dispatchChange("clear", {});
    return true;
  }

  function clearLegacyKeys() {
    removeLS(LEGACY_NAME_KEY);
    removeLS(LEGACY_BEST_KEY);
    return true;
  }

  // API estable
  window.Auth = {
    VERSION,

    listProfiles,
    getActiveProfile,
    getActiveOrLastProfile,

    getLastProfileId,
    getLastProfile,

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
})();
