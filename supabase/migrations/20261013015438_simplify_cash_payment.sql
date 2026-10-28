insert into public.cash_registers (id, name, active)
values ('30000000-0000-4000-8000-000000000001', 'Caja principal', true)
on conflict (name) do update set active = true;

update public.profiles
set cash_register_id = (select id from public.cash_registers where name = 'Caja principal')
where role = 'administrator' and cash_register_id is null;

create or replace function public.record_cash_sale(
  p_sale_id uuid,
  p_total_amount bigint,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_register uuid;
  v_sale public.sales%rowtype;
  v_calculated_total bigint;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select role, cash_register_id into v_role, v_register from public.profiles
  where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'cashier') then raise exception 'operation not authorized'; end if;

  if v_register is not null and not exists (
    select 1 from public.cash_registers where id = v_register and active = true
  ) then raise exception 'active cash register required'; end if;
  if v_register is null and v_role = 'administrator' then
    select id into v_register from public.cash_registers
    where active = true order by created_at, id limit 1;
  end if;
  if v_register is null then raise exception 'cash register assignment required'; end if;

  select * into v_sale from public.sales where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_sale); end if;
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

revoke all on function public.record_cash_sale(uuid, bigint, jsonb, text) from public, anon;
grant execute on function public.record_cash_sale(uuid, bigint, jsonb, text) to authenticated;
