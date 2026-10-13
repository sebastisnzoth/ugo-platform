# UGO Platform

Nueva implementación de UGO en React + TypeScript + Vite, separada de `ugo-admin-panel` y publicada mediante GitHub Actions en GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev
```

## Supabase

La app utiliza el proyecto compartido UGO TEST existente (`tmossnqfwfwjrtzwcbmm`) y su autenticación. No crea una base paralela ni ejecuta migraciones. La URL y la clave publicable pueden configurarse con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca agregar claves `service_role` al frontend.

La autenticación de inicio de sesión y registro está conectada. El catálogo visual es una primera base de interfaz; los listados reales, solicitudes, asignaciones, mapas y paneles completos por rol deben conectarse a los contratos/tablas ya existentes sin recrear ni borrar datos.

## Publicación

El workflow `.github/workflows/deploy.yml` construye `dist` en cada push a `main` y lo publica en GitHub Pages. En Settings → Pages, seleccionar **GitHub Actions** como fuente. URL esperada: https://sebastisnzoth.github.io/ugo-platform/.

## Alcance inicial

- Home responsive del marketplace.
- Búsqueda visual de categorías.
- Registro e inicio de sesión Supabase.
- Selección inicial de rol cliente/profesional.
- Deploy automatizado de GitHub Pages.
