/* app.js — Grid Rogue v0.1.8 STABLE+FULLSCREEN + AUDIO + I18N
   v0.1.8:
   - Keys renombradas a gridrogue_* con migración desde gridrunner_* (sin perder datos)
   - Panel de Upgrades: (CSS pasa a styles.css, NO inyección en JS)
   - Aura de escudo alrededor del player (visual protector cuando shields > 0)
   - Mobile: layout compacto 8x16 (en vez de 8x24) para que el juego se vea más grande
   - Anti-scroll/overscroll: bloqueo de scroll en juego, manteniendo scroll dentro de Opciones
   - Dpad SOLO móvil + colocación en bordes (CSS en styles.css)
   - Compat: mantiene window.__GRIDRUNNER_BOOTED (failsafe antiguo) y añade __GRIDROGUE_BOOTED
*/
(() => {
  "use strict";

  const APP_VERSION = String(window.APP_VERSION || "0.1.8");

  // Compat flags (failsafe/index antiguo)
  window.__GRIDRUNNER_BOOTED = false;
  window.__GRIDROGUE_BOOTED = false;

  // ───────────────────────── Imports (globals) ─────────────────────────
  const U = window.GRUtils || {};

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

  // ⛑️ Importante: NO romper pills con iconos. Si existe .pv, solo actualiza eso.
  const setPill = U.setPill || ((el, v) => {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(v);
    else el.textContent = String(v);
  });

  const setState = U.setState || ((s) => { try { document.body.dataset.state = s; } catch {} });

  const I18n = window.I18n || {
    setLang() {},
    getLang() { return "es"; },
    t(k, a) { return (a != null) ? `${k} ${a}` : k; },
    languageOptions() { return []; },
    applyDataAttrs() {},
  };

  const AudioSys = window.AudioSys || {
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

  // ───────────────────────── Storage keys (Grid Rogue + legacy Grid Runner) ─────────────────────────
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
  function writeLS(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

  function migrateKeyIfNeeded(newKey, oldKey) {
    const n = readLS(newKey);
    if (n != null) return n;
    const o = readLS(oldKey);
    if (o != null) {
      writeLS(newKey, o);
      return o;
    }
    return null;
  }

  // ───────────────────────── Device / Layout ─────────────────────────
  function isCoarsePointer() {
    try { return matchMedia("(pointer:coarse)").matches; } catch { return false; }
  }
  function isPortrait() {
    try { return matchMedia("(orientation: portrait)").matches; } catch { return (innerHeight >= innerWidth); }
  }
  function isMobileUA() {
    const ua = navigator.userAgent || "";
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  }

  // ✅ MÁS FIABLE: si es móvil/coarse y está en portrait => layout móvil (8x16)
  function isMobileLayout() {
    const coarse = isCoarsePointer();
    const portrait = isPortrait();
    return (coarse || isMobileUA()) && portrait;
  }

  function desiredRows() {
    // ✅ Mobile compacto para que el juego se vea más grande
    return isMobileLayout() ? 16 : 24;
  }

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
      // Guardar en nuevo + legacy (por si queda un app.js viejo cacheado)
      writeLS(SETTINGS_KEY, json);
      writeLS(SETTINGS_KEY_OLD, json);
    } catch {}
  }

  function vibrate(ms) {
    if (!settings.vibration) return;
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(ms); } catch {}
  }

  // aplica idioma ya
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

  // ✅ Scroll lock más duro (evita “scroll fantasma” en iOS/Android)
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
      // NO "none": así permitimos gestos dentro de overlays con scroll propio
      document.body.style.touchAction = "manipulation";
    } catch {}
  }

  function installAntiScrollGuards() {
    const allowScrollInOptions = (target) => {
      if (!overlayOptions || overlayOptions.hidden) return false;
      // permitir scroll SOLO dentro del cuerpo de opciones (o elementos internos)
      const body =
        overlayOptions.querySelector?.("#optionsBody") ||
        overlayOptions.querySelector?.(".options") ||
        overlayOptions;
      return !!(body && target && (target === body || target.closest?.("#optionsBody") || target.closest?.(".options")));
    };

    const preventIfNeeded = (e) => {
      if (!e.cancelable) return;
      if (allowScrollInOptions(e.target)) return;
      // bloquea wheel/touchmove en el resto para evitar “scroll fantasma”
      e.preventDefault();
    };

    // Wheel (PC trackpad) + Touch (mobile)
    document.addEventListener("wheel", preventIfNeeded, { passive: false });
    document.addEventListener("touchmove", preventIfNeeded, { passive: false });
  }

  // ───────────────────────── Auth ─────────────────────────
  const Auth = window.Auth || null;

  let activeProfileId = null;

  // migra nombre/best
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

      // Persist también en storage local (nuevo + legacy)
      writeLS(NAME_KEY, playerName);
      writeLS(NAME_KEY_OLD, playerName);
      writeLS(BEST_KEY, String(best));
      writeLS(BEST_KEY_OLD, String(best));

      // Prefs por perfil (si existen) -> aplicarlas al settings local (sin romper)
      const prefs = Auth.getPrefsForActive?.();
      if (prefs && typeof prefs === "object") {
        // Sólo lo que nuestro settings entiende
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
      // Guardamos settings como prefs del perfil activo (si hay perfil activo)
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
  async function preloadSpritesWithTimeout(timeoutMs = 900) {
    const keys = [
      ["coin", "tile_coin.svg"],
      ["gem", "tile_gem.svg"],
      ["bonus", "tile_bonus.svg"],
      ["trap", "tile_trap.svg"],
      ["block", "tile_block.svg"],
      ["player", "tile_player.svg"], // si no existe, fallback a cuadrado
    ];
    const timeout = new Promise((res) => setTimeout(res, timeoutMs, "timeout"));
    try {
      const tasks = keys.map(async ([k, file]) => {
        try {
          const img = await loadImage(spriteUrl(file));
          sprites.map.set(k, img);
        } catch {}
      });
      await Promise.race([Promise.all(tasks), timeout]);
      sprites.ready = sprites.map.size > 0;
    } catch {
      sprites.ready = sprites.map.size > 0;
    }
  }

  // ───────────────────────── Game constants (dynamic rows) ─────────────────────────
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

  function applyRowsIfNeeded({ forceReset = false } = {}) {
    const want = desiredRows();
    if (want === ROWS) return false;
    ROWS = want;

    // Si cambia layout (portrait/size), reconstruimos de forma segura
    if (forceReset) {
      resetRun(true);
    } else {
      // Si estás jugando, mejor no “romper” arrays a mitad -> manda a menú
      if (running && !gameOver) resetRun(true);
      else {
        recomputeZone();
        makeGrid();
        rerollCombo();
      }
    }
    return true;
  }

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

  let shields = 0;
  let magnet = 0;
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

  // UI FX
  let toastT = 0;
  let playerPulse = 0;
  let zonePulse = 0;

  // Shake: solo player
  let shakeT = 0;
  let shakePow = 0;

  let hitFlashT = 0;
  let hitFlashMax = 1;
  let hitFlashColor = "#ff2b4d";

  const particles = [];
  const floatTexts = [];

  // Background stars
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

  let overlayLoading, loadingSub, overlayStart, overlayPaused, overlayUpgrades, overlayGameOver, overlayOptions, overlayError;

  let btnStart, profileSelect, btnNewProfile, newProfileWrap, startName;
  let btnResume, btnQuitToStart, btnPausedRestart;

  let upTitle, upSub, upgradeChoices, btnReroll, btnSkipUpgrade;

  let goStats, goScoreBig, goBestBig, btnBackToStart, btnRetry;

  let btnCloseOptions, optSprites, optVibration, optDpad, optFx, optFxValue, btnClearLocal, btnRepairPWA;

  // AUDIO opts
  let optMusicOn, optSfxOn, optMusicVol, optMusicVolValue, optSfxVol, optSfxVolValue, optMuteAll, btnTestAudio;

  // I18N opts
  let optLang = null;

  let errMsg, btnErrClose, btnErrReload;

  let comboSeq, comboTimerVal, comboHint, toast;
  let levelProgFill, levelProgText, levelProgPct;

  let dpad, btnUp, btnDown, btnLeft, btnRight;

  // ───────────────────────── Error handling global ─────────────────────────
  function showFatal(err) {
    try {
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
    toast.textContent = msg;
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
  function setOfflinePill() { if (pillOffline) pillOffline.hidden = navigator.onLine; }

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
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.marginTop = "10px";

      const lab = document.createElement("label");
      lab.htmlFor = "optLang";
      lab.textContent = I18n.t("opt_language");
      lab.style.opacity = "0.9";

      const sel = document.createElement("select");
      sel.id = "optLang";
      sel.style.minWidth = "140px";

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

    // ✅ Dpad sólo en móvil/coarse
    const coarse = isCoarsePointer() || isMobileUA();
    if (dpad) dpad.hidden = !(coarse && settings.showDpad);

    I18n.applyDataAttrs(document);
    applyAudioSettingsNow();
    resize();
  }

  // ───────────────────────── Grid (robusto) ─────────────────────────
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
        const g = Math.random();
        out[c] = (g < 0.68) ? CellType.Coin : (g < 0.92) ? CellType.Gem : CellType.Bonus;
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

  function applyCollect(t, checkCombo = true) {
    playerPulse = 1;
    zonePulse = 1;

    const v = scoreFor(t);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    if (t === CellType.Trap) {
      streak = 0;
      mult = clamp(mult * 0.92, 1.0, 4.0);
      vibrate(18);
      failCombo();
      showToast(I18n.t("toast_trap"), 650);
      flash("#ff6b3d", 220);
      shake(220, 7);
      AudioSys.sfx("trap");
      return;
    }

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
    if (magnet <= 0) return;
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
          applyCollect(t, false);
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
        } else {
          AudioSys.sfx("ko");
          gameOverNow("KO");
        }
        return;
      }

      if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) spawnEatFX(t, x, y);
      else spawnPop(x, y, CELL_COLORS[t], 0.85);

      const before = score;
      applyCollect(t, true);
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

  function failCombo() {
    comboIdx = 0;
    comboTime = comboTimeMax;
    renderComboUI();
  }

  // ───────────────────────── Upgrades ─────────────────────────
  const Upgrades = [
    { id: "shield", nameKey: "up_shield_name", descKey: "up_shield_desc", tagKey: "tag_defense", max: 6, rarity: "common", weight: 10, apply() { shields++; } },

    { id: "mag1", nameKey: "up_mag1_name", descKey: "up_mag1_desc", tagKey: "tag_qol", max: 1, rarity: "rare", weight: 7, apply() { magnet = Math.max(magnet, 1); } },
    { id: "mag2", nameKey: "up_mag2_name", descKey: "up_mag2_desc", tagKey: "tag_qol", max: 1, rarity: "epic", weight: 4, apply() { magnet = 2; } },
    { id: "mag3", nameKey: "up_mag3_name", descKey: "up_mag3_desc", tagKey: "tag_qol", max: 1, rarity: "legendary", weight: 2, apply() { magnet = 3; } },

    { id: "boost", nameKey: "up_boost_name", descKey: "up_boost_desc", tagKey: "tag_points", max: 10, rarity: "common", weight: 10, apply() { scoreBoost += 0.08; } },
    { id: "trap", nameKey: "up_trap_name", descKey: "up_trap_desc", tagKey: "tag_defense", max: 4, rarity: "common", weight: 9, apply() { trapResist++; } },

    { id: "zone", nameKey: "up_zone_name", descKey: "up_zone_desc", tagKey: "tag_mobility", max: 3, rarity: "epic", weight: 4, apply() { zoneExtra++; recomputeZone(); } },

    { id: "coin", nameKey: "up_coin_name", descKey: "up_coin_desc", tagKey: "tag_points", max: 8, rarity: "common", weight: 10, apply() { coinValue += 2; } },
    { id: "gem", nameKey: "up_gem_name", descKey: "up_gem_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7, apply() { gemValue += 6; } },
    { id: "bonus", nameKey: "up_bonus_name", descKey: "up_bonus_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7, apply() { bonusValue += 10; } },

    { id: "reroll", nameKey: "up_reroll_name", descKey: "up_reroll_desc", tagKey: "tag_upgrades", max: 5, rarity: "rare", weight: 6, apply() { rerolls++; } },
    { id: "mult", nameKey: "up_mult_name", descKey: "up_mult_desc", tagKey: "tag_combo", max: 10, rarity: "epic", weight: 5, apply() { mult = clamp(mult + 0.10, 1.0, 4.0); } },
  ];

  const pickedCount = new Map();

  function isUpgradeAllowed(u) {
    if ((pickedCount.get(u.id) || 0) >= (u.max ?? 999)) return false;
    if (u.id === "mag1") return magnet < 1;
    if (u.id === "mag2") return magnet < 2;
    if (u.id === "mag3") return magnet < 3;
    return true;
  }

  const canPick = (u) => isUpgradeAllowed(u);
  const markPick = (u) => pickedCount.set(u.id, (pickedCount.get(u.id) || 0) + 1);

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

  function chooseUpgrades(n = 3) {
    const pool = Upgrades.filter(canPick);
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

  function pauseForOverlay(on) {
    if (!running || gameOver) return;
    paused = !!on;
    AudioSys.duckMusic(paused || inLevelUp || gameOver);
  }

  // ───────────────────────── Upgrade Confetti FX ─────────────────────────
  let upFxCanvas = null, upFxCtx = null;
  const upConfetti = [];
  let upFxW = 0, upFxH = 0;

  function ensureUpgradeFxCanvas() {
    if (!overlayUpgrades) return;
    if (upFxCanvas && upFxCanvas.parentElement) return;

    try {
      const c = document.createElement("canvas");
      c.id = "upFxCanvas";
      c.style.position = "absolute";
      c.style.left = "0";
      c.style.top = "0";
      c.style.width = "100%";
      c.style.height = "100%";
      c.style.pointerEvents = "none";
      c.style.zIndex = "0";
      overlayUpgrades.style.position = overlayUpgrades.style.position || "relative";
      overlayUpgrades.appendChild(c);

      upFxCanvas = c;
      upFxCtx = c.getContext("2d", { alpha: true });

      resizeUpgradeFxCanvas();
    } catch {}
  }

  function resizeUpgradeFxCanvas() {
    if (!upFxCanvas || !overlayUpgrades) return;
    const r = overlayUpgrades.getBoundingClientRect();
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
    const g = 520;
    for (let i = upConfetti.length - 1; i >= 0; i--) {
      const p = upConfetti[i];
      p.life -= dtMs;
      if (p.life <= 0 || p.y > upFxH + 80) { upConfetti.splice(i, 1); continue; }

      p.vy += g * dt;
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
    currentUpgradeChoices = chooseUpgrades(3);
    if (upgradeChoices) upgradeChoices.innerHTML = "";

    for (const u of currentUpgradeChoices) {
      const name = I18n.t(u.nameKey);
      const desc = I18n.t(u.descKey);
      const tag = I18n.t(u.tagKey);

      const rarity = (u.rarity || "common");
      const rarityText = rarityLabel(rarity);

      const card = document.createElement("div");
      card.className = "upCard";
      card.dataset.rarity = rarity;
      card.setAttribute("role", "button");
      card.tabIndex = 0;

      const nextLv = (pickedCount.get(u.id) || 0) + 1;
      const maxLv = u.max ?? 999;

      card.innerHTML = `
        <div class="upTitle">${name}</div>
        <div class="upDesc">${desc}</div>
        <div class="upMeta">
          <span class="upRarityBadge">${rarityText}</span>
          <span class="badge">${tag}</span>
          <span class="badge">Lv ${nextLv}/${maxLv}</span>
        </div>
      `;

      const pickThis = () => {
        markPick(u);
        u.apply();

        const burst = (rarity === "legendary") ? 1.9 : (rarity === "epic") ? 1.4 : (rarity === "rare") ? 1.15 : 1.0;
        confettiBurst(burst);

        showToast(I18n.t("toast_upgrade", name), 950);
        shake(120, 3);
        flash(
          (rarity === "legendary") ? "#ffd35a" :
          (rarity === "epic") ? "#d685ff" :
          (rarity === "rare") ? "#6ab0ff" : "#ffffff",
          120
        );
        AudioSys.sfx("pick");
        closeUpgrade();
      };

      card.addEventListener("click", () => pickThis());
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickThis(); }
      });

      upgradeChoices?.appendChild(card);
    }

    if (btnReroll) btnReroll.disabled = !(rerolls > 0);
    if (btnSkipUpgrade) btnSkipUpgrade.hidden = (level < 4);
  }

  function rerollUpgrades() {
    if (rerolls <= 0) return;
    rerolls--;
    renderUpgradeChoices();
    showToast(I18n.t("toast_reroll"), 650);
    shake(90, 2);
    flash("#ffd35a", 110);
    AudioSys.sfx("reroll");
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
    if (magnet <= 0) return;
    const rad = (magnet + 0.35) * cellPx;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.15);
    g.addColorStop(0, "rgba(106,176,255,0.12)");
    g.addColorStop(0.55, "rgba(106,176,255,0.06)");
    g.addColorStop(1, "rgba(106,176,255,0.0)");
    ctx.fillStyle = g;
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

  // ✅ Aura de escudo (v0.1.8)
  function drawShieldAura(cx, cy) {
    if (shields <= 0) return;

    const phase = (running ? runTime : (performance.now() / 1000));
    const pulse = 0.5 + 0.5 * Math.sin(phase * 3.6);
    const rad = cellPx * (0.78 + 0.06 * pulse);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.15);
    g.addColorStop(0.0, "rgba(106,176,255,0.00)");
    g.addColorStop(0.38, `rgba(106,176,255,${(0.10 + 0.06 * pulse).toFixed(3)})`);
    g.addColorStop(1.0, "rgba(106,176,255,0.00)");
    ctx.fillStyle = g;
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

    const g = ctx.createLinearGradient(0, 0, 0, cssCanvasH);
    g.addColorStop(0, "#060610");
    g.addColorStop(1, "#04040a");
    ctx.fillStyle = g;
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

        if (!used && (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus)) {
          drawTileGlow(x, y, t, 0);
        }

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
    if (!gameArea || !canvas || !ctx) return;

    updateVhUnit();

    // si cambia mobile layout (rows) por orientación/tamaño -> reajusta
    applyRowsIfNeeded({ forceReset: false });

    const r = gameArea.getBoundingClientRect();
    const availW = Math.max(240, Math.floor(r.width));
    const availH = Math.max(240, Math.floor(r.height));

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

    // ✅ móvil: permite celdas más grandes
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
    draw(16);
  }

  // ───────────────────────── Input ─────────────────────────
  function isAnyBlockingOverlayOpen() {
    const open = (el) => el && el.hidden === false;
    return open(overlayStart) || open(overlayOptions) || open(overlayUpgrades) || open(overlayPaused) || open(overlayGameOver) || open(overlayError) || open(overlayLoading);
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
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      AudioSys.unlock();

      if (k === "Escape") { togglePause(); return; }
      if (k === "r" || k === "R") { if (!isAnyBlockingOverlayOpen()) { resetRun(false); startRun(); } return; }

      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
    });

    btnLeft?.addEventListener("click", () => move(-1, 0));
    btnRight?.addEventListener("click", () => move(+1, 0));
    btnUp?.addEventListener("click", () => move(0, -1));
    btnDown?.addEventListener("click", () => move(0, +1));

    if (!canvas || !gameArea) return;

    // Evita gestos/scroll dentro del área de juego
    const blockIfGame = (e) => { if (e.cancelable) e.preventDefault(); };
    gameArea.addEventListener("wheel", blockIfGame, { passive: false });
    gameArea.addEventListener("touchmove", blockIfGame, { passive: false });
    gameArea.addEventListener("gesturestart", blockIfGame, { passive: false });
    gameArea.addEventListener("gesturechange", blockIfGame, { passive: false });

    let sx = 0, sy = 0, st = 0, active = false;

    canvas.addEventListener("pointerdown", (e) => {
      AudioSys.unlock();
      if (!canControl()) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
    });

    const endSwipe = (e) => {
      if (!active) return;
      active = false;
      if (!canControl()) return;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = performance.now() - st;

      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (dt < 650 && (adx > 22 || ady > 22)) {
        if (adx > ady) move(dx > 0 ? +1 : -1, 0);
        else move(0, dy > 0 ? +1 : -1);
      }
    };

    canvas.addEventListener("pointerup", endSwipe, { passive: true });
    canvas.addEventListener("pointercancel", () => { active = false; }, { passive: true });
  }

  // ───────────────────────── UI ─────────────────────────
  function togglePause() {
    if (!running || gameOver || inLevelUp) return;
    if (overlayOptions && !overlayOptions.hidden) return;
    paused = !paused;
    if (paused) { overlayShow(overlayPaused); AudioSys.duckMusic(true); }
    else { overlayHide(overlayPaused); AudioSys.duckMusic(false); }
    AudioSys.sfx("ui");
  }

  function showOptions() {
    overlayShow(overlayOptions);
    pauseForOverlay(true);
    try {
      requestAnimationFrame(() => {
        const body =
          overlayOptions?.querySelector?.("#optionsBody") ||
          overlayOptions?.querySelector?.(".panel") ||
          overlayOptions;
        if (body) body.scrollTop = 0;
      });
    } catch {}
    AudioSys.sfx("ui");
  }
  function hideOptions() {
    overlayHide(overlayOptions);
    if (!inLevelUp && !gameOver && running) pauseForOverlay(false);
    AudioSys.sfx("ui");
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

    shields = 0; magnet = 0; scoreBoost = 0; trapResist = 0; rerolls = 0;
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

    if (showMenu) { overlayShow(overlayStart); setState("menu"); }
    else overlayHide(overlayStart);

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

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    runTime = 0;
    scrollPx = 0;
    comboTime = comboTimeMax;

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

    if (score > best) {
      best = score;
      try { writeLS(BEST_KEY, String(best)); writeLS(BEST_KEY_OLD, String(best)); } catch {}
      try { Auth?.setBestForActive?.(best); } catch {}
    }

    // Guardar runs (nuevo + legacy)
    try {
      const raw = migrateKeyIfNeeded(RUNS_KEY, RUNS_KEY_OLD);
      const arr = raw ? safeParse(raw, []) : [];
      arr.unshift({ ts: Date.now(), profileId: activeProfileId, name: playerName, score, level, time: Math.round(runTime), rows: ROWS });
      arr.length = Math.min(arr.length, 30);
      const json = JSON.stringify(arr);
      writeLS(RUNS_KEY, json);
      writeLS(RUNS_KEY_OLD, json);
    } catch {}

    if (goScoreBig) goScoreBig.textContent = String(score | 0);
    if (goBestBig) goBestBig.textContent = String(best | 0);

    if (goStats) {
      goStats.innerHTML = `
        <div class="line"><span>${I18n.t("stats_reason")}</span><span>${reason}</span></div>
        <div class="line"><span>${I18n.t("stats_level")}</span><span>${level}</span></div>
        <div class="line"><span>${I18n.t("stats_time")}</span><span>${Math.round(runTime)}s</span></div>
        <div class="line"><span>${I18n.t("stats_streak")}</span><span>${streak}</span></div>
        <div class="line"><span>${I18n.t("stats_mult")}</span><span>${mult.toFixed(2)}</span></div>
      `;
    }

    overlayShow(overlayGameOver);

    if (pendingReload) {
      pendingReload = false;
      requestAppReload();
    }
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

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
    try {
      const dt = clamp(t - lastT, 0, 50);
      lastT = t;

      tickFx(dt);
      update(dt);
      draw(dt);
    } catch (e) {
      showFatal(e);
    }
    requestAnimationFrame(frame);
  }

  // ───────────────────────── PWA / SW / Install ─────────────────────────
  let deferredPrompt = null;
  let swReg = null;
  let swReloadGuard = false;

  function isStandalone() {
    return (window.matchMedia?.("(display-mode: standalone)")?.matches) ||
      (window.navigator.standalone === true) ||
      document.referrer.includes("android-app://");
  }

  function markUpdateAvailable(msg = null) {
    if (!pillUpdate) return;
    pillUpdate.hidden = false;
    setPill(pillUpdate, msg || I18n.t("pill_update"));
  }

  function requestAppReload() {
    if (running && !gameOver) {
      pendingReload = true;
      markUpdateAvailable(I18n.t("pill_update"));
      showToast(I18n.t("update_apply_end"), 1200);
      return;
    }
    location.reload();
  }

  async function applySWUpdateNow() {
    if (!swReg) { location.reload(); return; }

    if (swReg.waiting) { try { swReg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {} }
    else { try { await swReg.update?.(); } catch {} }

    const k = SW_RELOAD_KEY;
    const kOld = SW_RELOAD_KEY_OLD;

    if (sessionStorage.getItem(k) !== "1" && sessionStorage.getItem(kOld) !== "1") {
      sessionStorage.setItem(k, "1");
      setTimeout(() => location.reload(), 650);
    } else location.reload();
  }

  async function repairPWA() {
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

  async function setupPWA() {
    setOfflinePill();
    window.addEventListener("online", setOfflinePill, { passive: true });
    window.addEventListener("offline", setOfflinePill, { passive: true });

    if (btnInstall) btnInstall.hidden = true;

    if (!isStandalone()) {
      window.addEventListener("beforeinstallprompt", (e) => {
        if (isStandalone()) return;
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall) btnInstall.hidden = false;
      });

      window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        if (btnInstall) btnInstall.hidden = true;
      });

      btnInstall?.addEventListener("click", async () => {
        AudioSys.unlock();
        if (!deferredPrompt) return;
        btnInstall.disabled = true;
        try { deferredPrompt.prompt(); await deferredPrompt.userChoice; } catch {}
        deferredPrompt = null;
        btnInstall.hidden = true;
        btnInstall.disabled = false;
      });
    }

    pillUpdate?.addEventListener("click", () => {
      AudioSys.unlock();
      if (running && !gameOver) {
        pendingReload = true;
        showToast(I18n.t("update_apply_end_short"), 900);
        return;
      }
      applySWUpdateNow();
    });

    if (window.__GRIDRUNNER_NOSW) return;

    if ("serviceWorker" in navigator) {
      try {
        const swUrl = new URL(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`, location.href);
        swReg = await navigator.serviceWorker.register(swUrl);

        try { await swReg.update(); } catch {}
        if (swReg.waiting) markUpdateAvailable(I18n.t("pill_update"));

        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              markUpdateAvailable(I18n.t("pill_update"));
              showToast(I18n.t("update_available"), 1100);
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (swReloadGuard) return;
          swReloadGuard = true;

          const k = SW_RELOAD_KEY;
          const kOld = SW_RELOAD_KEY_OLD;

          if (sessionStorage.getItem(k) !== "1" && sessionStorage.getItem(kOld) !== "1") {
            sessionStorage.setItem(k, "1");
            requestAppReload();
          }
        });
      } catch (e) {
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Auth UI ─────────────────────────
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

    profileSelect.addEventListener("change", () => {
      AudioSys.unlock();
      if (profileSelect.value !== "__new__") {
        Auth.setActiveProfile?.(profileSelect.value);
        syncFromAuth();
        applySettingsToUI();
        updatePillsNow();
      }
      refreshNewWrap();
    });

    btnNewProfile?.addEventListener("click", () => {
      AudioSys.unlock();
      profileSelect.value = "__new__";
      refreshNewWrap();
      startName?.focus();
    });

    startName?.addEventListener("input", refreshNewWrap);
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
    if (!gameArea) throw new Error("Falta #gameArea");
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
    loadingSub = $("loadingSub");
    overlayStart = $("overlayStart");
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
  }

  async function boot() {
    try {
      const bootStartedAt = performance.now();

      cacheDOM();

      // flags para failsafe
      window.__GRIDRUNNER_BOOTED = true;
      window.__GRIDROGUE_BOOTED = true;

      lockPageScroll();
      installAntiScrollGuards();
      updateVhUnit();

      ensureUpgradeFxCanvas();

      setPill(pillVersion, `v${APP_VERSION}`);
      if (pillUpdate) pillUpdate.hidden = true;

      if (loadingSub) loadingSub.textContent = I18n.t("app_loading");
      setState("loading");

      syncFromAuth();
      applyAudioSettingsNow();

      // decide rows al boot
      ROWS = desiredRows();

      recomputeZone();
      makeGrid();
      rerollCombo();

      initAuthUI();

      setupLanguageUI();
      applySettingsToUI();

      resize();
      window.addEventListener("resize", resize, { passive: true });
      window.visualViewport?.addEventListener?.("resize", resize, { passive: true });

      bindInputs();

      btnPause?.addEventListener("click", togglePause);
      btnOptions?.addEventListener("click", showOptions);

      btnResume?.addEventListener("click", () => { overlayHide(overlayPaused); pauseForOverlay(false); AudioSys.sfx("ui"); });
      btnQuitToStart?.addEventListener("click", async () => { AudioSys.sfx("ui"); await overlayFadeOut(overlayPaused, 120); resetRun(true); });

      btnPausedRestart?.addEventListener("click", () => { AudioSys.sfx("ui"); resetRun(false); startRun(); });

      btnRetry?.addEventListener("click", () => { resetRun(false); startRun(); });
      btnBackToStart?.addEventListener("click", () => { resetRun(true); });
      btnRestart?.addEventListener("click", () => { resetRun(false); startRun(); });

      btnCloseOptions?.addEventListener("click", hideOptions);
      overlayOptions?.addEventListener("click", (e) => { if (e.target === overlayOptions) hideOptions(); });

      optSprites?.addEventListener("change", () => {
        settings.useSprites = !!optSprites.checked;
        saveSettings();
        pushPrefsToAuth();
      });
      optVibration?.addEventListener("change", () => {
        settings.vibration = !!optVibration.checked;
        saveSettings();
        pushPrefsToAuth();
      });
      optDpad?.addEventListener("change", () => {
        settings.showDpad = !!optDpad.checked;
        applySettingsToUI();
        saveSettings();
        pushPrefsToAuth();
      });
      optFx?.addEventListener("input", () => {
        settings.fx = clamp(parseFloat(optFx.value || "1"), 0.4, 1.25);
        if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);
        saveSettings();
        pushPrefsToAuth();
      });

      optMusicOn?.addEventListener("change", () => {
        AudioSys.unlock();
        settings.musicOn = !!optMusicOn.checked;
        applyAudioSettingsNow();
        saveSettings();
        pushPrefsToAuth();
      });
      optSfxOn?.addEventListener("change", () => {
        AudioSys.unlock();
        settings.sfxOn = !!optSfxOn.checked;
        applyAudioSettingsNow();
        saveSettings();
        pushPrefsToAuth();
      });
      optMusicVol?.addEventListener("input", () => {
        AudioSys.unlock();
        settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.6"), 0, 1);
        if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
        applyAudioSettingsNow();
        saveSettings();
        pushPrefsToAuth();
      });
      optSfxVol?.addEventListener("input", () => {
        AudioSys.unlock();
        settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.9"), 0, 1);
        if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
        applyAudioSettingsNow();
        saveSettings();
        pushPrefsToAuth();
      });
      optMuteAll?.addEventListener("change", () => {
        AudioSys.unlock();
        settings.muteAll = !!optMuteAll.checked;
        applyAudioSettingsNow();
        saveSettings();
        pushPrefsToAuth();
      });

      btnTestAudio?.addEventListener("click", async () => {
        await AudioSys.unlock();
        applyAudioSettingsNow();
        AudioSys.startMusic();
        AudioSys.sfx("coin");
        showToast(I18n.t("audio_ok"), 700);
      });

      if (optLang) {
        optLang.addEventListener("change", () => {
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
        });
      }

      btnRepairPWA?.addEventListener("click", repairPWA);

      btnClearLocal?.addEventListener("click", () => {
        const ok = confirm(I18n.t("confirm_clear_local"));
        if (!ok) return;
        localStorage.clear();
        location.reload();
      });

      btnErrClose?.addEventListener("click", () => overlayHide(overlayError));
      btnErrReload?.addEventListener("click", () => location.reload());

      btnReroll?.addEventListener("click", rerollUpgrades);
      btnSkipUpgrade?.addEventListener("click", () => { closeUpgrade(); showToast(I18n.t("toast_skip"), 650); AudioSys.sfx("ui"); });

      btnStart?.addEventListener("click", async () => {
        await AudioSys.unlock();

        if (Auth && profileSelect) {
          if (profileSelect.value === "__new__") {
            const nm = (startName?.value || "").trim();
            const p = Auth.createProfile?.(nm);
            if (!p) { showToast(I18n.t("name_min"), 900); return; }
            syncFromAuth();
            initAuthUI();
          } else {
            Auth.setActiveProfile?.(profileSelect.value);
            syncFromAuth();
          }
        } else {
          const nm = (startName?.value || "").trim().slice(0, 16);
          if (nm.length >= 2) {
            playerName = nm;
            writeLS(NAME_KEY, playerName);
            writeLS(NAME_KEY_OLD, playerName);
          }
        }
        updatePillsNow();
        await startRun();
      });

      pillPlayer?.addEventListener("click", () => resetRun(true));
      pillPlayer?.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") resetRun(true); });

      if (loadingSub) loadingSub.textContent = I18n.t("app_pwa");
      setupPWA();
      preloadSpritesWithTimeout(900);

      resetRun(true);

      lastT = performance.now();
      requestAnimationFrame(frame);

      const SPLASH_MIN_MS = 1400;
      const elapsed = performance.now() - bootStartedAt;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);

      setTimeout(async () => {
        await overlayFadeOut(overlayLoading, 180);
        overlayShow(overlayStart);
        setState("menu");
        if (brandSub) brandSub.textContent = I18n.t("app_ready");
        updatePillsNow();
      }, wait);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && running && !gameOver && !inLevelUp) {
          pauseForOverlay(true);
          overlayShow(overlayPaused);
        }
      });

    } catch (e) {
      showFatal(e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
