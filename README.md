# Grid Runner (PWA) — v0.1.1

## Cambios v0.1.1
- Iconos Material Symbols (Google Fonts) en lugar de emojis.
- Fix “loading infinito”: watchdog + el juego nunca se queda bloqueado.
- Animación de inicio (splash con transición a menú).
- Botón “Instalar” inteligente:
  - Solo aparece si el navegador soporta instalación y el sitio es instalable.
  - Nunca aparece en modo app/standalone.
- auth.js (perfiles locales):
  - Crear / seleccionar perfil.
  - Best score por perfil.
  - Migración automática desde `gridrunner_name_v1`.

## Deploy en GitHub Pages
1. Sube estos archivos al repo (root o carpeta).
2. En GitHub: Settings → Pages → Build and deployment:
   - Source: Deploy from a branch
   - Branch: main / (root)
3. Abre la URL de Pages.

## Offline
Con Service Worker:
- Navegación offline devuelve `index.html`.
- Assets en cache con stale-while-revalidate.

## Notas
- Material Symbols se cargan desde Google Fonts (si estás offline por primera vez, los iconos pueden tardar en aparecer).
