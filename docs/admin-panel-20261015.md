# Rediseño del panel admin UGO (conectado a UGO TEST)

Fecha: 2026-10-15 · Alcance: `ugo-platform`, entrada `?app=admin` (y `?app=superadmin`).

## 1. Qué se entrega

Un panel administrativo nuevo, con lenguaje visual propio y datos reales del proyecto compartido **UGO TEST**
(`tmossnqfwfwjrtzwcbmm`). No se crean tablas, no se ejecutan migraciones y no se mezclan datos de demostración
con producción.

### Secciones

| Sección | Qué muestra | Fuente real |
| --- | --- | --- |
| Visión general | 8 indicadores, pulso de 14/30 días, cola de atención y últimos movimientos auditados | conteos sobre `servicios`, `pagos`, `perfiles_proveedor`, `usuarios`, `deudas_ugo_proveedor`, `disputas`, `documentos` + `audit_log` |
| Servicios | filtros por estado (`buscando`, `ofrecido`, `asignado`, `en_camino`, `esperando_aprobacion`, `disputado`, `completado`, `cancelado`), ambiente real/demo, búsqueda por número, descripción o zona y expediente con resumen, eventos, evidencias y pagos | `servicios`, `eventos_servicio` (fallback `servicio_estado_eventos`), `evidencias_servicio`, `pagos`, `disputas` |
| Personas | cuentas con rol real, estado activo/inactivo, último acceso de Auth, perfil de cliente/profesional y acción de activar/desactivar | `usuarios`, `perfiles_cliente`, `perfiles_proveedor`, RPC `admin_get_auth_users` |
| Profesionales | cola de verificación (registrado/pendiente/verificado/rechazado), presencia online/disponible, ciudad base y documentos del legajo | `perfiles_proveedor`, `documentos` |
| Finanzas | Pix directo informado sin conciliar, pagos por estado (bóveda), comisiones UGO de efectivo y retiros reales | `pagos`, `deudas_ugo_proveedor`, `retiros` |
| Disputas | casos abiertos/en revisión vs. resueltos, conversación del caso y resolución a favor de cliente o profesional | `disputas`, `disputa_mensajes` |
| Auditoría | eventos con actor, entidad y detalle JSON | `audit_log` |
| Sistema | entorno conectado, estado real de cada tabla y RPC, categorías y configuración vigente (valores sensibles enmascarados) | catálogo OpenAPI de PostgREST + `categorias`, `config_sistema` |

### Acciones administrativas (RPC reales, auditadas)

| Acción | RPC | Validaciones de UI |
| --- | --- | --- |
| Activar / desactivar cuenta | `admin_set_usuario_activo(p_usuario_id, p_activo, p_motivo)` | confirmación con motivo que queda en auditoría |
| Conciliar o rechazar Pix | `conciliar_pix_direto(p_pago_id, p_aprobar, p_referencia, p_nota)` | referencia end-to-end obligatoria (6–160) al aprobar |
| Confirmar cobro de comisión UGO | `admin_confirmar_deuda_ugo_pagada(p_deuda_id, p_referencia, p_notas)` | referencia mínima de 4 caracteres |
| Retiros (procesando / pagado / fallido) | `admin_actualizar_retiro(p_retiro_id, p_estado, p_transferencia_externa_id, p_notas)` | referencia obligatoria para `pagado`; bloqueo de retiros demo |
| Resolver disputa | `admin_resolver_disputa(p_disputa_id, p_resolucion, p_favor_de)` | texto de resolución mínimo de 8 caracteres |

Los mensajes de error del contrato (`ADMIN_REQUIRED`, `PIX_REFERENCE_REQUIRED`, `WITHDRAWAL_ALREADY_FINAL`,
`La resolución requiere una explicación`, …) se traducen a mensajes operativos en español. Ninguna acción se
simula: si la RPC no está expuesta o falla, el panel muestra el motivo y no marca éxito.

## 2. Acceso

1. Abrir `?app=admin` (o `?app=superadmin`).
2. Ingresar con el email (o usuario corto, que se resuelve como `usuario@example.com`) y contraseña de UGO TEST.
3. El panel valida el rol contra `usuarios`: `tipo` ∈ {`admin`, `superadmin`, `arbitro`} y `activo = true`.
   Para `?app=superadmin` y para la sección Super Admin se exige `tipo = superadmin`.
4. Si el rol no corresponde, se cierra la sesión y se explica el motivo. La sesión admin vive en
   `localStorage['ugo-platform-admin-auth']`, aislada de la app cliente.

Recuperación de contraseña: `resetPasswordForEmail` con retorno a `?app=admin&recovery=1`; el enlace (`?code=`) se
intercambia con `exchangeCodeForSession` y luego se define la nueva contraseña.

## 3. Diseño

- **Rail oscuro** con grupos Operación / Personas / Dinero / Sistema, contadores vivos en los accesos
  (Pix + comisiones, disputas, verificaciones, pedidos demorados) y tarjeta de entorno `UGO TEST`.
- **Barra superior** con título contextual, indicador de tiempo real (Realtime) y botón de actualización manual.
- **Indicadores** con tipografía numérica tabular, tono semántico y aclaración de la métrica (por ejemplo
  «Informados por el cliente», «Sin match hace +30 min»).
- **Tablas densas** con encabezado fijo, filas navegables por teclado, chips de estado y columnas numéricas
  alineadas a la derecha.
- **Panel lateral (drawer)** para expedientes: resumen, eventos, evidencias, pagos, disputas y conversación.
- **Buscador de acciones** con `Ctrl/⌘ + K`, atajo `/` para enfocar la búsqueda de la sección y `Esc` para cerrar.
- **Estados honestos**: `StatusNote` distingue «contrato no disponible», «sin permisos (RLS)», «error de red»;
  los indicadores que no se pueden leer se muestran como `—`, nunca como `0` falso. Los vacíos explican por qué
  pueden estar vacíos.
- **Responsive**: 4 → 3 → 2 → 1 columnas; el rail pasa a menú lateral con fondo oscuro en ≤1024 px.
- Accesibilidad: roles `tablist`/`dialog`, `aria-current`, foco visible, `aria-live` en avisos y soporte de
  `prefers-reduced-motion`.

## 4. Sincronización

- Suscripción Realtime (`postgres_changes`) a `servicios`, `servicio_estado_eventos`, `pagos`,
  `perfiles_proveedor`, `usuarios`, `deudas_ugo_proveedor` y `disputas`, con debounce de 700 ms.
- Si el canal cae (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) se marca «Sincronización degradada», se reintenta con
  un canal nuevo y se activa sondeo cada 25 s mientras la pestaña está visible.
- `auth.realtime.setAuth(access_token)` después del login para que Realtime respete RLS.

## 5. Validación

- `npm run build` → typecheck (`tsc -b`, `strict` + `noUnusedLocals`) + build de Vite.
- `npm run smoke:admin` → monta el panel en jsdom con React 19 y `fetch` interceptado: recorre las 8 secciones,
  abre fichas laterales, abre el modal de conciliación Pix y el buscador de acciones, y falla si hay excepciones
  de runtime. Salida esperada:

```text
  ✓ overview  encabezado "Visión general" …
  ✓ services  encabezado "Servicios" · filas=3 …
  …
  Smoke test del panel admin: OK
```

## 6. Pendientes explícitos

- Aprobación/rechazo de legajos: el panel muestra estado y documentos, pero la transición se realiza por el flujo
  de legajo existente; no se inventa una RPC que el contrato no exponga.
- Edición de `config_sistema` y feature flags: sólo lectura (los valores sensibles se enmascaran).
- Superficies Super Admin/autonomía (`autonomous_*`): fuera de este alcance; el rediseño prioriza operación diaria.
- Mapas y seguimiento GPS: sin cambios respecto del flujo actual.
