/* app.js — Grid Runner (PWA) v0.1.1
   ✅ v0.1.1:
   - Sin emojis (Material Symbols en HTML)
   - Fix loading infinito: splash + watchdog + nunca bloquea por sprites
   - Botón Instalar: solo web instalable, nunca standalone/app
   - auth.js: perfiles locales (crear/seleccionar), best por perfil
   - Sprites opcionales: assets/sprites/tile_*.svg (fallback si faltan)
*/

(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.1.1");

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  function must(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  }

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function overlayShow(el) { el.hidden = false; }
  function overlayHide(el) { el.hidden = true; }

  function setPill(el, value) {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(value);
    else el.textContent = String(value);
  }

  // ───────────────────────── DOM ─────────────────────────
  const stage = must("stage");
  const canvas = must("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const brandSub = must("brandSub");

  const pillScore = must("pillScore");
  const pillBest = must("pillBest");
  const pillStreak = must("pillStreak");
  const pillMult = must("pillMult");
  const pillLevel = must("pillLevel");
  const pillSpeed = must("pillSpeed");
  const pillPlayer = must("pillPlayer");
  const pillUpdate = must("pillUpdate");
  const pillOffline = must("pillOffline");
  const pillVersion = must("pillVersion");

  const btnOptions = must("btnOptions");
  const btnPause = must("btnPause");
  const btnRestart = must("btnRestart");
  const btnInstall = must("btnInstall");

  const overlayLoading = must("overlayLoading");
  const loadingSub = must("loadingSub");
  const overlayStart = must("overlayStart");
  const overlayPaused = must("overlayPaused");
  const overlayUpgrades = must("overlayUpgrades");
  const overlayGameOver = must("overlayGameOver");
  const overlayOptions = must("overlayOptions");
  const overlayError = must("overlayError");

  const btnStart = must("btnStart");
  const profileSelect = document.getElementById("profileSelect");
  const btnNewProfile = document.getElementById("btnNewProfile");
  const newProfileWrap = document.getElementById("newProfileWrap");
  const startName = document.getElementById("startName");

  const btnResume = must("btnResume");
  const btnQuitToStart = must("btnQuitToStart");

  const upTitle = must("upTitle");
  const upSub = must("upSub");
  const upgradeChoices = must("upgradeChoices");
  const btnReroll = must("btnReroll");
  const btnSkipUpgrade = must("btnSkipUpgrade");

  const goStats = must("goStats");
  const btnBackToStart = must("btnBackToStart");
  const btnRetry = must("btnRetry");

  const btnCloseOptions = must("btnCloseOptions");
  const optSprites = must("optSprites");
  const optVibration = must("optVibration");
  const optDpad = must("optDpad");
  const optFx = must("optFx");
  const optFxValue = must("optFxValue");
  const btnClearLocal = must("btnClearLocal");

  const errMsg = must("errMsg");
  const btnErrClose = must("btnErrClose");
  const btnErrReload = must("btnErrReload");

  const comboSeq = must("comboSeq");
  const comboTimerVal = document.getElementById("comboTimerVal");
  const comboHint = must("comboHint");
  const toast = must("toast");

  const dpad = must("dpad");
  const btnUp = must("btnUp");
  const btnDown = must("btnDown");
  const btnLeft = must("btnLeft");
  const btnRight = must("btnRight");

  setPill(pillVersion, `v${APP_VERSION}`);

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

  function applySettingsToUI() {
    optSprites.checked = !!settings.useSprites;
    optVibration.checked = !!settings.vibration;
    optDpad.checked = !!settings.showDpad;
    optFx.value = String(settings.fx);
    optFxValue.textContent = settings.fx.toFixed(2);

    const isCoarse = matchMedia("(pointer:coarse)").matches;
    dpad.hidden = !(isCoarse && settings.showDpad);
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

  function initAuthUI() {
    if (!Auth || !profileSelect) return;

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
      btnStart.disabled = !ok;
    };

    profileSelect.addEventListener("change", () => {
      if (profileSelect.value !== "__new__") {
        Auth.setActiveProfile?.(profileSelect.value);
        syncFromAuth();
        updatePills();
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

  // ───────────────────────── PWA / SW / Install ─────────────────────────
  let deferredPrompt = null;
  let swReg = null;
  let pendingReload = false;

  function isStandalone() {
    return (window.matchMedia?.("(display-mode: standalone)")?.matches) ||
      (window.navigator.standalone === true) ||
      document.referrer.includes("android-app://");
  }

  function setOfflinePill() {
    pillOffline.hidden = navigator.onLine;
  }

  function requestAppReload() {
    // si está en partida, esperamos
    if (running && !gameOver) {
      pendingReload = true;
      pillUpdate.hidden = false;
      setPill(pillUpdate, "Actualizar");
      showToast("Update listo: se aplicará al terminar.", 1200);
      return;
    }
    location.reload();
  }

  async function setupPWA() {
    setOfflinePill();
    window.addEventListener("online", setOfflinePill, { passive: true });
    window.addEventListener("offline", setOfflinePill, { passive: true });

    // install solo si web instalable y NO standalone
    btnInstall.hidden = true;
    if (!isStandalone()) {
      window.addEventListener("beforeinstallprompt", (e) => {
        if (isStandalone()) return;
        e.preventDefault();
        deferredPrompt = e;
        btnInstall.hidden = false;
      });

      window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        btnInstall.hidden = true;
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
    }

    // update pill
    pillUpdate.addEventListener("click", requestAppReload);

    // SW
    if ("serviceWorker" in navigator) {
      try {
        const url = new URL("./sw.js", location.href);
        swReg = await navigator.serviceWorker.register(url, {
          scope: new URL("./", location.href).pathname
        });

        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              pillUpdate.hidden = false;
              setPill(pillUpdate, "Actualizar");
              showToast("Actualización disponible.", 1100);
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          requestAppReload();
        });
      } catch (e) {
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Sprites optional (SVGs) ─────────────────────────
  const sprites = {
    ready: false,
    map: new Map(), // key->Image
  };

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
    // NO BLOQUEA NUNCA: si falla, sprites.ready=false y ya.
    const keys = [
      ["coin", "tile_coin.svg"],
      ["gem", "tile_gem.svg"],
      ["bonus", "tile_bonus.svg"],
      ["trap", "tile_trap.svg"],
      ["block", "tile_block.svg"],
      // player: si tienes alguno, ponlo aquí. Si no, fallback.
      // ["player", "player.svg"],
    ];

    const timeout = new Promise((res) => setTimeout(res, timeoutMs, "timeout"));

    try {
      const tasks = keys.map(async ([k, file]) => {
        const img = await loadImage(spriteUrl(file));
        sprites.map.set(k, img);
      });

      const result = await Promise.race([Promise.all(tasks), timeout]);
      if (result === "timeout") {
        sprites.ready = sprites.map.size > 0;
        return;
      }
      sprites.ready = sprites.map.size > 0;
    } catch {
      sprites.ready = sprites.map.size > 0;
    }
  }

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
  let targetRow = 1; // dentro de zona
  let colF = 3;
  let rowF = 1;

  // upgrades/effects
  let shields = 0;
  let magnet = 0;     // 0..2
  let scoreBoost = 0; // 0.. (porcentaje)
  let trapResist = 0; // 0..4
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

  // fx
  let toastT = 0;

  // ───────────────────────── UI helpers ─────────────────────────
  function showToast(msg, ms = 900) {
    toast.textContent = msg;
    toast.hidden = false;
    toastT = ms;
  }

  function hideToast() {
    toast.hidden = true;
    toastT = 0;
  }

  function updatePills() {
    setPill(pillScore, score | 0);
    setPill(pillBest, best | 0);
    setPill(pillStreak, streak | 0);
    setPill(pillMult, mult.toFixed(2));
    setPill(pillLevel, `Lv ${level}`);
    setPill(pillSpeed, `${speedRowsPerSec().toFixed(1)}x`);
    setPill(pillPlayer, playerName || "Jugador");
    setOfflinePill();
  }

  // ───────────────────────── Grid ─────────────────────────
  function recomputeZone() {
    zoneH = clamp(zoneBase + zoneExtra, 3, 9);
    zoneY0 = (ROWS - zoneH) - 2; // zona cerca de abajo
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

    // evita filas imposibles
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
    const t = runTime;
    const base = 1.05;
    const byTime = 0.03 * t;
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

  function applyMagnetAround(r, c) {
    if (magnet <= 0) return;
    const rad = magnet; // 1 o 2
    for (let rr = r - rad; rr <= r + rad; rr++) {
      for (let cc = c - rad; cc <= c + rad; cc++) {
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
        if (consumed[rr][cc]) continue;
        const t = grid[rr][cc];
        if (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus) {
          consumed[rr][cc] = true;
          grid[rr][cc] = CellType.Empty;
          applyCollect(t, false); // no combo chain extra
        }
      }
    }
  }

  function applyCollect(t, checkCombo = true) {
    const v = scoreFor(t);
    const add = Math.round(v * mult * (1 + scoreBoost));
    score = Math.max(0, score + add);

    if (t === CellType.Trap) {
      streak = 0;
      mult = clamp(mult * 0.92, 1.0, 4.0);
      vibrate(15);
      failCombo();
      showToast("Trampa", 650);
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
          rerollCombo();
        } else {
          comboTime = comboTimeMax;
          renderComboUI();
        }
      } else {
        failCombo();
      }
    }

    if (!inLevelUp && score >= nextLevelAt) {
      openUpgrade();
    }
  }

  function stepAdvance() {
    shiftRows();

    // puntos por avanzar
    score += 1;

    const r = playerAbsRow();
    const c = Math.round(colF);
    const t = grid[r][c];

    // magnet: antes de aplicar la casilla, atraer
    applyMagnetAround(r, c);

    if (!consumed[r][c] && t !== CellType.Empty) {
      consumed[r][c] = true;
      grid[r][c] = CellType.Empty;

      if (t === CellType.Block) {
        if (shields > 0) {
          shields--;
          showToast("Shield salvó un KO", 900);
          vibrate(20);
        } else {
          gameOverNow("KO");
        }
        return;
      }

      applyCollect(t, true);
    }
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

    // historial
    try {
      const raw = localStorage.getItem(RUNS_KEY);
      const arr = raw ? safeParse(raw, []) : [];
      arr.unshift({ ts: Date.now(), profileId: activeProfileId, name: playerName, score, level });
      arr.length = Math.min(arr.length, 30);
      localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
    } catch {}

    goStats.innerHTML = `
      <div class="line"><span>Motivo</span><span>${reason}</span></div>
      <div class="line"><span>Score</span><span>${score}</span></div>
      <div class="line"><span>Nivel</span><span>${level}</span></div>
      <div class="line"><span>Mejor</span><span>${best}</span></div>
    `;

    overlayShow(overlayGameOver);

    if (pendingReload) {
      pendingReload = false;
      requestAppReload();
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

    upTitle.textContent = `Nivel ${level}`;
    upSub.textContent = "Elige una mejora";

    renderUpgradeChoices();
    overlayShow(overlayUpgrades);
    updatePills();
  }

  function closeUpgrade() {
    overlayHide(overlayUpgrades);
    inLevelUp = false;
    paused = false;
  }

  function renderUpgradeChoices() {
    currentUpgradeChoices = chooseUpgrades(3);
    upgradeChoices.innerHTML = "";

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
        closeUpgrade();
      });
      upgradeChoices.appendChild(card);
    }

    btnReroll.disabled = !(rerolls > 0);
    btnSkipUpgrade.hidden = (level < 4);
  }

  function rerollUpgrades() {
    if (rerolls <= 0) return;
    rerolls--;
    renderUpgradeChoices();
    showToast("Reroll", 650);
  }

  // ───────────────────────── Rendering ─────────────────────────
  function draw() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, stageW, stageH);

    // background board
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(offX, offY, gridW, gridH);

    // zone highlight
    const zTop = offY + zoneY0 * cellPx;
    ctx.fillStyle = "rgba(105,168,255,0.08)";
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    // cells
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

        const ok = drawSprite(key, x + 2, y + 2, cellPx - 4, cellPx - 4, alpha);
        if (!ok) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(x + 2, y + 2, cellPx - 4, cellPx - 4);
          ctx.globalAlpha = 1;
        }
      }
    }

    // grid lines
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const x = offX + c * cellPx;
      ctx.beginPath();
      ctx.moveTo(x, offY);
      ctx.lineTo(x, offY + gridH);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = offY + r * cellPx;
      ctx.beginPath();
      ctx.moveTo(offX, y);
      ctx.lineTo(offX + gridW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // player
    const px = offX + colF * cellPx;
    const py = offY + (zoneY0 + rowF) * cellPx;
    const okP = drawSprite("player", px + 2, py + 2, cellPx - 4, cellPx - 4, 1);
    if (!okP) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(px + 2, py + 2, cellPx - 4, cellPx - 4);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, cellPx - 6, cellPx - 6);
    }

    // shield count
    if (shields > 0) {
      ctx.fillStyle = "rgba(105,168,255,0.95)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx * 0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), px + cellPx - 10, py + 12);
    }

    ctx.restore();
  }

  // ───────────────────────── Resize ─────────────────────────
  function resize() {
    const r = stage.getBoundingClientRect();
    stageW = Math.max(240, Math.floor(r.width));
    stageH = Math.max(240, Math.floor(r.height));

    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.floor(stageW * dpr);
    canvas.height = Math.floor(stageH * dpr);

    cellPx = Math.floor(Math.min(stageW / COLS, stageH / ROWS));
    cellPx = clamp(cellPx, 14, 64);

    gridW = cellPx * COLS;
    gridH = cellPx * ROWS;

    offX = Math.floor((stageW - gridW) / 2);
    offY = Math.floor((stageH - gridH) / 2);

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
    vibrate(10);
  }

  function bindInputs() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
      if (k === "Escape") togglePause();
    }, { passive: true });

    btnLeft.addEventListener("click", () => move(-1, 0));
    btnRight.addEventListener("click", () => move(+1, 0));
    btnUp.addEventListener("click", () => move(0, -1));
    btnDown.addEventListener("click", () => move(0, +1));

    let sx = 0, sy = 0, st = 0, active = false;

    canvas.addEventListener("pointerdown", (e) => {
      if (!canControl()) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener("pointerup", (e) => {
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
    }, { passive: true });
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

    makeGrid();
    rerollCombo();

    overlayHide(overlayPaused);
    overlayHide(overlayUpgrades);
    overlayHide(overlayGameOver);
    if (showMenu) overlayShow(overlayStart);
    else overlayHide(overlayStart);

    updatePills();
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

    updatePills();
    draw();
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

  function update(dtMs) {
    // toast
    if (toastT > 0) {
      toastT -= dtMs;
      if (toastT <= 0) hideToast();
    }

    // combo time
    comboTime -= dtMs / 1000;
    if (comboTimerVal) comboTimerVal.textContent = `${Math.max(0, comboTime).toFixed(1)}s`;
    if (comboTime <= 0) {
      failCombo();
      comboTime = comboTimeMax;
    }

    // smooth player
    const k = 14;
    colF = lerp(colF, targetCol, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));
    rowF = lerp(rowF, targetRow, clamp((dtMs / 1000) * (k / 12), 0.06, 0.35));

    // scroll
    runTime += dtMs / 1000;
    const sp = speedRowsPerSec();
    scrollPx += (sp * cellPx) * (dtMs / 1000);

    while (scrollPx >= cellPx && running && !paused && !gameOver && !inLevelUp) {
      scrollPx -= cellPx;
      stepAdvance();
    }

    updatePills();
  }

  function frame(t) {
    const dt = Math.min(40, t - lastT);
    lastT = t;

    if (running && !paused && !gameOver && !inLevelUp) update(dt);
    else update(dt * 0.25); // UI viva sin “gastar” partida

    draw();
    requestAnimationFrame(frame);
  }

  // ───────────────────────── Boot ─────────────────────────
  async function boot() {
    try {
      loadingSub.textContent = "Preparando UI…";
      applySettingsToUI();
      resize();
      window.addEventListener("resize", resize, { passive: true });

      // auth
      syncFromAuth();
      initAuthUI();

      // inputs
      bindInputs();

      // UI listeners
      btnPause.addEventListener("click", togglePause);
      btnRestart.addEventListener("click", () => { resetRun(false); startRun(); });
      btnOptions.addEventListener("click", showOptions);

      btnResume.addEventListener("click", () => { overlayHide(overlayPaused); paused = false; });
      btnQuitToStart.addEventListener("click", () => { overlayHide(overlayPaused); resetRun(true); });

      btnRetry.addEventListener("click", () => { resetRun(false); startRun(); });
      btnBackToStart.addEventListener("click", () => { resetRun(true); });

      btnCloseOptions.addEventListener("click", hideOptions);
      overlayOptions.addEventListener("click", (e) => { if (e.target === overlayOptions) hideOptions(); });

      optSprites.addEventListener("change", () => { settings.useSprites = !!optSprites.checked; saveSettings(); });
      optVibration.addEventListener("change", () => { settings.vibration = !!optVibration.checked; saveSettings(); });
      optDpad.addEventListener("change", () => { settings.showDpad = !!optDpad.checked; applySettingsToUI(); saveSettings(); });
      optFx.addEventListener("input", () => {
        settings.fx = clamp(parseFloat(optFx.value || "1"), 0.4, 1.25);
        optFxValue.textContent = settings.fx.toFixed(2);
        saveSettings();
      });

      btnClearLocal.addEventListener("click", () => {
        const ok = confirm("¿Borrar datos locales? (Perfiles, settings, runs)");
        if (!ok) return;
        localStorage.clear();
        location.reload();
      });

      btnErrClose.addEventListener("click", () => overlayHide(overlayError));
      btnErrReload.addEventListener("click", () => location.reload());

      btnReroll.addEventListener("click", rerollUpgrades);
      btnSkipUpgrade.addEventListener("click", () => { closeUpgrade(); showToast("Saltar", 650); });

      // Start button (perfil)
      btnStart.addEventListener("click", () => {
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
        updatePills();
        startRun();
      });

      // pill player -> menú
      pillPlayer.addEventListener("click", () => resetRun(true));

      // PWA
      loadingSub.textContent = "Preparando PWA…";
      setupPWA();

      // sprites (no bloquea)
      loadingSub.textContent = "Preparando sprites…";
      preloadSpritesWithTimeout(900);

      // estado inicial
      resetRun(true);

      // loop
      lastT = performance.now();
      requestAnimationFrame(frame);

      // splash + watchdog
      const watchdog = setTimeout(() => {
        if (!overlayLoading.hidden) {
          overlayHide(overlayLoading);
          overlayShow(overlayStart);
        }
      }, 6500);

      await new Promise(res => setTimeout(res, 1100));
      clearTimeout(watchdog);

      overlayHide(overlayLoading);
      overlayShow(overlayStart);

      brandSub.textContent = "Listo";
      updatePills();
    } catch (e) {
      console.error(e);
      overlayHide(overlayLoading);
      errMsg.textContent = e?.message ? e.message : "Error desconocido";
      overlayShow(overlayError);
    }
  }

  boot();
})();
