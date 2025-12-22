/* Grid Runner — PWA (v1.0.0)
   - Cuadrícula 8x24
   - Scroll por filas (avanza hacia arriba)
   - Celdas con ventajas/desventajas + combos
   - Tap izquierda/derecha + swipe + teclado
   - Offline SW + Install prompt
*/
(() => {
  "use strict";

  const VERSION = "1.0.0";

  // ───────────────────────────── UI refs ─────────────────────────────
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const hudScore = $("hudScore");
  const hudStreak = $("hudStreak");
  const hudMult = $("hudMult");
  const hudBest = $("hudBest");

  const btnPause = $("btnPause");
  const btnRestart = $("btnRestart");
  const btnInstall = $("btnInstall");
  const pillOffline = $("pillOffline");

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

  // ───────────────────────────── Game config ─────────────────────────────
  const COLS = 8;
  const ROWS = 24;

  // Player stays in a fixed row while grid scrolls down
  const PLAYER_ROW = ROWS - 3;

  // Cell types
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

  const BASE_STEP_MS = 140;          // velocidad base
  const MIN_STEP_MS = 92;            // límite rápido
  const MAX_STEP_MS = 190;           // límite lento

  const BEST_KEY = "grid_runner_best_v1";
  const STATE_KEY = "grid_runner_state_v1"; // por si luego quieres guardar partida

  // ───────────────────────────── State ─────────────────────────────
  let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let cellPx = 18; // se calcula en resize
  let boardX = 0, boardY = 0; // offset dentro del canvas

  let running = false;
  let paused = false;
  let gameOver = false;

  let score = 0;
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

  let streak = 0;
  let mult = 1;

  let stepMs = BASE_STEP_MS;
  let acc = 0;
  let lastT = 0;

  // Player column
  let pCol = Math.floor(COLS / 2);

  // Grid: rows of cells. Each row is Uint8Array(COLS)
  /** @type {Uint8Array[]} */
  let grid = [];

  // Toast timer
  let toastTimer = 0;

  // Simple RNG
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randi = (min, max) => (Math.random() * (max - min + 1) + min) | 0;

  // ───────────────────────────── Utilities ─────────────────────────────
  function showToast(msg, ms = 900) {
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = ms;
  }

  function hideToast() {
    toast.hidden = true;
    toastTimer = 0;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function vibrate(ms = 15) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
  }

  function updateHud() {
    hudScore.textContent = String(score);
    hudStreak.textContent = String(streak);
    hudMult.textContent = String(mult);
    hudBest.textContent = String(best);
  }

  function setOverlay(el, visible) {
    el.hidden = !visible;
  }

  // ───────────────────────────── Board generation ─────────────────────────────
  function makeEmptyRow() {
    const row = new Uint8Array(COLS);
    row.fill(CELL.EMPTY);
    return row;
  }

  function generateRow(difficulty01) {
    // difficulty01: 0..1
    const row = makeEmptyRow();

    // block chance increases slightly over time
    const blockChance = clamp(0.10 + difficulty01 * 0.22, 0.10, 0.34);

    // good items
    const coinChance  = clamp(0.10 + difficulty01 * 0.08, 0.10, 0.18);
    const gemChance   = clamp(0.045 + difficulty01 * 0.05, 0.045, 0.095);
    const bonusChance = clamp(0.028 + difficulty01 * 0.03, 0.028, 0.060);

    // bad items
    const trapChance  = clamp(0.040 + difficulty01 * 0.05, 0.040, 0.090);

    // Create at least one safe path: reserve 1-2 cols as safe corridor
    const safeCol = randi(0, COLS - 1);
    const safeCol2 = (Math.random() < 0.25) ? clamp(safeCol + (Math.random() < 0.5 ? -1 : 1), 0, COLS - 1) : safeCol;

    for (let c = 0; c < COLS; c++) {
      if (c === safeCol || c === safeCol2) continue; // keep empty

      const x = Math.random();

      // Blocks first
      if (x < blockChance) {
        row[c] = CELL.BLOCK;
        continue;
      }

      // Items (rare)
      const y = Math.random();
      if (y < bonusChance) row[c] = CELL.BONUS;
      else if (y < bonusChance + gemChance) row[c] = CELL.GEM;
      else if (y < bonusChance + gemChance + coinChance) row[c] = CELL.COIN;
      else if (y < bonusChance + gemChance + coinChance + trapChance) row[c] = CELL.TRAP;
    }

    // Ensure not all empty (except safe corridor). Add a coin sometimes.
    if (Math.random() < 0.35) {
      const c = randi(0, COLS - 1);
      if (row[c] === CELL.EMPTY && c !== safeCol) row[c] = CELL.COIN;
    }

    return row;
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      // Bottom area easier
      const d = clamp((r / ROWS) * 0.35, 0, 0.35);
      grid.push(generateRow(d));
    }
  }

  // ───────────────────────────── Game logic ─────────────────────────────
  function resetGame() {
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    streak = 0;
    mult = 1;
    stepMs = BASE_STEP_MS;

    pCol = Math.floor(COLS / 2);

    initGrid();
    updateHud();
    hideToast();

    setOverlay(overlayStart, true);
    setOverlay(overlayPaused, false);
    setOverlay(overlayGameOver, false);
  }

  function startGame() {
    if (gameOver) return;
    running = true;
    paused = false;

    setOverlay(overlayStart, false);
    setOverlay(overlayPaused, false);
    setOverlay(overlayGameOver, false);

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function setPaused(v) {
    if (!running) return;
    paused = v;
    setOverlay(overlayPaused, paused);
    if (!paused) {
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
    updateHud();

    finalLine.textContent = `Has hecho ${score} puntos. ${reason}`;
    setOverlay(overlayGameOver, true);
    setOverlay(overlayPaused, false);
    setOverlay(overlayStart, false);

    vibrate(70);
  }

  function applyCellEffect(cell) {
    // Score always increases by movement
    // Extra based on cell + multiplier
    let msg = null;

    if (cell === CELL.EMPTY) {
      // streak decays slowly, not reset
      if (streak > 0 && Math.random() < 0.18) streak = Math.max(0, streak - 1);
      mult = 1 + Math.min(4, Math.floor(streak / 5)); // 1..5
      return;
    }

    if (cell === CELL.BLOCK) {
      endGame("Bloque bloqueante.");
      return;
    }

    if (cell === CELL.TRAP) {
      score = Math.max(0, score - 25);
      streak = 0;
      mult = 1;
      stepMs = clamp(stepMs + 12, MIN_STEP_MS, MAX_STEP_MS); // un pelín más lento
      msg = "TRAMPA -25 (racha reset)";
      vibrate(25);
      return msg;
    }

    // Good cells
    streak += 1;
    mult = 1 + Math.min(4, Math.floor(streak / 5)); // 1..5

    if (cell === CELL.COIN) {
      score += 10 * mult;
      msg = `+${10 * mult} (Moneda)`;
      vibrate(10);
    } else if (cell === CELL.GEM) {
      score += 30 * mult;
      msg = `+${30 * mult} (Gema)`;
      vibrate(12);
    } else if (cell === CELL.BONUS) {
      score += 60 * mult;
      // acelera ligeramente si vas bien
      stepMs = clamp(stepMs - 6, MIN_STEP_MS, MAX_STEP_MS);
      msg = `BONUS +${60 * mult}`;
      vibrate(18);
    }

    // Mega-bono cada 8 buenas seguidas
    if (streak > 0 && streak % 8 === 0) {
      const bonus = 120 * mult;
      score += bonus;
      msg = `COMBO x${mult} +${bonus}`;
      stepMs = clamp(stepMs - 10, MIN_STEP_MS, MAX_STEP_MS);
      vibrate(22);
    }

    return msg;
  }

  function step() {
    // difficulty based on score
    const difficulty01 = clamp(score / 1200, 0, 1);

    // Shift grid down by 1 row (world moves toward player)
    grid.pop();
    grid.unshift(generateRow(difficulty01));

    // Movement points (survival points)
    score += 1 * mult;

    // Cell under player position (fixed row)
    const cell = grid[PLAYER_ROW][pCol];

    // Apply effect + clear the cell after using it (except block)
    const msg = applyCellEffect(cell);
    if (!gameOver && cell !== CELL.BLOCK) {
      grid[PLAYER_ROW][pCol] = CELL.EMPTY;
    }

    if (msg) showToast(msg);

    updateHud();
  }

  function movePlayer(dir) {
    if (!running || paused || gameOver) return;
    const next = clamp(pCol + dir, 0, COLS - 1);
    if (next !== pCol) {
      pCol = next;
      vibrate(6);
    }
  }

  // ───────────────────────────── Rendering ─────────────────────────────
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    // Fit 8x24 cells in the canvas with padding
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

  function drawCell(x, y, type) {
    // base tile background
    const bg = CELL_COLOR[CELL.EMPTY];
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cellPx, cellPx);

    // subtle grid line
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = Math.max(1, Math.floor(dpr));
    ctx.strokeRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);

    if (type === CELL.EMPTY) return;

    // item/block
    ctx.fillStyle = CELL_COLOR[type];
    const inset = Math.floor(cellPx * 0.18);
    const r = Math.floor(cellPx * 0.18);

    roundRectFill(x + inset, y + inset, cellPx - inset * 2, cellPx - inset * 2, r);

    // gloss
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRectFill(x + inset + 1, y + inset + 1, cellPx - inset * 2 - 2, Math.floor((cellPx - inset * 2) * 0.45), r);

    // symbol
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    const cx = x + cellPx / 2;
    const cy = y + cellPx / 2;
    ctx.beginPath();

    if (type === CELL.BLOCK) {
      ctx.fillRect(cx - cellPx * 0.18, cy - cellPx * 0.18, cellPx * 0.36, cellPx * 0.36);
    } else if (type === CELL.COIN) {
      ctx.arc(cx, cy, cellPx * 0.18, 0, Math.PI * 2);
    } else if (type === CELL.GEM) {
      ctx.moveTo(cx, cy - cellPx * 0.2);
      ctx.lineTo(cx + cellPx * 0.2, cy);
      ctx.lineTo(cx, cy + cellPx * 0.2);
      ctx.lineTo(cx - cellPx * 0.2, cy);
      ctx.closePath();
      ctx.fill();
    } else if (type === CELL.TRAP) {
      ctx.moveTo(cx, cy - cellPx * 0.22);
      ctx.lineTo(cx + cellPx * 0.22, cy + cellPx * 0.22);
      ctx.lineTo(cx - cellPx * 0.22, cy + cellPx * 0.22);
      ctx.closePath();
      ctx.fill();
    } else if (type === CELL.BONUS) {
      // star-ish
      const spikes = 5;
      const outer = cellPx * 0.22;
      const inner = cellPx * 0.10;
      let rot = Math.PI / 2 * 3;
      let stepA = Math.PI / spikes;
      ctx.moveTo(cx, cy - outer);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        rot += stepA;
        ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
        rot += stepA;
      }
      ctx.lineTo(cx, cy - outer);
      ctx.closePath();
      ctx.fill();
    }
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

  function draw() {
    // background
    ctx.fillStyle = "#06060a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // board shadow frame
    const bw = cellPx * COLS;
    const bh = cellPx * ROWS;

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    roundRectFill(boardX - 8 * dpr, boardY - 8 * dpr, bw + 16 * dpr, bh + 16 * dpr, 18 * dpr);

    // cells
    for (let r = 0; r < ROWS; r++) {
      const y = boardY + r * cellPx;
      const row = grid[r];
      for (let c = 0; c < COLS; c++) {
        const x = boardX + c * cellPx;
        drawCell(x, y, row[c]);
      }
    }

    // player
    const px = boardX + pCol * cellPx;
    const py = boardY + PLAYER_ROW * cellPx;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRectFill(px + 2 * dpr, py + 5 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#ffffff";
    roundRectFill(px + 2 * dpr, py + 2 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#101225";
    ctx.globalAlpha = 0.9;
    roundRectFill(px + 6 * dpr, py + 6 * dpr, cellPx - 12 * dpr, cellPx - 12 * dpr, Math.floor(cellPx * 0.18));
    ctx.globalAlpha = 1;

    // paused overlay hint inside canvas
    if (paused && running) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(boardX, boardY, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `${Math.floor(18 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.textAlign = "center";
      ctx.fillText("PAUSA", boardX + bw / 2, boardY + bh / 2);
    }
  }

  // ───────────────────────────── Main loop ─────────────────────────────
  function loop(t) {
    if (!running || paused || gameOver) return;

    const dt = Math.min(60, t - lastT);
    lastT = t;
    acc += dt;

    // toast countdown
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }

    while (acc >= stepMs && !gameOver) {
      acc -= stepMs;
      step();
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ───────────────────────────── Input ─────────────────────────────
  function bindInputs() {
    zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(-1); }, { passive: false });
    zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(+1); }, { passive: false });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") movePlayer(-1);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") movePlayer(+1);
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (running && !gameOver) setPaused(!paused);
      }
      if (e.key === "Enter") {
        if (overlayStart && !overlayStart.hidden) startGame();
        else if (overlayGameOver && !overlayGameOver.hidden) { resetGame(); startGame(); }
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

      // horizontal swipe
      if (dt < 300 && Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        movePlayer(dx > 0 ? +1 : -1);
      }
    }, { passive: true });
  }

  // ───────────────────────────── Buttons ─────────────────────────────
  function bindButtons() {
    btnStart.addEventListener("click", () => startGame());
    btnResume.addEventListener("click", () => setPaused(false));

    btnPlayAgain.addEventListener("click", () => { resetGame(); startGame(); });

    btnPause.addEventListener("click", () => {
      if (!running) return;
      if (gameOver) return;
      setPaused(!paused);
    });

    btnRestart.addEventListener("click", () => {
      resetGame();
      startGame();
    });
  }

  // ───────────────────────────── PWA: install + SW ─────────────────────────────
  function setupPWA() {
    // Offline indicator
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
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      btnInstall.hidden = true;
      btnInstall.disabled = false;
    });

    // Service Worker (GitHub Pages compatible: rutas relativas)
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          const swUrl = new URL("./sw.js", location.href);
          await navigator.serviceWorker.register(swUrl, { scope: "./" });
        } catch (err) {
          // si falla, el juego igual funciona online
          console.warn("SW register failed:", err);
        }
      });
    }
  }

  // ───────────────────────────── Boot ─────────────────────────────
  function boot() {
    hudBest.textContent = String(best);

    resetGame();
    bindInputs();
    bindButtons();
    setupPWA();

    resize();
    window.addEventListener("resize", () => resize(), { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive: true });

    // Evitar scroll accidental en iOS
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive: false });

    // Render inicial
    draw();

    // info versión en consola
    console.log(`Grid Runner PWA v${VERSION}`);
  }

  boot();
})();
