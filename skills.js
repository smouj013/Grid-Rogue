/* skills.js — Grid Rogue v1.1.0
   Upgrades/Skills Pack + Discovery + Shop/Chest
   ✅ Integra con app.js vía window.GRSkills.create(api, pickedCount)
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
    common:    { label: "Común",      wMul: 1.00, priceMul: 1.00 },
    rare:      { label: "Rara",       wMul: 0.75, priceMul: 1.25 },
    epic:      { label: "Épica",      wMul: 0.45, priceMul: 1.55 },
    legendary: { label: "Legendaria", wMul: 0.22, priceMul: 2.10 },
  });

  function rarityMeta(r) { return RARITY[r] || RARITY.common; }

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

  function upgradeIcon(u) {
    const id = (u && u.id) ? String(u.id) : "";
    if (id.startsWith("shield")) return "shield";
    if (id.startsWith("heart") || id.startsWith("hp")) return "favorite";
    if (id.startsWith("regen")) return "healing";
    if (id.startsWith("revive") || id.includes("phoenix")) return "local_fire_department";
    if (id.startsWith("mag")) return "compass_calibration";
    if (id.startsWith("boost")) return "bolt";
    if (id.startsWith("trap")) return "verified_user";
    if (id.startsWith("zone")) return "open_with";
    if (id.startsWith("coin")) return "paid";
    if (id.startsWith("gem")) return "diamond";
    if (id.startsWith("bonus")) return "workspace_premium";
    if (id.startsWith("mult")) return "functions";
    if (id.startsWith("combo")) return "timer";
    if (id.startsWith("reroll")) return "casino";
    if (id.startsWith("key")) return "key";
    if (id.startsWith("shop")) return "storefront";
    if (id.startsWith("chest")) return "inventory_2";
    if (id.startsWith("step")) return "directions_walk";
    if (id.startsWith("block")) return "stop_circle";
    return "upgrade";
  }

  function create(api, pickedCount) {
    if (!api || typeof api !== "object") throw new Error("GRSkills.create(api, pickedCount): falta api");
    const picks = pickedCount instanceof Map ? pickedCount : new Map();
    const discovered = (api.discoveredSet instanceof Set) ? api.discoveredSet : new Set();
    const onDiscover = (typeof api.onDiscover === "function") ? api.onDiscover : null;

    function getPickCount(id) { return (picks.get(id) || 0) | 0; }
    function discover(id) {
      const k = String(id || "");
      if (!k) return;
      if (discovered.has(k)) return;
      discovered.add(k);
      try { onDiscover && onDiscover(k); } catch (_) {}
    }
    function isDiscovered(id) { return discovered.has(String(id || "")); }

    function mk(def) {
      const d = Object.assign({
        id: "",
        name: "",
        desc: "",
        tag: "General",
        rarity: "common",
        weight: 10,
        max: 999,
        unlockAt: 1,
        secret: false,
        price: 120,
        icon: "",
        apply: () => {},
      }, def || {});
      if (!d.icon) d.icon = upgradeIcon(d);
      return Object.freeze(d);
    }

    const _clamp = api.clamp || clamp;
    const _clampInt = api.clampInt || clampInt;

    const incInt = (key, delta, min, max) => {
      const v = (api[key] | 0) + (delta | 0);
      api[key] = _clampInt(v, (min ?? -999999) | 0, (max ?? 999999) | 0);
    };
    const incNum = (key, delta, min, max) => {
      const v = (Number(api[key]) || 0) + (Number(delta) || 0);
      api[key] = _clamp(v, (min ?? -1e9), (max ?? 1e9));
    };

    const Skills = [];
    const add = (d) => Skills.push(mk(d));

    add({ id:"shield_1", name:"Escudo +1", desc:"Ganas 1 escudo. Un escudo bloquea 1 KO.", tag:"Defensa",
      rarity:"common", weight:12, max:18, unlockAt:1, price:90,
      apply(){ incInt("shields", +1, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"shield_2", name:"Escudo +2", desc:"Ganas 2 escudos de golpe.", tag:"Defensa",
      rarity:"rare", weight:7, max:10, unlockAt:8, price:170,
      apply(){ incInt("shields", +2, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"shield_wall", name:"Muro Protector", desc:"Pasivo: al subir de nivel, ganas +1 escudo.", tag:"Defensa",
      rarity:"epic", weight:4, max:3, unlockAt:16, price:320,
      apply(){ incInt("shieldOnLevelUp", +1, 0, 6); api.updateStatusHUD?.(); } });

    add({ id:"block_resist_1", name:"Armadura Anti-KO", desc:"Si te comes un bloque sin escudos: en vez de KO, pierdes 2♥ (1 uso).", tag:"Defensa",
      rarity:"rare", weight:6, max:8, unlockAt:10, price:260,
      apply(){ incInt("blockResist", +1, 0, 99); api.updateStatusHUD?.(); } });

    add({ id:"block_resist_2", name:"Armadura Anti-KO II", desc:"Ganas 2 usos extra de Anti-KO.", tag:"Defensa",
      rarity:"epic", weight:3, max:6, unlockAt:22, price:420,
      apply(){ incInt("blockResist", +2, 0, 99); api.updateStatusHUD?.(); } });

    add({ id:"heart_1", name:"Corazón +1", desc:"+1 vida máxima y curas +1 ahora.", tag:"Supervivencia",
      rarity:"common", weight:11, max:14, unlockAt:1, price:120,
      apply(){
        const cap = (api.HP_CAP ?? 24) | 0;
        const start = (api.HP_START ?? 10) | 0;
        api.hpMax = _clampInt((api.hpMax|0)+1, start, cap);
        api.hp = _clampInt((api.hp|0)+1, 0, api.hpMax|0);
        api.updateStatusHUD?.();
      } });

    add({ id:"heart_2", name:"Dos Corazones", desc:"+2 vida máxima y curas +2.", tag:"Supervivencia",
      rarity:"rare", weight:6, max:8, unlockAt:12, price:240,
      apply(){
        const cap = (api.HP_CAP ?? 24) | 0;
        const start = (api.HP_START ?? 10) | 0;
        api.hpMax = _clampInt((api.hpMax|0)+2, start, cap);
        api.hp = _clampInt((api.hp|0)+2, 0, api.hpMax|0);
        api.updateStatusHUD?.();
      } });

    add({ id:"regen_1", name:"Regeneración I", desc:"Cada 18 pasos, curas +1 (si no estás al máximo).", tag:"Supervivencia",
      rarity:"common", weight:8, max:1, unlockAt:6, price:160,
      apply(){
        api.regenEvery = Math.min((api.regenEvery|0) || 18, 18);
        incInt("regenAmount", +1, 0, 6);
        api.updateStatusHUD?.();
      } });

    add({ id:"regen_2", name:"Regeneración II", desc:"Cada 12 pasos, curas +1.", tag:"Supervivencia",
      rarity:"rare", weight:5, max:1, unlockAt:14, price:260,
      apply(){
        const cur = (api.regenEvery|0) || 99;
        api.regenEvery = Math.min(cur, 12);
        incInt("regenAmount", +1, 0, 6);
        api.updateStatusHUD?.();
      } });

    add({ id:"regen_3", name:"Regeneración III", desc:"Cada 10 pasos, curas +2.", tag:"Supervivencia",
      rarity:"epic", weight:3, max:1, unlockAt:24, price:420,
      apply(){
        const cur = (api.regenEvery|0) || 99;
        api.regenEvery = Math.min(cur, 10);
        incInt("regenAmount", +2, 0, 8);
        api.updateStatusHUD?.();
      } });

    add({ id:"revive_phoenix", name:"Fénix", desc:"Te revive 1 vez cuando llegas a 0♥ (vuelves con 1♥).", tag:"Supervivencia",
      rarity:"legendary", weight:1.8, max:2, unlockAt:20, price:680, secret:true,
      apply(){ incInt("revives", +1, 0, 9); api.updateStatusHUD?.(); } });

    add({ id:"mag_1", name:"Imán I", desc:"Atrae recompensas cercanas (nivel 1). +12s.", tag:"QoL",
      rarity:"rare", weight:7, max:1, unlockAt:6, price:220,
      apply(){ api.magnet = Math.max(api.magnet|0, 1); incNum("magnetTime", +12, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"mag_2", name:"Imán II", desc:"Imán más fuerte (nivel 2). +18s.", tag:"QoL",
      rarity:"epic", weight:4, max:1, unlockAt:14, price:380,
      apply(){ api.magnet = Math.max(api.magnet|0, 2); incNum("magnetTime", +18, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"mag_3", name:"Imán III", desc:"Imán máximo (nivel 3). +26s.", tag:"QoL",
      rarity:"legendary", weight:2, max:1, unlockAt:22, price:620, secret:true,
      apply(){ api.magnet = Math.max(api.magnet|0, 3); incNum("magnetTime", +26, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"mag_time_1", name:"Batería de Imán", desc:"Añade +8s de duración al imán.", tag:"QoL",
      rarity:"common", weight:9, max:8, unlockAt:8, price:140,
      apply(){ incNum("magnetTime", +8, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"mag_time_2", name:"Batería XL", desc:"Añade +14s de duración al imán.", tag:"QoL",
      rarity:"rare", weight:6, max:6, unlockAt:16, price:240,
      apply(){ incNum("magnetTime", +14, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"trap_resist_1", name:"Resistencia a Trampas", desc:"Reduce el castigo de trampas (stack).", tag:"Defensa",
      rarity:"common", weight:10, max:6, unlockAt:1, price:120,
      apply(){ incInt("trapResist", +1, 0, 12); api.updateStatusHUD?.(); } });

    add({ id:"trap_heal", name:"Sangre Fría", desc:"20% de curarte +1♥ al pisar una trampa.", tag:"Supervivencia",
      rarity:"epic", weight:3.2, max:4, unlockAt:18, price:420, secret:true,
      apply(){ incNum("trapHealChance", +0.20, 0, 0.95); api.updateStatusHUD?.(); } });

    add({ id:"zone_1", name:"Zona +1", desc:"Tu zona de movimiento crece (+1).", tag:"Movilidad",
      rarity:"epic", weight:4, max:3, unlockAt:10, price:380,
      apply(){ incInt("zoneExtra", +1, 0, 9); api.recomputeZone?.(); api.updateStatusHUD?.(); } });

    add({ id:"zone_2", name:"Zona +2", desc:"Tu zona crece (+2).", tag:"Movilidad",
      rarity:"legendary", weight:1.8, max:2, unlockAt:22, price:700, secret:true,
      apply(){ incInt("zoneExtra", +2, 0, 9); api.recomputeZone?.(); api.updateStatusHUD?.(); } });

    add({ id:"boost_1", name:"Boost", desc:"+8% puntos (multiplica tus pickups).", tag:"Puntos",
      rarity:"common", weight:11, max:14, unlockAt:1, price:140,
      apply(){ incNum("scoreBoost", +0.08, 0, 10); api.updateStatusHUD?.(); } });

    add({ id:"boost_2", name:"Boost II", desc:"+14% puntos.", tag:"Puntos",
      rarity:"rare", weight:6.5, max:10, unlockAt:10, price:260,
      apply(){ incNum("scoreBoost", +0.14, 0, 10); api.updateStatusHUD?.(); } });

    add({ id:"coin_1", name:"Moneda +", desc:"+2 valor de Moneda.", tag:"Puntos",
      rarity:"common", weight:12, max:12, unlockAt:1, price:120,
      apply(){ incInt("coinValue", +2, 1, 9999); } });

    add({ id:"coin_2", name:"Moneda ++", desc:"+4 valor de Moneda.", tag:"Puntos",
      rarity:"rare", weight:7, max:10, unlockAt:10, price:240,
      apply(){ incInt("coinValue", +4, 1, 9999); } });

    add({ id:"gem_1", name:"Gema +", desc:"+6 valor de Gema.", tag:"Puntos",
      rarity:"rare", weight:8, max:10, unlockAt:6, price:220,
      apply(){ incInt("gemValue", +6, 1, 9999); } });

    add({ id:"gem_2", name:"Gema ++", desc:"+10 valor de Gema.", tag:"Puntos",
      rarity:"epic", weight:4.2, max:8, unlockAt:16, price:360,
      apply(){ incInt("gemValue", +10, 1, 9999); } });

    add({ id:"bonus_1", name:"Bonus +", desc:"+10 valor de Bonus.", tag:"Puntos",
      rarity:"rare", weight:8, max:10, unlockAt:6, price:220,
      apply(){ incInt("bonusValue", +10, 1, 9999); } });

    add({ id:"bonus_2", name:"Bonus ++", desc:"+18 valor de Bonus.", tag:"Puntos",
      rarity:"epic", weight:4.2, max:8, unlockAt:16, price:360,
      apply(){ incInt("bonusValue", +18, 1, 9999); } });

    add({ id:"step_score_1", name:"Paso Rentable", desc:"Cada paso da +1 punto extra.", tag:"Puntos",
      rarity:"common", weight:8, max:6, unlockAt:4, price:140,
      apply(){ incInt("stepScoreBonus", +1, 0, 40); } });

    add({ id:"step_score_2", name:"Paso Rentable II", desc:"Cada paso da +2 puntos extra.", tag:"Puntos",
      rarity:"rare", weight:5, max:6, unlockAt:12, price:260,
      apply(){ incInt("stepScoreBonus", +2, 0, 40); } });

    add({ id:"mult_1", name:"Multiplicador +", desc:"+0.10 al multiplicador base.", tag:"Combo",
      rarity:"epic", weight:5, max:10, unlockAt:8, price:360,
      apply(){ incNum("mult", +0.10, 1.0, 4.0); } });

    add({ id:"mult_2", name:"Multiplicador ++", desc:"+0.20 al multiplicador base.", tag:"Combo",
      rarity:"legendary", weight:2, max:6, unlockAt:18, price:720, secret:true,
      apply(){ incNum("mult", +0.20, 1.0, 4.0); } });

    add({ id:"combo_time_1", name:"Combo +Tiempo", desc:"+0.6s al tiempo de combo.", tag:"Combo",
      rarity:"common", weight:8, max:8, unlockAt:1, price:120,
      apply(){ incNum("comboTimeBonus", +0.6, 0, 9); } });

    add({ id:"combo_time_2", name:"Combo +Tiempo II", desc:"+1.0s al tiempo de combo.", tag:"Combo",
      rarity:"rare", weight:5.5, max:8, unlockAt:10, price:240,
      apply(){ incNum("comboTimeBonus", +1.0, 0, 9); } });

    add({ id:"combo_time_3", name:"Combo +Tiempo III", desc:"+1.4s al tiempo de combo.", tag:"Combo",
      rarity:"epic", weight:3.4, max:6, unlockAt:18, price:380,
      apply(){ incNum("comboTimeBonus", +1.4, 0, 12); } });

    add({ id:"reroll_1", name:"Reroll", desc:"Ganas 1 reroll para la pantalla de mejoras.", tag:"Upgrades",
      rarity:"rare", weight:7, max:8, unlockAt:6, price:220,
      apply(){ incInt("rerolls", +1, 0, 99); api.updateStatusHUD?.(); } });

    add({ id:"reroll_2", name:"Reroll x2", desc:"Ganas 2 rerolls.", tag:"Upgrades",
      rarity:"epic", weight:3.5, max:6, unlockAt:14, price:360,
      apply(){ incInt("rerolls", +2, 0, 99); api.updateStatusHUD?.(); } });

    add({ id:"extra_choice_1", name:"Elección Extra", desc:"En level-up aparecen +1 carta.", tag:"Upgrades",
      rarity:"rare", weight:4.8, max:3, unlockAt:10, price:320, secret:true,
      apply(){ incInt("extraUpgradeChoices", +1, 0, 4); } });

    add({ id:"key_1", name:"Llave +1", desc:"Ganas 1 llave (para cofres).", tag:"Llaves",
      rarity:"common", weight:8.5, max:18, unlockAt:4, price:160,
      apply(){ incInt("keys", +1, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"key_2", name:"Llaves +2", desc:"Ganas 2 llaves.", tag:"Llaves",
      rarity:"rare", weight:5.2, max:12, unlockAt:12, price:260,
      apply(){ incInt("keys", +2, 0, 999); api.updateStatusHUD?.(); } });

    add({ id:"shop_discount_1", name:"Descuento", desc:"-6% precios en tienda.", tag:"Tienda",
      rarity:"rare", weight:5, max:6, unlockAt:10, price:280,
      apply(){ incInt("shopDiscount", +1, 0, 12); } });

    add({ id:"shop_picks_1", name:"Tienda +Oferta", desc:"En tienda aparecen +1 oferta.", tag:"Tienda",
      rarity:"epic", weight:3.2, max:3, unlockAt:18, price:420, secret:true,
      apply(){ incInt("shopPicks", +1, 3, 7); } });

    add({ id:"chest_luck_1", name:"Suerte de Cofres", desc:"Mejor loot en cofres (bias a rare/epic).", tag:"Cofres",
      rarity:"rare", weight:4.8, max:6, unlockAt:12, price:280,
      apply(){ incInt("chestLuck", +1, 0, 12); } });

    add({ id:"chest_picks_1", name:"Cofre +Elección", desc:"En cofres aparecen +1 opción.", tag:"Cofres",
      rarity:"epic", weight:3.2, max:3, unlockAt:18, price:420, secret:true,
      apply(){ incInt("chestPicks", +1, 3, 7); } });

    const pack = (id, name, desc, key, delta, rarity, unlockAt, price, max, tag) => add({
      id, name, desc, tag: tag || "General",
      rarity, weight: (rarity === "legendary") ? 2 : (rarity === "epic") ? 4 : (rarity === "rare") ? 6 : 10,
      unlockAt, price, max,
      apply(){ incInt(key, delta, 0, 999); api.updateStatusHUD?.(); }
    });

    pack("shield_pack_3", "Caja de Escudos", "Ganas +3 escudos.", "shields", 3, "epic", 24, 520, 6, "Defensa");
    pack("key_pack_3", "Llaves +3", "Ganas +3 llaves.", "keys", 3, "epic", 22, 520, 8, "Llaves");
    pack("reroll_pack_3", "Reroll x3", "Ganas +3 rerolls.", "rerolls", 3, "legendary", 26, 740, 4, "Upgrades");

    add({ id:"boost_pack", name:"Turbo de Puntos", desc:"+25% puntos.", tag:"Puntos",
      rarity:"epic", weight:3.6, max:6, unlockAt:20, price:520, secret:true,
      apply(){ incNum("scoreBoost", +0.25, 0, 10); api.updateStatusHUD?.(); } });

    add({ id:"heart_pack_3", name:"Tres Corazones", desc:"+3 vida máxima y curas +3.", tag:"Supervivencia",
      rarity:"epic", weight:3.4, max:5, unlockAt:20, price:520, secret:true,
      apply(){
        const cap = (api.HP_CAP ?? 24) | 0;
        const start = (api.HP_START ?? 10) | 0;
        api.hpMax = _clampInt((api.hpMax|0)+3, start, cap);
        api.hp = _clampInt((api.hp|0)+3, 0, api.hpMax|0);
        api.updateStatusHUD?.();
      } });

    add({ id:"coin_pack_big", name:"Monedas Premium", desc:"+10 valor de Moneda.", tag:"Puntos",
      rarity:"epic", weight:3.2, max:6, unlockAt:22, price:520, secret:true,
      apply(){ incInt("coinValue", +10, 1, 9999); } });

    add({ id:"gem_pack_big", name:"Gemas Premium", desc:"+22 valor de Gema.", tag:"Puntos",
      rarity:"legendary", weight:1.8, max:5, unlockAt:26, price:820, secret:true,
      apply(){ incInt("gemValue", +22, 1, 9999); } });

    add({ id:"bonus_pack_big", name:"Bonus Premium", desc:"+34 valor de Bonus.", tag:"Puntos",
      rarity:"legendary", weight:1.8, max:5, unlockAt:26, price:820, secret:true,
      apply(){ incInt("bonusValue", +34, 1, 9999); } });

    add({ id:"combo_time_pack", name:"Tiempo de Combo XL", desc:"+2.5s al tiempo de combo.", tag:"Combo",
      rarity:"legendary", weight:1.7, max:4, unlockAt:24, price:780, secret:true,
      apply(){ incNum("comboTimeBonus", +2.5, 0, 14); } });

    function canPick(u) {
      const id = u.id;
      const max = (u.max ?? 999) | 0;
      if ((getPickCount(id) | 0) >= max) return false;

      if (id === "mag_1" && (api.magnet|0) >= 1) return false;
      if (id === "mag_2" && (api.magnet|0) >= 2) return false;
      if (id === "mag_3" && (api.magnet|0) >= 3) return false;

      const cap = (api.HP_CAP ?? 24) | 0;
      if (id.startsWith("heart") && (api.hpMax|0) >= cap) return false;

      return true;
    }

    function unlocked(u, level) { return (level | 0) >= ((u.unlockAt ?? 1) | 0); }

    function visibleInLevelUp(u, level) {
      if (!unlocked(u, level)) return false;
      if (!canPick(u)) return false;
      if (u.secret && !isDiscovered(u.id)) return false;
      return true;
    }

    function visibleInShop(u, level) {
      if (!unlocked(u, level)) return false;
      if (!canPick(u)) return false;
      return true;
    }

    function visibleInChest(u, level) {
      if (!unlocked(u, level)) return false;
      if (!canPick(u)) return false;
      return true;
    }

    function chestBiasMul(r, luck) {
      const L = clampInt(luck|0, 0, 12);
      if (r === "legendary") return 1.0 + 0.11 * L;
      if (r === "epic") return 1.0 + 0.08 * L;
      if (r === "rare") return 1.0 + 0.05 * L;
      return 1.0;
    }

    function choose(pool, n, weightFn) {
      const out = [];
      const p = pool.slice();
      for (let i = 0; i < (n|0); i++) {
        if (!p.length) break;
        const u = pickWeighted(p, weightFn);
        out.push(u);
        const idx = p.indexOf(u);
        if (idx >= 0) p.splice(idx, 1);
      }
      return out;
    }

    function chooseLevelUp({ level = 1, n = 3 } = {}) {
      const lvl = level | 0;
      const pool = Skills.filter(u => visibleInLevelUp(u, lvl));
      return choose(pool, n|0, (u) => {
        const pm = rarityMeta(u.rarity).wMul;
        const picked = getPickCount(u.id);
        const antiRepeat = 1.0 / (1.0 + picked * 0.35);
        return (Number(u.weight)||1) * pm * antiRepeat;
      });
    }

    function chooseShop({ level = 1, n = 3 } = {}) {
      const lvl = level | 0;
      const pool = Skills.filter(u => visibleInShop(u, lvl));
      return choose(pool, n|0, (u) => (Number(u.weight)||1) * rarityMeta(u.rarity).wMul);
    }

    function chooseChest({ level = 1, n = 3 } = {}) {
      const lvl = level | 0;
      const pool = Skills.filter(u => visibleInChest(u, lvl));
      const luck = api.chestLuck|0;
      return choose(pool, n|0, (u) => {
        const base = (Number(u.weight)||1) * rarityMeta(u.rarity).wMul;
        return base * chestBiasMul(u.rarity, luck);
      });
    }

    function price(u, level = 1) {
      const lvl = level | 0;
      const base = Math.max(40, Number(u.price) || 120);
      const rm = rarityMeta(u.rarity);
      const infl = 1.0 + clamp(lvl, 0, 60) * 0.032;
      const discSteps = clampInt(api.shopDiscount|0, 0, 12);
      const disc = 1.0 - discSteps * 0.06;
      const v = base * rm.priceMul * infl * disc;
      return Math.max(40, Math.round(v));
    }

    function pick(u) {
      if (!u || !u.id) return false;
      picks.set(u.id, getPickCount(u.id) + 1);
      discover(u.id);
      try { u.apply && u.apply(); } catch (_) {}
      return true;
    }

    function list() { return Skills.slice(); }

    function getCatalog({ discoveredOnly = false } = {}) {
      const out = [];
      for (const u of Skills) {
        const d = isDiscovered(u.id);
        if (discoveredOnly && !d) continue;
        out.push({
          id: u.id,
          name: u.name,
          desc: u.desc,
          tag: u.tag,
          rarity: u.rarity,
          secret: !!u.secret,
          unlockAt: u.unlockAt|0,
          max: u.max|0,
          icon: u.icon || upgradeIcon(u),
          picked: getPickCount(u.id),
          discovered: d,
        });
      }
      const rOrder = { common:0, rare:1, epic:2, legendary:3 };
      out.sort((a,b) => {
        if ((b.discovered|0) !== (a.discovered|0)) return (b.discovered|0)-(a.discovered|0);
        const ra = rOrder[a.rarity] ?? 0;
        const rb = rOrder[b.rarity] ?? 0;
        if (rb !== ra) return rb - ra;
        return String(a.name).localeCompare(String(b.name));
      });
      return out;
    }

    return Object.freeze({
      list,
      getCatalog,
      chooseLevelUp,
      chooseShop,
      chooseChest,
      price,
      pick,
      canPick,
      discover,
      isDiscovered,
      upgradeIcon,
      rarityMeta,
    });
  }

  try {
    g.GRSkills = Object.freeze({ create });
  } catch (_) {
    g.GRSkills = { create };
  }
})();
