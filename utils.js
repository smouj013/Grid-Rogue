/* utils.js — Grid Rogue v0.1.9
   Helpers compartidos (clamps, DOM, overlays, viewport-fix móvil, scroll-lock, etc.)
   ✅ v0.1.9:
   - HUD helpers: setHP (corazones) + setBuffs (badges con stack + timer)
   - Rarity helpers para duraciones (útil para Imán con tiempo por rareza)
   - overlays show/hide + fadeOut (compatible aunque no haya animaciones CSS)
   - Scroll-lock robusto sin depender de CSS (y compatible con .noScroll si existe)
*/
(() => {
  "use strict";

  const VERSION = "0.1.9";

  // ───────────────────────── Math / Random ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v | 0)) : (a | 0));
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
      const k = "__gr_ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

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

  function overlayFadeOut(el, ms = 160) {
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
  let __prev = null;

  function lockScroll() {
    __scrollLockCount++;
    if (__scrollLockCount !== 1) return;

    try {
      __scrollY = window.scrollY || 0;

      document.documentElement.classList.add("noScroll");
      document.body.classList.add("noScroll");

      __prev = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overflowY: document.body.style.overflowY,
      };

      document.body.style.position = "fixed";
      document.body.style.top = `-${__scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflowY = "hidden";
    } catch {}
  }

  function unlockScroll() {
    __scrollLockCount = Math.max(0, __scrollLockCount - 1);
    if (__scrollLockCount !== 0) return;

    try {
      document.documentElement.classList.remove("noScroll");
      document.body.classList.remove("noScroll");

      if (__prev) {
        document.body.style.position = __prev.position;
        document.body.style.top = __prev.top;
        document.body.style.left = __prev.left;
        document.body.style.right = __prev.right;
        document.body.style.width = __prev.width;
        document.body.style.overflowY = __prev.overflowY;
        __prev = null;
      } else {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflowY = "";
      }

      const y = __scrollY | 0;
      window.scrollTo(0, y);
    } catch {}
  }

  // ───────────────────────── HUD helpers (v0.1.9) ─────────────────────────
  function ensureHudNodes() {
    const hudStatus = $("hudStatus") || $("levelProg");
    if (!hudStatus) return;

    // HP
    const hpWrap = $("hudHearts") || $("hpWrap") || qs(".hpWrap", hudStatus);
    if (hpWrap) {
      let hearts = qs(".hearts", hpWrap);
      if (!hearts) {
        hearts = createEl("div", { class: "hearts" });
        hpWrap.appendChild(hearts);
      }
      if (!hearts.id) hearts.id = "hpHearts";

      let hpText = qs(".hpText", hpWrap);
      if (!hpText) {
        hpText = createEl("div", { class: "hpText tiny muted", text: "0/0" });
        hpText.id = "hpText";
        hpWrap.appendChild(hpText);
      } else if (!hpText.id) {
        hpText.id = "hpText";
      }
    }

    // Buffs
    const buffsWrap = $("hudBuffs") || $("buffBadges") || qs(".buffsWrap", hudStatus);
    if (buffsWrap) {
      if (!buffsWrap.id) buffsWrap.id = "hudBuffs";
    }
  }

  function setHP(current, max = 10) {
    ensureHudNodes();
    const hpWrap = $("hudHearts") || $("hpWrap") || null;
    const hpHearts = $("hpHearts") || (hpWrap ? qs(".hearts", hpWrap) : null);
    const hpText = $("hpText") || (hpWrap ? qs(".hpText", hpWrap) : null);

    if (!hpHearts) return;

    const cur = clampInt(current, 0, 999);
    const mx = clampInt(max, 1, 999);

    clearEl(hpHearts);
    for (let i = 0; i < mx; i++) {
      const full = i < cur;
      hpHearts.appendChild(
        createEl("span", { class: `heart ${full ? "full" : "empty"}`, "aria-hidden": "true" }, [
          createEl("span", { class: "ms", text: "favorite" })
        ])
      );
    }

    if (hpText) hpText.textContent = `${cur}/${mx}`;
  }

  function setBuffs(buffs) {
    ensureHudNodes();
    const wrap = $("hudBuffs") || $("buffBadges");
    if (!wrap) return;

    const arr = Array.isArray(buffs) ? buffs : [];
    clearEl(wrap);

    for (const b of arr) {
      if (!b) continue;
      const key = String(b.key || "");
      if (!key) continue;

      const rarity = String(b.rarity || "common").toLowerCase();
      const icon = String(b.icon || "auto_awesome");
      const count = clampInt(b.count ?? 1, 1, 999);

      const duration = Number(b.duration);
      const timeLeft = Number(b.timeLeft);
      const hasTimer = Number.isFinite(duration) && duration > 0 && Number.isFinite(timeLeft) && timeLeft >= 0;
      const showTime = (b.showTime !== false);

      const pct = hasTimer ? clamp(timeLeft / duration, 0, 1) : 1;

      const badge = createEl("div", {
        class: "buffBadge",
        title: String(b.title || b.name || key),
        dataset: { key, rarity },
      });

      badge.style.setProperty("--pct", String(pct));

      badge.appendChild(createEl("span", { class: "bIcon ms", text: icon, "aria-hidden": "true" }));

      const countEl = createEl("span", { class: "bCount", text: String(count) });
      if (count <= 1) countEl.hidden = true;
      badge.appendChild(countEl);

      const timeEl = createEl("span", { class: "bTime", text: (hasTimer && showTime) ? fmtSeconds(timeLeft) : "" });
      if (!(hasTimer && showTime)) timeEl.hidden = true;
      badge.appendChild(timeEl);

      wrap.appendChild(badge);
    }
  }

  // ───────────────────────── Boot (viewport vars) ─────────────────────────
  onViewportChange(() => applyViewportVars(), { immediate: true });

  // ───────────────────────── Export ─────────────────────────
  const api = Object.freeze({
    VERSION,

    clamp, clampInt, lerp, invLerp, randi, chance,
    rarityMult, scaleByRarity, fmtSeconds, now, pad2,

    safeParse, safeStringify, canLS,
    lsGet, lsSet, lsDel,

    $, qs, qsa,
    on, off,
    setAttrs, createEl, clearEl,
    addClass, removeClass, toggleClass,

    overlayShow, overlayHide, overlayFadeOut,
    pulse,
    setPill, setState,

    isMobileLike, isStandalone,
    applyViewportVars,
    onViewportChange,
    rafThrottle,

    lockScroll, unlockScroll,

    hud: Object.freeze({
      ensureHudNodes,
      setHP,
      setBuffs,
    }),
  });

  window.GRUtils = api;
  if (!window.Utils) window.Utils = api;
})();
