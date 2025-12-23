# Grid Rogue — Arcade Roguelite (v0.1.9)

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

## 🧠 Upgrades y rarezas

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

```
## ✅ Update v0.1.9 (nuevo)

### ❤️ Sistema de Vida (Corazones)
- El jugador ahora tiene **vida**: empieza con **10 corazones**.
- Cada vez que pisa/recibe el efecto de una **trampa (tile rojo)**, pierde **1 corazón**.
- La vida se muestra **en la barra superior**, junto a la zona donde ves el nivel / progreso (HUD).
- Feedback claro de daño/estado para que se note al instante cuando estás en peligro.

### ➕ Nueva mejora: “Vida +”
- Se añade una **nueva mejora** que permite **ganar corazones** (curación / vida extra).
- Entra dentro del sistema de rarezas (cuanto más rara, mejor impacto).

### 🧲 Imán con duración (según rareza)
- La mejora de **Imán** deja de ser permanente y pasa a ser **temporal**:
  - **Común**: duración corta
  - **Rara**: duración media
  - **Épica**: duración alta
  - **Legendaria**: duración máxima
- Cuando el imán está activo, el jugador atrae premios cercanos durante ese tiempo.

### 🏷️ Badges de mejoras activas en HUD
- En la zona del HUD (junto al nivel), ahora aparecen **iconos/badges** de las **mejoras activas**.
- Si tienes varias copias del mismo upgrade:
  - Se muestra un **contador** encima del badge (ej. “2”, “3”…).
  - Si solo hay 1, **no aparece número**.
- Si la mejora es temporal (como Imán), el badge se mantiene visible mientras dure.

### 🧱 Panel de mejoras mejorado (más “pro”)
- El panel de Upgrades se ve **más claro y más bonito**:
  - Jerarquía visual más marcada (rareza → nombre → descripción).
  - Mejor espaciado y lectura.
  - Presentación más limpia al elegir.
- En general, el panel “aparece” mejor y se percibe más premium.

### 🔊 Audio v0.1.9 (compat + nuevos SFX)
- `audio.js` y `audio_sys.js` actualizados a **v0.1.9**.
- Alias SFX extra listos para usarse desde el gameplay/UI:
  - `hurt`, `heal`, `heart`, `magnet_on`, `magnet_off`, `upgrade_open`, `upgrade_pick`, etc.
- Se refuerza el criterio de **no música procedural** (silencio si no se puede reproducir el loop).

```