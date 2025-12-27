/* app.js — Grid Rogue v1.1.0 (STABLE+FULLSCREEN + AUDIO + I18N + PWA + SKILLS)
   ✅ Compatible con:
   - utils.js (window.GRUtils)
   - audio.js (window.AudioSys)
   - localization.js (window.I18n)
   - auth.js (window.Auth) si existe
   - rendiment.js (window.GRPerf) si existe (opcional)
   - skills.js (window.GRSkills) ✅ (pack Skills/Upgrades + Discovery + Shop/Chest)

   v1.1.0 (STABLE patch):
   - PWA/SW: anti “reload loop” endurecido (controllerchange + tags + cooldown)
   - Update pill: aplica update sin forzar reload durante run (espera a GameOver o click)
   - Robustez extra en resize/viewport + observers (sin romper DOM/ids)
   - Integración skills.js (si existe): LevelUp usa Skills Pack; fallback a upgrades internos si no está
*/
(() => {
  "use strict";

  // ───────────────────────── Guard anti doble carga ─────────────────────────
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const LOAD_GUARD = "__GRIDROGUE_APPJS_LOADED_V1100";
  try { if (g && g[LOAD_GUARD]) return; if (g) g[LOAD_GUARD] = true; } catch (_) {}

  // ───────────────────────── Version / Integraciones ─────────────────────────
  const APP_VERSION = String((typeof window !== "undefined" && window.APP_VERSION) || "1.1.0");

  // Compat flags (failsafe/index antiguo) — no pisar si ya existen
  try {
    if (typeof window !== "undefined") {
      if (typeof window.__GRIDRUNNER_BOOTED === "undefined") window.__GRIDRUNNER_BOOTED = false;
      if (typeof window.__GRIDROGUE_BOOTED === "undefined") window.__GRIDROGUE_BOOTED = false;
    }
  } catch (_) {}

  // Integraciones opcionales
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
  const randInt = (a, b) => (a + (Math.random() * (b - a + 1) | 0));
  const isTouch = (() => {
    try { return ("ontouchstart" in window) || (navigator && navigator.maxTouchPoints > 0); } catch (_) { return false; }
  })();

  const log = (...args) => { try { console.log("[GridRogue]", ...args); } catch (_) {} };
  const warn = (...args) => { try { console.warn("[GridRogue]", ...args); } catch (_) {} };
  const err = (...args) => { try { console.error("[GridRogue]", ...args); } catch (_) {} };

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

  // Migración básica gridrunner_* -> gridrogue_* (no destruye lo nuevo)
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
  const $ = (sel, root = document) => {
    try { return root.querySelector(sel); } catch (_) { return null; }
  };
  const $$ = (sel, root = document) => {
    try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; }
  };

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

  function safeAppend(parent, child) {
    try { parent.appendChild(child); } catch (_) {}
  }

  function ensureMetaViewport() {
    try {
      let m = $('meta[name="viewport"]');
      if (!m) {
        m = el("meta", { name: "viewport" });
        safeAppend(document.head, m);
      }
      // No rompe si el usuario ya tiene uno más estricto
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

    // Si existe un contenedor principal, lo reutilizamos
    root = $("#app") || $("#root") || $("#main") || document.body;

    // Creamos un wrapper propio (no rompe el DOM existente)
    const wrap = el("div", { id: "gr-root", class: "gr-root" });
    // Si root era body, metemos wrap al final; si no, lo metemos dentro
    if (root === document.body) safeAppend(document.body, wrap);
    else safeAppend(root, wrap);
    return wrap;
  }

  function ensureCanvas(root) {
    // Intento de reusar canvas existente
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
    // Contenedor overlays
    let ov = $("#gr-overlays");
    if (!ov) {
      ov = el("div", { id: "gr-overlays", class: "gr-overlays", "aria-live": "polite" });
      safeAppend(root, ov);
    }

    // Update pill (PWA)
    let updatePill = $("#gr-update-pill");
    if (!updatePill) {
      updatePill = el("button", {
        id: "gr-update-pill",
        class: "gr-update-pill",
        type: "button",
        "aria-hidden": "true"
      }, []);
      updatePill.style.display = "none";
      safeAppend(ov, updatePill);
    }

    // Toast
    let toast = $("#gr-toast");
    if (!toast) {
      toast = el("div", { id: "gr-toast", class: "gr-toast", "aria-hidden": "true" });
      toast.style.display = "none";
      safeAppend(ov, toast);
    }

    // Splash
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
                el("button", { id: "gr-btn-start", class: "gr-btn gr-btn-primary", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.start", null, "Empezar") })
                ]),
                el("button", { id: "gr-btn-tutorial", class: "gr-btn gr-btn-ghost", type: "button" }, [
                  el("span", { class: "gr-btn-text", text: t("ui.howToPlay", null, "Cómo jugar") })
                ])
              ]),
              el("div", { class: "gr-panel-help" }, [
                el("div", { class: "gr-help-line", text: t("help.one", null, "Muévete por la cuadrícula. Cada paso cuenta.") }),
                el("div", { class: "gr-help-line", text: t("help.two", null, "Encadena recogidas para combos y sube de nivel para elegir skills.") })
              ])
            ]),
            el("div", { class: "gr-panel", "data-panel": "modes" }, [
              el("div", { class: "gr-field" }, [
                el("div", { class: "gr-label", text: t("ui.gameMode", null, "Modo de juego") }),
                el("div", { class: "gr-mode-grid" }, [
                  el("button", { class: "gr-mode is-active", type: "button", "data-mode": "classic" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.classic", null, "Clásico") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.classicDesc", null, "Endless con trampas, combos y upgrades.") })
                  ]),
                  el("button", { class: "gr-mode", type: "button", "data-mode": "rush" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.rush", null, "Rush") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.rushDesc", null, "Tiempo limitado. Máxima puntuación rápido.") })
                  ]),
                  el("button", { class: "gr-mode", type: "button", "data-mode": "zen" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.zen", null, "Zen") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.zenDesc", null, "Sin estrés: menos castigo, más ritmo.") })
                  ]),
                  el("button", { class: "gr-mode", type: "button", "data-mode": "hardcore" }, [
                    el("div", { class: "gr-mode-title", text: t("mode.hardcore", null, "Hardcore") }),
                    el("div", { class: "gr-mode-desc", text: t("mode.hardcoreDesc", null, "Poca vida y castigo alto. Para tryhards.") })
                  ])
                ])
              ])
            ]),
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
                el("div", { class: "gr-help-line", text: t("help.profile", null, "Los records se guardan por perfil si tienes auth.js.") })
              ])
            ]),
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

    // GameOver
    let over = $("#gr-gameover");
    if (!over) {
      over = el("div", { id: "gr-gameover", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card" }, [
          el("div", { class: "gr-modal-title", text: t("ui.gameOver", null, "Game Over") }),
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

    // LevelUp / Skill picker
    let levelUp = $("#gr-levelup");
    if (!levelUp) {
      levelUp = el("div", { id: "gr-levelup", class: "gr-modal", style: "display:none" }, [
        el("div", { class: "gr-modal-card gr-levelup-card" }, [
          el("div", { class: "gr-modal-title", id: "gr-levelup-title", text: t("ui.levelUp", null, "Subes de nivel") }),
          el("div", { class: "gr-levelup-sub", id: "gr-levelup-sub", text: t("ui.chooseSkill", null, "Elige 1 mejora") }),
          el("div", { class: "gr-levelup-choices", id: "gr-levelup-choices" })
        ])
      ]);
      safeAppend(ov, levelUp);
    }

    // HowTo / License modals (ligeros)
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

    // D-Pad móvil (si toca)
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

    return { ov, splash, menu, hud, pause, over, levelUp, info, toast, updatePill, dpad };
  }

  // ───────────────────────── Settings ─────────────────────────
  const SETTINGS_KEY = `${KEY_NEW}settings_v3`;
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
    // FNV-1a simple
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
    trap: "assets/sprites/tile_trap.svg"
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
    Trap: 5
  };

  const MODE_DEF = {
    classic: { id: "classic", hp: 10, timeLimitSec: 0, trapEnabled: true, scoreMult: 1.0 },
    rush: { id: "rush", hp: 10, timeLimitSec: 90, trapEnabled: true, scoreMult: 1.15 },
    zen: { id: "zen", hp: 10, timeLimitSec: 0, trapEnabled: false, scoreMult: 0.90 },
    hardcore: { id: "hardcore", hp: 5, timeLimitSec: 0, trapEnabled: true, scoreMult: 1.25 }
  };

  // Estado runtime
  const State = {
    booted: false,
    running: false,
    paused: false,
    gameOver: false,

    mode: "classic",
    w: 8,
    h: 16,

    seed: 0,
    rng: Math.random,

    grid: null,
    px: 0,
    py: 0,

    score: 0,
    steps: 0,
    combo: 0,
    comboTimer: 0, // ms
    level: 1,
    xp: 0,
    xpNeed: 30,

    hp: 10,
    maxHp: 10,

    // Buffs
    buffs: {
      magnetMs: 0,
      shield: 0,
      scoreBoost: 0 // multiplicador adicional
    },

    // Skills system (si existe)
    skills: null,
    skillsState: null,

    // Rush timer
    timeLeftMs: 0,

    // render
    cellPx: 24,
    offX: 0,
    offY: 0,

    // PWA update
    pendingReload: false
  };

  // ───────────────────────── Upgrades fallback (si no skills.js) ─────────────────────────
  const FallbackUpgrades = [
    {
      id: "hp_plus",
      rarity: "common",
      name: () => t("up.hpPlus", null, "Vida +"),
      desc: () => t("up.hpPlusDesc", null, "+2 corazones máximos y cura 2."),
      apply: () => {
        State.maxHp += 2;
        State.hp = clampInt(State.hp + 2, 0, State.maxHp);
        toast(t("toast.hpUp", null, "Vida aumentada."));
      }
    },
    {
      id: "magnet",
      rarity: "rare",
      name: () => t("up.magnet", null, "Imán"),
      desc: () => t("up.magnetDesc", null, "Atracción temporal de loot cercano."),
      apply: () => {
        // Duración según rareza del pick (fallback simple)
        State.buffs.magnetMs = Math.max(State.buffs.magnetMs, 12000);
        toast(t("toast.magnet", null, "Imán activo."));
      }
    },
    {
      id: "shield",
      rarity: "common",
      name: () => t("up.shield", null, "Escudo"),
      desc: () => t("up.shieldDesc", null, "+1 escudo. Bloquea 1 golpe de trampa."),
      apply: () => {
        State.buffs.shield = clampInt(State.buffs.shield + 1, 0, 99);
        toast(t("toast.shield", null, "Escudo +1."));
      }
    },
    {
      id: "score_boost",
      rarity: "epic",
      name: () => t("up.scoreBoost", null, "Puntos x"),
      desc: () => t("up.scoreBoostDesc", null, "Aumenta tu puntuación ganada."),
      apply: () => {
        State.buffs.scoreBoost = clamp(Number(State.buffs.scoreBoost) + 0.10, 0, 2);
        toast(t("toast.scoreBoost", null, "Más puntuación por loot."));
      }
    }
  ];

  const RARITY_WEIGHT = { common: 70, rare: 22, epic: 7, legendary: 1 };

  function pickFallbackChoices(rng, count) {
    const pool = FallbackUpgrades.slice();
    const picks = [];
    for (let i = 0; i < count; i++) {
      if (!pool.length) break;
      let total = 0;
      for (const u of pool) total += (RARITY_WEIGHT[u.rarity] || 1);
      let r = rng() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= (RARITY_WEIGHT[pool[idx].rarity] || 1);
        if (r <= 0) break;
      }
      idx = clampInt(idx, 0, pool.length - 1);
      picks.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picks;
  }

  // ───────────────────────── Skills system handshake ─────────────────────────
  const SKILLS_KEY = `${KEY_NEW}skills_state_v1`;

  function loadSkillsState() {
    const st = lsGetJSON(SKILLS_KEY, null);
    return (st && typeof st === "object") ? st : {};
  }
  function saveSkillsState(st) {
    if (!st || typeof st !== "object") return;
    lsSetJSON(SKILLS_KEY, st);
  }

  function createSkillsIfAvailable() {
    if (!GRSkills || typeof GRSkills.create !== "function") return null;

    const api = {
      version: APP_VERSION,
      // util
      clamp, clampInt, lerp,
      now: () => perfNow(),
      t,
      // estado “guardable”
      getState: () => State.skillsState,
      setState: (s) => { State.skillsState = (s && typeof s === "object") ? s : {}; saveSkillsState(State.skillsState); },
      // lectura simple del run
      getRun: () => ({
        mode: State.mode,
        score: State.score,
        level: State.level,
        hp: State.hp,
        maxHp: State.maxHp
      }),
      // feedback
      toast: (msg) => toast(msg),
      // audio hooks
      sfx: (id) => sfx(id),
      // RNG del run
      rng: () => State.rng()
    };

    try {
      State.skillsState = loadSkillsState();
      const sys = GRSkills.create(api, 3);
      // si el sys quiere inicializar estado
      if (sys && typeof sys.load === "function") sys.load(State.skillsState);
      return sys;
    } catch (e) {
      warn("skills.js detectado pero falló create():", e);
      return null;
    }
  }

  // ───────────────────────── HUD helpers ─────────────────────────
  function setText(id, txt) {
    const n = document.getElementById(id);
    if (n) n.textContent = String(txt);
  }

  function hearts(hp, maxHp) {
    const full = "❤";
    const empty = "♡";
    const a = clampInt(hp, 0, 999);
    const b = clampInt(maxHp, 0, 999);
    let s = "";
    for (let i = 0; i < b; i++) s += (i < a) ? full : empty;
    return s;
  }

  function setHPUI() {
    setText("gr-hp", hearts(State.hp, State.maxHp));
  }

  function setBadgesUI() {
    const wrap = document.getElementById("gr-badges");
    if (!wrap) return;
    wrap.innerHTML = "";

    const badges = [];

    if (State.buffs.shield > 0) {
      badges.push({ id: "shield", text: `🛡 ${State.buffs.shield}` });
    }
    if (State.buffs.magnetMs > 0) {
      const s = Math.ceil(State.buffs.magnetMs / 1000);
      badges.push({ id: "magnet", text: `🧲 ${s}s` });
    }
    if (State.buffs.scoreBoost > 0) {
      const p = Math.round(State.buffs.scoreBoost * 100);
      badges.push({ id: "boost", text: `✦ +${p}%` });
    }
    if (State.mode === "rush" && State.running) {
      const s = Math.max(0, Math.ceil(State.timeLeftMs / 1000));
      badges.push({ id: "timer", text: `⏱ ${s}s` });
    }

    for (const b of badges) {
      wrap.appendChild(el("div", { class: "gr-badge", "data-badge": b.id, text: b.text }));
    }
  }

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
    }, 1800);
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
    // Si el tag coincide, evitamos bucles
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
    // Si está en run, pospone
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

    try {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    } catch (_) {}

    try {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // El SW tomó control. No forzar reload en run.
        showUpdatePill(t("ui.applyUpdate", null, "Aplicar update"), () => applyUpdateNow());
      });
    } catch (_) {}

    // También si hay waiting SW, intentamos notificar
    try {
      navigator.serviceWorker.ready.then((reg) => {
        if (!reg) return;
        // Si ya hay uno esperando, avisar
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
            if (nw.state === "installed") {
              // Si ya hay controller => update
              if (navigator.serviceWorker.controller) {
                showUpdatePill(t("ui.applyUpdate", null, "Aplicar update"), () => {
                  try { nw.postMessage({ type: "SKIP_WAITING" }); } catch (_) {}
                  applyUpdateNow();
                });
              }
            }
          });
        });
      }).catch(() => {});
    } catch (_) {}
  }

  // ───────────────────────── Game generation ─────────────────────────
  function allocGrid(w, h) {
    const arr = new Uint8Array(w * h);
    arr.fill(Tile.Empty);
    return arr;
  }

  function idx(x, y) { return y * State.w + x; }

  function getTile(x, y) {
    if (x < 0 || y < 0 || x >= State.w || y >= State.h) return Tile.Block;
    return State.grid[idx(x, y)];
  }

  function setTile(x, y, v) {
    if (x < 0 || y < 0 || x >= State.w || y >= State.h) return;
    State.grid[idx(x, y)] = v;
  }

  function randTile(rng, mode) {
    const m = MODE_DEF[mode] || MODE_DEF.classic;
    const r = rng();

    // Probabilidades base
    // Bloques para dar “laberinto”, traps según modo
    if (r < 0.12) return Tile.Block;
    if (r < 0.50) return Tile.Coin;
    if (r < 0.72) return Tile.Empty;
    if (r < 0.90) return Tile.Gem;
    if (r < 0.98) return Tile.Bonus;
    if (m.trapEnabled) return Tile.Trap;
    return Tile.Empty;
  }

  function generateGrid() {
    State.grid = allocGrid(State.w, State.h);

    // borde: algo más bloqueado en laterales para “mapa”
    for (let y = 0; y < State.h; y++) {
      for (let x = 0; x < State.w; x++) {
        let v = randTile(State.rng, State.mode);

        // Centro de inicio despejado
        if (x === (State.w >> 1) && y === (State.h >> 1)) v = Tile.Empty;

        // Evitar demasiados blocks seguidos en el borde
        if ((x === 0 || y === 0 || x === State.w - 1 || y === State.h - 1) && State.rng() < 0.20) {
          v = Tile.Block;
        }
        setTile(x, y, v);
      }
    }

    // Start en el centro
    State.px = (State.w >> 1);
    State.py = (State.h >> 1);
    setTile(State.px, State.py, Tile.Empty);
  }

  // ───────────────────────── Gameplay: collect / trap / xp ─────────────────────────
  function addScore(base) {
    const modeMult = (MODE_DEF[State.mode] || MODE_DEF.classic).scoreMult || 1;
    const comboMult = 1 + Math.min(2.5, State.combo * 0.08);
    const boostMult = 1 + (State.buffs.scoreBoost || 0);
    const gained = Math.round(base * modeMult * comboMult * boostMult);
    State.score += gained;
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

  function applyTrapHit() {
    if (State.buffs.shield > 0) {
      State.buffs.shield = clampInt(State.buffs.shield - 1, 0, 99);
      sfx("sfx_ui_click");
      toast(t("toast.shieldBlock", null, "Escudo bloqueó el golpe."));
      return;
    }
    State.hp = clampInt(State.hp - 1, 0, State.maxHp);
    sfx("sfx_trap");
    toast(t("toast.hit", null, "-1 vida."));
    if (State.hp <= 0) endGame();
  }

  function applyCollect(tileType) {
    if (tileType === Tile.Coin) {
      sfx("sfx_coin");
      addScore(10);
      gainXP(8);
      bumpCombo();
    } else if (tileType === Tile.Gem) {
      sfx("sfx_gem");
      addScore(25);
      gainXP(14);
      bumpCombo();
    } else if (tileType === Tile.Bonus) {
      sfx("sfx_bonus");
      addScore(50);
      gainXP(18);
      bumpCombo();
    } else if (tileType === Tile.Trap) {
      // rompe combo
      State.combo = 0;
      State.comboTimer = 0;
      applyTrapHit();
    } else {
      // vacío / bloque no suma
      State.combo = 0;
      State.comboTimer = 0;
    }
  }

  function bumpCombo() {
    State.combo = clampInt(State.combo + 1, 0, 999);
    State.comboTimer = 1600; // ms
    if (State.combo > 1) sfx("sfx_combo");
  }

  function respawnSomeTiles() {
    // Mantiene el tablero “vivo”: tras cada paso, re-roll de 1-2 celdas vacías
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

  // ───────────────────────── Movement ─────────────────────────
  function tryMove(dx, dy) {
    if (!State.running || State.paused || State.gameOver) return;
    const nx = State.px + dx;
    const ny = State.py + dy;

    const tt = getTile(nx, ny);
    if (tt === Tile.Block) {
      sfx("sfx_block");
      // mini feedback de combo cortado
      State.combo = 0;
      State.comboTimer = 0;
      return;
    }

    State.px = nx;
    State.py = ny;
    State.steps++;

    // “pisar” tile
    const stepped = tt;
    setTile(nx, ny, Tile.Empty);
    applyCollect(stepped);

    // Magnet: convierte loot cercano en recogida automática (simple)
    if (State.buffs.magnetMs > 0) {
      magnetPull();
    }

    respawnSomeTiles();
    updateHUD();
    draw();
  }

  function magnetPull() {
    // Pull 1 tile adyacente por step (prioridad: gem > bonus > coin)
    const around = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    let best = null;
    let bestScore = -1;
    for (const [dx, dy] of around) {
      const x = State.px + dx, y = State.py + dy;
      const tt = getTile(x, y);
      let s = -1;
      if (tt === Tile.Bonus) s = 3;
      else if (tt === Tile.Gem) s = 2;
      else if (tt === Tile.Coin) s = 1;
      if (s > bestScore) { bestScore = s; best = [x, y, tt]; }
    }
    if (best && bestScore > 0) {
      const [x, y, tt] = best;
      setTile(x, y, Tile.Empty);
      applyCollect(tt);
    }
  }

  // ───────────────────────── LevelUp UI + aplicación ─────────────────────────
  function onLevelUp() {
    sfx("sfx_levelup");
    openLevelUpPicker();
  }

  function openLevelUpPicker() {
    // pausar “suavemente” pero sin entrar en Pause (para no mezclar UI)
    State.paused = true;
    renderPauseState();

    const modal = document.getElementById("gr-levelup");
    const wrap = document.getElementById("gr-levelup-choices");
    const title = document.getElementById("gr-levelup-title");
    const sub = document.getElementById("gr-levelup-sub");
    if (!modal || !wrap) return;

    title.textContent = t("ui.levelUp", null, `Nivel ${State.level}`);
    sub.textContent = t("ui.chooseSkill", null, "Elige 1 mejora");

    wrap.innerHTML = "";

    let choices = null;

    // skills.js si existe: intentamos varias APIs sin romper
    if (State.skills) {
      try {
        if (typeof State.skills.getLevelUpChoices === "function") {
          choices = State.skills.getLevelUpChoices({ level: State.level });
        } else if (typeof State.skills.rollLevelUpChoices === "function") {
          choices = State.skills.rollLevelUpChoices({ level: State.level });
        } else if (typeof State.skills.levelUpChoices === "function") {
          choices = State.skills.levelUpChoices({ level: State.level });
        }
      } catch (e) {
        warn("skills choices falló:", e);
        choices = null;
      }
    }

    // fallback
    if (!choices || !Array.isArray(choices) || choices.length === 0) {
      const picks = pickFallbackChoices(State.rng, 3);
      choices = picks.map((u) => ({
        id: u.id,
        rarity: u.rarity,
        name: u.name(),
        desc: u.desc(),
        _fallback: u
      }));
    }

    const pick = (ch) => {
      closeLevelUpPicker();
      applyChoice(ch);
    };

    for (const ch of choices.slice(0, 3)) {
      const btn = el("button", { class: "gr-skill", type: "button" }, [
        el("div", { class: "gr-skill-top" }, [
          el("div", { class: "gr-skill-name", text: String(ch.name || ch.title || ch.id) }),
          el("div", { class: "gr-skill-rarity", text: String(ch.rarity || "").toUpperCase() })
        ]),
        el("div", { class: "gr-skill-desc", text: String(ch.desc || ch.description || "") })
      ]);
      btn.addEventListener("click", () => pick(ch));
      wrap.appendChild(btn);
    }

    modal.style.display = "flex";
  }

  function closeLevelUpPicker() {
    const modal = document.getElementById("gr-levelup");
    if (modal) modal.style.display = "none";
    State.paused = false;
    renderPauseState();
  }

  function applyChoice(choice) {
    // skills.js: intentar aplicar
    if (State.skills) {
      try {
        if (typeof State.skills.apply === "function") {
          State.skills.apply(choice);
          // si el sistema mutó estado, persistimos
          if (typeof State.skills.save === "function") {
            const st = State.skills.save();
            if (st && typeof st === "object") {
              State.skillsState = st;
              saveSkillsState(st);
            }
          }
          updateHUD();
          draw();
          return;
        }
        if (typeof State.skills.pick === "function") {
          State.skills.pick(choice);
          updateHUD();
          draw();
          return;
        }
      } catch (e) {
        warn("skills apply falló, usando fallback:", e);
      }
    }

    // fallback
    if (choice && choice._fallback && typeof choice._fallback.apply === "function") {
      choice._fallback.apply();
    }
    updateHUD();
    draw();
  }

  // ───────────────────────── Render ─────────────────────────
  let ctx = null;
  let images = null;

  function computeLayout(canvas) {
    const root = $("#gr-root") || document.body;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width | 0);
    const h = Math.max(1, rect.height | 0);

    // Ajuste canvas interno a devicePixelRatio
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    canvas.width = Math.max(1, (w * dpr) | 0);
    canvas.height = Math.max(1, (h * dpr) | 0);

    // Cell size: encaja el grid centrado
    const pad = 16;
    const availableW = Math.max(1, w - pad * 2);
    const availableH = Math.max(1, h - pad * 2);

    const cell = Math.floor(Math.min(availableW / State.w, availableH / State.h));
    State.cellPx = Math.max(10, cell);

    const gridW = State.cellPx * State.w;
    const gridH = State.cellPx * State.h;

    State.offX = ((w - gridW) / 2) | 0;
    State.offY = ((h - gridH) / 2) | 0;

    // Para dibujar con DPR
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reduce motion
    try { root.classList.toggle("gr-reduce", !!Settings.reduceMotion); } catch (_) {}
  }

  function draw() {
    const canvas = $("#gr-canvas");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ox = State.offX, oy = State.offY, cs = State.cellPx;

    // Fondo
    ctx.fillStyle = "#07070b";
    ctx.fillRect(0, 0, (canvas.width / (window.devicePixelRatio || 1)), (canvas.height / (window.devicePixelRatio || 1)));

    // Grid cells
    for (let y = 0; y < State.h; y++) {
      for (let x = 0; x < State.w; x++) {
        const tt = getTile(x, y);
        const px = ox + x * cs;
        const py = oy + y * cs;

        // base cell
        ctx.fillStyle = "#0f0f16";
        ctx.fillRect(px, py, cs, cs);

        // tile
        drawTile(tt, px, py, cs);
      }
    }

    // Grid lines opcionales
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

    // Combo FX (simple)
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

      if (img) {
        try {
          ctx.drawImage(img, rx, ry, rs, rs);
          return;
        } catch (_) {}
      }
    }

    // fallback shapes
    if (tt === Tile.Block) {
      ctx.fillStyle = "#2a2a35";
      ctx.fillRect(rx, ry, rs, rs);
    } else if (tt === Tile.Coin) {
      ctx.fillStyle = "#ffcf3a";
      circle(rx + rs / 2, ry + rs / 2, rs * 0.32);
    } else if (tt === Tile.Gem) {
      ctx.fillStyle = "#64d6ff";
      diamond(rx + rs / 2, ry + rs / 2, rs * 0.34);
    } else if (tt === Tile.Bonus) {
      ctx.fillStyle = "#7bff77";
      star(rx + rs / 2, ry + rs / 2, rs * 0.33);
    } else if (tt === Tile.Trap) {
      ctx.fillStyle = "#ff3b4a";
      triangle(rx + rs / 2, ry + rs / 2, rs * 0.38);
    }
  }

  function drawPlayer(x, y, s) {
    const cx = x + s / 2, cy = y + s / 2;
    const r = s * 0.32;

    // aura escudo
    if (State.buffs.shield > 0) {
      ctx.strokeStyle = "rgba(120,190,255,0.75)";
      ctx.lineWidth = Math.max(2, (s * 0.08) | 0);
      circleStroke(cx, cy, r + s * 0.18);
    }

    // player core
    ctx.fillStyle = "#e8e8ff";
    circle(cx, cy, r);

    // “ojo” dirección (simple)
    ctx.fillStyle = "#0b0b10";
    circle(cx + r * 0.35, cy - r * 0.15, r * 0.15);
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function circleStroke(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
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
    // 5 puntas simple
    const spikes = 5;
    const outer = r;
    const inner = r * 0.45;
    let rot = Math.PI / 2 * 3;
    let cx = x, cy = y;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
      rot += Math.PI / spikes;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
      rot += Math.PI / spikes;
    }
    ctx.lineTo(cx, cy - outer);
    ctx.closePath();
    ctx.fill();
  }

  // ───────────────────────── HUD / UI updates ─────────────────────────
  function updateHUD() {
    setText("gr-score", State.score);
    setText("gr-level", State.level);
    setHPUI();
    setBadgesUI();
  }

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
    // dpad
    const dpad = $("#gr-dpad");
    if (dpad) dpad.style.display = (isTouch && State.running && !State.paused && !State.gameOver) ? "block" : "none";
    // hud
    showHUD(State.running && !State.gameOver);
    // pause modal
    showPause(!!State.paused && State.running && !State.gameOver && $("#gr-levelup")?.style.display !== "flex");
  }

  // ───────────────────────── Run lifecycle ─────────────────────────
  let Settings = loadSettings();

  function getActiveProfileId() {
    if (Auth && typeof Auth.getActiveProfileId === "function") {
      try { return String(Auth.getActiveProfileId() || "default"); } catch (_) { return "default"; }
    }
    return "default";
  }

  function getBestScore(profileId) {
    if (Auth && typeof Auth.getBestScore === "function") {
      try { return Number(Auth.getBestScore(profileId)) || 0; } catch (_) { return 0; }
    }
    // fallback local
    return Number(lsGet(`${KEY_NEW}best_${profileId}`, "0")) || 0;
  }

  function setBestScore(profileId, v) {
    if (Auth && typeof Auth.setBestScore === "function") {
      try { Auth.setBestScore(profileId, v); return; } catch (_) {}
    }
    lsSet(`${KEY_NEW}best_${profileId}`, String(v | 0));
  }

  function setLastRun(profileId, score) {
    lsSet(`${KEY_NEW}last_${profileId}`, String(score | 0));
  }

  function getLastRun(profileId) {
    return Number(lsGet(`${KEY_NEW}last_${profileId}`, "0")) || 0;
  }

  function newRunSeed(profileId) {
    // estable: perfil + fecha día + random
    const base = `${profileId}|${new Date().toDateString()}|${Math.random()}`;
    return hashStrToSeed(base);
  }

  function startGame() {
    unlockAudio();

    State.running = true;
    State.paused = false;
    State.gameOver = false;

    const profileId = getActiveProfileId();
    State.seed = newRunSeed(profileId);
    State.rng = mulberry32(State.seed);

    // aplicar modo
    const m = MODE_DEF[State.mode] || MODE_DEF.classic;

    State.score = 0;
    State.steps = 0;
    State.combo = 0;
    State.comboTimer = 0;

    State.level = 1;
    State.xp = 0;
    State.xpNeed = 30;

    State.maxHp = m.hp;
    State.hp = m.hp;

    State.buffs.magnetMs = 0;
    State.buffs.shield = 0;
    State.buffs.scoreBoost = 0;

    State.timeLeftMs = (m.timeLimitSec > 0) ? (m.timeLimitSec * 1000) : 0;

    generateGrid();

    // asegurar skills
    if (!State.skills) State.skills = createSkillsIfAvailable();

    showMenu(false);
    showHUD(true);
    renderPauseState();

    updateHUD();
    draw();

    music("music_loop");
    sfx("sfx_ui_click");
  }

  function endGame() {
    State.gameOver = true;
    State.running = false;
    State.paused = false;

    // persist best
    const profileId = getActiveProfileId();
    const best = getBestScore(profileId);
    const score = State.score | 0;
    if (score > best) setBestScore(profileId, score);
    setLastRun(profileId, score);

    // UI
    setText("gr-over-score", score);
    setText("gr-over-best", Math.max(best, score));
    showGameOver(true);
    showHUD(false);
    renderPauseState();

    sfx("sfx_gameover");

    // aplicar update pendiente si existía
    if (State.pendingReload) {
      State.pendingReload = false;
      applyUpdateNow();
    }
  }

  function exitToMenu() {
    State.running = false;
    State.paused = false;
    State.gameOver = false;

    showGameOver(false);
    showPause(false);
    closeLevelUpPicker();

    showMenu(true);
    showHUD(false);
    renderPauseState();

    // refresca KPIs
    refreshMenuKPIs();

    // update pill: si había update, sigue visible
    draw();
  }

  function restartRun() {
    showGameOver(false);
    showPause(false);
    closeLevelUpPicker();
    startGame();
  }

  function togglePause() {
    if (!State.running || State.gameOver) return;
    // si está picker abierto, no alternar
    const pickerOpen = ($("#gr-levelup") && $("#gr-levelup").style.display === "flex");
    if (pickerOpen) return;
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

    // timers
    if (State.comboTimer > 0) State.comboTimer = Math.max(0, State.comboTimer - dt);
    if (State.comboTimer === 0) State.combo = 0;

    if (State.buffs.magnetMs > 0) State.buffs.magnetMs = Math.max(0, State.buffs.magnetMs - dt);

    // rush timer
    if (State.mode === "rush" && State.timeLeftMs > 0) {
      State.timeLeftMs = Math.max(0, State.timeLeftMs - dt);
      if (State.timeLeftMs === 0) endGame();
    }

    // HUD badges updates (solo si cambia algo)
    setBadgesUI();
  }

  // ───────────────────────── Input ─────────────────────────
  function bindInput() {
    window.addEventListener("keydown", (e) => {
      if (!e) return;
      const k = e.key || e.code;

      // Unlock audio on first input
      if (k) unlockAudio();

      // Menú: Enter para start
      if (!State.running && !State.gameOver) {
        if (k === "Enter") {
          const menuVisible = $("#gr-menu") && $("#gr-menu").style.display !== "none";
          if (menuVisible) { startGame(); e.preventDefault(); }
        }
      }

      if (k === "Escape") {
        if (State.gameOver) {
          exitToMenu();
          e.preventDefault();
          return;
        }
        if (!State.running) return;
        togglePause();
        e.preventDefault();
        return;
      }

      if (!State.running || State.paused || State.gameOver) return;

      if (k === "ArrowUp" || k === "w" || k === "W") { tryMove(0, -1); e.preventDefault(); }
      else if (k === "ArrowDown" || k === "s" || k === "S") { tryMove(0, 1); e.preventDefault(); }
      else if (k === "ArrowLeft" || k === "a" || k === "A") { tryMove(-1, 0); e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { tryMove(1, 0); e.preventDefault(); }
    }, { passive: false });

    // D-Pad móvil
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

    // tap en canvas: mueve hacia el tap (simple)
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
          if (Math.abs(dx) + Math.abs(dy) === 1) tryMove(Math.sign(dx), Math.sign(dy));
        } catch (_) {}
      }, { passive: true });
    }
  }

  // ───────────────────────── Menu interactions ─────────────────────────
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

    // Modes
    $$(".gr-mode").forEach((b) => {
      b.addEventListener("click", () => {
        unlockAudio();
        $$(".gr-mode").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const mode = String(b.getAttribute("data-mode") || "classic");
        if (MODE_DEF[mode]) {
          State.mode = mode;
          lsSet(`${KEY_NEW}mode`, mode);
          toast(t("toast.mode", null, "Modo seleccionado."));
        }
        sfx("sfx_ui_click");
      });
    });

    // Start
    $("#gr-btn-start")?.addEventListener("click", () => { startGame(); });

    // Tutorial
    $("#gr-btn-tutorial")?.addEventListener("click", () => {
      unlockAudio();
      openInfoModal(
        t("ui.howToPlay", null, "Cómo jugar"),
        [
          `• ${t("how.move", null, "Muévete con WASD / flechas o el D-Pad.")}`,
          `• ${t("how.collect", null, "Pisa monedas/gemas/bonus para sumar puntos y XP.")}`,
          `• ${t("how.combo", null, "Encadena recogidas para COMBO (más puntos).")}`,
          `• ${t("how.trap", null, "Las trampas quitan vida (escudo las bloquea).")}`,
          `• ${t("how.level", null, "Al subir de nivel eliges 1 skill.")}`,
          `• ${t("how.pwa", null, "Si hay actualización, verás un botón para aplicarla sin romper tu run.")}`
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
        refreshMenuKPIs();
      } else {
        openInfoModal(
          t("ui.profile", null, "Perfil"),
          t("profile.noAuth", null, "No se detectó auth.js. Estás usando el perfil 'default'.")
        );
      }
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
        try {
          if (I18n && typeof I18n.setLanguage === "function") I18n.setLanguage(v);
        } catch (_) {}
        // Re-pinta textos visibles (sin reconstruir todo)
        softRelabelUI();
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

    // Info modal close
    $("#gr-infomodal-close")?.addEventListener("click", () => closeInfoModal());

    // Install PWA button
    bindInstallButton();
  }

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

  function refreshMenuKPIs() {
    const profileId = getActiveProfileId();
    const best = getBestScore(profileId);
    const last = getLastRun(profileId);

    setText("gr-bestscore", best);
    setText("gr-lastrun", last ? String(last) : "—");
    const p = $("#gr-profile-active");
    if (p) p.textContent = profileId;
  }

  // Relabel superficial (no re-crea DOM). Si quieres full re-i18n, recarga.
  function softRelabelUI() {
    // Menu top
    const install = $("#gr-btn-install .gr-btn-text");
    if (install) install.textContent = t("ui.install", null, "Instalar");
    const start = $("#gr-btn-start .gr-btn-text");
    if (start) start.textContent = t("ui.start", null, "Empezar");
    const tut = $("#gr-btn-tutorial .gr-btn-text");
    if (tut) tut.textContent = t("ui.howToPlay", null, "Cómo jugar");

    const pause = $("#gr-btn-pause .gr-btn-text");
    if (pause) pause.textContent = t("ui.pause", null, "Pausa");

    // Tabs
    $$(".gr-tab").forEach((b) => {
      const tab = b.getAttribute("data-tab");
      if (tab === "play") b.textContent = t("ui.play", null, "Jugar");
      else if (tab === "modes") b.textContent = t("ui.modes", null, "Modos");
      else if (tab === "options") b.textContent = t("ui.options", null, "Opciones");
      else if (tab === "profile") b.textContent = t("ui.profile", null, "Perfil");
      else if (tab === "credits") b.textContent = t("ui.credits", null, "Créditos");
    });

    // HUD labels
    const hudLabels = $$("#gr-hud .gr-hud-label");
    if (hudLabels && hudLabels.length >= 3) {
      hudLabels[0].textContent = t("ui.score", null, "Puntos");
      hudLabels[1].textContent = t("ui.level", null, "Nivel");
      hudLabels[2].textContent = t("ui.hp", null, "Vida");
    }
  }

  // ───────────────────────── PWA Install prompt ─────────────────────────
  let deferredInstall = null;

  function bindInstallButton() {
    const btn = $("#gr-btn-install");
    if (!btn) return;

    const canInstall = () => !!deferredInstall;

    const refresh = () => {
      // Ocultar si no instalable o si ya está en modo standalone
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

    // VisualViewport (móvil)
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => doResize(), { passive: true });
      }
    } catch (_) {}

    // ResizeObserver del canvas (si CSS lo cambia)
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

    if (GRPerf && typeof GRPerf.mark === "function") {
      try { GRPerf.mark("app_boot_start"); } catch (_) {}
    }

    migrateOldKeys();
    ensureMetaViewport();

    // Modo recordado
    const savedMode = String(lsGet(`${KEY_NEW}mode`, "classic"));
    if (MODE_DEF[savedMode]) State.mode = savedMode;

    // Settings + audio
    Settings = loadSettings();
    applyAudioSettings(Settings);

    // I18n: aplicar idioma guardado
    try {
      if (I18n && typeof I18n.setLanguage === "function") I18n.setLanguage(Settings.lang || "auto");
    } catch (_) {}

    const root = ensureRoot();
    const canvas = ensureCanvas(root);
    const overlays = ensureOverlays(root);

    // Context 2D
    try { ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }); } catch (_) { ctx = null; }
    if (!ctx) {
      overlays.splash.querySelector(".gr-subtitle").textContent = "Canvas no disponible.";
      return;
    }

    // Poblar selector idioma
    populateLanguageOptions();

    // Cargar settings en UI
    syncOptionsUI();

    // KPIs
    refreshMenuKPIs();

    // Bind UI
    bindMenuUI();
    bindInput();

    // Resize
    bindResize(canvas);

    // Sprites
    images = await loadImages(SPRITES);

    // Skills (si existe)
    State.skills = createSkillsIfAvailable();

    // SW
    setupServiceWorker();

    // Mostrar menú
    showSplash(false);
    showMenu(true);
    draw();

    // Loop
    requestAnimationFrame(tick);

    if (GRPerf && typeof GRPerf.mark === "function") {
      try { GRPerf.mark("app_boot_ready"); } catch (_) {}
    }
    log("Boot OK v" + APP_VERSION);
  }

  function populateLanguageOptions() {
    const sel = $("#gr-opt-lang");
    if (!sel) return;
    sel.innerHTML = "";
    const add = (value, label) => sel.appendChild(el("option", { value, text: label }));

    add("auto", t("lang.auto", null, "Auto"));

    // Si I18n expone opciones, usarlo
    if (I18n) {
      try {
        if (typeof I18n.languageOptions === "function") {
          const opts = I18n.languageOptions();
          if (Array.isArray(opts)) {
            for (const o of opts) {
              if (!o) continue;
              add(String(o.value || o.code || ""), String(o.label || o.name || o.value || o.code || ""));
            }
            sel.value = Settings.lang || "auto";
            return;
          }
        }
      } catch (_) {}
    }

    // fallback mínimo
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
      if (State.running) {
        State.running = false;
        State.paused = false;
        State.gameOver = true;
      }
      fatalOverlay((e && e.message) ? e.message : "Error");
    } catch (_) {}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try {
      err("unhandledrejection", e && e.reason);
      if (State.running) {
        State.running = false;
        State.paused = false;
        State.gameOver = true;
      }
      fatalOverlay((e && e.reason) ? String(e.reason) : "Rechazo no controlado");
    } catch (_) {}
  });

  // ───────────────────────── Public minimal API (opcional) ─────────────────────────
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
          level: State.level,
          hp: State.hp,
          mode: State.mode
        })
      };
    }
  } catch (_) {}

  // ───────────────────────── Boot now ─────────────────────────
  try {
    // Evita doble boot si algún index viejo lo llama
    if (typeof window !== "undefined") window.__GRIDROGUE_BOOTED = true;
  } catch (_) {}

  // Boot cuando DOM listo
  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  }
})();
