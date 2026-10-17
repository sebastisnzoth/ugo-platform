# Nuevo diseño Cliente UGO

Referencia: `client-app-uxui-design (1).zip` suministrado por el propietario.

## Implementado
- Sidebar desktop, encabezado, hero, categorías, navegación móvil y diseño responsive inspirados en el ZIP.
- Pantallas Inicio, Explorar, Solicitud, Servicio, Actividad, Pagos y Perfil.
- Reutilización de `ClientProfile`, `ClientActivity` y `ClientSavedPlaces` ligados a Supabase UGO TEST.
- Creación de pedidos, pagos y búsqueda de proveedores: **bloqueados hasta integración real**. No utilizar datos ficticios del ZIP como reales.

## Pendiente
- Paridad visual pixel a pixel con ZIP original, incluyendo fotografías autorizadas e iconos.
- Contrato real de categorías y de creación de servicios, GPS, matching, pagos y chat.
- Pruebas E2E con clientes TEST, autorización y revisión RLS.

## Mejoras (2026-10-17)
- Wizard de "Nuevo servicio" navegable en 3 pasos (categoría → detalles → confirmación) con borrador local (localStorage), sin crear solicitudes ficticias.
- Inicio con datos reales: pedidos recientes, contadores (pedidos, direcciones, servicios en curso) y saludo por cuenta.
- Chips de estado por pedido, skeletons de carga, estados vacíos con CTA y transiciones de vista (respetando `prefers-reduced-motion`).
- Navegación completa: "Volver al sitio", acceso a perfil desde la barra lateral, "Ingresar" en la app sin sesión y CTA a la app desde la landing al iniciar sesión.

## Publicación
- No modificar producción ni el repositorio fuente `ugo-admin-panel`.
- Build/CI same-SHA, revisión de PR y despliegue por GitHub Actions.
