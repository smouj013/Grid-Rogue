/* Grid Runner — PWA (v0.0.3)
   ✅ Scroll continuo (más FPS) + player smooth movement
   ✅ Velocidad progresiva: lenta al inicio, sube suave (tiempo + racha)
   ✅ Bloques KO muy visibles (pulso + X + borde rojo)
   ✅ Score más “legible”: delta, popups, barra combo
   ✅ Menos densidad de celdas
   ✅ Ranking online: UI lista + endpoint configurable
*/
(() => {
  "use strict";

  const APP_VERSION = "0.0.3";

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

  const btnPause = $("btnPause");
  const btnRestart = $("btnRestart");
  const btnInstall = $("btnInstall");
  const pillOffline = $("pillOffline");

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

  const btnStart = $("btnStart");
  const btnResume = $("btnResume");
  const btnPlayAgain = $("btnPlayAgain");
  const finalLine = $("finalLine");

  const toast = $("toast");

  const zoneLeft = $("zoneLeft");
  const zoneRight = $("zoneRight");

  const ROOT = document.documentElement;

  // ───────────────────────── Leaderboard config (ONLINE) ─────────────────────────
  // ✅ Para que funcione “mundial” necesitas un backend.
  // Pon aquí tu endpoint cuando lo tengas (Cloudflare Worker / Supabase / etc.)
  // Ejemplo: const LEADERBOARD_ENDPOINT = "https://TU-WORKER.tudominio.workers.dev";
  const LEADERBOARD_ENDPOINT = ""; // <- rellena cuando lo tengas
  const LEADERBOARD_GAME_ID = "grid-runner";
  const PLAYER_NAME_KEY = "grid_runner_player_name_v1";

  // ───────────────────────── Game config ─────────────────────────
  const COLS = 8;
  const ROWS = 24;
  const PLAYER_ROW = ROWS - 3;

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

  const BEST_KEY = "grid_runner_best_v3";

  // Velocidad (rows/sec)
  const SPEED_START = 0.85;  // MUY lento al inicio
  const SPEED_MAX   = 4.50;  // máximo (sin volverse injugable)
  const SPEED_RAMP_SECONDS = 85; // tarda en llegar cerca del max

  // Movimiento suave del player (col/sec)
  const PLAYER_SMOOTH_COLS_PER_SEC = 18;

  // Combo reward cada N
  const COMBO_EVERY = 8;

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

  let runTime = 0;       // segundos sobreviviendo
  let rowsSurvived = 0;  // filas avanzadas

  // Scroll continuo: 0..cellPx
  let scrollPx = 0;

  // Speed boost (por bonus/trampa) que decae a 0
  let speedBoost = 0; // -0.25..+0.35

  // Player movement
  let targetCol = Math.floor(COLS / 2);
  let playerColFloat = targetCol;

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
  /** @type {{x:number,y:number,text:string,life:number,max:number,vy:number,alpha:number,color:string}[]} */
  const floatTexts = [];

  // HUD prev
  let prevScore = -1, prevStreak = -1, prevMult = -1, prevBest = -1;
  let lastDelta = 0;
  let deltaTimer = 0;

  // RNG
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randi = (min, max) => (Math.random() * (max - min + 1) + min) | 0;

  function vibrate(ms = 12) {
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
    lastDelta = v;
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

  // ───────────────────────── Board generation ─────────────────────────
  function makeEmptyRow() {
    const row = new Uint8Array(COLS);
    row.fill(CELL.EMPTY);
    return row;
  }

  function chooseType(difficulty01) {
    // Menos densidad global (más limpio visual)
    // Primero decidimos si “hay algo” en esa celda.
    const fill = clamp(0.16 + difficulty01 * 0.12, 0.16, 0.28); // 16%..28%
    if (Math.random() > fill) return CELL.EMPTY;

    // Pesos (bloques no demasiado)
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

    // límites por fila (reduce “demasiados cuadrados”)
    const maxBlocks = 2 + (difficulty01 > 0.75 ? 1 : 0); // 2..3
    const maxItems  = 2 + (difficulty01 > 0.55 ? 1 : 0); // 2..3

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

    // Garantiza “algo” a veces (para que no sea aburrido al inicio)
    if (difficulty01 < 0.25 && items === 0 && Math.random() < 0.35) {
      const c = randi(0, COLS - 1);
      if (c !== safeCol && row[c] === CELL.EMPTY) row[c] = CELL.COIN;
    }

    return row;
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const d = 0.0; // inicio calmado
      grid.push(generateRow(d));
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
    const c = cellCenterPx(col, row);
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.4) * power;
      particles.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * sp * 2.4,
        vy: Math.sin(a) * sp * 2.4 - (1.1 * power),
        life: 0,
        max: 360 + Math.random() * 240,
        size: (1.5 + Math.random() * 2.2) * dpr,
        color,
        alpha: 1,
      });
    }
  }

  function spawnFloatText(col, row, text, color = "rgba(255,255,255,.95)") {
    const c = cellCenterPx(col, row);
    floatTexts.push({
      x: c.x,
      y: c.y - 6 * dpr,
      text,
      life: 0,
      max: 820,
      vy: -0.22 * dpr,
      alpha: 1,
      color
    });
  }

  function kick(type) {
    if (type === "good") {
      shake = clamp(shake + 0.15, 0, 1);
      pulse = clamp(pulse + 0.18, 0, 1);
      glow = clamp(glow + 0.02, 0.16, 0.28);
      vibrate(10);
    } else if (type === "bonus") {
      shake = clamp(shake + 0.24, 0, 1);
      pulse = clamp(pulse + 0.26, 0, 1);
      glow = clamp(glow + 0.03, 0.16, 0.30);
      vibrate(18);
    } else if (type === "bad") {
      shake = clamp(shake + 0.20, 0, 1);
      pulse = clamp(pulse + 0.16, 0, 1);
      glow = clamp(glow + 0.015, 0.16, 0.26);
      vibrate(22);
    } else if (type === "dead") {
      shake = 1; pulse = 1; glow = 0.30;
      vibrate(70);
    }
  }

  function updateTheme(dtMs) {
    // color según racha (suave)
    const s = clamp(streak, 0, 50);
    hueTarget = 215 + s * 1.25; // 215..~277
    hue += (hueTarget - hue) * (1 - Math.pow(0.0018, dtMs));

    glow += (0.18 - glow) * (1 - Math.pow(0.0022, dtMs));
    pulse += (0 - pulse) * (1 - Math.pow(0.0045, dtMs));
    shake += (0 - shake) * (1 - Math.pow(0.0060, dtMs));
    speedBoost += (0 - speedBoost) * (1 - Math.pow(0.0028, dtMs)); // decae

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
    // ramp por tiempo de supervivencia (más estable que score)
    const t = clamp(runTime / SPEED_RAMP_SECONDS, 0, 1);
    // racha añade “emoción” pero poco
    const s = clamp(streak / 35, 0, 1);
    return clamp(t * 0.88 + s * 0.12, 0, 1);
  }

  function currentSpeedRowsPerSec() {
    const d = difficulty01();
    const base = SPEED_START + (SPEED_MAX - SPEED_START) * d;
    const streakBoost = 1 + clamp(mult - 1, 0, 4) * 0.03; // hasta +12%
    const boost = 1 + clamp(speedBoost, -0.25, 0.35);
    return base * streakBoost * boost;
  }

  // ───────────────────────── Game logic ─────────────────────────
  function resetGame() {
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    streak = 0;
    mult = 1;

    runTime = 0;
    rowsSurvived = 0;

    scrollPx = 0;
    speedBoost = 0;

    targetCol = Math.floor(COLS / 2);
    playerColFloat = targetCol;

    particles.length = 0;
    floatTexts.length = 0;
    shake = 0; pulse = 0; glow = 0.18;

    initGrid();
    updateHud(true);
    updateComboUI();

    hudScoreDelta.textContent = "+0";
    deltaTimer = 0;

    hideToast();

    overlayShow(overlayStart);
    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);

    draw();
  }

  function startGame() {
    if (gameOver) return;
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

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud(true);

    finalLine.textContent = `Has hecho ${score} puntos. ${reason}`;
    overlayShow(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayStart);

    kick("dead");
  }

  function applyCellEffect(cell, col) {
    let msg = null;

    if (cell === CELL.EMPTY) {
      if (streak > 0 && Math.random() < 0.16) streak = Math.max(0, streak - 1);
      mult = 1 + Math.min(4, Math.floor(streak / 5));
      return null;
    }

    if (cell === CELL.BLOCK) {
      endGame("Bloque KO.");
      return null;
    }

    const fxCol = col;
    const fxRow = PLAYER_ROW;

    if (cell === CELL.TRAP) {
      score = Math.max(0, score - 25);
      setScoreDelta(-25);
      spawnFloatText(fxCol, fxRow, "-25", "rgba(255,130,160,.95)");
      streak = 0;
      mult = 1;
      speedBoost = clamp(speedBoost - 0.10, -0.25, 0.35);
      msg = "TRAMPA -25 (racha reset)";
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.TRAP], 14, 1.1);
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
      spawnFloatText(fxCol, fxRow, `+${add}`, "rgba(170,255,220,.95)");
      msg = `+${add} (Moneda)`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.COIN], 10, 0.9);
      kick("good");
    } else if (cell === CELL.GEM) {
      const add = 30 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(fxCol, fxRow, `+${add}`, "rgba(170,220,255,.95)");
      msg = `+${add} (Gema)`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.GEM], 14, 1.0);
      kick("good");
    } else if (cell === CELL.BONUS) {
      const add = 60 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(fxCol, fxRow, `+${add}`, "rgba(255,240,170,.95)");
      speedBoost = clamp(speedBoost + 0.07, -0.25, 0.35);
      msg = `BONUS +${add}`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.BONUS], 18, 1.2);
      kick("bonus");
    }

    // Combo cada 8
    if (streak > 0 && streak % COMBO_EVERY === 0) {
      const add = 120 * mult;
      score += add;
      setScoreDelta(add);
      spawnFloatText(fxCol, fxRow, `COMBO +${add}`, "rgba(255,255,255,.95)");
      speedBoost = clamp(speedBoost + 0.10, -0.25, 0.35);
      msg = `COMBO x${mult} +${add}`;
      spawnParticles(fxCol, fxRow, "#ffffff", 22, 1.3);
      kick("bonus");
    }

    return msg;
  }

  function stepRowAdvance() {
    // dificultad actual
    const d = difficulty01();

    // shift grid: entra nueva fila arriba
    grid.pop();
    grid.unshift(generateRow(d));

    rowsSurvived += 1;

    // Puntos por avanzar (pequeños y constantes)
    const survivalAdd = 1 * mult;
    score += survivalAdd;

    // Evaluación de celda bajo el player (usa targetCol para lógica)
    const col = clamp(targetCol, 0, COLS - 1);
    const cell = grid[PLAYER_ROW][col];

    const msg = applyCellEffect(cell, col);
    if (!gameOver && cell !== CELL.BLOCK) grid[PLAYER_ROW][col] = CELL.EMPTY;

    if (msg) showToast(msg, 900);

    updateHud();
  }

  function movePlayer(dir) {
    if (!running || paused || gameOver) return;
    const next = clamp(targetCol + dir, 0, COLS - 1);
    if (next !== targetCol) {
      targetCol = next;
      shake = clamp(shake + 0.06, 0, 1);
      vibrate(6);
    }
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

  function drawCell(x, y, type) {
    // base
    ctx.fillStyle = CELL_COLOR[CELL.EMPTY];
    ctx.fillRect(x, y, cellPx, cellPx);

    // grid line
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = Math.max(1, Math.floor(dpr));
    ctx.strokeRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);

    if (type === CELL.EMPTY) return;

    const inset = Math.floor(cellPx * 0.18);
    const r = Math.floor(cellPx * 0.18);

    // BLOQUE KO: súper visible
    if (type === CELL.BLOCK) {
      const p = 0.5 + 0.5 * Math.sin(animT * 6.2);
      ctx.fillStyle = "rgba(90,96,120,0.90)";
      roundRectFill(x + inset, y + inset, cellPx - inset * 2, cellPx - inset * 2, r);

      // borde rojo
      ctx.save();
      ctx.globalAlpha = 0.75 + p * 0.20;
      ctx.strokeStyle = "rgba(230,0,18,0.95)";
      ctx.lineWidth = Math.max(2, Math.floor(2 * dpr));
      ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, cellPx - inset * 2 - 1, cellPx - inset * 2 - 1);
      ctx.restore();

      // “X”
      const cx = x + cellPx * 0.5;
      const cy = y + cellPx * 0.5;
      drawBlockX(cx, cy, cellPx * 0.18, 0.55 + p * 0.35);
      return;
    }

    // item normal
    ctx.fillStyle = CELL_COLOR[type];
    roundRectFill(x + inset, y + inset, cellPx - inset * 2, cellPx - inset * 2, r);

    // gloss
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRectFill(
      x + inset + 1, y + inset + 1,
      cellPx - inset * 2 - 2,
      Math.floor((cellPx - inset * 2) * 0.45),
      r
    );
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

  function drawFloatTexts() {
    if (!floatTexts.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(13 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto`;
    for (const ft of floatTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillText(ft.text, ft.x + 1.5 * dpr, ft.y + 1.5 * dpr);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw() {
    // shake
    shakeSeed += 1;
    const sx = (Math.sin(shakeSeed * 12.9898) * 43758.5453) % 1;
    const sy = (Math.sin(shakeSeed * 78.233) * 12345.6789) % 1;
    const offX = (sx - 0.5) * (cellPx * 0.12) * shake;
    const offY = (sy - 0.5) * (cellPx * 0.12) * shake;

    ctx.save();
    ctx.translate(offX, offY);

    // background
    ctx.fillStyle = "#06060a";
    ctx.fillRect(-offX, -offY, canvas.width, canvas.height);

    const bw = cellPx * COLS;
    const bh = cellPx * ROWS;

    // frame
    ctx.fillStyle = `rgba(255,255,255,${0.02 + pulse * 0.04})`;
    roundRectFill(boardX - 8 * dpr, boardY - 8 * dpr, bw + 16 * dpr, bh + 16 * dpr, 18 * dpr);

    // draw grid with scroll offset (smooth)
    const yOffset = scrollPx;

    for (let r = 0; r < ROWS; r++) {
      const y = boardY + r * cellPx + yOffset;
      const row = grid[r];
      for (let c = 0; c < COLS; c++) {
        const x = boardX + c * cellPx;
        drawCell(x, y, row[c]);
      }
    }

    // particles + float texts (over board)
    drawParticles();
    drawFloatTexts();

    // player smooth
    const playerX = boardX + playerColFloat * cellPx;
    const playerY = boardY + PLAYER_ROW * cellPx + yOffset;

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
  function isOnline() {
    return navigator.onLine;
  }

  function leaderboardReady() {
    return isOnline() && !!LEADERBOARD_ENDPOINT;
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

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
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
    } catch (e) {
      lbStatus.textContent = "No se pudo cargar el ranking (endpoint caído o CORS).";
      renderLb([]);
    }
  }

  async function submitScoreOnline() {
    if (!isOnline()) {
      showToast("Sin internet: no se puede enviar score.", 1200);
      return;
    }
    if (!LEADERBOARD_ENDPOINT) {
      showToast("Falta configurar LEADERBOARD_ENDPOINT en app.js", 1500);
      return;
    }

    const name = (playerNameInput.value || "").trim().slice(0, 16);
    if (!name) {
      showToast("Pon un nombre primero.", 1000);
      return;
    }

    localStorage.setItem(PLAYER_NAME_KEY, name);

    try {
      btnSubmitScore.disabled = true;
      const url = `${LEADERBOARD_ENDPOINT}/submit`;
      const payload = { game: LEADERBOARD_GAME_ID, name, score };
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
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }
    if (deltaTimer > 0) {
      deltaTimer -= dt;
      if (deltaTimer <= 0) {
        hudScoreDelta.textContent = "+0";
      }
    }

    runTime += dt / 1000;

    updateTheme(dt);
    updateParticles(dt);

    // smooth player move
    const diff = (targetCol - playerColFloat);
    const maxStep = PLAYER_SMOOTH_COLS_PER_SEC * (dt / 1000);
    if (Math.abs(diff) <= maxStep) playerColFloat = targetCol;
    else playerColFloat += Math.sign(diff) * maxStep;

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
    zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(-1); }, { passive: false });
    zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(+1); }, { passive: false });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") movePlayer(-1);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") movePlayer(+1);

      if (e.key === " " || e.key === "Spacebar") {
        if (running && !gameOver) setPaused(!paused);
      }
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (running && !gameOver) setPaused(!paused);
      }
      if (e.key === "Enter") {
        if (!overlayStart.hidden) startGame();
        else if (!overlayGameOver.hidden) { resetGame(); startGame(); }
      }
    });

    // Swipe
    let sx = 0, sy = 0, st = 0;
    canvas.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY; st = performance.now();
    }, { passive: true });

    canvas.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = performance.now() - st;
      if (dt < 300 && Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        movePlayer(dx > 0 ? +1 : -1);
      }
    }, { passive: true });

    // Pause on background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !gameOver) setPaused(true);
    });
  }

  // ───────────────────────── Buttons ─────────────────────────
  function bindButtons() {
    const startFn = () => startGame();

    btnStart.addEventListener("click", startFn);
    btnResume.addEventListener("click", () => setPaused(false));
    btnPlayAgain.addEventListener("click", () => { resetGame(); startGame(); });

    btnPause.addEventListener("click", () => {
      if (!running || gameOver) return;
      setPaused(!paused);
    });

    btnRestart.addEventListener("click", () => {
      resetGame();
      startGame();
    });

    btnLeaderboard.addEventListener("click", async () => {
      overlayShow(overlayLeaderboard);
      await fetchLeaderboard();
    });

    btnCloseLeaderboard.addEventListener("click", () => {
      overlayHide(overlayLeaderboard, 160);
    });

    btnSubmitScore.addEventListener("click", submitScoreOnline);

    // carga nombre guardado
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    if (saved) playerNameInput.value = saved;
  }

  // ───────────────────────── PWA ─────────────────────────
  function setupPWA() {
    const setNet = () => {
      const offline = !navigator.onLine;
      pillOffline.hidden = !offline;
      // si está abierto el ranking, refresca estado
      if (!overlayLeaderboard.hidden) fetchLeaderboard();
    };
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    setNet();

    // Install prompt
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

    // SW
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

    resetGame();
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

    // evitar scroll iOS durante juego
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive: false });

    draw();
    console.log(`Grid Runner PWA v${APP_VERSION}`);
  }

  boot();
})();
