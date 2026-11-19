BEGIN;

-- El rollback no altera estudiantes ni movimientos históricos. students.net_balance
-- se mantiene actualizado durante la migración para recuperar el comportamiento previo.
DROP FUNCTION IF EXISTS public.record_student_movement_by_register(
  uuid, public.student_movement_type, bigint, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.list_student_accounts(uuid);
DROP VIEW IF EXISTS public.student_account_reconciliation;
DROP VIEW IF EXISTS public.student_movements_pending_reconciliation;
DROP TRIGGER IF EXISTS student_movements_apply_account ON public.student_movements;
DROP TRIGGER IF EXISTS student_movements_assign_reversal_register ON public.student_movements;
DROP FUNCTION IF EXISTS private.apply_student_account_movement();
DROP FUNCTION IF EXISTS private.assign_student_reversal_register();
DROP TABLE IF EXISTS public.student_accounts;
GRANT EXECUTE ON FUNCTION public.record_student_movement(
  uuid, public.student_movement_type, bigint, text, text, text) TO authenticated;

COMMIT;
