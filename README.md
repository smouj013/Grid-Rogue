# Grid Rogue — Arcade Roguelite (v0.2.0)

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

## Licencia

© 2025 Grid Rogue. Todos los derechos reservados.

Queda prohibida la reproducción, distribución, modificación, descompilación, ingeniería inversa o cualquier uso del código, recursos, gráficos, audio y demás contenidos de este proyecto sin autorización expresa y por escrito del autor.

Este proyecto no se licencia para uso público. El acceso al repositorio/archivos no otorga ningún derecho de uso, copia o redistribución.

---

## 🔖 Versión

```
✅ Update v0.2.0

🧭 HUD sin “layout shift” (HP + Badges fuera del container)

La vida (corazones) y los badges de mejoras activas ahora se renderizan en un dock/overlay propio del HUD.

Resultado: no empujan ni deforman la barra de nivel/progreso, y no cambian el layout cuando aparecen/desaparecen badges.

Mejor soporte de safe-area (móvil) y z-index para que nunca queden tapados.

📐 Layout responsive “pro” (más espacio al juego sin romper el grid)

El panel/fondo del juego (container del grid) ahora se expande si hay espacio en pantalla.

El grid mantiene intacto el número correcto de celdas visibles (sin estirar ni deformar).

Se eliminan efectos raros de padding: más aire, mejor centrado y lectura.

Objetivo: cero scroll en gameplay y una UI más limpia.

❤️ Sistema de Vida (Corazones) refinado

HP sigue siendo 10 corazones iniciales.

Trampa (tile rojo) = -1 corazón con feedback más inmediato.

Mejor feedback visual: “flash/impacto” al recibir daño y mejor claridad del estado.

➕ Mejora “Vida +” mejor integrada (rareza y feedback)

La mejora Vida + se integra mejor en UI/UX:

Mejor mensaje/feedback al curarte.

Preparada para escalar por rareza sin romper el balance ni el sistema.

🧲 Imán temporal pulido (tiempo + badge claro)

El Imán sigue siendo temporal según rareza.

El badge de Imán muestra la duración restante de forma más legible y estable (sin afectar el layout).

Mejor consistencia en stacking/contador cuando hay varias copias.

🧱 Panel de Upgrades “más premium” (espaciado y jerarquía)

Más padding, separación entre elementos y lectura.

Rareza/nombre/descripción se ven más claros y sin solaparse.

Mejor comportamiento en pantallas pequeñas y grandes.

🔊 Audio (v0.2.0) y robustez

Mejoras de estabilidad para evitar dobles inicializaciones.

Mantiene aliases SFX (hurt/heal/magnet_on/off/upgrade_open/pick, etc.) y refuerza el comportamiento de fallback.

🧠 Rendimiento / Estabilidad general

Helpers de rendimiento (“rendiment”) listos para medir FPS/stutters sin romper nada.

Mejor comportamiento al cambiar de pestaña/volver (sin cuelgues ni estados raros).

Ajustes de compatibilidad y limpieza para que todo siga funcionando aunque falte algún nodo del HUD en HTML.

```