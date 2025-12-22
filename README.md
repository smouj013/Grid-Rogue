# Grid Runner — PWA (v0.0.8)

Runner en cuadrícula **8×24**:
- Layout responsive (móvil iOS/Android y PC)
- Grid grande (canvas ocupa todo el alto útil)
- Pantalla de carga inicial **mínimo 5s**
- Movimiento 4 direcciones + banda de movimiento
- Combos visibles + niveles + mejoras (20+)
- Offline con Service Worker
- Auto-update (cuando hay update, se aplica al acabar la run)

## Estructura
- index.html
- styles.css
- app.js
- sw.js
- manifest.webmanifest
- assets/
  - icons/
  - sprites/

## GitHub Pages
Settings → Pages → Deploy from branch → `main` / root.

## Local
Con VSCode Live Server o:
```bash
npx serve .
