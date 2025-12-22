# Grid Runner (PWA) — v0.1.3

Arcade grid runner con **perfiles locales**, **upgrades**, **combos**, **PWA instalable**, **offline**, y (lo más importante) **anti-freeze**: si algo falla, **siempre** tienes salida (Recargar / Reparar PWA).

> v0.1.3 mejora sobre todo la **UI/feedback** (combo con color + nivel con barra + zona imán suave) y la **consistencia de overlays** (siempre fullscreen por encima del header).

---

## ✅ Cambios v0.1.3 (respecto a 0.1.2)

### UI / Feedback visual (lo que pedías)
- **Combos**: los chips muestran **icono + color** según tipo (Coin/Gem/Bonus).
- **Progreso de nivel**: barra tipo **slider** (score → next level) con feedback constante.
- **Zona de imán**: overlay más **suave** y “bonito” (halo + borde), y se entiende el radio.
- **Popups de puntos**: al chocar/recoger, aparece **+X / -X** flotando sobre el tile (ya incluido en `app.js`).
- **Game Over**: el resultado se ve **grande y centrado** dentro del overlay (no se “pierde” en el header).

### Transiciones / Splash real
- **Splash real** con:
  - Logo + subtítulo
  - **3 puntitos** animados (cargando)
  - Tiempo mínimo visible (para que se llegue a ver SIEMPRE)
- Transición suave entre:
  - **Loading → Menú**
  - **Menú → Juego**
  - **Juego → Game Over**

### Estabilidad / “no se queda congelado”
- Se mantiene el **failsafe inline en `index.html`**:
  - si pasado ~4.5s no arranca, aparecen:
    - **Recargar**
    - **Reparar PWA**
- `app.js` mantiene:
  - `window.onerror` + `unhandledrejection`
  - overlay de error seguro
  - loop protegido

### Perfiles (auth.js)
- `auth.js` ampliado:
  - saneado extra del estado
  - API opcional: rename/delete/export/import
  - no rompe si `localStorage` falla

---

## 📁 Estructura de archivos (root del repo)

