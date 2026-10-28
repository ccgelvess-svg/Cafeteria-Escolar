create or replace function public.reverse_student_movement(p_student_id uuid, p_movement_id uuid, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.student_movements%rowtype;
  v_reversal public.student_movements%rowtype;
  v_name text;
begin
  select display_name into v_name from public.profiles
    where user_id = (select auth.uid()) and active = true and role = 'administrator';
  if v_name is null then raise exception 'operation not authorized'; end if;

  select * into v_original from public.student_movements
    where id = p_movement_id and student_id = p_student_id for update;
  if not found then raise exception 'movement not found'; end if;
  if v_original.type = 'reversal' then raise exception 'a reversal cannot be reversed'; end if;

  select * into v_reversal from public.student_movements
    where reverses_movement_id = p_movement_id;
  if found then return to_jsonb(v_reversal); end if;

  insert into public.student_movements (
    student_id, type, amount, detail, actor_user_id, actor_display_name,
    cash_register_id, device_id, idempotency_key, reverses_movement_id
  ) values (
    p_student_id, 'reversal', -v_original.amount, 'Reverso: ' || v_original.detail,
    (select auth.uid()), v_name, null, p_device_id, 'reversal:' || p_movement_id, p_movement_id
  ) returning * into v_reversal;
  update public.students set net_balance = net_balance + v_reversal.amount where id = p_student_id;
  return to_jsonb(v_reversal);
end;
$$;

revoke all on function public.reverse_student_movement(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_student_movement(uuid, uuid, text) to authenticated;
