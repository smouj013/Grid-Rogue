/* utils.js — Grid Rogue v0.1.8
   Helpers compartidos (clamps, DOM, overlays, viewport-fix móvil, scroll-lock, etc.)
   - Mantiene compatibilidad con v0.1.7 (GRUtils.* existentes)
   - Añade utilidades para móvil (isMobile/isStandalone + --vh) y UI (createEl, qs/qsa, pulse)
*/
(() => {
  "use strict";

  const VERSION = "0.1.8";

  // ───────────────────────── Math / Random ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  // ───────────────────────── JSON / Storage ─────────────────────────
  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const safeStringify = (obj, fallback = "") => { try { return JSON.stringify(obj); } catch { return fallback; } };

  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : safeParse(v, fallback);
    } catch {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, safeStringify(value, "")); return true; } catch { return false; }
  }
  function lsDel(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }

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

  function overlayFadeOut(el, ms = 180) {
    return new Promise((res) => {
      if (!el || el.hidden) return res();
      el.classList.remove("fadeIn");
      el.classList.add("fadeOut");
      setTimeout(() => { overlayHide(el); res(); }, ms);
    });
  }

  function pulse(el, className = "pulse", ms = 220) {
    if (!el) return;
    el.classList.remove(className);
    // fuerza reflow para reiniciar animación
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
    // iOS Safari: navigator.standalone
    // Otros: display-mode
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
      // Coarse pointer + ancho moderado suele ser móvil/tablet
      const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
      const small = typeof matchMedia === "function" && matchMedia("(max-width: 900px)").matches;
      return !!(coarse || small);
    } catch {
      return false;
    }
  }

  // Evita “vh roto” en móvil (barras del navegador). Define CSS vars:
  // --vh: 1% del alto visual actual
  // --vw: 1% del ancho visual actual
  function applyViewportVars() {
    try {
      const vv = window.visualViewport;
      const h = (vv && Number.isFinite(vv.height)) ? vv.height : window.innerHeight;
      const w = (vv && Number.isFinite(vv.width)) ? vv.width : window.innerWidth;

      // 1% units
      document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
      document.documentElement.style.setProperty("--vw", `${w * 0.01}px`);

      // flags de device (útil para CSS: [data-mobile="1"] etc.)
      document.body?.dataset && (document.body.dataset.mobile = isMobileLike() ? "1" : "0");
      document.body?.dataset && (document.body.dataset.standalone = isStandalone() ? "1" : "0");
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

  // Suscripción cómoda a resize/orientation/visualViewport con throttle
  function onViewportChange(cb, { immediate = true } = {}) {
    const handler = rafThrottle(() => cb());
    const unsubs = [];

    unsubs.push(on(window, "resize", handler, { passive: true }));
    unsubs.push(on(window, "orientationchange", handler, { passive: true }));

    if (window.visualViewport) {
      unsubs.push(on(window.visualViewport, "resize", handler, { passive: true }));
      unsubs.push(on(window.visualViewport, "scroll", handler, { passive: true })); // iOS mueve barras
    }

    if (immediate) handler();
    return () => unsubs.forEach((u) => { try { u(); } catch {} });
  }

  // Lock scroll (útil si un overlay/panel tapa todo en móvil)
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

  // ───────────────────────── Boot (viewport vars) ─────────────────────────
  // Deja listo --vh/--vw y flags para CSS desde el arranque
  onViewportChange(() => applyViewportVars(), { immediate: true });

  // ───────────────────────── Export ─────────────────────────
  window.GRUtils = Object.freeze({
    VERSION,

    // Math
    clamp, clampInt, lerp, invLerp, randi, chance,

    // JSON/Storage
    safeParse, safeStringify,
    lsGet, lsSet, lsDel,

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
  });
})();
