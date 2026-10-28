# Supabase: configuración segura

## Variables locales y de Vercel

Configurar únicamente estas variables públicas:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No crear variables `VITE_*` con una `service_role`, secret key, contraseña de base de datos o token personal.

## Aplicación de la migración

La migración `supabase/migrations/20261012183720_secure_auth_rls.sql` crea perfiles, cajas, estudiantes, movimientos, ventas, productos y existencias. Todas las tablas expuestas tienen RLS, permisos explícitos y acceso anónimo revocado.

La primera asignación de administrador debe hacerse desde un canal de administración de Supabase, vinculando un usuario real de `auth.users` con `public.profiles`. La aplicación no crea usuarios ni asigna roles por defecto.

Ejemplo de estructura requerida, reemplazando los valores por un usuario ya existente:

```sql
insert into public.profiles (user_id, display_name, role)
select id, '<nombre real>', 'administrator'
from auth.users
where email = '<correo real>';
```

Para un cajero, crear primero una fila en `cash_registers` y asignar su `id` en `profiles.cash_register_id`.

## Verificación obligatoria antes de publicar

1. Aplicar la migración en el proyecto confirmado.
2. Ejecutar los asesores de seguridad y rendimiento.
3. Verificar con usuarios reales que Administrador vea todo; Cajero solo POS, estudiantes necesarios y su caja; Inventarios solo productos y existencias.
4. Confirmar que `anon` no puede leer ninguna tabla y que un usuario sin perfil queda bloqueado.
5. Configurar las dos variables públicas en Vercel y volver a ejecutar build.
