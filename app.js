/* app.js — Grid Runner (PWA) v0.1.2 (JUICY + FIXED)
   ✅ Canvas sin distorsión: JS fija el tamaño CSS del canvas al mismo que renderiza
   ✅ NO acumula scroll/tiempo en pausa/menús (adiós “lag” al volver)
   ✅ Snap a píxel (scroll + player) => cuadrados perfectos
   ✅ Rendimiento: throttle de DOM (pills) + cap de steps por frame
   ✅ Juice: screen-shake, pulse, partículas ligeras, glow
*/

(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.1.2");

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function overlayShow(el) { if (el) el.hidden = false; }
  function overlayHide(el) { if (el) el.hidden = true; }

  function setPill(el, value) {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    const txt = String(value);
    if (pv) {
      if (pv.textContent !== txt) pv.textContent = txt;
    } else {
      if (el.textContent !== txt) el.textContent = txt;
    }
  }

  const $ = (id) => document.getElementById(id);
  const must = (id) => {
    const el = $(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  };

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
    if (!raw) return defaultSettings();
    const s = safeParse(raw, null);
    if (!s) return defaultSettings();
    return {
      ...defaultSettings(),
      ...s,
      fx: clamp(Number(s.fx ?? 1.0) || 1.0, 0.4, 1.25),
    };
  })();

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function vibrate(ms) {
    if (!settings.vibration) return;
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(ms); } catch {}
  }

  // ───────────────────────── Auth (profiles) ─────────────────────────
  const Auth = window.Auth || null;
  let activeProfileId = null;
  let playerName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0, 16);
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  if (playerName.length < 2) playerName = "Jugador";

  function syncFromAuth() {
    if (!Auth) return;
    const p = Auth.getActiveProfile?.();
    if (!p) return;
    activeProfileId = p.id;
    playerName = (p.name || "Jugador").trim().slice(0, 16) || "Jugador";
    best = (Auth.getBestForActive?.() ?? best) | 0;
    localStorage.setItem(NAME_KEY, playerName);
    localStorage.setItem(BEST_KEY, String(best));
  }

  // ───────────────────────── Sprites optional (SVGs) ─────────────────────────
  const sprites = { ready: false, map: new Map() };

  function spriteUrl(name) {
    return new URL(`./assets/sprites/${name}`, location.href).toString();
  }

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
    ];
    const timeout = new Promise((res) => setTimeout(res, timeoutMs, "timeout"));
    try {
      const tasks = keys.map(async ([k, file]) => {
        const img = await loadImage(spriteUrl(file));
        sprites.map.set(k, img);
      });
      const result = await Promise.race([Promise.all(tasks), timeout]);
      sprites.ready = (result !== "timeout") ? (sprites.map.size > 0) : (sprites.map.size > 0);
    } catch {
      sprites.ready = sprites.map.size > 0;
    }
  }

  // ───────────────────────── Game constants ─────────────────────────
  const COLS = 8;
  const ROWS = 24;

  const CellType = Object.freeze({
    Empty: 0,
    Coin: 1,
    Gem: 2,
    Bonus: 3,
    Trap: 4,
    Block: 5,
  });

  const CELL_COLORS = {
    [CellType.Empty]: "rgba(0,0,0,0)",
    [CellType.Coin]: "#2ee59d",
    [CellType.Gem]: "#69a8ff",
    [CellType.Bonus]: "#ffd35a",
    [CellType.Trap]: "#ff7b2e",
    [CellType.Block]: "#7b8296",
  };

  // ───────────────────────── Runtime state ─────────────────────────
  let running = false;
  let paused = false;
  let gameOver = false;
  let inLevelUp = false;

  let score = 0;
  let streak = 0;
  let mult = 1.0;
  let level = 1;
  let nextLevelAt = 220;

  // grid
  let grid = [];
  let consumed = [];

  // render geom
  let dpr = 1;
  let stageW = 0, stageH = 0;
  let cellPx = 18;
  let gridW = 0, gridH = 0;
  let offX = 0, offY = 0;

  // scrolling
  let scrollPx = 0;
  let runTime = 0;

  // player zone
  let zoneBase = 3;
  let zoneExtra = 0;
  let zoneH = 3;
  let zoneY0 = 0;

  let targetCol = 3;
  let targetRow = 1;
  let colF = 3;
  let rowF = 1;

  // spring movement (snappy)
  let colV = 0;
  let rowV = 0;

  // upgrades/effects
  let shields = 0;
  let magnet = 0;
  let scoreBoost = 0;
  let trapResist = 0;
  let rerolls = 0;

  // values
  let coinValue = 10;
  let gemValue = 30;
  let bonusValue = 60;

  // combo
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

  // juice
  let toastT = 0;
  let shakeT = 0;
  let shakePow = 0;
  let playerPulse = 0; // 0..1

  // particles (super ligero)
  const fxP = [];
  const FX_MAX = 120;

  function addBurst(x, y, color, n = 10, pow = 1.0) {
    const fx = clamp(settings.fx, 0.4, 1.25);
    const count = Math.floor(n * fx);
    for (let i = 0; i < count; i++) {
      if (fxP.length >= FX_MAX) fxP.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (40 + Math.random() * 140) * pow * fx;
      fxP.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        life: 0.35 + Math.random() * 0.35,
        color,
        size: 2 + Math.random() * 2.8
      });
    }
  }

  function shake(seconds, pow) {
    shakeT = Math.max(shakeT, seconds);
    shakePow = Math.max(shakePow, pow);
  }

  // ───────────────────────── DOM refs ─────────────────────────
  let stage, canvas, ctx;
  let brandSub;

  let pillScore, pillBest, pillStreak, pillMult, pillLevel, pillSpeed, pillPlayer, pillUpdate, pillOffline, pillVersion;
  let btnOptions, btnPause, btnRestart, btnInstall;

  let overlayLoading, loadingSub, overlayStart, overlayPaused, overlayUpgrades, overlayGameOver, overlayOptions, overlayError;

  let btnStart, profileSelect, btnNewProfile, newProfileWrap, startName;
  let btnResume, btnQuitToStart;

  let upTitle, upSub, upgradeChoices, btnReroll, btnSkipUpgrade;

  let goStats, btnBackToStart, btnRetry;

  let btnCloseOptions, optSprites, optVibration, optDpad, optFx, optFxValue, btnClearLocal;
  let errMsg, btnErrClose, btnErrReload;

  let comboSeq, comboTimerVal, comboHint, toast;

  let dpad, btnUp, btnDown, btnLeft, btnRight;

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
    toast.hidden = true;
    toast.classList.remove("show");
    toastT = 0;
  }

  function setOfflinePill() {
    if (!pillOffline) return;
    pillOffline.hidden = navigator.onLine;
  }

  // throttle DOM (pills) -> mucho mejor en móvil
  let uiAcc = 0;
  let lastUI = { s:-1, b:-1, st:-1, m:"", lv:"", sp:"", pl:"" };

  function updatePillsThrottled(dtMs) {
    uiAcc += dtMs;
    if (uiAcc < 120) return; // ~8Hz
    uiAcc = 0;

    const s = score | 0;
    const b = best | 0;
    const st = streak | 0;
    const m = mult.toFixed(2);
    const lv = `Lv ${level}`;
    const sp = `${speedRowsPerSec().toFixed(1)}x`;
    const pl = playerName || "Jugador";

    if (lastUI.s !== s) { setPill(pillScore, s); lastUI.s = s; }
    if (lastUI.b !== b) { setPill(pillBest, b); lastUI.b = b; }
    if (lastUI.st !== st) { setPill(pillStreak, st); lastUI.st = st; }
    if (lastUI.m !== m) { setPill(pillMult, m); lastUI.m = m; }
    if (lastUI.lv !== lv) { setPill(pillLevel, lv); lastUI.lv = lv; }
    if (lastUI.sp !== sp) { setPill(pillSpeed, sp); lastUI.sp = sp; }
    if (lastUI.pl !== pl) { setPill(pillPlayer, pl); lastUI.pl = pl; }

    setOfflinePill();
  }

  function applySettingsToUI() {
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx) optFx.value = String(settings.fx);
    if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);

    const isCoarse = matchMedia("(pointer:coarse)").matches;
    if (dpad) dpad.hidden = !(isCoarse && settings.showDpad);
  }

  // ───────────────────────── Grid ─────────────────────────
  function recomputeZone() {
    zoneH = clamp(zoneBase + zoneExtra, 3, 9);
    zoneY0 = (ROWS - zoneH) - 2;
    zoneY0 = clamp(zoneY0, 0, ROWS - zoneH);

    targetRow = clamp(targetRow, 0, zoneH - 1);
    rowF = clamp(rowF, 0, zoneH - 1);
  }

  function makeGrid() {
    grid = new Array(ROWS);
    consumed = new Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      grid[r] = genRow();
      consumed[r] = new Array(COLS).fill(false);
    }
  }

  function genRow() {
    const density = clamp(0.28 + (level - 1) * 0.005, 0.18, 0.52);
    const out = new Array(COLS).fill(CellType.Empty);

    for (let c = 0; c < COLS; c++) {
      if (!chance(density)) continue;

      const wGood = 0.64;
      const wTrap = 0.18;
      const wBlock = 0.18;

      let roll = Math.random() * (wGood + wTrap + wBlock);
      if (roll < wGood) {
        const g = Math.random();
        out[c] = (g < 0.68) ? CellType.Coin : (g < 0.92) ? CellType.Gem : CellType.Bonus;
      } else if (roll < wGood + wTrap) {
        out[c] = CellType.Trap;
      } else {
        out[c] = CellType.Block;
      }
    }

    const blocks = out.reduce((a, v) => a + (v === CellType.Block ? 1 : 0), 0);
    if (blocks >= 5) {
      for (let c = 0; c < COLS; c++) {
        if (out[c] === CellType.Block && chance(0.55)) out[c] = CellType.Empty;
      }
    }
    return out;
  }

  function shiftRows() {
    for (let r = ROWS - 1; r >= 1; r--) {
      grid[r] = grid[r - 1];
      consumed[r] = consumed[r - 1];
    }
    grid[0] = genRow();
    consumed[0] = new Array(COLS).fill(false);
  }

  // ───────────────────────── Gameplay ─────────────────────────
  function speedRowsPerSec() {
    const base = 1.05;
    const byTime = 0.03 * runTime;
    const byLevel = 0.07 * (level - 1);
    return clamp(base + byTime + byLevel, 0.85, 6.25);
  }

  function playerAbsRow() {
    return zoneY0 + Math.round(rowF);
  }

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

  function applyCollect(t, checkCombo = true) {
    const v = scoreFor(t);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    // juice
    playerPulse = 1;

    if (t === CellType.Trap) {
      streak = 0;
      mult = clamp(mult * 0.92, 1.0, 4.0);
      vibrate(18);
      failCombo();
      showToast("Trampa", 650);
      shake(0.22, 4.0);
      return;
    }

    streak++;
    vibrate(10);

    if (checkCombo) {
      if (combo[comboIdx] === t) {
        comboIdx++;
        if (comboIdx >= combo.length) {
          mult = clamp(mult + 0.15, 1.0, 4.0);
          showToast("Combo completado: +MULT", 900);
          shake(0.12, 2.5);
          rerollCombo();
        } else {
          comboTime = comboTimeMax;
          renderComboUI();
        }
      } else {
        failCombo();
      }
    }

    if (!inLevelUp && score >= nextLevelAt) openUpgrade();
  }

  function applyMagnetAround(r, c) {
    if (magnet <= 0) return;
    const rad = magnet;
    for (let rr = r - rad; rr <= r + rad; rr++) {
      for (let cc = c - rad; cc <= c + rad; cc++) {
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
        if (consumed[rr][cc]) continue;
        const t = grid[rr][cc];
        if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) {
          consumed[rr][cc] = true;
          grid[rr][cc] = CellType.Empty;
          applyCollect(t, false);
        }
      }
    }
  }

  function stepAdvance() {
    shiftRows();
    score += 1;

    const r = playerAbsRow();
    const c = Math.round(colF);
    const t = grid[r][c];

    applyMagnetAround(r, c);

    if (!consumed[r][c] && t !== CellType.Empty) {
      consumed[r][c] = true;
      grid[r][c] = CellType.Empty;

      // burst
      const cx = offX + c * cellPx + cellPx * 0.5;
      const cy = offY + r * cellPx + cellPx * 0.5;
      const col = (t === CellType.Trap) ? "#ff7b2e" :
                  (t === CellType.Block) ? "#7b8296" :
                  (t === CellType.Coin) ? "#2ee59d" :
                  (t === CellType.Gem) ? "#69a8ff" : "#ffd35a";
      addBurst(cx, cy, col, (t === CellType.Block) ? 14 : 10, (t === CellType.Block) ? 1.1 : 1.0);

      if (t === CellType.Block) {
        if (shields > 0) {
          shields--;
          showToast("Shield salvó un KO", 900);
          vibrate(22);
          shake(0.18, 3.2);
        } else {
          gameOverNow("KO");
        }
        return;
      }

      applyCollect(t, true);
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
    combo = COMBO_POOL[randi(0, COMBO_POOL.length - 1)].slice();
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
  function canPick(u) {
    const c = pickedCount.get(u.id) || 0;
    return c < (u.max ?? 999);
  }
  function markPick(u) {
    const c = pickedCount.get(u.id) || 0;
    pickedCount.set(u.id, c + 1);
  }

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

  function openUpgrade() {
    if (inLevelUp || gameOver) return;
    inLevelUp = true;
    paused = true;

    level++;
    nextLevelAt = score + Math.round(240 + level * 150);

    if (upTitle) upTitle.textContent = `Nivel ${level}`;
    if (upSub) upSub.textContent = "Elige una mejora";

    renderUpgradeChoices();
    overlayShow(overlayUpgrades);
  }

  function closeUpgrade() {
    overlayHide(overlayUpgrades);
    inLevelUp = false;
    paused = false;
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
        shake(0.10, 2.0);
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

  function draw() {
    if (!ctx) return;

    // screen shake
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      const pow = shakePow * (shakeT * 2.5);
      sx = (Math.random() * 2 - 1) * pow;
      sy = (Math.random() * 2 - 1) * pow;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(sx, sy);

    // crisp
    ctx.imageSmoothingEnabled = false;

    // background inside canvas
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, stageW, stageH);

    // subtle vignette
    const g = ctx.createRadialGradient(stageW*0.5, stageH*0.35, 20, stageW*0.5, stageH*0.5, Math.max(stageW, stageH)*0.75);
    g.addColorStop(0, "rgba(255,255,255,0.045)");
    g.addColorStop(1, "rgba(0,0,0,0.20)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, stageW, stageH);

    // zone highlight
    const zTop = offY + zoneY0 * cellPx;
    ctx.fillStyle = "rgba(105,168,255,0.085)";
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    // snap scroll to pixel (evita blur)
    const spx = Math.round(scrollPx);

    // draw cells
    for (let r = 0; r < ROWS; r++) {
      const y = offY + r * cellPx + spx;
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t === CellType.Empty) continue;

        const used = consumed[r][c];
        const alpha = used ? 0.22 : 0.95;

        const x = offX + c * cellPx;
        const key =
          (t === CellType.Coin) ? "coin" :
          (t === CellType.Gem) ? "gem" :
          (t === CellType.Bonus) ? "bonus" :
          (t === CellType.Trap) ? "trap" : "block";

        const pad = 2;
        const rx = (x + pad) | 0;
        const ry = (y + pad) | 0;
        const rw = (cellPx - pad*2) | 0;

        const ok = drawSprite(key, rx, ry, rw, rw, alpha);
        if (!ok) {
          // base
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(rx, ry, rw, rw);

          // bevel (juicy, pero barato)
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillStyle = "rgba(255,255,255,0.80)";
          ctx.fillRect(rx, ry, rw, 1);
          ctx.fillRect(rx, ry, 1, rw);

          ctx.globalAlpha = alpha * 0.25;
          ctx.fillStyle = "rgba(0,0,0,0.80)";
          ctx.fillRect(rx, ry + rw - 1, rw, 1);
          ctx.fillRect(rx + rw - 1, ry, 1, rw);

          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 1;
        }
      }
    }

    // grid lines (muy suaves)
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = (offX + c * cellPx) | 0;
      ctx.beginPath();
      ctx.moveTo(x, offY);
      ctx.lineTo(x, offY + gridH);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = (offY + r * cellPx) | 0;
      ctx.beginPath();
      ctx.moveTo(offX, y);
      ctx.lineTo(offX + gridW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // player (pulse)
    const px = offX + colF * cellPx;
    const py = offY + (zoneY0 + rowF) * cellPx;

    const pPad = 2;
    const baseX = Math.round(px + pPad);
    const baseY = Math.round(py + pPad);
    const size = Math.round(cellPx - pPad*2);

    const pulse = 1 + (playerPulse * 0.10) * clamp(settings.fx, 0.4, 1.25);
    const cx = baseX + size * 0.5;
    const cy = baseY + size * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);

    const okP = drawSprite("player", baseX, baseY, size, size, 1);
    if (!okP) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(baseX, baseY, size, size);

      // outline
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX + 1, baseY + 1, size - 2, size - 2);
    }

    // shield count
    if (shields > 0) {
      ctx.fillStyle = "rgba(105,168,255,0.95)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx * 0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), baseX + size - 10, baseY + 12);
    }
    ctx.restore();

    // particles
    if (fxP.length) {
      for (let i = 0; i < fxP.length; i++) {
        const p = fxP[i];
        const k = clamp(1 - (p.t / p.life), 0, 1);
        ctx.globalAlpha = 0.9 * k;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ───────────────────────── Resize (FIX: no distorsión) ─────────────────────────
  function resize() {
    if (!stage || !canvas || !ctx) return;

    // Área real disponible
    const r = stage.getBoundingClientRect();
    stageW = Math.max(240, Math.floor(r.width));
    stageH = Math.max(240, Math.floor(r.height));

    // ✅ Igualamos tamaño CSS del canvas a la stage -> 0 distorsión
    canvas.style.width = `${stageW}px`;
    canvas.style.height = `${stageH}px`;

    dpr = Math.max(1, Math.min(2.0, window.devicePixelRatio || 1)); // 2.0 = mejor rendimiento móvil
    canvas.width = Math.floor(stageW * dpr);
    canvas.height = Math.floor(stageH * dpr);

    cellPx = Math.floor(Math.min(stageW / COLS, stageH / ROWS));
    cellPx = clamp(cellPx, 14, 64) | 0;

    gridW = cellPx * COLS;
    gridH = cellPx * ROWS;

    offX = ((stageW - gridW) / 2) | 0;
    offY = ((stageH - gridH) / 2) | 0;

    draw();
  }

  // ───────────────────────── Input ─────────────────────────
  function canControl() {
    return running && !paused && !gameOver && !inLevelUp;
  }

  function move(dx, dy) {
    if (!canControl()) return;
    targetCol = clamp(targetCol + dx, 0, COLS - 1);
    targetRow = clamp(targetRow + dy, 0, zoneH - 1);
    vibrate(8);
  }

  function bindInputs() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
      if (k === "Escape") togglePause();
    });

    btnLeft?.addEventListener("click", () => move(-1, 0));
    btnRight?.addEventListener("click", () => move(+1, 0));
    btnUp?.addEventListener("click", () => move(0, -1));
    btnDown?.addEventListener("click", () => move(0, +1));

    if (!canvas) return;

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

  // ───────────────────────── UI / buttons ─────────────────────────
  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) overlayShow(overlayPaused);
    else overlayHide(overlayPaused);
  }

  function showOptions() {
    overlayShow(overlayOptions);
    if (running && !gameOver) paused = true;
  }

  function hideOptions() {
    overlayHide(overlayOptions);
    if (running && !gameOver && !inLevelUp) paused = false;
  }

  // ───────────────────────── Run lifecycle ─────────────────────────
  function resetRun(showMenu) {
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    score = 0;
    streak = 0;
    mult = 1.0;
    level = 1;
    nextLevelAt = 220;

    shields = 0;
    magnet = 0;
    scoreBoost = 0;
    trapResist = 0;
    rerolls = 0;

    zoneExtra = 0;
    recomputeZone();

    targetCol = Math.floor(COLS / 2);
    targetRow = Math.floor(zoneH / 2);
    colF = targetCol;
    rowF = targetRow;
    colV = 0;
    rowV = 0;

    runTime = 0;
    scrollPx = 0;
    comboTime = comboTimeMax;
    playerPulse = 0;
    shakeT = 0;
    shakePow = 0;

    fxP.length = 0;

    makeGrid();
    rerollCombo();

    overlayHide(overlayPaused);
    overlayHide(overlayUpgrades);
    overlayHide(overlayGameOver);
    if (showMenu) overlayShow(overlayStart);
    else overlayHide(overlayStart);

    draw();
  }

  function startRun() {
    overlayHide(overlayStart);
    overlayHide(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayOptions);
    overlayHide(overlayUpgrades);

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    runTime = 0;
    scrollPx = 0;
    comboTime = comboTimeMax;

    draw();
  }

  function gameOverNow(reason) {
    running = false;
    paused = true;
    gameOver = true;
    inLevelUp = false;

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      Auth?.setBestForActive?.(best);
    }

    try {
      const raw = localStorage.getItem(RUNS_KEY);
      const arr = raw ? safeParse(raw, []) : [];
      arr.unshift({ ts: Date.now(), profileId: activeProfileId, name: playerName, score, level });
      arr.length = Math.min(arr.length, 30);
      localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
    } catch {}

    if (goStats) {
      goStats.innerHTML = `
        <div class="line"><span>Motivo</span><span>${reason}</span></div>
        <div class="line"><span>Score</span><span>${score}</span></div>
        <div class="line"><span>Nivel</span><span>${level}</span></div>
        <div class="line"><span>Mejor</span><span>${best}</span></div>
      `;
    }

    overlayShow(overlayGameOver);
    shake(0.28, 5.0);
  }

  // ───────────────────────── Main loop (FIX sync + perf) ─────────────────────────
  let lastT = 0;

  function updateAlways(dtMs) {
    // toast
    if (toastT > 0) {
      toastT -= dtMs;
      if (toastT <= 0) hideToast();
    }

    // particles
    for (let i = fxP.length - 1; i >= 0; i--) {
      const p = fxP[i];
      p.t += dtMs / 1000;
      if (p.t >= p.life) { fxP.splice(i, 1); continue; }
      const dt = dtMs / 1000;
      p.vx *= Math.pow(0.12, dt); // damping
      p.vy *= Math.pow(0.12, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // shake decay
    if (shakeT > 0) {
      shakeT -= dtMs / 1000;
      if (shakeT <= 0) { shakeT = 0; shakePow = 0; }
    }

    // pulse decay
    if (playerPulse > 0) {
      playerPulse = Math.max(0, playerPulse - (dtMs / 1000) * 3.8);
    }

    // UI throttle
    updatePillsThrottled(dtMs);
  }

  function updateRun(dtMs) {
    const dt = dtMs / 1000;

    // ✅ combo timer solo en juego activo
    comboTime -= dt;
    if (comboTimerVal) comboTimerVal.textContent = `${Math.max(0, comboTime).toFixed(1)}s`;
    if (comboTime <= 0) {
      failCombo();
      comboTime = comboTimeMax;
    }

    // movement spring (snappy)
    const spring = 68;
    const damp = 14;
    colV += (targetCol - colF) * spring * dt;
    rowV += (targetRow - rowF) * spring * dt;
    colV *= Math.exp(-damp * dt);
    rowV *= Math.exp(-damp * dt);
    colF += colV * dt;
    rowF += rowV * dt;

    runTime += dt;

    // scroll
    const sp = speedRowsPerSec();
    scrollPx += (sp * cellPx) * dt;

    // ✅ cap steps por frame (evita freeze si un frame llega tarde)
    const maxSteps = 6;
    let steps = Math.floor(scrollPx / cellPx);
    if (steps > maxSteps) steps = maxSteps;

    if (steps > 0) {
      scrollPx -= steps * cellPx;
      for (let i = 0; i < steps; i++) stepAdvance();
    }

    // si se acumuló demasiado, recorta (no queremos “catch up” infinito)
    scrollPx = clamp(scrollPx, 0, cellPx - 1);
  }

  function frame(t) {
    const dt = Math.min(34, t - lastT); // ~30fps worst-case cap
    lastT = t;

    // Siempre: FX/particles/toast/ui
    updateAlways(dt);

    // Solo juego activo: física/scroll/combos
    if (running && !paused && !gameOver && !inLevelUp) {
      updateRun(dt);
    }

    draw();
    requestAnimationFrame(frame);
  }

  // ───────────────────────── PWA (igual que tu 0.1.2) ─────────────────────────
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

  async function applySWUpdateNow() {
    if (swReg?.waiting) {
      try { swReg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
    }
    const k = "gridrunner_sw_reload_once";
    if (sessionStorage.getItem(k) !== "1") {
      sessionStorage.setItem(k, "1");
      setTimeout(() => location.reload(), 700);
    } else {
      location.reload();
    }
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

    pillUpdate?.addEventListener("click", () => applySWUpdateNow());

    if ("serviceWorker" in navigator) {
      try {
        swReg = await navigator.serviceWorker.register(new URL("./sw.js", location.href));
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
            location.reload();
          }
        });
      } catch (e) {
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Boot ─────────────────────────
  function initAuthUI() {
    if (!Auth || !profileSelect) {
      if (btnStart) btnStart.disabled = false;
      if (newProfileWrap) newProfileWrap.hidden = false;
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
    if (ap && list.some(x => x.id === ap.id)) {
      profileSelect.value = ap.id;
    } else if (list.length) {
      profileSelect.value = list[0].id;
      Auth.setActiveProfile?.(list[0].id);
      syncFromAuth();
    } else {
      profileSelect.value = "__new__";
    }

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

  function globalErrorTrap() {
    window.addEventListener("error", (e) => {
      try {
        overlayHide(overlayLoading);
        if (errMsg) errMsg.textContent = e?.message || "Error";
        overlayShow(overlayError);
      } catch {}
    });

    window.addEventListener("unhandledrejection", (e) => {
      try {
        overlayHide(overlayLoading);
        if (errMsg) errMsg.textContent = (e?.reason?.message || e?.reason || "Promise error");
        overlayShow(overlayError);
      } catch {}
    });
  }

  async function boot() {
    try {
      stage = must("stage");
      canvas = must("gameCanvas");
      ctx = canvas.getContext("2d", { alpha: false });

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
      btnBackToStart = $("btnBackToStart");
      btnRetry = $("btnRetry");

      btnCloseOptions = $("btnCloseOptions");
      optSprites = $("optSprites");
      optVibration = $("optVibration");
      optDpad = $("optDpad");
      optFx = $("optFx");
      optFxValue = $("optFxValue");
      btnClearLocal = $("btnClearLocal");

      errMsg = $("errMsg");
      btnErrClose = $("btnErrClose");
      btnErrReload = $("btnErrReload");

      comboSeq = $("comboSeq");
      comboTimerVal = $("comboTimerVal");
      comboHint = $("comboHint");
      toast = $("toast");

      dpad = $("dpad");
      btnUp = $("btnUp");
      btnDown = $("btnDown");
      btnLeft = $("btnLeft");
      btnRight = $("btnRight");

      setPill(pillVersion, `v${APP_VERSION}`);
      if (pillUpdate) pillUpdate.hidden = true;

      globalErrorTrap();

      if (loadingSub) loadingSub.textContent = "Preparando UI…";
      applySettingsToUI();
      resize();
      window.addEventListener("resize", resize, { passive: true });

      syncFromAuth();
      initAuthUI();

      bindInputs();

      btnPause?.addEventListener("click", togglePause);
      btnRestart?.addEventListener("click", () => { resetRun(false); startRun(); });
      btnOptions?.addEventListener("click", showOptions);

      btnResume?.addEventListener("click", () => { overlayHide(overlayPaused); paused = false; });
      btnQuitToStart?.addEventListener("click", () => { overlayHide(overlayPaused); resetRun(true); });

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

      btnStart?.addEventListener("click", () => {
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
          if (nm.length >= 2) {
            playerName = nm;
            localStorage.setItem(NAME_KEY, playerName);
          }
        }
        startRun();
      });

      pillPlayer?.addEventListener("click", () => resetRun(true));

      if (loadingSub) loadingSub.textContent = "Preparando PWA…";
      setupPWA();

      if (loadingSub) loadingSub.textContent = "Preparando sprites…";
      preloadSpritesWithTimeout(900);

      resetRun(true);

      lastT = performance.now();
      requestAnimationFrame(frame);

      // watchdog + finish splash
      const watchdog = setTimeout(() => {
        if (overlayLoading && !overlayLoading.hidden) {
          overlayHide(overlayLoading);
          overlayShow(overlayStart);
        }
      }, 6500);

      await new Promise(res => setTimeout(res, 900));
      clearTimeout(watchdog);

      overlayHide(overlayLoading);
      overlayShow(overlayStart);

      if (brandSub) brandSub.textContent = "Listo";

      // ✅ marca booted para tu failsafe inline
      window.__GRIDRUNNER_BOOTED = true;

      // pause on tab hide
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && running && !gameOver && !inLevelUp) {
          paused = true;
          overlayShow(overlayPaused);
        }
      });

    } catch (e) {
      console.error(e);
      overlayHide(overlayLoading);
      if (errMsg) errMsg.textContent = e?.message ? e.message : "Error desconocido";
      overlayShow(overlayError);
      if (!overlayError) alert(e?.message || "Error desconocido");
    }
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

})();
