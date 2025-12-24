/* rendiment.js — Grid Rogue v0.1.9
   Performance/“rendiment” helpers (NO rompe nada existente).
   - No modifica app.js automáticamente.
   - Expone window.GRPerf con métricas, medidores y utilidades opcionales.
   - Diseñado para funcionar aunque el navegador no soporte APIs modernas.

   Uso típico (opcional) en index.html:
   <script src="./rendiment.js?v=0.1.9" defer></script>
   (cárgalo ANTES de app.js)

   Uso típico (opcional) en app.js:
   const Perf = window.GRPerf;
   Perf?.start();
   Perf?.mark("boot");
   const end = Perf?.measure("draw"); end(); // o Perf.time("draw", fn)
*/

(() => {
  "use strict";

  const VERSION = "0.1.9";
  const NS = "GRPerf";

  // ✅ Guard: evita crash si se ejecuta dos veces (SW/duplicados)
  try {
    if (typeof window !== "undefined" && window[NS]) return;
  } catch (_) {}

  // ───────────────────────── Safe env ─────────────────────────
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
    return Math.max(a, Math.min(b, v));
  };

  // ───────────────────────── Device heuristics (suave) ─────────────────────────
  function getDeviceHints() {
    const hc = clampInt((navigator && navigator.hardwareConcurrency) || 0, 0, 64);
    const dm = clampInt((navigator && navigator.deviceMemory) || 0, 0, 64); // Chrome only
    const ua = (navigator && navigator.userAgent) || "";
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const coarse = (() => { try { return matchMedia("(pointer:coarse)").matches; } catch { return false; } })();
    const reducedMotion = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();

    const lowEnd = (mobile || coarse) && ((hc > 0 && hc <= 4) || (dm > 0 && dm <= 3));
    return { hardwareConcurrency: hc, deviceMemory: dm, mobile, coarse, reducedMotion, lowEnd };
  }

  // ───────────────────────── Rolling stats ─────────────────────────
  function makeRing(n) {
    const arr = new Array(n).fill(0);
    let i = 0, filled = false;
    return {
      push(v) {
        arr[i] = v;
        i = (i + 1) % n;
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
        return m;
      },
      min() {
        const v = this.values();
        if (!v.length) return 0;
        let m = Infinity;
        for (let k = 0; k < v.length; k++) m = Math.min(m, v[k]);
        return m;
      }
    };
  }

  // ───────────────────────── Core state ─────────────────────────
  const state = {
    version: VERSION,
    running: false,

    targetFps: 60,
    longFrameMs: 50,

    frameCount: 0,
    fps: 0,
    dtAvgMs: 0,
    dtMaxMs: 0,
    longFrames: 0,
    stutters: 0,
    lastDtMs: 16.7,

    t0: 0,
    lastT: 0,
    lastFpsT: 0,
    fpsFrames: 0,

    dtRing: makeRing(120),
    fpsRing: makeRing(60),

    marks: new Map(),
    measures: new Map(),

    listeners: new Set(),

    watchdogOn: false,
    watchdogId: 0,
    watchdogLast: 0,
    watchdogThresholdMs: 1500,
  };

  function budgetMs() {
    const tf = clampInt(state.targetFps, 20, 240);
    return 1000 / tf;
  }

  function emit() {
    if (!state.listeners.size) return;
    const snap = api.getMetrics();
    for (const fn of state.listeners) {
      try { fn(snap); } catch {}
    }
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
    const span = t - state.lastFpsT;
    if (span >= 500) {
      const fps = (state.fpsFrames * 1000) / Math.max(1, span);
      state.fps = fps;
      state.fpsRing.push(fps);
      state.fpsFrames = 0;
      state.lastFpsT = t;
    }

    state.dtAvgMs = state.dtRing.avg();
    state.dtMaxMs = state.dtRing.max();

    if (span >= 500) emit();

    rafId = raf(tick);
  }

  function start() {
    if (state.running) return;
    state.running = true;

    state.t0 = now();
    state.lastT = 0;
    state.lastFpsT = 0;
    state.fpsFrames = 0;

    state.frameCount = 0;
    state.longFrames = 0;
    state.stutters = 0;

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
    const startT = (fromMark && state.marks.has(String(fromMark)))
      ? state.marks.get(String(fromMark))
      : now();

    return function endMeasure() {
      const dt = Math.max(0, now() - startT);
      let ring = state.measures.get(n);
      if (!ring) { ring = makeRing(90); state.measures.set(n, ring); }
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

  // ───────────────────────── Watchdog (detecta cuelgues) ─────────────────────────
  function startWatchdog({ thresholdMs = 1500, intervalMs = 500, onStall = null } = {}) {
    stopWatchdog();
    state.watchdogOn = true;
    state.watchdogThresholdMs = clampInt(thresholdMs, 300, 20000);
    state.watchdogLast = now();

    const tickDog = () => {
      if (!state.watchdogOn) return;
      const t = now();
      const gap = t - state.watchdogLast;
      state.watchdogLast = t;

      if (gap >= state.watchdogThresholdMs) {
        try { onStall && onStall({ gapMs: gap, thresholdMs: state.watchdogThresholdMs }); } catch {}
      }
      state.watchdogId = setTimeout(tickDog, clampInt(intervalMs, 100, 2000));
    };

    state.watchdogId = setTimeout(tickDog, clampInt(intervalMs, 100, 2000));
  }

  function stopWatchdog() {
    state.watchdogOn = false;
    if (state.watchdogId) clearTimeout(state.watchdogId);
    state.watchdogId = 0;
  }

  // ───────────────────────── Visibility helpers ─────────────────────────
  function onVisibilityChange(fn) {
    const handler = () => {
      try { fn && fn(document.hidden === true); } catch {}
    };
    document.addEventListener("visibilitychange", handler, { passive: true });
    return () => document.removeEventListener("visibilitychange", handler);
  }

  // ───────────────────────── Optional: simple limiter wrapper ─────────────────────────
  function createLoop(step, draw, { targetFps = 60, maxDtMs = 50 } = {}) {
    const target = clampInt(targetFps, 20, 240);
    const budget = 1000 / target;

    let running = false;
    let last = 0;
    let acc = 0;
    let rafLoopId = 0;

    function frame(t) {
      if (!running) return;
      const dt = clamp(t - (last || t), 0, maxDtMs);
      last = t;

      acc += dt;
      while (acc >= budget) {
        try { step && step(budget); } catch {}
        acc -= budget;
      }
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

  // ───────────────────────── Public API ─────────────────────────
  const api = {
    version: VERSION,

    getDeviceHints,
    setTargetFps(fps) { state.targetFps = clampInt(fps, 20, 240); return state.targetFps; },
    setLongFrameMs(ms) { state.longFrameMs = clampInt(ms, 16, 200); return state.longFrameMs; },

    start,
    stop,
    isRunning() { return !!state.running; },

    getMetrics() {
      const b = budgetMs();
      return {
        version: VERSION,
        running: !!state.running,

        targetFps: state.targetFps,
        budgetMs: b,

        frameCount: state.frameCount,
        fps: Number(state.fps || 0),
        fpsAvg: Number(state.fpsRing.avg() || 0),

        dtLastMs: Number(state.lastDtMs || 0),
        dtAvgMs: Number(state.dtAvgMs || 0),
        dtMaxMs: Number(state.dtMaxMs || 0),

        longFrames: state.longFrames,
        stutters: state.stutters,
      };
    },

    onMetrics(fn) {
      if (typeof fn !== "function") return () => {};
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },

    mark,
    measure,
    time,
    timeAsync,

    getMeasure(name) {
      const ring = state.measures.get(String(name || ""));
      if (!ring) return null;
      return {
        name: String(name),
        avgMs: ring.avg(),
        minMs: ring.min(),
        maxMs: ring.max(),
        samples: ring.values().length,
      };
    },
    listMeasures() {
      const out = [];
      for (const [k, ring] of state.measures.entries()) {
        out.push({ name: k, avgMs: ring.avg(), minMs: ring.min(), maxMs: ring.max(), samples: ring.values().length });
      }
      out.sort((a, b) => b.avgMs - a.avgMs);
      return out;
    },
    clearMeasures() { state.measures.clear(); },

    idle: (cb, opt) => ric(cb, opt),
    cancelIdle: (id) => cic(id),

    startWatchdog,
    stopWatchdog,

    onVisibilityChange,

    createLoop,
  };

  // Expose (sin romper si algo raro pasa)
  try {
    Object.defineProperty(window, NS, { value: api, writable: false, configurable: false });
  } catch {
    try { window[NS] = api; } catch {}
  }
})();
