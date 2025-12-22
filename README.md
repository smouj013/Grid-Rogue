# Grid Runner — PWA (v0.0.3)

Juego móvil PWA tipo runner en cuadrícula (8x24).
- Movimiento ultra suave (scroll continuo + player smooth)
- Velocidad progresiva (lenta al inicio, sube suave)
- Bloques KO muy visibles (borde rojo + X + pulso)
- Score más claro (delta + popups + combo bar)
- Menos densidad visual (menos “ruido”)
- Leyenda siempre visible
- Controles: tap izq/der + swipe (móvil) / teclado (PC)
- Offline con Service Worker
- Ranking mundial: solo online (endpoint configurable)

## Ejecutar en local
VSCode:
- Instala **Live Server**
- Click derecho `index.html` → "Open with Live Server"

o:
```bash
npx serve .
