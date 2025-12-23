# Grid Rogue — PWA Arcade Roguelite (v0.1.6)

**Grid Rogue** es un arcade rápido estilo **roguelite en cuadrícula**: runs cortas, **upgrades**, **combos** y progresión por partida, con **audio** (SFX + música).  
Optimizado para **móvil (portrait)** y fluido también en escritorio.

> ⚠️ Importante: si **NO** existe `assets/audio/` o faltan audios, **no pasa nada** → el juego usa **fallback** y sigue funcionando.

---

## ✅ Qué incluye

- **Runs**: score, nivel, multiplicador y combos.
- **Upgrades** al subir de nivel (elige mejoras).
- **Combos** por secuencias con temporizador.
- **Audio completo**: música + efectos con toggles y volúmenes.
- **Perfiles locales** (localStorage): mejor score por perfil.
- **PWA instalable** + **offline** tras la primera carga.
- **Updates seguros**: aparece el pill **Actualizar** cuando hay nueva versión.
- **Repair Mode**: limpia Service Worker y cachés cuando algo se queda “pegado”.

---

## 📦 Estructura del proyecto (raíz del repo)

Sube todo en la **raíz** del repositorio (sin carpetas extra tipo `/dist`):

´´´
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
´´´
---

## 🚀 Deploy en GitHub Pages (paso a paso)

1. Crea un repo en GitHub (ej. `grid-rogue`).
2. Sube **todos los archivos** en la **raíz** del repo.
3. En GitHub:
   - **Settings → Pages**
   - **Build and deployment**
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / **(root)**
4. Abre la URL que te da GitHub Pages.

> ℹ️ En PWA es normal que el navegador tarde unos segundos en detectar que es instalable.

---

## 📲 Instalación (PWA)

### Android (Chrome/Edge)
- Abre la web → aparecerá botón **Instalar**  
  o menú ⋮ → **“Instalar app”**.

### iOS (Safari)
- Abre la web en Safari → botón compartir → **“Añadir a pantalla de inicio”**.

> Nota iOS: el audio (música/SFX) se activa tras pulsar **Empezar** o hacer el primer gesto, por políticas de autoplay.

---

## 🧰 Repair Mode (cuando “se queda raro”)

### Desde el juego
- **Opciones → Reparar PWA**  
  (desinstala el Service Worker, borra caches y recarga).

### Por URL (manual)
- `?repair=1` → limpia SW/caches y recarga (modo “nuke”)
- `?nosw=1` → arranca sin Service Worker (útil para debug)

---

## 🎵 Audio (archivos y recomendaciones)

### Archivos esperados (según el proyecto actual)

**Música**
- `assets/audio/bgm_loop.mp3` → música principal en loop
- `assets/audio/music_loop.mp3` → alternativa / respaldo

**Efectos (SFX)**
- `assets/audio/sfx_ui_click.wav` → UI / botones
- `assets/audio/sfx_coin.wav` → coin
- `assets/audio/sfx_gem.wav` → gem
- `assets/audio/sfx_bonus.wav` → bonus
- `assets/audio/sfx_trap.wav` → trap
- `assets/audio/sfx_ko.wav` → KO / hit fuerte
- `assets/audio/sfx_levelup.wav` → subir de nivel
- `assets/audio/sfx_upgrade.wav` → elegir upgrade
- `assets/audio/sfx_pick.wav` → pick/collect genérico
- `assets/audio/sfx_reroll.wav` → reroll
- `assets/audio/sfx_combo.wav` → combo
- `assets/audio/sfx_block.wav` → block
- `assets/audio/sfx_gameover.wav` → game over

> Si quieres usar otros nombres, ajusta el loader dentro de `audio.js`.

### Recomendaciones para que suene bien
- Música: MP3 **128–192 kbps**, loop limpio (sin “click” al repetir).
- SFX: clips cortos (**50–300ms**), sin saturación (evita clipping).
- Exporta WAV a 44.1kHz o 48kHz (lo importante es que no recorte).

---

## ♻️ Offline / Updates (Service Worker)

- La app funciona **offline** después del primer load.
- Cuando publiques una versión nueva:
  - aparece el pill **Actualizar**
  - puedes aplicarlo en el momento (mejor si NO estás en mitad de un run)

Si notas “caché vieja” o comportamiento raro:
- usa **Reparar PWA** o entra con `?repair=1`.

---

## 👤 Perfiles (auth.js)

- Perfiles guardados en el dispositivo (localStorage).
- Migración automática desde claves antiguas si procede.
- API en `window.Auth`:
  - `createProfile(name)`
  - `listProfiles()`
  - `setActiveProfile(id)`
  - `renameProfile(id, newName)`
  - `deleteProfile(id)`
  - `getBestForActive()`
  - `setBestForActive(score)`
  - `exportAuth()` / `importAuth(json)`
  - prefs opcionales por perfil (si el juego las usa)

---

## 🧪 Desarrollo local

Puedes abrir `index.html` directamente, pero para evitar problemas de rutas/caché es mejor un server local:

- VS Code → extensión **Live Server**
- o cualquier servidor estático simple

---

## ✅ Checklist de release (v0.1.6)

Asegúrate de que todo está alineado a **0.1.6**:

- [ ] `window.APP_VERSION = "0.1.6"` en `index.html`
- [ ] `manifest.webmanifest` actualizado (ej. `start_url: "./?v=0.1.6"`)
- [ ] `sw.js` versionado a `v0.1.6`
- [ ] Imports con `?v=0.1.6` (`styles.css`, `app.js`, `auth.js`, etc.)
- [ ] Probado:
  - [ ] Primer load
  - [ ] Offline tras recargar
  - [ ] Instalación PWA (Android/iOS)
  - [ ] Audio tras pulsar “Empezar”
  - [ ] Repair Mode (`?repair=1`)
  - [ ] Update pill aparece tras deploy nuevo

---

## 📜 Licencia

Proyecto personal / prototipo.  
Define aquí tu licencia si lo vas a publicar (MIT, Apache-2.0, GPL, etc.).
