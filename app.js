/* app.js — Grid Rogue v1.1.0 (RUNNER/ROGUE + SKILLS + SHOP/CHEST/KEY + ARCADE/INFINITE)
   ✅ Compatible con:
   - utils.js (window.GRUtils) (opcional)
   - audio.js (window.AudioSys) (opcional)
   - localization.js (window.I18n) (opcional)
   - auth.js (window.Auth) (opcional)
   - skills.js (window.GRSkills) ✅
   - rendiment.js (window.GRPerf) (opcional)

   Objetivo:
   - Mantener el "runner grid rogue" (avanzas por filas, el mundo se genera arriba).
   - Al pisar Shop abre tienda, al pisar Chest abre cofre (si tienes llave),
     Key da llaves.
   - LevelUp usa Skills Pack si existe (GRSkills), con reroll, discovery y catálogo.
   - Menú principal con modos: Infinito y Arcade (5 zonas x 20 stages).
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1100";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.1.0");

  // ───────────────────────── Dependencias opcionales ─────────────────────────
  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};
  const I18n = (typeof window !== "undefined" && window.I18n) ? window.I18n : null;
  const AudioSys = (typeof window !== "undefined" && window.AudioSys) ? window.AudioSys : null;
  const Auth = (typeof window !== "undefined" && window.Auth) ? window.Auth : null;
  const GRPerf = (typeof window !== "undefined" && window.GRPerf) ? window.GRPerf : null;

  // ───────────────────────── Helpers básicos (fallbacks) ─────────────────────────
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  });

  const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  const qs = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
  const NO_SW = !!(g && g.__GRIDRUNNER_NOSW) || qs.has("nosw");

  const log = (...a) => { try { console.log("[GridRogue]", ...a); } catch (_) {} };

  const LS = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        if (v == null) return fallback;
        return v;
      } catch (_) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
    jget(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        if (v == null) return fallback;
        return JSON.parse(v);
      } catch (_) { return fallback; }
    },
    jset(k, obj) { try { localStorage.setItem(k, JSON.stringify(obj)); } catch (_) {} },
  };

  const isMobile = (() => {
    try {
      return (matchMedia && matchMedia("(pointer:coarse)").matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    } catch (_) { return false; }
  })();

  const prefersReducedMotion = (() => {
    try { return matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  })();

  // ───────────────────────── DOM refs ─────────────────────────
  const $ = (id) => document.getElementById(id);

  const el = {
    pillModeVal: $("pillModeVal"),
    pillScore: $("pillScore"),
    pillBest: $("pillBest"),
    pillLevel: $("pillLevel"),
    pillMult: $("pillMult"),
    pillPlayer: $("pillPlayer"),
    pillVersion: $("pillVersion"),
    pillOffline: $("pillOffline"),
    pillUpdate: $("pillUpdate"),

    btnInstall: $("btnInstall"),
    btnPause: $("btnPause"),
    btnOptions: $("btnOptions"),

    stage: $("stage"),
    canvas: $("gameCanvas"),
    canvasWrap: $("canvasWrap"),
    canvasSizer: $("canvasSizer"),
    railFrame: $("railFrame"),

    hudFloat: $("hudFloat"),
    toast: $("toast"),

    comboSeq: $("comboSeq"),
    comboTimerVal: $("comboTimerVal"),
    comboHint: $("comboHint"),

    levelProgText: $("levelProgText"),
    levelProgPct: $("levelProgPct"),
    levelProgFill: $("levelProgFill"),

    overlayLoading: $("overlayLoading"),
    loadingSub: $("loadingSub"),
    loadingHint: $("loadingHint"),
    btnEmergencyReload: $("btnEmergencyReload"),
    btnEmergencyRepair: $("btnEmergencyRepair"),

    overlayPress: $("overlayPress"),
    btnPressStart: $("btnPressStart"),
    pressMeta: $("pressMeta"),
    pressSub: $("pressSub"),
    pressHint: $("pressHint"),

    overlayStart: $("overlayStart"),
    profileSelect: $("profileSelect"),
    btnNewProfile: $("btnNewProfile"),
    newProfileWrap: $("newProfileWrap"),
    startName: $("startName"),
    btnStart: $("btnStart"),
    startTitle: $("startTitle"),
    startSub: $("startSub"),

    overlayPaused: $("overlayPaused"),
    btnResume: $("btnResume"),
    btnPausedRestart: $("btnPausedRestart"),
    btnQuitToStart: $("btnQuitToStart"),

    overlayUpgrades: $("overlayUpgrades"),
    upgradeChoices: $("upgradeChoices"),
    btnReroll: $("btnReroll"),
    btnSkipUpgrade: $("btnSkipUpgrade"),
    upTitle: $("upTitle"),
    upSub: $("upSub"),

    overlayGameOver: $("overlayGameOver"),
    goScoreBig: $("goScoreBig"),
    goBestBig: $("goBestBig"),
    goStats: $("goStats"),
    btnBackToStart: $("btnBackToStart"),
    btnRetry: $("btnRetry"),

    overlayOptions: $("overlayOptions"),
    btnCloseOptions: $("btnCloseOptions"),
    optMusicOn: $("optMusicOn"),
    optSfxOn: $("optSfxOn"),
    optMusicVol: $("optMusicVol"),
    optSfxVol: $("optSfxVol"),
    optMusicVolValue: $("optMusicVolValue"),
    optSfxVolValue: $("optSfxVolValue"),
    optMuteAll: $("optMuteAll"),
    btnTestAudio: $("btnTestAudio"),
    optSprites: $("optSprites"),
    optVibration: $("optVibration"),
    optDpad: $("optDpad"),
    optFx: $("optFx"),
    optFxValue: $("optFxValue"),
    optLang: $("optLang"),
    btnRepairPWA: $("btnRepairPWA"),
    btnClearLocal: $("btnClearLocal"),

    overlayError: $("overlayError"),
    errMsg: $("errMsg"),
    btnErrClose: $("btnErrClose"),
    btnErrReload: $("btnErrReload"),

    dpad: $("dpad"),
    btnUp: $("btnUp"),
    btnDown: $("btnDown"),
    btnLeft: $("btnLeft"),
    btnRight: $("btnRight"),
  };

  // ───────────────────────── UI helpers ─────────────────────────
  function show(o) { if (!o) return; o.hidden = false; }
  function hide(o) { if (!o) return; o.hidden = true; }
  function setText(node, txt) { if (!node) return; node.textContent = String(txt ?? ""); }

  function toast(msg, ms = 1200) {
    try {
      if (!el.toast) return;
      setText(el.toast, msg);
      el.toast.hidden = false;
      el.toast.classList.remove("pop");
      void el.toast.offsetWidth;
      el.toast.classList.add("pop");
      const t = setTimeout(() => { if (el.toast) el.toast.hidden = true; }, clampInt(ms, 300, 5000));
      return () => clearTimeout(t);
    } catch (_) {}
  }

  function pillSet(pill, valueText) {
    if (!pill) return;
    const pv = pill.querySelector(".pv");
    if (pv) pv.textContent = String(valueText ?? "");
  }

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return String(Math.round(n));
  }

  function vib(ms = 20) {
    try {
      if (!state.options.vibration) return;
      if (navigator && navigator.vibrate) navigator.vibrate(clampInt(ms, 5, 60));
    } catch (_) {}
  }

  // ───────────────────────── Options persistentes ─────────────────────────
  const OPT_KEYS = {
    musicOn: "gridrogue_opt_musicOn",
    sfxOn: "gridrogue_opt_sfxOn",
    musicVol: "gridrogue_opt_musicVol",
    sfxVol: "gridrogue_opt_sfxVol",
    muteAll: "gridrogue_opt_muteAll",
    sprites: "gridrogue_opt_sprites",
    vibration: "gridrogue_opt_vibration",
    dpad: "gridrogue_opt_dpad",
    fx: "gridrogue_opt_fx",
    lang: "gridrogue_opt_lang",
  };

  function loadOptions() {
    const o = state.options;
    o.musicOn = LS.get(OPT_KEYS.musicOn, "1") === "1";
    o.sfxOn = LS.get(OPT_KEYS.sfxOn, "1") === "1";
    o.musicVol = clamp(Number(LS.get(OPT_KEYS.musicVol, "0.60")) || 0.60, 0, 1);
    o.sfxVol = clamp(Number(LS.get(OPT_KEYS.sfxVol, "0.90")) || 0.90, 0, 1);
    o.muteAll = LS.get(OPT_KEYS.muteAll, "0") === "1";
    o.sprites = LS.get(OPT_KEYS.sprites, "1") === "1";
    o.vibration = LS.get(OPT_KEYS.vibration, "1") === "1";
    o.dpad = LS.get(OPT_KEYS.dpad, isMobile ? "1" : "0") === "1";
    o.fx = clamp(Number(LS.get(OPT_KEYS.fx, "1.00")) || 1.0, 0.4, 1.25);
    o.lang = LS.get(OPT_KEYS.lang, "");
  }

  function saveOptions() {
    const o = state.options;
    LS.set(OPT_KEYS.musicOn, o.musicOn ? "1" : "0");
    LS.set(OPT_KEYS.sfxOn, o.sfxOn ? "1" : "0");
    LS.set(OPT_KEYS.musicVol, String(o.musicVol));
    LS.set(OPT_KEYS.sfxVol, String(o.sfxVol));
    LS.set(OPT_KEYS.muteAll, o.muteAll ? "1" : "0");
    LS.set(OPT_KEYS.sprites, o.sprites ? "1" : "0");
    LS.set(OPT_KEYS.vibration, o.vibration ? "1" : "0");
    LS.set(OPT_KEYS.dpad, o.dpad ? "1" : "0");
    LS.set(OPT_KEYS.fx, String(o.fx));
    LS.set(OPT_KEYS.lang, String(o.lang || ""));
  }

  function syncOptionsUI() {
    const o = state.options;
    if (el.optMusicOn) el.optMusicOn.checked = !!o.musicOn;
    if (el.optSfxOn) el.optSfxOn.checked = !!o.sfxOn;
    if (el.optMusicVol) el.optMusicVol.value = String(o.musicVol);
    if (el.optSfxVol) el.optSfxVol.value = String(o.sfxVol);
    if (el.optMusicVolValue) setText(el.optMusicVolValue, o.musicVol.toFixed(2));
    if (el.optSfxVolValue) setText(el.optSfxVolValue, o.sfxVol.toFixed(2));
    if (el.optMuteAll) el.optMuteAll.checked = !!o.muteAll;
    if (el.optSprites) el.optSprites.checked = !!o.sprites;
    if (el.optVibration) el.optVibration.checked = !!o.vibration;
    if (el.optDpad) el.optDpad.checked = !!o.dpad;
    if (el.optFx) el.optFx.value = String(o.fx);
    if (el.optFxValue) setText(el.optFxValue, o.fx.toFixed(2));

    if (el.dpad) el.dpad.hidden = !(isMobile && o.dpad && state.phase === "playing");
  }

  function applyAudioOptions() {
    try {
      if (!AudioSys) return;
      const o = state.options;
      if (typeof AudioSys.setMuteAll === "function") AudioSys.setMuteAll(!!o.muteAll);
      if (typeof AudioSys.setMusicEnabled === "function") AudioSys.setMusicEnabled(!!o.musicOn);
      if (typeof AudioSys.setSfxEnabled === "function") AudioSys.setSfxEnabled(!!o.sfxOn);
      if (typeof AudioSys.setMusicVolume === "function") AudioSys.setMusicVolume(o.musicVol);
      if (typeof AudioSys.setSfxVolume === "function") AudioSys.setSfxVolume(o.sfxVol);
    } catch (_) {}
  }

  function sfx(name) {
    try {
      if (!AudioSys) return;
      if (typeof AudioSys.play === "function") AudioSys.play(name);
      else if (typeof AudioSys.sfx === "function") AudioSys.sfx(name);
      else if (typeof AudioSys.playSfx === "function") AudioSys.playSfx(name);
    } catch (_) {}
  }

  function musicStart() {
    try {
      if (!AudioSys) return;
      if (typeof AudioSys.playMusic === "function") AudioSys.playMusic("loop");
      else if (typeof AudioSys.music === "function") AudioSys.music("loop");
    } catch (_) {}
  }

  function audioUnlockOnce() {
    try {
      if (!AudioSys) return;
      if (typeof AudioSys.unlock === "function") AudioSys.unlock();
      if (typeof AudioSys.init === "function") AudioSys.init();
    } catch (_) {}
  }

  // ───────────────────────── Estado global ─────────────────────────
  const state = {
    bootTs: now(),
    phase: "boot", // boot -> press -> menu -> playing -> paused -> upgrades -> shop -> chest -> gameover
    running: false,
    raf: 0,
    lastTs: 0,

    options: {
      musicOn: true,
      sfxOn: true,
      musicVol: 0.60,
      sfxVol: 0.90,
      muteAll: false,
      sprites: true,
      vibration: true,
      dpad: isMobile,
      fx: 1.0,
      lang: "",
    },

    // perfiles
    profile: { id: "local", name: "Jugador" },
    profiles: [],

    // modo
    mode: "infinite", // infinite | arcade
    arcade: {
      zone: 1, // 1..5
      stage: 1, // 1..20
    },

    // pwa update
    sw: {
      reg: null,
      waiting: null,
      updateAvailable: false,
      pendingReload: false,
    },

    // juego
    game: null,
  };

  // ───────────────────────── Constantes juego ─────────────────────────
  const GAME = {
    COLS: 8,
    ROWS: isMobile ? 16 : 20,
    SAFE_PLAYER_Y: isMobile ? 12 : 15, // zona baja (runner feel)
    SHIFT_THRESHOLD_Y: isMobile ? 5 : 6, // cuando el jugador sube demasiado, shift del mundo
    BASE_STEP_XP: 2,
    BASE_STEP_SCORE: 0,
    HP_START: 10,
    HP_CAP: 24,
    MULT_CAP: 4.0,
    BASE_COMBO_TIME: 2.2,

    // arcade
    ARCADE_ZONES: 5,
    ARCADE_STAGES_PER_ZONE: 20,
  };

  const TILE = Object.freeze({
    Empty: "empty",
    Coin: "coin",
    Gem: "gem",
    Bonus: "bonus",
    Trap: "trap",
    Block: "block",
    Shop: "shop",
    Chest: "chest",
    Key: "key",
  });

  function tileIsPickup(t) {
    return t === TILE.Coin || t === TILE.Gem || t === TILE.Bonus;
  }

  // ───────────────────────── Generación de filas (runner) ─────────────────────────
  function randChoiceWeighted(items, weights) {
    let sum = 0;
    for (let i = 0; i < items.length; i++) sum += Math.max(0.0001, Number(weights[i]) || 0);
    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0.0001, Number(weights[i]) || 0);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function tileWeightsForDifficulty(d) {
    // d: 0..1.5
    const base = {
      empty: 54,
      coin: 16,
      gem: 7,
      bonus: 4,
      trap: 10,
      block: 7,
      key: 1.6,
      chest: 1.2,
      shop: 1.0,
    };
    const k = clamp(d, 0, 1.5);
    base.empty = Math.max(30, base.empty - 18 * k);
    base.trap = base.trap + 8 * k;
    base.block = base.block + 7 * k;
    base.coin = base.coin + 2 * (1 - Math.min(1, k));
    base.gem = base.gem + 1 * (1 - Math.min(1, k));
    base.key = base.key + 0.2 * k;
    base.chest = base.chest + 0.2 * k;
    base.shop = base.shop + 0.15 * k;

    return base;
  }

  function generateRow(game, difficulty01) {
    const w = tileWeightsForDifficulty(difficulty01);
    const items = [TILE.Empty, TILE.Coin, TILE.Gem, TILE.Bonus, TILE.Trap, TILE.Block, TILE.Key, TILE.Chest, TILE.Shop];
    const weights = [w.empty, w.coin, w.gem, w.bonus, w.trap, w.block, w.key, w.chest, w.shop];

    const row = new Array(GAME.COLS).fill(TILE.Empty);

    // Evitar filas imposibles: máximo N blocks, asegurar 1-2 celdas "safe"
    let blocks = 0;
    let traps = 0;

    for (let x = 0; x < GAME.COLS; x++) {
      let t = randChoiceWeighted(items, weights);

      // limitar
      if (t === TILE.Block && blocks >= 2) t = TILE.Empty;
      if (t === TILE.Trap && traps >= 3) t = TILE.Empty;

      // no spamear shop/chest
      if ((t === TILE.Shop || t === TILE.Chest) && Math.random() < 0.55) t = TILE.Empty;

      row[x] = t;
      if (t === TILE.Block) blocks++;
      if (t === TILE.Trap) traps++;
    }

    // Garantizar al menos 2 no-block
    let safeCount = 0;
    for (let x = 0; x < GAME.COLS; x++) if (row[x] !== TILE.Block) safeCount++;
    if (safeCount < 2) {
      for (let i = 0; i < 2; i++) row[(Math.random() * GAME.COLS) | 0] = TILE.Empty;
    }

    // Evitar que haya demasiados "event tiles" juntos
    if (row.filter(t => t === TILE.Shop).length > 1) {
      for (let x = 0; x < GAME.COLS; x++) if (row[x] === TILE.Shop && Math.random() < 0.7) row[x] = TILE.Empty;
    }
    if (row.filter(t => t === TILE.Chest).length > 1) {
      for (let x = 0; x < GAME.COLS; x++) if (row[x] === TILE.Chest && Math.random() < 0.7) row[x] = TILE.Empty;
    }

    return row;
  }

  function difficultyFromProgress(game) {
    // progresión suave por distancia + nivel
    const dist = (game.distance | 0);
    const lvl = (game.level | 0);
    const zone = Math.floor(dist / 60); // cada 60 pasos sube un "tier"
    const d = (zone * 0.18) + Math.min(0.8, (lvl - 1) * 0.03);
    return clamp(d, 0, 1.4);
  }

  // ───────────────────────── Render (canvas) ─────────────────────────
  function makeRenderer(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    ctx.imageSmoothingEnabled = false;

    const images = new Map();
    const spriteMap = new Map([
      [TILE.Block, "./assets/sprites/tile_block.svg"],
      [TILE.Trap, "./assets/sprites/tile_trap.svg"],
      [TILE.Coin, "./assets/sprites/tile_coin.svg"],
      [TILE.Gem, "./assets/sprites/tile_gem.svg"],
      [TILE.Bonus, "./assets/sprites/tile_bonus.svg"],
      // Shop/Chest/Key pueden no existir: dibujamos fallback
    ]);

    function loadSprites() {
      const promises = [];
      for (const [k, src] of spriteMap.entries()) {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        const p = new Promise((res) => {
          img.onload = () => res(true);
          img.onerror = () => res(false);
        });
        img.src = src;
        images.set(k, img);
        promises.push(p);
      }
      return Promise.all(promises);
    }

    function fit() {
      const baseW = Number(el.canvas.dataset.basew || canvas.width) || canvas.width;
      const baseH = Number(el.canvas.dataset.baseh || canvas.height) || canvas.height;
      canvas.width = baseW;
      canvas.height = baseH;
      ctx.imageSmoothingEnabled = false;
    }

    function draw(game) {
      const W = canvas.width;
      const H = canvas.height;

      // fondo
      ctx.fillStyle = "#07070c";
      ctx.fillRect(0, 0, W, H);

      const cols = GAME.COLS;
      const rows = GAME.ROWS;

      // tamaño de celda (cuadrada)
      const cell = Math.floor(Math.min(W / cols, H / rows));
      const gridW = cell * cols;
      const gridH = cell * rows;
      const ox = Math.floor((W - gridW) / 2);
      const oy = Math.floor((H - gridH) / 2);

      // grid lines (suaves)
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#2a2a34";
      ctx.lineWidth = 1;
      for (let x = 0; x <= cols; x++) {
        const px = ox + x * cell + 0.5;
        ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(px, oy + gridH); ctx.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        const py = oy + y * cell + 0.5;
        ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox + gridW, py); ctx.stroke();
      }
      ctx.restore();

      // tiles
      for (let y = 0; y < rows; y++) {
        const row = game.grid[y];
        for (let x = 0; x < cols; x++) {
          const t = row[x];
          const px = ox + x * cell;
          const py = oy + y * cell;

          // base tile shading
          ctx.fillStyle = "#0f0f16";
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

          if (t === TILE.Empty) continue;

          // sprites si existen
          const useSprite = state.options.sprites && images.get(t) && images.get(t).complete && images.get(t).naturalWidth > 0;
          if (useSprite) {
            ctx.drawImage(images.get(t), px + 2, py + 2, cell - 4, cell - 4);
          } else {
            // fallback
            drawTileFallback(t, px, py, cell);
          }
        }
      }

      // highlight player cell
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(ox + game.px * cell + 2, oy + game.py * cell + 2, cell - 4, cell - 4);
      ctx.restore();

      // player
      drawPlayer(game, ox, oy, cell);

      // fx: flash (daño)
      if (game.flash > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(game.flash, 0, 1) * 0.35;
        ctx.fillStyle = game.flashColor || "#ff3355";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    function drawTileFallback(t, x, y, s) {
      const pad = 6;
      const cx = x + s / 2;
      const cy = y + s / 2;

      // base
      ctx.save();
      ctx.globalAlpha = 0.92;

      if (t === TILE.Block) {
        ctx.fillStyle = "#2d2d36";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#0c0c10";
        ctx.fillRect(x + 10, y + 10, s - 20, s - 20);
        ctx.strokeStyle = "#ff4a4a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + s - 10, y + s - 10);
        ctx.stroke();
      } else if (t === TILE.Trap) {
        ctx.fillStyle = "#2a0f14";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#ff3355";
        ctx.beginPath();
        ctx.moveTo(cx, y + pad);
        ctx.lineTo(x + s - pad, y + s - pad);
        ctx.lineTo(x + pad, y + s - pad);
        ctx.closePath();
        ctx.fill();
      } else if (t === TILE.Coin) {
        ctx.fillStyle = "#1d1a08";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#ffd34a";
        ctx.beginPath();
        ctx.arc(cx, cy, (s * 0.28), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff2b0";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (t === TILE.Gem) {
        ctx.fillStyle = "#07131f";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#4ad0ff";
        ctx.beginPath();
        ctx.moveTo(cx, y + pad);
        ctx.lineTo(x + s - pad, cy);
        ctx.lineTo(cx, y + s - pad);
        ctx.lineTo(x + pad, cy);
        ctx.closePath();
        ctx.fill();
      } else if (t === TILE.Bonus) {
        ctx.fillStyle = "#13071f";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#d24aff";
        ctx.beginPath();
        ctx.arc(cx, cy, (s * 0.26), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.floor(s * 0.34)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", cx, cy + 1);
      } else if (t === TILE.Key) {
        ctx.fillStyle = "#10131a";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#ffd34a";
        ctx.beginPath();
        ctx.arc(x + s * 0.38, cy, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + s * 0.46, cy - s * 0.06, s * 0.32, s * 0.12);
        ctx.fillRect(x + s * 0.70, cy - s * 0.06, s * 0.05, s * 0.22);
        ctx.fillRect(x + s * 0.62, cy - s * 0.06, s * 0.05, s * 0.18);
      } else if (t === TILE.Chest) {
        ctx.fillStyle = "#14100a";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#a66b2a";
        ctx.fillRect(x + s*0.18, y + s*0.34, s*0.64, s*0.44);
        ctx.fillStyle = "#ffd34a";
        ctx.fillRect(x + s*0.18, y + s*0.50, s*0.64, s*0.08);
        ctx.fillRect(x + s*0.47, y + s*0.42, s*0.06, s*0.20);
      } else if (t === TILE.Shop) {
        ctx.fillStyle = "#0b1410";
        ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        ctx.fillStyle = "#35ff7a";
        ctx.fillRect(x + s*0.18, y + s*0.42, s*0.64, s*0.36);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + s*0.22, y + s*0.32, s*0.56, s*0.08);
        ctx.fillStyle = "#0b1410";
        ctx.fillRect(x + s*0.30, y + s*0.54, s*0.10, s*0.14);
      }

      ctx.restore();
    }

    function drawPlayer(game, ox, oy, cell) {
      const x = ox + game.px * cell;
      const y = oy + game.py * cell;

      // aura escudo
      if ((game.shields | 0) > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#4ad0ff";
        ctx.lineWidth = Math.max(2, Math.floor(cell * 0.06));
        ctx.beginPath();
        ctx.arc(x + cell/2, y + cell/2, cell*0.34, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // cuerpo
      ctx.save();
      ctx.fillStyle = "#e8e8ff";
      ctx.beginPath();
      ctx.arc(x + cell/2, y + cell/2, cell*0.22, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    return {
      ctx,
      loadSprites,
      fit,
      draw,
    };
  }

  // ───────────────────────── HUD / status ─────────────────────────
  function updateStatusHUD(game) {
    // top pills
    pillSet(el.pillScore, fmt(game.score));
    pillSet(el.pillLevel, `Lv ${game.level | 0}`);
    pillSet(el.pillMult, (Number(game.mult) || 1).toFixed(2));

    // best score pill
    const best = getBestScore(state.profile.id, state.mode, state.arcade.zone, state.arcade.stage);
    pillSet(el.pillBest, fmt(best));

    // hudFloat: corazones + buffs
    if (U.setHP) {
      try { U.setHP(game.hp | 0, game.hpMax | 0); } catch (_) {}
    } else if (el.hudFloat) {
      const hearts = [];
      const hp = clampInt(game.hp | 0, 0, game.hpMax | 0);
      const max = clampInt(game.hpMax | 0, 1, GAME.HP_CAP);
      for (let i = 0; i < max; i++) hearts.push(i < hp ? "♥" : "♡");
      el.hudFloat.textContent = `HP ${hearts.join("")}`;
    }

    // buffs (fallback)
    if (U.setBuffs) {
      const buffs = [];
      if ((game.shields | 0) > 0) buffs.push({ id: "sh", icon: "shield", label: `x${game.shields|0}` });
      if ((game.keys | 0) > 0) buffs.push({ id: "k", icon: "key", label: `x${game.keys|0}` });
      if ((game.rerolls | 0) > 0) buffs.push({ id: "r", icon: "casino", label: `x${game.rerolls|0}` });
      if ((game.magnet | 0) > 0 && (game.magnetTime || 0) > 0) buffs.push({ id: "m", icon: "compass_calibration", label: `${Math.ceil(game.magnetTime)}s` });
      try { U.setBuffs(buffs); } catch (_) {}
    } else if (el.hudFloat) {
      // ya pinta HP; no saturar
    }
  }

  // ───────────────────────── Progreso/level bar ─────────────────────────
  function updateLevelBar(game) {
    const need = game.xpNeed | 0;
    const xp = game.xp | 0;
    const pct = (need > 0) ? clamp(xp / need, 0, 1) : 0;

    setText(el.levelProgText, `Lv ${game.level|0} • ${xp}/${need}`);
    setText(el.levelProgPct, `${Math.round(pct * 100)}%`);
    if (el.levelProgFill) el.levelProgFill.style.width = `${Math.round(pct * 100)}%`;
  }

  // ───────────────────────── Combo ─────────────────────────
  const DIR = Object.freeze({ Up: "U", Down: "D", Left: "L", Right: "R" });

  function randDir() {
    const a = [DIR.Up, DIR.Left, DIR.Right]; // runner feel: no down en secuencia principal
    return a[(Math.random() * a.length) | 0];
  }

  function dirLabel(d) {
    if (d === DIR.Up) return "↑";
    if (d === DIR.Down) return "↓";
    if (d === DIR.Left) return "←";
    if (d === DIR.Right) return "→";
    return "•";
  }

  function newComboSeq(len = 4) {
    const s = [];
    for (let i = 0; i < len; i++) s.push(randDir());
    return s;
  }

  function renderCombo(game) {
    if (!el.comboSeq) return;
    const parts = [];
    for (let i = 0; i < game.comboSeq.length; i++) {
      const d = game.comboSeq[i];
      const done = i < game.comboIndex;
      parts.push(done ? `【${dirLabel(d)}】` : ` ${dirLabel(d)} `);
    }
    el.comboSeq.textContent = parts.join(" ");
    setText(el.comboTimerVal, (Math.max(0, game.comboTimer) || 0).toFixed(1));
  }

  function comboTimeMax(game) {
    return (GAME.BASE_COMBO_TIME + (Number(game.comboTimeBonus) || 0));
  }

  function comboOnMove(game, dir) {
    // si está en tienda/cofre/upgrades: no
    if (state.phase !== "playing") return;

    const tmax = comboTimeMax(game);
    const good = (dir === game.comboSeq[game.comboIndex]);
    if (!good || game.comboTimer <= 0) {
      // reset
      game.comboIndex = 0;
      game.comboSeq = newComboSeq(4);
      game.comboTimer = tmax;
      // pequeño castigo: bajar un pelín si estás alto
      if (game.mult > 1.0 && Math.random() < 0.25) game.mult = Math.max(1.0, game.mult - 0.05);
      renderCombo(game);
      return;
    }

    game.comboIndex++;
    game.comboTimer = tmax;

    if (game.comboIndex >= game.comboSeq.length) {
      // completar: sube mult
      game.comboIndex = 0;
      game.comboSeq = newComboSeq(4);
      const add = 0.10 + (Number(game.multAddBonus) || 0);
      game.mult = clamp(Number(game.mult) + add, 1.0, GAME.MULT_CAP);
      sfx("sfx_combo");
      toast(`Combo! Mult x${game.mult.toFixed(2)}`, 900);
      vib(20);
      renderCombo(game);
    } else {
      renderCombo(game);
    }
  }

  // ───────────────────────── Skills Pack integración ─────────────────────────
  function profileKey(prefix) {
    const pid = state.profile && state.profile.id ? state.profile.id : "local";
    return `${prefix}_${pid}`;
  }

  function loadPickedMap() {
    const raw = LS.jget(profileKey("gridrogue_picks_v1"), null);
    const m = new Map();
    if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) m.set(k, raw[k] | 0);
    }
    return m;
  }

  function savePickedMap(map) {
    const obj = {};
    for (const [k, v] of map.entries()) obj[k] = v | 0;
    LS.jset(profileKey("gridrogue_picks_v1"), obj);
  }

  function loadDiscoveredSet() {
    const raw = LS.jget(profileKey("gridrogue_disc_v1"), null);
    const s = new Set();
    if (Array.isArray(raw)) for (const x of raw) s.add(String(x));
    return s;
  }

  function saveDiscoveredSet(set) {
    LS.jset(profileKey("gridrogue_disc_v1"), Array.from(set));
  }

  function makeSkills(game) {
    const has = (typeof window !== "undefined" && window.GRSkills && typeof window.GRSkills.create === "function");
    if (!has) return null;

    const pickedCount = loadPickedMap();
    const discoveredSet = loadDiscoveredSet();

    const api = {
      // clamps
      clamp,
      clampInt,

      // stats (skills.js lee/escribe)
      HP_START: GAME.HP_START,
      HP_CAP: GAME.HP_CAP,

      hp: game.hp,
      hpMax: game.hpMax,

      shields: game.shields,
      shieldOnLevelUp: game.shieldOnLevelUp,

      blockResist: game.blockResist,

      regenEvery: game.regenEvery,
      regenAmount: game.regenAmount,

      revives: game.revives,

      magnet: game.magnet,
      magnetTime: game.magnetTime,

      trapResist: game.trapResist,
      trapHealChance: game.trapHealChance,

      zoneExtra: game.zoneExtra,

      scoreBoost: game.scoreBoost,
      coinValue: game.coinValue,
      gemValue: game.gemValue,
      bonusValue: game.bonusValue,
      stepScoreBonus: game.stepScoreBonus,

      mult: game.mult,
      comboTimeBonus: game.comboTimeBonus,

      rerolls: game.rerolls,
      extraUpgradeChoices: game.extraUpgradeChoices,

      keys: game.keys,

      shopDiscount: game.shopDiscount,
      shopPicks: game.shopPicks,

      chestLuck: game.chestLuck,
      chestPicks: game.chestPicks,

      // hooks
      recomputeZone() {
        game.moveRange = clampInt(1 + (game.zoneExtra | 0), 1, 4);
      },
      updateStatusHUD() {
        // sync back desde api (por si skills modificó api directamente)
        syncFromApiToGame(game, api);
        persistRunMeta(game);
        updateStatusHUD(game);
      },
      onDiscover(id) {
        try { saveDiscoveredSet(discoveredSet); } catch (_) {}
      },
      discoveredSet,
    };

    const skills = window.GRSkills.create(api, pickedCount);
    return { skills, api, pickedCount, discoveredSet };
  }

  function syncFromApiToGame(game, api) {
    // copiar campos relevantes
    game.hp = clampInt(api.hp | 0, 0, api.hpMax | 0);
    game.hpMax = clampInt(api.hpMax | 0, GAME.HP_START, GAME.HP_CAP);

    game.shields = api.shields | 0;
    game.shieldOnLevelUp = api.shieldOnLevelUp | 0;
    game.blockResist = api.blockResist | 0;

    game.regenEvery = api.regenEvery | 0;
    game.regenAmount = api.regenAmount | 0;

    game.revives = api.revives | 0;

    game.magnet = api.magnet | 0;
    game.magnetTime = Number(api.magnetTime) || 0;

    game.trapResist = api.trapResist | 0;
    game.trapHealChance = Number(api.trapHealChance) || 0;

    game.zoneExtra = api.zoneExtra | 0;
    game.moveRange = clampInt(1 + (game.zoneExtra | 0), 1, 4);

    game.scoreBoost = Number(api.scoreBoost) || 0;
    game.coinValue = api.coinValue | 0;
    game.gemValue = api.gemValue | 0;
    game.bonusValue = api.bonusValue | 0;
    game.stepScoreBonus = api.stepScoreBonus | 0;

    game.mult = clamp(Number(api.mult) || 1.0, 1.0, GAME.MULT_CAP);
    game.comboTimeBonus = Number(api.comboTimeBonus) || 0;

    game.rerolls = api.rerolls | 0;
    game.extraUpgradeChoices = api.extraUpgradeChoices | 0;

    game.keys = api.keys | 0;

    game.shopDiscount = api.shopDiscount | 0;
    game.shopPicks = clampInt(api.shopPicks | 0, 3, 7);

    game.chestLuck = api.chestLuck | 0;
    game.chestPicks = clampInt(api.chestPicks | 0, 3, 7);
  }

  function persistSkillsMeta(sk) {
    if (!sk) return;
    try { savePickedMap(sk.pickedCount); } catch (_) {}
    try { saveDiscoveredSet(sk.discoveredSet); } catch (_) {}
  }

  // ───────────────────────── Overlays extra (Shop/Chest/Catalog/Arcade select) ─────────────────────────
  function ensureExtraOverlays() {
    const host = el.canvasWrap || document.body;

    // Catalog
    if (!$("overlayCatalog")) {
      const sec = document.createElement("section");
      sec.className = "overlay";
      sec.id = "overlayCatalog";
      sec.hidden = true;
      sec.innerHTML = `
        <div class="panel wide">
          <div class="panelHead">
            <div>
              <div class="h2">Catálogo</div>
              <div class="muted tiny">Descubre y revisa tus skills.</div>
            </div>
            <button class="iconBtn small" id="btnCloseCatalog" type="button" title="Cerrar">
              <span class="ms" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="panelBody">
            <div class="tiny muted" id="catalogMeta"></div>
            <div class="catalogGrid" id="catalogGrid"></div>
          </div>
        </div>
      `;
      host.appendChild(sec);
    }

    // Shop
    if (!$("overlayShop")) {
      const sec = document.createElement("section");
      sec.className = "overlay";
      sec.id = "overlayShop";
      sec.hidden = true;
      sec.innerHTML = `
        <div class="panel wide">
          <div class="panelHead">
            <div>
              <div class="h2">Tienda</div>
              <div class="muted tiny">Compra skills con puntos.</div>
            </div>
            <button class="iconBtn small" id="btnCloseShop" type="button" title="Cerrar">
              <span class="ms" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="panelBody">
            <div class="tiny muted" id="shopMeta"></div>
            <div class="upgradeChoices" id="shopChoices"></div>
            <div class="tiny muted">Consejo: el descuento reduce precios. La oferta escala con el nivel.</div>
          </div>
          <div class="panelActions">
            <button class="btn" id="btnShopSkip" type="button">Salir</button>
          </div>
        </div>
      `;
      host.appendChild(sec);
    }

    // Chest
    if (!$("overlayChest")) {
      const sec = document.createElement("section");
      sec.className = "overlay";
      sec.id = "overlayChest";
      sec.hidden = true;
      sec.innerHTML = `
        <div class="panel wide">
          <div class="panelHead">
            <div>
              <div class="h2">Cofre</div>
              <div class="muted tiny">Gasta 1 llave para elegir un loot.</div>
            </div>
            <button class="iconBtn small" id="btnCloseChest" type="button" title="Cerrar">
              <span class="ms" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="panelBody">
            <div class="tiny muted" id="chestMeta"></div>
            <div class="upgradeChoices" id="chestChoices"></div>
          </div>
          <div class="panelActions">
            <button class="btn" id="btnChestSkip" type="button">Salir</button>
          </div>
        </div>
      `;
      host.appendChild(sec);
    }

    // Arcade selector (inyectado en overlayStart)
    if (el.overlayStart && !$("modeWrap")) {
      const form = el.overlayStart.querySelector(".form");
      const wrap = document.createElement("div");
      wrap.id = "modeWrap";
      wrap.className = "modeWrap";
      wrap.innerHTML = `
        <div class="optGroupTitle" style="margin-top:10px;">
          <span class="ms" aria-hidden="true">stadia_controller</span>
          <span>Modo</span>
        </div>
        <div class="row rowGap" style="align-items:center;">
          <label class="optRow" style="flex:1; display:flex; justify-content:space-between;">
            <span>Infinito</span>
            <input type="radio" name="modeRadio" id="modeInfinite" value="infinite" checked />
          </label>
          <label class="optRow" style="flex:1; display:flex; justify-content:space-between;">
            <span>Arcade</span>
            <input type="radio" name="modeRadio" id="modeArcade" value="arcade" />
          </label>
        </div>

        <div id="arcadeWrap" hidden>
          <div class="row rowGap" style="margin-top:8px;">
            <div style="flex:1;">
              <label class="label" for="arcadeZone">Zona (1-5)</label>
              <select id="arcadeZone" class="select"></select>
            </div>
            <div style="flex:1;">
              <label class="label" for="arcadeStage">Stage (1-20)</label>
              <select id="arcadeStage" class="select"></select>
            </div>
          </div>
          <div class="tiny muted" id="arcadeInfo" style="margin-top:6px;"></div>
        </div>
      `;
      // insertar antes del botón empezar
      const actions = form.querySelector(".panelActions");
      form.insertBefore(wrap, actions);
    }
  }

  // ───────────────────────── Profiles (Auth opcional) ─────────────────────────
  function loadProfiles() {
    // Si Auth existe, intenta usarlo, si no: fallback
    if (Auth && typeof Auth.listProfiles === "function") {
      try {
        const ps = Auth.listProfiles();
        if (Array.isArray(ps) && ps.length) return ps.map(p => ({ id: String(p.id), name: String(p.name || "Jugador") }));
      } catch (_) {}
    }

    const raw = LS.jget("gridrogue_profiles_v1", null);
    if (Array.isArray(raw) && raw.length) return raw.map(p => ({ id: String(p.id), name: String(p.name || "Jugador") }));

    const def = [{ id: "local", name: "Jugador" }];
    LS.jset("gridrogue_profiles_v1", def);
    return def;
  }

  function saveProfiles() {
    if (Auth && typeof Auth.saveProfiles === "function") {
      try { Auth.saveProfiles(state.profiles); return; } catch (_) {}
    }
    LS.jset("gridrogue_profiles_v1", state.profiles);
  }

  function setCurrentProfile(pid) {
    const p = state.profiles.find(x => x.id === pid) || state.profiles[0];
    state.profile = p || { id: "local", name: "Jugador" };
    LS.set("gridrogue_profile_current_v1", state.profile.id);
  }

  function initProfileUI() {
    if (!el.profileSelect) return;
    el.profileSelect.innerHTML = "";
    for (const p of state.profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      el.profileSelect.appendChild(opt);
    }

    const last = LS.get("gridrogue_profile_current_v1", state.profiles[0]?.id || "local");
    el.profileSelect.value = state.profiles.some(p => p.id === last) ? last : (state.profiles[0]?.id || "local");
    setCurrentProfile(el.profileSelect.value);

    el.profileSelect.addEventListener("change", () => {
      setCurrentProfile(el.profileSelect.value);
      updateStartMeta();
    }, { passive: true });

    if (el.btnNewProfile) {
      el.btnNewProfile.addEventListener("click", () => {
        if (!el.newProfileWrap) return;
        el.newProfileWrap.hidden = !el.newProfileWrap.hidden;
        if (!el.newProfileWrap.hidden && el.startName) el.startName.focus();
      });
    }

    if (el.startName) {
      el.startName.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          createProfileFromInput();
        }
      });
    }
  }

  function createProfileFromInput() {
    const name = String(el.startName ? el.startName.value : "").trim();
    if (name.length < 2) { toast("Nombre demasiado corto.", 1200); return; }

    const id = `p_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    state.profiles.push({ id, name: name.slice(0, 16) });
    saveProfiles();
    initProfileUI();
    el.profileSelect.value = id;
    setCurrentProfile(id);
    if (el.newProfileWrap) el.newProfileWrap.hidden = true;
    if (el.startName) el.startName.value = "";
    toast("Perfil creado.", 900);
  }

  // ───────────────────────── Best scores / arcade stars ─────────────────────────
  function bestKey(pid, mode, zone, stage) {
    if (mode === "arcade") return `gridrogue_best_${pid}_arcade_z${zone}_s${stage}`;
    return `gridrogue_best_${pid}_infinite`;
  }

  function getBestScore(pid, mode, zone, stage) {
    return Number(LS.get(bestKey(pid, mode, zone, stage), "0")) || 0;
  }

  function setBestScore(pid, mode, zone, stage, score) {
    const k = bestKey(pid, mode, zone, stage);
    const cur = Number(LS.get(k, "0")) || 0;
    if (score > cur) LS.set(k, String(Math.round(score)));
  }

  function arcadeStarsKey(pid, zone, stage) {
    return `gridrogue_arcade_stars_${pid}_z${zone}_s${stage}`;
  }

  function getStars(pid, zone, stage) {
    return clampInt(Number(LS.get(arcadeStarsKey(pid, zone, stage), "0")) || 0, 0, 3);
  }

  function setStars(pid, zone, stage, stars) {
    const cur = getStars(pid, zone, stage);
    if (stars > cur) LS.set(arcadeStarsKey(pid, zone, stage), String(stars));
  }

  function stageDistance(zone, stage) {
    // 5 zonas x 20 stages: distancia objetivo sube
    // zona 1 stage 1: ~70 ; zona 5 stage 20: ~220
    const z = clampInt(zone, 1, 5);
    const s = clampInt(stage, 1, 20);
    return Math.round(60 + (s - 1) * 6 + (z - 1) * 18);
  }

  function stageTargetScore(zone, stage) {
    // score objetivo aproximado por distancia y dificultad
    const d = stageDistance(zone, stage);
    const z = clampInt(zone, 1, 5);
    const base = d * (10 + z * 2);
    return Math.round(base);
  }

  function computeStars(score, target) {
    if (score >= target) return 3;
    if (score >= target * 0.80) return 2;
    if (score >= target * 0.60) return 1;
    return 0;
  }

  // ───────────────────────── Menú meta ─────────────────────────
  function updateStartMeta() {
    // modo pill
    setText(el.pressMeta, `Modo: ${state.mode === "arcade" ? "Arcade" : "Infinito"} • Perfil: ${state.profile.name}`);

    // arcade selector UI
    const modeInf = $("modeInfinite");
    const modeArc = $("modeArcade");
    const arcadeWrap = $("arcadeWrap");
    const arcadeZone = $("arcadeZone");
    const arcadeStage = $("arcadeStage");
    const arcadeInfo = $("arcadeInfo");

    if (modeInf && modeArc && arcadeWrap) {
      const setMode = (m) => {
        state.mode = m;
        arcadeWrap.hidden = (m !== "arcade");
        setText(el.pressMeta, `Modo: ${m === "arcade" ? "Arcade" : "Infinito"} • Perfil: ${state.profile.name}`);
      };

      modeInf.onchange = () => { if (modeInf.checked) setMode("infinite"); };
      modeArc.onchange = () => { if (modeArc.checked) setMode("arcade"); };

      // persist modo
      const lastMode = LS.get("gridrogue_last_mode_v1", "infinite");
      if (lastMode === "arcade") { modeArc.checked = true; setMode("arcade"); } else { modeInf.checked = true; setMode("infinite"); }

      if (arcadeZone && arcadeZone.options.length === 0) {
        for (let z = 1; z <= GAME.ARCADE_ZONES; z++) {
          const opt = document.createElement("option");
          opt.value = String(z);
          opt.textContent = `Zona ${z}`;
          arcadeZone.appendChild(opt);
        }
      }
      if (arcadeStage && arcadeStage.options.length === 0) {
        for (let s = 1; s <= GAME.ARCADE_STAGES_PER_ZONE; s++) {
          const opt = document.createElement("option");
          opt.value = String(s);
          opt.textContent = `Stage ${s}`;
          arcadeStage.appendChild(opt);
        }
      }

      // cargar última selección
      state.arcade.zone = clampInt(Number(LS.get("gridrogue_last_arcade_zone_v1", "1")) || 1, 1, 5);
      state.arcade.stage = clampInt(Number(LS.get("gridrogue_last_arcade_stage_v1", "1")) || 1, 1, 20);
      arcadeZone.value = String(state.arcade.zone);
      arcadeStage.value = String(state.arcade.stage);

      const refreshInfo = () => {
        const z = clampInt(Number(arcadeZone.value) || 1, 1, 5);
        const s = clampInt(Number(arcadeStage.value) || 1, 1, 20);
        state.arcade.zone = z;
        state.arcade.stage = s;
        LS.set("gridrogue_last_arcade_zone_v1", String(z));
        LS.set("gridrogue_last_arcade_stage_v1", String(s));

        const dist = stageDistance(z, s);
        const target = stageTargetScore(z, s);
        const stars = getStars(state.profile.id, z, s);
        if (arcadeInfo) arcadeInfo.textContent = `Objetivo: ${dist} pasos • 3★ ≈ ${target} puntos • Récord: ${fmt(getBestScore(state.profile.id, "arcade", z, s))} • Stars: ${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
      };

      arcadeZone.onchange = refreshInfo;
      arcadeStage.onchange = refreshInfo;
      refreshInfo();
    }
  }

  // ───────────────────────── Crear run ─────────────────────────
  function newGame() {
    const grid = [];
    for (let y = 0; y < GAME.ROWS; y++) grid.push(new Array(GAME.COLS).fill(TILE.Empty));

    const game = {
      // grid
      grid,
      px: (GAME.COLS / 2) | 0,
      py: GAME.SAFE_PLAYER_Y,

      // run
      distance: 0,
      score: 0,
      pickups: { coin: 0, gem: 0, bonus: 0, key: 0, chest: 0, shop: 0, trap: 0, block: 0 },
      startedAt: Date.now(),

      // stats / skills
      hp: GAME.HP_START,
      hpMax: GAME.HP_START,

      shields: 0,
      shieldOnLevelUp: 0,
      blockResist: 0,

      regenEvery: 0,
      regenAmount: 0,
      revives: 0,

      magnet: 0,
      magnetTime: 0,

      trapResist: 0,
      trapHealChance: 0,

      zoneExtra: 0,
      moveRange: 1,

      scoreBoost: 0,
      coinValue: 2,
      gemValue: 10,
      bonusValue: 20,
      stepScoreBonus: 0,

      mult: 1.0,
      multAddBonus: 0,
      comboTimeBonus: 0,

      rerolls: 0,
      extraUpgradeChoices: 0,

      keys: 0,
      shopDiscount: 0,
      shopPicks: 3,

      chestLuck: 0,
      chestPicks: 3,

      // xp/level
      level: 1,
      xp: 0,
      xpNeed: 220,

      // combo
      comboSeq: newComboSeq(4),
      comboIndex: 0,
      comboTimer: comboTimeMax({ comboTimeBonus: 0 }),
      comboStreak: 0,

      // fx
      flash: 0,
      flashColor: "#ff3355",

      // status
      dead: false,
      win: false,
      paused: false,

      // skills runtime
      sk: null,
      lastMagnetPull: 0,
      stepsSinceRegen: 0,
    };

    // generar mapa inicial
    for (let y = 0; y < GAME.ROWS; y++) {
      const d = difficultyFromProgress(game);
      game.grid[y] = generateRow(game, d);
    }

    // asegurar spawn tile vacío
    game.grid[game.py][game.px] = TILE.Empty;

    // skills
    game.sk = makeSkills(game);
    if (game.sk) {
      // sync inicial
      syncFromApiToGame(game, game.sk.api);
      game.sk.api.recomputeZone?.();
    }

    // arcade target
    if (state.mode === "arcade") {
      game.arcadeTargetDist = stageDistance(state.arcade.zone, state.arcade.stage);
      game.arcadeTargetScore = stageTargetScore(state.arcade.zone, state.arcade.stage);
    } else {
      game.arcadeTargetDist = 0;
      game.arcadeTargetScore = 0;
    }

    return game;
  }

  function xpNeedForLevel(level, zoneMul = 1.0) {
    const l = clampInt(level | 0, 1, 999);
    const base = 220 + (l - 1) * 85;
    return Math.round(base * zoneMul);
  }

  function arcadeZoneMul() {
    if (state.mode !== "arcade") return 1.0;
    return 1.0 + (clampInt(state.arcade.zone, 1, 5) - 1) * 0.18;
  }

  function persistRunMeta(game) {
    // persist mode
    LS.set("gridrogue_last_mode_v1", state.mode);
  }

  // ───────────────────────── Mecánicas (apply tiles) ─────────────────────────
  function addScore(game, base, reason = "") {
    const boost = 1.0 + (Number(game.scoreBoost) || 0);
    const v = Math.round((Number(base) || 0) * boost * (Number(game.mult) || 1));
    game.score += v;
    if (reason) { /* noop */ }
    pillSet(el.pillScore, fmt(game.score));
    return v;
  }

  function gainXP(game, amount) {
    game.xp += (amount | 0);
    if (game.xp >= game.xpNeed) {
      // puede subir varios niveles si va sobrado
      while (game.xp >= game.xpNeed) {
        game.xp -= game.xpNeed;
        game.level++;
        // bonus por nivel: escudo por skill pasiva
        if ((game.shieldOnLevelUp | 0) > 0) game.shields += (game.shieldOnLevelUp | 0);
        sfx("sfx_levelup");
        openUpgrades(game);
        game.xpNeed = xpNeedForLevel(game.level, arcadeZoneMul());
      }
    }
    updateLevelBar(game);
    updateStatusHUD(game);
  }

  function heal(game, amt) {
    const a = amt | 0;
    if (a <= 0) return;
    const before = game.hp | 0;
    game.hp = clampInt((game.hp | 0) + a, 0, game.hpMax | 0);
    if (game.hp > before) {
      game.flash = 0.45;
      game.flashColor = "#35ff7a";
      updateStatusHUD(game);
    }
  }

  function damage(game, amt, color = "#ff3355") {
    const a = amt | 0;
    if (a <= 0) return;
    game.hp = clampInt((game.hp | 0) - a, 0, game.hpMax | 0);
    game.flash = 0.55;
    game.flashColor = color;
    updateStatusHUD(game);
    if ((game.hp | 0) <= 0) {
      if ((game.revives | 0) > 0) {
        game.revives--;
        game.hp = 1;
        toast("¡Fénix! Revives con 1♥", 1200);
        sfx("sfx_pick");
        updateStatusHUD(game);
      } else {
        gameOver(game);
      }
    }
  }

  function applyTrapHit(game) {
    game.pickups.trap++;

    // resist chance
    const resistStacks = clampInt(game.trapResist | 0, 0, 12);
    const resistChance = clamp(resistStacks * 0.08, 0, 0.70);
    if (Math.random() < resistChance) {
      toast("Trampa resistida", 700);
      sfx("sfx_pick");
      vib(10);
      return;
    }

    sfx("sfx_trap");
    vib(25);
    damage(game, 1, "#ff3355");

    // heal chance (después)
    const hc = clamp(Number(game.trapHealChance) || 0, 0, 0.95);
    if (hc > 0 && Math.random() < hc) {
      heal(game, 1);
      toast("Sangre fría: +1♥", 800);
    }
  }

  function applyBlock(game) {
    game.pickups.block++;

    if ((game.shields | 0) > 0) {
      game.shields--;
      sfx("sfx_ko");
      toast("Escudo bloquea KO", 800);
      vib(12);
      updateStatusHUD(game);
      return;
    }

    // blockResist: en vez de KO pierdes 2♥ (consume 1)
    if ((game.blockResist | 0) > 0) {
      game.blockResist--;
      toast("Anti-KO: -2♥", 900);
      sfx("sfx_ko");
      vib(18);
      damage(game, 2, "#ff4a4a");
      updateStatusHUD(game);
      return;
    }

    sfx("sfx_ko");
    vib(30);
    gameOver(game);
  }

  function applyPickup(game, t) {
    if (t === TILE.Coin) {
      game.pickups.coin++;
      const v = addScore(game, game.coinValue | 0, "coin");
      sfx("sfx_coin");
      gainXP(game, 12);
      return v;
    }
    if (t === TILE.Gem) {
      game.pickups.gem++;
      const v = addScore(game, game.gemValue | 0, "gem");
      sfx("sfx_gem");
      gainXP(game, 18);
      return v;
    }
    if (t === TILE.Bonus) {
      game.pickups.bonus++;
      const v = addScore(game, game.bonusValue | 0, "bonus");
      sfx("sfx_bonus");
      gainXP(game, 25);
      return v;
    }
    return 0;
  }

  // ───────────────────────── Movimiento (runner) ─────────────────────────
  function canMove(game, dx, dy) {
    if (game.dead || game.win) return false;
    if (state.phase !== "playing") return false;

    // runner: bloquea bajar (dy > 0)
    if (dy > 0) return false;

    const nx = game.px + dx;
    const ny = game.py + dy;
    if (nx < 0 || nx >= GAME.COLS) return false;
    if (ny < 0 || ny >= GAME.ROWS) return false;
    return true;
  }

  function doMove(game, dir) {
    if (dir === DIR.Down) return false;

    const range = clampInt(game.moveRange | 0, 1, 4);
    let dx = 0, dy = 0;
    if (dir === DIR.Left) dx = -1;
    else if (dir === DIR.Right) dx = +1;
    else if (dir === DIR.Up) dy = -1;

    // mover hasta range, pero detenerse en borde
    for (let step = 0; step < range; step++) {
      if (!canMove(game, dx, dy)) break;

      game.px += dx;
      game.py += dy;

      // step base score/xp
      if ((game.stepScoreBonus | 0) > 0) game.score += (game.stepScoreBonus | 0);
      gainXP(game, GAME.BASE_STEP_XP);

      // combo check
      comboOnMove(game, dir);

      // tile effect
      const t = game.grid[game.py][game.px];
      resolveTile(game, t);

      // limpiar tile para que no se repita al volver a pisar
      game.grid[game.py][game.px] = TILE.Empty;

      // regen por pasos
      if ((game.regenEvery | 0) > 0 && (game.regenAmount | 0) > 0) {
        game.stepsSinceRegen++;
        if (game.stepsSinceRegen >= (game.regenEvery | 0)) {
          game.stepsSinceRegen = 0;
          if ((game.hp | 0) < (game.hpMax | 0)) {
            heal(game, game.regenAmount | 0);
            toast(`Regeneración +${game.regenAmount|0}♥`, 750);
          }
        }
      }

      // magnet tick (tiempo)
      // (se descuenta en loop con dt)
      updateStatusHUD(game);

      // runner shift si sube demasiado
      if (game.py <= GAME.SHIFT_THRESHOLD_Y) {
        shiftWorldDown(game, 1);
      }

      // arcade win?
      if (state.mode === "arcade") {
        if ((game.distance | 0) >= (game.arcadeTargetDist | 0)) {
          // fin por objetivo de distancia
          stageClear(game);
          return true;
        }
      }

      if (game.dead) return true;
    }
    return true;
  }

  function shiftWorldDown(game, rowsToShift) {
    const n = clampInt(rowsToShift | 0, 1, 4);

    for (let i = 0; i < n; i++) {
      // eliminar última fila
      game.grid.pop();

      // insertar nueva arriba
      const d = difficultyFromProgress(game);
      game.grid.unshift(generateRow(game, d));

      // el jugador baja 1 porque todo bajó
      game.py++;

      // progreso
      game.distance++;
    }

    // evitar salir de límites
    game.py = clampInt(game.py, 0, GAME.ROWS - 1);

    // asegurar spawn no-block directo (pequeño “fairness”)
    const py = game.py;
    const px = game.px;
    if (game.grid[py][px] === TILE.Block) game.grid[py][px] = TILE.Empty;

    // magnet auto pull ocasional
    if ((game.magnet | 0) > 0 && (game.magnetTime || 0) > 0) magnetPull(game);

    updateStatusHUD(game);
  }

  function magnetRadius(game) {
    const m = clampInt(game.magnet | 0, 0, 3);
    return m; // 1..3
  }

  function magnetPull(game) {
    const r = magnetRadius(game);
    if (r <= 0) return;

    const px = game.px, py = game.py;
    let pulled = 0;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || x >= GAME.COLS || y < 0 || y >= GAME.ROWS) continue;
        const t = game.grid[y][x];
        if (tileIsPickup(t)) {
          applyPickup(game, t);
          game.grid[y][x] = TILE.Empty;
          pulled++;
        }
      }
    }

    if (pulled > 0) {
      toast(`Imán: +${pulled} loot`, 650);
      sfx("sfx_pick");
      vib(10);
    }
  }

  function resolveTile(game, t) {
    if (t === TILE.Empty) return;

    if (t === TILE.Trap) { applyTrapHit(game); return; }
    if (t === TILE.Block) { applyBlock(game); return; }

    if (t === TILE.Key) {
      game.pickups.key++;
      game.keys++;
      sfx("sfx_pick");
      toast("Llave +1", 700);
      updateStatusHUD(game);
      return;
    }

    if (t === TILE.Shop) {
      game.pickups.shop++;
      openShop(game);
      return;
    }

    if (t === TILE.Chest) {
      game.pickups.chest++;
      if ((game.keys | 0) <= 0) {
        toast("Necesitas 1 llave", 900);
        sfx("sfx_ui_click");
        return;
      }
      // gasta llave al abrir
      game.keys--;
      updateStatusHUD(game);
      openChest(game);
      return;
    }

    if (tileIsPickup(t)) {
      applyPickup(game, t);
      return;
    }
  }

  // ───────────────────────── Upgrades (LevelUp) ─────────────────────────
  function openUpgrades(game) {
    if (!el.overlayUpgrades) return;
    state.phase = "upgrades";
    show(el.overlayUpgrades);
    hide(el.overlayPaused);
    hide(el.overlayOptions);
    hide($("overlayShop"));
    hide($("overlayChest"));

    // generar choices
    const sk = game.sk;
    const n = clampInt(3 + (game.extraUpgradeChoices | 0), 3, 6);

    let choices = [];
    if (sk && sk.skills) {
      choices = sk.skills.chooseLevelUp({ level: game.level | 0, n });
    } else {
      choices = fallbackUpgrades(game, n);
    }

    renderUpgradeCards(game, choices, "levelup");
    updateUpgradeButtons(game);
  }

  function updateUpgradeButtons(game) {
    if (el.btnReroll) {
      el.btnReroll.disabled = (game.rerolls | 0) <= 0;
      setText(el.btnReroll, `Reroll${(game.rerolls|0)>0 ? ` (${game.rerolls|0})` : ""}`);
    }
    if (el.btnSkipUpgrade) el.btnSkipUpgrade.disabled = false;
  }

  function fallbackUpgrades(game, n) {
    // fallback mínimo si skills.js no está
    const pool = [
      { id:"shield_1", name:"Escudo +1", desc:"Ganas 1 escudo.", rarity:"common", icon:"shield", apply(){ game.shields++; } },
      { id:"heart_1", name:"Corazón +1", desc:"+1 vida max y curas +1.", rarity:"common", icon:"favorite", apply(){ game.hpMax = clampInt(game.hpMax+1, GAME.HP_START, GAME.HP_CAP); heal(game,1); } },
      { id:"coin_1", name:"Moneda +", desc:"+2 valor moneda.", rarity:"common", icon:"paid", apply(){ game.coinValue += 2; } },
      { id:"gem_1", name:"Gema +", desc:"+6 valor gema.", rarity:"rare", icon:"diamond", apply(){ game.gemValue += 6; } },
      { id:"reroll_1", name:"Reroll", desc:"+1 reroll.", rarity:"rare", icon:"casino", apply(){ game.rerolls++; } },
      { id:"key_1", name:"Llave +1", desc:"+1 llave.", rarity:"common", icon:"key", apply(){ game.keys++; } },
    ];
    const out = [];
    const p = pool.slice();
    for (let i = 0; i < n; i++) {
      if (!p.length) break;
      out.push(p.splice((Math.random()*p.length)|0, 1)[0]);
    }
    return out;
  }

  function renderUpgradeCards(game, choices, kind) {
    const host =
      (kind === "shop") ? $("shopChoices") :
      (kind === "chest") ? $("chestChoices") :
      el.upgradeChoices;

    if (!host) return;
    host.innerHTML = "";

    const sk = game.sk;

    for (const u of (choices || [])) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "upgradeCard";
      card.setAttribute("data-id", String(u.id || ""));

      const icon = (u.icon || (sk && sk.skills && sk.skills.upgradeIcon ? sk.skills.upgradeIcon(u) : "upgrade"));
      const rarity = String(u.rarity || "common");
      const title = String(u.name || "Mejora");
      const desc = String(u.desc || "");

      let priceTxt = "";
      let canAfford = true;

      if (kind === "shop" && sk && sk.skills && typeof sk.skills.price === "function") {
        const price = sk.skills.price(u, game.level|0);
        priceTxt = ` • ${price} pts`;
        canAfford = (game.score | 0) >= price;
      }

      card.innerHTML = `
        <div class="uTop">
          <span class="ms uIcon" aria-hidden="true">${icon}</span>
          <div class="uText">
            <div class="uTitle">${escapeHtml(title)}<span class="uMeta"> • ${rarity}${escapeHtml(priceTxt)}</span></div>
            <div class="uDesc">${escapeHtml(desc)}</div>
          </div>
        </div>
      `;

      if (kind === "shop" && !canAfford) card.classList.add("disabled");

      card.addEventListener("click", () => {
        if (kind === "shop") {
          if (!canAfford) { toast("No tienes puntos suficientes.", 900); sfx("sfx_ui_click"); return; }
          buyInShop(game, u);
          return;
        }
        if (kind === "chest") {
          pickFromChest(game, u);
          return;
        }
        pickUpgrade(game, u);
      });

      host.appendChild(card);
    }
  }

  function escapeHtml(s) {
    s = String(s ?? "");
    return s.replace(/[&<>"']/g, (c) => (
      c === "&" ? "&amp;" :
      c === "<" ? "&lt;" :
      c === ">" ? "&gt;" :
      c === '"' ? "&quot;" : "&#039;"
    ));
  }

  function pickUpgrade(game, u) {
    const sk = game.sk;
    sfx("sfx_pick");

    if (sk && sk.skills && typeof sk.skills.pick === "function") {
      sk.skills.pick(u);
      persistSkillsMeta(sk);
      syncFromApiToGame(game, sk.api);
      savePickedMap(sk.pickedCount);
      saveDiscoveredSet(sk.discoveredSet);
    } else {
      try { u.apply && u.apply(); } catch (_) {}
    }

    closeUpgrades(game);
  }

  function closeUpgrades(game) {
    hide(el.overlayUpgrades);
    state.phase = "playing";
    updateStatusHUD(game);
    updateLevelBar(game);
    renderCombo(game);
  }

  function rerollUpgrades(game) {
    if ((game.rerolls | 0) <= 0) { sfx("sfx_ui_click"); return; }
    game.rerolls--;
    sfx("sfx_reroll");

    const sk = game.sk;
    const n = clampInt(3 + (game.extraUpgradeChoices | 0), 3, 6);

    let choices = [];
    if (sk && sk.skills) {
      choices = sk.skills.chooseLevelUp({ level: game.level | 0, n });
      persistSkillsMeta(sk);
    } else {
      choices = fallbackUpgrades(game, n);
    }

    renderUpgradeCards(game, choices, "levelup");
    updateUpgradeButtons(game);
    updateStatusHUD(game);
  }

  // ───────────────────────── Shop ─────────────────────────
  function openShop(game) {
    const ov = $("overlayShop");
    if (!ov) return;

    state.phase = "shop";
    show(ov);

    // meta
    const meta = $("shopMeta");
    if (meta) meta.textContent = `Nivel ${game.level|0} • Puntos: ${fmt(game.score)} • Descuento: ${(game.shopDiscount|0)*6}%`;

    const sk = game.sk;
    const n = clampInt(game.shopPicks | 0, 3, 7);
    let offers = [];

    if (sk && sk.skills) {
      offers = sk.skills.chooseShop({ level: game.level | 0, n });
    } else {
      offers = fallbackUpgrades(game, n);
    }

    renderUpgradeCards(game, offers, "shop");
    updateStatusHUD(game);
  }

  function closeShop(game) {
    hide($("overlayShop"));
    state.phase = "playing";
    updateStatusHUD(game);
  }

  function buyInShop(game, u) {
    const sk = game.sk;
    if (!sk || !sk.skills || typeof sk.skills.price !== "function" || typeof sk.skills.pick !== "function") {
      // fallback: compra gratis
      try { u.apply && u.apply(); } catch (_) {}
      sfx("sfx_pick");
      toast("Comprado.", 700);
      closeShop(game);
      return;
    }

    const price = sk.skills.price(u, game.level|0);
    if ((game.score | 0) < price) { toast("No tienes puntos.", 900); return; }

    game.score -= price;
    pillSet(el.pillScore, fmt(game.score));

    sk.skills.pick(u);
    persistSkillsMeta(sk);
    syncFromApiToGame(game, sk.api);
    savePickedMap(sk.pickedCount);
    saveDiscoveredSet(sk.discoveredSet);

    sfx("sfx_pick");
    toast("Comprado.", 700);
    closeShop(game);
  }

  // ───────────────────────── Chest ─────────────────────────
  function openChest(game) {
    const ov = $("overlayChest");
    if (!ov) return;

    state.phase = "chest";
    show(ov);

    const meta = $("chestMeta");
    if (meta) meta.textContent = `Nivel ${game.level|0} • Llaves: ${game.keys|0} • Suerte: ${game.chestLuck|0}`;

    const sk = game.sk;
    const n = clampInt(game.chestPicks | 0, 3, 7);
    let loot = [];

    if (sk && sk.skills) {
      loot = sk.skills.chooseChest({ level: game.level | 0, n });
    } else {
      loot = fallbackUpgrades(game, n);
    }

    renderUpgradeCards(game, loot, "chest");
    updateStatusHUD(game);
  }

  function closeChest(game) {
    hide($("overlayChest"));
    state.phase = "playing";
    updateStatusHUD(game);
  }

  function pickFromChest(game, u) {
    const sk = game.sk;
    sfx("sfx_pick");

    if (sk && sk.skills && typeof sk.skills.pick === "function") {
      sk.skills.pick(u);
      persistSkillsMeta(sk);
      syncFromApiToGame(game, sk.api);
      savePickedMap(sk.pickedCount);
      saveDiscoveredSet(sk.discoveredSet);
    } else {
      try { u.apply && u.apply(); } catch (_) {}
    }

    toast("Loot obtenido.", 750);
    closeChest(game);
  }

  // ───────────────────────── Catálogo ─────────────────────────
  function openCatalog(game) {
    const ov = $("overlayCatalog");
    if (!ov) return;

    state.prevPhaseBeforeCatalog = state.phase;
    state.phase = "catalog";
    show(ov);

    const meta = $("catalogMeta");
    const grid = $("catalogGrid");
    if (!grid) return;

    const sk = game && game.sk ? game.sk : (state.game && state.game.sk ? state.game.sk : null);
    if (!sk || !sk.skills || typeof sk.skills.getCatalog !== "function") {
      if (meta) meta.textContent = "No hay skills.js cargado.";
      grid.innerHTML = "";
      return;
    }

    const all = sk.skills.getCatalog({ discoveredOnly: false });
    const discCount = all.filter(x => x.discovered).length;

    if (meta) meta.textContent = `Descubiertas: ${discCount}/${all.length} • Perfil: ${state.profile.name}`;

    grid.innerHTML = "";
    for (const it of all) {
      const item = document.createElement("div");
      item.className = "catalogItem" + (it.discovered ? "" : " locked");
      item.innerHTML = `
        <div class="cTop">
          <span class="ms cIcon" aria-hidden="true">${escapeHtml(it.icon || "upgrade")}</span>
          <div class="cTitle">${escapeHtml(it.name || it.id || "???")}</div>
        </div>
        <div class="cDesc">${escapeHtml(it.desc || "")}</div>
        <div class="cMeta tiny muted">${it.rarity} • picked ${it.picked|0}${it.secret ? " • secret" : ""}</div>
      `;
      grid.appendChild(item);
    }
  }

  function closeCatalog() {
    hide($("overlayCatalog"));
    state.phase = state.prevPhaseBeforeCatalog || "playing";
  }

  // ───────────────────────── Game Over / Stage Clear ─────────────────────────
  function stageClear(game) {
    if (game.dead) return;
    game.win = true;
    state.phase = "gameover";
    show(el.overlayGameOver);

    const score = game.score | 0;
    const best = getBestScore(state.profile.id, "arcade", state.arcade.zone, state.arcade.stage);
    setBestScore(state.profile.id, "arcade", state.arcade.zone, state.arcade.stage, score);

    const target = game.arcadeTargetScore | 0;
    const stars = computeStars(score, target);
    setStars(state.profile.id, state.arcade.zone, state.arcade.stage, stars);

    setText(el.goScoreBig, fmt(score));
    setText(el.goBestBig, fmt(Math.max(best, score)));

    const st = $("goStats");
    if (st) {
      st.innerHTML = `
        <div class="statRow"><span>RESULTADO</span><span><b>STAGE CLEAR</b> • ${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span></div>
        <div class="statRow"><span>Zona/Stage</span><span>${state.arcade.zone}-${state.arcade.stage}</span></div>
        <div class="statRow"><span>Objetivo</span><span>${fmt(target)} pts • ${game.arcadeTargetDist|0} pasos</span></div>
        <div class="statRow"><span>Distancia</span><span>${game.distance|0}</span></div>
        <div class="statRow"><span>Nivel</span><span>${game.level|0}</span></div>
        <div class="statRow"><span>Monedas</span><span>${game.pickups.coin|0}</span></div>
        <div class="statRow"><span>Gemas</span><span>${game.pickups.gem|0}</span></div>
        <div class="statRow"><span>Bonus</span><span>${game.pickups.bonus|0}</span></div>
      `;
    }

    stopRunLoop();
  }

  function gameOver(game) {
    if (game.dead) return;
    game.dead = true;

    sfx("sfx_gameover");
    state.phase = "gameover";
    show(el.overlayGameOver);

    const score = game.score | 0;

    if (state.mode === "arcade") {
      setBestScore(state.profile.id, "arcade", state.arcade.zone, state.arcade.stage, score);
    } else {
      setBestScore(state.profile.id, "infinite", 0, 0, score);
    }

    const best = getBestScore(state.profile.id, state.mode, state.arcade.zone, state.arcade.stage);

    setText(el.goScoreBig, fmt(score));
    setText(el.goBestBig, fmt(best));

    const st = el.goStats;
    if (st) {
      st.innerHTML = `
        <div class="statRow"><span>Modo</span><span>${state.mode === "arcade" ? `Arcade ${state.arcade.zone}-${state.arcade.stage}` : "Infinito"}</span></div>
        <div class="statRow"><span>Distancia</span><span>${game.distance|0}</span></div>
        <div class="statRow"><span>Nivel</span><span>${game.level|0}</span></div>
        <div class="statRow"><span>Monedas</span><span>${game.pickups.coin|0}</span></div>
        <div class="statRow"><span>Gemas</span><span>${game.pickups.gem|0}</span></div>
        <div class="statRow"><span>Bonus</span><span>${game.pickups.bonus|0}</span></div>
        <div class="statRow"><span>Llaves</span><span>${game.pickups.key|0}</span></div>
        <div class="statRow"><span>Cofres</span><span>${game.pickups.chest|0}</span></div>
        <div class="statRow"><span>Tiendas</span><span>${game.pickups.shop|0}</span></div>
      `;
    }

    stopRunLoop();
  }

  // ───────────────────────── Loop / timing ─────────────────────────
  let renderer = null;

  function startRunLoop() {
    if (state.running) return;
    state.running = true;
    state.lastTs = now();
    state.raf = requestAnimationFrame(tick);
  }

  function stopRunLoop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function tick(ts) {
    if (!state.running) return;
    const game = state.game;
    if (!game) { state.running = false; return; }

    const dt = Math.min(0.05, Math.max(0.001, (ts - state.lastTs) / 1000));
    state.lastTs = ts;

    // timers
    if (state.phase === "playing") {
      game.comboTimer -= dt;
      if (game.comboTimer < 0) game.comboTimer = 0;

      if ((game.magnetTime || 0) > 0 && (game.magnet | 0) > 0) {
        game.magnetTime = Math.max(0, Number(game.magnetTime) - dt);
        if (game.magnetTime === 0) {
          toast("Imán terminado", 800);
        }
      }

      // FX
      game.flash = Math.max(0, game.flash - dt * 1.5);

      renderCombo(game);
    } else {
      // FX igualmente
      game.flash = Math.max(0, game.flash - dt * 1.5);
    }

    // draw
    try { renderer && renderer.draw(game); } catch (e) { fatal(e); return; }

    state.raf = requestAnimationFrame(tick);
  }

  // ───────────────────────── Input ─────────────────────────
  function bindInput() {
    // teclado
    window.addEventListener("keydown", (e) => {
      if (state.phase === "press" || state.phase === "menu") {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          if (state.phase === "press") onPressStart();
        }
        return;
      }

      if (state.phase === "gameover") {
        if (e.key === "Enter") { e.preventDefault(); retry(); }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (state.phase === "playing") openOptions();
        else if (state.phase === "options") closeOptions();
        return;
      }

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePause();
        return;
      }

      const game = state.game;
      if (!game) return;

      if (state.phase === "upgrades") {
        if (e.key === "r" || e.key === "R") rerollUpgrades(game);
        if (e.key === "Enter") { /* no auto */ }
        return;
      }

      if (state.phase === "shop" || state.phase === "chest" || state.phase === "catalog") return;
      if (state.phase !== "playing") return;

      let dir = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = DIR.Up;
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = DIR.Left;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = DIR.Right;
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = DIR.Down;

      if (dir) {
        e.preventDefault();
        doMove(game, dir);
      }
    });

    // dpad
    if (el.btnUp) el.btnUp.addEventListener("click", () => state.game && doMove(state.game, DIR.Up));
    if (el.btnLeft) el.btnLeft.addEventListener("click", () => state.game && doMove(state.game, DIR.Left));
    if (el.btnRight) el.btnRight.addEventListener("click", () => state.game && doMove(state.game, DIR.Right));
    if (el.btnDown) el.btnDown.addEventListener("click", () => state.game && doMove(state.game, DIR.Down));

    // swipe simple
    let touchStartX = 0, touchStartY = 0, touchActive = false;

    const onTouchStart = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (!touchActive) return;
      touchActive = false;

      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;

      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < 22) return;

      let dir = null;
      if (ax > ay) dir = dx > 0 ? DIR.Right : DIR.Left;
      else dir = dy > 0 ? DIR.Down : DIR.Up;

      if (state.phase === "press") { onPressStart(); return; }
      if (state.phase === "playing" && state.game) doMove(state.game, dir);
    };

    if (el.canvasWrap) {
      el.canvasWrap.addEventListener("touchstart", onTouchStart, { passive: true });
      el.canvasWrap.addEventListener("touchend", onTouchEnd, { passive: true });
    }

    // botones UI
    if (el.btnPause) el.btnPause.addEventListener("click", () => togglePause());
    if (el.btnOptions) el.btnOptions.addEventListener("click", () => openOptions());

    if (el.btnResume) el.btnResume.addEventListener("click", () => resume());
    if (el.btnPausedRestart) el.btnPausedRestart.addEventListener("click", () => retry());
    if (el.btnQuitToStart) el.btnQuitToStart.addEventListener("click", () => goToMenu());

    if (el.btnReroll) el.btnReroll.addEventListener("click", () => state.game && rerollUpgrades(state.game));
    if (el.btnSkipUpgrade) el.btnSkipUpgrade.addEventListener("click", () => state.game && closeUpgrades(state.game));

    if (el.btnBackToStart) el.btnBackToStart.addEventListener("click", () => goToMenu());
    if (el.btnRetry) el.btnRetry.addEventListener("click", () => retry());

    if (el.btnCloseOptions) el.btnCloseOptions.addEventListener("click", () => closeOptions());

    // extra overlay buttons
    const btnCloseShop = () => $("btnCloseShop");
    const btnShopSkip = () => $("btnShopSkip");
    const btnCloseChest = () => $("btnCloseChest");
    const btnChestSkip = () => $("btnChestSkip");
    const btnCloseCatalog = () => $("btnCloseCatalog");

    setTimeout(() => {
      btnCloseShop()?.addEventListener("click", () => state.game && closeShop(state.game));
      btnShopSkip()?.addEventListener("click", () => state.game && closeShop(state.game));
      btnCloseChest()?.addEventListener("click", () => state.game && closeChest(state.game));
      btnChestSkip()?.addEventListener("click", () => state.game && closeChest(state.game));
      btnCloseCatalog()?.addEventListener("click", () => closeCatalog());
    }, 0);

    if (el.pillPlayer) {
      el.pillPlayer.addEventListener("click", () => {
        if (!state.game) return;
        openCatalog(state.game);
      });
      el.pillPlayer.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); if (state.game) openCatalog(state.game); }
      });
    }

    // Press Start
    if (el.btnPressStart) el.btnPressStart.addEventListener("click", () => onPressStart());

    // Start
    if (el.btnStart) el.btnStart.addEventListener("click", () => {
      // crear perfil si está abierto
      if (el.newProfileWrap && !el.newProfileWrap.hidden) {
        createProfileFromInput();
      }
      startRun();
    });

    // opciones
    if (el.optMusicOn) el.optMusicOn.addEventListener("change", () => { state.options.musicOn = !!el.optMusicOn.checked; saveOptions(); applyAudioOptions(); });
    if (el.optSfxOn) el.optSfxOn.addEventListener("change", () => { state.options.sfxOn = !!el.optSfxOn.checked; saveOptions(); applyAudioOptions(); });
    if (el.optMusicVol) el.optMusicVol.addEventListener("input", () => { state.options.musicVol = clamp(Number(el.optMusicVol.value) || 0, 0, 1); syncOptionsUI(); saveOptions(); applyAudioOptions(); }, { passive:true });
    if (el.optSfxVol) el.optSfxVol.addEventListener("input", () => { state.options.sfxVol = clamp(Number(el.optSfxVol.value) || 0, 0, 1); syncOptionsUI(); saveOptions(); applyAudioOptions(); }, { passive:true });
    if (el.optMuteAll) el.optMuteAll.addEventListener("change", () => { state.options.muteAll = !!el.optMuteAll.checked; saveOptions(); applyAudioOptions(); });
    if (el.optSprites) el.optSprites.addEventListener("change", () => { state.options.sprites = !!el.optSprites.checked; saveOptions(); });
    if (el.optVibration) el.optVibration.addEventListener("change", () => { state.options.vibration = !!el.optVibration.checked; saveOptions(); });
    if (el.optDpad) el.optDpad.addEventListener("change", () => { state.options.dpad = !!el.optDpad.checked; saveOptions(); syncOptionsUI(); });
    if (el.optFx) el.optFx.addEventListener("input", () => { state.options.fx = clamp(Number(el.optFx.value) || 1, 0.4, 1.25); saveOptions(); syncOptionsUI(); }, { passive:true });

    if (el.btnTestAudio) el.btnTestAudio.addEventListener("click", () => {
      audioUnlockOnce();
      sfx("sfx_ui_click");
      musicStart();
      toast("Audio OK", 800);
    });

    if (el.btnRepairPWA) el.btnRepairPWA.addEventListener("click", () => {
      // usa tu repair mode del index.html
      try {
        const u = new URL(location.href);
        u.searchParams.set("repair", "1");
        location.href = u.toString();
      } catch (_) { location.href = "?repair=1"; }
    });

    if (el.btnClearLocal) el.btnClearLocal.addEventListener("click", () => {
      if (!confirm("¿Borrar datos locales (perfiles, récords, opciones, skills)?")) return;
      try { localStorage.clear(); } catch (_) {}
      location.reload();
    });

    // errors overlay
    if (el.btnErrClose) el.btnErrClose.addEventListener("click", () => hide(el.overlayError));
    if (el.btnErrReload) el.btnErrReload.addEventListener("click", () => location.reload());
  }

  // ───────────────────────── Pausa / opciones ─────────────────────────
  function togglePause() {
    if (!state.game) return;

    if (state.phase === "playing") pause();
    else if (state.phase === "paused") resume();
  }

  function pause() {
    if (!state.game) return;
    state.phase = "paused";
    show(el.overlayPaused);
    if (el.dpad) el.dpad.hidden = true;
  }

  function resume() {
    if (!state.game) return;
    hide(el.overlayPaused);
    state.phase = "playing";
    syncOptionsUI();
  }

  function openOptions() {
    state.prevPhaseBeforeOptions = state.phase;
    state.phase = "options";
    show(el.overlayOptions);
    if (el.dpad) el.dpad.hidden = true;
  }

  function closeOptions() {
    hide(el.overlayOptions);
    state.phase = state.prevPhaseBeforeOptions || "playing";
    syncOptionsUI();
  }

  // ───────────────────────── Press / Menu / StartRun ─────────────────────────
  function onPressStart() {
    audioUnlockOnce();
    applyAudioOptions();
    sfx("sfx_ui_click");

    hide(el.overlayPress);
    show(el.overlayStart);
    state.phase = "menu";

    updateStartMeta();
  }

  function goToMenu() {
    stopRunLoop();
    hide(el.overlayGameOver);
    hide(el.overlayPaused);
    hide(el.overlayUpgrades);
    hide($("overlayShop"));
    hide($("overlayChest"));
    hide($("overlayCatalog"));
    show(el.overlayStart);

    state.game = null;
    state.phase = "menu";
    syncOptionsUI();
    updateStartMeta();
  }

  function retry() {
    hide(el.overlayGameOver);
    hide(el.overlayPaused);
    hide(el.overlayUpgrades);
    hide($("overlayShop"));
    hide($("overlayChest"));
    hide($("overlayCatalog"));

    startRun();
  }

  function startRun() {
    // persist modo
    LS.set("gridrogue_last_mode_v1", state.mode);

    // crear juego
    state.game = newGame();
    state.phase = "playing";

    // UI
    hide(el.overlayStart);
    hide(el.overlayGameOver);
    hide(el.overlayPaused);
    hide(el.overlayUpgrades);
    hide(el.overlayOptions);
    hide($("overlayShop"));
    hide($("overlayChest"));
    hide($("overlayCatalog"));

    if (el.dpad) el.dpad.hidden = !(isMobile && state.options.dpad);

    updateStatusHUD(state.game);
    updateLevelBar(state.game);
    renderCombo(state.game);

    // audio
    musicStart();

    // loop
    startRunLoop();
  }

  // ───────────────────────── PWA / Service Worker / Update pill ─────────────────────────
  async function registerSW() {
    if (NO_SW) return;
    if (!("serviceWorker" in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`, { scope: "./" });
      state.sw.reg = reg;

      // update flow
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // update disponible
              state.sw.waiting = reg.waiting || nw;
              state.sw.updateAvailable = true;
              showUpdatePill();
            }
          }
        });
      });

      // si ya hay waiting
      if (reg.waiting && navigator.serviceWorker.controller) {
        state.sw.waiting = reg.waiting;
        state.sw.updateAvailable = true;
        showUpdatePill();
      }

      navigator.serviceWorker.addEventListener("message", (e) => {
        const d = e.data || {};
        if (d.type === "SW_ACTIVATED") {
          // si pedimos update, recarga en momento seguro
          if (state.sw.pendingReload) maybeReloadNow();
        }
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // evita loops: solo marcar pendiente
        state.sw.pendingReload = true;
        maybeReloadNow();
      });
    } catch (e) {
      log("SW register error:", e);
    }
  }

  function showUpdatePill() {
    if (!el.pillUpdate) return;
    el.pillUpdate.hidden = false;

    el.pillUpdate.onclick = () => {
      sfx("sfx_ui_click");
      requestSWUpdate();
    };
  }

  function requestSWUpdate() {
    try {
      const reg = state.sw.reg;
      const w = state.sw.waiting || (reg ? reg.waiting : null);
      if (!w) {
        // intentar update
        reg && reg.update && reg.update();
        toast("Buscando update…", 900);
        return;
      }
      w.postMessage({ type: "SKIP_WAITING" });
      state.sw.pendingReload = true;
      maybeReloadNow();
      toast("Update listo. Se aplicará al terminar o al volver al menú.", 1400);
    } catch (_) {}
  }

  function maybeReloadNow() {
    // NO recargar en medio del run si está jugando
    if (state.phase === "playing" || state.phase === "shop" || state.phase === "chest" || state.phase === "upgrades") return;

    // recarga si estamos en menu o gameover
    if (state.sw.pendingReload) {
      state.sw.pendingReload = false;
      try { location.reload(); } catch (_) {}
    }
  }

  // ───────────────────────── Network state ─────────────────────────
  function bindNetworkPill() {
    const setOffline = () => {
      if (!el.pillOffline) return;
      el.pillOffline.hidden = navigator.onLine;
    };
    window.addEventListener("online", setOffline, { passive: true });
    window.addEventListener("offline", setOffline, { passive: true });
    setOffline();
  }

  // ───────────────────────── Boot / init ─────────────────────────
  function fatal(err) {
    try {
      console.error(err);
      if (el.errMsg) el.errMsg.textContent = String(err && err.message ? err.message : err);
      show(el.overlayError);
      state.running = false;
      if (state.raf) cancelAnimationFrame(state.raf);
    } catch (_) {}
  }

  function initPills() {
    if (el.pillVersion) setText(el.pillVersion, `v${APP_VERSION}`);

    const modeTxt = isMobile ? "WEB • MÓVIL" : "WEB • PC";
    setText(el.pillModeVal, modeTxt);
  }

  function initLanguageUI() {
    if (!el.optLang) return;
    if (!I18n || typeof I18n.languageOptions !== "function") return;

    try {
      const opts = I18n.languageOptions();
      el.optLang.innerHTML = "";
      for (const o of opts) {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label || o.value;
        el.optLang.appendChild(opt);
      }

      const saved = state.options.lang || "";
      if (saved) el.optLang.value = saved;

      el.optLang.addEventListener("change", () => {
        state.options.lang = el.optLang.value;
        saveOptions();
        try { I18n.setLanguage && I18n.setLanguage(state.options.lang); } catch (_) {}
      });
    } catch (_) {}
  }

  function initInstallButton() {
    // opcional: capturar beforeinstallprompt
    let bip = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      try {
        e.preventDefault();
        bip = e;
        if (el.btnInstall) el.btnInstall.hidden = false;
      } catch (_) {}
    });

    if (el.btnInstall) {
      el.btnInstall.addEventListener("click", async () => {
        sfx("sfx_ui_click");
        if (!bip) return;
        try {
          await bip.prompt();
          await bip.userChoice;
        } catch (_) {}
        bip = null;
        el.btnInstall.hidden = true;
      });
    }
  }

  function resizeCanvas() {
    try {
      if (!el.canvas || !renderer) return;
      renderer.fit();
    } catch (_) {}
  }

  async function boot() {
    try {
      initPills();
      ensureExtraOverlays();

      loadOptions();
      syncOptionsUI();
      applyAudioOptions();

      // profiles
      state.profiles = loadProfiles();
      initProfileUI();

      // language
      initLanguageUI();

      // renderer
      renderer = makeRenderer(el.canvas);
      renderer.fit();

      // sprites async
      setText(el.loadingSub, "Cargando assets…");
      await renderer.loadSprites();

      // bind
      bindInput();
      bindNetworkPill();
      initInstallButton();

      // SW
      setText(el.loadingSub, "Preparando PWA…");
      registerSW();

      // loading -> press
      hide(el.overlayLoading);
      show(el.overlayPress);
      state.phase = "press";
      updateStartMeta();

      // failsafe: si algo rompe, mostrar botones emergencia
      setTimeout(() => {
        try {
          if (el.btnEmergencyReload) el.btnEmergencyReload.hidden = false;
          if (el.btnEmergencyRepair) el.btnEmergencyRepair.hidden = false;
          if (el.btnEmergencyReload) el.btnEmergencyReload.onclick = () => location.reload();
          if (el.btnEmergencyRepair) el.btnEmergencyRepair.onclick = () => {
            try {
              const u = new URL(location.href);
              u.searchParams.set("repair", "1");
              location.href = u.toString();
            } catch (_) { location.href = "?repair=1"; }
          };
        } catch (_) {}
      }, 4500);

      // hook overlay buttons (shop/chest/catalog)
      setTimeout(() => {
        $("btnCloseShop")?.addEventListener("click", () => state.game && closeShop(state.game));
        $("btnShopSkip")?.addEventListener("click", () => state.game && closeShop(state.game));
        $("btnCloseChest")?.addEventListener("click", () => state.game && closeChest(state.game));
        $("btnChestSkip")?.addEventListener("click", () => state.game && closeChest(state.game));
        $("btnCloseCatalog")?.addEventListener("click", () => closeCatalog());
      }, 0);

      // options close
      if (el.btnCloseOptions) el.btnCloseOptions.addEventListener("click", () => closeOptions());

      // upgrades reroll text update
      if (el.btnReroll) el.btnReroll.addEventListener("click", () => state.game && rerollUpgrades(state.game));

      // resize
      window.addEventListener("resize", () => resizeCanvas(), { passive: true });
      window.addEventListener("orientationchange", () => resizeCanvas(), { passive: true });

      // global errors
      window.addEventListener("error", (e) => {
        try { fatal(e.error || new Error(e.message || "Error")); } catch (_) {}
      });
      window.addEventListener("unhandledrejection", (e) => {
        try { fatal(e.reason || new Error("Unhandled promise rejection")); } catch (_) {}
      });

      // perf hook
      try { GRPerf && GRPerf.mark && GRPerf.mark("boot_done"); } catch (_) {}

      // initial meta
      updateStartMeta();
    } catch (e) {
      fatal(e);
    }
  }

  // ───────────────────────── Wiring buttons that depend on created overlays ─────────────────────────
  function bindOverlayButtons() {
    // Upgrades
    if (el.btnReroll) el.btnReroll.addEventListener("click", () => state.game && rerollUpgrades(state.game));
    if (el.btnSkipUpgrade) el.btnSkipUpgrade.addEventListener("click", () => state.game && closeUpgrades(state.game));

    // Shop/Chest/Catalog
    $("btnCloseShop")?.addEventListener("click", () => state.game && closeShop(state.game));
    $("btnShopSkip")?.addEventListener("click", () => state.game && closeShop(state.game));
    $("btnCloseChest")?.addEventListener("click", () => state.game && closeChest(state.game));
    $("btnChestSkip")?.addEventListener("click", () => state.game && closeChest(state.game));
    $("btnCloseCatalog")?.addEventListener("click", () => closeCatalog());
  }

  // ───────────────────────── Start ─────────────────────────
  try { bindOverlayButtons(); } catch (_) {}
  boot();
})();
