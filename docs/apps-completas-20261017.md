# Completado de apps Cliente y Proveedor (2026-10-17)

Se conectaron los contratos reales que estaban pendientes. Nuevas capas:
`src/serviceContracts.ts` (chat, evidencias, disputas, tracking — compartido),
`src/clientData.ts` (creación, pagos, aprobación, ratings),
ampliaciones en `src/providerData.ts` y componente `src/ServiceJobTools.tsx`.

## App Cliente — completado

- **Creación real de pedidos**: el wizard envía el pedido (`servicios` estado `buscando`) y ejecuta `iniciar_matching`. Categorías reales desde `categorias` (fallback visual si la tabla no responde).
- **Forma de pago**: `seleccionar_metodo_pago_servicio` (efectivo/pix/tarjeta) + `cash_payment_enabled`; lock respetado.
- **Servicio activo (job console)**: ciclo de vida completo, seguimiento GPS real (`obtener_tracking_servicio_cliente`), aprobación (`aprobar_servicio`), confirmación de efectivo (`confirmar_pago_efectivo_cliente`), cancelación temprana, calificación (`resenas`).
- **Chat del servicio** (`mensajes`, idempotencia por `clientMessageId`), **evidencias** (`evidencias_servicio` + bucket `service-evidence`) y **disputas** (`abrir_disputa_v2` con motivos reales de `reglas_motivos_disputa`).
- **Pagos**: listado real de `pagos` del cliente con estados del contrato.

## App Proveedor — completado

- **Onboarding/KYC**: alta de perfil (`perfiles_proveedor` estado `registrado`), carga de documentos a bucket `provider-kyc` + `documentos`, foto de perfil (`provider-public` + `foto_perfil_path`/`usuarios.foto_url`) y envío a revisión (`registrado`/`rechazado` → `pendiente`, con aceptación de términos).
- **Radar de demanda** (`obtener_demanda_proveedor`) en Inicio.
- **Chat, evidencias y disputas** sobre el servicio activo (mismo `ServiceJobTools`).
- **Deuda UGO**: acción "Informar pago" (`informar_pago_deuda_ugo`) con referencia del comprobante.
- **Agenda**: `programado_para` visible en el servicio activo.

## Reglas de negocio respetadas

- Efectivo: el cobro lo confirma el cliente (`confirmar_pago_efectivo_cliente`); el proveedor solo marca TRABAJO LISTO.
- Matching exige GPS fresco ≤90 s y precisión ≤250 m para operar Online.
- Disputas con motivos oficiales, evidencias y resolución auditada.
- Sin datos ficticios: todos los listados provienen de UGO TEST.

## Queda pendiente (requiere backend/externo)

- Generación PIX de deuda UGO (endpoint backend `?ugo_debt=1`) — solo informe manual.
- Google Calendar (OAuth server-side), push notifications, realtime de las pantallas.
- Mapa visual de tracking (hoy: coordenadas + frescura), OCR de KYC, workers autónomos.
