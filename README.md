```md
# Grid Rogue — PWA Arcade (v0.1.6)

**Grid Rogue** es un arcade rápido de **roguelite en cuadrícula**: runs cortas, **upgrades**, **combos** y progresión por partida, con **audio** (SFX + música).  
Optimizado para **móvil** (portrait) y fluido también en escritorio.

---

## ✅ Características

- **Runs**: score, nivel, multiplicador y combos.
- **Upgrades** al subir de nivel (elige mejoras).
- **Combos** por secuencia con temporizador.
- **Audio completo** con control de música/SFX y volúmenes.
- **Perfiles locales** (localStorage) con mejor score por perfil.
- **PWA instalable** + **offline** tras la primera carga.
- **Actualizaciones seguras**: aparece el pill **Update/Actualizar** cuando hay nueva versión.
- **Repair Mode** para limpiar Service Worker y cachés si algo se queda desincronizado.

---

## 📁 Estructura del proyecto

Sube todo en la **raíz** del repo (sin subcarpetas extra tipo `/dist`):

```

/
.nojekyll
index.html
styles.css
app.js
auth.js
audio.js
sw.js
manifest.webmanifest
README.md
assets/
icons/
favicon-32.png
apple-touch-icon-180.png
icon-192.png
icon-192-maskable.png
icon-512.png
icon-512-maskable.png
audio/
bgm_loop.mp3
music_loop.mp3
sfx_ui_click.wav
sfx_coin.wav
sfx_gem.wav
sfx_bonus.wav
sfx_trap.wav
sfx_ko.wav
sfx_levelup.wav
sfx_pick.wav
sfx_reroll.wav
sfx_combo.wav
sfx_gameover.wav
sfx_block.wav
sfx_upgrade.wav
sprites/
tile_block.svg
tile_bonus.svg
tile_coin.svg
tile_gem.svg
tile_trap.svg

```

> Si **NO** existe `assets/audio/` o faltan audios: **no pasa nada** → el juego usa **sonidos/música fallback** y sigue funcionando.

---

## 🚀 Deploy en GitHub Pages (paso a paso)

1. Crea un repo en GitHub (ej. `grid-rogue`).
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
- Abre la web → aparecerá botón **Instalar**
  o menú ⋮ → **“Instalar app”**.

### iOS (Safari)
- Abre la web en Safari → botón compartir → **“Añadir a pantalla de inicio”**.

> Nota iOS: música/sonidos arrancan tras pulsar **Empezar**, por restricciones de autoplay.

---

## 🧰 Modo reparación (cuando algo se queda raro)

### Desde la UI
- **Opciones → Reparar PWA**: desinstala SW + borra caches y recarga.

### Por URL (manual)
- `?repair=1` → limpia SW/caches y recarga
- `?nosw=1` → arranca sin Service Worker

---

## 🎵 Añadir tu música y sonidos

Coloca los archivos en `assets/audio/`.

### Nombres recomendados (según el proyecto actual)
**Música**
- `bgm_loop.mp3` (loop principal)
- `music_loop.mp3` (alternativa/backup)

**SFX**
- `sfx_ui_click.wav` (UI)
- `sfx_coin.wav`, `sfx_gem.wav`, `sfx_bonus.wav`
- `sfx_levelup.wav`, `sfx_upgrade.wav`
- `sfx_gameover.wav`
- `sfx_trap.wav`, `sfx_ko.wav`
- `sfx_pick.wav`, `sfx_reroll.wav`
- `sfx_combo.wav`
- `sfx_block.wav`

> Si prefieres otros nombres, tendrás que ajustarlos en el loader de `audio.js`.

### Recomendaciones
- Música: MP3 128–192kbps, loop limpio.
- SFX: clips cortos (50–300ms aprox), sin clipping.
- Mantén nombres tal cual para que el loader los encuentre.

---

## ♻️ Offline / Updates (Service Worker)

- La app funciona **offline** tras la primera carga.
- Cuando hay una actualización:
  - aparece el pill **Actualizar**
  - puedes aplicar en el momento (si no estás jugando) o al terminar el run

Si notas “caché vieja”:
- Usa **Reparar PWA** o entra con `?repair=1`.

---

## 🧾 Perfiles (auth.js)

- Perfiles guardados en el dispositivo (localStorage).
- Migración automática desde claves antiguas si procede.
- API disponible en `window.Auth`:
  - `createProfile`, `setActiveProfile`, `renameProfile`, `deleteProfile`
  - `getBestForActive`, `setBestForActive`
  - `exportAuth`, `importAuth` (útil para backups)
  - prefs opcionales por perfil (si el juego las usa)

---

## 🧪 Dev rápido (local)

Puedes abrir `index.html` directamente, pero para evitar problemas de rutas/caché es mejor un server local:

- VS Code → extensión **Live Server**
- o cualquier servidor estático simple

---

## ✅ Checklist de release (v0.1.6)

- [ ] `window.APP_VERSION = "0.1.6"` en `index.html`
- [ ] `manifest.webmanifest` actualizado a `0.1.6` (incluye `start_url`)
- [ ] `sw.js` versionado a `v0.1.6`
- [ ] Todos los imports con `?v=0.1.6`
- [ ] Probado:
  - [ ] Primer load
  - [ ] Offline tras recargar
  - [ ] Instalación PWA
  - [ ] Audio tras pulsar “Empezar”
  - [ ] Repair Mode (`?repair=1`)

---

## 📜 Licencia

Proyecto personal / prototipo.  
Define aquí tu licencia si lo vas a publicar (MIT, Apache-2.0, GPL, etc.).
```
