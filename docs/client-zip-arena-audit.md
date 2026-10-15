# Auditoría UGO Cliente — ZIP original vs Arena y app publicada

Fecha: 2026-10-15.

## Fuentes comprobadas
- ZIP del propietario: `client-app-uxui-design (1).zip` contiene `src/components/ugo-client.tsx` (28.487 bytes) y `src/app/globals.css` (37.154 bytes), usando Next.js y `lucide-react`. **Debe ser la autoridad visual**.
- Adaptación local previa: `ugo-cliente-zip-exacto-vite.zip`, con `src/UgoClient.tsx` y `src/ugo-original.css`; no verificada en GitHub.
- Rama Arena: [sebastianzothoficial-cell/ugo-platform, arena/25d44ee4-ugo-platform](https://github.com/sebastianzothoficial-cell/ugo-platform/tree/arena%2F25d44ee4-ugo-platform), React/Vite con `src/App.tsx` de ~102 KB, MapLibre, idiomas, PWA y consultas Supabase. **No es el componente original del ZIP**.
- Destino: `sebastisnzoth/ugo-platform` main `bd47e8879c9f1b361c37e5ce518d4a797f04d917` al iniciar la auditoría. Tiene `src/ClientExperience.tsx` y `src/client-zip-design.css`, que son una adaptación visual, **no una copia del ZIP**.

## Decisión
1. Priorizar importar íntegros el JSX y CSS del ZIP en una PR dedicada, sin reescribirlos a mano. El ZIP está disponible en el diálogo de ChatGPT, pero **no estaba incorporado al árbol GitHub** al momento de esta PR.
2. Separar vistas puramente visuales del ZIP de los servicios reales. Prohibir los profesionales falsos y sus tarifas/ETA, datos de chat, pagos y notificaciones simuladas como si fueran runtime.
3. Reutilizar contratos existentes de UGO TEST y, de la rama Arena, los patrones de roles canónicos, navegación y lectura real que superen auditoría, sin importar la aplicación completa de la otra cuenta.
4. No mezclar claves `service_role` ni publicar secretos en Pages. No introducir escrituras en producción.

## Contrato concreto conectado en esta PR
Categorías de `categorias` (`id,nombre,emoji,slug`) obtenidas mediante cliente público Supabase existente, sin datos de demostración. Error explícito, carga y catálogo vacío. UI muestra `nombre` y `emoji` reales. Sin persistir pedidos ni matching.

## Estado
- Auditoría estructura ZIP/Arena/main: VERIFIED (código inspeccionado).
- Reemplazo del catálogo inventado: IMPLEMENTED / requiere CI same-SHA y prueba runtime con usuario TEST.
- Copia 1:1 de los componentes visuales originales: PENDING.
- Solicitud E2E y roles/RLS: PENDING.
- Publicación del rediseño exacto: PENDING.

## Próxima intervención requerida
Importar `src/components/ugo-client.tsx` y `src/app/globals.css` del ZIP real; conservar jerarquía HTML y clases, adaptar solo imports y contratos. Correr build Vite y comparación visual 390×844 y 1440×900 contra ZIP antes de pedir merge.
