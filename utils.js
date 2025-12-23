/* utils.js — Grid Rogue v0.1.7
   Helpers compartidos (clamps, DOM, overlays, etc.)
*/
(() => {
  "use strict";

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

  window.GRUtils = Object.freeze({
    clamp, clampInt, lerp, randi, chance,
    safeParse, $,
    overlayShow, overlayHide, overlayFadeOut,
    setPill, setState,
  });
})();
