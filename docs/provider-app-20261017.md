# App Proveedor (2026-10-17)

Nueva app de rol profesional en `src/ProviderExperience.tsx`, accesible con `?app=provider`.
Mismo sistema visual `uxugo` que la app cliente (`client-zip-design.css` + `provider-app.css`).

## Contratos reales conectados (UGO TEST)

Fuente: `ugo-admin-panel` (`src/mvp/provider/providerService.ts`, `docs/UGO_DATA_BACKEND_MASTER.md`).
Sin datos ficticios: todo se lee/escribe contra las tablas y RPCs canónicas.

- **Snapshot**: `perfiles_proveedor` (por `usuario_id`), RPC `obtener_ofertas_proveedor`,
  `servicios` (`proveedor_id`, joins `categorias`/`usuarios`), `pagos`, `deudas_ugo_proveedor`.
- **Disponibilidad**: Online = RPC GPS-gated `activar_disponibilidad_proveedor` (precisión ≤250 m);
  Offline = update propio `perfiles_proveedor.online/disponible`. Indicador de matching con GPS fresco (≤90 s).
- **Oportunidades**: `aceptar_oferta` / `rechazar_oferta` (asignación atómica, única).
- **Ciclo del servicio**: `avanzar_servicio` (`en_camino`, `en_progreso`, `esperando_aprobacion`),
  llegada = `publicar_ubicacion_proveedor` + `marcar_llegada_proveedor`, cancelación = `cancelar_servicio_proveedor` (con motivo).
- **Perfil profesional**: update `{bio, tarifa_base, ciudad_base, zona_radio_km}`; categorías vía RPC `guardar_categorias_proveedor` (lectura `categorias` + `usuarios.categorias_ids`).
- **Reglas de negocio respetadas**: bloqueo a las 3+ deudas UGO reales abiertas; el cobro en efectivo
  lo confirma el cliente (no el proveedor); estados del lifecycle canónico (`asignado → en_camino → llegado → en_progreso → esperando_aprobacion → completado`).

## Pantallas

Inicio (estado online/GPS, stats reales, servicio activo, oportunidades), Oportunidades,
Servicio (lifecycle + acciones + pago del servicio), Actividad (historial real),
Ingresos (liberado/retenido/efectivo/deuda UGO, pagos y comisiones), Perfil profesional (datos + categorías + verificación).

## Pendiente

- Onboarding/KYC completo (carga de documentos, cámara) — vive en `ugo-admin-panel`.
- Chat cliente↔proveedor, evidencias, disputas, mapa de tracking y radar de demanda (`obtener_demanda_proveedor`).
- Flujo PIX de pago de deuda UGO (`informar_pago_deuda_ugo`) — backend-driven.
- Foto de perfil (bucket `provider-public`) y Google Calendar.

## Acceso

- Login con rol `proveedor` (metadata `role`/`tipo`) redirige a `?app=provider`; el rol cliente va a `?app=client`.
- La landing muestra el botón de la app según el rol de la sesión.
