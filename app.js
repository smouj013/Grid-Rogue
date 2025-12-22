/* Grid Runner — PWA (v0.0.2)
   ✅ Fix overlays hidden (CSS) + salida suave
   ✅ Juicy: partículas, shake suave, pulses, HUD bump
   ✅ Fondo cambia según racha (suave, sin dañar la vista)
   ✅ Robustez: pausa al cambiar de pestaña, dt clamp, ResizeObserver
*/
(() => {
  "use strict";

  const APP_VERSION = "0.0.2";

  // ───────────────────────── UI refs ─────────────────────────
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

  const ROOT = document.documentElement;

  // ───────────────────────── Game config ─────────────────────────
  const COLS = 8;
  const ROWS = 24;
  const PLAYER_ROW = ROWS - 3;

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

  const BASE_STEP_MS = 140;
  const MIN_STEP_MS = 92;
  const MAX_STEP_MS = 190;

  const BEST_KEY = "grid_runner_best_v2";
  const SW_TOAST_KEY = "grid_runner_sw_toast_v2";

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

  let stepMs = BASE_STEP_MS;
  let acc = 0;
  let lastT = 0;

  let pCol = Math.floor(COLS / 2);
  /** @type {Uint8Array[]} */
  let grid = [];

  // Toast timer
  let toastTimer = 0;

  // Juicy FX
  let shake = 0;              // 0..1
  let shakeSeed = 0;
  let pulse = 0;              // 0..1 (flash suave)
  let hue = 220;              // actual
  let hueTarget = 220;        // objetivo por racha
  let glow = 0.18;            // CSS var

  /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,size:number,color:string,alpha:number}[]} */
  const particles = [];

  // HUD previous values for bump anim
  let prevScore = -1, prevStreak = -1, prevMult = -1, prevBest = -1;

  // RNG helpers
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
    // reflow (para reiniciar anim)
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function updateHud(force = false) {
    if (force || score !== prevScore) { hudScore.textContent = String(score); bump(hudScore); prevScore = score; }
    if (force || streak !== prevStreak) { hudStreak.textContent = String(streak); bump(hudStreak); prevStreak = streak; }
    if (force || mult !== prevMult) { hudMult.textContent = String(mult); bump(hudMult); prevMult = mult; }
    if (force || best !== prevBest) { hudBest.textContent = String(best); bump(hudBest); prevBest = best; }
  }

  function overlayShow(el) {
    el.classList.remove("fadeOut");
    el.hidden = false;
  }

  function overlayHide(el, ms = 180) {
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

  function generateRow(difficulty01) {
    const row = makeEmptyRow();

    const blockChance = clamp(0.10 + difficulty01 * 0.22, 0.10, 0.34);
    const coinChance  = clamp(0.10 + difficulty01 * 0.08, 0.10, 0.18);
    const gemChance   = clamp(0.045 + difficulty01 * 0.05, 0.045, 0.095);
    const bonusChance = clamp(0.028 + difficulty01 * 0.03, 0.028, 0.060);
    const trapChance  = clamp(0.040 + difficulty01 * 0.05, 0.040, 0.090);

    // camino seguro 1-2 columnas
    const safeCol = randi(0, COLS - 1);
    const safeCol2 = (Math.random() < 0.25)
      ? clamp(safeCol + (Math.random() < 0.5 ? -1 : 1), 0, COLS - 1)
      : safeCol;

    for (let c = 0; c < COLS; c++) {
      if (c === safeCol || c === safeCol2) continue;

      const x = Math.random();
      if (x < blockChance) { row[c] = CELL.BLOCK; continue; }

      const y = Math.random();
      if (y < bonusChance) row[c] = CELL.BONUS;
      else if (y < bonusChance + gemChance) row[c] = CELL.GEM;
      else if (y < bonusChance + gemChance + coinChance) row[c] = CELL.COIN;
      else if (y < bonusChance + gemChance + coinChance + trapChance) row[c] = CELL.TRAP;
    }

    // un extra de moneda a veces
    if (Math.random() < 0.35) {
      const c = randi(0, COLS - 1);
      if (row[c] === CELL.EMPTY && c !== safeCol) row[c] = CELL.COIN;
    }

    return row;
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const d = clamp((r / ROWS) * 0.35, 0, 0.35);
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
        vx: Math.cos(a) * sp * 2.2,
        vy: Math.sin(a) * sp * 2.2 - (0.8 * power),
        life: 0,
        max: 360 + Math.random() * 220,
        size: (1.6 + Math.random() * 2.2) * dpr,
        color,
        alpha: 1,
      });
    }
  }

  function kick(type) {
    // “juice” controlado: shake + pulso + glow
    if (type === "good") {
      shake = clamp(shake + 0.18, 0, 1);
      pulse = clamp(pulse + 0.20, 0, 1);
      glow = clamp(glow + 0.02, 0.16, 0.28);
      vibrate(10);
    } else if (type === "bonus") {
      shake = clamp(shake + 0.28, 0, 1);
      pulse = clamp(pulse + 0.28, 0, 1);
      glow = clamp(glow + 0.03, 0.16, 0.30);
      vibrate(18);
    } else if (type === "bad") {
      shake = clamp(shake + 0.22, 0, 1);
      pulse = clamp(pulse + 0.16, 0, 1);
      glow = clamp(glow + 0.015, 0.16, 0.26);
      vibrate(22);
    } else if (type === "dead") {
      shake = 1;
      pulse = 1;
      glow = 0.30;
      vibrate(70);
    }
  }

  function updateTheme(dtMs) {
    // hue según racha (suave). 0 racha ~ 220; racha alta -> más cálido.
    const s = clamp(streak, 0, 45);
    hueTarget = 220 + s * 1.35;       // 220..280 aprox
    hue += (hueTarget - hue) * (1 - Math.pow(0.0018, dtMs)); // lerp dt friendly

    // glow vuelve a base lentamente
    glow += (0.18 - glow) * (1 - Math.pow(0.0022, dtMs));
    pulse += (0 - pulse) * (1 - Math.pow(0.0045, dtMs));
    shake += (0 - shake) * (1 - Math.pow(0.0060, dtMs));

    ROOT.style.setProperty("--hue", hue.toFixed(2));
    ROOT.style.setProperty("--glow", glow.toFixed(3));
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      const t = p.life / p.max;
      p.vy += 0.0024 * dt; // gravedad suave
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.alpha = 1 - t;
      if (t >= 1) particles.splice(i, 1);
    }
  }

  // ───────────────────────── Game logic ─────────────────────────
  function resetGame() {
    running = false;
    paused = false;
    gameOver = false;

    score = 0;
    streak = 0;
    mult = 1;
    stepMs = BASE_STEP_MS;

    pCol = Math.floor(COLS / 2);

    particles.length = 0;
    shake = 0; pulse = 0; glow = 0.18;

    initGrid();
    updateHud(true);
    hideToast();

    overlayShow(overlayStart);
    overlayHide(overlayPaused);
    overlayHide(overlayGameOver);

    // dibuja tablero detrás del overlay
    draw();
  }

  function startGame() {
    if (gameOver) return;

    // salida mínima (juicy) del overlay
    if (!overlayStart.hidden) overlayHide(overlayStart, 180);

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

  function applyCellEffect(cell) {
    let msg = null;

    if (cell === CELL.EMPTY) {
      if (streak > 0 && Math.random() < 0.18) streak = Math.max(0, streak - 1);
      mult = 1 + Math.min(4, Math.floor(streak / 5));
      return null;
    }

    if (cell === CELL.BLOCK) {
      endGame("Bloque bloqueante.");
      return null;
    }

    // coordenadas para FX
    const fxCol = pCol;
    const fxRow = PLAYER_ROW;

    if (cell === CELL.TRAP) {
      score = Math.max(0, score - 25);
      streak = 0;
      mult = 1;
      stepMs = clamp(stepMs + 12, MIN_STEP_MS, MAX_STEP_MS);
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
      msg = `+${add} (Moneda)`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.COIN], 10, 0.9);
      kick("good");
    } else if (cell === CELL.GEM) {
      const add = 30 * mult;
      score += add;
      msg = `+${add} (Gema)`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.GEM], 14, 1.0);
      kick("good");
    } else if (cell === CELL.BONUS) {
      const add = 60 * mult;
      score += add;
      stepMs = clamp(stepMs - 6, MIN_STEP_MS, MAX_STEP_MS);
      msg = `BONUS +${add}`;
      spawnParticles(fxCol, fxRow, CELL_COLOR[CELL.BONUS], 18, 1.2);
      kick("bonus");
    }

    // Combo cada 8 buenas
    if (streak > 0 && streak % 8 === 0) {
      const add = 120 * mult;
      score += add;
      stepMs = clamp(stepMs - 10, MIN_STEP_MS, MAX_STEP_MS);
      msg = `COMBO x${mult} +${add}`;
      spawnParticles(fxCol, fxRow, "#ffffff", 22, 1.3);
      kick("bonus");
    }

    return msg;
  }

  function step() {
    const difficulty01 = clamp(score / 1200, 0, 1);

    grid.pop();
    grid.unshift(generateRow(difficulty01));

    // puntos por avanzar
    score += 1 * mult;

    const cell = grid[PLAYER_ROW][pCol];
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
      // micro feedback
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

  function drawCell(x, y, type) {
    // tile base
    ctx.fillStyle = CELL_COLOR[CELL.EMPTY];
    ctx.fillRect(x, y, cellPx, cellPx);

    // grid line
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

  function draw() {
    // camera shake
    shakeSeed += 1;
    const sx = (Math.sin(shakeSeed * 12.9898) * 43758.5453) % 1;
    const sy = (Math.sin(shakeSeed * 78.233) * 12345.6789) % 1;
    const offX = (sx - 0.5) * (cellPx * 0.12) * shake;
    const offY = (sy - 0.5) * (cellPx * 0.12) * shake;

    ctx.save();
    ctx.translate(offX, offY);

    // background (canvas)
    ctx.fillStyle = "#06060a";
    ctx.fillRect(-offX, -offY, canvas.width, canvas.height);

    const bw = cellPx * COLS;
    const bh = cellPx * ROWS;

    // frame
    ctx.fillStyle = `rgba(255,255,255,${0.02 + pulse * 0.04})`;
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

    // particles over board
    drawParticles();

    // player
    const px = boardX + pCol * cellPx;
    const py = boardY + PLAYER_ROW * cellPx;

    // glow
    ctx.globalAlpha = 0.16 + pulse * 0.22;
    ctx.fillStyle = "#ffffff";
    roundRectFill(px - 2 * dpr, py - 2 * dpr, cellPx + 4 * dpr, cellPx + 4 * dpr, Math.floor(cellPx * 0.28));
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRectFill(px + 2 * dpr, py + 5 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#ffffff";
    roundRectFill(px + 2 * dpr, py + 2 * dpr, cellPx - 4 * dpr, cellPx - 4 * dpr, Math.floor(cellPx * 0.22));

    ctx.fillStyle = "#101225";
    ctx.globalAlpha = 0.9;
    roundRectFill(px + 6 * dpr, py + 6 * dpr, cellPx - 12 * dpr, cellPx - 12 * dpr, Math.floor(cellPx * 0.18));
    ctx.globalAlpha = 1;

    // paused hint (dentro del canvas, sutil)
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

  // ───────────────────────── Main loop ─────────────────────────
  function loop(t) {
    if (!running || paused || gameOver) return;

    let dt = t - lastT;
    lastT = t;

    // robustez: si dt es gigante (cambio de pestaña), no spamear steps
    if (dt > 250) dt = 16.67;
    dt = Math.min(50, dt);

    acc += dt;

    // timers
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }

    updateTheme(dt);
    updateParticles(dt);

    while (acc >= stepMs && !gameOver) {
      acc -= stepMs;
      step();
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

    // Pausa automática en background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !gameOver) setPaused(true);
    });
  }

  // ───────────────────────── Buttons ─────────────────────────
  function bindButtons() {
    const startFn = () => startGame();

    btnStart.addEventListener("click", startFn);
    btnStart.addEventListener("pointerup", startFn);

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
  }

  // ───────────────────────── PWA ─────────────────────────
  function setupPWA() {
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

    // SW register
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          const swUrl = new URL("./sw.js", location.href);
          const reg = await navigator.serviceWorker.register(swUrl, { scope: "./" });

          // Toast “update available” (suave, sin molestar)
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                // evita spamear
                if (!sessionStorage.getItem(SW_TOAST_KEY)) {
                  sessionStorage.setItem(SW_TOAST_KEY, "1");
                  showToast("Actualización lista. Recarga para aplicar ✅", 1400);
                }
              }
            });
          });
        } catch (err) {
          console.warn("SW register failed:", err);
        }
      });
    }
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot() {
    // si no hay canvas context, aborta “bonito”
    if (!ctx) {
      alert("Tu navegador no soporta Canvas 2D.");
      return;
    }

    best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

    resetGame();
    bindInputs();
    bindButtons();
    setupPWA();

    // Resize robusto
    resize();
    window.addEventListener("resize", () => resize(), { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive: true });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

    // Evitar scroll accidental en iOS mientras juegas
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive: false });

    // primer render ya visible detrás del overlay
    draw();

    console.log(`Grid Runner PWA v${APP_VERSION}`);
  }

  boot();
})();
