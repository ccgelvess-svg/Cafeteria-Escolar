-- Prueba para la COPIA LOCAL generada por prepare_inventory_rpc_sandbox.mjs.
-- Usa únicamente identidades ficticias. La transacción siempre termina en ROLLBACK.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF to_regclass('private.inventory_validation_marker') IS NULL THEN
    RAISE EXCEPTION 'Este script solo se ejecuta en el entorno aislado generado';
  END IF;
  IF (SELECT count(*) FROM private.inventory_validation_marker) <> 1 THEN
    RAISE EXCEPTION 'Marcador del entorno aislado inválido';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'private.inventory_validation_marker'::regclass) OR
     EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'private'
             AND tablename = 'inventory_validation_marker') OR
     has_table_privilege('anon', 'private.inventory_validation_marker',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR
     has_table_privilege('authenticated', 'private.inventory_validation_marker',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR
     has_table_privilege('service_role', 'private.inventory_validation_marker',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
    RAISE EXCEPTION 'El marcador de validación no está aislado';
  END IF;
  IF (SELECT count(*) FROM public.cash_registers WHERE active AND id IN (
    '30000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000002'::uuid
  )) <> 2 THEN RAISE EXCEPTION 'Faltan las dos cajas de prueba'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = 'agua-bolsa') THEN
    RAISE EXCEPTION 'Falta el producto de prueba local';
  END IF;
END
$guard$;

CREATE TEMP TABLE inventory_test_baseline AS
SELECT id, price, stock_quantity FROM public.products WHERE id = 'agua-bolsa';
GRANT SELECT ON inventory_test_baseline TO authenticated;
-- Solo durante esta transacción: permite comparar las columnas globales no sensibles.
-- No concede acceso al costo y el ROLLBACK final revierte estos permisos.
GRANT SELECT (price, stock_quantity) ON public.products TO authenticated;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
VALUES
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'local-admin@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'local-cashier@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'local-inventory@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.profiles (user_id, display_name, role, cash_register_id, active)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Administrador local', 'administrator', NULL, true),
  ('a0000000-0000-4000-8000-000000000002', 'Cajero local', 'cashier',
   '30000000-0000-4000-8000-000000000001', true),
  ('a0000000-0000-4000-8000-000000000003', 'Inventario local', 'inventory',
   '30000000-0000-4000-8000-000000000001', true);

INSERT INTO public.students (id, code, first_name, last_name, grade, group_name,
                             net_balance, created_by)
VALUES ('c0000000-0000-4000-8000-000000000001', 'LOCAL-TEST-001', 'Prueba',
        'Aislada', '0', 'A', 5000, 'a0000000-0000-4000-8000-000000000001');

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;

-- Mismo product_id: precio y existencias independientes. Ningún dato global se copia.
SELECT public.save_cash_register_product(
  '30000000-0000-4000-8000-000000000001', 'agua-bolsa', 'Agua principal',
  (SELECT category_id FROM public.products WHERE id = 'agua-bolsa'),
  'Agua', 800, 300, 2, NULL, false);
SELECT public.save_cash_register_product(
  '30000000-0000-4000-8000-000000000002', 'agua-bolsa', 'Agua Cardenal',
  (SELECT category_id FROM public.products WHERE id = 'agua-bolsa'),
  'Agua', 1200, 400, 2, NULL, false);
SELECT public.record_cash_register_stock_movement(
  '30000000-0000-4000-8000-000000000001', 'agua-bolsa', 5,
  'opening', 'Conteo local principal', 'local:opening:principal');
SELECT public.record_cash_register_stock_movement(
  '30000000-0000-4000-8000-000000000002', 'agua-bolsa', 7,
  'opening', 'Conteo local Cardenal', 'local:opening:cardenal');
SELECT public.save_cash_register_product(
  '30000000-0000-4000-8000-000000000001', 'agua-bolsa', 'Agua principal',
  (SELECT category_id FROM public.products WHERE id = 'agua-bolsa'),
  'Agua', 800, 300, 2, NULL, true);
SELECT public.save_cash_register_product(
  '30000000-0000-4000-8000-000000000002', 'agua-bolsa', 'Agua Cardenal',
  (SELECT category_id FROM public.products WHERE id = 'agua-bolsa'),
  'Agua', 1200, 400, 2, NULL, true);

DO $offers$
BEGIN
  IF (SELECT count(*) FROM public.cash_register_inventory WHERE product_id = 'agua-bolsa') <> 2 OR
     (SELECT price FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000001' AND product_id = 'agua-bolsa') <> 800 OR
     (SELECT price FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000002' AND product_id = 'agua-bolsa') <> 1200 THEN
    RAISE EXCEPTION 'Precios por caja incorrectos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products p JOIN inventory_test_baseline b USING (id)
             WHERE p.price <> b.price OR p.stock_quantity <> b.stock_quantity) THEN
    RAISE EXCEPTION 'La preparación modificó precio o stock global';
  END IF;
END
$offers$;

-- Inventario y cajero solo pueden consultar su caja asignada.
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000003', true);
DO $inventory_role$
DECLARE v_rejected boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.cash_register_inventory WHERE product_id = 'agua-bolsa') <> 1 OR
     (SELECT count(*) FROM public.list_cash_register_inventory(
       '30000000-0000-4000-8000-000000000001')) <> 52 OR
     (SELECT cost FROM public.list_cash_register_inventory(
       '30000000-0000-4000-8000-000000000001') WHERE product_id = 'agua-bolsa') <> 300 THEN
    RAISE EXCEPTION 'Inventario no quedó limitado a su caja con acceso a costos';
  END IF;
  BEGIN
    PERFORM * FROM public.list_cash_register_inventory(
      '30000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'cash register not assigned to inventory user' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Inventario pudo consultar costos de otra caja';
  END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.save_inventory_category(
      (SELECT category_id FROM public.products WHERE id = 'agua-bolsa'),
      'Categoría ajena', 'categoria-ajena', true);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'operation not authorized' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Inventario pudo modificar el catálogo general'; END IF;
END
$inventory_role$;

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000002', true);
DO $cashier_role$
DECLARE v_rejected boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.cash_register_inventory WHERE product_id = 'agua-bolsa') <> 1 THEN
    RAISE EXCEPTION 'El cajero ve inventario de otra caja';
  END IF;
  BEGIN
    PERFORM cost FROM public.cash_register_inventory WHERE product_id = 'agua-bolsa';
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'El cajero pudo consultar costos de compra'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.record_cash_sale(
      'd0000000-0000-4000-8000-000000000010', 1200,
      '[{"productId":"agua-bolsa","unitPrice":1200,"quantity":1}]'::jsonb,
      'local:cross-box', '30000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'cash register not assigned to cashier' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Venta en otra caja no fue bloqueada'; END IF;
  v_rejected := false;
  BEGIN
    UPDATE public.products SET price = 1 WHERE id = 'agua-bolsa';
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'El cajero pudo escribir el precio global'; END IF;
END
$cashier_role$;

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
DO $sales$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.record_cash_sale(
      'd0000000-0000-4000-8000-000000000011', 1,
      '[{"productId":"agua-bolsa","unitPrice":1,"quantity":1}]'::jsonb,
      'local:wrong-price', '30000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'cash register price changed' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Precio ajeno no fue rechazado'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.record_cash_sale(
      'd0000000-0000-4000-8000-000000000012', 1198800,
      '[{"productId":"agua-bolsa","unitPrice":1200,"quantity":999}]'::jsonb,
      'local:oversell', '30000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'insufficient cash register stock' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Venta sin existencias no fue rechazada'; END IF;
  v_rejected := false;

  PERFORM public.record_cash_sale(
    'd0000000-0000-4000-8000-000000000001', 1600,
    '[{"productId":"agua-bolsa","unitPrice":800,"quantity":2}]'::jsonb,
    'local:principal:sale', '30000000-0000-4000-8000-000000000001');
  BEGIN
    PERFORM public.record_cash_sale(
      'd0000000-0000-4000-8000-000000000001', 1600,
      '[{"productId":"agua-bolsa","unitPrice":1600,"quantity":1}]'::jsonb,
      'local:principal:sale', '30000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'idempotency key reused for another sale' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Idempotencia aceptó artículos diferentes'; END IF;
  v_rejected := false;
  PERFORM public.record_cash_sale(
    'd0000000-0000-4000-8000-000000000001', 1600,
    '[{"productId":"agua-bolsa","unitPrice":800,"quantity":2}]'::jsonb,
    'local:principal:sale', '30000000-0000-4000-8000-000000000001');
  PERFORM public.record_cash_sale(
    'd0000000-0000-4000-8000-000000000002', 1200,
    '[{"productId":"agua-bolsa","unitPrice":1200,"quantity":1}]'::jsonb,
    'local:cardenal:sale', '30000000-0000-4000-8000-000000000002');
  PERFORM public.record_student_sale(
    'd0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001', 1200,
    '[{"productId":"agua-bolsa","unitPrice":1200,"quantity":1}]'::jsonb,
    'local-device', 'local:cardenal:student', '30000000-0000-4000-8000-000000000002');

  IF (SELECT stock_quantity FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000001' AND product_id = 'agua-bolsa') <> 3 OR
     (SELECT stock_quantity FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000002' AND product_id = 'agua-bolsa') <> 5 OR
     (SELECT net_balance FROM public.students WHERE id =
       'c0000000-0000-4000-8000-000000000001') <> 3800 THEN
    RAISE EXCEPTION 'Venta o consumo descontó el ámbito incorrecto';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sales WHERE id IN (
      'd0000000-0000-4000-8000-000000000011',
      'd0000000-0000-4000-8000-000000000012')) OR
     (SELECT count(*) FROM public.sales WHERE id IN (
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000002',
      'd0000000-0000-4000-8000-000000000003')) <> 3 THEN
    RAISE EXCEPTION 'Venta rechazada persistió o reintento duplicó una venta';
  END IF;
  IF (SELECT count(*) FROM public.cash_register_stock_movements
      WHERE movement_type = 'sale') <> 3 OR
     (SELECT count(*) FROM public.stock_movements WHERE source_sale_id IN (
       'd0000000-0000-4000-8000-000000000001',
       'd0000000-0000-4000-8000-000000000002',
       'd0000000-0000-4000-8000-000000000003')) <> 0 THEN
    RAISE EXCEPTION 'Movimientos de venta en ámbito incorrecto';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products p JOIN inventory_test_baseline b USING (id)
             WHERE p.price <> b.price OR p.stock_quantity <> b.stock_quantity) THEN
    RAISE EXCEPTION 'Una venta local modificó precio o stock global';
  END IF;
  IF (SELECT unit_price FROM public.sale_items WHERE sale_id =
       'd0000000-0000-4000-8000-000000000002') <> 1200 THEN
    RAISE EXCEPTION 'La venta no conservó el precio de Cardenal';
  END IF;
END
$sales$;

SELECT public.void_sale('d0000000-0000-4000-8000-000000000001',
                        'Reverso local principal', 'local-device');
SELECT public.void_sale('d0000000-0000-4000-8000-000000000001',
                        'Reverso local principal', 'local-device');
SELECT public.void_sale('d0000000-0000-4000-8000-000000000003',
                        'Reverso local estudiante', 'local-device');

DO $final$
BEGIN
  IF (SELECT stock_quantity FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000001' AND product_id = 'agua-bolsa') <> 5 OR
     (SELECT stock_quantity FROM public.cash_register_inventory WHERE cash_register_id =
       '30000000-0000-4000-8000-000000000002' AND product_id = 'agua-bolsa') <> 6 OR
     (SELECT net_balance FROM public.students WHERE id =
       'c0000000-0000-4000-8000-000000000001') <> 5000 THEN
    RAISE EXCEPTION 'Anulación alteró la caja o el saldo equivocados';
  END IF;
  IF (SELECT count(*) FROM public.cash_register_stock_movements
      WHERE movement_type = 'sale_reversal') <> 2 THEN
    RAISE EXCEPTION 'Reversos no son idempotentes';
  END IF;
  IF (public.get_sales_report('2000-01-01'::timestamptz,
      '30000000-0000-4000-8000-000000000002')->>'totalAmount')::bigint <> 1200 OR
     (public.get_sales_report('2000-01-01'::timestamptz,
      '30000000-0000-4000-8000-000000000002')->>'completedSales')::bigint <> 1 OR
     (SELECT cash_total FROM public.get_cash_register_summaries()
      WHERE id = '30000000-0000-4000-8000-000000000002') <> 1200 THEN
    RAISE EXCEPTION 'Reportes por caja incorrectos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products p JOIN inventory_test_baseline b USING (id)
             WHERE p.price <> b.price OR p.stock_quantity <> b.stock_quantity) THEN
    RAISE EXCEPTION 'La anulación modificó el inventario global';
  END IF;
END
$final$;

ROLLBACK;
