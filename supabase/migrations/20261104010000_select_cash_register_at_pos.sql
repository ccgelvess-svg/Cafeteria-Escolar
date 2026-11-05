do $$
declare
  v_backup text;
begin
  foreach v_backup in array array[
    'private.reset_20261104_cash_registers',
    'private.reset_20261104_sales',
    'private.reset_20261104_sale_items',
    'private.reset_20261104_stock_movements',
    'private.reset_20261104_student_movements',
    'private.reset_20261104_students',
    'private.reset_20261104_products'
  ] loop
    if to_regclass(v_backup) is null then raise exception 'required reset backup missing: %', v_backup; end if;
    if has_table_privilege('anon', v_backup, 'select')
       or has_table_privilege('authenticated', v_backup, 'select') then
      raise exception 'reset backup is publicly exposed: %', v_backup;
    end if;
  end loop;

  if (select count(*) from private.reset_20261104_sales) <> 26 then
    raise exception 'reset backup must contain exactly 26 sales';
  end if;
  if (select count(*) from public.cash_registers
      where name in ('Caja principal', 'Cardenal Sancha') and active) <> 2 then
    raise exception 'both cash registers must exist and be active';
  end if;
  if exists (
    select 1 from public.sales s
    join public.cash_registers cr on cr.id = s.cash_register_id
    where cr.name in ('Caja principal', 'Cardenal Sancha')
  ) then raise exception 'cash registers must be empty before applying selection migration'; end if;
end;
$$;

drop policy if exists registers_select_authorized on public.cash_registers;
create policy registers_select_authorized on public.cash_registers for select to authenticated
using (
  (select private.current_app_role()) = 'administrator'
  or (
    (select private.current_app_role()) = 'cashier'
    and id = (select private.current_cash_register_id())
    and active = true
  )
);

create function public.record_cash_sale(
  p_sale_id uuid,
  p_total_amount bigint,
  p_items jsonb,
  p_idempotency_key text,
  p_cash_register_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_assigned_register uuid;
  v_register uuid;
  v_sale public.sales%rowtype;
  v_calculated_total bigint;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select role, cash_register_id into v_role, v_assigned_register from public.profiles
  where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'cashier') then raise exception 'operation not authorized'; end if;

  select id into v_register from public.cash_registers
  where id = p_cash_register_id and active = true;
  if v_register is null then raise exception 'active cash register selection required'; end if;
  if v_role = 'cashier' and v_assigned_register is distinct from v_register then
    raise exception 'cash register not assigned to cashier';
  end if;

  select * into v_sale from public.sales where idempotency_key = p_idempotency_key;
  if found then
    if v_sale.cash_register_id <> v_register then raise exception 'sale belongs to another cash register'; end if;
    return to_jsonb(v_sale);
  end if;

  select coalesce(sum(p.price * (item->>'quantity')::integer), 0)
  into v_calculated_total from jsonb_array_elements(p_items) item
  join public.products p on p.id = item->>'productId';
  if p_total_amount <= 0 or v_calculated_total <> p_total_amount then raise exception 'sale total mismatch'; end if;

  insert into public.sales (id, actor_user_id, cash_register_id, total_amount, payment_method, idempotency_key)
  values (p_sale_id, (select auth.uid()), v_register, p_total_amount, 'cash', p_idempotency_key)
  returning * into v_sale;
  perform private.record_sale_stock(p_sale_id, p_items);
  insert into public.sale_items (sale_id, product_id, product_name, unit_price, quantity)
  select p_sale_id, p.id, p.name, p.price, (item->>'quantity')::integer
  from jsonb_array_elements(p_items) item join public.products p on p.id = item->>'productId';
  return to_jsonb(v_sale);
end;
$$;

create function public.record_student_sale(
  p_sale_id uuid,
  p_student_id uuid,
  p_total_amount bigint,
  p_items jsonb,
  p_device_id text,
  p_idempotency_key text,
  p_cash_register_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_assigned_register uuid;
  v_register uuid;
  v_sale public.sales%rowtype;
  v_calculated_total bigint;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select role, cash_register_id into v_role, v_assigned_register from public.profiles
  where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'cashier') then raise exception 'operation not authorized'; end if;

  select id into v_register from public.cash_registers
  where id = p_cash_register_id and active = true;
  if v_register is null then raise exception 'active cash register selection required'; end if;
  if v_role = 'cashier' and v_assigned_register is distinct from v_register then
    raise exception 'cash register not assigned to cashier';
  end if;

  select * into v_sale from public.sales where idempotency_key = p_idempotency_key;
  if found then
    if v_sale.cash_register_id <> v_register then raise exception 'sale belongs to another cash register'; end if;
    return to_jsonb(v_sale);
  end if;

  select coalesce(sum(p.price * (item->>'quantity')::integer), 0)
  into v_calculated_total from jsonb_array_elements(p_items) item
  join public.products p on p.id = item->>'productId';
  if p_total_amount <= 0 or v_calculated_total <> p_total_amount then raise exception 'sale total mismatch'; end if;

  insert into public.sales (id, student_id, actor_user_id, cash_register_id, total_amount, payment_method, idempotency_key)
  values (p_sale_id, p_student_id, (select auth.uid()), v_register, p_total_amount, 'student-account', p_idempotency_key)
  returning * into v_sale;
  perform private.record_sale_stock(p_sale_id, p_items);
  insert into public.sale_items (sale_id, product_id, product_name, unit_price, quantity)
  select p_sale_id, p.id, p.name, p.price, (item->>'quantity')::integer
  from jsonb_array_elements(p_items) item join public.products p on p.id = item->>'productId';

  perform public.record_student_movement(
    p_student_id, 'consumption', p_total_amount,
    (select string_agg((item->>'quantity') || '× ' || p.name, ' · ')
     from jsonb_array_elements(p_items) item join public.products p on p.id = item->>'productId'),
    p_device_id, 'sale:' || p_idempotency_key
  );
  update public.student_movements set cash_register_id = v_register
  where idempotency_key = 'sale:' || p_idempotency_key;
  return to_jsonb(v_sale);
end;
$$;

revoke all on function public.record_cash_sale(uuid, bigint, jsonb, text, uuid) from public, anon;
revoke all on function public.record_student_sale(uuid, uuid, bigint, jsonb, text, text, uuid) from public, anon;
grant execute on function public.record_cash_sale(uuid, bigint, jsonb, text, uuid) to authenticated;
grant execute on function public.record_student_sale(uuid, uuid, bigint, jsonb, text, text, uuid) to authenticated;
