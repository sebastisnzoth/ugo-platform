# Panel Admin y Super Admin (2026-10-17)

Nuevas vistas en `src/AdminExperience.tsx` + `src/adminData.ts` + `src/admin-app.css` (tema "control center" oscuro).

## Acceso y roles (contrato real)

Fuente: `ugo-admin-panel` (`AdminGate.tsx`, `admin_superadmin_config_hardening.sql`, `database.types.ts`, `docs/UGO_DATA_BACKEND_MASTER.md` §15/§21).

- **Admin** (`?app=admin`): `usuarios.tipo` ∈ `admin` | `superadmin` y `activo = true`.
- **Super Admin** (`?app=superadmin`): `usuarios.tipo = 'superadmin'` y `activo = true`.
- Login propio del panel (mismo gate que `AdminGate`), pantalla de "Acceso denegado" y cierre de sesión.
- La autorización real vive en RLS/RPC (`private.is_admin` / `private.is_superadmin`); la UI solo refleja el rol y oculta acciones.

## Pantallas Admin

- **Dashboard** — métricas reales de `vista_admin_dashboard` (12 indicadores: bóveda, ingresos, disputas, docs, etc.).
- **Servicios** — `servicios` con joins de categoría/cliente/proveedor, chips de estado y filtro.
- **Usuarios** — `usuarios` con rol, karma y trabajos; acción **Suspender proveedor** (RPC `admin_suspender_proveedor`, auditada).
- **Disputas** — `disputas` con formulario de resolución (RPC `admin_resolver_disputa`, con `p_favor_de`).
- **Documentos / KYC** — `documentos` con estados reales.
- **Bóveda** — `escrow` con acción **Liberar** (RPC `admin_liberar_escrow`, auditada).
- **Auditoría** — `audit_log` (evento, entidad, detalles, timestamp).

## Sección Super Admin (`?app=superadmin`)

- **Configuración del sistema** — `config_sistema` (lectura admin) + edición por RPC `admin_update_config` (los `feature_*` exigen superadmin).
- **Feature flags** — toggle por RPC `admin_set_feature_flag`.
- **Bóveda de credenciales de pago** — solo estado vía `admin_payment_credentials_status()` (`private.payment_credentials` nunca se expone).
- **Autonomía del sistema** — RPC `superadmin_evaluate_autonomy_on_gate` (auditada).

## Pendiente

- Realtime del panel (§26: `servicios`, `servicio_estado_eventos`, `pagos`, `deudas_ugo_proveedor`).
- Ficha 360° por serviceId, trazabilidad por usuario (§21) y reputación bilateral.
- Gestión completa de KYC (OCR, revisor), retiros y conciliación PIX.
- Workers autónomos (control center) más allá del gate de evaluación.

## Acceso desde la landing

- Login con metadata `role`/`tipo` = `admin`/`superadmin` redirige al panel correspondiente.
- Enlace discreto "Acceso staff" en el footer de la landing.
