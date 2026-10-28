# Integración de autenticación

La aplicación niega el acceso por defecto hasta que exista un proveedor de identidad y un backend de sesiones. No se aceptan roles, usuarios ni tokens enviados por el frontend.

## Contrato requerido

- `GET /api/auth/session`: valida la cookie de sesión en el servidor. Responde `401` si no existe sesión o `{ authenticated: true, user, expiresAt }` con un rol permitido.
- `GET /api/auth/login?returnTo=...`: inicia OIDC/OAuth con estado, PKCE y una lista cerrada de destinos locales.
- `POST /api/auth/logout`: invalida la sesión en el servidor y expira la cookie.
- Las cookies deben usar el prefijo `__Host-`, y los atributos `Secure`, `HttpOnly`, `SameSite=Strict` y `Path=/`.
- El backend debe aplicar la misma matriz de permisos a cada consulta y mutación. Las guardas React solo controlan la experiencia visual.

## Roles

- `administrator`: administración, POS e inventarios.
- `cashier`: POS y operaciones limitadas a `cashRegisterId` asignado por el servidor.
- `inventory`: productos y existencias; sin acceso a estudiantes, saldos ni POS.

## Pendientes de servidor

1. Elegir y configurar un proveedor OIDC institucional.
2. Crear usuarios, asignaciones de caja y roles en una base central.
3. Implementar sesiones revocables, expiración, rotación y protección CSRF.
4. Mover estudiantes y movimientos desde IndexedDB a API autorizada; cifrar los datos locales que deban conservarse offline.
5. Registrar auditoría de accesos y operaciones, y sincronizar dispositivos.
