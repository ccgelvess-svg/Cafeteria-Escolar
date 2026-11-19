# Orden de instalación y pruebas en un proyecto Supabase temporal

Este procedimiento **no se ejecutó**. Requiere un proyecto Supabase nuevo,
vacío y separado del proyecto de producción. Se usa el contenido de
`.local-inventory-validation/`, generado desde las fuentes del proyecto. No
se enlaza el repositorio con el proyecto temporal ni se usan `db push`,
respaldos o credenciales de producción.

## Identidad y preparación

1. Abrir el SQL Editor **del proyecto temporal**. Copiar su `project ref` desde
   la URL y compararlo con el del proyecto de producción: deben ser distintos.
   Revisar también en la configuración de Data API que `private` no figure entre
   los esquemas expuestos. Repetir la comprobación del `project ref` antes de
   cada archivo que modifique el esquema.
2. Ejecutar `inventory_temp_project_preflight.sql`. Continuar solo si
   `app_schema_empty = true` y `no_production_reset_backup = true`. Registrar
   `postgres_version_num` y compararlo con PostgreSQL 17, configurado en
   `supabase/config.toml`. Si una condición falla, detenerse; no adaptar el
   procedimiento sobre una base con datos.
3. Verificar que los SHA-256 de los archivos coincidan con `manifest.json`.
   Los seis primeros archivos están en `supabase/migrations/` dentro de la
   copia aislada. Cinco son idénticos a los originales. El sexto conserva
   únicamente la parte operativa de la migración original y omite su guardia
   de respaldos privados, imposible de satisfacer en un proyecto nuevo.

## Orden exacto en SQL Editor

Ejecutar **un archivo completo por vez**, esperar éxito y comprobar que el
SQL Editor sigue mostrando el `project ref` temporal. Detenerse ante cualquier
error. No continuar con archivos posteriores para compensar un fallo.

| Paso | Archivo dentro de `.local-inventory-validation/` | Resultado esperado |
| --- | --- | --- |
| 1 | `inventory_temp_project_preflight.sql` | Base de la aplicación vacía; sin respaldo remoto. |
| 2 | `supabase/migrations/20261012183720_secure_auth_rls.sql` | Esquema, tipos, tablas, roles y RPC iniciales. |
| 3 | `supabase/migrations/20261013012343_inventory_module.sql` | Categorías, productos de demostración y RPC de inventario global anterior. |
| 4 | `supabase/migrations/20261013015438_simplify_cash_payment.sql` | Caja principal y venta en efectivo anterior. |
| 5 | `supabase/migrations/20261013060000_idempotent_student_reversal.sql` | Reverso estudiantil idempotente. |
| 6 | `supabase/migrations/20261104000000_add_cardenal_sancha_cash_register.sql` | Cardenal Sancha con ID `30000000-0000-4000-8000-000000000002`. |
| 7 | `supabase/migrations/20261104010000_select_cash_register_at_pos.sql` | Selección de caja; **solo copia aislada sin guardia de respaldos privados**. |
| 8 | `inventory_by_cash_register_local_apply.sql` | Dos tablas por caja, políticas y RPC nuevas. Este archivo hace `COMMIT` **solo en el temporal**. |
| 9 | `inventory_temp_project_postcheck.sql` | Dos cajas activas, cinco RPC presentes, `marker_rls_enabled`, `marker_has_no_policies` y `marker_api_roles_denied` en `true`, y conteos de prueba en cero. |
| 10 | `inventory_by_cash_register_rpc.sql` | Prueba con identidades ficticias; `BEGIN` y `ROLLBACK` final. Todas las aserciones deben terminar sin error. |
| 11 | `inventory_temp_project_postcheck.sql` | Los conteos de ofertas, movimientos, ventas, estudiantes y usuarios de prueba siguen en cero. |

La advertencia del SQL Editor sobre operaciones de esquema o ausencia temporal
de RLS solo es esperable en este proyecto temporal. El archivo del paso 8
habilita RLS y concede únicamente los accesos definidos para las tablas nuevas.
El marcador reside en `private`, con RLS habilitado y sin permisos de tabla
para `PUBLIC`, `anon`, `authenticated` ni `service_role`. Antes de crearlo,
el archivo rechaza una base que contenga los respaldos privados conocidos de
producción. Esta guardia complementa la comprobación manual del `project ref`;
no identifica por sí sola todos los proyectos de producción posibles.
No seleccionar `Run` si la URL visible pertenece a producción.

## Cobertura y criterio de aceptación

La prueba comprueba precios y existencias diferentes para un mismo producto
compartido, lectura por rol, rechazo de venta desde otra caja, rechazo de precio
incorrecto y sobreventa, venta en efectivo y a cuenta, reintentos idempotentes,
instantánea de precio, anulación local y reverso del saldo. Verifica que las
ventas nuevas no escriben el precio ni el stock global.

La prueba no demuestra concurrencia entre dos conexiones ni la conciliación de
stock real. Ambos puntos quedan pendientes antes de considerar una migración a
producción. Guardar el resultado de cada paso y el `project ref` temporal, sin
copiar nombres, documentos ni credenciales en el informe.
