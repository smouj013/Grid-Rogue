/* Grid Runner — PWA (v0.0.7)
   - Layout responsive real (iOS/Android/PC)
   - Player centrado + banda de 3 filas (zona de movimiento)
   - Movimiento 4 direcciones (teclado / swipe / dpad opcional)
   - Visual mejorado: KO muy visible, filas pasadas atenuadas, más “juicy”
   - Combos visibles + nivel/XP + mejoras roguelike (20+)
   - Ranking eliminado (ignorar por ahora)
*/
(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.0.7");

  // ───────────────────────── DOM ─────────────────────────
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const stage = canvas.parentElement;

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

  const comboSeq = $("comboSeq");
  const comboTimer = $("comboTimer");
  const comboHint = $("comboHint");

  const dpad = $("dpad");
  const btnUp = $("btnUp");
  const btnDown = $("btnDown");
  const btnLeft = $("btnLeft");
  const btnRight = $("btnRight");

  const upgBtns = [ $("upg0"), $("upg1"), $("upg2") ];

  // ───────────────────────── Storage keys ─────────────────────────
  const LS_PREFIX = "grid_runner_";
  const BEST_KEY = LS_PREFIX + "best";
  const RUNS_KEY = LS_PREFIX + "runs";
  const NAME_KEY = LS_PREFIX + "name";
  const SETTINGS_KEY = LS_PREFIX + "settings_v2";

  // ───────────────────────── Utils ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const now = () => performance.now() * 0.001;

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

  let toastTimer = 0;
  function showToast(msg, ms=900){
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = ms / 1000;
  }
  function hideToast(){
    toast.hidden = true;
    toastTimer = 0;
  }

  function overlayShow(el){
    el.classList.remove("fadeOut");
    el.hidden = false;
  }
  function overlayHide(el, ms=180){
    el.classList.add("fadeOut");
    window.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("fadeOut");
    }, ms);
  }

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = {
    useSprites: true,
    vibration: true,
    showDpad: true,
    fx: 1.0,
  };

  let settings = loadSettings();
  function loadSettings(){
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings, showDpad: isMobileLike() };
      const obj = JSON.parse(raw);
      return {
        ...defaultSettings,
        ...obj,
        showDpad: ("showDpad" in obj) ? !!obj.showDpad : isMobileLike(),
      };
    } catch {
      return { ...defaultSettings, showDpad: isMobileLike() };
    }
  }
  function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  function applySettingsToUI(){
    optSprites.checked = !!settings.useSprites;
    optVibration.checked = !!settings.vibration;
    optDpad.checked = !!settings.showDpad;
    optFx.value = String(clamp(settings.fx, 0.4, 1.25));
    optFxValue.textContent = clamp(settings.fx, 0.4, 1.25).toFixed(2);

    dpad.hidden = !settings.showDpad;
    pillSprites.textContent = settings.useSprites ? "🧩 Sprites" : "🎨 Colores";
    ctx.imageSmoothingEnabled = !settings.useSprites;
  }

  // ───────────────────────── Sprites (opcionales) ─────────────────────────
  const SPR = {
    player: null,
    empty: null,
    block: null,
    coin: null,
    gem: null,
    trap: null,
    bonus: null,
    ok: false,
  };

  function loadImage(src){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadSprites(){
    const base = "./assets/sprites/";
    const [player, empty, block, coin, gem, trap, bonus] = await Promise.all([
      loadImage(base + "player.svg"),
      loadImage(base + "tile_empty.svg"),
      loadImage(base + "tile_block.svg"),
      loadImage(base + "tile_coin.svg"),
      loadImage(base + "tile_gem.svg"),
      loadImage(base + "tile_trap.svg"),
      loadImage(base + "tile_bonus.svg"),
    ]);
    SPR.player = player;
    SPR.empty = empty;
    SPR.block = block;
    SPR.coin = coin;
    SPR.gem = gem;
    SPR.trap = trap;
    SPR.bonus = bonus;
    SPR.ok = !!(player && empty && block && coin && gem && trap && bonus);
    // no bloquea si faltan
  }

  // ───────────────────────── Game constants ─────────────────────────
  const W = 8;
  const H = 24;

  const CELL = {
    EMPTY: 0,
    COIN: 1,
    GEM: 2,
    BONUS: 3,
    TRAP: 4,
    BLOCK: 5,
  };

  const CELL_COLOR = {
    [CELL.EMPTY]: "rgba(255,255,255,0.06)",
    [CELL.COIN]:  "rgba(124,255,210,0.92)",
    [CELL.GEM]:   "rgba(120,182,255,0.92)",
    [CELL.BONUS]: "rgba(255,209,106,0.92)",
    [CELL.TRAP]:  "rgba(255,122,168,0.92)",
    [CELL.BLOCK]: "rgba(255,78,78,0.90)",
  };

  const CENTER_ROW = Math.floor(H/2);

  // ───────────────────────── Runtime state ─────────────────────────
  let dpr = 1;
  let cellPx = 16;
  let boardX = 0, boardY = 0, boardW = 0, boardH = 0;

  // grid rows: each row is array of cell types
  let grid = [];

  let running = false;
  let paused = false;
  let gameOver = false;
  let inLevelUp = false;

  let playerName = "";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);

  let score = 0;
  let streak = 0;
  let mult = 1;

  let xp = 0;
  let level = 1;
  let xpNeed = 50;

  let rowsSurvived = 0;
  let runTime = 0;

  // movement band
  let bandH = 3; // can upgrade
  let playerW = 1; // can upgrade (2)
  let shieldHits = 0;

  // player pos (grid coords) and smoothing
  let pCol = Math.floor(W/2);
  let pRow = CENTER_ROW; // inside band
  let pColF = pCol;
  let pRowF = pRow;

  // scrolling
  let scrollPx = 0;

  // fx
  let hue = 220;
  let hueTarget = 220;
  let shake = 0;
  let pulse = 0;

  let deltaTimer = 0;

  // buffs
  let buffX2T = 0;
  let magnet = 0; // radius
  let luck = 0;   // spawn bias

  // combo target
  let comboTarget = null;

  // particles / float texts
  const particles = [];
  const floatTexts = [];

  // ───────────────────────── Helpers ─────────────────────────
  function bandTop(){
    const half = Math.floor(bandH/2);
    return clamp(CENTER_ROW - half, 0, H-1);
  }
  function bandBottom(){
    return clamp(bandTop() + bandH - 1, 0, H-1);
  }

  function effectiveMult(){
    return (buffX2T > 0 ? 2 : 1);
  }

  function setScoreDelta(v){
    hudScoreDelta.textContent = (v >= 0 ? `+${v}` : `${v}`);
    hudScoreDelta.classList.add("show");
    deltaTimer = 0.85;
  }

  function awardXp(amount){
    xp += amount;
    while (xp >= xpNeed){
      xp -= xpNeed;
      level += 1;
      xpNeed = Math.floor(50 + (level-1) * 14);
      triggerLevelUp();
    }
  }

  // ───────────────────────── Generation ─────────────────────────
  function initGrid(){
    grid = [];
    for (let r=0;r<H;r++){
      grid.push(genRow(r));
    }
  }

  function weightPick(pairs){
    // pairs: [value, weight]
    let sum = 0;
    for (const p of pairs) sum += p[1];
    let t = Math.random() * sum;
    for (const p of pairs){
      t -= p[1];
      if (t <= 0) return p[0];
    }
    return pairs[pairs.length-1][0];
  }

  function genRow(rIdx){
    // densidad más baja al principio, sube suave con nivel/tiempo
    const prog = clamp((runTime/40) + (level-1)*0.08, 0, 2.2);
    const density = clamp(0.26 + prog*0.06, 0.22, 0.52); // menos ruido
    const blockChance = clamp(0.04 + prog*0.015, 0.03, 0.12);

    const row = new Array(W).fill(CELL.EMPTY);

    // decide cuántas celdas no-vacías
    let count = 0;
    for (let c=0;c<W;c++){
      if (Math.random() < density) count++;
    }
    count = clamp(count, 1, Math.floor(W*0.55));

    const positions = [];
    for (let c=0;c<W;c++) positions.push(c);
    // shuffle
    for (let i=positions.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (let i=0;i<count;i++){
      const c = positions[i];

      // tipos: block poco frecuente pero visible
      const isBlock = (Math.random() < blockChance);
      if (isBlock){
        row[c] = CELL.BLOCK;
        continue;
      }

      // spawn de goodies: luck aumenta gem/bonus y reduce trap
      const l = clamp(luck, 0, 6);
      row[c] = weightPick([
        [CELL.COIN,  52 + l*2],
        [CELL.GEM,   18 + l*3],
        [CELL.BONUS,  8 + l*2],
        [CELL.TRAP,  22 - l*2],
      ]);
    }

    // evita filas imposibles: no llenes de blocks
    const blocks = row.filter(x => x === CELL.BLOCK).length;
    if (blocks >= 4){
      for (let c=0;c<W;c++){
        if (row[c] === CELL.BLOCK && Math.random() < 0.6) row[c] = CELL.EMPTY;
      }
    }

    return row;
  }

  // ───────────────────────── Combo target ─────────────────────────
  function chipForCell(cell){
    if (cell === CELL.COIN)  return { cls:"coin",  label:"Moneda" };
    if (cell === CELL.GEM)   return { cls:"gem",   label:"Gema" };
    if (cell === CELL.BONUS) return { cls:"bonus", label:"Bonus" };
    if (cell === CELL.TRAP)  return { cls:"trap",  label:"Trampa" };
    return { cls:"", label:"—" };
  }

  function newComboTarget(){
    // secuencia variable y relativamente corta para leer bien
    const len = randi(3, 5);
    const seq = [];
    for (let i=0;i<len;i++){
      const t = weightPick([
        [CELL.COIN, 60],
        [CELL.GEM,  25],
        [CELL.BONUS, 15],
      ]);
      seq.push(t);
    }
    comboTarget = {
      seq,
      idx: 0,
      expires: now() + (18 - Math.min(8, level*0.35)), // se ajusta
      reward: 140 + level*10,
    };
    renderComboTarget();
  }

  function renderComboTarget(){
    if (!comboTarget){
      comboSeq.innerHTML = "";
      comboTimer.textContent = "—";
      comboHint.textContent = "—";
      return;
    }

    const tLeft = Math.max(0, comboTarget.expires - now());
    comboTimer.textContent = `${tLeft.toFixed(0)}s`;

    comboSeq.innerHTML = "";
    for (let i=0;i<comboTarget.seq.length;i++){
      const cell = comboTarget.seq[i];
      const info = chipForCell(cell);
      const div = document.createElement("div");
      div.className = "comboChip" + (i < comboTarget.idx ? " done" : "");
      div.innerHTML = `<span class="comboDot ${info.cls}"></span><span>${info.label}</span>`;
      comboSeq.appendChild(div);
    }
    comboHint.textContent = (comboTarget.idx > 0)
      ? `Progreso: ${comboTarget.idx}/${comboTarget.seq.length}`
      : "Completa la secuencia para bonus extra.";
  }

  function onCollectedForCombo(cellType){
    if (!comboTarget) return;

    // expira
    if (now() > comboTarget.expires){
      comboTarget.idx = 0;
      comboTarget.expires = now() + 16;
      hueTarget = 220;
      renderComboTarget();
      return;
    }

    const want = comboTarget.seq[comboTarget.idx];
    if (cellType === want){
      comboTarget.idx++;
      pulse = Math.min(1, pulse + 0.25);
      hueTarget = 190 + (streak * 6);
      renderComboTarget();

      if (comboTarget.idx >= comboTarget.seq.length){
        const bonus = Math.floor(comboTarget.reward * (1 + Math.min(3, streak/10)) * effectiveMult());
        score += bonus;
        setScoreDelta(bonus);
        bump(hudScore);
        showToast(`Combo ✅ +${bonus}`, 900);
        vibrate(22);
        spawnBurstAtPlayer("rgba(255,220,120,0.95)", 24);

        // reset y nueva
        comboTarget = null;
        newComboTarget();

        // recompensa extra
        awardXp(10);
      }
    } else {
      // si coges otra cosa buena: pequeño “fallo” sin castigo fuerte
      if (cellType === CELL.COIN || cellType === CELL.GEM || cellType === CELL.BONUS){
        comboTarget.idx = 0;
        renderComboTarget();
      }
    }
  }

  // ───────────────────────── Upgrades (20+) ─────────────────────────
  const UPG = [];
  const upgPickHistory = new Set();

  function addUpg(id, title, desc, meta, apply){
    UPG.push({ id, title, desc, meta, apply });
  }

  addUpg("BAND_PLUS1", "Banda +1", "Aumenta 1 fila la zona central de movimiento.", "Movilidad", () => {
    bandH = clamp(bandH + 1, 3, 9);
    showToast("Banda ampliada ✅", 800);
  });

  addUpg("BAND_PLUS2", "Banda +2", "Aumenta 2 filas la zona central de movimiento.", "Movilidad", () => {
    bandH = clamp(bandH + 2, 3, 9);
    showToast("Banda ampliada ✅", 800);
  });

  addUpg("WIDE_PLAYER", "Doble bloque", "Ahora ocupas 2 columnas (más fácil pillar items, más riesgo).", "Cuerpo", () => {
    playerW = clamp(playerW + 1, 1, 2);
    pCol = clamp(pCol, 0, W - playerW);
    showToast("Ahora eres 2× ancho ✅", 900);
  });

  addUpg("SHIELD_1", "Escudo", "Absorbe 1 KO (bloque) y te salva.", "Defensa", () => {
    shieldHits = clamp(shieldHits + 1, 0, 3);
    showToast("Escudo +1 ✅", 800);
  });

  addUpg("X2_8S", "x2 (8s)", "Puntos x2 durante 8 segundos.", "Buff", () => {
    buffX2T = Math.max(buffX2T, 8);
    showToast("x2 activo ⚡", 800);
  });

  addUpg("X2_14S", "x2 (14s)", "Puntos x2 durante 14 segundos.", "Buff", () => {
    buffX2T = Math.max(buffX2T, 14);
    showToast("x2 activo ⚡", 800);
  });

  addUpg("MAGNET_1", "Imán I", "Atrae monedas/gemas cercanas (±1 columna).", "Utilidad", () => {
    magnet = clamp(magnet + 1, 0, 3);
    showToast("Imán +1 ✅", 800);
  });

  addUpg("MAGNET_2", "Imán II", "Atrae monedas/gemas cercanas (±2 columnas).", "Utilidad", () => {
    magnet = clamp(magnet + 2, 0, 3);
    showToast("Imán +2 ✅", 800);
  });

  addUpg("LUCK_1", "Suerte I", "Más gemas/bonus, menos trampas.", "Spawn", () => {
    luck = clamp(luck + 1, 0, 6);
    showToast("Suerte +1 ✅", 800);
  });

  addUpg("LUCK_2", "Suerte II", "Más gemas/bonus, menos trampas.", "Spawn", () => {
    luck = clamp(luck + 2, 0, 6);
    showToast("Suerte +2 ✅", 800);
  });

  addUpg("TRAP_SOFT", "Trampas suaves", "Las trampas restan menos y no resetean tanto.", "Defensa", () => {
    // lo aplicamos bajando castigo en runtime con flag
    flags.trapSoft = true;
    showToast("Trampas más suaves ✅", 850);
  });

  addUpg("COIN_PLUS", "Moneda +", "Monedas dan +3 extra (antes de mult).", "Score", () => {
    flags.coinPlus += 3;
    showToast("Monedas mejoradas ✅", 800);
  });

  addUpg("GEM_PLUS", "Gema +", "Gemas dan +10 extra (antes de mult).", "Score", () => {
    flags.gemPlus += 10;
    showToast("Gemas mejoradas ✅", 800);
  });

  addUpg("BONUS_PLUS", "Bonus +", "Bonus da +20 extra (antes de mult).", "Score", () => {
    flags.bonusPlus += 20;
    showToast("Bonus mejorado ✅", 800);
  });

  addUpg("SLOW_START", "Arranque suave", "La velocidad inicial baja (más tiempo al inicio).", "Pacing", () => {
    flags.slowStart = true;
    showToast("Inicio más lento ✅", 900);
  });

  addUpg("XP_UP", "XP +", "Ganas +25% de XP.", "Progreso", () => {
    flags.xpBoost = Math.min(2.0, flags.xpBoost + 0.25);
    showToast("XP aumentado ✅", 800);
  });

  addUpg("COMBO_TIME", "Combo + tiempo", "Los combos duran +6s.", "Combo", () => {
    flags.comboTimePlus += 6;
    showToast("Combos más largos ✅", 800);
  });

  addUpg("COMBO_REWARD", "Combo + premio", "Los combos dan +35% premio.", "Combo", () => {
    flags.comboRewardMul *= 1.35;
    showToast("Premio combo ↑ ✅", 800);
  });

  addUpg("STREAK_KEEP", "Racha firme", "Las filas vacías casi no bajan racha.", "Racha", () => {
    flags.streakFirm = true;
    showToast("Racha más estable ✅", 800);
  });

  addUpg("SAFE_STEP", "Paso seguro", "Tras comer bonus, 1 fila de invulnerabilidad.", "Defensa", () => {
    flags.safeStep = true;
    showToast("Paso seguro ✅", 800);
  });

  addUpg("SCORE_ON_ROWS", "Supervivencia", "Ganas +1 punto por fila sobrevivida.", "Score", () => {
    flags.scorePerRow = true;
    showToast("+1 por fila ✅", 800);
  });

  addUpg("SHAKE_LOW", "FX calmado", "Reduce shake sin quitar partículas.", "Accesibilidad", () => {
    flags.lowShake = true;
    showToast("Shake reducido ✅", 800);
  });

  addUpg("HEAL_STREAK", "Curar racha", "Al subir de nivel: racha +3.", "Racha", () => {
    streak += 3;
    showToast("Racha +3 ✅", 800);
  });

  // runtime flags
  const flags = {
    trapSoft: false,
    coinPlus: 0,
    gemPlus: 0,
    bonusPlus: 0,
    slowStart: false,
    xpBoost: 1.0,
    comboTimePlus: 0,
    comboRewardMul: 1.0,
    streakFirm: false,
    safeStep: false,
    scorePerRow: false,
    lowShake: false,
  };

  let invulRows = 0;

  function triggerLevelUp(){
    inLevelUp = true;
    paused = true;

    overlayShow(overlayUpgrades);

    const picks = pickUpgrades(3);
    for (let i=0;i<3;i++){
      const u = picks[i];
      const btn = upgBtns[i];
      btn.innerHTML = `
        <div class="uTitle">${u.title}</div>
        <div class="uDesc">${u.desc}</div>
        <div class="uMeta">${u.meta}</div>
      `;
      btn.onclick = () => {
        overlayHide(overlayUpgrades, 160);
        inLevelUp = false;
        paused = false;
        u.apply();
        upgPickHistory.add(u.id);
        // mini reward
        vibrate(18);
        showToast(`Mejora: ${u.title}`, 900);
      };
    }
    updateHud(true);
  }

  function pickUpgrades(n){
    // evita repetir demasiado, pero si ya cogiste muchas, rellena
    const pool = UPG.slice().filter(u => !upgPickHistory.has(u.id));
    const src = (pool.length >= n) ? pool : UPG.slice();
    const arr = src.slice();

    // shuffle
    for (let i=arr.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  }

  // ───────────────────────── FX: particles / float texts ─────────────────────────
  function spawnParticles(x, y, color, n, power){
    const k = settings.fx;
    const count = Math.floor(n * k);
    for (let i=0;i<count;i++){
      particles.push({
        x, y,
        vx: (Math.random()*2-1) * 0.9 * power,
        vy: (Math.random()*2-1) * 1.1 * power,
        life: 0.55 + Math.random()*0.25,
        t: 0,
        color,
        s: 2 + Math.random()*2,
      });
    }
  }

  function spawnBurstAtPlayer(color, n){
    const px = boardX + (pColF + 0.5) * cellPx;
    const py = boardY + (pRowF + 0.5) * cellPx - scrollPx;
    spawnParticles(px, py, color, n, 1.2);
  }

  function spawnFloatText(col, row, text, color){
    floatTexts.push({
      x: boardX + (col + 0.5) * cellPx,
      y: boardY + (row + 0.45) * cellPx - scrollPx,
      vy: -0.55,
      t: 0,
      life: 0.9,
      text,
      color,
    });
  }

  function updateParticles(dt){
    // dt in seconds
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * (cellPx * 0.9) * dt;
      p.y += p.vy * (cellPx * 0.9) * dt;
      p.vy += 2.0 * dt;
      if (p.t >= p.life) particles.splice(i, 1);
    }

    for (let i=floatTexts.length-1;i>=0;i--){
      const f = floatTexts[i];
      f.t += dt;
      f.y += f.vy * (cellPx * 0.8) * dt;
      if (f.t >= f.life) floatTexts.splice(i, 1);
    }
  }

  // ───────────────────────── Gameplay ─────────────────────────
  function resetRunState(){
    score = 0;
    streak = 0;
    mult = 1;

    xp = 0;
    level = 1;
    xpNeed = 50;

    rowsSurvived = 0;
    runTime = 0;

    bandH = 3;
    playerW = 1;
    shieldHits = 0;

    buffX2T = 0;
    magnet = 0;
    luck = 0;

    invulRows = 0;

    flags.trapSoft = false;
    flags.coinPlus = 0;
    flags.gemPlus = 0;
    flags.bonusPlus = 0;
    flags.slowStart = false;
    flags.xpBoost = 1.0;
    flags.comboTimePlus = 0;
    flags.comboRewardMul = 1.0;
    flags.streakFirm = false;
    flags.safeStep = false;
    flags.scorePerRow = false;
    flags.lowShake = false;

    pCol = Math.floor(W/2);
    pRow = CENTER_ROW;
    pColF = pCol;
    pRowF = pRow;

    scrollPx = 0;

    shake = 0;
    pulse = 0;
    hue = 220;
    hueTarget = 220;

    particles.length = 0;
    floatTexts.length = 0;

    comboTarget = null;
    newComboTarget();

    initGrid();
  }

  function resetGame(toStart=false){
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    resetRunState();

    overlayHide(overlayPaused, 0);
    overlayHide(overlayGameOver, 0);
    overlayHide(overlayUpgrades, 0);

    if (toStart){
      overlayShow(overlayStart);
      refreshStartStats();
      syncStartNameUI();
    } else {
      overlayHide(overlayStart, 0);
    }

    updateHud(true);
    renderComboTarget();
    draw();
  }

  function currentSpeedRowsPerSec(){
    // progresión: lenta al inicio, acelera suave con tiempo/nivel
    const base = flags.slowStart ? 0.85 : 1.05;
    const t = clamp(runTime / 55, 0, 1.5);
    const lvl = (level-1) * 0.10;
    const streakB = clamp(streak / 80, 0, 0.18);
    const x2 = 0;

    // easing: al inicio acelera menos
    const eased = t * t * (3 - 2*t); // smoothstep
    const sp = base + eased * 1.25 + lvl + streakB + x2;
    return clamp(sp, 0.75, 4.25);
  }

  function tryCollectAt(col, row){
    if (row < 0 || row >= H) return;
    if (col < 0 || col >= W) return;

    const cell = grid[row][col];
    if (cell === CELL.EMPTY) return;

    // KO
    if (cell === CELL.BLOCK){
      if (invulRows > 0){
        // invul
        grid[row][col] = CELL.EMPTY;
        spawnFloatText(col, row, "SAFE", "rgba(180,255,255,0.95)");
        spawnParticles(boardX + (col+0.5)*cellPx, boardY + (row+0.5)*cellPx - scrollPx, "rgba(180,255,255,0.95)", 18, 1.0);
        return;
      }
      if (shieldHits > 0){
        shieldHits--;
        grid[row][col] = CELL.EMPTY;
        showToast("Escudo 🛡️", 850);
        spawnFloatText(col, row, "🛡️", "rgba(180,255,255,0.95)");
        spawnBurstAtPlayer("rgba(180,255,255,0.95)", 22);
        shake = Math.max(shake, 0.12 * settings.fx);
        vibrate(18);
        updateHud(true);
        return;
      }
      endGame("Bloque KO.");
      return;
    }

    // recoge y convierte en vacío
    grid[row][col] = CELL.EMPTY;

    if (cell === CELL.TRAP){
      const penalty = flags.trapSoft ? 12 : 25;
      score = Math.max(0, score - penalty);
      setScoreDelta(-penalty);
      spawnFloatText(col, row, `-${penalty}`, "rgba(255,120,160,0.95)");
      spawnBurstAtPlayer("rgba(255,120,160,0.95)", 18);
      streak = 0;
      mult = 1;
      hueTarget = 330;
      shake = Math.max(shake, (flags.lowShake ? 0.08 : 0.14) * settings.fx);
      vibrate(25);
      awardXp(Math.floor(2 * flags.xpBoost));
      onCollectedForCombo(CELL.TRAP);
      updateHud(true);
      return;
    }

    // goodies
    streak += 1;

    // si quieres una racha más estable, las vacías penalizan menos (se usa en tick)
    mult = 1 + Math.min(4, Math.floor(streak / 6));

    let add = 0;
    let xpAdd = 0;
    let color = "rgba(200,255,220,0.95)";

    if (cell === CELL.COIN){
      add = (10 + flags.coinPlus) * mult;
      xpAdd = 3;
      color = "rgba(124,255,210,0.95)";
    } else if (cell === CELL.GEM){
      add = (30 + flags.gemPlus) * mult;
      xpAdd = 5;
      color = "rgba(120,182,255,0.95)";
    } else if (cell === CELL.BONUS){
      add = (60 + flags.bonusPlus) * mult;
      xpAdd = 7;
      color = "rgba(255,209,106,0.95)";
      // bonus: pequeña invul por filas
      if (flags.safeStep) invulRows = Math.max(invulRows, 1);
    }

    add = Math.floor(add * effectiveMult());
    score += add;

    setScoreDelta(add);
    bump(hudScore);

    spawnFloatText(col, row, `+${add}`, color);
    spawnParticles(
      boardX + (col+0.5)*cellPx,
      boardY + (row+0.5)*cellPx - scrollPx,
      color,
      (cell === CELL.BONUS ? 22 : 14),
      (cell === CELL.BONUS ? 1.25 : 1.0)
    );

    hueTarget = 200 + streak * 3.5;
    pulse = Math.min(1, pulse + 0.12);

    vibrate(cell === CELL.BONUS ? 22 : 12);

    awardXp(Math.floor(xpAdd * flags.xpBoost));

    onCollectedForCombo(cell);
    updateHud(true);
  }

  function tryCollectPlayerCell(){
    // imán: atrae coin/gem cercanos dentro de banda
    if (magnet > 0){
      for (let dx=-magnet; dx<=magnet; dx++){
        for (let w=0; w<playerW; w++){
          const c = clamp(pCol + w + dx, 0, W-1);
          const cell = grid[pRow][c];
          if (cell === CELL.COIN || cell === CELL.GEM){
            tryCollectAt(c, pRow);
          }
        }
      }
    }

    for (let w=0; w<playerW; w++){
      tryCollectAt(pCol + w, pRow);
    }
  }

  function movePlayer(dx, dy){
    if (!running || paused || gameOver || inLevelUp) return;

    const bt = bandTop();
    const bb = bandBottom();

    pCol = clamp(pCol + dx, 0, W - playerW);
    pRow = clamp(pRow + dy, bt, bb);

    // colecciona al moverte (tocar)
    tryCollectPlayerCell();
  }

  function endGame(reason){
    running = false;
    paused = false;
    gameOver = true;

    // guarda best
    if (score > best){
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }

    // guarda runs
    const runs = loadRuns();
    runs.unshift({ t: Date.now(), score, rows: rowsSurvived, level });
    while (runs.length > 8) runs.pop();
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));

    finalLine.textContent = `Has hecho ${score} puntos (Nivel ${level}, ${rowsSurvived} filas). ${reason}`;
    overlayShow(overlayGameOver);
    overlayHide(overlayPaused, 0);
    overlayHide(overlayStart, 0);
    overlayHide(overlayUpgrades, 0);

    shake = Math.max(shake, 0.20 * settings.fx);
    spawnBurstAtPlayer("rgba(255,90,90,0.95)", 28);
    vibrate(55);

    updateHud(true);
  }

  function stepRowAdvance(){
    // fila sobrevivida
    rowsSurvived++;
    if (flags.scorePerRow) score += 1;

    // invul por filas
    if (invulRows > 0) invulRows--;

    // shift grid down: pop bottom, unshift new row on top
    grid.pop();
    grid.unshift(genRow(0));

    // “vacío” puede bajar racha muy suave
    if (!flags.streakFirm && Math.random() < 0.12 && streak > 0){
      streak = Math.max(0, streak - 1);
      mult = 1 + Math.min(4, Math.floor(streak / 6));
    }

    // XP por supervivencia mínima
    awardXp(Math.floor(1 * flags.xpBoost));

    // combo caduca
    if (comboTarget && now() > comboTarget.expires){
      comboTarget.idx = 0;
      comboTarget.expires = now() + (16 + flags.comboTimePlus);
      hueTarget = 220;
      renderComboTarget();
    }

    updateHud(false);

    // recoge si la celda “entra” en ti con el scroll
    tryCollectPlayerCell();
  }

  // ───────────────────────── HUD ─────────────────────────
  function updateHud(force=false){
    hudScore.textContent = String(score);
    hudStreak.textContent = String(streak);
    hudMult.textContent = String(mult * effectiveMult());
    hudBest.textContent = String(best);

    hudLevel.textContent = String(level);
    hudXp.textContent = `${xp}/${xpNeed}`;
    hudLevelFill.style.width = `${Math.floor((xp / xpNeed) * 100)}%`;

    const comboText = comboTarget
      ? `${comboTarget.idx}/${comboTarget.seq.length}`
      : "—";
    hudComboText.textContent = comboText;
    const fill = comboTarget ? (comboTarget.idx / comboTarget.seq.length) : 0;
    hudComboFill.style.width = `${Math.floor(fill * 100)}%`;

    pillLevel.textContent = `⭐ Lv ${level}`;
    pillPlayer.textContent = `👤 ${playerName || "—"}`;

    if (force){
      bump(hudScore);
    }
  }

  // ───────────────────────── Stats start ─────────────────────────
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
    updateHud(true);
  }

  // ───────────────────────── Resize / draw ─────────────────────────
  function resize(){
    const rect = stage.getBoundingClientRect();
    dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const pad = Math.floor(16 * dpr);
    const availW = canvas.width - pad * 2;
    const availH = canvas.height - pad * 2;

    cellPx = Math.max(12, Math.floor(Math.min(availW / W, availH / H)));
    boardW = cellPx * W;
    boardH = cellPx * H;

    boardX = Math.floor((canvas.width - boardW) * 0.5);
    boardY = Math.floor((canvas.height - boardH) * 0.5);

    ctx.imageSmoothingEnabled = !settings.useSprites;
    draw();
  }

  function drawRoundedRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function drawTile(x, y, type, alpha, t){
    ctx.globalAlpha = alpha;

    // sprite path
    if (settings.useSprites && SPR.ok){
      const img =
        type === CELL.EMPTY ? SPR.empty :
        type === CELL.COIN ? SPR.coin :
        type === CELL.GEM ? SPR.gem :
        type === CELL.BONUS ? SPR.bonus :
        type === CELL.TRAP ? SPR.trap :
        SPR.block;

      if (img){
        ctx.drawImage(img, x, y, cellPx, cellPx);
        ctx.globalAlpha = 1;
        return;
      }
    }

    // fallback: color blocks + patterns
    const r = Math.max(3, Math.floor(cellPx * 0.18));
    drawRoundedRect(x+1, y+1, cellPx-2, cellPx-2, r);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    if (type !== CELL.EMPTY){
      // base
      drawRoundedRect(x+2, y+2, cellPx-4, cellPx-4, r-1);
      ctx.fillStyle = CELL_COLOR[type];
      ctx.fill();

      // extra style per type
      if (type === CELL.BLOCK){
        // stripes + pulse border
        const p = 0.5 + 0.5*Math.sin(t*6.5);
        ctx.lineWidth = Math.max(1, Math.floor(2 * dpr));
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.25*p})`;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.rect(x+2, y+2, cellPx-4, cellPx-4);
        ctx.clip();
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (let i=-cellPx;i<cellPx*2;i+=Math.floor(6*dpr)){
          ctx.fillRect(x+i, y, Math.floor(3*dpr), cellPx);
        }
        ctx.restore();

        // X
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(20,0,0,0.55)";
        ctx.lineWidth = Math.max(2, Math.floor(3*dpr));
        ctx.beginPath();
        ctx.moveTo(x+6*dpr, y+6*dpr);
        ctx.lineTo(x+cellPx-6*dpr, y+cellPx-6*dpr);
        ctx.moveTo(x+cellPx-6*dpr, y+6*dpr);
        ctx.lineTo(x+6*dpr, y+cellPx-6*dpr);
        ctx.stroke();
      } else {
        // subtle highlight
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        drawRoundedRect(x+3, y+3, cellPx-6, cellPx*0.40, r-2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawPlayer(x, y, t){
    // glow
    const glow = 0.12 + pulse * 0.10;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, ${glow})`;
    ctx.shadowBlur = Math.floor(22 * dpr * settings.fx);

    const r = Math.max(4, Math.floor(cellPx * 0.22));

    // sprite
    if (settings.useSprites && SPR.ok && SPR.player){
      ctx.drawImage(SPR.player, x, y, cellPx * playerW, cellPx);
      ctx.restore();
      return;
    }

    // fallback
    drawRoundedRect(x+2, y+2, cellPx*playerW-4, cellPx-4, r);
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.92)`;
    ctx.fill();
    ctx.lineWidth = Math.max(1, Math.floor(2*dpr));
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();

    // eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(x + (cellPx*playerW)*0.62, y + cellPx*0.34, cellPx*0.16, cellPx*0.16);

    ctx.restore();
  }

  function draw(){
    const t = now();

    // background hue drift
    hue = lerp(hue, hueTarget, 0.04);

    // clear
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = `hsl(${hue}, 28%, 8%)`;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // camera shake
    const sh = shake * settings.fx;
    const sx = (Math.random()*2-1) * sh * cellPx;
    const sy = (Math.random()*2-1) * sh * cellPx;

    ctx.save();
    ctx.translate(sx, sy);

    // board bg
    const bgGrad = ctx.createLinearGradient(boardX, boardY, boardX, boardY+boardH);
    bgGrad.addColorStop(0, "rgba(255,255,255,0.04)");
    bgGrad.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = bgGrad;
    drawRoundedRect(boardX, boardY, boardW, boardH, Math.floor(18*dpr));
    ctx.fill();

    // band highlight (zona mov)
    const bt = bandTop();
    const bb = bandBottom();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(120,200,255,0.08)";
    ctx.fillRect(boardX, boardY + bt*cellPx, boardW, (bb-bt+1)*cellPx);

    // grid tiles
    // y offset for scroll: tiles appear moved down by scrollPx
    for (let r=0;r<H;r++){
      for (let c=0;c<W;c++){
        const type = grid[r][c];

        const x = boardX + c*cellPx;
        const y = boardY + r*cellPx + scrollPx;

        // if offscreen skip
        if (y < boardY - cellPx || y > boardY + boardH) continue;

        // fade "past" rows below band
        let a = 1.0;
        if (r > bb + 1) a = 0.38;
        else if (r < bt - 1) a = 0.65;

        drawTile(x, y, type, a, t);
      }
    }

    // player in fixed band coord (scroll affects world, so player y should subtract scroll)
    // We render player using pRowF but in board coords we subtract scrollPx to keep him stable relative to board.
    pColF = lerp(pColF, pCol, 0.24);
    pRowF = lerp(pRowF, pRow, 0.24);

    const px = boardX + pColF * cellPx;
    const py = boardY + pRowF * cellPx + scrollPx;

    drawPlayer(px, py, t);

    // invul indicator
    if (invulRows > 0 || shieldHits > 0){
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = invulRows > 0 ? "rgba(180,255,255,0.80)" : "rgba(200,255,255,0.60)";
      ctx.lineWidth = Math.max(2, Math.floor(3*dpr));
      drawRoundedRect(px+3, py+3, cellPx*playerW-6, cellPx-6, Math.floor(cellPx*0.24));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // particles
    for (const p of particles){
      const life = 1 - (p.t / p.life);
      ctx.globalAlpha = clamp(life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s*dpr, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // float texts
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(14*dpr)}px system-ui, -apple-system, Segoe UI, Roboto`;
    for (const f of floatTexts){
      const life = 1 - (f.t / f.life);
      ctx.globalAlpha = clamp(life, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ───────────────────────── Tick loop ─────────────────────────
  let lastT = 0;
  function loop(ts){
    if (!running){
      // aun así, dibuja un poco para no “romper” si resize
      lastT = ts;
      requestAnimationFrame(loop);
      return;
    }

    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;

    dt = clamp(dt, 0, 0.05);

    if (toastTimer > 0){
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }

    if (deltaTimer > 0){
      deltaTimer -= dt;
      if (deltaTimer <= 0){
        hudScoreDelta.classList.remove("show");
        hudScoreDelta.textContent = "+0";
      }
    }

    // timers buffs
    if (buffX2T > 0) buffX2T = Math.max(0, buffX2T - dt);

    // combo timer text
    if (comboTarget){
      comboTimer.textContent = `${Math.max(0, comboTarget.expires - now()).toFixed(0)}s`;
    }

    if (!paused && !gameOver && !inLevelUp){
      runTime += dt;

      // scroll
      const speedRows = currentSpeedRowsPerSec();
      pillSpeed.textContent = `Vel ${speedRows.toFixed(1)}×`;

      scrollPx += speedRows * cellPx * dt;

      while (scrollPx >= cellPx){
        scrollPx -= cellPx;
        stepRowAdvance();
      }

      // shake decay
      shake = Math.max(0, shake - dt * 0.9);
      pulse = Math.max(0, pulse - dt * 0.7);
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ───────────────────────── Input ─────────────────────────
  function bindInputs(){
    // quick left/right zones
    zoneLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(-1, 0); }, { passive:false });
    zoneRight.addEventListener("pointerdown", (e) => { e.preventDefault(); movePlayer(+1, 0); }, { passive:false });

    // dpad
    btnUp.addEventListener("click", () => movePlayer(0, -1));
    btnDown.addEventListener("click", () => movePlayer(0, +1));
    btnLeft.addEventListener("click", () => movePlayer(-1, 0));
    btnRight.addEventListener("click", () => movePlayer(+1, 0));

    // keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") movePlayer(-1, 0);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") movePlayer(+1, 0);
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") movePlayer(0, -1);
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") movePlayer(0, +1);

      if (e.key === " " || e.key === "Spacebar" || e.key === "p" || e.key === "P" || e.key === "Escape"){
        if (running && !gameOver) setPaused(!paused);
      }
      if (e.key === "Enter"){
        if (!overlayStart.hidden) startGame();
        else if (!overlayGameOver.hidden) { resetRunState(); startGame(); }
      }
    });

    // swipe 4 dirs
    let sx0=0, sy0=0, st0=0;
    canvas.addEventListener("pointerdown", (e) => {
      sx0 = e.clientX; sy0 = e.clientY; st0 = performance.now();
    }, { passive:true });

    canvas.addEventListener("pointerup", (e) => {
      const dt = performance.now() - st0;
      if (dt > 380) return;

      const dx = e.clientX - sx0;
      const dy = e.clientY - sy0;

      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const min = 26;

      if (ax < min && ay < min) return;

      if (ax > ay){
        movePlayer(dx > 0 ? +1 : -1, 0);
      } else {
        movePlayer(0, dy > 0 ? +1 : -1);
      }
    }, { passive:true });

    // pause on background
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running && !gameOver) setPaused(true, true);
    });

    // prevent scroll on iOS while playing
    document.addEventListener("touchmove", (e) => {
      if (running) e.preventDefault();
    }, { passive:false });
  }

  // ───────────────────────── UI buttons ─────────────────────────
  function setPaused(v, silent=false){
    if (gameOver) return;
    paused = !!v;

    if (paused){
      if (!silent) overlayShow(overlayPaused);
    } else {
      overlayHide(overlayPaused, 160);
    }
  }

  function startGame(){
    if (gameOver) return;

    const nm = (startName.value || "").trim().slice(0, 16);
    if (!nm || nm.length < 2){
      showToast("Pon un nombre (mín. 2).", 1100);
      return;
    }

    playerName = nm;
    localStorage.setItem(NAME_KEY, playerName);

    pillPlayer.textContent = `👤 ${playerName}`;

    overlayHide(overlayStart, 160);
    overlayHide(overlayGameOver, 0);
    overlayHide(overlayPaused, 0);
    overlayHide(overlayUpgrades, 0);
    overlayHide(overlayOptions, 0);

    running = true;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    lastT = 0;
    showToast("¡Vamos! 🔥", 700);

    // reset run y arranca
    resetRunState();
    updateHud(true);
  }

  function bindButtons(){
    pillVersion.textContent = `v${APP_VERSION}`;

    btnStart.addEventListener("click", startGame);
    startName.addEventListener("input", () => {
      btnStart.disabled = !((startName.value || "").trim().length >= 2);
    });

    btnResume.addEventListener("click", () => setPaused(false));
    btnPause.addEventListener("click", () => {
      if (!running || gameOver) return;
      setPaused(!paused);
    });

    btnRestart.addEventListener("click", () => {
      if (!running) {
        resetGame(true);
        return;
      }
      resetRunState();
      showToast("Reset ✅", 700);
      updateHud(true);
    });

    btnPlayAgain.addEventListener("click", () => {
      resetRunState();
      overlayHide(overlayGameOver, 160);
      running = true;
      paused = false;
      gameOver = false;
      showToast("Otra 🔁", 650);
    });

    btnBackToStart.addEventListener("click", () => {
      resetGame(true);
    });

    btnOptions.addEventListener("click", () => {
      overlayShow(overlayOptions);
      applySettingsToUI();
    });

    btnCloseOptions.addEventListener("click", () => overlayHide(overlayOptions, 160));

    optSprites.addEventListener("change", () => {
      settings.useSprites = !!optSprites.checked;
      saveSettings();
      applySettingsToUI();
      draw();
      showToast(settings.useSprites ? "Sprites ON ✅" : "Sprites OFF ✅", 800);
    });

    optVibration.addEventListener("change", () => {
      settings.vibration = !!optVibration.checked;
      saveSettings();
      applySettingsToUI();
      showToast("Guardado ✅", 650);
    });

    optDpad.addEventListener("change", () => {
      settings.showDpad = !!optDpad.checked;
      saveSettings();
      applySettingsToUI();
      showToast("Guardado ✅", 650);
    });

    optFx.addEventListener("input", () => {
      settings.fx = clamp(parseFloat(optFx.value) || 1.0, 0.4, 1.25);
      optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
    });

    btnClearLocal.addEventListener("click", () => {
      localStorage.removeItem(BEST_KEY);
      localStorage.removeItem(RUNS_KEY);
      best = 0;
      refreshStartStats();
      updateHud(true);
      showToast("Datos local borrados ✅", 900);
    });
  }

  // ───────────────────────── PWA ─────────────────────────
  function setupPWA(){
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

    // SW register (GitHub Pages compatible)
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
  }

  // ───────────────────────── Boot ─────────────────────────
  function boot(){
    // nombre
    const savedName = (localStorage.getItem(NAME_KEY) || "").trim();
    if (savedName) playerName = savedName;

    hudBest.textContent = String(best);

    applySettingsToUI();
    refreshStartStats();
    syncStartNameUI();

    // overlays
    overlayShow(overlayStart);

    // init
    resetRunState();
    bindInputs();
    bindButtons();
    setupPWA();

    resize();
    window.addEventListener("resize", () => resize(), { passive:true });
    window.addEventListener("orientationchange", () => setTimeout(resize, 80), { passive:true });

    // sprites async (no bloquea)
    loadSprites().then(() => draw());

    // loop siempre vivo (evita “se queda pillado”)
    requestAnimationFrame(loop);

    console.log(`Grid Runner PWA v${APP_VERSION} (ranking ignorado)`);
  }

  boot();
})();
