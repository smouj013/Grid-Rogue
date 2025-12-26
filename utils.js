(() => {
  "use strict";

  const VERSION = "1.0.0";

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

  function canLS() {
    try {
      const k = "__ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  }

  const __RAM = Object.create(null);
  const lsGetRaw = (key) => { try { return localStorage.getItem(key); } catch { return (__RAM[key] ?? null); } };
  const lsSetRaw = (key, value) => { try { localStorage.setItem(key, String(value ?? "")); return true; } catch { __RAM[key] = String(value ?? ""); return false; } };
  const lsDelRaw = (key) => { try { localStorage.removeItem(key); delete __RAM[key]; return true; } catch { delete __RAM[key]; return false; } };

  const lsGet = (key, fallback) => {
    const raw = lsGetRaw(key);
    if (raw == null) return fallback;
    return safeParse(raw, fallback);
  };
  const lsSet = (key, value) => {
    const raw = safeStringify(value, "");
    if (!raw) return false;
    return lsSetRaw(key, raw) || !canLS();
  };
  const lsDel = (key) => lsDelRaw(key) || !canLS();

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
      } else el.setAttribute(k, String(v));
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

  function overlayShow(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove("fadeOut");
    el.classList.add("fadeIn");
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

  function setState(s) { try { document.body.dataset.state = String(s); } catch {} }

  function fmtScore(n) {
    n = Math.max(0, n | 0);
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + "k";
    if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + "M";
    return (n / 1e9).toFixed(1) + "B";
  }

  function fmtSeconds(sec) {
    sec = Number(sec);
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    if (sec < 10) return sec.toFixed(1);
    return String(Math.ceil(sec));
  }

  function now() { return Date.now(); }

  function isMobile() {
    try { return matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 760; } catch { return false; }
  }

  function isStandalone() {
    try {
      return (
        (typeof navigator !== "undefined" && navigator.standalone === true) ||
        (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) ||
        (typeof matchMedia === "function" && matchMedia("(display-mode: fullscreen)").matches)
      );
    } catch { return false; }
  }

  function setVHVar() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }

  function toast(msg, ms = 1100) {
    const el = $("toast");
    if (!el) return;
    el.textContent = String(msg ?? "");
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), Math.max(300, ms | 0));
  }

  function setHP(hpRowEl, hp, hpMax, shields = 0) {
    if (!hpRowEl) return;
    hp = Math.max(0, hp | 0);
    hpMax = Math.max(1, hpMax | 0);
    shields = Math.max(0, shields | 0);

    clearEl(hpRowEl);

    // Escudos como corazones azules al inicio
    for (let i = 0; i < shields; i++) {
      hpRowEl.appendChild(createEl("span", { class: "heart shield", text: "🛡" }));
    }

    for (let i = 0; i < hpMax; i++) {
      const full = i < hp;
      hpRowEl.appendChild(createEl("span", { class: "heart" + (full ? " full" : ""), text: "❤" }));
    }
  }

  function setBuffs(buffRowEl, buffs) {
    if (!buffRowEl) return;
    clearEl(buffRowEl);
    if (!buffs || !buffs.length) return;

    for (const b of buffs) {
      const badge = createEl("div", { class: "buffBadge", dataset: { kind: b.kind || "misc" } }, [
        createEl("span", { class: "bIcon ms", text: b.icon || "bolt" }),
        createEl("span", { class: "bTime", text: b.text || "" }),
      ]);
      if (b.count && b.count > 1) {
        badge.appendChild(createEl("span", { class: "bCount", text: String(b.count | 0) }));
      }
      buffRowEl.appendChild(badge);
    }
  }

  window.GRUtils = {
    VERSION,
    clamp, clampInt, lerp, randi, chance,
    safeParse, safeStringify,
    canLS, lsGet, lsSet, lsDel,
    $, qs, qsa, on, off,
    setAttrs, createEl, clearEl,
    overlayShow, overlayHide, overlayFadeOut,
    setState,
    fmtScore, fmtSeconds,
    now,
    isMobile, isStandalone,
    setVHVar,
    toast,
    setHP, setBuffs,
  };
})();
