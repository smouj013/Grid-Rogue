/* app.js — Grid Rogue v1.1.0+ (STABLE + FULLSCREEN + AUDIO + I18N + PWA + SKILLS + SHOP/CHEST/KEY + ARCADE)
   ✅ Compatible con:
   - utils.js (window.GRUtils)
   - audio.js (window.AudioSys)
   - localization.js (window.I18n)
   - auth.js (window.Auth) si existe
   - rendiment.js (window.GRPerf) si existe (opcional)
   - skills.js (window.GRSkills) ✅ (Upgrades/Skills Pack + Discovery + Shop/Chest)

   Incluye:
   - Tiles: Shop / Chest / Key (aparecen SIEMPRE: garantizados + probabilidad)
   - Tienda: se abre al pisar Shop (compra con CASH)
   - Cofre: se abre al pisar Chest (consume 1 Key si tienes)
   - Llaves: se obtienen pisando Key
   - Integración REAL con skills.js:
     * chooseLevelUp / chooseShop / chooseChest
     * price(), pick(), rerolls, extra choices, discovery
     * stats puenteados a State (hp/hpMax/shields/magnet/etc)
   - Modo INFINITO (endless) + Modo ARCADE (campaña):
     * 5 zonas, 20 runs por zona (100 stages)
     * hasta 3 estrellas por run
     * desbloqueo progresivo y guardado por perfil
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1100P";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  // ───────────────────────── Version / Integraciones ─────────────────────────
  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.1.0");

  const U = (typeof window !== "undefined" && window.GRUtils) ? window.GRUtils : {};
  const AudioSys = (typeof window !== "undefined" && window.AudioSys) ? window.AudioSys : null;
  const I18n = (typeof window !== "undefined" && window.I18n) ? window.I18n : null;
  const Auth = (typeof window !== "undefined" && window.Auth) ? window.Auth : null;
  const GRPerf = (typeof window !== "undefined" && window.GRPerf) ? window.GRPerf : null;
  const GRSkills = (typeof window !== "undefined" && window.GRSkills) ? window.GRSkills : null;

  const perfNow = (() => {
    try { if (typeof performance !== "undefined" && performance.now) return () => performance.now(); } catch (_) {}
    return () => Date.now();
  })();

  const clamp = U.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const clampInt = U.clampInt || ((v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0)));
  const lerp = U.lerp || ((a, b, t) => a + (b - a) * t);

  const log = (...args) => { try { console.log("[GridRogue]", ...args); } catch (_) {} };
  const warn = (...args) => { try { console.warn("[GridRogue]", ...args); } catch (_) {} };
  const err = (...args) => { try { console.error("[GridRogue]", ...args); } catch (_) {} };

  const isTouch = (() => {
    try { return ("ontouchstart" in window) || (navigator && navigator.maxTouchPoints > 0); } catch (_) { return false; }
  })();

  // ───────────────────────── Storage (con migración) ─────────────────────────
  const KEY_NEW = "gridrogue_";
  const KEY_OLD = "gridrunner_";

  function lsGet(k, fb = null) {
    try {
      const v = localStorage.getItem(k);
      return (v == null) ? fb : v;
    } catch (_) { return fb; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, String(v)); } catch (_) {}
  }
  function lsDel(k) {
    try { localStorage.removeItem(k); } catch (_) {}
  }
  function lsGetJSON(k, fb = null) {
    const raw = lsGet(k, null);
    if (!raw) return fb;
    try { return JSON.parse(raw); } catch (_) { return fb; }
  }
  function lsSetJSON(k, obj) {
    try { localStorage.setItem(k, JSON.stringify(obj)); } catch (_) {}
  }

  function migrateOldKeys() {
    try {
      const keys = Object.keys(localStorage);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!k || typeof k !== "string") continue;
        if (!k.startsWith(KEY_OLD)) continue;
        const nk = KEY_NEW + k.slice(KEY_OLD.length);
        if (localStorage.getItem(nk) != null) continue;
        localStorage.setItem(nk, localStorage.getItem(k));
      }
    } catch (_) {}
  }

  // ───────────────────────── i18n helper ─────────────────────────
  function t(key, params, fallback) {
    try {
      if (I18n && typeof I18n.t === "function") {
        const out = I18n.t(key, params);
        if (out != null && String(out).trim() !== "") return String(out);
      }
    } catch (_) {}
    return (fallback != null) ? String(fallback) : String(key);
  }

  // ───────────────────────── HTML helpers ─────────────────────────
  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch (_) { return null; } };
  const $$ = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; } };

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === "class") e.className = String(v);
        else if (k === "text") e.textContent = String(v);
        else if (k === "html") e.innerHTML = String(v);
        else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, String(v));
      }
    }
    if (children && children.length) {
      for (const c of children) {
        if (c == null) continue;
        e.appendChild((typeof c === "string") ? document.createTextNode(c) : c);
      }
    }
    return e;
  }

  function safeAppend(parent, child) { try { parent.appendChild(child); } catch (_) {} }

  function ensureMetaViewport() {
    try {
      let m = $('meta[name="viewport"]');
      if (!m) {
        m = el("meta", { name: "viewport" });
        safeAppend(document.head, m);
      }
      const cur = String(m.getAttribute("content") || "");
      if (!cur.includes("viewport-fit=cover")) {
        const next = cur ? (cur + ",viewport-fit=cover") : "width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no";
        m.setAttribute("content", next);
      }
    } catch (_) {}
  }

  // ───────────────────────── UI base (crea si falta) ─────────────────────────
  function ensureRoot() {
    let root = $("#gr-root");
    if (root) return root;
    root = $("#app") || $("#root") || $("#main") || document.body;
    const wrap = el("div", { id: "gr-root", class: "gr-root" });
    if (root === document.body) safeAppend(document.body, wrap);
    else safeAppend(root, wrap);
    return wrap;
  }

  function ensureCanvas(root) {
    let c = $("#gr-canvas") || $("#gameCanvas") || $("canvas#canvas") || $("canvas");
    if (c && c.tagName === "CANVAS") {
      if (!c.id) c.id = "gr-canvas";
      c.classList.add("gr-canvas");
      return c;
    }
    c = el("canvas", { id: "gr-canvas", class: "gr-canvas", width: "640", height: "480" });
    safeAppend(root, c);
    return c;
  }

  function ensureOverlays(root) {
    let ov = $("#gr-overlays");
    if (!ov) {
      ov = el("div", { id: "gr-overlays", class: "gr-overlays", "aria-live": "polite" });
      safeAppend(root, ov);
    }

    let updatePill = $("#gr-update-pill");
    if (!updatePill) {
      updatePill = el("button", { id: "gr-update-pill", class: "gr-update-pill", type: "button", "aria-hidden": "true" }, []);
      updatePill.style.display = "none";
      safeAppend(ov, updatePill);
    }

    let toast = $("#gr-toast");
    if (!toast) {
      toast = el("div", { id: "gr-toast", class: "gr-toast", "aria-hidden": "true" });
      toast.style.display = "none";
      safeAppend(ov, toast);
    }

    let splash = $("#gr-splash");
    if (!splash) {
      splash = el("div", { id: "gr-splash", class: "gr-splash" }, [
        el("div", { class: "gr-splash-inner" }, [
          el("div", { class: "gr-title", text: "Grid Rogue" }),
          el("div", { class: "gr-subtitle", text: t("app.loading", null, "Cargando…") }),
          el("div", { class: "gr-splash-meta", text: `v${APP_VERSION}` })
        ])
      ]);
      safeAppend(ov, splash);
    }

    // Menú principal
    let menu = $("#gr-menu");
    if (!menu) {
      menu = el("div", { id: "gr-menu", class: "gr-menu", style: "display:none" }, [
        el("div", { class: "gr-menu-card" }, [
          el("div", { class: "gr-menu-header" }, [
            el("div", { class: "gr-menu-brand" }, [
              el("div", { class: "gr-menu-title", text: "Grid Rogue" }),
              el("div", { class: "gr-menu-version", text: `v${APP_VERSION}` })
            ]),
            el("div", { class: "gr-menu-actions" }, [
              el("button", { id: "gr-btn-install", class: "gr-btn gr-btn-ghost", type: "button" }, [
                el("span", { class: "gr-btn-text", text: t("ui.install", null, "Instalar") })
              ])
            ])
          ]),
          el("div", { class: "gr-menu-tabs" }, [
            el("button", { class: "gr-tab is-active", type: "button", "data-tab": "play", text: t("ui.play", null, "Jugar") }),
            el("button", { class: "gr-tab", type: "button", "data-tab": "modes", text: t("ui.modes", null, "Modos") }),
            el("button", { class: "gr-tab", type: "button", "data-tab": "options", text: t("ui.options", null, "Opciones") }),
            el("button", { class: "gr-tab", type: "button", "data-tab": "profile", text: t("ui.profile", null, "Perfil") }),
            el("button", { class: "gr-tab", type: "button", "data-tab": "credits", text: t("ui.credits", null, "Créditos") })
          ]),
          el("div", { class: "gr-menu-panels" }, [
            // PLAY
            el("div", { class: "gr-panel is-active", "data-panel": "play" }, [
              el("div", { class: "gr-panel-row" }, [
                el("div", { class: "gr-kpi" }, [
                  el("div", { class: "gr-kpi-label", text: t("ui.bestScore", null, "Mejor puntuación") }),
                  el("div", { id: "gr-bestscore", class: "gr-kpi-value", text: "0" })
                ]),
                el("div", { class: "gr-kpi" }, [
                  el("div", { class: "gr-kpi-label", text: t("ui.lastRun", null, "Última run") }),
                  el("div", { id: "gr-lastrun", class: "gr-kpi-value", text: "—" })
                ])
              ]),
              el("div", { class: "gr-panel-row" }, [
                el("div", { class: "gr-pill", id: "gr-play-summary", text: "" })
              ]),
              el("div", { class: "gr-panel-row" }, [
                el("button", { id: "gr-btn-start", class: "gr-btn gr-btn-primary", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.start", null, "Empezar") })
                ]),
                el("button", { id: "gr-btn-tutorial", class: "gr-btn gr-btn-ghost", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.howToPlay", null, "Cómo jugar") })
                ])
              ]),
              el("div", { class: "gr-panel-help" }, [
                el("div", { class: "gr-help-line", text: t("help.one", null, "Muévete por la cuadrícula. Cada paso cuenta.") }),
                el("div", { class: "gr-help-line", text: t("help.two", null, "Shop/Chest/Keys + Skills + Arcade con estrellas.") })
              ])
            ]),
            // MODES
            el("div", { class: "gr-panel", "data-panel": "modes" }, [
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.playMode", null, "Modo principal") }),
                el("div", { class: "gr-mode-grid" }, [
                  el("button", { class: "gr-mode is-active", type: "button", "data-playmode": "endless" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.endless", null, "Infinito") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.endlessDesc", null, "Run libre: score, builds y farmeo.") })
                  ]),
                  el("button", { class: "gr-mode", type: "button", "data-playmode": "arcade" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.arcade", null, "Arcade") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.arcadeDesc", null, "5 zonas × 20 runs. Hasta 3⭐ por run.") })
                  ])
                ])
              ]),
              // Endless variants
              el("div", { class: "gr-field", id: "gr-endless-variants" }, [
                el("div", { class: "gr-label", text: t("ui.endlessVariant", null, "Variante Infinito") }),
                el("div", { class: "gr-mode-grid" }, [
                  el("button", { class: "gr-submode is-active", type: "button", "data-mode": "classic" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.classic", null, "Clásico") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.classicDesc", null, "Endless equilibrado.") })
                  ]),
                  el("button", { class: "gr-submode", type: "button", "data-mode": "rush" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.rush", null, "Rush") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.rushDesc", null, "Tiempo límite. Ritmo alto.") })
                  ]),
                  el("button", { class: "gr-submode", type: "button", "data-mode": "zen" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.zen", null, "Zen") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.zenDesc", null, "Más chill. Menos castigo.") })
                  ]),
                  el("button", { class: "gr-submode", type: "button", "data-mode": "hardcore" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.hardcore", null, "Hardcore") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.hardcoreDesc", null, "Poca vida. Castigo alto.") })
                  ])
                ])
              ]),
              // Arcade selector
              el("div", { class: "gr-field", id: "gr-arcade-panel", style: "display:none" }, [
                el("div", { class: "gr-label", text: t("ui.arcadeSelect", null, "Selecciona run (Arcade)") }),
                el("div", { class: "gr-arcade-zones", id: "gr-arcade-zones" }),
                el("div", { class: "gr-arcade-stages", id: "gr-arcade-stages" }),
                el("div", { class: "gr-panel-help" }, [
                  el("div", { class: "gr-help-line", id: "gr-arcade-hint", text: "" })
                ])
              ])
            ]),
            // OPTIONS
            el("div", { class: "gr-panel", "data-panel": "options" }, [
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.language", null, "Idioma") }),
                el("select", { id: "gr-opt-lang", class: "gr-select" }, [])
              ]),
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.sfx", null, "SFX") }),
                el("input", { id: "gr-opt-sfx", class: "gr-range", type: "range", min: "0", max: "100", value: "70" })
              ]),
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.music", null, "Música") }),
                el("input", { id: "gr-opt-music", class: "gr-range", type: "range", min: "0", max: "100", value: "55" })
              ]),
              el("div", { class: "gr-field gr-field-inline" }, [
                el("label", { class: "gr-check" }, [
                  el("input", { id: "gr-opt-gridlines", type: "checkbox" }),
                  el("span", { class: "gr-check-text", text: t("ui.gridLines", null, "Mostrar líneas del grid") })
                ])
              ]),
              el("div", { class: "gr-field gr-field-inline" }, [
                el("label", { class: "gr-check" }, [
                  el("input", { id: "gr-opt-reduce", type: "checkbox" }),
                  el("span", { class: "gr-check-text", text: t("ui.reduceMotion", null, "Reducir animaciones") })
                ])
              ]),
              el("div", { class: "gr-panel-row" }, [
                el("button", { id: "gr-btn-reset", class: "gr-btn gr-btn-ghost", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.resetSettings", null, "Restablecer") })
                ])
              ])
            ]),
            // PROFILE
            el("div", { class: "gr-panel", "data-panel": "profile" }, [
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.activeProfile", null, "Perfil activo") }),
                el("div", { id: "gr-profile-active", class: "gr-pill", text: "default" })
              ]),
              el("div", { class: "gr-panel-row" }, [
                el("button", { id: "gr-btn-profile", class: "gr-btn gr-btn-ghost", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.manageProfiles", null, "Gestionar perfiles") })
                ])
              ]),
              el("div", { class: "gr-panel-help" }, [
                el("div", { class: "gr-help-line", text: t("help.profile", null, "Los records/progreso se guardan por perfil si tienes auth.js.") })
              ])
            ]),
            // CREDITS
            el("div", { class: "gr-panel", "data-panel": "credits" }, [
              el("div", { class: "gr-credits" }, [
                el("div", { class: "gr-credits-line", text: t("credits.line1", null, "Hecho con HTML5 + JS. Runs rápidas. Builds locas.") }),
                el("div", { class: "gr-credits-line", text: t("credits.line2", null, "© Todos los derechos reservados.") })
              ]),
              el("div", { class: "gr-panel-row" }, [
                el("button", { id: "gr-btn-license", class: "gr-btn gr-btn-ghost", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.license", null, "Licencia") })
                ])
              ])
            ])
          ])
        ])
      ]);
      safeAppend(ov, menu);
    }

    // HUD en juego
    let hud = $("#gr-hud");
    if (!hud) {
      hud = el("div", { id: "gr-hud", class: "gr-hud", style: "display:none" }, [
        el("div", { class: "gr-hud-left" }, [
          el("button", { id: "gr-btn-pause", class: "gr-btn gr-btn-ghost gr-btn-sm", type: "button" }, [
            el("span", { class: "gr-btn-text", text: t("ui.pause", null, "Pausa") })
          ])
        ]),
        el("div", { class: "gr-hud-mid" }, [
          el("div", { class: "gr-hud-stat" }, [
            el("div", { class: "gr-hud-label", text: t("ui.score", null, "Puntos") }),
            el("div", { id: "gr-score", class: "gr-hud-value", text: "0" })
          ]),
          el("div", { class: "gr-hud-stat" }, [
            el("div", { class: "gr-hud-label", text: t("ui.cash", null, "Cash") }),
            el("div", { id: "gr-cash", class: "gr-hud-value", text: "0" })
          ]),
          el("div", { class: "gr-hud-stat" }, [
            el("div", { class: "gr-hud-label", text: t("ui.level", null, "Nivel") }),
            el("div", { id: "gr-level", class: "gr-hud-value", text: "1" })
          ]),
          el("div", { class: "gr-hud-stat" }, [
            el("div", { class: "gr-hud-label", text: t("ui.hp", null, "Vida") }),
            el("div", { id: "gr-hp", class: "gr-hud-value", text: "❤❤❤❤❤❤❤❤❤❤" })
          ])
        ]),
        el("div", { class: "gr-hud-right" }, [
          el("div", { id: "gr-badges", class: "gr-badges" })
        ])
      ]);
      safeAppend(ov, hud);
    }

    // Pause
    let pause = $("#gr-pause");
    if (!pause) {
      pause = el("div", { id: "gr-pause", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", text: t("ui.paused", null, "Pausa") }),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-btn-resume", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.resume", null, "Continuar") })
            ]),
            el("button", { id: "gr-btn-restart", class: "gr-btn gr-btn-ghost", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.restart", null, "Reiniciar") })
            ])
          ]),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-btn-exit", class: "gr-btn gr-btn-ghost", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.exit", null, "Salir al menú") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, pause);
    }

    // GameOver / Fail
    let over = $("#gr-gameover");
    if (!over) {
      over = el("div", { id: "gr-gameover", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", id: "gr-over-title", text: t("ui.gameOver", null, "Game Over") }),
          el("div", { class: "gr-modal-kpis" }, [
            el("div", { class: "gr-kpi" }, [
              el("div", { class: "gr-kpi-label", text: t("ui.score", null, "Puntos") }),
              el("div", { id: "gr-over-score", class: "gr-kpi-value", text: "0" })
            ]),
            el("div", { class: "gr-kpi" }, [
              el("div", { class: "gr-kpi-label", text: t("ui.bestScore", null, "Mejor") }),
              el("div", { id: "gr-over-best", class: "gr-kpi-value", text: "0" })
            ])
          ]),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-btn-again", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.playAgain", null, "Otra") })
            ]),
            el("button", { id: "gr-btn-menu", class: "gr-btn gr-btn-ghost", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.menu", null, "Menú") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, over);
    }

    // LevelUp picker
    let levelUp = $("#gr-levelup");
    if (!levelUp) {
      levelUp = el("div", { id: "gr-levelup", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card gr-levelup-card" }, [
          el("div", { class: "gr-modal-title", id: "gr-levelup-title", text: t("ui.levelUp", null, "Subes de nivel") }),
          el("div", { class: "gr-levelup-sub", id: "gr-levelup-sub", text: t("ui.chooseSkill", null, "Elige 1 mejora") }),
          el("div", { class: "gr-levelup-actions" }, [
            el("button", { id: "gr-levelup-reroll", class: "gr-btn gr-btn-ghost gr-btn-sm", type: "button" }, [
              el("span", { class: "gr-btn-text", id: "gr-levelup-reroll-txt", text: "" })
            ])
          ]),
          el("div", { class: "gr-levelup-choices", id: "gr-levelup-choices" })
        ])
      ]);
      safeAppend(ov, levelUp);
    }

    // Shop modal
    let shop = $("#gr-shop");
    if (!shop) {
      shop = el("div", { id: "gr-shop", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", text: t("ui.shop", null, "Tienda") }),
          el("div", { class: "gr-modal-body" }, [
            el("div", { class: "gr-shop-top" }, [
              el("div", { class: "gr-pill", id: "gr-shop-cash", text: "" }),
              el("div", { class: "gr-shop-actions" }, [
                el("button", { id: "gr-shop-reroll", class: "gr-btn gr-btn-ghost gr-btn-sm", type: "button" }, [
                  el("span", { class: "gr-btn-text", id: "gr-shop-reroll-txt", text: "" })
                ])
              ])
            ]),
            el("div", { class: "gr-shop-items", id: "gr-shop-items" })
          ]),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-shop-close", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.close", null, "Cerrar") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, shop);
    }

    // Chest modal
    let chest = $("#gr-chest");
    if (!chest) {
      chest = el("div", { id: "gr-chest", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", text: t("ui.chest", null, "Cofre") }),
          el("div", { class: "gr-modal-body" }, [
            el("div", { class: "gr-shop-top" }, [
              el("div", { class: "gr-pill", id: "gr-chest-keys", text: "" }),
              el("div", { class: "gr-shop-actions" }, [
                el("button", { id: "gr-chest-reroll", class: "gr-btn gr-btn-ghost gr-btn-sm", type: "button" }, [
                  el("span", { class: "gr-btn-text", id: "gr-chest-reroll-txt", text: "" })
                ])
              ])
            ]),
            el("div", { class: "gr-levelup-choices", id: "gr-chest-items" })
          ]),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-chest-close", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.close", null, "Cerrar") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, chest);
    }

    // Arcade clear modal
    let clear = $("#gr-arcadeclear");
    if (!clear) {
      clear = el("div", { id: "gr-arcadeclear", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", id: "gr-arcadeclear-title", text: t("ui.cleared", null, "Run completada") }),
          el("div", { class: "gr-modal-body" }, [
            el("div", { class: "gr-pill", id: "gr-arcadeclear-info", text: "" }),
            el("div", { class: "gr-arcade-stars", id: "gr-arcadeclear-stars", text: "⭐" })
          ]),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-arcadeclear-next", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.next", null, "Siguiente") })
            ]),
            el("button", { id: "gr-arcadeclear-menu", class: "gr-btn gr-btn-ghost", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.menu", null, "Menú") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, clear);
    }

    // Info modal
    let info = $("#gr-infomodal");
    if (!info) {
      info = el("div", { id: "gr-infomodal", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { id: "gr-infomodal-title", class: "gr-modal-title", text: "—" }),
          el("div", { id: "gr-infomodal-body", class: "gr-modal-body", text: "" }),
          el("div", { class: "gr-modal-row" }, [
            el("button", { id: "gr-infomodal-close", class: "gr-btn gr-btn-primary", type: "button" }, [
              el("span", { class: "gr-btn-text", text: t("ui.close", null, "Cerrar") })
            ])
          ])
        ])
      ]);
      safeAppend(ov, info);
    }

    // D-Pad
    let dpad = $("#gr-dpad");
    if (!dpad) {
      dpad = el("div", { id: "gr-dpad", class: "gr-dpad", style: "display:none" }, [
        el("button", { class: "gr-dpad-btn", type: "button", "data-dir": "up", "aria-label": "Up" }, ["▲"]),
        el("div", { class: "gr-dpad-mid" }, [
          el("button", { class: "gr-dpad-btn", type: "button", "data-dir": "left", "aria-label": "Left" }, ["◀"]),
          el("button", { class: "gr-dpad-btn", type: "button", "data-dir": "down", "aria-label": "Down" }, ["▼"]),
          el("button", { class: "gr-dpad-btn", type: "button", "data-dir": "right", "aria-label": "Right" }, ["▶"])
        ])
      ]);
      safeAppend(ov, dpad);
    }

    return { ov, splash, menu, hud, pause, over, levelUp, info, toast, updatePill, dpad, shop, chest, clear };
  }

  // ───────────────────────── Settings ─────────────────────────
  const SETTINGS_KEY = `${KEY_NEW}settings_v4`;
  const DEFAULT_SETTINGS = {
    lang: "auto",
    sfx: 0.70,
    music: 0.55,
    gridLines: true,
    reduceMotion: false
  };

  function loadSettings() {
    const s = lsGetJSON(SETTINGS_KEY, null);
    const out = Object.assign({}, DEFAULT_SETTINGS, (s && typeof s === "object") ? s : {});
    out.sfx = clamp(Number(out.sfx), 0, 1);
    out.music = clamp(Number(out.music), 0, 1);
    out.gridLines = !!out.gridLines;
    out.reduceMotion = !!out.reduceMotion;
    out.lang = (out.lang == null) ? "auto" : String(out.lang);
    return out;
  }

  function saveSettings(s) {
    const safe = {
      lang: String(s.lang || "auto"),
      sfx: clamp(Number(s.sfx), 0, 1),
      music: clamp(Number(s.music), 0, 1),
      gridLines: !!s.gridLines,
      reduceMotion: !!s.reduceMotion
    };
    lsSetJSON(SETTINGS_KEY, safe);
  }

  // ───────────────────────── RNG (seeded) ─────────────────────────
  function hashStrToSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────────────────────── Assets (sprites opcionales) ─────────────────────────
  const SPRITES = {
    block: "assets/sprites/tile_block.svg",
    bonus: "assets/sprites/tile_bonus.svg",
    coin: "assets/sprites/tile_coin.svg",
    gem: "assets/sprites/tile_gem.svg",
    trap: "assets/sprites/tile_trap.svg",
    shop: "assets/sprites/tile_shop.svg",
    chest: "assets/sprites/tile_chest.svg",
    key: "assets/sprites/tile_key.svg"
  };

  function loadImages(map) {
    const out = {};
    const entries = Object.entries(map || {});
    let pending = entries.length;
    if (!pending) return Promise.resolve(out);

    return new Promise((resolve) => {
      const done = () => { pending--; if (pending <= 0) resolve(out); };
      for (const [k, path] of entries) {
        try {
          const img = new Image();
          img.onload = () => { out[k] = img; done(); };
          img.onerror = () => { done(); };
          img.src = new URL(path, document.baseURI).toString();
        } catch (_) { done(); }
      }
    });
  }

  // ───────────────────────── Game model ─────────────────────────
  const Tile = {
    Empty: 0,
    Block: 1,
    Coin: 2,
    Gem: 3,
    Bonus: 4,
    Trap: 5,
    Key: 6,
    Chest: 7,
    Shop: 8
  };

  const MODE_DEF = {
    classic:   { id: "classic",   hp: 10, timeLimitSec: 0,   trapEnabled: true,  scoreMult: 1.00 },
    rush:      { id: "rush",      hp: 10, timeLimitSec: 90,  trapEnabled: true,  scoreMult: 1.10 },
    zen:       { id: "zen",       hp: 10, timeLimitSec: 0,   trapEnabled: false, scoreMult: 0.92 },
    hardcore:  { id: "hardcore",  hp: 5,  timeLimitSec: 0,   trapEnabled: true,  scoreMult: 1.25 }
  };

  // Arcade: 5 zonas × 20 stages = 100
  const ARCADE_ZONES = 5;
  const ARCADE_STAGES_PER_ZONE = 20;

  function arcadeStageId(z, s) { return `z${z}_s${s}`; }

  function buildArcadeStageConfig(z, s) {
    const zone = clampInt(z, 0, ARCADE_ZONES - 1);
    const stage = clampInt(s, 0, ARCADE_STAGES_PER_ZONE - 1);

    // Dificultad progresiva
    const globalIndex = zone * ARCADE_STAGES_PER_ZONE + stage; // 0..99
    const targetScore = 650 + globalIndex * 140 + zone * 250;
    const maxSteps = 120 + globalIndex * 3 + zone * 10;
    const timeLimitSec = (globalIndex >= 10) ? (95 - Math.min(35, zone * 4 + Math.floor(globalIndex / 6) * 2)) : 0;

    return {
      zone,
      stage,
      id: arcadeStageId(zone, stage),
      targetScore: Math.round(targetScore),
      maxSteps: Math.round(maxSteps),
      timeLimitSec: Math.max(0, timeLimitSec | 0)
    };
  }

  // Estado runtime
  const State = {
    booted: false,
    running: false,
    paused: false,
    gameOver: false,

    // modo principal
    playMode: "endless", // "endless" | "arcade"
    mode: "classic",     // variantes endless
    arcade: null,        // config stage arcade si aplica

    w: 8,
    h: 16,

    seed: 0,
    rng: Math.random,

    grid: null,
    px: 0,
    py: 0,

    score: 0,
    cash: 0,
    steps: 0,

    combo: 0,
    comboTimer: 0, // ms

    level: 1,
    xp: 0,
    xpNeed: 30,

    // timers
    timeLeftMs: 0, // rush o arcade si usa tiempo

    // render
    cellPx: 24,
    offX: 0,
    offY: 0,

    // PWA update
    pendingReload: false,

    // skills
    skills: null,        // objeto retornado por GRSkills.create(...)
    skillsMeta: null,    // { picksMap, discoveredSet }
    stats: {
      HP_START: 10,
      HP_CAP: 24,

      hp: 10,
      hpMax: 10,

      shields: 0,
      shieldOnLevelUp: 0,
      blockResist: 0,

      regenEvery: 0,
      regenAmount: 0,

      revives: 0,

      magnet: 0,
      magnetTime: 0, // segundos restantes

      trapResist: 0,
      trapHealChance: 0,

      zoneExtra: 0,

      scoreBoost: 0, // porcentaje (0.08 = +8%)
      coinValue: 10,
      gemValue: 25,
      bonusValue: 50,

      stepScoreBonus: 0,

      mult: 1.0,
      comboTimeBonus: 0,

      rerolls: 0,
      extraUpgradeChoices: 0,

      keys: 0,

      shopDiscount: 0,
      shopPicks: 3,

      chestLuck: 0,
      chestPicks: 3
    }
  };

  // ───────────────────────── Toast ─────────────────────────
  let toastTimer = 0;
  function toast(msg) {
    const node = document.getElementById("gr-toast");
    if (!node) return;
    node.textContent = String(msg || "");
    node.style.display = "block";
    node.setAttribute("aria-hidden", "false");
    try { node.classList.remove("is-show"); void node.offsetWidth; node.classList.add("is-show"); } catch (_) {}
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.style.display = "none";
      node.setAttribute("aria-hidden", "true");
      try { node.classList.remove("is-show"); } catch (_) {}
    }, 1750);
  }

  // ───────────────────────── Audio wrappers ─────────────────────────
  function applyAudioSettings(settings) {
    if (!AudioSys) return;
    try {
      if (typeof AudioSys.setSfxVolume === "function") AudioSys.setSfxVolume(settings.sfx);
      if (typeof AudioSys.setMusicVolume === "function") AudioSys.setMusicVolume(settings.music);
    } catch (_) {}
  }

  function unlockAudio() {
    if (!AudioSys) return;
    try {
      if (typeof AudioSys.unlock === "function") AudioSys.unlock();
      else if (typeof AudioSys.init === "function") AudioSys.init();
    } catch (_) {}
  }

  function sfx(id) {
    if (!AudioSys) return;
    try {
      if (typeof AudioSys.playSFX === "function") AudioSys.playSFX(id);
      else if (typeof AudioSys.sfx === "function") AudioSys.sfx(id);
    } catch (_) {}
  }

  function music(id) {
    if (!AudioSys) return;
    try {
      if (typeof AudioSys.playMusic === "function") AudioSys.playMusic(id);
      else if (typeof AudioSys.music === "function") AudioSys.music(id);
    } catch (_) {}
  }

  // ───────────────────────── PWA / SW Update (anti reload loop) ─────────────────────────
  const SW_COOLDOWN_MS = 12_000;
  const SW_RELOAD_KEY = `${KEY_NEW}sw_last_reload_at`;
  const SW_TAG_KEY = `${KEY_NEW}sw_reload_tag`;
  const SW_TAG = `${APP_VERSION}_${Date.now()}`;

  function canReloadBySW() {
    const last = Number(lsGet(SW_RELOAD_KEY, "0")) || 0;
    const now = Date.now();
    if (now - last < SW_COOLDOWN_MS) return false;
    const prevTag = String(lsGet(SW_TAG_KEY, ""));
    if (prevTag && prevTag === SW_TAG) return false;
    return true;
  }
  function markReloadBySW() {
    lsSet(SW_RELOAD_KEY, String(Date.now()));
    lsSet(SW_TAG_KEY, SW_TAG);
  }
  function showUpdatePill(text, onClick) {
    const pill = document.getElementById("gr-update-pill");
    if (!pill) return;
    pill.textContent = String(text || t("ui.updateAvailable", null, "Actualización disponible"));
    pill.style.display = "inline-flex";
    pill.setAttribute("aria-hidden", "false");
    pill.onclick = null;
    pill.onclick = (e) => { try { e.preventDefault(); } catch (_) {} onClick && onClick(); };
  }
  function hideUpdatePill() {
    const pill = document.getElementById("gr-update-pill");
    if (!pill) return;
    pill.style.display = "none";
    pill.setAttribute("aria-hidden", "true");
    pill.onclick = null;
  }
  function applyUpdateNow() {
    if (State.running && !State.gameOver) {
      State.pendingReload = true;
      toast(t("toast.updateLater", null, "Se aplicará al terminar la run."));
      return;
    }
    if (!canReloadBySW()) {
      toast(t("toast.updateBlocked", null, "Update detectado, pero se evitó un bucle de recarga."));
      return;
    }
    markReloadBySW();
    try { location.reload(); } catch (_) {}
  }
  function setupServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try { navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {}); } catch (_) {}

    try {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        showUpdatePill(t("ui.applyUpdate", null, "Aplicar update"), () => applyUpdateNow());
      });
    } catch (_) {}

    try {
      navigator.serviceWorker.ready.then((reg) => {
        if (!reg) return;
        if (reg.waiting) {
          showUpdatePill(t("ui.applyUpdate", null, "Aplicar update"), () => {
            try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch (_) {}
            applyUpdateNow();
          });
        }
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              showUpdatePill(t("ui.applyUpdate", null, "Aplicar update"), () => {
                try { nw.postMessage({ type: "SKIP_WAITING" }); } catch (_) {}
                applyUpdateNow();
              });
            }
          });
        });
      }).catch(() => {});
    } catch (_) {}
  }

  // ───────────────────────── Grid helpers ─────────────────────────
  function allocGrid(w, h) {
    const arr = new Uint8Array(w * h);
    arr.fill(Tile.Empty);
    return arr;
  }
  function idx(x, y) { return y * State.w + x; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < State.w && y < State.h; }
  function getTile(x, y) {
    if (!inside(x, y)) return Tile.Block;
    return State.grid[idx(x, y)];
  }
  function setTile(x, y, v) {
    if (!inside(x, y)) return;
    State.grid[idx(x, y)] = v;
  }

  // ───────────────────────── Arcade Progress (por perfil) ─────────────────────────
  function getActiveProfileId() {
    if (Auth && typeof Auth.getActiveProfileId === "function") {
      try { return String(Auth.getActiveProfileId() || "default"); } catch (_) { return "default"; }
    }
    return "default";
  }

  function arcadeSaveKey(profileId) { return `${KEY_NEW}arcade_${profileId}_v1`; }

  function loadArcadeProgress(profileId) {
    const d = lsGetJSON(arcadeSaveKey(profileId), null);
    if (d && typeof d === "object") return d;
    return {
      unlocked: { zone: 0, stage: 0 }, // máximo desbloqueado
      stars: {} // id -> bestStars
    };
  }
  function saveArcadeProgress(profileId, prog) {
    if (!prog || typeof prog !== "object") return;
    lsSetJSON(arcadeSaveKey(profileId), prog);
  }

  function isStageUnlocked(prog, zone, stage) {
    const uz = clampInt(prog?.unlocked?.zone ?? 0, 0, ARCADE_ZONES - 1);
    const us = clampInt(prog?.unlocked?.stage ?? 0, 0, ARCADE_STAGES_PER_ZONE - 1);
    if (zone < uz) return true;
    if (zone > uz) return false;
    return stage <= us;
  }

  function getBestStars(prog, zone, stage) {
    const id = arcadeStageId(zone, stage);
    const v = prog?.stars ? (prog.stars[id] | 0) : 0;
    return clampInt(v, 0, 3);
  }

  function setBestStars(prog, zone, stage, stars) {
    const id = arcadeStageId(zone, stage);
    prog.stars[id] = Math.max(getBestStars(prog, zone, stage), clampInt(stars, 0, 3));
  }

  function unlockNextStage(prog, zone, stage) {
    // desbloquea el siguiente stage linealmente
    let z = zone, s = stage + 1;
    if (s >= ARCADE_STAGES_PER_ZONE) { s = 0; z = zone + 1; }
    if (z >= ARCADE_ZONES) return; // terminado todo
    const curZ = clampInt(prog.unlocked.zone, 0, ARCADE_ZONES - 1);
    const curS = clampInt(prog.unlocked.stage, 0, ARCADE_STAGES_PER_ZONE - 1);

    // si el nuevo es más avanzado, aplica
    if (z > curZ || (z === curZ && s > curS)) {
      prog.unlocked.zone = z;
      prog.unlocked.stage = s;
    }
  }

  // ───────────────────────── Best score por perfil ─────────────────────────
  function getBestScore(profileId) {
    if (Auth && typeof Auth.getBestScore === "function") {
      try { return Number(Auth.getBestScore(profileId)) || 0; } catch (_) { return 0; }
    }
    return Number(lsGet(`${KEY_NEW}best_${profileId}`, "0")) || 0;
  }
  function setBestScore(profileId, v) {
    if (Auth && typeof Auth.setBestScore === "function") {
      try { Auth.setBestScore(profileId, v); return; } catch (_) {}
    }
    lsSet(`${KEY_NEW}best_${profileId}`, String(v | 0));
  }
  function setLastRun(profileId, score) { lsSet(`${KEY_NEW}last_${profileId}`, String(score | 0)); }
  function getLastRun(profileId) { return Number(lsGet(`${KEY_NEW}last_${profileId}`, "0")) || 0; }

  // ───────────────────────── Skills persistence + puente para skills.js ─────────────────────────
  function skillsSaveKey(profileId) { return `${KEY_NEW}skillsmeta_${profileId}_v1`; }

  function loadSkillsMeta(profileId) {
    const d = lsGetJSON(skillsSaveKey(profileId), null);
    const picksMap = new Map();
    const discoveredSet = new Set();

    if (d && typeof d === "object") {
      const picks = d.picks || {};
      for (const k of Object.keys(picks)) picksMap.set(k, picks[k] | 0);
      const disc = Array.isArray(d.discovered) ? d.discovered : [];
      for (const x of disc) discoveredSet.add(String(x));
    }
    return { picksMap, discoveredSet };
  }

  function saveSkillsMeta(profileId) {
    if (!State.skillsMeta) return;
    const obj = { picks: {}, discovered: [] };
    try {
      for (const [k, v] of State.skillsMeta.picksMap.entries()) obj.picks[k] = v | 0;
      obj.discovered = Array.from(State.skillsMeta.discoveredSet.values());
    } catch (_) {}
    lsSetJSON(skillsSaveKey(profileId), obj);
  }

  function defineBridgeProp(obj, key, getter, setter) {
    try {
      Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: false,
        get: getter,
        set: setter
      });
    } catch (_) {
      // fallback: asigna valor plano (no ideal, pero evita crash)
      try { obj[key] = getter(); } catch (_) {}
    }
  }

  function ensureSkillsSystem(profileId) {
    if (!GRSkills || typeof GRSkills.create !== "function") return null;
    if (State.skills) return State.skills;

    State.skillsMeta = loadSkillsMeta(profileId);

    const api = {};

    // constantes (skills.js usa api.HP_CAP / api.HP_START)
    api.HP_CAP = State.stats.HP_CAP | 0;
    api.HP_START = State.stats.HP_START | 0;

    // callbacks opcionales que skills.js invoca
    api.updateStatusHUD = () => { updateHUD(); draw(); };
    api.recomputeZone = () => { /* zone se lee directo de State.stats.zoneExtra */ };

    // discovery
    api.discoveredSet = State.skillsMeta.discoveredSet;
    api.onDiscover = () => { saveSkillsMeta(profileId); };

    // puentea propiedades que skills.js lee y escribe
    const P = [
      "hp","hpMax","shields","shieldOnLevelUp","blockResist",
      "regenEvery","regenAmount","revives",
      "magnet","magnetTime",
      "trapResist","trapHealChance",
      "zoneExtra",
      "scoreBoost",
      "coinValue","gemValue","bonusValue",
      "stepScoreBonus",
      "mult","comboTimeBonus",
      "rerolls","extraUpgradeChoices",
      "keys",
      "shopDiscount","shopPicks",
      "chestLuck","chestPicks"
    ];

    for (const k of P) {
      defineBridgeProp(api, k,
        () => State.stats[k],
        (v) => {
          if (k === "mult") State.stats[k] = clamp(Number(v) || 1, 0.5, 4.0);
          else if (k === "scoreBoost" || k === "trapHealChance") State.stats[k] = clamp(Number(v) || 0, 0, 10);
          else if (k === "magnetTime" || k === "comboTimeBonus") State.stats[k] = clamp(Number(v) || 0, 0, 999);
          else if (k === "coinValue" || k === "gemValue" || k === "bonusValue") State.stats[k] = Math.max(1, (Number(v) || 1) | 0);
          else State.stats[k] = (Number(v) || 0);
        }
      );
    }

    // tiny helpers (skills.js usa api[key] directo, pero esto ayuda a ti)
    api.clamp = clamp;
    api.clampInt = clampInt;

    try {
      State.skills = GRSkills.create(api, State.skillsMeta.picksMap);
      return State.skills;
    } catch (e) {
      warn("GRSkills.create falló:", e);
      State.skills = null;
      return null;
    }
  }

  function spendReroll() {
    const r = State.stats.rerolls | 0;
    if (r <= 0) return false;
    State.stats.rerolls = r - 1;
    updateHUD();
    return true;
  }

  function maybeDiscoverSecretFromContext(kind) {
    // Para que los secretos “salgan” algún día:
    // al abrir Shop/Chest, 30% de descubrir 1 secreto desbloqueado.
    if (!State.skills || typeof State.skills.list !== "function") return;
    if (State.rng() > 0.30) return;

    try {
      const list = State.skills.list();
      const lvl = State.level | 0;
      const secretPool = list.filter(u => u && u.secret && (lvl >= (u.unlockAt|0)) && !State.skills.isDiscovered(u.id));
      if (!secretPool.length) return;
      const pick = secretPool[(State.rng() * secretPool.length) | 0];
      State.skills.discover(pick.id);
      saveSkillsMeta(getActiveProfileId());
      toast(t("toast.discover", null, "Has descubierto una mejora secreta."));
    } catch (_) {}
  }

  // ───────────────────────── Spawns de tiles (incluye Shop/Chest/Key) ─────────────────────────
  function randTile(rng, modeId) {
    const m = MODE_DEF[modeId] || MODE_DEF.classic;
    const r = rng();

    // Prob base (ajusta a gusto)
    // Bloques (peligrosos al chocar), traps, loot, y especiales raros
    // Especiales “no salen” => aquí y además garantía por run (ver placeSpecialTiles)
    if (r < 0.13) return Tile.Block;

    // especiales (raros)
    if (r < 0.140) return Tile.Key;
    if (r < 0.146) return Tile.Chest;
    if (r < 0.151) return Tile.Shop;

    // loot y vacío
    if (r < 0.54) return Tile.Coin;
    if (r < 0.70) return Tile.Empty;
    if (r < 0.88) return Tile.Gem;
    if (r < 0.965) return Tile.Bonus;

    if (m.trapEnabled) return Tile.Trap;
    return Tile.Empty;
  }

  function placeSpecialTilesGuarantee() {
    // Asegura que existen SIEMPRE: 1 shop, 2 chests, 3 keys (ajusta por arcade)
    const need = {
      shop: 1,
      chest: 2,
      key: 3
    };

    // en arcade, un poco más de keys/chests
    if (State.playMode === "arcade") {
      need.key = 4;
      need.chest = 3;
      need.shop = 1;
    }

    const attempts = 999;

    function placeOne(tileType) {
      for (let i = 0; i < attempts; i++) {
        const x = (State.rng() * State.w) | 0;
        const y = (State.rng() * State.h) | 0;
        if (x === State.px && y === State.py) continue;
        const cur = getTile(x, y);
        if (cur !== Tile.Empty && cur !== Tile.Coin && cur !== Tile.Gem && cur !== Tile.Bonus) continue;
        setTile(x, y, tileType);
        return true;
      }
      return false;
    }

    for (let i = 0; i < need.shop; i++) placeOne(Tile.Shop);
    for (let i = 0; i < need.chest; i++) placeOne(Tile.Chest);
    for (let i = 0; i < need.key; i++) placeOne(Tile.Key);
  }

  function generateGrid() {
    State.grid = allocGrid(State.w, State.h);

    for (let y = 0; y < State.h; y++) {
      for (let x = 0; x < State.w; x++) {
        let v = randTile(State.rng, State.mode);

        // centro despejado
        if (x === (State.w >> 1) && y === (State.h >> 1)) v = Tile.Empty;

        // borde algo más sólido
        if ((x === 0 || y === 0 || x === State.w - 1 || y === State.h - 1) && State.rng() < 0.18) {
          v = Tile.Block;
        }
        setTile(x, y, v);
      }
    }

    State.px = (State.w >> 1);
    State.py = (State.h >> 1);
    setTile(State.px, State.py, Tile.Empty);

    placeSpecialTilesGuarantee();
  }

  // ───────────────────────── Score / XP / combo / regen ─────────────────────────
  function addScore(raw) {
    const m = MODE_DEF[State.mode] || MODE_DEF.classic;

    const baseMult = clamp(Number(State.stats.mult) || 1, 0.5, 4.0);
    const modeMult = (State.playMode === "endless") ? (m.scoreMult || 1) : 1.0;

    const comboMult = 1 + Math.min(2.5, (State.combo | 0) * 0.08);
    const boostMult = 1 + clamp(Number(State.stats.scoreBoost) || 0, 0, 10);

    const gained = Math.round(raw * baseMult * modeMult * comboMult * boostMult);
    State.score += gained;
  }

  function addCash(raw) {
    // cash es “moneda para tienda”, escala como puntos base del tile
    const baseMult = clamp(Number(State.stats.mult) || 1, 0.5, 4.0);
    const gained = Math.max(1, Math.round(raw * 0.85 * baseMult));
    State.cash += gained;
  }

  function gainXP(xp) {
    State.xp += xp;
    while (State.xp >= State.xpNeed) {
      State.xp -= State.xpNeed;
      State.level++;
      State.xpNeed = Math.round(30 + Math.pow(State.level, 1.18) * 12);
      onLevelUp();
    }
  }

  function comboWindowMs() {
    const extra = clamp(Number(State.stats.comboTimeBonus) || 0, 0, 14);
    return 1600 + Math.round(extra * 1000);
  }

  function bumpCombo() {
    State.combo = clampInt(State.combo + 1, 0, 999);
    State.comboTimer = comboWindowMs();
    if (State.combo > 1) sfx("sfx_combo");
  }

  function tryRegenOnStep() {
    const every = (State.stats.regenEvery | 0);
    const amt = (State.stats.regenAmount | 0);
    if (every <= 0 || amt <= 0) return;
    if ((State.steps % every) !== 0) return;
    if ((State.stats.hp | 0) >= (State.stats.hpMax | 0)) return;
    State.stats.hp = clampInt((State.stats.hp | 0) + amt, 0, State.stats.hpMax | 0);
    toast(t("toast.regen", null, "+Vida (regen)"));
    sfx("sfx_pick");
  }

  // ───────────────────────── Daños / Revive / Block KO ─────────────────────────
  function consumeReviveIfNeeded() {
    if ((State.stats.hp | 0) > 0) return false;
    const r = (State.stats.revives | 0);
    if (r <= 0) return false;
    State.stats.revives = r - 1;
    State.stats.hp = 1;
    toast(t("toast.revive", null, "¡Fénix! Revives con 1♥"));
    sfx("sfx_levelup");
    return true;
  }

  function applyTrapHit() {
    // resistencia: chance de ignorar daño
    const resist = clampInt(State.stats.trapResist | 0, 0, 12);
    const ignoreChance = Math.min(0.85, resist * 0.15);
    if (ignoreChance > 0 && State.rng() < ignoreChance) {
      toast(t("toast.trapResist", null, "Resistes la trampa."));
      sfx("sfx_ui_click");
      return;
    }

    // escudo bloquea
    if ((State.stats.shields | 0) > 0) {
      State.stats.shields = (State.stats.shields | 0) - 1;
      toast(t("toast.shieldBlock", null, "Escudo bloqueó el golpe."));
      sfx("sfx_ui_click");
      updateHUD();
      return;
    }

    State.stats.hp = clampInt((State.stats.hp | 0) - 1, 0, State.stats.hpMax | 0);
    sfx("sfx_trap");

    // chance de curarte
    const ch = clamp(Number(State.stats.trapHealChance) || 0, 0, 0.95);
    if (ch > 0 && State.rng() < ch && (State.stats.hp | 0) < (State.stats.hpMax | 0)) {
      State.stats.hp = clampInt((State.stats.hp | 0) + 1, 0, State.stats.hpMax | 0);
      toast(t("toast.trapHeal", null, "Trampa… pero te curas +1♥"));
    } else {
      toast(t("toast.hit", null, "-1 vida."));
    }

    if ((State.stats.hp | 0) <= 0) {
      if (!consumeReviveIfNeeded()) endGame(false);
    }
    updateHUD();
  }

  function applyBlockHit(nx, ny) {
    // bloque = KO salvo escudos o blockResist
    const shields = (State.stats.shields | 0);
    if (shields > 0) {
      State.stats.shields = shields - 1;
      setTile(nx, ny, Tile.Empty);
      State.px = nx; State.py = ny; // atraviesas
      toast(t("toast.blockShield", null, "Rompes el bloque con escudo."));
      sfx("sfx_block");
      updateHUD();
      return true;
    }

    const br = (State.stats.blockResist | 0);
    if (br > 0) {
      State.stats.blockResist = br - 1;
      State.stats.hp = clampInt((State.stats.hp | 0) - 2, 0, State.stats.hpMax | 0);
      setTile(nx, ny, Tile.Empty);
      State.px = nx; State.py = ny;
      toast(t("toast.blockResist", null, "Anti-KO: -2♥ (salvado)"));
      sfx("sfx_block");
      if ((State.stats.hp | 0) <= 0) {
        if (!consumeReviveIfNeeded()) { endGame(false); return true; }
      }
      updateHUD();
      return true;
    }

    // KO directo
    toast(t("toast.blockKO", null, "KO por bloque."));
    sfx("sfx_ko");
    endGame(false);
    return true;
  }

  // ───────────────────────── Collect / Interacciones tiles ─────────────────────────
  function applyCollect(tileType) {
    const cv = Math.max(1, (State.stats.coinValue | 0));
    const gv = Math.max(1, (State.stats.gemValue | 0));
    const bv = Math.max(1, (State.stats.bonusValue | 0));

    if (tileType === Tile.Coin) {
      sfx("sfx_coin");
      addScore(cv);
      addCash(cv);
      gainXP(8);
      bumpCombo();
    } else if (tileType === Tile.Gem) {
      sfx("sfx_gem");
      addScore(gv);
      addCash(gv);
      gainXP(14);
      bumpCombo();
    } else if (tileType === Tile.Bonus) {
      sfx("sfx_bonus");
      addScore(bv);
      addCash(bv);
      gainXP(18);
      bumpCombo();
    } else if (tileType === Tile.Trap) {
      State.combo = 0;
      State.comboTimer = 0;
      applyTrapHit();
    } else if (tileType === Tile.Key) {
      sfx("sfx_pick");
      State.stats.keys = (State.stats.keys | 0) + 1;
      addScore(12);
      toast(t("toast.key", null, "+1 llave"));
    } else if (tileType === Tile.Shop) {
      sfx("sfx_ui_click");
      openShop();
    } else if (tileType === Tile.Chest) {
      sfx("sfx_ui_click");
      openChest();
    } else {
      // vacío
      State.combo = 0;
      State.comboTimer = 0;
    }
  }

  // ───────────────────────── Movement / Zone ─────────────────────────
  function zoneRange() {
    const z = clampInt(State.stats.zoneExtra | 0, 0, 9);
    return 1 + z;
  }

  function tryMove(dx, dy) {
    if (!State.running || State.paused || State.gameOver) return;

    const range = zoneRange();

    // stepScoreBonus por step real
    const stepBonus = clampInt(State.stats.stepScoreBonus | 0, 0, 40);

    for (let step = 0; step < range; step++) {
      const nx = State.px + dx;
      const ny = State.py + dy;

      const tt = getTile(nx, ny);

      if (tt === Tile.Block) {
        // bloque es “hit” (KO salvo defensa)
        applyBlockHit(nx, ny);
        break;
      }

      // mover 1 paso
      State.px = nx;
      State.py = ny;
      State.steps++;

      // objetivos arcade
      if (State.playMode === "arcade" && State.arcade) {
        if (State.steps >= (State.arcade.maxSteps | 0) && State.score < (State.arcade.targetScore | 0)) {
          toast(t("toast.failSteps", null, "Te quedaste sin pasos."));
          endGame(false);
          return;
        }
      }

      // score por paso
      if (stepBonus > 0) addScore(stepBonus);

      // pisa tile
      const stepped = tt;
      setTile(nx, ny, Tile.Empty);
      applyCollect(stepped);

      // magnet activo
      if ((State.stats.magnet | 0) > 0 && (State.stats.magnetTime | 0) > 0) {
        magnetPull();
      }

      // regen
      tryRegenOnStep();

      // respawn ligero
      respawnSomeTiles();

      // arcade: check win
      if (State.playMode === "arcade" && State.arcade) {
        if (State.score >= (State.arcade.targetScore | 0)) {
          endArcadeClear();
          return;
        }
      }

      if (State.gameOver) return;
      if (State.paused) break; // si abrió shop/chest, pausa

      // si el siguiente “sub-step” saldría del mapa, para
      if (!inside(State.px + dx, State.py + dy)) break;
    }

    updateHUD();
    draw();
  }

  function magnetPull() {
    const lvl = clampInt(State.stats.magnet | 0, 1, 3);
    const rad = (lvl === 1) ? 1 : (lvl === 2) ? 2 : 3;

    let best = null;
    let bestScore = -1;

    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const x = State.px + dx;
        const y = State.py + dy;
        if (!inside(x, y)) continue;
        if (dx === 0 && dy === 0) continue;

        const tt = getTile(x, y);
        let s = -1;
        if (tt === Tile.Bonus) s = 3;
        else if (tt === Tile.Gem) s = 2;
        else if (tt === Tile.Coin) s = 1;
        else continue;

        // prefer cerca
        const dist = Math.abs(dx) + Math.abs(dy);
        const score = s * 10 - dist;
        if (score > bestScore) { bestScore = score; best = [x, y, tt]; }
      }
    }

    if (best) {
      const [x, y, tt] = best;
      setTile(x, y, Tile.Empty);
      applyCollect(tt);
    }
  }

  function respawnSomeTiles() {
    // mantén tablero “vivo”, pero respeta especiales (no los sobreescribas)
    const rolls = (State.rng() < 0.55) ? 1 : 2;
    for (let i = 0; i < rolls; i++) {
      const x = (State.rng() * State.w) | 0;
      const y = (State.rng() * State.h) | 0;
      if (x === State.px && y === State.py) continue;
      const cur = getTile(x, y);
      if (cur !== Tile.Empty) continue;
      setTile(x, y, randTile(State.rng, State.mode));
    }
  }

  // ───────────────────────── LevelUp (skills.js real) ─────────────────────────
  function onLevelUp() {
    // shieldOnLevelUp
    const addS = clampInt(State.stats.shieldOnLevelUp | 0, 0, 6);
    if (addS > 0) State.stats.shields = (State.stats.shields | 0) + addS;

    sfx("sfx_levelup");
    openLevelUpPicker();
  }

  function getChoiceCountForLevelUp() {
    const base = 3;
    const extra = clampInt(State.stats.extraUpgradeChoices | 0, 0, 4);
    return base + extra;
  }

  function openLevelUpPicker() {
    State.paused = true;
    renderPauseState();

    const modal = $("#gr-levelup");
    const wrap = $("#gr-levelup-choices");
    const title = $("#gr-levelup-title");
    const sub = $("#gr-levelup-sub");
    const rerollBtn = $("#gr-levelup-reroll");
    const rerollTxt = $("#gr-levelup-reroll-txt");

    if (!modal || !wrap) return;

    title.textContent = t("ui.levelUp", null, `Nivel ${State.level}`);
    sub.textContent = t("ui.chooseSkill", null, "Elige 1 mejora");

    const n = getChoiceCountForLevelUp();
    const rerolls = (State.stats.rerolls | 0);
    if (rerollBtn && rerollTxt) {
      rerollTxt.textContent = (rerolls > 0) ? `${t("ui.reroll", null, "Reroll")} (${rerolls})` : t("ui.reroll0", null, "Sin rerolls");
      rerollBtn.style.display = "inline-flex";
      rerollBtn.disabled = !(rerolls > 0);
    }

    function rollChoices() {
      wrap.innerHTML = "";

      let choices = [];
      if (State.skills && typeof State.skills.chooseLevelUp === "function") {
        try {
          choices = State.skills.chooseLevelUp({ level: State.level, n });
        } catch (e) {
          warn("chooseLevelUp falló:", e);
          choices = [];
        }
      }

      if (!choices || !choices.length) {
        // fallback mínimo si algo raro
        choices = [];
      }

      const pick = (u) => {
        closeLevelUpPicker();
        if (u) {
          try {
            State.skills && State.skills.pick && State.skills.pick(u);
            saveSkillsMeta(getActiveProfileId());
          } catch (_) {}
          updateHUD();
          draw();
        }
      };

      for (const u of choices) {
        wrap.appendChild(makeUpgradeCard(u, {
          mode: "pick",
          onPick: () => pick(u)
        }));
      }
    }

    if (rerollBtn) {
      rerollBtn.onclick = () => {
        unlockAudio();
        if (!spendReroll()) return;
        sfx("sfx_reroll");
        rollChoices();
        const rr = (State.stats.rerolls | 0);
        if (rerollTxt) rerollTxt.textContent = (rr > 0) ? `${t("ui.reroll", null, "Reroll")} (${rr})` : t("ui.reroll0", null, "Sin rerolls");
        if (rerollBtn) rerollBtn.disabled = !(rr > 0);
        updateHUD();
      };
    }

    rollChoices();
    modal.style.display = "flex";
  }

  function closeLevelUpPicker() {
    const modal = $("#gr-levelup");
    if (modal) modal.style.display = "none";
    State.paused = false;
    renderPauseState();
  }

  // ───────────────────────── Shop / Chest UI ─────────────────────────
  function setModalVisible(id, show) {
    const m = $(id);
    if (!m) return;
    m.style.display = show ? "flex" : "none";
  }

  function openShop() {
    // pausa sin salir
    State.paused = true;
    renderPauseState();

    setModalVisible("#gr-shop", true);
    maybeDiscoverSecretFromContext("shop");
    renderShop();
  }

  function closeShop() {
    setModalVisible("#gr-shop", false);
    State.paused = false;
    renderPauseState();
    updateHUD();
    draw();
  }

  function openChest() {
    // si no tienes llave, no gastes tile (ya se convirtió a vacío en el step)
    const k = (State.stats.keys | 0);
    if (k <= 0) {
      toast(t("toast.needKey", null, "Necesitas una llave."));
      return;
    }

    // consume 1 llave al abrir
    State.stats.keys = k - 1;

    State.paused = true;
    renderPauseState();

    setModalVisible("#gr-chest", true);
    maybeDiscoverSecretFromContext("chest");
    renderChest();
  }

  function closeChest() {
    setModalVisible("#gr-chest", false);
    State.paused = false;
    renderPauseState();
    updateHUD();
    draw();
  }

  function rarityLabel(u) {
    try {
      const r = String(u?.rarity || "common");
      if (State.skills && State.skills.rarityMeta) return State.skills.rarityMeta(r).label || r;
      return r;
    } catch (_) { return String(u?.rarity || ""); }
  }

  function iconNode(u) {
    const icon = String(u?.icon || (State.skills && State.skills.upgradeIcon ? State.skills.upgradeIcon(u) : "") || "");
    if (!icon) return null;

    // Si tienes Material Symbols en index, esto se verá perfecto.
    const span = el("span", { class: "material-symbols-outlined gr-skill-icon", text: icon });
    return span;
  }

  function makeUpgradeCard(u, opts) {
    const name = String(u?.name || u?.title || u?.id || "");
    const desc = String(u?.desc || u?.description || "");
    const rarity = String(u?.rarity || "").toUpperCase();
    const tag = String(u?.tag || "");
    const ico = iconNode(u);

    const topLeft = el("div", { class: "gr-skill-name", text: name });
    const topRight = el("div", { class: "gr-skill-rarity", text: rarity });

    const top = el("div", { class: "gr-skill-top" }, [
      el("div", { class: "gr-skill-left" }, [ ico ? ico : el("span", { class: "gr-skill-icon-fb", text: "✦" }), topLeft ]),
      topRight
    ]);

    const meta = el("div", { class: "gr-skill-meta", text: tag ? `${tag} · ${rarityLabel(u)}` : `${rarityLabel(u)}` });
    const body = el("div", { class: "gr-skill-desc", text: desc });

    const card = el("button", { class: "gr-skill", type: "button" }, [ top, meta, body ]);

    if (opts?.mode === "pick") {
      card.addEventListener("click", () => { opts.onPick && opts.onPick(); });
    } else if (opts?.mode === "shop") {
      card.classList.add("gr-shop-card");
      // añade footer compra
      const price = (opts.price | 0);
      const canBuy = !!opts.canBuy;
      const footer = el("div", { class: "gr-shop-footer" }, [
        el("div", { class: "gr-pill", text: `💰 ${price}` }),
        el("button", { class: "gr-btn gr-btn-primary gr-btn-sm", type: "button" }, [
          el("span", { class: "gr-btn-text", text: canBuy ? t("ui.buy", null, "Comprar") : t("ui.noMoney", null, "Sin cash") })
        ])
      ]);

      footer.querySelector("button").disabled = !canBuy;
      footer.querySelector("button").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        opts.onBuy && opts.onBuy();
      });

      card.type = "button";
      card.disabled = false;
      card.addEventListener("click", () => { /* no-op, compra en botón */ });

      // convierte card a div para evitar doble click estilo
      const wrap = el("div", { class: "gr-shop-item" }, [ card, footer ]);
      return wrap;
    } else if (opts?.mode === "chest") {
      card.addEventListener("click", () => { opts.onPick && opts.onPick(); });
    }

    return card;
  }

  function renderShop() {
    const box = $("#gr-shop-items");
    const cashPill = $("#gr-shop-cash");
    const rerollBtn = $("#gr-shop-reroll");
    const rerollTxt = $("#gr-shop-reroll-txt");

    if (cashPill) cashPill.textContent = `💰 ${State.cash | 0}`;
    if (!box) return;
    box.innerHTML = "";

    const sys = State.skills;
    if (!sys || typeof sys.chooseShop !== "function" || typeof sys.price !== "function") {
      box.appendChild(el("div", { class: "gr-modal-body", text: "skills.js no disponible." }));
      return;
    }

    const n = clampInt(State.stats.shopPicks | 0, 3, 7);
    let offers = [];
    try { offers = sys.chooseShop({ level: State.level, n }); } catch (_) { offers = []; }

    const rerolls = (State.stats.rerolls | 0);
    if (rerollBtn && rerollTxt) {
      rerollTxt.textContent = (rerolls > 0) ? `${t("ui.reroll", null, "Reroll")} (${rerolls})` : t("ui.reroll0", null, "Sin rerolls");
      rerollBtn.disabled = !(rerolls > 0);
      rerollBtn.onclick = () => {
        unlockAudio();
        if (!spendReroll()) return;
        sfx("sfx_reroll");
        renderShop();
        updateHUD();
      };
    }

    for (const u of offers) {
      const price = sys.price(u, State.level) | 0;
      const canBuy = (State.cash | 0) >= price;

      box.appendChild(makeUpgradeCard(u, {
        mode: "shop",
        price,
        canBuy,
        onBuy: () => {
          unlockAudio();
          if (!canBuy) { sfx("sfx_block"); toast(t("toast.noMoney", null, "No tienes suficiente cash.")); return; }
          // compra
          State.cash = (State.cash | 0) - price;
          try {
            sys.pick(u);
            saveSkillsMeta(getActiveProfileId());
          } catch (_) {}
          sfx("sfx_upgrade");
          toast(t("toast.bought", null, "Comprado."));
          renderShop();
          updateHUD();
          draw();
        }
      }));
    }

    if (!offers.length) {
      box.appendChild(el("div", { class: "gr-modal-body", text: t("ui.noOffers", null, "No hay ofertas disponibles.") }));
    }
  }

  function renderChest() {
    const box = $("#gr-chest-items");
    const keysPill = $("#gr-chest-keys");
    const rerollBtn = $("#gr-chest-reroll");
    const rerollTxt = $("#gr-chest-reroll-txt");

    if (keysPill) keysPill.textContent = `🔑 ${State.stats.keys | 0}`;
    if (!box) return;
    box.innerHTML = "";

    const sys = State.skills;
    if (!sys || typeof sys.chooseChest !== "function") {
      box.appendChild(el("div", { class: "gr-modal-body", text: "skills.js no disponible." }));
      return;
    }

    const n = clampInt(State.stats.chestPicks | 0, 3, 7);
    let offers = [];
    try { offers = sys.chooseChest({ level: State.level, n }); } catch (_) { offers = []; }

    const rerolls = (State.stats.rerolls | 0);
    if (rerollBtn && rerollTxt) {
      rerollTxt.textContent = (rerolls > 0) ? `${t("ui.reroll", null, "Reroll")} (${rerolls})` : t("ui.reroll0", null, "Sin rerolls");
      rerollBtn.disabled = !(rerolls > 0);
      rerollBtn.onclick = () => {
        unlockAudio();
        if (!spendReroll()) return;
        sfx("sfx_reroll");
        renderChest();
        updateHUD();
      };
    }

    for (const u of offers) {
      box.appendChild(makeUpgradeCard(u, {
        mode: "chest",
        onPick: () => {
          unlockAudio();
          try {
            sys.pick(u);
            saveSkillsMeta(getActiveProfileId());
          } catch (_) {}
          sfx("sfx_pick");
          toast(t("toast.chestPick", null, "Loot obtenido."));
          closeChest();
        }
      }));
    }

    if (!offers.length) {
      box.appendChild(el("div", { class: "gr-modal-body", text: t("ui.noOffers", null, "No hay loot disponible.") }));
    }
  }

  // ───────────────────────── HUD ─────────────────────────
  function setText(id, txt) { const n = document.getElementById(id); if (n) n.textContent = String(txt); }

  function hearts(hp, maxHp) {
    const full = "❤";
    const empty = "♡";
    const a = clampInt(hp, 0, 999);
    const b = clampInt(maxHp, 0, 999);
    let s = "";
    for (let i = 0; i < b; i++) s += (i < a) ? full : empty;
    return s;
  }

  function setBadgesUI() {
    const wrap = document.getElementById("gr-badges");
    if (!wrap) return;
    wrap.innerHTML = "";

    const badges = [];
    if ((State.stats.shields | 0) > 0) badges.push({ id: "shield", text: `🛡 ${State.stats.shields | 0}` });
    if ((State.stats.blockResist | 0) > 0) badges.push({ id: "antiko", text: `🧱 ${State.stats.blockResist | 0}` });
    if ((State.stats.keys | 0) > 0) badges.push({ id: "keys", text: `🔑 ${State.stats.keys | 0}` });
    if ((State.stats.magnet | 0) > 0 && (State.stats.magnetTime | 0) > 0) {
      badges.push({ id: "magnet", text: `🧲 ${Math.ceil(State.stats.magnetTime | 0)}s` });
    }
    if ((State.stats.scoreBoost | 0) > 0) {
      const p = Math.round((Number(State.stats.scoreBoost) || 0) * 100);
      badges.push({ id: "boost", text: `✦ +${p}%` });
    }
    if (State.playMode === "endless" && State.mode === "rush" && State.running) {
      badges.push({ id: "timer", text: `⏱ ${Math.max(0, Math.ceil(State.timeLeftMs / 1000))}s` });
    }
    if (State.playMode === "arcade" && State.arcade && State.running) {
      const goal = State.arcade.targetScore | 0;
      const left = Math.max(0, (State.arcade.maxSteps | 0) - (State.steps | 0));
      badges.push({ id: "goal", text: `🎯 ${State.score}/${goal}` });
      badges.push({ id: "steps", text: `👣 ${left}` });
      if ((State.arcade.timeLimitSec | 0) > 0) {
        badges.push({ id: "timer", text: `⏱ ${Math.max(0, Math.ceil(State.timeLeftMs / 1000))}s` });
      }
    }

    for (const b of badges) wrap.appendChild(el("div", { class: "gr-badge", "data-badge": b.id, text: b.text }));
  }

  function updateHUD() {
    setText("gr-score", State.score | 0);
    setText("gr-cash", State.cash | 0);
    setText("gr-level", State.level | 0);
    setText("gr-hp", hearts(State.stats.hp | 0, State.stats.hpMax | 0));
    setBadgesUI();
  }

  // ───────────────────────── Render ─────────────────────────
  let ctx = null;
  let images = null;
  let Settings = loadSettings();

  function computeLayout(canvas) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0);
    const h = Math.max(1, rect.height | 0);

    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    canvas.width = Math.max(1, (w * dpr) | 0);
    canvas.height = Math.max(1, (h * dpr) | 0);

    const pad = 16;
    const availableW = Math.max(1, w - pad * 2);
    const availableH = Math.max(1, h - pad * 2);

    const cell = Math.floor(Math.min(availableW / State.w, availableH / State.h));
    State.cellPx = Math.max(10, cell);

    const gridW = State.cellPx * State.w;
    const gridH = State.cellPx * State.h;

    State.offX = ((w - gridW) / 2) | 0;
    State.offY = ((h - gridH) / 2) | 0;

    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    try {
      const root = $("#gr-root") || document.body;
      root.classList.toggle("gr-reduce", !!Settings.reduceMotion);
    } catch (_) {}
  }

  function draw() {
    const canvas = $("#gr-canvas");
    if (!canvas || !ctx) return;

    const vw = (canvas.width / (window.devicePixelRatio || 1));
    const vh = (canvas.height / (window.devicePixelRatio || 1));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ox = State.offX, oy = State.offY, cs = State.cellPx;

    // Fondo
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, vw, vh);

    // Grid
    for (let y = 0; y < State.h; y++) {
      for (let x = 0; x < State.w; x++) {
        const tt = getTile(x, y);
        const px = ox + x * cs;
        const py = oy + y * cs;

        ctx.fillStyle = "#0f0f16";
        ctx.fillRect(px, py, cs, cs);

        drawTile(tt, px, py, cs);
      }
    }

    // líneas
    if (Settings.gridLines) {
      ctx.strokeStyle = "rgba(255,255,255,0.055)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= State.w; x++) {
        const px = ox + x * cs;
        ctx.beginPath();
        ctx.moveTo(px + 0.5, oy);
        ctx.lineTo(px + 0.5, oy + State.h * cs);
        ctx.stroke();
      }
      for (let y = 0; y <= State.h; y++) {
        const py = oy + y * cs;
        ctx.beginPath();
        ctx.moveTo(ox, py + 0.5);
        ctx.lineTo(ox + State.w * cs, py + 0.5);
        ctx.stroke();
      }
    }

    // Player
    drawPlayer(ox + State.px * cs, oy + State.py * cs, cs);

    // Combo text
    if (State.combo > 1 && State.comboTimer > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(`COMBO x${State.combo}`, ox, Math.max(16, oy - 10));
    }
  }

  function drawTile(tt, x, y, s) {
    const pad = Math.max(2, (s * 0.12) | 0);
    const rx = x + pad, ry = y + pad, rs = s - pad * 2;

    if (images) {
      let img = null;
      if (tt === Tile.Block) img = images.block;
      else if (tt === Tile.Coin) img = images.coin;
      else if (tt === Tile.Gem) img = images.gem;
      else if (tt === Tile.Bonus) img = images.bonus;
      else if (tt === Tile.Trap) img = images.trap;
      else if (tt === Tile.Shop) img = images.shop;
      else if (tt === Tile.Chest) img = images.chest;
      else if (tt === Tile.Key) img = images.key;

      if (img) {
        try { ctx.drawImage(img, rx, ry, rs, rs); return; } catch (_) {}
      }
    }

    // fallback shapes
    if (tt === Tile.Block) { ctx.fillStyle = "#2a2a35"; ctx.fillRect(rx, ry, rs, rs); }
    else if (tt === Tile.Coin) { ctx.fillStyle = "#ffcf3a"; circle(rx + rs / 2, ry + rs / 2, rs * 0.32); }
    else if (tt === Tile.Gem) { ctx.fillStyle = "#64d6ff"; diamond(rx + rs / 2, ry + rs / 2, rs * 0.34); }
    else if (tt === Tile.Bonus) { ctx.fillStyle = "#7bff77"; star(rx + rs / 2, ry + rs / 2, rs * 0.33); }
    else if (tt === Tile.Trap) { ctx.fillStyle = "#ff3b4a"; triangle(rx + rs / 2, ry + rs / 2, rs * 0.38); }
    else if (tt === Tile.Key) { ctx.fillStyle = "#ffd56a"; keyShape(rx + rs / 2, ry + rs / 2, rs * 0.34); }
    else if (tt === Tile.Chest) { ctx.fillStyle = "#c38bff"; chestShape(rx, ry, rs); }
    else if (tt === Tile.Shop) { ctx.fillStyle = "#ff9ad1"; shopShape(rx, ry, rs); }
  }

  function drawPlayer(x, y, s) {
    const cx = x + s / 2, cy = y + s / 2;
    const r = s * 0.32;

    // aura escudo
    if ((State.stats.shields | 0) > 0) {
      ctx.strokeStyle = "rgba(120,190,255,0.75)";
      ctx.lineWidth = Math.max(2, (s * 0.08) | 0);
      circleStroke(cx, cy, r + s * 0.18);
    }

    ctx.fillStyle = "#e8e8ff";
    circle(cx, cy, r);

    ctx.fillStyle = "#0b0b10";
    circle(cx + r * 0.35, cy - r * 0.15, r * 0.15);
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function circleStroke(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
  function triangle(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.lineTo(x + r, y + r);
    ctx.closePath();
    ctx.fill();
  }
  function diamond(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x + r, y);
    ctx.closePath();
    ctx.fill();
  }
  function star(x, y, r) {
    const spikes = 5;
    const outer = r;
    const inner = r * 0.45;
    let rot = Math.PI / 2 * 3;
    ctx.beginPath();
    ctx.moveTo(x, y - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      rot += Math.PI / spikes;
      ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += Math.PI / spikes;
    }
    ctx.lineTo(x, y - outer);
    ctx.closePath();
    ctx.fill();
  }
  function keyShape(x, y, r) {
    // círculo + diente
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - r * 0.05, y - r * 0.12, r * 0.70, r * 0.24);
    ctx.fillRect(x + r * 0.35, y - r * 0.12, r * 0.12, r * 0.34);
  }
  function chestShape(x, y, s) {
    ctx.fillRect(x, y + s * 0.20, s, s * 0.68);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, y + s * 0.48, s, s * 0.10);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + s * 0.12, y + s * 0.30, s * 0.76, s * 0.10);
  }
  function shopShape(x, y, s) {
    ctx.fillRect(x + s * 0.12, y + s * 0.35, s * 0.76, s * 0.55);
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(x + s * 0.12, y + s * 0.25, s * 0.76, s * 0.12);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x + s * 0.20, y + s * 0.45, s * 0.60, s * 0.12);
  }

  // ───────────────────────── UI state helpers ─────────────────────────
  function showMenu(show) {
    const menu = $("#gr-menu");
    const splash = $("#gr-splash");
    const hud = $("#gr-hud");
    const canvas = $("#gr-canvas");

    if (splash) splash.style.display = "none";
    if (menu) menu.style.display = show ? "block" : "none";
    if (hud) hud.style.display = show ? "none" : (State.running ? "flex" : "none");
    if (canvas) canvas.style.opacity = show ? "0.25" : "1";
  }

  function showHUD(show) {
    const hud = $("#gr-hud");
    if (hud) hud.style.display = show ? "flex" : "none";
  }

  function showSplash(show) {
    const splash = $("#gr-splash");
    if (splash) splash.style.display = show ? "flex" : "none";
  }

  function showPause(show) {
    const modal = $("#gr-pause");
    if (modal) modal.style.display = show ? "flex" : "none";
  }

  function showGameOver(show) {
    const modal = $("#gr-gameover");
    if (modal) modal.style.display = show ? "flex" : "none";
  }

  function renderPauseState() {
    const dpad = $("#gr-dpad");
    const anyModalOpen =
      ($("#gr-levelup")?.style.display === "flex") ||
      ($("#gr-shop")?.style.display === "flex") ||
      ($("#gr-chest")?.style.display === "flex") ||
      ($("#gr-infomodal")?.style.display === "flex") ||
      ($("#gr-arcadeclear")?.style.display === "flex") ||
      ($("#gr-gameover")?.style.display === "flex");

    if (dpad) dpad.style.display = (isTouch && State.running && !State.paused && !State.gameOver && !anyModalOpen) ? "block" : "none";
    showHUD(State.running && !State.gameOver);
    showPause(!!State.paused && State.running && !State.gameOver && !anyModalOpen);
  }

  // ───────────────────────── Run lifecycle ─────────────────────────
  function newRunSeed(profileId) {
    const base = `${profileId}|${new Date().toDateString()}|${Math.random()}`;
    return hashStrToSeed(base);
  }

  function resetStatsForRun(baseHP) {
    State.stats.hpMax = baseHP | 0;
    State.stats.hp = baseHP | 0;

    // no resetees meta “permanente” de skills (picks), solo variables de run:
    // Aquí reiniciamos lo que debería ser run-based (si tú quieres persistente, quita estos resets).
    State.stats.shields = 0;
    State.stats.shieldOnLevelUp = State.stats.shieldOnLevelUp | 0;
    State.stats.blockResist = State.stats.blockResist | 0;

    State.stats.regenEvery = State.stats.regenEvery | 0;
    State.stats.regenAmount = State.stats.regenAmount | 0;

    State.stats.revives = State.stats.revives | 0;

    State.stats.magnetTime = clampInt(State.stats.magnetTime | 0, 0, 999);
  }

  function startGame() {
    unlockAudio();

    const profileId = getActiveProfileId();

    // skills bridge (si existe skills.js)
    ensureSkillsSystem(profileId);

    State.running = true;
    State.paused = false;
    State.gameOver = false;

    State.seed = newRunSeed(profileId);
    State.rng = mulberry32(State.seed);

    State.score = 0;
    State.cash = 0;
    State.steps = 0;

    State.combo = 0;
    State.comboTimer = 0;

    State.level = 1;
    State.xp = 0;
    State.xpNeed = 30;

    // base HP por modo
    const m = MODE_DEF[State.mode] || MODE_DEF.classic;
    const baseHP = (State.playMode === "endless") ? (m.hp | 0) : 10;

    resetStatsForRun(baseHP);

    // timers
    if (State.playMode === "endless" && (m.timeLimitSec | 0) > 0) State.timeLeftMs = (m.timeLimitSec | 0) * 1000;
    else if (State.playMode === "arcade" && State.arcade && (State.arcade.timeLimitSec | 0) > 0) State.timeLeftMs = (State.arcade.timeLimitSec | 0) * 1000;
    else State.timeLeftMs = 0;

    // generar tablero
    generateGrid();

    // UI
    showMenu(false);
    showHUD(true);
    renderPauseState();

    updateHUD();
    draw();

    music("music_loop");
    sfx("sfx_ui_click");
  }

  function endGame(recordBest) {
    State.gameOver = true;
    State.running = false;
    State.paused = false;

    const profileId = getActiveProfileId();
    const best = getBestScore(profileId);
    const score = State.score | 0;

    if (recordBest) {
      if (score > best) setBestScore(profileId, score);
      setLastRun(profileId, score);
    }

    setText("gr-over-title", t("ui.gameOver", null, "Game Over"));
    setText("gr-over-score", score);
    setText("gr-over-best", Math.max(best, score));

    showGameOver(true);
    showHUD(false);
    renderPauseState();

    sfx("sfx_gameover");

    // aplicar update pendiente
    if (State.pendingReload) {
      State.pendingReload = false;
      applyUpdateNow();
    }
  }

  function endArcadeClear() {
    // calcula estrellas
    const hp = State.stats.hp | 0;
    const hpMax = State.stats.hpMax | 0;
    const steps = State.steps | 0;
    const st = State.arcade;

    let stars = 1;
    if (hp >= Math.ceil(hpMax * 0.60)) stars++;
    if (st && steps <= Math.floor((st.maxSteps | 0) * 0.75)) stars++;
    if (st && (st.timeLimitSec | 0) > 0) {
      // si hay tiempo: tercer criterio también puede ser tiempo sobrante
      const left = Math.max(0, Math.ceil(State.timeLeftMs / 1000));
      const req = Math.ceil((st.timeLimitSec | 0) * 0.25);
      if (left >= req) stars = Math.max(stars, 3);
    }
    stars = clampInt(stars, 1, 3);

    // persist progreso
    const profileId = getActiveProfileId();
    const prog = loadArcadeProgress(profileId);
    setBestStars(prog, st.zone, st.stage, stars);
    unlockNextStage(prog, st.zone, st.stage);
    saveArcadeProgress(profileId, prog);

    // UI
    State.gameOver = true;
    State.running = false;
    State.paused = false;

    setText("gr-arcadeclear-title", t("ui.cleared", null, "Run completada"));
    setText("gr-arcadeclear-info", `Zona ${st.zone + 1} · Run ${st.stage + 1} · ${t("ui.score", null, "Puntos")}: ${State.score}/${st.targetScore}`);
    setText("gr-arcadeclear-stars", "⭐".repeat(stars) + "☆".repeat(3 - stars));

    setModalVisible("#gr-arcadeclear", true);
    showHUD(false);
    renderPauseState();

    sfx("sfx_levelup");
  }

  function exitToMenu() {
    State.running = false;
    State.paused = false;
    State.gameOver = false;

    // cierra modales
    setModalVisible("#gr-gameover", false);
    setModalVisible("#gr-levelup", false);
    setModalVisible("#gr-shop", false);
    setModalVisible("#gr-chest", false);
    setModalVisible("#gr-arcadeclear", false);

    showMenu(true);
    showHUD(false);
    renderPauseState();

    refreshMenuKPIs();
    refreshPlaySummary();
    draw();
  }

  function restartRun() {
    setModalVisible("#gr-gameover", false);
    setModalVisible("#gr-levelup", false);
    setModalVisible("#gr-shop", false);
    setModalVisible("#gr-chest", false);
    setModalVisible("#gr-arcadeclear", false);
    startGame();
  }

  function togglePause() {
    if (!State.running || State.gameOver) return;

    const anyModalOpen =
      ($("#gr-levelup")?.style.display === "flex") ||
      ($("#gr-shop")?.style.display === "flex") ||
      ($("#gr-chest")?.style.display === "flex") ||
      ($("#gr-infomodal")?.style.display === "flex") ||
      ($("#gr-arcadeclear")?.style.display === "flex") ||
      ($("#gr-gameover")?.style.display === "flex");

    if (anyModalOpen) return;

    State.paused = !State.paused;
    renderPauseState();
    sfx("sfx_ui_click");
  }

  // ───────────────────────── Loop ─────────────────────────
  let lastTick = 0;

  function tick(ts) {
    requestAnimationFrame(tick);

    if (!State.running || State.paused || State.gameOver) {
      lastTick = ts;
      return;
    }

    const dt = Math.min(50, Math.max(0, ts - (lastTick || ts)));
    lastTick = ts;

    if (State.comboTimer > 0) State.comboTimer = Math.max(0, State.comboTimer - dt);
    if (State.comboTimer === 0) State.combo = 0;

    // magnet time (segundos, decrementa con dt)
    if ((State.stats.magnetTime | 0) > 0) {
      const next = Math.max(0, (Number(State.stats.magnetTime) || 0) - dt / 1000);
      State.stats.magnetTime = next;
    }

    // timers de modo
    if (State.timeLeftMs > 0) {
      State.timeLeftMs = Math.max(0, State.timeLeftMs - dt);
      if (State.timeLeftMs === 0) {
        if (State.playMode === "endless" && State.mode === "rush") endGame(true);
        else if (State.playMode === "arcade" && State.arcade && State.score < (State.arcade.targetScore | 0)) {
          toast(t("toast.failTime", null, "Se acabó el tiempo."));
          endGame(false);
        }
      }
    }

    setBadgesUI();
  }

  // ───────────────────────── Input ─────────────────────────
  function bindInput() {
    window.addEventListener("keydown", (e) => {
      if (!e) return;
      const k = e.key || e.code;
      if (k) unlockAudio();

      if (!State.running && !State.gameOver) {
        if (k === "Enter") {
          const menuVisible = $("#gr-menu") && $("#gr-menu").style.display !== "none";
          if (menuVisible) { startGame(); e.preventDefault(); }
        }
      }

      if (k === "Escape") {
        if ($("#gr-shop")?.style.display === "flex") { closeShop(); e.preventDefault(); return; }
        if ($("#gr-chest")?.style.display === "flex") { closeChest(); e.preventDefault(); return; }
        if ($("#gr-levelup")?.style.display === "flex") { /* no se cierra con Esc, fuerza pick */ e.preventDefault(); return; }
        if ($("#gr-arcadeclear")?.style.display === "flex") { exitToMenu(); e.preventDefault(); return; }

        if (State.gameOver) { exitToMenu(); e.preventDefault(); return; }
        if (!State.running) return;
        togglePause(); e.preventDefault(); return;
      }

      if (!State.running || State.paused || State.gameOver) return;

      if (k === "ArrowUp" || k === "w" || k === "W") { tryMove(0, -1); e.preventDefault(); }
      else if (k === "ArrowDown" || k === "s" || k === "S") { tryMove(0, 1); e.preventDefault(); }
      else if (k === "ArrowLeft" || k === "a" || k === "A") { tryMove(-1, 0); e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { tryMove(1, 0); e.preventDefault(); }
    }, { passive: false });

    // D-Pad
    const dpad = $("#gr-dpad");
    if (dpad) {
      dpad.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("[data-dir]") : null;
        if (!btn) return;
        unlockAudio();
        const dir = btn.getAttribute("data-dir");
        if (dir === "up") tryMove(0, -1);
        else if (dir === "down") tryMove(0, 1);
        else if (dir === "left") tryMove(-1, 0);
        else if (dir === "right") tryMove(1, 0);
      });
    }

    // click/tap: mueve dentro de la zona (range)
    const canvas = $("#gr-canvas");
    if (canvas) {
      canvas.addEventListener("pointerdown", (e) => {
        unlockAudio();
        if (!State.running || State.paused || State.gameOver) return;
        try {
          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) - State.offX;
          const y = (e.clientY - rect.top) - State.offY;
          const cx = Math.floor(x / State.cellPx);
          const cy = Math.floor(y / State.cellPx);

          const dx = cx - State.px;
          const dy = cy - State.py;
          const range = zoneRange();

          const md = Math.abs(dx) + Math.abs(dy);
          if (md <= 0 || md > range) return;

          // mueve “paso a paso” hacia el target (prioriza eje mayor)
          let tx = State.px, ty = State.py;
          let sx = dx, sy = dy;
          while ((tx !== cx || ty !== cy) && (Math.abs(tx - State.px) + Math.abs(ty - State.py)) < range) {
            const ax = cx - tx;
            const ay = cy - ty;
            if (Math.abs(ax) >= Math.abs(ay)) tx += Math.sign(ax);
            else ty += Math.sign(ay);
            // simula como input: un step
            const ddx = tx - State.px;
            const ddy = ty - State.py;
            if (Math.abs(ddx) + Math.abs(ddy) !== 1) break;
            tryMove(ddx, ddy);
            if (State.paused || State.gameOver) break;
          }
        } catch (_) {}
      }, { passive: true });
    }
  }

  // ───────────────────────── Menu interactions ─────────────────────────
  function openInfoModal(title, body) {
    const modal = $("#gr-infomodal");
    const tnode = $("#gr-infomodal-title");
    const bnode = $("#gr-infomodal-body");
    if (!modal || !tnode || !bnode) return;
    tnode.textContent = String(title || "");
    bnode.textContent = String(body || "");
    modal.style.display = "flex";
  }
  function closeInfoModal() {
    const modal = $("#gr-infomodal");
    if (modal) modal.style.display = "none";
  }

  function refreshMenuKPIs() {
    const profileId = getActiveProfileId();
    setText("gr-bestscore", getBestScore(profileId));
    setText("gr-lastrun", (getLastRun(profileId) ? String(getLastRun(profileId)) : "—"));

    const p = $("#gr-profile-active");
    if (p) p.textContent = profileId;

    // refresca arcade selector
    renderArcadeSelector();
  }

  function refreshPlaySummary() {
    const pill = $("#gr-play-summary");
    if (!pill) return;

    if (State.playMode === "endless") {
      pill.textContent = `Modo: Infinito · ${String(State.mode).toUpperCase()}`;
    } else {
      const a = State.arcade || { zone: 0, stage: 0 };
      pill.textContent = `Modo: Arcade · Zona ${a.zone + 1} · Run ${a.stage + 1}`;
    }
  }

  function syncOptionsUI() {
    const sfxRange = $("#gr-opt-sfx");
    const musicRange = $("#gr-opt-music");
    const gridLines = $("#gr-opt-gridlines");
    const reduce = $("#gr-opt-reduce");
    const langSel = $("#gr-opt-lang");

    if (sfxRange) sfxRange.value = String(Math.round(Settings.sfx * 100));
    if (musicRange) musicRange.value = String(Math.round(Settings.music * 100));
    if (gridLines) gridLines.checked = !!Settings.gridLines;
    if (reduce) reduce.checked = !!Settings.reduceMotion;
    if (langSel) langSel.value = Settings.lang || "auto";
  }

  function populateLanguageOptions() {
    const sel = $("#gr-opt-lang");
    if (!sel) return;
    sel.innerHTML = "";

    const add = (value, label) => sel.appendChild(el("option", { value, text: label }));

    add("auto", t("lang.auto", null, "Auto"));

    if (I18n) {
      try {
        if (typeof I18n.languageOptions === "function") {
          const opts = I18n.languageOptions();
          if (Array.isArray(opts)) {
            for (const o of opts) add(String(o.value || o.code || ""), String(o.label || o.name || o.value || o.code || ""));
            sel.value = Settings.lang || "auto";
            return;
          }
        }
      } catch (_) {}
    }

    add("es", "Español");
    add("en", "English");
    add("fr", "Français");
    add("de", "Deutsch");
    add("it", "Italiano");
    add("pt", "Português");
    add("ja", "日本語");
    add("ko", "한국어");
    add("zh-hans", "中文(简体)");
    add("zh-hant", "中文(繁體)");
    add("ar", "العربية");

    sel.value = Settings.lang || "auto";
  }

  function renderArcadeSelector() {
    const panel = $("#gr-arcade-panel");
    const zonesBox = $("#gr-arcade-zones");
    const stagesBox = $("#gr-arcade-stages");
    const hint = $("#gr-arcade-hint");
    if (!panel || !zonesBox || !stagesBox) return;

    const profileId = getActiveProfileId();
    const prog = loadArcadeProgress(profileId);

    // zona seleccionada (temporal)
    const selZ = clampInt(Number(lsGet(`${KEY_NEW}arcade_sel_zone_${profileId}`, "0")), 0, ARCADE_ZONES - 1);
    const selS = clampInt(Number(lsGet(`${KEY_NEW}arcade_sel_stage_${profileId}`, "0")), 0, ARCADE_STAGES_PER_ZONE - 1);

    zonesBox.innerHTML = "";
    for (let z = 0; z < ARCADE_ZONES; z++) {
      const btn = el("button", { class: "gr-btn gr-btn-ghost gr-btn-sm", type: "button" }, [
        el("span", { class: "gr-btn-text", text: `Zona ${z + 1}` })
      ]);
      if (z === selZ) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        unlockAudio();
        lsSet(`${KEY_NEW}arcade_sel_zone_${profileId}`, String(z));
        lsSet(`${KEY_NEW}arcade_sel_stage_${profileId}`, "0");
        renderArcadeSelector();
        sfx("sfx_ui_click");
      });
      zonesBox.appendChild(btn);
    }

    stagesBox.innerHTML = "";
    for (let s = 0; s < ARCADE_STAGES_PER_ZONE; s++) {
      const unlocked = isStageUnlocked(prog, selZ, s);
      const bestStars = getBestStars(prog, selZ, s);

      const b = el("button", { class: "gr-arcade-stage", type: "button" }, [
        el("div", { class: "gr-arcade-stage-top" }, [
          el("div", { class: "gr-arcade-stage-num", text: `${s + 1}` }),
          el("div", { class: "gr-arcade-stage-stars", text: bestStars ? ("⭐".repeat(bestStars)) : "" })
        ]),
        el("div", { class: "gr-arcade-stage-lock", text: unlocked ? "" : "🔒" })
      ]);

      if (s === selS) b.classList.add("is-active");
      if (!unlocked) b.classList.add("is-locked");

      b.addEventListener("click", () => {
        unlockAudio();
        if (!unlocked) { sfx("sfx_block"); toast(t("toast.locked", null, "Aún bloqueado.")); return; }
        lsSet(`${KEY_NEW}arcade_sel_stage_${profileId}`, String(s));
        renderArcadeSelector();
        sfx("sfx_ui_click");
      });

      stagesBox.appendChild(b);
    }

    const chosenS = clampInt(Number(lsGet(`${KEY_NEW}arcade_sel_stage_${profileId}`, "0")), 0, ARCADE_STAGES_PER_ZONE - 1);
    const cfg = buildArcadeStageConfig(selZ, chosenS);
    if (hint) {
      const timeTxt = (cfg.timeLimitSec > 0) ? ` · ⏱ ${cfg.timeLimitSec}s` : "";
      hint.textContent = `Objetivo: 🎯 ${cfg.targetScore} pts · 👣 ${cfg.maxSteps} pasos${timeTxt}`;
    }

    // set current arcade selection in State (para summary)
    State.arcade = cfg;
    refreshPlaySummary();
  }

  function bindMenuUI() {
    // Tabs
    $$(".gr-tab").forEach((b) => {
      b.addEventListener("click", () => {
        unlockAudio();
        $$(".gr-tab").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const tab = b.getAttribute("data-tab");
        $$(".gr-panel").forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-panel") === tab));
        sfx("sfx_ui_click");
      });
    });

    // PlayMode (endless vs arcade)
    $$(".gr-mode[data-playmode]").forEach((b) => {
      b.addEventListener("click", () => {
        unlockAudio();
        $$(".gr-mode[data-playmode]").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const pm = String(b.getAttribute("data-playmode") || "endless");
        State.playMode = (pm === "arcade") ? "arcade" : "endless";
        lsSet(`${KEY_NEW}playmode`, State.playMode);

        // toggles UI
        const arc = $("#gr-arcade-panel");
        const endv = $("#gr-endless-variants");
        if (arc) arc.style.display = (State.playMode === "arcade") ? "block" : "none";
        if (endv) endv.style.display = (State.playMode === "arcade") ? "none" : "block";

        refreshPlaySummary();
        sfx("sfx_ui_click");
      });
    });

    // Endless variants
    $$(".gr-submode[data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        unlockAudio();
        $$(".gr-submode[data-mode]").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const mode = String(b.getAttribute("data-mode") || "classic");
        if (MODE_DEF[mode]) {
          State.mode = mode;
          lsSet(`${KEY_NEW}mode`, mode);
          toast(t("toast.mode", null, "Modo seleccionado."));
        }
        refreshPlaySummary();
        sfx("sfx_ui_click");
      });
    });

    // Start
    $("#gr-btn-start")?.addEventListener("click", () => {
      // si arcade, asegura config actual
      if (State.playMode === "arcade") {
        const profileId = getActiveProfileId();
        const selZ = clampInt(Number(lsGet(`${KEY_NEW}arcade_sel_zone_${profileId}`, "0")), 0, ARCADE_ZONES - 1);
        const selS = clampInt(Number(lsGet(`${KEY_NEW}arcade_sel_stage_${profileId}`, "0")), 0, ARCADE_STAGES_PER_ZONE - 1);
        State.arcade = buildArcadeStageConfig(selZ, selS);
      }
      startGame();
    });

    // Tutorial
    $("#gr-btn-tutorial")?.addEventListener("click", () => {
      unlockAudio();
      openInfoModal(
        t("ui.howToPlay", null, "Cómo jugar"),
        [
          `• ${t("how.move", null, "Muévete con WASD / flechas o D-Pad.")}`,
          `• ${t("how.block", null, "Bloques: si los golpeas, KO salvo escudo/Anti-KO.")}`,
          `• ${t("how.shop", null, "Shop: pisa el tile para abrir tienda (compra con 💰).")}`,
          `• ${t("how.chest", null, "Chest: pisa el tile para abrir cofre (consume 🔑).")}`,
          `• ${t("how.keys", null, "Keys: pisa el tile 🔑 para conseguir llaves.")}`,
          `• ${t("how.level", null, "Al subir de nivel eliges 1 skill (rerolls si tienes).")}`,
          `• ${t("how.arcade", null, "Arcade: completa objetivo 🎯 con límite de pasos/tiempo para ganar ⭐.")}`
        ].join("\n")
      );
      sfx("sfx_ui_click");
    });

    // License
    $("#gr-btn-license")?.addEventListener("click", () => {
      unlockAudio();
      openInfoModal(
        t("ui.license", null, "Licencia"),
        t("license.text", null, "© Todos los derechos reservados. No se permite redistribuir ni reutilizar los assets/código sin permiso.")
      );
      sfx("sfx_ui_click");
    });

    // Profile manage
    $("#gr-btn-profile")?.addEventListener("click", () => {
      unlockAudio();
      if (Auth && typeof Auth.openProfilePicker === "function") {
        try { Auth.openProfilePicker(); } catch (_) {}
      } else {
        openInfoModal(t("ui.profile", null, "Perfil"), t("profile.noAuth", null, "No se detectó auth.js. Perfil: default."));
      }
      refreshMenuKPIs();
      refreshPlaySummary();
      sfx("sfx_ui_click");
    });

    // Options
    const sfxRange = $("#gr-opt-sfx");
    const musicRange = $("#gr-opt-music");
    const gridLines = $("#gr-opt-gridlines");
    const reduce = $("#gr-opt-reduce");
    const langSel = $("#gr-opt-lang");

    if (sfxRange) {
      sfxRange.addEventListener("input", () => {
        Settings.sfx = clamp(Number(sfxRange.value) / 100, 0, 1);
        saveSettings(Settings);
        applyAudioSettings(Settings);
      });
    }
    if (musicRange) {
      musicRange.addEventListener("input", () => {
        Settings.music = clamp(Number(musicRange.value) / 100, 0, 1);
        saveSettings(Settings);
        applyAudioSettings(Settings);
      });
    }
    if (gridLines) {
      gridLines.addEventListener("change", () => {
        Settings.gridLines = !!gridLines.checked;
        saveSettings(Settings);
        draw();
      });
    }
    if (reduce) {
      reduce.addEventListener("change", () => {
        Settings.reduceMotion = !!reduce.checked;
        saveSettings(Settings);
        draw();
      });
    }
    if (langSel) {
      langSel.addEventListener("change", () => {
        const v = String(langSel.value || "auto");
        Settings.lang = v;
        saveSettings(Settings);
        try { if (I18n && typeof I18n.setLanguage === "function") I18n.setLanguage(v); } catch (_) {}
        sfx("sfx_ui_click");
      });
    }

    // Reset
    $("#gr-btn-reset")?.addEventListener("click", () => {
      unlockAudio();
      Settings = Object.assign({}, DEFAULT_SETTINGS);
      saveSettings(Settings);
      applyAudioSettings(Settings);
      syncOptionsUI();
      draw();
      toast(t("toast.reset", null, "Opciones restablecidas."));
      sfx("sfx_ui_click");
    });

    // Pause modal
    $("#gr-btn-pause")?.addEventListener("click", () => togglePause());
    $("#gr-btn-resume")?.addEventListener("click", () => togglePause());
    $("#gr-btn-restart")?.addEventListener("click", () => restartRun());
    $("#gr-btn-exit")?.addEventListener("click", () => exitToMenu());

    // GameOver modal
    $("#gr-btn-again")?.addEventListener("click", () => restartRun());
    $("#gr-btn-menu")?.addEventListener("click", () => exitToMenu());

    // Arcade clear modal
    $("#gr-arcadeclear-menu")?.addEventListener("click", () => {
      setModalVisible("#gr-arcadeclear", false);
      exitToMenu();
    });
    $("#gr-arcadeclear-next")?.addEventListener("click", () => {
      // selecciona siguiente stage desbloqueado y arranca
      const profileId = getActiveProfileId();
      const prog = loadArcadeProgress(profileId);
      const uz = clampInt(prog.unlocked.zone, 0, ARCADE_ZONES - 1);
      const us = clampInt(prog.unlocked.stage, 0, ARCADE_STAGES_PER_ZONE - 1);

      lsSet(`${KEY_NEW}arcade_sel_zone_${profileId}`, String(uz));
      lsSet(`${KEY_NEW}arcade_sel_stage_${profileId}`, String(us));

      setModalVisible("#gr-arcadeclear", false);
      State.playMode = "arcade";
      State.arcade = buildArcadeStageConfig(uz, us);
      startGame();
    });

    // Info modal close
    $("#gr-infomodal-close")?.addEventListener("click", () => closeInfoModal());

    // Shop / Chest close
    $("#gr-shop-close")?.addEventListener("click", () => closeShop());
    $("#gr-chest-close")?.addEventListener("click", () => closeChest());

    // Install
    bindInstallButton();
  }

  // ───────────────────────── PWA Install prompt ─────────────────────────
  let deferredInstall = null;

  function bindInstallButton() {
    const btn = $("#gr-btn-install");
    if (!btn) return;

    const canInstall = () => !!deferredInstall;

    const refresh = () => {
      const standalone = (() => {
        try {
          return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                 (navigator && navigator.standalone);
        } catch (_) { return false; }
      })();
      btn.style.display = (!standalone && canInstall()) ? "inline-flex" : "none";
    };

    window.addEventListener("beforeinstallprompt", (e) => {
      try { e.preventDefault(); } catch (_) {}
      deferredInstall = e;
      refresh();
    });

    window.addEventListener("appinstalled", () => {
      deferredInstall = null;
      refresh();
      toast(t("toast.installed", null, "Instalado."));
    });

    btn.addEventListener("click", async () => {
      unlockAudio();
      if (!deferredInstall) return;
      try {
        deferredInstall.prompt();
        await deferredInstall.userChoice;
      } catch (_) {}
      deferredInstall = null;
      refresh();
      sfx("sfx_ui_click");
    });

    refresh();
  }

  // ───────────────────────── Resize robustness ─────────────────────────
  let ro = null;
  function bindResize(canvas) {
    const doResize = () => {
      computeLayout(canvas);
      draw();
    };

    window.addEventListener("resize", () => doResize(), { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(doResize, 50), { passive: true });

    try {
      if (window.visualViewport) window.visualViewport.addEventListener("resize", () => doResize(), { passive: true });
    } catch (_) {}

    try {
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => doResize());
        ro.observe(canvas);
      }
    } catch (_) {}

    doResize();
  }

  // ───────────────────────── Boot ─────────────────────────
  async function boot() {
    if (State.booted) return;
    State.booted = true;

    if (GRPerf && typeof GRPerf.mark === "function") { try { GRPerf.mark("app_boot_start"); } catch (_) {} }

    migrateOldKeys();
    ensureMetaViewport();

    // carga preferencias
    Settings = loadSettings();
    applyAudioSettings(Settings);

    // idioma
    try { if (I18n && typeof I18n.setLanguage === "function") I18n.setLanguage(Settings.lang || "auto"); } catch (_) {}

    // modo guardado
    const savedMode = String(lsGet(`${KEY_NEW}mode`, "classic"));
    if (MODE_DEF[savedMode]) State.mode = savedMode;

    const savedPlayMode = String(lsGet(`${KEY_NEW}playmode`, "endless"));
    State.playMode = (savedPlayMode === "arcade") ? "arcade" : "endless";

    const root = ensureRoot();
    const canvas = ensureCanvas(root);
    const overlays = ensureOverlays(root);

    try { ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }); } catch (_) { ctx = null; }
    if (!ctx) {
      overlays.splash.querySelector(".gr-subtitle").textContent = "Canvas no disponible.";
      return;
    }

    populateLanguageOptions();
    syncOptionsUI();

    // Setup playmode UI
    const arc = $("#gr-arcade-panel");
    const endv = $("#gr-endless-variants");
    if (arc) arc.style.display = (State.playMode === "arcade") ? "block" : "none";
    if (endv) endv.style.display = (State.playMode === "arcade") ? "none" : "block";

    // set active classes
    $$(".gr-mode[data-playmode]").forEach((b) => {
      const pm = String(b.getAttribute("data-playmode") || "");
      b.classList.toggle("is-active", (pm === State.playMode));
    });
    $$(".gr-submode[data-mode]").forEach((b) => {
      const m = String(b.getAttribute("data-mode") || "");
      b.classList.toggle("is-active", (m === State.mode));
    });

    // bind
    bindMenuUI();
    bindInput();
    bindResize(canvas);

    // cargar sprites
    images = await loadImages(SPRITES);

    // SW
    setupServiceWorker();

    // refresca UI
    refreshMenuKPIs();
    renderArcadeSelector();
    refreshPlaySummary();

    showSplash(false);
    showMenu(true);
    draw();

    requestAnimationFrame(tick);

    if (GRPerf && typeof GRPerf.mark === "function") { try { GRPerf.mark("app_boot_ready"); } catch (_) {} }
    log("Boot OK v" + APP_VERSION);
  }

  // ───────────────────────── Fatal handling ─────────────────────────
  function fatalOverlay(message) {
    const ov = $("#gr-overlays") || document.body;
    const card = el("div", { class: "gr-modal", style: "display:flex" }, [
      el("div", { class: "gr-modal-card" }, [
        el("div", { class: "gr-modal-title", text: "Error" }),
        el("div", { class: "gr-modal-body", text: String(message || "Error inesperado.") }),
        el("div", { class: "gr-modal-row" }, [
          el("button", { class: "gr-btn gr-btn-primary", type: "button", onclick: () => { try { location.reload(); } catch (_) {} } }, [
            el("span", { class: "gr-btn-text", text: "Recargar" })
          ])
        ])
      ])
    ]);
    safeAppend(ov, card);
  }

  window.addEventListener("error", (e) => {
    try {
      err("window.error", e && e.message, e && e.error);
      State.running = false; State.paused = false; State.gameOver = true;
      fatalOverlay((e && e.message) ? e.message : "Error");
    } catch (_) {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    try {
      err("unhandledrejection", e && e.reason);
      State.running = false; State.paused = false; State.gameOver = true;
      fatalOverlay((e && e.reason) ? String(e.reason) : "Rechazo no controlado");
    } catch (_) {}
  });

  // ───────────────────────── Public API mínima ─────────────────────────
  try {
    if (typeof window !== "undefined") {
      window.GridRogue = {
        version: APP_VERSION,
        start: () => startGame(),
        exit: () => exitToMenu(),
        toast: (m) => toast(m),
        getState: () => ({
          running: State.running,
          paused: State.paused,
          score: State.score,
          cash: State.cash,
          level: State.level,
          hp: State.stats.hp,
          mode: State.mode,
          playMode: State.playMode,
          arcade: State.arcade
        })
      };
    }
  } catch (_) {}

  // ───────────────────────── Boot ─────────────────────────
  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  }
})();
