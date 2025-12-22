/* app.js — Grid Runner (PWA) v0.1.4 STABLE+FULLSCREEN
   - HUD fuera del canvas y con altura fija (cero layout-shifts)
   - Canvas ocupa el máximo posible (PC/móvil)
   - Shake ya NO mueve el grid: solo tiembla el player (sin “glitch”)
   - Anti-scroll/anti-zoom en gameArea (mobile safe)
   - Pills a 10Hz (menos reflow/jank)
*/

(() => {
  "use strict";

  const APP_VERSION = String(window.APP_VERSION || "0.1.4");
  window.__GRIDRUNNER_BOOTED = false;

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const $ = (id) => document.getElementById(id);

  function overlayShow(el) {
    if (!el) return;
    el.classList.remove("fadeOut");
    el.classList.add("fadeIn");
    el.hidden = false;
  }
  function overlayHide(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.remove("fadeIn", "fadeOut");
  }
  function overlayFadeOut(el, ms = 180) {
    return new Promise((res) => {
      if (!el || el.hidden) return res();
      el.classList.remove("fadeIn");
      el.classList.add("fadeOut");
      setTimeout(() => { overlayHide(el); res(); }, ms);
    });
  }

  function setPill(el, value) {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(value);
    else el.textContent = String(value);
  }

  function setState(s) { try { document.body.dataset.state = s; } catch {} }

  // ───────────────────────── Storage keys ─────────────────────────
  const BEST_KEY = "gridrunner_best_v1";
  const NAME_KEY = "gridrunner_name_v1";
  const SETTINGS_KEY = "gridrunner_settings_v1";
  const RUNS_KEY = "gridrunner_runs_v1";

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = () => ({
    useSprites: false,
    vibration: true,
    showDpad: true,
    fx: 1.0,
  });

  let settings = (() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? safeParse(raw, null) : null;
    const base = defaultSettings();
    if (!s || typeof s !== "object") return base;
    return {
      ...base,
      ...s,
      fx: clamp(Number(s.fx ?? 1.0) || 1.0, 0.4, 1.25),
    };
  })();

  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }
  function vibrate(ms) {
    if (!settings.vibration) return;
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(ms); } catch {}
  }

  // ───────────────────────── Auth ─────────────────────────
  const Auth = window.Auth || null;

  let activeProfileId = null;
  let playerName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0, 16);
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  if (playerName.length < 2) playerName = "Jugador";

  function syncFromAuth() {
    try {
      if (!Auth) return;
      const p = Auth.getActiveProfile?.();
      if (!p) return;
      activeProfileId = p.id;
      playerName = (p.name || "Jugador").trim().slice(0, 16) || "Jugador";
      best = (Auth.getBestForActive?.() ?? best) | 0;
      localStorage.setItem(NAME_KEY, playerName);
      localStorage.setItem(BEST_KEY, String(best));
    } catch {}
  }

  // ───────────────────────── Sprites optional ─────────────────────────
  const sprites = { ready: false, map: new Map() };

  function spriteUrl(name) { return new URL(`./assets/sprites/${name}`, location.href).toString(); }
  function loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("img missing"));
      img.src = url;
    });
  }

  async function preloadSpritesWithTimeout(timeoutMs = 900) {
    const keys = [
      ["coin", "tile_coin.svg"],
      ["gem", "tile_gem.svg"],
      ["bonus", "tile_bonus.svg"],
      ["trap", "tile_trap.svg"],
      ["block", "tile_block.svg"],
      ["player", "tile_player.svg"],
    ];
    const timeout = new Promise((res) => setTimeout(res, timeoutMs, "timeout"));
    try {
      const tasks = keys.map(async ([k, file]) => {
        const img = await loadImage(spriteUrl(file));
        sprites.map.set(k, img);
      });
      await Promise.race([Promise.all(tasks), timeout]);
      sprites.ready = sprites.map.size > 0;
    } catch {
      sprites.ready = sprites.map.size > 0;
    }
  }

  // ───────────────────────── Game constants ─────────────────────────
  const COLS = 8;
  const ROWS = 24;
  const CANVAS_AR = COLS / ROWS;

  const CellType = Object.freeze({
    Empty: 0, Coin: 1, Gem: 2, Bonus: 3, Trap: 4, Block: 5,
  });

  const CELL_COLORS = {
    [CellType.Empty]: "rgba(0,0,0,0)",
    [CellType.Coin]: "#2ef2a0",
    [CellType.Gem]:  "#6ab0ff",
    [CellType.Bonus]:"#ffd35a",
    [CellType.Trap]: "#ff6b3d",
    [CellType.Block]:"#7f8aa8",
  };

  // ───────────────────────── Runtime state ─────────────────────────
  let running = false, paused = false, gameOver = false, inLevelUp = false;
  let score = 0, streak = 0, mult = 1.0, level = 1;

  let levelStartScore = 0;
  let nextLevelAt = 220;

  let grid = [];
  let consumed = [];
  let gridReady = false;

  let dpr = 1;
  let cssCanvasW = 0, cssCanvasH = 0;

  let cellPx = 18;
  let gridW = 0, gridH = 0;
  let offX = 0, offY = 0;

  let scrollPx = 0;
  let runTime = 0;

  let zoneBase = 3;
  let zoneExtra = 0;
  let zoneH = 3;
  let zoneY0 = 0;

  let targetCol = 3;
  let targetRow = 1;
  let colF = 3;
  let rowF = 1;

  let shields = 0;
  let magnet = 0;
  let scoreBoost = 0;
  let trapResist = 0;
  let rerolls = 0;

  let coinValue = 10;
  let gemValue = 30;
  let bonusValue = 60;

  const COMBO_POOL = [
    [CellType.Coin, CellType.Coin, CellType.Gem],
    [CellType.Gem, CellType.Coin, CellType.Bonus],
    [CellType.Coin, CellType.Gem, CellType.Gem],
    [CellType.Bonus, CellType.Coin, CellType.Gem],
    [CellType.Coin, CellType.Coin, CellType.Coin, CellType.Bonus],
  ];
  let combo = [];
  let comboIdx = 0;
  let comboTimeMax = 6.0;
  let comboTime = 6.0;

  // UI FX
  let toastT = 0;
  let playerPulse = 0;
  let zonePulse = 0;

  // ✅ Shake: YA NO mueve el grid (solo player)
  let shakeT = 0;
  let shakePow = 0;

  let hitFlashT = 0;
  let hitFlashMax = 1;
  let hitFlashColor = "#ff2b4d";

  const particles = [];
  const floatTexts = [];

  // ───────────────────────── DOM refs ─────────────────────────
  let stage, canvasWrap, gameArea, hud, canvas, ctx;
  let brandSub;

  let pillScore, pillBest, pillStreak, pillMult, pillLevel, pillSpeed, pillPlayer, pillUpdate, pillOffline, pillVersion;
  let btnOptions, btnPause, btnRestart, btnInstall;

  let overlayLoading, loadingSub, overlayStart, overlayPaused, overlayUpgrades, overlayGameOver, overlayOptions, overlayError;

  let btnStart, profileSelect, btnNewProfile, newProfileWrap, startName;
  let btnResume, btnQuitToStart;

  let upTitle, upSub, upgradeChoices, btnReroll, btnSkipUpgrade;

  let goStats, goScoreBig, goBestBig, btnBackToStart, btnRetry;

  let btnCloseOptions, optSprites, optVibration, optDpad, optFx, optFxValue, btnClearLocal, btnRepairPWA;

  let errMsg, btnErrClose, btnErrReload;

  let comboSeq, comboTimerVal, comboHint, toast;
  let levelProgFill, levelProgText, levelProgPct;

  let dpad, btnUp, btnDown, btnLeft, btnRight;

  // ───────────────────────── Error handling global ─────────────────────────
  function showFatal(err) {
    try {
      console.error(err);
      try { overlayHide(overlayLoading); } catch {}
      const msg =
        (err && err.message) ? err.message :
        (typeof err === "string" ? err : "Error desconocido");
      if (errMsg) errMsg.textContent = msg;
      if (overlayError) overlayShow(overlayError);
      if (!overlayError) alert(msg);
    } catch {}
  }

  window.addEventListener("error", (e) => showFatal(e?.error || new Error(e?.message || "Error")));
  window.addEventListener("unhandledrejection", (e) => showFatal(e?.reason || new Error("Promise rejection")));

  // ───────────────────────── UI helpers ─────────────────────────
  function showToast(msg, ms = 900) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add("show");
    toastT = ms;
  }
  function hideToast() {
    if (!toast) return;
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 180);
    toastT = 0;
  }
  function setOfflinePill() { if (pillOffline) pillOffline.hidden = navigator.onLine; }

  function speedRowsPerSec() {
    const t = runTime;
    const base = 1.05;
    const byTime = 0.026 * t;
    const byLevel = 0.075 * (level - 1);
    return clamp(base + byTime + byLevel, 0.9, 6.0);
  }

  function updateLevelProgressUI() {
    const denom = Math.max(1, (nextLevelAt - levelStartScore));
    const v = clamp((score - levelStartScore) / denom, 0, 1);
    if (levelProgFill) levelProgFill.style.width = `${Math.round(v * 100)}%`;
    if (levelProgText) levelProgText.textContent = `Lv ${level} • ${Math.max(0, score - levelStartScore)}/${Math.max(1, nextLevelAt - levelStartScore)}`;
    if (levelProgPct) levelProgPct.textContent = `${Math.round(v * 100)}%`;
  }

  // ✅ Pills a 10Hz (reduce jank)
  let pillAccMs = 0;
  function updatePillsNow() {
    setPill(pillScore, score | 0);
    setPill(pillBest, best | 0);
    setPill(pillStreak, streak | 0);
    setPill(pillMult, mult.toFixed(2));
    setPill(pillLevel, `Lv ${level}`);
    setPill(pillSpeed, `${speedRowsPerSec().toFixed(1)}x`);
    setPill(pillPlayer, playerName || "Jugador");
    setOfflinePill();
    updateLevelProgressUI();
  }

  function applySettingsToUI() {
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx) optFx.value = String(settings.fx);
    if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);

    const isCoarse = matchMedia("(pointer:coarse)").matches;
    if (dpad) dpad.hidden = !(isCoarse && settings.showDpad);

    resize();
  }

  // ───────────────────────── Grid (robusto) ─────────────────────────
  function recomputeZone() {
    zoneH = clampInt(zoneBase + zoneExtra, 3, 9);
    zoneY0 = (ROWS - zoneH) - 2;
    zoneY0 = clampInt(zoneY0, 0, ROWS - zoneH);

    targetRow = clampInt(targetRow, 0, zoneH - 1);
    rowF = clamp(Number(rowF) || 0, 0, zoneH - 1);
  }

  function genRow() {
    const density = clamp(0.28 + (level - 1) * 0.005, 0.18, 0.52);
    const out = new Array(COLS).fill(CellType.Empty);

    for (let c = 0; c < COLS; c++) {
      if (!chance(density)) continue;

      const wGood = 0.64, wTrap = 0.18, wBlock = 0.18;
      let roll = Math.random() * (wGood + wTrap + wBlock);

      if (roll < wGood) {
        const g = Math.random();
        out[c] = (g < 0.68) ? CellType.Coin : (g < 0.92) ? CellType.Gem : CellType.Bonus;
      } else if (roll < wGood + wTrap) out[c] = CellType.Trap;
      else out[c] = CellType.Block;
    }

    const blocks = out.reduce((a, v) => a + (v === CellType.Block ? 1 : 0), 0);
    if (blocks >= 5) {
      for (let c = 0; c < COLS; c++) {
        if (out[c] === CellType.Block && chance(0.55)) out[c] = CellType.Empty;
      }
    }
    return out;
  }

  function makeGrid() {
    grid = new Array(ROWS);
    consumed = new Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      grid[r] = genRow();
      consumed[r] = new Array(COLS).fill(false);
    }
    gridReady = true;
  }

  function ensureGridValid() {
    if (!Array.isArray(grid) || grid.length !== ROWS) return false;
    if (!Array.isArray(consumed) || consumed.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(grid[r]) || grid[r].length !== COLS) return false;
      if (!Array.isArray(consumed[r]) || consumed[r].length !== COLS) return false;
    }
    return true;
  }

  function shiftRows() {
    for (let r = ROWS - 1; r >= 1; r--) {
      grid[r] = grid[r - 1];
      consumed[r] = consumed[r - 1];
    }
    grid[0] = genRow();
    consumed[0] = new Array(COLS).fill(false);
  }

  function playerAbsRow() {
    const rf = Number.isFinite(rowF) ? rowF : 0;
    const rr = zoneY0 + Math.round(rf);
    return clampInt(rr, 0, ROWS - 1);
  }

  function safeCellType(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    const row = grid[r];
    if (!row) return CellType.Empty;
    const t = row[c];
    return Number.isFinite(t) ? t : CellType.Empty;
  }

  function safeConsumed(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    const row = consumed[r];
    if (!row) return false;
    return !!row[c];
  }

  function setConsumed(r, c, v) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    if (!consumed[r]) consumed[r] = new Array(COLS).fill(false);
    consumed[r][c] = !!v;
  }

  function setCellEmpty(r, c) {
    r = clampInt(r, 0, ROWS - 1);
    c = clampInt(c, 0, COLS - 1);
    if (!grid[r]) grid[r] = genRow();
    grid[r][c] = CellType.Empty;
  }

  // ───────────────────────── Gameplay ─────────────────────────
  function scoreFor(type) {
    if (type === CellType.Coin) return coinValue;
    if (type === CellType.Gem) return gemValue;
    if (type === CellType.Bonus) return bonusValue;
    if (type === CellType.Trap) {
      const base = 25;
      const reduced = base * (1 - 0.10 * trapResist);
      return -Math.round(reduced);
    }
    return 0;
  }

  function shake(ms, powPx) {
    shakeT = Math.max(shakeT, ms);
    shakePow = Math.max(shakePow, powPx);
  }

  function flash(color = "#ff2b4d", ms = 220) {
    hitFlashColor = color;
    hitFlashT = Math.max(hitFlashT, ms);
    hitFlashMax = Math.max(1, ms);
  }

  function spawnFloatText(x, y, text, color, stroke = "rgba(0,0,0,0.55)") {
    floatTexts.push({ x, y, vy: -18 - 22 * settings.fx, life: 720, max: 720, text, color, stroke });
    if (floatTexts.length > 80) floatTexts.splice(0, floatTexts.length - 80);
  }

  function spawnPop(x, y, color, intensity = 1) {
    const n = clampInt(Math.round(12 * intensity * settings.fx), 8, 30);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 1.20) * (26 + 34 * settings.fx) * intensity;
      particles.push({ kind: "dot", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 260 + Math.random() * 220, max: 460, rad: (1.2 + Math.random() * 2.8) * settings.fx, color });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function spawnSparks(x, y, color, intensity = 1) {
    const n = clampInt(Math.round(10 * intensity * settings.fx), 6, 24);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.55 + Math.random() * 1.25) * (34 + 44 * settings.fx) * intensity;
      particles.push({
        kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 220 + Math.random() * 180, max: 420,
        w: Math.max(1.4, (1.6 + Math.random() * 1.4) * settings.fx),
        h: Math.max(4.0, (6.0 + Math.random() * 7.0) * settings.fx),
        rot: a + (Math.random() * 0.6 - 0.3),
        vr: (Math.random() * 5.0 - 2.5),
        color,
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function spawnEatFX(t, x, y) {
    const col = CELL_COLORS[t] || "rgba(255,255,255,0.85)";
    if (t === CellType.Coin) { spawnPop(x, y, col, 0.85); spawnSparks(x, y, "rgba(255,255,255,0.92)", 0.65); shake(55, 1.2); return; }
    if (t === CellType.Gem)  { spawnPop(x, y, col, 0.95); spawnSparks(x, y, "rgba(170,210,255,0.95)", 0.85); shake(60, 1.35); return; }
    if (t === CellType.Bonus){ spawnPop(x, y, col, 1.15); spawnSparks(x, y, "rgba(255,245,200,0.95)", 1.0); shake(75, 1.6); return; }
  }

  function applyCollect(t, checkCombo = true) {
    playerPulse = 1;
    zonePulse = 1;

    const v = scoreFor(t);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    if (t === CellType.Trap) {
      streak = 0;
      mult = clamp(mult * 0.92, 1.0, 4.0);
      vibrate(18);
      failCombo();
      showToast("Trampa", 650);
      flash("#ff6b3d", 220);
      shake(220, 7);
      return;
    }

    streak++;
    vibrate(10);

    if (checkCombo) {
      if (combo[comboIdx] === t) {
        comboIdx++;
        comboTime = comboTimeMax;
        if (comboIdx >= combo.length) {
          mult = clamp(mult + 0.15, 1.0, 4.0);
          showToast("Combo completado: +MULT", 900);
          shake(140, 3.2);
          flash("#6ab0ff", 140);
          rerollCombo();
        } else renderComboUI();
      } else failCombo();
    }

    if (!inLevelUp && score >= nextLevelAt) openUpgrade();
  }

  function applyMagnetAround(r, c) {
    if (magnet <= 0) return;
    const rad = clampInt(magnet, 1, 3);

    for (let rr = r - rad; rr <= r + rad; rr++) {
      if (rr < 0 || rr >= ROWS) continue;
      for (let cc = c - rad; cc <= c + rad; cc++) {
        if (cc < 0 || cc >= COLS) continue;

        if (safeConsumed(rr, cc)) continue;
        const t = safeCellType(rr, cc);

        if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) {
          setConsumed(rr, cc, true);
          setCellEmpty(rr, cc);

          const x = offX + cc * cellPx + cellPx * 0.5;
          const y = offY + rr * cellPx + cellPx * 0.5 + scrollPx;

          spawnEatFX(t, x, y);

          const before = score;
          applyCollect(t, false);
          const delta = score - before;
          if (delta !== 0) spawnFloatText(
            x, y,
            (delta > 0 ? `+${delta}` : `${delta}`),
            delta > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,120,120,0.95)"
          );
        }
      }
    }
  }

  function stepAdvance() {
    if (!ensureGridValid()) { makeGrid(); recomputeZone(); }

    shiftRows();
    score += 1;

    const r = playerAbsRow();
    const c = clampInt(Math.round(Number.isFinite(colF) ? colF : targetCol), 0, COLS - 1);

    applyMagnetAround(r, c);

    const t = safeCellType(r, c);

    if (!safeConsumed(r, c) && t !== CellType.Empty) {
      setConsumed(r, c, true);
      setCellEmpty(r, c);

      const x = offX + c * cellPx + cellPx * 0.5;
      const y = offY + r * cellPx + cellPx * 0.5 + scrollPx;

      if (t === CellType.Block) {
        flash("#ff2b4d", 280);
        shake(260, 10);

        spawnPop(x, y, CELL_COLORS[t], 1.25);
        spawnSparks(x, y, "rgba(255,140,160,0.95)", 1.0);
        spawnFloatText(x, y, "KO", "rgba(255,120,120,0.95)");

        if (shields > 0) {
          shields--;
          showToast("Shield salvó un KO", 900);
          vibrate(24);
          shake(190, 6);
          flash("#6ab0ff", 140);
        } else gameOverNow("KO");
        return;
      }

      if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) spawnEatFX(t, x, y);
      else spawnPop(x, y, CELL_COLORS[t], 0.85);

      const before = score;
      applyCollect(t, true);
      const delta = score - before;
      if (delta !== 0) spawnFloatText(
        x, y,
        (delta > 0 ? `+${delta}` : `${delta}`),
        delta > 0 ? "rgba(255,255,255,0.92)" : "rgba(255,120,120,0.95)"
      );
    }
  }

  // ───────────────────────── Combo UI ─────────────────────────
  function iconForType(t) {
    if (t === CellType.Coin) return "paid";
    if (t === CellType.Gem) return "diamond";
    if (t === CellType.Bonus) return "workspace_premium";
    return "help";
  }
  function nameForType(t) {
    if (t === CellType.Coin) return "Coin";
    if (t === CellType.Gem) return "Gem";
    if (t === CellType.Bonus) return "Bonus";
    return "—";
  }

  function rerollCombo() {
    const pick = COMBO_POOL[randi(0, COMBO_POOL.length - 1)];
    combo = Array.isArray(pick) ? pick.slice() : [CellType.Coin, CellType.Coin, CellType.Gem];
    comboIdx = 0;
    comboTimeMax = clamp(6.2 - (level * 0.06), 3.8, 7.0);
    comboTime = comboTimeMax;
    renderComboUI();
  }

  function renderComboUI() {
    if (!comboSeq || !comboHint) return;
    comboSeq.innerHTML = "";
    for (let i = 0; i < combo.length; i++) {
      const t = combo[i];
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.style.setProperty("--chipc", CELL_COLORS[t] || "rgba(255,255,255,0.22)");

      const ic = document.createElement("span");
      ic.className = "ms";
      ic.textContent = iconForType(t);

      const tx = document.createElement("span");
      tx.textContent = nameForType(t);

      chip.appendChild(ic);
      chip.appendChild(tx);

      if (i < comboIdx) chip.style.opacity = "0.55";
      if (i === comboIdx) chip.style.borderColor = "rgba(255,255,255,0.22)";

      comboSeq.appendChild(chip);
    }
    comboHint.textContent = "Completa la secuencia para subir multiplicador.";
  }

  function failCombo() {
    comboIdx = 0;
    comboTime = comboTimeMax;
    renderComboUI();
  }

  // ───────────────────────── Upgrades ─────────────────────────
  const Upgrades = [
    { id: "shield", name: "Shield", desc: "Bloquea 1 KO (se consume).", tag: "Defensa", max: 6, apply() { shields++; } },
    { id: "mag1", name: "Imán I", desc: "Atrae premios cercanos (radio 1).", tag: "QoL", max: 1, apply() { magnet = Math.max(magnet, 1); } },
    { id: "mag2", name: "Imán II", desc: "Imán mejorado (radio 2).", tag: "QoL", max: 1, apply() { magnet = 2; } },
    { id: "mag3", name: "Imán III", desc: "Radio 3 (máximo).", tag: "QoL", max: 1, apply() { magnet = 3; } },
    { id: "boost", name: "Score +", desc: "Más puntos (+8%).", tag: "Puntos", max: 10, apply() { scoreBoost += 0.08; } },
    { id: "trap", name: "Resistencia trampas", desc: "Reduce penalización de trampas.", tag: "Defensa", max: 4, apply() { trapResist++; } },
    { id: "zone", name: "Zona +", desc: "Zona de movimiento más alta (+1 fila).", tag: "Movilidad", max: 3, apply() { zoneExtra++; recomputeZone(); } },
    { id: "coin", name: "Coin +", desc: "Coin vale más (+2).", tag: "Puntos", max: 8, apply() { coinValue += 2; } },
    { id: "gem", name: "Gem +", desc: "Gem vale más (+6).", tag: "Puntos", max: 6, apply() { gemValue += 6; } },
    { id: "bonus", name: "Bonus +", desc: "Bonus vale más (+10).", tag: "Puntos", max: 6, apply() { bonusValue += 10; } },
    { id: "reroll", name: "Reroll +", desc: "Ganas 1 reroll extra.", tag: "Upgrades", max: 5, apply() { rerolls++; } },
    { id: "mult", name: "Mult +", desc: "Sube multiplicador base (+0.10).", tag: "Combo", max: 10, apply() { mult = clamp(mult + 0.10, 1.0, 4.0); } },
  ];

  const pickedCount = new Map();
  const canPick = (u) => (pickedCount.get(u.id) || 0) < (u.max ?? 999);
  const markPick = (u) => pickedCount.set(u.id, (pickedCount.get(u.id) || 0) + 1);

  function chooseUpgrades(n = 3) {
    const pool = Upgrades.filter(canPick);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!pool.length) break;
      const idx = randi(0, pool.length - 1);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  let currentUpgradeChoices = [];

  function pauseForOverlay(on) {
    if (!running || gameOver) return;
    paused = !!on;
  }

  function openUpgrade() {
    if (inLevelUp || gameOver) return;
    inLevelUp = true;
    pauseForOverlay(true);

    level++;
    levelStartScore = score;
    nextLevelAt = score + Math.round(240 + level * 150);

    if (upTitle) upTitle.textContent = `Nivel ${level}`;
    if (upSub) upSub.textContent = "Elige una mejora";

    renderUpgradeChoices();
    overlayShow(overlayUpgrades);
    updatePillsNow();
  }

  function closeUpgrade() {
    overlayHide(overlayUpgrades);
    inLevelUp = false;
    pauseForOverlay(false);
  }

  function renderUpgradeChoices() {
    currentUpgradeChoices = chooseUpgrades(3);
    if (upgradeChoices) upgradeChoices.innerHTML = "";

    for (const u of currentUpgradeChoices) {
      const card = document.createElement("div");
      card.className = "upCard";
      card.innerHTML = `
        <div class="upTitle">${u.name}</div>
        <div class="upDesc">${u.desc}</div>
        <div class="upMeta">
          <span class="badge">${u.tag}</span>
          <span class="badge">Lv ${(pickedCount.get(u.id) || 0) + 1}/${u.max}</span>
        </div>
      `;
      card.addEventListener("click", () => {
        markPick(u);
        u.apply();
        showToast(`Mejora: ${u.name}`, 950);
        shake(120, 3);
        flash("#6ab0ff", 120);
        closeUpgrade();
      });
      upgradeChoices?.appendChild(card);
    }

    if (btnReroll) btnReroll.disabled = !(rerolls > 0);
    if (btnSkipUpgrade) btnSkipUpgrade.hidden = (level < 4);
  }

  function rerollUpgrades() {
    if (rerolls <= 0) return;
    rerolls--;
    renderUpgradeChoices();
    showToast("Reroll", 650);
    shake(90, 2);
    flash("#ffd35a", 110);
  }

  // ───────────────────────── Rendering ─────────────────────────
  function drawSprite(key, x, y, w, h, alpha = 1) {
    if (!settings.useSprites) return false;
    if (!sprites.ready) return false;
    const img = sprites.map.get(key);
    if (!img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return true;
  }

  function clearScreen() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
    ctx.restore();
  }

  function drawParticles(dtMs) {
    if (!particles.length) return;
    const damp = Math.pow(0.0016, dtMs / 1000);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dtMs;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const t = p.life / p.max;

      p.vx *= damp;
      p.vy = (p.vy * damp) + 42 * (dtMs / 1000);
      p.x += p.vx * (dtMs / 1000);
      p.y += p.vy * (dtMs / 1000);

      const a = clamp(0.90 * t, 0, 0.90);

      if (p.kind === "spark") {
        p.rot += (p.vr || 0) * (dtMs / 1000);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-(p.w || 2) * 0.5, -(p.h || 8) * 0.5, (p.w || 2), (p.h || 8));
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, (p.rad || 2) * (0.65 + 0.65 * t)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts(dtMs) {
    if (!floatTexts.length) return;
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.life -= dtMs;
      if (f.life <= 0) { floatTexts.splice(i, 1); continue; }

      const t = f.life / f.max;
      f.y += f.vy * (dtMs / 1000);

      const a = clamp(0.95 * (t * t), 0, 0.95);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.max(12, Math.floor(cellPx * 0.34))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = f.stroke;
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawMagnetZone(cx, cy) {
    if (magnet <= 0) return;
    const rad = (magnet + 0.35) * cellPx;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.15);
    g.addColorStop(0, "rgba(106,176,255,0.12)");
    g.addColorStop(0.55, "rgba(106,176,255,0.06)");
    g.addColorStop(1, "rgba(106,176,255,0.0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(106,176,255,0.55)";
    ctx.lineWidth = Math.max(1.2, cellPx * 0.06);
    ctx.setLineDash([Math.max(4, cellPx * 0.22), Math.max(3, cellPx * 0.16)]);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw(dtMs = 16) {
    if (!ctx) return;
    if (!gridReady || !ensureGridValid()) { clearScreen(); return; }

    // ✅ shake (solo player): calculamos offset pero NO movemos el grid
    let psx = 0, psy = 0;
    if (shakeT > 0) {
      const k = shakeT / 280;
      const pow = shakePow * k;
      psx = (Math.random() * 2 - 1) * pow;
      psy = (Math.random() * 2 - 1) * pow;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const g = ctx.createLinearGradient(0, 0, 0, cssCanvasH);
    g.addColorStop(0, "#060610");
    g.addColorStop(1, "#04040a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);

    if (hitFlashT > 0) {
      const t = clamp(hitFlashT / hitFlashMax, 0, 1);
      const a = 0.55 * (t * t);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = hitFlashColor;
      ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
      ctx.restore();
    }

    // panel grid
    ctx.fillStyle = "rgba(255,255,255,0.028)";
    ctx.fillRect(offX, offY, gridW, gridH);

    // zona de movimiento
    const zTop = offY + zoneY0 * cellPx;
    const zoneA = 0.070 + 0.06 * zonePulse;
    ctx.fillStyle = `rgba(106,176,255,${zoneA.toFixed(3)})`;
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    // borde zona
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offX + 0.5, zTop + 0.5, gridW - 1, zoneH * cellPx - 1);
    ctx.globalAlpha = 1;

    // tiles
    for (let r = 0; r < ROWS; r++) {
      const y = offY + r * cellPx + scrollPx;
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t === CellType.Empty) continue;

        const used = consumed[r][c];
        const alpha = used ? 0.22 : 0.92;

        const x = offX + c * cellPx;
        const key =
          (t === CellType.Coin) ? "coin" :
          (t === CellType.Gem) ? "gem" :
          (t === CellType.Bonus) ? "bonus" :
          (t === CellType.Trap) ? "trap" : "block";

        const pad = Math.max(2, Math.floor(cellPx * 0.08));
        const ok = drawSprite(key, x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2, alpha);
        if (!ok) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2);
          ctx.globalAlpha = 1;
        }
      }
    }

    // grid lines
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = offX + c * cellPx + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, offY);
      ctx.lineTo(x, offY + gridH);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = offY + r * cellPx + 0.5;
      ctx.beginPath();
      ctx.moveTo(offX, y);
      ctx.lineTo(offX + gridW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // player (con shake local)
    let px = offX + colF * cellPx + psx;
    let py = offY + (zoneY0 + rowF) * cellPx + psy;

    const s = 1 + 0.08 * playerPulse;
    const cx = px + cellPx / 2;
    const cy = py + cellPx / 2;

    drawMagnetZone(cx, cy);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    const padP = Math.max(2, Math.floor(cellPx * 0.08));
    const okP = drawSprite("player", px + padP, py + padP, cellPx - padP * 2, cellPx - padP * 2, 1);
    if (!okP) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(px + padP, py + padP, cellPx - padP * 2, cellPx - padP * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.40)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + padP + 1, py + padP + 1, cellPx - padP * 2 - 2, cellPx - padP * 2 - 2);
    }

    if (shields > 0) {
      ctx.fillStyle = "rgba(106,176,255,0.96)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx * 0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), px + cellPx - 10, py + 12);
    }

    ctx.restore();

    // FX
    ctx.globalCompositeOperation = "lighter";
    drawParticles(dtMs);
    ctx.globalCompositeOperation = "source-over";
    drawFloatTexts(dtMs);

    ctx.restore();
  }

  // ───────────────────────── Resize (fit AR) ─────────────────────────
  function resize() {
    if (!gameArea || !canvas || !ctx) return;

    const r = gameArea.getBoundingClientRect();
    const availW = Math.max(240, Math.floor(r.width));
    const availH = Math.max(240, Math.floor(r.height));

    let w = availW;
    let h = Math.floor(w / CANVAS_AR);
    if (h > availH) { h = availH; w = Math.floor(h * CANVAS_AR); }

    cssCanvasW = Math.max(240, w);
    cssCanvasH = Math.max(240, h);

    canvas.style.width = `${cssCanvasW}px`;
    canvas.style.height = `${cssCanvasH}px`;
    canvas.style.aspectRatio = `${COLS} / ${ROWS}`;

    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.floor(cssCanvasW * dpr);
    canvas.height = Math.floor(cssCanvasH * dpr);

    cellPx = Math.floor(Math.min(cssCanvasW / COLS, cssCanvasH / ROWS));
    cellPx = clampInt(cellPx, 14, 72);

    gridW = cellPx * COLS;
    gridH = cellPx * ROWS;

    offX = Math.floor((cssCanvasW - gridW) / 2);
    offY = Math.floor((cssCanvasH - gridH) / 2);

    draw(16);
  }

  // ───────────────────────── Input ─────────────────────────
  function isAnyBlockingOverlayOpen() {
    const open = (el) => el && el.hidden === false;
    return open(overlayStart) || open(overlayOptions) || open(overlayUpgrades) || open(overlayPaused) || open(overlayGameOver) || open(overlayError) || open(overlayLoading);
  }

  function canControl() {
    return running && !paused && !gameOver && !inLevelUp && !isAnyBlockingOverlayOpen();
  }

  function move(dx, dy) {
    if (!canControl()) return;
    targetCol = clampInt(targetCol + dx, 0, COLS - 1);
    targetRow = clampInt(targetRow + dy, 0, zoneH - 1);
    vibrate(8);
    playerPulse = 0.65;
  }

  function bindInputs() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "Escape") { togglePause(); return; }
      if (k === "r" || k === "R") { if (!isAnyBlockingOverlayOpen()) { resetRun(false); startRun(); } return; }

      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
    });

    btnLeft?.addEventListener("click", () => move(-1, 0));
    btnRight?.addEventListener("click", () => move(+1, 0));
    btnUp?.addEventListener("click", () => move(0, -1));
    btnDown?.addEventListener("click", () => move(0, +1));

    if (!canvas || !gameArea) return;

    const blockIfGame = (e) => { if (e.cancelable) e.preventDefault(); };
    gameArea.addEventListener("wheel", blockIfGame, { passive: false });
    gameArea.addEventListener("touchmove", blockIfGame, { passive: false });
    gameArea.addEventListener("gesturestart", blockIfGame, { passive: false });
    gameArea.addEventListener("gesturechange", blockIfGame, { passive: false });

    let sx = 0, sy = 0, st = 0, active = false;

    canvas.addEventListener("pointerdown", (e) => {
      if (!canControl()) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
    });

    const endSwipe = (e) => {
      if (!active) return;
      active = false;
      if (!canControl()) return;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = performance.now() - st;

      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (dt < 650 && (adx > 22 || ady > 22)) {
        if (adx > ady) move(dx > 0 ? +1 : -1, 0);
        else move(0, dy > 0 ? +1 : -1);
      }
    };

    canvas.addEventListener("pointerup", endSwipe, { passive: true });
    canvas.addEventListener("pointercancel", () => { active = false; }, { passive: true });
  }

  // ───────────────────────── UI ─────────────────────────
  function togglePause() {
    if (!running || gameOver || inLevelUp) return;
    if (overlayOptions && !overlayOptions.hidden) return;
    paused = !paused;
    if (paused) overlayShow(overlayPaused);
    else overlayHide(overlayPaused);
  }

  function showOptions() { overlayShow(overlayOptions); pauseForOverlay(true); }
  function hideOptions() { overlayHide(overlayOptions); if (!inLevelUp && !gameOver && running) pauseForOverlay(false); }

  // ───────────────────────── Run lifecycle ─────────────────────────
  let pendingReload = false;

  function resetRun(showMenu) {
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    score = 0; streak = 0; mult = 1.0; level = 1;
    levelStartScore = 0; nextLevelAt = 220;

    shields = 0; magnet = 0; scoreBoost = 0; trapResist = 0; rerolls = 0;
    pickedCount.clear();

    zoneExtra = 0;
    recomputeZone();

    targetCol = Math.floor(COLS / 2);
    targetRow = Math.floor(zoneH / 2);
    colF = targetCol;
    rowF = targetRow;

    runTime = 0;
    scrollPx = 0;

    particles.length = 0;
    floatTexts.length = 0;
    playerPulse = 0;
    zonePulse = 0;
    shakeT = 0;
    shakePow = 0;

    hitFlashT = 0;
    hitFlashMax = 1;

    makeGrid();
    rerollCombo();

    overlayHide(overlayPaused);
    overlayHide(overlayUpgrades);
    overlayHide(overlayGameOver);
    overlayHide(overlayOptions);

    if (showMenu) { overlayShow(overlayStart); setState("menu"); }
    else overlayHide(overlayStart);

    updatePillsNow();
    draw(16);
  }

  async function startRun() {
    if (overlayStart && !overlayStart.hidden) await overlayFadeOut(overlayStart, 170);
    overlayHide(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayOptions);
    overlayHide(overlayUpgrades);
    overlayHide(overlayError);

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    runTime = 0;
    scrollPx = 0;
    comboTime = comboTimeMax;

    setState("playing");
    updatePillsNow();
    draw(16);
  }

  function gameOverNow(reason) {
    running = false;
    paused = true;
    gameOver = true;
    inLevelUp = false;

    setState("over");
    shake(360, 12);
    flash("#ff2b4d", 360);
    vibrate(32);

    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
      try { Auth?.setBestForActive?.(best); } catch {}
    }

    try {
      const raw = localStorage.getItem(RUNS_KEY);
      const arr = raw ? safeParse(raw, []) : [];
      arr.unshift({ ts: Date.now(), profileId: activeProfileId, name: playerName, score, level, time: Math.round(runTime) });
      arr.length = Math.min(arr.length, 30);
      localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
    } catch {}

    if (goScoreBig) goScoreBig.textContent = String(score | 0);
    if (goBestBig) goBestBig.textContent = String(best | 0);

    if (goStats) {
      goStats.innerHTML = `
        <div class="line"><span>Motivo</span><span>${reason}</span></div>
        <div class="line"><span>Nivel</span><span>${level}</span></div>
        <div class="line"><span>Tiempo</span><span>${Math.round(runTime)}s</span></div>
        <div class="line"><span>Racha</span><span>${streak}</span></div>
        <div class="line"><span>Mult</span><span>${mult.toFixed(2)}</span></div>
      `;
    }

    overlayShow(overlayGameOver);

    if (pendingReload) {
      pendingReload = false;
      requestAppReload();
    }
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

  function tickFx(dtMs) {
    if (toastT > 0) { toastT -= dtMs; if (toastT <= 0) hideToast(); }

    playerPulse = Math.max(0, playerPulse - dtMs / (220 / settings.fx));
    zonePulse = Math.max(0, zonePulse - dtMs / (260 / settings.fx));

    if (shakeT > 0) { shakeT -= dtMs; if (shakeT <= 0) { shakeT = 0; shakePow = 0; } }
    if (hitFlashT > 0) { hitFlashT -= dtMs; if (hitFlashT < 0) hitFlashT = 0; }

    pillAccMs += dtMs;
    if (pillAccMs >= 100) { pillAccMs = 0; updatePillsNow(); }
  }

  function update(dtMs) {
    if (!running || paused || gameOver || inLevelUp) return;

    comboTime -= dtMs / 1000;
    if (comboTimerVal) comboTimerVal.textContent = `${Math.max(0, comboTime).toFixed(1)}s`;
    if (comboTime <= 0) { failCombo(); comboTime = comboTimeMax; }

    const k = 14;
    colF = lerp(colF, targetCol, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));
    rowF = lerp(rowF, targetRow, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));

    runTime += dtMs / 1000;
    const sp = speedRowsPerSec();
    scrollPx += (sp * cellPx) * (dtMs / 1000);

    let safe = 0;
    while (scrollPx >= cellPx && safe++ < 12) {
      scrollPx -= cellPx;
      stepAdvance();
      if (paused || gameOver || inLevelUp || !running) break;
    }
  }

  function frame(t) {
    try {
      const dt = clamp(t - lastT, 0, 50);
      lastT = t;

      tickFx(dt);
      update(dt);
      draw(dt);
    } catch (e) {
      showFatal(e);
    }
    requestAnimationFrame(frame);
  }

  // ───────────────────────── PWA / SW / Install ─────────────────────────
  let deferredPrompt = null;
  let swReg = null;
  let swReloadGuard = false;

  function isStandalone() {
    return (window.matchMedia?.("(display-mode: standalone)")?.matches) ||
      (window.navigator.standalone === true) ||
      document.referrer.includes("android-app://");
  }

  function markUpdateAvailable(msg = "Actualizar") {
    if (!pillUpdate) return;
    pillUpdate.hidden = false;
    setPill(pillUpdate, msg);
  }

  function requestAppReload() {
    if (running && !gameOver) {
      pendingReload = true;
      markUpdateAvailable("Actualizar");
      showToast("Update listo: se aplicará al terminar.", 1200);
      return;
    }
    location.reload();
  }

  async function applySWUpdateNow() {
    if (!swReg) { location.reload(); return; }

    if (swReg.waiting) { try { swReg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {} }
    else { try { await swReg.update?.(); } catch {} }

    const k = "gridrunner_sw_reload_once";
    if (sessionStorage.getItem(k) !== "1") {
      sessionStorage.setItem(k, "1");
      setTimeout(() => location.reload(), 650);
    } else location.reload();
  }

  async function repairPWA() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {}
    location.reload();
  }

  async function setupPWA() {
    setOfflinePill();
    window.addEventListener("online", setOfflinePill, { passive: true });
    window.addEventListener("offline", setOfflinePill, { passive: true });

    if (btnInstall) btnInstall.hidden = true;

    if (!isStandalone()) {
      window.addEventListener("beforeinstallprompt", (e) => {
        if (isStandalone()) return;
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall) btnInstall.hidden = false;
      });

      window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        if (btnInstall) btnInstall.hidden = true;
      });

      btnInstall?.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        btnInstall.disabled = true;
        try { deferredPrompt.prompt(); await deferredPrompt.userChoice; } catch {}
        deferredPrompt = null;
        btnInstall.hidden = true;
        btnInstall.disabled = false;
      });
    }

    pillUpdate?.addEventListener("click", () => {
      if (running && !gameOver) {
        pendingReload = true;
        showToast("Se aplicará al terminar.", 900);
        return;
      }
      applySWUpdateNow();
    });

    if (window.__GRIDRUNNER_NOSW) return;

    if ("serviceWorker" in navigator) {
      try {
        const swUrl = new URL(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`, location.href);
        swReg = await navigator.serviceWorker.register(swUrl);

        try { await swReg.update(); } catch {}
        if (swReg.waiting) markUpdateAvailable("Actualizar");

        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              markUpdateAvailable("Actualizar");
              showToast("Actualización disponible.", 1100);
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (swReloadGuard) return;
          swReloadGuard = true;

          const k = "gridrunner_sw_reload_once";
          if (sessionStorage.getItem(k) !== "1") {
            sessionStorage.setItem(k, "1");
            requestAppReload();
          }
        });
      } catch (e) {
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Auth UI ─────────────────────────
  function initAuthUI() {
    if (!profileSelect) return;

    if (!Auth) {
      if (newProfileWrap) newProfileWrap.hidden = false;
      if (btnStart) btnStart.disabled = false;
      return;
    }

    const list = Auth.listProfiles?.() || [];
    profileSelect.innerHTML = "";

    for (const p of list) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      profileSelect.appendChild(opt);
    }

    const optNew = document.createElement("option");
    optNew.value = "__new__";
    optNew.textContent = "Crear nuevo…";
    profileSelect.appendChild(optNew);

    const ap = Auth.getActiveProfile?.();
    if (ap && list.some(x => x.id === ap.id)) profileSelect.value = ap.id;
    else if (list.length) {
      profileSelect.value = list[0].id;
      Auth.setActiveProfile?.(list[0].id);
      syncFromAuth();
    } else profileSelect.value = "__new__";

    const refreshNewWrap = () => {
      const isNew = profileSelect.value === "__new__";
      if (newProfileWrap) newProfileWrap.hidden = !isNew;
      const ok = !isNew || ((startName?.value || "").trim().length >= 2);
      if (btnStart) btnStart.disabled = !ok;
    };

    profileSelect.addEventListener("change", () => {
      if (profileSelect.value !== "__new__") {
        Auth.setActiveProfile?.(profileSelect.value);
        syncFromAuth();
        updatePillsNow();
      }
      refreshNewWrap();
    });

    btnNewProfile?.addEventListener("click", () => {
      profileSelect.value = "__new__";
      refreshNewWrap();
      startName?.focus();
    });

    startName?.addEventListener("input", refreshNewWrap);
    refreshNewWrap();
  }

  // ───────────────────────── Boot ─────────────────────────
  function cacheDOM() {
    stage = $("stage");
    canvasWrap = $("canvasWrap");
    gameArea = $("gameArea");
    hud = $("hud");
    canvas = $("gameCanvas");

    if (!stage) throw new Error("Falta #stage");
    if (!gameArea) throw new Error("Falta #gameArea");
    if (!canvas) throw new Error("Falta #gameCanvas");

    ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
          canvas.getContext("2d", { alpha: false }) ||
          canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear contexto 2D");

    brandSub = $("brandSub");

    pillScore = $("pillScore");
    pillBest = $("pillBest");
    pillStreak = $("pillStreak");
    pillMult = $("pillMult");
    pillLevel = $("pillLevel");
    pillSpeed = $("pillSpeed");
    pillPlayer = $("pillPlayer");
    pillUpdate = $("pillUpdate");
    pillOffline = $("pillOffline");
    pillVersion = $("pillVersion");

    btnOptions = $("btnOptions");
    btnPause = $("btnPause");
    btnRestart = $("btnRestart");
    btnInstall = $("btnInstall");

    overlayLoading = $("overlayLoading");
    loadingSub = $("loadingSub");
    overlayStart = $("overlayStart");
    overlayPaused = $("overlayPaused");
    overlayUpgrades = $("overlayUpgrades");
    overlayGameOver = $("overlayGameOver");
    overlayOptions = $("overlayOptions");
    overlayError = $("overlayError");

    btnStart = $("btnStart");
    profileSelect = $("profileSelect");
    btnNewProfile = $("btnNewProfile");
    newProfileWrap = $("newProfileWrap");
    startName = $("startName");

    btnResume = $("btnResume");
    btnQuitToStart = $("btnQuitToStart");

    upTitle = $("upTitle");
    upSub = $("upSub");
    upgradeChoices = $("upgradeChoices");
    btnReroll = $("btnReroll");
    btnSkipUpgrade = $("btnSkipUpgrade");

    goStats = $("goStats");
    goScoreBig = $("goScoreBig");
    goBestBig = $("goBestBig");
    btnBackToStart = $("btnBackToStart");
    btnRetry = $("btnRetry");

    btnCloseOptions = $("btnCloseOptions");
    optSprites = $("optSprites");
    optVibration = $("optVibration");
    optDpad = $("optDpad");
    optFx = $("optFx");
    optFxValue = $("optFxValue");
    btnClearLocal = $("btnClearLocal");
    btnRepairPWA = $("btnRepairPWA");

    errMsg = $("errMsg");
    btnErrClose = $("btnErrClose");
    btnErrReload = $("btnErrReload");

    comboSeq = $("comboSeq");
    comboTimerVal = $("comboTimerVal");
    comboHint = $("comboHint");
    toast = $("toast");

    levelProgFill = $("levelProgFill");
    levelProgText = $("levelProgText");
    levelProgPct = $("levelProgPct");

    dpad = $("dpad");
    btnUp = $("btnUp");
    btnDown = $("btnDown");
    btnLeft = $("btnLeft");
    btnRight = $("btnRight");
  }

  async function boot() {
    try {
      const bootStartedAt = performance.now();

      cacheDOM();
      window.__GRIDRUNNER_BOOTED = true;

      setPill(pillVersion, `v${APP_VERSION}`);
      if (pillUpdate) pillUpdate.hidden = true;

      if (loadingSub) loadingSub.textContent = "Iniciando…";
      setState("loading");

      syncFromAuth();

      recomputeZone();
      makeGrid();
      rerollCombo();

      initAuthUI();
      applySettingsToUI();

      resize();
      window.addEventListener("resize", resize, { passive: true });
      window.visualViewport?.addEventListener?.("resize", resize, { passive: true });

      bindInputs();

      btnPause?.addEventListener("click", togglePause);
      btnRestart?.addEventListener("click", () => { resetRun(false); startRun(); });
      btnOptions?.addEventListener("click", showOptions);

      btnResume?.addEventListener("click", () => { overlayHide(overlayPaused); pauseForOverlay(false); });
      btnQuitToStart?.addEventListener("click", async () => { await overlayFadeOut(overlayPaused); resetRun(true); });

      btnRetry?.addEventListener("click", () => { resetRun(false); startRun(); });
      btnBackToStart?.addEventListener("click", () => { resetRun(true); });

      btnCloseOptions?.addEventListener("click", hideOptions);
      overlayOptions?.addEventListener("click", (e) => { if (e.target === overlayOptions) hideOptions(); });

      optSprites?.addEventListener("change", () => { settings.useSprites = !!optSprites.checked; saveSettings(); });
      optVibration?.addEventListener("change", () => { settings.vibration = !!optVibration.checked; saveSettings(); });
      optDpad?.addEventListener("change", () => { settings.showDpad = !!optDpad.checked; applySettingsToUI(); saveSettings(); });
      optFx?.addEventListener("input", () => {
        settings.fx = clamp(parseFloat(optFx.value || "1"), 0.4, 1.25);
        if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);
        saveSettings();
      });

      btnRepairPWA?.addEventListener("click", repairPWA);

      btnClearLocal?.addEventListener("click", () => {
        const ok = confirm("¿Borrar datos locales? (Perfiles, settings, runs)");
        if (!ok) return;
        localStorage.clear();
        location.reload();
      });

      btnErrClose?.addEventListener("click", () => overlayHide(overlayError));
      btnErrReload?.addEventListener("click", () => location.reload());

      btnReroll?.addEventListener("click", rerollUpgrades);
      btnSkipUpgrade?.addEventListener("click", () => { closeUpgrade(); showToast("Saltar", 650); });

      btnStart?.addEventListener("click", async () => {
        if (Auth && profileSelect) {
          if (profileSelect.value === "__new__") {
            const nm = (startName?.value || "").trim();
            const p = Auth.createProfile?.(nm);
            if (!p) { showToast("Nombre mínimo 2 letras", 900); return; }
            syncFromAuth();
            initAuthUI();
          } else {
            Auth.setActiveProfile?.(profileSelect.value);
            syncFromAuth();
          }
        } else {
          const nm = (startName?.value || "").trim().slice(0, 16);
          if (nm.length >= 2) { playerName = nm; localStorage.setItem(NAME_KEY, playerName); }
        }
        updatePillsNow();
        await startRun();
      });

      pillPlayer?.addEventListener("click", () => resetRun(true));
      pillPlayer?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") resetRun(true);
      });

      if (loadingSub) loadingSub.textContent = "PWA…";
      setupPWA();
      preloadSpritesWithTimeout(900);

      resetRun(true);

      lastT = performance.now();
      requestAnimationFrame(frame);

      const SPLASH_MIN_MS = 5000;
      const elapsed = performance.now() - bootStartedAt;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);

      setTimeout(async () => {
        await overlayFadeOut(overlayLoading, 180);
        overlayShow(overlayStart);
        setState("menu");
        if (brandSub) brandSub.textContent = "Listo";
        updatePillsNow();
      }, wait);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && running && !gameOver && !inLevelUp) {
          pauseForOverlay(true);
          overlayShow(overlayPaused);
        }
      });

    } catch (e) {
      showFatal(e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();
