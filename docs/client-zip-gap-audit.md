# Auditoría funcional — UGO Cliente ZIP exacto

Fecha: 2026-10-15. Basada en `client-app-uxui-design (1).zip`, `ugo-cliente-diseno-captura-ugo-test(1).zip`, la captura del propietario y el PR #9.

## Hallazgos y riesgos confirmados
- **P0 — Solicitud:** en la importación inicial, el formulario no retenía `descripcion`, `direccion` ni archivos; mostraba “fuga debajo del fregadero”, “Rua Madre Maria Vilac 123” y un presupuesto R$120–180 prefijados. El botón final estaba deshabilitado. Se reemplazó la pantalla activa por `ClientRequestForm`: selección de categorías reales vía `categorias`, controles con estado, validaciones y resumen sin datos ficticios. **Persistencia de pedido y subida Storage: PENDING**.
- **P0 — Acciones falsas:** el ZIP original contiene tres profesionales, ETA, precio, ubicación de mapa y reseñas ficticias; vista `ExploreView` quedó fuera del router activo de la primera adaptación, por lo que **aún no está conectada a datos reales**.
- **P0 — Seguimiento:** la pestaña Servicio muestra el historial (como Actividad), no un seguimiento en vivo con estado/proveedor/GPS. **PENDING**.
- **P1 — Encabezado:** saludo genérico, ubicación sin lectura de `direcciones_cliente`, campana con aviso de integración pendiente. **PENDING**.
- **P1 — Chat y notificaciones:** el JSX original incluye modales de demostración, no conectados al router activo. **PENDING**.
- **P1 — Pagos:** pantalla temporal informativa; la vista heredada de transacciones simuladas se conserva como fuente original pero está inactiva. **PENDING**.
- **P1 — Perfil/Actividad:** componentes reales existentes consultan UGO TEST, pero faltan E2E/RLS con cuentas concretas. **UNVERIFIED runtime**.
- **P1 — Móvil:** conservar y verificar diseño del ZIP con capturas en 390×844, 768×1024 y 1440×900. **UNVERIFIED visual**.
- **P2 — Hugo:** no se incorporó orbe/acciones conversacionales reales. **PENDING**.

## Política de aceptación
No publicar reseñas, profesionales, pagos, precios ni tiempos inventados como si fueran en vivo. No habilitar “Buscar profesional” hasta verificar creación real en `servicios`, categoría, dirección, autorizaciones y flujo proveedor. Descartar cambios de estado si falla la operación.

## Pruebas
El script `scripts/materialize-client-design.mjs` comprueba SHA256 del JSX y CSS originales **antes** de sustituir únicamente el componente de solicitud por su versión conectada. CI build verifica compilación, pero no E2E.
