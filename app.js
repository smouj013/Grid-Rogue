/* app.js — Grid Runner (PWA) v0.1.7 STABLE+FULLSCREEN + AUDIO + I18N
   - v0.1.7:
     ✅ Opciones: panel con scroll seguro (si no cabe, siempre podrás bajar/subir)
     ✅ Estética: fondos/overlays más “juicy” (gradientes, bordes, glow) vía CSS inyectado (no rompe tu styles.css)
     ✅ Upgrades: overlay mucho mejor centrado + layout consistente (no 2 arriba y 1 abajo)
     ✅ Upgrades: rarezas (Común/Rara/Épica/Legendaria) con color + badge
     ✅ Upgrades: confetti/partículas de fondo al aparecer el panel de mejoras
     ✅ Upgrades: evita upgrades “inferiores” si ya tienes uno superior (ej: imanes)
     ✅ Feedback en juego: brillo/juice extra en tiles según upgrades (valores/boost/mult)
   - Música: HTMLAudio (nativo) + duck por volumen
   - SFX: WebAudio buffers + fallback procedural
   - Unlock móvil/iOS: audio se activa con el primer gesto
*/

(() => {
  "use strict";

  const APP_VERSION = String(window.APP_VERSION || "0.1.7");
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

  // ───────────────────────── I18N ─────────────────────────
  const I18n = (() => {
    const normalize = (raw) => {
      const s = String(raw || "").toLowerCase().trim();
      if (!s || s === "auto") return "auto";
      const base = s.split("-")[0];
      if (base === "pt") return "pt";
      if (base === "ca") return "ca";
      return base;
    };

    const dict = {
      es: {
        langName: "Español",
        defaultPlayer: "Jugador",
        app_ready: "Listo",
        app_loading: "Iniciando…",
        app_pwa: "PWA…",
        audio_ok: "Audio OK",
        update_apply_end: "Update listo: se aplicará al terminar.",
        update_available: "Actualización disponible.",
        update_apply_end_short: "Se aplicará al terminar.",
        pill_update: "Actualizar",
        toast_trap: "Trampa",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Mejora: {0}",
        toast_reroll: "Reroll",
        toast_skip: "Saltar",
        toast_shield_saved: "El escudo salvó un KO",
        name_min: "Nombre mínimo 2 letras",
        combo_hint: "Completa la secuencia para subir multiplicador.",
        stats_reason: "Motivo",
        stats_level: "Nivel",
        stats_time: "Tiempo",
        stats_streak: "Racha",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bonus",
        // UI
        opt_language: "Idioma",
        lang_auto: "Auto",
        up_choose: "Elige una mejora",
        up_level_title: "Nivel {0}",
        rarity_common: "Común",
        rarity_rare: "Rara",
        rarity_epic: "Épica",
        rarity_legendary: "Legendaria",
        new_profile: "Crear nuevo…",
        confirm_clear_local: "¿Borrar datos locales? (Perfiles, ajustes, runs)",
        // Tags
        tag_defense: "Defensa",
        tag_qol: "QoL",
        tag_points: "Puntos",
        tag_mobility: "Movilidad",
        tag_upgrades: "Upgrades",
        tag_combo: "Combo",
        // Upgrades
        up_shield_name: "Escudo",
        up_shield_desc: "Bloquea 1 KO (se consume).",
        up_mag1_name: "Imán I",
        up_mag1_desc: "Atrae premios cercanos (radio 1).",
        up_mag2_name: "Imán II",
        up_mag2_desc: "Imán mejorado (radio 2).",
        up_mag3_name: "Imán III",
        up_mag3_desc: "Radio 3 (máximo).",
        up_boost_name: "Puntos +",
        up_boost_desc: "Más puntos (+8%).",
        up_trap_name: "Resistencia a trampas",
        up_trap_desc: "Reduce penalización de trampas.",
        up_zone_name: "Zona +",
        up_zone_desc: "Zona de movimiento más alta (+1 fila).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin vale más (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem vale más (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus vale más (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Ganas 1 reroll extra.",
        up_mult_name: "Mult +",
        up_mult_desc: "Sube multiplicador base (+0.10).",
      },
      en: {
        langName: "English",
        defaultPlayer: "Player",
        app_ready: "Ready",
        app_loading: "Starting…",
        app_pwa: "PWA…",
        audio_ok: "Audio OK",
        update_apply_end: "Update ready: it will apply after the run.",
        update_available: "Update available.",
        update_apply_end_short: "It will apply after the run.",
        pill_update: "Update",
        toast_trap: "Trap",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Upgrade: {0}",
        toast_reroll: "Reroll",
        toast_skip: "Skip",
        toast_shield_saved: "Shield saved you from a KO",
        name_min: "Name must be at least 2 characters",
        combo_hint: "Complete the sequence to increase multiplier.",
        stats_reason: "Reason",
        stats_level: "Level",
        stats_time: "Time",
        stats_streak: "Streak",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bonus",
        opt_language: "Language",
        lang_auto: "Auto",
        up_choose: "Choose an upgrade",
        up_level_title: "Level {0}",
        rarity_common: "Common",
        rarity_rare: "Rare",
        rarity_epic: "Epic",
        rarity_legendary: "Legendary",
        new_profile: "Create new…",
        confirm_clear_local: "Clear local data? (Profiles, settings, runs)",
        // Tags
        tag_defense: "Defense",
        tag_qol: "QoL",
        tag_points: "Points",
        tag_mobility: "Mobility",
        tag_upgrades: "Upgrades",
        tag_combo: "Combo",
        // Upgrades
        up_shield_name: "Shield",
        up_shield_desc: "Blocks 1 KO (consumed).",
        up_mag1_name: "Magnet I",
        up_mag1_desc: "Pulls nearby rewards (radius 1).",
        up_mag2_name: "Magnet II",
        up_mag2_desc: "Improved magnet (radius 2).",
        up_mag3_name: "Magnet III",
        up_mag3_desc: "Radius 3 (max).",
        up_boost_name: "Score +",
        up_boost_desc: "More points (+8%).",
        up_trap_name: "Trap resistance",
        up_trap_desc: "Reduces trap penalty.",
        up_zone_name: "Zone +",
        up_zone_desc: "Taller movement zone (+1 row).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin worth more (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem worth more (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus worth more (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Gain 1 extra reroll.",
        up_mult_name: "Mult +",
        up_mult_desc: "Increase base multiplier (+0.10).",
      },
      fr: {
        langName: "Français",
        defaultPlayer: "Joueur",
        app_ready: "Prêt",
        app_loading: "Démarrage…",
        app_pwa: "PWA…",
        audio_ok: "Audio OK",
        update_apply_end: "MAJ prête : elle s’appliquera après la partie.",
        update_available: "Mise à jour disponible.",
        update_apply_end_short: "Après la partie.",
        pill_update: "Mettre à jour",
        toast_trap: "Piège",
        toast_combo_mult: "Combo : +MULT",
        toast_upgrade: "Amélioration : {0}",
        toast_reroll: "Relance",
        toast_skip: "Passer",
        toast_shield_saved: "Bouclier : KO évité",
        name_min: "Nom : минимум 2 caractères",
        combo_hint: "Complète la séquence pour augmenter le multiplicateur.",
        stats_reason: "Raison",
        stats_level: "Niveau",
        stats_time: "Temps",
        stats_streak: "Série",
        stats_mult: "Mult",
        cell_coin: "Pièce",
        cell_gem: "Gemme",
        cell_bonus: "Bonus",
        opt_language: "Langue",
        lang_auto: "Auto",
        up_choose: "Choisis une amélioration",
        up_level_title: "Niveau {0}",
        rarity_common: "Commune",
        rarity_rare: "Rare",
        rarity_epic: "Épique",
        rarity_legendary: "Légendaire",
        new_profile: "Créer nouveau…",
        confirm_clear_local: "Effacer les données locales ? (Profils, réglages, runs)",
        tag_defense: "Défense",
        tag_qol: "QoL",
        tag_points: "Points",
        tag_mobility: "Mobilité",
        tag_upgrades: "Amélios",
        tag_combo: "Combo",
        up_shield_name: "Bouclier",
        up_shield_desc: "Bloque 1 KO (consommé).",
        up_mag1_name: "Aimant I",
        up_mag1_desc: "Attire les récompenses (rayon 1).",
        up_mag2_name: "Aimant II",
        up_mag2_desc: "Aimant amélioré (rayon 2).",
        up_mag3_name: "Aimant III",
        up_mag3_desc: "Rayon 3 (max).",
        up_boost_name: "Score +",
        up_boost_desc: "Plus de points (+8%).",
        up_trap_name: "Résistance pièges",
        up_trap_desc: "Réduit la pénalité des pièges.",
        up_zone_name: "Zone +",
        up_zone_desc: "Zone de mouvement plus haute (+1 ligne).",
        up_coin_name: "Pièce +",
        up_coin_desc: "Pièce vaut plus (+2).",
        up_gem_name: "Gemme +",
        up_gem_desc: "Gemme vaut plus (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus vaut plus (+10).",
        up_reroll_name: "Relance +",
        up_reroll_desc: "Gagne 1 relance.",
        up_mult_name: "Mult +",
        up_mult_desc: "Augmente le mult de base (+0,10).",
      },
      de: {
        langName: "Deutsch",
        defaultPlayer: "Spieler",
        app_ready: "Bereit",
        app_loading: "Startet…",
        app_pwa: "PWA…",
        audio_ok: "Audio OK",
        update_apply_end: "Update bereit: wird nach dem Lauf angewendet.",
        update_available: "Update verfügbar.",
        update_apply_end_short: "Nach dem Lauf.",
        pill_update: "Aktualisieren",
        toast_trap: "Falle",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Upgrade: {0}",
        toast_reroll: "Neu würfeln",
        toast_skip: "Überspringen",
        toast_shield_saved: "Schild hat dich vor KO gerettet",
        name_min: "Name: mindestens 2 Zeichen",
        combo_hint: "Vervollständige die Sequenz für mehr Multiplikator.",
        stats_reason: "Grund",
        stats_level: "Level",
        stats_time: "Zeit",
        stats_streak: "Serie",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bonus",
        opt_language: "Sprache",
        lang_auto: "Auto",
        up_choose: "Wähle ein Upgrade",
        up_level_title: "Level {0}",
        rarity_common: "Gewöhnlich",
        rarity_rare: "Selten",
        rarity_epic: "Episch",
        rarity_legendary: "Legendär",
        new_profile: "Neu erstellen…",
        confirm_clear_local: "Lokale Daten löschen? (Profile, Einstellungen, Runs)",
        tag_defense: "Verteidigung",
        tag_qol: "QoL",
        tag_points: "Punkte",
        tag_mobility: "Mobilität",
        tag_upgrades: "Upgrades",
        tag_combo: "Combo",
        up_shield_name: "Schild",
        up_shield_desc: "Blockt 1 KO (verbraucht).",
        up_mag1_name: "Magnet I",
        up_mag1_desc: "Zieht Belohnungen an (Radius 1).",
        up_mag2_name: "Magnet II",
        up_mag2_desc: "Besserer Magnet (Radius 2).",
        up_mag3_name: "Magnet III",
        up_mag3_desc: "Radius 3 (Max).",
        up_boost_name: "Score +",
        up_boost_desc: "Mehr Punkte (+8%).",
        up_trap_name: "Fallenresistenz",
        up_trap_desc: "Reduziert Fallenstrafe.",
        up_zone_name: "Zone +",
        up_zone_desc: "Höhere Bewegungszone (+1 Reihe).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin ist mehr wert (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem ist mehr wert (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus ist mehr wert (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Erhalte 1 zusätzlichen Reroll.",
        up_mult_name: "Mult +",
        up_mult_desc: "Erhöht Basismultiplikator (+0,10).",
      },
      it: {
        langName: "Italiano",
        defaultPlayer: "Giocatore",
        app_ready: "Pronto",
        app_loading: "Avvio…",
        app_pwa: "PWA…",
        audio_ok: "Audio OK",
        update_apply_end: "Aggiornamento pronto: si applicherà dopo la run.",
        update_available: "Aggiornamento disponibile.",
        update_apply_end_short: "Dopo la run.",
        pill_update: "Aggiorna",
        toast_trap: "Trappola",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Miglioria: {0}",
        toast_reroll: "Reroll",
        toast_skip: "Salta",
        toast_shield_saved: "Scudo: KO evitato",
        name_min: "Nome: minimo 2 caratteri",
        combo_hint: "Completa la sequenza per aumentare il moltiplicatore.",
        stats_reason: "Motivo",
        stats_level: "Livello",
        stats_time: "Tempo",
        stats_streak: "Serie",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bonus",
        opt_language: "Lingua",
        lang_auto: "Auto",
        up_choose: "Scegli un upgrade",
        up_level_title: "Livello {0}",
        rarity_common: "Comune",
        rarity_rare: "Raro",
        rarity_epic: "Epico",
        rarity_legendary: "Leggendario",
        new_profile: "Crea nuovo…",
        confirm_clear_local: "Cancellare i dati locali? (Profili, impostazioni, runs)",
        tag_defense: "Difesa",
        tag_qol: "QoL",
        tag_points: "Punti",
        tag_mobility: "Mobilità",
        tag_upgrades: "Upgrade",
        tag_combo: "Combo",
        up_shield_name: "Scudo",
        up_shield_desc: "Blocca 1 KO (consumato).",
        up_mag1_name: "Magnete I",
        up_mag1_desc: "Attira ricompense (raggio 1).",
        up_mag2_name: "Magnete II",
        up_mag2_desc: "Magnete migliorato (raggio 2).",
        up_mag3_name: "Magnete III",
        up_mag3_desc: "Raggio 3 (max).",
        up_boost_name: "Punti +",
        up_boost_desc: "Più punti (+8%).",
        up_trap_name: "Resistenza trappole",
        up_trap_desc: "Riduce la penalità delle trappole.",
        up_zone_name: "Zona +",
        up_zone_desc: "Zona movimento più alta (+1 riga).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin vale di più (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem vale di più (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus vale di più (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Ottieni 1 reroll extra.",
        up_mult_name: "Mult +",
        up_mult_desc: "Aumenta mult base (+0,10).",
      },
      pt: {
        langName: "Português",
        defaultPlayer: "Jogador",
        app_ready: "Pronto",
        app_loading: "A iniciar…",
        app_pwa: "PWA…",
        audio_ok: "Áudio OK",
        update_apply_end: "Update pronto: aplica-se no fim da run.",
        update_available: "Atualização disponível.",
        update_apply_end_short: "No fim da run.",
        pill_update: "Atualizar",
        toast_trap: "Armadilha",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Upgrade: {0}",
        toast_reroll: "Reroll",
        toast_skip: "Saltar",
        toast_shield_saved: "Escudo salvou-te de um KO",
        name_min: "Nome: mínimo 2 caracteres",
        combo_hint: "Completa a sequência para aumentar o multiplicador.",
        stats_reason: "Motivo",
        stats_level: "Nível",
        stats_time: "Tempo",
        stats_streak: "Sequência",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bónus",
        opt_language: "Idioma",
        lang_auto: "Auto",
        up_choose: "Escolhe um upgrade",
        up_level_title: "Nível {0}",
        rarity_common: "Comum",
        rarity_rare: "Raro",
        rarity_epic: "Épico",
        rarity_legendary: "Lendário",
        new_profile: "Criar novo…",
        confirm_clear_local: "Apagar dados locais? (Perfis, definições, runs)",
        tag_defense: "Defesa",
        tag_qol: "QoL",
        tag_points: "Pontos",
        tag_mobility: "Mobilidade",
        tag_upgrades: "Upgrades",
        tag_combo: "Combo",
        up_shield_name: "Escudo",
        up_shield_desc: "Bloqueia 1 KO (consome).",
        up_mag1_name: "Íman I",
        up_mag1_desc: "Atrai prémios (raio 1).",
        up_mag2_name: "Íman II",
        up_mag2_desc: "Íman melhorado (raio 2).",
        up_mag3_name: "Íman III",
        up_mag3_desc: "Raio 3 (máx).",
        up_boost_name: "Pontos +",
        up_boost_desc: "Mais pontos (+8%).",
        up_trap_name: "Resistência a armadilhas",
        up_trap_desc: "Reduz penalização das armadilhas.",
        up_zone_name: "Zona +",
        up_zone_desc: "Zona de movimento maior (+1 linha).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin vale mais (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem vale mais (+6).",
        up_bonus_name: "Bónus +",
        up_bonus_desc: "Bónus vale mais (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Ganhas 1 reroll extra.",
        up_mult_name: "Mult +",
        up_mult_desc: "Aumenta mult base (+0,10).",
      },
      ca: {
        langName: "Català",
        defaultPlayer: "Jugador",
        app_ready: "A punt",
        app_loading: "Iniciant…",
        app_pwa: "PWA…",
        audio_ok: "Àudio OK",
        update_apply_end: "Actualització llesta: s’aplicarà en acabar la run.",
        update_available: "Actualització disponible.",
        update_apply_end_short: "En acabar la run.",
        pill_update: "Actualitza",
        toast_trap: "Trampa",
        toast_combo_mult: "Combo: +MULT",
        toast_upgrade: "Millora: {0}",
        toast_reroll: "Reroll",
        toast_skip: "Saltar",
        toast_shield_saved: "L’escut t’ha salvat d’un KO",
        name_min: "Nom: mínim 2 lletres",
        combo_hint: "Completa la seqüència per pujar multiplicador.",
        stats_reason: "Motiu",
        stats_level: "Nivell",
        stats_time: "Temps",
        stats_streak: "Ratxa",
        stats_mult: "Mult",
        cell_coin: "Coin",
        cell_gem: "Gem",
        cell_bonus: "Bonus",
        opt_language: "Idioma",
        lang_auto: "Auto",
        up_choose: "Tria una millora",
        up_level_title: "Nivell {0}",
        rarity_common: "Comuna",
        rarity_rare: "Rara",
        rarity_epic: "Èpica",
        rarity_legendary: "Legendària",
        new_profile: "Crear nou…",
        confirm_clear_local: "Esborrar dades locals? (Perfils, opcions, runs)",
        tag_defense: "Defensa",
        tag_qol: "QoL",
        tag_points: "Punts",
        tag_mobility: "Mobilitat",
        tag_upgrades: "Upgrades",
        tag_combo: "Combo",
        up_shield_name: "Escut",
        up_shield_desc: "Bloqueja 1 KO (es consumeix).",
        up_mag1_name: "Imant I",
        up_mag1_desc: "Atrau premis (radi 1).",
        up_mag2_name: "Imant II",
        up_mag2_desc: "Imant millorat (radi 2).",
        up_mag3_name: "Imant III",
        up_mag3_desc: "Radi 3 (màxim).",
        up_boost_name: "Punts +",
        up_boost_desc: "Més punts (+8%).",
        up_trap_name: "Resistència trampes",
        up_trap_desc: "Redueix penalització de trampes.",
        up_zone_name: "Zona +",
        up_zone_desc: "Zona de moviment més alta (+1 fila).",
        up_coin_name: "Coin +",
        up_coin_desc: "Coin val més (+2).",
        up_gem_name: "Gem +",
        up_gem_desc: "Gem val més (+6).",
        up_bonus_name: "Bonus +",
        up_bonus_desc: "Bonus val més (+10).",
        up_reroll_name: "Reroll +",
        up_reroll_desc: "Guanyes 1 reroll extra.",
        up_mult_name: "Mult +",
        up_mult_desc: "Puja mult base (+0,10).",
      },
    };

    const supported = ["auto", ...Object.keys(dict)];
    let current = "es";

    function detectBrowser() {
      const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "es";
      const n = normalize(nav);
      return dict[n] ? n : "en";
    }

    function setLang(raw) {
      const n = normalize(raw);
      if (n === "auto") current = detectBrowser();
      else current = dict[n] ? n : "en";
      try { document.documentElement.lang = current; } catch {}
    }

    function getLang() { return current; }

    function fmt(str, args) {
      return String(str).replace(/\{(\d+)\}/g, (_, i) => (args && args[+i] != null) ? String(args[+i]) : "");
    }

    function t(key, ...args) {
      const base = dict[current] || dict.en || dict.es;
      const es = dict.es || {};
      const val = (base && base[key] != null) ? base[key] : (es[key] != null ? es[key] : key);
      return args.length ? fmt(val, args) : String(val);
    }

    function languageOptions() {
      const order = ["auto", "es", "en", "fr", "de", "it", "pt", "ca"];
      const out = [];
      for (const code of order) {
        if (!supported.includes(code)) continue;
        if (code === "auto") out.push({ code, label: (dict[current]?.lang_auto || dict.es.lang_auto || "Auto") });
        else out.push({ code, label: dict[code]?.langName || code.toUpperCase() });
      }
      for (const code of supported) {
        if (order.includes(code)) continue;
        if (code === "auto") continue;
        out.push({ code, label: dict[code]?.langName || code.toUpperCase() });
      }
      return out;
    }

    function applyDataAttrs(root = document) {
      try {
        root.querySelectorAll?.("[data-i18n]")?.forEach((el) => {
          const k = el.getAttribute("data-i18n");
          if (k) el.textContent = t(k);
        });
        root.querySelectorAll?.("[data-i18n-title]")?.forEach((el) => {
          const k = el.getAttribute("data-i18n-title");
          if (k) el.title = t(k);
        });
        root.querySelectorAll?.("[data-i18n-ph]")?.forEach((el) => {
          const k = el.getAttribute("data-i18n-ph");
          if (k) el.placeholder = t(k);
        });
      } catch {}
    }

    return { setLang, getLang, t, languageOptions, applyDataAttrs };
  })();

  // ───────────────────────── Settings ─────────────────────────
  const defaultSettings = () => ({
    useSprites: false,
    vibration: true,
    showDpad: true,
    fx: 1.0,

    // AUDIO
    musicOn: true,
    musicVol: 0.60,
    sfxVol: 0.90,
    muteAll: false,

    // I18N
    lang: "auto",
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

      musicOn: (s.musicOn ?? base.musicOn) !== false,
      musicVol: clamp(Number(s.musicVol ?? base.musicVol) || base.musicVol, 0, 1),
      sfxVol: clamp(Number(s.sfxVol ?? base.sfxVol) || base.sfxVol, 0, 1),
      muteAll: !!(s.muteAll ?? base.muteAll),

      lang: (typeof s.lang === "string" ? s.lang : base.lang),
    };
  })();

  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }
  function vibrate(ms) {
    if (!settings.vibration) return;
    if (!("vibrate" in navigator)) return;
    try { navigator.vibrate(ms); } catch {}
  }

  // aplica idioma ya
  I18n.setLang(settings.lang);

  // ───────────────────────── CSS patch v0.1.7 (sin tocar styles.css) ─────────────────────────
  function injectPatchStyles017() {
    try {
      if (document.getElementById("grPatch017")) return;
      const st = document.createElement("style");
      st.id = "grPatch017";
      st.textContent = `
        /* v0.1.7 UI polish + scroll safety */
        #stage{
          background:
            radial-gradient(1200px 800px at 30% 10%, rgba(106,176,255,.10), rgba(0,0,0,0) 60%),
            radial-gradient(900px 700px at 70% 90%, rgba(255,211,90,.08), rgba(0,0,0,0) 55%),
            linear-gradient(180deg, #050512, #030309);
        }

        /* Overlays: safe padding + smoother panel */
        [id^="overlay"]{
          padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
        }

        /* Opciones: si el contenido no cabe => scroll siempre disponible */
        #overlayOptions{ overflow: auto !important; -webkit-overflow-scrolling: touch; }
        #overlayOptions .panel,
        #overlayOptions .card,
        #overlayOptions #optionsBody{
          max-height: calc(100dvh - 140px);
          overflow: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(10,10,18,.86);
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 40px rgba(0,0,0,.35);
        }

        /* Upgrades: layout consistente (evita 2+1 feo) */
        #upgradeChoices{
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
          justify-items: stretch;
          width: 100%;
          max-width: 980px;
          margin: 12px auto 0;
        }
        @media (max-width: 680px){
          #upgradeChoices{ grid-template-columns: 1fr !important; max-width: 520px; }
        }

        /* Up card look */
        .upCard{
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background:
            radial-gradient(600px 320px at 20% 10%, rgba(106,176,255,.10), rgba(0,0,0,0) 60%),
            linear-gradient(180deg, rgba(18,18,30,.92), rgba(10,10,18,.92));
          box-shadow: 0 10px 26px rgba(0,0,0,.35);
          transform: translateZ(0);
          will-change: transform, box-shadow;
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
        }
        .upCard:hover{
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(0,0,0,.42);
          border-color: rgba(255,255,255,.18);
        }
        .upCard:active{ transform: translateY(0); }

        .upCard .upTitle{
          font-weight: 900;
          letter-spacing: .2px;
          text-shadow: 0 2px 10px rgba(0,0,0,.35);
        }
        .upCard[data-rarity="common"] .upTitle{ color: rgba(255,255,255,.92); }
        .upCard[data-rarity="rare"] .upTitle{ color: rgba(106,176,255,.96); }
        .upCard[data-rarity="epic"] .upTitle{ color: rgba(214,133,255,.96); }
        .upCard[data-rarity="legendary"] .upTitle{ color: rgba(255,211,90,.98); }

        .upCard[data-rarity="rare"]{ border-color: rgba(106,176,255,.22); }
        .upCard[data-rarity="epic"]{ border-color: rgba(214,133,255,.22); }
        .upCard[data-rarity="legendary"]{
          border-color: rgba(255,211,90,.26);
          box-shadow: 0 14px 40px rgba(255,211,90,.08), 0 12px 30px rgba(0,0,0,.40);
        }

        .upRarityBadge{
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(0,0,0,.18);
          font-weight: 800;
          font-size: 12px;
        }
        .upCard[data-rarity="common"] .upRarityBadge{ color: rgba(255,255,255,.85); }
        .upCard[data-rarity="rare"] .upRarityBadge{ color: rgba(106,176,255,.95); border-color: rgba(106,176,255,.24); }
        .upCard[data-rarity="epic"] .upRarityBadge{ color: rgba(214,133,255,.95); border-color: rgba(214,133,255,.24); }
        .upCard[data-rarity="legendary"] .upRarityBadge{ color: rgba(255,211,90,.98); border-color: rgba(255,211,90,.28); }

        /* Upgrade overlay polish */
        #overlayUpgrades{
          background:
            radial-gradient(1100px 800px at 50% 20%, rgba(106,176,255,.10), rgba(0,0,0,0) 62%),
            radial-gradient(900px 700px at 70% 80%, rgba(255,211,90,.08), rgba(0,0,0,0) 60%),
            rgba(0,0,0,.55);
          backdrop-filter: blur(10px);
        }
        #overlayUpgrades .panel,
        #overlayUpgrades .card{
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(10,10,18,.88);
          box-shadow: 0 16px 46px rgba(0,0,0,.45);
        }

        /* Toast a bit juicier */
        #toast.show{
          box-shadow: 0 12px 30px rgba(0,0,0,.35);
          border: 1px solid rgba(255,255,255,.14);
        }
      `;
      document.head.appendChild(st);
    } catch {}
  }

  // ───────────────────────── Audio (robusto) ─────────────────────────
  const AudioSys = (() => {
    const supportsCtx = (() => {
      try { return !!(window.AudioContext || window.webkitAudioContext); } catch { return false; }
    })();

    const FILES = {
      bgm:   "assets/audio/bgm_loop.mp3",
      coin:  "assets/audio/sfx_coin.wav",
      gem:   "assets/audio/sfx_gem.wav",
      bonus: "assets/audio/sfx_bonus.wav",
      trap:  "assets/audio/sfx_trap.wav",
      ko:    "assets/audio/sfx_ko.wav",
      level: "assets/audio/sfx_levelup.wav",
      pick:  "assets/audio/sfx_pick.wav",
      reroll:"assets/audio/sfx_reroll.wav",
      ui:    "assets/audio/sfx_ui_click.wav",
    };

    let ctx = null;
    let master = null;
    let sfxGain = null;

    let musicEl = null;
    let musicMode = "none";
    let duckFactor = 1.0;
    let volAnimRaf = 0;

    let unlocked = false;
    let muted = false;
    let musicOn = true;
    let sfxOn = true;

    let musicVol = 0.60;
    let sfxVol = 0.90;

    const buffers = new Map();
    let proceduralNode = null;

    const urlOf = (rel) => new URL(rel, location.href).toString();

    function ensureCtx() {
      if (!supportsCtx) return null;
      if (ctx) return ctx;

      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });

      master = ctx.createGain();
      sfxGain = ctx.createGain();

      master.gain.value = muted ? 0 : 1;
      sfxGain.gain.value = sfxOn ? sfxVol : 0;

      sfxGain.connect(master);
      master.connect(ctx.destination);

      return ctx;
    }

    function ensureMusicEl() {
      if (musicEl) return musicEl;

      try {
        const el = new Audio();
        el.src = urlOf(FILES.bgm);
        el.loop = true;
        el.preload = "auto";
        el.autoplay = false;

        el.playsInline = true;
        try { el.setAttribute("playsinline", ""); } catch {}
        try { el.setAttribute("webkit-playsinline", ""); } catch {}

        try { el.defaultPlaybackRate = 1; } catch {}
        try { el.playbackRate = 1; } catch {}
        try { el.preservesPitch = true; } catch {}
        try { el.mozPreservesPitch = true; } catch {}
        try { el.webkitPreservesPitch = true; } catch {}

        el.muted = true;
        el.volume = 0;

        musicEl = el;
        musicMode = "html";
        return musicEl;
      } catch {
        musicEl = null;
        return null;
      }
    }

    function effectiveMusicVolume() {
      if (muted || !musicOn) return 0;
      return clamp(musicVol * duckFactor, 0, 1);
    }

    function setMusicVolumeImmediate(v) {
      const el = ensureMusicEl();
      if (!el) return;
      const vv = clamp(v, 0, 1);
      try {
        el.muted = vv <= 0.0001;
        el.volume = vv;
      } catch {}
    }

    function setMusicVolumeSmooth(target, ms = 140) {
      const el = ensureMusicEl();
      if (!el) return;

      if (volAnimRaf) cancelAnimationFrame(volAnimRaf);
      const t0 = performance.now();
      let from = 0;

      try { from = Number.isFinite(el.volume) ? el.volume : 0; } catch { from = 0; }
      const to = clamp(target, 0, 1);

      const step = () => {
        const t = performance.now();
        const k = clamp((t - t0) / Math.max(1, ms), 0, 1);
        const e = 1 - Math.pow(1 - k, 2);
        const v = from + (to - from) * e;
        setMusicVolumeImmediate(v);
        if (k < 1) volAnimRaf = requestAnimationFrame(step);
        else volAnimRaf = 0;
      };

      volAnimRaf = requestAnimationFrame(step);
    }

    async function unlock() {
      unlocked = true;

      if (supportsCtx) {
        const c = ensureCtx();
        if (c) {
          try { if (c.state !== "running") await c.resume(); } catch {}
        }
      }
      return true;
    }

    function setMute(v) {
      muted = !!v;

      if (master) master.gain.value = muted ? 0 : 1;

      if (muted) {
        stopMusic();
      } else {
        const vv = effectiveMusicVolume();
        setMusicVolumeImmediate(vv);
      }
    }

    function setMusicOn(v) {
      musicOn = !!v;
      if (!musicOn) stopMusic();
      else startMusic();
    }

    function setSfxOn(v) {
      sfxOn = !!v;
      if (sfxGain) sfxGain.gain.value = sfxOn ? sfxVol : 0;
    }

    function setVolumes({ music, sfx }) {
      if (Number.isFinite(music)) musicVol = clamp(music, 0, 1);
      if (Number.isFinite(sfx)) sfxVol = clamp(sfx, 0, 1);

      if (sfxGain) sfxGain.gain.value = sfxOn ? sfxVol : 0;

      const vv = effectiveMusicVolume();
      setMusicVolumeImmediate(vv);
    }

    function duckMusic(on) {
      const targetDuck = on ? 0.35 : 1.0;
      duckFactor = targetDuck;
      const vv = effectiveMusicVolume();
      setMusicVolumeSmooth(vv, 140);
    }

    async function loadBuffer(key, relPath) {
      if (!supportsCtx) return null;
      if (buffers.has(key)) return buffers.get(key);

      const c = ensureCtx();
      if (!c) return null;

      try {
        const res = await fetch(urlOf(relPath), { cache: "force-cache" });
        if (!res || !res.ok) throw new Error("fetch audio fail");
        const arr = await res.arrayBuffer();
        const buf = await c.decodeAudioData(arr.slice(0));
        buffers.set(key, buf);
        return buf;
      } catch {
        buffers.set(key, null);
        return null;
      }
    }

    function playBuffer(buf, { gain = 1, rate = 1, pan = 0 } = {}) {
      if (!buf) return false;
      const c = ensureCtx();
      if (!c || !unlocked) return false;
      if (!sfxOn || muted) return false;

      try {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = clamp(rate, 0.5, 2.0);

        const g = c.createGain();
        g.gain.value = clamp(gain, 0, 2.0);

        let node = src;
        if (c.createStereoPanner) {
          const p = c.createStereoPanner();
          p.pan.value = clamp(pan, -1, 1);
          node.connect(p);
          node = p;
        }
        node.connect(g);
        g.connect(sfxGain);

        src.start();
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch {} };
        return true;
      } catch {
        return false;
      }
    }

    function beep({ f = 440, ms = 90, type = "square", gain = 0.18, slideTo = null } = {}) {
      const c = ensureCtx();
      if (!c || !unlocked) return false;
      if (!sfxOn || muted) return false;

      const t0 = c.currentTime;
      const t1 = t0 + clamp(ms, 20, 600) / 1000;

      const o = c.createOscillator();
      const g = c.createGain();

      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t1);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t1);

      o.connect(g);
      g.connect(sfxGain);
      o.start(t0);
      o.stop(t1);

      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch {} };
      return true;
    }

    async function sfx(name) {
      await unlock();

      if (!supportsCtx) return false;

      const map = {
        coin: "coin",
        gem: "gem",
        bonus: "bonus",
        trap: "trap",
        ko: "ko",
        level: "level",
        pick: "pick",
        reroll: "reroll",
        ui: "ui",
      };

      const k = map[name] || "ui";
      const file = FILES[k];
      if (file) {
        const buf = await loadBuffer(k, file);
        if (buf) {
          const rate = 0.94 + Math.random() * 0.12;
          const gain = (k === "ko" || k === "trap") ? 0.95 : 0.70;
          return playBuffer(buf, { gain, rate, pan: (Math.random() * 2 - 1) * 0.15 });
        }
      }

      if (k === "coin")  return beep({ f: 820, ms: 60, type: "square", gain: 0.14, slideTo: 980 });
      if (k === "gem")   return beep({ f: 620, ms: 85, type: "triangle", gain: 0.16, slideTo: 920 });
      if (k === "bonus") return beep({ f: 520, ms: 120, type: "sawtooth", gain: 0.12, slideTo: 1040 });
      if (k === "trap")  return beep({ f: 220, ms: 140, type: "square", gain: 0.16, slideTo: 110 });
      if (k === "ko")    return beep({ f: 150, ms: 220, type: "sawtooth", gain: 0.18, slideTo: 60 });
      if (k === "level") return beep({ f: 440, ms: 140, type: "triangle", gain: 0.14, slideTo: 880 });
      if (k === "pick")  return beep({ f: 520, ms: 80, type: "square", gain: 0.12, slideTo: 700 });
      if (k === "reroll")return beep({ f: 360, ms: 90, type: "triangle", gain: 0.12, slideTo: 520 });
      return beep({ f: 520, ms: 55, type: "square", gain: 0.09, slideTo: 610 });
    }

    function stopProceduralMusic() {
      if (!proceduralNode) return;
      try { proceduralNode.stop?.(); } catch {}
      try { proceduralNode.disconnect?.(); } catch {}
      proceduralNode = null;
      if (musicMode === "procedural") musicMode = "none";
    }

    function stopMusic() {
      if (musicEl) {
        try {
          musicEl.pause();
          musicEl.currentTime = 0;
        } catch {}
        try {
          musicEl.defaultPlaybackRate = 1;
          musicEl.playbackRate = 1;
        } catch {}
      }
      stopProceduralMusic();
    }

    async function startMusic() {
      if (!musicOn || muted) return;

      await unlock();

      const el = ensureMusicEl();
      if (el) {
        try {
          el.defaultPlaybackRate = 1;
          el.playbackRate = 1;
        } catch {}
        const vv = effectiveMusicVolume();
        setMusicVolumeImmediate(vv);
        if (vv <= 0.0001) return;

        try {
          if (!el.paused) return;
          const p = el.play();
          if (p && typeof p.then === "function") await p;
          musicMode = "html";
          return;
        } catch {
          // cae a procedural
        }
      }

      if (!supportsCtx || !ctx) return;
      if (proceduralNode) return;

      try {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();

        o1.type = "sine";
        o2.type = "triangle";
        o1.frequency.value = 110;
        o2.frequency.value = 220;

        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.15;
        lfoG.gain.value = 12;

        lfo.connect(lfoG);
        lfoG.connect(o2.frequency);

        g.gain.value = 0.10;

        o1.connect(g);
        o2.connect(g);
        g.connect(master);

        o1.start();
        o2.start();
        lfo.start();

        const notes = [110, 123.47, 130.81, 146.83, 164.81, 146.83, 130.81, 123.47];
        let idx = 0;

        const step = () => {
          if (!ctx || !proceduralNode || !musicOn || muted) return;
          const f = notes[idx++ % notes.length];
          const t = ctx.currentTime;
          o1.frequency.setTargetAtTime(f, t, 0.12);
          o2.frequency.setTargetAtTime(f * 2, t, 0.12);
          setTimeout(step, 680);
        };

        proceduralNode = {
          stop() {
            try { o1.stop(); o2.stop(); lfo.stop(); } catch {}
            try { o1.disconnect(); o2.disconnect(); lfo.disconnect(); lfoG.disconnect(); g.disconnect(); } catch {}
          },
          disconnect() {},
        };

        musicMode = "procedural";
        step();
      } catch {
        // nada
      }
    }

    return {
      supports: true,
      unlock,
      sfx,
      startMusic,
      stopMusic,
      duckMusic,
      setMute,
      setMusicOn,
      setSfxOn,
      setVolumes,
      getState: () => ({ muted, musicOn, sfxOn, musicVol, sfxVol, unlocked, musicMode }),
    };
  })();

  function applyAudioSettingsNow() {
    try {
      AudioSys.setMute(!!settings.muteAll);
      AudioSys.setMusicOn(!!settings.musicOn);
      AudioSys.setVolumes({ music: settings.musicVol, sfx: settings.sfxVol });
    } catch {}
  }

  // ───────────────────────── Auth ─────────────────────────
  const Auth = window.Auth || null;

  let activeProfileId = null;
  let playerName = (localStorage.getItem(NAME_KEY) || "").trim().slice(0, 16);
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

  if (playerName.length < 2) playerName = I18n.t("defaultPlayer");

  function syncFromAuth() {
    try {
      if (!Auth) return;
      const p = Auth.getActiveProfile?.();
      if (!p) return;
      activeProfileId = p.id;
      playerName = (p.name || I18n.t("defaultPlayer")).trim().slice(0, 16) || I18n.t("defaultPlayer");
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
        try {
          const img = await loadImage(spriteUrl(file));
          sprites.map.set(k, img);
        } catch {
          // no rompe el resto
        }
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

  // Shake: solo player
  let shakeT = 0;
  let shakePow = 0;

  let hitFlashT = 0;
  let hitFlashMax = 1;
  let hitFlashColor = "#ff2b4d";

  const particles = [];
  const floatTexts = [];

  // Background stars (v0.1.7)
  const bgStars = [];
  function initBgStars() {
    bgStars.length = 0;
    const n = clampInt(Math.round(42 + (cssCanvasW * cssCanvasH) / 18000), 40, 140);
    for (let i = 0; i < n; i++) {
      bgStars.push({
        x: Math.random() * Math.max(1, cssCanvasW),
        y: Math.random() * Math.max(1, cssCanvasH),
        s: 0.6 + Math.random() * 1.8,
        a: 0.04 + Math.random() * 0.18,
        vy: 6 + Math.random() * 22,
        tw: 0.8 + Math.random() * 1.8,
        t: Math.random() * 10,
      });
    }
  }
  function tickBgStars(dtMs) {
    if (!bgStars.length) return;
    const dt = dtMs / 1000;
    for (const st of bgStars) {
      st.t += dt * st.tw;
      st.y += st.vy * dt;
      if (st.y > cssCanvasH + 4) {
        st.y = -4;
        st.x = Math.random() * Math.max(1, cssCanvasW);
        st.vy = 6 + Math.random() * 22;
        st.a = 0.04 + Math.random() * 0.18;
        st.s = 0.6 + Math.random() * 1.8;
        st.tw = 0.8 + Math.random() * 1.8;
      }
    }
  }

  // ───────────────────────── DOM refs ─────────────────────────
  let stage, canvasWrap, gameArea, hud, canvas, ctx;
  let brandSub;

  let pillScore, pillBest, pillStreak, pillMult, pillLevel, pillSpeed, pillPlayer, pillUpdate, pillOffline, pillVersion;
  let btnOptions, btnPause, btnRestart, btnInstall;

  let overlayLoading, loadingSub, overlayStart, overlayPaused, overlayUpgrades, overlayGameOver, overlayOptions, overlayError;

  let btnStart, profileSelect, btnNewProfile, newProfileWrap, startName;
  let btnResume, btnQuitToStart, btnPausedRestart;

  let upTitle, upSub, upgradeChoices, btnReroll, btnSkipUpgrade;

  let goStats, goScoreBig, goBestBig, btnBackToStart, btnRetry;

  let btnCloseOptions, optSprites, optVibration, optDpad, optFx, optFxValue, btnClearLocal, btnRepairPWA;

  // NEW AUDIO opts
  let optMusicOn, optMusicVol, optMusicVolValue, optSfxVol, optSfxVolValue, optMuteAll, btnTestAudio;

  // I18N opts
  let optLang = null;

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

  // Pills a 10Hz
  let pillAccMs = 0;
  function updatePillsNow() {
    setPill(pillScore, score | 0);
    setPill(pillBest, best | 0);
    setPill(pillStreak, streak | 0);
    setPill(pillMult, mult.toFixed(2));
    setPill(pillLevel, `Lv ${level}`);
    setPill(pillSpeed, `${speedRowsPerSec().toFixed(1)}x`);
    setPill(pillPlayer, playerName || I18n.t("defaultPlayer"));
    setOfflinePill();
    updateLevelProgressUI();
  }

  function setupLanguageUI() {
    optLang = $("optLang");
    if (optLang) return;

    if (!overlayOptions) return;

    try {
      const host =
        overlayOptions.querySelector?.("#optionsBody") ||
        overlayOptions.querySelector?.(".panel") ||
        overlayOptions.querySelector?.(".card") ||
        overlayOptions;

      if (!host) return;

      if (overlayOptions.querySelector?.("#optLang")) { optLang = $("optLang"); return; }

      const row = document.createElement("div");
      row.id = "optLangRow";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.marginTop = "10px";

      const lab = document.createElement("label");
      lab.htmlFor = "optLang";
      lab.textContent = I18n.t("opt_language");
      lab.style.opacity = "0.9";

      const sel = document.createElement("select");
      sel.id = "optLang";
      sel.style.minWidth = "140px";

      row.appendChild(lab);
      row.appendChild(sel);

      host.appendChild(row);
      optLang = sel;
    } catch {}
  }

  function fillLanguageOptions() {
    if (!optLang) return;
    const opts = I18n.languageOptions();
    optLang.innerHTML = "";
    for (const o of opts) {
      const op = document.createElement("option");
      op.value = o.code;
      op.textContent = o.label;
      optLang.appendChild(op);
    }
  }

  function applySettingsToUI() {
    if (optSprites) optSprites.checked = !!settings.useSprites;
    if (optVibration) optVibration.checked = !!settings.vibration;
    if (optDpad) optDpad.checked = !!settings.showDpad;
    if (optFx) optFx.value = String(settings.fx);
    if (optFxValue) optFxValue.textContent = settings.fx.toFixed(2);

    if (optMusicOn) optMusicOn.checked = !!settings.musicOn;
    if (optMusicVol) optMusicVol.value = String(settings.musicVol);
    if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
    if (optSfxVol) optSfxVol.value = String(settings.sfxVol);
    if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
    if (optMuteAll) optMuteAll.checked = !!settings.muteAll;

    if (optLang) {
      fillLanguageOptions();
      optLang.value = String(settings.lang || "auto");
    }

    const isCoarse = matchMedia("(pointer:coarse)").matches;
    if (dpad) dpad.hidden = !(isCoarse && settings.showDpad);

    I18n.applyDataAttrs(document);

    applyAudioSettingsNow();
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
    // v0.1.7: más “juice” según upgrades
    const boostJuice = clamp(1 + scoreBoost * 0.85, 1, 1.85);
    const multJuice = clamp(1 + (mult - 1) * 0.20, 1, 1.65);
    const intensity = boostJuice * multJuice;

    if (t === CellType.Coin) { spawnPop(x, y, col, 0.85 * intensity); spawnSparks(x, y, "rgba(255,255,255,0.92)", 0.65 * intensity); shake(55, 1.2); return; }
    if (t === CellType.Gem)  { spawnPop(x, y, col, 0.95 * intensity); spawnSparks(x, y, "rgba(170,210,255,0.95)", 0.85 * intensity); shake(60, 1.35); return; }
    if (t === CellType.Bonus){ spawnPop(x, y, col, 1.15 * intensity); spawnSparks(x, y, "rgba(255,245,200,0.95)", 1.0 * intensity); shake(75, 1.6); return; }
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
      showToast(I18n.t("toast_trap"), 650);
      flash("#ff6b3d", 220);
      shake(220, 7);
      AudioSys.sfx("trap");
      return;
    }

    streak++;
    vibrate(10);

    if (t === CellType.Coin) AudioSys.sfx("coin");
    else if (t === CellType.Gem) AudioSys.sfx("gem");
    else if (t === CellType.Bonus) AudioSys.sfx("bonus");

    if (checkCombo) {
      if (combo[comboIdx] === t) {
        comboIdx++;
        comboTime = comboTimeMax;
        if (comboIdx >= combo.length) {
          mult = clamp(mult + 0.15, 1.0, 4.0);
          showToast(I18n.t("toast_combo_mult"), 900);
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
          showToast(I18n.t("toast_shield_saved"), 900);
          vibrate(24);
          shake(190, 6);
          flash("#6ab0ff", 140);
          AudioSys.sfx("pick");
        } else {
          AudioSys.sfx("ko");
          gameOverNow("KO");
        }
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
    if (t === CellType.Coin) return I18n.t("cell_coin");
    if (t === CellType.Gem) return I18n.t("cell_gem");
    if (t === CellType.Bonus) return I18n.t("cell_bonus");
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
    comboHint.textContent = I18n.t("combo_hint");
  }

  function failCombo() {
    comboIdx = 0;
    comboTime = comboTimeMax;
    renderComboUI();
  }

  // ───────────────────────── Upgrades (v0.1.7: rarezas + jerarquías) ─────────────────────────
  const Upgrades = [
    { id: "shield", nameKey: "up_shield_name", descKey: "up_shield_desc", tagKey: "tag_defense", max: 6, rarity: "common", weight: 10, apply() { shields++; } },

    // Magnet chain (no ofrecer inferiores si ya tienes superior)
    { id: "mag1", nameKey: "up_mag1_name", descKey: "up_mag1_desc", tagKey: "tag_qol", max: 1, rarity: "rare", weight: 7, apply() { magnet = Math.max(magnet, 1); } },
    { id: "mag2", nameKey: "up_mag2_name", descKey: "up_mag2_desc", tagKey: "tag_qol", max: 1, rarity: "epic", weight: 4, apply() { magnet = 2; } },
    { id: "mag3", nameKey: "up_mag3_name", descKey: "up_mag3_desc", tagKey: "tag_qol", max: 1, rarity: "legendary", weight: 2, apply() { magnet = 3; } },

    { id: "boost", nameKey: "up_boost_name", descKey: "up_boost_desc", tagKey: "tag_points", max: 10, rarity: "common", weight: 10, apply() { scoreBoost += 0.08; } },
    { id: "trap", nameKey: "up_trap_name", descKey: "up_trap_desc", tagKey: "tag_defense", max: 4, rarity: "common", weight: 9, apply() { trapResist++; } },

    { id: "zone", nameKey: "up_zone_name", descKey: "up_zone_desc", tagKey: "tag_mobility", max: 3, rarity: "epic", weight: 4, apply() { zoneExtra++; recomputeZone(); } },

    { id: "coin", nameKey: "up_coin_name", descKey: "up_coin_desc", tagKey: "tag_points", max: 8, rarity: "common", weight: 10, apply() { coinValue += 2; } },
    { id: "gem", nameKey: "up_gem_name", descKey: "up_gem_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7, apply() { gemValue += 6; } },
    { id: "bonus", nameKey: "up_bonus_name", descKey: "up_bonus_desc", tagKey: "tag_points", max: 6, rarity: "rare", weight: 7, apply() { bonusValue += 10; } },

    { id: "reroll", nameKey: "up_reroll_name", descKey: "up_reroll_desc", tagKey: "tag_upgrades", max: 5, rarity: "rare", weight: 6, apply() { rerolls++; } },
    { id: "mult", nameKey: "up_mult_name", descKey: "up_mult_desc", tagKey: "tag_combo", max: 10, rarity: "epic", weight: 5, apply() { mult = clamp(mult + 0.10, 1.0, 4.0); } },
  ];

  const pickedCount = new Map();

  function isUpgradeAllowed(u) {
    // max picks
    if ((pickedCount.get(u.id) || 0) >= (u.max ?? 999)) return false;

    // v0.1.7: no ofrecer inferiores de una cadena si ya tienes superior
    if (u.id === "mag1") return magnet < 1;
    if (u.id === "mag2") return magnet < 2;
    if (u.id === "mag3") return magnet < 3;

    return true;
  }

  const canPick = (u) => isUpgradeAllowed(u);
  const markPick = (u) => pickedCount.set(u.id, (pickedCount.get(u.id) || 0) + 1);

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

  function chooseUpgrades(n = 3) {
    const pool = Upgrades.filter(canPick);
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

  let currentUpgradeChoices = [];

  function pauseForOverlay(on) {
    if (!running || gameOver) return;
    paused = !!on;
    AudioSys.duckMusic(paused || inLevelUp || gameOver);
  }

  // ───────────────────────── Upgrade Confetti FX (v0.1.7) ─────────────────────────
  let upFxCanvas = null, upFxCtx = null;
  const upConfetti = [];
  let upFxW = 0, upFxH = 0;

  function ensureUpgradeFxCanvas() {
    if (!overlayUpgrades) return;
    if (upFxCanvas && upFxCanvas.parentElement) return;

    try {
      const c = document.createElement("canvas");
      c.id = "upFxCanvas";
      c.style.position = "absolute";
      c.style.left = "0";
      c.style.top = "0";
      c.style.width = "100%";
      c.style.height = "100%";
      c.style.pointerEvents = "none";
      c.style.zIndex = "0"; // detrás del panel (si tu panel tiene z mayor)
      overlayUpgrades.style.position = overlayUpgrades.style.position || "relative";
      overlayUpgrades.appendChild(c);

      upFxCanvas = c;
      upFxCtx = c.getContext("2d", { alpha: true });

      resizeUpgradeFxCanvas();
    } catch {}
  }

  function resizeUpgradeFxCanvas() {
    if (!upFxCanvas || !overlayUpgrades) return;
    const r = overlayUpgrades.getBoundingClientRect();
    const d = Math.max(1, Math.min(2.0, window.devicePixelRatio || 1));
    upFxW = Math.max(1, Math.floor(r.width));
    upFxH = Math.max(1, Math.floor(r.height));
    upFxCanvas.width = Math.floor(upFxW * d);
    upFxCanvas.height = Math.floor(upFxH * d);
    try { upFxCtx.setTransform(d, 0, 0, d, 0, 0); } catch {}
  }

  function rarityLabel(r) {
    if (r === "rare") return I18n.t("rarity_rare");
    if (r === "epic") return I18n.t("rarity_epic");
    if (r === "legendary") return I18n.t("rarity_legendary");
    return I18n.t("rarity_common");
  }

  function confettiBurst(strength = 1) {
    ensureUpgradeFxCanvas();
    if (!upFxCtx) return;

    const n = clampInt(Math.round(60 * strength), 30, 120);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * upFxW;
      const y = -10 - Math.random() * 40;
      const sp = (120 + Math.random() * 260) * (0.7 + 0.6 * strength);
      const ang = (Math.PI * 0.35) + Math.random() * (Math.PI * 0.30);
      const vx = (Math.cos(ang) * sp) * (Math.random() < 0.5 ? -1 : 1) * 0.35;
      const vy = Math.sin(ang) * sp;

      const palette = [
        "rgba(255,211,90,0.95)",
        "rgba(106,176,255,0.95)",
        "rgba(46,242,160,0.95)",
        "rgba(214,133,255,0.95)",
        "rgba(255,120,160,0.95)",
      ];

      upConfetti.push({
        x, y, vx, vy,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() * 8 - 4),
        w: 4 + Math.random() * 8,
        h: 6 + Math.random() * 12,
        life: 1100 + Math.random() * 900,
        max: 2200,
        col: palette[randi(0, palette.length - 1)],
        kind: Math.random() < 0.65 ? "rect" : "tri",
      });
    }
    if (upConfetti.length > 420) upConfetti.splice(0, upConfetti.length - 420);
  }

  function tickUpgradeFx(dtMs) {
    if (!upFxCtx || !overlayUpgrades || overlayUpgrades.hidden) {
      // si no está visible, limpiamos suave
      if (upFxCtx && upFxCanvas) {
        try { upFxCtx.clearRect(0, 0, upFxW, upFxH); } catch {}
      }
      upConfetti.length = 0;
      return;
    }

    const dt = dtMs / 1000;
    const g = 520;
    for (let i = upConfetti.length - 1; i >= 0; i--) {
      const p = upConfetti[i];
      p.life -= dtMs;
      if (p.life <= 0 || p.y > upFxH + 80) { upConfetti.splice(i, 1); continue; }

      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      // wrap x
      if (p.x < -40) p.x = upFxW + 40;
      if (p.x > upFxW + 40) p.x = -40;
    }

    // draw
    upFxCtx.clearRect(0, 0, upFxW, upFxH);
    upFxCtx.save();
    upFxCtx.globalCompositeOperation = "lighter";
    for (const p of upConfetti) {
      const t = clamp(p.life / p.max, 0, 1);
      const a = clamp(0.92 * t, 0, 0.92);
      upFxCtx.globalAlpha = a;
      upFxCtx.fillStyle = p.col;

      upFxCtx.save();
      upFxCtx.translate(p.x, p.y);
      upFxCtx.rotate(p.rot);

      if (p.kind === "tri") {
        upFxCtx.beginPath();
        upFxCtx.moveTo(0, -p.h * 0.5);
        upFxCtx.lineTo(-p.w * 0.5, p.h * 0.5);
        upFxCtx.lineTo(p.w * 0.5, p.h * 0.5);
        upFxCtx.closePath();
        upFxCtx.fill();
      } else {
        upFxCtx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
      }

      upFxCtx.restore();
    }
    upFxCtx.restore();
    upFxCtx.globalAlpha = 1;
  }

  function openUpgrade() {
    if (inLevelUp || gameOver) return;
    inLevelUp = true;
    pauseForOverlay(true);

    level++;
    levelStartScore = score;
    nextLevelAt = score + Math.round(240 + level * 150);

    if (upTitle) upTitle.textContent = I18n.t("up_level_title", level);
    if (upSub) upSub.textContent = I18n.t("up_choose");

    renderUpgradeChoices();
    overlayShow(overlayUpgrades);
    updatePillsNow();

    // v0.1.7: confetti
    confettiBurst(1.0 + Math.min(0.8, level * 0.03));

    AudioSys.sfx("level");
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
      const name = I18n.t(u.nameKey);
      const desc = I18n.t(u.descKey);
      const tag = I18n.t(u.tagKey);

      const rarity = (u.rarity || "common");
      const rarityText = rarityLabel(rarity);

      const card = document.createElement("div");
      card.className = "upCard";
      card.dataset.rarity = rarity;

      card.innerHTML = `
        <div class="upTitle">${name}</div>
        <div class="upDesc">${desc}</div>
        <div class="upMeta">
          <span class="upRarityBadge">${rarityText}</span>
          <span class="badge">${tag}</span>
          <span class="badge">Lv ${(pickedCount.get(u.id) || 0) + 1}/${u.max}</span>
        </div>
      `;

      card.addEventListener("click", () => {
        markPick(u);
        u.apply();

        // v0.1.7: feedback extra según rareza
        const burst = (rarity === "legendary") ? 1.9 : (rarity === "epic") ? 1.4 : (rarity === "rare") ? 1.15 : 1.0;
        confettiBurst(burst);

        showToast(I18n.t("toast_upgrade", name), 950);
        shake(120, 3);
        flash(
          (rarity === "legendary") ? "#ffd35a" :
          (rarity === "epic") ? "#d685ff" :
          (rarity === "rare") ? "#6ab0ff" : "#ffffff",
          120
        );
        AudioSys.sfx("pick");
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
    showToast(I18n.t("toast_reroll"), 650);
    shake(90, 2);
    flash("#ffd35a", 110);
    AudioSys.sfx("reroll");
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

  // v0.1.7: tile glows según upgrades de valor
  function drawTileGlow(x, y, t, usedAlpha) {
    // solo si no es usado
    const a = (1 - usedAlpha);
    if (a <= 0.01) return;

    let k = 0;
    if (t === CellType.Coin) k = clamp((coinValue - 10) / 16, 0, 1);
    else if (t === CellType.Gem) k = clamp((gemValue - 30) / 48, 0, 1);
    else if (t === CellType.Bonus) k = clamp((bonusValue - 60) / 80, 0, 1);
    if (k <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 * k * (0.55 + 0.45 * (1 + scoreBoost));
    const col =
      (t === CellType.Coin) ? "rgba(46,242,160,0.95)" :
      (t === CellType.Gem) ? "rgba(106,176,255,0.95)" :
      "rgba(255,211,90,0.95)";
    ctx.fillStyle = col;
    ctx.fillRect(x, y, cellPx, cellPx);
    ctx.restore();
  }

  function draw(dtMs = 16) {
    if (!ctx) return;
    if (!gridReady || !ensureGridValid()) return;

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

    // v0.1.7: stars background
    if (bgStars.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const st of bgStars) {
        const tw = 0.55 + 0.45 * Math.sin(st.t);
        const a = clamp(st.a * tw, 0, 0.24);
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (hitFlashT > 0) {
      const t = clamp(hitFlashT / hitFlashMax, 0, 1);
      const a = 0.55 * (t * t);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = hitFlashColor;
      ctx.fillRect(0, 0, cssCanvasW, cssCanvasH);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,0.028)";
    ctx.fillRect(offX, offY, gridW, gridH);

    const zTop = offY + zoneY0 * cellPx;
    const zoneA = 0.070 + 0.06 * zonePulse;
    ctx.fillStyle = `rgba(106,176,255,${zoneA.toFixed(3)})`;
    ctx.fillRect(offX, zTop, gridW, zoneH * cellPx);

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offX + 0.5, zTop + 0.5, gridW - 1, zoneH * cellPx - 1);
    ctx.globalAlpha = 1;

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

        // v0.1.7: glow por upgrades de valor
        if (!used && (t === CellType.Coin || t === CellType.Gem || t === CellType.Bonus)) {
          drawTileGlow(x, y, t, 0);
        }

        const ok = drawSprite(key, x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2, alpha);
        if (!ok) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = CELL_COLORS[t];
          ctx.fillRect(x + pad, y + pad, cellPx - pad * 2, cellPx - pad * 2);
          ctx.globalAlpha = 1;
        }

        // v0.1.7: trap resist feedback (outline suave)
        if (!used && t === CellType.Trap && trapResist > 0) {
          ctx.save();
          ctx.globalAlpha = clamp(0.10 + trapResist * 0.06, 0.10, 0.32);
          ctx.strokeStyle = "rgba(46,242,160,0.85)";
          ctx.lineWidth = Math.max(1, Math.floor(cellPx * 0.06));
          ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, cellPx - pad * 2 - 1, cellPx - pad * 2 - 1);
          ctx.restore();
        }
      }
    }

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

    let px = offX + colF * cellPx + psx;
    let py = offY + (zoneY0 + rowF) * cellPx + psy;

    const s = 1 + 0.08 * playerPulse;
    const cx = px + cellPx / 2;
    const cy = py + cellPx / 2;

    drawMagnetZone(cx, cy);

    // v0.1.7: aura suave por mult alto
    if (mult > 1.2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = (0.55 + (mult - 1) * 0.22) * cellPx;
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gg.addColorStop(0, "rgba(214,133,255,0.10)");
      gg.addColorStop(0.55, "rgba(106,176,255,0.06)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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

    // v0.1.7: stars
    initBgStars();

    // v0.1.7: upgrade fx canvas resize
    resizeUpgradeFxCanvas();

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
    AudioSys.unlock();
  }

  function bindInputs() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      AudioSys.unlock();

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
      AudioSys.unlock();
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
    if (paused) { overlayShow(overlayPaused); AudioSys.duckMusic(true); }
    else { overlayHide(overlayPaused); AudioSys.duckMusic(false); }
    AudioSys.sfx("ui");
  }

  function showOptions() {
    overlayShow(overlayOptions);
    pauseForOverlay(true);
    // v0.1.7: garantiza scroll usable
    try {
      requestAnimationFrame(() => {
        const body =
          overlayOptions?.querySelector?.("#optionsBody") ||
          overlayOptions?.querySelector?.(".panel") ||
          overlayOptions;
        if (body) body.scrollTop = 0;
      });
    } catch {}
    AudioSys.sfx("ui");
  }
  function hideOptions() {
    overlayHide(overlayOptions);
    if (!inLevelUp && !gameOver && running) pauseForOverlay(false);
    AudioSys.sfx("ui");
  }

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
    AudioSys.duckMusic(showMenu);
  }

  async function startRun() {
    await AudioSys.unlock();
    applyAudioSettingsNow();
    AudioSys.startMusic();

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

    AudioSys.duckMusic(false);
    AudioSys.sfx("ui");
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

    AudioSys.duckMusic(true);

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
        <div class="line"><span>${I18n.t("stats_reason")}</span><span>${reason}</span></div>
        <div class="line"><span>${I18n.t("stats_level")}</span><span>${level}</span></div>
        <div class="line"><span>${I18n.t("stats_time")}</span><span>${Math.round(runTime)}s</span></div>
        <div class="line"><span>${I18n.t("stats_streak")}</span><span>${streak}</span></div>
        <div class="line"><span>${I18n.t("stats_mult")}</span><span>${mult.toFixed(2)}</span></div>
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

    // v0.1.7: bg stars + upgrade confetti
    tickBgStars(dtMs);
    tickUpgradeFx(dtMs);
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

  function markUpdateAvailable(msg = null) {
    if (!pillUpdate) return;
    pillUpdate.hidden = false;
    setPill(pillUpdate, msg || I18n.t("pill_update"));
  }

  function requestAppReload() {
    if (running && !gameOver) {
      pendingReload = true;
      markUpdateAvailable(I18n.t("pill_update"));
      showToast(I18n.t("update_apply_end"), 1200);
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
        AudioSys.unlock();
        if (!deferredPrompt) return;
        btnInstall.disabled = true;
        try { deferredPrompt.prompt(); await deferredPrompt.userChoice; } catch {}
        deferredPrompt = null;
        btnInstall.hidden = true;
        btnInstall.disabled = false;
      });
    }

    pillUpdate?.addEventListener("click", () => {
      AudioSys.unlock();
      if (running && !gameOver) {
        pendingReload = true;
        showToast(I18n.t("update_apply_end_short"), 900);
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
        if (swReg.waiting) markUpdateAvailable(I18n.t("pill_update"));

        swReg.addEventListener("updatefound", () => {
          const nw = swReg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              markUpdateAvailable(I18n.t("pill_update"));
              showToast(I18n.t("update_available"), 1100);
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
    optNew.textContent = I18n.t("new_profile");
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
      AudioSys.unlock();
      if (profileSelect.value !== "__new__") {
        Auth.setActiveProfile?.(profileSelect.value);
        syncFromAuth();
        updatePillsNow();
      }
      refreshNewWrap();
    });

    btnNewProfile?.addEventListener("click", () => {
      AudioSys.unlock();
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
    btnPausedRestart = $("btnPausedRestart");

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

    optMusicOn = $("optMusicOn");
    optMusicVol = $("optMusicVol");
    optMusicVolValue = $("optMusicVolValue");
    optSfxVol = $("optSfxVol");
    optSfxVolValue = $("optSfxVolValue");
    optMuteAll = $("optMuteAll");
    btnTestAudio = $("btnTestAudio");

    optLang = $("optLang");

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

      // v0.1.7: UI patch styles
      injectPatchStyles017();

      // v0.1.7: confetti canvas init
      ensureUpgradeFxCanvas();

      setPill(pillVersion, `v${APP_VERSION}`);
      if (pillUpdate) pillUpdate.hidden = true;

      if (loadingSub) loadingSub.textContent = I18n.t("app_loading");
      setState("loading");

      syncFromAuth();

      applyAudioSettingsNow();

      recomputeZone();
      makeGrid();
      rerollCombo();

      initAuthUI();

      setupLanguageUI();
      applySettingsToUI();

      resize();
      window.addEventListener("resize", resize, { passive: true });
      window.visualViewport?.addEventListener?.("resize", resize, { passive: true });

      bindInputs();

      btnPause?.addEventListener("click", togglePause);
      btnOptions?.addEventListener("click", showOptions);

      btnResume?.addEventListener("click", () => { overlayHide(overlayPaused); pauseForOverlay(false); AudioSys.sfx("ui"); });
      btnQuitToStart?.addEventListener("click", async () => { AudioSys.sfx("ui"); await overlayFadeOut(overlayPaused); resetRun(true); });

      btnPausedRestart?.addEventListener("click", () => { AudioSys.sfx("ui"); resetRun(false); startRun(); });

      btnRetry?.addEventListener("click", () => { resetRun(false); startRun(); });
      btnBackToStart?.addEventListener("click", () => { resetRun(true); });
      btnRestart?.addEventListener("click", () => { resetRun(false); startRun(); });

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

      optMusicOn?.addEventListener("change", () => {
        AudioSys.unlock();
        settings.musicOn = !!optMusicOn.checked;
        applyAudioSettingsNow();
        saveSettings();
      });
      optMusicVol?.addEventListener("input", () => {
        AudioSys.unlock();
        settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.6"), 0, 1);
        if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
        applyAudioSettingsNow();
        saveSettings();
      });
      optSfxVol?.addEventListener("input", () => {
        AudioSys.unlock();
        settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.9"), 0, 1);
        if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
        applyAudioSettingsNow();
        saveSettings();
      });
      optMuteAll?.addEventListener("change", () => {
        AudioSys.unlock();
        settings.muteAll = !!optMuteAll.checked;
        applyAudioSettingsNow();
        saveSettings();
      });
      btnTestAudio?.addEventListener("click", async () => {
        await AudioSys.unlock();
        applyAudioSettingsNow();
        AudioSys.startMusic();
        AudioSys.sfx("coin");
        showToast(I18n.t("audio_ok"), 700);
      });

      if (optLang) {
        optLang.addEventListener("change", () => {
          const v = String(optLang.value || "auto");
          settings.lang = v;
          saveSettings();

          I18n.setLang(settings.lang);

          applySettingsToUI();

          updatePillsNow();
          renderComboUI();
          if (overlayUpgrades && !overlayUpgrades.hidden) renderUpgradeChoices();
          if (brandSub) brandSub.textContent = I18n.t("app_ready");
        });
      }

      btnRepairPWA?.addEventListener("click", repairPWA);

      btnClearLocal?.addEventListener("click", () => {
        const ok = confirm(I18n.t("confirm_clear_local"));
        if (!ok) return;
        localStorage.clear();
        location.reload();
      });

      btnErrClose?.addEventListener("click", () => overlayHide(overlayError));
      btnErrReload?.addEventListener("click", () => location.reload());

      btnReroll?.addEventListener("click", rerollUpgrades);
      btnSkipUpgrade?.addEventListener("click", () => { closeUpgrade(); showToast(I18n.t("toast_skip"), 650); AudioSys.sfx("ui"); });

      btnStart?.addEventListener("click", async () => {
        await AudioSys.unlock();

        if (Auth && profileSelect) {
          if (profileSelect.value === "__new__") {
            const nm = (startName?.value || "").trim();
            const p = Auth.createProfile?.(nm);
            if (!p) { showToast(I18n.t("name_min"), 900); return; }
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

      if (loadingSub) loadingSub.textContent = I18n.t("app_pwa");
      setupPWA();
      preloadSpritesWithTimeout(900);

      resetRun(true);

      lastT = performance.now();
      requestAnimationFrame(frame);

      const SPLASH_MIN_MS = 1400;
      const elapsed = performance.now() - bootStartedAt;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);

      setTimeout(async () => {
        await overlayFadeOut(overlayLoading, 180);
        overlayShow(overlayStart);
        setState("menu");
        if (brandSub) brandSub.textContent = I18n.t("app_ready");
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
