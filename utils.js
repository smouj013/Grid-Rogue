/* utils.js — Grid Rogue v1.0.0 (GRUtils) */
(() => {
  "use strict";

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a, Math.min(b, v));
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const chance = (p) => Math.random() < p;

  const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const safeStringify = (obj, fallback = "") => { try { return JSON.stringify(obj); } catch { return fallback; } };

  const $ = (id) => document.getElementById(id);

  const overlayShow = (el) => { if (!el) return; el.hidden = false; };
  const overlayHide = (el) => { if (!el) return; el.hidden = true; };

  const overlayFadeOut = async (el, ms = 140) => {
    if (!el) return;
    // Fade simple por CSS (sin dependencia). Si no hay transición, igual cierra.
    try {
      el.classList.add("fadeOut");
      await new Promise(res => setTimeout(res, Math.max(0, ms | 0)));
    } catch {}
    el.classList.remove("fadeOut");
    el.hidden = true;
  };

  const setPill = (el, v) => {
    if (!el) return;
    const pv = el.querySelector?.(".pv");
    if (pv) pv.textContent = String(v);
    else el.textContent = String(v);
  };

  const setState = (s) => { try { document.body.dataset.state = String(s); } catch {} };

  const now = () => (performance?.now?.() ?? Date.now());

  // canLS útil (Safari privado)
  const canLS = () => {
    try {
      const k = "__ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  };

  window.GRUtils = {
    clamp, clampInt, lerp, randi, chance,
    safeParse, safeStringify,
    $, overlayShow, overlayHide, overlayFadeOut,
    setPill, setState,
    now, canLS
  };
})();
