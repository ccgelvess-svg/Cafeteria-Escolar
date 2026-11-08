BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.cash_register_inventory') IS NOT NULL OR
     to_regclass('public.cash_register_stock_movements') IS NOT NULL THEN
    RAISE EXCEPTION 'El inventario por caja ya existe';
  END IF;
  IF (SELECT count(*) FROM public.products) <> 52 OR
     EXISTS (SELECT 1 FROM public.products WHERE stock_quantity <> 0) OR
     EXISTS (SELECT 1 FROM public.sales) OR
     EXISTS (SELECT 1 FROM public.sale_items) OR
     EXISTS (SELECT 1 FROM public.stock_movements) THEN
    RAISE EXCEPTION 'Producción no coincide con el estado limpio confirmado';
  END IF;
  IF (SELECT count(*) FROM public.cash_registers WHERE active AND
      ((id = '30000000-0000-4000-8000-000000000001'::uuid AND name = 'Caja principal') OR
       (id = '30000000-0000-4000-8000-000000000002'::uuid AND name = 'Cardenal Sancha'))) <> 2 THEN
    RAISE EXCEPTION 'Las dos cajas activas no coinciden';
  END IF;
  IF to_regprocedure('private.current_app_role()') IS NULL OR
     to_regprocedure('private.current_cash_register_id()') IS NULL OR
     to_regprocedure('public.save_inventory_category(uuid,text,text,boolean)') IS NULL OR
     to_regprocedure('public.record_student_movement(uuid,public.student_movement_type,bigint,text,text,text)') IS NULL OR
     to_regprocedure('public.reverse_student_movement(uuid,uuid,text)') IS NULL OR
     to_regprocedure('public.record_cash_sale(uuid,bigint,jsonb,text,uuid)') IS NULL OR
     to_regprocedure('public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NULL OR
     to_regprocedure('public.void_sale(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Falta una dependencia funcional';
  END IF;
  IF to_regprocedure('public.record_cash_sale_global_legacy_20261106(uuid,bigint,jsonb,text,uuid)') IS NOT NULL OR
     to_regprocedure('public.record_student_sale_global_legacy_20261106(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NOT NULL OR
     to_regprocedure('public.void_sale_global_legacy_20261106(uuid,text,text)') IS NOT NULL OR
     to_regprocedure('public.save_inventory_category_global_legacy_20261106(uuid,text,text,boolean)') IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe un respaldo funcional de esta migración';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'cash_registers' AND policyname = 'registers_select_authorized') <> 1 THEN
    RAISE EXCEPTION 'La política actual de cajas no coincide';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles profile
      WHERE profile.active AND profile.role = 'inventory' AND
        (profile.cash_register_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.cash_registers register
          WHERE register.id = profile.cash_register_id AND register.active))) THEN
    RAISE EXCEPTION 'Todo usuario activo de inventarios debe tener una caja activa asignada';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.profiles'::regclass
        AND conname = 'active_inventory_requires_register') THEN
    RAISE EXCEPTION 'La restricción de inventarios ya existe';
  END IF;
END
$preflight$;

ALTER POLICY registers_select_authorized ON public.cash_registers
  RENAME TO registers_select_authorized_legacy_20261106;
ALTER FUNCTION public.save_inventory_category(uuid,text,text,boolean)
  RENAME TO save_inventory_category_global_legacy_20261106;
ALTER FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text,uuid)
  RENAME TO record_cash_sale_global_legacy_20261106;
ALTER FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid)
  RENAME TO record_student_sale_global_legacy_20261106;
ALTER FUNCTION public.void_sale(uuid,text,text)
  RENAME TO void_sale_global_legacy_20261106;

REVOKE ALL ON FUNCTION public.record_cash_sale_global_legacy_20261106(uuid,bigint,jsonb,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_student_sale_global_legacy_20261106(uuid,uuid,bigint,jsonb,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.void_sale_global_legacy_20261106(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_inventory_category_global_legacy_20261106(uuid,text,text,boolean)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.cash_register_inventory (
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  display_name text CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 150),
  subcategory text NOT NULL DEFAULT 'General' CHECK (length(trim(subcategory)) BETWEEN 1 AND 80),
  price bigint NOT NULL CHECK (price >= 0),
  cost bigint NOT NULL DEFAULT 0 CHECK (cost >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock integer NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cash_register_id, product_id)
);
CREATE INDEX cash_register_inventory_active_idx
  ON public.cash_register_inventory(cash_register_id, active, category_id);

CREATE UNIQUE INDEX sales_id_cash_register_id_idx ON public.sales(id, cash_register_id);
CREATE TABLE public.cash_register_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL,
  product_id text NOT NULL,
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  movement_type text NOT NULL CHECK (movement_type IN
    ('opening', 'entry', 'adjustment', 'sale', 'sale_reversal')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 300),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_sale_id uuid,
  reverses_movement_id uuid,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  UNIQUE (id, cash_register_id, product_id),
  UNIQUE (reverses_movement_id),
  FOREIGN KEY (cash_register_id, product_id)
    REFERENCES public.cash_register_inventory(cash_register_id, product_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_sale_id, cash_register_id)
    REFERENCES public.sales(id, cash_register_id) ON DELETE RESTRICT,
  FOREIGN KEY (reverses_movement_id, cash_register_id, product_id)
    REFERENCES public.cash_register_stock_movements(id, cash_register_id, product_id) ON DELETE RESTRICT,
  CHECK ((movement_type IN ('sale', 'sale_reversal')) = (source_sale_id IS NOT NULL)),
  CHECK ((movement_type = 'sale_reversal') = (reverses_movement_id IS NOT NULL))
);
CREATE INDEX cash_register_stock_movements_register_time_idx
  ON public.cash_register_stock_movements(cash_register_id, occurred_at DESC);
CREATE INDEX cash_register_stock_movements_product_idx
  ON public.cash_register_stock_movements(cash_register_id, product_id, occurred_at DESC);
CREATE INDEX cash_register_stock_movements_sale_idx
  ON public.cash_register_stock_movements(source_sale_id) WHERE source_sale_id IS NOT NULL;

ALTER TABLE public.profiles ADD CONSTRAINT active_inventory_requires_register
  CHECK (role <> 'inventory' OR NOT active OR cash_register_id IS NOT NULL);

ALTER TABLE public.cash_register_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_register_inventory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_register_stock_movements FROM PUBLIC, anon, authenticated;
CREATE POLICY cash_register_inventory_select ON public.cash_register_inventory
  FOR SELECT TO authenticated USING (
    (SELECT private.current_app_role()) = 'administrator' OR
    ((SELECT private.current_app_role()) IN ('cashier', 'inventory') AND
     cash_register_id = (SELECT private.current_cash_register_id()))
  );
CREATE POLICY cash_register_stock_movements_select ON public.cash_register_stock_movements
  FOR SELECT TO authenticated USING (
    (SELECT private.current_app_role()) = 'administrator' OR
    ((SELECT private.current_app_role()) IN ('cashier', 'inventory') AND
     cash_register_id = (SELECT private.current_cash_register_id()))
  );
GRANT SELECT (cash_register_id, product_id, category_id, display_name, subcategory,
  price, stock_quantity, minimum_stock, active, created_at, updated_at)
  ON public.cash_register_inventory TO authenticated;
GRANT SELECT ON public.cash_register_stock_movements TO authenticated;

-- Compatibilidad del POS: las dos cajas reciben el catálogo actual, pero
-- ninguna existencia. Los precios quedan desacoplados desde este punto.
INSERT INTO public.cash_register_inventory (
  cash_register_id, product_id, category_id, display_name, subcategory,
  price, cost, stock_quantity, minimum_stock, active
)
SELECT cash_register.id, product.id, product.category_id, product.name,
  product.subcategory, product.price, product.cost, 0,
  product.minimum_stock, false
FROM public.cash_registers cash_register
CROSS JOIN public.products product
WHERE cash_register.id IN (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid
);

CREATE POLICY registers_select_authorized ON public.cash_registers FOR SELECT TO authenticated
USING (
  (SELECT private.current_app_role()) = 'administrator' OR
  ((SELECT private.current_app_role()) IN ('cashier', 'inventory') AND
   id = (SELECT private.current_cash_register_id()) AND active)
);

CREATE FUNCTION public.save_cash_register_product(
  p_cash_register_id uuid, p_id text, p_name text, p_category_id uuid,
  p_subcategory text, p_price bigint, p_cost bigint, p_minimum_stock integer,
  p_sku text, p_active boolean
) RETURNS public.cash_register_inventory
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $save_product$
DECLARE
  v_id text := COALESCE(NULLIF(trim(p_id), ''), gen_random_uuid()::text);
  v_offer public.cash_register_inventory%rowtype;
  v_role public.app_role;
  v_assigned uuid;
BEGIN
  SELECT role, cash_register_id INTO v_role, v_assigned FROM public.profiles
  WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'inventory') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF v_role = 'inventory' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to inventory user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF length(trim(p_name)) NOT BETWEEN 1 AND 150 OR
     length(trim(p_subcategory)) NOT BETWEEN 1 AND 80 OR
     p_price IS NULL OR p_price < 0 OR p_cost IS NULL OR p_cost < 0 OR
     p_minimum_stock IS NULL OR p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'invalid product values';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE id = p_category_id AND active) THEN
    RAISE EXCEPTION 'active category required';
  END IF;
  IF p_id IS NULL OR trim(p_id) = '' THEN
    INSERT INTO public.products (id, name, category_id, subcategory, price, cost,
      stock_quantity, minimum_stock, sku, active)
    VALUES (v_id, trim(p_name), p_category_id, trim(p_subcategory), 0, 0, 0, 0,
      NULLIF(trim(p_sku), ''), false);
  ELSIF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_id) THEN
    RAISE EXCEPTION 'product identity not found';
  END IF;
  INSERT INTO public.cash_register_inventory AS inventory (
    cash_register_id, product_id, display_name, category_id, subcategory,
    price, cost, minimum_stock, active)
  VALUES (p_cash_register_id, v_id, trim(p_name), p_category_id,
    trim(p_subcategory), p_price, p_cost, p_minimum_stock, false)
  ON CONFLICT (cash_register_id, product_id) DO UPDATE SET
    display_name = EXCLUDED.display_name, category_id = EXCLUDED.category_id,
    subcategory = EXCLUDED.subcategory, price = EXCLUDED.price,
    cost = EXCLUDED.cost, minimum_stock = EXCLUDED.minimum_stock,
    active = COALESCE(p_active, false) AND inventory.stock_quantity > 0,
    updated_at = now()
  RETURNING * INTO v_offer;
  RETURN v_offer;
END
$save_product$;

CREATE FUNCTION public.record_cash_register_stock_movement(
  p_cash_register_id uuid, p_product_id text, p_quantity_delta integer,
  p_movement_type text, p_reason text, p_idempotency_key text
) RETURNS public.cash_register_stock_movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $stock_movement$
DECLARE
  v_offer public.cash_register_inventory%rowtype;
  v_movement public.cash_register_stock_movements%rowtype;
  v_role public.app_role;
  v_assigned uuid;
BEGIN
  SELECT role, cash_register_id INTO v_role, v_assigned FROM public.profiles
  WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'inventory') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF v_role = 'inventory' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to inventory user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers
      WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 OR
     p_movement_type NOT IN ('opening', 'entry', 'adjustment') OR
     length(trim(p_reason)) NOT BETWEEN 3 AND 300 OR
     length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid stock movement';
  END IF;
  SELECT * INTO v_movement FROM public.cash_register_stock_movements
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_movement.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_movement.product_id IS DISTINCT FROM p_product_id OR
       v_movement.quantity_delta IS DISTINCT FROM p_quantity_delta THEN
      RAISE EXCEPTION 'idempotency key reused for another movement';
    END IF;
    RETURN v_movement;
  END IF;
  SELECT * INTO v_offer FROM public.cash_register_inventory
  WHERE cash_register_id = p_cash_register_id AND product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cash register product not found'; END IF;
  IF v_offer.stock_quantity::bigint + p_quantity_delta < 0 OR
     v_offer.stock_quantity::bigint + p_quantity_delta > 2147483647 THEN
    RAISE EXCEPTION 'invalid resulting stock';
  END IF;
  UPDATE public.cash_register_inventory SET
    stock_quantity = stock_quantity + p_quantity_delta, updated_at = now()
  WHERE cash_register_id = p_cash_register_id AND product_id = p_product_id;
  INSERT INTO public.cash_register_stock_movements (
    cash_register_id, product_id, quantity_delta, movement_type, reason,
    actor_user_id, idempotency_key)
  VALUES (p_cash_register_id, p_product_id, p_quantity_delta, p_movement_type,
    trim(p_reason), auth.uid(), p_idempotency_key)
  RETURNING * INTO v_movement;
  RETURN v_movement;
END
$stock_movement$;

CREATE FUNCTION public.list_cash_register_inventory(p_cash_register_id uuid)
RETURNS TABLE (
  cash_register_id uuid, product_id text, display_name text, category_id uuid,
  subcategory text, price bigint, cost bigint, stock_quantity integer,
  minimum_stock integer, active boolean, updated_at timestamptz,
  product_name text, sku text, category_name text, category_slug text,
  category_active boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $list_inventory$
DECLARE
  v_role public.app_role;
  v_assigned uuid;
BEGIN
  SELECT role, profiles.cash_register_id INTO v_role, v_assigned
  FROM public.profiles WHERE user_id = auth.uid() AND profiles.active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'inventory') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF v_role = 'inventory' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to inventory user';
  END IF;
  RETURN QUERY
  SELECT inventory.cash_register_id, inventory.product_id, inventory.display_name,
    inventory.category_id, inventory.subcategory, inventory.price, inventory.cost,
    inventory.stock_quantity, inventory.minimum_stock, inventory.active,
    inventory.updated_at, product.name, product.sku, category.name, category.slug,
    category.active
  FROM public.cash_register_inventory inventory
  JOIN public.products product ON product.id = inventory.product_id
  JOIN public.product_categories category ON category.id = inventory.category_id
  WHERE inventory.cash_register_id = p_cash_register_id
  ORDER BY inventory.product_id;
END
$list_inventory$;

CREATE FUNCTION private.sale_items_match(p_sale_id uuid, p_items jsonb)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $items_match$
DECLARE
  v_stored jsonb;
  v_requested jsonb;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 OR
     (SELECT count(*) FROM jsonb_array_elements(p_items)) <>
       (SELECT count(DISTINCT item->>'productId') FROM jsonb_array_elements(p_items) item) THEN
    RETURN false;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productId', sale_item.product_id,
    'quantity', sale_item.quantity,
    'unitPrice', sale_item.unit_price
  ) ORDER BY sale_item.product_id), '[]'::jsonb)
  INTO v_stored FROM public.sale_items sale_item WHERE sale_item.sale_id = p_sale_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productId', item->>'productId',
    'quantity', (item->>'quantity')::integer,
    'unitPrice', (item->>'unitPrice')::bigint
  ) ORDER BY item->>'productId'), '[]'::jsonb)
  INTO v_requested FROM jsonb_array_elements(p_items) item;
  RETURN v_stored = v_requested;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN false;
END
$items_match$;
REVOKE ALL ON FUNCTION private.sale_items_match(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.record_cash_register_sale_stock(
  p_sale_id uuid, p_cash_register_id uuid, p_items jsonb, p_total_amount bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $sale_stock$
DECLARE
  v_item record;
  v_offer public.cash_register_inventory%rowtype;
  v_count integer;
  v_total bigint := 0;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'sale items required';
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items) item;
  IF v_count <> (SELECT count(DISTINCT item->>'productId') FROM jsonb_array_elements(p_items) item) THEN
    RAISE EXCEPTION 'duplicate sale items';
  END IF;
  PERFORM 1 FROM public.cash_register_inventory
  WHERE cash_register_id = p_cash_register_id
    AND product_id IN (SELECT item->>'productId' FROM jsonb_array_elements(p_items) item)
  ORDER BY product_id FOR UPDATE;
  FOR v_item IN
    SELECT item->>'productId' AS product_id,
      (item->>'quantity')::integer AS quantity,
      (item->>'unitPrice')::bigint AS client_price
    FROM jsonb_array_elements(p_items) item ORDER BY item->>'productId'
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'invalid sale quantity'; END IF;
    SELECT * INTO v_offer FROM public.cash_register_inventory
    WHERE cash_register_id = p_cash_register_id AND product_id = v_item.product_id;
    IF NOT FOUND OR NOT v_offer.active THEN RAISE EXCEPTION 'product unavailable in selected cash register'; END IF;
    IF v_offer.price IS DISTINCT FROM v_item.client_price THEN RAISE EXCEPTION 'cash register price changed'; END IF;
    IF v_offer.stock_quantity < v_item.quantity THEN RAISE EXCEPTION 'insufficient cash register stock'; END IF;
    v_total := v_total + v_offer.price * v_item.quantity;
    UPDATE public.cash_register_inventory SET
      stock_quantity = stock_quantity - v_item.quantity, updated_at = now()
    WHERE cash_register_id = p_cash_register_id AND product_id = v_item.product_id;
    INSERT INTO public.cash_register_stock_movements (
      cash_register_id, product_id, quantity_delta, movement_type, reason,
      actor_user_id, source_sale_id, idempotency_key)
    VALUES (p_cash_register_id, v_item.product_id, -v_item.quantity, 'sale',
      'Venta confirmada', auth.uid(), p_sale_id,
      'sale:' || p_sale_id::text || ':' || v_item.product_id);
    INSERT INTO public.sale_items (sale_id, product_id, product_name, unit_price, quantity)
    VALUES (p_sale_id, v_item.product_id,
      COALESCE(v_offer.display_name, (SELECT name FROM public.products WHERE id = v_item.product_id)),
      v_offer.price, v_item.quantity);
  END LOOP;
  IF p_total_amount IS NULL OR p_total_amount <= 0 OR v_total <> p_total_amount THEN
    RAISE EXCEPTION 'sale total mismatch';
  END IF;
END
$sale_stock$;
REVOKE ALL ON FUNCTION private.record_cash_register_sale_stock(uuid,uuid,jsonb,bigint)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.record_cash_sale(
  p_sale_id uuid, p_total_amount bigint, p_items jsonb,
  p_idempotency_key text, p_cash_register_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $cash_sale$
DECLARE
  v_role public.app_role;
  v_assigned uuid;
  v_sale public.sales%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT role, cash_register_id INTO v_role, v_assigned FROM public.profiles
  WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'cashier') THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF v_role = 'cashier' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;
  IF length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid idempotency key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO v_sale FROM public.sales WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_sale.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_sale.payment_method <> 'cash' OR v_sale.total_amount IS DISTINCT FROM p_total_amount OR
       v_sale.id IS DISTINCT FROM p_sale_id OR v_sale.actor_user_id IS DISTINCT FROM auth.uid() OR
       NOT private.sale_items_match(v_sale.id, p_items) THEN
      RAISE EXCEPTION 'idempotency key reused for another sale';
    END IF;
    RETURN to_jsonb(v_sale);
  END IF;
  INSERT INTO public.sales (id, actor_user_id, cash_register_id, total_amount, payment_method, idempotency_key)
  VALUES (p_sale_id, auth.uid(), p_cash_register_id, p_total_amount, 'cash', p_idempotency_key)
  RETURNING * INTO v_sale;
  PERFORM private.record_cash_register_sale_stock(p_sale_id, p_cash_register_id, p_items, p_total_amount);
  RETURN to_jsonb(v_sale);
END
$cash_sale$;

CREATE FUNCTION public.record_student_sale(
  p_sale_id uuid, p_student_id uuid, p_total_amount bigint, p_items jsonb,
  p_device_id text, p_idempotency_key text, p_cash_register_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $student_sale$
DECLARE
  v_role public.app_role;
  v_assigned uuid;
  v_sale public.sales%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT role, cash_register_id INTO v_role, v_assigned FROM public.profiles
  WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'cashier') THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF v_role = 'cashier' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;
  IF length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid idempotency key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO v_sale FROM public.sales WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_sale.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_sale.payment_method <> 'student-account' OR v_sale.student_id IS DISTINCT FROM p_student_id OR
       v_sale.total_amount IS DISTINCT FROM p_total_amount OR v_sale.id IS DISTINCT FROM p_sale_id OR
       v_sale.actor_user_id IS DISTINCT FROM auth.uid() OR
       NOT private.sale_items_match(v_sale.id, p_items) THEN
      RAISE EXCEPTION 'idempotency key reused for another sale';
    END IF;
    RETURN to_jsonb(v_sale);
  END IF;
  INSERT INTO public.sales (id, student_id, actor_user_id, cash_register_id,
    total_amount, payment_method, idempotency_key)
  VALUES (p_sale_id, p_student_id, auth.uid(), p_cash_register_id,
    p_total_amount, 'student-account', p_idempotency_key)
  RETURNING * INTO v_sale;
  PERFORM private.record_cash_register_sale_stock(p_sale_id, p_cash_register_id, p_items, p_total_amount);
  PERFORM public.record_student_movement(p_student_id, 'consumption', p_total_amount,
    (SELECT string_agg(si.quantity || '× ' || si.product_name, ' · ')
     FROM public.sale_items si WHERE si.sale_id = p_sale_id),
    p_device_id, 'sale:' || p_idempotency_key);
  UPDATE public.student_movements SET cash_register_id = p_cash_register_id
  WHERE idempotency_key = 'sale:' || p_idempotency_key;
  RETURN to_jsonb(v_sale);
END
$student_sale$;

CREATE FUNCTION public.void_sale(p_sale_id uuid, p_reason text, p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $void_sale$
DECLARE
  v_sale public.sales%rowtype;
  v_local public.cash_register_stock_movements%rowtype;
  v_student_movement_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
      AND active AND role = 'administrator') THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF length(trim(p_reason)) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'reason is required'; END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF v_sale.status = 'voided' THEN RETURN to_jsonb(v_sale); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_register_stock_movements
      WHERE source_sale_id = p_sale_id AND movement_type = 'sale') THEN
    RAISE EXCEPTION 'sale stock history is missing';
  END IF;
  FOR v_local IN SELECT * FROM public.cash_register_stock_movements
    WHERE source_sale_id = p_sale_id AND movement_type = 'sale'
    ORDER BY product_id FOR UPDATE
  LOOP
    IF v_local.cash_register_id IS DISTINCT FROM v_sale.cash_register_id THEN
      RAISE EXCEPTION 'sale stock belongs to another cash register';
    END IF;
    UPDATE public.cash_register_inventory SET
      stock_quantity = stock_quantity - v_local.quantity_delta, updated_at = now()
    WHERE cash_register_id = v_sale.cash_register_id AND product_id = v_local.product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'cash register offer missing'; END IF;
    INSERT INTO public.cash_register_stock_movements (
      cash_register_id, product_id, quantity_delta, movement_type, reason,
      actor_user_id, source_sale_id, idempotency_key, reverses_movement_id)
    VALUES (v_sale.cash_register_id, v_local.product_id, -v_local.quantity_delta,
      'sale_reversal', 'Anulación: ' || trim(p_reason), auth.uid(), p_sale_id,
      'sale-reversal:' || v_local.id::text, v_local.id);
  END LOOP;
  IF v_sale.student_id IS NOT NULL THEN
    SELECT id INTO v_student_movement_id FROM public.student_movements
    WHERE idempotency_key = 'sale:' || v_sale.idempotency_key;
    IF v_student_movement_id IS NOT NULL THEN
      PERFORM public.reverse_student_movement(v_sale.student_id, v_student_movement_id, p_device_id);
    END IF;
  END IF;
  UPDATE public.sales SET status = 'voided', voided_at = now(),
    voided_by = auth.uid(), void_reason = trim(p_reason)
  WHERE id = p_sale_id RETURNING * INTO v_sale;
  RETURN to_jsonb(v_sale);
END
$void_sale$;

CREATE OR REPLACE FUNCTION public.save_inventory_category(
  p_id uuid, p_name text, p_slug text, p_active boolean
) RETURNS public.product_categories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $save_category$
DECLARE
  v_category public.product_categories%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND active AND role = 'administrator') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF length(trim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid category name'; END IF;
  IF trim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'invalid category slug'; END IF;
  INSERT INTO public.product_categories (id, name, slug, active)
  VALUES (COALESCE(p_id, gen_random_uuid()), trim(p_name), trim(p_slug), COALESCE(p_active, true))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
    active = EXCLUDED.active
  RETURNING * INTO v_category;
  RETURN v_category;
END
$save_category$;

CREATE FUNCTION public.get_sales_report(p_start timestamptz, p_cash_register_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $sales_report$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND active AND role = 'administrator') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF p_start IS NULL THEN RAISE EXCEPTION 'report start is required'; END IF;
  IF p_cash_register_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cash_registers WHERE id = p_cash_register_id) THEN
    RAISE EXCEPTION 'cash register not found';
  END IF;
  WITH filtered AS MATERIALIZED (
    SELECT sale.* FROM public.sales sale
    WHERE sale.occurred_at >= p_start
      AND sale.status = 'completed'
      AND (p_cash_register_id IS NULL OR sale.cash_register_id = p_cash_register_id)
  ), top_products AS (
    SELECT item.product_name, sum(item.quantity)::bigint AS units
    FROM filtered sale JOIN public.sale_items item ON item.sale_id = sale.id
    GROUP BY item.product_name ORDER BY units DESC, item.product_name LIMIT 6
  ), by_register AS (
    SELECT register.id, register.name, count(sale.id)::bigint AS sales,
      COALESCE(sum(sale.total_amount), 0)::bigint AS total,
      COALESCE(sum(sale.total_amount) FILTER (WHERE sale.payment_method = 'cash'), 0)::bigint AS cash
    FROM public.cash_registers register
    LEFT JOIN filtered sale ON sale.cash_register_id = register.id
    WHERE p_cash_register_id IS NULL OR register.id = p_cash_register_id
    GROUP BY register.id, register.name
  ), hourly AS (
    SELECT extract(hour FROM sale.occurred_at AT TIME ZONE 'America/Bogota')::integer AS hour,
      count(*)::bigint AS sales
    FROM filtered sale GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'completedSales', count(*)::bigint,
    'totalAmount', COALESCE(sum(total_amount), 0)::bigint,
    'cashRevenue', COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'cash'), 0)::bigint,
    'averageTicket', COALESCE(round(avg(total_amount)), 0)::bigint,
    'soldUnits', COALESCE((SELECT sum(item.quantity) FROM filtered sale
      JOIN public.sale_items item ON item.sale_id = sale.id), 0)::bigint,
    'topProducts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'productName', product_name, 'units', units) ORDER BY units DESC, product_name)
      FROM top_products), '[]'::jsonb),
    'byRegister', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'registerId', id, 'registerName', name, 'sales', sales, 'total', total, 'cash', cash)
      ORDER BY name) FROM by_register), '[]'::jsonb),
    'hourlySales', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'hour', hour, 'sales', sales) ORDER BY hour) FROM hourly), '[]'::jsonb)
  ) INTO v_result FROM filtered;
  RETURN v_result;
END
$sales_report$;

CREATE FUNCTION public.get_cash_register_summaries()
RETURNS TABLE (
  id uuid, name text, active boolean, completed_sales bigint,
  voided_sales bigint, cash_total bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $register_summaries$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND profiles.active AND role = 'administrator') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  RETURN QUERY
  SELECT register.id, register.name, register.active,
    count(sale.id) FILTER (WHERE sale.status = 'completed')::bigint,
    count(sale.id) FILTER (WHERE sale.status = 'voided')::bigint,
    COALESCE(sum(sale.total_amount) FILTER (
      WHERE sale.status = 'completed' AND sale.payment_method = 'cash'), 0)::bigint
  FROM public.cash_registers register
  LEFT JOIN public.sales sale ON sale.cash_register_id = register.id
  GROUP BY register.id, register.name, register.active
  ORDER BY register.name;
END
$register_summaries$;

REVOKE ALL ON FUNCTION public.save_cash_register_product(uuid,text,text,uuid,text,bigint,bigint,integer,text,boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_cash_register_stock_movement(uuid,text,integer,text,text,text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_cash_register_inventory(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_sale(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sales_report(timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_cash_register_summaries() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_inventory_category(uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cash_register_product(uuid,text,text,uuid,text,bigint,bigint,integer,text,boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_register_stock_movement(uuid,text,integer,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_cash_register_inventory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_report(timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_register_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_inventory_category(uuid,text,text,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.record_cash_sale(uuid,bigint,jsonb,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.record_student_sale(uuid,uuid,bigint,jsonb,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.save_inventory_product(text,text,uuid,text,bigint,bigint,integer,text,boolean)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.record_stock_movement(text,integer,text,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.adjust_product_stock(text,integer,text) FROM authenticated;
REVOKE INSERT (id, name, price, active) ON public.products FROM authenticated;
REVOKE UPDATE (name, price, active, category_id, subcategory, cost, minimum_stock, sku)
  ON public.products FROM authenticated;
REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT (id, name, active, updated_at, category_id, subcategory, sku, created_at)
  ON public.products TO authenticated;

DO $postcheck$
BEGIN
  IF (SELECT count(*) FROM public.products) <> 52 OR
     EXISTS (SELECT 1 FROM public.products WHERE stock_quantity <> 0) OR
     EXISTS (SELECT 1 FROM public.sales) OR EXISTS (SELECT 1 FROM public.sale_items) OR
     EXISTS (SELECT 1 FROM public.stock_movements) OR
     EXISTS (SELECT 1 FROM public.cash_register_stock_movements) THEN
    RAISE EXCEPTION 'La migración alteró datos o creó inventario inicial';
  END IF;
  IF (SELECT count(*) FROM public.cash_register_inventory) <> 104 OR
     EXISTS (SELECT 1 FROM public.cash_register_inventory WHERE stock_quantity <> 0) OR
     EXISTS (SELECT 1 FROM public.cash_register_inventory WHERE active) OR
     EXISTS (
       SELECT 1 FROM public.products product
       WHERE (SELECT count(*) FROM public.cash_register_inventory inventory
              WHERE inventory.product_id = product.id
                AND inventory.cash_register_id IN (
                  '30000000-0000-4000-8000-000000000001'::uuid,
                  '30000000-0000-4000-8000-000000000002'::uuid)) <> 2
     ) THEN
    RAISE EXCEPTION 'El catálogo inicial por caja no coincide o tiene existencias';
  END IF;
  IF to_regprocedure('public.record_cash_sale(uuid,bigint,jsonb,text,uuid)') IS NULL OR
     to_regprocedure('public.record_student_sale(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NULL OR
     NOT has_function_privilege('authenticated',
       'public.record_cash_sale(uuid,bigint,jsonb,text,uuid)', 'EXECUTE') OR
     NOT has_function_privilege('authenticated',
       'public.list_cash_register_inventory(uuid)', 'EXECUTE') OR
     has_column_privilege('authenticated', 'public.cash_register_inventory', 'cost', 'SELECT') OR
     has_column_privilege('authenticated', 'public.products', 'cost', 'SELECT') OR
     has_function_privilege('authenticated',
       'public.record_cash_sale_global_legacy_20261106(uuid,bigint,jsonb,text,uuid)', 'EXECUTE') OR
     has_function_privilege('authenticated',
       'public.save_inventory_category_global_legacy_20261106(uuid,text,text,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Las firmas compatibles con el POS no quedaron protegidas';
  END IF;
END
$postcheck$;

COMMIT;
