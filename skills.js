/* skills.js — Grid Rogue v1.0.0 (Upgrades/Skills Pack)
   ✅ Diseñado para integrarse con app.js vía window.GRSkills.create(api, pickedCount)
   - No depende de I18n (la UI/strings siguen en app.js)
   - Encapsula: catálogo de mejoras, pesos, límites, validación, elección, iconos y duraciones
*/
(() => {
  "use strict";

  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_SKILLSJS_LOADED_V1000";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};

  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  });

  // Duraciones base del imán (segundos)
  const MAGNET_DUR = Object.freeze({ rare: 12, epic: 18, legendary: 26 });

  function upgradeIcon(u) {
    const id = u?.id || "";
    if (id === "shield") return "shield";
    if (id === "heart") return "favorite";
    if (id.startsWith("mag")) return "compass_calibration";
    if (id === "boost") return "bolt";
    if (id === "trap") return "verified_user";
    if (id === "zone") return "open_with";
    if (id === "coin") return "paid";
    if (id === "gem") return "diamond";
    if (id === "bonus") return "workspace_premium";
    if (id === "reroll") return "casino";
    if (id === "mult") return "functions";
    return "upgrade";
  }

  function pickWeighted(pool) {
    let sum = 0;
    for (const u of pool) sum += Math.max(0.0001, Number(u.weight) || 1);
    let r = Math.random() * sum;
    for (const u of pool) {
      r -= Math.max(0.0001, Number(u.weight) || 1);
      if (r <= 0) return u;
    }
    return pool[pool.length - 1];
  }

  /**
   * Crea el sistema de skills/mejoras.
   * @param {object} api - API con getters/setters a las variables de app.js + helpers:
   *   - shields, magnet, magnetTime, scoreBoost, trapResist, zoneExtra, rerolls
   *   - coinValue, gemValue, bonusValue, mult, hp, hpMax
   *   - HP_START, HP_CAP
   *   - recomputeZone(), updateStatusHUD()
   *   - clamp(), clampInt() (opcionales)
   * @param {Map} pickedCount - Map compartido con app.js para contar picks por id.
   */
  function create(api, pickedCount) {
    if (!api || typeof api !== "object") throw new Error("GRSkills.create(api, pickedCount): falta api");

    const _clamp = api.clamp || clamp;
    const _clampInt = api.clampInt || clampInt;

    const picks = pickedCount instanceof Map ? pickedCount : new Map();

    // Catálogo base (puedes ampliar aquí sin tocar app.js)
    const Upgrades = [
      { id: "shield", nameKey: "up_shield_name", descKey: "up_shield_desc", tagKey: "tag_defense", max: 12, rarity: "common", weight: 10,
        apply() { api.shields = (api.shields | 0) + 1; api.updateStatusHUD?.(); } },

      { id: "heart", nameKey: "up_heart_name", descKey: "up_heart_desc", tagKey: "tag_survival", max: 10, rarity: "common", weight: 9,
        apply() {
          const cap = (api.HP_CAP ?? 24) | 0;
          const start = (api.HP_START ?? 10) | 0;
          api.hpMax = _clampInt((api.hpMax | 0) + 1, start, cap);
          api.hp = _clampInt((api.hp | 0) + 1, 0, api.hpMax | 0);
          api.updateStatusHUD?.();
        } },

      { id: "mag1", nameKey: "up_mag1_name", descKey: "up_mag1_desc", tagKey: "tag_qol", max: 1, rarity: "rare", weight: 7,
        apply() {
          api.magnet = Math.max(api.magnet | 0, 1);
          api.magnetTime = (Number(api.magnetTime) || 0) + MAGNET_DUR.rare;
          api.updateStatusHUD?.();
        } },
      { id: "mag2", nameKey: "up_mag2_name", descKey: "up_mag2_desc", tagKey: "tag_qol", max: 1, rarity: "epic", weight: 4,
        apply() {
          api.magnet = Math.max(api.magnet | 0, 2);
          api.magnetTime = (Number(api.magnetTime) || 0) + MAGNET_DUR.epic;
          api.updateStatusHUD?.();
        } },
      { id: "mag3", nameKey: "up_mag3_name", descKey: "up_mag3_desc", tagKey: "tag_qol", max: 1, rarity: "legendary", weight: 2,
        apply() {
          api.magnet = Math.max(api.magnet | 0, 3);
          api.magnetTime = (Number(api.magnetTime) || 0) + MAGNET_DUR.legendary;
          api.updateStatusHUD?.();
        } },

      { id: "boost", nameKey: "up_boost_name", descKey: "up_boost_desc", tagKey: "tag_points", max: 10, rarity: "common", weight: 10,
        apply() { api.scoreBoost = (Number(api.scoreBoost) || 0) + 0.08; api.updateStatusHUD?.(); } },

      { id: "trap", nameKey: "up_trap_name", descKey: "up_trap_desc", tagKey: "tag_defense", max: 4, rarity: "common", weight: 9,
        apply() { api.trapResist = (api.trapResist | 0) + 1; api.updateStatusHUD?.(); } },

      { id: "zone", nameKey: "up_zone_name", descKey: "up_zone_desc", tagKey: "tag_mobility", max: 3, rarity: "epic", weight: 4,
        apply() {
          api.zoneExtra = (api.zoneExtra | 0) + 1;
          api.recomputeZone?.();
          api.updateStatusHUD?.();
        } },

      { id: "coin", nameKey: "up_coin_name", descKey: "up_coin_desc", tagKey: "tag_points", max: 8, rarity: "common", weight: 10,
        apply() { api.coinValue = (api.coinValue | 0) + 2; } },

      { id: "gem", nameKey: "up_gem_name", descKey: "up_gem_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7,
        apply() { api.gemValue = (api.gemValue | 0) + 6; } },

      { id: "bonus", nameKey: "up_bonus_name", descKey: "up_bonus_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7,
        apply() { api.bonusValue = (api.bonusValue | 0) + 10; } },

      { id: "reroll", nameKey: "up_reroll_name", descKey: "up_reroll_desc", tagKey: "tag_upgrades", max: 5, rarity: "rare", weight: 6,
        apply() { api.rerolls = (api.rerolls | 0) + 1; api.updateStatusHUD?.(); } },

      { id: "mult", nameKey: "up_mult_name", descKey: "up_mult_desc", tagKey: "tag_combo", max: 10, rarity: "epic", weight: 5,
        apply() { api.mult = _clamp((Number(api.mult) || 1) + 0.10, 1.0, 4.0); } },
    ];

    function getPickCount(id) { return (picks.get(id) || 0) | 0; }

    function isUpgradeAllowed(u) {
      if (!u) return false;

      const max = (u.max ?? 999) | 0;
      if (getPickCount(u.id) >= max) return false;

      // Reglas especiales
      if (u.id === "mag1") return (api.magnet | 0) < 1;
      if (u.id === "mag2") return (api.magnet | 0) < 2;
      if (u.id === "mag3") return (api.magnet | 0) < 3;

      if (u.id === "heart") {
        const cap = (api.HP_CAP ?? 24) | 0;
        return (api.hpMax | 0) < cap;
      }

      return true;
    }

    function markPick(u) {
      if (!u) return;
      picks.set(u.id, getPickCount(u.id) + 1);
    }

    function chooseUpgrades(n = 3) {
      const pool = Upgrades.filter(isUpgradeAllowed);
      const out = [];
      for (let i = 0; i < n; i++) {
        if (!pool.length) break;
        const u = pickWeighted(pool);
        const idx = pool.indexOf(u);
        if (idx >= 0) pool.splice(idx, 1);
        out.push(u);
      }
      return out;
    }

    function addUpgrade(def) {
      if (!def || !def.id) return false;
      Upgrades.push(def);
      return true;
    }

    function resetPicks() { picks.clear(); }

    return Object.freeze({
      MAGNET_DUR,
      Upgrades,
      upgradeIcon,
      isUpgradeAllowed,
      chooseUpgrades,
      markPick,
      getPickCount,
      addUpgrade,
      resetPicks,
      pickedCount: picks,
    });
  }

  g.GRSkills = g.GRSkills || {};
  g.GRSkills.VERSION = "1.0.0";
  g.GRSkills.create = create;
})();
