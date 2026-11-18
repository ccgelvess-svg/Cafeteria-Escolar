BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.teachers') IS NOT NULL OR
     to_regclass('public.teacher_movements') IS NOT NULL OR
     EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'teacher_id'
     ) THEN
    RAISE EXCEPTION 'Las cuentas de profesores ya existen total o parcialmente';
  END IF;
  IF to_regclass('public.cash_registers') IS NULL OR
     to_regclass('public.sales') IS NULL OR
     to_regprocedure('private.current_app_role()') IS NULL OR
     to_regprocedure('private.current_cash_register_id()') IS NULL OR
     to_regprocedure('private.set_updated_at()') IS NULL OR
     to_regprocedure('private.record_cash_register_sale_stock(uuid,uuid,jsonb,bigint)') IS NULL OR
     to_regprocedure('private.sale_items_match(uuid,jsonb)') IS NULL OR
     to_regprocedure('public.void_sale(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'El esquema base requerido para profesores no está disponible';
  END IF;
END
$preflight$;

-- Se reutilizan el estado y los tipos contables de estudiantes para mantener
-- exactamente la misma semántica: consumo negativo; recarga/abono positivo.
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 50),
  first_name text NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 100),
  net_balance bigint NOT NULL DEFAULT 0,
  status public.student_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teachers_id_cash_register_key UNIQUE (id, cash_register_id)
);

CREATE UNIQUE INDEX teachers_cash_register_code_uidx
  ON public.teachers(cash_register_id, upper(trim(code)));
CREATE INDEX teachers_cash_register_status_idx
  ON public.teachers(cash_register_id, status, first_name, last_name);

CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE public.teacher_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  cash_register_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  type public.student_movement_type NOT NULL,
  amount bigint NOT NULL CHECK (amount <> 0),
  detail text NOT NULL CHECK (length(trim(detail)) BETWEEN 1 AND 500),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  actor_display_name text NOT NULL,
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 100),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  reverses_movement_id uuid UNIQUE REFERENCES public.teacher_movements(id) ON DELETE RESTRICT,
  CONSTRAINT teacher_movements_teacher_register_fk
    FOREIGN KEY (teacher_id, cash_register_id)
    REFERENCES public.teachers(id, cash_register_id) ON DELETE RESTRICT
);

CREATE INDEX teacher_movements_teacher_occurred_idx
  ON public.teacher_movements(teacher_id, occurred_at DESC);
CREATE INDEX teacher_movements_register_occurred_idx
  ON public.teacher_movements(cash_register_id, occurred_at DESC);

ALTER TABLE public.sales ADD COLUMN teacher_id uuid;
ALTER TABLE public.sales ADD CONSTRAINT sales_teacher_register_fk
  FOREIGN KEY (teacher_id, cash_register_id)
  REFERENCES public.teachers(id, cash_register_id) ON DELETE RESTRICT;
ALTER TABLE public.sales ADD CONSTRAINT sales_single_account_holder_check
  CHECK (NOT (student_id IS NOT NULL AND teacher_id IS NOT NULL));
ALTER TABLE public.sales ADD CONSTRAINT sales_teacher_account_payment_check
  CHECK (teacher_id IS NULL OR payment_method = 'student-account');
CREATE INDEX sales_teacher_id_idx ON public.sales(teacher_id);

COMMENT ON COLUMN public.sales.teacher_id IS
  'Profesor asociado a una venta fiada. teacher_id y student_id son mutuamente excluyentes.';
COMMENT ON CONSTRAINT sales_teacher_account_payment_check ON public.sales IS
  'student-account representa una venta contra cuenta personal, de estudiante o profesor.';

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY teachers_select_authorized ON public.teachers FOR SELECT TO authenticated
USING (
  (SELECT private.current_app_role()) = 'administrator'
  OR (
    (SELECT private.current_app_role()) = 'cashier'
    AND cash_register_id = (SELECT private.current_cash_register_id())
  )
);

CREATE POLICY teachers_insert_admin ON public.teachers FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.current_app_role()) = 'administrator'
  AND EXISTS (
    SELECT 1 FROM public.cash_registers register
    WHERE register.id = cash_register_id AND register.active
  )
);

CREATE POLICY teachers_update_admin ON public.teachers FOR UPDATE TO authenticated
USING ((SELECT private.current_app_role()) = 'administrator')
WITH CHECK (
  (SELECT private.current_app_role()) = 'administrator'
  AND EXISTS (
    SELECT 1 FROM public.cash_registers register
    WHERE register.id = cash_register_id AND register.active
  )
);

CREATE POLICY teacher_movements_select_authorized
ON public.teacher_movements FOR SELECT TO authenticated
USING (
  (SELECT private.current_app_role()) = 'administrator'
  OR (
    (SELECT private.current_app_role()) = 'cashier'
    AND cash_register_id = (SELECT private.current_cash_register_id())
  )
);

REVOKE ALL ON public.teachers, public.teacher_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.teachers TO authenticated;
GRANT INSERT (id, cash_register_id, code, first_name, last_name, status)
  ON public.teachers TO authenticated;
GRANT UPDATE (cash_register_id, code, first_name, last_name, status)
  ON public.teachers TO authenticated;
GRANT SELECT ON public.teacher_movements TO authenticated;

CREATE FUNCTION public.record_teacher_movement(
  p_teacher_id uuid,
  p_type public.student_movement_type,
  p_value bigint,
  p_detail text,
  p_device_id text,
  p_idempotency_key text,
  p_cash_register_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $teacher_movement$
DECLARE
  v_role public.app_role;
  v_assigned_register uuid;
  v_actor_name text;
  v_teacher public.teachers%rowtype;
  v_movement public.teacher_movements%rowtype;
  v_amount bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT role, cash_register_id, display_name
    INTO v_role, v_assigned_register, v_actor_name
  FROM public.profiles WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'cashier') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM public.cash_registers
      WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF v_role = 'cashier' AND v_assigned_register IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;
  IF v_role = 'cashier' AND p_type <> 'consumption' THEN
    RAISE EXCEPTION 'cashier movement not authorized';
  END IF;
  IF p_type = 'reversal' THEN RAISE EXCEPTION 'use reverse_teacher_movement'; END IF;
  IF p_value IS NULL OR p_value <= 0 THEN RAISE EXCEPTION 'value must be positive'; END IF;
  IF length(trim(p_detail)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid movement detail'; END IF;
  IF length(p_device_id) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid idempotency key'; END IF;

  v_amount := CASE WHEN p_type = 'consumption' THEN -p_value ELSE p_value END;
  PERFORM pg_advisory_xact_lock(hashtextextended('teacher-movement:' || p_idempotency_key, 0));
  SELECT * INTO v_movement FROM public.teacher_movements
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_movement.teacher_id IS DISTINCT FROM p_teacher_id OR
       v_movement.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_movement.type IS DISTINCT FROM p_type OR
       v_movement.amount IS DISTINCT FROM v_amount OR
       v_movement.detail IS DISTINCT FROM trim(p_detail) OR
       v_movement.actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'idempotency key reused for another teacher movement';
    END IF;
    RETURN to_jsonb(v_movement);
  END IF;

  SELECT * INTO v_teacher FROM public.teachers
  WHERE id = p_teacher_id AND cash_register_id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'teacher not found in selected cash register'; END IF;
  IF p_type = 'consumption' AND v_teacher.status <> 'active' THEN
    RAISE EXCEPTION 'teacher is inactive';
  END IF;

  INSERT INTO public.teacher_movements (
    teacher_id, cash_register_id, type, amount, detail, actor_user_id,
    actor_display_name, device_id, idempotency_key
  ) VALUES (
    p_teacher_id, p_cash_register_id, p_type, v_amount, trim(p_detail), auth.uid(),
    v_actor_name, p_device_id, p_idempotency_key
  ) RETURNING * INTO v_movement;

  UPDATE public.teachers SET net_balance = net_balance + v_amount
  WHERE id = p_teacher_id AND cash_register_id = p_cash_register_id;
  RETURN to_jsonb(v_movement);
END
$teacher_movement$;

CREATE FUNCTION public.reverse_teacher_movement(
  p_teacher_id uuid,
  p_movement_id uuid,
  p_device_id text,
  p_cash_register_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $teacher_reversal$
DECLARE
  v_actor_name text;
  v_teacher public.teachers%rowtype;
  v_original public.teacher_movements%rowtype;
  v_reversal public.teacher_movements%rowtype;
BEGIN
  SELECT display_name INTO v_actor_name FROM public.profiles
  WHERE user_id = auth.uid() AND active AND role = 'administrator';
  IF v_actor_name IS NULL THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF length(p_device_id) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE id = p_cash_register_id) THEN
    RAISE EXCEPTION 'cash register not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('teacher-reversal:' || p_movement_id::text, 0));
  SELECT * INTO v_teacher FROM public.teachers
  WHERE id = p_teacher_id AND cash_register_id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'teacher not found in selected cash register'; END IF;

  SELECT * INTO v_original FROM public.teacher_movements
  WHERE id = p_movement_id AND teacher_id = p_teacher_id
    AND cash_register_id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'teacher movement not found'; END IF;
  IF v_original.type = 'reversal' THEN RAISE EXCEPTION 'a reversal cannot be reversed'; END IF;

  SELECT * INTO v_reversal FROM public.teacher_movements
  WHERE reverses_movement_id = p_movement_id;
  IF FOUND THEN RETURN to_jsonb(v_reversal); END IF;

  INSERT INTO public.teacher_movements (
    teacher_id, cash_register_id, type, amount, detail, actor_user_id,
    actor_display_name, device_id, idempotency_key, reverses_movement_id
  ) VALUES (
    p_teacher_id, p_cash_register_id, 'reversal', -v_original.amount,
    'Reverso: ' || v_original.detail, auth.uid(), v_actor_name, p_device_id,
    'teacher-reversal:' || p_movement_id::text, p_movement_id
  ) RETURNING * INTO v_reversal;

  UPDATE public.teachers SET net_balance = net_balance + v_reversal.amount
  WHERE id = p_teacher_id AND cash_register_id = p_cash_register_id;
  RETURN to_jsonb(v_reversal);
END
$teacher_reversal$;

-- Las ventas de profesores reutilizan student-account como método contable de
-- cuenta personal; teacher_id permite distinguirlas sin alterar ventas previas.
CREATE FUNCTION public.record_teacher_sale(
  p_sale_id uuid,
  p_teacher_id uuid,
  p_total_amount bigint,
  p_items jsonb,
  p_device_id text,
  p_idempotency_key text,
  p_cash_register_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $teacher_sale$
DECLARE
  v_role public.app_role;
  v_assigned_register uuid;
  v_teacher public.teachers%rowtype;
  v_sale public.sales%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT role, cash_register_id INTO v_role, v_assigned_register
  FROM public.profiles WHERE user_id = auth.uid() AND active;
  IF v_role IS NULL OR v_role NOT IN ('administrator', 'cashier') THEN
    RAISE EXCEPTION 'operation not authorized';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM public.cash_registers
      WHERE id = p_cash_register_id AND active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF v_role = 'cashier' AND v_assigned_register IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;
  IF length(p_device_id) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid idempotency key'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO v_sale FROM public.sales WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_sale.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_sale.payment_method <> 'student-account' OR
       v_sale.teacher_id IS DISTINCT FROM p_teacher_id OR
       v_sale.student_id IS NOT NULL OR
       v_sale.total_amount IS DISTINCT FROM p_total_amount OR
       v_sale.id IS DISTINCT FROM p_sale_id OR
       v_sale.actor_user_id IS DISTINCT FROM auth.uid() OR
       NOT private.sale_items_match(v_sale.id, p_items) THEN
      RAISE EXCEPTION 'idempotency key reused for another teacher sale';
    END IF;
    RETURN to_jsonb(v_sale);
  END IF;

  SELECT * INTO v_teacher FROM public.teachers
  WHERE id = p_teacher_id AND cash_register_id = p_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'teacher not found in selected cash register'; END IF;
  IF v_teacher.status <> 'active' THEN RAISE EXCEPTION 'teacher is inactive'; END IF;

  INSERT INTO public.sales (
    id, teacher_id, actor_user_id, cash_register_id,
    total_amount, payment_method, idempotency_key
  ) VALUES (
    p_sale_id, p_teacher_id, auth.uid(), p_cash_register_id,
    p_total_amount, 'student-account', p_idempotency_key
  ) RETURNING * INTO v_sale;

  PERFORM private.record_cash_register_sale_stock(
    p_sale_id, p_cash_register_id, p_items, p_total_amount);
  PERFORM public.record_teacher_movement(
    p_teacher_id, 'consumption', p_total_amount,
    (SELECT string_agg(si.quantity || '× ' || si.product_name, ' · ')
     FROM public.sale_items si WHERE si.sale_id = p_sale_id),
    p_device_id, 'sale:' || p_idempotency_key, p_cash_register_id);
  RETURN to_jsonb(v_sale);
END
$teacher_sale$;

-- Conserva la anulación vigente y añade la reversión de la cuenta docente en
-- la misma transacción que la devolución de inventario.
CREATE OR REPLACE FUNCTION public.void_sale(
  p_sale_id uuid, p_reason text, p_device_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $void_sale$
DECLARE
  v_sale public.sales%rowtype;
  v_local public.cash_register_stock_movements%rowtype;
  v_student_movement_id uuid;
  v_teacher_movement_id uuid;
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
      PERFORM public.reverse_student_movement(
        v_sale.student_id, v_student_movement_id, p_device_id);
    END IF;
  ELSIF v_sale.teacher_id IS NOT NULL THEN
    IF p_device_id IS NULL OR length(p_device_id) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid device id';
    END IF;
    SELECT id INTO v_teacher_movement_id FROM public.teacher_movements
    WHERE idempotency_key = 'sale:' || v_sale.idempotency_key;
    IF v_teacher_movement_id IS NULL THEN
      RAISE EXCEPTION 'teacher sale movement is missing';
    END IF;
    PERFORM public.reverse_teacher_movement(
      v_sale.teacher_id, v_teacher_movement_id, p_device_id, v_sale.cash_register_id);
  END IF;
  UPDATE public.sales SET status = 'voided', voided_at = now(),
    voided_by = auth.uid(), void_reason = trim(p_reason)
  WHERE id = p_sale_id RETURNING * INTO v_sale;
  RETURN to_jsonb(v_sale);
END
$void_sale$;

REVOKE ALL ON FUNCTION public.record_teacher_movement(
  uuid,public.student_movement_type,bigint,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_teacher_movement(uuid,uuid,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_teacher_sale(uuid,uuid,bigint,jsonb,text,text,uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_sale(uuid,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_teacher_movement(
  uuid,public.student_movement_type,bigint,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_teacher_movement(uuid,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_teacher_sale(uuid,uuid,bigint,jsonb,text,text,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid,text,text) TO authenticated;

DO $postcheck$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teachers) OR
     EXISTS (SELECT 1 FROM public.teacher_movements) OR
     EXISTS (SELECT 1 FROM public.sales WHERE teacher_id IS NOT NULL) THEN
    RAISE EXCEPTION 'La migración creó o vinculó datos de profesores inesperadamente';
  END IF;
  IF to_regprocedure(
       'public.record_teacher_movement(uuid,public.student_movement_type,bigint,text,text,text,uuid)') IS NULL OR
     to_regprocedure('public.reverse_teacher_movement(uuid,uuid,text,uuid)') IS NULL OR
     to_regprocedure('public.record_teacher_sale(uuid,uuid,bigint,jsonb,text,text,uuid)') IS NULL OR
     NOT has_function_privilege('authenticated',
       'public.record_teacher_sale(uuid,uuid,bigint,jsonb,text,text,uuid)', 'EXECUTE') OR
     has_table_privilege('anon', 'public.teachers', 'SELECT') OR
     has_table_privilege('authenticated', 'public.teacher_movements', 'INSERT') THEN
    RAISE EXCEPTION 'Las cuentas de profesores no quedaron protegidas correctamente';
  END IF;
END
$postcheck$;

COMMIT;
