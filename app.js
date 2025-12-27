/* app.js — Grid Rogue v1.1.1 (FIX + MODOS + SHOP/CHEST/KEY + ARCADE 5x20)
   ✅ Compatible con:
   - utils.js (window.GRUtils) opcional
   - audio.js (window.AudioSys) opcional
   - localization.js (window.I18n) opcional
   - auth.js (window.Auth) opcional
   - skills.js (window.GRSkills) ✅

   FIX CLAVE:
   - Evita pantalla en blanco (errores capturados + overlays)
   - SW update: no fuerza reload en mitad de run (aplica en menú / gameover / click)
   - Tiles nuevos: Shop / Chest / Key + UI overlays
   - Menú: Infinito + Arcade (5 zonas x 20 runs, progreso + estrellas)
*/
(() => {
  "use strict";

  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1111";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.1.1");
  const LS_PREFIX = "gridrogue_";

  // ───────────────────────── Helpers ─────────────────────────
  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};
  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => {
    v = Number(v); if (!Number.isFinite(v)) v = a;
    v = v | 0; return Math.max(a, Math.min(b, v));
  });

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => { try { el && el.addEventListener(ev, fn, opt); } catch(_){} };
  const fmt = (n) => (Number(n)||0).toLocaleString("es-ES");

  const lsGet = (k, d=null) => {
    try { const s = localStorage.getItem(LS_PREFIX + k); return (s==null) ? d : JSON.parse(s); } catch(_) { return d; }
  };
  const lsSet = (k, v) => { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch(_){} };
  const lsDel = (k) => { try { localStorage.removeItem(LS_PREFIX + k); } catch(_){} };

  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }

  // ───────────────────────── DOM refs ─────────────────────────
  const el = {
    overlayLoading: $("overlayLoading"),
    overlayPress: $("overlayPress"),
    overlayStart: $("overlayStart"),
    overlayPaused: $("overlayPaused"),
    overlayUpgrades: $("overlayUpgrades"),
    overlayShop: $("overlayShop"),
    overlayChest: $("overlayChest"),
    overlayGameOver: $("overlayGameOver"),
    overlayArcadeComplete: $("overlayArcadeComplete"),
    overlayOptions: $("overlayOptions"),
    overlayError: $("overlayError"),
    overlayCatalog: $("overlayCatalog"),

    errMsg: $("errMsg"),
    btnErrClose: $("btnErrClose"),
    btnErrReload: $("btnErrReload"),

    loadingSub: $("loadingSub"),
    btnEmergencyReload: $("btnEmergencyReload"),
    btnEmergencyRepair: $("btnEmergencyRepair"),

    btnPressStart: $("btnPressStart"),
    pressMeta: $("pressMeta"),

    profileSelect: $("profileSelect"),
    btnNewProfile: $("btnNewProfile"),
    newProfileWrap: $("newProfileWrap"),
    startName: $("startName"),
    btnStart: $("btnStart"),

    btnModeEndless: $("btnModeEndless"),
    btnModeArcade: $("btnModeArcade"),
    arcadeWrap: $("arcadeWrap"),
    arcadeZoneSelect: $("arcadeZoneSelect"),
    arcadeRuns: $("arcadeRuns"),
    arcadeInfo: $("arcadeInfo"),

    btnPause: $("btnPause"),
    btnOptions: $("btnOptions"),

    btnResume: $("btnResume"),
    btnPausedRestart: $("btnPausedRestart"),
    btnQuitToStart: $("btnQuitToStart"),

    upTitle: $("upTitle"),
    upSub: $("upSub"),
    upgradeChoices: $("upgradeChoices"),
    btnReroll: $("btnReroll"),
    btnSkipUpgrade: $("btnSkipUpgrade"),

    shopChoices: $("shopChoices"),
    btnCloseShop: $("btnCloseShop"),
    shopSub: $("shopSub"),

    chestChoices: $("chestChoices"),
    btnCloseChest: $("btnCloseChest"),
    chestSub: $("chestSub"),

    goTitle: $("goTitle"),
    goScoreBig: $("goScoreBig"),
    goBestBig: $("goBestBig"),
    goStats: $("goStats"),
    btnBackToStart: $("btnBackToStart"),
    btnRetry: $("btnRetry"),

    arcadeCompleteTitle: $("arcadeCompleteTitle"),
    arcadeCompleteMeta: $("arcadeCompleteMeta"),
    arcadeStars: $("arcadeStars"),
    btnArcadeMenu: $("btnArcadeMenu"),
    btnArcadeNext: $("btnArcadeNext"),

    btnCloseOptions: $("btnCloseOptions"),
    btnRepairPWA: $("btnRepairPWA"),
    btnClearLocal: $("btnClearLocal"),
    btnTestAudio: $("btnTestAudio"),

    optMusicOn: $("optMusicOn"),
    optSfxOn: $("optSfxOn"),
    optMusicVol: $("optMusicVol"),
    optSfxVol: $("optSfxVol"),
    optMusicVolValue: $("optMusicVolValue"),
    optSfxVolValue: $("optSfxVolValue"),
    optMuteAll: $("optMuteAll"),
    optSprites: $("optSprites"),
    optVibration: $("optVibration"),
    optDpad: $("optDpad"),
    optFx: $("optFx"),
    optFxValue: $("optFxValue"),
    optLang: $("optLang"),

    pillScore: $("pillScore"),
    pillBest: $("pillBest"),
    pillLevel: $("pillLevel"),
    pillMult: $("pillMult"),
    pillKeys: $("pillKeys"),
    pillBank: $("pillBank"),
    pillOffline: $("pillOffline"),
    pillUpdate: $("pillUpdate"),
    pillModeVal: $("pillModeVal"),
    pillPlayer: $("pillPlayer"),

    comboSeq: $("comboSeq"),
    comboTimerVal: $("comboTimerVal"),
    levelProgText: $("levelProgText"),
    levelProgPct: $("levelProgPct"),
    levelProgFill: $("levelProgFill"),
    toast: $("toast"),

    btnInstall: $("btnInstall"),

    overlayCatalogList: $("catalogList"),
    overlayCatalogMeta: $("catalogMeta"),
    btnCloseCatalog: $("btnCloseCatalog"),

    canvas: $("gameCanvas"),
    dpad: $("dpad"),
    btnUp: $("btnUp"),
    btnDown: $("btnDown"),
    btnLeft: $("btnLeft"),
    btnRight: $("btnRight"),
  };

  // ───────────────────────── Safe overlay helpers ─────────────────────────
  function show(overlay) { if (overlay) overlay.hidden = false; }
  function hide(overlay) { if (overlay) overlay.hidden = true; }
  function hideAllOverlays() {
    hide(el.overlayLoading);
    hide(el.overlayPress);
    hide(el.overlayStart);
    hide(el.overlayPaused);
    hide(el.overlayUpgrades);
    hide(el.overlayShop);
    hide(el.overlayChest);
    hide(el.overlayGameOver);
    hide(el.overlayArcadeComplete);
    hide(el.overlayOptions);
    hide(el.overlayError);
    hide(el.overlayCatalog);
  }
  function toast(msg, ms=1200) {
    if (!el.toast) return;
    el.toast.textContent = String(msg || "");
    el.toast.hidden = !msg;
    if (msg) setTimeout(() => { try { el.toast.hidden = true; } catch(_){} }, ms|0);
  }
  function fatal(msg, err) {
    console.error("[GridRogue FATAL]", msg, err || "");
    hideAllOverlays();
    if (el.errMsg) el.errMsg.textContent = String(msg || "Error");
    show(el.overlayError);
  }

  // ───────────────────────── Settings ─────────────────────────
  const Settings = {
    musicOn: true,
    sfxOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,
    sprites: true,
    vibration: true,
    dpad: true,
    fx: 1.0,
    lang: "es",
  };

  function loadSettings() {
    const s = lsGet("settings_v2", null);
    if (s && typeof s === "object") {
      for (const k of Object.keys(Settings)) if (k in s) Settings[k] = s[k];
    }
  }
  function saveSettings() { lsSet("settings_v2", Settings); }

  // ───────────────────────── Profiles (fallback si Auth no existe) ─────────────────────────
  const Auth = (typeof window !== "undefined" && window.Auth) ? window.Auth : null;

  function profKey() { return "profiles_v1"; }
  function getProfiles() {
    if (Auth && typeof Auth.listProfiles === "function") {
      try { return Auth.listProfiles() || []; } catch(_) {}
    }
    const p = lsGet(profKey(), null);
    if (Array.isArray(p) && p.length) return p;
    const def = [{ id: "p1", name: "Jugador", createdAt: Date.now() }];
    lsSet(profKey(), def);
    lsSet("profile_selected", "p1");
    return def;
  }
  function setSelectedProfile(id) {
    if (Auth && typeof Auth.selectProfile === "function") {
      try { Auth.selectProfile(id); return; } catch(_) {}
    }
    lsSet("profile_selected", String(id));
  }
  function getSelectedProfileId() {
    if (Auth && typeof Auth.getSelectedProfile === "function") {
      try { const p = Auth.getSelectedProfile(); if (p && p.id) return String(p.id); } catch(_) {}
    }
    return String(lsGet("profile_selected", "p1"));
  }
  function createProfile(name) {
    const n = String(name || "").trim();
    if (n.length < 2) return null;
    if (Auth && typeof Auth.createProfile === "function") {
      try { return Auth.createProfile(n); } catch(_) {}
    }
    const list = getProfiles().slice();
    const id = "p" + Math.random().toString(16).slice(2, 10);
    const p = { id, name: n, createdAt: Date.now() };
    list.push(p);
    lsSet(profKey(), list);
    setSelectedProfile(id);
    return p;
  }

  // ───────────────────────── Arcade model ─────────────────────────
  const ARCADE = {
    zones: [
      { id:"z1", name:"Zona 1 • Inicio", baseDiff: 0 },
      { id:"z2", name:"Zona 2 • Calle",  baseDiff: 1 },
      { id:"z3", name:"Zona 3 • Docks",  baseDiff: 2 },
      { id:"z4", name:"Zona 4 • Noche",  baseDiff: 3 },
      { id:"z5", name:"Zona 5 • Élite",  baseDiff: 4 },
    ],
    runsPerZone: 20,
  };

  const RUN_TYPES = [
    { id:"t1",  name:"Equilibrado",         mod:(c)=>c },
    { id:"t2",  name:"Más trampas",         mod:(c)=>{ c.pTrap+=0.06; c.pCoin-=0.02; } },
    { id:"t3",  name:"Más bloques",         mod:(c)=>{ c.pBlock+=0.06; c.pBonus-=0.02; } },
    { id:"t4",  name:"Más botín",           mod:(c)=>{ c.pCoin+=0.03; c.pGem+=0.02; c.pBonus+=0.02; } },
    { id:"t5",  name:"Cofres frecuentes",   mod:(c)=>{ c.pChest+=0.02; c.pKey+=0.02; } },
    { id:"t6",  name:"Tiendas frecuentes",  mod:(c)=>{ c.pShop+=0.02; c.pCoin-=0.01; } },
    { id:"t7",  name:"Combo estricto",      mod:(c)=>{ c.comboBase-=0.35; } },
    { id:"t8",  name:"Combo generoso",      mod:(c)=>{ c.comboBase+=0.55; } },
    { id:"t9",  name:"Puntos altos",        mod:(c)=>{ c.coinValue+=1; c.gemValue+=4; c.bonusValue+=6; } },
    { id:"t10", name:"Puntos bajos",        mod:(c)=>{ c.coinValue-=1; c.gemValue-=2; c.bonusValue-=3; } },
    { id:"t11", name:"Llaves escasas",      mod:(c)=>{ c.pKey-=0.02; c.pChest+=0.01; } },
    { id:"t12", name:"Llaves abundantes",   mod:(c)=>{ c.pKey+=0.03; } },
    { id:"t13", name:"Riesgo",              mod:(c)=>{ c.pTrap+=0.03; c.pBlock+=0.03; c.coinValue+=1; } },
    { id:"t14", name:"Defensivo",           mod:(c)=>{ c.pTrap-=0.02; c.pBlock-=0.02; c.pHeart+=0.01; } },
    { id:"t15", name:"Magnet friendly",     mod:(c)=>{ c.pCoin+=0.02; c.pGem+=0.02; } },
    { id:"t16", name:"Tienda cara",         mod:(c)=>{ c.shopInfl+=0.12; } },
    { id:"t17", name:"Tienda barata",       mod:(c)=>{ c.shopInfl-=0.10; } },
    { id:"t18", name:"Cofre raro",          mod:(c)=>{ c.chestLuck+=1; } },
    { id:"t19", name:"Sprint",              mod:(c)=>{ c.targetScoreMul-=0.08; } },
    { id:"t20", name:"Maratón",             mod:(c)=>{ c.targetScoreMul+=0.10; } },
  ];

  function arcadeKey(profileId) { return `arcade_${profileId}_v1`; }
  function arcadeLoad(profileId) {
    const d = lsGet(arcadeKey(profileId), null);
    if (d && typeof d === "object") return d;
    const init = { unlocked: {}, stars: {}, bestScore: {} };
    // desbloquea z1r1
    init.unlocked["z1_r1"] = true;
    lsSet(arcadeKey(profileId), init);
    return init;
  }
  function arcadeSave(profileId, data) { lsSet(arcadeKey(profileId), data); }
  function arcadeId(zoneIndex, runIndex) { return `z${zoneIndex+1}_r${runIndex+1}`; }

  // ───────────────────────── Game config / tiles ─────────────────────────
  const TILE = Object.freeze({
    Empty:  "empty",
    Coin:   "coin",
    Gem:    "gem",
    Bonus:  "bonus",
    Trap:   "trap",
    Block:  "block",
    Heart:  "heart",
    Shop:   "shop",
    Chest:  "chest",
    Key:    "key",
  });

  function tileIcon(t) {
    if (t === TILE.Coin) return "paid";
    if (t === TILE.Gem) return "diamond";
    if (t === TILE.Bonus) return "workspace_premium";
    if (t === TILE.Trap) return "dangerous";
    if (t === TILE.Block) return "stop_circle";
    if (t === TILE.Heart) return "favorite";
    if (t === TILE.Shop) return "storefront";
    if (t === TILE.Chest) return "inventory_2";
    if (t === TILE.Key) return "key";
    return "";
  }

  function baseConfig() {
    return {
      cols: 8,
      rows: 16,

      // probabilidades base (se normaliza)
      pCoin:  0.18,
      pGem:   0.10,
      pBonus: 0.09,
      pTrap:  0.10,
      pBlock: 0.07,
      pHeart: 0.05,
      pShop:  0.05,
      pChest: 0.05,
      pKey:   0.06,

      comboBase: 2.8,
      shopInfl: 1.0,       // multiplicador de precios (extra)
      chestLuck: 0,        // bias extra
      targetScoreMul: 1.0, // arcade

      // valores base (skills los modifican)
      coinValue: 2,
      gemValue:  10,
      bonusValue: 18,
    };
  }

  function normalizeProbs(c) {
    const keys = ["pCoin","pGem","pBonus","pTrap","pBlock","pHeart","pShop","pChest","pKey"];
    let sum = 0;
    for (const k of keys) sum += Math.max(0, Number(c[k]) || 0);
    if (sum <= 0) { c.pCoin = 1; sum = 1; }
    for (const k of keys) c[k] = (Math.max(0, Number(c[k]) || 0) / sum);
  }

  function pickTileType(c) {
    const r = Math.random();
    let a = 0;
    const add = (p, t) => { a += p; if (r <= a) return t; return null; };
    return (
      add(c.pCoin, TILE.Coin) ||
      add(c.pGem, TILE.Gem) ||
      add(c.pBonus, TILE.Bonus) ||
      add(c.pTrap, TILE.Trap) ||
      add(c.pBlock, TILE.Block) ||
      add(c.pHeart, TILE.Heart) ||
      add(c.pShop, TILE.Shop) ||
      add(c.pChest, TILE.Chest) ||
      add(c.pKey, TILE.Key) ||
      TILE.Coin
    );
  }

  // ───────────────────────── State ─────────────────────────
  const State = {
    mode: "endless", // "endless" | "arcade"
    profileId: "p1",
    profileName: "Jugador",

    running: false,
    paused: false,
    inOverlay: false,
    waitingForPress: true,

    // arcade selection
    arcadeZone: 0,
    arcadeRun: 0,
    arcadeTargetScore: 1200,
    arcadeDone: false,

    // game stats
    score: 0,      // acumulado (highscore)
    bank: 0,       // gastable (tienda)
    level: 1,
    xp: 0,
    xpToNext: 220,

    // player
    px: 3,
    py: 7,
    steps: 0,

    // hp
    HP_START: 10,
    HP_CAP: 24,
    hpMax: 10,
    hp: 10,

    // buffs/skills fields (compat skills.js)
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
    scoreBoost: 0,
    coinValue: 2,
    gemValue: 10,
    bonusValue: 18,
    stepScoreBonus: 0,
    mult: 1.0,
    comboTimeBonus: 0,
    rerolls: 0,
    extraUpgradeChoices: 0,
    keys: 0,
    shopDiscount: 0,
    shopPicks: 3,
    chestLuck: 0,
    chestPicks: 3,

    // combo runtime
    comboSeq: [],
    comboIdx: 0,
    comboTimer: 0,
    comboMultAdd: 0, // extra sobre base mult
    comboCompleted: 0,

    // skills runtime
    discoveredSet: new Set(),
    pickedCount: new Map(),

    // board
    cfg: baseConfig(),
    grid: [],
  };

  function bestKey(profileId) { return `best_${profileId}_v1`; }
  function loadBest(profileId) { return clampInt(lsGet(bestKey(profileId), 0), 0, 999999999); }
  function saveBest(profileId, v) { lsSet(bestKey(profileId), clampInt(v, 0, 999999999)); }

  function discKey(profileId) { return `discovered_${profileId}_v1`; }
  function picksKey(profileId) { return `picked_${profileId}_v1`; }
  function loadDiscovered(profileId) {
    const a = lsGet(discKey(profileId), []);
    State.discoveredSet = new Set(Array.isArray(a) ? a.map(String) : []);
  }
  function saveDiscovered(profileId) {
    lsSet(discKey(profileId), Array.from(State.discoveredSet));
  }
  function loadPicked(profileId) {
    const o = lsGet(picksKey(profileId), {});
    const m = new Map();
    if (o && typeof o === "object") for (const k of Object.keys(o)) m.set(k, clampInt(o[k], 0, 9999));
    State.pickedCount = m;
  }
  function savePicked(profileId) {
    const o = {};
    for (const [k,v] of State.pickedCount.entries()) o[k] = v|0;
    lsSet(picksKey(profileId), o);
  }

  // ───────────────────────── Skills integration ─────────────────────────
  function buildSkillsAPI() {
    return {
      // expose state fields (skills.js lee/escribe aquí)
      get HP_CAP() { return State.HP_CAP; },
      get HP_START() { return State.HP_START; },

      get discoveredSet() { return State.discoveredSet; },
      onDiscover: (id) => { saveDiscovered(State.profileId); },

      updateStatusHUD: () => updateHUD(),
      recomputeZone: () => {},

      // compat clamp
      clamp, clampInt,

      // bind fields so skills can set them
      get shields() { return State.shields; }, set shields(v){ State.shields = v|0; },
      get shieldOnLevelUp(){ return State.shieldOnLevelUp; }, set shieldOnLevelUp(v){ State.shieldOnLevelUp = v|0; },
      get blockResist(){ return State.blockResist; }, set blockResist(v){ State.blockResist = v|0; },

      get hpMax(){ return State.hpMax; }, set hpMax(v){ State.hpMax = v|0; },
      get hp(){ return State.hp; }, set hp(v){ State.hp = v|0; },

      get regenEvery(){ return State.regenEvery; }, set regenEvery(v){ State.regenEvery = v|0; },
      get regenAmount(){ return State.regenAmount; }, set regenAmount(v){ State.regenAmount = v|0; },
      get revives(){ return State.revives; }, set revives(v){ State.revives = v|0; },
      get magnet(){ return State.magnet; }, set magnet(v){ State.magnet = v|0; },
      get magnetTime(){ return State.magnetTime; }, set magnetTime(v){ State.magnetTime = Number(v)||0; },

      get trapResist(){ return State.trapResist; }, set trapResist(v){ State.trapResist = v|0; },
      get trapHealChance(){ return State.trapHealChance; }, set trapHealChance(v){ State.trapHealChance = Number(v)||0; },

      get zoneExtra(){ return State.zoneExtra; }, set zoneExtra(v){ State.zoneExtra = v|0; },

      get scoreBoost(){ return State.scoreBoost; }, set scoreBoost(v){ State.scoreBoost = Number(v)||0; },

      get coinValue(){ return State.coinValue; }, set coinValue(v){ State.coinValue = v|0; },
      get gemValue(){ return State.gemValue; }, set gemValue(v){ State.gemValue = v|0; },
      get bonusValue(){ return State.bonusValue; }, set bonusValue(v){ State.bonusValue = v|0; },

      get stepScoreBonus(){ return State.stepScoreBonus; }, set stepScoreBonus(v){ State.stepScoreBonus = v|0; },

      get mult(){ return State.mult; }, set mult(v){ State.mult = Number(v)||1; },
      get comboTimeBonus(){ return State.comboTimeBonus; }, set comboTimeBonus(v){ State.comboTimeBonus = Number(v)||0; },

      get rerolls(){ return State.rerolls; }, set rerolls(v){ State.rerolls = v|0; },
      get extraUpgradeChoices(){ return State.extraUpgradeChoices; }, set extraUpgradeChoices(v){ State.extraUpgradeChoices = v|0; },

      get keys(){ return State.keys; }, set keys(v){ State.keys = v|0; },
      get shopDiscount(){ return State.shopDiscount; }, set shopDiscount(v){ State.shopDiscount = v|0; },
      get shopPicks(){ return State.shopPicks; }, set shopPicks(v){ State.shopPicks = v|0; },

      get chestLuck(){ return State.chestLuck; }, set chestLuck(v){ State.chestLuck = v|0; },
      get chestPicks(){ return State.chestPicks; }, set chestPicks(v){ State.chestPicks = v|0; },
    };
  }

  let Skills = null; // instance pack
  function initSkills() {
    const GRSkills = (typeof window !== "undefined" && window.GRSkills) ? window.GRSkills : null;
    if (!GRSkills || typeof GRSkills.create !== "function") {
      Skills = null;
      return;
    }
    Skills = GRSkills.create(buildSkillsAPI(), State.pickedCount);
  }

  // ───────────────────────── UI update ─────────────────────────
  function setPill(pill, val) {
    if (!pill) return;
    const pv = pill.querySelector(".pv");
    if (pv) pv.textContent = String(val);
  }
  function updateHUD() {
    setPill(el.pillScore, fmt(State.score));
    setPill(el.pillBest, fmt(loadBest(State.profileId)));
    setPill(el.pillLevel, `Lv ${State.level}`);
    setPill(el.pillMult, (effectiveMult()).toFixed(2));
    setPill(el.pillKeys, String(State.keys|0));
    setPill(el.pillBank, fmt(State.bank|0));

    // combo UI
    if (el.comboSeq) {
      el.comboSeq.textContent = State.comboSeq.map(x => x.toUpperCase()).join(" ");
    }
    if (el.comboTimerVal) {
      el.comboTimerVal.textContent = (Math.max(0, State.comboTimer)).toFixed(1);
    }

    // level progress
    const pct = (State.xpToNext > 0) ? clamp((State.xp / State.xpToNext) * 100, 0, 100) : 0;
    if (el.levelProgText) el.levelProgText.textContent = `Lv ${State.level} • ${fmt(State.xp)}/${fmt(State.xpToNext)}`;
    if (el.levelProgPct) el.levelProgPct.textContent = `${pct.toFixed(0)}%`;
    if (el.levelProgFill) el.levelProgFill.style.width = `${pct}%`;
  }

  // ───────────────────────── Canvas / Render ─────────────────────────
  const ctx = el.canvas ? el.canvas.getContext("2d") : null;

  function effectiveMult() {
    return clamp((Number(State.mult)||1) + (Number(State.comboMultAdd)||0), 1.0, 4.0);
  }

  function tileColor(t) {
    switch (t) {
      case TILE.Coin: return "#f7c948";
      case TILE.Gem: return "#4dd2ff";
      case TILE.Bonus: return "#b78cff";
      case TILE.Trap: return "#ff4d4d";
      case TILE.Block: return "#2a2a35";
      case TILE.Heart: return "#ff4fa5";
      case TILE.Shop: return "#48f7c0";
      case TILE.Chest: return "#ff9f43";
      case TILE.Key: return "#ffd166";
      default: return "#12121a";
    }
  }

  function draw() {
    if (!ctx || !el.canvas) return;
    const w = el.canvas.width, h = el.canvas.height;

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0,0,w,h);

    const cols = State.cfg.cols|0;
    const rows = State.cfg.rows|0;
    const pad = 18;
    const cell = Math.floor(Math.min((w - pad*2)/cols, (h - pad*2)/rows));
    const ox = Math.floor((w - cell*cols)/2);
    const oy = Math.floor((h - cell*rows)/2);

    // grid lines
    ctx.globalAlpha = 1;
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const i = y*cols + x;
        const t = State.grid[i]?.t || TILE.Empty;

        const px = ox + x*cell;
        const py = oy + y*cell;

        ctx.fillStyle = tileColor(t);
        ctx.fillRect(px, py, cell, cell);

        // borde suave
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, cell-1, cell-1);

        // icono simple (letra) si sprites off
        if (!Settings.sprites && t !== TILE.Empty) {
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(px+2, py+2, cell-4, cell-4);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = `${Math.max(10, Math.floor(cell*0.42))}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const ch =
            (t===TILE.Coin) ? "C" :
            (t===TILE.Gem) ? "G" :
            (t===TILE.Bonus) ? "B" :
            (t===TILE.Trap) ? "!" :
            (t===TILE.Block) ? "X" :
            (t===TILE.Heart) ? "♥" :
            (t===TILE.Shop) ? "S" :
            (t===TILE.Chest) ? "□" :
            (t===TILE.Key) ? "K" : "";
          ctx.fillText(ch, px + cell/2, py + cell/2);
        }
      }
    }

    // zone highlight (radio = 1 + zoneExtra)
    const zr = 1 + (State.zoneExtra|0);
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#ffffff";
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const d = Math.abs(x - State.px) + Math.abs(y - State.py);
        if (d <= zr) {
          const px = ox + x*cell;
          const py = oy + y*cell;
          ctx.fillRect(px, py, cell, cell);
        }
      }
    }
    ctx.globalAlpha = 1;

    // player
    {
      const px = ox + State.px*cell;
      const py = oy + State.py*cell;
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(px + cell/2, py + cell/2, Math.max(6, cell*0.22), 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // aura si shields
      if ((State.shields|0) > 0) {
        ctx.strokeStyle = "rgba(120,210,255,0.85)";
        ctx.lineWidth = Math.max(2, cell*0.06);
        ctx.beginPath();
        ctx.arc(px + cell/2, py + cell/2, Math.max(10, cell*0.30), 0, Math.PI*2);
        ctx.stroke();
      }
    }
  }

  function canvasToCell(clientX, clientY) {
    if (!el.canvas) return null;
    const r = el.canvas.getBoundingClientRect();
    const x = (clientX - r.left) * (el.canvas.width / r.width);
    const y = (clientY - r.top) * (el.canvas.height / r.height);

    const cols = State.cfg.cols|0;
    const rows = State.cfg.rows|0;
    const pad = 18;
    const cell = Math.floor(Math.min((el.canvas.width - pad*2)/cols, (el.canvas.height - pad*2)/rows));
    const ox = Math.floor((el.canvas.width - cell*cols)/2);
    const oy = Math.floor((el.canvas.height - cell*rows)/2);

    const cx = Math.floor((x - ox) / cell);
    const cy = Math.floor((y - oy) / cell);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
    return { x: cx, y: cy };
  }

  // ───────────────────────── Board generation ─────────────────────────
  function genBoard() {
    const cols = State.cfg.cols|0;
    const rows = State.cfg.rows|0;
    State.grid = new Array(cols*rows);
    for (let i=0;i<State.grid.length;i++) State.grid[i] = { t: TILE.Empty, used:false };
    // rellena aleatorio (evita spawn player)
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const i = y*cols + x;
        if (x === State.px && y === State.py) { State.grid[i].t = TILE.Empty; continue; }
        State.grid[i].t = pickTileType(State.cfg);
      }
    }
  }

  function rerollFarTiles() {
    // mantiene la sensación de run infinito (rellena lejos)
    const cols = State.cfg.cols|0, rows = State.cfg.rows|0;
    const keep = 3 + (State.zoneExtra|0); // zona + margen
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const d = Math.abs(x - State.px) + Math.abs(y - State.py);
        const i = y*cols + x;
        const cell = State.grid[i];
        if (!cell) continue;
        if (d > keep && cell.used) {
          cell.used = false;
          cell.t = pickTileType(State.cfg);
        }
      }
    }
  }

  // ───────────────────────── Game flow ─────────────────────────
  function resetRunCore() {
    State.running = false;
    State.paused = false;
    State.inOverlay = false;
    State.arcadeDone = false;

    State.score = 0;
    State.bank = 0;
    State.level = 1;
    State.xp = 0;
    State.xpToNext = 220;

    State.px = 3;
    State.py = 7;
    State.steps = 0;

    State.hpMax = State.HP_START|0;
    State.hp = State.hpMax|0;

    State.shields = 0;
    State.shieldOnLevelUp = 0;
    State.blockResist = 0;
    State.regenEvery = 0;
    State.regenAmount = 0;
    State.revives = 0;
    State.magnet = 0;
    State.magnetTime = 0;
    State.trapResist = 0;
    State.trapHealChance = 0;
    State.zoneExtra = 0;
    State.scoreBoost = 0;
    State.coinValue = 2;
    State.gemValue = 10;
    State.bonusValue = 18;
    State.stepScoreBonus = 0;
    State.mult = 1.0;
    State.comboTimeBonus = 0;
    State.rerolls = 0;
    State.extraUpgradeChoices = 0;
    State.keys = 0;
    State.shopDiscount = 0;
    State.shopPicks = 3;
    State.chestLuck = 0;
    State.chestPicks = 3;

    State.comboSeq = [];
    State.comboIdx = 0;
    State.comboTimer = 0;
    State.comboMultAdd = 0;
    State.comboCompleted = 0;

    // skills init (usa picked/discovered persistentes)
    initSkills();

    // combo start
    makeNewCombo();
  }

  function makeNewCombo() {
    const dirs = ["w","a","s","d"];
    State.comboSeq = [];
    for (let i=0;i<4;i++) State.comboSeq.push(dirs[(Math.random()*dirs.length)|0]);
    State.comboIdx = 0;
    State.comboTimer = (State.cfg.comboBase + (Number(State.comboTimeBonus)||0));
  }

  function addScore(amount) {
    const a = Math.max(0, Number(amount)||0);
    const boosted = a * (1.0 + clamp(Number(State.scoreBoost)||0, 0, 10));
    const m = effectiveMult();
    const gain = Math.round(boosted * m);
    State.score += gain;
    State.bank += gain;
    State.xp += Math.round(gain * 0.55); // xp derivada para level up
  }

  function levelUpIfNeeded() {
    while (State.xp >= State.xpToNext) {
      State.xp -= State.xpToNext;
      State.level += 1;
      State.xpToNext = Math.round(220 * (1 + (State.level-1) * 0.12));

      if ((State.shieldOnLevelUp|0) > 0) State.shields += (State.shieldOnLevelUp|0);

      sfx("sfx_levelup");
      openUpgrades();
    }
  }

  function heal(n) {
    const a = clampInt(n|0, 0, 999);
    if (a <= 0) return;
    State.hp = clampInt((State.hp|0) + a, 0, State.hpMax|0);
  }

  function damage(n) {
    const a = clampInt(n|0, 0, 999);
    if (a <= 0) return;
    State.hp = clampInt((State.hp|0) - a, 0, State.hpMax|0);
    if ((State.hp|0) <= 0) {
      if ((State.revives|0) > 0) {
        State.revives -= 1;
        State.hp = 1;
        toast("Fénix: revives con 1♥", 1400);
        updateHUD();
        return;
      }
      gameOver();
    }
  }

  function applyTrap() {
    // prob de ignorar trampa por trapResist (6% por stack)
    const resist = clampInt(State.trapResist|0, 0, 12);
    const ignoreChance = clamp(resist * 0.06, 0, 0.75);
    if (Math.random() < ignoreChance) {
      toast("Trampa resistida", 900);
      return;
    }
    // posible curación
    if (Math.random() < clamp(Number(State.trapHealChance)||0, 0, 0.95)) {
      heal(1);
      toast("Sangre fría: +1♥", 900);
      return;
    }
    damage(1);
    sfx("sfx_trap");
  }

  function applyBlock() {
    if ((State.shields|0) > 0) {
      State.shields -= 1;
      toast("Escudo bloquea KO", 900);
      sfx("sfx_ko");
      return;
    }
    if ((State.blockResist|0) > 0) {
      State.blockResist -= 1;
      damage(2);
      toast("Anti-KO: -2♥", 900);
      sfx("sfx_ko");
      return;
    }
    // KO directo
    State.hp = 0;
    sfx("sfx_ko");
    gameOver();
  }

  function consumeTile(x, y) {
    const cols = State.cfg.cols|0;
    const i = y*cols + x;
    const cell = State.grid[i];
    if (!cell || cell.used) return;
    cell.used = true;

    const t = cell.t;
    cell.t = TILE.Empty;

    // paso rentable (siempre)
    const stepBonus = clampInt(State.stepScoreBonus|0, 0, 999);
    if (stepBonus > 0) addScore(stepBonus);

    // tile effect
    if (t === TILE.Coin) { addScore(clampInt(State.coinValue|0, 1, 9999)); sfx("sfx_coin"); }
    else if (t === TILE.Gem) { addScore(clampInt(State.gemValue|0, 1, 9999)); sfx("sfx_gem"); }
    else if (t === TILE.Bonus) { addScore(clampInt(State.bonusValue|0, 1, 9999)); sfx("sfx_bonus"); }
    else if (t === TILE.Heart) { heal(1); toast("+1♥", 800); }
    else if (t === TILE.Trap) { applyTrap(); }
    else if (t === TILE.Block) { applyBlock(); }
    else if (t === TILE.Key) { State.keys += 1; toast("+1 llave", 900); sfx("sfx_pick"); }
    else if (t === TILE.Shop) { openShop(); }
    else if (t === TILE.Chest) { openChest(); }

    updateHUD();
    levelUpIfNeeded();

    // arcade win check
    if (State.mode === "arcade" && !State.arcadeDone) {
      if ((State.score|0) >= (State.arcadeTargetScore|0)) {
        arcadeComplete();
      }
    }
  }

  function magnetSweep() {
    const lvl = clampInt(State.magnet|0, 0, 3);
    if (lvl <= 0) return;
    // recoge alrededor (manhattan)
    const cols = State.cfg.cols|0, rows = State.cfg.rows|0;
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        const d = Math.abs(x - State.px) + Math.abs(y - State.py);
        if (d <= lvl) {
          const i = y*cols + x;
          const cell = State.grid[i];
          if (!cell || cell.used) continue;
          if (cell.t === TILE.Coin || cell.t === TILE.Gem || cell.t === TILE.Bonus || cell.t === TILE.Key || cell.t === TILE.Heart) {
            consumeTile(x,y);
          }
        }
      }
    }
  }

  function handleCombo(dir) {
    if (!State.comboSeq.length) return;
    const need = State.comboSeq[State.comboIdx];
    if (dir === need) {
      State.comboIdx++;
      State.comboTimer = (State.cfg.comboBase + (Number(State.comboTimeBonus)||0));
      if (State.comboIdx >= State.comboSeq.length) {
        State.comboIdx = 0;
        State.comboCompleted++;
        State.comboMultAdd = clamp((State.comboMultAdd + 0.10), 0, 3.0);
        toast(`Combo! +mult`, 900);
        sfx("sfx_combo");
        makeNewCombo();
      }
    } else {
      // pequeña penalización suave
      State.comboMultAdd = clamp(State.comboMultAdd - 0.05, 0, 3.0);
      State.comboIdx = 0;
    }
  }

  function tryMoveTo(nx, ny, dirChar) {
    if (!State.running || State.paused || State.inOverlay) return false;

    const cols = State.cfg.cols|0, rows = State.cfg.rows|0;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;

    // move
    State.px = nx;
    State.py = ny;
    State.steps++;

    // combo
    handleCombo(dirChar);

    // consume tile
    consumeTile(nx, ny);

    // regen
    if ((State.regenEvery|0) > 0 && (State.regenAmount|0) > 0) {
      if ((State.steps|0) > 0 && (State.steps % State.regenEvery) === 0) {
        if ((State.hp|0) < (State.hpMax|0)) {
          heal(State.regenAmount|0);
          toast(`Regen +${State.regenAmount}♥`, 900);
        }
      }
    }

    // magnet time countdown is real-time (tick), pero sweep aquí da sensación inmediata
    if ((State.magnetTime|0) > 0) magnetSweep();

    rerollFarTiles();
    updateHUD();
    draw();
    return true;
  }

  function moveDir(dx, dy, dirChar) {
    return tryMoveTo(State.px + dx, State.py + dy, dirChar);
  }

  // click move dentro de zona
  function tryClickMove(cx, cy) {
    const zr = 1 + (State.zoneExtra|0);
    const d = Math.abs(cx - State.px) + Math.abs(cy - State.py);
    if (d <= 0 || d > zr) return;
    // mueve 1 paso hacia el objetivo (simple)
    const dx = (cx > State.px) ? 1 : (cx < State.px) ? -1 : 0;
    const dy = (cy > State.py) ? 1 : (cy < State.py) ? -1 : 0;
    if (dx !== 0) moveDir(dx, 0, (dx>0)?"d":"a");
    else if (dy !== 0) moveDir(0, dy, (dy>0)?"s":"w");
  }

  function pauseGame() { State.paused = true; }
  function resumeGame() { State.paused = false; }

  function gameOver() {
    State.running = false;
    State.paused = true;
    State.inOverlay = true;

    sfx("sfx_gameover");

    const best = loadBest(State.profileId);
    if ((State.score|0) > (best|0)) saveBest(State.profileId, State.score|0);

    if (el.goTitle) el.goTitle.textContent = "Game Over";
    if (el.goScoreBig) el.goScoreBig.textContent = fmt(State.score);
    if (el.goBestBig) el.goBestBig.textContent = fmt(loadBest(State.profileId));

    if (el.goStats) {
      el.goStats.innerHTML = `
        <div class="tiny muted">Puntos gastables: <b>${fmt(State.bank|0)}</b></div>
        <div class="tiny muted">Nivel: <b>${State.level}</b> • Pasos: <b>${State.steps}</b></div>
        <div class="tiny muted">Llaves: <b>${State.keys|0}</b> • Escudos: <b>${State.shields|0}</b></div>
      `;
    }

    hideAllOverlays();
    show(el.overlayGameOver);
  }

  function arcadeComplete() {
    State.arcadeDone = true;
    State.running = false;
    State.paused = true;
    State.inOverlay = true;

    // estrellas: 1 por completar, +1 si hp>=60%, +1 si sin revive y pasos <= targetSteps
    const hpPct = (State.hpMax>0) ? (State.hp/State.hpMax) : 0;
    let stars = 1;
    if (hpPct >= 0.60) stars++;
    if ((State.revives|0) === 0 && (State.steps|0) <= Math.round(140 + State.arcadeRun*6)) stars++;

    const pid = State.profileId;
    const data = arcadeLoad(pid);
    const zid = State.arcadeZone|0;
    const rid = State.arcadeRun|0;
    const id = arcadeId(zid, rid);

    data.stars[id] = Math.max(data.stars[id]||0, stars);
    data.bestScore[id] = Math.max(data.bestScore[id]||0, State.score|0);

    // unlock next
    const nextRun = rid + 1;
    const nextZone = zid + ((nextRun >= ARCADE.runsPerZone) ? 1 : 0);
    const nextRunInZone = (nextRun >= ARCADE.runsPerZone) ? 0 : nextRun;

    if (nextZone < ARCADE.zones.length) {
      data.unlocked[arcadeId(nextZone, nextRunInZone)] = true;
    }

    arcadeSave(pid, data);

    if (el.arcadeCompleteTitle) el.arcadeCompleteTitle.textContent = "Run completado";
    if (el.arcadeCompleteMeta) {
      el.arcadeCompleteMeta.textContent =
        `${ARCADE.zones[zid].name} • Run ${rid+1}/${ARCADE.runsPerZone} • Objetivo ${fmt(State.arcadeTargetScore)} • Score ${fmt(State.score)}`;
    }
    if (el.arcadeStars) el.arcadeStars.textContent = "★".repeat(stars) + "☆".repeat(3-stars);

    hideAllOverlays();
    show(el.overlayArcadeComplete);

    // botón next (si existe)
    if (el.btnArcadeNext) el.btnArcadeNext.disabled = !(nextZone < ARCADE.zones.length);
  }

  // ───────────────────────── Upgrades / Shop / Chest UI ─────────────────────────
  function mkCard(u, subtitle, rightTag) {
    const icon = (Skills && Skills.upgradeIcon) ? Skills.upgradeIcon(u) : "upgrade";
    const rar = u.rarity || "common";
    const name = u.name || "Mejora";
    const desc = u.desc || "";
    const tag = u.tag || "General";
    const rt = rightTag ? `<span class="tiny muted">${rightTag}</span>` : "";
    return `
      <button class="upgradeCard rarity-${rar}" data-uid="${String(u.id||"")}">
        <div class="uTop">
          <span class="ms" aria-hidden="true">${icon}</span>
          <div class="uText">
            <div class="uName">${name}</div>
            <div class="uDesc">${desc}</div>
          </div>
        </div>
        <div class="uMeta">
          <span class="tiny muted">${tag}</span>
          <span class="tiny muted">${subtitle||""}</span>
          ${rt}
        </div>
      </button>
    `;
  }

  function openUpgrades() {
    if (!Skills) return;

    State.inOverlay = true;
    pauseGame();

    const n = clampInt(3 + (State.extraUpgradeChoices|0), 3, 7);
    const offers = Skills.chooseLevelUp({ level: State.level|0, n });

    if (el.upgradeChoices) {
      el.upgradeChoices.innerHTML = offers.map(u => mkCard(u, (u.rarity||"").toUpperCase())).join("");
      // click
      el.upgradeChoices.querySelectorAll("button[data-uid]").forEach(btn => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-uid");
          const u = offers.find(x => String(x.id) === String(id));
          if (!u) return;
          Skills.pick(u);
          savePicked(State.profileId);
          saveDiscovered(State.profileId);
          closeUpgrades();
        });
      });
    }

    if (el.btnReroll) el.btnReroll.disabled = ((State.rerolls|0) <= 0);
    hideAllOverlays();
    show(el.overlayUpgrades);
    updateHUD();
  }

  function closeUpgrades() {
    hide(el.overlayUpgrades);
    State.inOverlay = false;
    resumeGame();
    draw();
  }

  function openShop() {
    if (!Skills) return;
    State.inOverlay = true;
    pauseGame();

    const n = clampInt(State.shopPicks|0, 3, 7);
    const offers = Skills.chooseShop({ level: State.level|0, n });

    if (el.shopSub) el.shopSub.textContent = `Banco: ${fmt(State.bank|0)} • Compra una mejora`;
    if (el.shopChoices) {
      el.shopChoices.innerHTML = offers.map(u => {
        const base = Skills.price(u, State.level|0);
        const extra = Math.round(base * Math.max(0.75, Number(State.cfg.shopInfl)||1));
        const finalPrice = clampInt(extra, 40, 999999);
        return mkCard(u, `Precio: ${fmt(finalPrice)}`, `Banco: ${fmt(State.bank|0)}`).replace(
          `data-uid="${String(u.id||"")}"`,
          `data-uid="${String(u.id||"")}" data-price="${finalPrice}"`
        );
      }).join("");

      el.shopChoices.querySelectorAll("button[data-uid]").forEach(btn => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-uid");
          const price = clampInt(btn.getAttribute("data-price"), 0, 999999);
          const u = offers.find(x => String(x.id) === String(id));
          if (!u) return;
          if ((State.bank|0) < price) {
            toast("No tienes suficientes puntos", 1100);
            return;
          }
          State.bank -= price;
          Skills.pick(u);
          savePicked(State.profileId);
          saveDiscovered(State.profileId);
          sfx("sfx_ui_click");
          closeShop();
        });
      });
    }

    hideAllOverlays();
    show(el.overlayShop);
    updateHUD();
  }

  function closeShop() {
    hide(el.overlayShop);
    State.inOverlay = false;
    resumeGame();
    draw();
  }

  function openChest() {
    if (!Skills) return;
    State.inOverlay = true;
    pauseGame();

    if ((State.keys|0) <= 0) {
      if (el.chestSub) el.chestSub.textContent = "No tienes llaves. Busca un tile Key.";
      if (el.chestChoices) el.chestChoices.innerHTML = `<div class="tiny muted">Necesitas 1 llave para abrir el cofre.</div>`;
      hideAllOverlays();
      show(el.overlayChest);
      return;
    }

    // consume key
    State.keys -= 1;

    // n picks
    const n = clampInt(State.chestPicks|0, 3, 7);
    const offers = Skills.chooseChest({ level: State.level|0, n });

    if (el.chestSub) el.chestSub.textContent = `Cofre abierto • Elige 1 mejora (llaves: ${State.keys|0})`;
    if (el.chestChoices) {
      el.chestChoices.innerHTML = offers.map(u => mkCard(u, "GRATIS", (u.rarity||"").toUpperCase())).join("");
      el.chestChoices.querySelectorAll("button[data-uid]").forEach(btn => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-uid");
          const u = offers.find(x => String(x.id) === String(id));
          if (!u) return;
          Skills.pick(u);
          savePicked(State.profileId);
          saveDiscovered(State.profileId);
          sfx("sfx_pick");
          closeChest();
        });
      });
    }

    hideAllOverlays();
    show(el.overlayChest);
    updateHUD();
  }

  function closeChest() {
    hide(el.overlayChest);
    State.inOverlay = false;
    resumeGame();
    draw();
  }

  // ───────────────────────── Catalog UI ─────────────────────────
  function openCatalog() {
    if (!Skills) return;
    State.inOverlay = true;
    pauseGame();

    const all = Skills.getCatalog({ discoveredOnly: false });
    const disc = all.filter(x => x.discovered).length;
    if (el.overlayCatalogMeta) el.overlayCatalogMeta.textContent = `Descubiertas: ${disc}/${all.length}`;

    if (el.overlayCatalogList) {
      el.overlayCatalogList.innerHTML = all.map(it => {
        const s = it.discovered ? "" : "opacity:0.55; filter:saturate(0.3);";
        const stars = it.picked ? ` • x${it.picked}` : "";
        return `
          <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.08); border-radius:10px; margin-bottom:8px; ${s}">
            <div style="display:flex; gap:10px; align-items:center;">
              <span class="ms" aria-hidden="true">${it.icon || "upgrade"}</span>
              <div style="flex:1;">
                <div style="font-weight:700;">${it.name}${stars}</div>
                <div class="tiny muted">${it.desc}</div>
                <div class="tiny muted">${it.tag} • ${it.rarity} • Lvl ${it.unlockAt}${it.secret ? " • Secreta" : ""}</div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    hideAllOverlays();
    show(el.overlayCatalog);
  }

  function closeCatalog() {
    hide(el.overlayCatalog);
    State.inOverlay = false;
    resumeGame();
    draw();
  }

  // ───────────────────────── Audio wrappers ─────────────────────────
  const AudioSys = (typeof window !== "undefined" && window.AudioSys) ? window.AudioSys : null;

  function audioApplySettings() {
    try {
      if (!AudioSys) return;
      if (typeof AudioSys.setMusicEnabled === "function") AudioSys.setMusicEnabled(!!Settings.musicOn);
      if (typeof AudioSys.setSfxEnabled === "function") AudioSys.setSfxEnabled(!!Settings.sfxOn);
      if (typeof AudioSys.setMusicVolume === "function") AudioSys.setMusicVolume(Number(Settings.musicVol)||0.6);
      if (typeof AudioSys.setSfxVolume === "function") AudioSys.setSfxVolume(Number(Settings.sfxVol)||0.9);
      if (typeof AudioSys.setMuteAll === "function") AudioSys.setMuteAll(!!Settings.muteAll);
    } catch (_) {}
  }

  function sfx(name) {
    if (Settings.muteAll || !Settings.sfxOn) return;
    try {
      if (AudioSys && typeof AudioSys.play === "function") AudioSys.play(name);
    } catch (_) {}
  }

  async function unlockAudio() {
    try {
      if (AudioSys && typeof AudioSys.unlock === "function") await AudioSys.unlock();
      if (AudioSys && typeof AudioSys.startBgm === "function") AudioSys.startBgm("bgm_loop");
    } catch (_) {}
  }

  // ───────────────────────── Options UI bind ─────────────────────────
  function bindOptions() {
    if (el.optMusicOn) el.optMusicOn.checked = !!Settings.musicOn;
    if (el.optSfxOn) el.optSfxOn.checked = !!Settings.sfxOn;
    if (el.optMusicVol) el.optMusicVol.value = String(Settings.musicVol);
    if (el.optSfxVol) el.optSfxVol.value = String(Settings.sfxVol);
    if (el.optMusicVolValue) el.optMusicVolValue.textContent = (Number(Settings.musicVol)||0).toFixed(2);
    if (el.optSfxVolValue) el.optSfxVolValue.textContent = (Number(Settings.sfxVol)||0).toFixed(2);
    if (el.optMuteAll) el.optMuteAll.checked = !!Settings.muteAll;
    if (el.optSprites) el.optSprites.checked = !!Settings.sprites;
    if (el.optVibration) el.optVibration.checked = !!Settings.vibration;
    if (el.optDpad) el.optDpad.checked = !!Settings.dpad;
    if (el.optFx) el.optFx.value = String(Settings.fx);
    if (el.optFxValue) el.optFxValue.textContent = (Number(Settings.fx)||1).toFixed(2);

    on(el.optMusicOn, "change", () => { Settings.musicOn = !!el.optMusicOn.checked; saveSettings(); audioApplySettings(); });
    on(el.optSfxOn, "change", () => { Settings.sfxOn = !!el.optSfxOn.checked; saveSettings(); audioApplySettings(); });
    on(el.optMusicVol, "input", () => { Settings.musicVol = Number(el.optMusicVol.value)||0; if (el.optMusicVolValue) el.optMusicVolValue.textContent = (Settings.musicVol).toFixed(2); saveSettings(); audioApplySettings(); });
    on(el.optSfxVol, "input", () => { Settings.sfxVol = Number(el.optSfxVol.value)||0; if (el.optSfxVolValue) el.optSfxVolValue.textContent = (Settings.sfxVol).toFixed(2); saveSettings(); audioApplySettings(); });
    on(el.optMuteAll, "change", () => { Settings.muteAll = !!el.optMuteAll.checked; saveSettings(); audioApplySettings(); });

    on(el.optSprites, "change", () => { Settings.sprites = !!el.optSprites.checked; saveSettings(); draw(); });
    on(el.optVibration, "change", () => { Settings.vibration = !!el.optVibration.checked; saveSettings(); });
    on(el.optDpad, "change", () => { Settings.dpad = !!el.optDpad.checked; saveSettings(); refreshDpadVisibility(); });
    on(el.optFx, "input", () => { Settings.fx = Number(el.optFx.value)||1; if (el.optFxValue) el.optFxValue.textContent = (Settings.fx).toFixed(2); saveSettings(); });

    on(el.btnTestAudio, "click", () => { sfx("sfx_ui_click"); sfx("sfx_pick"); });

    on(el.btnRepairPWA, "click", async () => {
      try {
        // usa tu repair param
        const qs = new URLSearchParams(location.search);
        qs.set("repair", "1");
        location.href = location.pathname + "?" + qs.toString();
      } catch (_) {}
    });

    on(el.btnClearLocal, "click", () => {
      try {
        // borra SOLO gridrogue_*
        const kill = [];
        for (let i=0;i<localStorage.length;i++){
          const k = localStorage.key(i);
          if (k && k.startsWith(LS_PREFIX)) kill.push(k);
        }
        kill.forEach(k => localStorage.removeItem(k));
        location.reload();
      } catch (_) {}
    });
  }

  // ───────────────────────── Menu (modes + arcade selection) ─────────────────────────
  function renderProfiles() {
    const list = getProfiles();
    const sel = getSelectedProfileId();

    if (el.profileSelect) {
      el.profileSelect.innerHTML = list.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
      el.profileSelect.value = sel;
    }

    const p = list.find(x => String(x.id) === String(sel)) || list[0];
    State.profileId = p ? String(p.id) : "p1";
    State.profileName = p ? String(p.name) : "Jugador";

    loadDiscovered(State.profileId);
    loadPicked(State.profileId);
    initSkills();
    updateHUD();
  }

  function setMode(mode) {
    State.mode = mode;
    if (el.btnModeEndless) el.btnModeEndless.classList.toggle("primary", mode === "endless");
    if (el.btnModeArcade) el.btnModeArcade.classList.toggle("primary", mode === "arcade");
    if (el.arcadeWrap) el.arcadeWrap.hidden = (mode !== "arcade");
  }

  function arcadeBuildSelectors() {
    if (!el.arcadeZoneSelect) return;
    el.arcadeZoneSelect.innerHTML = ARCADE.zones.map((z, i) => `<option value="${i}">${z.name}</option>`).join("");
    el.arcadeZoneSelect.value = String(State.arcadeZone|0);

    const pid = State.profileId;
    const data = arcadeLoad(pid);

    function runRow(zoneIndex, runIndex) {
      const id = arcadeId(zoneIndex, runIndex);
      const unlocked = !!data.unlocked[id];
      const stars = clampInt(data.stars[id]||0, 0, 3);
      const best = clampInt(data.bestScore[id]||0, 0, 999999999);

      const btnClass = unlocked ? "btn" : "btn danger";
      const starsText = "★".repeat(stars) + "☆".repeat(3-stars);
      return `
        <button class="${btnClass}" data-run="${runIndex}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; margin-bottom:6px;">
          <span>Run ${runIndex+1}</span>
          <span class="tiny muted">${unlocked ? starsText : "BLOQUEADO"}${unlocked && best>0 ? " • "+fmt(best) : ""}</span>
        </button>
      `;
    }

    function renderRuns() {
      const z = clampInt(Number(el.arcadeZoneSelect.value), 0, ARCADE.zones.length-1);
      State.arcadeZone = z;

      let html = "";
      for (let r=0;r<ARCADE.runsPerZone;r++) html += runRow(z, r);
      if (el.arcadeRuns) el.arcadeRuns.innerHTML = html;

      const buttons = el.arcadeRuns ? Array.from(el.arcadeRuns.querySelectorAll("button[data-run]")) : [];
      buttons.forEach(b => {
        on(b, "click", () => {
          const rid = clampInt(Number(b.getAttribute("data-run")), 0, ARCADE.runsPerZone-1);
          const id = arcadeId(State.arcadeZone, rid);
          if (!data.unlocked[id]) { toast("Ese run está bloqueado", 1000); return; }
          State.arcadeRun = rid;
          buttons.forEach(x => x.classList.remove("primary"));
          b.classList.add("primary");
          if (el.arcadeInfo) el.arcadeInfo.textContent = `Seleccionado: ${ARCADE.zones[State.arcadeZone].name} • Run ${rid+1}`;
        });
      });

      // marca seleccionado
      const pick = buttons.find(b => Number(b.getAttribute("data-run")) === (State.arcadeRun|0));
      if (pick) pick.classList.add("primary");
    }

    on(el.arcadeZoneSelect, "change", () => { renderRuns(); });

    renderRuns();
  }

  function openStartMenu() {
    State.running = false;
    State.paused = true;
    State.inOverlay = true;

    renderProfiles();
    setMode(State.mode || "endless");
    arcadeBuildSelectors();

    hideAllOverlays();
    show(el.overlayStart);
  }

  // ───────────────────────── Start run (endless/arcade) ─────────────────────────
  function buildArcadeConfig() {
    const z = clampInt(State.arcadeZone|0, 0, ARCADE.zones.length-1);
    const r = clampInt(State.arcadeRun|0, 0, ARCADE.runsPerZone-1);

    const cfg = baseConfig();
    cfg.cols = 8;
    cfg.rows = 16;

    const zone = ARCADE.zones[z];
    const diff = (zone.baseDiff|0) + Math.floor(r / 4);

    // dificultad: más peligro y un poco menos corazones
    cfg.pTrap += diff * 0.01;
    cfg.pBlock += diff * 0.008;
    cfg.pHeart = Math.max(0.03, cfg.pHeart - diff * 0.004);

    // tipo de run (20 tipos)
    const t = RUN_TYPES[r % RUN_TYPES.length];
    try { t.mod(cfg); } catch (_) {}

    normalizeProbs(cfg);

    // objetivo (score acumulado)
    const baseTarget = 1200 + (z*ARCADE.runsPerZone + r) * 95;
    const mul = clamp(Number(cfg.targetScoreMul)||1, 0.75, 1.5);
    State.arcadeTargetScore = Math.round(baseTarget * mul);

    // aplica
    State.cfg = cfg;

    return { zoneIndex: z, runIndex: r, type: t };
  }

  function buildEndlessConfig() {
    const cfg = baseConfig();
    cfg.cols = 8;
    cfg.rows = 16;
    normalizeProbs(cfg);
    State.cfg = cfg;
  }

  function startRun() {
    try {
      // profile
      const sel = el.profileSelect ? String(el.profileSelect.value||"") : getSelectedProfileId();
      if (sel) setSelectedProfile(sel);
      renderProfiles();

      // crear perfil si estaba en modo "nuevo"
      if (el.newProfileWrap && !el.newProfileWrap.hidden) {
        const name = el.startName ? el.startName.value : "";
        const p = createProfile(name);
        if (!p) { toast("Nombre demasiado corto", 1100); return; }
        renderProfiles();
      }

      // config
      if (State.mode === "arcade") {
        const pid = State.profileId;
        const data = arcadeLoad(pid);
        const id = arcadeId(State.arcadeZone|0, State.arcadeRun|0);
        if (!data.unlocked[id]) { toast("Ese run está bloqueado", 1100); return; }
        buildArcadeConfig();
      } else {
        buildEndlessConfig();
      }

      resetRunCore();
      genBoard();
      updateHUD();

      State.running = true;
      State.paused = false;
      State.inOverlay = false;
      hideAllOverlays();

      draw();
    } catch (e) {
      fatal("No se pudo iniciar el run (error en JS).", e);
    }
  }

  // ───────────────────────── Input ─────────────────────────
  function refreshDpadVisibility() {
    const isTouch = matchMedia && matchMedia("(pointer: coarse)").matches;
    const showDpad = !!Settings.dpad && !!isTouch;
    if (el.dpad) el.dpad.hidden = !showDpad;
  }

  function bindInput() {
    on(document, "keydown", (ev) => {
      const k = (ev.key||"").toLowerCase();
      if (k === "escape") { togglePause(); return; }

      if (State.inOverlay) return;

      if (k === "arrowup" || k === "w") moveDir(0,-1,"w");
      else if (k === "arrowdown" || k === "s") moveDir(0, 1,"s");
      else if (k === "arrowleft" || k === "a") moveDir(-1,0,"a");
      else if (k === "arrowright" || k === "d") moveDir( 1,0,"d");
    });

    // dpad
    on(el.btnUp, "click", () => moveDir(0,-1,"w"));
    on(el.btnDown, "click", () => moveDir(0, 1,"s"));
    on(el.btnLeft, "click", () => moveDir(-1,0,"a"));
    on(el.btnRight, "click", () => moveDir( 1,0,"d"));

    // click on canvas (zona)
    on(el.canvas, "pointerdown", (e) => {
      if (State.inOverlay || !State.running) return;
      const c = canvasToCell(e.clientX, e.clientY);
      if (!c) return;
      tryClickMove(c.x, c.y);
    });

    // swipe (simple)
    let sx=0, sy=0, st=0;
    on(el.canvas, "touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = Date.now();
    }, { passive:true });

    on(el.canvas, "touchend", (e) => {
      const dt = Date.now() - st;
      if (dt > 450) return;
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 18 && ay < 18) return;
      if (ax > ay) {
        if (dx > 0) moveDir(1,0,"d"); else moveDir(-1,0,"a");
      } else {
        if (dy > 0) moveDir(0,1,"s"); else moveDir(0,-1,"w");
      }
    }, { passive:true });
  }

  // ───────────────────────── Pause/Overlays buttons ─────────────────────────
  function togglePause() {
    if (!State.running) return;
    if (State.inOverlay) return;

    if (!State.paused) {
      State.paused = true;
      State.inOverlay = true;
      hideAllOverlays();
      show(el.overlayPaused);
    } else {
      State.paused = false;
      State.inOverlay = false;
      hide(el.overlayPaused);
      draw();
    }
  }

  function bindButtons() {
    on(el.btnPause, "click", () => togglePause());
    on(el.btnOptions, "click", () => { hideAllOverlays(); show(el.overlayOptions); State.inOverlay = true; pauseGame(); });

    on(el.btnCloseOptions, "click", () => { hide(el.overlayOptions); State.inOverlay = false; resumeGame(); draw(); });

    on(el.btnResume, "click", () => { hide(el.overlayPaused); State.inOverlay = false; State.paused = false; draw(); });
    on(el.btnPausedRestart, "click", () => { hide(el.overlayPaused); startRun(); });
    on(el.btnQuitToStart, "click", () => { openStartMenu(); });

    on(el.btnBackToStart, "click", () => { openStartMenu(); });
    on(el.btnRetry, "click", () => { startRun(); });

    on(el.btnCloseShop, "click", () => closeShop());
    on(el.btnCloseChest, "click", () => closeChest());

    on(el.btnArcadeMenu, "click", () => openStartMenu());
    on(el.btnArcadeNext, "click", () => {
      const zid = State.arcadeZone|0, rid = State.arcadeRun|0;
      let nr = rid + 1, nz = zid;
      if (nr >= ARCADE.runsPerZone) { nr = 0; nz = zid + 1; }
      if (nz >= ARCADE.zones.length) { openStartMenu(); return; }
      State.arcadeZone = nz;
      State.arcadeRun = nr;
      openStartMenu();
    });

    on(el.btnReroll, "click", () => {
      if (!Skills) return;
      if ((State.rerolls|0) <= 0) return;
      State.rerolls -= 1;
      sfx("sfx_reroll");
      openUpgrades();
    });

    on(el.btnSkipUpgrade, "click", () => closeUpgrades());

    on(el.btnNewProfile, "click", () => {
      if (!el.newProfileWrap) return;
      el.newProfileWrap.hidden = !el.newProfileWrap.hidden;
      if (!el.newProfileWrap.hidden && el.startName) el.startName.focus();
    });

    on(el.profileSelect, "change", () => {
      const id = String(el.profileSelect.value||"");
      if (id) setSelectedProfile(id);
      renderProfiles();
      arcadeBuildSelectors();
    });

    on(el.btnModeEndless, "click", () => setMode("endless"));
    on(el.btnModeArcade, "click", () => { setMode("arcade"); arcadeBuildSelectors(); });

    on(el.btnStart, "click", () => startRun());

    on(el.pillPlayer, "click", () => openCatalog());
    on(el.btnCloseCatalog, "click", () => closeCatalog());

    on(el.btnErrClose, "click", () => { openStartMenu(); });
    on(el.btnErrReload, "click", () => { location.reload(); });

    // press to start overlay
    on(el.btnPressStart, "click", async () => {
      hide(el.overlayPress);
      show(el.overlayStart);
      State.inOverlay = true;
      await unlockAudio();
    });
  }

  // ───────────────────────── Ticker (combo timer + magnet time) ─────────────────────────
  let lastT = 0;
  function tick(t) {
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;

    if (State.running && !State.paused && !State.inOverlay) {
      // combo timer
      State.comboTimer -= dt;
      if (State.comboTimer <= 0) {
        State.comboTimer = 0;
        State.comboIdx = 0;
        State.comboMultAdd = clamp(State.comboMultAdd - 0.10, 0, 3.0);
        makeNewCombo();
      }

      // magnet time
      if ((State.magnetTime|0) > 0) {
        State.magnetTime = Math.max(0, Number(State.magnetTime) - dt);
        if (State.magnetTime <= 0) {
          State.magnet = Math.max(0, (State.magnet|0)); // nivel se queda, solo dura el tiempo (tu skills lo usa así)
        }
      }

      updateHUD();
    }

    draw();
    requestAnimationFrame(tick);
  }

  // ───────────────────────── SW register + update pill ─────────────────────────
  let swWaiting = null;
  let updatePending = false;

  function showUpdatePill() {
    if (!el.pillUpdate) return;
    el.pillUpdate.hidden = false;
  }

  function hideUpdatePill() {
    if (!el.pillUpdate) return;
    el.pillUpdate.hidden = true;
  }

  async function registerSW() {
    try {
      if (window.__GRIDRUNNER_NOSW) return;
      if (!("serviceWorker" in navigator)) return;

      const reg = await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            swWaiting = reg.waiting || nw;
            updatePending = true;
            showUpdatePill();
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", (ev) => {
        const d = ev.data || {};
        if (d.type === "SW_ACTIVATED") {
          // ok
        }
      });

      on(el.pillUpdate, "click", async () => {
        // si estás en run, no forzamos reload: marcamos pending y se aplicará en menú/gameover
        updatePending = true;
        if (!State.running) {
          await applyUpdateNow(reg);
        } else {
          toast("Update listo. Se aplicará al terminar el run.", 1400);
        }
      });

      // aplica update en gameover/menu
      const applyMaybe = async () => {
        if (!updatePending) return;
        if (State.running) return;
        await applyUpdateNow(reg);
      };

      setInterval(applyMaybe, 1200);
    } catch (_) {}
  }

  async function applyUpdateNow(reg) {
    try {
      const r = reg || (await navigator.serviceWorker.getRegistration());
      const w = r && r.waiting ? r.waiting : swWaiting;
      if (w) w.postMessage({ type: "SKIP_WAITING" });
      hideUpdatePill();
      updatePending = false;

      // espera controllerchange
      const done = new Promise((res) => {
        let to = setTimeout(res, 1200);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          clearTimeout(to);
          res();
        }, { once: true });
      });
      await done;
      location.reload();
    } catch (_) {
      location.reload();
    }
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot() {
    try {
      loadSettings();
      bindOptions();
      audioApplySettings();
      refreshDpadVisibility();

      // offline pill
      const updNet = () => { if (el.pillOffline) el.pillOffline.hidden = navigator.onLine; };
      on(window, "online", updNet);
      on(window, "offline", updNet);
      updNet();

      // mode label
      const isTouch = matchMedia && matchMedia("(pointer: coarse)").matches;
      if (el.pillModeVal) el.pillModeVal.textContent = isTouch ? "WEB • MÓVIL" : "WEB • PC";
      if (el.pressMeta) el.pressMeta.textContent = `Modo: ${State.mode === "arcade" ? "Arcade" : "Infinito"}`;

      // global error capture -> no pantallazo en blanco
      on(window, "error", (e) => fatal("Error JS: revisa consola.", e?.error || e));
      on(window, "unhandledrejection", (e) => fatal("Promesa rechazada (JS).", e?.reason || e));

      bindInput();
      bindButtons();
      registerSW();

      // loading -> press
      if (el.loadingSub) el.loadingSub.textContent = "Listo";
      hide(el.overlayLoading);
      show(el.overlayPress);
      State.inOverlay = true;

      // failsafe botones
      setTimeout(() => {
        if (el.btnEmergencyReload) el.btnEmergencyReload.hidden = false;
        if (el.btnEmergencyRepair) el.btnEmergencyRepair.hidden = false;
      }, 2200);

      on(el.btnEmergencyReload, "click", () => location.reload());
      on(el.btnEmergencyRepair, "click", () => {
        const qs = new URLSearchParams(location.search);
        qs.set("repair", "1");
        location.href = location.pathname + "?" + qs.toString();
      });

      // init profiles/menu (pero lo enseñamos tras press)
      renderProfiles();
      setMode("endless");
      arcadeBuildSelectors();

      // tick
      lastT = now();
      requestAnimationFrame(tick);
    } catch (e) {
      fatal("Fallo al arrancar la app.", e);
    }
  }

  // start after DOM ready (defer -> ya está)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
