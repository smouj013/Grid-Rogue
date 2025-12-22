(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.0.9");

  // ───────────────────────── DOM ─────────────────────────
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const toast = document.getElementById("toast");

  const pillPlayer = document.getElementById("pillPlayer");
  const pillOffline = document.getElementById("pillOffline");

  const btnPause = document.getElementById("btnPause");
  const btnOptions = document.getElementById("btnOptions");
  const btnInstall = document.getElementById("btnInstall");

  const zoneLeft = document.getElementById("zoneLeft");
  const zoneRight = document.getElementById("zoneRight");

  const dpad = document.getElementById("dpad");
  const dpadUp = document.getElementById("dpadUp");
  const dpadDown = document.getElementById("dpadDown");
  const dpadLeft = document.getElementById("dpadLeft");
  const dpadRight = document.getElementById("dpadRight");

  const hudScore = document.getElementById("hudScore");
  const hudStreak = document.getElementById("hudStreak");
  const hudMult = document.getElementById("hudMult");
  const hudLevel = document.getElementById("hudLevel");
  const hudSpeed = document.getElementById("hudSpeed");

  const comboTitle = document.getElementById("comboTitle");
  const comboTimer = document.getElementById("comboTimer");
  const comboSeq = document.getElementById("comboSeq");
  const comboHint = document.getElementById("comboHint");

  const overlayLoading = document.getElementById("overlayLoading");
  const loadingText = document.getElementById("loadingText");
  const loadingSub = document.getElementById("loadingSub");

  const overlayStart = document.getElementById("overlayStart");
  const startName = document.getElementById("startName");
  const startBest = document.getElementById("startBest");
  const startRuns = document.getElementById("startRuns");
  const btnStart = document.getElementById("btnStart");

  const overlayPaused = document.getElementById("overlayPaused");
  const btnResume = document.getElementById("btnResume");

  const overlayGameOver = document.getElementById("overlayGameOver");
  const finalLine = document.getElementById("finalLine");
  const btnPlayAgain = document.getElementById("btnPlayAgain");
  const btnBackToStart = document.getElementById("btnBackToStart");

  const overlayUpgrades = document.getElementById("overlayUpgrades");
  const upgBtns = [document.getElementById("upg0"), document.getElementById("upg1"), document.getElementById("upg2")];

  const overlayOptions = document.getElementById("overlayOptions");
  const btnCloseOptions = document.getElementById("btnCloseOptions");
  const optSprites = document.getElementById("optSprites");
  const optVibration = document.getElementById("optVibration");
  const optDpad = document.getElementById("optDpad");
  const optFx = document.getElementById("optFx");
  const optFxValue = document.getElementById("optFxValue");
  const btnClearLocal = document.getElementById("btnClearLocal");

  // ───────────────────────── Fix iOS VH ─────────────────────────
  function setVh() {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  }

  // ───────────────────────── Storage ─────────────────────────
  const LS_PREFIX = "grid_runner_";
  const BEST_KEY = LS_PREFIX + "best_v2";
  const RUNS_KEY = LS_PREFIX + "runs_v2";
  const NAME_KEY = LS_PREFIX + "name_v2";
  const SETTINGS_KEY = LS_PREFIX + "settings_v4";

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const nowSec = () => performance.now() * 0.001;

  function isMobileLike() {
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) <= 820;
    return coarse || small;
  }

  function vibrate(ms) {
    if (!settings.vibration) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  let toastT = 0;
  function showToast(msg, ms = 1100) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toastT = ms * 0.001;
  }
  function hideToast() {
    if (!toast) return;
    toast.hidden = true;
    toastT = 0;
  }

  function overlayShow(el) {
    if (!el) return;
    el.hidden = false;
  }
  function overlayHide(el) {
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
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const s = JSON.parse(raw);
      const d = defaultSettings();
      return {
        useSprites: s.useSprites !== false,
        vibration: s.vibration !== false,
        showDpad: ("showDpad" in s) ? !!s.showDpad : d.showDpad,
        fx: clamp(Number(s.fx ?? d.fx), 0.4, 1.25)
      };
    } catch {
      return defaultSettings();
    }
  })();

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function applySettingsToUI() {
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx) optFx.value = String(settings.fx);
    if (optFxValue) optFxValue.textContent = Number(settings.fx).toFixed(2);

    if (dpad) dpad.hidden = !settings.showDpad;
    ctx.imageSmoothingEnabled = !settings.useSprites;
  }

  // ───────────────────────── Sprites (opcionales) ─────────────────────────
  const CELL = Object.freeze({
    EMPTY: 0,
    COIN: 1,
    GEM: 2,
    BONUS: 3,
    TRAP: 4,
    BLOCK: 5
  });

  const CELL_VALUE = Object.freeze({
    [CELL.EMPTY]: 0,
    [CELL.COIN]: 10,
    [CELL.GEM]: 30,
    [CELL.BONUS]: 60,
    [CELL.TRAP]: -25,
    [CELL.BLOCK]: 0
  });

  const SPRITES = Object.freeze({
    player: "./assets/sprites/player.svg",
    [CELL.EMPTY]: "./assets/sprites/tile_empty.svg",
    [CELL.COIN]: "./assets/sprites/tile_coin.svg",
    [CELL.GEM]: "./assets/sprites/tile_gem.svg",
    [CELL.BONUS]: "./assets/sprites/tile_bonus.svg",
    [CELL.TRAP]: "./assets/sprites/tile_trap.svg",
    [CELL.BLOCK]: "./assets/sprites/tile_block.svg"
  });

  /** @type {Map<string|number, HTMLImageElement>} */
  const spriteImages = new Map();
  /** @type {Map<string|number, boolean>} */
  const spriteLoaded = new Map();

  function loadImage(key, url) {
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

  // ───────────────────────── Game config ─────────────────────────
  const W = 8;
  const H = 24;

  // ───────────────────────── Render sizing ─────────────────────────
  let dpr = 1;
  let cellPx = 18;
  let offX = 0, offY = 0;
  let viewW = 0, viewH = 0;

  let resizeQueued = false;
  function resize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;

      setVh();

      const rect = stage.getBoundingClientRect();
      viewW = rect.width;
      viewH = rect.height;

      const maxDpr = isMobileLike() ? 3 : 2;
      dpr = clamp(window.devicePixelRatio || 1, 1, maxDpr);

      // cellPx en CSS px (NO dpr) para un grid grande y nítido
      const c = Math.floor(Math.min(viewW / W, viewH / H));
      cellPx = clamp(c, 10, 64);

      const bw = cellPx * W;
      const bh = cellPx * H;

      offX = Math.floor((viewW - bw) * 0.5);
      offY = Math.floor((viewH - bh) * 0.5);

      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  // ───────────────────────── State ─────────────────────────
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  let runs = (() => {
    try { return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]") || []; }
    catch { return []; }
  })();

  let playerName = (localStorage.getItem(NAME_KEY) || "").trim();

  // board
  let grid = [];
  let scroll = 0;              // 0..1 (suave)
  let dist = 0;

  // player
  let playerCol = Math.floor(W / 2);
  let playerRow = Math.floor(H / 2);
  let bandHeight = 3;          // 3 filas
  let playerWidth = 1;

  // render smooth
  let rCol = playerCol;
  let rRow = playerRow;

  // stats
  let score = 0;
  let streak = 0;
  let mult = 1;
  let level = 1;
  let nextLevelAt = 250;

  // speed
  let baseSpeed = 1.2;         // lento al inicio
  let speed = 1.2;

  // fx
  let shakeT = 0;
  let shakeA = 0;

  // particles
  const floaters = [];

  // combo
  let combo = [];
  let comboIndex = 0;
  let comboT = 18;            // segundos para cambiar si no se completa

  // upgrades
  let pendingUpgrades = [];
  const upgradeState = new Map(); // id -> level
  let shield = 0;
  let x2T = 0;

  // run state
  let running = false;
  let paused = false;

  // ───────────────────────── Upgrades (20+) ─────────────────────────
  const UPGRADES = [
    { id:"WIDE",   title:"Runner Doble", desc:"Ahora ocupas 2 cuadrados (más pickups).", max:1,
      apply(){ playerWidth = 2; } },
    { id:"LANE1",  title:"+1 Fila Movimiento", desc:"Banda +1 (más espacio vertical).", max:4,
      apply(){ bandHeight = clamp(bandHeight + 1, 3, 9); } },
    { id:"LANE2",  title:"+2 Filas Movimiento", desc:"Banda +2 (brutal).", max:2,
      apply(){ bandHeight = clamp(bandHeight + 2, 3, 9); } },
    { id:"SHIELD", title:"Escudo", desc:"Ignora 1 KO (bloque) una vez.", max:3,
      apply(){ shield += 1; } },
    { id:"X2",     title:"x2 Puntos", desc:"Doble puntos durante 10s.", max:6,
      apply(){ x2T = Math.max(x2T, 10); } },
    { id:"SLOW",   title:"Ralentizar", desc:"Velocidad -12% permanente.", max:5,
      apply(){ baseSpeed = Math.max(0.75, baseSpeed * 0.88); } },
    { id:"MULT",   title:"Mult Fácil", desc:"Sube multiplicador más rápido.", max:5,
      apply(){ streakBonusStep = Math.max(3, streakBonusStep - 1); } },
    { id:"COIN+",  title:"Monedas +", desc:"Más monedas aparecen.", max:6,
      apply(){ spawnBias.coin += 0.05; } },
    { id:"GEM+",   title:"Gemas +", desc:"Más gemas aparecen.", max:6,
      apply(){ spawnBias.gem += 0.03; } },
    { id:"BONUS+", title:"Bonus +", desc:"Más bonus aparecen.", max:4,
      apply(){ spawnBias.bonus += 0.02; } },
    { id:"BLOCK-", title:"Menos Bloques", desc:"Reduce la probabilidad de KO.", max:6,
      apply(){ spawnBias.block -= 0.04; } },
    { id:"TRAP-",  title:"Menos Trampas", desc:"Reduce la probabilidad de trampa.", max:6,
      apply(){ spawnBias.trap -= 0.04; } },
    { id:"COMBO+", title:"Combo Buff", desc:"+50% al premio del combo.", max:6,
      apply(){ comboBonusMul *= 1.5; } },
    { id:"MAG",    title:"Mini Imán", desc:"Si coges algo, también recoge adyacentes (±1).", max:3,
      apply(){ magnet = clamp(magnet + 1, 0, 2); } },
    { id:"HEALTR", title:"Trampa Suave", desc:"Trampa resta menos.", max:4,
      apply(){ trapDamage = Math.max(5, trapDamage - 5); } },
    { id:"START+", title:"Arranque", desc:"+80 puntos al empezar la run.", max:3,
      apply(){ score += 80; } },
    { id:"SHAKE-", title:"Estabilidad", desc:"Menos shake (visual).", max:3,
      apply(){ shakeScale = Math.max(0.35, shakeScale * 0.75); } },
    { id:"FX+",    title:"Juice+", desc:"Más números y efectos (solo visual).", max:4,
      apply(){ settings.fx = clamp(settings.fx + 0.1, 0.4, 1.25); applySettingsToUI(); saveSettings(); } },
    { id:"SPEED+", title:"Rush", desc:"Velocidad +8% pero más score por segundo.", max:5,
      apply(){ baseSpeed *= 1.08; secScoreBonus += 0.4; } },
    { id:"SAFE",   title:"Red de Seguridad", desc:"El primer bloque se convierte en trampa.", max:2,
      apply(){ safeBlock += 1; } },
  ];

  // small tunables influenced by upgrades
  let streakBonusStep = 6;    // cada X racha sube mult
  let comboBonusMul = 1.0;
  let magnet = 0;             // 0..2 (recoge adyacentes)
  let trapDamage = 25;
  let shakeScale = 1.0;
  let secScoreBonus = 0;      // bonus por segundo
  let safeBlock = 0;

  // spawn bias
  const spawnBias = { coin:0, gem:0, bonus:0, trap:0, block:0 };

  // ───────────────────────── Board helpers ─────────────────────────
  function bandMinMax(){
    const half = Math.floor(bandHeight / 2);
    const min = clamp(playerRow - half, 0, H - 1);
    const max = clamp(playerRow + (bandHeight - 1 - half), 0, H - 1);
    return [min, max];
  }

  function resetBoard() {
    grid = Array.from({ length: H }, () => Array(W).fill(CELL.EMPTY));
    scroll = 0;
    dist = 0;

    // arranque con algunas filas suaves arriba
    for (let y = 0; y < 8; y++) {
      grid[y] = genRow(y, true);
    }
  }

  function pickCellType(soft = false) {
    // base weights
    let wCoin = 0.40 + spawnBias.coin;
    let wGem = 0.18 + spawnBias.gem;
    let wBonus = 0.06 + spawnBias.bonus;
    let wTrap = (soft ? 0.04 : 0.10) + spawnBias.trap;
    let wBlock = (soft ? 0.02 : 0.09) + spawnBias.block;

    // dificultad por nivel
    const t = clamp((level - 1) / 18, 0, 1);
    wTrap += 0.08 * t;
    wBlock += 0.07 * t;

    // clamps para no romper
    wTrap = clamp(wTrap, 0.01, 0.30);
    wBlock = clamp(wBlock, 0.01, 0.28);

    const sum = wCoin + wGem + wBonus + wTrap + wBlock;
    let r = Math.random() * sum;

    if ((r -= wCoin) <= 0) return CELL.COIN;
    if ((r -= wGem) <= 0) return CELL.GEM;
    if ((r -= wBonus) <= 0) return CELL.BONUS;
    if ((r -= wTrap) <= 0) return CELL.TRAP;
    return CELL.BLOCK;
  }

  function genRow(yIndex, soft = false) {
    const row = Array(W).fill(CELL.EMPTY);

    // ✅ “salen demasiados cuadrados” => limitamos densidad
    // 0..2 normalmente, sube poco con nivel
    const maxItems = (level < 5) ? 1 : (level < 12 ? 2 : 2);
    const count = (Math.random() < 0.55) ? 0 : randi(1, maxItems);

    const used = new Set();
    for (let i = 0; i < count; i++) {
      let x = randi(0, W - 1);
      let tries = 0;
      while (used.has(x) && tries++ < 12) x = randi(0, W - 1);
      used.add(x);
      row[x] = pickCellType(soft);
    }
    return row;
  }

  function shiftDownOne() {
    // cae una fila
    grid.pop();
    grid.unshift(genRow(0, level <= 2));

    // colisión cuando la fila “entra” en la banda del player
    resolveCollisionAtPlayer();
  }

  // ───────────────────────── Combo ─────────────────────────
  function newCombo() {
    const pool = [CELL.COIN, CELL.GEM, CELL.BONUS];
    const len = randi(3, 4);
    combo = [];
    for (let i = 0; i < len; i++) combo.push(pool[randi(0, pool.length - 1)]);
    comboIndex = 0;
    comboT = randi(14, 22);
    renderComboUI();
  }

  function renderComboUI() {
    if (!comboSeq) return;
    comboSeq.innerHTML = "";
    for (let i = 0; i < combo.length; i++) {
      const t = combo[i];
      const chip = document.createElement("span");
      chip.className = "comboChip" + (i < comboIndex ? " done" : "");
      const dot = document.createElement("i");
      dot.className = "comboDot " + (
        t === CELL.COIN ? "coin" :
        t === CELL.GEM ? "gem" :
        t === CELL.BONUS ? "bonus" : "coin"
      );
      const txt = document.createElement("span");
      txt.textContent = (t === CELL.COIN ? "Coin" : t === CELL.GEM ? "Gem" : "Bonus");
      chip.appendChild(dot);
      chip.appendChild(txt);
      comboSeq.appendChild(chip);
    }
    if (comboTitle) comboTitle.textContent = `Combo (${comboIndex}/${combo.length})`;
  }

  function advanceCombo(cellType) {
    const target = combo[comboIndex];
    if (cellType === target) {
      comboIndex++;
      if (comboIndex >= combo.length) {
        const bonus = Math.floor(150 * mult * comboBonusMul);
        addScore(bonus, "COMBO!");
        vibrate(18);
        shake(0.12, 5);
        newCombo();
      } else {
        renderComboUI();
      }
      return;
    }

    // reset suave
    comboIndex = (cellType === combo[0]) ? 1 : 0;
    renderComboUI();
  }

  // ───────────────────────── Score / HUD ─────────────────────────
  function addFloater(xCell, yCell, text, color) {
    floaters.push({
      x: xCell + 0.5,
      y: yCell + 0.5,
      text,
      color,
      t: 0,
      life: 0.85 + 0.25 * settings.fx,
      vy: -0.9 - 0.4 * settings.fx,
      s: 1.0 + 0.15 * settings.fx
    });
  }

  function addScore(points, label = null, atX = null, atY = null, color = null) {
    const mul = (x2T > 0) ? 2 : 1;
    const p = Math.floor(points * mul);
    score = Math.max(0, score + p);

    if (hudScore) hudScore.textContent = String(score);

    if (label && atX != null && atY != null) {
      addFloater(atX, atY, label, color || "rgba(255,255,255,0.92)");
    }
  }

  function recomputeMult() {
    mult = 1 + Math.floor(streak / streakBonusStep);
    mult = clamp(mult, 1, 12);
    if (hudMult) hudMult.textContent = `x${mult}`;
  }

  function refreshHud() {
    if (hudScore) hudScore.textContent = String(score);
    if (hudStreak) hudStreak.textContent = String(streak);
    if (hudLevel) hudLevel.textContent = String(level);
    if (hudMult) hudMult.textContent = `x${mult}`;
    if (hudSpeed) hudSpeed.textContent = speed.toFixed(1);
  }

  function updateBgHue() {
    // hue según racha/mult (visual suave)
    const target = 345 + clamp(streak, 0, 30) * 2.5 + (mult - 1) * 6;
    const current = Number(getComputedStyle(document.documentElement).getPropertyValue("--hue")) || 345;
    const next = lerp(current, target, 0.05 + 0.06 * settings.fx);
    document.documentElement.style.setProperty("--hue", String(next));
  }

  // ───────────────────────── Collisions ─────────────────────────
  function takeCell(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return CELL.EMPTY;
    const t = grid[y][x];
    grid[y][x] = CELL.EMPTY; // ✅ “ya no hace nada” una vez pasado
    return t;
  }

  function resolveCollisionAtPlayer() {
    const [bMin, bMax] = bandMinMax();
    const y = clamp(playerRow, bMin, bMax);

    // colisiones para 1 o 2 tiles
    const cols = (playerWidth === 2) ? [playerCol, playerCol + 1] : [playerCol];

    for (const cx of cols) {
      const t = takeCell(cx, y);
      if (t === CELL.EMPTY) continue;

      if (t === CELL.BLOCK) {
        if (safeBlock > 0) {
          safeBlock--;
          handleTrap(cx, y, true);
        } else if (shield > 0) {
          shield--;
          addFloater(cx, y, "SHIELD!", "rgba(182,183,255,0.95)");
          shake(0.12, 6);
          vibrate(25);
        } else {
          // KO
          gameOver("Bloque KO");
          return;
        }
      } else if (t === CELL.TRAP) {
        handleTrap(cx, y, false);
      } else {
        // positivo
        const base = CELL_VALUE[t];
        const pts = Math.floor(base * mult);
        const col = (t === CELL.COIN) ? "rgba(255,204,51,0.95)"
                 : (t === CELL.GEM) ? "rgba(58,211,255,0.95)"
                 : "rgba(46,229,157,0.95)";

        addScore(pts, `+${pts}`, cx, y, col);
        streak++;
        recomputeMult();
        advanceCombo(t);

        shake(0.07, 3);
        vibrate(10);

        // magnet (recoge adyacentes)
        if (magnet > 0) {
          for (let dx = -magnet; dx <= magnet; dx++) {
            if (dx === 0) continue;
            const tx = cx + dx;
            const tt = (tx >= 0 && tx < W) ? grid[y][tx] : CELL.EMPTY;
            if (tt === CELL.COIN || tt === CELL.GEM || tt === CELL.BONUS) {
              grid[y][tx] = CELL.EMPTY;
              const b2 = CELL_VALUE[tt];
              const pts2 = Math.floor(b2 * mult);
              addScore(pts2, `+${pts2}`, tx, y, col);
              streak++;
            }
          }
          recomputeMult();
        }
      }
    }

    if (hudStreak) hudStreak.textContent = String(streak);
  }

  function handleTrap(cx, cy, fromBlock) {
    const dmg = fromBlock ? trapDamage : trapDamage;
    score = Math.max(0, score - dmg);
    streak = 0;
    mult = 1;

    if (hudScore) hudScore.textContent = String(score);
    if (hudStreak) hudStreak.textContent = String(streak);
    if (hudMult) hudMult.textContent = "x1";

    addFloater(cx, cy, fromBlock ? `- ${dmg} (SAFE)` : `- ${dmg}`, "rgba(255,107,107,0.95)");
    shake(0.14, 7);
    vibrate(28);
    comboIndex = 0;
    renderComboUI();
  }

  // ───────────────────────── Level / upgrades ─────────────────────────
  function maybeLevelUp() {
    if (score < nextLevelAt) return;

    level++;
    nextLevelAt = Math.floor(nextLevelAt * 1.35 + 120);
    if (hudLevel) hudLevel.textContent = String(level);

    running = false;
    paused = true;

    showUpgradeChoices();
  }

  function getUpgradeLevel(id) {
    return upgradeState.get(id) || 0;
  }

  function canPickUpgrade(u) {
    return getUpgradeLevel(u.id) < u.max;
  }

  function pickUpgradeChoices() {
    const pool = UPGRADES.filter(canPickUpgrade);
    // fallback si están todas max
    if (pool.length === 0) return UPGRADES.slice(0, 3);

    const out = [];
    const used = new Set();
    while (out.length < 3 && used.size < pool.length) {
      const u = pool[randi(0, pool.length - 1)];
      if (used.has(u.id)) continue;
      used.add(u.id);
      out.push(u);
    }
    while (out.length < 3) out.push(pool[randi(0, pool.length - 1)]);
    return out;
  }

  function showUpgradeChoices() {
    pendingUpgrades = pickUpgradeChoices();

    for (let i = 0; i < 3; i++) {
      const u = pendingUpgrades[i];
      const lv = getUpgradeLevel(u.id);
      upgBtns[i].innerHTML = `
        <div class="uTitle">${escapeHtml(u.title)}</div>
        <div class="uDesc">${escapeHtml(u.desc)}</div>
        <div class="uMeta">Lv ${lv + 1} / ${u.max}</div>
      `;
      upgBtns[i].onclick = () => {
        applyUpgrade(u);
        overlayHide(overlayUpgrades);
        paused = false;
        running = true;
      };
    }

    overlayShow(overlayUpgrades);
    showToast("Mejora desbloqueada ✨", 900);
  }

  function applyUpgrade(u) {
    const lv = getUpgradeLevel(u.id);
    upgradeState.set(u.id, lv + 1);
    try { u.apply(); } catch {}
    refreshHud();
    shake(0.08, 3);
    vibrate(12);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  // ───────────────────────── Game flow ─────────────────────────
  function resetGame(full = true) {
    score = 0;
    streak = 0;
    mult = 1;
    level = 1;
    nextLevelAt = 250;

    baseSpeed = 1.2;
    speed = 1.2;

    shield = 0;
    x2T = 0;

    // upgrades runtime knobs
    streakBonusStep = 6;
    comboBonusMul = 1.0;
    magnet = 0;
    trapDamage = 25;
    shakeScale = 1.0;
    secScoreBonus = 0;
    safeBlock = 0;
    spawnBias.coin = spawnBias.gem = spawnBias.bonus = spawnBias.trap = spawnBias.block = 0;

    playerWidth = 1;
    bandHeight = 3;

    playerCol = Math.floor(W / 2);
    playerRow = Math.floor(H / 2);
    rCol = playerCol;
    rRow = playerRow;

    floaters.length = 0;
    upgradeState.clear();

    resetBoard();
    newCombo();
    refreshHud();

    if (full) {
      updateStartStats();
    }
  }

  function startRun() {
    overlayHide(overlayStart);
    overlayHide(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayUpgrades);
    overlayHide(overlayOptions);

    resetGame(false);
    running = true;
    paused = false;

    showToast("GO! 🚀", 700);

    // si hay update esperando, que no corte la run
    // (se aplica al final)
  }

  function pauseGame() {
    if (!running) return;
    running = false;
    paused = true;
    overlayShow(overlayPaused);
  }

  function resumeGame() {
    overlayHide(overlayPaused);
    overlayHide(overlayOptions);
    paused = false;
    running = true;
  }

  function gameOver(reason = "KO") {
    running = false;
    paused = false;

    // guardar best y run
    best = Math.max(best, score);
    try { localStorage.setItem(BEST_KEY, String(best)); } catch {}

    runs.unshift({ score, ts: Date.now() });
    runs = runs.slice(0, 12);
    try { localStorage.setItem(RUNS_KEY, JSON.stringify(runs)); } catch {}

    updateStartStats();

    if (finalLine) finalLine.textContent = `Score: ${score} · Mejor: ${best} · (${reason})`;
    overlayShow(overlayGameOver);

    // aplicar update pendiente si existe
    maybeApplyPendingUpdate();
  }

  function updateStartStats() {
    if (startBest) startBest.textContent = String(best);
    if (startRuns) startRuns.textContent = String(runs.length);
  }

  function syncNameUI() {
    const saved = (localStorage.getItem(NAME_KEY) || "").trim();
    if (saved) playerName = saved;

    if (pillPlayer) pillPlayer.textContent = `👤 ${playerName || "—"}`;
    if (startName) startName.value = playerName || "";
    if (btnStart) btnStart.disabled = !((startName.value || "").trim().length >= 2);
  }

  // ───────────────────────── Input ─────────────────────────
  function clampPlayerInside() {
    const maxCol = W - playerWidth;
    playerCol = clamp(playerCol, 0, maxCol);

    const [bMin, bMax] = bandMinMax();
    playerRow = clamp(playerRow, bMin, bMax);
  }

  function move(dx, dy) {
    playerCol += dx;
    playerRow += dy;
    clampPlayerInside();
    vibrate(6);
  }

  function bindInputs() {
    // teclado
    window.addEventListener("keydown", (e) => {
      if (overlayStart && !overlayStart.hidden) return;
      if (overlayOptions && !overlayOptions.hidden) return;

      const k = e.key.toLowerCase();
      if (k === "p" || k === "escape") { running ? pauseGame() : resumeGame(); return; }
      if (!running) return;

      if (k === "arrowleft" || k === "a") move(-1, 0);
      else if (k === "arrowright" || k === "d") move(1, 0);
      else if (k === "arrowup" || k === "w") move(0, -1);
      else if (k === "arrowdown" || k === "s") move(0, 1);
    }, { passive: true });

    // DPad
    dpadLeft?.addEventListener("click", () => running && move(-1, 0));
    dpadRight?.addEventListener("click", () => running && move(1, 0));
    dpadUp?.addEventListener("click", () => running && move(0, -1));
    dpadDown?.addEventListener("click", () => running && move(0, 1));

    // tap left/right rápido
    zoneLeft?.addEventListener("pointerdown", (e) => { if (running) { e.preventDefault(); move(-1, 0); } }, { passive:false });
    zoneRight?.addEventListener("pointerdown", (e) => { if (running) { e.preventDefault(); move(1, 0); } }, { passive:false });

    // swipe 4 dirs
    let sx = 0, sy = 0, st = 0, swiping = false;
    stage.addEventListener("pointerdown", (e) => {
      if (!running) return;
      swiping = true;
      sx = e.clientX; sy = e.clientY;
      st = nowSec();
    }, { passive:true });

    stage.addEventListener("pointerup", (e) => {
      if (!running || !swiping) return;
      swiping = false;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const adx = Math.abs(dx), ady = Math.abs(dy);

      // umbral
      const thr = Math.max(18, Math.min(viewW, viewH) * 0.04);
      if (Math.max(adx, ady) < thr) return;

      if (adx > ady) move(dx < 0 ? -1 : 1, 0);
      else move(0, dy < 0 ? -1 : 1);
    }, { passive:true });

    // evitar scroll accidental en iOS mientras juegas
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive:false });
  }

  // ───────────────────────── Buttons ─────────────────────────
  function bindButtons() {
    btnPause?.addEventListener("click", () => running ? pauseGame() : resumeGame());
    btnResume?.addEventListener("click", resumeGame);

    btnOptions?.addEventListener("click", () => {
      overlayShow(overlayOptions);
      if (running) pauseGame();
      applySettingsToUI();
    });
    btnCloseOptions?.addEventListener("click", () => {
      overlayHide(overlayOptions);
      if (paused) overlayHide(overlayPaused);
    });

    btnStart?.addEventListener("click", () => {
      const nm = (startName.value || "").trim().slice(0, 16);
      if (nm.length < 2) return;
      playerName = nm;
      try { localStorage.setItem(NAME_KEY, nm); } catch {}
      syncNameUI();
      startRun();
    });

    startName?.addEventListener("input", () => {
      btnStart.disabled = !((startName.value || "").trim().length >= 2);
    });

    btnPlayAgain?.addEventListener("click", () => startRun());
    btnBackToStart?.addEventListener("click", () => {
      overlayHide(overlayGameOver);
      overlayShow(overlayStart);
    });

    optSprites?.addEventListener("change", () => { settings.useSprites = !!optSprites.checked; saveSettings(); applySettingsToUI(); });
    optVibration?.addEventListener("change", () => { settings.vibration = !!optVibration.checked; saveSettings(); });
    optDpad?.addEventListener("change", () => { settings.showDpad = !!optDpad.checked; saveSettings(); applySettingsToUI(); });
    optFx?.addEventListener("input", () => {
      settings.fx = clamp(Number(optFx.value) || 1.0, 0.4, 1.25);
      saveSettings();
      applySettingsToUI();
    });

    btnClearLocal?.addEventListener("click", () => {
      try {
        localStorage.removeItem(BEST_KEY);
        localStorage.removeItem(RUNS_KEY);
      } catch {}
      best = 0;
      runs = [];
      updateStartStats();
      showToast("Borrado ✅", 900);
    });
  }

  // ───────────────────────── PWA install + auto update ─────────────────────────
  const SW_TOAST_KEY = "sw_update_toast_v2";
  let pendingWorker = null;
  let reloadedOnce = false;

  function maybeApplyPendingUpdate() {
    if (!pendingWorker) return;
    try {
      pendingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch {}
    pendingWorker = null;
  }

  function setupPWA() {
    const setNet = () => {
      const offline = !navigator.onLine;
      if (pillOffline) pillOffline.hidden = !offline;
    };
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    setNet();

    // Install prompt (Chrome/Android)
    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) btnInstall.hidden = false;
    });

    btnInstall?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      btnInstall.disabled = true;
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      btnInstall.hidden = true;
      btnInstall.disabled = false;
    });

    // SW register
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          const swUrl = new URL("./sw.js", location.href);
          const reg = await navigator.serviceWorker.register(swUrl, { scope: "./" });

          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloadedOnce) return;
            reloadedOnce = true;
            location.reload();
          });

          const schedule = (worker) => {
            pendingWorker = worker;
            // ✅ si no estás jugando, aplica ya
            if (!running) {
              showToast("Update listo ✅ aplicando…", 900);
              maybeApplyPendingUpdate();
            } else if (!sessionStorage.getItem(SW_TOAST_KEY)) {
              sessionStorage.setItem(SW_TOAST_KEY, "1");
              showToast("Update listo ✅ se aplicará al terminar la run", 1600);
            }
          };

          if (reg.waiting) schedule(reg.waiting);

          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                schedule(nw);
              }
            });
          });

          const safeUpdate = () => reg.update().catch(() => {});
          setInterval(safeUpdate, 15 * 60 * 1000);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") safeUpdate();
          });

        } catch (err) {
          console.warn("SW register failed:", err);
        }
      });
    }
  }

  // ───────────────────────── Loading sequence (mín 5s) ─────────────────────────
  async function startLoadingSequence() {
    overlayShow(overlayLoading);
    overlayHide(overlayStart);
    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);
    overlayHide(overlayUpgrades);
    overlayHide(overlayOptions);

    if (loadingText) loadingText.textContent = "Cargando…";
    if (loadingSub) loadingSub.textContent = "Preparando la cuadrícula";

    const t0 = nowSec();
    const minMs = 5000;

    const pSprites = preloadSprites().catch(() => {});
    const pMin = new Promise((r) => setTimeout(r, minMs));

    setTimeout(() => { if (loadingSub) loadingSub.textContent = "Cargando sprites (opcional)"; }, 900);
    setTimeout(() => { if (loadingSub) loadingSub.textContent = "Casi listo…"; }, 2600);

    await Promise.allSettled([pSprites, pMin]);

    const waited = (nowSec() - t0) * 1000;
    if (waited < minMs) await new Promise((r) => setTimeout(r, minMs - waited));

    overlayHide(overlayLoading);
    overlayShow(overlayStart);
    showToast("Listo ✅", 700);
  }

  // ───────────────────────── Loop ─────────────────────────
  let lastT = nowSec();

  function shake(time, amp) {
    shakeT = Math.max(shakeT, time);
    shakeA = Math.max(shakeA, amp);
  }

  function tick(dt) {
    // toast
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) hideToast();
    }

    updateBgHue();

    if (!running) {
      draw();
      return;
    }

    // timers
    if (x2T > 0) x2T = Math.max(0, x2T - dt);
    comboT -= dt;
    if (comboTimer) comboTimer.textContent = `${Math.ceil(comboT)}s`;
    if (comboT <= 0) newCombo();

    // speed (subida progresiva, suave)
    const targetSpeed = baseSpeed + (level - 1) * 0.08 + dist * 0.0008;
    speed = lerp(speed, targetSpeed, clamp(dt * 1.3, 0, 1));
    dist += speed * dt;

    // score por segundo (si hay upgrade rush)
    if (secScoreBonus > 0) {
      score += secScoreBonus * dt;
      score = Math.floor(score);
      if (hudScore) hudScore.textContent = String(score);
    }

    // scroll
    scroll += speed * dt;
    while (scroll >= 1) {
      scroll -= 1;
      shiftDownOne();
      maybeLevelUp();
    }

    // smooth player
    rCol = lerp(rCol, playerCol, clamp(dt * 14, 0, 1));
    rRow = lerp(rRow, playerRow, clamp(dt * 14, 0, 1));

    // particles
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      f.y += f.vy * dt;
      if (f.t >= f.life) floaters.splice(i, 1);
    }

    // shake
    if (shakeT > 0) {
      shakeT -= dt;
      if (shakeT <= 0) { shakeT = 0; shakeA = 0; }
    }

    refreshHud();
    draw();
  }

  function draw() {
    // fondo
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, viewW, viewH);

    // apply shake
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      const a = shakeA * (0.5 + 0.5 * Math.random()) * shakeScale;
      sx = (Math.random() * 2 - 1) * a;
      sy = (Math.random() * 2 - 1) * a;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // board rect
    const bw = cellPx * W;
    const bh = cellPx * H;

    // band highlight (3 filas)
    const [bMin, bMax] = bandMinMax();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(offX, offY + (bMin + scroll) * cellPx, bw, (bMax - bMin + 1) * cellPx);

    // grid cells
    for (let y = 0; y < H; y++) {
      const yPix = offY + (y + scroll) * cellPx;

      // “ya no hacen daño” => rows debajo de la banda se ven apagadas
      const behind = y > (bMax + 1);
      const alpha = behind ? 0.32 : 1.0;

      for (let x = 0; x < W; x++) {
        const t = grid[y][x];
        const xPix = offX + x * cellPx;

        // tile bg
        ctx.fillStyle = behind ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.045)";
        ctx.fillRect(xPix + 1, yPix + 1, cellPx - 2, cellPx - 2);

        if (t !== CELL.EMPTY) {
          const spr = getSprite(t);
          if (spr) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(spr, xPix + 1, yPix + 1, cellPx - 2, cellPx - 2);
            ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle =
              (t === CELL.COIN) ? "rgba(255,204,51,0.92)" :
              (t === CELL.GEM) ? "rgba(58,211,255,0.92)" :
              (t === CELL.BONUS) ? "rgba(46,229,157,0.92)" :
              (t === CELL.TRAP) ? "rgba(255,107,107,0.92)" :
              "rgba(182,183,255,0.92)";
            ctx.fillRect(xPix + 3, yPix + 3, cellPx - 6, cellPx - 6);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // player draw
    const pSpr = getSprite("player");
    const pY = clamp(rRow, bMin, bMax);
    const py = offY + (pY + scroll) * cellPx;

    const cols = (playerWidth === 2) ? [rCol, rCol + 1] : [rCol];
    for (const c of cols) {
      const px = offX + c * cellPx;
      if (pSpr) {
        ctx.drawImage(pSpr, px + 1, py + 1, cellPx - 2, cellPx - 2);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(px + 3, py + 3, cellPx - 6, cellPx - 6);
      }
      // outline
      ctx.strokeStyle = "rgba(230,0,18,0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, cellPx - 4, cellPx - 4);
    }

    // particles
    for (const f of floaters) {
      const t = clamp(f.t / f.life, 0, 1);
      const a = 1 - t;
      const xx = offX + f.x * cellPx;
      const yy = offY + (f.y + scroll) * cellPx;

      ctx.globalAlpha = a;
      ctx.fillStyle = f.color || "rgba(255,255,255,0.9)";
      ctx.font = `${Math.floor(14 * f.s)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, xx, yy);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot() {
    if (!ctx) {
      alert("Tu navegador no soporta Canvas 2D.");
      return;
    }

    setVh();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive: true });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => resize());
      ro.observe(stage);
    }

    applySettingsToUI();
    bindInputs();
    bindButtons();
    setupPWA();

    syncNameUI();
    updateStartStats();

    resetGame(true);
    resize();
    draw();

    startLoadingSequence().catch(() => {
      overlayHide(overlayLoading);
      overlayShow(overlayStart);
    });

    console.log(`Grid Runner PWA v${APP_VERSION}`);
  }

  // RAF
  function frame() {
    const t = nowSec();
    const dt = clamp(t - lastT, 0, 0.05);
    lastT = t;
    tick(dt);
    requestAnimationFrame(frame);
  }

  boot();
  requestAnimationFrame(frame);

})();
