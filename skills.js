/* skills.js — Grid Rogue v1.1.0 (Upgrades/Skills Pack + DISCOVERY + SHOP/CHEST)
   ✅ Integra con app.js vía window.GRSkills.create(api, pickedCount)
   - No depende de I18n (incluye fallback name/desc embebidos)
   - Encapsula: catálogo (60+), rarezas, pesos, límites, unlock por nivel, discovery,
     selección (level-up), tienda (shop picks + precios) y cofres (chest rolls).
*/
(() => {
  "use strict";

  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_SKILLSJS_LOADED_V1100";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};

  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  });

  const RARITY = Object.freeze({
    common:    { label: "Común",      wMul: 1.00, priceMul: 1.00, hue: 205 },
    rare:      { label: "Rara",       wMul: 0.75, priceMul: 1.25, hue: 195 },
    epic:      { label: "Épica",      wMul: 0.45, priceMul: 1.55, hue: 285 },
    legendary: { label: "Legendaria", wMul: 0.22, priceMul: 2.10, hue:  40 },
  });

  // Duraciones base del imán (segundos)
  const MAGNET_DUR = Object.freeze({ rare: 12, epic: 18, legendary: 26 });

  function rarityMeta(r) { return RARITY[r] || RARITY.common; }

  function upgradeIcon(u) {
    const id = (u && u.id) ? String(u.id) : "";
    if (id === "shield" || id.startsWith("shield_")) return "shield";
    if (id === "heart" || id.startsWith("heart_")) return "favorite";
    if (id.startsWith("mag")) return "compass_calibration";
    if (id.startsWith("boost")) return "bolt";
    if (id.startsWith("trap") || id.includes("armor") || id.includes("resist")) return "verified_user";
    if (id.startsWith("zone") || id.includes("radius") || id.includes("reach")) return "open_with";
    if (id.startsWith("coin") || id.includes("gold")) return "paid";
    if (id.startsWith("gem")) return "diamond";
    if (id.startsWith("bonus")) return "workspace_premium";
    if (id.startsWith("reroll")) return "casino";
    if (id.startsWith("mult") || id.includes("combo")) return "functions";
    if (id.startsWith("key") || id.includes("lock")) return "key";
    if (id.startsWith("chest") || id.includes("treasure")) return "inventory_2";
    if (id.startsWith("shop") || id.includes("market")) return "storefront";
    if (id.startsWith("xp") || id.includes("level")) return "stars";
    if (id.includes("revive") || id.includes("phoenix")) return "local_fire_department";
    if (id.includes("step")) return "directions_walk";
    return "upgrade";
  }

  function pickWeighted(pool, weightFn) {
    let sum = 0;
    for (const u of pool) sum += Math.max(0.0001, Number(weightFn ? weightFn(u) : u.weight) || 1);
    let r = Math.random() * sum;
    for (const u of pool) {
      r -= Math.max(0.0001, Number(weightFn ? weightFn(u) : u.weight) || 1);
      if (r <= 0) return u;
    }
    return pool[pool.length - 1];
  }

  function create(api, pickedCount) {
    if (!api || typeof api !== "object") throw new Error("GRSkills.create(api, pickedCount): falta api");

    const _clamp = api.clamp || clamp;
    const _clampInt = api.clampInt || clampInt;

    const picks = pickedCount instanceof Map ? pickedCount : new Map();

    // discoverySet: Set compartido desde app.js (por perfil)
    const discovered = (api.discoveredSet instanceof Set) ? api.discoveredSet : new Set();

    function getPickCount(id) { return (picks.get(id) || 0) | 0; }
    function markPick(u) { if (u && u.id) picks.set(u.id, getPickCount(u.id) + 1); }
    function isDiscovered(id) { return discovered.has(id); }
    function discover(id) { if (id) discovered.add(String(id)); }

    function mk(def) {
      const d = Object.assign({
        id: "",
        nameKey: "",
        descKey: "",
        name: "",
        desc: "",
        tag: "General",
        rarity: "common",
        weight: 10,
        max: 999,
        unlockAt: 1,
        secret: false, // si true: no sale en level-up hasta descubrirse (cofre/tienda)
        price: 120,
        apply: () => {},
      }, def || {});
      return Object.freeze(d);
    }

    const Upgrades = [];

    // ───────────────────────────────── Helpers de stats ─────────────────────────────────
    const incInt = (key, delta, min, max) => {
      const v = (api[key] | 0) + (delta | 0);
      api[key] = _clampInt(v, (min ?? -999999) | 0, (max ?? 999999) | 0);
    };

    const incNum = (key, delta, min, max) => {
      const v = (Number(api[key]) || 0) + (Number(delta) || 0);
      api[key] = _clamp(v, (min ?? -1e9), (max ?? 1e9));
    };

    const addSkill = (def) => { Upgrades.push(mk(def)); };

    // ───────────────────────────────── Skills (60+) ─────────────────────────────────
    // Defensa / HP
    addSkill({ id:"shield", name:"Escudo +1", desc:"Ganas 1 escudo. Un escudo bloquea 1 golpe.", tag:"Defensa",
      rarity:"common", weight:12, max:16, unlockAt:1, price:90,
      apply(){ incInt("shields", +1, 0, 999); api.updateStatusHUD?.(); } });

    addSkill({ id:"shield_pack", name:"Pack de Escudos", desc:"Ganas +2 escudos de golpe.", tag:"Defensa",
      rarity:"rare", weight:7, max:8, unlockAt:8, price:170,
      apply(){ incInt("shields", +2, 0, 999); api.updateStatusHUD?.(); } });

    addSkill({ id:"shield_wall", name:"Muro Protector", desc:"Tus escudos aguantan más: +1 escudo extra al subir de nivel (pasivo).", tag:"Defensa",
      rarity:"epic", weight:4, max:2, unlockAt:18, price:320,
      apply(){ incInt("shieldOnLevelUp", +1, 0, 5); api.updateStatusHUD?.(); } });

    addSkill({ id:"heart", name:"Corazón +1", desc:"+1 vida máxima y curas +1 ahora.", tag:"Supervivencia",
      rarity:"common", weight:11, max:12, unlockAt:1, price:120,
      apply(){
        const cap = (api.HP_CAP ?? 24) | 0;
        const start = (api.HP_START ?? 10) | 0;
        api.hpMax = _clampInt((api.hpMax|0)+1, start, cap);
        api.hp = _clampInt((api.hp|0)+1, 0, api.hpMax|0);
        api.updateStatusHUD?.();
      } });

    addSkill({ id:"heart_pack", name:"Dos Corazones", desc:"+2 vida máxima y curas +2.", tag:"Supervivencia",
      rarity:"rare", weight:6, max:6, unlockAt:12, price:240,
      apply(){
        const cap = (api.HP_CAP ?? 24) | 0;
        const start = (api.HP_START ?? 10) | 0;
        api.hpMax = _clampInt((api.hpMax|0)+2, start, cap);
        api.hp = _clampInt((api.hp|0)+2, 0, api.hpMax|0);
        api.updateStatusHUD?.();
      } });

    addSkill({ id:"regen_1", name:"Regeneración I", desc:"Cada 18 pasos, curas +1 (si no estás al máximo).", tag:"Supervivencia",
      rarity:"common", weight:8, max:1, unlockAt:6, price:160,
      apply(){ api.regenEvery = Math.min((api.regenEvery|0) || 18, 18); incInt("regenAmount", +1, 0, 5); api.updateStatusHUD?.(); } });

    addSkill({ id:"regen_2", name:"Regeneración II", desc:"Cada 12 pasos, curas +1.", tag:"Supervivencia",
      rarity:"rare", weight:5, max:1, unlockAt:14, price:260,
      apply(){ api.regenEvery = Math.min((api.regenEvery|0) || 18, 12); incInt("regenAmount", +1, 0, 5); api.updateStatusHUD?.(); } });

    addSkill({ id:"revive_1", name:"Última Oportunidad", desc:"1 resurrección por run (revives con 1 HP).", tag:"Supervivencia",
      rarity:"epic", weight:3, max:1, unlockAt:16, price:420,
      apply(){ incInt("revives", +1, 0, 3); api.updateStatusHUD?.(); } });

    addSkill({ id:"phoenix", name:"Fénix", desc:"Resurrección mejorada: al revivir, ganas +2 escudos.", tag:"Supervivencia",
      rarity:"legendary", weight:1.6, max:1, unlockAt:24, price:720,
      apply(){ incInt("reviveShieldBonus", +2, 0, 10); api.updateStatusHUD?.(); } });

    // Trampas / Mitigación
    addSkill({ id:"trap_resist_1", name:"Armadura I", desc:"+1 resistencia: más probabilidad de ignorar daño de trampa.", tag:"Defensa",
      rarity:"common", weight:10, max:6, unlockAt:2, price:110,
      apply(){ incInt("trapResist", +1, 0, 12); api.updateStatusHUD?.(); } });

    addSkill({ id:"trap_resist_2", name:"Armadura II", desc:"+2 resistencia.", tag:"Defensa",
      rarity:"rare", weight:6, max:3, unlockAt:10, price:220,
      apply(){ incInt("trapResist", +2, 0, 12); api.updateStatusHUD?.(); } });

    addSkill({ id:"trap_damage_down", name:"Botas Aislantes", desc:"Las trampas pegan -1 (mínimo 0).", tag:"Defensa",
      rarity:"epic", weight:3.5, max:1, unlockAt:20, price:390,
      apply(){ incInt("trapDamageDown", +1, 0, 1); api.updateStatusHUD?.(); } });

    addSkill({ id:"locksmith", name:"Cerrajero", desc:"Cofres cerrados ya no te quitan vida al chocar (siguen bloqueando).", tag:"Llaves/Cofres",
      rarity:"rare", weight:5, max:1, unlockAt:9, price:240,
      apply(){ api.lockedChestDamage = 0; api.updateStatusHUD?.(); } });

    // Magnet / Pickup
    addSkill({ id:"mag1", name:"Imán I", desc:"Activa Imán I y suma +12s de duración.", tag:"Calidad de vida",
      rarity:"rare", weight:7, max:1, unlockAt:4, price:220,
      apply(){
        api.magnet = Math.max(api.magnet|0, 1);
        api.magnetTime = (Number(api.magnetTime)||0) + MAGNET_DUR.rare * (Number(api.magnetGainMult)||1);
        api.updateStatusHUD?.();
      } });

    addSkill({ id:"mag2", name:"Imán II", desc:"Activa Imán II y suma +18s.", tag:"Calidad de vida",
      rarity:"epic", weight:4, max:1, unlockAt:12, price:380,
      apply(){
        api.magnet = Math.max(api.magnet|0, 2);
        api.magnetTime = (Number(api.magnetTime)||0) + MAGNET_DUR.epic * (Number(api.magnetGainMult)||1);
        api.updateStatusHUD?.();
      } });

    addSkill({ id:"mag3", name:"Imán III", desc:"Activa Imán III y suma +26s.", tag:"Calidad de vida",
      rarity:"legendary", weight:2, max:1, unlockAt:20, price:720,
      apply(){
        api.magnet = Math.max(api.magnet|0, 3);
        api.magnetTime = (Number(api.magnetTime)||0) + MAGNET_DUR.legendary * (Number(api.magnetGainMult)||1);
        api.updateStatusHUD?.();
      } });

    addSkill({ id:"mag_gain", name:"Batería Magnética", desc:"Las mejoras de imán duran +25% (ganancia).", tag:"Calidad de vida",
      rarity:"common", weight:7, max:3, unlockAt:7, price:150,
      apply(){ incNum("magnetGainMult", +0.25, 1.0, 2.5); api.updateStatusHUD?.(); } });

    addSkill({ id:"mag_drain", name:"Imán Eficiente", desc:"El imán se gasta -15% más lento.", tag:"Calidad de vida",
      rarity:"rare", weight:5, max:3, unlockAt:11, price:240,
      apply(){ incNum("magnetDrainMult", -0.15, 0.35, 1.0); api.updateStatusHUD?.(); } });

    addSkill({ id:"reach_1", name:"Alcance I", desc:"Recolectas 1 casilla más lejos (pasivo).", tag:"Movilidad",
      rarity:"common", weight:9, max:2, unlockAt:5, price:160,
      apply(){ incInt("pickupRadiusBase", +1, 0, 5); api.recomputeZone?.(); api.updateStatusHUD?.(); } });

    addSkill({ id:"reach_2", name:"Alcance II", desc:"Recolectas 2 casillas más lejos (pasivo).", tag:"Movilidad",
      rarity:"epic", weight:3, max:1, unlockAt:17, price:390,
      apply(){ incInt("pickupRadiusBase", +2, 0, 6); api.recomputeZone?.(); api.updateStatusHUD?.(); } });

    // Puntos / Economía
    addSkill({ id:"boost", name:"Puntos +", desc:"+8% puntos de todo lo que recolectas.", tag:"Puntos",
      rarity:"common", weight:12, max:10, unlockAt:1, price:110,
      apply(){ incNum("scoreBoost", +0.08, 0, 2.0); api.updateStatusHUD?.(); } });

    addSkill({ id:"boost_2", name:"Puntos ++", desc:"+12% puntos (mejorado).", tag:"Puntos",
      rarity:"rare", weight:6, max:6, unlockAt:10, price:220,
      apply(){ incNum("scoreBoost", +0.12, 0, 2.5); api.updateStatusHUD?.(); } });

    addSkill({ id:"step_score_1", name:"Pago por Paso", desc:"+1 punto cada paso.", tag:"Puntos",
      rarity:"common", weight:7, max:3, unlockAt:6, price:180,
      apply(){ incInt("stepScore", +1, 0, 10); } });

    addSkill({ id:"step_score_2", name:"Sueldo Doble", desc:"+2 puntos por paso.", tag:"Puntos",
      rarity:"epic", weight:3, max:1, unlockAt:18, price:420,
      apply(){ incInt("stepScore", +2, 0, 12); } });

    addSkill({ id:"coin", name:"Monedas +", desc:"+2 valor de moneda.", tag:"Puntos",
      rarity:"common", weight:12, max:10, unlockAt:1, price:110,
      apply(){ incInt("coinValue", +2, 0, 9999); } });

    addSkill({ id:"coin_2", name:"Monedas ++", desc:"+4 valor de moneda.", tag:"Puntos",
      rarity:"rare", weight:7, max:6, unlockAt:9, price:210,
      apply(){ incInt("coinValue", +4, 0, 9999); } });

    addSkill({ id:"gem", name:"Gemas +", desc:"+6 valor de gema.", tag:"Puntos",
      rarity:"rare", weight:8, max:8, unlockAt:3, price:190,
      apply(){ incInt("gemValue", +6, 0, 9999); } });

    addSkill({ id:"gem_2", name:"Gemas ++", desc:"+10 valor de gema.", tag:"Puntos",
      rarity:"epic", weight:4, max:5, unlockAt:12, price:340,
      apply(){ incInt("gemValue", +10, 0, 9999); } });

    addSkill({ id:"bonus", name:"Bonus +", desc:"+10 valor de bonus.", tag:"Puntos",
      rarity:"rare", weight:8, max:8, unlockAt:3, price:190,
      apply(){ incInt("bonusValue", +10, 0, 9999); } });

    addSkill({ id:"bonus_2", name:"Bonus ++", desc:"+18 valor de bonus.", tag:"Puntos",
      rarity:"epic", weight:4, max:4, unlockAt:14, price:360,
      apply(){ incInt("bonusValue", +18, 0, 9999); } });

    addSkill({ id:"golden_touch", name:"Toque Dorado", desc:"Las monedas tienen +20% de probabilidad de aparecer.", tag:"Puntos",
      rarity:"legendary", weight:1.7, max:1, unlockAt:22, price:780,
      apply(){ incNum("coinSpawnMult", +0.20, 1.0, 3.0); } });

    // Mult / Combo / XP
    addSkill({ id:"mult", name:"Multiplicador +", desc:"+0.10 al multiplicador base (hasta tu cap).", tag:"Combo",
      rarity:"epic", weight:5, max:10, unlockAt:5, price:260,
      apply(){ api.mult = _clamp((Number(api.mult)||1) + 0.10, 1.0, Number(api.multCap)||4.0); } });

    addSkill({ id:"mult_cap", name:"Cap de Mult +", desc:"+0.25 al cap del multiplicador (máx 6.0).", tag:"Combo",
      rarity:"rare", weight:6, max:8, unlockAt:7, price:230,
      apply(){ api.multCap = _clamp((Number(api.multCap)||4.0) + 0.25, 2.0, 6.0); api.updateStatusHUD?.(); } });

    addSkill({ id:"combo_time_1", name:"Combo Lento", desc:"+0.7s extra para completar secuencias.", tag:"Combo",
      rarity:"common", weight:9, max:4, unlockAt:2, price:140,
      apply(){ incNum("comboTimeBonus", +0.7, 0, 6); } });

    addSkill({ id:"combo_time_2", name:"Combo Maestro", desc:"+1.2s extra para combos.", tag:"Combo",
      rarity:"rare", weight:6, max:3, unlockAt:11, price:240,
      apply(){ incNum("comboTimeBonus", +1.2, 0, 8); } });

    addSkill({ id:"combo_shield", name:"Combo Protector", desc:"Al completar una secuencia, ganas +1 escudo.", tag:"Combo",
      rarity:"epic", weight:3.5, max:2, unlockAt:15, price:390,
      apply(){ incInt("comboShieldGain", +1, 0, 3); api.updateStatusHUD?.(); } });

    addSkill({ id:"xp_1", name:"XP +", desc:"+12% experiencia.", tag:"Progreso",
      rarity:"common", weight:9, max:5, unlockAt:1, price:130,
      apply(){ incNum("xpGainMult", +0.12, 1.0, 3.0); } });

    addSkill({ id:"xp_2", name:"XP ++", desc:"+20% experiencia.", tag:"Progreso",
      rarity:"rare", weight:6, max:4, unlockAt:8, price:230,
      apply(){ incNum("xpGainMult", +0.20, 1.0, 3.5); } });

    addSkill({ id:"xp_3", name:"Mentor", desc:"+35% experiencia.", tag:"Progreso",
      rarity:"epic", weight:3, max:2, unlockAt:16, price:420,
      apply(){ incNum("xpGainMult", +0.35, 1.0, 4.0); } });

    // Rerolls de level-up (no shop)
    addSkill({ id:"reroll", name:"Reroll +1", desc:"+1 reroll gratis en panel de upgrades.", tag:"Upgrades",
      rarity:"rare", weight:6, max:6, unlockAt:4, price:200,
      apply(){ incInt("rerolls", +1, 0, 99); api.updateStatusHUD?.(); } });

    addSkill({ id:"reroll_2", name:"Reroll +2", desc:"+2 rerolls.", tag:"Upgrades",
      rarity:"epic", weight:3, max:3, unlockAt:14, price:360,
      apply(){ incInt("rerolls", +2, 0, 99); api.updateStatusHUD?.(); } });

    // Llaves / Cofres / Tienda
    addSkill({ id:"key_start", name:"Llave Inicial", desc:"Empiezas cada run con +1 llave.", tag:"Llaves/Cofres",
      rarity:"common", weight:8, max:1, unlockAt:3, price:170,
      apply(){ incInt("startKeys", +1, 0, 3); api.updateStatusHUD?.(); } });

    addSkill({ id:"key_finder", name:"Buscador de Llaves", desc:"+20% probabilidad de que aparezca una llave.", tag:"Llaves/Cofres",
      rarity:"rare", weight:6, max:4, unlockAt:6, price:240,
      apply(){ incNum("keySpawnMult", +0.20, 1.0, 3.0); } });

    addSkill({ id:"spare_key", name:"Copia de Llave", desc:"25% de probabilidad de no gastar llave al abrir cofre.", tag:"Llaves/Cofres",
      rarity:"epic", weight:3.5, max:2, unlockAt:12, price:380,
      apply(){ incNum("spareKeyChance", +0.25, 0, 0.75); api.updateStatusHUD?.(); } });

    addSkill({ id:"chest_luck", name:"Suerte en Cofres", desc:"Mejora la calidad de recompensas de cofres.", tag:"Llaves/Cofres",
      rarity:"rare", weight:6, max:5, unlockAt:7, price:240,
      apply(){ incNum("chestQuality", +0.15, 0, 2.0); } });

    addSkill({ id:"chest_double", name:"Doble Botín", desc:"10% de probabilidad de que un cofre dé 2 recompensas.", tag:"Llaves/Cofres",
      rarity:"legendary", weight:1.4, max:1, unlockAt:21, price:820,
      apply(){ incNum("chestDoubleChance", +0.10, 0, 0.25); } });

    addSkill({ id:"treasure_map", name:"Mapa del Tesoro", desc:"+15% probabilidad de que aparezcan cofres.", tag:"Llaves/Cofres",
      rarity:"epic", weight:3.2, max:3, unlockAt:13, price:390,
      apply(){ incNum("chestSpawnMult", +0.15, 1.0, 3.0); } });

    addSkill({ id:"shop_discount", name:"Descuento I", desc:"La tienda es 10% más barata.", tag:"Tienda",
      rarity:"common", weight:8, max:4, unlockAt:4, price:180,
      apply(){ incNum("shopDiscount", +0.10, 0, 0.60); } });

    addSkill({ id:"shop_discount_2", name:"Descuento II", desc:"La tienda es 15% más barata.", tag:"Tienda",
      rarity:"rare", weight:6, max:3, unlockAt:11, price:260,
      apply(){ incNum("shopDiscount", +0.15, 0, 0.70); } });

    addSkill({ id:"shop_reroll_tamer", name:"Reroll Barato", desc:"El reroll de tienda escala más lento.", tag:"Tienda",
      rarity:"epic", weight:3.4, max:2, unlockAt:14, price:380,
      apply(){ incNum("shopRerollScaleDown", +0.12, 0, 0.40); } });

    addSkill({ id:"shop_coupon", name:"Cupón", desc:"La primera compra en cada tienda cuesta -60 puntos.", tag:"Tienda",
      rarity:"rare", weight:5.5, max:1, unlockAt:9, price:240,
      apply(){ incInt("shopCoupon", +60, 0, 120); } });

    addSkill({ id:"black_market", name:"Mercado Negro", desc:"Las tiendas tienen más probabilidad de ofrecer épicas/legendarias.", tag:"Tienda",
      rarity:"legendary", weight:1.3, max:1, unlockAt:23, price:860,
      apply(){ incNum("shopQuality", +0.30, 0, 1.5); } });

    addSkill({ id:"shop_spawn", name:"Calles Comerciales", desc:"+12% probabilidad de que aparezca una tienda.", tag:"Tienda",
      rarity:"epic", weight:3.2, max:3, unlockAt:15, price:380,
      apply(){ incNum("shopSpawnMult", +0.12, 1.0, 2.5); } });

    // Tiles / utilidades
    addSkill({ id:"block_breaker", name:"Rompe-Muros", desc:"Al chocar contra un bloque, 35% de romperlo (sin daño).", tag:"Utilidad",
      rarity:"rare", weight:6, max:3, unlockAt:8, price:250,
      apply(){ incNum("blockBreakChance", +0.35, 0, 0.90); } });

    addSkill({ id:"lucky_roll", name:"Suerte", desc:"Mejora levemente la aparición de tiles valiosos.", tag:"Utilidad",
      rarity:"common", weight:8, max:5, unlockAt:5, price:150,
      apply(){ incNum("valuableSpawnMult", +0.08, 1.0, 2.0); } });

    addSkill({ id:"mystery_ink", name:"Tinta Misteriosa", desc:"A veces verás una skill adelantada a tu nivel (descubrimiento).", tag:"Utilidad",
      rarity:"epic", weight:2.8, max:1, unlockAt:10, price:420,
      apply(){ incNum("mysterySkillChance", +0.10, 0, 0.25); } });

    // Secret skills (solo aparecen en cofre/tienda hasta descubrirse)
    addSkill({ id:"secret_1", name:"Prototipo: Turbo", desc:"+1 movimiento gratis cada 14 pasos (pasivo).", tag:"Secreto",
      rarity:"epic", weight:2.2, max:1, unlockAt:12, price:520, secret:true,
      apply(){ incInt("freeMoveEvery", +14, 0, 30); api.updateStatusHUD?.(); } });

    addSkill({ id:"secret_2", name:"Prototipo: Seguro", desc:"Cuando te quedas a 1 HP, ganas +2 escudos (1 vez por run).", tag:"Secreto",
      rarity:"legendary", weight:1.1, max:1, unlockAt:18, price:920, secret:true,
      apply(){ incInt("panicShield", +2, 0, 6); api.updateStatusHUD?.(); } });

    addSkill({ id:"secret_3", name:"Prototipo: Alquimia", desc:"10% de convertir BONUS en GEM al aparecer.", tag:"Secreto",
      rarity:"rare", weight:2.8, max:1, unlockAt:14, price:480, secret:true,
      apply(){ incNum("alchemyChance", +0.10, 0, 0.25); } });

    // Extra filler para llegar holgado a 60+ (variantes útiles)
    addSkill({ id:"shield_on_pick", name:"Refuerzo", desc:"Cada 8 recolectas, ganas +1 escudo.", tag:"Defensa",
      rarity:"epic", weight:3, max:2, unlockAt:19, price:420,
      apply(){ incInt("shieldEveryPicks", 8, 0, 12); api.updateStatusHUD?.(); } });

    addSkill({ id:"key_ring", name:"Llavero", desc:"Puedes llevar +2 llaves extra (no pierdes al recoger).", tag:"Llaves/Cofres",
      rarity:"common", weight:7, max:2, unlockAt:6, price:160,
      apply(){ incInt("keyCapBonus", +2, 0, 10); api.updateStatusHUD?.(); } });

    addSkill({ id:"chest_heal", name:"Cofre Curativo", desc:"Al abrir un cofre, curas +1 (si puedes).", tag:"Llaves/Cofres",
      rarity:"rare", weight:5.5, max:2, unlockAt:10, price:260,
      apply(){ incInt("chestHeal", +1, 0, 3); api.updateStatusHUD?.(); } });

    addSkill({ id:"shop_free_reroll", name:"Reroll Gratis", desc:"1 reroll gratis por tienda.", tag:"Tienda",
      rarity:"epic", weight:3.0, max:2, unlockAt:16, price:460,
      apply(){ incInt("shopFreeRerolls", +1, 0, 3); api.updateStatusHUD?.(); } });

    addSkill({ id:"combo_xp", name:"Aprendiz", desc:"Completar combos da +10% XP extra (stack).", tag:"Progreso",
      rarity:"rare", weight:5.5, max:5, unlockAt:7, price:240,
      apply(){ incNum("comboXpBonus", +0.10, 0, 1.0); } });

    addSkill({ id:"shop_saver", name:"Ahorro", desc:"Cada compra tiene 15% de devolver parte del coste (20%).", tag:"Tienda",
      rarity:"epic", weight:2.8, max:1, unlockAt:18, price:520,
      apply(){ incNum("shopCashbackChance", +0.15, 0, 0.35); incNum("shopCashbackPct", +0.20, 0, 0.35); } });

    // (Con esto ya superas 60 IDs sin problema)

    // ───────────────────────────────── Reglas / Allowed ─────────────────────────────────
    function isUpgradeAllowed(u, ctx) {
      if (!u || !u.id) return false;

      const level = (ctx && Number(ctx.level)) || (api.level | 0) || 1;

      // unlock por nivel
      if ((u.unlockAt | 0) > (level | 0)) return false;

      // secret: no sale en level-up hasta descubrirse (pero sí en shop/chest)
      if (u.secret && (ctx && ctx.source === "levelup") && !isDiscovered(u.id)) return false;

      const max = (u.max ?? 999) | 0;
      if (getPickCount(u.id) >= max) return false;

      // Reglas especiales (compat con tu antiguo pack)
      if (u.id === "mag1") return (api.magnet | 0) < 1;
      if (u.id === "mag2") return (api.magnet | 0) < 2;
      if (u.id === "mag3") return (api.magnet | 0) < 3;

      if (u.id === "heart" || u.id === "heart_pack") {
        const cap = (api.HP_CAP ?? 24) | 0;
        return (api.hpMax | 0) < cap;
      }

      return true;
    }

    function chooseUpgrades(n = 3, ctx = null) {
      const context = Object.assign({ source: "levelup", level: (api.level | 0) || 1 }, ctx || {});
      const pool = Upgrades.filter(u => isUpgradeAllowed(u, context));

      // Discovery “al azar”: intenta colar 1 skill no descubierta (si hay)
      const wantMystery = Math.random() < (Number(api.mysterySkillChance) || 0);
      const out = [];

      if (wantMystery) {
        const nd = pool.filter(u => !isDiscovered(u.id));
        if (nd.length) {
          const pick = pickWeighted(nd, u => (Number(u.weight) || 1) * rarityMeta(u.rarity).wMul);
          out.push(pick);
          const idx = pool.indexOf(pick);
          if (idx >= 0) pool.splice(idx, 1);
        }
      }

      while (out.length < n && pool.length) {
        const pick = pickWeighted(pool, u => (Number(u.weight) || 1) * rarityMeta(u.rarity).wMul);
        out.push(pick);
        const idx = pool.indexOf(pick);
        if (idx >= 0) pool.splice(idx, 1);
      }
      return out;
    }

    function computeShopPrice(u, ctx = null) {
      const level = (ctx && Number(ctx.level)) || (api.level | 0) || 1;
      const base = (u && Number(u.price)) || 120;
      const rm = rarityMeta(u && u.rarity);
      const levelMul = 1 + Math.min(1.2, (level - 1) * 0.035);
      const disc = clamp(Number(api.shopDiscount) || 0, 0, 0.80);
      const coupon = (ctx && ctx.coupon) ? (Number(ctx.coupon) || 0) : 0;
      const price = Math.max(25, Math.round((base * rm.priceMul * levelMul) * (1 - disc) - coupon));
      return price | 0;
    }

    function chooseShopItems(n = 3, ctx = null) {
      const context = Object.assign({ source: "shop", level: (api.level | 0) || 1 }, ctx || {});
      const pool = Upgrades.filter(u => isUpgradeAllowed(u, context));
      const out = [];
      for (let i = 0; i < n; i++) {
        if (!pool.length) break;
        // Shop “calidad”: empuja rarezas un poco si tienes shopQuality
        const shopQ = clamp(Number(api.shopQuality) || 0, 0, 1.5);
        const pick = pickWeighted(pool, u => {
          const rm = rarityMeta(u.rarity);
          const bias = 1 + (shopQ * (u.rarity === "rare" ? 0.35 : u.rarity === "epic" ? 0.65 : u.rarity === "legendary" ? 0.95 : 0));
          return (Number(u.weight) || 1) * rm.wMul * bias;
        });
        out.push(pick);
        const idx = pool.indexOf(pick);
        if (idx >= 0) pool.splice(idx, 1);
      }
      return out;
    }

    function rollChestReward(ctx = null) {
      const context = Object.assign({ source: "chest", level: (api.level | 0) || 1 }, ctx || {});
      const pool = Upgrades.filter(u => isUpgradeAllowed(u, context));

      // Chest “calidad”: empuja rarezas si chestQuality sube
      const cq = clamp(Number(api.chestQuality) || 0, 0, 2.0);
      const pick = pickWeighted(pool, u => {
        const rm = rarityMeta(u.rarity);
        const bias = 1 + (cq * (u.rarity === "rare" ? 0.30 : u.rarity === "epic" ? 0.55 : u.rarity === "legendary" ? 0.85 : 0));
        return (Number(u.weight) || 1) * rm.wMul * bias;
      });

      return pick || null;
    }

    function getCatalog() {
      return Upgrades.slice().sort((a, b) => {
        const la = (a.unlockAt | 0), lb = (b.unlockAt | 0);
        if (la !== lb) return la - lb;
        const ra = a.rarity, rb = b.rarity;
        const order = { common: 0, rare: 1, epic: 2, legendary: 3 };
        return (order[ra] ?? 0) - (order[rb] ?? 0);
      });
    }

    function addUpgrade(def) {
      if (!def || !def.id) return false;
      Upgrades.push(mk(def));
      return true;
    }

    function resetPicks() { picks.clear(); }

    return Object.freeze({
      VERSION: "1.1.0",
      RARITY,
      MAGNET_DUR,
      Upgrades,
      getCatalog,
      upgradeIcon,
      rarityMeta,
      isUpgradeAllowed,
      chooseUpgrades,
      chooseShopItems,
      computeShopPrice,
      rollChestReward,
      markPick,
      getPickCount,
      addUpgrade,
      resetPicks,
      pickedCount: picks,
      discoveredSet: discovered,
      discover,
      isDiscovered,
    });
  }

  g.GRSkills = g.GRSkills || {};
  g.GRSkills.VERSION = "1.1.0";
  g.GRSkills.create = create;
})();
