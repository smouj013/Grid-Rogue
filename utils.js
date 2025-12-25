/* utils.js — Grid Rogue v0.2.0 (UPDATED+HARDENED)
   Helpers compartidos (clamps, DOM, overlays, viewport-fix móvil, scroll-lock, etc.)
   ✅ HUD helpers robustos (layout nuevo + fallback legacy + autocreación sin romper)
   ✅ overlay fadeIn/fadeOut compatible con styles.css
   ✅ viewport vars con visualViewport + fallback + fix iOS (100vh)
   ✅ scroll-lock con contador (no rompe overlays encadenados)
   ✅ canLS/ls helpers con fallback RAM si LS bloqueado
   ✅ Exporta window.GRUtils + alias window.Utils (compat)
*/
(() => {
  "use strict";

  const VERSION = "0.2.2";

  // ───────────────────────── Math / Random ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a | 0, Math.min(b | 0, v));
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  // ───────────────────────── Rarity helpers ─────────────────────────
  const RARITY_MULT = Object.freeze({
    common: 1.0,
    rare: 1.5,
    epic: 2.25,
    legendary: 3.0,
  });

  function rarityMult(rarity) {
    const k = String(rarity || "common").toLowerCase();
    return RARITY_MULT[k] ?? 1.0;
  }

  function scaleByRarity(baseSeconds, rarity) {
    const base = Number(baseSeconds);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return base * rarityMult(rarity);
  }

  // ───────────────────────── Time formatting ─────────────────────────
  const pad2 = (n) => String(n | 0).padStart(2, "0");

  function fmtSeconds(sec) {
    sec = Number(sec);
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    if (sec < 10) return sec.toFixed(1);
    return String(Math.ceil(sec));
  }

  function now() { return Date.now(); }

  // ───────────────────────── JSON / Storage ─────────────────────────
  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const safeStringify = (obj, fallback = "") => { try { return JSON.stringify(obj); } catch { return fallback; } };

  function canLS() {
    try {
      const k = "__ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  // Fallback RAM cuando LS está bloqueado (Safari privado, policies, etc.)
  const __RAM = Object.create(null);

  function lsGetRaw(key) {
    try { return localStorage.getItem(key); } catch { return (__RAM[key] ?? null); }
  }
  function lsSetRaw(key, value) {
    try { localStorage.setItem(key, String(value ?? "")); return true; } catch {
      __RAM[key] = String(value ?? "");
      return false;
    }
  }
  function lsDelRaw(key) {
    try { localStorage.removeItem(key); delete __RAM[key]; return true; } catch {
      delete __RAM[key];
      return false;
    }
  }

  function lsGet(key, fallback) {
    const raw = lsGetRaw(key);
    if (raw == null) return fallback;
    return safeParse(raw, fallback);
  }
  function lsSet(key, value) {
    const raw = safeStringify(value, "");
    if (!raw) return false;
    return lsSetRaw(key, raw) || !canLS();
  }
  function lsDel(key) {
    return lsDelRaw(key) || !canLS();
  }

  // ───────────────────────── DOM helpers ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); return () => off(el, ev, fn, opts); }
  function off(el, ev, fn, opts) { if (el) el.removeEventListener(ev, fn, opts); }

  function setAttrs(el, attrs) {
    if (!el || !attrs) return el;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") el.className = String(v);
      else if (k === "text") el.textContent = String(v);
      else if (k === "html") el.innerHTML = String(v);
      else if (k === "dataset" && v && typeof v === "object") {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = String(dv);
      } else if (k in el) {
        try { el[k] = v; } catch { el.setAttribute(k, String(v)); }
      } else {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function createEl(tag, attrs, children) {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const ch of arr) {
        if (ch == null) continue;
        if (typeof ch === "string" || typeof ch === "number") el.appendChild(document.createTextNode(String(ch)));
        else el.appendChild(ch);
      }
    }
    return el;
  }

  function clearEl(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }

  function addClass(el, c) { if (el && c) el.classList.add(c); }
  function removeClass(el, c) { if (el && c) el.classList.remove(c); }
  function toggleClass(el, c, force) { if (el && c) el.classList.toggle(c, force); }

  // ───────────────────────── Overlays / UI ─────────────────────────
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

  function overlayFadeOut(el, ms = 160) {
    return new Promise((res) => {
      if (!el || el.hidden) return res();
      el.classList.remove("fadeIn");
      el.classList.add("fadeOut");
      setTimeout(() => { overlayHide(el); res(); }, Math.max(0, ms | 0));
    });
  }

  function pulse(el, className = "pulse", ms = 220) {
    if (!el) return;
    el.classList.remove(className);
    // fuerza reflow
    void el.offsetHeight;
    el.classList.add(className);
    if (ms > 0) setTimeout(() => el.classList.remove(className), ms);
  }

  function setPill(el, value) {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(value);
    else el.textContent = String(value);
  }

  function setState(s) { try { document.body.dataset.state = String(s); } catch {} }

  // ───────────────────────── Device / Mobile helpers ─────────────────────────
  function isStandalone() {
    try {
      return (
        (typeof navigator !== "undefined" && navigator.standalone === true) ||
        (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) ||
        (typeof matchMedia === "function" && matchMedia("(display-mode: fullscreen)").matches)
      );
    } catch {
      return false;
    }
  }

  function isMobileLike() {
    try {
      const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
      const small = typeof matchMedia === "function" && matchMedia("(max-width: 900px)").matches;
      return !!(coarse || small);
    } catch {
      return false;
    }
  }

  function applyViewportVars() {
    try {
      const vv = window.visualViewport;
      const h = (vv && Number.isFinite(vv.height)) ? vv.height : window.innerHeight;
      const w = (vv && Number.isFinite(vv.width)) ? vv.width : window.innerWidth;

      document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
      document.documentElement.style.setProperty("--vw", `${w * 0.01}px`);

      // extra: offset por teclado/scroll del visualViewport (iOS)
      const offY = (vv && Number.isFinite(vv.offsetTop)) ? vv.offsetTop : 0;
      document.documentElement.style.setProperty("--vvoffY", `${offY}px`);

      if (document.body?.dataset) {
        document.body.dataset.mobile = isMobileLike() ? "1" : "0";
        document.body.dataset.standalone = isStandalone() ? "1" : "0";
      }
    } catch {}
  }

  function rafThrottle(fn) {
    let raf = 0;
    let lastArgs = null;
    return function throttled(...args) {
      lastArgs = args;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { fn.apply(null, lastArgs); } catch {}
      });
    };
  }

  function onViewportChange(cb, { immediate = true } = {}) {
    const handler = rafThrottle(() => cb());
    const unsubs = [];

    unsubs.push(on(window, "resize", handler, { passive: true }));
    unsubs.push(on(window, "orientationchange", handler, { passive: true }));

    if (window.visualViewport) {
      unsubs.push(on(window.visualViewport, "resize", handler, { passive: true }));
      unsubs.push(on(window.visualViewport, "scroll", handler, { passive: true }));
    }

    if (immediate) handler();
    return () => unsubs.forEach((u) => { try { u(); } catch {} });
  }

  // ───────────────────────── Scroll lock ─────────────────────────
  let __scrollLockCount = 0;
  let __scrollY = 0;

  function lockScroll() {
    __scrollLockCount++;
    if (__scrollLockCount !== 1) return;

    try {
      __scrollY = window.scrollY || 0;
      document.documentElement.classList.add("noScroll");
      document.body.classList.add("noScroll");
      document.body.style.top = `-${__scrollY}px`;
    } catch {}
  }

  function unlockScroll() {
    __scrollLockCount = Math.max(0, __scrollLockCount - 1);
    if (__scrollLockCount !== 0) return;

    try {
      document.documentElement.classList.remove("noScroll");
      document.body.classList.remove("noScroll");
      const y = __scrollY | 0;
      document.body.style.top = "";
      window.scrollTo(0, y);
    } catch {}
  }

  // ───────────────────────── HUD helpers (v0.2.0) ─────────────────────────
  function ensureHudNodes() {
    // Layout esperado:
    // #hud (dentro de #canvasWrap)
    //   .combo
    //     #hudFloat
    //       #hudHearts
    //       .buffDock > #hudBuffs
    const hud = $("hud");
    if (!hud) return;

    const combo = qs(".combo", hud) || $("combo") || null;
    if (!combo) return;

    // Si ya existe el layout nuevo, ok
    let hudHearts = $("hudHearts");
    let hudBuffs = $("hudBuffs");
    if (hudHearts && hudBuffs) return;

    // Si solo existe legacy, no lo duplicamos (lo usaremos como fallback)
    const legacyHearts = $("hpHearts");
    const legacyBuffs = $("buffBadges");
    if ((!hudHearts && legacyHearts) || (!hudBuffs && legacyBuffs)) return;

    // Crear el flotante si falta (no empuja la barra de nivel)
    let hudFloat = $("hudFloat");
    if (!hudFloat) {
      hudFloat = createEl("div", { id: "hudFloat", class: "hudFloat" });
      const levelProg = $("levelProg");
      if (levelProg && levelProg.parentElement === combo) combo.insertBefore(hudFloat, levelProg);
      else combo.appendChild(hudFloat);
    }

    if (!hudHearts) {
      hudHearts = createEl("div", { id: "hudHearts", class: "hpWrap", "aria-label": "Vida" });
      hudFloat.appendChild(hudHearts);
    }

    if (!hudBuffs) {
      const dock = createEl("div", { class: "buffDock", "aria-label": "Mejoras activas" }, [
        createEl("div", { id: "hudBuffs", class: "buffBar" })
      ]);
      hudFloat.appendChild(dock);
      hudBuffs = $("hudBuffs");
    }
  }

  function getHeartsEl() {
    // Prioridad layout nuevo
    return $("hudHearts") || $("hpHearts") || null;
  }
  function getBuffsEl() {
    // Prioridad layout nuevo
    return $("hudBuffs") || $("buffBadges") || null;
  }

  function setHP(current, max = 10) {
    ensureHudNodes();

    const heartsEl = getHeartsEl();
    if (!heartsEl) return;

    const cur = clampInt(current, 0, 999);
    const mx = clampInt(max, 1, 999);

    clearEl(heartsEl);

    // Si estamos en layout nuevo, añadimos icono y contenedor como en tu CSS
    const isNew = heartsEl.id === "hudHearts";
    if (isNew) {
      heartsEl.appendChild(createEl("span", { class: "ms hpIcon", text: "favorite", "aria-hidden": "true" }));
      const row = createEl("span", { class: "hpHearts", "aria-hidden": "true" });
      for (let i = 0; i < mx; i++) {
        const full = i < cur;
        row.appendChild(createEl("span", { class: `ms heart ${full ? "full" : "empty"}`, text: "favorite" }));
      }
      heartsEl.appendChild(row);

      // Si mx es grande, añade “+N” para no romper UI
      if (mx > 12) {
        const more = createEl("span", { class: "hpMore", text: `+${mx - 12}` });
        // visual: mostramos 12 corazones y el resto como +N
        // (para evitar overflow en móviles)
        while (row.childNodes.length > 12) row.removeChild(row.lastChild);
        heartsEl.appendChild(more);
      }

      heartsEl.appendChild(createEl("span", { class: "hpText", text: `${cur}/${mx}` }));
      return;
    }

    // Legacy simple
    for (let i = 0; i < mx; i++) {
      const full = i < cur;
      heartsEl.appendChild(
        createEl("span", { class: `ms heart ${full ? "full" : "empty"}`, text: "favorite", "aria-hidden": "true" })
      );
    }
    const hpText = $("hpText");
    if (hpText) hpText.textContent = `${cur}/${mx}`;
  }

  // buffs: [{ key, kind, icon, rarity, count, timeLeft, duration, title/name }]
  function setBuffs(buffs) {
    ensureHudNodes();

    const wrap = getBuffsEl();
    if (!wrap) return;

    const arr = Array.isArray(buffs) ? buffs : [];
    clearEl(wrap);

    for (const b of arr) {
      if (!b) continue;

      const key = String(b.key || "");
      if (!key) continue;

      const kind = String(b.kind || b.key || "").toLowerCase();
      const rarity = String(b.rarity || "common").toLowerCase();
      const icon = String(b.icon || "auto_awesome");
      const count = clampInt(b.count ?? 1, 1, 999);

      const duration = Number(b.duration);
      const timeLeft = Number(b.timeLeft);
      const hasTimer =
        Number.isFinite(duration) && duration > 0 &&
        Number.isFinite(timeLeft) && timeLeft >= 0;

      const badge = createEl("div", {
        class: "buffBadge",
        title: String(b.title || b.name || key),
        dataset: { key, rarity, kind },
      });

      // Icono
      badge.appendChild(createEl("span", { class: "ms bIcon", text: icon, "aria-hidden": "true" }));

      // Timer (si hay)
      const timeEl = createEl("span", { class: "bTime", text: hasTimer ? fmtSeconds(timeLeft) : "" });
      if (!hasTimer) timeEl.hidden = true;
      badge.appendChild(timeEl);

      // Count (si >1)
      const countEl = createEl("span", { class: "bCount", text: String(count) });
      if (count <= 1) countEl.hidden = true;
      badge.appendChild(countEl);

      wrap.appendChild(badge);
    }
  }

  // ───────────────────────── Boot (viewport vars) ─────────────────────────
  onViewportChange(() => applyViewportVars(), { immediate: true });

  // ───────────────────────── Export ─────────────────────────
  const api = Object.freeze({
    VERSION,

    // Math
    clamp, clampInt, lerp, invLerp, randi, chance,

    // Rarity/time
    rarityMult, scaleByRarity, fmtSeconds, now, pad2,

    // JSON/Storage
    safeParse, safeStringify,
    canLS, lsGet, lsSet, lsDel,
    lsGetRaw, lsSetRaw, lsDelRaw,

    // DOM
    $, qs, qsa,
    on, off,
    setAttrs, createEl, clearEl,
    addClass, removeClass, toggleClass,

    // Overlays/UI
    overlayShow, overlayHide, overlayFadeOut,
    pulse,
    setPill, setState,

    // Device/Viewport
    isMobileLike, isStandalone,
    applyViewportVars,
    onViewportChange,
    rafThrottle,

    // Scroll lock
    lockScroll, unlockScroll,

    // HUD
    hud: Object.freeze({
      ensureHudNodes,
      setHP,
      setBuffs,
    }),
  });

  window.GRUtils = api;
  if (!window.Utils) window.Utils = api;
})();
