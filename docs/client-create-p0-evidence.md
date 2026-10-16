# Evidencia P0 — contrato de creación y despacho Cliente (2026-10-15)

**Entorno verificado:** Supabase UGO TEST `tmossnqfwfwjrtzwcbmm` (`UGO Arena`, `ACTIVE_HEALTHY`). No se ejecutaron escrituras directas en la base de datos durante esta auditoría.

## Contrato de referencia comprobado en ugo-admin-panel
- `src/features/client/request/ClientPostConfirmFlow.tsx`: `servicios.insert` con `cliente_id`, `categoria_id`, `estado='buscando'`, `descripcion`, `direccion_cliente`, `programado_para`, `metadata.request_draft_id`, forma de pago, y recuperación de la fila filtrando `metadata->>request_draft_id`.
- `supabase/migrations/20260915045500_client_request_draft_idempotency.sql`: índice único `servicios_cliente_request_draft_uidx` por `(cliente_id,metadata->>'request_draft_id')`.
- `src/features/client/request/ClientRequestEvidence.tsx`: bucket `request-evidence` + `evidencias_solicitud` ligadas por `draft_id`.
- `supabase/migrations/20260930222500_payment_before_dispatch_guard.sql`: matching requiere método `efectivo` o `pix`.

## Consultas read-only a la base TEST
- Índice `servicios_cliente_request_draft_uidx`: **existe**, verificado en `pg_indexes`.
- Política `servicios_insert`: presente para `authenticated`, exige propietario autenticado, `proveedor_id IS NULL`, estado permitido, comisiones nulas, y condiciones de ambiente/metadata; verificado en `pg_policies`.
- Columnas de creación: `cliente_id,categoria_id,estado,descripcion,urgencia,direccion_cliente,programado_para,tarifa,metadata` confirmadas en `information_schema.columns`.
- RPC `guardar_ubicacion_servicio_cliente(p_servicio_id uuid,p_lat double precision,p_lng double precision)`: existe y `authenticated` tiene EXECUTE.
- RPC `iniciar_matching(p_servicio_id uuid)`: existe y `authenticated` tiene EXECUTE.
- Bucket `request-evidence`: existe, `public=false`.

## Implementación PR #9
- `src/exact/clientOrderService.ts`: `recoverOrNewDraftId`, recuperación de pedido por borrador, insert canónico, recuperación tras timeout/error (índice único arbitra simultáneos), subida a bucket privado y creación de filas de evidencia ligadas al borrador.
- `src/exact/ClientRequestForm.tsx`: confirma pedido con autenticación real, estado visible y errores. Después ofrece **paso explícito** para comenzar búsqueda con GPS y llamar secuencialmente a la RPC de ubicación y `iniciar_matching`.
- Matching no se ejecuta si no hay GPS reciente y válido. Nunca avanzar visualmente a “asignado” sin respuesta confirmada.
- `sessionStorage` almacena el UUID del borrador hasta confirmar persistencia; no se borra con errores de red. El índice en DB proporciona la garantía definitiva contra duplicación de servicios del mismo borrador.

## Lo que no se ha verificado
- **Runtime Cliente → Proveedor** con cuentas reales TEST y proveedor online: NO ejecutado. Requiere credenciales de cuentas de prueba, GPS de cliente en browser y una categoría común con proveedor activo; comprobar fila `ofertas_servicio`, recepción en Proveedor, aceptación y cambio de estado.
- **Upload real de fotografías** autenticado: no probado con Storage/RLS.
- **RLS bajo un JWT concreto de Cliente**: política inspeccionada, pero todavía sin prueba de permiso efectiva.
- **Visual E2E** de los componentes originales: pendiente.
- **Pricing/PIX**: selección de forma de pago no supone integración con procesador, cobro ni validación de prepago.

No presentar `CI success` como evidencia de recepción de oferta por el proveedor. No hacer merge/deploy sin autorización.
