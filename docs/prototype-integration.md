# Integración del prototipo visual UGO

Fuente de diseño: archivo entregado por el propietario `ugo-flow-design-prototype (2).zip` (React/Vite/Tailwind 4).

## Auditoría del archivo original
- Componentes: `src/components/PhoneFrame.tsx`, `src/flow/ui.tsx`.
- Pantallas: `src/flow/screens/cliente.tsx`, `proveedor.tsx`, `admin.tsx`.
- Navegación: `src/flow/screens/index.ts` con flujos separados para tres roles.
- Temas: `src/index.css` con tokens claro/oscuro.
- `src/App.tsx` declara expresamente «Prototipo de diseño · sin servicios reales».
- No contiene cliente Supabase ni reemplaza backend real; no se pueden publicar operaciones ficticias como reales.

## Etapa 1: puente visual seguro
- Aplicar colores/tokens y mejoras responsive del prototipo sobre la landing actual.
- Mantener autenticación Supabase existente y GitHub Pages tal como están.
- Evitar copiar un login simulado, historiales de prueba o controles sin lógica.
- Publicación únicamente después de revisión de PR y aprobación.

## Siguientes etapas (NO incluidas en este PR)
1. Migrar componentes visuales y navegación Cliente manteniendo sesión y permisos reales.
2. Revisar contratos de UGO TEST y conexión de perfil + categorías; no inventar RPC.
3. Integrar flujo Proveedor y validación administrativa, con pruebas RLS.
4. Integrar Admin, pagos, GPS, Hugo por voz y E2E TEST.
5. Pruebas accesibilidad, móvil, seguridad y revisión visual contra el ZIP.

No modificar `ugo-admin-panel`, políticas RLS, producción, ni emitir confirmaciones de pedidos desde el prototipo.
