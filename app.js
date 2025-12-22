/* app.js — Grid Runner PWA v0.1.0
   - Layout estable sin scroll (móvil/PC)
   - Loading mínimo 5s
   - Sin ranking (evita bloqueos por endpoint)
   - Upgrades roguelike (20+)
   - Overlays robustos (options ya no se queda pillado)
   - Auto-update SW (toast + reload seguro)
*/

(() => {
  "use strict";

  const APP_VERSION = String(window.APP_VERSION || "0.1.0");

  // ───────────────────────── Helpers ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const chance = (p) => (Math.random() < p);
  const now = () => performance.now();

  function must(id){
    const el = $(id);
    if (!el) throw new Error(`Falta elemento #${id} en index.html`);
    return el;
  }

  function sleep(ms){
    return new Promise(res => setTimeout(res, ms));
  }

  // ───────────────────────── DOM ─────────────────────────
  const canvas = must("game");
  const stage = must("stage");
  const ctx = canvas.getContext("2d", { alpha: false });

  // header pills
  const pillVersion = must("pillVersion");
  const pillOffline  = must("pillOffline");
  const pillUpdate   = must("pillUpdate");
  const pillScore    = must("pillScore");
  const pillBest     = must("pillBest");
  const pillStreak   = must("pillStreak");
  const pillMult     = must("pillMult");
  const pillLevel    = must("pillLevel");
  const pillSpeed    = must("pillSpeed");
  const pillPlayer   = must("pillPlayer");

  // buttons
  const btnOptions = must("btnOptions");
  const btnPause   = must("btnPause");
  const btnRestart = must("btnRestart");
  const btnInstall = must("btnInstall");

  // overlays
  const overlayLoading  = must("overlayLoading");
  const overlayStart    = must("overlayStart");
  const overlayPaused   = must("overlayPaused");
  const overlayUpgrades = must("overlayUpgrades");
  const overlayGameOver = must("overlayGameOver");
  const overlayOptions  = must("overlayOptions");
  const overlayError    = must("overlayError");

  // overlay controls
  const loadingText = must("loadingText");
  const loadingSub  = must("loadingSub");

  const startName = must("startName");
  const btnStart  = must("btnStart");
  const btnHow    = must("btnHow");
  const howText   = must("howText");

  const btnClosePause = must("btnClosePause");
  const btnResume     = must("btnResume");
  const btnQuit       = must("btnQuit");

  const upTitle      = must("upTitle");
  const upSub        = must("upSub");
  const upgradeChoices = must("upgradeChoices");
  const btnReroll    = must("btnReroll");
  const btnSkipUpgrade = must("btnSkipUpgrade");
  const upgradeHint  = must("upgradeHint");

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

  // in-stage HUD
  const comboSeq = must("comboSeq");
  const comboTimer = must("comboTimer");
  const comboHint = must("comboHint");
  const toast = must("toast");

  // dpad
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

  const CELL_LABEL = {
    [CellType.Coin]:  "+10",
    [CellType.Gem]:   "+30",
    [CellType.Bonus]: "+60",
    [CellType.Trap]:  "-25",
    [CellType.Block]: "KO",
  };

  // ───────────────────────── Runtime state ─────────────────────────
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

  let playerName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0,16);
  if (playerName.length < 2) playerName = "";

  let running = false;
  let paused = false;
  let gameOver = false;
  let inLevelUp = false;

  // grid data
  let grid = [];
  let consumed = []; // ya aplicado (gris/atenuado)

  // positioning / render
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

  // player position (en zona)
  let zoneRowsBase = 3;
  let zoneExtra = 0;
  let zoneY0 = 0;            // arranque de zona dentro del grid visible
  let zoneH = 3;

  let playerCol = 0;
  let playerRowInZone = 0;   // 0..zoneH-1
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

  // generation knobs (modificables por upgrades)
  let genDensityMul = 1.0;     // menos/más casillas en general
  let genBlockMul = 1.0;       // más/menos bloqueantes
  let genGoodMul = 1.0;        // más/menos premios
  let genBonusMul = 1.0;       // más/menos BONUS
  let startSlow = false;

  // survivability / specials
  let shields = 0;             // bloque KO consume shield
  let magnetLv = 0;            // recoge adyacentes
  let flatScorePerRow = 1;     // puntos por avanzar
  let multHold = 0;            // tiempo con mult temporal

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

  // particles (muy ligero)
  let pops = [];

  // sprites (opcionales)
  const sprites = {
    ready: false,
    img: null,
    map: {}, // key -> {x,y,w,h}
  };

  // ───────────────────────── Overlays ─────────────────────────
  function overlayShow(el){
    el.hidden = false;
  }
  function overlayHide(el){
    el.hidden = true;
  }
  function anyBlockingOverlayOpen(){
    return (!overlayStart.hidden || !overlayPaused.hidden || !overlayUpgrades.hidden || !overlayOptions.hidden || !overlayGameOver.hidden || !overlayError.hidden);
  }

  function setPaused(v){
    paused = !!v;
  }

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

  function setOfflinePill(){
    const offline = !navigator.onLine;
    pillOffline.hidden = !offline;
  }

  function requestAppReload(){
    // si estás jugando, no te reviento la run; dejo marcado y lo hago al KO/menú
    if (running && !gameOver){
      pendingReload = true;
      pillUpdate.hidden = false;
      pillUpdate.textContent = "Actualizar";
      showToast("Update listo (al terminar).", 1200);
      return;
    }
    location.reload();
  }

  async function setupPWA(){
    setOfflinePill();
    window.addEventListener("online", setOfflinePill, { passive:true });
    window.addEventListener("offline", setOfflinePill, { passive:true });

    // Install prompt (Chrome/Android)
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

    pillUpdate.addEventListener("click", () => {
      if (swReg && swReg.waiting){
        swReg.waiting.postMessage({ type:"SKIP_WAITING" });
      } else {
        requestAppReload();
      }
    });

    if ("serviceWorker" in navigator){
      try{
        const swUrl = new URL("./sw.js", location.href);
        swReg = await navigator.serviceWorker.register(swUrl, { scope: "./" });

        // checks periódicos
        setInterval(() => swReg.update().catch(()=>{}), 60_000);

        // si ya hay waiting
        if (swReg.waiting){
          pillUpdate.hidden = false;
        }

        swReg.addEventListener("updatefound", () => {
          const newWorker = swReg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed"){
              if (navigator.serviceWorker.controller){
                // hay update
                pillUpdate.hidden = false;
                showToast("Actualización disponible.", 1100);
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // nuevo SW controla la página => reload seguro
          requestAppReload();
        });
      } catch (e){
        console.warn("SW register failed:", e);
      }
    }
  }

  // ───────────────────────── Sprites optional ─────────────────────────
  async function preloadSprites(){
    // Opcional: sprite atlas en assets/sprites/atlas.png y assets/sprites/atlas.json
    // Si no existen, no pasa nada.
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

      const jsonRes = await fetch(jsonUrl, { cache: "no-store" }).catch(()=>null);
      if (!jsonRes || !jsonRes.ok) throw new Error("atlas.json missing");
      const map = await jsonRes.json();

      await imgPromise;

      sprites.img = img;
      sprites.map = map || {};
      sprites.ready = true;
    } catch {
      sprites.ready = false;
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

    // rellena con filas iniciales
    for (let r=0;r<ROWS;r++){
      grid[r] = genRow(r);
      consumed[r] = new Array(COLS).fill(false);
    }
  }

  function genRow(rowIndex){
    // Menos densidad para que no salgan “demasiados cuadrados”
    const baseDensity = 0.28; // base
    const density = clamp(baseDensity * genDensityMul, 0.12, 0.55);

    const out = new Array(COLS).fill(CellType.Empty);

    for (let c=0;c<COLS;c++){
      if (!chance(density)) continue;

      // weights
      const wGood = 0.62 * genGoodMul;
      const wTrap = 0.18;
      const wBlock = 0.20 * genBlockMul;

      const t = Math.random() * (wGood + wTrap + wBlock);
      let type = CellType.Coin;

      if (t < wGood){
        // good
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

    // “Garantía” suave: que no sea una fila totalmente llena de KO
    const blockCount = out.reduce((a,v)=>a+(v===CellType.Block?1:0),0);
    if (blockCount >= 5){
      for (let c=0;c<COLS;c++){
        if (out[c] === CellType.Block && chance(0.55)) out[c] = CellType.Empty;
      }
    }

    return out;
  }

  function shiftRows(){
    // baja todo
    for (let r=ROWS-1;r>=1;r--){
      grid[r] = grid[r-1];
      consumed[r] = consumed[r-1];
    }
    grid[0] = genRow(0);
    consumed[0] = new Array(COLS).fill(false);
  }

  // ───────────────────────── Speed ─────────────────────────
  function speedRowsPerSec(){
    // arranque suave + progresión
    const t = runTime;

    const start = 1.05;
    const byTime = 0.030 * t;             // sube con tiempo
    const byLevel = 0.065 * (level - 1);  // sube con nivel

    let s = start + byTime + byLevel;

    if (startSlow && t < 12){
      s -= 0.35 * (1 - t/12);
    }

    // cap para no volverse injugable
    s = clamp(s, 0.85, 6.25);
    return s;
  }

  // ───────────────────────── Score / combo / level ─────────────────────────
  function updatePills(){
    pillScore.textContent = `🏁 ${score}`;
    pillBest.textContent  = `🏆 ${best}`;
    pillStreak.textContent = `🔥 ${streak}`;
    pillMult.textContent = `✖️ ${mult.toFixed(1)}`;
    pillLevel.textContent = `⭐ Lv ${level}`;
    pillSpeed.textContent = `Vel ${speedRowsPerSec().toFixed(1)}×`;
    pillPlayer.textContent = `👤 ${playerName || "—"}`;
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
    // curva estable
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
    comboTimer.textContent = `⏳ ${secs}s`;
  }

  function comboOnCollect(type){
    if (!combo.length) return;

    if (type === combo[comboIdx]){
      comboIdx++;
      renderCombo();

      if (comboIdx >= combo.length){
        // combo completo
        const bonus = 120 + 30 * combo.length + 10 * streak;
        addScore(bonus, "#ffd35a");
        showToast(`COMBO +${Math.round(bonus*mult)} ✅`, 900);

        // mult temporal suave
        multHold = Math.max(multHold, 3.5);
        mult = clamp(mult + 0.2, 1.0, 3.0);

        combo = [];
        comboIdx = 0;
        comboEndsAt = 0;
        ensureCombo();
      }
    } else if (type === CellType.Coin || type === CellType.Gem || type === CellType.Bonus){
      // fallo de secuencia (solo si recoges algo “de combo”)
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
    { id:"reroll", name:"Reroll", max:3, w: 0.9,
      desc:"Ganas 1 reroll por nivel (para cambiar opciones).",
      apply(){ rerollCharges += 1; }
    },
    { id:"start_slow", name:"Arranque suave", max:1, w: 0.9,
      desc:"La velocidad sube aún más lento al principio.",
      apply(){ startSlow = true; }
    },
    { id:"less_blocks", name:"Menos KO", max:4, w: 1.0,
      desc:"Reduce la probabilidad de casillas bloqueantes.",
      apply(){ genBlockMul *= 0.88; }
    },
    { id:"more_good", name:"Más premios", max:5, w: 1.0,
      desc:"Aumenta la probabilidad de monedas/gemas.",
      apply(){ genGoodMul *= 1.12; }
    },
    { id:"more_bonus", name:"Más BONUS", max:4, w: 0.9,
      desc:"Aumenta la probabilidad de BONUS.",
      apply(){ genBonusMul *= 1.18; }
    },
    { id:"less_density", name:"Menos densidad", max:3, w: 0.8,
      desc:"Salen menos casillas en general (más limpio).",
      apply(){ genDensityMul *= 0.90; }
    },
    { id:"more_density", name:"Más densidad", max:2, w: 0.6,
      desc:"Salen más casillas (más riesgo/recompensa).",
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
      apply(){ /* se aplica en daño */ }
    },
    { id:"combo_bonus", name:"Bonus de combo +", max:5, w: 0.8,
      desc:"Los combos dan más puntos.",
      apply(){ /* se usa en cálculo */ }
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

    // selección ponderada sin repetir
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
        if (roll <= 0){
          chosen = u; break;
        }
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

    // recompensa: reroll se gasta aquí si procede
    showToast(`Mejora: ${u.name}`, 900);

    // cierre
    closeLevelUp();
  }

  function upgradeHas(id){ return getUpLv(id) > 0; }

  // ───────────────────────── Run lifecycle ─────────────────────────
  function recomputeZone(){
    zoneH = clamp(zoneRowsBase + zoneExtra, 3, 9);
    zoneY0 = Math.floor(ROWS/2) - Math.floor(zoneH/2);

    // clamp player inside
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
    }

    // guarda run local
    try{
      const raw = localStorage.getItem(RUNS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const entry = { ts: Date.now(), name: playerName || "Anon", score, level };
      arr.unshift(entry);
      arr.length = Math.min(arr.length, 30);
      localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
    } catch {}

    goStats.textContent = `Score ${score} — Nivel ${level}`;
    overlayShow(overlayGameOver);

    if (pendingReload){
      // ya es buen momento
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

    // pequeño feedback
    if (settings.vibration && navigator.vibrate){
      navigator.vibrate(10);
    }
  }

  function bindInputs(){
    // Keyboard
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") move(-1, 0);
      if (k === "ArrowRight" || k === "d" || k === "D") move(+1, 0);
      if (k === "ArrowUp" || k === "w" || k === "W") move(0, -1);
      if (k === "ArrowDown" || k === "s" || k === "S") move(0, +1);

      if (k === "Escape") togglePause();
    }, { passive:true });

    // Dpad
    btnLeft.addEventListener("click", () => move(-1,0));
    btnRight.addEventListener("click", () => move(+1,0));
    btnUp.addEventListener("click", () => move(0,-1));
    btnDown.addEventListener("click", () => move(0,+1));

    // Swipe on canvas
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
        if (adx > ady){
          move(dx > 0 ? +1 : -1, 0);
        } else {
          move(0, dy > 0 ? +1 : -1);
        }
      }
    }, { passive:true });
  }

  // ───────────────────────── Apply cell effects ─────────────────────────
  let antiKoCharges = 0;

  function applyCell(type, r, c){
    if (type === CellType.Empty) return;

    // magnet: recoge premios cercanos (solo premios)
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
      // anti KO upgrade
      if (upgradeHas("anti_ko") && antiKoCharges < getUpLv("anti_ko")){
        antiKoCharges += 1;
        showToast("Anti-KO ✅", 900);
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

      // ¿rompe racha?
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

    // combo
    comboOnCollect(type);

    // reward per streak (pequeñito)
    if (streak > 0 && streak % 10 === 0){
      addScore(40 + streak, "#ffd35a");
      showToast(`Racha ${streak} 🔥`, 900);
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

    // puntos por avanzar
    addScore(flatScorePerRow, "#a7a7b8");

    // aplica casilla debajo del player (en su fila actual)
    const r = playerAbsRow();
    const c = Math.round(playerColF);
    const t = grid[r][c];
    if (!consumed[r][c]) applyCell(t, r, c);

    // level-up check
    if (!inLevelUp && score >= nextLevelScore){
      level += 1;
      nextLevelScore += nextLevelThreshold(level);

      // upgrade que da X2 temporal al subir
      if (upgradeHas("double_time")){
        multHold = Math.max(multHold, 3.0 + 0.9*getUpLv("double_time"));
        mult = clamp(mult + 0.2, 1.0, 3.0);
      }

      // reroll gain
      if (upgradeHas("reroll")){
        rerollCharges += 1;
      }

      // recalcula zona si hay upgrades
      recomputeZone();

      openLevelUp();
    }
  }

  function update(dt){
    if (toastTimer > 0){
      toastTimer -= dt;
      if (toastTimer <= 0) hideToast();
    }

    // combo timer
    if (combo.length){
      const secs = Math.max(0, Math.ceil((comboEndsAt - now())/1000));
      comboTimer.textContent = `⏳ ${secs}s`;
      if (now() >= comboEndsAt){
        combo = [];
        comboIdx = 0;
        ensureCombo();
      }
    } else {
      ensureCombo();
    }

    // bg hue = racha
    bgHueTarget = 220 + clamp(streak, 0, 40) * 2.2;
    bgHue = lerp(bgHue, bgHueTarget, clamp(dt/900, 0.02, 0.18));
    document.documentElement.style.setProperty("--hue", String(Math.round(bgHue)));

    // mult temporal
    if (multHold > 0){
      multHold -= dt/1000;
      if (multHold <= 0){
        mult = clamp(mult - 0.2, 1.0, 3.0);
      }
    }

    // smooth player
    const smoothLv = getUpLv("smooth_move");
    const k = moveSmoothK + 5*smoothLv;

    playerColF = lerp(playerColF, targetCol, clamp(dt/1000 * (k/12), 0.06, 0.35));
    playerRowF = lerp(playerRowF, targetRowInZone, clamp(dt/1000 * (k/12), 0.06, 0.35));

    // scroll
    runTime += dt/1000;
    const sp = speedRowsPerSec();

    scrollPx += (sp * cellPx) * (dt/1000);

    while (scrollPx >= cellPx && running && !paused && !gameOver && !inLevelUp){
      scrollPx -= cellPx;
      stepAdvance();
      ensureCombo();
    }

    // pop numbers
    for (let i=pops.length-1;i>=0;i--){
      pops[i].t += dt/1000;
      if (pops[i].t > 0.85) pops.splice(i,1);
    }

    updatePills();
  }

  // ───────────────────────── Draw ─────────────────────────
  function draw(){
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);

    // fondo
    ctx.fillStyle = "#050507";
    ctx.fillRect(0,0,stageW,stageH);

    // grid frame background
    const pad = 0;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(offX-pad, offY-pad, gridW+pad*2, gridH+pad*2);

    // zona de movimiento (banda)
    const zTop = offY + zoneY0 * cellPx;
    ctx.fillStyle = "rgba(105,168,255,0.08)";
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    // cells
    const fadeStart = ROWS - 6;
    for (let r=0;r<ROWS;r++){
      const y = offY + r * cellPx + scrollPx; // scroll visual
      const fade = (r >= fadeStart) ? clamp(1 - (r - fadeStart) / 6, 0.25, 1) : 1;

      for (let c=0;c<COLS;c++){
        const x = offX + c * cellPx;
        const t = grid[r][c];
        if (t === CellType.Empty) continue;

        // consumed / passed
        const used = consumed[r][c];
        const a = used ? 0.22 : 0.92;
        const alpha = a * fade;

        // sprite key
        const key = (t===CellType.Coin?"coin":t===CellType.Gem?"gem":t===CellType.Bonus?"bonus":t===CellType.Trap?"trap":"block");

        const drawn = drawSprite(key, x+2, y+2, cellPx-4, cellPx-4, alpha);

        if (!drawn){
          // fallback color
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

    // grid lines (muy suave)
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
    const keyPlayer = "player";

    const ok = drawSprite(keyPlayer, px+2, py+2, cellPx-4, cellPx-4, 1);
    if (!ok){
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(px+2, py+2, cellPx-4, cellPx-4);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px+3, py+3, cellPx-6, cellPx-6);
    }

    // shield indicator
    if (shields > 0){
      ctx.fillStyle = "rgba(105,168,255,0.9)";
      ctx.font = `900 ${Math.max(11, Math.floor(cellPx*0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shields), px + cellPx - 10, py + 12);
    }

    // pop numbers
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

    // canvas internal size
    canvas.width  = Math.floor(stageW * dpr);
    canvas.height = Math.floor(stageH * dpr);

    // cellPx: maximiza el grid sin deformar
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

  function bindButtons(){
    // overlays: click outside panel closes (evita “bloqueado”)
    for (const ov of [overlayOptions, overlayPaused, overlayStart, overlayGameOver, overlayUpgrades]){
      ov.addEventListener("pointerdown", (e) => {
        if (e.target === ov){
          // cerrar solo si tiene sentido
          if (ov === overlayOptions) { overlayHide(overlayOptions); setPaused(false); }
          if (ov === overlayPaused)  { overlayHide(overlayPaused); setPaused(false); }
        }
      });
    }

    btnOptions.addEventListener("click", () => {
      if (!running || gameOver) return;
      setPaused(true);
      overlayShow(overlayOptions);
    });

    btnCloseOptions.addEventListener("click", () => {
      overlayHide(overlayOptions);
      if (running && !gameOver && !inLevelUp) setPaused(false);
    });

    btnPause.addEventListener("click", togglePause);

    btnClosePause.addEventListener("click", () => {
      overlayHide(overlayPaused);
      setPaused(false);
    });

    btnResume.addEventListener("click", () => {
      overlayHide(overlayPaused);
      setPaused(false);
    });

    btnQuit.addEventListener("click", () => {
      overlayHide(overlayPaused);
      resetRun(true);
    });

    btnRestart.addEventListener("click", () => {
      resetRun(false);
      startRun();
    });

    btnHow.addEventListener("click", () => {
      howText.hidden = !howText.hidden;
    });

    startName.addEventListener("input", () => {
      const nm = (startName.value || "").trim().slice(0, 16);
      btnStart.disabled = !(nm.length >= 2);
      pillPlayer.textContent = `👤 ${nm || playerName || "—"}`;
    });

    btnStart.addEventListener("click", () => {
      const nm = (startName.value || "").trim().slice(0, 16);
      if (nm.length < 2) return;
      playerName = nm;
      localStorage.setItem(NAME_KEY, nm);
      startRun();
    });

    btnRetry.addEventListener("click", () => {
      overlayHide(overlayGameOver);
      resetRun(false);
      startRun();
    });

    btnBackToStart.addEventListener("click", () => {
      overlayHide(overlayGameOver);
      resetRun(true);
    });

    btnReroll.addEventListener("click", () => {
      if (rerollCharges <= 0) return;
      rerollCharges -= 1;
      showUpgradeChoices();
      showToast("Reroll ✅", 700);
    });

    btnSkipUpgrade.addEventListener("click", () => {
      closeLevelUp();
    });

    optSprites.addEventListener("change", () => {
      settings.useSprites = !!optSprites.checked;
      saveSettings();
      draw();
    });

    optVibration.addEventListener("change", () => {
      settings.vibration = !!optVibration.checked;
      saveSettings();
    });

    optDpad.addEventListener("change", () => {
      settings.showDpad = !!optDpad.checked;
      saveSettings();
      applySettingsToUI();
    });

    optFx.addEventListener("input", () => {
      settings.fx = clamp(Number(optFx.value) || 1.0, 0.4, 1.25);
      optFxValue.textContent = settings.fx.toFixed(2);
      saveSettings();
    });

    btnClearLocal.addEventListener("click", () => {
      localStorage.removeItem(RUNS_KEY);
      localStorage.removeItem(BEST_KEY);
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      showToast("Datos borrados.", 900);
      location.reload();
    });

    btnErrClose.addEventListener("click", () => overlayHide(overlayError));
    btnErrReload.addEventListener("click", () => {
      try{
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(RUNS_KEY);
      } catch {}
      location.reload();
    });
  }

  // ───────────────────────── Main loop ─────────────────────────
  let lastT = 0;

  function loop(t){
    const dt = clamp(t - lastT, 0, 40);
    lastT = t;

    if (running && !paused && !gameOver && !inLevelUp){
      update(dt);
    } else {
      // aun actualizo cositas mínimas (combo timer / toast)
      if (toastTimer > 0){
        toastTimer -= dt;
        if (toastTimer <= 0) hideToast();
      }
      if (combo.length){
        const secs = Math.max(0, Math.ceil((comboEndsAt - now())/1000));
        comboTimer.textContent = `⏳ ${secs}s`;
      }
      updatePills();
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ───────────────────────── Boot (fluido + loading mínimo) ─────────────────────────
  async function boot(){
    try{
      if (!ctx){
        alert("Tu navegador no soporta Canvas 2D.");
        return;
      }

      applySettingsToUI();
      bindInputs();
      bindButtons();

      // listeners resize
      resize();
      window.addEventListener("resize", () => resize(), { passive:true });
      window.addEventListener("orientationchange", () => setTimeout(resize, 120), { passive:true });

      // PWA + SW update
      setupPWA();

      // loading mínimo
      overlayShow(overlayLoading);
      overlayHide(overlayStart);

      loadingText.textContent = "Cargando…";
      loadingSub.textContent = "Inicializando";

      const minLoading = sleep(5200);

      // opcional: precargar sprites (no bloquea juego si falla)
      const spritePromise = preloadSprites();

      // prepara run inicial (menú)
      resetRun(false);

      // espera mínimo + sprites
      await Promise.allSettled([minLoading, spritePromise]);

      overlayHide(overlayLoading);

      // start screen
      if (playerName.length >= 2){
        startName.value = playerName;
        btnStart.disabled = false;
      } else {
        startName.value = "";
        btnStart.disabled = true;
      }
      overlayShow(overlayStart);

      // iniciar loop
      lastT = now();
      requestAnimationFrame(loop);

      console.log(`Grid Runner v${APP_VERSION}`);
    } catch (e){
      console.error(e);
      errMsg.textContent = String(e?.message || e);
      overlayShow(overlayError);
    }
  }

  boot();
})();
