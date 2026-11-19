-- Solo lectura. Ejecutar exclusivamente en el SQL Editor del proyecto temporal vacío.
-- El identificador del proyecto se verifica visualmente en la URL de Supabase.
SELECT
  current_database() AS database_name,
  current_user AS executing_role,
  inet_server_addr()::text AS server_address,
  current_setting('server_version_num')::integer AS postgres_version_num,
  to_regclass('public.cash_registers') IS NULL
    AND to_regclass('public.products') IS NULL
    AND to_regclass('public.students') IS NULL
    AND to_regclass('public.sales') IS NULL
    AND to_regclass('public.stock_movements') IS NULL
    AND to_regclass('public.cash_register_inventory') IS NULL AS app_schema_empty,
  to_regclass('private.reset_20261104_sales') IS NULL AS no_production_reset_backup;
