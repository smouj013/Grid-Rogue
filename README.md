
> Si **NO** existe `assets/audio/` o faltan audios: **no pasa nada** → el juego usa **sonidos/música fallback** y sigue funcionando.

---

## 🚀 Deploy en GitHub Pages (paso a paso)

1. Crea un repo en GitHub (ej. `grid-runner`).
2. Sube **todos los archivos** en la **raíz** del repo (no dentro de subcarpetas extra).
3. Ve a:
   - **Settings → Pages**
   - **Build and deployment**
   - **Source:** Deploy from a branch
   - **Branch:** `main` / **(root)**
4. Abre la URL de GitHub Pages que te muestra GitHub.

> Importante: en PWA es normal que el navegador tarde unos segundos en “ver” que es instalable.

---

## 📲 Instalación (PWA)

### Android (Chrome/Edge)
- Abre la web → aparecerá botón **Instalar** (o menú ⋮ → “Instalar app”).

### iOS (Safari)
- Abre la web en Safari → botón compartir → **Añadir a pantalla de inicio**.

> Nota iOS: la música/sonidos arrancan tras pulsar **Empezar**, por restricciones de autoplay.

---

## 🧰 Modo reparación (cuando algo se queda raro)
- **Reparar PWA** (en Opciones): desinstala SW + borra caches y recarga.
- URL manual:
  - `?repair=1` → limpia SW/caches y recarga
  - `?nosw=1` → arranca sin Service Worker

---

## 🎵 Añadir tu música y sonidos

Coloca archivos en `assets/audio/`:

- `music.mp3` (loop de música)
- `sfx_move.mp3` (movimiento)
- `sfx_coin.mp3`, `sfx_gem.mp3`, `sfx_bonus.mp3` (recolección)
- `sfx_levelup.mp3` (subida de nivel)
- `sfx_gameover.mp3` (game over)

Recomendaciones:
- MP3 a 128–192kbps está perfecto.
- Clips cortos para SFX (50–300ms aprox).
- Mantén nombres tal cual para que el loader los encuentre.

---

## ♻️ Offline / Updates (Service Worker)

- La app funciona **offline** tras la primera carga.
- Cuando hay una actualización:
  - aparece el pill **Actualizar**
  - puedes aplicar en el momento (si no estás jugando) o al terminar run

Si notas “caché vieja”:
- Usa **Reparar PWA** o `?repair=1`.

---

## 🧾 Perfiles (auth.js)

- Perfiles guardados en el dispositivo (localStorage).
- Migración automática desde claves antiguas si procede.
- API disponible en `window.Auth`:
  - crear/seleccionar/renombrar/borrar
  - export/import (útil para backups)

---

## 🧪 Dev rápido (local)

Puedes abrir `index.html` directamente, pero para evitar problemas de rutas/caché es mejor un server local:

- VS Code → extensión “Live Server”
- o cualquier servidor estático simple

---

## ✅ Checklist de release

- [ ] `window.APP_VERSION = "0.1.5"` en `index.html`
- [ ] `manifest.webmanifest` actualizado a `0.1.5`
- [ ] `sw.js` versionado a `v0.1.5`
- [ ] Todos los imports con `?v=0.1.5`
- [ ] Probado:
  - [ ] Primer load
  - [ ] Offline tras recargar
  - [ ] Instalación PWA
  - [ ] Audio tras pulsar “Empezar”
  - [ ] Repair Mode (`?repair=1`)

---

## 📜 Licencia
Proyecto personal / prototipo. (Define aquí tu licencia si lo vas a publicar.)
