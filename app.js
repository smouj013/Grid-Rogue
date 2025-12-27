/* app.js — Grid Rogue v1.1.0 (STABLE+FULLSCREEN + AUDIO + I18N + PWA + SKILLS)
   ✅ Compatible con:
   - utils.js (window.GRUtils)
   - audio.js (window.AudioSys)
   - localization.js (window.I18n)
   - auth.js (window.Auth) si existe
   - rendiment.js (window.GRPerf) si existe (opcional)
   - skills.js (window.GRSkills) ✅ (pack Skills/Upgrades + Discovery + Shop/Chest)

   v1.1.0 (STABLE patch):
   - PWA/SW: anti “reload loop” endurecido (controllerchange + tags + cooldown)
   - Update pill: aplica update sin forzar reload durante run (espera a GameOver o click)
   - Robustez extra en resize/viewport + observers (sin romper DOM/ids)
   - Integración skills.js (si existe): LevelUp usa Skills Pack; fallback a upgrades internos si no está

   ✅ PATCH UI (sin cambiar versión):
   - FIX: los overlays (Upgrades/Start/Options/etc.) ya NO mueven el layout del juego al aparecer
     (forzados a fixed/inset:0 si el CSS no lo hacía).
   - FIX: el toast se fuerza a fixed (no participa en flow), evitando “saltos” de layout.
   - Menú principal con pestañas (Jugar / Catálogo / Tienda) creado dinámicamente si no existe.
   - Catálogo/Tienda renderizados con skills.js cuando está disponible (fallback si no).
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1100";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.1.0");

  // Compat flags (failsafe/index antiguo) — no pisar si ya existen
  try {
    if (typeof window.__GRIDRUNNER_BOOTED === "undefined") window.__GRIDRUNNER_BOOTED = false;
    if (typeof window.__GRIDROGUE_BOOTED === "undefined") window.__GRIDROGUE_BOOTED = false;
  } catch (_) {}

  // ───────────────────────── Tiny helpers ─────────────────────────
  const isFn = (v) => typeof v === "function";
  const on = (el, ev, fn, opts) => { try { el && el.addEventListener(ev, fn, opts); } catch {} };
  const off = (el, ev, fn, opts) => { try { el && el.removeEventListener(ev, fn, opts); } catch {} };
  const raf = (fn) => requestAnimationFrame(fn);

  // ───────────────────────── Perf helpers (fallback) ─────────────────────────
  const pNow = (() => {
    try { if (typeof performance !== "undefined" && typeof performance.now === "function") return () => performance.now(); } catch {}
    return () => Date.now();
  })();

  const GRPerf = (typeof window !== "undefined" && window.GRPerf) ? window.GRPerf : null;
  const perfEndBoot = (() => {
    try {
      if (!GRPerf) return null;
      GRPerf.setConfig?.({ targetFps: 60, autoPauseOnHidden: true, emitIntervalMs: 500 });
      return GRPerf.measure?.("boot_total");
    } catch { return null; }
  })();

  // ───────────────────────── Imports (globals) ─────────────────────────
  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};

  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  });
  const lerp = U.lerp || ((a, b, t) => a + (b - a) * t);
  const randi = U.randi || ((a, b) => Math.floor(a + Math.random() * (b - a + 1)));
  const chance = U.chance || ((p) => Math.random() < p);
  const safeParse = U.safeParse || ((raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } });
  const $ = U.$ || ((id) => document.getElementById(id));

  const overlayShow = U.overlayShow || ((el) => { if (!el) return; el.hidden = false; });
  const overlayHide = U.overlayHide || ((el) => { if (!el) return; el.hidden = true; });
  const overlayFadeOut = U.overlayFadeOut || ((el, _ms = 0) => Promise.resolve(overlayHide(el)));

  // NO romper pills con iconos: si existe .pv, solo actualiza eso.
  const setPill = U.setPill || ((el, v) => {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(v);
    else el.textContent = String(v);
  });

  const setState = U.setState || ((s) => { try { document.body.dataset.state = String(s); } catch {} });

  const I18n = (typeof window !== "undefined" && window.I18n) ? window.I18n : {
    setLang() {},
    getLang() { return "es"; },
    t(k, a) { return (a != null) ? `${k} ${a}` : k; },
    languageOptions() { return [{ code: "auto", label: "Auto" }, { code: "es", label: "Español" }, { code: "en", label: "English" }]; },
    applyDataAttrs() {},
  };

  function T(key, fallback = null, arg = null) {
    try {
      const s = I18n.t(key, arg);
      if (typeof s === "string" && s !== key) return s;
    } catch {}
    if (fallback == null) return key;
    if (arg == null) return String(fallback);
    return String(fallback).replace("{0}", String(arg));
  }

  const AudioSys = (typeof window !== "undefined" && window.AudioSys) ? window.AudioSys : {
    unlock: async () => true,
    sfx: async () => false,
    startMusic: async () => {},
    stopMusic: () => {},
    duckMusic: () => {},
    setMute: () => {},
    setMusicOn: () => {},
    setSfxOn: () => {},
    setVolumes: () => {},
    getState: () => ({}),
  };

  // ───────────────────────── Storage keys ─────────────────────────
  const BEST_KEY       = "gridrogue_best_v1";
  const NAME_KEY       = "gridrogue_name_v1";
  const SETTINGS_KEY   = "gridrogue_settings_v1";
  const RUNS_KEY       = "gridrogue_runs_v1";

  const BEST_KEY_OLD     = "gridrunner_best_v1";
  const NAME_KEY_OLD     = "gridrunner_name_v1";
  const SETTINGS_KEY_OLD = "gridrunner_settings_v1";
  const RUNS_KEY_OLD     = "gridrunner_runs_v1";

  const SW_RELOAD_KEY = "gridrogue_sw_reload_once";
  const SW_RELOAD_KEY_OLD = "gridrunner_sw_reload_once";

  function readLS(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function writeLS(k, v) { try { localStorage.setItem(k, String(v)); return true; } catch { return false; } }

  function migrateKeyIfNeeded(newKey, oldKey) {
    const n = readLS(newKey);
    if (n != null) return n;
    const o = readLS(oldKey);
    if (o != null) { writeLS(newKey, o); return o; }
    return null;
  }

  // ───────────────────────── Device / Layout ─────────────────────────
  function isCoarsePointer() { try { return matchMedia("(pointer:coarse)").matches; } catch { return false; } }
  function isPortrait() { try { return matchMedia("(orientation: portrait)").matches; } catch { return (innerHeight >= innerWidth); } }
  function isMobileUA() { const ua = (typeof navigator !== "undefined" ? (navigator.userAgent || "") : ""); return /Mobi|Android|iPhone|iPad|iPod/i.test(ua); }
  function isMobileLayout() { return (isCoarsePointer() || isMobileUA()) && isPortrait(); }
  function desiredRows() { return isMobileLayout() ? 16 : 24; }

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = () => ({
    useSprites: false,
    vibration: true,
    showDpad: true,
    fx: 1.0,
    musicOn: true,
    sfxOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,
    lang: "auto",
  });

  let settings = (() => {
    const raw = migrateKeyIfNeeded(SETTINGS_KEY, SETTINGS_KEY_OLD);
    const s = raw ? safeParse(raw, null) : null;
    const base = defaultSettings();
    if (!s || typeof s !== "object") return base;
    return {
      ...base,
      ...s,
      fx: clamp(Number(s.fx ?? 1.0) || 1.0, 0.4, 1.25),
      musicOn: (s.musicOn ?? base.musicOn) !== false,
      sfxOn: (s.sfxOn ?? base.sfxOn) !== false,
      musicVol: clamp(Number(s.musicVol ?? base.musicVol) || base.musicVol, 0, 1),
      sfxVol: clamp(Number(s.sfxVol ?? base.sfxVol) || base.sfxVol, 0, 1),
      muteAll: !!(s.muteAll ?? base.muteAll),
      lang: (typeof s.lang === "string" ? s.lang : base.lang),
    };
  })();

  function saveSettings() {
    try {
      const json = JSON.stringify(settings);
      writeLS(SETTINGS_KEY, json);
      writeLS(SETTINGS_KEY_OLD, json);
    } catch {}
  }

  function vibrate(ms) {
    if (!settings.vibration) return;
    if (typeof navigator === "undefined") return;
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(ms); } catch {}
  }

  I18n.setLang(settings.lang);

  function applyAudioSettingsNow() {
    try {
      AudioSys.setMute(!!settings.muteAll);
      AudioSys.setMusicOn(!!settings.musicOn);
      AudioSys.setSfxOn(!!settings.sfxOn);
      AudioSys.setVolumes({ music: settings.musicVol, sfx: settings.sfxVol });
    } catch {}
  }

  // ───────────────────────── Viewport helpers (anti-scroll) ─────────────────────────
  function updateVhUnit() {
    try {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    } catch {}
  }

  function lockPageScroll() {
    try {
      document.documentElement.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";

      const y = window.scrollY || 0;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${y}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.touchAction = "manipulation";
    } catch {}
  }

  // DOM refs (necesarias para anti-scroll guards)
  let overlayOptions = null;
  let overlayStart = null; // <- se usa también para permitir scroll en Catálogo/Tienda
  let startPanelCatalog = null;
  let startPanelShop = null;

  function findScrollableAncestor(target, limitEl) {
    try {
      if (!target) return null;
      let el = target;
      while (el && el !== document && el !== window && el !== limitEl) {
        if (!el.getBoundingClientRect) { el = el.parentElement; continue; }
        const st = getComputedStyle(el);
        const oy = st.overflowY;
        if ((oy === "auto" || oy === "scroll") && (el.scrollHeight > el.clientHeight + 2)) return el;
        el = el.parentElement;
      }
      return null;
    } catch { return null; }
  }

  function installAntiScrollGuards() {
    // Permitir scroll SOLO dentro de overlays que lo necesiten (Options y, si existe, Catálogo/Tienda)
    const allowedRoots = () => {
      const out = [];
      if (overlayOptions && !overlayOptions.hidden) out.push(overlayOptions);
      if (overlayStart && !overlayStart.hidden) {
        // Solo permitimos scroll si estás dentro de los paneles “largos”
        if (startPanelCatalog && !startPanelCatalog.hidden) out.push(startPanelCatalog);
        if (startPanelShop && !startPanelShop.hidden) out.push(startPanelShop);
      }
      return out;
    };

    const isScrollableInAllowed = (target, event) => {
      try {
        const roots = allowedRoots();
        if (!roots.length) return false;

        const tag = (target?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;

        const path = (event && typeof event.composedPath === "function") ? event.composedPath() : null;
        const iter = (path && path.length) ? path : null;

        for (const root of roots) {
          if (!root) continue;

          if (iter) {
            for (const el of iter) {
              if (el === root) break;
              const sc = findScrollableAncestor(el, root);
              if (sc) return true;
            }
          } else {
            const sc = findScrollableAncestor(target, root);
            if (sc) return true;
          }
        }

        return false;
      } catch { return false; }
    };

    const preventIfNeeded = (e) => {
      if (!e.cancelable) return;
      if (isScrollableInAllowed(e.target, e)) return;
      e.preventDefault();
    };

    document.addEventListener("wheel", preventIfNeeded, { passive: false });
    document.addEventListener("touchmove", preventIfNeeded, { passive: false });
  }

  // ───────────────────────── Auth ─────────────────────────
  const Auth = (typeof window !== "undefined" && window.Auth) ? window.Auth : null;
  let activeProfileId = null;

  let playerName = (migrateKeyIfNeeded(NAME_KEY, NAME_KEY_OLD) || "").trim().slice(0, 16);
  let best = parseInt(migrateKeyIfNeeded(BEST_KEY, BEST_KEY_OLD) || "0", 10) || 0;
  if (playerName.length < 2) playerName = I18n.t("defaultPlayer");

  function syncFromAuth() {
    try {
      if (!Auth) return;
      const p = Auth.getActiveProfile?.();
      if (!p) return;

      activeProfileId = p.id;
      playerName = (p.name || I18n.t("defaultPlayer")).trim().slice(0, 16) || I18n.t("defaultPlayer");
      best = (Auth.getBestForActive?.() ?? best) | 0;

      writeLS(NAME_KEY, playerName);
      writeLS(NAME_KEY_OLD, playerName);
      writeLS(BEST_KEY, String(best));
      writeLS(BEST_KEY_OLD, String(best));

      const prefs = Auth.getPrefsForActive?.();
      if (prefs && typeof prefs === "object") {
        if ("useSprites" in prefs) settings.useSprites = !!prefs.useSprites;
        if ("vibration" in prefs) settings.vibration = !!prefs.vibration;
        if ("showDpad" in prefs) settings.showDpad = !!prefs.showDpad;
        if ("fx" in prefs) settings.fx = clamp(Number(prefs.fx ?? settings.fx) || settings.fx, 0.4, 1.25);

        if ("musicOn" in prefs) settings.musicOn = !!prefs.musicOn;
        if ("sfxOn" in prefs) settings.sfxOn = !!prefs.sfxOn;
        if ("musicVol" in prefs) settings.musicVol = clamp(Number(prefs.musicVol ?? settings.musicVol) || settings.musicVol, 0, 1);
        if ("sfxVol" in prefs) settings.sfxVol = clamp(Number(prefs.sfxVol ?? settings.sfxVol) || settings.sfxVol, 0, 1);
        if ("muteAll" in prefs) settings.muteAll = !!prefs.muteAll;

        if ("lang" in prefs && typeof prefs.lang === "string") settings.lang = prefs.lang;

        saveSettings();
      }
    } catch {}
  }

  function pushPrefsToAuth() {
    try {
      if (!Auth) return;
      Auth.setPrefsForActive?.({
        useSprites: !!settings.useSprites,
        vibration: !!settings.vibration,
        showDpad: !!settings.showDpad,
        fx: settings.fx,
        musicOn: !!settings.musicOn,
        sfxOn: !!settings.sfxOn,
        musicVol: settings.musicVol,
        sfxVol: settings.sfxVol,
        muteAll: !!settings.muteAll,
        lang: String(settings.lang || "auto"),
      });
    } catch {}
  }

  // ───────────────────────── Sprites optional ─────────────────────────
  const sprites = { ready: false, map: new Map() };
  function spriteUrl(name) { return new URL(`./assets/sprites/${name}`, location.href).toString(); }
  function loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("img missing"));
      img.src = url;
    });
  }

  async function tryLoadFirst(key, files) {
    for (const file of files) {
      try { const img = await loadImage(spriteUrl(file)); sprites.map.set(key, img); return true; } catch {}
    }
    return false;
  }

  async function preloadSpritesWithTimeout(timeoutMs = 900) {
    const candidates = [
      ["coin",  ["tile_coin.svg",  "tile_coin.png"]],
      ["gem",   ["tile_gem.svg",   "tile_gem.png"]],
      ["bonus", ["tile_bonus.svg", "tile_bonus.png"]],
      ["trap",  ["tile_trap.svg",  "tile_trap.png"]],
      ["block", ["tile_block.svg", "tile_block.png"]],
      ["player", ["tile_player.svg", "tile_player.png", "tile_hero.svg", "tile_hero.png"]],
    ];

    const timeout = new Promise((res) => setTimeout(res, timeoutMs, "timeout"));
    try {
      const tasks = candidates.map(([k, list]) => tryLoadFirst(k, list));
      await Promise.race([Promise.all(tasks), timeout]);
      sprites.ready = sprites.map.size > 0;
    } catch { sprites.ready = sprites.map.size > 0; }
  }

  // ───────────────────────── Game constants ─────────────────────────
  const COLS = 8;
  let ROWS = desiredRows();

  const CellType = Object.freeze({ Empty: 0, Coin: 1, Gem: 2, Bonus: 3, Trap: 4, Block: 5 });

  const CELL_COLORS = {
    [CellType.Empty]: "rgba(0,0,0,0)",
    [CellType.Coin]: "#2ef2a0",
    [CellType.Gem]:  "#6ab0ff",
    [CellType.Bonus]:"#ffd35a",
    [CellType.Trap]: "#ff6b3d",
    [CellType.Block]:"#7f8aa8",
  };

  function canvasAR() { return COLS / ROWS; }

  // ───────────────────────── Runtime state ─────────────────────────
  let running = false, paused = false, gameOver = false, inLevelUp = false;
  let score = 0, streak = 0, mult = 1.0, level = 1;

  let levelStartScore = 0;
  let nextLevelAt = 220;

  let grid = [];
  let consumed = [];
  let gridReady = false;

  let dpr = 1;
  let cssCanvasW = 0, cssCanvasH = 0;

  let cellPx = 18;
  let gridW = 0, gridH = 0;
  let offX = 0, offY = 0;

  let scrollPx = 0;
  let runTime = 0;

  let zoneBase = 3;
  let zoneExtra = 0;
  let zoneH = 3;
  let zoneY0 = 0;

  let targetCol = 3;
  let targetRow = 1;
  let colF = 3;
  let rowF = 1;

  const HP_START = 10;
  const HP_CAP = 24;
  let hpMax = HP_START;
  let hp = HP_START;

  let shields = 0;

  let magnet = 0;
  let magnetTime = 0;

  let scoreBoost = 0;
  let trapResist = 0;
  let rerolls = 0;

  let coinValue = 10;
  let gemValue = 30;
  let bonusValue = 60;

  const COMBO_POOL = [
    [CellType.Coin, CellType.Coin, CellType.Gem],
    [CellType.Gem, CellType.Coin, CellType.Bonus],
    [CellType.Coin, CellType.Gem, CellType.Gem],
    [CellType.Bonus, CellType.Coin, CellType.Gem],
    [CellType.Coin, CellType.Coin, CellType.Coin, CellType.Bonus],
  ];
  let combo = [];
  let comboIdx = 0;
  let comboTimeMax = 6.0;
  let comboTime = 6.0;

  let toastT = 0;
  let playerPulse = 0;
  let zonePulse = 0;

  let shakeT = 0;
  let shakePow = 0;

  let hitFlashT = 0;
  let hitFlashMax = 1;
  let hitFlashColor = "#ff2b4d";

  const particles = [];
  const floatTexts = [];

  const bgStars = [];
  function initBgStars() {
    bgStars.length = 0;
    const n = clampInt(Math.round(42 + (cssCanvasW * cssCanvasH) / 18000), 40, 140);
    for (let i = 0; i < n; i++) {
      bgStars.push({
        x: Math.random() * Math.max(1, cssCanvasW),
        y: Math.random() * Math.max(1, cssCanvasH),
        s: 0.6 + Math.random() * 1.8,
        a: 0.04 + Math.random() * 0.18,
        vy: 6 + Math.random() * 22,
        tw: 0.8 + Math.random() * 1.8,
        t: Math.random() * 10,
      });
    }
  }
  function tickBgStars(dtMs) {
    if (!bgStars.length) return;
    const dt = dtMs / 1000;
    for (const st of bgStars) {
      st.t += dt * st.tw;
      st.y += st.vy * dt;
      if (st.y > cssCanvasH + 4) {
        st.y = -4;
        st.x = Math.random() * Math.max(1, cssCanvasW);
        st.vy = 6 + Math.random() * 22;
        st.a = 0.04 + Math.random() * 0.18;
        st.s = 0.6 + Math.random() * 1.8;
        st.tw = 0.8 + Math.random() * 1.8;
      }
    }
  }

  // ───────────────────────── DOM refs ─────────────────────────
  let stage, canvasWrap, gameArea, hud, canvas, ctx;
  let brandSub;

  let pillScore, pillBest, pillStreak, pillMult, pillLevel, pillSpeed, pillPlayer, pillUpdate, pillOffline, pillVersion;
  let btnOptions, btnPause, btnRestart, btnInstall;

  let overlayLoading, overlayPress, loadingSub, btnPressStart, pressMeta;
  let pillModeVal, railCanvasEl;

  let overlayPaused, overlayUpgrades, overlayGameOver, overlayError;
  let btnResume, btnQuitToStart, btnPausedRestart;

  let upTitle, upSub, upgradeChoices, btnReroll, btnSkipUpgrade;

  let goStats, goScoreBig, goBestBig, btnBackToStart, btnRetry;

  let btnCloseOptions, optSprites, optVibration, optDpad, optFx, optFxValue, btnClearLocal, btnRepairPWA;
  let optMusicOn, optSfxOn, optMusicVol, optMusicVolValue, optSfxVol, optSfxVolValue, optMuteAll, btnTestAudio;

  let optLang = null;

  let errMsg, btnErrClose, btnErrReload;

  let comboSeq, comboTimerVal, comboHint, toast;
  let levelProgFill, levelProgText, levelProgPct;

  let dpad, btnUp, btnDown, btnLeft, btnRight;

  // Menú tabs + paneles (creados dinámicamente si no existen)
  let startTabBar = null;
  let startTabPlay = null;
  let startTabCatalog = null;
  let startTabShop = null;
  let startPanelPlay = null;

  let catalogHost = null;
  let shopHost = null;
  let catalogList = null;
  let catalogSearch = null;
  let shopList = null;
  let shopMeta = null;
  let btnShopRefresh = null;

  // HUD flotante
  let hudFloat = null;
  let hudStatus = null;
  let hudHearts = null;
  let hudBuffs = null;
  let _hudPosRAF = 0;
  let _hudRO = null;
  let _hudAnchorRO = null;

  // ───────────────────────── Error handling global ─────────────────────────
  let fatalStop = false;

  function showFatal(err) {
    try {
      fatalStop = true;
      console.error(err);
      try { overlayHide(overlayLoading); } catch {}
      const msg =
        (err && err.message) ? err.message :
        (typeof err === "string" ? err : "Error desconocido");
      if (errMsg) errMsg.textContent = msg;
      if (overlayError) overlayShow(overlayError);
      if (!overlayError) alert(msg);
    } catch {}
  }
  window.addEventListener("error", (e) => showFatal(e?.error || new Error(e?.message || "Error")));
  window.addEventListener("unhandledrejection", (e) => showFatal(e?.reason || new Error("Promise rejection")));

  // ───────────────────────── UI helpers ─────────────────────────
  function showToast(msg, ms = 900) {
    if (!toast) return;
    toast.textContent = String(msg ?? "");
    toast.hidden = false;
    toast.classList.add("show");
    toastT = ms;
  }
  function hideToast() {
    if (!toast) return;
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 180);
    toastT = 0;
  }

  function setOfflinePill() {
    if (!pillOffline) return;
    try { pillOffline.hidden = navigator.onLine; } catch { pillOffline.hidden = true; }
  }

  function speedRowsPerSec() {
    const t = runTime;
    const base = 1.05;
    const byTime = 0.026 * t;
    const byLevel = 0.075 * (level - 1);
    return clamp(base + byTime + byLevel, 0.9, 6.0);
  }

  function updateLevelProgressUI() {
    const denom = Math.max(1, (nextLevelAt - levelStartScore));
    const v = clamp((score - levelStartScore) / denom, 0, 1);
    if (levelProgFill) levelProgFill.style.width = `${Math.round(v * 100)}%`;
    if (levelProgText) levelProgText.textContent = `Lv ${level} • ${Math.max(0, score - levelStartScore)}/${Math.max(1, nextLevelAt - levelStartScore)}`;
    if (levelProgPct) levelProgPct.textContent = `${Math.round(v * 100)}%`;
  }

  function fmtTimeShort(sec) {
    sec = Math.max(0, Number(sec) || 0);
    if (sec >= 99.5) return "99s";
    return `${Math.ceil(sec)}s`;
  }

  function escapeAttr(s) {
    const v = String(s ?? "");
    return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ───────────────────────── Layout Stability (NO layout shift) ─────────────────────────
  function ensureLayoutStableCSS() {
    if (document.getElementById("grLayoutStableCss")) return;
    try {
      const st = document.createElement("style");
      st.id = "grLayoutStableCss";
      st.textContent = `
/* Anti layout-shift: overlays y toast fuera del flow */
#toast{
  position:fixed !important;
  left:50% !important;
  transform:translateX(-50%) !important;
  bottom:calc(env(safe-area-inset-bottom, 0px) + 16px) !important;
  z-index:80 !important;
  pointer-events:none !important;
  max-width:min(92vw, 560px) !important;
}
#hudFloat{position:absolute;inset:0;pointer-events:none;z-index:40;overflow:visible}
#hudStatus{position:absolute;left:0;top:0;transform:translate(0,0);pointer-events:none;will-change:transform}
.upFxCanvas{position:absolute;inset:0;pointer-events:none}

/* Tabs del menú principal (solo si existen) */
#startTabBar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin:0 0 12px 0}
.startTabBtn{
  appearance:none;border:1px solid rgba(255,255,255,0.14);
  background:rgba(255,255,255,0.06);
  color:inherit;border-radius:12px;padding:10px 12px;
  font-weight:800;letter-spacing:0.2px;
  cursor:pointer;user-select:none;
}
.startTabBtn.active{
  border-color:rgba(106,176,255,0.45);
  background:rgba(106,176,255,0.10);
}
#startPanels .startPanel{display:block}
#startPanels .startPanel[hidden]{display:none !important}
#startPanelCatalog, #startPanelShop{
  overflow:auto; max-height:min(68vh, 560px);
  border:1px solid rgba(255,255,255,0.10);
  background:rgba(0,0,0,0.18);
  border-radius:14px; padding:12px;
}
.catalogGrid, .shopGrid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
  gap:10px;
}
.catCard, .shopCard{
  border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.06);
  border-radius:14px;
  padding:12px;
}
.catCard .row, .shopCard .row{display:flex;gap:10px;align-items:flex-start}
.catCard .icon, .shopCard .icon{
  width:44px;height:44px;border-radius:12px;
  display:grid;place-items:center;
  background:rgba(255,255,255,0.07);
  border:1px solid rgba(255,255,255,0.10);
  flex:0 0 auto;
}
.catCard .ttl, .shopCard .ttl{font-weight:900}
.catCard .sub, .shopCard .sub{opacity:0.85;font-size:13px;line-height:1.35}
.catBadges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.catBadge{border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);border-radius:999px;padding:4px 8px;font-weight:800;font-size:12px;opacity:0.95}
.shopActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.shopBtn{
  appearance:none;border:1px solid rgba(255,255,255,0.14);
  background:rgba(255,255,255,0.08);color:inherit;
  border-radius:12px;padding:9px 10px;font-weight:900;cursor:pointer
}
.shopBtn.primary{
  border-color:rgba(46,242,160,0.35);
  background:rgba(46,242,160,0.10);
}
      `.trim();
      document.head.appendChild(st);
    } catch {}
  }

  function forceOverlayFixed(el, z = 50) {
    if (!el) return;
    try {
      const cs = getComputedStyle(el);
      // Si ya está fixed/absolute, no tocamos (respetar CSS)
      if (cs.position === "static" || !cs.position) {
        el.style.position = "fixed";
        el.style.left = "0";
        el.style.top = "0";
        el.style.right = "0";
        el.style.bottom = "0";
        el.style.inset = "0";
      }
      if (!el.style.zIndex) el.style.zIndex = String(z);
      // Evitar que el overlay entre en el flow por display accidental (solo si era block sin posicionar)
      // Aquí NO cambiamos display para no romper tu CSS.
    } catch {}
  }

  function stabilizeToastEl() {
    if (!toast) return;
    try {
      const cs = getComputedStyle(toast);
      if (cs.position === "static" || !cs.position) {
        toast.style.position = "fixed";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 16px)";
        toast.style.zIndex = "80";
        toast.style.pointerEvents = "none";
      }
    } catch {}
  }

  function stabilizeOverlaysNow() {
    // Orden de z para que no se solapen raro
    forceOverlayFixed(overlayLoading, 90);
    forceOverlayFixed(overlayError, 95);
    forceOverlayFixed(overlayPress, 70);
    forceOverlayFixed(overlayStart, 70);
    forceOverlayFixed(overlayOptions, 80);
    forceOverlayFixed(overlayUpgrades, 85);
    forceOverlayFixed(overlayPaused, 82);
    forceOverlayFixed(overlayGameOver, 86);
  }

  // ───────────────────────── HUD FLOAT LAYER ─────────────────────────
  function ensureHudFloatLayer() {
    ensureLayoutStableCSS();
    if (hudFloat && hudFloat.parentElement) return;

    const existing = $("hudFloat");
    if (existing) { hudFloat = existing; return; }

    const host = stage || document.body;
    if (!host) return;

    try {
      const cs = getComputedStyle(host);
      if (cs.position === "static") host.style.position = "relative";
      if (cs.overflow === "hidden") host.style.overflow = "visible";
    } catch {}

    try {
      const f = document.createElement("div");
      f.id = "hudFloat";
      f.className = "hudFloat";
      host.appendChild(f);
      hudFloat = f;
    } catch {}
  }

  function getLevelProgressAnchor() {
    return $("levelProgress") ||
      levelProgText?.closest?.("#levelProgress") ||
      levelProgFill?.closest?.("#levelProgress") ||
      levelProgText?.closest?.(".levelProgress") ||
      levelProgFill?.closest?.(".levelProgress") ||
      null;
  }

  function scheduleHudStatusPosition() {
    if (_hudPosRAF) return;
    _hudPosRAF = raf(() => {
      _hudPosRAF = 0;
      positionHudStatus();
    });
  }

  function positionHudStatus() {
    if (!hudStatus || !hudFloat) return;

    const ref = stage || document.body;
    const refRect = ref.getBoundingClientRect?.();
    if (!refRect) return;

    const vv = window.visualViewport || null;
    const vvTop = vv ? Math.max(0, vv.offsetTop || 0) : 0;
    const vvLeft = vv ? Math.max(0, vv.offsetLeft || 0) : 0;

    const anchor = getLevelProgressAnchor();

    let x = Math.max(0, Math.round(refRect.width - 260));
    let y = 8 + vvTop;
    let w = 260;

    if (anchor?.getBoundingClientRect) {
      const a = anchor.getBoundingClientRect();
      x = Math.round((a.left - refRect.left) + vvLeft);
      y = Math.round((a.bottom - refRect.top) + 6 + vvTop);
      w = Math.round(a.width);

      if ((y + 52) > (refRect.height + vvTop)) y = Math.round((a.top - refRect.top) - 52 - 6 + vvTop);

      x = clampInt(x, 6, Math.max(6, Math.round(refRect.width - 6 - w)));
      y = clampInt(y, 6, Math.max(6, Math.round(refRect.height - 6 - 52)));
    }

    hudStatus.style.left = "0px";
    hudStatus.style.top = "0px";
    hudStatus.style.width = `${Math.max(220, w)}px`;
    hudStatus.style.transform = `translate(${x}px, ${y}px)`;
  }

  function shouldShowHudStatus() {
    if (!running) return false;
    if (overlayUpgrades && !overlayUpgrades.hidden) return false;
    if (overlayOptions && !overlayOptions.hidden) return false;
    if (overlayGameOver && !overlayGameOver.hidden) return false;
    if (overlayLoading && !overlayLoading.hidden) return false;
    if (overlayError && !overlayError.hidden) return false;
    if (overlayStart && !overlayStart.hidden) return false;
    if (overlayPress && !overlayPress.hidden) return false;
    return true;
  }

  function ensureHudStatusUI() {
    ensureHudFloatLayer();
    if (!hudFloat) return;

    const existing = $("hudStatus");
    if (existing) {
      hudStatus = existing;
      hudHearts = $("hudHearts");
      hudBuffs = $("hudBuffs");
      if (!hudStatus.parentElement) hudFloat.appendChild(hudStatus);
      return;
    }

    if (hudStatus && hudStatus.parentElement) return;

    try {
      const wrap = document.createElement("div");
      wrap.id = "hudStatus";
      wrap.className = "statusBar";
      wrap.style.pointerEvents = "none";

      const hearts = document.createElement("div");
      hearts.id = "hudHearts";
      hearts.className = "hpWrap";

      const buffs = document.createElement("div");
      buffs.id = "hudBuffs";
      buffs.className = "buffBar";

      wrap.appendChild(hearts);
      wrap.appendChild(buffs);

      hudFloat.appendChild(wrap);

      hudStatus = wrap;
      hudHearts = hearts;
      hudBuffs = buffs;
    } catch {}
  }

  function installHudObservers() {
    try {
      if (window.ResizeObserver) {
        if (!_hudRO && (stage || hud)) {
          _hudRO = new ResizeObserver(() => scheduleHudStatusPosition());
          _hudRO.observe(stage || hud);
        }

        const anchor = getLevelProgressAnchor();
        if (!_hudAnchorRO && anchor) {
          _hudAnchorRO = new ResizeObserver(() => scheduleHudStatusPosition());
          _hudAnchorRO.observe(anchor);
        }
      }

      on(window.visualViewport, "resize", scheduleHudStatusPosition, { passive: true });
      on(window.visualViewport, "scroll", scheduleHudStatusPosition, { passive: true });

      document.fonts?.ready?.then?.(() => scheduleHudStatusPosition()).catch?.(() => {});
    } catch {}
  }

  function updateHeartsUI() {
    if (!hudHearts) return;

    const maxShow = isMobileLayout() ? 10 : 14;
    const showN = Math.min(hpMax, maxShow);
    const extra = Math.max(0, hpMax - showN);

    const hearts = [];
    for (let i = 0; i < showN; i++) {
      const full = i < hp;
      hearts.push(`<span class="ms heart ${full ? "full" : "empty"}">favorite</span>`);
    }

    hudHearts.innerHTML = `
<span class="ms hpIcon">favorite</span>
<span class="hpHearts">${hearts.join("")}</span>
${extra > 0 ? `<span class="hpMore">+${extra}</span>` : ``}
<span class="hpText mono">(${hp}/${hpMax})</span>
    `.trim();

    hudHearts.title = T("hud_hp_title", "Vida: {0}", `${hp}/${hpMax}`);
  }

  function makeBuffBadge({ kind, icon, count = 0, time = 0, title = "" }) {
    const showCount = Number(count) > 1;
    const showTime = Number(time) > 0;
    return `
<div class="buffBadge" data-kind="${escapeAttr(kind)}" title="${escapeAttr(title)}">
  <span class="ms bIcon">${escapeAttr(icon)}</span>
  ${showTime ? `<span class="bTime mono">${escapeAttr(fmtTimeShort(time))}</span>` : ``}
  ${showCount ? `<span class="bCount mono">${count | 0}</span>` : ``}
</div>
    `.trim();
  }

  const pickedCount = new Map();

  // ───────────────────────── Skills.js integration ─────────────────────────
  let Skills = null;
  let skillsEnabled = false;

  function callFirst(obj, names, ...args) {
    if (!obj) return undefined;
    for (const n of names) {
      const fn = obj[n];
      if (typeof fn === "function") return fn.apply(obj, args);
    }
    return undefined;
  }

  // API que recibe skills.js (si existe)
  const skillsApi = {
    version: APP_VERSION,
    log: (...a) => { try { console.log("[Skills]", ...a); } catch {} },

    // i18n opcional (skills.js NO depende, pero si lo quiere usar)
    t: (k, arg) => {
      try { return I18n.t(k, arg); } catch { return String(k); }
    },

    // RNG / helpers
    clamp, clampInt, randi, chance,

    // estado actual (lectura)
    getState: () => ({
      running, paused, gameOver, inLevelUp,
      score, streak, mult, level,
      runTime, ROWS, COLS,
      hp, hpMax, shields,
      magnet, magnetTime,
      scoreBoost, trapResist, rerolls,
      coinValue, gemValue, bonusValue,
      zoneBase, zoneExtra, zoneH,
    }),

    // mutadores (escritura segura)
    addScore: (delta) => { score = Math.max(0, (score | 0) + (delta | 0)); },
    setScore: (v) => { score = Math.max(0, (v | 0)); },

    addStreak: (d) => { streak = Math.max(0, (streak | 0) + (d | 0)); },
    setStreak: (v) => { streak = Math.max(0, (v | 0)); },

    addMult: (d) => { mult = clamp((Number(mult) || 1) + Number(d || 0), 1.0, 4.0); },
    setMult: (v) => { mult = clamp(Number(v || 1), 1.0, 4.0); },

    addLevel: (d) => { level = Math.max(1, (level | 0) + (d | 0)); },
    setLevel: (v) => { level = Math.max(1, (v | 0)); },

    addShield: (d = 1) => { shields = Math.max(0, (shields | 0) + (d | 0)); },
    setShields: (v) => { shields = Math.max(0, (v | 0)); },

    addMaxHP: (d = 1) => { hpMax = clampInt(hpMax + (d | 0), HP_START, HP_CAP); hp = clampInt(hp, 0, hpMax); },
    heal: (d = 1) => { hp = clampInt(hp + (d | 0), 0, hpMax); },
    damage: (d = 1) => { hp = clampInt(hp - (d | 0), 0, hpMax); },

    addMagnet: (d = 1) => { magnet = clampInt(Math.max(magnet, 0) + (d | 0), 0, 3); },
    setMagnet: (v) => { magnet = clampInt(v, 0, 3); },
    addMagnetTime: (sec) => { magnetTime = Math.max(0, Number(magnetTime) + Number(sec || 0)); },
    setMagnetTime: (sec) => { magnetTime = Math.max(0, Number(sec || 0)); },

    addScoreBoost: (d) => { scoreBoost = Math.max(0, Number(scoreBoost) + Number(d || 0)); },
    setScoreBoost: (v) => { scoreBoost = Math.max(0, Number(v || 0)); },

    addTrapResist: (d = 1) => { trapResist = clampInt(trapResist + (d | 0), 0, 9); },
    setTrapResist: (v) => { trapResist = clampInt(v, 0, 9); },

    addZoneExtra: (d = 1) => { zoneExtra = clampInt(zoneExtra + (d | 0), 0, 9); recomputeZone(); },
    setZoneExtra: (v) => { zoneExtra = clampInt(v, 0, 9); recomputeZone(); },

    addReroll: (d = 1) => { rerolls = clampInt(rerolls + (d | 0), 0, 99); },
    setRerolls: (v) => { rerolls = clampInt(v, 0, 99); },

    addCoinValue: (d = 1) => { coinValue = Math.max(1, (coinValue | 0) + (d | 0)); },
    addGemValue: (d = 1) => { gemValue = Math.max(1, (gemValue | 0) + (d | 0)); },
    addBonusValue: (d = 1) => { bonusValue = Math.max(1, (bonusValue | 0) + (d | 0)); },

    // UI / feedback
    toast: (msg, ms) => showToast(msg, ms),
    flash: (color, ms) => flash(color, ms),
    shake: (ms, pow) => shake(ms, pow),
    sfx: (name) => { try { AudioSys.sfx(name); } catch {} },
    vibrate: (ms) => vibrate(ms),

    // estado UI
    updateHUD: () => { updatePillsNow(); },

    // picks map compartido (skills.js lo usa para stacks/limits)
    pickedCount,
  };

  function initSkillsPackIfPresent() {
    try {
      const GRSkills = (typeof window !== "undefined") ? window.GRSkills : null;
      if (!GRSkills || !isFn(GRSkills.create)) {
        Skills = null;
        skillsEnabled = false;
        return;
      }

      const inst = GRSkills.create(skillsApi, pickedCount);
      Skills = inst || null;
      skillsEnabled = !!Skills;

      // init hooks opcionales
      callFirst(Skills, ["onInit", "init"], skillsApi);
      callFirst(Skills, ["onBoot"], skillsApi);
    } catch (e) {
      console.warn("skills.js init failed:", e);
      Skills = null;
      skillsEnabled = false;
    }
  }

  function skillsGetLevelUpChoices(n = 3) {
    if (!Skills) return null;

    const out =
      callFirst(Skills, ["getLevelUpChoices", "rollLevelUp", "makeLevelUpChoices", "levelUpChoices", "pickLevelUpChoices"], n) ??
      callFirst(Skills, ["getChoices", "rollChoices", "choices"], { kind: "levelup", count: n, level }) ??
      null;

    return Array.isArray(out) ? out : null;
  }

  function skillsPick(choice) {
    if (!Skills || !choice) return false;

    const id = (typeof choice === "string") ? choice : (choice.id || choice.key || choice.skillId || "");
    if (!id) return false;

    const ok =
      !!callFirst(Skills, ["pick", "choose", "take", "apply", "select"], id, choice);

    // si no devuelve boolean, asumimos ok si no petó
    return ok || ok === undefined;
  }

  function skillsCanReroll() {
    if (!Skills) return (rerolls > 0);
    const v = callFirst(Skills, ["canReroll", "canRerollLevelUp"], { level, rerolls }) ?? null;
    if (typeof v === "boolean") return v;
    return rerolls > 0;
  }

  function skillsRerollLevelUp() {
    if (!Skills) return false;
    const out = callFirst(Skills, ["rerollLevelUp", "rerollChoices", "reroll"], { kind: "levelup", level, rerolls });
    if (out === false) return false;
    return true;
  }

  function skillsGetBadges() {
    if (!Skills) return null;
    const b =
      callFirst(Skills, ["getBadges", "badges", "getBuffBadges", "getHUD"], skillsApi.getState()) ??
      null;
    return Array.isArray(b) ? b : null;
  }

  // ───────────────────────── Catálogo / Tienda (Skills) ─────────────────────────
  function skillsGetCatalog() {
    if (!Skills) return null;
    const out =
      callFirst(Skills, ["getCatalog", "listCatalog", "catalog", "getAllSkills", "allSkills"], { kind: "catalog" }) ??
      callFirst(Skills, ["getAll", "all"], "catalog") ??
      null;
    return Array.isArray(out) ? out : null;
  }

  function skillsGetShopOffers(count = 6) {
    if (!Skills) return null;
    const out =
      callFirst(Skills, ["getShopOffers", "getShopPicks", "shopPicks", "rollShop", "shop"], { count }) ??
      callFirst(Skills, ["getChoices", "choices"], { kind: "shop", count }) ??
      null;
    return Array.isArray(out) ? out : null;
  }

  function skillsBuyFromShop(choice) {
    if (!Skills || !choice) return false;
    const id = String(choice.id || choice.key || choice.skillId || "");
    if (!id) return false;
    const out =
      callFirst(Skills, ["buy", "purchase", "buyShop", "shopBuy"], id, choice) ??
      callFirst(Skills, ["pick", "choose", "take", "apply", "select"], id, choice) ??
      null;
    if (typeof out === "boolean") return out;
    return out !== false;
  }

  function normalizeChoiceForUI(u) {
    if (!u) return null;
    const id = String(u.id || u.key || u.skillId || u.nameKey || "");
    const rarity = String(u.rarity || u.tier || u.rare || "common");
    const icon = String(u.icon || u.iconName || upgradeIcon(u) || "upgrade");
    const tags = u.tags || u.tag || u.tagKey || null;

    const name =
      (typeof u.name === "string" && u.name.trim()) ? u.name.trim() :
      (typeof u.title === "string" && u.title.trim()) ? u.title.trim() :
      (u.nameKey ? (I18n.t(u.nameKey) !== u.nameKey ? I18n.t(u.nameKey) : u.nameKey) : id);

    const desc =
      (typeof u.desc === "string" && u.desc.trim()) ? u.desc.trim() :
      (typeof u.description === "string" && u.description.trim()) ? u.description.trim() :
      (u.descKey ? (I18n.t(u.descKey) !== u.descKey ? I18n.t(u.descKey) : "") : "");

    const maxLv = Number(u.max ?? u.maxLevel ?? u.cap ?? 999) || 999;
    const curLv = (pickedCount.get(id) || 0) + 1;

    let tagText = "";
    if (Array.isArray(tags) && tags.length) tagText = String(tags[0]);
    else if (typeof tags === "string") tagText = tags;
    else if (typeof u.tagName === "string") tagText = u.tagName;
    else if (typeof u.tagKey === "string") tagText = I18n.t(u.tagKey);

    const extraMeta =
      (typeof u.meta === "string" && u.meta) ? u.meta :
      (u.duration ? `⏱ ${u.duration}s` : "");

    return { raw: u, id, rarity, icon, name, desc, tagText, maxLv, curLv, extraMeta };
  }

  function renderCatalog() {
    if (!catalogList) return;
    const q = (catalogSearch?.value || "").trim().toLowerCase();
    const items = skillsGetCatalog() || [];
    if (!items.length) {
      catalogList.innerHTML = `
<div class="catCard">
  <div class="row">
    <div class="icon"><span class="ms">info</span></div>
    <div>
      <div class="ttl">${escapeAttr(T("catalog_empty", "Catálogo no disponible"))}</div>
      <div class="sub">${escapeAttr(T("catalog_need_skills", "Cargando skills.js… (o no está incluido)."))}</div>
    </div>
  </div>
</div>`;
      return;
    }

    const view = [];
    for (const it of items) {
      const ui = normalizeChoiceForUI(it);
      if (!ui) continue;

      if (q) {
        const hay = `${ui.name} ${ui.desc} ${ui.id} ${ui.tagText}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const owned = (pickedCount.get(ui.id) || 0);
      const rarityText = rarityLabel(ui.rarity);

      view.push(`
<div class="catCard" data-rarity="${escapeAttr(ui.rarity)}" data-id="${escapeAttr(ui.id)}">
  <div class="row">
    <div class="icon"><span class="ms">${escapeAttr(ui.icon)}</span></div>
    <div style="min-width:0">
      <div class="ttl">${escapeAttr(ui.name)}</div>
      <div class="sub">${escapeAttr(ui.desc || "—")}</div>
      <div class="catBadges">
        <span class="catBadge">${escapeAttr(rarityText)}</span>
        ${ui.tagText ? `<span class="catBadge">${escapeAttr(ui.tagText)}</span>` : ``}
        <span class="catBadge">${escapeAttr(`Owned: ${owned}`)}</span>
        <span class="catBadge">${escapeAttr(`Cap: ${ui.maxLv}`)}</span>
        ${ui.extraMeta ? `<span class="catBadge">${escapeAttr(ui.extraMeta)}</span>` : ``}
      </div>
    </div>
  </div>
</div>`);
    }

    catalogList.innerHTML = view.join("") || `
<div class="catCard">
  <div class="row">
    <div class="icon"><span class="ms">search_off</span></div>
    <div>
      <div class="ttl">${escapeAttr(T("catalog_no_match", "Sin resultados"))}</div>
      <div class="sub">${escapeAttr(T("catalog_try_other", "Prueba otra búsqueda."))}</div>
    </div>
  </div>
</div>`;
  }

  let _shopOffers = [];

  function renderShop() {
    if (!shopList) return;

    _shopOffers = skillsGetShopOffers(6) || [];

    if (!_shopOffers.length) {
      shopList.innerHTML = `
<div class="shopCard">
  <div class="row">
    <div class="icon"><span class="ms">store</span></div>
    <div>
      <div class="ttl">${escapeAttr(T("shop_empty", "Tienda no disponible"))}</div>
      <div class="sub">${escapeAttr(T("shop_need_skills", "Necesitas skills.js para Tienda/Cofres (o aún no está listo)."))}</div>
    </div>
  </div>
</div>`;
      if (shopMeta) shopMeta.textContent = "";
      return;
    }

    if (shopMeta) shopMeta.textContent = T("shop_hint", "La tienda depende del pack de skills (precios/moneda los define skills.js).");

    const html = [];
    for (const it of _shopOffers) {
      const ui = normalizeChoiceForUI(it);
      if (!ui) continue;

      const rarityText = rarityLabel(ui.rarity);
      const owned = (pickedCount.get(ui.id) || 0);

      html.push(`
<div class="shopCard" data-id="${escapeAttr(ui.id)}">
  <div class="row">
    <div class="icon"><span class="ms">${escapeAttr(ui.icon)}</span></div>
    <div style="min-width:0;flex:1">
      <div class="ttl">${escapeAttr(ui.name)}</div>
      <div class="sub">${escapeAttr(ui.desc || "—")}</div>
      <div class="catBadges">
        <span class="catBadge">${escapeAttr(rarityText)}</span>
        ${ui.tagText ? `<span class="catBadge">${escapeAttr(ui.tagText)}</span>` : ``}
        <span class="catBadge">${escapeAttr(`Owned: ${owned}`)}</span>
      </div>
      <div class="shopActions">
        <button class="shopBtn primary" data-buy="${escapeAttr(ui.id)}">${escapeAttr(T("shop_buy", "Comprar"))}</button>
      </div>
    </div>
  </div>
</div>`);
    }
    shopList.innerHTML = `<div class="shopGrid">${html.join("")}</div>`;

    // wire buy
    const buttons = shopList.querySelectorAll?.("[data-buy]");
    buttons?.forEach?.((btn) => {
      on(btn, "click", () => {
        const id = btn.getAttribute("data-buy") || "";
        const found = _shopOffers.find(x => String(x.id || x.key || x.skillId || "") === id) || null;
        AudioSys.unlock();

        const ok = found ? skillsBuyFromShop(found) : false;
        if (ok) {
          // marca pick para stacks/limits y refresca UI (skills.js suele hacerlo internamente también)
          pickedCount.set(id, (pickedCount.get(id) || 0) + 1);
          showToast(T("shop_bought", "Comprado"), 850);
          AudioSys.sfx("upgrade");
          updatePillsNow();
          renderCatalog();
          renderShop();
        } else {
          showToast(T("shop_nope", "No se pudo comprar"), 900);
          AudioSys.sfx("ui");
        }
      });
    });
  }

  // ───────────────────────── Menú principal con pestañas ─────────────────────────
  let _startActiveTab = "play";

  function setStartTab(tab) {
    _startActiveTab = tab;

    if (startTabPlay) startTabPlay.classList.toggle("active", tab === "play");
    if (startTabCatalog) startTabCatalog.classList.toggle("active", tab === "catalog");
    if (startTabShop) startTabShop.classList.toggle("active", tab === "shop");

    if (startPanelPlay) startPanelPlay.hidden = (tab !== "play");
    if (startPanelCatalog) startPanelCatalog.hidden = (tab !== "catalog");
    if (startPanelShop) startPanelShop.hidden = (tab !== "shop");

    // cuando cambiamos a Catálogo/Tienda, aseguramos render y que el scroll esté permitido
    if (tab === "catalog") renderCatalog();
    if (tab === "shop") renderShop();
  }

  function ensureStartTabsUI() {
    if (!overlayStart) return;

    // Si ya existe una estructura, solo cacheamos refs
    const existingBar = $("startTabBar") || overlayStart.querySelector?.("#startTabBar");
    const existingPanels = $("startPanels") || overlayStart.querySelector?.("#startPanels");
    if (existingBar && existingPanels) {
      startTabBar = existingBar;
      startPanelPlay = $("startPanelPlay") || overlayStart.querySelector?.("#startPanelPlay");
      startPanelCatalog = $("startPanelCatalog") || overlayStart.querySelector?.("#startPanelCatalog");
      startPanelShop = $("startPanelShop") || overlayStart.querySelector?.("#startPanelShop");

      startTabPlay = $("startTabPlay") || overlayStart.querySelector?.("#startTabPlay");
      startTabCatalog = $("startTabCatalog") || overlayStart.querySelector?.("#startTabCatalog");
      startTabShop = $("startTabShop") || overlayStart.querySelector?.("#startTabShop");

      catalogHost = $("catalogHost") || overlayStart.querySelector?.("#catalogHost");
      shopHost = $("shopHost") || overlayStart.querySelector?.("#shopHost");
      catalogList = $("catalogList") || overlayStart.querySelector?.("#catalogList");
      catalogSearch = $("catalogSearch") || overlayStart.querySelector?.("#catalogSearch");
      shopList = $("shopList") || overlayStart.querySelector?.("#shopList");
      shopMeta = $("shopMeta") || overlayStart.querySelector?.("#shopMeta");
      btnShopRefresh = $("btnShopRefresh") || overlayStart.querySelector?.("#btnShopRefresh");
      return;
    }

    // Creamos tabs “sin romper” el contenido: metemos todo lo actual en Play panel
    try {
      const host =
        overlayStart.querySelector?.(".startPanel") ||
        overlayStart.querySelector?.(".panel") ||
        overlayStart;

      if (!host) return;

      // contenedor tabs + panels
      const bar = document.createElement("div");
      bar.id = "startTabBar";
      bar.className = "startTabBar";

      const mkBtn = (id, label, tab) => {
        const b = document.createElement("button");
        b.id = id;
        b.className = "startTabBtn";
        b.type = "button";
        b.textContent = label;
        b.dataset.tab = tab;
        return b;
      };

      const bPlay = mkBtn("startTabPlay", T("tab_play", "Jugar"), "play");
      const bCat  = mkBtn("startTabCatalog", T("tab_catalog", "Catálogo"), "catalog");
      const bShop = mkBtn("startTabShop", T("tab_shop", "Tienda"), "shop");

      bar.appendChild(bPlay);
      bar.appendChild(bCat);
      bar.appendChild(bShop);

      const panels = document.createElement("div");
      panels.id = "startPanels";

      const panelPlay = document.createElement("div");
      panelPlay.id = "startPanelPlay";
      panelPlay.className = "startPanel";

      const panelCatalog = document.createElement("div");
      panelCatalog.id = "startPanelCatalog";
      panelCatalog.className = "startPanel";
      panelCatalog.hidden = true;

      const panelShop = document.createElement("div");
      panelShop.id = "startPanelShop";
      panelShop.className = "startPanel";
      panelShop.hidden = true;

      // mover hijos actuales del host al panelPlay (menos si ya están dentro de host y son el mismo panel)
      const moving = [];
      for (const ch of Array.from(host.childNodes)) moving.push(ch);
      for (const ch of moving) panelPlay.appendChild(ch);

      // construir catálogo
      const catWrap = document.createElement("div");
      catWrap.id = "catalogHost";
      catWrap.innerHTML = `
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
  <div style="font-weight:900">${escapeAttr(T("catalog_title", "Catálogo"))}</div>
  <div style="flex:1"></div>
  <input id="catalogSearch" class="input" type="search" placeholder="${escapeAttr(T("catalog_search", "Buscar…"))}" style="min-width:220px;max-width:360px;width:100%" />
</div>
<div id="catalogList" class="catalogGrid"></div>
      `.trim();
      panelCatalog.appendChild(catWrap);

      // construir tienda
      const shopWrap = document.createElement("div");
      shopWrap.id = "shopHost";
      shopWrap.innerHTML = `
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
  <div style="font-weight:900">${escapeAttr(T("shop_title", "Tienda"))}</div>
  <div style="flex:1"></div>
  <button id="btnShopRefresh" class="shopBtn" type="button">${escapeAttr(T("shop_refresh", "Refrescar"))}</button>
</div>
<div id="shopMeta" style="opacity:0.85;font-size:13px;margin:0 0 10px 0"></div>
<div id="shopList" class="shopGrid"></div>
      `.trim();
      panelShop.appendChild(shopWrap);

      panels.appendChild(panelPlay);
      panels.appendChild(panelCatalog);
      panels.appendChild(panelShop);

      // Inyectamos tabs arriba del host
      host.appendChild(bar);
      host.appendChild(panels);

      // cache refs
      startTabBar = bar;
      startTabPlay = bPlay;
      startTabCatalog = bCat;
      startTabShop = bShop;

      startPanelPlay = panelPlay;
      startPanelCatalog = panelCatalog;
      startPanelShop = panelShop;

      catalogHost = catWrap;
      shopHost = shopWrap;
      catalogSearch = $("catalogSearch");
      catalogList = $("catalogList");
      shopList = $("shopList");
      shopMeta = $("shopMeta");
      btnShopRefresh = $("btnShopRefresh");

      // eventos
      on(bPlay, "click", () => { AudioSys.unlock(); setStartTab("play"); AudioSys.sfx("ui"); });
      on(bCat, "click", () => { AudioSys.unlock(); setStartTab("catalog"); AudioSys.sfx("ui"); });
      on(bShop, "click", () => { AudioSys.unlock(); setStartTab("shop"); AudioSys.sfx("ui"); });

      on(catalogSearch, "input", () => renderCatalog());
      on(btnShopRefresh, "click", () => { AudioSys.unlock(); renderShop(); AudioSys.sfx("ui"); });

      // estado inicial
      setStartTab("play");
    } catch {}
  }

  // ───────────────────────── Buffs UI ─────────────────────────
  function updateBuffsUI() {
    if (!hudBuffs) return;

    const items = [];

    // 1) badges desde skills.js si existen (prioridad)
    const sb = skillsGetBadges();
    if (sb && sb.length) {
      for (const bb of sb) {
        if (!bb) continue;
        const kind = String(bb.kind || bb.id || "skill");
        const icon = String(bb.icon || "upgrade");
        const count = Number(bb.count || bb.stack || 0) || 0;
        const time = Number(bb.time || bb.remaining || 0) || 0;
        const title = String(bb.title || bb.name || kind);
        items.push(makeBuffBadge({ kind, icon, count, time, title }));
      }
      hudBuffs.innerHTML = items.join("");
      return;
    }

    // 2) fallback (modo base)
    if (shields > 0) items.push(makeBuffBadge({ kind: "shield", icon: "shield", count: shields, title: T("buff_shield", "Escudo") }));
    if (magnet > 0 && magnetTime > 0.01) items.push(makeBuffBadge({ kind: "magnet", icon: "compass_calibration", count: magnet, time: magnetTime, title: T("buff_magnet", "Imán") }));

    const boostCount = pickedCount.get("boost") || 0;
    if (boostCount > 0) items.push(makeBuffBadge({ kind: "boost", icon: "bolt", count: boostCount, title: T("buff_boost", "Puntos +") }));

    if (trapResist > 0) items.push(makeBuffBadge({ kind: "resist", icon: "verified_user", count: trapResist, title: T("buff_trap_resist", "Resistencia a trampas") }));
    if (zoneExtra > 0) items.push(makeBuffBadge({ kind: "zone", icon: "open_with", count: zoneExtra, title: T("buff_zone", "Zona +") }));
    if (rerolls > 0) items.push(makeBuffBadge({ kind: "reroll", icon: "casino", count: rerolls, title: T("buff_rerolls", "Rerolls") }));

    const hpExtra = Math.max(0, hpMax - HP_START);
    if (hpExtra > 0) items.push(makeBuffBadge({ kind: "hp", icon: "favorite", count: hpExtra + 1, title: T("buff_hp", "Vida máxima") }));

    hudBuffs.innerHTML = items.join("");
  }

  function updateStatusHUD() {
    ensureHudStatusUI();
    if (hudStatus) {
      hudStatus.hidden = !shouldShowHudStatus();
      hudStatus.classList.toggle("compact", isMobileLayout());
      hudStatus.style.pointerEvents = "none";
    }
    updateHeartsUI();
    updateBuffsUI();
    scheduleHudStatusPosition();
  }

  // Pills a 10Hz
  let pillAccMs = 0;
  function updatePillsNow() {
    setPill(pillScore, score | 0);
    setPill(pillBest, best | 0);
    setPill(pillStreak, streak | 0);
    setPill(pillMult, mult.toFixed(2));
    setPill(pillLevel, `Lv ${level}`);
    setPill(pillSpeed, `${speedRowsPerSec().toFixed(1)}x`);
    setPill(pillPlayer, playerName || I18n.t("defaultPlayer"));
    setOfflinePill();
    updateLevelProgressUI();
    updateStatusHUD();
  }

  function setupLanguageUI() {
    optLang = $("optLang");
    if (optLang) return;
    if (!overlayOptions) return;

    try {
      const host =
        overlayOptions.querySelector?.("#optionsBody") ||
        overlayOptions.querySelector?.(".panel") ||
        overlayOptions.querySelector?.(".card") ||
        overlayOptions;
      if (!host) return;

      if (overlayOptions.querySelector?.("#optLang")) { optLang = $("optLang"); return; }

      const row = document.createElement("div");
      row.id = "optLangRow";
      row.className = "optRow";

      const lab = document.createElement("label");
      lab.htmlFor = "optLang";
      lab.className = "optLabel";
      lab.textContent = I18n.t("opt_language");

      const sel = document.createElement("select");
      sel.id = "optLang";
      sel.className = "select";

      row.appendChild(lab);
      row.appendChild(sel);

      host.appendChild(row);
      optLang = sel;
    } catch {}
  }

  function fillLanguageOptions() {
    if (!optLang) return;
    const opts = I18n.languageOptions();
    optLang.innerHTML = "";
    for (const o of opts) {
      const op = document.createElement("option");
      op.value = o.code;
      op.textContent = o.label;
      optLang.appendChild(op);
    }
  }

  function applySettingsToUI() {
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx) optFx.value = String(settings.fx);
    if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);

    if (optMusicOn) optMusicOn.checked = !!settings.musicOn;
    if (optSfxOn) optSfxOn.checked = !!settings.sfxOn;
    if (optMusicVol) optMusicVol.value = String(settings.musicVol);
    if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
    if (optSfxVol) optSfxVol.value = String(settings.sfxVol);
    if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
    if (optMuteAll) optMuteAll.checked = !!settings.muteAll;

    if (optLang) {
      fillLanguageOptions();
      optLang.value = String(settings.lang || "auto");
    }

    const coarse = isCoarsePointer() || isMobileUA();
    if (dpad) dpad.hidden = !(coarse && settings.showDpad);
    document.documentElement.classList.toggle("dpadOn", coarse && settings.showDpad);

    I18n.applyDataAttrs(document);
    applyAudioSettingsNow();
    updateStatusHUD();
    resize();
  }

  // ───────────────────────── Grid ─────────────────────────
  function recomputeZone() {
    zoneH = clampInt(zoneBase + zoneExtra, 3, 9);
    zoneY0 = (ROWS - zoneH) - 2;
    zoneY0 = clampInt(zoneY0, 0, ROWS - zoneH);

    targetRow = clampInt(targetRow, 0, zoneH - 1);
    rowF = clamp(Number(rowF) || 0, 0, zoneH - 1);
  }

  function genRow() {
    const density = clamp(0.28 + (level - 1) * 0.005, 0.18, 0.52);
    const out = new Array(COLS).fill(CellType.Empty);

    for (let c = 0; c < COLS; c++) {
      if (!chance(density)) continue;

      const wGood = 0.64, wTrap = 0.18, wBlock = 0.18;
      let roll = Math.random() * (wGood + wTrap + wBlock);

      if (roll < wGood) {
        const gg = Math.random();
        out[c] = (gg < 0.68) ? CellType.Coin : (gg < 0.92) ? CellType.Gem : CellType.Bonus;
      } else if (roll < wGood + wTrap) out[c] = CellType.Trap;
      else out[c] = CellType.Block;
    }

    const blocks = out.reduce((a, v) => a + (v === CellType.Block ? 1 : 0), 0);
    if (blocks >= Math.max(4, Math.floor(COLS * 0.6))) {
      for (let c = 0; c < COLS; c++) {
        if (out[c] === CellType.Block && chance(0.55)) out[c] = CellType.Empty;
      }
    }
    return out;
  }

  function makeGrid() {
    grid = new Array(ROWS);
    consumed = new Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      grid[r] = genRow();
      consumed[r] = new Array(COLS).fill(false);
    }
    gridReady = true;
  }

  function ensureGridValid() {
    if (!Array.isArray(grid) || grid.length !== ROWS) return false;
    if (!Array.isArray(consumed) || consumed.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(grid[r]) || grid[r].length !== COLS) return false;
      if (!Array.isArray(consumed[r]) || consumed[r].length !== COLS) return false;
    }
    return true;
  }

  function shiftRows() {
    for (let r = ROWS - 1; r >= 1; r--) {
      grid[r] = grid[r - 1];
      consumed[r] = consumed[r - 1];
    }
    grid[0] = genRow();
    consumed[0] = new Array(COLS).fill(false);
  }

  function playerAbsRow() {
    const rf = Number.isFinite(rowF) ? rowF : 0;
    const rr = zoneY0 + Math.round(rf);
    return clampInt(rr, 0, ROWS - 1);
  }

  function safeCellType(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    const row = grid[r];
    if (!row) return CellType.Empty;
    const t = row[c];
    return Number.isFinite(t) ? t : CellType.Empty;
  }

  function safeConsumed(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    const row = consumed[r];
    if (!row) return false;
    return !!row[c];
  }

  function setConsumed(r, c, v) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    if (!consumed[r]) consumed[r] = new Array(COLS).fill(false);
    consumed[r][c] = !!v;
  }

  function setCellEmpty(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    if (!grid[r]) grid[r] = genRow();
    grid[r][c] = CellType.Empty;
  }

  function applyRowsIfNeeded({ forceReset = false } = {}) {
    const want = desiredRows();
    if (want === ROWS) return false;
    ROWS = want;

    if (forceReset) {
      resetRun(true);
    } else {
      if (running && !gameOver) resetRun(true);
      else {
        recomputeZone();
        makeGrid();
        rerollCombo();
      }
    }
    return true;
  }

  // ───────────────────────── Gameplay ─────────────────────────
  function scoreFor(type) {
    if (type === CellType.Coin) return coinValue;
    if (type === CellType.Gem) return gemValue;
    if (type === CellType.Bonus) return bonusValue;
    if (type === CellType.Trap) {
      const base = 25;
      const reduced = base * (1 - 0.10 * trapResist);
      return -Math.round(reduced);
    }
    return 0;
  }

  function shake(ms, powPx) {
    shakeT = Math.max(shakeT, ms);
    shakePow = Math.max(shakePow, powPx);
  }

  function flash(color = "#ff2b4d", ms = 220) {
    hitFlashColor = color;
    hitFlashT = Math.max(hitFlashT, ms);
    hitFlashMax = Math.max(1, ms);
  }

  function spawnFloatText(x, y, text, color, stroke = "rgba(0,0,0,0.55)") {
    floatTexts.push({ x, y, vy: -18 - 22 * settings.fx, life: 720, max: 720, text, color, stroke });
    if (floatTexts.length > 80) floatTexts.splice(0, floatTexts.length - 80);
  }

  function spawnPop(x, y, color, intensity = 1) {
    const n = clampInt(Math.round(12 * intensity * settings.fx), 8, 30);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 1.20) * (26 + 34 * settings.fx) * intensity;
      particles.push({
        kind: "dot",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 260 + Math.random() * 220,
        max: 460,
        rad: (1.2 + Math.random() * 2.8) * settings.fx,
        color
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function spawnSparks(x, y, color, intensity = 1) {
    const n = clampInt(Math.round(10 * intensity * settings.fx), 6, 24);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.55 + Math.random() * 1.25) * (34 + 44 * settings.fx) * intensity;
      particles.push({
        kind: "spark", x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 220 + Math.random() * 180,
        max: 420,
        w: Math.max(1.4, (1.6 + Math.random() * 1.4) * settings.fx),
        h: Math.max(4.0, (6.0 + Math.random() * 7.0) * settings.fx),
        rot: a + (Math.random() * 0.6 - 0.3),
        vr: (Math.random() * 5.0 - 2.5),
        color
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function spawnEatFX(t, x, y) {
    const col = CELL_COLORS[t] || "rgba(255,255,255,0.85)";
    const boostJuice = clamp(1 + scoreBoost * 0.85, 1, 1.85);
    const multJuice = clamp(1 + (mult - 1) * 0.20, 1, 1.65);
    const intensity = boostJuice * multJuice;

    if (t === CellType.Coin) { spawnPop(x, y, col, 0.85 * intensity); spawnSparks(x, y, "rgba(255,255,255,0.92)", 0.65 * intensity); shake(55, 1.2); return; }
    if (t === CellType.Gem)  { spawnPop(x, y, col, 0.95 * intensity); spawnSparks(x, y, "rgba(170,210,255,0.95)", 0.85 * intensity); shake(60, 1.35); return; }
    if (t === CellType.Bonus){ spawnPop(x, y, col, 1.15 * intensity); spawnSparks(x, y, "rgba(255,245,200,0.95)", 1.0 * intensity); shake(75, 1.6); return; }
  }

  function loseHp(amount, x = null, y = null) {
    const prev = hp;
    hp = clampInt(hp - (amount | 0), 0, hpMax);
    if (x != null && y != null) spawnFloatText(x, y, `-${amount}♥`, "rgba(255,120,120,0.95)");
    updateStatusHUD();
    if (hp <= 0 && prev > 0) {
      AudioSys.sfx("gameover");
      gameOverNow(T("reason_no_hp", "Sin vida"));
    }
  }

  function applyTrapHit(x = null, y = null) {
    playerPulse = 1;
    zonePulse = 1;

    // hook skills
    callFirst(Skills, ["onTrap", "onHitTrap", "trap"], skillsApi.getState());

    const v = scoreFor(CellType.Trap);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    loseHp(1, x, y);
    if (gameOver) return;

    streak = 0;
    mult = clamp(mult * 0.92, 1.0, 4.0);

    vibrate(18);
    failCombo();

    showToast(T("toast_trap_hp", "¡Trampa! -1♥"), 700);
    flash("#ff6b3d", 220);
    shake(220, 7);
    AudioSys.sfx("trap");
  }

  function applyCollect(t, checkCombo = true, x = null, y = null) {
    if (t === CellType.Trap) { applyTrapHit(x, y); return; }

    playerPulse = 1;
    zonePulse = 1;

    // hook skills
    callFirst(Skills, ["onCollect", "onPickup", "collect"], { ...skillsApi.getState(), cellType: t });

    const v = scoreFor(t);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    streak++;
    vibrate(10);

    if (t === CellType.Coin) AudioSys.sfx("coin");
    else if (t === CellType.Gem) AudioSys.sfx("gem");
    else if (t === CellType.Bonus) AudioSys.sfx("bonus");

    if (checkCombo) {
      if (combo[comboIdx] === t) {
        comboIdx++;
        comboTime = comboTimeMax;
        if (comboIdx >= combo.length) {
          mult = clamp(mult + 0.15, 1.0, 4.0);
          showToast(I18n.t("toast_combo_mult"), 900);
          shake(140, 3.2);
          flash("#6ab0ff", 140);
          rerollCombo();
        } else renderComboUI();
      } else failCombo();
    }

    if (!inLevelUp && score >= nextLevelAt) openUpgrade();
  }

  function applyMagnetAround(r, c) {
    if (magnet <= 0 || magnetTime <= 0) return;
    const rad = clampInt(magnet, 1, 3);

    for (let rr = r - rad; rr <= r + rad; rr++) {
      if (rr < 0 || rr >= ROWS) continue;
      for (let cc = c - rad; cc <= c + rad; cc++) {
        if (cc < 0 || cc >= COLS) continue;

        if (safeConsumed(rr, cc)) continue;
        const t = safeCellType(rr, cc);

        if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) {
          setConsumed(rr, cc, true);
          setCellEmpty(rr, cc);

          const x = offX + cc * cellPx + cellPx * 0.5;
          const y = offY + rr * cellPx + cellPx * 0.5 + scrollPx;

          spawnEatFX(t, x, y);

          const before = score;
          applyCollect(t, false, x, y);
          const delta = score - before;
          if (delta !== 0) spawnFloatText(
            x, y,
            (delta > 0 ? `+${delta}` : `${delta}`),
            delta > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,120,120,0.95)"
          );
        }
      }
    }
  }

  function stepAdvance() {
    if (!ensureGridValid()) { makeGrid(); recomputeZone(); }
    shiftRows();
    score += 1;

    const r = playerAbsRow();
    const c = clampInt(Math.round(Number.isFinite(colF) ? colF : targetCol), 0, COLS - 1);

    // hook skills
    callFirst(Skills, ["onStep", "onAdvance", "step"], { ...skillsApi.getState(), row: r, col: c });

    applyMagnetAround(r, c);

    const t = safeCellType(r, c);

    if (!safeConsumed(r, c) && t !== CellType.Empty) {
      setConsumed(r, c, true);
      setCellEmpty(r, c);

      const x = offX + c * cellPx + cellPx * 0.5;
      const y = offY + r * cellPx + cellPx * 0.5 + scrollPx;

      if (t === CellType.Block) {
        flash("#ff2b4d", 280);
        shake(260, 10);

        spawnPop(x, y, CELL_COLORS[t], 1.25);
        spawnSparks(x, y, "rgba(255,140,160,0.95)", 1.0);
        spawnFloatText(x, y, "KO", "rgba(255,120,120,0.95)");

        if (shields > 0) {
          shields--;
          showToast(I18n.t("toast_shield_saved"), 900);
          vibrate(24);
          shake(190, 6);
          flash("#6ab0ff", 140);
          AudioSys.sfx("pick");
          updateStatusHUD();
        } else {
          // hook skills
          callFirst(Skills, ["onKO", "onDeath", "onGameOverCause"], { ...skillsApi.getState(), reason: "KO" });

          AudioSys.sfx("ko");
          gameOverNow("KO");
        }
        return;
      }

      if (t === CellType.Trap) {
        spawnPop(x, y, CELL_COLORS[t], 0.95);
        spawnSparks(x, y, "rgba(255,160,180,0.95)", 0.65);
        applyCollect(CellType.Trap, true, x, y);
        return;
      }

      if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) spawnEatFX(t, x, y);
      else spawnPop(x, y, CELL_COLORS[t], 0.85);

      const before = score;
      applyCollect(t, true, x, y);
      const delta = score - before;
      if (delta !== 0) spawnFloatText(
        x, y,
        (delta > 0 ? `+${delta}` : `${delta}`),
        delta > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,120,120,0.95)"
      );
    }
  }

  // ───────────────────────── Combo UI ─────────────────────────
  function iconForType(t) {
    if (t === CellType.Coin) return "paid";
    if (t === CellType.Gem) return "diamond";
    if (t === CellType.Bonus) return "workspace_premium";
    return "help";
  }
  function nameForType(t) {
    if (t === CellType.Coin) return I18n.t("cell_coin");
    if (t === CellType.Gem) return I18n.t("cell_gem");
    if (t === CellType.Bonus) return I18n.t("cell_bonus");
    return "—";
  }

  function rerollCombo() {
    const pick = COMBO_POOL[randi(0, COMBO_POOL.length - 1)];
    combo = Array.isArray(pick) ? pick.slice() : [CellType.Coin, CellType.Coin, CellType.Gem];
    comboIdx = 0;
    comboTimeMax = clamp(6.2 - (level * 0.06), 3.8, 7.0);
    comboTime = comboTimeMax;
    renderComboUI();
  }

  function renderComboUI() {
    if (!comboSeq || !comboHint) return;
    comboSeq.innerHTML = "";
    for (let i = 0; i < combo.length; i++) {
      const t = combo[i];
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.style.setProperty("--chipc", CELL_COLORS[t] || "rgba(255,255,255,0.22)");

      const ic = document.createElement("span");
      ic.className = "ms";
      ic.textContent = iconForType(t);

      const tx = document.createElement("span");
      tx.textContent = nameForType(t);

      chip.appendChild(ic);
      chip.appendChild(tx);

      if (i < comboIdx) chip.style.opacity = "0.55";
      if (i === comboIdx) chip.style.borderColor = "rgba(255,255,255,0.22)";

      comboSeq.appendChild(chip);
    }
    comboHint.textContent = I18n.t("combo_hint");
  }

  function failCombo() { comboIdx = 0; comboTime = comboTimeMax; renderComboUI(); }

  // ───────────────────────── Upgrades (fallback base) ─────────────────────────
  const MAGNET_DUR = { rare: 12, epic: 18, legendary: 26 };

  function upgradeIcon(u) {
    const id = u?.id || "";
    if (id === "shield") return "shield";
    if (id === "heart") return "favorite";
    if (id.startsWith("mag")) return "compass_calibration";
    if (id === "boost") return "bolt";
    if (id === "trap") return "verified_user";
    if (id === "zone") return "open_with";
    if (id === "coin") return "paid";
    if (id === "gem") return "diamond";
    if (id === "bonus") return "workspace_premium";
    if (id === "reroll") return "casino";
    if (id === "mult") return "functions";
    return "upgrade";
  }

  const UpgradesFallback = [
    { id: "shield", nameKey: "up_shield_name", descKey: "up_shield_desc", tagKey: "tag_defense", max: 12, rarity: "common", weight: 10,
      apply() { shields++; updateStatusHUD(); } },

    { id: "heart", nameKey: "up_heart_name", descKey: "up_heart_desc", tagKey: "tag_survival", max: 10, rarity: "common", weight: 9,
      apply() { hpMax = clampInt(hpMax + 1, HP_START, HP_CAP); hp = clampInt(hp + 1, 0, hpMax); updateStatusHUD(); } },

    { id: "mag1", nameKey: "up_mag1_name", descKey: "up_mag1_desc", tagKey: "tag_qol", max: 1, rarity: "rare", weight: 7,
      apply() { magnet = Math.max(magnet, 1); magnetTime += MAGNET_DUR.rare; updateStatusHUD(); } },
    { id: "mag2", nameKey: "up_mag2_name", descKey: "up_mag2_desc", tagKey: "tag_qol", max: 1, rarity: "epic", weight: 4,
      apply() { magnet = Math.max(magnet, 2); magnetTime += MAGNET_DUR.epic; updateStatusHUD(); } },
    { id: "mag3", nameKey: "up_mag3_name", descKey: "up_mag3_desc", tagKey: "tag_qol", max: 1, rarity: "legendary", weight: 2,
      apply() { magnet = Math.max(magnet, 3); magnetTime += MAGNET_DUR.legendary; updateStatusHUD(); } },

    { id: "boost", nameKey: "up_boost_name", descKey: "up_boost_desc", tagKey: "tag_points", max: 10, rarity: "common", weight: 10,
      apply() { scoreBoost += 0.08; updateStatusHUD(); } },

    { id: "trap", nameKey: "up_trap_name", descKey: "up_trap_desc", tagKey: "tag_defense", max: 4, rarity: "common", weight: 9,
      apply() { trapResist++; updateStatusHUD(); } },

    { id: "zone", nameKey: "up_zone_name", descKey: "up_zone_desc", tagKey: "tag_mobility", max: 3, rarity: "epic", weight: 4,
      apply() { zoneExtra++; recomputeZone(); updateStatusHUD(); } },

    { id: "coin", nameKey: "up_coin_name", descKey: "up_coin_desc", tagKey: "tag_points", max: 8, rarity: "common", weight: 10,
      apply() { coinValue += 2; } },
    { id: "gem", nameKey: "up_gem_name", descKey: "up_gem_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7,
      apply() { gemValue += 6; } },
    { id: "bonus", nameKey: "up_bonus_name", descKey: "up_bonus_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7,
      apply() { bonusValue += 10; } },

    { id: "reroll", nameKey: "up_reroll_name", descKey: "up_reroll_desc", tagKey: "tag_upgrades", max: 5, rarity: "rare", weight: 6,
      apply() { rerolls++; updateStatusHUD(); } },

    { id: "mult", nameKey: "up_mult_name", descKey: "up_mult_desc", tagKey: "tag_combo", max: 10, rarity: "epic", weight: 5,
      apply() { mult = clamp(mult + 0.10, 1.0, 4.0); } },
  ];

  function isUpgradeAllowedFallback(u) {
    if ((pickedCount.get(u.id) || 0) >= (u.max ?? 999)) return false;
    if (u.id === "mag1") return magnet < 1;
    if (u.id === "mag2") return magnet < 2;
    if (u.id === "mag3") return magnet < 3;
    if (u.id === "heart") return hpMax < HP_CAP;
    return true;
  }

  const canPickFallback = (u) => isUpgradeAllowedFallback(u);
  const markPick = (uOrId) => {
    const id = (typeof uOrId === "string") ? uOrId : (uOrId?.id || "");
    if (!id) return;
    pickedCount.set(id, (pickedCount.get(id) || 0) + 1);
  };

  function pickWeighted(pool) {
    let sum = 0;
    for (const u of pool) sum += Math.max(0.0001, Number(u.weight) || 1);
    let r = Math.random() * sum;
    for (const u of pool) {
      r -= Math.max(0.0001, Number(u.weight) || 1);
      if (r <= 0) return u;
    }
    return pool[pool.length - 1];
  }

  function chooseUpgradesFallback(n = 3) {
    const pool = UpgradesFallback.filter(canPickFallback);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!pool.length) break;
      const u = pickWeighted(pool);
      const idx = pool.indexOf(u);
      if (idx >= 0) pool.splice(idx, 1);
      out.push(u);
    }
    return out;
  }

  let currentUpgradeChoices = [];

  function pauseForOverlay(onv) {
    if (!running || gameOver) return;
    paused = !!onv;
    AudioSys.duckMusic(paused || inLevelUp || gameOver);
  }

  // ───────────────────────── Upgrade Confetti FX ─────────────────────────
  let upFxCanvas = null, upFxCtx = null;
  const upConfetti = [];
  let upFxW = 0, upFxH = 0;

  function getUpgradesPanelHost() {
    if (!overlayUpgrades) return null;
    return overlayUpgrades.querySelector?.(".upgradesPanel") ||
           overlayUpgrades.querySelector?.(".panel") ||
           overlayUpgrades;
  }

  function ensureUpgradeFxCanvas() {
    const host = getUpgradesPanelHost();
    if (!host) return;
    if (upFxCanvas && upFxCanvas.parentElement) return;

    try {
      host.style.position = host.style.position || "relative";
      const c = document.createElement("canvas");
      c.id = "upFxCanvas";
      c.className = "upFxCanvas";
      c.style.pointerEvents = "none";
      host.appendChild(c);

      upFxCanvas = c;
      upFxCtx = c.getContext("2d", { alpha: true });
      resizeUpgradeFxCanvas();
    } catch {}
  }

  function resizeUpgradeFxCanvas() {
    const host = getUpgradesPanelHost();
    if (!upFxCanvas || !host) return;
    const r = host.getBoundingClientRect();
    const d = Math.max(1, Math.min(2.0, window.devicePixelRatio || 1));
    upFxW = Math.max(1, Math.floor(r.width));
    upFxH = Math.max(1, Math.floor(r.height));
    upFxCanvas.width = Math.floor(upFxW * d);
    upFxCanvas.height = Math.floor(upFxH * d);
    try { upFxCtx.setTransform(d, 0, 0, d, 0, 0); } catch {}
  }

  function rarityLabel(r) {
    if (r === "rare") return I18n.t("rarity_rare");
    if (r === "epic") return I18n.t("rarity_epic");
    if (r === "legendary") return I18n.t("rarity_legendary");
    return I18n.t("rarity_common");
  }

  function confettiBurst(strength = 1) {
    ensureUpgradeFxCanvas();
    if (!upFxCtx) return;

    const n = clampInt(Math.round(60 * strength), 30, 120);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * upFxW;
      const y = -10 - Math.random() * 40;
      const sp = (120 + Math.random() * 260) * (0.7 + 0.6 * strength);
      const ang = (Math.PI * 0.35) + Math.random() * (Math.PI * 0.30);
      const vx = (Math.cos(ang) * sp) * (Math.random() < 0.5 ? -1 : 1) * 0.35;
      const vy = Math.sin(ang) * sp;

      const palette = [
        "rgba(255,211,90,0.95)",
        "rgba(106,176,255,0.95)",
        "rgba(46,242,160,0.95)",
        "rgba(214,133,255,0.95)",
        "rgba(255,120,160,0.95)",
      ];

      upConfetti.push({
        x, y, vx, vy,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() * 8 - 4),
        w: 4 + Math.random() * 8,
        h: 6 + Math.random() * 12,
        life: 1100 + Math.random() * 900,
        max: 2200,
        col: palette[randi(0, palette.length - 1)],
        kind: Math.random() < 0.65 ? "rect" : "tri",
      });
    }
    if (upConfetti.length > 420) upConfetti.splice(0, upConfetti.length - 420);
  }

  function tickUpgradeFx(dtMs) {
    if (!upFxCtx || !overlayUpgrades || overlayUpgrades.hidden) {
      if (upFxCtx && upFxCanvas) { try { upFxCtx.clearRect(0, 0, upFxW, upFxH); } catch {} }
      upConfetti.length = 0;
      return;
    }

    const dt = dtMs / 1000;
    const g0 = 520;
    for (let i = upConfetti.length - 1; i >= 0; i--) {
      const p = upConfetti[i];
      p.life -= dtMs;
      if (p.life <= 0 || p.y > upFxH + 80) { upConfetti.splice(i, 1); continue; }

      p.vy += g0 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.x < -40) p.x = upFxW + 40;
      if (p.x > upFxW + 40) p.x = -40;
    }

    upFxCtx.clearRect(0, 0, upFxW, upFxH);
    upFxCtx.save();
    upFxCtx.globalCompositeOperation = "lighter";
    for (const p of upConfetti) {
      const t = clamp(p.life / p.max, 0, 1);
      const a = clamp(0.92 * t, 0, 0.92);
      upFxCtx.globalAlpha = a;
      upFxCtx.fillStyle = p.col;

      upFxCtx.save();
      upFxCtx.translate(p.x, p.y);
      upFxCtx.rotate(p.rot);

      if (p.kind === "tri") {
        upFxCtx.beginPath();
        upFxCtx.moveTo(0, -p.h * 0.5);
        upFxCtx.lineTo(-p.w * 0.5, p.h * 0.5);
        upFxCtx.lineTo(p.w * 0.5, p.h * 0.5);
        upFxCtx.closePath();
        upFxCtx.fill();
      } else {
        upFxCtx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
      }

      upFxCtx.restore();
    }
    upFxCtx.restore();
    upFxCtx.globalAlpha = 1;
  }

  function openUpgrade() {
    if (inLevelUp || gameOver) return;
    inLevelUp = true;
    pauseForOverlay(true);

    level++;
    levelStartScore = score;
    nextLevelAt = score + Math.round(240 + level * 150);

    // hook skills
    callFirst(Skills, ["onLevelUp", "levelUp"], { ...skillsApi.getState(), level });

    if (upTitle) upTitle.textContent = I18n.t("up_level_title", level);
    if (upSub) upSub.textContent = I18n.t("up_choose");

    renderUpgradeChoices();
    overlayShow(overlayUpgrades);
    updatePillsNow();

    confettiBurst(1.0 + Math.min(0.8, level * 0.03));
    AudioSys.sfx("level");
  }

  function closeUpgrade() {
    overlayHide(overlayUpgrades);
    inLevelUp = false;
    pauseForOverlay(false);
  }

  function renderUpgradeChoices() {
    // 1) skills.js choices si existe
    const skillsChoices = skillsGetLevelUpChoices(3);
    if (skillsChoices && skillsChoices.length) {
      currentUpgradeChoices = skillsChoices.slice(0, 3);
    } else {
      // 2) fallback base
      currentUpgradeChoices = chooseUpgradesFallback(3);
    }

    if (upgradeChoices) upgradeChoices.innerHTML = "";

    for (const rawU of currentUpgradeChoices) {
      const ui = normalizeChoiceForUI(rawU);
      if (!ui) continue;

      const rarityText = rarityLabel(ui.rarity);

      const card = document.createElement("div");
      card.className = "upCard";
      card.dataset.rarity = ui.rarity;
      card.dataset.upid = ui.id;
      card.setAttribute("role", "button");
      card.tabIndex = 0;

      card.innerHTML = `
<div class="upHead">
  <div class="upIcon"><span class="ms">${escapeAttr(ui.icon)}</span></div>
  <div class="upHeadText">
    <div class="upTitle">${escapeAttr(ui.name)}</div>
    <div class="upSubRow">
      <span class="upRarityBadge">${escapeAttr(rarityText)}</span>
      ${ui.tagText ? `<span class="badge">${escapeAttr(ui.tagText)}</span>` : ``}
      <span class="badge">Lv ${ui.curLv}/${ui.maxLv}</span>
      ${ui.extraMeta ? `<span class="badge">${escapeAttr(ui.extraMeta)}</span>` : ``}
    </div>
  </div>
</div>
<div class="upDesc">${escapeAttr(ui.desc || "—")}</div>
      `;

      const pickThis = () => {
        // siempre marcamos el pick (skills.js lo usa también)
        markPick(ui.id);

        let pickedViaSkills = false;

        if (Skills && skillsEnabled) {
          pickedViaSkills = skillsPick(ui.raw);
        }

        if (!pickedViaSkills) {
          // fallback base: si el raw tiene apply, usamos eso
          if (isFn(ui.raw?.apply)) ui.raw.apply();
        }

        const rarity = ui.rarity || "common";
        const burst = (rarity === "legendary") ? 1.9 : (rarity === "epic") ? 1.4 : (rarity === "rare") ? 1.15 : 1.0;
        confettiBurst(burst);

        showToast(I18n.t("toast_upgrade", ui.name), 950);
        shake(120, 3);
        flash(
          (rarity === "legendary") ? "#ffd35a" :
          (rarity === "epic") ? "#d685ff" :
          (rarity === "rare") ? "#6ab0ff" : "#ffffff",
          120
        );
        AudioSys.sfx("pick");
        updatePillsNow();
        closeUpgrade();
      };

      on(card, "click", () => pickThis());
      on(card, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickThis(); }
      });

      upgradeChoices?.appendChild(card);
    }

    if (btnReroll) btnReroll.disabled = !skillsCanReroll();
    if (btnSkipUpgrade) btnSkipUpgrade.hidden = (level < 4);
  }

  function rerollUpgrades() {
    // prioridad: skills.js si lo soporta
    if (Skills && skillsEnabled) {
      const ok = skillsRerollLevelUp();
      if (!ok && rerolls <= 0) return;
      if (!ok && rerolls > 0) rerolls--;
    } else {
      if (rerolls <= 0) return;
      rerolls--;
    }

    renderUpgradeChoices();
    showToast(I18n.t("toast_reroll"), 650);
    shake(90, 2);
    flash("#ffd35a", 110);
    AudioSys.sfx("reroll");
    updateStatusHUD();
  }

  // ───────────────────────── Rendering ─────────────────────────
  function drawSprite(key, x, y, w, h, alpha = 1) {
    if (!settings.useSprites) return false;
    if (!sprites.ready) return false;
    const img = sprites.map.get(key);
    if (!img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return true;
  }

  function drawParticles(dtMs) {
    if (!particles.length) return;
    const damp = Math.pow(0.0016, dtMs / 1000);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dtMs;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const t = p.life / p.max;

      p.vx *= damp;
      p.vy = (p.vy * damp) + 42 * (dtMs / 1000);
      p.x += p.vx * (dtMs / 1000);
      p.y += p.vy * (dtMs / 1000);

      const a = clamp(0.90 * t, 0, 0.90);

      if (p.kind === "spark") {
        p.rot += (p.vr || 0) * (dtMs / 1000);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-(p.w || 2) * 0.5, -(p.h || 8) * 0.5, (p.w || 2), (p.h || 8));
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, (p.rad || 2) * (0.65 + 0.65 * t)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts(dtMs) {
    if (!floatTexts.length) return;
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.life -= dtMs;
      if (f.life <= 0) { floatTexts.splice(i, 1); continue; }

      const t = f.life / f.max;
      f.y += f.vy * (dtMs / 1000);

      const a = clamp(0.95 * (t * t), 0, 0.95);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.max(12, Math.floor(cellPx * 0.34))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = f.stroke;
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawMagnetZone(cx, cy) {
    if (magnet <= 0 || magnetTime <= 0) return;
    const rad = (magnet + 0.35) * cellPx;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.15);
    gg.addColorStop(0, "rgba(106,176,255,0.12)");
    gg.addColorStop(0.55, "rgba(106,176,255,0.06)");
    gg.addColorStop(1, "rgba(106,176,255,0.0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(106,176,255,0.55)";
    ctx.lineWidth = Math.max(1.2, cellPx * 0.06);
    ctx.setLineDash([Math.max(4, cellPx * 0.22), Math.max(3, cellPx * 0.16)]);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawShieldAura(cx, cy) {
    if (shields <= 0) return;

    const phase = (running ? runTime : (pNow() / 1000));
    const pulse = 0.5 + 0.5 * Math.sin(phase * 3.6);
    const rad = cellPx * (0.78 + 0.06 * pulse);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.15);
    gg.addColorStop(0.0, "rgba(106,176,255,0.00)");
    gg.addColorStop(0.38, `rgba(106,176,255,${(0.10 + 0.06 * pulse).toFixed(3)})`);
    gg.addColorStop(1.0, "rgba(106,176,255,0.00)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.58;
    ctx.strokeStyle = "rgba(106,176,255,0.75)";
    ctx.lineWidth = Math.max(1.5, cellPx * 0.08);
    ctx.setLineDash([Math.max(6, cellPx * 0.25), Math.max(4, cellPx * 0.18)]);
    ctx.lineDashOffset = -phase * 18;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawTileGlow(x, y, t, usedAlpha) {
    const a = (1 - usedAlpha);
    if (a <= 0.01) return;

    let k = 0;
    if (t === CellType.Coin) k = clamp((coinValue - 10) / 16, 0, 1);
    else if (t === CellType.Gem) k = clamp((gemValue - 30) / 48, 0, 1);
    else if (t === CellType.Bonus) k = clamp((bonusValue - 60) / 80, 0, 1);
    if (k <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 * k * (0.55 + 0.45 * (1 + scoreBoost));
    const col =
      (t === CellType.Coin) ? "rgba(46,242,160,0.95)" :
      (t === CellType.Gem) ? "rgba(106,176,255,0.95)" :
      "rgba(255,211,90,0.95)";
    ctx.fillStyle = col;
    ctx.fillRect(x, y, cellPx, cellPx);
    ctx.restore();
  }

  function draw(dtMs = 16) {
    if (!ctx) return;
    if (!gridReady || !ensureGridValid()) return;

    let psx = 0, psy = 0;
    if (shakeT > 0) {
      const k = shakeT / 280;
      const pow = shakePow * k;
      psx = (Math.random() * 2 - 1) * pow;
      psy = (Math.random() * 2 - 1) * pow;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const bg = ctx.createLinearGradient(0, 0, 0, cssCanvasH);
    bg.addColorStop(0, "#060610");
    bg.addColorStop(1, "#04040a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);

    if (bgStars.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const st of bgStars) {
        const tw = 0.55 + 0.45 * Math.sin(st.t);
        const a = clamp(st.a * tw, 0, 0.24);
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (hitFlashT > 0) {
      const t = clamp(hitFlashT / hitFlashMax, 0, 1);
      const a = 0.55 * (t * t);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = hitFlashColor;
      ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,0.028)";
    ctx.fillRect(offX, offY, gridW, gridH);

    const zTop = offY + zoneY0 * cellPx;
    const zoneA = 0.070 + 0.06 * zonePulse;
    ctx.fillStyle = `rgba(106,176,255,${zoneA.toFixed(3)})`;
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offX + 0.5, zTop + 0.5, gridW - 1, zoneH * cellPx - 1);
    ctx.globalAlpha = 1;

    for (let r = 0; r < ROWS; r++) {
      const y = offY + r * cellPx + scrollPx;
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t === CellType.Empty) continue;

        const used = consumed[r][c];
        const alpha = used ? 0.22 : 0.92;

        const x = offX + c * cellPx;
        const key =
          (t === CellType.Coin) ? "coin" :
          (t === CellType.Gem) ? "gem" :
          (t === CellType.Bonus) ? "bonus" :
          (t === CellType.Trap) ? "trap" : "block";

        const pad = Math.max(2, Math.floor(cellPx * 0.08));

        if (!used && (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus)) drawTileGlow(x, y, t, 0);

        const ok = drawSprite(key, x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2, alpha);
        if (!ok) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2);
          ctx.globalAlpha = 1;
        }

        if (!used && t === CellType.Trap && trapResist > 0) {
          ctx.save();
          ctx.globalAlpha = clamp(0.10 + trapResist * 0.06, 0.10, 0.32);
          ctx.strokeStyle = "rgba(46,242,160,0.85)";
          ctx.lineWidth = Math.max(1, Math.floor(cellPx * 0.06));
          ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, cellPx - pad * 2 - 1, cellPx - pad * 2 - 1);
          ctx.restore();
        }
      }
    }

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = offX + c * cellPx + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, offY);
      ctx.lineTo(x, offY + gridH);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = offY + r * cellPx + 0.5;
      ctx.beginPath();
      ctx.moveTo(offX, y);
      ctx.lineTo(offX + gridW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    let px = offX + colF * cellPx + psx;
    let py = offY + (zoneY0 + rowF) * cellPx + psy;

    const s = 1 + 0.08 * playerPulse;
    const cx = px + cellPx / 2;
    const cy = py + cellPx / 2;

    drawMagnetZone(cx, cy);
    drawShieldAura(cx, cy);

    if (mult > 1.2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = (0.55 + (mult - 1) * 0.22) * cellPx;
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gg.addColorStop(0, "rgba(214,133,255,0.10)");
      gg.addColorStop(0.55, "rgba(106,176,255,0.06)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    const padP = Math.max(2, Math.floor(cellPx * 0.08));
    const okP = drawSprite("player", px + padP, py + padP, cellPx - padP * 2, cellPx - padP * 2, 1);
    if (!okP) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(px + padP, py + padP, cellPx - padP * 2, cellPx - padP * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.40)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + padP + 1, py + padP + 1, cellPx - padP * 2 - 2, cellPx - padP * 2 - 2);
    }

    if (shields > 0) {
      ctx.fillStyle = "rgba(106,176,255,0.96)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx * 0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), px + cellPx - 10, py + 12);
    }

    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    drawParticles(dtMs);
    ctx.globalCompositeOperation = "source-over";
    drawFloatTexts(dtMs);

    ctx.restore();
  }

  // ───────────────────────── Resize ─────────────────────────
  function resize() {
    if ((!gameArea && !canvasWrap) || !canvas || !ctx) return;

    updateVhUnit();
    applyRowsIfNeeded({ forceReset: false });

    const host = railCanvasEl || canvasWrap || gameArea;
    const r = host.getBoundingClientRect();
    const cs = getComputedStyle(host);
    const padW = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padH = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);

    const availW = Math.max(240, Math.floor(r.width - padW));
    const availH = Math.max(240, Math.floor(r.height - padH));

    let w = availW;
    let h = Math.floor(w / canvasAR());
    if (h > availH) { h = availH; w = Math.floor(h * canvasAR()); }

    cssCanvasW = Math.max(240, w);
    cssCanvasH = Math.max(240, h);

    canvas.style.width = `${cssCanvasW}px`;
    canvas.style.height = `${cssCanvasH}px`;
    canvas.style.aspectRatio = `${COLS} / ${ROWS}`;

    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.floor(cssCanvasW * dpr);
    canvas.height = Math.floor(cssCanvasH * dpr);

    const maxCell = isMobileLayout() ? 88 : 72;
    const minCell = isMobileLayout() ? 16 : 14;

    cellPx = Math.floor(Math.min(cssCanvasW / COLS, cssCanvasH / ROWS));
    cellPx = clampInt(cellPx, minCell, maxCell);

    gridW = cellPx * COLS;
    gridH = cellPx * ROWS;

    offX = Math.floor((cssCanvasW - gridW) / 2);
    offY = Math.floor((cssCanvasH - gridH) / 2);

    initBgStars();
    resizeUpgradeFxCanvas();
    updateStatusHUD();
    draw(16);
  }

  // ───────────────────────── Input ─────────────────────────
  function isAnyBlockingOverlayOpen() {
    const open = (el) => el && el.hidden === false;
    return open(overlayStart) || open(overlayOptions) || open(overlayUpgrades) || open(overlayPaused) || open(overlayGameOver) || open(overlayError) || open(overlayLoading) || open(overlayPress);
  }

  function canControl() {
    return running && !paused && !gameOver && !inLevelUp && !isAnyBlockingOverlayOpen();
  }

  function move(dx, dy) {
    if (!canControl()) return;
    targetCol = clampInt(targetCol + dx, 0, COLS - 1);
    targetRow = clampInt(targetRow + dy, 0, zoneH - 1);
    vibrate(8);
    playerPulse = 0.65;
    AudioSys.unlock();
  }

  function bindInputs() {
    on(window, "keydown", (e) => {
      const k = e.key;
      AudioSys.unlock();

      if (k === "Escape") { togglePause(); return; }
      if (k === "r" || k === "R") { if (!isAnyBlockingOverlayOpen()) { resetRun(false); startRun(); } return; }

      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
    });

    on(btnLeft, "click", () => move(-1, 0));
    on(btnRight, "click", () => move(+1, 0));
    on(btnUp, "click", () => move(0, -1));
    on(btnDown, "click", () => move(0, +1));

    if (!canvas || !gameArea) return;

    const blockIfGame = (e) => { if (e.cancelable) e.preventDefault(); };
    on(gameArea, "wheel", blockIfGame, { passive: false });
    on(gameArea, "touchmove", blockIfGame, { passive: false });
    on(gameArea, "gesturestart", blockIfGame, { passive: false });
    on(gameArea, "gesturechange", blockIfGame, { passive: false });

    let sx = 0, sy = 0, st = 0, active = false;

    on(canvas, "pointerdown", (e) => {
      AudioSys.unlock();
      if (!canControl()) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      st = pNow();
      canvas.setPointerCapture?.(e.pointerId);
    });

    const endSwipe = (e) => {
      if (!active) return;
      active = false;
      if (!canControl()) return;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = pNow() - st;

      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (dt < 650 && (adx > 22 || ady > 22)) {
        if (adx > ady) move(dx > 0 ? +1 : -1, 0);
        else move(0, dy > 0 ? +1 : -1);
      }
    };

    on(canvas, "pointerup", endSwipe, { passive: true });
    on(canvas, "pointercancel", () => { active = false; }, { passive: true });
  }

  // ───────────────────────── UI ─────────────────────────
  function togglePause() {
    if (!running || gameOver || inLevelUp) return;
    if (overlayOptions && !overlayOptions.hidden) return;
    paused = !paused;
    if (paused) { overlayShow(overlayPaused); AudioSys.duckMusic(true); }
    else { overlayHide(overlayPaused); AudioSys.duckMusic(false); }
    AudioSys.sfx("ui");
    updateStatusHUD();
  }

  function showOptions() {
    overlayShow(overlayOptions);
    pauseForOverlay(true);
    try {
      raf(() => {
        const body =
          overlayOptions?.querySelector?.("#optionsBody") ||
          overlayOptions?.querySelector?.(".panel") ||
          overlayOptions;
        if (body) body.scrollTop = 0;
      });
    } catch {}
    AudioSys.sfx("ui");
    updateStatusHUD();
  }

  function hideOptions() {
    overlayHide(overlayOptions);
    if (!inLevelUp && !gameOver && running) pauseForOverlay(false);
    AudioSys.sfx("ui");
    updateStatusHUD();
  }

  function showPressToStart() {
    if (!overlayPress) {
      overlayShow(overlayStart);
      return;
    }

    const mode = (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || (navigator.standalone === true) ? "APP" : "WEB";
    const device = isMobileLayout() ? "MÓVIL" : "PC";
    if (pillModeVal) pillModeVal.textContent = `${mode} • ${device}`;
    if (pressMeta) pressMeta.textContent = `Modo: ${mode} • ${device}`;

    overlayHide(overlayStart);
    overlayShow(overlayPress);

    let done = false;
    const proceed = async () => {
      if (done) return;
      done = true;

      try { sessionStorage.setItem("gridrogue_press_seen_v1", "1"); } catch (_) {}
      try { AudioSys?.unlock?.(true); } catch (_) {}

      await overlayFadeOut(overlayPress, 160);
      overlayShow(overlayStart);

      try { $("btnStart")?.focus?.(); } catch (_) {}
    };

    if (btnPressStart) btnPressStart.onclick = proceed;

    const onAny = (e) => {
      if (e && e.target && e.target.closest && e.target.closest("a,button,input,select,textarea")) {
        if (e.target === btnPressStart) return;
      }
      proceed();
    };

    on(window, "keydown", onAny, { once: true });
    on(window, "pointerdown", onAny, { once: true, passive: true });
    on(window, "touchstart", onAny, { once: true, passive: true });
  }

  // ───────────────────────── Run lifecycle ─────────────────────────
  let pendingReload = false;

  function resetRun(showMenu) {
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    score = 0; streak = 0; mult = 1.0; level = 1;
    levelStartScore = 0; nextLevelAt = 220;

    hpMax = HP_START;
    hp = HP_START;

    shields = 0; magnet = 0; magnetTime = 0; scoreBoost = 0; trapResist = 0; rerolls = 0;
    pickedCount.clear();

    zoneExtra = 0;
    recomputeZone();

    targetCol = Math.floor(COLS / 2);
    targetRow = Math.floor(zoneH / 2);
    colF = targetCol;
    rowF = targetRow;

    runTime = 0;
    scrollPx = 0;

    particles.length = 0;
    floatTexts.length = 0;
    playerPulse = 0;
    zonePulse = 0;
    shakeT = 0;
    shakePow = 0;

    hitFlashT = 0;
    hitFlashMax = 1;

    makeGrid();
    rerollCombo();

    overlayHide(overlayPaused);
    overlayHide(overlayUpgrades);
    overlayHide(overlayGameOver);
    overlayHide(overlayOptions);

    // hook skills
    callFirst(Skills, ["onResetRun", "resetRun", "onNewRun", "newRun"], skillsApi);

    if (showMenu) {
      overlayShow(overlayStart);
      setState("menu");
      // volvemos a “Jugar” por defecto para no confundir
      if (startPanelPlay && startPanelCatalog && startPanelShop) setStartTab("play");
    } else overlayHide(overlayStart);

    updatePillsNow();
    draw(16);
    AudioSys.duckMusic(showMenu);
  }

  async function startRun() {
    await AudioSys.unlock();
    applyAudioSettingsNow();
    AudioSys.startMusic();

    if (overlayStart && !overlayStart.hidden) await overlayFadeOut(overlayStart, 170);
    overlayHide(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayOptions);
    overlayHide(overlayUpgrades);
    overlayHide(overlayError);
    overlayHide(overlayPress);

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    runTime = 0;
    scrollPx = 0;
    comboTime = comboTimeMax;

    // hook skills
    callFirst(Skills, ["onRunStart", "onStartRun", "startRun"], skillsApi.getState());

    setState("playing");
    updatePillsNow();
    draw(16);

    AudioSys.duckMusic(false);
    AudioSys.sfx("ui");
  }

  function gameOverNow(reason) {
    running = false;
    paused = true;
    gameOver = true;
    inLevelUp = false;

    setState("over");
    shake(360, 12);
    flash("#ff2b4d", 360);
    vibrate(32);

    AudioSys.duckMusic(true);

    // hook skills
    callFirst(Skills, ["onGameOver", "gameOver", "onRunEnd", "runEnd"], { ...skillsApi.getState(), reason });

    if (score > best) {
      best = score;
      try { writeLS(BEST_KEY, String(best)); writeLS(BEST_KEY_OLD, String(best)); } catch {}
      try { Auth?.setBestForActive?.(best); } catch {}
    }

    try {
      const raw = migrateKeyIfNeeded(RUNS_KEY, RUNS_KEY_OLD);
      const arr = raw ? safeParse(raw, []) : [];
      arr.unshift({
        ts: Date.now(),
        profileId: activeProfileId,
        name: playerName,
        score,
        level,
        time: Math.round(runTime),
        rows: ROWS,
        hpMax
      });
      arr.length = Math.min(arr.length, 30);
      const json = JSON.stringify(arr);
      writeLS(RUNS_KEY, json);
      writeLS(RUNS_KEY_OLD, json);
    } catch {}

    if (goScoreBig) goScoreBig.textContent = String(score | 0);
    if (goBestBig) goBestBig.textContent = String(best | 0);

    if (goStats) {
      goStats.innerHTML = `
<div class="line"><span>${I18n.t("stats_reason")}</span><span>${escapeAttr(reason)}</span></div>
<div class="line"><span>${I18n.t("stats_level")}</span><span>${level}</span></div>
<div class="line"><span>${I18n.t("stats_time")}</span><span>${Math.round(runTime)}s</span></div>
<div class="line"><span>${I18n.t("stats_streak")}</span><span>${streak}</span></div>
<div class="line"><span>${I18n.t("stats_mult")}</span><span>${mult.toFixed(2)}</span></div>
<div class="line"><span>${T("stats_hp", "HP")}</span><span>${hp}/${hpMax}</span></div>
      `;
    }

    overlayShow(overlayGameOver);
    updateStatusHUD();

    if (pendingReload) {
      pendingReload = false;
      requestAppReload();
    }
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

  function tickTimedUpgrades(dtMs) {
    if (magnetTime > 0 && running && !paused && !gameOver && !inLevelUp) {
      const prev = magnetTime;
      magnetTime = Math.max(0, magnetTime - dtMs / 1000);
      if (prev > 0 && magnetTime <= 0.001) {
        magnetTime = 0;
        magnet = 0;
        updateStatusHUD();
        showToast(T("toast_magnet_end", "Imán terminado"), 700);
        AudioSys.sfx("ui");
      }
    }
  }

  function tickFx(dtMs) {
    if (toastT > 0) { toastT -= dtMs; if (toastT <= 0) hideToast(); }

    playerPulse = Math.max(0, playerPulse - dtMs / (220 / settings.fx));
    zonePulse = Math.max(0, zonePulse - dtMs / (260 / settings.fx));

    if (shakeT > 0) { shakeT -= dtMs; if (shakeT <= 0) { shakeT = 0; shakePow = 0; } }
    if (hitFlashT > 0) { hitFlashT -= dtMs; if (hitFlashT < 0) hitFlashT = 0; }

    pillAccMs += dtMs;
    if (pillAccMs >= 100) { pillAccMs = 0; updatePillsNow(); }

    tickBgStars(dtMs);
    tickUpgradeFx(dtMs);
    tickTimedUpgrades(dtMs);

    // hook skills (tick)
    callFirst(Skills, ["tick", "onTick"], dtMs, skillsApi.getState());
  }

  function update(dtMs) {
    if (!running || paused || gameOver || inLevelUp) return;

    comboTime -= dtMs / 1000;
    if (comboTimerVal) comboTimerVal.textContent = `${Math.max(0, comboTime).toFixed(1)}s`;
    if (comboTime <= 0) { failCombo(); comboTime = comboTimeMax; }

    const k = 14;
    colF = lerp(colF, targetCol, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));
    rowF = lerp(rowF, targetRow, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));

    runTime += dtMs / 1000;
    const sp = speedRowsPerSec();
    scrollPx += (sp * cellPx) * (dtMs / 1000);

    let safe = 0;
    while (scrollPx >= cellPx && safe++ < 12) {
      scrollPx -= cellPx;
      stepAdvance();
      if (paused || gameOver || inLevelUp || !running) break;
    }
  }

  function frame(t) {
    if (fatalStop) return;
    try {
      const dt = clamp(t - lastT, 0, 50);
      lastT = t;

      tickFx(dt);
      update(dt);
      draw(dt);
    } catch (e) {
      showFatal(e);
      return;
    }
    requestAnimationFrame(frame);
  }

  // ───────────────────────── PWA / SW / Install ─────────────────────────
  let deferredPrompt = null;
  let swReg = null;

  let swReloadGuard = false;
  let hadControllerAtBoot = false;
  let swActivatedVersion = null;

  const SW_RELOAD_TAG = "gridrogue_sw_reload_tag_v1";
  const SW_RELOAD_COOLDOWN_MS = 9000;

  function isStandalone() {
    return (window.matchMedia?.("(display-mode: standalone)")?.matches) ||
      (window.navigator.standalone === true) ||
      (document.referrer || "").includes("android-app://");
  }

  function getReloadStamp() {
    try {
      const a = sessionStorage.getItem(SW_RELOAD_TAG);
      const t = parseInt(a || "0", 10) || 0;
      return t;
    } catch { return 0; }
  }

  function markReloadStamp() {
    const now = Date.now();
    try { sessionStorage.setItem(SW_RELOAD_TAG, String(now)); } catch {}
    try { writeLS(SW_RELOAD_KEY, String(now)); writeLS(SW_RELOAD_KEY_OLD, String(now)); } catch {}
  }

  function reloadedTooRecently() {
    const now = Date.now();
    const ss = getReloadStamp();
    if (ss && (now - ss) < SW_RELOAD_COOLDOWN_MS) return true;

    try {
      const ls = parseInt(readLS(SW_RELOAD_KEY) || readLS(SW_RELOAD_KEY_OLD) || "0", 10) || 0;
      if (ls && (now - ls) < SW_RELOAD_COOLDOWN_MS) return true;
    } catch {}

    return false;
  }

  function markUpdateAvailable(msg = null) {
    if (!pillUpdate) return;
    pillUpdate.hidden = false;
    setPill(pillUpdate, msg || I18n.t("pill_update"));
  }

  function clearUpdatePill() {
    if (!pillUpdate) return;
    pillUpdate.hidden = true;
  }

  function requestAppReload() {
    if (running && !gameOver) {
      pendingReload = true;
      markUpdateAvailable(I18n.t("pill_update"));
      showToast(I18n.t("update_apply_end"), 1200);
      return;
    }

    if (reloadedTooRecently()) return;
    markReloadStamp();
    location.reload();
  }

  function waitForControllerChange(timeoutMs = 3500) {
    return new Promise((resolve) => {
      let done = false;

      const finish = (ok) => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch {}
        try { navigator.serviceWorker.removeEventListener("controllerchange", onChange); } catch {}
        resolve(!!ok);
      };

      const onChange = () => finish(true);
      const t = setTimeout(() => finish(false), timeoutMs);

      try { navigator.serviceWorker.addEventListener("controllerchange", onChange); }
      catch { finish(false); }
    });
  }

  async function applySWUpdateNow() {
    AudioSys.unlock();

    if (!("serviceWorker" in navigator)) {
      requestAppReload();
      return;
    }

    if (!swReg) {
      requestAppReload();
      return;
    }

    if (running && !gameOver) {
      pendingReload = true;
      markUpdateAvailable(I18n.t("pill_update"));
      showToast(I18n.t("update_apply_end_short"), 900);
      return;
    }

    try {
      try { await swReg.update?.(); } catch {}

      if (swReg.waiting) {
        try { swReg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
        await waitForControllerChange(3500);
        requestAppReload();
        return;
      }

      requestAppReload();
    } catch {
      requestAppReload();
    }
  }

  async function repairPWA() {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_ALL_CACHES" });
        setTimeout(() => location.reload(), 600);
        return;
      }
    } catch {}

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}

    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {}

    location.reload();
  }

  function setupInstallUI() {
    if (btnInstall) btnInstall.hidden = true;
    if (isStandalone()) return;

    on(window, "beforeinstallprompt", (e) => {
      if (isStandalone()) return;
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) btnInstall.hidden = false;
    });

    on(window, "appinstalled", () => {
      deferredPrompt = null;
      if (btnInstall) btnInstall.hidden = true;
    });

    on(btnInstall, "click", async () => {
      AudioSys.unlock();
      if (!deferredPrompt) return;
      btnInstall.disabled = true;
      try { deferredPrompt.prompt(); await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      btnInstall.hidden = true;
      btnInstall.disabled = false;
    });
  }

  function wireUpdatePill() {
    if (!pillUpdate) return;
    on(pillUpdate, "click", () => {
      AudioSys.unlock();
      applySWUpdateNow();
    });
  }

  function setupSWMessaging() {
    if (!("serviceWorker" in navigator)) return;

    on(navigator.serviceWorker, "message", (ev) => {
      const d = ev?.data;
      if (!d || !d.type) return;

      if (d.type === "SW_ACTIVATED") {
        swActivatedVersion = String(d.version || "");
        markUpdateAvailable(I18n.t("pill_update"));
      }

      if (d.type === "SW_VERSION") {
        swActivatedVersion = String(d.version || "");
      }
    });

    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" });
      }
    } catch {}
  }

  async function setupPWA() {
    setOfflinePill();
    on(window, "online", setOfflinePill, { passive: true });
    on(window, "offline", setOfflinePill, { passive: true });

    setupInstallUI();
    wireUpdatePill();

    if (window.__GRIDRUNNER_NOSW) return;
    if (!("serviceWorker" in navigator)) return;

    hadControllerAtBoot = !!navigator.serviceWorker.controller;

    setupSWMessaging();

    try {
      const swUrl = new URL("./sw.js", location.href);
      swUrl.searchParams.set("v", String(APP_VERSION || "1.1.0"));

      swReg = await navigator.serviceWorker.register(swUrl.toString(), {
        scope: "./",
        updateViaCache: "none",
      });

      try { await swReg.update?.(); } catch {}

      if (swReg.waiting) {
        markUpdateAvailable(I18n.t("pill_update"));
      }

      swReg.addEventListener("updatefound", () => {
        const nw = swReg.installing;
        if (!nw) return;

        nw.addEventListener("statechange", () => {
          if (nw.state === "installed") {
            if (navigator.serviceWorker.controller) {
              markUpdateAvailable(I18n.t("pill_update"));
              showToast(I18n.t("update_available"), 1100);
            }
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // v1.1.0: anti-loop robusto
        if (swReloadGuard) return;
        swReloadGuard = true;

        if (reloadedTooRecently()) return;
        markReloadStamp();

        if (!hadControllerAtBoot) {
          clearUpdatePill();
          return;
        }

        requestAppReload();
      });

    } catch (e) {
      console.warn("SW register failed:", e);
    }
  }

  // ───────────────────────── Auth UI ─────────────────────────
  let btnStart, profileSelect, btnNewProfile, newProfileWrap, startName;

  function initAuthUI() {
    if (!profileSelect) return;

    if (!Auth) {
      if (newProfileWrap) newProfileWrap.hidden = false;
      if (btnStart) btnStart.disabled = false;
      return;
    }

    const list = Auth.listProfiles?.() || [];
    profileSelect.innerHTML = "";

    for (const p of list) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      profileSelect.appendChild(opt);
    }

    const optNew = document.createElement("option");
    optNew.value = "__new__";
    optNew.textContent = I18n.t("new_profile");
    profileSelect.appendChild(optNew);

    const ap = Auth.getActiveProfile?.();
    if (ap && list.some(x => x.id === ap.id)) profileSelect.value = ap.id;
    else if (list.length) {
      profileSelect.value = list[0].id;
      Auth.setActiveProfile?.(list[0].id);
      syncFromAuth();
    } else profileSelect.value = "__new__";

    const refreshNewWrap = () => {
      const isNew = profileSelect.value === "__new__";
      if (newProfileWrap) newProfileWrap.hidden = !isNew;
      const ok = !isNew || ((startName?.value || "").trim().length >= 2);
      if (btnStart) btnStart.disabled = !ok;
    };

    on(profileSelect, "change", () => {
      AudioSys.unlock();
      if (profileSelect.value !== "__new__") {
        Auth.setActiveProfile?.(profileSelect.value);
        syncFromAuth();
        applySettingsToUI();
        updatePillsNow();
      }
      refreshNewWrap();
    });

    on(btnNewProfile, "click", () => {
      AudioSys.unlock();
      profileSelect.value = "__new__";
      refreshNewWrap();
      startName?.focus();
    });

    on(startName, "input", refreshNewWrap);
    refreshNewWrap();
  }

  // ───────────────────────── Boot ─────────────────────────
  function cacheDOM() {
    stage = $("stage");
    canvasWrap = $("canvasWrap");
    gameArea = $("gameArea");
    hud = $("hud");
    canvas = $("gameCanvas");

    if (!stage) throw new Error("Falta #stage");
    if (!gameArea && !canvasWrap) throw new Error("Falta #gameArea (o #canvasWrap)");
    if (!canvas) throw new Error("Falta #gameCanvas");

    ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
          canvas.getContext("2d", { alpha: false }) ||
          canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear contexto 2D");

    brandSub = $("brandSub");

    pillScore = $("pillScore");
    pillBest = $("pillBest");
    pillStreak = $("pillStreak");
    pillMult = $("pillMult");
    pillLevel = $("pillLevel");
    pillSpeed = $("pillSpeed");
    pillPlayer = $("pillPlayer");
    pillUpdate = $("pillUpdate");
    pillOffline = $("pillOffline");
    pillVersion = $("pillVersion");

    btnOptions = $("btnOptions");
    btnPause = $("btnPause");
    btnRestart = $("btnRestart");
    btnInstall = $("btnInstall");

    overlayLoading = $("overlayLoading");
    overlayPress = $("overlayPress");
    loadingSub = $("loadingSub");
    overlayStart = $("overlayStart");

    btnPressStart = $("btnPressStart");
    pressMeta = $("pressMeta");
    pillModeVal = $("pillModeVal");
    railCanvasEl = $("railCanvas");

    overlayPaused = $("overlayPaused");
    overlayUpgrades = $("overlayUpgrades");
    overlayGameOver = $("overlayGameOver");
    overlayOptions = $("overlayOptions");
    overlayError = $("overlayError");

    btnStart = $("btnStart");
    profileSelect = $("profileSelect");
    btnNewProfile = $("btnNewProfile");
    newProfileWrap = $("newProfileWrap");
    startName = $("startName");

    btnResume = $("btnResume");
    btnQuitToStart = $("btnQuitToStart");
    btnPausedRestart = $("btnPausedRestart");

    upTitle = $("upTitle");
    upSub = $("upSub");
    upgradeChoices = $("upgradeChoices");
    btnReroll = $("btnReroll");
    btnSkipUpgrade = $("btnSkipUpgrade");

    goStats = $("goStats");
    goScoreBig = $("goScoreBig");
    goBestBig = $("goBestBig");
    btnBackToStart = $("btnBackToStart");
    btnRetry = $("btnRetry");

    btnCloseOptions = $("btnCloseOptions");
    optSprites = $("optSprites");
    optVibration = $("optVibration");
    optDpad = $("optDpad");
    optFx = $("optFx");
    optFxValue = $("optFxValue");
    btnClearLocal = $("btnClearLocal");
    btnRepairPWA = $("btnRepairPWA");

    optMusicOn = $("optMusicOn");
    optSfxOn = $("optSfxOn");
    optMusicVol = $("optMusicVol");
    optMusicVolValue = $("optMusicVolValue");
    optSfxVol = $("optSfxVol");
    optSfxVolValue = $("optSfxVolValue");
    optMuteAll = $("optMuteAll");
    btnTestAudio = $("btnTestAudio");

    optLang = $("optLang");

    errMsg = $("errMsg");
    btnErrClose = $("btnErrClose");
    btnErrReload = $("btnErrReload");

    comboSeq = $("comboSeq");
    comboTimerVal = $("comboTimerVal");
    comboHint = $("comboHint");
    toast = $("toast");

    levelProgFill = $("levelProgFill");
    levelProgText = $("levelProgText");
    levelProgPct = $("levelProgPct");

    dpad = $("dpad");
    btnUp = $("btnUp");
    btnDown = $("btnDown");
    btnLeft = $("btnLeft");
    btnRight = $("btnRight");

    hudFloat = $("hudFloat");
  }

  function wireUI() {
    on(btnPause, "click", togglePause);
    on(btnOptions, "click", showOptions);

    on(btnResume, "click", () => { overlayHide(overlayPaused); pauseForOverlay(false); AudioSys.sfx("ui"); updateStatusHUD(); });
    on(btnQuitToStart, "click", async () => { AudioSys.sfx("ui"); await overlayFadeOut(overlayPaused, 120); resetRun(true); });
    on(btnPausedRestart, "click", () => { AudioSys.sfx("ui"); resetRun(false); startRun(); });

    on(btnRetry, "click", () => { resetRun(false); startRun(); });
    on(btnBackToStart, "click", () => { resetRun(true); });
    on(btnRestart, "click", () => { resetRun(false); startRun(); });

    on(btnCloseOptions, "click", hideOptions);
    on(overlayOptions, "click", (e) => { if (e.target === overlayOptions) hideOptions(); });

    on(optSprites, "change", () => { settings.useSprites = !!optSprites.checked; saveSettings(); pushPrefsToAuth(); });
    on(optVibration, "change", () => { settings.vibration = !!optVibration.checked; saveSettings(); pushPrefsToAuth(); });
    on(optDpad, "change", () => { settings.showDpad = !!optDpad.checked; applySettingsToUI(); saveSettings(); pushPrefsToAuth(); });

    on(optFx, "input", () => {
      settings.fx = clamp(parseFloat(optFx.value || "1"), 0.4, 1.25);
      if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
      pushPrefsToAuth();
    });

    on(optMusicOn, "change", () => { AudioSys.unlock(); settings.musicOn = !!optMusicOn.checked; applyAudioSettingsNow(); saveSettings(); pushPrefsToAuth(); });
    on(optSfxOn, "change", () => { AudioSys.unlock(); settings.sfxOn = !!optSfxOn.checked; applyAudioSettingsNow(); saveSettings(); pushPrefsToAuth(); });

    on(optMusicVol, "input", () => {
      AudioSys.unlock();
      settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.6"), 0, 1);
      if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
      applyAudioSettingsNow();
      saveSettings();
      pushPrefsToAuth();
    });

    on(optSfxVol, "input", () => {
      AudioSys.unlock();
      settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.9"), 0, 1);
      if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
      applyAudioSettingsNow();
      saveSettings();
      pushPrefsToAuth();
    });

    on(optMuteAll, "change", () => { AudioSys.unlock(); settings.muteAll = !!optMuteAll.checked; applyAudioSettingsNow(); saveSettings(); pushPrefsToAuth(); });

    on(btnTestAudio, "click", async () => {
      await AudioSys.unlock();
      applyAudioSettingsNow();
      AudioSys.startMusic();
      AudioSys.sfx("coin");
      showToast(I18n.t("audio_ok"), 700);
    });

    if (optLang) {
      on(optLang, "change", () => {
        const v = String(optLang.value || "auto");
        settings.lang = v;
        saveSettings();
        pushPrefsToAuth();

        I18n.setLang(settings.lang);
        applySettingsToUI();

        updatePillsNow();
        renderComboUI();
        if (overlayUpgrades && !overlayUpgrades.hidden) renderUpgradeChoices();
        if (brandSub) brandSub.textContent = I18n.t("app_ready");

        // refrescar títulos de tabs y contenido
        if (startTabPlay) startTabPlay.textContent = T("tab_play", "Jugar");
        if (startTabCatalog) startTabCatalog.textContent = T("tab_catalog", "Catálogo");
        if (startTabShop) startTabShop.textContent = T("tab_shop", "Tienda");
        if (btnShopRefresh) btnShopRefresh.textContent = T("shop_refresh", "Refrescar");

        // si estás en catálogo/tienda, re-render
        if (startPanelCatalog && !startPanelCatalog.hidden) renderCatalog();
        if (startPanelShop && !startPanelShop.hidden) renderShop();
      });
    }

    // Actions extra
    on(btnReroll, "click", () => { AudioSys.unlock(); rerollUpgrades(); });
    on(btnSkipUpgrade, "click", () => { AudioSys.unlock(); closeUpgrade(); AudioSys.sfx("ui"); });

    on(btnRepairPWA, "click", () => { AudioSys.unlock(); repairPWA(); });

    on(btnClearLocal, "click", async () => {
      AudioSys.unlock();
      const ok = confirm(T("confirm_clear_local", "¿Borrar datos locales? (score, runs, settings)"));
      if (!ok) return;

      try {
        const keys = [
          BEST_KEY, NAME_KEY, SETTINGS_KEY, RUNS_KEY,
          BEST_KEY_OLD, NAME_KEY_OLD, SETTINGS_KEY_OLD, RUNS_KEY_OLD,
          SW_RELOAD_KEY, SW_RELOAD_KEY_OLD,
          SW_RELOAD_TAG,
          "gridrogue_press_seen_v1",
        ];
        for (const k of keys) {
          try { localStorage.removeItem(k); } catch {}
          try { sessionStorage.removeItem(k); } catch {}
        }
      } catch {}

      // intento soft reset
      settings = defaultSettings();
      saveSettings();
      pushPrefsToAuth();

      try { location.reload(); } catch {}
    });

    // Error overlay buttons
    on(btnErrClose, "click", () => { try { overlayHide(overlayError); } catch {} });
    on(btnErrReload, "click", () => { try { requestAppReload(); } catch { location.reload(); } });

    // Start
    on(btnStart, "click", async () => {
      AudioSys.unlock();

      // Si Auth existe y estamos creando perfil nuevo
      if (Auth && profileSelect && profileSelect.value === "__new__") {
        const nm = String((startName?.value || "")).trim().slice(0, 16);
        if (nm.length < 2) { showToast(T("need_name", "Pon un nombre"), 900); return; }

        // Crear perfil si el auth.js lo soporta
        try {
          const id =
            Auth.createProfile?.(nm) ??
            Auth.addProfile?.(nm) ??
            null;

          if (id) {
            Auth.setActiveProfile?.(id);
            syncFromAuth();
          } else {
            // fallback: sin API clara, usamos nombre local
            playerName = nm;
            writeLS(NAME_KEY, playerName);
            writeLS(NAME_KEY_OLD, playerName);
          }
        } catch {
          playerName = nm;
          writeLS(NAME_KEY, playerName);
          writeLS(NAME_KEY_OLD, playerName);
        }
      } else if (!Auth) {
        // sin Auth: usa startName si existe
        const nm = String((startName?.value || playerName || "")).trim().slice(0, 16);
        if (nm.length >= 2) {
          playerName = nm;
          writeLS(NAME_KEY, playerName);
          writeLS(NAME_KEY_OLD, playerName);
        }
      } else {
        // Auth: cambio de profile ya lo gestiona el select
        syncFromAuth();
      }

      resetRun(false);
      await startRun();
    });
  }

  // ───────────────────────── Boot sequence ─────────────────────────
  let _didAntiScroll = false;

  function safeEndPerfBoot() {
    try {
      if (!perfEndBoot) return;
      if (typeof perfEndBoot === "function") perfEndBoot();
      else if (typeof perfEndBoot.end === "function") perfEndBoot.end();
    } catch {}
  }

  async function boot() {
    if (window.__GRIDROGUE_BOOTED) return;
    window.__GRIDROGUE_BOOTED = true;

    ensureLayoutStableCSS();

    // watchdog anti “loading infinito”
    let watchdog = null;
    try {
      watchdog = setTimeout(() => {
        try { overlayHide(overlayLoading); } catch {}
        try { overlayShow(overlayStart); } catch {}
        setState("menu");
      }, 5200);
    } catch {}

    try {
      cacheDOM();

      // fija overlays/toast para evitar layout shift
      stabilizeOverlaysNow();
      stabilizeToastEl();

      // scroll-lock global (el scroll solo dentro de overlays permitidos por guards)
      lockPageScroll();
      if (!_didAntiScroll) { installAntiScrollGuards(); _didAntiScroll = true; }

      // UI dinámica
      setupLanguageUI();
      ensureStartTabsUI();

      // HUD flotante
      ensureHudStatusUI();
      installHudObservers();

      // State base
      setState("loading");
      if (pillVersion) setPill(pillVersion, `v${APP_VERSION}`);
      if (brandSub) brandSub.textContent = I18n.t("app_loading") || I18n.t("app_ready") || "Ready";

      // Auth + prefs
      syncFromAuth();
      initAuthUI();

      // Skills pack
      initSkillsPackIfPresent();

      // Sprites opcionales
      try { await preloadSpritesWithTimeout(950); } catch {}

      // Wire
      wireUI();
      bindInputs();

      // aplicar settings a UI + audio + resize
      applySettingsToUI();

      // grid init
      recomputeZone();
      makeGrid();
      rerollCombo();

      // Resize listeners (robusto)
      let _rzRAF = 0;
      const scheduleResize = () => {
        if (_rzRAF) return;
        _rzRAF = raf(() => { _rzRAF = 0; resize(); });
      };
      on(window, "resize", scheduleResize, { passive: true });
      on(window, "orientationchange", scheduleResize, { passive: true });
      on(window.visualViewport, "resize", scheduleResize, { passive: true });
      on(window.visualViewport, "scroll", scheduleResize, { passive: true });

      // PWA
      try { await setupPWA(); } catch {}

      // Primer render
      resize();
      updatePillsNow();

      // mostrar UI inicial
      try { overlayHide(overlayLoading); } catch {}
      setState("menu");

      const pressSeen = (() => {
        try { return sessionStorage.getItem("gridrogue_press_seen_v1") === "1"; } catch { return false; }
      })();

      if (!pressSeen) showPressToStart();
      else overlayShow(overlayStart);

      if (brandSub) brandSub.textContent = I18n.t("app_ready");

      // loop
      lastT = pNow();
      requestAnimationFrame(frame);

      safeEndPerfBoot();
    } finally {
      try { if (watchdog) clearTimeout(watchdog); } catch {}
    }
  }

  // ───────────────────────── Start boot ─────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(showFatal), { once: true });
  } else {
    boot().catch(showFatal);
  }

})();
