# Grid Runner (PWA) — v0.1.2

Arcade grid runner con **perfiles locales**, **upgrades**, **combos**, **PWA instalable**, **offline**, y (lo más importante) **anti-freeze**: si algo falla, **siempre** tienes salida (Recargar / Reparar PWA).

---

## ✅ Cambios v0.1.2 (respecto a 0.1.1)

### Estabilidad / “no se queda congelado”
- **Failsafe inline en `index.html`** (no depende de `app.js`):
  - Si pasados ~4.5s sigue “Cargando”, aparecen:
    - **Recargar**
    - **Reparar PWA** (desregistra Service Worker + borra caches + recarga)
- `app.js` añade **captura global de errores**:
  - `window.onerror` + `unhandledrejection`
  - Si algo revienta, se oculta loading y se muestra overlay de error.
- `app.js` fuerza un **arranque robusto**:
  - Nunca deja `overlayLoading` bloqueando sin salida.
  - `requestAnimationFrame` protegido con try/catch.

### PWA / Updates más fiables
- `register("./sw.js?v=0.1.2")` para evitar SW viejo.
- `reg.update()` al iniciar para buscar actualización al momento.
- Pill **“Actualizar”** se activa al detectar `waiting` o `installed` con controller.

---

## 📁 Estructura de archivos (root del repo)

```
index.html
styles.css
app.js
auth.js
sw.js
manifest.webmanifest
assets/
icons/
favicon-32.png
icon-192.png
icon-512.png
apple-touch-icon-180.png
sprites/ (opcional)
tile_coin.svg (opcional)
tile_gem.svg
tile_bonus.svg
tile_trap.svg
tile_block.svg
```


> Si `assets/sprites` no existe o faltan sprites, el juego funciona igual (fallback a colores).

---

## 🚀 Deploy en GitHub Pages (paso a paso)

1. **Crea un repo** en GitHub (público o privado).
2. Sube **todos los archivos** al **root** del repo (misma carpeta).
3. Ve a: **Settings → Pages**
4. En **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Guarda y abre la URL que te da GitHub Pages.

---

## ✅ Checklist rápido (para evitar problemas típicos)

### 1) La app no actualiza
- Pulsa **Actualizar** (pill en la topbar) si aparece.
- Si sigue raro: abre la PWA → ve a “Cargando” → pulsa **Reparar PWA**.

### 2) Se queda “Cargando…” y no puedes tocar nada
En v0.1.2 **no debería pasar sin salida**:
- espera 4–5 segundos → deben aparecer los botones:
  - **Recargar**
  - **Reparar PWA**

### 3) “Los botones no funcionan”
Casi siempre es:
- JS viejo cacheado por SW
- o un error JS que aborta el arranque

Solución:
- **Reparar PWA** (lo hace automático)
- o manual: borrar datos del sitio + recargar

---

## 🧩 Cómo funciona el “Reparar PWA”
Cuando lo pulsas:
1. Desregistra todos los Service Workers del origen.
2. Borra todas las caches del navegador (`caches.delete(...)`).
3. Recarga la página.

Esto fuerza a descargar de cero `index.html`, `app.js`, `styles.css`, etc.

---

## 🎮 Controles
- PC: **WASD** / **Flechas**
- Móvil: **Swipe**
- Opcional: **Cruceta (D-pad)** en Opciones (si activada)

---

## ⚙️ Opciones (overlay Opciones)
- **Usar sprites** (si existen en `assets/sprites`)
- **Vibración** (móvil)
- **Mostrar cruceta** (móvil)
- **FX** (multiplicador visual/feedback)
- **Borrar datos locales** (perfiles + settings + runs)

---

## 🧠 Datos locales (sin servidor)
Se guardan en `localStorage`:
- Perfiles: `gridrunner_auth_v1`
- Settings: `gridrunner_settings_v1`
- Runs recientes: `gridrunner_runs_v1`
- Legacy (migración): `gridrunner_name_v1`, `gridrunner_best_v1`

---

## 🔄 Actualizar versión
Para sacar v0.1.3, etc.:
1. Cambia `window.APP_VERSION` en `index.html`.
2. Cambia `VERSION` en `sw.js`.
3. Actualiza los `?v=` de:
   - `styles.css?v=...`
   - `auth.js?v=...`
   - `app.js?v=...`
   - `manifest.webmanifest?v=...`
4. Deploy en GitHub Pages.

---

## 🛠️ Debug rápido (si algo falla)
- Abre **DevTools → Console** y mira errores.
- Pruébalo en incógnito para descartar cache.
- Si es iOS:
  - Instala de nuevo desde Safari (Share → Add to Home Screen).
  - Si se queda raro: “Reparar PWA” desde la web y vuelve a abrir.

---

## 📌 Notas importantes
- Si tu repo está en subcarpeta de GH Pages (`usuario.github.io/repo/`), el `sw.js` usa `registration.scope`, así que funciona igual.
- Google Fonts (Material Symbols) es cross-origin y no se cachea por el SW (normal).

---

## Licencia
Uso libre para tu proyecto.
