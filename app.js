/* Grid Runner — PWA (v0.0.8)
   - Grid más grande y responsive (móvil/PC)
   - Pantalla de carga inicial (mínimo 5s)
   - Auto-update real (SW: SKIP_WAITING + reload)
   - Movimiento 4 direcciones + banda (3 filas por defecto)
   - Combos visibles + niveles + mejoras (20+)
   - Ranking ignorado por ahora
*/
(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.0.8");

  // ───────────────────────── DOM ─────────────────────────
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = $("stage") || canvas.parentElement;

  // Pills
  const pillVersion = $("pillVersion");
  const pillOffline = $("pillOffline");
  const pillSpeed = $("pillSpeed");
  const pillLevel = $("pillLevel");
  const pillPlayer = $("pillPlayer");
  const pillSprites = $("pillSprites");

  // HUD
  const hudScore = $("hudScore");
  const hudScoreDelta = $("hudScoreDelta");
  const hudStreak = $("hudStreak");
  const hudMult = $("hudMult");
  const hudBest = $("hudBest");
  const hudComboFill = $("hudComboFill");
  const hudComboText = $("hudComboText");
  const hudLevel = $("hudLevel");
  const hudXp = $("hudXp");
  const hudLevelFill = $("hudLevelFill");

  // Buttons
  const btnOptions = $("btnOptions");
  const btnPause = $("btnPause");
  const btnRestart = $("btnRestart");
  const btnInstall = $("btnInstall");

  // Overlays
  const overlayLoading = $("overlayLoading");
  const loadingText = $("loadingText");
  const loadingSub = $("loadingSub");

  const overlayStart = $("overlayStart");
  const overlayPaused = $("overlayPaused");
  const overlayGameOver = $("overlayGameOver");
  const overlayUpgrades = $("overlayUpgrades");
  const overlayOptions = $("overlayOptions");

  // Start UI
  const startName = $("startName");
  const startBest = $("startBest");
  const startRuns = $("startRuns");
  const btnStart = $("btnStart");

  // Pause/GameOver UI
  const btnResume = $("btnResume");
  const btnPlayAgain = $("btnPlayAgain");
  const btnBackToStart = $("btnBackToStart");
  const btnBackToStart2 = $("btnBackToStart2");
  const finalLine = $("finalLine");

  // Options UI
  const btnCloseOptions = $("btnCloseOptions");
  const optSprites = $("optSprites");
  const optVibration = $("optVibration");
  const optDpad = $("optDpad");
  const optFx = $("optFx");
  const optFxValue = $("optFxValue");
  const btnClearLocal = $("btnClearLocal");

  // Touch
  const zoneLeft = $("zoneLeft");
  const zoneRight = $("zoneRight");

  // Combo Dock
  const comboSeqEl = $("comboSeq");
  const comboTimerEl = $("comboTimer");
  const comboHintEl = $("comboHint");

  // D-pad
  const dpad = $("dpad");
  const btnUp = $("btnUp");
  const btnDown = $("btnDown");
  const btnLeft = $("btnLeft");
  const btnRight = $("btnRight");

  // Upgrades buttons
  const upg0 = $("upg0");
  const upg1 = $("upg1");
  const upg2 = $("upg2");
  const btnReroll = $("btnReroll");
  const rerollCount = $("rerollCount");

  const toast = $("toast");

  // ───────────────────────── Config ─────────────────────────
  const COLS = 8;
  const ROWS = 24;

  const CELL = Object.freeze({
    EMPTY: 0,
    BLOCK: 1,
    COIN: 2,
    GEM: 3,
    TRAP: 4,
    BONUS: 5
  });

  const TYPE_NAME = {
    [CELL.EMPTY]: "Vacío",
    [CELL.BLOCK]: "KO",
    [CELL.COIN]: "Moneda",
    [CELL.GEM]: "Gema",
    [CELL.TRAP]: "Trampa",
    [CELL.BONUS]: "Bonus"
  };

  const BASE_COLOR = {
    [CELL.EMPTY]: "#0f1020",
    [CELL.BLOCK]: "#ff3355",
    [CELL.COIN]:  "#2ee59d",
    [CELL.GEM]:   "#69a8ff",
    [CELL.TRAP]:  "#ff7b2e",
    [CELL.BONUS]: "#ffd35a"
  };

  const VALUE = {
    [CELL.COIN]:  10,
    [CELL.GEM]:   25,
    [CELL.BONUS]: 60,
    [CELL.TRAP]:  -15
  };

  const SPRITE_URL = {
    player: "./assets/sprites/player.svg",
    [CELL.EMPTY]: "./assets/sprites/tile_empty.svg",
    [CELL.BLOCK]: "./assets/sprites/tile_block.svg",
    [CELL.COIN]:  "./assets/sprites/tile_coin.svg",
    [CELL.GEM]:   "./assets/sprites/tile_gem.svg",
    [CELL.TRAP]:  "./assets/sprites/tile_trap.svg",
    [CELL.BONUS]: "./assets/sprites/tile_bonus.svg"
  };

  // ───────────────────────── Storage ─────────────────────────
  const LS_PREFIX = "grid_runner_";
  const BEST_KEY = LS_PREFIX + "best_v1";
  const RUNS_KEY = LS_PREFIX + "runs_v1";
  const NAME_KEY = LS_PREFIX + "name_v1";
  const SETTINGS_KEY = LS_PREFIX + "settings_v3";

  // ───────────────────────── Device detect ─────────────────────────
  function isMobileLike(){
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) <= 760;
    return coarse || small;
  }
  function setDeviceAttr(){
    document.documentElement.dataset.device = isMobileLike() ? "mobile" : "desktop";
  }

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();

  function showToast(msg, ms=1200){
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, ms);
  }

  function overlayShow(el){
    if (!el) return;
    el.hidden = false;
  }
  function overlayHide(el){
    if (!el) return;
    el.hidden = true;
  }

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = () => {
    const mobile = isMobileLike();
    return {
      useSprites: true,
      vibration: mobile,
      showDpad: mobile,
      fx: 1.0
    };
  };

  let settings = (() => {
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const s = JSON.parse(raw);
      return { ...defaultSettings(), ...s };
    } catch {
      return defaultSettings();
    }
  })();

  function saveSettings(){
    try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function applySettingsToUI(){
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx){
      optFx.value = String(settings.fx);
      optFxValue.textContent = Number(settings.fx).toFixed(2);
    }

    if (pillSprites) pillSprites.textContent = settings.useSprites ? "🧩 Sprites" : "🎨 Colores";
    if (dpad) dpad.hidden = !settings.showDpad;
  }

  // ───────────────────────── Sprites ─────────────────────────
  const sprites = {
    loaded:false,
    player:null,
    tiles: new Map()
  };

  function loadImage(url){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function preloadSprites(){
    const toLoad = [];
    toLoad.push(loadImage(SPRITE_URL.player).then(img => sprites.player = img));
    Object.keys(SPRITE_URL).forEach((k) => {
      if (k === "player") return;
      const t = Number(k);
      toLoad.push(loadImage(SPRITE_URL[t]).then(img => sprites.tiles.set(t, img)));
    });
    await Promise.allSettled(toLoad);
    sprites.loaded = true;
  }

  // ───────────────────────── Canvas layout ─────────────────────────
  let dpr = 1;
  let cw = 0, ch = 0;
  let cellPx = 18;
  let offX = 0, offY = 0;

  function resize(){
    setDeviceAttr();

    const rect = stage.getBoundingClientRect();
    const mobile = isMobileLike();

    const maxDpr = mobile ? 2.0 : 2.25;
    dpr = Math.min(maxDpr, window.devicePixelRatio || 1);

    cw = Math.max(1, Math.floor(rect.width * dpr));
    ch = Math.max(1, Math.floor(rect.height * dpr));

    canvas.width = cw;
    canvas.height = ch;

    const pad = (mobile ? 10 : 14) * dpr;
    const availW = Math.max(1, cw - pad*2);
    const availH = Math.max(1, ch - pad*2);

    cellPx = Math.floor(Math.min(availW / COLS, availH / ROWS));
    cellPx = Math.max(cellPx, Math.floor(14 * dpr));

    const boardW = cellPx * COLS;
    const boardH = cellPx * ROWS;

    offX = Math.floor((cw - boardW) * 0.5);
    offY = Math.floor((ch - boardH) * 0.5);
  }

  // ───────────────────────── Game state ─────────────────────────
  let best = 0;
  let runs = 0;
  let playerName = "";

  let running = false;
  let paused = false;
  let gameOver = false;

  // player
  const midRow = Math.floor(ROWS/2);
  let laneRows = 3;              // banda vertical de movimiento
  let playerRow = midRow;        // dentro de la banda
  let playerCol = Math.floor(COLS/2);
  let playerSpan = 1;            // upgrade: 2 (dos cuadrados)
  let shield = 0;                // protecciones

  // scoring
  let score = 0;
  let streak = 0;
  let mult = 1;

  // speed (rows per second)
  let baseSpeed = 2.2;
  let speed = baseSpeed;
  let tAlive = 0;

  // level/xp
  let level = 1;
  let xp = 0;
  let nextXp = 60;

  // soft FX
  let shake = 0;
  let shakeX = 0, shakeY = 0;

  // scroll
  let scroll = 0; // 0..1 (fracción de fila)
  let lastT = now();

  // floating numbers
  const pops = []; // {x,y,text,color,life,vy,scale}
  function addPop(cx, cy, text, color){
    const fx = clamp(settings.fx || 1, 0.4, 1.25);
    pops.push({
      x: cx, y: cy,
      text,
      color,
      life: 900 * fx,
      t: 0,
      vy: -0.06 * dpr,
      scale: 1.0
    });
  }

  // grid
  let grid = [];
  function makeRow(){
    // densidad más baja (menos “cuadrados”)
    // Ajustable por upgrades
    const pBlock = clamp(0.10 + (speed-2.2)*0.01, 0.08, 0.18) * (spawn.blockMul || 1);
    const pGood  = clamp(0.18 + (speed-2.2)*0.015, 0.14, 0.28) * (spawn.goodMul || 1);
    const pTrap  = clamp(0.07 + (speed-2.2)*0.01, 0.06, 0.16) * (spawn.trapMul || 1);

    const row = new Array(COLS).fill(0).map(() => ({ t: CELL.EMPTY }));
    // 0..2 elementos por fila aprox
    const rolls = (Math.random() < 0.65) ? 1 : 2;
    for (let i=0;i<rolls;i++){
      const c = (Math.random()*COLS)|0;
      if (row[c].t !== CELL.EMPTY) continue;

      const r = Math.random();
      let t = CELL.EMPTY;

      if (r < pBlock) t = CELL.BLOCK;
      else if (r < pBlock + pTrap) t = CELL.TRAP;
      else if (r < pBlock + pTrap + pGood){
        // buenos
        const rr = Math.random();
        t = (rr < 0.60) ? CELL.COIN : (rr < 0.90) ? CELL.GEM : CELL.BONUS;
      }
      row[c].t = t;
    }
    return row;
  }

  function initGrid(){
    grid = [];
    for (let r=0;r<ROWS;r++) grid.push(makeRow());
  }

  // ───────────────────────── Combo system ─────────────────────────
  const combo = {
    seq: [],
    idx: 0,
    expiresAt: 0,
    durationMs: 12000,
  };

  function pickCombo(){
    const pool = [CELL.COIN, CELL.GEM, CELL.BONUS];
    const len = (Math.random() < 0.55) ? 3 : 4;
    combo.seq = [];
    for (let i=0;i<len;i++){
      combo.seq.push(pool[(Math.random()*pool.length)|0]);
    }
    combo.idx = 0;
    combo.expiresAt = now() + combo.durationMs;
    renderComboUI();
  }

  function renderComboUI(){
    if (!comboSeqEl) return;
    comboSeqEl.innerHTML = "";
    combo.seq.forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "comboPill" + (i < combo.idx ? " done" : "");
      const dot = document.createElement("span");
      dot.className = "comboDot";
      dot.style.background = BASE_COLOR[t];
      const txt = document.createElement("span");
      txt.textContent = TYPE_NAME[t];
      el.appendChild(dot);
      el.appendChild(txt);
      comboSeqEl.appendChild(el);
    });
    if (comboHintEl){
      comboHintEl.textContent = (combo.idx >= combo.seq.length)
        ? "¡Combo completado!"
        : `Paso ${combo.idx+1}/${combo.seq.length}`;
    }
  }

  function tickCombo(){
    const ms = combo.expiresAt - now();
    if (comboTimerEl){
      comboTimerEl.textContent = ms > 0 ? `⏳ ${(ms/1000).toFixed(1)}s` : "⏳ 0.0s";
    }
    if (ms <= 0){
      combo.idx = 0;
      combo.expiresAt = now() + combo.durationMs;
      renderComboUI();
    }
  }

  function onCollectForCombo(t){
    if (!combo.seq.length) return;
    const need = combo.seq[combo.idx];
    const isCollectible = (t === CELL.COIN || t === CELL.GEM || t === CELL.BONUS);

    if (t === need){
      combo.idx++;
      renderComboUI();
      if (combo.idx >= combo.seq.length){
        // bonus de combo
        const bonus = Math.round(120 * mult);
        score += bonus;
        xp += 20;
        streak += 2;
        mult = clamp(mult + 1, 1, 12);
        addPop(screenPlayerX(), screenPlayerY(), `COMBO +${bonus}`, "#ffd35a");
        if (settings.vibration) tryVibrate(25);
        shake = Math.max(shake, 0.9 * settings.fx);
        pickCombo();
      }
      return;
    }

    // si coges algo “bien” pero no era el correcto => reset suave
    if (isCollectible && combo.idx > 0){
      combo.idx = 0;
      combo.expiresAt = now() + combo.durationMs;
      renderComboUI();
    }
  }

  // ───────────────────────── Upgrades (20+) ─────────────────────────
  const spawn = { goodMul:1, trapMul:1, blockMul:1 };
  const timed = {
    x2Until: 0,
    slowUntil: 0,
    magnetUntil: 0
  };
  const stacks = new Map();
  let rerolls = 0;
  let currentChoices = [];

  function addStack(id, n=1){
    stacks.set(id, (stacks.get(id)||0) + n);
  }

  function hasTimed(key){ return now() < (timed[key] || 0); }

  const UPGRADES = [
    { id:"twin", name:"Doble corredor", desc:"Ahora eres 2 cuadrados (más fácil pillar bonus).", max:1, w:1.0,
      apply(){ playerSpan = 2; } },

    { id:"widen1", name:"Más carriles", desc:"+2 filas a la banda de movimiento (máx 9).", max:3, w:1.2,
      apply(){ laneRows = clamp(laneRows + 2, 3, 9); } },

    { id:"shield1", name:"Escudo", desc:"Bloque KO te perdona 1 vez.", max:5, w:1.0,
      apply(){ shield += 1; } },

    { id:"magnet", name:"Imán", desc:"Durante 10s atraes monedas/gemas cercanas.", max:5, w:1.0,
      apply(){ timed.magnetUntil = now() + 10000; } },

    { id:"x2", name:"x2 Puntos", desc:"Durante 12s, puntos x2.", max:8, w:1.0,
      apply(){ timed.x2Until = now() + 12000; } },

    { id:"slow", name:"Slow-mo", desc:"Durante 8s, la velocidad baja.", max:8, w:1.0,
      apply(){ timed.slowUntil = now() + 8000; } },

    { id:"lucky", name:"Suerte", desc:"Más items buenos, menos “vacío”.", max:6, w:1.1,
      apply(){ spawn.goodMul = clamp(spawn.goodMul + 0.12, 1, 2.0); } },

    { id:"cleaner", name:"Menos KO", desc:"Reduce bloques KO.", max:6, w:1.0,
      apply(){ spawn.blockMul = clamp(spawn.blockMul * 0.90, 0.55, 1.0); } },

    { id:"antiTrap", name:"Menos trampas", desc:"Reduce trampas.", max:6, w:1.0,
      apply(){ spawn.trapMul = clamp(spawn.trapMul * 0.90, 0.55, 1.0); } },

    { id:"multUp", name:"Multiplicador +1", desc:"Aumenta x en +1 (máx x12).", max:10, w:1.2,
      apply(){ mult = clamp(mult + 1, 1, 12); } },

    { id:"streakGuard", name:"Racha protegida", desc:"Trampas ya no resetean racha (solo restan).", max:1, w:0.8,
      apply(){ addStack("streakGuard", 1); } },

    { id:"xpBoost", name:"XP extra", desc:"+20 XP ahora mismo.", max:99, w:1.3,
      apply(){ xp += 20; } },

    { id:"scoreBoost", name:"Puntos extra", desc:"+80 puntos ahora mismo.", max:99, w:1.2,
      apply(){ score += 80; } },

    { id:"speedBaseDown", name:"Arranque suave", desc:"Baja la velocidad base un poco.", max:4, w:0.9,
      apply(){ baseSpeed = clamp(baseSpeed - 0.15, 1.6, 3.0); } },

    { id:"speedGrowDown", name:"Crecimiento lento", desc:"La velocidad sube más lento.", max:5, w:0.9,
      apply(){ addStack("speedGrowDown", 1); } },

    { id:"fxUp", name:"Más FX", desc:"Sube intensidad FX +0.05 (máx 1.25).", max:10, w:0.7,
      apply(){ settings.fx = clamp((settings.fx||1) + 0.05, 0.4, 1.25); saveSettings(); applySettingsToUI(); } },

    { id:"reroll", name:"Reroll +1", desc:"Ganas 1 reroll para elegir upgrades.", max:10, w:1.0,
      apply(){ rerolls += 1; } },

    { id:"comboTime", name:"Combo más largo", desc:"+3s al temporizador de combos.", max:5, w:0.9,
      apply(){ combo.durationMs = clamp(combo.durationMs + 3000, 9000, 24000); } },

    { id:"comboReward", name:"Combo más potente", desc:"Bonus de combo +20%.", max:6, w:0.9,
      apply(){ addStack("comboReward", 1); } },

    { id:"magnetPlus", name:"Imán mejorado", desc:"El imán dura +2s.", max:6, w:0.9,
      apply(){ timed.magnetUntil = Math.max(timed.magnetUntil, now()) + 2000; } },

    { id:"shieldPlus", name:"Escudo++", desc:"Ganas 2 escudos.", max:5, w:0.6,
      apply(){ shield += 2; } },

    { id:"laneNudge", name:"Ajuste de carril", desc:"Te centra automáticamente si te sales.", max:1, w:0.8,
      apply(){ addStack("laneNudge", 1); } }
  ];

  function canTake(upg){
    const c = stacks.get(upg.id) || 0;
    return c < (upg.max || 99);
  }

  function pick3Upgrades(){
    const available = UPGRADES.filter(canTake);
    const bag = [];
    // weighted pick
    for (let i=0;i<available.length;i++){
      const u = available[i];
      const w = clamp(u.w || 1, 0.2, 3);
      const copies = Math.max(1, Math.round(w * 3));
      for (let k=0;k<copies;k++) bag.push(u);
    }
    const out = [];
    while (out.length < 3 && bag.length){
      const u = bag[(Math.random()*bag.length)|0];
      if (out.includes(u)) continue;
      out.push(u);
    }
    // fallback
    while (out.length < 3 && available.length){
      const u = available[(Math.random()*available.length)|0];
      if (!out.includes(u)) out.push(u);
    }
    return out;
  }

  function showUpgradeChoices(){
    currentChoices = pick3Upgrades();
    const els = [upg0, upg1, upg2];
    els.forEach((el, i) => {
      const u = currentChoices[i];
      if (!el || !u) return;
      const count = stacks.get(u.id) || 0;
      const max = u.max || 99;
      el.innerHTML = `
        <div class="upgName">${u.name}</div>
        <div class="upgDesc">${u.desc}</div>
        <div class="upgMeta">
          <span class="pill subtle">Stack ${count}/${max}</span>
        </div>
      `;
    });
    if (rerollCount) rerollCount.textContent = String(rerolls);
    overlayShow(overlayUpgrades);
  }

  function applyUpgrade(i){
    const u = currentChoices[i];
    if (!u) return;
    addStack(u.id, 1);
    u.apply();

    saveSettings();
    overlayHide(overlayUpgrades);

    // re-render combo (por si cambió duración)
    combo.expiresAt = now() + combo.durationMs;
    renderComboUI();

    paused = false;
    running = true;
  }

  function tryLevelUp(){
    while (xp >= nextXp){
      xp -= nextXp;
      level += 1;
      nextXp = Math.round(nextXp * 1.18 + 12);

      // pausa y upgrades
      running = false;
      paused = true;
      showToast(`Nivel ${level} ⭐`, 900);
      showUpgradeChoices();
      break;
    }
  }

  // ───────────────────────── Start/Reset ─────────────────────────
  function refreshStartStats(){
    best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    runs = parseInt(localStorage.getItem(RUNS_KEY) || "0", 10) || 0;
    if (startBest) startBest.textContent = String(best);
    if (startRuns) startRuns.textContent = String(runs);
    if (hudBest) hudBest.textContent = String(best);
  }

  function resetRunState(){
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    streak = 0;
    mult = 1;

    level = 1;
    xp = 0;
    nextXp = 60;

    baseSpeed = 2.2;
    speed = baseSpeed;
    tAlive = 0;

    laneRows = 3;
    playerSpan = 1;
    shield = 0;

    spawn.goodMul = 1;
    spawn.trapMul = 1;
    spawn.blockMul = 1;

    timed.x2Until = 0;
    timed.slowUntil = 0;
    timed.magnetUntil = 0;

    stacks.clear();
    rerolls = 0;
    currentChoices = [];

    scroll = 0;
    pops.length = 0;
    shake = 0;

    playerCol = Math.floor(COLS/2);
    playerRow = midRow;

    initGrid();
    pickCombo();
    updateHud(true);
  }

  function startRun(){
    resetRunState();
    running = true;
    paused = false;
    gameOver = false;
    overlayHide(overlayStart);
    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);
    showToast("¡Vamos! 🔥", 700);
  }

  function endRun(reason){
    running = false;
    paused = false;
    gameOver = true;

    runs = (parseInt(localStorage.getItem(RUNS_KEY) || "0", 10) || 0) + 1;
    localStorage.setItem(RUNS_KEY, String(runs));

    if (score > best){
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      showToast("Nuevo récord 🏆", 1100);
    }

    if (finalLine){
      finalLine.textContent = `${reason} — Puntos: ${score} • Racha: ${streak} • Nivel: ${level}`;
    }

    refreshStartStats();
    overlayShow(overlayGameOver);
  }

  // ───────────────────────── Input ─────────────────────────
  function tryVibrate(ms){
    try{
      if (!settings.vibration) return;
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  }

  function laneBounds(){
    const half = Math.floor(laneRows/2);
    const a = clamp(midRow - half, 0, ROWS-1);
    const b = clamp(midRow + half, 0, ROWS-1);
    return [a, b];
  }

  function move(dx, dy){
    if (!running || paused || gameOver) return;

    const [a,b] = laneBounds();

    // horizontal
    playerCol = clamp(playerCol + dx, 0, COLS - playerSpan);

    // vertical dentro de banda
    playerRow = clamp(playerRow + dy, a, b);

    // small feedback
    shake = Math.max(shake, 0.12 * settings.fx);
  }

  function bindInputs(){
    // keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") move(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d") move(1, 0);
      else if (e.key === "ArrowUp" || e.key === "w") move(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s") move(0, 1);
      else if (e.key === " "){
        togglePause();
      }
    });

    // taps L/R
    if (zoneLeft) zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); move(-1,0); }, { passive:false });
    if (zoneRight) zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); move(1,0); }, { passive:false });

    // swipe (4 dirs) on stage
    let sx=0, sy=0, st=0;
    stage.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; st = now();
    }, { passive:true });

    stage.addEventListener("touchend", (e) => {
      const dt = now() - st;
      if (dt > 500) return;
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const thr = 18;

      if (adx < thr && ady < thr) return;

      if (adx > ady){
        move(dx > 0 ? 1 : -1, 0);
      } else {
        move(0, dy > 0 ? 1 : -1);
      }
    }, { passive:true });

    // dpad
    if (btnUp) btnUp.addEventListener("pointerdown", (e)=>{ e.preventDefault(); move(0,-1); }, { passive:false });
    if (btnDown) btnDown.addEventListener("pointerdown", (e)=>{ e.preventDefault(); move(0,1); }, { passive:false });
    if (btnLeft) btnLeft.addEventListener("pointerdown", (e)=>{ e.preventDefault(); move(-1,0); }, { passive:false });
    if (btnRight) btnRight.addEventListener("pointerdown", (e)=>{ e.preventDefault(); move(1,0); }, { passive:false });

    // iOS: evitar scroll mientras juegas
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive:false });
  }

  // ───────────────────────── Buttons ─────────────────────────
  function togglePause(){
    if (gameOver) return;
    if (!running && !paused) return;

    if (paused){
      paused = false;
      running = true;
      overlayHide(overlayPaused);
    } else {
      paused = true;
      running = false;
      overlayShow(overlayPaused);
    }
  }

  function bindButtons(){
    if (pillVersion) pillVersion.textContent = `v${APP_VERSION}`;

    btnPause.addEventListener("click", () => {
      togglePause();
    });

    btnRestart.addEventListener("click", () => {
      // reset rápido: vuelve al start si no hay run
      if (!running && !paused){
        overlayShow(overlayStart);
        return;
      }
      startRun();
    });

    btnOptions.addEventListener("click", () => {
      overlayShow(overlayOptions);
      if (running){
        paused = true; running = false;
      }
    });

    btnCloseOptions.addEventListener("click", () => {
      overlayHide(overlayOptions);
      if (paused && !gameOver && !overlayUpgrades.hidden){
        // si estás en upgrades, no reanudes
        return;
      }
      if (paused && !gameOver){
        paused = false; running = true;
      }
    });

    btnResume.addEventListener("click", () => {
      paused = false; running = true;
      overlayHide(overlayPaused);
    });

    btnPlayAgain.addEventListener("click", () => {
      overlayHide(overlayGameOver);
      startRun();
    });

    btnBackToStart.addEventListener("click", () => {
      paused = false; running = false; gameOver = false;
      overlayHide(overlayPaused);
      overlayShow(overlayStart);
      updateHud(true);
    });

    btnBackToStart2.addEventListener("click", () => {
      paused = false; running = false; gameOver = false;
      overlayHide(overlayGameOver);
      overlayShow(overlayStart);
      updateHud(true);
    });

    // start name
    startName.addEventListener("input", () => {
      const nm = (startName.value || "").trim().slice(0,16);
      btnStart.disabled = !(nm.length >= 2);
      pillPlayer.textContent = `👤 ${nm || "—"}`;
    });

    btnStart.addEventListener("click", () => {
      const nm = (startName.value || "").trim().slice(0,16);
      if (nm.length < 2) return;
      playerName = nm;
      try{ localStorage.setItem(NAME_KEY, playerName); } catch {}
      pillPlayer.textContent = `👤 ${playerName}`;
      startRun();
    });

    // options controls
    optSprites.addEventListener("change", () => {
      settings.useSprites = !!optSprites.checked;
      saveSettings();
      applySettingsToUI();
      draw();
    });

    optVibration.addEventListener("change", () => {
      settings.vibration = !!optVibration.checked;
      saveSettings();
    });

    optDpad.addEventListener("change", () => {
      settings.showDpad = !!optDpad.checked;
      saveSettings();
      applySettingsToUI();
    });

    optFx.addEventListener("input", () => {
      settings.fx = clamp(parseFloat(optFx.value) || 1.0, 0.4, 1.25);
      optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
    });

    btnClearLocal.addEventListener("click", () => {
      localStorage.removeItem(BEST_KEY);
      localStorage.removeItem(RUNS_KEY);
      refreshStartStats();
      showToast("Datos local borrados ✅", 900);
    });

    // upgrades overlay
    upg0.addEventListener("click", () => applyUpgrade(0));
    upg1.addEventListener("click", () => applyUpgrade(1));
    upg2.addEventListener("click", () => applyUpgrade(2));

    btnReroll.addEventListener("click", () => {
      if (rerolls <= 0) return;
      rerolls -= 1;
      if (rerollCount) rerollCount.textContent = String(rerolls);
      showUpgradeChoices();
      showToast("Reroll ✅", 650);
    });
  }

  // ───────────────────────── Gameplay tick ─────────────────────────
  function screenPlayerX(){
    return offX + (playerCol + (playerSpan*0.5)) * cellPx;
  }
  function screenPlayerY(){
    return offY + (playerRow + 0.5) * cellPx + scroll * cellPx;
  }

  function applyCollision(tileType){
    if (tileType === CELL.EMPTY) return;

    // magnet: si activo, “aspira” monedas/gemas cercanas al pasar
    // (se aplica en checkCell)
  }

  function checkCellAt(r, c){
    const cell = grid[r]?.[c];
    if (!cell) return;

    let t = cell.t;
    if (t === CELL.EMPTY) return;

    // Magnet effect (solo coin/gem)
    if (hasTimed("magnetUntil") && (t === CELL.COIN || t === CELL.GEM)){
      // atrae automáticamente: cuenta como recogido
    }

    if (t === CELL.BLOCK){
      if (shield > 0){
        shield -= 1;
        grid[r][c].t = CELL.EMPTY;
        streak = Math.max(0, streak - 1);
        addPop(screenPlayerX(), screenPlayerY(), "ESCUDO", "#ffffff");
        showToast("Escudo 💥", 800);
        tryVibrate(25);
        shake = Math.max(shake, 0.9 * settings.fx);
        return;
      }
      endRun("KO");
      tryVibrate(70);
      return;
    }

    if (t === CELL.TRAP){
      const val = VALUE[CELL.TRAP];
      score = Math.max(0, score + val);
      xp += 6;

      const guard = stacks.get("streakGuard") ? true : false;
      if (!guard) streak = 0;

      mult = Math.max(1, mult - 1);

      grid[r][c].t = CELL.EMPTY;

      addPop(screenPlayerX(), screenPlayerY(), `${val}`, BASE_COLOR[CELL.TRAP]);
      tryVibrate(20);
      shake = Math.max(shake, 0.7 * settings.fx);
      return;
    }

    // COIN/GEM/BONUS
    let add = VALUE[t] || 0;
    if (hasTimed("x2Until")) add *= 2;
    add = Math.round(add * mult);

    score += add;
    xp += (t === CELL.BONUS ? 18 : t === CELL.GEM ? 12 : 8);

    streak += 1;
    if (streak % 6 === 0) mult = clamp(mult + 1, 1, 12);

    grid[r][c].t = CELL.EMPTY;

    addPop(screenPlayerX(), screenPlayerY(), `+${add}`, BASE_COLOR[t]);
    tryVibrate(t === CELL.BONUS ? 18 : 10);
    shake = Math.max(shake, 0.45 * settings.fx);

    onCollectForCombo(t);
  }

  function stepRows(n=1){
    for (let k=0;k<n;k++){
      // shift down
      grid.pop();
      grid.unshift(makeRow());

      // progreso: puntos por avance
      score += Math.round(2 * mult);
      xp += 1;
    }
  }

  function updateSpeed(dt){
    const slow = hasTimed("slowUntil") ? 0.62 : 1.0;
    const growDown = stacks.get("speedGrowDown") || 0;
    const growMul = clamp(1.0 - growDown * 0.06, 0.65, 1.0);

    const streakBoost = clamp(streak * 0.01, 0, 0.45);
    const timeBoost = clamp(tAlive * 0.010, 0, 1.00);

    speed = (baseSpeed + timeBoost + streakBoost) * growMul * slow;
  }

  function updateHud(force=false){
    if (hudScore) hudScore.textContent = String(score);
    if (hudStreak) hudStreak.textContent = String(streak);
    if (hudMult) hudMult.textContent = String(mult);
    if (hudLevel) hudLevel.textContent = String(level);
    if (hudXp) hudXp.textContent = `${Math.floor(xp)} / ${nextXp}`;

    if (pillSpeed) pillSpeed.textContent = `Vel ${ (speed/baseSpeed).toFixed(2) }×`;
    if (pillLevel) pillLevel.textContent = `⭐ Lv ${level}`;

    // barras
    if (hudComboFill){
      const per = clamp((streak % 6) / 6, 0, 1);
      hudComboFill.style.width = `${Math.round(per*100)}%`;
    }
    if (hudComboText){
      hudComboText.textContent = `Combo ${streak % 6}/6`;
    }
    if (hudLevelFill){
      const per = clamp(xp / nextXp, 0, 1);
      hudLevelFill.style.width = `${Math.round(per*100)}%`;
    }
  }

  // ───────────────────────── Render ─────────────────────────
  function drawBackground(){
    // fondo suave: cambia con racha (sin quemar ojos)
    const s = clamp(streak/20, 0, 1);
    const r = Math.floor(18 + 40*s);
    const g = Math.floor(18 + 20*s);
    const b = Math.floor(38 + 60*s);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0,0,cw,ch);
  }

  function drawGrid(){
    const [a,b] = laneBounds();
    const scrollPx = scroll * cellPx;

    // shake
    let sx = 0, sy = 0;
    if (shake > 0.001){
      const fx = settings.fx || 1;
      shake = lerp(shake, 0, 0.08);
      shakeX = (Math.random()*2-1) * 6 * shake * fx * dpr;
      shakeY = (Math.random()*2-1) * 6 * shake * fx * dpr;
      sx = shakeX; sy = shakeY;
    } else {
      shake = 0; shakeX = 0; shakeY = 0;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // board area
    const boardW = cellPx * COLS;
    const boardH = cellPx * ROWS;

    // subtle border
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = Math.max(1, 1*dpr);
    ctx.strokeRect(offX+0.5, offY+0.5, boardW-1, boardH-1);

    for (let r=0;r<ROWS;r++){
      const y = offY + r*cellPx + scrollPx;

      // banda de movimiento (3 filas o más) resaltada
      if (r >= a && r <= b){
        ctx.fillStyle = "rgba(255,255,255,.055)";
        ctx.fillRect(offX, y, boardW, cellPx);
      }

      const passed = (r > playerRow);
      const alphaRow = passed ? 0.38 : 1.0;

      for (let c=0;c<COLS;c++){
        const x = offX + c*cellPx;

        // cell bg
        ctx.fillStyle = "rgba(0,0,0,.10)";
        ctx.fillRect(x, y, cellPx, cellPx);

        // content
        const t = grid[r][c].t;

        if (t !== CELL.EMPTY){
          // KO muy visible
          const pulse = (t === CELL.BLOCK) ? (0.65 + 0.35*Math.sin((now()/180))) : 1.0;

          ctx.globalAlpha = alphaRow;

          if (settings.useSprites && sprites.loaded){
            const img = sprites.tiles.get(t);
            if (img){
              const pad = Math.floor(cellPx * 0.10);
              ctx.drawImage(img, x+pad, y+pad, cellPx-pad*2, cellPx-pad*2);
            } else {
              ctx.fillStyle = BASE_COLOR[t];
              ctx.globalAlpha = alphaRow * 0.85;
              ctx.fillRect(x+2, y+2, cellPx-4, cellPx-4);
            }
          } else {
            ctx.fillStyle = BASE_COLOR[t];
            ctx.globalAlpha = alphaRow * 0.85;
            ctx.fillRect(x+2, y+2, cellPx-4, cellPx-4);
          }

          // block extra
          if (t === CELL.BLOCK){
            ctx.globalAlpha = alphaRow * pulse;
            ctx.strokeStyle = "rgba(255,255,255,.9)";
            ctx.lineWidth = Math.max(2, 2*dpr);
            ctx.strokeRect(x+2, y+2, cellPx-4, cellPx-4);

            // X
            ctx.strokeStyle = "rgba(0,0,0,.45)";
            ctx.lineWidth = Math.max(3, 3*dpr);
            ctx.beginPath();
            ctx.moveTo(x+6, y+6);
            ctx.lineTo(x+cellPx-6, y+cellPx-6);
            ctx.moveTo(x+cellPx-6, y+6);
            ctx.lineTo(x+6, y+cellPx-6);
            ctx.stroke();
          }

          ctx.globalAlpha = 1.0;
        }

        // grid lines
        ctx.strokeStyle = "rgba(255,255,255,.06)";
        ctx.lineWidth = Math.max(1, 1*dpr);
        ctx.strokeRect(x+0.5, y+0.5, cellPx-1, cellPx-1);
      }
    }

    // player (centrado)
    const px = offX + playerCol*cellPx;
    const py = offY + playerRow*cellPx + scrollPx;

    const spanW = playerSpan*cellPx;

    // player base
    ctx.globalAlpha = 1;
    if (settings.useSprites && sprites.loaded && sprites.player){
      const pad = Math.floor(cellPx * 0.10);
      ctx.drawImage(sprites.player, px+pad, py+pad, spanW-pad*2, cellPx-pad*2);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.fillRect(px+3, py+3, spanW-6, cellPx-6);
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = Math.max(2, 2*dpr);
      ctx.strokeRect(px+3, py+3, spanW-6, cellPx-6);
    }

    // shield indicator
    if (shield > 0){
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "rgba(105,168,255,.9)";
      ctx.lineWidth = Math.max(2, 2*dpr);
      ctx.strokeRect(px+1.5, py+1.5, spanW-3, cellPx-3);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawPops(dt){
    for (let i=pops.length-1;i>=0;i--){
      const p = pops[i];
      p.t += dt;
      const t = clamp(p.t / p.life, 0, 1);
      const a = 1 - t;
      p.y += p.vy * dt;

      const scale = 1 + 0.22 * (1 - t);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = `${Math.floor(16*dpr*scale)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.text, p.x + shakeX*0.25, p.y + shakeY*0.25);
      ctx.restore();

      if (t >= 1) pops.splice(i,1);
    }
  }

  function draw(){
    drawBackground();
    drawGrid();
  }

  // ───────────────────────── Loop ─────────────────────────
  function loop(){
    const t = now();
    const dt = clamp(t - lastT, 0, 40); // ms
    lastT = t;

    tickCombo();

    if (running && !paused && !gameOver){
      tAlive += dt/1000;
      updateSpeed(dt/1000);

      // scroll
      scroll += (speed * (dt/1000));
      while (scroll >= 1){
        scroll -= 1;
        stepRows(1);

        // check collision en la fila del player
        for (let s=0;s<playerSpan;s++){
          checkCellAt(playerRow, playerCol + s);
          if (gameOver) break;
        }

        // magnet: recoger alrededor 1 celda (solo coin/gem)
        if (!gameOver && hasTimed("magnetUntil")){
          for (let rr=playerRow-1; rr<=playerRow+1; rr++){
            if (rr < 0 || rr >= ROWS) continue;
            for (let cc=playerCol-1; cc<=playerCol+playerSpan; cc++){
              if (cc < 0 || cc >= COLS) continue;
              const tt = grid[rr][cc].t;
              if (tt === CELL.COIN || tt === CELL.GEM){
                grid[rr][cc].t = CELL.EMPTY;
                let add = VALUE[tt] || 0;
                if (hasTimed("x2Until")) add *= 2;
                add = Math.round(add * mult);
                score += add;
                xp += 6;
                addPop(screenPlayerX(), screenPlayerY(), `+${add}`, BASE_COLOR[tt]);
              }
            }
          }
        }

        // auto-centro si tienes laneNudge
        if (stacks.get("laneNudge")){
          const [a,b] = laneBounds();
          playerRow = clamp(playerRow, a, b);
        }

        tryLevelUp();
      }

      updateHud();
    }

    // render
    draw();
    drawPops(dt);

    // si hay update pendiente y ya no estás jugando => aplica
    maybeApplyPendingUpdate();

    requestAnimationFrame(loop);
  }

  // ───────────────────────── PWA (auto update) ─────────────────────────
  const SW_TOAST_KEY = "grid_runner_sw_toast_v1";
  let pendingWorker = null;
  let reloadedOnce = false;

  function maybeApplyPendingUpdate(){
    if (!pendingWorker) return;
    if (running && !gameOver) return; // no cortar run
    try{
      pendingWorker.postMessage({ type:"SKIP_WAITING" });
      pendingWorker = null;
      showToast("Actualizando…", 900);
    } catch {
      pendingWorker = null;
    }
  }

  function setupPWA(){
    // online/offline
    const setNet = () => {
      const offline = !navigator.onLine;
      pillOffline.hidden = !offline;
    };
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    setNet();

    // Install prompt (Chrome/Android)
    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btnInstall.hidden = false;
    });

    btnInstall.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      btnInstall.disabled = true;
      try{
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      btnInstall.hidden = true;
      btnInstall.disabled = false;
    });

    // SW register + auto-update
    if ("serviceWorker" in navigator){
      window.addEventListener("load", async () => {
        try{
          const swUrl = new URL("./sw.js", location.href);
          const reg = await navigator.serviceWorker.register(swUrl, { scope:"./" });

          // reload al tomar el control el nuevo SW
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloadedOnce) return;
            reloadedOnce = true;
            location.reload();
          });

          const schedule = (worker) => {
            pendingWorker = worker;
            // si no estás jugando, aplica ya
            if (!running) maybeApplyPendingUpdate();
            else if (!sessionStorage.getItem(SW_TOAST_KEY)){
              sessionStorage.setItem(SW_TOAST_KEY, "1");
              showToast("Update lista ✅ Se aplicará al terminar la run", 1800);
            }
          };

          // si ya había waiting
          if (reg.waiting) schedule(reg.waiting);

          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller){
                schedule(nw);
              }
            });
          });

          // checks periódicos
          const safeUpdate = () => reg.update().catch(()=>{});
          setInterval(safeUpdate, 15 * 60 * 1000);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") safeUpdate();
          });

        } catch (err){
          console.warn("SW register failed:", err);
        }
      });
    }
  }

  // ───────────────────────── Boot (loading >= 5s) ─────────────────────────
  function syncNameUI(){
    const saved = (localStorage.getItem(NAME_KEY) || "").trim();
    if (saved) playerName = saved;

    if (pillPlayer) pillPlayer.textContent = `👤 ${playerName || "—"}`;
    if (startName) startName.value = playerName || "";

    btnStart.disabled = !((startName.value || "").trim().length >= 2);
  }

  async function startLoadingSequence(){
    overlayShow(overlayLoading);
    overlayHide(overlayStart);
    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);
    overlayHide(overlayUpgrades);
    overlayHide(overlayOptions);

    if (loadingText) loadingText.textContent = "Cargando…";
    if (loadingSub) loadingSub.textContent = "Preparando la cuadrícula";

    const t0 = now();
    const minMs = 5000;

    // carga sprites en paralelo (no bloquea si faltan)
    const pSprites = preloadSprites().catch(()=>{});

    // espera mínimo 5s
    const pMin = new Promise((r)=>setTimeout(r, minMs));

    // y mientras: 2 “pasos” visuales
    setTimeout(()=>{ if (loadingSub) loadingSub.textContent = "Cargando sprites (opcional)"; }, 900);
    setTimeout(()=>{ if (loadingSub) loadingSub.textContent = "Casi listo…"; }, 2600);

    await Promise.allSettled([pSprites, pMin]);

    const waited = now() - t0;
    if (waited < minMs) await new Promise(r => setTimeout(r, minMs - waited));

    overlayHide(overlayLoading);
    overlayShow(overlayStart);
    showToast("Listo ✅", 700);
  }

  function boot(){
    if (!ctx){
      alert("Tu navegador no soporta Canvas 2D.");
      return;
    }

    setDeviceAttr();

    refreshStartStats();
    syncNameUI();

    applySettingsToUI();

    bindInputs();
    bindButtons();
    setupPWA();

    resize();
    window.addEventListener("resize", () => resize(), { passive:true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive:true });

    // init game
    resetRunState();
    draw();

    // loading >= 5s antes de mostrar start
    startLoadingSequence();

    // loop siempre vivo (evita “se queda pillado”)
    requestAnimationFrame(loop);

    console.log(`Grid Runner PWA v${APP_VERSION} (ranking ignorado)`);
  }

  boot();
})();
