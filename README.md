# Grid Runner — PWA (v0.0.4)

Juego móvil PWA tipo runner en cuadrícula (8x24).

## Cambios v0.0.4
- Movimiento en 4 direcciones (WASD/Arrows + swipe + D-Pad)
- Player centrado en el grid
- Banda central de 3 filas marcada (zona de movimiento)
- Filas “pasadas” atenuadas (visual: ya no afectan)
- Pantalla de bienvenida con nombre (guardado local)
- Guardado local de runs (historial) + best local
- Opciones: vibración, mostrar D-Pad, intensidad de efectos
- UI mejor ajustada a iOS/Android (safe areas, canvas a 100% y sin zoom raro)
- Números + feedback más “juicy” (color + pop + partículas)

## Ejecutar en local
VSCode: Live Server, o:
```bash
npx serve .
