/* Grid Runner — PWA (v0.0.4)
   ✅ Player centrado en el grid
   ✅ Banda de 3 filas (marcada) donde puede moverse (4 direcciones)
   ✅ Celdas “pasadas” atenuadas (visual: ya no afectan)
   ✅ Start con nombre + guardado local de runs
   ✅ Opciones (vibración, d-pad, intensidad FX)
   ✅ Números más juicy por color
*/
(() => {
  "use strict";

  const APP_VERSION = "0.0.4";

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
  const pillSpeed = $("pillSpeed");
  const pillPlayer = $("pillPlayer");

  const btnPause = $("btnPause");
  const btnRestart = $("btnRestart");
  const btnInstall = $("btnInstall");
  const pillOffline = $("pillOffline");

  const btnOptions = $("btnOptions");
  const overlayOptions = $("overlayOptions");
  const btnCloseOptions = $("btnCloseOptions");
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

  const ROOT = document.documentElement;

  // ───────────────────────── Local storage keys ─────────────────────────
  const BEST_KEY = "grid_runner_best_v4";
  const RUNS_KEY = "grid_runner_runs_v1";
  const PLAYER_NAME_KEY = "grid_runner_player_name_v2";
  const SETTINGS_KEY = "grid_runner_settings_v1";

  // ───────────────────────── Leaderboard config (ONLINE) ─────────────────────────
  const LEADERBOARD_ENDPOINT = ""; // <- pon tu Cloudflare Worker URL aquí
  const LEADERBOARD_GAME_ID = "grid-runner";

  // ───────────────────────── Game config ─────────────────────────
  const COLS = 8;
  const ROWS = 24;

  // Banda central de movimiento: 3 filas
  const BAND_HEIGHT = 3;
  const BAND_CENTER = Math.floor(ROWS / 2);
  const BAND_START = BAND_CENTER - 1;
  const BAND_END = BAND_CENTER + 1;

  const CELL = Object.freeze({
    EMPTY: 0,
    BLOCK: 1,  // KO
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

  // Velocidad (rows/sec)
  const SPEED_START = 0.85;
  const SPEED_MAX   = 4.50;
  const SPEED_RAMP_SECONDS = 85;

  // Smooth movement
  const PLAYER_SMOOTH_CELLS_PER_SEC = 18;

  // Combo reward cada N
  const COMBO_EVERY = 8;

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = Object.freeze({
    vibration: true,
    showDpad: true,
    fx: 1.0, // 0.4..1.25
  });

  /** @type {{vibration:boolean, showDpad:boolean, fx:number}} */
  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const obj = JSON.parse(raw);
      return {
        vibration: !!obj.vibration,
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
    optVibration.checked = settings.vibration;
    optDpad.checked = settings.showDpad;
    optFx.value = String(settings.fx);
    optFxValue.textContent = settings.fx.toFixed(2);
    dpad.hidden = !settings.showDpad;
  }

  // ───────────────────────── State ─────────────────────────
  let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let cellPx = 18;
  let boardX = 0, boardY = 0;

  let running = false;
  let paused = false;
  let gameOver = false;

  let score = 0;
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

  let streak = 0;
  let mult = 1;

  let runTime = 0;

  // Scroll continuo: 0..cellPx
  let scrollPx = 0;

  // Speed boost (por bonus/trampa) que decae a 0
  let speedBoost = 0; // -0.25..+0.35

  // Player movement (col/row dentro de la banda)
  let targetCol = Math.floor(COLS / 2);
  let targetRow = BAND_CENTER;

  let playerColFloat = targetCol;
  let playerRowFloat = targetRow;

  // Grid
  /** @type {Uint8Array[]} */
  let grid = [];

  // Animation time
  let animT = 0;

  // Toast timer
  let toastTimer = 0;

  // Visual FX
  let shake = 0;
  let shakeSeed = 0;
  let pulse = 0;
  let hue = 220;
  let hueTarget = 220;
  let glow = 0.18;

  /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,size:number,color:string,alpha:number}[]} */
  const particles = [];
  /** @type {{x:number,y:number,text:string,life:number,max:number,vy:number,alpha:number,color:string,scale0:number,scale1:number}[]} */
  const floatTexts = [];

  // HUD prev
  let prevScore = -1, prevStreak = -1, prevMult = -1, prevBest = -1;
  let deltaTimer = 0;

  // Player name
  let playerName = (localStorage.getItem(PLAYER_NAME_KEY) || "").trim().slice(0, 16);

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randi = (min, max) => (Math.random() * (max - min + 1) + min) | 0;

  function vibrate(ms = 12) {
    if (!settings.vibration) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
  }

  // ───────────────────────── UI helpers ─────────────────────────
  function showToast(msg, ms = 900) {
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = ms;
  }
  function hideToast() {
    toast.hidden = true;
    toastTimer = 0;
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function setScoreDelta(v) {
    deltaTimer = 900;
    hudScoreDelta.textContent = (v >= 0 ? `+${v}` : `${v}`);
    hudScoreDelta.classList.toggle("delta", true);
  }

  function updateComboUI() {
    const p = (streak % COMBO_EVERY) / COMBO_EVERY;
    hudComboFill.style.width = `${Math.floor(p * 100)}%`;
    hudComboText.textContent = `Combo ${streak % COMBO_EVERY}/${COMBO_EVERY}`;
  }

  function updateHud(force = false) {
    if (force || score !== prevScore) { hudScore.textContent = String(score); bump(hudScore); prevScore = score; }
    if (force || streak !== prevStreak) { hudStreak.textContent = String(streak); bump(hudStreak); prevStreak = streak; updateComboUI(); }
    if (force || mult !== prevMult) { hudMult.textContent = String(mult); bump(hudMult); prevMult = mult; }
    if (force || best !== prevBest) { hudBest.textContent = String(best); bump(hudBest); prevBest = best; }
    pillPlayer.textContent = `👤 ${playerName || "—"}`;
  }

  function overlayShow(el) {
    el.classList.remove("fadeOut");
    el.hidden = false;
  }

  function overlayHide(el, ms = 180) {
    if (el.hidden) return;
    el.classList.add("fadeOut");
    window.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("fadeOut");
    }, ms);
  }

  // ───────────────────────── Runs local (historial) ─────────────────────────
  function loadRuns() {
    try {
      const raw = localStorage.getItem(RUNS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, 50);
    } catch {
      return [];
    }
  }

  function saveRuns(runs) {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 50)));
  }

  function addRun(scoreFinal) {
    const runs = loadRuns();
    runs.unshift({
      s: scoreFinal | 0,
      t: Date.now(),
      n: (playerName || "").slice(0, 16),
    });
    saveRuns(runs);
  }

  function refreshStartStats() {
    startBest.textContent = String(best);
    const runs = loadRuns();
    const last = runs.slice(0, 3).map(r => String(r.s));
    startRuns.textContent = last.length ? last.join(" · ") : "—";
  }

  // ───────────────────────── Board generation ─────────────────────────
  function makeEmptyRow() {
    const row = new Uint8Array(COLS);
    row.fill(CELL.EMPTY);
    return row;
  }

  function chooseType(difficulty01) {
    const fill = clamp(0.16 + difficulty01 * 0.12, 0.16, 0.28);
    if (Math.random() > fill) return CELL.EMPTY;

    const wBlock = 0.34 + difficulty01 * 0.10;
    const wCoin  = 0.32 - difficulty01 * 0.02;
    const wGem   = 0.16;
    const wTrap  = 0.12 + difficulty01 * 0.04;
    const wBonus = 0.06;

    const sum = wBlock + wCoin + wGem + wTrap + wBonus;
    let x = Math.random() * sum;

    if ((x -= wBlock) < 0) return CELL.BLOCK;
    if ((x -= wCoin) < 0) return CELL.COIN;
    if ((x -= wGem) < 0) return CELL.GEM;
    if ((x -= wTrap) < 0) return CELL.TRAP;
    return CELL.BONUS;
  }

  function generateRow(difficulty01) {
    const row = makeEmptyRow();

    // Camino seguro 1-2 columnas
    const safeCol = randi(0, COLS - 1);
    const safeCol2 = (Math.random() < 0.25)
      ? clamp(safeCol + (Math.random() < 0.5 ? -1 : 1), 0, COLS - 1)
      : safeCol;

    const maxBlocks = 2 + (difficulty01 > 0.75 ? 1 : 0);
    const maxItems  = 2 + (difficulty01 > 0.55 ? 1 : 0);

    let blocks = 0;
    let items = 0;

    for (let c = 0; c < COLS; c++) {
      if (c === safeCol || c === safeCol2) continue;

      const t = chooseType(difficulty01);

      if (t === CELL.BLOCK) {
        if (blocks >= maxBlocks) continue;
        blocks++;
        row[c] = t;
      } else if (t !== CELL.EMPTY) {
        if (items >= maxItems) continue;
        items++;
        row[c] = t;
      }
    }

    if (difficulty01 < 0.25 && items === 0 && Math.random() < 0.35) {
      const c = randi(0, COLS - 1);
      if (c !== safeCol && row[c] === CELL.EMPTY) row[c] = CELL.COIN;
    }

    return row;
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push(generateRow(0.0));
    }
  }

  // ───────────────────────── FX helpers ─────────────────────────
  function cellCenterPx(col, row) {
    return {
      x: boardX + col * cellPx + cellPx * 0.5,
      y: boardY + row * cellPx + cellPx * 0.5,
    };
  }

  function spawnParticles(col, row, color, amount, power = 1) {
    const fx = settings.fx;
    const c = cellCenterPx(col, row);
    const n = Math.floor(amount * fx);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.4) * power * fx;
      particles.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * sp * 2.4,
        vy: Math.sin(a) * sp * 2.4 - (1.1 * power * fx),
        life: 0,
        max: 330 + Math.random() * 260,
        size: (1.4 + Math.random() * 2.4) * dpr * fx,
        color,
        alpha: 1,
      });
    }
  }

  function spawnFloatText(col, row, text, color, kind = "normal") {
    const fx = settings.fx;
    const c = cellCenterPx(col, row);
    const max = kind === "combo" ? 980 : 860;
    floatTexts.push({
      x: c.x,
      y: c.y - 7 * dpr,
      text,
      life: 0,
      max,
      vy: (-0.26 * dpr) * (kind === "combo" ? 1.15 : 1.0),
      alpha: 1,
      color,
      scale0: (kind === "combo" ? 1.35 : 1.18) * fx,
      scale1: 1.0 * fx,
    });
  }

  function kick(type) {
    const fx = settings.fx;
    if (type === "good") {
      shake = clamp(shake + 0.12 * fx, 0, 1);
      pulse = clamp(pulse + 0.16 * fx, 0, 1);
      glow = clamp(glow + 0.02 * fx, 0.16, 0.30);
      vibrate(10);
    } else if (type === "bonus") {
      shake = clamp(shake + 0.20 * fx, 0, 1);
      pulse = clamp(pulse + 0.22 * fx, 0, 1);
      glow = clamp(glow + 0.03 * fx, 0.16, 0.32);
      vibrate(18);
    } else if (type === "bad") {
      shake = clamp(shake + 0.18 * fx, 0, 1);
      pulse = clamp(pulse + 0.14 * fx, 0, 1);
      glow = clamp(glow + 0.015 * fx, 0.16, 0.28);
      vibrate(22);
    } else if (type === "dead") {
      shake = 1; pulse = 1; glow = 0.32;
      vibrate(70);
    }
  }

  function updateTheme(dtMs) {
    const s = clamp(streak, 0, 50);
    hueTarget = 215 + s * 1.25;
    hue += (hueTarget - hue) * (1 - Math.pow(0.0018, dtMs));

    glow += (0.18 - glow) * (1 - Math.pow(0.0022, dtMs));
    pulse += (0 - pulse) * (1 - Math.pow(0.0045, dtMs));
    shake += (0 - shake) * (1 - Math.pow(0.0060, dtMs));
    speedBoost += (0 - speedBoost) * (1 - Math.pow(0.0028, dtMs));

    ROOT.style.setProperty("--hue", hue.toFixed(2));
    ROOT.style.setProperty("--glow", glow.toFixed(3));
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      const t = p.life / p.max;
      p.vy += 0.0026 * dt;
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.alpha = 1 - t;
      if (t >= 1) particles.splice(i, 1);
    }

    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const ft = floatTexts[i];
      ft.life += dt;
      const t = ft.life / ft.max;
      ft.y += ft.vy * (dt / 16.67) * 10;
      ft.alpha = 1 - t;
      if (t >= 1) floatTexts.splice(i, 1);
    }
  }

  // ───────────────────────── Speed / difficulty ─────────────────────────
  function difficulty01() {
    const t = clamp(runTime / SPEED_RAMP_SECONDS, 0, 1);
    const s = clamp(streak / 35, 0, 1);
    return clamp(t * 0.88 + s * 0.12, 0, 1);
  }

  function currentSpeedRowsPerSec() {
    const d = difficulty01();
    const base = SPEED_START + (SPEED_MAX - SPEED_START) * d;
    const streakBoost = 1 + clamp(mult - 1, 0, 4) * 0.03;
    const boost = 1 + clamp(speedBoost, -0.25, 0.35);
    return base * streakBoost * boost;
  }

  // ───────────────────────── Game logic ─────────────────────────
  function resetGame(showStartOverlay = true) {
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    streak = 0;
    mult = 1;

    runTime = 0;

    scrollPx = 0;
    speedBoost = 0;

    targetCol = Math.floor(COLS / 2);
    targetRow = BAND_CENTER;
    playerColFloat = targetCol;
    playerRowFloat = targetRow;

    particles.length = 0;
    floatTexts.length = 0;
    shake = 0; pulse = 0; glow = 0.18;

    initGrid();
    updateHud(true);

    hudScoreDelta.textContent = "+0";
    deltaTimer = 0;

    hideToast();

    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);

    if (showStartOverlay) {
      overlayShow(overlayStart);
      refreshStartStats();
      syncStartNameUI();
    } else {
      overlayHide(overlayStart);
    }

    draw();
  }

  function startGame() {
    if (gameOver) return;

    const nm = (startName.value || "").trim().slice(0, 16);
    if (!nm || nm.length < 2) {
      showToast("Pon un nombre (mín. 2).", 1100);
      return;
    }

    playerName = nm;
    localStorage.setItem(PLAYER_NAME_KEY, playerName);

    // sincroniza también en ranking
    playerNameInput.value = playerName;
    pillPlayer.textContent = `👤 ${playerName}`;

    overlayHide(overlayStart, 180);
    running = true;
    paused = false;
    gameOver = false;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function setPaused(v) {
    if (!running || gameOver) return;
    paused = v;
    if (paused) {
      overlayShow(overlayPaused);
      draw();
    } else {
      overlayHide(overlayPaused, 160);
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function endGame(reason = "Te has chocado.") {
    running = false;
    paused = false;
    gameOver = true;

    addRun(score);

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud(true);
    refreshStartStats();

    finalLine.textContent = `Has hecho ${score} puntos. ${reason}`;
    overlayShow(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayStart);

    kick("dead");
  }

  function applyCellEffect(cell, col, row) {
    let msg = null;

    if (cell === CELL.EMPTY) {
      // “decay” suave para que no suba mult infinito sin pisar cosas
      if (streak > 0 && Math.random() < 0.12) streak = Math.max(0, streak - 1);
      mult = 1 + Math.min(4, Math.floor(streak / 5));
      return null;
    }

    if (cell === CELL.BLOCK) {
      endGame("Bloque KO.");
      return null;
    }

    if (cell === CELL.TRAP) {
      score = Math.max(0, score - 25);
      setScoreDelta(-25);
      spawnFloatText(col, row, "-25", "rgba(255,120,160,.98)", "normal");
      streak = 0;
      mult = 1;
      speedBoost = clamp(speedBoost - 0.10, -0.25, 0.35);
      msg = "TRAMPA -25";
      spawnParticles(col, row, CELL_COLOR[CELL.TRAP], 18, 1.1);
      kick("bad");
      return msg;
    }

    // Good cells
    streak += 1;
    mult = 1 + Math.min(4, Math.floor(streak / 5));

    if (cell === CELL.COIN) {
      const add = 10 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(col, row, `+${add}`, "rgba(165,255,220,.98)", "normal");
      msg = `+${add}`;
      spawnParticles(col, row, CELL_COLOR[CELL.COIN], 14, 0.95);
      kick("good");
    } else if (cell === CELL.GEM) {
      const add = 30 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(col, row, `+${add}`, "rgba(165,220,255,.98)", "normal");
      msg = `+${add}`;
      spawnParticles(col, row, CELL_COLOR[CELL.GEM], 18, 1.05);
      kick("good");
    } else if (cell === CELL.BONUS) {
      const add = 60 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(col, row, `+${add}`, "rgba(255,240,165,.98)", "normal");
      speedBoost = clamp(speedBoost + 0.07, -0.25, 0.35);
      msg = `BONUS +${add}`;
      spawnParticles(col, row, CELL_COLOR[CELL.BONUS], 22, 1.25);
      kick("bonus");
    }

    // Combo cada 8
    if (streak > 0 && streak % COMBO_EVERY === 0) {
      const add = 120 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(col, row, `COMBO +${add}`, "rgba(255,255,255,.98)", "combo");
      speedBoost = clamp(speedBoost + 0.10, -0.25, 0.35);
      msg = `COMBO +${add}`;
      spawnParticles(col, row, "#ffffff", 28, 1.35);
      kick("bonus");
    }

    return msg;
  }

  function tryTriggerCellAt(col, row, reason = "") {
    if (!running || paused || gameOver) return;

    const c = clamp(col, 0, COLS - 1);
    const r = clamp(row, 0, ROWS - 1);

    const cell = grid[r][c];
    if (cell === CELL.EMPTY) return;

    const msg = applyCellEffect(cell, c, r);
    if (!gameOver && cell !== CELL.BLOCK) grid[r][c] = CELL.EMPTY;
    if (msg) showToast(msg, 720);
    updateHud();
  }

  function stepRowAdvance() {
    const d = difficulty01();

    grid.pop();
    grid.unshift(generateRow(d));

    // Puntos por avanzar (pequeños y constantes)
    const survivalAdd = 1 * mult;
    score += survivalAdd;

    // El scroll te “mete” una nueva celda bajo tus pies: trigger ahí
    const col = clamp(targetCol, 0, COLS - 1);
    const row = clamp(targetRow, 0, ROWS - 1);

    tryTriggerCellAt(col, row, "scroll");

    updateHud();
  }

  function movePlayer(dx, dy) {
    if (!running || paused || gameOver) return;

    const nextCol = clamp(targetCol + dx, 0, COLS - 1);
    const nextRow = clamp(targetRow + dy, BAND_START, BAND_END);

    const moved = (nextCol !== targetCol) || (nextRow !== targetRow);
    if (!moved) return;

    targetCol = nextCol;
    targetRow = nextRow;

    shake = clamp(shake + 0.06 * settings.fx, 0, 1);
    vibrate(7);

    // Trigger inmediato al pisar una celda por movimiento (más responsive)
    tryTriggerCellAt(targetCol, targetRow, "move");
  }

  // ───────────────────────── Rendering ─────────────────────────
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const pad = Math.floor(14 * dpr);
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;

    const cellW = Math.floor(w / COLS);
    const cellH = Math.floor(h / ROWS);
    cellPx = Math.max(8, Math.min(cellW, cellH));

    const boardW = cellPx * COLS;
    const boardH = cellPx * ROWS;

    boardX = Math.floor((canvas.width - boardW) / 2);
    boardY = Math.floor((canvas.height - boardH) / 2);

    draw();
  }

  function roundRectFill(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawBlockX(cx, cy, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(230,0,18,0.95)";
    ctx.lineWidth = Math.max(2, Math.floor(2 * dpr));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy + size);
    ctx.moveTo(cx + size, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawCell(x, y, type, rowIndex) {
    const inBand = (rowIndex >= BAND_START && rowIndex <= BAND_END);
    const behind = Math.max(0, rowIndex - BAND_END); // filas “pasadas” (abajo)
    const fade = behind === 0 ? 1 : clamp(1 - behind * 0.12, 0.35, 0.92);

    // base
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = CELL_COLOR[CELL.EMPTY];
    ctx.fillRect(x, y, cellPx, cellPx);

    // banda marcada (3 filas)
    if (inBand) {
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect(x, y, cellPx, cellPx);
    }

    // grid line
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = Math.max(1, Math.floor(dpr));
    ctx.strokeRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);

    // fade de filas pasadas (no afectan)
    if (behind > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x, y, cellPx, cellPx);
    }

    if (type === CELL.EMPTY) {
      ctx.restore();
      return;
    }

    const inset = Math.floor(cellPx * 0.18);
    const r = Math.floor(cellPx * 0.18);

    // dibuja contenido con fade (pasadas = más apagadas)
    ctx.globalAlpha = fade;

    if (type === CELL.BLOCK) {
      const p = 0.5 + 0.5 * Math.sin(animT * 6.2);
      ctx.fillStyle = "rgba(90,96,120,0.92)";
      roundRectFill(x + inset, y + inset, cellPx - inset * 2, cellPx - inset * 2, r);

      // borde rojo (más suave en pasadas)
      ctx.save();
      ctx.globalAlpha = fade * (0.70 + p * 0.22);
      ctx.strokeStyle = "rgba(230,0,18,0.95)";
      ctx.lineWidth = Math.max(2, Math.floor(2 * dpr));
      ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, cellPx - inset * 2 - 1, cellPx - inset * 2 - 1);
      ctx.restore();

      const cx = x + cellPx * 0.5;
      const cy = y + cellPx * 0.5;
      drawBlockX(cx, cy, cellPx * 0.18, fade * (0.52 + p * 0.36));

      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.fillStyle = CELL_COLOR[type];
    roundRectFill(x + inset, y + inset, cellPx - inset * 2, cellPx - inset * 2, r);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRectFill(
      x + inset + 1, y + inset + 1,
      cellPx - inset * 2 - 2,
      Math.floor((cellPx - inset * 2) * 0.45),
      r
    );

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    if (!particles.length) return;
    ctx.save();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function drawFloatTexts() {
    if (!floatTexts.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const ft of floatTexts) {
      const t = clamp(ft.life / ft.max, 0, 1);
      const pop = easeOutBack(clamp(t * 2.2, 0, 1));
      const scale = ft.scale0 + (ft.scale1 - ft.scale0) * clamp(t * 1.4, 0, 1);

      const fontPx = Math.floor(16 * dpr * scale);
      ctx.font = `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));

      // sombra + borde ligero
      ctx.fillStyle = "rgba(0,0,0,0.40)";
      ctx.fillText(ft.text, ft.x + 2 * dpr, ft.y + 2 * dpr);

      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);

      // pequeño glow
      ctx.globalAlpha *= 0.22;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBandMarkers(bw, yOffset) {
    // stripe fondo
    for (let r = BAND_START; r <= BAND_END; r++) {
      const y = boardY + r * cellPx + yOffset;
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(boardX, y, bw, cellPx);
    }

    // líneas delimitadoras
    const yTop = boardY + BAND_START * cellPx + yOffset;
    const yBot = boardY + (BAND_END + 1) * cellPx + yOffset;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = "rgba(110,200,255,0.55)";
    ctx.lineWidth = Math.max(1, Math.floor(dpr));
    ctx.beginPath();
    ctx.moveTo(boardX, yTop + 0.5);
    ctx.lineTo(boardX + bw, yTop + 0.5);
    ctx.moveTo(boardX, yBot + 0.5);
    ctx.lineTo(boardX + bw, yBot + 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw() {
    // shake
    shakeSeed += 1;
    const fx = settings.fx;
    const sx = (Math.sin(shakeSeed * 12.9898) * 43758.5453) % 1;
    const sy = (Math.sin(shakeSeed * 78.233) * 12345.6789) % 1;
    const offX = (sx - 0.5) * (cellPx * 0.10) * shake * fx;
    const offY = (sy - 0.5) * (cellPx * 0.10) * shake * fx;

    ctx.save();
    ctx.translate(offX, offY);

    ctx.fillStyle = "#06060a";
    ctx.fillRect(-offX, -offY, canvas.width, canvas.height);

    const bw = cellPx * COLS;
    const bh = cellPx * ROWS;

    // frame
    ctx.fillStyle = `rgba(255,255,255,${0.02 + pulse * 0.045})`;
    roundRectFill(boardX - 8 * dpr, boardY - 8 * dpr, bw + 16 * dpr, bh + 16 * dpr, 18 * dpr);

    const yOffset = scrollPx;

    // banda marcada (detrás de celdas)
    drawBandMarkers(bw, yOffset);

    // grid
    for (let r = 0; r < ROWS; r++) {
      const y = boardY + r * cellPx + yOffset;
      const row = grid[r];
      for (let c = 0; c < COLS; c++) {
        const x = boardX + c * cellPx;
        drawCell(x, y, row[c], r);
      }
    }

    drawParticles();
    drawFloatTexts();

    // player smooth (col+row)
    const playerX = boardX + playerColFloat * cellPx;
    const playerY = boardY + playerRowFloat * cellPx + yOffset;

    // glow
    ctx.globalAlpha = 0.16 + pulse * 0.22;
    ctx.fillStyle = "#ffffff";
    roundRectFill(playerX - 2 * dpr, playerY - 2 * dpr, cellPx + 4 * dpr, cellPx + 4 * dpr, Math.floor(cellPx * 0.28));
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRectFill(playerX + 2 * dpr, playerY + 5 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#ffffff";
    roundRectFill(playerX + 2 * dpr, playerY + 2 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#101225";
    ctx.globalAlpha = 0.9;
    roundRectFill(playerX + 6 * dpr, playerY + 6 * dpr, cellPx - 12 * dpr, cellPx - 12 * dpr, Math.floor(cellPx * 0.18));
    ctx.globalAlpha = 1;

    // pause overlay inside canvas
    if (paused && running) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(boardX, boardY, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `${Math.floor(18 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.textAlign = "center";
      ctx.fillText("PAUSA", boardX + bw / 2, boardY + bh / 2);
    }

    ctx.restore();
  }

  // ───────────────────────── Leaderboard (online) ─────────────────────────
  function isOnline() { return navigator.onLine; }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  }

  function renderLb(entries) {
    lbList.innerHTML = "";
    if (!entries || !entries.length) {
      lbList.innerHTML = `<div class="muted">No hay datos.</div>`;
      return;
    }
    entries.forEach((e, i) => {
      const rank = (i + 1);
      const name = (e.name || "Player").toString().slice(0, 16);
      const sc = (e.score ?? 0);
      const div = document.createElement("div");
      div.className = "lbEntry";
      div.innerHTML = `
        <div class="lbLeft">
          <div class="lbRank">${rank}</div>
          <div class="lbName">${escapeHtml(name)}</div>
        </div>
        <div class="lbScore">${escapeHtml(String(sc))}</div>
      `;
      lbList.appendChild(div);
    });
  }

  async function fetchLeaderboard() {
    if (!isOnline()) {
      lbStatus.textContent = "Sin internet. El ranking solo se muestra online.";
      renderLb([]);
      return;
    }
    if (!LEADERBOARD_ENDPOINT) {
      lbStatus.textContent = "Ranking no configurado (falta LEADERBOARD_ENDPOINT en app.js).";
      renderLb([]);
      return;
    }

    lbStatus.textContent = "Cargando ranking…";
    try {
      const url = `${LEADERBOARD_ENDPOINT}/top?game=${encodeURIComponent(LEADERBOARD_GAME_ID)}&limit=20`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      lbStatus.textContent = "Top mundial";
      renderLb(data?.entries || []);
    } catch {
      lbStatus.textContent = "No se pudo cargar el ranking (endpoint caído o CORS).";
      renderLb([]);
    }
  }

  async function submitScoreOnline() {
    if (!isOnline()) { showToast("Sin internet: no se puede enviar.", 1100); return; }
    if (!LEADERBOARD_ENDPOINT) { showToast("Falta LEADERBOARD_ENDPOINT.", 1400); return; }

    const name = (playerNameInput.value || "").trim().slice(0, 16);
    if (!name || name.length < 2) { showToast("Nombre mínimo 2.", 1000); return; }

    playerName = name;
    localStorage.setItem(PLAYER_NAME_KEY, playerName);
    pillPlayer.textContent = `👤 ${playerName}`;
    startName.value = playerName;

    try {
      btnSubmitScore.disabled = true;
      const url = `${LEADERBOARD_ENDPOINT}/submit`;
      const payload = { game: LEADERBOARD_GAME_ID, name: playerName, score };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("Score enviado ✅", 900);
      await fetchLeaderboard();
    } catch {
      showToast("No se pudo enviar (endpoint/CORS).", 1200);
    } finally {
      btnSubmitScore.disabled = false;
    }
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

  function loop(t) {
    if (!running || paused || gameOver) return;

    let dt = t - lastT;
    lastT = t;

    if (dt > 250) dt = 16.67;
    dt = Math.min(40, dt);

    animT += dt / 1000;

    // timers
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hideToast(); }
    if (deltaTimer > 0) { deltaTimer -= dt; if (deltaTimer <= 0) hudScoreDelta.textContent = "+0"; }

    runTime += dt / 1000;

    updateTheme(dt);
    updateParticles(dt);

    // smooth player move (col+row)
    {
      const diffC = (targetCol - playerColFloat);
      const diffR = (targetRow - playerRowFloat);
      const maxStep = PLAYER_SMOOTH_CELLS_PER_SEC * (dt / 1000);

      if (Math.abs(diffC) <= maxStep) playerColFloat = targetCol;
      else playerColFloat += Math.sign(diffC) * maxStep;

      if (Math.abs(diffR) <= maxStep) playerRowFloat = targetRow;
      else playerRowFloat += Math.sign(diffR) * maxStep;
    }

    // continuous scroll
    const speedRows = currentSpeedRowsPerSec();
    pillSpeed.textContent = `Vel ${speedRows.toFixed(1)}×`;

    const speedPx = speedRows * cellPx;
    scrollPx += speedPx * (dt / 1000);

    while (scrollPx >= cellPx && !gameOver) {
      scrollPx -= cellPx;
      stepRowAdvance();
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ───────────────────────── Input ─────────────────────────
  function bindInputs() {
    // Tap zones: izquierda/derecha
    zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(-1, 0); }, { passive: false });
    zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(+1, 0); }, { passive: false });

    // D-Pad
    const bindBtn = (el, dx, dy) => {
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(dx, dy); }, { passive: false });
    };
    bindBtn(btnUp, 0, -1);
    bindBtn(btnDown, 0, +1);
    bindBtn(btnLeft, -1, 0);
    bindBtn(btnRight, +1, 0);

    // Keyboard
    window.addEventListener("keydown", (e) => {
      const k = e.key;

      if (k === "ArrowLeft" || k === "a" || k === "A") movePlayer(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") movePlayer(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") movePlayer(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") movePlayer(0, +1);

      if (k === " " || k === "Spacebar") { if (running && !gameOver) setPaused(!paused); }
      if (k === "p" || k === "P" || k === "Escape") { if (running && !gameOver) setPaused(!paused); }

      if (k === "Enter") {
        if (!overlayStart.hidden) startGame();
        else if (!overlayGameOver.hidden) { resetGame(false); startGame(); }
      }
    });

    // Swipe 4 direcciones
    let sx = 0, sy = 0, st = 0;
    canvas.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY; st = performance.now();
    }, { passive: true });

    canvas.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = performance.now() - st;

      if (dt < 320) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        const min = 26;

        if (ax > ay && ax > min) movePlayer(dx > 0 ? +1 : -1, 0);
        else if (ay > ax && ay > min) movePlayer(0, dy > 0 ? +1 : -1);
      }
    }, { passive: true });

    // Pause on background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !gameOver) setPaused(true);
    });

    // evitar scroll iOS durante juego
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive: false });
  }

  // ───────────────────────── Buttons ─────────────────────────
  function bindButtons() {
    btnStart.addEventListener("click", startGame);

    btnResume.addEventListener("click", () => setPaused(false));

    btnPlayAgain.addEventListener("click", () => {
      resetGame(false);
      startGame();
    });

    btnBackToStart.addEventListener("click", () => {
      resetGame(true);
    });

    btnPause.addEventListener("click", () => {
      if (!running || gameOver) return;
      setPaused(!paused);
    });

    btnRestart.addEventListener("click", () => {
      // reinicia pero vuelve a start (para cambiar nombre si quiere)
      resetGame(true);
    });

    // Options
    btnOptions.addEventListener("click", () => {
      overlayShow(overlayOptions);
      applySettingsToUI();
    });
    btnCloseOptions.addEventListener("click", () => overlayHide(overlayOptions, 160));

    optVibration.addEventListener("change", () => {
      settings.vibration = optVibration.checked;
      saveSettings();
      applySettingsToUI();
      showToast("Guardado ✅", 650);
    });

    optDpad.addEventListener("change", () => {
      settings.showDpad = optDpad.checked;
      saveSettings();
      applySettingsToUI();
      showToast("Guardado ✅", 650);
    });

    optFx.addEventListener("input", () => {
      settings.fx = clamp(parseFloat(optFx.value) || 1.0, 0.4, 1.25);
      optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
      applySettingsToUI();
    });

    btnClearLocal.addEventListener("click", () => {
      localStorage.removeItem(RUNS_KEY);
      refreshStartStats();
      showToast("Historial borrado.", 900);
    });

    // Leaderboard
    btnLeaderboard.addEventListener("click", async () => {
      overlayShow(overlayLeaderboard);
      await fetchLeaderboard();
    });
    btnCloseLeaderboard.addEventListener("click", () => overlayHide(overlayLeaderboard, 160));
    btnSubmitScore.addEventListener("click", submitScoreOnline);

    // Start name live validation
    startName.addEventListener("input", () => {
      const nm = (startName.value || "").trim().slice(0, 16);
      btnStart.disabled = !(nm.length >= 2);
      pillPlayer.textContent = `👤 ${nm || playerName || "—"}`;
    });
  }

  function syncStartNameUI() {
    startName.value = playerName || "";
    btnStart.disabled = !((startName.value || "").trim().length >= 2);
    playerNameInput.value = playerName || "";
    updateHud(true);
  }

  // ───────────────────────── PWA ─────────────────────────
  function setupPWA() {
    const setNet = () => {
      const offline = !navigator.onLine;
      pillOffline.hidden = !offline;
      if (!overlayLeaderboard.hidden) fetchLeaderboard();
    };
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    setNet();

    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btnInstall.hidden = false;
    });

    btnInstall.addEventListener("click", async () => {
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

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          const swUrl = new URL("./sw.js", location.href);
          await navigator.serviceWorker.register(swUrl, { scope: "./" });
        } catch (err) {
          console.warn("SW register failed:", err);
        }
      });
    }
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot() {
    if (!ctx) { alert("Tu navegador no soporta Canvas 2D."); return; }

    best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

    applySettingsToUI();
    bindInputs();
    bindButtons();
    setupPWA();

    resize();
    window.addEventListener("resize", () => resize(), { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive: true });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

    resetGame(true);
    draw();

    console.log(`Grid Runner PWA v${APP_VERSION}`);
  }

  boot();
})();
