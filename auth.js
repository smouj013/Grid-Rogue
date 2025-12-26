(() => {
  "use strict";

  const VERSION = "1.0.0";
  const U = window.GRUtils || null;

  const now = (U && U.now) ? U.now : (() => Date.now());
  const safeParse = (U && U.safeParse) ? U.safeParse : ((raw, fb) => { try { return JSON.parse(raw); } catch { return fb; } });
  const safeStringify = (U && U.safeStringify) ? U.safeStringify : ((o, fb="") => { try { return JSON.stringify(o); } catch { return fb; } });

  const canLS = (U && U.canLS) ? U.canLS : (() => {
    try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return true; } catch { return false; }
  });

  const __RAM = Object.create(null);
  const readLS = (k) => { try { return localStorage.getItem(k); } catch { return (__RAM[k] ?? null); } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, String(v ?? "")); return true; } catch { __RAM[k] = String(v ?? ""); return false; } };
  const removeLS = (k) => { try { localStorage.removeItem(k); delete __RAM[k]; return true; } catch { delete __RAM[k]; return false; } };

  const AUTH_KEY = "gridrogue_auth_v1";
  const AUTH_KEY_OLD = "gridrunner_auth_v1";
  const LEGACY_NAME_KEY = "gridrunner_name_v1";
  const LEGACY_BEST_KEY = "gridrunner_best_v1";

  const hasCrypto = () => { try { return !!(globalThis.crypto && crypto.getRandomValues); } catch { return false; } };
  const uid = () => {
    if (hasCrypto()) {
      const buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return "p_" + Array.from(buf).map(n => n.toString(16).padStart(8, "0")).join("_");
    }
    return "p_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
  };

  const safeString = (v) => (v == null ? "" : String(v));
  const normalizeName = (name) => safeString(name).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16);

  function safeObj(v){ return (v && typeof v === "object") ? v : null; }

  function sanitizePrefs(prefs) {
    const o = safeObj(prefs);
    if (!o) return null;

    const out = {};
    if ("useSprites" in o) out.useSprites = !!o.useSprites;
    if ("vibration" in o) out.vibration = !!o.vibration;
    if ("showDpad" in o) out.showDpad = !!o.showDpad;
    if ("reduceMotion" in o) out.reduceMotion = !!o.reduceMotion;
    if ("fx" in o) out.fx = Math.max(0.4, Math.min(1.25, Number(o.fx) || 1));

    if ("musicOn" in o) out.musicOn = !!o.musicOn;
    if ("sfxOn" in o) out.sfxOn = !!o.sfxOn;
    if ("musicVol" in o) out.musicVol = Math.max(0, Math.min(1, Number(o.musicVol) || 0));
    if ("sfxVol" in o) out.sfxVol = Math.max(0, Math.min(1, Number(o.sfxVol) || 0));
    if ("muteAll" in o) out.muteAll = !!o.muteAll;

    return Object.keys(out).length ? out : null;
  }

  function defaultStats() {
    return {
      runsTotal: 0,
      playTimeSec: 0,
      bestOverall: 0,
      bestEndless: 0,
      bestArcade: 0,
      bestStory: 0,
      highestArcadeRound: 0,
      highestStoryStage: 0,
      lastRunAt: 0,
      lastMode: "",
      lastScore: 0,
    };
  }

  function sanitizeStats(stats) {
    const o = safeObj(stats);
    const d = defaultStats();
    if (!o) return d;

    const out = { ...d };

    for (const k of Object.keys(d)) {
      if (!(k in o)) continue;
      const v = o[k];
      if (typeof d[k] === "number") out[k] = Math.max(0, (Number(v) || 0));
      else out[k] = safeString(v).slice(0, 24);
    }

    out.runsTotal = out.runsTotal | 0;
    out.playTimeSec = out.playTimeSec | 0;
    out.bestOverall = out.bestOverall | 0;
    out.bestEndless = out.bestEndless | 0;
    out.bestArcade = out.bestArcade | 0;
    out.bestStory = out.bestStory | 0;
    out.highestArcadeRound = out.highestArcadeRound | 0;
    out.highestStoryStage = out.highestStoryStage | 0;
    out.lastRunAt = out.lastRunAt | 0;
    out.lastScore = out.lastScore | 0;

    return out;
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
    const stats = sanitizeStats(p.stats);

    return { id, name, createdAt, lastLoginAt, best, ...(prefs ? { prefs } : {}), stats };
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
    if (activeId && !cleaned.some(p => p.id === activeId)) activeId = cleaned[0]?.id || null;

    return { v: 1, activeId, profiles: cleaned };
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

    return { st: { v: 1, activeId: null, profiles: [] }, loadedFrom: null };
  }

  function saveState(st) {
    const json = safeStringify(st, "");
    if (!json) return false;
    const okNew = writeLS(AUTH_KEY, json);
    writeLS(AUTH_KEY_OLD, json);
    return okNew || !canLS();
  }

  function ensureMigration(st, loadedFrom) {
    if (loadedFrom === AUTH_KEY_OLD) saveState(st);

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
      stats: sanitizeStats({ bestOverall: Math.max(0, legacyBest | 0) }),
    });

    st.activeId = id;
    saveState(st);
    return st;
  }

  const loaded = loadState();
  const state = ensureMigration(loaded.st, loaded.loadedFrom);

  if (!state.activeId && state.profiles.length) {
    state.activeId = state.profiles[0].id;
    saveState(state);
  }

  function cloneProfile(p) {
    return p ? { ...p, prefs: p.prefs ? { ...p.prefs } : undefined, stats: p.stats ? { ...p.stats } : defaultStats() } : null;
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
      if (!state.profiles.some(p => p.id !== exceptId && (p.name || "").toLowerCase() === cLower)) return cand;
    }
    return (base.slice(0, 14) + " *").slice(0, 16);
  }

  function listProfiles() {
    return state.profiles.slice().sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0)).map(cloneProfile);
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
    const p = { id, name: nm, createdAt: now(), lastLoginAt: now(), best: 0, stats: defaultStats() };
    state.profiles.push(p);
    state.activeId = id;
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

    if (state.profiles.length === 0) state.activeId = null;
    else if (wasActive) {
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
    const cur = p.prefs ? { ...p.prefs } : {};
    return setPrefsForActive({ ...cur, ...(safeObj(partialPrefs) || {}) });
  }

  function getStatsForActive() {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    return p ? { ...sanitizeStats(p.stats) } : defaultStats();
  }

  function patchStatsForActive(partial) {
    const p = state.profiles.find(p => p.id === state.activeId) || null;
    if (!p) return false;
    const cur = sanitizeStats(p.stats);
    const inc = safeObj(partial) || {};
    p.stats = sanitizeStats({ ...cur, ...inc });
    p.lastLoginAt = now();
    saveState(state);
    return true;
  }

  function exportAuth() {
    const snap = sanitizeState({ v: 1, activeId: state.activeId, profiles: state.profiles });
    return safeStringify(snap, "{}") || "{}";
  }

  function importAuth(json, { merge = true } = {}) {
    const incoming = safeParse(json, null);
    if (!incoming || typeof incoming !== "object") return { ok: false, reason: "JSON inválido" };

    const inc = sanitizeState(incoming);
    if (!inc.profiles.length) return { ok: false, reason: "No hay perfiles" };

    if (!merge) {
      state.v = 1;
      state.profiles = inc.profiles.slice();
      state.activeId =
        (inc.activeId && inc.profiles.some(p => p.id === inc.activeId)) ? inc.activeId : inc.profiles[0].id;
      saveState(state);
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
      if (existingNames.has(lower)) name = uniqueName(name, null) || name;
      existingNames.add(name.toLowerCase());

      state.profiles.push({ ...p, id, name });
    }

    const merged = sanitizeState({ v: 1, activeId: state.activeId, profiles: state.profiles });
    state.profiles = merged.profiles;
    if (!state.activeId || !state.profiles.some(p => p.id === state.activeId)) state.activeId = merged.activeId || state.profiles[0]?.id || null;

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

  window.Auth = {
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
    getPrefsForActive,
    setPrefsForActive,
    patchPrefsForActive,
    getStatsForActive,
    patchStatsForActive,
    exportAuth,
    importAuth,
    clearAuth,
    clearLegacyKeys,
  };
})();
