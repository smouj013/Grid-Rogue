/* Grid Runner — PWA (v0.0.6)
   ✅ Sprites configurables (fallback a colores)
   ✅ Movimiento 4 direcciones en banda central (banda ampliable por upgrades)
   ✅ Combos objetivo visibles (secuencia y timer) + bonus al completarlos
   ✅ Sistema roguelike de mejoras (20+) al subir de nivel (3 opciones)
   ✅ Densidad de celdas ajustada (menos “ruido”)
   ✅ Visual: banda marcada, filas “inertes” atenuadas, números más juicy
   ✅ Ranking mundial online (Cloudflare Worker) solo si hay internet
*/
(() => {
  "use strict";

  const APP_VERSION = "0.0.6";

  // ───────────────────────── UI refs ─────────────────────────
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });

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

  const pillSpeed = $("pillSpeed");
  const pillPlayer = $("pillPlayer");
  const pillSprites = $("pillSprites");
  const pillOffline = $("pillOffline");
  const pillLevel = $("pillLevel");
  const pillVersion = $("pillVersion");

  const btnPause = $("btnPause");
  const btnRestart = $("btnRestart");
  const btnInstall = $("btnInstall");

  const btnOptions = $("btnOptions");
  const overlayOptions = $("overlayOptions");
  const btnCloseOptions = $("btnCloseOptions");
  const optSprites = $("optSprites");
  const optVibration = $("optVibration");
  const optDpad = $("optDpad");
  const optFx = $("optFx");
  const optFxValue = $("optFxValue");
  const btnClearLocal = $("btnClearLocal");

  const btnLeaderboard = $("btnLeaderboard");
  const overlayLeaderboard = $("overlayLeaderboard");
  const btnCloseLeaderboard = $("btnCloseLeaderboard");
  const lbStatus = $("lbStatus");
  const lbList = $("lbList");
  const playerNameInput = $("playerName");
  const btnSubmitScore = $("btnSubmitScore");

  const overlayStart = $("overlayStart");
  const overlayPaused = $("overlayPaused");
  const overlayGameOver = $("overlayGameOver");
  const overlayUpgrades = $("overlayUpgrades");

  const startName = $("startName");
  const startBest = $("startBest");
  const startRuns = $("startRuns");

  const btnStart = $("btnStart");
  const btnResume = $("btnResume");
  const btnPlayAgain = $("btnPlayAgain");
  const btnBackToStart = $("btnBackToStart");
  const finalLine = $("finalLine");

  const toast = $("toast");
  const zoneLeft = $("zoneLeft");
  const zoneRight = $("zoneRight");

  const dpad = $("dpad");
  const btnUp = $("btnUp");
  const btnDown = $("btnDown");
  const btnLeft = $("btnLeft");
  const btnRight = $("btnRight");

  const comboSeq = $("comboSeq");
  const comboTimer = $("comboTimer");
  const comboHint = $("comboHint");

  const upgradeChoices = $("upgradeChoices");
  const upLevelPill = $("upLevelPill");
  const btnReroll = $("btnReroll");
  const btnSkipUpgrade = $("btnSkipUpgrade");
  const upgradeHint = $("upgradeHint");

  // ───────────────────────── Local storage keys ─────────────────────────
  const BEST_KEY = "grid_runner_best_v5";
  const RUNS_KEY = "grid_runner_runs_v2";
  const PLAYER_NAME_KEY = "grid_runner_player_name_v3";
  const SETTINGS_KEY = "grid_runner_settings_v3";
  const META_KEY = "grid_runner_meta_v1"; // upgrades meta (por si quieres persistir más adelante)

  // ───────────────────────── Leaderboard (ONLINE) ─────────────────────────
  // Pon la URL de tu worker desplegado. Ejemplo:
  // const LEADERBOARD_ENDPOINT = "https://grid-runner-lb.TUUSUARIO.workers.dev";
  const LEADERBOARD_ENDPOINT = "";
  const LEADERBOARD_GAME_ID = "grid-runner";

  // ───────────────────────── Game config ─────────────────────────
  const COLS = 8;
  const ROWS = 24;

  const BAND_CENTER = Math.floor(ROWS / 2);

  const CELL = Object.freeze({
    EMPTY: 0,
    BLOCK: 1,
    COIN: 2,
    GEM: 3,
    TRAP: 4,
    BONUS: 5,
  });

  const CELL_COLOR = {
    [CELL.EMPTY]: "#101225",
    [CELL.BLOCK]: "#7b8296",
    [CELL.COIN]:  "#2ee59d",
    [CELL.GEM]:   "#3aa0ff",
    [CELL.TRAP]:  "#ff4d6d",
    [CELL.BONUS]: "#ffcc33",
  };

  // Velocidad (filas / segundo)
  const SPEED_START = 0.70;     // más lento al inicio
  const SPEED_MAX   = 4.80;
  const SPEED_RAMP_SECONDS = 95; // sube más gradual
  const PLAYER_SMOOTH_CELLS_PER_SEC = 22;

  // Streak -> mult
  const BASE_STREAK_PER_MULT = 5; // upgrades lo pueden bajar

  // Combo “por racha”
  const COMBO_EVERY = 8;

  // Combo objetivo (visible)
  const COMBO_TARGET_BASE_DURATION = 24; // segundos
  const COMBO_TARGET_MIN_LEN = 3;
  const COMBO_TARGET_MAX_LEN = 5;

  // ───────────────────────── Sprites config (EDITA AQUÍ) ─────────────────────────
  const SPRITES = Object.freeze({
    player: "./assets/sprites/player.svg",
    [CELL.BLOCK]: "./assets/sprites/tile_block.svg",
    [CELL.COIN]:  "./assets/sprites/tile_coin.svg",
    [CELL.GEM]:   "./assets/sprites/tile_gem.svg",
    [CELL.TRAP]:  "./assets/sprites/tile_trap.svg",
    [CELL.BONUS]: "./assets/sprites/tile_bonus.svg",
    [CELL.EMPTY]: "./assets/sprites/tile_empty.svg",
  });

  const SPRITE_INSET_RATIO = 0.10;
  const SPRITE_SCALE = Object.freeze({
    default: 1.00,
    player: 1.00,
    [CELL.BLOCK]: 1.04,
  });

  /** @type {Map<string|number, HTMLImageElement>} */
  const spriteImages = new Map();
  /** @type {Map<string|number, boolean>} */
  const spriteLoaded = new Map();

  async function loadImage(key, url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
      img.onload = async () => {
        spriteImages.set(key, img);
        spriteLoaded.set(key, true);
        try { if (img.decode) await img.decode(); } catch {}
        resolve(true);
      };
      img.onerror = () => {
        spriteLoaded.set(key, false);
        resolve(false);
      };
    });
  }

  async function preloadSprites() {
    const tasks = [];
    tasks.push(loadImage("player", SPRITES.player));
    for (const k of Object.keys(SPRITES)) {
      if (k === "player") continue;
      tasks.push(loadImage(Number(k), SPRITES[k]));
    }
    await Promise.allSettled(tasks);
  }

  function getSprite(key) {
    if (!settings.useSprites) return null;
    if (spriteLoaded.get(key) !== true) return null;
    return spriteImages.get(key) || null;
  }

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = Object.freeze({
    useSprites: true,
    vibration: true,
    showDpad: true,
    fx: 1.0,
  });

  /** @type {{useSprites:boolean, vibration:boolean, showDpad:boolean, fx:number}} */
  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const obj = JSON.parse(raw);
      return {
        useSprites: obj.useSprites !== false,
        vibration: obj.vibration !== false,
        showDpad: obj.showDpad !== false,
        fx: clamp(Number(obj.fx) || 1.0, 0.4, 1.25),
      };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applySettingsToUI() {
    optSprites.checked = settings.useSprites;
    optVibration.checked = settings.vibration;
    optDpad.checked = settings.showDpad;
    optFx.value = String(settings.fx);
    optFxValue.textContent = settings.fx.toFixed(2);
    dpad.hidden = !settings.showDpad;

    pillSprites.textContent = `Sprites: ${settings.useSprites ? "ON" : "OFF"}`;
  }

  // ───────────────────────── State ─────────────────────────
  let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let cellPx = 18;
  let boardX = 0, boardY = 0;

  let running = false;
  let paused = false;
  let gameOver = false;
  let inLevelUp = false;

  let score = 0;
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

  let streak = 0;
  let mult = 1;

  let runTime = 0;
  let rowsSurvived = 0;

  let scrollPx = 0;
  let speedBoost = 0;

  // Player target in celdas
  let targetCol = Math.floor(COLS / 2);
  let targetRow = BAND_CENTER;

  // Smooth render positions
  let playerColFloat = targetCol;
  let playerRowFloat = targetRow;

  /** @type {Uint8Array[]} */
  let grid = [];

  // VFX
  let animT = 0;
  let toastTimer = 0;
  let shake = 0;
  let shakeSeed = 0;
  let pulse = 0;

  // fondo
  let hue = 220;
  let hueTarget = 220;
  let glow = 0.16;

  const particles = [];
  const floatTexts = [];

  // HUD caching
  let prevScore = -1, prevStreak = -1, prevMult = -1, prevBest = -1;
  let deltaTimer = 0;

  // player name
  let playerName = (localStorage.getItem(PLAYER_NAME_KEY) || "").trim().slice(0, 16);

  // Band (ampliable)
  let bandHeight = 3; // base
  function bandStart() { return clamp(BAND_CENTER - Math.floor(bandHeight / 2), 0, ROWS - 1); }
  function bandEnd()   { return clamp(bandStart() + bandHeight - 1, 0, ROWS - 1); }

  // Dual runner
  let dualRunner = false; // upgrade
  function playerWidth() { return dualRunner ? 2 : 1; }
  function maxCol() { return COLS - playerWidth(); }

  // Buffs / upgrades runtime
  let shields = 0;
  let invulnT = 0;

  let coinMul = 1.0;
  let gemMul = 1.0;
  let bonusMul = 1.0;
  let survivalAddBase = 1;

  let streakPerMult = BASE_STREAK_PER_MULT;
  let comboRewardMul = 1.0;
  let comboTargetExtraTime = 0;

  let trapPenaltyBase = 25;
  let trapPenaltyMul = 1.0;
  let trapSoftReset = 0; // 0 normal, 1 half, 2 keep mult etc

  let genBlockMul = 1.0;
  let genGoodMul = 1.0;
  let genBonusMul = 1.0;

  let rerollCharges = 0;

  // Score multiplier buff (temporal)
  let buffX2T = 0;

  // Combo objetivo state
  let comboTarget = null; // { seq:number[], idx:number, expires:number, reward:number }

  // Level system (score thresholds)
  let level = 1;
  let nextLevelScore = 200;

  // upgrades picked this run
  /** @type {Record<string, number>} */
  let upgradeLv = Object.create(null);

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const now = () => performance.now() * 0.001;

  function easeOutCubic(t){ t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

  function isMobileLike(){
    return (matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }

  function vibrate(ms){
    if (!settings.vibration) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function bump(el){
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function overlayShow(el){
    el.classList.remove("fadeOut");
    el.hidden = false;
  }
  function overlayHide(el, ms = 180){
    el.classList.add("fadeOut");
    window.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("fadeOut");
    }, ms);
  }

  function showToast(msg, ms = 900){
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = ms / 1000;
  }

  function setScoreDelta(add){
    hudScoreDelta.textContent = (add >= 0 ? `+${add}` : `${add}`);
    hudScoreDelta.classList.add("delta");
    deltaTimer = 0.85;
  }

  function effectiveScoreMult(){
    return (buffX2T > 0) ? 2 : 1;
  }

  // ───────────────────────── Combos objetivo ─────────────────────────
  function chipForCell(cell){
    if (cell === CELL.COIN) return { cls:"coin", label:"Moneda" };
    if (cell === CELL.GEM) return { cls:"gem", label:"Gema" };
    if (cell === CELL.BONUS) return { cls:"bonus", label:"Bonus" };
    if (cell === CELL.TRAP) return { cls:"trap", label:"Trampa" };
    if (cell === CELL.BLOCK) return { cls:"block", label:"Bloque" };
    return { cls:"", label:"—" };
  }

  function renderComboTarget(){
    if (!comboTarget) {
      comboSeq.innerHTML = "";
      comboTimer.textContent = "—";
      comboHint.textContent = "—";
      return;
    }

    const tLeft = Math.max(0, comboTarget.expires - now());
    comboTimer.textContent = `${tLeft.toFixed(0)}s`;

    comboSeq.innerHTML = "";
    for (let i = 0; i < comboTarget.seq.length; i++){
      const cell = comboTarget.seq[i];
      const info = chipForCell(cell);
      const div = document.createElement("div");
      div.className = "comboChip" + (i < comboTarget.idx ? " done" : "");
      div.innerHTML = `<span class="comboDot ${info.cls}"></span><span>${info.label}</span>`;
      comboSeq.appendChild(div);
    }

    const left = comboTarget.seq.length - comboTarget.idx;
    comboHint.textContent = left <= 0 ? "¡Completado!" : `Faltan ${left} en orden`;
  }

  function newComboTarget(){
    const len = randi(COMBO_TARGET_MIN_LEN, COMBO_TARGET_MAX_LEN);
    const pool = [CELL.COIN, CELL.GEM, CELL.BONUS];
    const seq = [];
    let last = -1;
    for (let i=0;i<len;i++){
      let c = pool[randi(0, pool.length - 1)];
      if (c === last && Math.random() < 0.65) c = pool[(pool.indexOf(c)+1) % pool.length];
      seq.push(c);
      last = c;
    }

    const duration = COMBO_TARGET_BASE_DURATION + comboTargetExtraTime;
    const rewardBase = 90 * len; // base
    comboTarget = {
      seq,
      idx: 0,
      expires: now() + duration,
      reward: Math.floor(rewardBase),
    };
    renderComboTarget();
  }

  function comboTargetOnPick(cell){
    if (!comboTarget) return;

    // expire?
    if (now() > comboTarget.expires){
      newComboTarget();
      return;
    }

    const expected = comboTarget.seq[comboTarget.idx];
    if (cell === expected){
      comboTarget.idx++;
      // feedback
      shake = clamp(shake + 0.06, 0, 1);
      pulse = clamp(pulse + 0.12, 0, 1);
      renderComboTarget();

      // completed
      if (comboTarget.idx >= comboTarget.seq.length){
        const add = Math.floor(comboTarget.reward * comboRewardMul * mult * effectiveScoreMult());
        score += add;
        setScoreDelta(add);
        spawnFloatText(targetCol, targetRow, `OBJ +${add}`, "rgba(255,255,255,0.95)", 1.15);
        spawnParticles(targetCol, targetRow, "#ffffff", 24, 1.4);
        hueTarget = (hueTarget + 22) % 360;

        // chance de buff x2 (upgrade)
        if (upgradeLv["x2_burst"] > 0){
          const dur = 6 + 2 * upgradeLv["x2_burst"];
          buffX2T = Math.max(buffX2T, dur);
          showToast(`COMBO OBJETIVO ✔  x2 (${dur}s)`, 900);
        } else {
          showToast(`COMBO OBJETIVO ✔  +${add}`, 900);
        }

        // siguiente combo
        newComboTarget();
      }
    } else {
      // fallo: reinicia progreso (sin castigar demasiado)
      if (comboTarget.idx > 0){
        comboTarget.idx = 0;
        renderComboTarget();
        spawnFloatText(targetCol, targetRow, `FALLO`, "rgba(255,255,255,0.70)", 0.95);
        shake = clamp(shake + 0.04, 0, 1);
      }
    }
  }

  // ───────────────────────── Upgrades (20+) ─────────────────────────
  const UPGRADES = [
    { id:"dual_runner", name:"Doble Runner", max:1,
      desc:"Tu jugador ocupa 2 cuadrados (recoges doble si cae bien).",
      apply(){ dualRunner = true; targetCol = clamp(targetCol, 0, maxCol()); }
    },
    { id:"band_plus", name:"Más filas de movimiento", max:4,
      desc:"+1 a la banda central (más libertad vertical).",
      apply(){ bandHeight = clamp(bandHeight + 1, 3, 9); targetRow = clamp(targetRow, bandStart(), bandEnd()); }
    },
    { id:"shield", name:"Escudo", max:3,
      desc:"Ganas 1 escudo. Un BLOQUE no te mata: consume escudo.",
      apply(){ shields += 1; }
    },
    { id:"coin_boost", name:"Monedas++", max:5,
      desc:"+20% puntos de MONEDA.",
      apply(){ coinMul *= 1.2; }
    },
    { id:"gem_boost", name:"Gemas++", max:5,
      desc:"+20% puntos de GEMA.",
      apply(){ gemMul *= 1.2; }
    },
    { id:"bonus_boost", name:"Bonus++", max:5,
      desc:"+20% puntos de BONUS.",
      apply(){ bonusMul *= 1.2; }
    },
    { id:"survival_boost", name:"Supervivencia", max:5,
      desc:"+1 punto extra por fila avanzada.",
      apply(){ survivalAddBase += 1; }
    },
    { id:"mult_faster", name:"Multiplicador rápido", max:3,
      desc:"Necesitas menos racha para subir el multiplicador.",
      apply(){ streakPerMult = clamp(streakPerMult - 1, 2, 5); }
    },
    { id:"trap_armor", name:"Armadura anti-trampa", max:4,
      desc:"Reduces el daño de TRAMPA (hasta -60%).",
      apply(){ trapPenaltyMul *= 0.85; }
    },
    { id:"trap_soft", name:"Racha resistente", max:2,
      desc:"Las TRAMPAS no te resetean del todo la racha.",
      apply(){ trapSoftReset = Math.min(2, trapSoftReset + 1); }
    },
    { id:"invuln", name:"Invulnerabilidad breve", max:2,
      desc:"Tras una TRAMPA, 1.0s invulnerable (escala).",
      apply(){ /* se usa en runtime */ }
    },
    { id:"combo_master", name:"Combo Maestro", max:4,
      desc:"+30% recompensa de combo objetivo.",
      apply(){ comboRewardMul *= 1.3; }
    },
    { id:"combo_time", name:"Combo con más tiempo", max:3,
      desc:"+6s al timer del combo objetivo.",
      apply(){ comboTargetExtraTime += 6; }
    },
    { id:"x2_burst", name:"Explosión x2", max:3,
      desc:"Al completar combo objetivo: x2 puntos durante unos segundos.",
      apply(){ /* activa en comboTargetOnPick */ }
    },
    { id:"less_blocks", name:"Menos bloques", max:3,
      desc:"Reduce la cantidad de BLOQUES generados.",
      apply(){ genBlockMul *= 0.88; }
    },
    { id:"more_goods", name:"Más recompensas", max:3,
      desc:"Más MONEDAS y GEMAS en el mapa.",
      apply(){ genGoodMul *= 1.15; }
    },
    { id:"more_bonus", name:"Más BONUS", max:3,
      desc:"Aumenta probabilidad de BONUS.",
      apply(){ genBonusMul *= 1.18; }
    },
    { id:"reroll", name:"Reroll", max:2,
      desc:"Ganas 1 reroll por subida de nivel (para repetir opciones).",
      apply(){ rerollCharges += 1; }
    },
    { id:"start_slow", name:"Arranque suave", max:1,
      desc:"Los primeros segundos, la velocidad sube aún más lento.",
      apply(){ /* se usa en speed calc */ }
    },
    { id:"score_magnet", name:"Imán (1 casilla)", max:3,
      desc:"Al pisar, recoge también premios adyacentes (si hay).",
      apply(){ /* se usa en applyCellEffect */ }
    },
    { id:"combo_every", name:"Combo por racha mejorado", max:2,
      desc:"El combo por racha (cada 8) da más puntos.",
      apply(){ /* runtime */ }
    },
  ];

  function getUpgradeLevel(id){ return upgradeLv[id] || 0; }
  function canTakeUpgrade(u){ return getUpgradeLevel(u.id) < u.max; }

  function pickUpgradeChoices(count=3){
    const pool = UPGRADES.filter(canTakeUpgrade);
    // si se agotan, rellena con “shield” (si se puede) o repite pool
    const out = [];
    for (let i=0;i<count;i++){
      if (pool.length === 0) break;
      const idx = randi(0, pool.length - 1);
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  }

  let currentChoices = [];

  function openLevelUp(){
    inLevelUp = true;
    setPaused(true, true);

    upLevelPill.textContent = `Nivel ${level}`;
    upgradeHint.textContent = `Elige 1 mejora (tienes ${Object.keys(upgradeLv).length} activas).`;

    showUpgradeChoices();

    overlayShow(overlayUpgrades);
  }

  function closeLevelUp(){
    overlayHide(overlayUpgrades, 160);
    inLevelUp = false;
    setPaused(false, true);
  }

  function showUpgradeChoices(){
    currentChoices = pickUpgradeChoices(3);
    upgradeChoices.innerHTML = "";

    for (const u of currentChoices){
      const lv = getUpgradeLevel(u.id);
      const div = document.createElement("div");
      div.className = "upCard";
      div.innerHTML = `
        <div class="upName">${u.name}</div>
        <div class="upDesc">${u.desc}</div>
        <div class="upMeta">
          <span>Nivel: ${lv}/${u.max}</span>
          <span>+1</span>
        </div>
      `;
      div.addEventListener("click", () => {
        takeUpgrade(u);
      });
      upgradeChoices.appendChild(div);
    }

    // reroll UI
    const rr = getUpgradeLevel("reroll");
    const hasRR = rr > 0;
    btnReroll.hidden = !hasRR;
    btnReroll.disabled = !(hasRR && rerollCharges > 0);
    btnReroll.textContent = `🔁 Reroll (${rerollCharges})`;

    // skip (solo si ya estás alto o para debug; lo dejamos oculto por defecto)
    btnSkipUpgrade.hidden = true;
  }

  function takeUpgrade(u){
    const lv = getUpgradeLevel(u.id);
    if (lv >= u.max) return;

    upgradeLv[u.id] = lv + 1;
    u.apply();

    // feedback
    spawnParticles(targetCol, targetRow, "#ffffff", 18, 1.2);
    spawnFloatText(targetCol, targetRow, `+${u.name}`, "rgba(255,255,255,0.95)", 1.05);
    showToast(`Mejora: ${u.name}`, 900);

    // asegura combo target
    if (!comboTarget) newComboTarget();

    closeLevelUp();
  }

  // ───────────────────────── Board generation ─────────────────────────
  function makeEmptyRow(){
    const row = new Uint8Array(COLS);
    row.fill(CELL.EMPTY);
    return row;
  }

  function generateRow(difficulty01){
    const row = makeEmptyRow();

    // menos ruido global; y mods por upgrades
    const blockChance = clamp((0.08 + difficulty01 * 0.20) * genBlockMul, 0.06, 0.30);
    const coinChance  = clamp((0.085 + difficulty01 * 0.07) * genGoodMul, 0.07, 0.20);
    const gemChance   = clamp((0.040 + difficulty01 * 0.05) * genGoodMul, 0.03, 0.12);
    const bonusChance = clamp((0.022 + difficulty01 * 0.03) * genBonusMul, 0.016, 0.07);
    const trapChance  = clamp((0.038 + difficulty01 * 0.05), 0.03, 0.10);

    // camino seguro 1-2 columnas
    const safeCol = randi(0, COLS - 1);
    const safeCol2 = (Math.random() < 0.28)
      ? clamp(safeCol + (Math.random() < 0.5 ? -1 : 1), 0, COLS - 1)
      : safeCol;

    for (let c=0;c<COLS;c++){
      if (c === safeCol || c === safeCol2) continue;

      const x = Math.random();
      if (x < blockChance){ row[c] = CELL.BLOCK; continue; }

      const y = Math.random();
      if (y < bonusChance) row[c] = CELL.BONUS;
      else if (y < bonusChance + gemChance) row[c] = CELL.GEM;
      else if (y < bonusChance + gemChance + coinChance) row[c] = CELL.COIN;
      else if (y < bonusChance + gemChance + coinChance + trapChance) row[c] = CELL.TRAP;
    }

    // un extra de moneda a veces
    if (Math.random() < 0.30){
      const c = randi(0, COLS - 1);
      if (row[c] === CELL.EMPTY && c !== safeCol) row[c] = CELL.COIN;
    }

    return row;
  }

  function initGrid(){
    grid = [];
    for (let r=0;r<ROWS;r++){
      const d = clamp((r / ROWS) * 0.30, 0, 0.30);
      grid.push(generateRow(d));
    }
  }

  // ───────────────────────── Difficulty / Speed ─────────────────────────
  function difficulty01(){
    const t = clamp(runTime / SPEED_RAMP_SECONDS, 0, 1);
    const streakBoost = clamp(streak / 70, 0, 0.25);
    return clamp(t + streakBoost, 0, 1);
  }

  function currentSpeed(){
    // base ramp
    const t = easeOutCubic(clamp(runTime / SPEED_RAMP_SECONDS, 0, 1));
    let sp = SPEED_START + (SPEED_MAX - SPEED_START) * t;

    // upgrade: start_slow -> amortigua los primeros 18s
    if (getUpgradeLevel("start_slow") > 0){
      const k = clamp(runTime / 18, 0, 1);
      sp = lerp(SPEED_START, sp, k*k);
    }

    // speedBoost decae a 0
    sp *= (1 + speedBoost);
    sp = clamp(sp, 0.55, 6.0);
    return sp;
  }

  // ───────────────────────── Effects / Particles / Float text ─────────────────────────
  function spawnParticles(col, row, color, n=10, sizeMul=1.0){
    const fx = settings.fx;
    const cx = col + 0.5;
    const cy = row + 0.5;
    for (let i=0;i<n;i++){
      particles.push({
        x: cx + (Math.random()-0.5)*0.12,
        y: cy + (Math.random()-0.5)*0.12,
        vx: (Math.random()-0.5) * 3.2 * fx,
        vy: (Math.random()-0.5) * 3.2 * fx - 0.4,
        life: 0.45 + Math.random()*0.35,
        t: 0,
        color,
        size: (0.10 + Math.random()*0.10) * sizeMul,
      });
    }
  }

  function spawnFloatText(col, row, text, color="rgba(255,255,255,0.95)", scale=1.0){
    const fx = settings.fx;
    floatTexts.push({
      x: col + 0.5,
      y: row + 0.5,
      text,
      color,
      life: 0.85,
      t: 0,
      vy: -0.9 - Math.random()*0.4,
      scale: scale * fx,
      rot: (Math.random()-0.5)*0.18,
    });
  }

  function kick(kind){
    const fx = settings.fx;
    if (kind === "good"){ shake = clamp(shake + 0.05*fx, 0, 1); pulse = clamp(pulse + 0.08*fx, 0, 1); }
    if (kind === "bad"){ shake = clamp(shake + 0.08*fx, 0, 1); pulse = clamp(pulse + 0.04*fx, 0, 1); }
    if (kind === "bonus"){ shake = clamp(shake + 0.10*fx, 0, 1); pulse = clamp(pulse + 0.12*fx, 0, 1); }
  }

  // ───────────────────────── Cell effects ─────────────────────────
  function applyTrap(){
    if (invulnT > 0) {
      spawnFloatText(targetCol, targetRow, "NO HIT", "rgba(255,255,255,0.75)", 1.0);
      return "Invulnerable";
    }

    const pen = Math.max(1, Math.round(trapPenaltyBase * trapPenaltyMul));
    score -= pen;
    setScoreDelta(-pen);

    // racha: soft reset según upgrade
    if (trapSoftReset === 0){
      streak = 0; mult = 1;
    } else if (trapSoftReset === 1){
      streak = Math.floor(streak * 0.5);
      mult = 1 + Math.min(4, Math.floor(streak / streakPerMult));
    } else {
      streak = Math.max(0, streak - 4);
      mult = 1 + Math.min(4, Math.floor(streak / streakPerMult));
    }

    // invuln upgrade
    const invLv = getUpgradeLevel("invuln");
    if (invLv > 0) invulnT = Math.max(invulnT, 0.9 + invLv * 0.35);

    speedBoost = clamp(speedBoost - 0.08, -0.28, 0.40);
    spawnParticles(targetCol, targetRow, CELL_COLOR[CELL.TRAP], 14, 1.1);
    spawnFloatText(targetCol, targetRow, `-${pen}`, "rgba(255,130,160,0.95)", 1.2);
    kick("bad");
    return `TRAMPA -${pen}`;
  }

  function applyGood(cell){
    streak += 1;
    mult = 1 + Math.min(4, Math.floor(streak / streakPerMult));

    const sm = effectiveScoreMult();

    if (cell === CELL.COIN){
      const add = Math.floor(10 * mult * coinMul * sm);
      score += add;
      setScoreDelta(add);
      spawnFloatText(targetCol, targetRow, `+${add}`, "rgba(170,255,220,0.95)", 1.22);
      spawnParticles(targetCol, targetRow, CELL_COLOR[CELL.COIN], 10, 0.95);
      kick("good");
      comboTargetOnPick(CELL.COIN);
      return `+${add} (Moneda)`;
    }

    if (cell === CELL.GEM){
      const add = Math.floor(30 * mult * gemMul * sm);
      score += add;
      setScoreDelta(add);
      spawnFloatText(targetCol, targetRow, `+${add}`, "rgba(170,220,255,0.95)", 1.24);
      spawnParticles(targetCol, targetRow, CELL_COLOR[CELL.GEM], 14, 1.05);
      kick("good");
      comboTargetOnPick(CELL.GEM);
      return `+${add} (Gema)`;
    }

    if (cell === CELL.BONUS){
      const add = Math.floor(60 * mult * bonusMul * sm);
      score += add;
      setScoreDelta(add);
      spawnFloatText(targetCol, targetRow, `+${add}`, "rgba(255,240,170,0.98)", 1.28);
      speedBoost = clamp(speedBoost + 0.07, -0.28, 0.40);
      spawnParticles(targetCol, targetRow, CELL_COLOR[CELL.BONUS], 18, 1.2);
      kick("bonus");
      comboTargetOnPick(CELL.BONUS);
      return `BONUS +${add}`;
    }

    return "";
  }

  function applyBlock(){
    if (shields > 0){
      shields -= 1;
      spawnParticles(targetCol, targetRow, "#ffffff", 20, 1.25);
      spawnFloatText(targetCol, targetRow, `ESCUDO`, "rgba(255,255,255,0.95)", 1.15);
      shake = clamp(shake + 0.16, 0, 1);
      speedBoost = clamp(speedBoost - 0.05, -0.28, 0.40);
      return "Bloque absorbido (escudo)";
    }
    gameOver = true;
    running = false;
    showGameOver();
    return "KO";
  }

  // magnet upgrade: recoge adyacentes (1 celda) si hay premios
  function magnetCollectAround(){
    const lv = getUpgradeLevel("score_magnet");
    if (lv <= 0) return;
    const range = clamp(lv, 1, 3); // 1..3 (pero mantenemos 1 casilla real; range como “intensidad”)
    const dirs = [
      [ 1, 0], [-1, 0], [0, 1], [0,-1]
    ];
    for (const [dx,dy] of dirs){
      const c = targetCol + dx;
      const r = targetRow + dy;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const cell = grid[r][c];
      if (cell === CELL.COIN || cell === CELL.GEM || cell === CELL.BONUS){
        // “consume” y aplica como si lo pisaras pero con menos vfx
        grid[r][c] = CELL.EMPTY;
        const oldFX = settings.fx;
        // micro: no toques fx, sólo reduce particulas
        applyGood(cell);
        spawnParticles(c, r, "rgba(255,255,255,0.85)", 6 + range*2, 0.9);
      }
    }
  }

  function applyCellEffect(cell){
    if (cell === CELL.EMPTY) return "";

    if (cell === CELL.TRAP){
      const msg = applyTrap();
      return msg;
    }

    if (cell === CELL.BLOCK){
      const msg = applyBlock();
      return msg;
    }

    // Good cells
    magnetCollectAround();
    const msg = applyGood(cell);

    // Combo por racha (cada N)
    if (!gameOver && streak > 0 && streak % COMBO_EVERY === 0){
      const extra = (getUpgradeLevel("combo_every") > 0) ? (120 + 60*getUpgradeLevel("combo_every")) : 120;
      const add = Math.floor(extra * mult * effectiveScoreMult());
      score += add;
      setScoreDelta(add);
      spawnFloatText(targetCol, targetRow, `COMBO +${add}`, "rgba(255,255,255,0.95)", 1.18);
      speedBoost = clamp(speedBoost + 0.08, -0.28, 0.40);
      spawnParticles(targetCol, targetRow, "#ffffff", 22, 1.25);
      kick("bonus");
    }

    return msg;
  }

  // ───────────────────────── Step / loop ─────────────────────────
  function stepRowAdvance(){
    const d = difficulty01();

    // shift: entra fila arriba
    grid.pop();
    grid.unshift(generateRow(d));

    rowsSurvived += 1;

    // puntos por avanzar
    const add = Math.floor(survivalAddBase * mult * effectiveScoreMult());
    score += add;

    // evalúa celda(s) bajo player (1 o 2 columnas si dual)
    const c0 = clamp(targetCol, 0, maxCol());
    const r0 = clamp(targetRow, bandStart(), bandEnd());

    const cellsToCheck = [];
    cellsToCheck.push([c0, r0]);
    if (dualRunner) cellsToCheck.push([c0+1, r0]);

    let msg = "";
    for (const [c,r] of cellsToCheck){
      const cell = grid[r][c];
      // si ya estás en gameOver, no sigas
      if (gameOver) break;
      const localMsg = applyCellEffect(cell);
      if (!gameOver && cell !== CELL.BLOCK) grid[r][c] = CELL.EMPTY;
      if (localMsg && !msg) msg = localMsg;
    }

    if (msg) showToast(msg, 850);

    // level check
    checkLevelUp();

    updateHud();
  }

  function checkLevelUp(){
    while (score >= nextLevelScore){
      level += 1;
      // siguiente umbral (crece)
      nextLevelScore = Math.floor(nextLevelScore + 160 + level*45 + Math.pow(level, 1.15)*8);
      showToast(`Nivel ${level} ⚡`, 900);
      openLevelUp();
      break; // no acumules varios en el mismo frame
    }
  }

  function tick(dt){
    if (!running || paused || gameOver) return;

    runTime += dt;

    // buffs
    if (speedBoost !== 0){
      speedBoost = lerp(speedBoost, 0, clamp(dt * 0.6, 0, 1));
      if (Math.abs(speedBoost) < 0.003) speedBoost = 0;
    }
    if (invulnT > 0) invulnT = Math.max(0, invulnT - dt);
    if (buffX2T > 0) buffX2T = Math.max(0, buffX2T - dt);

    // scroll
    const sp = currentSpeed(); // filas/sec
    scrollPx += sp * cellPx * dt;

    while (scrollPx >= cellPx){
      scrollPx -= cellPx;
      stepRowAdvance();
      if (paused || gameOver) break;
    }

    // player smooth
    const smooth = PLAYER_SMOOTH_CELLS_PER_SEC;
    playerColFloat = lerp(playerColFloat, targetCol, clamp(dt * smooth, 0, 1));
    playerRowFloat = lerp(playerRowFloat, targetRow, clamp(dt * smooth, 0, 1));

    // fondo según racha + buff
    const streakHeat = clamp(streak / 24, 0, 1);
    hueTarget = 220 + streakHeat * 80 + (buffX2T > 0 ? 18 : 0);
    hue = lerp(hue, hueTarget, clamp(dt * 0.45, 0, 1));
    glow = lerp(glow, 0.14 + streakHeat * 0.10, clamp(dt * 0.65, 0, 1));

    // vfx
    animT += dt;
    shake = lerp(shake, 0, clamp(dt * 1.8, 0, 1));
    pulse = lerp(pulse, 0, clamp(dt * 1.6, 0, 1));

    // particles
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t += dt;
      const k = p.t / p.life;
      p.x += p.vx * dt * 0.08;
      p.y += p.vy * dt * 0.08;
      p.vx *= Math.pow(0.35, dt);
      p.vy = p.vy * Math.pow(0.45, dt) + 0.9*dt;
      if (k >= 1) particles.splice(i,1);
    }

    // float texts
    for (let i=floatTexts.length-1;i>=0;i--){
      const f = floatTexts[i];
      f.t += dt;
      f.y += f.vy * dt * 0.12;
      f.vy *= Math.pow(0.60, dt);
      if (f.t >= f.life) floatTexts.splice(i,1);
    }
  }

  // ───────────────────────── Input / movement ─────────────────────────
  function movePlayer(dx, dy){
    if (!running || paused || gameOver || inLevelUp) return;

    const nc = clamp(targetCol + dx, 0, maxCol());
    const nr = clamp(targetRow + dy, bandStart(), bandEnd());

    if (nc !== targetCol || nr !== targetRow){
      targetCol = nc;
      targetRow = nr;
      shake = clamp(shake + 0.05, 0, 1);
      vibrate(6);
    }
  }

  // swipe 4-dir
  function bindSwipe(){
    let sx=0, sy=0, st=0, active=false;

    const onDown = (e) => {
      if (inLevelUp) return;
      active = true;
      st = performance.now();
      const t = (e.touches && e.touches[0]) ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY;
    };
    const onUp = (e) => {
      if (!active) return;
      active = false;
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dtm = performance.now() - st;

      const ax = Math.abs(dx), ay = Math.abs(dy);
      const min = 28; // umbral swipe
      if (ax < min && ay < min) return;

      if (ax > ay){
        movePlayer(dx > 0 ? 1 : -1, 0);
      } else {
        movePlayer(0, dy > 0 ? 1 : -1);
      }
    };

    canvas.addEventListener("pointerdown", onDown, { passive:true });
    canvas.addEventListener("pointerup", onUp, { passive:true });

    canvas.addEventListener("touchstart", onDown, { passive:true });
    canvas.addEventListener("touchend", onUp, { passive:true });
  }

  function bindInputs(){
    // zonas tap izq/der
    zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(-1,0); }, { passive:false });
    zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer( 1,0); }, { passive:false });

    // dpad
    btnLeft.addEventListener("pointerdown", (e)=>{ e.preventDefault(); movePlayer(-1,0); }, { passive:false });
    btnRight.addEventListener("pointerdown",(e)=>{ e.preventDefault(); movePlayer( 1,0); }, { passive:false });
    btnUp.addEventListener("pointerdown",   (e)=>{ e.preventDefault(); movePlayer( 0,-1); }, { passive:false });
    btnDown.addEventListener("pointerdown", (e)=>{ e.preventDefault(); movePlayer( 0, 1); }, { passive:false });

    // teclado
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " "){
        if (running && !gameOver) setPaused(!paused);
        e.preventDefault();
        return;
      }
      if (k === "arrowleft" || k === "a") movePlayer(-1,0);
      if (k === "arrowright"|| k === "d") movePlayer( 1,0);
      if (k === "arrowup"   || k === "w") movePlayer( 0,-1);
      if (k === "arrowdown" || k === "s") movePlayer( 0, 1);
    });

    bindSwipe();

    // pausa automática al cambiar pestaña
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !gameOver) setPaused(true);
    });
  }

  // ───────────────────────── HUD ─────────────────────────
  function updateHud(force=false){
    if (force || score !== prevScore){ hudScore.textContent = String(score); bump(hudScore); prevScore = score; }
    if (force || streak !== prevStreak){ hudStreak.textContent = String(streak); bump(hudStreak); prevStreak = streak; }
    if (force || mult !== prevMult){ hudMult.textContent = String(mult); bump(hudMult); prevMult = mult; }
    if (force || best !== prevBest){ hudBest.textContent = String(best); bump(hudBest); prevBest = best; }

    // combo meter
    const p = (COMBO_EVERY > 0) ? ((streak % COMBO_EVERY) / COMBO_EVERY) : 0;
    hudComboFill.style.width = `${Math.floor(p*100)}%`;
    hudComboText.textContent = `Combo ${streak % COMBO_EVERY}/${COMBO_EVERY}`;

    // level hud
    hudLevel.textContent = String(level);
    pillLevel.textContent = `Nivel ${level}`;

    const prevThreshold = estimatePrevLevelThreshold();
    const cur = clamp(score - prevThreshold, 0, 99999999);
    const need = Math.max(1, nextLevelScore - prevThreshold);
    const lp = clamp(cur / need, 0, 1);
    hudXp.textContent = `${cur}/${need}`;
    hudLevelFill.style.width = `${Math.floor(lp*100)}%`;

    // pills
    pillPlayer.textContent = `👤 ${playerName || "—"}`;

    const sp = currentSpeed();
    const spx = (sp / SPEED_START);
    pillSpeed.textContent = `Vel ${spx.toFixed(1)}×`;

    // score delta fade
    if (deltaTimer > 0){
      deltaTimer -= 0.016;
      if (deltaTimer <= 0){
        hudScoreDelta.textContent = "";
        hudScoreDelta.classList.remove("delta");
      }
    }

    // combo target timer refresh
    if (comboTarget) renderComboTarget();
  }

  function estimatePrevLevelThreshold(){
    // aproximación: para el cálculo del progreso del nivel actual
    // guardamos el “umbral anterior” como (nextLevelScore - delta). Pero como delta varía, hacemos un truco:
    // Si level=1, umbral anterior 0.
    if (level <= 1) return 0;

    // recreamos umbrales desde inicio (barato, niveles bajos)
    let l = 1;
    let thr = 200;
    let prev = 0;
    while (l < level){
      prev = thr;
      l += 1;
      thr = Math.floor(thr + 160 + l*45 + Math.pow(l, 1.15)*8);
      if (l > 200) break;
    }
    return prev;
  }

  // ───────────────────────── Render helpers ─────────────────────────
  function roundRectFill(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  function drawCellSpriteOrColor(cell, x, y, s, alpha, isBlock=false){
    const spr = getSprite(cell);
    ctx.globalAlpha = alpha;

    if (spr){
      const inset = s * SPRITE_INSET_RATIO;
      const scale = SPRITE_SCALE[cell] ?? SPRITE_SCALE.default;
      const ss = (s - inset*2) * scale;
      const ox = x + (s - ss) / 2;
      const oy = y + (s - ss) / 2;
      ctx.drawImage(spr, ox, oy, ss, ss);
    } else {
      // color fallback
      ctx.fillStyle = CELL_COLOR[cell] || "#ffffff";
      roundRectFill(x+1, y+1, s-2, s-2, Math.max(4, s*0.18));
    }

    // bloque: borde rojo + X
    if (cell === CELL.BLOCK || isBlock){
      ctx.globalAlpha = alpha;
      const t = animT*3.2;
      const pulse = 0.55 + 0.35*Math.sin(t);
      ctx.strokeStyle = `rgba(255,60,80,${0.55*pulse})`;
      ctx.lineWidth = Math.max(2, s*0.08);
      ctx.strokeRect(x+1.5, y+1.5, s-3, s-3);

      ctx.strokeStyle = `rgba(255,60,80,${0.40*pulse})`;
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(x+s*0.22, y+s*0.22);
      ctx.lineTo(x+s*0.78, y+s*0.78);
      ctx.moveTo(x+s*0.78, y+s*0.22);
      ctx.lineTo(x+s*0.22, y+s*0.78);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function draw(){
    // fondo dinámico (suave)
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1,0,0,1,0,0);

    ctx.fillStyle = `hsl(${hue} 32% 9%)`;
    ctx.fillRect(0,0,w,h);

    // glow
    ctx.globalAlpha = glow;
    ctx.fillStyle = `hsl(${(hue+20)%360} 70% 50%)`;
    ctx.beginPath();
    ctx.ellipse(w*0.35, h*0.18, w*0.35, h*0.28, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // shake
    let sx=0, sy=0;
    if (shake > 0.001){
      shakeSeed += 1;
      sx = (Math.sin(shakeSeed*12.2)+Math.cos(shakeSeed*7.9))*shake*8*dpr;
      sy = (Math.cos(shakeSeed*9.1)-Math.sin(shakeSeed*5.7))*shake*8*dpr;
    }

    ctx.translate(sx, sy);

    // board
    const bs = bandStart();
    const be = bandEnd();

    // banda marcada (3+ filas) con color suave
    const bandTintA = 0.10 + 0.05 * clamp(streak/20, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${bandTintA})`;
    for (let r=bs; r<=be; r++){
      const y = boardY + (r * cellPx) - scrollPx;
      ctx.fillRect(boardX, y, cellPx*COLS, cellPx);
    }

    // grid
    for (let r=0;r<ROWS;r++){
      const row = grid[r];
      const y = boardY + (r * cellPx) - scrollPx;

      // filas “inertes” (ya pasadas detrás de la banda)
      const behind = r - be;
      let alphaRow = 1.0;
      if (behind > 0){
        alphaRow = clamp(0.50 - behind*0.04, 0.18, 0.50);
      }

      for (let c=0;c<COLS;c++){
        const cell = row[c];
        const x = boardX + c*cellPx;

        // tile bg (vacío) muy sutil para “rejilla”
        ctx.globalAlpha = 0.16 * alphaRow;
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        roundRectFill(x+1, y+1, cellPx-2, cellPx-2, Math.max(4, cellPx*0.18));
        ctx.globalAlpha = 1;

        if (cell !== CELL.EMPTY){
          drawCellSpriteOrColor(cell, x, y, cellPx, alphaRow);
        } else {
          // opcional: dibujar tile_empty si existe sprite
          const emptySpr = getSprite(CELL.EMPTY);
          if (emptySpr){
            drawCellSpriteOrColor(CELL.EMPTY, x, y, cellPx, 0.15*alphaRow);
          }
        }
      }
    }

    // particles (in board coords)
    for (const p of particles){
      const k = clamp(p.t / p.life, 0, 1);
      const a = (1 - k) * 0.95;
      const x = boardX + p.x*cellPx;
      const y = boardY + p.y*cellPx - scrollPx;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * cellPx;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // float texts
    for (const f of floatTexts){
      const k = clamp(f.t / f.life, 0, 1);
      const a = (1 - k);
      const x = boardX + f.x*cellPx;
      const y = boardY + f.y*cellPx - scrollPx - k*10*dpr;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.rot);
      const sc = (1 + (1-k)*0.10) * f.scale;
      ctx.scale(sc, sc);

      // outline para “juicy”
      ctx.globalAlpha = a;
      ctx.font = `${Math.floor(12*dpr)}px ui-sans-serif,system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.lineWidth = Math.max(3, 3*dpr);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(f.text, 0, 0);

      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);

      ctx.restore();
    }

    // player
    const px = boardX + playerColFloat*cellPx;
    const py = boardY + playerRowFloat*cellPx - scrollPx;

    const pSpr = getSprite("player");
    const drawPlayerCell = (x, y) => {
      if (pSpr){
        const inset = cellPx * SPRITE_INSET_RATIO;
        const scale = SPRITE_SCALE.player;
        const ss = (cellPx - inset*2) * scale;
        const ox = x + (cellPx - ss)/2;
        const oy = y + (cellPx - ss)/2;
        ctx.drawImage(pSpr, ox, oy, ss, ss);
      } else {
        // rect
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        roundRectFill(x+2, y+2, cellPx-4, cellPx-4, Math.max(6, cellPx*0.22));
      }
      // pulse glow
      const pp = pulse;
      if (pp > 0.001){
        ctx.globalAlpha = 0.25*pp;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(2, cellPx*0.08);
        ctx.strokeRect(x+2.5, y+2.5, cellPx-5, cellPx-5);
        ctx.globalAlpha = 1;
      }
    };

    // dibuja 1 o 2 celdas
    drawPlayerCell(px, py);
    if (dualRunner){
      drawPlayerCell(px + cellPx, py);
      // unión sutil
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(px + cellPx - 2, py + 6, 4, cellPx - 12);
      ctx.globalAlpha = 1;
    }

    // escudos UI (mini pips)
    if (shields > 0){
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      for (let i=0;i<shields;i++){
        ctx.beginPath();
        ctx.arc(px + 10 + i*10, py - 6, 3.5, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // invuln hint
    if (invulnT > 0){
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(2, cellPx*0.08);
      ctx.strokeRect(px+2.5, py+2.5, cellPx*playerWidth()-5, cellPx-5);
      ctx.globalAlpha = 1;
    }

    // toast timer
    if (toastTimer > 0){
      toastTimer -= 1/60;
      if (toastTimer <= 0) toast.hidden = true;
    }
  }

  // ───────────────────────── Resize ─────────────────────────
  function resize(){
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const pad = Math.floor(14 * dpr);
    const w = canvas.width - pad*2;
    const h = canvas.height - pad*2;

    const cellW = Math.floor(w / COLS);
    const cellH = Math.floor(h / ROWS);
    cellPx = Math.max(10, Math.min(cellW, cellH));

    const boardW = cellPx * COLS;
    const boardH = cellPx * ROWS;

    boardX = Math.floor((canvas.width - boardW)/2);
    boardY = Math.floor((canvas.height - boardH)/2);

    draw();
  }

  // ───────────────────────── Game flow ─────────────────────────
  function resetRunState(){
    score = 0;
    streak = 0;
    mult = 1;

    runTime = 0;
    rowsSurvived = 0;
    scrollPx = 0;
    speedBoost = 0;

    // player defaults
    bandHeight = 3;
    dualRunner = false;
    shields = 0;
    invulnT = 0;

    // runtime multipliers
    coinMul = 1; gemMul = 1; bonusMul = 1;
    survivalAddBase = 1;
    streakPerMult = BASE_STREAK_PER_MULT;

    comboRewardMul = 1;
    comboTargetExtraTime = 0;
    trapPenaltyBase = 25;
    trapPenaltyMul = 1;
    trapSoftReset = 0;

    genBlockMul = 1;
    genGoodMul = 1;
    genBonusMul = 1;

    rerollCharges = 0;
    buffX2T = 0;

    level = 1;
    nextLevelScore = 200;

    upgradeLv = Object.create(null);

    // player center
    targetCol = Math.floor(COLS/2);
    targetRow = BAND_CENTER;
    playerColFloat = targetCol;
    playerRowFloat = targetRow;

    // combo target
    comboTarget = null;
    newComboTarget();

    particles.length = 0;
    floatTexts.length = 0;

    animT = 0;
    toastTimer = 0;
    shake = 0;
    pulse = 0;
    hue = 220;
    hueTarget = 220;
    glow = 0.16;

    initGrid();
  }

  function resetGame(goToStart=false){
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    resetRunState();

    if (goToStart){
      overlayShow(overlayStart);
      overlayHide(overlayGameOver, 0);
      overlayHide(overlayPaused, 0);
      overlayHide(overlayUpgrades, 0);
    }

    updateHud(true);
    renderComboTarget();
  }

  function startGame(){
    if (!playerName || playerName.trim().length < 2){
      showToast("Escribe un nombre primero.", 900);
      return;
    }

    overlayHide(overlayStart, 160);
    overlayHide(overlayGameOver, 0);
    overlayHide(overlayPaused, 0);
    overlayHide(overlayUpgrades, 0);

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    lastT = 0;
    requestAnimationFrame(loop);

    showToast("¡Vamos! 🔥", 700);
  }

  function setPaused(v, silent=false){
    if (gameOver) return;
    paused = !!v;
    if (paused){
      if (!silent) overlayShow(overlayPaused);
    } else {
      overlayHide(overlayPaused, 160);
    }
  }

  function showGameOver(){
    // guardar best local
    if (score > best){
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }

    // guardar run en historial
    const runs = loadRuns();
    runs.unshift({
      t: Date.now(),
      score,
      rows: rowsSurvived,
      level,
    });
    while (runs.length > 8) runs.pop();
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));

    finalLine.textContent = `Has hecho ${score} puntos (Nivel ${level}, ${rowsSurvived} filas).`;
    overlayShow(overlayGameOver);

    updateHud(true);
  }

  // ───────────────────────── Loop ─────────────────────────
  let lastT = 0;
  function loop(ts){
    if (!running) return;

    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;

    // clamp dt
    dt = clamp(dt, 0, 0.05);

    tick(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ───────────────────────── Runs stats ─────────────────────────
  function loadRuns(){
    try{
      const raw = localStorage.getItem(RUNS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch {
      return [];
    }
  }

  function refreshStartStats(){
    startBest.textContent = String(best);
    const runs = loadRuns();
    if (!runs.length){
      startRuns.textContent = "—";
      return;
    }
    const top = runs.slice(0, 3).map(r => r.score).join(" · ");
    startRuns.textContent = top;
  }

  function syncStartNameUI(){
    startName.value = playerName || "";
    btnStart.disabled = !((startName.value || "").trim().length >= 2);

    playerNameInput.value = playerName || "";
    updateHud(true);
  }

  // ───────────────────────── Buttons / UI ─────────────────────────
  function bindButtons(){
    pillVersion.textContent = `v${APP_VERSION}`;

    btnStart.addEventListener("click", () => {
      playerName = (startName.value || "").trim().slice(0,16);
      if (playerName.length < 2) return;
      localStorage.setItem(PLAYER_NAME_KEY, playerName);
      syncStartNameUI();

      resetRunState();
      startGame();
    });

    btnPlayAgain.addEventListener("click", () => {
      resetRunState();
      startGame();
    });

    btnBackToStart.addEventListener("click", () => {
      resetGame(true);
      refreshStartStats();
      syncStartNameUI();
    });

    btnResume.addEventListener("click", () => setPaused(false));
    btnPause.addEventListener("click", () => {
      if (!running || gameOver) return;
      setPaused(!paused);
    });

    btnRestart.addEventListener("click", () => {
      resetRunState();
      startGame();
    });

    btnOptions.addEventListener("click", () => overlayShow(overlayOptions));
    btnCloseOptions.addEventListener("click", () => overlayHide(overlayOptions, 160));

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
      settings.fx = clamp(Number(optFx.value) || 1.0, 0.4, 1.25);
      optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
    });

    btnClearLocal.addEventListener("click", () => {
      localStorage.removeItem(RUNS_KEY);
      refreshStartStats();
      showToast("Historial borrado.", 900);
    });

    // leaderboard
    btnLeaderboard.addEventListener("click", async () => {
      overlayShow(overlayLeaderboard);
      await fetchLeaderboard();
    });
    btnCloseLeaderboard.addEventListener("click", () => overlayHide(overlayLeaderboard, 160));
    btnSubmitScore.addEventListener("click", submitScoreOnline);

    // upgrades overlay
    btnReroll.addEventListener("click", () => {
      if (rerollCharges <= 0) return;
      rerollCharges -= 1;
      showUpgradeChoices();
      showToast("Reroll ✅", 700);
    });

    // start name input
    startName.addEventListener("input", () => {
      const nm = (startName.value || "").trim().slice(0, 16);
      btnStart.disabled = !(nm.length >= 2);
      pillPlayer.textContent = `👤 ${nm || playerName || "—"}`;
    });
  }

  // ───────────────────────── PWA ─────────────────────────
  function setupPWA(){
    const setNet = () => {
      const offline = !navigator.onLine;
      pillOffline.hidden = !offline;
      if (!overlayLeaderboard.hidden) fetchLeaderboard();
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

    // SW register
    if ("serviceWorker" in navigator){
      window.addEventListener("load", async () => {
        try{
          const swUrl = new URL("./sw.js", location.href);
          await navigator.serviceWorker.register(swUrl, { scope: "./" });
        } catch (err){
          console.warn("SW register failed:", err);
        }
      });
    }

    // Evitar scroll accidental iOS mientras juegas
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive:false });
  }

  // ───────────────────────── Leaderboard API ─────────────────────────
  function endpointOk(){
    return (LEADERBOARD_ENDPOINT && /^https?:\/\//i.test(LEADERBOARD_ENDPOINT));
  }

  async function fetchLeaderboard(){
    if (!navigator.onLine){
      lbStatus.textContent = "Offline. Conéctate para ver el ranking.";
      lbList.innerHTML = "";
      return;
    }
    if (!endpointOk()){
      lbStatus.textContent = "No hay endpoint configurado (Cloudflare Worker).";
      lbList.innerHTML = "";
      return;
    }

    lbStatus.textContent = "Cargando…";
    lbList.innerHTML = "";

    try{
      const url = new URL("/top", LEADERBOARD_ENDPOINT);
      url.searchParams.set("game", LEADERBOARD_GAME_ID);
      url.searchParams.set("limit", "25");
      const res = await fetch(url.toString(), { method:"GET" });
      const data = await res.json();

      if (!data || !data.ok){
        lbStatus.textContent = "Error al cargar ranking.";
        return;
      }

      const entries = Array.isArray(data.entries) ? data.entries : [];
      lbStatus.textContent = entries.length ? "Top mundial" : "Sin entradas aún.";

      for (let i=0;i<entries.length;i++){
        const e = entries[i];
        const row = document.createElement("div");
        row.className = "lbEntry";
        const when = e.ts ? new Date(e.ts).toLocaleString() : "";
        row.innerHTML = `
          <div class="lbLeft">
            <div class="lbName">#${i+1} ${escapeHtml(e.name || "Anon")}</div>
            <div class="lbMeta">${when}</div>
          </div>
          <div class="lbScore">${Number(e.score||0)}</div>
        `;
        lbList.appendChild(row);
      }
    } catch (err){
      console.warn(err);
      lbStatus.textContent = "Fallo de red / CORS.";
      lbList.innerHTML = "";
    }
  }

  async function submitScoreOnline(){
    if (!navigator.onLine){
      showToast("Sin internet.", 900);
      return;
    }
    if (!endpointOk()){
      showToast("No hay endpoint configurado.", 900);
      return;
    }

    const nm = (playerNameInput.value || "").trim().slice(0,16);
    if (nm.length < 2){
      showToast("Escribe un nombre.", 900);
      return;
    }
    localStorage.setItem(PLAYER_NAME_KEY, nm);
    playerName = nm;
    syncStartNameUI();

    try{
      btnSubmitScore.disabled = true;

      const res = await fetch(new URL("/submit", LEADERBOARD_ENDPOINT).toString(), {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({
          game: LEADERBOARD_GAME_ID,
          name: nm,
          score: Number(best || 0),
          ts: Date.now(),
        }),
      });
      const data = await res.json();
      if (data && data.ok){
        showToast("Enviado ✅", 900);
        await fetchLeaderboard();
      } else {
        showToast("No se pudo enviar.", 900);
      }
    } catch (err){
      console.warn(err);
      showToast("Error de red.", 900);
    } finally {
      btnSubmitScore.disabled = false;
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot(){
    if (!ctx){
      alert("Tu navegador no soporta Canvas 2D.");
      return;
    }

    best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

    applySettingsToUI();
    bindInputs();
    bindButtons();
    setupPWA();

    resize();
    window.addEventListener("resize", () => resize(), { passive:true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive:true });
    if ("ResizeObserver" in window){
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

    // sprites async: el juego funciona igual aunque aún no estén cargados
    preloadSprites().then(() => {
      if (settings.useSprites) draw();
    });

    refreshStartStats();
    syncStartNameUI();

    resetGame(true);
    draw();

    console.log(`Grid Runner PWA v${APP_VERSION}`);
  }

  boot();
})();
