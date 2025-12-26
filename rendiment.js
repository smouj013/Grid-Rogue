/* rendiment.js — Grid Rogue v1.0.0 (STABLE+HARDENED)
   Helpers de rendimiento (NO rompe nada existente).
   - No modifica app.js automáticamente.
   - Expone window.GRPerf con métricas, medidores y utilidades opcionales.
   - Fallbacks seguros si faltan APIs (RAF/Perf/RIC/Memory, etc.).

   ✅ Incluye:
   - Guard ultra-robusto contra doble carga (incluye escenarios raros con SW/cache)
   - Auto-pause del sampling al ocultar pestaña (configurable, seguro)
   - Snapshot estable + percentiles (dtP95, fpsP5/fpsP95) para detectar stutter real
   - Watchdog mejorado (stall detection) + reset limpio
   - createLoop con cap anti “spiral of death”
*/
(() => {
  "use strict";

  const FILE_VERSION = "1.0.0";
  const NS = "GRPerf";

  // ───────────────────────── Guard ultra robusto ─────────────────────────
  const g = (typeof globalThis !== "undefined")
    ? globalThis
    : (typeof window !== "undefined" ? window : {});

  try { if (g && g[NS]) return; } catch (_) {}

  // ───────────────────────── Entorno / fallbacks ─────────────────────────
  const hasWindow = typeof window !== "undefined";
  const hasDocument = typeof document !== "undefined";

  const hasPerf = typeof performance !== "undefined" && typeof performance.now === "function";
  const now = () => (hasPerf ? performance.now() : Date.now());

  const hasRIC = typeof requestIdleCallback === "function";
  const ric = (cb, opt) => {
    if (hasRIC) return requestIdleCallback(cb, opt);
    const start = now();
    return setTimeout(
      () => cb({ didTimeout: true, timeRemaining: () => Math.max(0, 50 - (now() - start)) }),
      1
    );
  };
  const cic = (id) => {
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
    else clearTimeout(id);
  };

  const hasRAF = typeof requestAnimationFrame === "function";
  const raf = (fn) => (hasRAF ? requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
  const caf = (id) => (hasRAF ? cancelAnimationFrame(id) : clearTimeout(id));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    v = v | 0;
    return Math.max(a | 0, Math.min(b | 0, v));
  };

  const safeFreeze = (obj) => {
    try { return (typeof Object.freeze === "function") ? Object.freeze(obj) : obj; }
    catch { return obj; }
  };

  // ───────────────────────── Map/Set fallback (suave) ─────────────────────────
  const hasMap = typeof Map === "function";
  const hasSet = typeof Set === "function";

  const makeMap = () => {
    if (hasMap) return new Map();
    const o = Object.create(null);
    return {
      set(k, v) { o[String(k)] = v; },
      get(k) { return o[String(k)]; },
      has(k) { return Object.prototype.hasOwnProperty.call(o, String(k)); },
      delete(k) { const kk = String(k); const ex = this.has(kk); if (ex) delete o[kk]; return ex; },
      clear() { for (const k in o) delete o[k]; },
      entries() { return Object.entries(o); }
    };
  };

  const makeSet = () => {
    if (hasSet) return new Set();
    const a = [];
    return {
      add(v) { if (!a.includes(v)) a.push(v); },
      delete(v) { const i = a.indexOf(v); if (i >= 0) { a.splice(i, 1); return true; } return false; },
      has(v) { return a.includes(v); },
      size: 0,
      values() { return a.slice(); }
    };
  };

  function setSize(s) {
    try {
      if (hasSet && s && typeof s.size === "number") return s.size;
      if (s && typeof s.values === "function") return s.values().length;
    } catch {}
    return 0;
  }

  // ───────────────────────── Heurísticas de dispositivo (suave) ─────────────────────────
  function getDeviceHints() {
    const nav = (typeof navigator !== "undefined" ? navigator : null);
    const hc = clampInt((nav && nav.hardwareConcurrency) || 0, 0, 64);
    const dm = clampInt((nav && nav.deviceMemory) || 0, 0, 64); // Chrome only
    const ua = (nav && nav.userAgent) || "";
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

    const coarse = (() => {
      try { return typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches; }
      catch { return false; }
    })();

    const reducedMotion = (() => {
      try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; }
      catch { return false; }
    })();

    const lowEnd = (mobile || coarse) && ((hc > 0 && hc <= 4) || (dm > 0 && dm <= 3));
    return { hardwareConcurrency: hc, deviceMemory: dm, mobile, coarse, reducedMotion, lowEnd };
  }

  // ───────────────────────── Rolling stats (ring) ─────────────────────────
  function makeRing(n) {
    const size = clampInt(n, 8, 2000);
    const arr = new Array(size).fill(0);
    let i = 0, filled = false;

    return {
      push(v) {
        arr[i] = Number(v) || 0;
        i = (i + 1) % size;
        if (i === 0) filled = true;
      },
      values() {
        return filled ? arr.slice() : arr.slice(0, i);
      },
      avg() {
        const v = this.values();
        if (!v.length) return 0;
        let s = 0;
        for (let k = 0; k < v.length; k++) s += v[k];
        return s / v.length;
      },
      max() {
        const v = this.values();
        if (!v.length) return 0;
        let m = -Infinity;
        for (let k = 0; k < v.length; k++) m = Math.max(m, v[k]);
        return Number.isFinite(m) ? m : 0;
      },
      min() {
        const v = this.values();
        if (!v.length) return 0;
        let m = Infinity;
        for (let k = 0; k < v.length; k++) m = Math.min(m, v[k]);
        return Number.isFinite(m) ? m : 0;
      },
      percentile(p) {
        const v = this.values();
        if (!v.length) return 0;
        const pp = clamp(Number(p) || 0, 0, 1);
        const sorted = v.slice().sort((a, b) => a - b);
        const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(pp * (sorted.length - 1))));
        return sorted[idx] || 0;
      }
    };
  }

  // ───────────────────────── Estado ─────────────────────────
  const state = {
    version: FILE_VERSION,

    running: false,

    // Config
    targetFps: 60,
    longFrameMs: 50,
    emitIntervalMs: 500,

    // Counters
    frameCount: 0,
    fps: 0,
    dtAvgMs: 0,
    dtMaxMs: 0,
    dtP95Ms: 0,
    longFrames: 0,
    stutters: 0,
    lastDtMs: 16.7,

    t0: 0,
    lastT: 0,
    lastEmitT: 0,
    lastFpsT: 0,
    fpsFrames: 0,

    // Rings
    dtRing: makeRing(180),
    fpsRing: makeRing(90),

    // Marks / measures
    marks: makeMap(),
    measures: makeMap(),

    // Events
    listeners: makeSet(),

    // Watchdog
    watchdogOn: false,
    watchdogId: 0,
    watchdogLast: 0,
    watchdogThresholdMs: 1500,

    // Visibility
    autoPauseOnHidden: true,
    _wasRunningBeforeHidden: false,
  };

  function budgetMs() {
    const tf = clampInt(state.targetFps, 20, 240);
    return 1000 / tf;
  }

  function stableSnapshot() {
    const b = budgetMs();
    return safeFreeze({
      fileVersion: FILE_VERSION,
      appVersion: hasWindow && window.APP_VERSION ? String(window.APP_VERSION) : null,
      running: !!state.running,

      targetFps: state.targetFps,
      budgetMs: b,
      longFrameMs: state.longFrameMs,
      emitIntervalMs: state.emitIntervalMs,

      frameCount: state.frameCount,

      fps: Number(state.fps || 0),
      fpsAvg: Number(state.fpsRing.avg() || 0),
      fpsP5: Number(state.fpsRing.percentile(0.05) || 0),
      fpsP95: Number(state.fpsRing.percentile(0.95) || 0),

      dtLastMs: Number(state.lastDtMs || 0),
      dtAvgMs: Number(state.dtAvgMs || 0),
      dtMaxMs: Number(state.dtMaxMs || 0),
      dtP95Ms: Number(state.dtP95Ms || 0),

      longFrames: state.longFrames,
      stutters: state.stutters,
    });
  }

  function emit() {
    const count = setSize(state.listeners);
    if (!count) return;

    const snap = stableSnapshot();

    if (hasSet) {
      for (const fn of state.listeners) { try { fn(snap); } catch {} }
      return;
    }

    // fallback array-like
    const arr = state.listeners.values();
    for (let i = 0; i < arr.length; i++) { try { arr[i](snap); } catch {} }
  }

  // ───────────────────────── Sampling loop (solo métricas) ─────────────────────────
  let rafId = 0;

  function tick(t) {
    if (!state.running) return;

    const prev = state.lastT || t;
    const dt = clamp(t - prev, 0, 250);

    state.lastT = t;
    state.frameCount++;
    state.fpsFrames++;

    state.lastDtMs = dt;
    state.dtRing.push(dt);

    const b = budgetMs();
    if (dt > state.longFrameMs) state.longFrames++;
    if (dt > b * 2.0) state.stutters++;

    if (!state.lastFpsT) state.lastFpsT = t;
    const fpsSpan = t - state.lastFpsT;
    if (fpsSpan >= 500) {
      const fps = (state.fpsFrames * 1000) / Math.max(1, fpsSpan);
      state.fps = fps;
      state.fpsRing.push(fps);
      state.fpsFrames = 0;
      state.lastFpsT = t;
    }

    state.dtAvgMs = state.dtRing.avg();
    state.dtMaxMs = state.dtRing.max();
    state.dtP95Ms = state.dtRing.percentile(0.95);

    if (!state.lastEmitT) state.lastEmitT = t;
    if ((t - state.lastEmitT) >= state.emitIntervalMs) {
      state.lastEmitT = t;
      emit();
    }

    rafId = raf(tick);
  }

  function resetCounters() {
    state.t0 = now();
    state.lastT = 0;
    state.lastEmitT = 0;
    state.lastFpsT = 0;
    state.fpsFrames = 0;

    state.frameCount = 0;
    state.longFrames = 0;
    state.stutters = 0;

    state.fps = 0;
    state.dtAvgMs = 0;
    state.dtMaxMs = 0;
    state.dtP95Ms = 0;
    state.lastDtMs = 16.7;

    state.dtRing = makeRing(180);
    state.fpsRing = makeRing(90);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    resetCounters();
    rafId = raf(tick);
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    try { caf(rafId); } catch {}
    rafId = 0;
  }

  // ───────────────────────── Marks / Measures ─────────────────────────
  function mark(name) {
    if (!name) return;
    state.marks.set(String(name), now());
  }

  function measure(name, fromMark = null) {
    const n = String(name || "measure");
    const key = fromMark != null ? String(fromMark) : null;

    const startT = (key && state.marks.has(key)) ? state.marks.get(key) : now();

    return function endMeasure() {
      const dt = Math.max(0, now() - startT);

      let ring = state.measures.get(n);
      if (!ring) {
        ring = makeRing(120);
        state.measures.set(n, ring);
      }
      ring.push(dt);
      return dt;
    };
  }

  function time(name, fn) {
    const end = measure(name);
    try { return fn(); }
    finally { end(); }
  }

  function timeAsync(name, fn) {
    const end = measure(name);
    let p;
    try { p = fn(); }
    catch (e) { end(); throw e; }
    return Promise.resolve(p).finally(() => end());
  }

  // ───────────────────────── Watchdog (stall detection) ─────────────────────────
  function startWatchdog({ thresholdMs = 1500, intervalMs = 500, onStall = null } = {}) {
    stopWatchdog();
    state.watchdogOn = true;
    state.watchdogThresholdMs = clampInt(thresholdMs, 300, 20000);
    state.watchdogLast = now();

    const every = clampInt(intervalMs, 100, 2000);

    const tickDog = () => {
      if (!state.watchdogOn) return;

      const t = now();
      const gap = t - state.watchdogLast;
      state.watchdogLast = t;

      if (gap >= state.watchdogThresholdMs) {
        try { if (typeof onStall === "function") onStall({ gapMs: gap, thresholdMs: state.watchdogThresholdMs }); }
        catch {}
      }

      state.watchdogId = setTimeout(tickDog, every);
    };

    state.watchdogId = setTimeout(tickDog, every);
  }

  function stopWatchdog() {
    state.watchdogOn = false;
    if (state.watchdogId) clearTimeout(state.watchdogId);
    state.watchdogId = 0;
  }

  // ───────────────────────── Visibility helpers ─────────────────────────
  function onVisibilityChange(fn) {
    if (!hasDocument) return () => {};
    const handler = () => { try { fn && fn(document.hidden === true); } catch {} };
    document.addEventListener("visibilitychange", handler, { passive: true });
    return () => document.removeEventListener("visibilitychange", handler);
  }

  // Auto-pause sampling en hidden (NO toca el juego; solo métricas)
  onVisibilityChange((hidden) => {
    if (!state.autoPauseOnHidden) return;

    if (hidden) {
      state._wasRunningBeforeHidden = state.running;
      if (state.running) stop();
    } else {
      if (state._wasRunningBeforeHidden) start();
      state._wasRunningBeforeHidden = false;
    }
  });

  // ───────────────────────── Optional: loop wrapper ─────────────────────────
  // Fixed-step (step) + variable render (draw) con cap anti “spiral of death”.
  function createLoop(step, draw, {
    targetFps = 60,
    maxDtMs = 50,
    maxStepsPerFrame = 5
  } = {}) {
    const target = clampInt(targetFps, 20, 240);
    const budget = 1000 / target;
    const capSteps = clampInt(maxStepsPerFrame, 1, 30);
    const dtCap = clampInt(maxDtMs, 16, 250);

    let running = false;
    let last = 0;
    let acc = 0;
    let rafLoopId = 0;

    function frame(t) {
      if (!running) return;

      const dt = clamp(t - (last || t), 0, dtCap);
      last = t;

      acc += dt;

      let steps = 0;
      while (acc >= budget && steps < capSteps) {
        steps++;
        try { step && step(budget); } catch {}
        acc -= budget;
      }

      // Si se “atasca”, recorta acumulación para evitar la espiral
      if (steps >= capSteps && acc >= budget) acc = 0;

      try { draw && draw(dt); } catch {}

      rafLoopId = raf(frame);
    }

    return {
      start() { if (running) return; running = true; last = 0; acc = 0; rafLoopId = raf(frame); },
      stop() { running = false; try { caf(rafLoopId); } catch {} rafLoopId = 0; },
      isRunning() { return running; },
      targetFps: target,
    };
  }

  // ───────────────────────── Extras (memoria estimada, opcional) ─────────────────────────
  function getMemoryHint() {
    try {
      const pm = performance && performance.memory;
      if (!pm) return null;
      return {
        usedJSHeapSize: pm.usedJSHeapSize || 0,
        totalJSHeapSize: pm.totalJSHeapSize || 0,
        jsHeapSizeLimit: pm.jsHeapSizeLimit || 0,
      };
    } catch {
      return null;
    }
  }

  // ───────────────────────── Public API ─────────────────────────
  const api = {
    version: FILE_VERSION,

    getDeviceHints,
    getMemoryHint,

    setTargetFps(fps) { state.targetFps = clampInt(fps, 20, 240); return state.targetFps; },
    setLongFrameMs(ms) { state.longFrameMs = clampInt(ms, 16, 250); return state.longFrameMs; },
    setEmitIntervalMs(ms) { state.emitIntervalMs = clampInt(ms, 100, 5000); return state.emitIntervalMs; },

    setConfig(cfg = {}) {
      const o = (cfg && typeof cfg === "object") ? cfg : {};
      if ("targetFps" in o) api.setTargetFps(o.targetFps);
      if ("longFrameMs" in o) api.setLongFrameMs(o.longFrameMs);
      if ("emitIntervalMs" in o) api.setEmitIntervalMs(o.emitIntervalMs);
      if ("autoPauseOnHidden" in o) state.autoPauseOnHidden = !!o.autoPauseOnHidden;
      return api.getConfig();
    },

    getConfig() {
      return {
        targetFps: state.targetFps,
        longFrameMs: state.longFrameMs,
        emitIntervalMs: state.emitIntervalMs,
        autoPauseOnHidden: !!state.autoPauseOnHidden,
      };
    },

    start,
    stop,
    reset() { resetCounters(); },
    isRunning() { return !!state.running; },

    getMetrics() {
      return {
        ...stableSnapshot(),
        memory: getMemoryHint(),
      };
    },

    onMetrics(fn) {
      if (typeof fn !== "function") return () => {};
      state.listeners.add(fn);

      // Set real o fallback
      return () => { try { state.listeners.delete(fn); } catch {} };
    },

    mark,
    measure,
    time,
    timeAsync,

    getMeasure(name) {
      const n = String(name || "");
      const ring = state.measures.get(n);
      if (!ring) return null;
      return {
        name: n,
        avgMs: ring.avg(),
        minMs: ring.min(),
        maxMs: ring.max(),
        p95Ms: ring.percentile(0.95),
        samples: ring.values().length,
      };
    },

    listMeasures() {
      const out = [];
      const entries = state.measures.entries();

      if (hasMap) {
        for (const [k, ring] of entries) {
          out.push({
            name: k,
            avgMs: ring.avg(),
            minMs: ring.min(),
            maxMs: ring.max(),
            p95Ms: ring.percentile(0.95),
            samples: ring.values().length,
          });
        }
      } else {
        for (let i = 0; i < entries.length; i++) {
          const k = entries[i][0];
          const ring = entries[i][1];
          out.push({
            name: k,
            avgMs: ring.avg(),
            minMs: ring.min(),
            maxMs: ring.max(),
            p95Ms: ring.percentile(0.95),
            samples: ring.values().length,
          });
        }
      }

      out.sort((a, b) => (b.p95Ms - a.p95Ms) || (b.avgMs - a.avgMs));
      return out;
    },

    clearMeasures() { try { state.measures.clear(); } catch {} },

    idle: (cb, opt) => ric(cb, opt),
    cancelIdle: (id) => cic(id),

    startWatchdog,
    stopWatchdog,

    onVisibilityChange,

    createLoop,
  };

  // Expose sin romper si algo raro pasa
  try {
    Object.defineProperty(g, NS, { value: api, writable: false, configurable: false });
  } catch {
    try { g[NS] = api; } catch {}
  }

  // Alias opcional
  if (hasWindow) {
    try { if (!window.Rendiment) window.Rendiment = api; } catch {}
  }
})();
