# Grid Rogue — Arcade Roguelite (v0.1.8)

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

```
✅ Update v0.1.8 (nuevo)

Mejoras de UI en “Mejoras / Upgrades”:

Panel de upgrades más legible y compacto, con mejor jerarquía visual (título → rareza → nombre → descripción).

Tags (Defensa / QoL / Puntos / Movilidad / Combo) más claros y consistentes.

Mejor soporte para textos largos (wrap correcto + cortes elegantes).

Escudo con feedback visual (aura protectora):

Si el jugador tiene Escudo activo, el tile del player muestra un aura/brillo sutil para que se entienda al instante que está protegido.

Al consumir el escudo, el aura desaparece con un feedback visual limpio.

Mobile: zona de juego más grande y sin “scroll raro”:

Ajustes de layout para que el juego se vea más grande en móvil y no “quede enano”.

Correcciones para evitar scroll accidental y problemas con viewport-fit/safe-area.

El canvas/grid se adapta mejor al alto real de pantalla.

Mobile: grid más compacto (mejor proporción):

En móvil el tablero pasa a un formato más “usable” (ej. de 8×24 → 8×16) para evitar que sea demasiado alto y se vea pequeño.

En escritorio se mantiene el grid original (sin afectar la experiencia).

Controles táctiles solo en móvil (y no tapan el juego):

El D-Pad/controles aparecen solo en móviles.

Flechas colocadas en los bordes (izquierda/derecha/arriba/abajo) para no cubrir el grid.

Mejor respuesta táctil (hitbox más cómoda sin invadir el área de juego).

Localización ampliada:

Añadidos idiomas extra (incluyendo chino, japonés, coreano, ruso, árabe y más), manteniendo fallback seguro a en/es si falta alguna clave.

Manifest / versión:

start_url actualizado a ?v=0.1.8 y versionado alineado con el resto del proyecto para evitar cachés “mezcladas”.
```