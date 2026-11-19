BEGIN;

CREATE TABLE public.student_accounts (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  net_balance bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, cash_register_id)
);

CREATE INDEX student_accounts_register_balance_idx
  ON public.student_accounts(cash_register_id, net_balance, student_id);

CREATE TRIGGER student_accounts_updated_at BEFORE UPDATE ON public.student_accounts
FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Solo se concilian automáticamente movimientos cuya caja ya está registrada.
-- Los movimientos históricos sin caja permanecen intactos y fuera del saldo por caja.
INSERT INTO public.student_accounts (student_id, cash_register_id, net_balance)
SELECT movement.student_id, movement.cash_register_id, sum(movement.amount)::bigint
FROM public.student_movements movement
WHERE movement.cash_register_id IS NOT NULL
GROUP BY movement.student_id, movement.cash_register_id
ON CONFLICT (student_id, cash_register_id) DO UPDATE
SET net_balance = EXCLUDED.net_balance, updated_at = now();

CREATE VIEW public.student_movements_pending_reconciliation
WITH (security_invoker = true) AS
SELECT movement.*
FROM public.student_movements movement
WHERE movement.cash_register_id IS NULL;

CREATE VIEW public.student_account_reconciliation
WITH (security_invoker = true) AS
SELECT student.id AS student_id,
  student.net_balance AS legacy_net_balance,
  COALESCE(sum(movement.amount) FILTER (WHERE movement.cash_register_id IS NOT NULL), 0)::bigint AS assigned_balance,
  COALESCE(sum(movement.amount) FILTER (WHERE movement.cash_register_id IS NULL), 0)::bigint AS pending_balance,
  (student.net_balance - COALESCE(sum(movement.amount), 0))::bigint AS integrity_difference
FROM public.students student
LEFT JOIN public.student_movements movement ON movement.student_id = student.id
GROUP BY student.id, student.net_balance;

CREATE FUNCTION private.assign_student_reversal_register()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NEW.type = 'reversal' AND NEW.cash_register_id IS NULL AND NEW.reverses_movement_id IS NOT NULL THEN
    SELECT original.cash_register_id INTO NEW.cash_register_id
    FROM public.student_movements original
    WHERE original.id = NEW.reverses_movement_id;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER student_movements_assign_reversal_register
BEFORE INSERT ON public.student_movements
FOR EACH ROW EXECUTE FUNCTION private.assign_student_reversal_register();

CREATE FUNCTION private.apply_student_account_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.cash_register_id IS NOT NULL
     AND OLD.cash_register_id IS DISTINCT FROM NEW.cash_register_id THEN
    UPDATE public.student_accounts
    SET net_balance = net_balance - OLD.amount
    WHERE student_id = OLD.student_id AND cash_register_id = OLD.cash_register_id;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.cash_register_id IS NOT NULL THEN
    INSERT INTO public.student_accounts (student_id, cash_register_id, net_balance)
    VALUES (NEW.student_id, NEW.cash_register_id, NEW.amount)
    ON CONFLICT (student_id, cash_register_id) DO UPDATE
    SET net_balance = public.student_accounts.net_balance + EXCLUDED.net_balance,
        updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.cash_register_id IS NOT NULL
        AND OLD.cash_register_id IS DISTINCT FROM NEW.cash_register_id THEN
    INSERT INTO public.student_accounts (student_id, cash_register_id, net_balance)
    VALUES (NEW.student_id, NEW.cash_register_id, NEW.amount)
    ON CONFLICT (student_id, cash_register_id) DO UPDATE
    SET net_balance = public.student_accounts.net_balance + EXCLUDED.net_balance,
        updated_at = now();
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER student_movements_apply_account
AFTER INSERT OR UPDATE OF cash_register_id ON public.student_movements
FOR EACH ROW EXECUTE FUNCTION private.apply_student_account_movement();

ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_accounts_select_authorized
ON public.student_accounts FOR SELECT TO authenticated
USING (
  (SELECT private.current_app_role()) = 'administrator'
  OR ((SELECT private.current_app_role()) = 'cashier'
      AND cash_register_id = (SELECT private.current_cash_register_id()))
);

REVOKE ALL ON public.student_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_accounts TO authenticated;
GRANT SELECT ON public.student_movements_pending_reconciliation TO authenticated;
GRANT SELECT ON public.student_account_reconciliation TO authenticated;

CREATE FUNCTION public.list_student_accounts(p_cash_register_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, code text, first_name text, last_name text, grade text, group_name text,
  net_balance bigint, status public.student_status, created_at timestamptz,
  updated_at timestamptz, cash_register_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' STABLE AS $function$
DECLARE
  v_role public.app_role;
  v_assigned uuid;
BEGIN
  SELECT profile.role, profile.cash_register_id INTO v_role, v_assigned
  FROM public.profiles profile WHERE profile.user_id = auth.uid() AND profile.active;
  IF v_role IS NULL OR v_role = 'inventory' THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF p_cash_register_id IS NULL AND v_role <> 'administrator' THEN
    RAISE EXCEPTION 'cash register required';
  END IF;
  IF p_cash_register_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cash_registers register
    WHERE register.id = p_cash_register_id AND register.active
  ) THEN RAISE EXCEPTION 'active cash register required'; END IF;
  IF v_role = 'cashier' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;

  RETURN QUERY
  SELECT student.id, student.code, student.first_name, student.last_name,
    student.grade, student.group_name,
    COALESCE(sum(account.net_balance), 0)::bigint,
    student.status, student.created_at, student.updated_at, p_cash_register_id
  FROM public.students student
  LEFT JOIN public.student_accounts account
    ON account.student_id = student.id
   AND (p_cash_register_id IS NULL OR account.cash_register_id = p_cash_register_id)
  GROUP BY student.id, student.code, student.first_name, student.last_name,
    student.grade, student.group_name, student.status, student.created_at, student.updated_at
  ORDER BY student.first_name, student.last_name;
END
$function$;

CREATE FUNCTION public.record_student_movement_by_register(
  p_student_id uuid, p_type public.student_movement_type, p_value bigint,
  p_detail text, p_device_id text, p_idempotency_key text, p_cash_register_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_role public.app_role;
  v_assigned uuid;
  v_actor_name text;
  v_student public.students%rowtype;
  v_movement public.student_movements%rowtype;
  v_amount bigint;
BEGIN
  SELECT profile.role, profile.cash_register_id, profile.display_name
    INTO v_role, v_assigned, v_actor_name
  FROM public.profiles profile WHERE profile.user_id = auth.uid() AND profile.active;
  IF v_role IS NULL OR v_role = 'inventory' THEN RAISE EXCEPTION 'operation not authorized'; END IF;
  IF v_role = 'cashier' AND p_type <> 'consumption' THEN RAISE EXCEPTION 'cashier movement not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_registers register
                 WHERE register.id = p_cash_register_id AND register.active) THEN
    RAISE EXCEPTION 'active cash register required';
  END IF;
  IF v_role = 'cashier' AND v_assigned IS DISTINCT FROM p_cash_register_id THEN
    RAISE EXCEPTION 'cash register not assigned to cashier';
  END IF;
  IF p_type = 'reversal' THEN RAISE EXCEPTION 'use reverse_student_movement'; END IF;
  IF p_value <= 0 THEN RAISE EXCEPTION 'value must be positive'; END IF;
  v_amount := CASE WHEN p_type = 'consumption' THEN -p_value ELSE p_value END;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO v_movement FROM public.student_movements
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_movement.student_id IS DISTINCT FROM p_student_id OR
       v_movement.cash_register_id IS DISTINCT FROM p_cash_register_id OR
       v_movement.type IS DISTINCT FROM p_type OR
       v_movement.amount IS DISTINCT FROM v_amount THEN
      RAISE EXCEPTION 'idempotency key reused for another movement';
    END IF;
    RETURN to_jsonb(v_movement);
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'student not found'; END IF;
  IF p_type = 'consumption' AND v_student.status <> 'active' THEN RAISE EXCEPTION 'student is inactive'; END IF;
  INSERT INTO public.student_accounts (student_id, cash_register_id)
  VALUES (p_student_id, p_cash_register_id) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.student_accounts
  WHERE student_id = p_student_id AND cash_register_id = p_cash_register_id FOR UPDATE;

  INSERT INTO public.student_movements (
    student_id, type, amount, detail, actor_user_id, actor_display_name,
    cash_register_id, device_id, idempotency_key
  ) VALUES (
    p_student_id, p_type, v_amount, trim(p_detail), auth.uid(), v_actor_name,
    p_cash_register_id, p_device_id, p_idempotency_key
  ) RETURNING * INTO v_movement;

  -- Se conserva el agregado histórico para una reversión segura de la migración.
  UPDATE public.students SET net_balance = net_balance + v_amount WHERE id = p_student_id;
  RETURN to_jsonb(v_movement);
END
$function$;

REVOKE ALL ON FUNCTION public.list_student_accounts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_student_movement_by_register(
  uuid, public.student_movement_type, bigint, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_student_movement(
  uuid, public.student_movement_type, bigint, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_accounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_movement_by_register(
  uuid, public.student_movement_type, bigint, text, text, text, uuid) TO authenticated;

COMMIT;
