# Grid Runner — PWA (v0.1.1)

Juego arcade **rápido y adictivo** para móvil y desktop: controlas un “runner” en una cuadrícula que **se desplaza constantemente**. Debes moverte dentro de tu **zona de movimiento** para recoger premios, encadenar **combos**, subir de nivel y elegir **mejoras**. Si pisas un **KO** sin escudo… se termina la run.

> **Modo PWA**: funciona online/offline, se puede instalar (cuando el navegador lo permite) y se actualiza mediante Service Worker.

---

## 🕹️ Cómo se juega

### Objetivo
- **Sobrevive** el máximo tiempo posible.
- Consigue la mayor **puntuación**.
- Mantén la **racha** (streak) y sube el **multiplicador** (mult).
- Completa **combos** para obtener bonus y/o mejoras de multiplicador (según configuración del juego).

### Controles
**Desktop**
- Mover: `WASD` o `Flechas`
- Pausa: `Esc`

**Móvil**
- **Desliza** en el canvas para moverte (arriba/abajo/izquierda/derecha)
- Opcional: **D-Pad** en pantalla (si está activado y el dispositivo es táctil)

### Tipos de casillas (tiles)
- **Coin**: puntos básicos.
- **Gem**: puntos superiores.
- **BONUS**: recompensa grande (y puede disparar efectos extra según mejoras).
- **Trap**: penalización (pierdes puntos y normalmente racha).
- **KO / Block**: si lo pisas, **muere** la run (a menos que tengas escudo).

> Nota: los nombres pueden variar en UI, pero el comportamiento general es el anterior.

---

## 🧩 Sistema de progreso (Run)

### Subida de nivel
A medida que aumentas tu puntuación:
- **Subes de nivel**
- Se abre un panel para elegir **1 mejora**
- Algunas mejoras tienen **límite** (máximo)

### Mejoras (Upgrades)
El juego incluye un set amplio de mejoras (ejemplos):
- **+Zona de movimiento**: más filas disponibles para esquivar.
- **Escudo**: evita una muerte por KO.
- **Imán**: recoge premios cercanos automáticamente.
- **Más puntos por avanzar**: recompensa por tiempo/supervivencia.
- **Mejoras de multiplicador**: acelera la escalada de score.
- **Reroll**: permite volver a tirar opciones de mejoras (si tienes cargas).

---

## 👤 Perfiles (auth.js)

Grid Runner incluye un sistema de perfiles **local** (sin servidor):
- Crear y seleccionar perfil.
- Guarda **best score por perfil**.
- El nombre del jugador se muestra en el HUD (pillPlayer).

### Migración / compatibilidad
- Si vienes de una versión anterior, se migra automáticamente desde:
  - `gridrunner_name_v1`
  - `gridrunner_best_v1` (compatibilidad)

> Todo se guarda en **localStorage** del dispositivo.

---

## ⚙️ Opciones

Desde el panel de opciones:
- **Sprites ON/OFF** (si existen assets de sprites, si no: fallback a colores)
- **Vibración ON/OFF**
- **D-Pad ON/OFF** (solo relevante en móvil / pointer coarse)
- **FX** (intensidad de efectos visuales)
- **Borrar datos locales** (resetea perfiles, runs, settings)

---

## 📦 Estructura del proyecto (esperada)

Tal cual tu repo (root):

GRID-RUNNER-PWA/
├─ index.html
├─ styles.css
├─ app.js
├─ auth.js
├─ sw.js
├─ manifest.webmanifest
├─ assets/
│ ├─ icons/
│ │ ├─ icon-192.png
│ │ ├─ icon-512.png
│ │ ├─ ... (maskable / apple touch)
│ └─ sprites/
│ ├─ tile_block.svg
│ ├─ tile_bonus.svg
│ ├─ tile_coin.svg
│ ├─ tile_gem.svg
│ ├─ tile_trap.svg
│ └─ (opcional) player.svg / atlas, etc.
└─ .nojekyll


---

## 🌐 PWA (Instalación / Offline / Actualizaciones)

### Instalación (botón “Instalar” inteligente)
- Solo aparece si:
  - El navegador soporta instalación (evento `beforeinstallprompt`)
  - Y **NO** estás ya en modo app/standalone
- En modo app/standalone:
  - **Nunca** se muestra el botón “Instalar”

### Offline
- El Service Worker cachea el **app shell**
- El juego funciona sin conexión una vez cargado al menos una vez

### Actualizaciones
- Cuando hay nueva versión:
  - aparece una pill en el HUD: **“Actualizar”**
- En partida:
  - la actualización se aplica al terminar la run (o reiniciar)
- Fuera de partida:
  - recarga inmediatamente

---

## ✅ Cambios v0.1.1 (release notes)

- Iconos **Material Symbols** (Google Fonts) en lugar de emojis.
- Fix “loading infinito”:
  - Splash + transición al menú
  - Watchdog anti-bloqueo
  - Carga de sprites **no bloqueante**
- Botón “Instalar” inteligente (solo web instalable).
- `auth.js` (perfiles locales):
  - Crear / seleccionar
  - Best score por perfil
  - Migración de nombre desde claves antiguas

---

## 🚀 Deploy en GitHub Pages

1. Sube todo al repo (carpeta raíz).
2. GitHub → **Settings → Pages**
3. Build and deployment:
   - **Source**: Deploy from a branch
   - **Branch**: `main` / `(root)`
4. Abre tu URL de GitHub Pages.

---

## 🧪 Debug rápido (si “no cambia nada” o se queda raro)

Esto casi siempre es **cache del Service Worker**.

### Opción A (rápida)
- Abre la web y pulsa **“Actualizar”** si aparece en la pill del HUD.

### Opción B (DevTools)
- DevTools → Application → Service Workers → **Unregister**
- Application → Storage → **Clear site data**
- Recarga (Ctrl+F5)

---

## 📄 Licencia
Uso personal / prototipo. (Ajusta esta sección si vas a publicar open-source.)

---

## ✉️ Créditos
- UI icons: **Material Symbols** (Google Fonts)
- PWA: Manifest + Service Worker (app shell caching)
