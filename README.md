```md
# Grid Runner — PWA (v0.1.0)

Juego PWA para móvil y PC: un runner de cuadrícula con **combos** y **mejoras roguelike**.  
Funciona offline (App Shell + Service Worker), sin scroll, con UI adaptada a móvil/desktop.

> ✅ Nota: **Ranking online está desactivado** por ahora (se ignora totalmente) para evitar bloqueos y freezes.

---

## 🎮 Cómo se juega

- Eres un cuadrado que se mueve dentro de una zona marcada del grid.
- Te puedes mover en **4 direcciones**:
  - PC: **WASD** o **Flechas**
  - Móvil: **Swipe** sobre el grid + **D-Pad** opcional
- El grid avanza automáticamente (scroll).
- Casillas:
  - 🟩 **Coin**: +10
  - 🟦 **Gem**: +30
  - 🟨 **Bonus**: +60
  - 🟧 **Trap**: resta puntos (y puede romper racha)
  - 🩶 **Block (KO)**: fin de partida (salvo escudos / anti-KO)

### Combos
Arriba a la izquierda verás un combo objetivo (una secuencia).  
Si recoges la secuencia completa a tiempo → bonus y estímulos.

### Niveles y mejoras
Al alcanzar cierto score, **subes de nivel** y eliges **1 de 3 mejoras** (estilo roguelike).  
Las mejoras se acumulan y algunas tienen límite.

---

## ✅ Características (v0.1.0)

- ✅ **Sin scroll** y layout full-screen (móvil + PC)
- ✅ Canvas ocupa toda la zona de juego (el header no lo tapa)
- ✅ **Loading inicial mínimo 5s**
- ✅ **Auto-update** vía Service Worker (botón “Actualizar” si hay update)
- ✅ Controles:
  - Teclado (PC)
  - Swipe (móvil)
  - D-Pad (móvil, opcional en opciones)
- ✅ Sistema de combos + HUD compacto
- ✅ Sistema de mejoras (20+ upgrades)
- ✅ Opciones:
  - Vibración
  - D-Pad
  - FX (intensidad)
  - Sprites ON/OFF (si hay atlas)
  - Borrar datos locales

---

## 📁 Estructura del proyecto

Recomendado:

```

/
index.html
styles.css
app.js
sw.js
manifest.webmanifest
/assets
icon.svg
/icons
icon-192.png
icon-512.png
apple-touch-icon-180.png
/sprites (opcional)
atlas.png
atlas.json

````

### Sprites (opcional)
El juego funciona sin sprites (modo colores).  
Si quieres sprites, crea:

- `assets/sprites/atlas.png`
- `assets/sprites/atlas.json`

Keys esperadas (mínimo):
- `coin`, `gem`, `bonus`, `trap`, `block`, `player`

Ejemplo `atlas.json`:
```json
{
  "coin":  { "x":0,  "y":0,  "w":64, "h":64 },
  "gem":   { "x":64, "y":0,  "w":64, "h":64 },
  "bonus": { "x":128,"y":0,  "w":64, "h":64 },
  "trap":  { "x":192,"y":0,  "w":64, "h":64 },
  "block": { "x":256,"y":0,  "w":64, "h":64 },
  "player":{ "x":320,"y":0,  "w":64, "h":64 }
}
````

Luego activa **Opciones → Sprites**.

---

## 📲 Instalación como app (PWA)

### Android / Chrome

* Abre la web
* Menú ⋮ → **Instalar aplicación** / **Añadir a pantalla de inicio**

### iOS / Safari

* Abre la web en Safari
* Compartir → **Añadir a pantalla de inicio**

> Importante: En iOS, el icono se toma del `apple-touch-icon-180.png`.

---

## 🚀 Deploy en GitHub Pages

1. Sube todos los archivos del proyecto a tu repo.
2. Ve a:

   * **Settings → Pages**
3. En **Build and deployment**:

   * Source: `Deploy from a branch`
   * Branch: `main`
   * Folder: `/ (root)`
4. Guarda y espera a que GitHub publique la URL.

---

## 🔄 Actualizaciones automáticas (Service Worker)

* La app registra `sw.js` y hace `update()` cada 60s.
* Si hay versión nueva, aparece un botón **“Actualizar”** en el header.
* Si estás jugando, el update se aplica al terminar (para no romper la run).

Si quieres forzar refresh:

* Cierra la app y vuelve a abrir
* O pulsa “Actualizar” cuando aparezca

---

## 💾 Guardado local

Se guarda automáticamente en el navegador:

* Nombre del jugador
* Mejor score
* Historial corto de runs (máximo 30)
* Opciones (FX, D-pad, etc.)

Puedes resetear todo en:

* **Opciones → Borrar local**

---

## 🧪 Ejecutar en local

Opción 1 (recomendado): servidor local simple

### Con Node (http-server)

```bash
npx http-server -p 5173
```

### Con Python

```bash
python -m http.server 5173
```

Luego abre:

* `http://localhost:5173`

> Nota: Service Worker requiere `http://localhost` o HTTPS.

---

## 🧰 Troubleshooting

### “Pantalla en blanco / no se ve nada”

* Abre la consola (F12) y mira errores.
* Asegúrate de que `index.html` tiene los IDs correctos y que `app.js` carga.
* Comprueba que estás sirviendo con servidor (no abrir con `file://`).

### “No instala en iPhone”

* Debe ser Safari
* Debe estar en HTTPS (GitHub Pages vale)
* Debe existir `apple-touch-icon-180.png`

### “No actualiza”

* Pulsa “Actualizar” si aparece.
* En Chrome: DevTools → Application → Service Workers → “Update”
* Limpia caché si lo estás testeando mucho.

---

## 🗺️ Roadmap (próximas versiones)

* Reintroducir ranking online (cuando toque) sin bloqueos
* Más variedad de combos
* Más upgrades, sinergias y rarezas (Common/Rare/Epic)
* Sonidos y “juice” visual extra sin fatiga visual
* Export/Import de datos locales

---

## 📝 Licencia

Uso libre para tu proyecto. Si lo publicas, ajusta este README y añade licencia si quieres.

```

Si quieres, también te hago un **CHANGELOG.md** (v0.0.9 → v0.1.0) y te dejo el repo “bonito” con badges + screenshots + sección de “Controles”.
::contentReference[oaicite:0]{index=0}
```
