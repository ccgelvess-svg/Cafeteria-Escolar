-- Reversión segura: solo antes de editar las ofertas iniciales o crear
-- movimientos y ventas nuevas.
-- Proporcionar en la misma sesión:
-- SET inventory_rollback.project_ref = 'safeabaodnkzoanvqdvp';
-- SET inventory_rollback.offline_queues_empty = 'confirmed';
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $guard$
BEGIN
  IF current_setting('inventory_rollback.project_ref', true)
       IS DISTINCT FROM 'safeabaodnkzoanvqdvp' OR
     current_setting('inventory_rollback.offline_queues_empty', true)
       IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'Falta confirmar producción o colas offline vacías';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cash_register_stock_movements) OR
     EXISTS (SELECT 1 FROM public.sales) OR
     EXISTS (SELECT 1 FROM public.sale_items) OR
     EXISTS (SELECT 1 FROM public.stock_movements) THEN
    RAISE EXCEPTION 'La reversión destruiría datos; abortando';
  END IF;
  IF (SELECT count(*) FROM public.cash_register_inventory) <> 104 OR
     EXISTS (SELECT 1 FROM public.cash_register_inventory inventory
       JOIN public.products product ON product.id = inventory.product_id
       WHERE inventory.stock_quantity <> 0
          OR inventory.category_id IS DISTINCT FROM product.category_id
          OR inventory.display_name IS DISTINCT FROM product.name
          OR inventory.subcategory IS DISTINCT FROM product.subcategory
          OR inventory.price IS DISTINCT FROM product.price
          OR inventory.cost IS DISTINCT FROM product.cost
          OR inventory.minimum_stock IS DISTINCT FROM product.minimum_stock
          OR inventory.active) OR
     EXISTS (SELECT 1 FROM public.products product
       WHERE (SELECT count(*) FROM public.cash_register_inventory inventory
              WHERE inventory.product_id = product.id
                AND inventory.cash_register_id IN (
                  '30000000-0000-4000-8000-000000000001'::uuid,
                  '30000000-0000-4000-8000-000000000002'::uuid)) <> 2) THEN
    RAISE EXCEPTION 'Las ofertas iniciales cambiaron; la reversión ya no es segura';
  END IF;
  IF to_regprocedure('public.record_cash_sale_global_legacy_20261106(uuid,bigint,jsonb,text,uuid)') IS NULL OR
     to_regprocedure('public.record_student_sale_global_legacy_20261106(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NULL OR
     to_regprocedure('public.void_sale_global_legacy_20261106(uuid,text,text)') IS NULL OR
     to_regprocedure('public.save_inventory_category_global_legacy_20261106(uuid,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Falta una función original respaldada';
  END IF;
END
$guard$;

DROP FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text,uuid);
DROP FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid);
DROP FUNCTION public.void_sale(uuid,text,text);
DROP FUNCTION public.save_inventory_category(uuid,text,text,boolean);
DROP FUNCTION public.save_cash_register_product(uuid,text,text,uuid,text,bigint,bigint,integer,text,boolean);
DROP FUNCTION public.record_cash_register_stock_movement(uuid,text,integer,text,text,text);
DROP FUNCTION public.list_cash_register_inventory(uuid);
DROP FUNCTION public.get_sales_report(timestamptz,uuid);
DROP FUNCTION public.get_cash_register_summaries();
DROP FUNCTION private.record_cash_register_sale_stock(uuid,uuid,jsonb,bigint);
DROP FUNCTION private.sale_items_match(uuid,jsonb);

DROP POLICY cash_register_inventory_select ON public.cash_register_inventory;
DROP POLICY cash_register_stock_movements_select ON public.cash_register_stock_movements;
DROP TABLE public.cash_register_stock_movements;
DROP TABLE public.cash_register_inventory;
DROP INDEX public.sales_id_cash_register_id_idx;
ALTER TABLE public.profiles DROP CONSTRAINT active_inventory_requires_register;

DROP POLICY registers_select_authorized ON public.cash_registers;
ALTER POLICY registers_select_authorized_legacy_20261106 ON public.cash_registers
  RENAME TO registers_select_authorized;
ALTER FUNCTION public.record_cash_sale_global_legacy_20261106(uuid,bigint,jsonb,text,uuid)
  RENAME TO record_cash_sale;
ALTER FUNCTION public.record_student_sale_global_legacy_20261106(uuid,uuid,bigint,jsonb,text,text,uuid)
  RENAME TO record_student_sale;
ALTER FUNCTION public.void_sale_global_legacy_20261106(uuid,text,text)
  RENAME TO void_sale;
ALTER FUNCTION public.save_inventory_category_global_legacy_20261106(uuid,text,text,boolean)
  RENAME TO save_inventory_category;

GRANT EXECUTE ON FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_inventory_category(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_inventory_product(text,text,uuid,text,bigint,bigint,integer,text,boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(text,integer,text,text,text) TO authenticated;
GRANT INSERT (id, name, price, active) ON public.products TO authenticated;
GRANT UPDATE (name, price, active, category_id, subcategory, cost, minimum_stock, sku)
  ON public.products TO authenticated;
GRANT SELECT ON public.products TO authenticated;

DO $postcheck$
BEGIN
  IF to_regclass('public.cash_register_inventory') IS NOT NULL OR
     to_regclass('public.cash_register_stock_movements') IS NOT NULL OR
     to_regprocedure('public.record_cash_sale(uuid,bigint,jsonb,text,uuid)') IS NULL OR
     NOT has_function_privilege('authenticated',
       'public.record_cash_sale(uuid,bigint,jsonb,text,uuid)', 'EXECUTE') OR
     (SELECT count(*) FROM public.products) <> 52 OR
     EXISTS (SELECT 1 FROM public.products WHERE stock_quantity <> 0) THEN
    RAISE EXCEPTION 'La reversión no restauró el estado previo';
  END IF;
END
$postcheck$;

COMMIT;
