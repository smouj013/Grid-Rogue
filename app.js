/* app.js — Grid Runner (PWA) v0.1.1
   ✅ v0.1.1:
   - Sin emojis: iconos Material Symbols (Google Fonts)
   - Fix loading infinito: watchdog + no bloqueo por sprites + overlay error correcto
   - Botón Instalar: solo web instalable, nunca en standalone/app
   - auth.js: perfiles locales (crear/seleccionar), best por perfil
*/

(() => {
  "use strict";

  const APP_VERSION = (window.APP_VERSION || "0.1.1");

  // ───────────────────────── Utils ─────────────────────────
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  function must(id){
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  }

  // ───────────────────────── DOM ─────────────────────────
  const stage = must("stage");
  const canvas = must("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha:false });

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

  const startTitle = must("startTitle");
  const startSub = must("startSub");
  const btnStart = must("btnStart");

  const profileSelect = document.getElementById("profileSelect");
  const btnNewProfile = document.getElementById("btnNewProfile");
  const newProfileWrap = document.getElementById("newProfileWrap");
  const startName = document.getElementById("startName");
  const profileHint = document.getElementById("profileHint");

  const btnResume = must("btnResume");
  const btnQuitToStart = must("btnQuitToStart");

  const upTitle = must("upTitle");
  const upSub = must("upSub");
  const upgradeChoices = must("upgradeChoices");
  const btnReroll = must("btnReroll");
  const btnSkipUpgrade = must("btnSkipUpgrade");
  const upgradeHint = must("upgradeHint");

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
  const comboTimer = must("comboTimer");
  const comboTimerVal = document.getElementById("comboTimerVal");
  const comboHint = must("comboHint");
  const toast = must("toast");

  const dpad = must("dpad");
  const btnUp = must("btnUp");
  const btnDown = must("btnDown");
  const btnLeft = must("btnLeft");
  const btnRight = must("btnRight");

  pillVersion.textContent = `v${APP_VERSION}`;

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
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const s = JSON.parse(raw);
      return {
        ...defaultSettings(),
        ...s,
        fx: clamp(Number(s.fx ?? 1.0) || 1.0, 0.4, 1.25),
      };
    } catch {
      return defaultSettings();
    }
  })();

  function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applySettingsToUI(){
    optSprites.checked = !!settings.useSprites;
    optVibration.checked = !!settings.vibration;
    optDpad.checked = !!settings.showDpad;
    optFx.value = String(settings.fx);
    optFxValue.textContent = settings.fx.toFixed(2);

    const isCoarse = matchMedia("(pointer:coarse)").matches;
    dpad.hidden = !(isCoarse && settings.showDpad);
  }

  // ───────────────────────── Auth (profiles) ─────────────────────────
  const Auth = window.Auth || null;
  let playerName = "";
  let best = 0;
  let activeProfileId = null;

  function syncFromAuth(){
    if (!Auth) return;
    const p = Auth.getActiveProfile?.();
    if (p){
      activeProfileId = p.id;
      playerName = (p.name || "").trim().slice(0,16);
      best = Auth.getBestForActive?.() ?? 0;
      localStorage.setItem(NAME_KEY, playerName);
      localStorage.setItem(BEST_KEY, String(best)); // compat
    }
  }

  function initAuthUI(){
    if (!Auth || !profileSelect) return;

    const list = Auth.listProfiles();
    profileSelect.innerHTML = "";

    for (const p of list){
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      profileSelect.appendChild(opt);
    }

    const optNew = document.createElement("option");
    optNew.value = "__new__";
    optNew.textContent = "Crear nuevo…";
    profileSelect.appendChild(optNew);

    const ap = Auth.getActiveProfile();
    if (ap && list.some(x => x.id === ap.id)){
      profileSelect.value = ap.id;
    } else if (list.length){
      profileSelect.value = list[0].id;
      Auth.setActiveProfile(list[0].id);
    } else {
      profileSelect.value = "__new__";
    }

    const refreshNewWrap = () => {
      const isNew = profileSelect.value === "__new__";
      if (newProfileWrap) newProfileWrap.hidden = !isNew;
      btnStart.disabled = isNew && (!startName || (startName.value.trim().length < 2));
    };

    profileSelect.addEventListener("change", () => {
      if (profileSelect.value !== "__new__"){
        Auth.setActiveProfile(profileSelect.value);
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

    profileHint && (profileHint.textContent = "Tus datos se guardan en este dispositivo.");
    refreshNewWrap();
  }

  // ───────────────────────── Game constants ─────────────────────────
  const COLS = 8;
  const ROWS = 24;

  const CellType = Object.freeze({
    Empty: 0,
    Coin:  1,
    Gem:   2,
    Bonus: 3,
    Trap:  4,
    Block: 5,
  });

  const CELL_COLORS = {
    [CellType.Empty]: "rgba(0,0,0,0)",
    [CellType.Coin]:  "#2ee59d",
    [CellType.Gem]:   "#69a8ff",
    [CellType.Bonus]: "#ffd35a",
    [CellType.Trap]:  "#ff7b2e",
    [CellType.Block]: "#7b8296",
  };

  // ───────────────────────── Runtime state ─────────────────────────
  best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  playerName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0,16);
  if (playerName.length < 2) playerName = "";

  let running = false;
  let paused = false;
  let gameOver = false;
  let inLevelUp = false;

  let grid = [];
  let consumed = [];

  // render geometry
  let dpr = 1;
  let stageW = 0;
  let stageH = 0;
  let cellPx = 18;
  let gridW = 0;
  let gridH = 0;
  let offX = 0;
  let offY = 0;

  // scroll
  let scrollPx = 0;
  let runTime = 0;

  // zone/player
  let zoneRowsBase = 3;
  let zoneExtra = 0;
  let zoneY0 = 0;
  let zoneH = 3;

  let playerCol = 0;
  let playerRowInZone = 0;
  let targetCol = 0;
  let targetRowInZone = 0;
  let playerColF = 0;
  let playerRowF = 0;

  // score
  let score = 0;
  let streak = 0;
  let mult = 1.0;

  // level
  let level = 1;
  let nextLevelScore = 180;

  // generation knobs
  let genDensityMul = 1.0;
  let genBlockMul = 1.0;
  let genGoodMul = 1.0;
  let genBonusMul = 1.0;
  let startSlow = false;

  // survivability/specials
  let shields = 0;
  let magnetLv = 0;
  let flatScorePerRow = 1;
  let multHold = 0;

  // reroll
  let rerollCharges = 0;

  // fx
  let toastTimer = 0;
  let bgHue = 220;
  let bgHueTarget = 220;

  // combo system
  const COMBOS = [
    [CellType.Coin, CellType.Coin, CellType.Gem],
    [CellType.Gem, CellType.Coin, CellType.Bonus],
    [CellType.Coin, CellType.Gem, CellType.Gem],
    [CellType.Bonus, CellType.Coin, CellType.Gem],
    [CellType.Coin, CellType.Coin, CellType.Coin, CellType.Bonus],
  ];
  let combo = [];
  let comboIdx = 0;
  let comboEndsAt = 0;

  // particles
  let pops = [];

  // sprites optional
  const sprites = {
    ready: false,
    img: null,
    map: {},
  };

  // ───────────────────────── Overlays ─────────────────────────
  function overlayShow(el){ el.hidden = false; }
  function overlayHide(el){ el.hidden = true; }

  function setPaused(v){ paused = !!v; }

  function showToast(msg, ms=900){
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = ms;
  }
  function hideToast(){
    toast.hidden = true;
    toastTimer = 0;
  }

  // ───────────────────────── PWA / SW update ─────────────────────────
  let deferredPrompt = null;
  let swReg = null;
  let pendingReload = false;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  function setOfflinePill(){
    pillOffline.hidden = navigator.onLine;
  }

  function requestAppReload(){
    if (running && !gameOver){
      pendingReload = true;
      pillUpdate.hidden = false;
      pillUpdate.querySelector(".pv")?.textContent && (pillUpdate.querySelector(".pv").textContent = "Actualizar");
      showToast("Update listo (al terminar).", 1200);
      return;
    }
    location.reload();
  }

  async function setupPWA(){
    setOfflinePill();
    window.addEventListener("online", setOfflinePill, { passive:true });
    window.addEventListener("offline", setOfflinePill, { passive:true });

    // Install solo si NO es standalone/app
    btnInstall.hidden = true;
    if (isStandalone()){
      btnInstall.hidden = true;
    }

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
      try{
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      btnInstall.hidden = true;
      btnInstall.disabled = false;
    });

    pillUpdate.addEventListener("click", () => requestAppReload());

    if ("serviceWorker" in navigator){
      try{
        const url = new URL("./sw.js", location.href);
        swReg = await navigator.serviceWorker.register(url, { scope: new URL("./", location.href).pathname });

        // Cuando haya update, mostramos pillUpdate
        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed"){
              if (navigator.serviceWorker.controller){
                pillUpdate.hidden = false;
                showToast("Actualización disponible.", 1100);
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          requestAppReload();
        });
      } catch (e){
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Sprites optional (NO BLOQUEA) ─────────────────────────
  async function preloadSpritesWithTimeout(timeoutMs=1400){
    const ac = ("AbortController" in window) ? new AbortController() : null;
    const t = setTimeout(() => ac?.abort(), timeoutMs);

    try{
      const atlasUrl = new URL("./assets/sprites/atlas.png", location.href).toString();
      const jsonUrl  = new URL("./assets/sprites/atlas.json", location.href).toString();

      const img = new Image();
      img.decoding = "async";

      const imgPromise = new Promise((res, rej) => {
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("atlas.png missing"));
      });
      img.src = atlasUrl;

      const jsonRes = await fetch(jsonUrl, { cache: "no-store", signal: ac?.signal }).catch(() => null);
      if (!jsonRes || !jsonRes.ok) throw new Error("atlas.json missing");
      const map = await jsonRes.json();

      await imgPromise;

      sprites.img = img;
      sprites.map = map || {};
      sprites.ready = true;
    } catch {
      sprites.ready = false;
    } finally {
      clearTimeout(t);
    }
  }

  function drawSprite(key, x, y, w, h, alpha=1){
    if (!settings.useSprites || !sprites.ready) return false;
    const r = sprites.map[key];
    if (!r || !sprites.img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites.img, r.x, r.y, r.w, r.h, x, y, w, h);
    ctx.restore();
    return true;
  }

  // ───────────────────────── Generation ─────────────────────────
  function initGrid(){
    grid = new Array(ROWS);
    consumed = new Array(ROWS);
    for (let r=0;r<ROWS;r++){
      grid[r] = new Array(COLS).fill(CellType.Empty);
      consumed[r] = new Array(COLS).fill(false);
    }
    for (let r=0;r<ROWS;r++){
      grid[r] = genRow(r);
      consumed[r] = new Array(COLS).fill(false);
    }
  }

  function genRow(){
    const baseDensity = 0.28;
    const density = clamp(baseDensity * genDensityMul, 0.12, 0.55);
    const out = new Array(COLS).fill(CellType.Empty);

    for (let c=0;c<COLS;c++){
      if (!chance(density)) continue;

      const wGood = 0.62 * genGoodMul;
      const wTrap = 0.18;
      const wBlock = 0.20 * genBlockMul;

      const t = Math.random() * (wGood + wTrap + wBlock);
      let type = CellType.Coin;

      if (t < wGood){
        const g = Math.random();
        if (g < 0.68) type = CellType.Coin;
        else if (g < 0.92) type = CellType.Gem;
        else type = chance(0.45 * genBonusMul) ? CellType.Bonus : CellType.Gem;
      } else if (t < wGood + wTrap){
        type = CellType.Trap;
      } else {
        type = CellType.Block;
      }
      out[c] = type;
    }

    const blockCount = out.reduce((a,v)=>a+(v===CellType.Block?1:0),0);
    if (blockCount >= 5){
      for (let c=0;c<COLS;c++){
        if (out[c] === CellType.Block && chance(0.55)) out[c] = CellType.Empty;
      }
    }
    return out;
  }

  function shiftRows(){
    for (let r=ROWS-1;r>=1;r--){
      grid[r] = grid[r-1];
      consumed[r] = consumed[r-1];
    }
    grid[0] = genRow(0);
    consumed[0] = new Array(COLS).fill(false);
  }

  // ───────────────────────── Speed ─────────────────────────
  function speedRowsPerSec(){
    const t = runTime;
    const start = 1.05;
    const byTime = 0.030 * t;
    const byLevel = 0.065 * (level - 1);

    let s = start + byTime + byLevel;
    if (startSlow && t < 12){
      s -= 0.35 * (1 - t/12);
    }
    s = clamp(s, 0.85, 6.25);
    return s;
  }

  // ───────────────────────── Score / combo / level ─────────────────────────
  function setPill(el, value){
    const pv = el.querySelector(".pv");
    if (pv) pv.textContent = value;
    else el.textContent = value;
  }

  function updatePills(){
    setPill(pillScore, String(score));
    setPill(pillBest, String(best));
    setPill(pillStreak, String(streak));
    setPill(pillMult, mult.toFixed(1));
    setPill(pillLevel, `Lv ${level}`);
    setPill(pillSpeed, `${speedRowsPerSec().toFixed(1)}x`);
    setPill(pillPlayer, playerName || "—");
  }

  function addScore(base, color="#fff"){
    const add = Math.round(base * mult);
    score += add;

    if (add !== 0 && settings.fx > 0.45){
      pops.push({
        x: offX + (playerCol + 0.5) * cellPx,
        y: offY + (playerAbsRow() + 0.5) * cellPx,
        text: (add>0?`+${add}`:`${add}`),
        t: 0,
        color,
      });
    }
  }

  function playerAbsRow(){
    return zoneY0 + Math.round(playerRowF);
  }

  function nextLevelThreshold(lv){
    return Math.round(180 + Math.pow(lv, 1.35) * 115);
  }

  function ensureCombo(){
    if (combo.length && now() < comboEndsAt) return;
    combo = COMBOS[randi(0, COMBOS.length-1)].slice();
    comboIdx = 0;
    comboEndsAt = now() + 18_000;
    renderCombo();
  }

  function renderCombo(){
    comboSeq.innerHTML = "";
    for (let i=0;i<combo.length;i++){
      const t = combo[i];
      const chip = document.createElement("span");
      chip.className = "comboChip" + (i < comboIdx ? " done" : (i===comboIdx ? " now" : ""));
      const dot = document.createElement("span");
      dot.className = "comboDot";
      dot.style.background = CELL_COLORS[t] || "#fff";
      const txt = document.createElement("span");
      txt.textContent = (t===CellType.Coin?"Coin":t===CellType.Gem?"Gem":t===CellType.Bonus?"BONUS":t===CellType.Trap?"Trap":"KO");
      chip.appendChild(dot);
      chip.appendChild(txt);
      comboSeq.appendChild(chip);
    }
    const secs = Math.max(0, Math.ceil((comboEndsAt - now())/1000));
    if (comboTimerVal) comboTimerVal.textContent = `${secs}s`;
    else comboTimer.textContent = `${secs}s`;
  }

  function comboOnCollect(type){
    if (!combo.length) return;

    if (type === combo[comboIdx]){
      comboIdx++;
      renderCombo();

      if (comboIdx >= combo.length){
        const bonus = 120 + 30 * combo.length + 10 * streak;
        addScore(bonus, "#ffd35a");
        showToast(`COMBO +${Math.round(bonus*mult)}`, 900);

        multHold = Math.max(multHold, 3.5);
        mult = clamp(mult + 0.2, 1.0, 3.0);

        combo = [];
        comboIdx = 0;
        comboEndsAt = 0;
        ensureCombo();
      }
    } else if (type === CellType.Coin || type === CellType.Gem || type === CellType.Bonus){
      comboIdx = 0;
      renderCombo();
      showToast("Combo reiniciado", 650);
    }
  }

  // ───────────────────────── Upgrades (20+) ─────────────────────────
  const upgradeLv = {}; // id->level

  const UPGRADES = [
    { id:"zone_plus1", name:"+1 fila de movimiento", max:3, w: 1.0,
      desc:"Aumenta la altura de tu zona de movimiento.",
      apply(){ zoneExtra += 1; }
    },
    { id:"shield", name:"Escudo", max:6, w: 1.0,
      desc:"Ganas 1 escudo. Un KO consume 1 escudo en vez de morir.",
      apply(){ shields += 1; }
    },
    { id:"less_ko", name:"Menos KO", max:6, w: 0.9,
      desc:"Reduce ligeramente la probabilidad de KO.",
      apply(){ genBlockMul *= 0.90; }
    },
    { id:"more_good", name:"Más premios", max:6, w: 0.9,
      desc:"Aumenta la probabilidad de premios.",
      apply(){ genGoodMul *= 1.08; }
    },
    { id:"more_bonus", name:"Más BONUS", max:5, w: 0.8,
      desc:"Aumenta la probabilidad de BONUS.",
      apply(){ genBonusMul *= 1.15; }
    },
    { id:"slow_start", name:"Inicio más lento", max:2, w: 0.8,
      desc:"Arrancas más lento durante unos segundos.",
      apply(){ startSlow = true; }
    },
    { id:"reroll", name:"Reroll", max:2, w: 0.75,
      desc:"Permite rerollear mejoras (gana cargas al subir de nivel).",
      apply(){ rerollCharges += 1; }
    },
    { id:"density_up", name:"Más densidad", max:6, w: 0.6,
      desc:"Más casillas en general (más riesgo, más reward).",
      apply(){ genDensityMul *= 1.12; }
    },
    { id:"magnet1", name:"Imán +1", max:3, w: 0.85,
      desc:"Recoges también premios adyacentes (nivel aumenta alcance).",
      apply(){ magnetLv = clamp(magnetLv + 1, 0, 3); }
    },
    { id:"row_score", name:"+Puntos por avanzar", max:5, w: 0.9,
      desc:"Ganas más puntos por cada fila avanzando.",
      apply(){ flatScorePerRow += 1; }
    },
    { id:"mult_up", name:"Multiplicador base +0.1", max:10, w: 0.65,
      desc:"Aumenta tu multiplicador base un poco.",
      apply(){ mult = clamp(mult + 0.1, 1.0, 3.0); }
    },
    { id:"trap_soft", name:"Trampas menos duras", max:4, w: 0.85,
      desc:"Reduce la penalización de trampas.",
      apply(){ /* runtime */ }
    },
    { id:"combo_bonus", name:"Bonus de combo +", max:5, w: 0.8,
      desc:"Los combos dan más puntos.",
      apply(){ /* runtime */ }
    },
    { id:"streak_guard", name:"Racha protegida", max:2, w: 0.6,
      desc:"Las trampas no rompen la racha (a veces).",
      apply(){ /* runtime */ }
    },
    { id:"double_time", name:"X2 temporal", max:6, w: 0.7,
      desc:"Al subir de nivel, ganas un X2 durante unos segundos.",
      apply(){ /* runtime */ }
    },
    { id:"score_burst", name:"Burst de puntos", max:5, w: 0.65,
      desc:"Al coger BONUS, estalla puntos extra.",
      apply(){ /* runtime */ }
    },
    { id:"anti_ko", name:"Anti-KO (1 vez)", max:2, w: 0.55,
      desc:"La primera vez que tocarías KO, sobrevives y limpias la casilla.",
      apply(){ /* runtime */ }
    },
    { id:"smooth_move", name:"Movimiento más suave", max:2, w: 0.8,
      desc:"Aumenta la suavidad/velocidad de ajuste del player.",
      apply(){ /* runtime */ }
    },
    { id:"combo_time", name:"Más tiempo de combo", max:3, w: 0.8,
      desc:"Los combos duran más antes de cambiar.",
      apply(){ /* runtime */ }
    },
    { id:"lucky", name:"Suerte", max:4, w: 0.75,
      desc:"Mejora ligeramente la calidad de premios (más gem/bonus).",
      apply(){ /* runtime */ }
    },
    { id:"fade_clarity", name:"Claridad", max:1, w: 0.7,
      desc:"Mejora la lectura: casillas consumidas más apagadas.",
      apply(){ /* runtime */ }
    },
  ];

  function getUpLv(id){ return upgradeLv[id] || 0; }
  function canTake(u){ return getUpLv(u.id) < u.max; }

  function pickChoices(n=3){
    const pool = UPGRADES.filter(canTake);
    if (pool.length === 0) return [];

    const out = [];
    const taken = new Set();
    for (let i=0;i<n;i++){
      let totalW = 0;
      for (const u of pool) if (!taken.has(u.id)) totalW += (u.w || 1);
      if (totalW <= 0) break;

      let roll = Math.random() * totalW;
      let chosen = null;
      for (const u of pool){
        if (taken.has(u.id)) continue;
        roll -= (u.w || 1);
        if (roll <= 0){ chosen = u; break; }
      }
      if (!chosen) chosen = pool[0];
      taken.add(chosen.id);
      out.push(chosen);
    }
    return out;
  }

  let currentChoices = [];

  function openLevelUp(){
    inLevelUp = true;
    setPaused(true);

    upTitle.textContent = `Nivel ${level}`;
    upSub.textContent = "Elige 1 mejora";
    upgradeHint.textContent = "Las mejoras se acumulan. Algunas tienen límite.";

    showUpgradeChoices();
    overlayShow(overlayUpgrades);
  }

  function closeLevelUp(){
    overlayHide(overlayUpgrades);
    inLevelUp = false;
    setPaused(false);
  }

  function showUpgradeChoices(){
    currentChoices = pickChoices(3);
    upgradeChoices.innerHTML = "";

    for (const u of currentChoices){
      const lv = getUpLv(u.id);

      const card = document.createElement("div");
      card.className = "upCard";
      card.innerHTML = `
        <div class="upName">${u.name}</div>
        <div class="upDesc">${u.desc}</div>
        <div class="upMeta"><span>Nivel: ${lv}/${u.max}</span><span>+1</span></div>
      `;
      card.addEventListener("click", () => takeUpgrade(u));
      upgradeChoices.appendChild(card);
    }

    const rr = getUpLv("reroll");
    btnReroll.hidden = !(rr > 0);
    btnReroll.disabled = !(rr > 0 && rerollCharges > 0);

    btnSkipUpgrade.hidden = !(level >= 4);
  }

  function takeUpgrade(u){
    upgradeLv[u.id] = getUpLv(u.id) + 1;
    try{ u.apply(); } catch (e){ console.warn("upgrade apply failed", e); }

    showToast(`Mejora: ${u.name}`, 900);
    closeLevelUp();
  }

  function upgradeHas(id){ return getUpLv(id) > 0; }

  // ───────────────────────── Run lifecycle ─────────────────────────
  function recomputeZone(){
    zoneH = clamp(zoneRowsBase + zoneExtra, 3, 9);
    zoneY0 = Math.floor(ROWS/2) - Math.floor(zoneH/2);

    targetRowInZone = clamp(targetRowInZone, 0, zoneH-1);
    playerRowF = clamp(playerRowF, 0, zoneH-1);
  }

  function resetRun(toStartMenu=false){
    running = false;
    paused = false;
    gameOver = false;
    inLevelUp = false;

    score = 0;
    streak = 0;
    mult = 1.0;

    level = 1;
    nextLevelScore = nextLevelThreshold(level);

    genDensityMul = 1.0;
    genBlockMul = 1.0;
    genGoodMul = 1.0;
    genBonusMul = 1.0;
    startSlow = false;

    shields = 0;
    magnetLv = 0;
    flatScorePerRow = 1;
    multHold = 0;

    rerollCharges = 0;
    for (const k of Object.keys(upgradeLv)) delete upgradeLv[k];

    runTime = 0;
    scrollPx = 0;
    pops = [];

    zoneRowsBase = 3;
    zoneExtra = 0;
    recomputeZone();

    playerCol = Math.floor(COLS/2);
    playerRowInZone = Math.floor(zoneH/2);
    targetCol = playerCol;
    targetRowInZone = playerRowInZone;
    playerColF = playerCol;
    playerRowF = playerRowInZone;

    initGrid();
    ensureCombo();
    renderCombo();

    updatePills();
    draw();

    if (toStartMenu){
      overlayShow(overlayStart);
    }
  }

  function startRun(){
    overlayHide(overlayStart);
    overlayHide(overlayGameOver);
    overlayHide(overlayPaused);
    overlayHide(overlayOptions);
    overlayHide(overlayUpgrades);

    running = true;
    paused = false;
    gameOver = false;

    runTime = 0;
    scrollPx = 0;
    ensureCombo();

    updatePills();
    draw();
  }

  function endRun(){
    running = false;
    gameOver = true;
    paused = true;

    if (score > best){
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      Auth?.setBestForActive?.(best);
    }

    try{
      const raw = localStorage.getItem(RUNS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const entry = { ts: Date.now(), profileId: activeProfileId || null, name: playerName || "Anon", score, level };
      arr.unshift(entry);
      arr.length = Math.min(arr.length, 30);
      localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
    } catch {}

    goStats.textContent = `Score ${score} — Nivel ${level}`;
    overlayShow(overlayGameOver);

    if (pendingReload){
      pendingReload = false;
      requestAppReload();
    }
  }

  // ───────────────────────── Movement / input ─────────────────────────
  let moveSmoothK = 14.0;

  function move(dx, dy){
    if (!running || paused || gameOver || inLevelUp) return;

    targetCol = clamp(targetCol + dx, 0, COLS - 1);
    targetRowInZone = clamp(targetRowInZone + dy, 0, zoneH - 1);

    if (settings.vibration && navigator.vibrate){
      navigator.vibrate(10);
    }
  }

  function bindInputs(){
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);
      if (k === "Escape") togglePause();
    }, { passive:true });

    btnLeft.addEventListener("click", () => move(-1,0));
    btnRight.addEventListener("click", () => move(+1,0));
    btnUp.addEventListener("click", () => move(0,-1));
    btnDown.addEventListener("click", () => move(0,+1));

    let sx=0, sy=0, st=0, active=false;

    canvas.addEventListener("pointerdown", (e) => {
      if (!running || paused) return;
      active = true;
      sx = e.clientX;
      sy = e.clientY;
      st = now();
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!active) return;
      active = false;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dt = now() - st;

      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (dt < 600 && (adx > 22 || ady > 22)){
        if (adx > ady) move(dx > 0 ? +1 : -1, 0);
        else move(0, dy > 0 ? +1 : -1);
      }
    }, { passive:true });
  }

  // ───────────────────────── Apply cell effects ─────────────────────────
  let antiKoCharges = 0;

  function applyCell(type, r, c){
    if (type === CellType.Empty) return;

    // magnet: recoge premios cercanos
    if (magnetLv > 0 && (type === CellType.Coin || type === CellType.Gem || type === CellType.Bonus)){
      for (let rr = r - magnetLv; rr <= r + magnetLv; rr++){
        for (let cc = c - magnetLv; cc <= c + magnetLv; cc++){
          if (rr<0||rr>=ROWS||cc<0||cc>=COLS) continue;
          if (consumed[rr][cc]) continue;
          const t2 = grid[rr][cc];
          if (t2 === CellType.Coin || t2 === CellType.Gem || t2 === CellType.Bonus){
            consumed[rr][cc] = true;
            scoreForType(t2);
            comboOnCollect(t2);
          }
        }
      }
    }

    consumed[r][c] = true;

    if (type === CellType.Block){
      if (upgradeHas("anti_ko") && antiKoCharges < getUpLv("anti_ko")){
        antiKoCharges += 1;
        showToast("Anti-KO activado", 900);
        streak = Math.max(0, streak-1);
        return;
      }

      if (shields > 0){
        shields -= 1;
        showToast("Escudo -1", 900);
        streak = 0;
        return;
      }

      endRun();
      return;
    }

    if (type === CellType.Trap){
      const soft = getUpLv("trap_soft");
      const base = 25;
      const dmg = Math.round(base * (1 - 0.10 * soft));
      addScore(-dmg, "#ff7b2e");

      const guard = getUpLv("streak_guard");
      if (!(guard > 0 && chance(0.30 + 0.15*guard))){
        streak = 0;
      }

      if (settings.vibration && navigator.vibrate) navigator.vibrate([20, 40, 20]);
      return;
    }

    // good
    scoreForType(type);
    streak += 1;

    comboOnCollect(type);

    if (streak > 0 && streak % 10 === 0){
      addScore(40 + streak, "#ffd35a");
      showToast(`Racha ${streak}`, 900);
      mult = clamp(mult + 0.1, 1.0, 3.0);
    }
  }

  function scoreForType(type){
    if (type === CellType.Coin){
      addScore(10, "#2ee59d");
    } else if (type === CellType.Gem){
      addScore(30, "#69a8ff");
    } else if (type === CellType.Bonus){
      addScore(60, "#ffd35a");
      if (upgradeHas("score_burst")){
        const lv = getUpLv("score_burst");
        addScore(12*lv, "#ffd35a");
      }
    }
  }

  // ───────────────────────── Step / update ─────────────────────────
  function stepAdvance(){
    shiftRows();
    addScore(flatScorePerRow, "#a7a7b8");

    const r = playerAbsRow();
    const c = Math.round(playerColF);
    const t = grid[r][c];
    if (!consumed[r][c]) applyCell(t, r, c);

    if (!inLevelUp && score >= nextLevelScore){
      level += 1;
      nextLevelScore += nextLevelThreshold(level);

      if (upgradeHas("double_time")){
        multHold = Math.max(multHold, 3.0 + 0.9*getUpLv("double_time"));
        mult = clamp(mult + 0.2, 1.0, 3.0);
      }

      if (upgradeHas("reroll")){
        rerollCharges += 1;
      }

      recomputeZone();
      openLevelUp();
    }
  }

  function update(dt){
    if (toastTimer > 0){
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }

    if (combo.length){
      const secs = Math.max(0, Math.ceil((comboEndsAt - now())/1000));
      if (comboTimerVal) comboTimerVal.textContent = `${secs}s`;
      if (now() >= comboEndsAt){
        combo = [];
        comboIdx = 0;
        ensureCombo();
      }
    } else {
      ensureCombo();
    }

    bgHueTarget = 220 + clamp(streak, 0, 40) * 2.2;
    bgHue = lerp(bgHue, bgHueTarget, clamp(dt/900, 0.02, 0.18));
    document.documentElement.style.setProperty("--hue", String(Math.round(bgHue)));

    if (multHold > 0){
      multHold -= dt/1000;
      if (multHold <= 0){
        mult = clamp(mult - 0.2, 1.0, 3.0);
      }
    }

    const smoothLv = getUpLv("smooth_move");
    const k = moveSmoothK + 5*smoothLv;

    playerColF = lerp(playerColF, targetCol, clamp(dt/1000 * (k/12), 0.06, 0.35));
    playerRowF = lerp(playerRowF, targetRowInZone, clamp(dt/1000 * (k/12), 0.06, 0.35));

    runTime += dt/1000;
    const sp = speedRowsPerSec();
    scrollPx += (sp * cellPx) * (dt/1000);

    while (scrollPx >= cellPx && running && !paused && !gameOver && !inLevelUp){
      scrollPx -= cellPx;
      stepAdvance();
      ensureCombo();
    }

    for (let i=pops.length-1;i>=0;i--){
      pops[i].t += dt/1000;
      if (pops[i].t > 0.85) pops.splice(i,1);
    }

    updatePills();
  }

  // ───────────────────────── Draw ─────────────────────────
  function draw(){
    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);

    ctx.fillStyle = "#050507";
    ctx.fillRect(0,0,stageW,stageH);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(offX, offY, gridW, gridH);

    const zTop = offY + zoneY0 * cellPx;
    ctx.fillStyle = "rgba(105,168,255,0.08)";
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    const fadeStart = ROWS - 6;
    for (let r=0;r<ROWS;r++){
      const y = offY + r * cellPx + scrollPx;
      const fade = (r >= fadeStart) ? clamp(1 - (r - fadeStart) / 6, 0.25, 1) : 1;

      for (let c=0;c<COLS;c++){
        const x = offX + c * cellPx;
        const t = grid[r][c];
        if (t === CellType.Empty) continue;

        const used = consumed[r][c];
        const a = used ? 0.22 : 0.92;
        const alpha = a * fade;

        const key = (t===CellType.Coin?"coin":t===CellType.Gem?"gem":t===CellType.Bonus?"bonus":t===CellType.Trap?"trap":"block");
        const drawn = drawSprite(key, x+2, y+2, cellPx-4, cellPx-4, alpha);

        if (!drawn){
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(x+2, y+2, cellPx-4, cellPx-4);

          if (t === CellType.Block){
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x+3, y+3, cellPx-6, cellPx-6);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let c=0;c<=COLS;c++){
      const x = offX + c*cellPx;
      ctx.beginPath();
      ctx.moveTo(x, offY);
      ctx.lineTo(x, offY+gridH);
      ctx.stroke();
    }
    for (let r=0;r<=ROWS;r++){
      const y = offY + r*cellPx;
      ctx.beginPath();
      ctx.moveTo(offX, y);
      ctx.lineTo(offX+gridW, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // player
    const px = offX + playerColF*cellPx;
    const py = offY + (zoneY0 + playerRowF)*cellPx;
    const ok = drawSprite("player", px+2, py+2, cellPx-4, cellPx-4, 1);
    if (!ok){
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(px+2, py+2, cellPx-4, cellPx-4);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px+3, py+3, cellPx-6, cellPx-6);
    }

    if (shields > 0){
      ctx.fillStyle = "rgba(105,168,255,0.9)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx*0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), px + cellPx - 10, py + 12);
    }

    if (settings.fx > 0.45){
      for (const p of pops){
        const t = p.t;
        const a = clamp(1 - t/0.85, 0, 1);
        const y = p.y - t*28;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color || "#fff";
        ctx.font = `900 14px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, p.x, y);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  // ───────────────────────── Resize ─────────────────────────
  function resize(){
    const r = stage.getBoundingClientRect();
    stageW = Math.max(240, Math.floor(r.width));
    stageH = Math.max(240, Math.floor(r.height));

    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width  = Math.floor(stageW * dpr);
    canvas.height = Math.floor(stageH * dpr);

    cellPx = Math.floor(Math.min(stageW / COLS, stageH / ROWS));
    cellPx = clamp(cellPx, 14, 64);

    gridW = cellPx * COLS;
    gridH = cellPx * ROWS;

    offX = Math.floor((stageW - gridW) / 2);
    offY = Math.floor((stageH - gridH) / 2);

    draw();
  }

  // ───────────────────────── Buttons / UI ─────────────────────────
  function togglePause(){
    if (!running || gameOver) return;

    if (!paused){
      setPaused(true);
      overlayShow(overlayPaused);
    } else {
      overlayHide(overlayPaused);
      setPaused(false);
    }
  }

  function showOptions(){
    overlayShow(overlayOptions);
    setPaused(true);
  }

  function hideOptions(){
    overlayHide(overlayOptions);
    if (running && !gameOver && !inLevelUp) setPaused(false);
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;
  function frame(t){
    const dt = Math.min(40, t - lastT);
    lastT = t;

    if (running && !paused && !gameOver && !inLevelUp){
      update(dt);
    } else {
      // mantenemos UI viva (combo timer / toast)
      update(dt * 0.35);
    }

    draw();
    requestAnimationFrame(frame);
  }

  // ───────────────────────── Boot ─────────────────────────
  async function boot(){
    try{
      loadingSub.textContent = "Preparando UI";
      applySettingsToUI();

      // Auth
      syncFromAuth();
      initAuthUI();

      // UI
      bindInputs();
      resize();
      window.addEventListener("resize", resize, { passive:true });

      // Start run state
      resetRun(true);

      // Buttons
      btnPause.addEventListener("click", togglePause);
      btnRestart.addEventListener("click", () => { resetRun(false); startRun(); });
      btnOptions.addEventListener("click", showOptions);

      btnResume.addEventListener("click", () => { overlayHide(overlayPaused); setPaused(false); });
      btnQuitToStart.addEventListener("click", () => { overlayHide(overlayPaused); resetRun(true); });

      btnRetry.addEventListener("click", () => { resetRun(false); startRun(); });
      btnBackToStart.addEventListener("click", () => { resetRun(true); });

      btnCloseOptions.addEventListener("click", hideOptions);
      overlayOptions.addEventListener("click", (e) => { if (e.target === overlayOptions) hideOptions(); });

      optSprites.addEventListener("change", () => { settings.useSprites = !!optSprites.checked; saveSettings(); });
      optVibration.addEventListener("change", () => { settings.vibration = !!optVibration.checked; saveSettings(); });
      optDpad.addEventListener("change", () => { settings.showDpad = !!optDpad.checked; applySettingsToUI(); saveSettings(); });
      optFx.addEventListener("input", () => { settings.fx = clamp(parseFloat(optFx.value||"1"), 0.4, 1.25); optFxValue.textContent = settings.fx.toFixed(2); saveSettings(); });

      btnClearLocal.addEventListener("click", () => {
        const ok = confirm("¿Borrar datos locales? (Perfiles, settings, runs)");
        if (!ok) return;
        localStorage.clear();
        location.reload();
      });

      btnErrClose.addEventListener("click", () => overlayHide(overlayError));
      btnErrReload.addEventListener("click", () => location.reload());

      // Perfil pill abre menú directamente
      pillPlayer.addEventListener("click", () => { resetRun(true); });

      // Start button: perfiles
      btnStart.addEventListener("click", () => {
        if (Auth && profileSelect){
          if (profileSelect.value === "__new__"){
            const nm = (startName?.value || "").trim();
            const p = Auth.createProfile(nm);
            if (!p){
              showToast("Nombre demasiado corto", 900);
              return;
            }
            syncFromAuth();
            initAuthUI();
          } else {
            Auth.setActiveProfile(profileSelect.value);
            syncFromAuth();
          }
        } else {
          // fallback legacy
          const nm = (startName?.value || "").trim().slice(0,16);
          if (nm.length >= 2){
            playerName = nm;
            localStorage.setItem(NAME_KEY, playerName);
          }
        }

        updatePills();
        startRun();
      });

      // PWA + SW
      loadingSub.textContent = "Preparando PWA";
      setupPWA();

      // NO BLOQUEAR POR SPRITES
      loadingSub.textContent = "Preparando tablero";
      preloadSpritesWithTimeout(1400);

      // Loop arrancando ya (para que nunca “se congele”)
      lastT = performance.now();
      requestAnimationFrame(frame);

      // Watchdog: si algo va mal, desbloquea igualmente
      const watchdog = setTimeout(() => {
        if (!overlayLoading.hidden){
          overlayLoading.classList.add("leaving");
          setTimeout(() => { overlayHide(overlayLoading); overlayShow(overlayStart); }, 180);
        }
      }, 6500);

      // Splash mínimo (animación)
      await new Promise(res => setTimeout(res, 1200));
      clearTimeout(watchdog);

      overlayLoading.classList.add("leaving");
      setTimeout(() => {
        overlayHide(overlayLoading);
        overlayShow(overlayStart);
      }, 180);

      brandSub.textContent = "Listo";
      updatePills();
    } catch (e){
      console.error(e);
      overlayHide(overlayLoading);
      errMsg.textContent = (e && e.message) ? e.message : "Error desconocido";
      overlayShow(overlayError);
    }
  }

  boot();
})();
