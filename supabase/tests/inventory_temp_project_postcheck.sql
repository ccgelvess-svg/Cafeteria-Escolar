-- Solo lectura. Debe ejecutarse después de la prueba con ROLLBACK.
-- La prueba revierte sus datos; permanecen únicamente las 104 ofertas inactivas de la migración formal.
SELECT
  (SELECT count(*) FROM public.cash_register_inventory) AS scoped_offers_expected_104,
  (SELECT count(*) FROM public.cash_register_stock_movements) AS scoped_movements,
  (SELECT count(*) FROM public.sales WHERE idempotency_key LIKE 'local:%') AS test_sales,
  (SELECT count(*) FROM public.students WHERE id =
    'c0000000-0000-4000-8000-000000000001'::uuid) AS test_students,
  (SELECT count(*) FROM auth.users WHERE id IN (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000003'::uuid)) AS test_users,
  (SELECT count(*) FROM public.cash_registers WHERE active AND id IN (
    '30000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000002'::uuid)) AS active_registers,
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'private.inventory_validation_marker'::regclass) AS marker_rls_enabled,
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'private'
    AND tablename = 'inventory_validation_marker') AS marker_has_no_policies,
  NOT has_table_privilege('anon', 'private.inventory_validation_marker',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    AND NOT has_table_privilege('authenticated', 'private.inventory_validation_marker',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    AND NOT has_table_privilege('service_role', 'private.inventory_validation_marker',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
    AS marker_api_roles_denied,
  to_regprocedure('public.save_cash_register_product(uuid,text,text,uuid,text,bigint,bigint,integer,text,boolean)') IS NOT NULL AS save_rpc_present,
  to_regprocedure('public.record_cash_register_stock_movement(uuid,text,integer,text,text,text)') IS NOT NULL AS stock_rpc_present,
  to_regprocedure('public.list_cash_register_inventory(uuid)') IS NOT NULL AS inventory_read_rpc_present,
  to_regprocedure('public.get_sales_report(timestamp with time zone,uuid)') IS NOT NULL AS report_rpc_present,
  to_regprocedure('public.get_cash_register_summaries()') IS NOT NULL AS register_summary_rpc_present,
  NOT has_column_privilege('authenticated', 'public.cash_register_inventory', 'cost', 'SELECT') AS cashier_cost_column_protected,
  NOT has_column_privilege('authenticated', 'public.products', 'cost', 'SELECT') AS legacy_cost_column_protected,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass
    AND conname = 'active_inventory_requires_register') AS inventory_assignment_guard_present,
  to_regprocedure('public.record_cash_sale(uuid,bigint,jsonb,text,uuid)') IS NOT NULL AS cash_sale_rpc_present,
  to_regprocedure('public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NOT NULL AS student_sale_rpc_present,
  to_regprocedure('public.void_sale(uuid,text,text)') IS NOT NULL AS void_rpc_present;
