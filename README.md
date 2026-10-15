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

## Aplicaciones

| Superficie | Entrada |
| --- | --- |
| Sitio público / marketplace | `/` |
| App cliente | `?app=client` |
| Panel admin | `?app=admin` |
| Panel Super Admin | `?app=superadmin` (exige rol `superadmin`) |

### Panel admin (rediseño 2026-10-15)

Consola de operaciones conectada al proyecto **UGO TEST**: visión general con indicadores reales, servicios con
expediente completo, personas, legajos de profesionales, finanzas (Pix directo, bóveda, comisiones, retiros),
disputas, auditoría y estado de contratos. Incluye acciones administrativas por RPC (`admin_set_usuario_activo`,
`conciliar_pix_direto`, `admin_confirmar_deuda_ugo_pagada`, `admin_actualizar_retiro`, `admin_resolver_disputa`),
sincronización Realtime y mensajes de error traducidos de los contratos vigentes.

- El rol se valida en `usuarios` (`tipo` admin/superadmin y `activo`), no en el frontend.
- La sesión admin se guarda en `ugo-platform-admin-auth`, separada de la app cliente.
- Los contratos ausentes o sin permisos (RLS) se muestran como aviso; nunca se inventan datos ni se rellena con ceros.
- Documentación: [`docs/admin-panel-20261015.md`](docs/admin-panel-20261015.md).

## Publicación

El workflow `.github/workflows/deploy.yml` construye `dist` en cada push a `main` y lo publica en GitHub Pages. En Settings → Pages, seleccionar **GitHub Actions** como fuente. URL esperada: https://sebastisnzoth.github.io/ugo-platform/.

## Verificación

```bash
npm run build         # typecheck estricto + build de producción
npm run smoke:admin   # monta el panel admin en jsdom y recorre sus 8 secciones
```

## Alcance inicial

- Home responsive del marketplace.
- Búsqueda visual de categorías.
- Registro e inicio de sesión Supabase.
- Selección inicial de rol cliente/profesional.
- Panel admin conectado a UGO TEST (`?app=admin`).
- Deploy automatizado de GitHub Pages.
