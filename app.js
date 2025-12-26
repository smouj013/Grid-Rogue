/* app.js — Grid Rogue v1.0.0 (PRO HUD + MODOS + 60 UPGRADES)
   ✅ Header minimal (solo Menú + Pausa)
   ✅ HUD sin solapamientos
   ✅ Stage oculto hasta Start
   ✅ Menú PRO con tabs + perfiles con stats
   ✅ Modos: endless + arcade/story (rondas con timer+objetivo)
   ✅ 60 upgrades (50+ reales) con rarezas + rerolls + catálogo
   ✅ Robusto: no rompe si faltan módulos opcionales (Auth / AudioSys / GRUtils)
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1000";
  try { if (g[LOAD_GUARD]) return; g[LOAD_GUARD] = true; } catch (_) {}

  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.0.0");

  // ───────────────────────── Imports (globals) ─────────────────────────
  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};
  const Auth = (typeof window !== "undefined" && window.Auth) ? window.Auth : null;

  const $ = U.$ || ((id) => document.getElementById(id));
  const qs = U.qs || ((sel, root = document) => root.querySelector(sel));
  const qsa = U.qsa || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));
  const on = U.on || ((el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts));
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0)));
  const randi = U.randi || ((a, b) => Math.floor(a + Math.random() * (b - a + 1)));
  const chance = U.chance || ((p) => Math.random() < p);
  const fmtScore = U.fmtScore || ((n) => String(n | 0));
  const fmtSeconds = U.fmtSeconds || ((s) => String(Math.max(0, Math.floor(s || 0))));
  const overlayShow = U.overlayShow || ((el) => { if (el) el.hidden = false; });
  const overlayHide = U.overlayHide || ((el) => { if (el) el.hidden = true; });
  const overlayFadeOut = U.overlayFadeOut || ((el) => Promise.resolve(overlayHide(el)));
  const lsGet = U.lsGet || ((k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } });
  const lsSet = U.lsSet || ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } });
  const toast = U.toast || ((m) => { try { console.log("[GridRogue]", m); } catch { } });
  const isMobile = U.isMobile || (() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  const setVHVar = U.setVHVar || (() => { });

  const haveSetHP = typeof U.setHP === "function";
  const haveSetBuffs = typeof U.setBuffs === "function";
  const setHP = U.setHP || (() => { });
  const setBuffs = U.setBuffs || (() => { });

  // AudioSys opcional
  const AudioSys = (typeof window !== "undefined" && window.AudioSys) ? window.AudioSys : {
    unlock: async () => true,
    sfx: async () => false,
    startMusic: async () => { },
    stopMusic: () => { },
    setMute: () => { },
    setMusicOn: () => { },
    setSfxOn: () => { },
    setVolumes: () => { },
  };

  // ───────────────────────── Keys ─────────────────────────
  const SETTINGS_KEY = "gridrogue_settings_v2";
  const RUNS_KEY = "gridrogue_runs_v2";

  // ───────────────────────── Settings ─────────────────────────
  const settings = {
    useSprites: true,
    vibration: true,
    showDpad: true,
    reduceMotion: false,
    fx: 1.0,
    musicOn: true,
    sfxOn: true,
    muteAll: false,
    musicVol: 0.55,
    sfxVol: 0.90,
  };

  function loadSettings() {
    const s = lsGet(SETTINGS_KEY, null);
    if (!s || typeof s !== "object") return;
    if ("useSprites" in s) settings.useSprites = !!s.useSprites;
    if ("vibration" in s) settings.vibration = !!s.vibration;
    if ("showDpad" in s) settings.showDpad = !!s.showDpad;
    if ("reduceMotion" in s) settings.reduceMotion = !!s.reduceMotion;
    if ("fx" in s) settings.fx = clamp(Number(s.fx) || settings.fx, 0.4, 1.25);
    if ("musicOn" in s) settings.musicOn = !!s.musicOn;
    if ("sfxOn" in s) settings.sfxOn = !!s.sfxOn;
    if ("muteAll" in s) settings.muteAll = !!s.muteAll;
    if ("musicVol" in s) settings.musicVol = clamp(Number(s.musicVol) || settings.musicVol, 0, 1);
    if ("sfxVol" in s) settings.sfxVol = clamp(Number(s.sfxVol) || settings.sfxVol, 0, 1);
  }

  function applyAudioSettings() {
    try {
      AudioSys.setMute(!!settings.muteAll);
      AudioSys.setMusicOn(!!settings.musicOn && !settings.muteAll);
      AudioSys.setSfxOn(!!settings.sfxOn && !settings.muteAll);
      AudioSys.setVolumes(settings.musicVol, settings.sfxVol);
    } catch (_) { }
  }

  function pushPrefsToAuth() {
    try {
      if (!Auth) return;
      Auth.patchPrefsForActive?.({
        useSprites: !!settings.useSprites,
        vibration: !!settings.vibration,
        showDpad: !!settings.showDpad,
        reduceMotion: !!settings.reduceMotion,
        fx: settings.fx,
        musicOn: !!settings.musicOn,
        sfxOn: !!settings.sfxOn,
        muteAll: !!settings.muteAll,
        musicVol: settings.musicVol,
        sfxVol: settings.sfxVol,
      });
    } catch (_) { }
  }

  function saveSettings() {
    lsSet(SETTINGS_KEY, { ...settings });
    pushPrefsToAuth();
    applyAudioSettings();
    applyDpadVisibility();
  }

  function vibrate(ms = 10) {
    if (!settings.vibration) return;
    try { navigator.vibrate?.(ms); } catch (_) { }
  }

  // ───────────────────────── DOM ─────────────────────────
  const stage = $("stage");
  const btnHome = $("btnHome");
  const btnPause = $("btnPause");
  const homeDot = $("homeDot");

  const overlayLoading = $("overlayLoading");
  const overlayPress = $("overlayPress");
  const btnPressStart = $("btnPressStart");

  const overlayMenu = $("overlayMenu");
  const btnCloseMenu = $("btnCloseMenu");
  const btnInstall = $("btnInstall");

  const overlayUpgrades = $("overlayUpgrades");
  const upgradeChoices = $("upgradeChoices");
  const btnContinue = $("btnContinue");
  const btnReroll = $("btnReroll");
  const rerollCount = $("rerollCount");
  const upTitle = $("upTitle");
  const upSub = $("upSub");

  const overlayPaused = $("overlayPaused");
  const btnUnpause = $("btnUnpause");
  const btnOpenMenuFromPause = $("btnOpenMenuFromPause");

  const overlayGameOver = $("overlayGameOver");
  const goReason = $("goReason");
  const goScore = $("goScore");
  const goBest = $("goBest");
  const goStats = $("goStats");
  const btnPlayAgain = $("btnPlayAgain");
  const btnBackToMenu = $("btnBackToMenu");

  const overlayError = $("overlayError");
  const errMsg = $("errMsg");
  const btnReload = $("btnReload");
  const btnRepair = $("btnRepair");

  // Menu Tabs
  const tabs = qsa(".tab", overlayMenu);
  const pages = qsa(".tabPage", overlayMenu);
  const catalog = $("catalog");
  const btnOpenCatalog = $("btnOpenCatalog");
  const btnCloseCatalog = $("btnCloseCatalog");
  const catalogList = $("catalogList");

  // Play
  const btnStartEndless = $("btnStartEndless");
  const btnStartArcade = $("btnStartArcade");
  const btnStartStory = $("btnStartStory");
  const btnResumeIfRunning = $("btnResumeIfRunning");
  const btnHardReset = $("btnHardReset");

  // Profiles
  const profileSelect = $("profileSelect");
  const btnNewProfile = $("btnNewProfile");
  const newProfileWrap = $("newProfileWrap");
  const newProfileName = $("newProfileName");
  const btnCreateProfile = $("btnCreateProfile");
  const btnCancelCreateProfile = $("btnCancelCreateProfile");
  const btnRenameProfile = $("btnRenameProfile");
  const btnDeleteProfile = $("btnDeleteProfile");
  const profileStats = $("profileStats");

  // Options
  const optUseSprites = $("optUseSprites");
  const optVibration = $("optVibration");
  const optShowDpad = $("optShowDpad");
  const optReduceMotion = $("optReduceMotion");
  const optFx = $("optFx");
  const optMusicOn = $("optMusicOn");
  const optSfxOn = $("optSfxOn");
  const optMuteAll = $("optMuteAll");
  const optMusicVol = $("optMusicVol");
  const optSfxVol = $("optSfxVol");
  const btnTestSfx = $("btnTestSfx");
  const btnTestMusic = $("btnTestMusic");
  const btnRepairPwa = $("btnRepairPwa");

  // Records
  const recordsList = $("recordsList");
  const btnClearRecords = $("btnClearRecords");

  // HUD
  const hudProfile = $("hudProfile");
  const hudMode = $("hudMode");
  const hudScore = $("hudScore");
  const hudBestVal = $("hudBest");
  const hudLevel = $("hudLevel");
  const hudSpeed = $("hudSpeed");
  const hudStageWrap = $("hudStageWrap");
  const hudTimerWrap = $("hudTimerWrap");
  const hudTargetWrap = $("hudTargetWrap");
  const hudStageScoreWrap = $("hudStageScoreWrap");
  const hudStage = $("hudStage");
  const hudTimer = $("hudTimer");
  const hudTarget = $("hudTarget");
  const hudStageScore = $("hudStageScore");
  const hpRow = $("hpRow");
  const buffRow = $("buffRow");

  const comboSeqEl = $("comboSeq");
  const comboTimerVal = $("comboTimerVal");
  const levelProgFill = $("levelProgFill");
  const levelProgText = $("levelProgText");
  const levelProgPct = $("levelProgPct");

  // Canvas
  const gameCanvas = $("gameCanvas");
  const fxCanvas = $("fxCanvas");
  const ctx = gameCanvas ? gameCanvas.getContext("2d", { alpha: false }) : null;
  const fctx = fxCanvas ? fxCanvas.getContext("2d") : null;

  // Dpad
  const dpad = $("dpad");
  const dpadBtns = qsa(".dbtn", dpad);

  // Emergency
  const btnEmergencyReload = $("btnEmergencyReload");
  const btnEmergencyRepair = $("btnEmergencyRepair");

  function showError(msg) {
    try {
      if (errMsg) errMsg.textContent = String(msg || "Error desconocido");
      if (overlayError) overlayShow(overlayError);
      console.error("[GridRogue Error]", msg);
    } catch (_) { }
  }

  // ───────────────────────── Game Constants ─────────────────────────
  const COLS = 8;
  const BASE_ROWS_DESKTOP = 24;
  const BASE_ROWS_MOBILE = 16;

  const Cell = Object.freeze({
    Empty: 0,
    Coin: 1,
    Gem: 2,
    Bonus: 3,
    Trap: 4,
    Block: 5,
  });

  const CellName = {
    [Cell.Empty]: "Vacío",
    [Cell.Coin]: "Moneda",
    [Cell.Gem]: "Gema",
    [Cell.Bonus]: "Bonus",
    [Cell.Trap]: "Trampa",
    [Cell.Block]: "Muro",
  };

  const CellIcon = {
    [Cell.Coin]: "paid",
    [Cell.Gem]: "diamond",
    [Cell.Bonus]: "stars",
    [Cell.Trap]: "warning",
    [Cell.Block]: "block",
  };

  const CellColor = {
    [Cell.Empty]: "#0c0c14",
    [Cell.Coin]: "#f4c34a",
    [Cell.Gem]: "#7ae0ff",
    [Cell.Bonus]: "#d685ff",
    [Cell.Trap]: "#ff5d7a",
    [Cell.Block]: "#7c849a",
  };

  // Sprites (si existen)
  const SPRITES = {
    [Cell.Coin]: "./assets/sprites/tile_coin.svg",
    [Cell.Gem]: "./assets/sprites/tile_gem.svg",
    [Cell.Bonus]: "./assets/sprites/tile_bonus.svg",
    [Cell.Trap]: "./assets/sprites/tile_trap.svg",
    [Cell.Block]: "./assets/sprites/tile_block.svg",
  };
  const spriteImg = new Map();

  function loadSprites() {
    spriteImg.clear();
    for (const [k, path] of Object.entries(SPRITES)) {
      const img = new Image();
      img.decoding = "async";
      img.src = path;
      spriteImg.set(Number(k), img);
    }
  }

  // ───────────────────────── Mode / Campaign ─────────────────────────
  const Mode = Object.freeze({ ENDLESS: "endless", ARCADE: "arcade", STORY: "story" });

  const STORY_STAGES = [
    { name: "Callejón Rojo", time: 38, target: 650, mod: { trap: +0.02 } },
    { name: "Bloques Sur", time: 38, target: 800, mod: { block: +0.02 } },
    { name: "Muelle Negro", time: 36, target: 980, mod: { gem: +0.02 } },
    { name: "Vieja Ciudad", time: 36, target: 1150, mod: { bonus: +0.02 } },
    { name: "Distrito Norte", time: 34, target: 1350, mod: { trap: +0.03 } },
    { name: "El Puente", time: 34, target: 1600, mod: { block: +0.03 } },
    { name: "Río Frío", time: 32, target: 1900, mod: { trap: +0.03, bonus: +0.01 } },
    { name: "Mercado", time: 32, target: 2250, mod: { gem: +0.03 } },
    { name: "Puerto", time: 30, target: 2700, mod: { trap: +0.04 } },
    { name: "Centro", time: 30, target: 3200, mod: { block: +0.04 } },
    { name: "La Torre", time: 28, target: 3800, mod: { trap: +0.04, gem: +0.02 } },
    { name: "Final", time: 28, target: 4500, mod: { trap: +0.05, block: +0.03 } },
  ];

  function arcadeStageConfig(roundIndex) {
    const r = Math.max(0, roundIndex | 0);
    const time = clamp(40 - r * 0.8, 22, 40);
    const target = Math.floor(700 * Math.pow(1.18, r));
    const mod = {
      trap: clamp(0.02 + r * 0.002, 0.02, 0.09),
      block: clamp(0.02 + r * 0.0015, 0.02, 0.07),
      gem: clamp(0.01 + r * 0.001, 0.01, 0.06),
      bonus: clamp(0.01 + r * 0.001, 0.01, 0.06),
    };
    return { name: `Ronda ${r + 1}`, time, target, mod };
  }

  // ───────────────────────── Upgrades ─────────────────────────
  const Rarity = Object.freeze({ Common: "common", Rare: "rare", Epic: "epic", Legendary: "legendary" });
  const RARITY_LABEL = { common: "Común", rare: "Rara", epic: "Épica", legendary: "Legendaria" };
  const RARITY_WEIGHT = { common: 60, rare: 25, epic: 12, legendary: 3 };

  function Upg(id, name, desc, icon, rarity, max, apply) {
    return { id, name, desc, icon, rarity, max, apply };
  }

  function createRunMods() {
    return {
      scoreMult: 1.0,
      coinMult: 1.0,
      gemMult: 1.0,
      bonusMult: 1.0,

      baseCoin: 20,
      baseGem: 65,
      baseBonus: 150,

      critChance: 0.0,
      critMult: 1.8,

      magnetRange: 0,
      magnetAlways: false,

      shields: 0,
      shieldMax: 0,
      shieldRegenSteps: 0,
      shieldRegenCounter: 0,

      hp: 10,
      hpMax: 10,
      regenEverySteps: 0,
      regenCounter: 0,

      trapDamage: 1,
      trapResist: 0.0,       // 0..0.8
      blockBreakChance: 0.0, // 0..0.8
      ghostChance: 0.0,      // 0..0.45 (evitar hit)

      dodgeCharges: 0,       // ignora hit seguro

      comboTime: 6.5,
      comboBonusMult: 1.0,
      comboHeal: 0,
      comboShield: 0,
      comboReroll: 0,
      comboExtendOnCorrect: 0.0,

      rerolls: 0,

      stageTimeBonusOnCoin: 0.0,
      stageTimeBonusOnGem: 0.0,
      stageTimeBonusOnBonus: 0.0,
      targetReduction: 0.0,

      stepScore: 0,
      streakMultPerStep: 0.0,
      streak: 0,

      convertTrapChance: 0.0,
      convertBlockChance: 0.0,

      chainChance: 0.0,
      echoChance: 0.0,

      previewRows: 0,
      zoneExtra: 0,
      zoneTight: 0,

      reviveCharges: 0,
      lowHpRage: false,
      rageMult: 1.0,
      rageSpeed: 1.0,

      coinShieldChance: 0.0,
      coinHealChance: 0.0,
      bonusHeal: 0,
      wallBreakScore: 0,

      hooks: {
        onCollect: [],
        onHit: [],
        onStep: [],
        onStageStart: [],
        onStageClear: [],
      },

      buffs: Object.create(null),
    };
  }

  function addBuff(mods, id, icon, kind, seconds, count = 1) {
    const b = mods.buffs[id] || { id, icon, kind, t: 0, count: 0 };
    b.t = Math.max(b.t, Number(seconds) || 0);
    b.count = Math.max(b.count, count | 0);
    mods.buffs[id] = b;
  }

  function tickBuffs(mods, dt) {
    for (const k of Object.keys(mods.buffs)) {
      const b = mods.buffs[k];
      b.t -= dt;
      if (b.t <= 0) delete mods.buffs[k];
    }
  }

  function buffsToUI(mods) {
    const arr = [];
    for (const k of Object.keys(mods.buffs)) {
      const b = mods.buffs[k];
      arr.push({
        icon: b.icon || "bolt",
        kind: b.kind || "misc",
        text: `${fmtSeconds(b.t)}s`,
        count: b.count || 1,
      });
    }
    arr.sort((a, b) => (a.kind || "").localeCompare(b.kind || ""));
    return arr;
  }

  // 60 upgrades
  const UPGRADES = [
    // Economía / valores
    Upg("coin_plus", "Monedas +", "+20% valor de monedas.", "paid", Rarity.Common, 8, (m) => { m.coinMult *= 1.20; }),
    Upg("gem_plus", "Gemas +", "+20% valor de gemas.", "diamond", Rarity.Common, 8, (m) => { m.gemMult *= 1.20; }),
    Upg("bonus_plus", "Bonus +", "+20% valor de bonus.", "stars", Rarity.Common, 8, (m) => { m.bonusMult *= 1.20; }),
    Upg("score_mult", "Amplificador", "+10% score global.", "bolt", Rarity.Common, 10, (m) => { m.scoreMult *= 1.10; }),

    Upg("coin_forge", "Casa de Moneda", "+6 valor base de moneda.", "payments", Rarity.Common, 6, (m) => { m.baseCoin += 6; }),
    Upg("gem_forge", "Tallador", "+18 valor base de gema.", "diamond", Rarity.Rare, 5, (m) => { m.baseGem += 18; }),
    Upg("bonus_forge", "Cartel de Bonus", "+55 valor base de bonus.", "stars", Rarity.Rare, 5, (m) => { m.baseBonus += 55; }),

    // Crítico
    Upg("crit_eye", "Ojo Crítico", "+6% crítico.", "visibility", Rarity.Rare, 6, (m) => { m.critChance = clamp(m.critChance + 0.06, 0, 0.60); }),
    Upg("crit_core", "Núcleo Crítico", "+0.25x a multiplicador crítico.", "flare", Rarity.Rare, 6, (m) => { m.critMult = clamp(m.critMult + 0.25, 1.6, 4.0); }),
    Upg("crit_rush", "Racha Crítica", "Tras gema: +10% crítico durante 4s.", "flash_on", Rarity.Epic, 3, (m) => {
      let t = 0;
      m.hooks.onCollect.push((ev) => { if (ev.finalCell === Cell.Gem) t = Math.max(t, 4.0); });
      m.hooks.onStep.push((ev) => { t = Math.max(0, t - ev.dt); });
      m.hooks.onCollect.push((ev) => {
        if (t > 0) {
          ev._critBoost = 0.10;
        }
      });
      m.hooks.onStep.push((ev) => {
        if (t > 0) addBuff(m, "crr", "flash_on", "boost", t, 1);
      });
    }),

    // Multiplicadores especiales / eventos
    Upg("double_dip", "Doble Cobro", "10% de duplicar el valor al recoger.", "call_split", Rarity.Rare, 6, (m) => {
      m.hooks.onCollect.push((ev) => { if (chance(0.10)) ev.addScore *= 2; });
    }),
    Upg("echo_pick", "Eco", "A veces el loot “resuena”: score extra.", "autorenew", Rarity.Rare, 6, (m) => { m.echoChance = clamp(m.echoChance + 0.12, 0, 0.65); }),
    Upg("chain", "Cadena", "Chance de “chain”: +20% score extra.", "hub", Rarity.Rare, 8, (m) => { m.chainChance = clamp(m.chainChance + 0.12, 0, 0.80); }),

    // Imán
    Upg("magnet_range", "Imán", "+1 rango de imán.", "magnet", Rarity.Common, 6, (m) => { m.magnetRange += 1; addBuff(m, "mag", "magnet", "magnet", 6.0, 1); }),
    Upg("magnet_over", "Overdrive Magnético", "Imán: recoge también diagonal (mejor).", "magnet", Rarity.Rare, 2, (m) => {
      // flag por closure: al tener este upgrade, usamos Chebyshev en vez de Manhattan (ver magnet)
      m._magCheby = true;
      addBuff(m, "mgo", "magnet", "magnet", 10.0, 1);
    }),
    Upg("magnet_core", "Núcleo Magnético", "Imán siempre activo.", "magnet", Rarity.Epic, 1, (m) => { m.magnetAlways = true; addBuff(m, "magperma", "magnet", "magnet", 9999, 1); }),
    Upg("vacuum_line", "Aspiradora", "Cada 10 steps recoge la fila del jugador.", "compress", Rarity.Epic, 2, (m) => {
      m.hooks.onStep.push((ev) => { if ((ev.stepCount % 10) === 0) ev.flags.vacuum = true; });
    }),

    // Vida / Escudos
    Upg("hp_forge", "Forja de Vida", "+2 vida máxima.", "favorite", Rarity.Rare, 5, (m) => { m.hpMax += 2; m.hp = Math.min(m.hpMax, m.hp + 2); }),
    Upg("regen", "Regeneración", "Cura 1 cada X steps (mejora al stackear).", "healing", Rarity.Rare, 4, (m) => { m.regenEverySteps = m.regenEverySteps ? Math.max(4, m.regenEverySteps - 1) : 9; }),
    Upg("shield_pack", "Escudo", "+2 escudos (máx +2).", "shield", Rarity.Rare, 6, (m) => { m.shieldMax += 2; m.shields = Math.min(m.shieldMax, m.shields + 2); addBuff(m, "sh", "shield", "shield", 8, 1); }),
    Upg("shield_regen", "Recarga de Escudo", "Recarga 1 escudo cada X steps.", "battery_charging_full", Rarity.Epic, 3, (m) => { m.shieldRegenSteps = m.shieldRegenSteps ? Math.max(6, m.shieldRegenSteps - 2) : 12; }),
    Upg("revive", "Segunda Oportunidad", "Revive 1 vez con 3 vida.", "restart_alt", Rarity.Legendary, 1, (m) => { m.reviveCharges += 1; addBuff(m, "rev", "restart_alt", "hp", 9999, m.reviveCharges); }),

    Upg("coin_shield", "Moneda Blindada", "Moneda: 12% de ganar +1 escudo.", "shield", Rarity.Rare, 6, (m) => { m.coinShieldChance = clamp(m.coinShieldChance + 0.12, 0, 0.70); }),
    Upg("coin_heal", "Moneda Sana", "Moneda: 10% de curar +1.", "favorite", Rarity.Rare, 6, (m) => { m.coinHealChance = clamp(m.coinHealChance + 0.10, 0, 0.60); }),
    Upg("bonus_heal", "Bonus Vital", "Bonus cura +1 (stackea).", "health_metrics", Rarity.Epic, 4, (m) => { m.bonusHeal += 1; }),

    Upg("dodge", "Evasión", "Ganas 1 carga: ignora el próximo hit.", "blur_on", Rarity.Epic, 3, (m) => {
      m.dodgeCharges += 1;
      addBuff(m, "dg", "blur_on", "resist", 9999, m.dodgeCharges);
    }),

    // Daño / resistencia
    Upg("resist", "Aislante", "Reduce daño de trampas 25%.", "health_and_safety", Rarity.Rare, 4, (m) => { m.trapResist = clamp(m.trapResist + 0.25, 0, 0.80); addBuff(m, "res", "health_and_safety", "resist", 10, 1); }),
    Upg("ghost", "Paso Fantasma", "8% de ignorar hits (trampa/muro).", "blur_on", Rarity.Epic, 5, (m) => { m.ghostChance = clamp(m.ghostChance + 0.08, 0, 0.45); }),
    Upg("breaker", "Demolicionista", "+12% romper muros.", "construction", Rarity.Rare, 6, (m) => { m.blockBreakChance = clamp(m.blockBreakChance + 0.12, 0, 0.80); }),
    Upg("wall_pay", "Soborno", "Al romper un muro: +100 score.", "request_quote", Rarity.Rare, 6, (m) => { m.wallBreakScore += 100; }),

    // Combo
    Upg("combo_time", "Reloj de Combo", "+1.2s ventana de combo.", "hourglass_top", Rarity.Common, 6, (m) => { m.comboTime += 1.2; }),
    Upg("combo_bonus", "Maestría", "+20% bonus de combo.", "bolt", Rarity.Rare, 8, (m) => { m.comboBonusMult *= 1.20; }),
    Upg("combo_heal", "Combo Vital", "Completar combo cura +1.", "favorite", Rarity.Epic, 4, (m) => { m.comboHeal += 1; }),
    Upg("combo_shield", "Combo Escudo", "Completar combo da +1 escudo.", "shield", Rarity.Epic, 4, (m) => { m.comboShield += 1; }),
    Upg("combo_reroll", "Combo Re-roll", "Completar combo: +1 re-roll.", "casino", Rarity.Epic, 3, (m) => { m.comboReroll += 1; }),
    Upg("combo_extend", "Combo Extendido", "Acierto de combo: +0.35s extra.", "add_alarm", Rarity.Rare, 6, (m) => { m.comboExtendOnCorrect += 0.35; }),

    // Arcade/Historia: tiempo/objetivo
    Upg("time_coin", "Crono-Moneda", "+0.20s por moneda (rondas).", "timer", Rarity.Rare, 6, (m) => { m.stageTimeBonusOnCoin += 0.20; }),
    Upg("time_gem", "Crono-Gema", "+0.35s por gema (rondas).", "timer", Rarity.Epic, 6, (m) => { m.stageTimeBonusOnGem += 0.35; }),
    Upg("time_bonus", "Crono-Bonus", "+0.55s por bonus (rondas).", "timer", Rarity.Epic, 4, (m) => { m.stageTimeBonusOnBonus += 0.55; }),
    Upg("target_cut", "Recorte de Objetivo", "-6% objetivo por stack (rondas).", "content_cut", Rarity.Epic, 5, (m) => { m.targetReduction = clamp(m.targetReduction + 0.06, 0, 0.35); }),
    Upg("target_shave", "Rasurado", "-3% objetivo por stack (rondas).", "cut", Rarity.Rare, 8, (m) => { m.targetReduction = clamp(m.targetReduction + 0.03, 0, 0.35); }),

    // Spawn manipulaciones / conversiones
    Upg("alchemist", "Alquimista", "5% convertir moneda→gema al recoger.", "science", Rarity.Rare, 6, (m) => { m.hooks.onCollect.push((ev) => { if (ev.cell === Cell.Coin && chance(0.05)) ev.forceCell = Cell.Gem; }); }),
    Upg("gem_to_bonus", "Tallado Dorado", "6% convertir gema→bonus al recoger.", "auto_awesome", Rarity.Epic, 4, (m) => { m.hooks.onCollect.push((ev) => { if (ev.cell === Cell.Gem && chance(0.06)) ev.forceCell = Cell.Bonus; }); }),
    Upg("trap_to_coin", "Desarme", "6% convertir trampa en moneda al generar.", "swap_horiz", Rarity.Rare, 7, (m) => { m.convertTrapChance = clamp(m.convertTrapChance + 0.06, 0, 0.50); }),
    Upg("block_to_bonus", "Grafitero", "6% convertir muro en bonus al generar.", "palette", Rarity.Rare, 7, (m) => { m.convertBlockChance = clamp(m.convertBlockChance + 0.06, 0, 0.50); }),

    // Streak / step score
    Upg("step_tip", "Propina", "+3 score por step.", "steps", Rarity.Common, 10, (m) => { m.stepScore += 3; }),
    Upg("streak", "Racha", "Cada step sin daño: +1% score (resetea al hit).", "speed", Rarity.Epic, 4, (m) => { m.streakMultPerStep = clamp(m.streakMultPerStep + 0.01, 0, 0.06); }),
    Upg("steps_big", "Kms", "+6 score por step.", "directions_walk", Rarity.Rare, 7, (m) => { m.stepScore += 6; }),

    // Preview / zona
    Upg("preview", "Predicción", "Muestra 1 fila futura.", "preview", Rarity.Rare, 2, (m) => { m.previewRows = Math.max(m.previewRows, 1); }),
    Upg("preview_plus", "Predicción +", "Muestra 2 filas futuras.", "preview", Rarity.Epic, 1, (m) => { m.previewRows = Math.max(m.previewRows, 2); }),
    Upg("zone_plus", "Zona Ampliada", "+1 fila de movimiento.", "unfold_more", Rarity.Rare, 3, (m) => { m.zoneExtra += 1; }),
    Upg("zone_tight", "Zona Compacta", "-1 fila de movimiento, pero +12% score.", "unfold_less", Rarity.Epic, 2, (m) => { m.zoneTight += 1; m.scoreMult *= 1.12; }),

    // Rage
    Upg("rage", "Adrenalina", "Con vida baja: +20% score y +10% velocidad.", "local_fire_department", Rarity.Epic, 1, (m) => { m.lowHpRage = true; m.rageMult = 1.20; m.rageSpeed = 1.10; }),
    Upg("risk", "Riesgo", "+18% score pero +1 daño de trampa.", "skull", Rarity.Epic, 2, (m) => { m.scoreMult *= 1.18; m.trapDamage += 1; }),

    // Rerolls
    Upg("reroll", "Re-roll", "+1 re-roll.", "casino", Rarity.Common, 8, (m) => { m.rerolls += 1; addBuff(m, "rr", "casino", "reroll", 8, m.rerolls); }),
    Upg("reroll_stage", "Batería", "Al completar ronda: +1 re-roll.", "battery_full", Rarity.Epic, 2, (m) => { m.hooks.onStageClear.push((ev) => { ev.awardReroll = (ev.awardReroll || 0) + 1; }); }),

    // Legendary spice
    Upg("golden_run", "Ruta Dorada", "Monedas +60%, Gemas +35%, pero +trampas.", "workspace_premium", Rarity.Legendary, 1, (m) => {
      m.coinMult *= 1.60;
      m.gemMult *= 1.35;
      m.hooks.onStageStart.push((ev) => { ev.extraTrap += 0.03; });
    }),
    Upg("guardian", "Guardián", "Empiezas con +4 escudos y recarga más rápida.", "shield", Rarity.Legendary, 1, (m) => {
      m.shieldMax += 4;
      m.shields = Math.min(m.shieldMax, m.shields + 4);
      m.shieldRegenSteps = m.shieldRegenSteps ? Math.max(5, m.shieldRegenSteps - 3) : 9;
    }),
    Upg("lucky_start", "Inicio Bendito", "+1 re-roll y +2 escudos al empezar run.", "emoji_events", Rarity.Legendary, 1, (m) => {
      m.rerolls += 1;
      m.shieldMax += 2;
      m.shields = Math.min(m.shieldMax, m.shields + 2);
      addBuff(m, "ls", "emoji_events", "boost", 9999, 1);
    }),

    // Extra “nuevos”
    Upg("bonus_bloom", "Flor de Bonus", "+bonus spawn en rondas.", "auto_awesome", Rarity.Rare, 6, (m) => { m.hooks.onStageStart.push((ev) => { ev.extraBonus += 0.01; }); }),
    Upg("gem_finder", "Buscagemas", "+gem spawn en rondas.", "travel_explore", Rarity.Rare, 6, (m) => { m.hooks.onStageStart.push((ev) => { ev.extraGem += 0.01; }); }),
    Upg("trap_slow", "Gel", "Hit: ralentiza el tick 0.6s.", "ac_unit", Rarity.Epic, 2, (m) => { m.hooks.onHit.push((ev) => { ev.slowFor = Math.max(ev.slowFor || 0, 0.6); }); }),
    Upg("panic_boost", "Pánico", "Al recibir hit: +15% score 3s.", "bolt", Rarity.Rare, 4, (m) => {
      m.hooks.onHit.push((ev) => {
        ev.grantBoost = Math.max(ev.grantBoost || 0, 3.0);
      });
    }),
    Upg("healgems", "Gemas Curativas", "Recoger gema cura 1 (cd 6s).", "health_metrics", Rarity.Epic, 2, (m) => {
      let cd = 0;
      m.hooks.onCollect.push((ev) => {
        if (ev.finalCell !== Cell.Gem) return;
        if (cd > 0) return;
        cd = 6.0;
        ev.heal = (ev.heal || 0) + 1;
      });
      m.hooks.onStep.push((ev) => { cd = Math.max(0, cd - ev.dt); });
    }),
  ];

  function createUpgradeState() {
    const st = Object.create(null);
    for (const u of UPGRADES) st[u.id] = 0;
    return st;
  }

  function canPickUpgrade(u, upState) {
    const cur = upState[u.id] | 0;
    return cur < (u.max | 0);
  }

  function weightedPick(list) {
    let sum = 0;
    for (const it of list) sum += (RARITY_WEIGHT[it.rarity] || 1);
    let r = Math.random() * sum;
    for (const it of list) {
      r -= (RARITY_WEIGHT[it.rarity] || 1);
      if (r <= 0) return it;
    }
    return list[list.length - 1] || null;
  }

  function rollUpgradeChoices(upState, count = 3) {
    const pool = UPGRADES.filter(u => canPickUpgrade(u, upState));
    const picks = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      const avail = pool.filter(u => !used.has(u.id));
      if (!avail.length) break;
      const pick = weightedPick(avail);
      if (!pick) break;
      used.add(pick.id);
      picks.push(pick);
    }
    return picks;
  }

  // ───────────────────────── Game State ─────────────────────────
  let rows = isMobile() ? BASE_ROWS_MOBILE : BASE_ROWS_DESKTOP;
  let grid = [];
  let zoneH = 6;
  let zoneY0 = 0;

  let running = false;
  let paused = false;
  let inUpgrade = false;

  let mode = Mode.ENDLESS;

  let player = { x: Math.floor(COLS / 2), yInZone: 2 };

  let score = 0;
  let best = 0;
  let level = 1;
  let xp = 0;
  let xpNext = 350;

  // arcade/story
  let roundIndex = 0;
  let stageTime = 0;
  let stageTimeLeft = 0;
  let stageTarget = 0;
  let stageScore = 0;
  let stageName = "";
  let stageMods = { trap: 0.02, block: 0.02, gem: 0.01, bonus: 0.01 };

  // tick
  let tickBase = 0.42;
  let tickMul = 1.0;
  let tickAcc = 0;
  let stepCount = 0;
  let slowTimer = 0;

  // combo
  let comboSeq = [];
  let comboIdx = 0;
  let comboTimer = 0;
  let comboMult = 1.0;

  // upgrades
  let mods = createRunMods();
  let upState = createUpgradeState();
  let pendingChoices = [];
  let pendingPick = null;
  let pendingReason = "level";

  // profile
  let playerName = "Jugador";

  // install prompt
  let deferredPrompt = null;

  // fx particles
  const FX = [];
  function fxSpawn(type, x, y, col) {
    if (!fctx) return;
    FX.push({
      type,
      x, y,
      vx: (Math.random() * 2 - 1) * 80,
      vy: (Math.random() * -1) * 120,
      life: 0.55,
      t: 0.55,
      col: col || "#fff",
      s: 1 + Math.random() * 0.8
    });
  }

  // ───────────────────────── Layout ─────────────────────────
  function recomputeZone() {
    const base = 6;
    const extra = (mods.zoneExtra | 0);
    const tight = (mods.zoneTight | 0);
    zoneH = clampInt(base + extra - tight, 3, 10);
    zoneY0 = (rows - zoneH) - 2;
    player.yInZone = clampInt(player.yInZone, 0, zoneH - 1);
  }

  function genRow(density, stageMod) {
    const r = new Array(COLS);
    for (let x = 0; x < COLS; x++) {
      const roll = Math.random();
      if (roll > density) { r[x] = Cell.Empty; continue; }

      let wCoin = 0.58;
      let wGem = 0.18 + (stageMod?.gem || 0);
      let wBonus = 0.10 + (stageMod?.bonus || 0);
      let wTrap = 0.10 + (stageMod?.trap || 0);
      let wBlock = 0.04 + (stageMod?.block || 0);

      const sum = wCoin + wGem + wBonus + wTrap + wBlock;
      wCoin /= sum; wGem /= sum; wBonus /= sum; wTrap /= sum; wBlock /= sum;

      let p = Math.random();
      let cell = Cell.Coin;
      if ((p -= wCoin) <= 0) cell = Cell.Coin;
      else if ((p -= wGem) <= 0) cell = Cell.Gem;
      else if ((p -= wBonus) <= 0) cell = Cell.Bonus;
      else if ((p -= wTrap) <= 0) cell = Cell.Trap;
      else cell = Cell.Block;

      if (cell === Cell.Trap && mods.convertTrapChance > 0 && chance(mods.convertTrapChance)) cell = Cell.Coin;
      if (cell === Cell.Block && mods.convertBlockChance > 0 && chance(mods.convertBlockChance)) cell = Cell.Bonus;

      r[x] = cell;
    }
    return r;
  }

  function resetGrid() {
    grid = [];
    for (let y = 0; y < rows; y++) {
      const dens = clamp(0.18 + (y / rows) * 0.22, 0.12, 0.45);
      grid.push(genRow(dens, stageMods));
    }
  }

  function applyDpadVisibility() {
    const show = !!settings.showDpad && isMobile();
    if (dpad) dpad.hidden = !show;
  }

  // ───────────────────────── UI Helpers ─────────────────────────
  function setTab(name) {
    for (const t of tabs) t.classList.toggle("active", t.dataset.tab === name);
    for (const p of pages) p.hidden = (p.dataset.page !== name);
    if (catalog) catalog.hidden = true;
  }

  function openMenu() {
    if (running && !inUpgrade) paused = true;
    overlayShow(overlayMenu);
    if (btnResumeIfRunning) btnResumeIfRunning.disabled = !running || inUpgrade;
    renderProfilesUI();
    renderRecordsUI();
    renderOptionsUI();
  }

  function closeMenu() {
    overlayHide(overlayMenu);
    if (running && !inUpgrade) paused = false;
  }

  function updateHeaderDot(isUpdate) {
    if (!homeDot) return;
    homeDot.hidden = !isUpdate;
  }

  function hpFallback(el, hp, hpMax, shields) {
    if (!el) return;
    const h = clampInt(hp, 0, 999);
    const hm = clampInt(hpMax, 1, 999);
    const sh = clampInt(shields, 0, 999);
    let html = "";
    html += `<span class="pill mono">HP ${h}/${hm}</span>`;
    if (sh > 0) html += ` <span class="pill mono">🛡 ${sh}</span>`;
    el.innerHTML = html;
  }

  function buffsFallback(el, arr) {
    if (!el) return;
    if (!arr || !arr.length) { el.innerHTML = ""; return; }
    el.innerHTML = arr.map(b => `<span class="pill mono">${b.icon} ${b.text}${b.count > 1 ? "×" + b.count : ""}</span>`).join(" ");
  }

  function updateHUD() {
    if (!hudProfile) return;

    hudProfile.textContent = playerName;
    hudMode.textContent =
      mode === Mode.ENDLESS ? "Infinito" :
        mode === Mode.ARCADE ? "Arcade" : "Historia";

    hudScore.textContent = fmtScore(score);
    hudBestVal.textContent = fmtScore(best);
    hudLevel.textContent = String(level | 0);

    hudSpeed.textContent = tickMul.toFixed(2) + "x";

    const isStages = (mode !== Mode.ENDLESS);
    if (hudStageWrap) hudStageWrap.hidden = !isStages;
    if (hudTimerWrap) hudTimerWrap.hidden = !isStages;
    if (hudTargetWrap) hudTargetWrap.hidden = !isStages;
    if (hudStageScoreWrap) hudStageScoreWrap.hidden = !isStages;

    if (isStages) {
      if (hudStage) hudStage.textContent = `${roundIndex + 1} • ${stageName}`;
      if (hudTimer) hudTimer.textContent = fmtSeconds(stageTimeLeft);
      if (hudTarget) hudTarget.textContent = fmtScore(stageTarget);
      if (hudStageScore) hudStageScore.textContent = fmtScore(stageScore);
    }

    const buffsArr = buffsToUI(mods);
    if (haveSetHP) setHP(hpRow, mods.hp, mods.hpMax, mods.shields);
    else hpFallback(hpRow, mods.hp, mods.hpMax, mods.shields);

    if (haveSetBuffs) setBuffs(buffRow, buffsArr);
    else buffsFallback(buffRow, buffsArr);

    if (comboTimerVal) comboTimerVal.textContent = `${fmtSeconds(comboTimer)}s`;
    renderComboSeq();

    // progress
    if (levelProgFill && levelProgText && levelProgPct) {
      if (mode === Mode.ENDLESS) {
        const pct = clamp(xp / Math.max(1, xpNext), 0, 1);
        levelProgFill.style.width = `${(pct * 100).toFixed(1)}%`;
        levelProgText.textContent = `${fmtScore(xp | 0)} / ${fmtScore(xpNext | 0)}`;
        levelProgPct.textContent = `${Math.floor(pct * 100)}%`;
      } else {
        const pct = clamp(stageScore / Math.max(1, stageTarget), 0, 1);
        levelProgFill.style.width = `${(pct * 100).toFixed(1)}%`;
        levelProgText.textContent = `${fmtScore(stageScore | 0)} / ${fmtScore(stageTarget | 0)}`;
        levelProgPct.textContent = `${Math.floor(pct * 100)}%`;
      }
    }
  }

  function renderComboSeq() {
    if (!comboSeqEl) return;
    comboSeqEl.innerHTML = "";
    for (let i = 0; i < comboSeq.length; i++) {
      const c = comboSeq[i];
      const done = i < comboIdx;
      const el = document.createElement("div");
      el.className = "comboToken" + (done ? " done" : "");
      el.innerHTML = `<span class="ms">${CellIcon[c] || "bolt"}</span><span>${CellName[c] || "?"}</span>`;
      comboSeqEl.appendChild(el);
    }
  }

  function renderCatalog() {
    if (!catalogList) return;
    catalogList.innerHTML = "";
    const sorted = UPGRADES.slice().sort((a, b) => {
      const ra = RARITY_WEIGHT[a.rarity] || 0;
      const rb = RARITY_WEIGHT[b.rarity] || 0;
      if (ra !== rb) return rb - ra;
      return a.name.localeCompare(b.name);
    });
    for (const u of sorted) {
      const div = document.createElement("div");
      div.className = "catalogItem";
      div.innerHTML = `<div class="t"><span class="ms">${u.icon}</span> ${u.name} <span class="pill mono">${RARITY_LABEL[u.rarity]}</span></div><div class="d">${u.desc}</div>`;
      catalogList.appendChild(div);
    }
  }

  // ───────────────────────── Profiles ─────────────────────────
  function ensureProfile() {
    if (!Auth) {
      playerName = "Jugador";
      best = 0;
      return;
    }
    const p = Auth.getActiveProfile?.();
    if (!p) Auth.createProfile?.("Jugador");
    const pp = Auth.getActiveProfile?.();
    playerName = (pp?.name || "Jugador").slice(0, 16);
    best = (Auth.getBestForActive?.() || 0) | 0;
  }

  function statLine(k, v) {
    const div = document.createElement("div");
    div.className = "statsLine";
    div.innerHTML = `<div class="k">${k}</div><div class="v mono">${v}</div>`;
    return div;
  }

  function renderProfileStats() {
    if (!Auth || !profileStats) return;
    const st = Auth.getStatsForActive?.() || {};
    const p = Auth.getActiveProfile?.();
    profileStats.innerHTML = "";
    profileStats.appendChild(statLine("Perfil", p?.name || "Jugador"));
    profileStats.appendChild(statLine("Runs", String(st.runsTotal | 0)));
    profileStats.appendChild(statLine("Tiempo jugado", `${Math.floor((st.playTimeSec || 0) / 60)} min`));
    profileStats.appendChild(statLine("Best overall", fmtScore(st.bestOverall | 0)));
    profileStats.appendChild(statLine("Best infinito", fmtScore(st.bestEndless | 0)));
    profileStats.appendChild(statLine("Best arcade", fmtScore(st.bestArcade | 0)));
    profileStats.appendChild(statLine("Best historia", fmtScore(st.bestStory | 0)));
    profileStats.appendChild(statLine("Mayor ronda arcade", String(st.highestArcadeRound | 0)));
    profileStats.appendChild(statLine("Mayor stage historia", String(st.highestStoryStage | 0)));
  }

  function renderProfilesUI() {
    if (!Auth || !profileSelect) {
      if (profileSelect) profileSelect.innerHTML = `<option>Auth no disponible</option>`;
      if (profileStats) profileStats.innerHTML = "";
      return;
    }
    const list = Auth.listProfiles?.() || [];
    const active = Auth.getActiveProfile?.();

    profileSelect.innerHTML = "";
    for (const p of list) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (active && p.id === active.id) opt.selected = true;
      profileSelect.appendChild(opt);
    }
    renderProfileStats();
  }

  // ───────────────────────── Records ─────────────────────────
  function getRuns() {
    const arr = lsGet(RUNS_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function pushRun(run) {
    const arr = getRuns();
    arr.unshift(run);
    while (arr.length > 30) arr.pop();
    lsSet(RUNS_KEY, arr);
  }
  function renderRecordsUI() {
    if (!recordsList) return;
    const arr = getRuns();
    recordsList.innerHTML = "";
    if (!arr.length) {
      recordsList.innerHTML = `<div class="tiny muted">No hay runs aún.</div>`;
      return;
    }
    for (const r of arr) {
      const div = document.createElement("div");
      div.className = "statsLine";
      const when = new Date(r.at || Date.now());
      div.innerHTML = `<div class="k">${when.toLocaleString()} • ${r.mode}</div><div class="v mono">${fmtScore(r.score | 0)}</div>`;
      recordsList.appendChild(div);
    }
  }

  // ───────────────────────── Options ─────────────────────────
  function renderOptionsUI() {
    if (!optUseSprites) return;
    optUseSprites.checked = !!settings.useSprites;
    optVibration.checked = !!settings.vibration;
    optShowDpad.checked = !!settings.showDpad;
    optReduceMotion.checked = !!settings.reduceMotion;
    if (optFx) optFx.value = String(settings.fx);
    if (optMusicOn) optMusicOn.checked = !!settings.musicOn;
    if (optSfxOn) optSfxOn.checked = !!settings.sfxOn;
    if (optMuteAll) optMuteAll.checked = !!settings.muteAll;
    if (optMusicVol) optMusicVol.value = String(settings.musicVol);
    if (optSfxVol) optSfxVol.value = String(settings.sfxVol);
  }

  // ───────────────────────── Run lifecycle ─────────────────────────
  function newCombo() {
    const pool = [Cell.Coin, Cell.Gem, Cell.Bonus];
    comboSeq = [pool[randi(0, 2)], pool[randi(0, 2)], pool[randi(0, 2)]];
    comboIdx = 0;
    comboTimer = mods.comboTime;
  }

  function resetRunCommon() {
    score = 0;
    level = 1;
    xp = 0;
    xpNext = 350;

    tickBase = 0.42;
    tickMul = 1.0;
    tickAcc = 0;
    stepCount = 0;
    slowTimer = 0;

    mods = createRunMods();
    mods.hpMax = 10;
    mods.hp = mods.hpMax;

    upState = createUpgradeState();
    inUpgrade = false;

    comboMult = 1.0;
    newCombo();

    rows = isMobile() ? BASE_ROWS_MOBILE : BASE_ROWS_DESKTOP;
    resetGrid();
    recomputeZone();

    player.x = Math.floor(COLS / 2);
    player.yInZone = Math.floor(zoneH / 2);

    loadSprites();
    updateHUD();
  }

  function setupStageForMode() {
    if (mode === Mode.ENDLESS) {
      stageTime = 0; stageTimeLeft = 0; stageTarget = 0; stageScore = 0; stageName = "—";
      stageMods = { trap: 0.02, block: 0.02, gem: 0.01, bonus: 0.01 };
      return;
    }
    if (mode === Mode.ARCADE) {
      const cfg = arcadeStageConfig(roundIndex);
      stageTime = cfg.time;
      stageTimeLeft = cfg.time;
      stageTarget = Math.floor(cfg.target * (1 - mods.targetReduction));
      stageScore = 0;
      stageName = cfg.name;
      stageMods = cfg.mod;
      return;
    }
    const idx = clampInt(roundIndex, 0, STORY_STAGES.length - 1);
    const cfg = STORY_STAGES[idx];
    stageTime = cfg.time;
    stageTimeLeft = cfg.time;
    stageTarget = Math.floor(cfg.target * (1 - mods.targetReduction));
    stageScore = 0;
    stageName = cfg.name;
    stageMods = cfg.mod;
  }

  function startRun(selectedMode) {
    mode = selectedMode;
    roundIndex = 0;

    resetRunCommon();
    setupStageForMode();

    if (mode !== Mode.ENDLESS) {
      const ev = { extraTrap: 0, extraBlock: 0, extraGem: 0, extraBonus: 0 };
      for (const fn of mods.hooks.onStageStart) { try { fn(ev); } catch (_) { } }
      stageMods = {
        trap: (stageMods.trap || 0) + (ev.extraTrap || 0),
        block: (stageMods.block || 0) + (ev.extraBlock || 0),
        gem: (stageMods.gem || 0) + (ev.extraGem || 0),
        bonus: (stageMods.bonus || 0) + (ev.extraBonus || 0),
      };
    }

    running = true;
    paused = false;

    if (btnPause) btnPause.disabled = false;
    if (btnResumeIfRunning) btnResumeIfRunning.disabled = false;

    if (stage) stage.classList.remove("isHidden");

    closeMenu();
    overlayHide(overlayPress);
    overlayHide(overlayLoading);

    applyAudioSettings();
    try { AudioSys.startMusic?.(); } catch (_) { }

    toast(mode === Mode.ENDLESS ? "Infinito" : (mode === Mode.ARCADE ? "Arcade" : "Historia"));
  }

  function endRun(reason) {
    running = false;
    paused = false;
    inUpgrade = false;

    if (btnPause) btnPause.disabled = true;
    if (btnResumeIfRunning) btnResumeIfRunning.disabled = true;

    try { AudioSys.stopMusic?.(); } catch (_) { }

    const finalScore = score | 0;
    best = Math.max(best | 0, finalScore);

    try {
      Auth?.setBestForActive?.(best);
      const st = Auth?.getStatsForActive?.() || {};
      const patch = { ...st };

      patch.runsTotal = (st.runsTotal | 0) + 1;
      patch.playTimeSec = (st.playTimeSec | 0) + Math.floor((stepCount * tickBase) / 1.0);
      patch.bestOverall = Math.max(st.bestOverall | 0, finalScore);

      if (mode === Mode.ENDLESS) patch.bestEndless = Math.max(st.bestEndless | 0, finalScore);
      if (mode === Mode.ARCADE) {
        patch.bestArcade = Math.max(st.bestArcade | 0, finalScore);
        patch.highestArcadeRound = Math.max(st.highestArcadeRound | 0, (roundIndex + 1) | 0);
      }
      if (mode === Mode.STORY) {
        patch.bestStory = Math.max(st.bestStory | 0, finalScore);
        patch.highestStoryStage = Math.max(st.highestStoryStage | 0, (roundIndex + 1) | 0);
      }

      patch.lastRunAt = Date.now();
      patch.lastMode = mode;
      patch.lastScore = finalScore;

      Auth?.patchStatsForActive?.(patch);
    } catch (_) { }

    pushRun({ at: Date.now(), mode, score: finalScore });

    if (goReason) goReason.textContent = String(reason || "—");
    if (goScore) goScore.textContent = fmtScore(finalScore);
    if (goBest) goBest.innerHTML = `Best: <span class="v">${fmtScore(best)}</span>`;

    if (goStats) {
      goStats.innerHTML = "";
      const lines = [
        ["Modo", mode === Mode.ENDLESS ? "Infinito" : (mode === Mode.ARCADE ? "Arcade" : "Historia")],
        ["Nivel", String(level | 0)],
        ["Steps", String(stepCount | 0)],
        ["Ronda/Stage", (mode === Mode.ENDLESS) ? "—" : String(roundIndex + 1)],
      ];
      for (const [k, v] of lines) {
        const div = document.createElement("div");
        div.className = "line statsLine";
        div.innerHTML = `<span>${k}</span><span class="mono">${v}</span>`;
        goStats.appendChild(div);
      }
    }

    overlayShow(overlayGameOver);
    updateHUD();
  }

  function hardResetRun() {
    running = false;
    paused = false;
    inUpgrade = false;
    if (btnPause) btnPause.disabled = true;
    if (btnResumeIfRunning) btnResumeIfRunning.disabled = true;
    try { AudioSys.stopMusic?.(); } catch (_) { }
    if (stage) stage.classList.add("isHidden");
    toast("Run reseteada");
    updateHUD();
  }

  // ───────────────────────── Upgrade Flow ─────────────────────────
  function openUpgrade(reason) {
    if (!running) return;
    inUpgrade = true;
    paused = true;
    pendingReason = reason || "level";

    pendingChoices = rollUpgradeChoices(upState, 4);
    pendingPick = null;

    if (upgradeChoices) upgradeChoices.innerHTML = "";
    for (const u of pendingChoices) {
      const card = document.createElement("div");
      card.className = "upCard";
      card.innerHTML = `
        <div class="upHead">
          <div class="upIcon"><span class="ms">${u.icon}</span></div>
          <div>
            <div class="upName">${u.name}</div>
            <div class="tiny muted">${u.id}</div>
          </div>
          <div class="upRarity">${RARITY_LABEL[u.rarity] || "Común"}</div>
        </div>
        <div class="upDesc">${u.desc}</div>
      `;
      card.addEventListener("click", () => {
        qsa(".upCard", upgradeChoices).forEach(x => x.style.outline = "none");
        card.style.outline = "2px solid rgba(122,167,255,.55)";
        pendingPick = u;
        vibrate(8);
        try { AudioSys.sfx?.("upgrade"); } catch (_) { }
      });
      upgradeChoices?.appendChild(card);
    }

    if (btnReroll) btnReroll.disabled = !(mods.rerolls > 0);
    if (rerollCount) rerollCount.textContent = String(mods.rerolls | 0);

    if (upTitle) upTitle.textContent = (reason === "stage") ? "Ronda completada: elige mejora" : "Subes de nivel: elige mejora";
    if (upSub) upSub.textContent = "Elige 1 • Puedes re-roll si tienes";

    overlayShow(overlayUpgrades);
    updateHUD();
  }

  function applyUpgrade(u) {
    if (!u) return false;
    if (!canPickUpgrade(u, upState)) return false;

    upState[u.id] = (upState[u.id] | 0) + 1;
    try { u.apply(mods, upState[u.id] | 0); } catch (_) { }

    if (mods.reviveCharges > 0) addBuff(mods, "rev", "restart_alt", "hp", 9999, mods.reviveCharges);
    if (mods.dodgeCharges > 0) addBuff(mods, "dg", "blur_on", "resist", 9999, mods.dodgeCharges);

    toast(`+ ${u.name}`);
    return true;
  }

  function rerollUpgrades() {
    if (mods.rerolls <= 0) return;
    mods.rerolls -= 1;
    if (btnReroll) btnReroll.disabled = !(mods.rerolls > 0);
    if (rerollCount) rerollCount.textContent = String(mods.rerolls | 0);

    pendingChoices = rollUpgradeChoices(upState, 4);
    pendingPick = null;

    if (upgradeChoices) upgradeChoices.innerHTML = "";
    for (const u of pendingChoices) {
      const card = document.createElement("div");
      card.className = "upCard";
      card.innerHTML = `
        <div class="upHead">
          <div class="upIcon"><span class="ms">${u.icon}</span></div>
          <div>
            <div class="upName">${u.name}</div>
            <div class="tiny muted">${u.id}</div>
          </div>
          <div class="upRarity">${RARITY_LABEL[u.rarity] || "Común"}</div>
        </div>
        <div class="upDesc">${u.desc}</div>
      `;
      card.addEventListener("click", () => {
        qsa(".upCard", upgradeChoices).forEach(x => x.style.outline = "none");
        card.style.outline = "2px solid rgba(122,167,255,.55)";
        pendingPick = u;
        vibrate(8);
        try { AudioSys.sfx?.("reroll"); } catch (_) { }
      });
      upgradeChoices?.appendChild(card);
    }

    try { AudioSys.sfx?.("reroll"); } catch (_) { }
  }

  function closeUpgradeAndContinue() {
    if (pendingPick) applyUpgrade(pendingPick);
    overlayHide(overlayUpgrades);
    inUpgrade = false;
    paused = false;

    if (pendingReason === "stage") nextStage();
    recomputeZone();
    updateHUD();
  }

  // ───────────────────────── Stage Flow ─────────────────────────
  function stageClear() {
    const timeBonus = Math.floor(stageTimeLeft * 8);
    score += timeBonus;
    addBuff(mods, "tb", "timer", "boost", 6, 1);

    const ev = { awardReroll: 0 };
    for (const fn of mods.hooks.onStageClear) { try { fn(ev); } catch (_) { } }
    if (ev.awardReroll) mods.rerolls += (ev.awardReroll | 0);

    level += 1;
    openUpgrade("stage");
  }

  function nextStage() {
    if (mode === Mode.ENDLESS) return;

    roundIndex += 1;

    if (mode === Mode.STORY && roundIndex >= STORY_STAGES.length) {
      endRun("Historia completada ✅");
      return;
    }

    setupStageForMode();

    const ev = { extraTrap: 0, extraBlock: 0, extraGem: 0, extraBonus: 0 };
    for (const fn of mods.hooks.onStageStart) { try { fn(ev); } catch (_) { } }
    stageMods = {
      trap: (stageMods.trap || 0) + (ev.extraTrap || 0),
      block: (stageMods.block || 0) + (ev.extraBlock || 0),
      gem: (stageMods.gem || 0) + (ev.extraGem || 0),
      bonus: (stageMods.bonus || 0) + (ev.extraBonus || 0),
    };

    toast(`Siguiente: ${stageName}`);
  }

  // ───────────────────────── Gameplay ─────────────────────────
  function cellValue(cell) {
    if (cell === Cell.Coin) return Math.floor(mods.baseCoin * mods.coinMult);
    if (cell === Cell.Gem) return Math.floor(mods.baseGem * mods.gemMult);
    if (cell === Cell.Bonus) return Math.floor(mods.baseBonus * mods.bonusMult);
    return 0;
  }

  function applyCollect(cell, x = -1, y = -1) {
    if (cell === Cell.Empty) return;

    const ev = {
      cell,
      x, y,
      forceCell: null,
      finalCell: cell,
      addScore: cellValue(cell),
      heal: 0,
      _critBoost: 0,
      _boostSec: 0,
    };
    const before = ev.addScore;

    for (const fn of mods.hooks.onCollect) { try { fn(ev); } catch (_) { } }

    ev.finalCell = (ev.forceCell != null) ? ev.forceCell : ev.cell;

    // si cambió el tipo y nadie tocó addScore, recalculamos
    if (ev.finalCell !== ev.cell && ev.addScore === before) {
      ev.addScore = cellValue(ev.finalCell);
    }

    let add = ev.addScore;
    // streak mult
    if (mods.streakMultPerStep > 0 && mods.streak > 0) {
      const streakMult = 1 + clamp(mods.streak * mods.streakMultPerStep, 0, 0.80);
      add = Math.floor(add * streakMult);
    }

    // boost temporal desde hooks de hit
    if (mods._scoreBoostTimer && mods._scoreBoostTimer > 0) {
      add = Math.floor(add * 1.15);
    }

    add = Math.floor(add * mods.scoreMult * comboMult);

    // chain / echo
    if (mods.chainChance > 0 && chance(Math.min(0.95, mods.chainChance))) {
      add += Math.floor(add * 0.20);
      addBuff(mods, "ch", "hub", "boost", 1.6, 1);
    }
    if (mods.echoChance > 0 && chance(Math.min(0.95, mods.echoChance))) {
      add += Math.floor(add * 0.35);
      addBuff(mods, "ec", "autorenew", "boost", 1.6, 1);
    }

    // crítico (incluye boost temporal)
    const critChanceEff = clamp(mods.critChance + (ev._critBoost || 0), 0, 0.85);
    if (critChanceEff > 0 && chance(critChanceEff)) {
      add = Math.floor(add * mods.critMult);
      addBuff(mods, "cr", "flare", "boost", 1.2, 1);
    }

    score += add;

    if (mode !== Mode.ENDLESS) {
      stageScore += add;
      if (ev.finalCell === Cell.Coin && mods.stageTimeBonusOnCoin > 0) stageTimeLeft += mods.stageTimeBonusOnCoin;
      if (ev.finalCell === Cell.Gem && mods.stageTimeBonusOnGem > 0) stageTimeLeft += mods.stageTimeBonusOnGem;
      if (ev.finalCell === Cell.Bonus && mods.stageTimeBonusOnBonus > 0) stageTimeLeft += mods.stageTimeBonusOnBonus;
    } else {
      xp += Math.floor(add * 0.30);
    }

    // combo
    if (ev.finalCell === comboSeq[comboIdx]) {
      comboIdx += 1;
      comboTimer = mods.comboTime + (mods.comboExtendOnCorrect || 0);
      if (comboIdx >= comboSeq.length) {
        const bonus = Math.floor(220 * mods.comboBonusMult * comboMult);
        score += bonus;
        if (mode !== Mode.ENDLESS) stageScore += bonus;
        else xp += Math.floor(bonus * 0.25);

        comboMult = clamp(comboMult + 0.15, 1.0, 4.0);
        addBuff(mods, "cmb", "bolt", "boost", 4.0, Math.max(1, Math.floor(comboMult)));

        if (mods.comboHeal > 0) mods.hp = Math.min(mods.hpMax, mods.hp + mods.comboHeal);
        if (mods.comboShield > 0) {
          mods.shieldMax = Math.max(mods.shieldMax, mods.shields + mods.comboShield);
          mods.shields = Math.min(mods.shieldMax, mods.shields + mods.comboShield);
        }
        if (mods.comboReroll > 0) {
          mods.rerolls += mods.comboReroll;
          addBuff(mods, "rr", "casino", "reroll", 4.0, mods.rerolls);
        }

        newCombo();
      }
    } else {
      comboIdx = 0;
      comboMult = 1.0;
      comboTimer = mods.comboTime;
    }

    // cura por hooks
    if (ev.heal) mods.hp = Math.min(mods.hpMax, mods.hp + (ev.heal | 0));

    // extras por tipo
    if (ev.finalCell === Cell.Coin) {
      if (mods.coinShieldChance > 0 && chance(mods.coinShieldChance)) {
        mods.shieldMax = Math.max(mods.shieldMax, mods.shields + 1);
        mods.shields = Math.min(mods.shieldMax, mods.shields + 1);
        addBuff(mods, "csh", "shield", "shield", 1.2, 1);
      }
      if (mods.coinHealChance > 0 && chance(mods.coinHealChance)) {
        mods.hp = Math.min(mods.hpMax, mods.hp + 1);
        addBuff(mods, "chl", "favorite", "hp", 1.2, 1);
      }
    }
    if (ev.finalCell === Cell.Bonus && mods.bonusHeal > 0) {
      mods.hp = Math.min(mods.hpMax, mods.hp + mods.bonusHeal);
      addBuff(mods, "bhl", "health_metrics", "hp", 1.2, mods.bonusHeal);
    }

    // FX + SFX
    const col = CellColor[ev.finalCell] || "#fff";
    fxSpawn("pop", pxOf(x) + CELL * 0.5, pyOf(y) + CELL * 0.5, col);

    try {
      if (ev.finalCell === Cell.Coin) AudioSys.sfx?.("coin");
      else if (ev.finalCell === Cell.Gem) AudioSys.sfx?.("gem");
      else if (ev.finalCell === Cell.Bonus) AudioSys.sfx?.("bonus");
    } catch (_) { }
  }

  function applyHit(kind) {
    // dodge charge
    if (mods.dodgeCharges > 0) {
      mods.dodgeCharges -= 1;
      addBuff(mods, "dg", "blur_on", "resist", 1.2, 1);
      try { AudioSys.sfx?.("pick"); } catch (_) { }
      return;
    }

    // ghost
    if (mods.ghostChance > 0 && chance(mods.ghostChance)) {
      addBuff(mods, "gh", "blur_on", "resist", 1.2, 1);
      return;
    }

    // hooks onHit
    const ev = { kind, slowFor: 0, grantBoost: 0 };
    for (const fn of mods.hooks.onHit) { try { fn(ev); } catch (_) { } }
    if (ev.slowFor) slowTimer = Math.max(slowTimer, ev.slowFor);
    if (ev.grantBoost) {
      mods._scoreBoostTimer = Math.max(mods._scoreBoostTimer || 0, ev.grantBoost);
      addBuff(mods, "pb", "bolt", "boost", ev.grantBoost, 1);
    }

    let dmg = mods.trapDamage;
    dmg = Math.max(0, Math.floor(dmg * (1 - clamp(mods.trapResist, 0, 0.85))));
    dmg = Math.max(1, dmg);

    if (mods.shields > 0) {
      mods.shields = Math.max(0, mods.shields - 1);
      addBuff(mods, "shh", "shield", "shield", 1.5, 1);
      try { AudioSys.sfx?.("block"); } catch (_) { }
      return;
    }

    mods.hp -= dmg;
    addBuff(mods, "hit", "warning", "resist", 1.5, 1);
    try { AudioSys.sfx?.(kind === "block" ? "block" : "trap"); } catch (_) { }

    mods.streak = 0;

    if (mods.lowHpRage && mods.hp <= 3) addBuff(mods, "rg", "local_fire_department", "boost", 2.0, 1);

    if (mods.hp <= 0) {
      if (mods.reviveCharges > 0) {
        mods.reviveCharges -= 1;
        mods.hp = Math.min(mods.hpMax, 3);
        addBuff(mods, "rev", "restart_alt", "hp", 4.0, 1);
        return;
      }
      endRun(kind === "trap" ? "Te eliminó una trampa" : "Te bloqueó un muro");
    }
  }

  function step() {
    stepCount++;

    // regen
    if (mods.regenEverySteps > 0) {
      mods.regenCounter = (mods.regenCounter | 0) + 1;
      if (mods.regenCounter >= mods.regenEverySteps) {
        mods.regenCounter = 0;
        if (mods.hp > 0) mods.hp = Math.min(mods.hpMax, mods.hp + 1);
      }
    }

    // shield regen
    if (mods.shieldRegenSteps > 0) {
      mods.shieldRegenCounter = (mods.shieldRegenCounter | 0) + 1;
      if (mods.shieldRegenCounter >= mods.shieldRegenSteps) {
        mods.shieldRegenCounter = 0;
        if (mods.shields < mods.shieldMax) {
          mods.shields = Math.min(mods.shieldMax, mods.shields + 1);
          addBuff(mods, "shr", "battery_charging_full", "shield", 1.2, 1);
        }
      }
    }

    // streak
    if (mods.streakMultPerStep > 0) mods.streak = (mods.streak | 0) + 1;

    // step score
    if (mods.stepScore > 0) {
      let add = mods.stepScore;
      add = Math.floor(add * mods.scoreMult);
      score += add;
      if (mode !== Mode.ENDLESS) stageScore += add;
      else xp += Math.floor(add * 0.2);
    }

    // onStep hooks
    const evStep = { stepCount, dt: tickBase * (1 / tickMul), flags: {} };
    for (const fn of mods.hooks.onStep) { try { fn(evStep); } catch (_) { } }

    // scroll grid
    grid.pop();
    const dens = clamp(0.22 + (level * 0.006), 0.20, 0.55);
    grid.unshift(genRow(dens, stageMods));

    // vacuum
    if (evStep.flags.vacuum) {
      const y = zoneY0 + player.yInZone;
      const row = grid[y];
      for (let x = 0; x < COLS; x++) {
        const c = row[x];
        if (c && c !== Cell.Empty) {
          applyCollect(c, x, y);
          row[x] = Cell.Empty;
        }
      }
      try { AudioSys.sfx?.("pick"); } catch (_) { }
    }

    // magnet (si always)
    if (mods.magnetAlways && mods.magnetRange > 0) magnetPull();

    // endless leveling
    if (mode === Mode.ENDLESS && !inUpgrade && xp >= xpNext) {
      xp -= xpNext;
      level += 1;
      xpNext = Math.floor(xpNext * 1.18 + 110);
      openUpgrade("level");
    }

    // speed scaling base
    if (mode === Mode.ENDLESS) tickMul = clamp(1 + level * 0.035, 1, 2.35);
    else tickMul = clamp(1 + roundIndex * 0.05, 1, 2.25);
  }

  function absY() { return zoneY0 + player.yInZone; }

  function tryMove(dx, dy) {
    if (!running || paused || inUpgrade) return;

    const nx = clampInt(player.x + dx, 0, COLS - 1);
    const nyz = clampInt(player.yInZone + dy, 0, zoneH - 1);
    const ay = zoneY0 + nyz;

    // si no cambia, nada
    if (nx === player.x && nyz === player.yInZone) return;

    const cell = grid?.[ay]?.[nx] ?? Cell.Empty;

    // muro: bloquea salvo romper
    if (cell === Cell.Block) {
      if (mods.blockBreakChance > 0 && chance(mods.blockBreakChance)) {
        grid[ay][nx] = Cell.Empty;
        if (mods.wallBreakScore > 0) {
          score += mods.wallBreakScore;
          if (mode !== Mode.ENDLESS) stageScore += mods.wallBreakScore;
        }
        addBuff(mods, "brk", "construction", "boost", 1.0, 1);
        try { AudioSys.sfx?.("block"); } catch (_) { }
        fxSpawn("hit", pxOf(nx) + CELL * 0.5, pyOf(ay) + CELL * 0.5, CellColor[Cell.Block]);
      } else {
        applyHit("block");
        return; // no entras
      }
    }

    // mover
    player.x = nx;
    player.yInZone = nyz;

    // interact
    if (cell === Cell.Trap) {
      grid[ay][nx] = Cell.Empty;
      applyHit("trap");
      fxSpawn("hit", pxOf(nx) + CELL * 0.5, pyOf(ay) + CELL * 0.5, CellColor[Cell.Trap]);
    } else if (cell === Cell.Coin || cell === Cell.Gem || cell === Cell.Bonus) {
      grid[ay][nx] = Cell.Empty;
      applyCollect(cell, nx, ay);
    }

    // magnet al moverse
    if (mods.magnetRange > 0) magnetPull();

    // vibrate
    vibrate(6);
    updateHUD();
  }

  function magnetPull() {
    const r = mods.magnetRange | 0;
    if (r <= 0) return;

    const px = player.x;
    const py = absY();

    let pulled = 0;
    const useCheby = !!mods._magCheby;

    for (let y = py - r; y <= py + r; y++) {
      if (y < 0 || y >= rows) continue;
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || x >= COLS) continue;
        if (x === px && y === py) continue;

        const dist = useCheby ? Math.max(Math.abs(x - px), Math.abs(y - py)) : (Math.abs(x - px) + Math.abs(y - py));
        if (dist > r) continue;

        const c = grid[y][x];
        if (c === Cell.Coin || c === Cell.Gem || c === Cell.Bonus) {
          grid[y][x] = Cell.Empty;
          applyCollect(c, x, y);
          pulled++;
          if (pulled >= 6) break;
        }
      }
      if (pulled >= 6) break;
    }

    if (pulled > 0) {
      addBuff(mods, "magp", "magnet", "magnet", 0.9, pulled);
      try { AudioSys.sfx?.("pick"); } catch (_) { }
    }
  }

  // ───────────────────────── Rendering ─────────────────────────
  const CELL = 64;

  function setupCanvas() {
    if (!gameCanvas || !fxCanvas || !ctx || !fctx) return;

    gameCanvas.width = COLS * CELL;
    gameCanvas.height = rows * CELL;
    fxCanvas.width = gameCanvas.width;
    fxCanvas.height = gameCanvas.height;

    ctx.imageSmoothingEnabled = false;
    fctx.imageSmoothingEnabled = true;
  }

  function pxOf(x) { return (x | 0) * CELL; }
  function pyOf(y) { return (y | 0) * CELL; }

  function drawCell(x, y, cell) {
    const px = pxOf(x), py = pyOf(y);

    if (!ctx) return;

    // fondo
    ctx.fillStyle = CellColor[Cell.Empty];
    ctx.fillRect(px, py, CELL, CELL);

    if (cell === Cell.Empty) return;

    const col = CellColor[cell] || "#fff";

    if (settings.useSprites) {
      const img = spriteImg.get(cell);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, px, py, CELL, CELL);
        return;
      }
    }

    // fallback
    ctx.fillStyle = col;
    ctx.fillRect(px + 6, py + 6, CELL - 12, CELL - 12);
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.strokeRect(px + 6.5, py + 6.5, CELL - 13, CELL - 13);
  }

  function draw() {
    if (!ctx || !gameCanvas) return;

    // clear
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // grid
    const preview = mods.previewRows | 0;
    const previewTop = Math.max(0, zoneY0 - preview);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        drawCell(x, y, c);

        // preview tint
        if (preview > 0 && y >= previewTop && y < zoneY0) {
          ctx.fillStyle = "rgba(122,167,255,.08)";
          ctx.fillRect(pxOf(x), pyOf(y), CELL, CELL);
        }
      }
    }

    // zona
    const zy = zoneY0 * CELL;
    ctx.fillStyle = "rgba(122,167,255,.07)";
    ctx.fillRect(0, zy, gameCanvas.width, zoneH * CELL);

    // jugador
    const px = player.x * CELL + CELL * 0.5;
    const py = (zoneY0 + player.yInZone) * CELL + CELL * 0.5;

    const rage = (mods.lowHpRage && mods.hp <= 3) ? 1 : 0;

    ctx.save();
    ctx.translate(px, py);
    const pulse = 1 + Math.sin(perfNow() * 0.008) * (settings.reduceMotion ? 0.02 : 0.08);
    const r = 18 * pulse;
    ctx.beginPath();
    ctx.fillStyle = rage ? "rgba(255,125,80,1)" : "rgba(122,167,255,1)";
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.stroke();
    ctx.restore();

    // shield aura
    if (mods.shields > 0) {
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(120,210,255,.35)";
      ctx.lineWidth = 5;
      ctx.arc(0, 0, 28 + Math.sin(perfNow() * 0.012) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFx(dt) {
    if (!fctx || !fxCanvas) return;
    fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (let i = FX.length - 1; i >= 0; i--) {
      const p = FX[i];
      p.t -= dt;
      if (p.t <= 0) { FX.splice(i, 1); continue; }

      const a = clamp(p.t / p.life, 0, 1);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;

      fctx.globalAlpha = a * 0.9;
      fctx.fillStyle = p.col;
      fctx.beginPath();
      fctx.arc(p.x, p.y, 4 * p.s, 0, Math.PI * 2);
      fctx.fill();
      fctx.globalAlpha = 1;
    }
  }

  function perfNow() {
    try { return performance.now(); } catch { return Date.now(); }
  }

  // ───────────────────────── Loop ─────────────────────────
  let raf = 0;
  let lastT = 0;

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!lastT) lastT = t;
    let dt = (t - lastT) / 1000;
    lastT = t;

    dt = clamp(dt, 0, 0.05);

    // buff timers
    if (running && !paused) {
      tickBuffs(mods, dt);
      if (mods._scoreBoostTimer) mods._scoreBoostTimer = Math.max(0, mods._scoreBoostTimer - dt);
    }

    // stage timer
    if (running && !paused && mode !== Mode.ENDLESS) {
      stageTimeLeft -= dt;
      if (stageTimeLeft <= 0) {
        if (stageScore >= stageTarget) {
          // si justo llegó
          stageTimeLeft = 0;
        } else {
          endRun("Tiempo agotado");
        }
      }
      if (running && !inUpgrade && stageScore >= stageTarget) {
        stageClear();
      }
    }

    // combo timer
    if (running && !paused && !inUpgrade) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboTimer = mods.comboTime;
        comboIdx = 0;
        comboMult = 1.0;
        newCombo();
      }
    }

    // slow timer
    if (running && !paused && slowTimer > 0) slowTimer = Math.max(0, slowTimer - dt);

    // tick stepping
    if (running && !paused && !inUpgrade) {
      const rageSpeed = (mods.lowHpRage && mods.hp <= 3) ? mods.rageSpeed : 1.0;
      const slowMul = (slowTimer > 0) ? 0.72 : 1.0;
      const fxMul = clamp(settings.fx || 1.0, 0.4, 1.25);

      const effMul = tickMul * rageSpeed * slowMul * fxMul;
      const tickTime = tickBase * (1 / clamp(effMul, 0.35, 3.5));

      tickAcc += dt;
      while (tickAcc >= tickTime && running && !paused && !inUpgrade) {
        tickAcc -= tickTime;
        step();
      }
    }

    // render
    draw();
    drawFx(dt);

    // HUD
    updateHUD();
  }

  // ───────────────────────── Menu / Install / SW Update ─────────────────────────
  function bindTabs() {
    for (const t of tabs) {
      on(t, "click", () => {
        vibrate(8);
        setTab(t.dataset.tab || "play");
      });
    }
  }

  function bindInstall() {
    on(window, "beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) btnInstall.hidden = false;
    });

    on(btnInstall, "click", async () => {
      if (!deferredPrompt) return;
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (_) { }
      deferredPrompt = null;
      if (btnInstall) btnInstall.hidden = true;
    });

    on(window, "appinstalled", () => {
      deferredPrompt = null;
      if (btnInstall) btnInstall.hidden = true;
      toast("Instalado ✅");
    });
  }

  function bindSWUpdateDot() {
    try {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.addEventListener("message", (ev) => {
        const d = ev?.data;
        if (!d) return;
        if (d.type === "SW_UPDATE_READY" || d.type === "sw_update_ready") {
          updateHeaderDot(true);
        }
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // normalmente indica que el SW cambió: mostrar dot
        updateHeaderDot(true);
      });
    } catch (_) { }
  }

  // ───────────────────────── Input ─────────────────────────
  function bindKeyboard() {
    on(window, "keydown", (e) => {
      const k = e.key;

      // bloquear scroll con flechas si estamos jugando
      if (running && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) {
        e.preventDefault();
      }

      if (k === "Escape") {
        if (overlayMenu && !overlayMenu.hidden) { closeMenu(); return; }
        if (overlayUpgrades && !overlayUpgrades.hidden) { closeUpgradeAndContinue(); return; }
        if (overlayPaused && !overlayPaused.hidden) { resume(); return; }
        if (running) { pause(); return; }
        openMenu();
        return;
      }

      if (!running || paused || inUpgrade) return;

      if (k === "ArrowLeft" || k === "a" || k === "A") tryMove(-1, 0);
      else if (k === "ArrowRight" || k === "d" || k === "D") tryMove(+1, 0);
      else if (k === "ArrowUp" || k === "w" || k === "W") tryMove(0, -1);
      else if (k === "ArrowDown" || k === "s" || k === "S") tryMove(0, +1);
    }, { passive: false });
  }

  function bindDpad() {
    if (!dpadBtns || !dpadBtns.length) return;
    for (const b of dpadBtns) {
      const dir = b.dataset.dir || "";
      const move = () => {
        if (dir === "l") tryMove(-1, 0);
        else if (dir === "r") tryMove(+1, 0);
        else if (dir === "u") tryMove(0, -1);
        else if (dir === "d") tryMove(0, +1);
      };
      on(b, "pointerdown", (e) => { e.preventDefault(); move(); }, { passive: false });
      on(b, "click", (e) => { e.preventDefault(); move(); }, { passive: false });
    }
  }

  function pause() {
    if (!running || inUpgrade) return;
    paused = true;
    overlayShow(overlayPaused);
    try { AudioSys.sfx?.("ui"); } catch (_) { }
  }

  function resume() {
    if (!running || inUpgrade) return;
    paused = false;
    overlayHide(overlayPaused);
    try { AudioSys.sfx?.("ui"); } catch (_) { }
  }

  // ───────────────────────── Bind UI ─────────────────────────
  function bindUI() {
    // header
    on(btnHome, "click", () => { vibrate(8); openMenu(); });
    on(btnPause, "click", () => { vibrate(8); pause(); });

    // press start
    on(btnPressStart, "click", async () => {
      vibrate(10);
      try { await AudioSys.unlock?.(); } catch (_) { }
      overlayHide(overlayPress);
      openMenu();
    });

    // menu
    on(btnCloseMenu, "click", () => { vibrate(8); closeMenu(); });

    // play
    on(btnStartEndless, "click", async () => { vibrate(10); try { await AudioSys.unlock?.(); } catch (_) { } startRun(Mode.ENDLESS); });
    on(btnStartArcade, "click", async () => { vibrate(10); try { await AudioSys.unlock?.(); } catch (_) { } startRun(Mode.ARCADE); });
    on(btnStartStory, "click", async () => { vibrate(10); try { await AudioSys.unlock?.(); } catch (_) { } startRun(Mode.STORY); });

    on(btnResumeIfRunning, "click", () => {
      vibrate(8);
      closeMenu();
      if (running) {
        paused = false;
        overlayHide(overlayPaused);
      }
    });

    on(btnHardReset, "click", () => { vibrate(10); hardResetRun(); });

    // paused overlay
    on(btnUnpause, "click", () => { vibrate(8); resume(); });
    on(btnOpenMenuFromPause, "click", () => { vibrate(8); overlayHide(overlayPaused); openMenu(); });

    // upgrades
    on(btnContinue, "click", () => { vibrate(10); closeUpgradeAndContinue(); });
    on(btnReroll, "click", () => { vibrate(8); rerollUpgrades(); });

    // gameover
    on(btnPlayAgain, "click", () => { vibrate(10); overlayHide(overlayGameOver); startRun(mode); });
    on(btnBackToMenu, "click", () => { vibrate(10); overlayHide(overlayGameOver); if (stage) stage.classList.add("isHidden"); openMenu(); });

    // error overlay
    on(btnReload, "click", () => location.reload());
    on(btnRepair, "click", async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (_) { }
      location.reload();
    });

    // emergency
    on(btnEmergencyReload, "click", () => location.reload());
    on(btnEmergencyRepair, "click", async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (_) { }
      location.reload();
    });

    // catalog
    on(btnOpenCatalog, "click", () => {
      vibrate(8);
      if (!catalog) return;
      renderCatalog();
      catalog.hidden = false;
    });
    on(btnCloseCatalog, "click", () => {
      vibrate(8);
      if (catalog) catalog.hidden = true;
    });

    // profiles
    on(profileSelect, "change", () => {
      if (!Auth) return;
      const id = profileSelect.value;
      try { Auth.setActiveProfile?.(id); } catch (_) { }
      ensureProfile();
      renderProfilesUI();
      updateHUD();
    });

    on(btnNewProfile, "click", () => {
      if (!newProfileWrap) return;
      vibrate(8);
      newProfileWrap.hidden = false;
      if (newProfileName) newProfileName.value = "";
      newProfileName?.focus?.();
    });

    on(btnCancelCreateProfile, "click", () => {
      vibrate(8);
      if (newProfileWrap) newProfileWrap.hidden = true;
    });

    on(btnCreateProfile, "click", () => {
      if (!Auth) return;
      const name = (newProfileName?.value || "").trim().slice(0, 16) || "Jugador";
      try { Auth.createProfile?.(name); } catch (_) { }
      if (newProfileWrap) newProfileWrap.hidden = true;
      ensureProfile();
      renderProfilesUI();
      updateHUD();
      vibrate(10);
    });

    on(btnRenameProfile, "click", () => {
      if (!Auth) return;
      const cur = Auth.getActiveProfile?.();
      const name = prompt("Nuevo nombre de perfil:", cur?.name || "Jugador");
      if (!name) return;
      try { Auth.renameActiveProfile?.(String(name).trim().slice(0, 16)); } catch (_) { }
      ensureProfile();
      renderProfilesUI();
      updateHUD();
    });

    on(btnDeleteProfile, "click", () => {
      if (!Auth) return;
      if (!confirm("¿Borrar este perfil?")) return;
      try { Auth.deleteActiveProfile?.(); } catch (_) { }
      ensureProfile();
      renderProfilesUI();
      updateHUD();
    });

    // records
    on(btnClearRecords, "click", () => {
      if (!confirm("¿Borrar historial de runs?")) return;
      lsSet(RUNS_KEY, []);
      renderRecordsUI();
      vibrate(10);
    });

    // options listeners
    on(optUseSprites, "change", () => { settings.useSprites = !!optUseSprites.checked; saveSettings(); });
    on(optVibration, "change", () => { settings.vibration = !!optVibration.checked; saveSettings(); });
    on(optShowDpad, "change", () => { settings.showDpad = !!optShowDpad.checked; saveSettings(); });
    on(optReduceMotion, "change", () => { settings.reduceMotion = !!optReduceMotion.checked; saveSettings(); });
    on(optFx, "input", () => { settings.fx = clamp(Number(optFx.value) || 1.0, 0.4, 1.25); saveSettings(); });

    on(optMusicOn, "change", () => { settings.musicOn = !!optMusicOn.checked; saveSettings(); });
    on(optSfxOn, "change", () => { settings.sfxOn = !!optSfxOn.checked; saveSettings(); });
    on(optMuteAll, "change", () => { settings.muteAll = !!optMuteAll.checked; saveSettings(); });
    on(optMusicVol, "input", () => { settings.musicVol = clamp(Number(optMusicVol.value) || 0, 0, 1); saveSettings(); });
    on(optSfxVol, "input", () => { settings.sfxVol = clamp(Number(optSfxVol.value) || 0, 0, 1); saveSettings(); });

    on(btnTestSfx, "click", () => { try { AudioSys.unlock?.(); AudioSys.sfx?.("ui_click"); } catch (_) { } });
    on(btnTestMusic, "click", () => { try { AudioSys.unlock?.(); AudioSys.startMusic?.(); setTimeout(() => AudioSys.stopMusic?.(), 1200); } catch (_) { } });

    on(btnRepairPwa, "click", async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        toast("PWA reparada. Recargando…");
      } catch (_) {
        toast("No se pudo reparar (pero no pasa nada). Recargando…");
      }
      location.reload();
    });
  }

  // ───────────────────────── Boot ─────────────────────────
  function sanityCheck() {
    if (!gameCanvas || !fxCanvas || !ctx || !fctx) {
      showError("Falta gameCanvas/fxCanvas en el HTML.");
      return false;
    }
    return true;
  }

  function boot() {
    try {
      loadSettings();
      applyAudioSettings();
      applyDpadVisibility();
      setVHVar();

      ensureProfile();

      // stage oculto hasta start
      if (stage) stage.classList.add("isHidden");

      // overlays iniciales
      if (overlayLoading) overlayHide(overlayLoading);
      if (overlayPress) overlayShow(overlayPress);
      if (overlayMenu) overlayHide(overlayMenu);
      if (overlayUpgrades) overlayHide(overlayUpgrades);
      if (overlayPaused) overlayHide(overlayPaused);
      if (overlayGameOver) overlayHide(overlayGameOver);
      if (overlayError) overlayHide(overlayError);

      // disable pause hasta que empiece run
      if (btnPause) btnPause.disabled = true;
      if (btnResumeIfRunning) btnResumeIfRunning.disabled = true;

      bindTabs();
      bindInstall();
      bindSWUpdateDot();
      bindKeyboard();
      bindDpad();
      bindUI();

      setTab("play");
      resetRunCommon();
      setupCanvas();

      // resize hooks
      on(window, "resize", () => { setVHVar(); setupCanvas(); });
      on(window, "orientationchange", () => { setTimeout(() => { setVHVar(); setupCanvas(); }, 100); });

      lastT = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);

      updateHUD();
    } catch (e) {
      showError(e?.message || String(e));
    }
  }

  // ───────────────────────── Global error traps ─────────────────────────
  window.addEventListener("error", (e) => {
    try { showError(e?.message || "Error"); } catch (_) { }
  });
  window.addEventListener("unhandledrejection", (e) => {
    try { showError(e?.reason?.message || String(e?.reason || "Promise error")); } catch (_) { }
  });

  if (sanityCheck()) boot();
})();
