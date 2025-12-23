# Grid Rogue — Arcade Roguelite (v0.1.7)

**Grid Rogue** es un **arcade roguelite en cuadrícula**: runs cortas, decisiones rápidas, **upgrades** al subir de nivel, **combos** por secuencias y un gameplay que se vuelve más “peligroso” cuanto mejor juegas.  
Diseñado para sentirse **fluido, directo y adictivo**, con **feedback juicy** (SFX, animaciones, resaltados) y controles cómodos tanto en **móvil (portrait)** como en escritorio.

---

## ⚡ De qué va (en 20 segundos)

Te mueves por una cuadrícula y tomas decisiones en milisegundos: **arriesgas para puntuar más**, encadenas **combos** con temporizador y eliges **mejoras** que cambian el estilo de tu run.  
Cada partida es distinta: no “grindeas” menús, juegas, mejoras, repites… y en cada run aprendes algo nuevo.

---

## 🎮 Loop de juego

- **Moverte** y sobrevivir en la cuadrícula.
- **Puntuar** recogiendo y encadenando acciones con ritmo.
- Mantener un **multiplicador** alto completando **secuencias de combo** antes de que expire el temporizador.
- **Subir de nivel** y elegir **1 de 3 upgrades** (con rarezas: común/rara/épica/legendaria).
- Combinar mejoras para crear builds: más riesgo, más recompensa.

---

## 🧠 Upgrades y rarezas (v0.1.7)

Los upgrades están pensados como decisiones “de roguelite”:
- **Común**: mejora estable, útil en cualquier run.
- **Rara**: cambia tu forma de jugar o potencia combos.
- **Épica**: un salto notable de poder o de ritmo.
- **Legendaria**: define el build (alto impacto).

> En v0.1.7 el sistema evita ofrecer upgrades “inferiores” si ya tienes una mejora superior equivalente (para que las elecciones tengan sentido).

---

## ✨ Feedback “juicy” (lo que se siente)

Grid Rogue busca que cada acción tenga respuesta:
- **Combos** con temporizador claro y sensación de “urgencia”.
- **Upgrades** con presentación más vistosa: color por rareza, mejor centrado y “momento” de elección.
- **Efectos visuales** que acompañan: resaltados, micro-animaciones y celebraciones (confeti/partículas) en el panel de upgrades.
- Un estilo **oscuro + neón** con interfaz limpia, sin tapar el juego.

---

## 🔊 Audio (SFX + música)

El audio es parte del ritmo:
- **Música en loop** para mantener flow.
- **SFX** para cada evento importante (UI, picks, combo, level up, game over…).
- Controles desde Opciones: **Music/SFX**, volúmenes y **Mute**.

> Importante: si faltan archivos de audio, el juego no se rompe; usa fallback y sigue funcionando.

---

## 👤 Perfiles y récords

- **Perfiles locales** (en el dispositivo) con mejor score por perfil.
- Perfecto para compartir móvil/PC con amigos y comparar runs.

---

## 📲 PWA instalable (móvil y escritorio)

Grid Rogue se puede jugar desde el navegador o instalar como app:
- **Móvil (portrait)**: pensado para pantalla completa.
- **Escritorio**: misma sensación, controles directos.

Incluye modo “Repair” si alguna vez una caché antigua se queda pegada tras actualizar.

---

## 🧪 Controles

- **Teclado**: WASD / Flechas.
- **Móvil**: Swipe (y cruceta opcional si la activas en Opciones).

---

## 🗺️ Roadmap corto (ideas)

- Más variedad de upgrades y sinergias.
- Eventos raros de run (modificadores temporales).
- Más “juice” en combos (streaks, flashes, mini-victorias).
- Ajustes de dificultad por niveles para runs más tensas.

---

## 🔖 Versión

## ✅ Update v0.1.7 (nuevo)

- **Arquitectura modular (split de app):** el juego queda dividido en **app.js (core)** + **utils.js** + **localization.js** + **audio_sys.js** para tener código más limpio, mantenible y sin “mezclas” raras al actualizar.
- **Inicialización más robusta:** orden de carga revisado para que **utils/localization/audio_sys** estén listos antes del core; arranque más estable sin depender de timing del DOM ni de que existan todos los elementos.
- **Audio separado y sólido:**
  - **audio_sys.js** centraliza el motor de audio (unlock por gesto, música/SFX, fallbacks).
  - **audio.js** gestiona **UI + settings** (Music/SFX, volúmenes, Mute, Test) sin romper si falta DOM o si AudioSys aún no está listo.
  - Settings compatibles con clave nueva **gridrogue_settings_v1** + legacy **gridrunner_settings_v1**.
  - Si hay **perfil activo**, guarda/lee audio también en **prefs del perfil** (sin depender de Auth si no existe).
- **Service Worker v0.1.7 mejorado:**
  - Prefijo de caché **gridrogue-** (evita mezclar con builds viejos).
  - Core con normalización de `?v=` (cache estable) + runtime **stale-while-revalidate**.
  - Limpieza agresiva de caches antiguas (**gridrunner-** y previas).
  - Navegación PWA/SPA: **network-first** con fallback seguro a `index.html`.
- **Repair Mode + failsafes:** modo `?repair` / `?nosw` y botón de “Reparar PWA” para desregistrar SW y borrar caches si alguna actualización se queda pegada.
- **Branding correcto:** todo el proyecto pasa a llamarse **Grid Rogue** (sin referencias a Grid Runner) manteniendo compatibilidad con datos antiguos cuando conviene.
