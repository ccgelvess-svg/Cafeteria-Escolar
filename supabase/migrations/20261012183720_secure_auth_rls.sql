create type public.app_role as enum ('administrator', 'cashier', 'inventory');
create type public.student_status as enum ('active', 'inactive');
create type public.student_movement_type as enum ('consumption', 'top-up', 'debt-payment', 'reversal');
create type public.sale_payment_method as enum ('student-account', 'cash');

create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  role public.app_role not null,
  cash_register_id uuid references public.cash_registers(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashier_requires_register check (role <> 'cashier' or cash_register_id is not null)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 1 and 50),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  grade text not null check (length(trim(grade)) between 1 and 30),
  group_name text not null check (length(trim(group_name)) between 1 and 30),
  net_balance bigint not null default 0,
  status public.student_status not null default 'active',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_movements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  occurred_at timestamptz not null default now(),
  type public.student_movement_type not null,
  amount bigint not null check (amount <> 0),
  detail text not null check (length(trim(detail)) between 1 and 500),
  actor_user_id uuid not null references auth.users(id),
  actor_display_name text not null,
  cash_register_id uuid references public.cash_registers(id),
  device_id text not null check (length(device_id) between 1 and 100),
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 200),
  reverses_movement_id uuid unique references public.student_movements(id)
);

create table public.sales (
  id uuid primary key,
  occurred_at timestamptz not null default now(),
  student_id uuid references public.students(id),
  actor_user_id uuid not null references auth.users(id),
  cash_register_id uuid references public.cash_registers(id),
  total_amount bigint not null check (total_amount > 0),
  payment_method public.sale_payment_method not null,
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 200)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id text not null,
  product_name text not null,
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total bigint generated always as (unit_price * quantity) stored
);

create table public.products (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 150),
  price bigint not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id),
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (length(trim(reason)) between 1 and 300),
  actor_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);

create index student_movements_student_id_idx on public.student_movements(student_id);
create index student_movements_cash_register_id_idx on public.student_movements(cash_register_id);
create index sales_cash_register_id_idx on public.sales(cash_register_id);
create index sales_student_id_idx on public.sales(student_id);
create index sale_items_sale_id_idx on public.sale_items(sale_id);
create index stock_movements_product_id_idx on public.stock_movements(product_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where user_id = (select auth.uid()) and active = true
$$;

create function private.current_cash_register_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cash_register_id from public.profiles
  where user_id = (select auth.uid()) and active = true
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.current_cash_register_id() from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_cash_register_id() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon;
grant execute on function private.set_updated_at() to authenticated;

create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger students_updated_at before update on public.students
for each row execute function private.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function private.set_updated_at();

alter table public.cash_registers enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy profiles_select_authorized on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.current_app_role()) = 'administrator');
create policy profiles_insert_admin on public.profiles for insert to authenticated
with check ((select private.current_app_role()) = 'administrator');
create policy profiles_update_admin on public.profiles for update to authenticated
using ((select private.current_app_role()) = 'administrator')
with check ((select private.current_app_role()) = 'administrator');

create policy registers_select_authorized on public.cash_registers for select to authenticated
using ((select private.current_app_role()) = 'administrator' or id = (select private.current_cash_register_id()));
create policy registers_insert_admin on public.cash_registers for insert to authenticated
with check ((select private.current_app_role()) = 'administrator');
create policy registers_update_admin on public.cash_registers for update to authenticated
using ((select private.current_app_role()) = 'administrator')
with check ((select private.current_app_role()) = 'administrator');

create policy students_select_pos_admin on public.students for select to authenticated
using ((select private.current_app_role()) in ('administrator', 'cashier'));
create policy students_insert_admin on public.students for insert to authenticated
with check ((select private.current_app_role()) = 'administrator');
create policy students_update_admin on public.students for update to authenticated
using ((select private.current_app_role()) = 'administrator')
with check ((select private.current_app_role()) = 'administrator');

create policy movements_select_authorized on public.student_movements for select to authenticated
using (
  (select private.current_app_role()) = 'administrator'
  or ((select private.current_app_role()) = 'cashier' and cash_register_id = (select private.current_cash_register_id()))
);

create policy sales_select_authorized on public.sales for select to authenticated
using (
  (select private.current_app_role()) = 'administrator'
  or ((select private.current_app_role()) = 'cashier' and cash_register_id = (select private.current_cash_register_id()))
);
create policy sale_items_select_authorized on public.sale_items for select to authenticated
using (exists (select 1 from public.sales where sales.id = sale_items.sale_id));

create policy products_select_authorized on public.products for select to authenticated
using ((select private.current_app_role()) in ('administrator', 'cashier', 'inventory'));
create policy products_insert_inventory on public.products for insert to authenticated
with check ((select private.current_app_role()) in ('administrator', 'inventory'));
create policy products_update_inventory on public.products for update to authenticated
using ((select private.current_app_role()) in ('administrator', 'inventory'))
with check ((select private.current_app_role()) in ('administrator', 'inventory'));

create policy stock_select_inventory on public.stock_movements for select to authenticated
using ((select private.current_app_role()) in ('administrator', 'inventory'));

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.cash_registers to authenticated;
grant select on public.students to authenticated;
grant insert (id, code, first_name, last_name, grade, group_name, status) on public.students to authenticated;
grant update (code, first_name, last_name, grade, group_name, status) on public.students to authenticated;
grant select on public.student_movements to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.products to authenticated;
grant insert (id, name, price, active) on public.products to authenticated;
grant update (name, price, active) on public.products to authenticated;
grant select on public.stock_movements to authenticated;

create function public.record_student_movement(
  p_student_id uuid,
  p_type public.student_movement_type,
  p_value bigint,
  p_detail text,
  p_device_id text,
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
  v_student public.students%rowtype;
  v_movement public.student_movements%rowtype;
  v_amount bigint;
  v_actor_name text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select role, cash_register_id, display_name into v_role, v_register, v_actor_name
    from public.profiles where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role = 'inventory' then raise exception 'operation not authorized'; end if;
  if v_role = 'cashier' and p_type <> 'consumption' then raise exception 'cashier movement not authorized'; end if;
  if v_role = 'cashier' and v_register is null then raise exception 'cash register assignment required'; end if;
  if p_type = 'reversal' then raise exception 'use reverse_student_movement'; end if;
  if p_value <= 0 then raise exception 'value must be positive'; end if;

  select * into v_movement from public.student_movements where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_movement); end if;
  select * into v_student from public.students where id = p_student_id for update;
  if not found then raise exception 'student not found'; end if;
  if p_type = 'consumption' and v_student.status <> 'active' then raise exception 'student is inactive'; end if;
  v_amount := case when p_type = 'consumption' then -p_value else p_value end;

  insert into public.student_movements (
    student_id, type, amount, detail, actor_user_id, actor_display_name,
    cash_register_id, device_id, idempotency_key
  ) values (
    p_student_id, p_type, v_amount, trim(p_detail), (select auth.uid()), v_actor_name,
    v_register, p_device_id, p_idempotency_key
  ) returning * into v_movement;
  update public.students set net_balance = net_balance + v_amount where id = p_student_id;
  return to_jsonb(v_movement);
end;
$$;

create function public.reverse_student_movement(p_student_id uuid, p_movement_id uuid, p_device_id text)
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

revoke all on function public.record_student_movement(uuid, public.student_movement_type, bigint, text, text, text) from public, anon;
revoke all on function public.reverse_student_movement(uuid, uuid, text) from public, anon;
grant execute on function public.record_student_movement(uuid, public.student_movement_type, bigint, text, text, text) to authenticated;
grant execute on function public.reverse_student_movement(uuid, uuid, text) to authenticated;

create function public.record_student_sale(
  p_sale_id uuid,
  p_student_id uuid,
  p_total_amount bigint,
  p_items jsonb,
  p_device_id text,
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
  if v_role = 'cashier' and v_register is null then raise exception 'cash register assignment required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'sale items required'; end if;
  select coalesce(sum((item->>'unitPrice')::bigint * (item->>'quantity')::integer), 0)
    into v_calculated_total from jsonb_array_elements(p_items) item;
  if p_total_amount <= 0 or v_calculated_total <> p_total_amount then raise exception 'sale total mismatch'; end if;

  select * into v_sale from public.sales where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_sale); end if;

  insert into public.sales (id, student_id, actor_user_id, cash_register_id, total_amount, payment_method, idempotency_key)
  values (p_sale_id, p_student_id, (select auth.uid()), v_register, p_total_amount, 'student-account', p_idempotency_key)
  returning * into v_sale;

  insert into public.sale_items (sale_id, product_id, product_name, unit_price, quantity)
  select p_sale_id, item->>'productId', item->>'productName', (item->>'unitPrice')::bigint, (item->>'quantity')::integer
  from jsonb_array_elements(p_items) item
  where (item->>'productId') is not null and (item->>'productName') is not null
    and (item->>'unitPrice')::bigint >= 0 and (item->>'quantity')::integer > 0;
  if not found then raise exception 'invalid sale items'; end if;

  perform public.record_student_movement(
    p_student_id, 'consumption', p_total_amount,
    (select string_agg((item->>'quantity') || '× ' || (item->>'productName'), ' · ') from jsonb_array_elements(p_items) item),
    p_device_id, 'sale:' || p_idempotency_key
  );
  return to_jsonb(v_sale);
end;
$$;

revoke all on function public.record_student_sale(uuid, uuid, bigint, jsonb, text, text) from public, anon;
grant execute on function public.record_student_sale(uuid, uuid, bigint, jsonb, text, text) to authenticated;

create function public.adjust_product_stock(p_product_id text, p_quantity_delta integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_product public.products%rowtype;
  v_movement public.stock_movements%rowtype;
begin
  select role into v_role from public.profiles
    where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'inventory') then raise exception 'operation not authorized'; end if;
  if p_quantity_delta = 0 then raise exception 'quantity delta cannot be zero'; end if;
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'product not found'; end if;
  if v_product.stock_quantity + p_quantity_delta < 0 then raise exception 'insufficient stock'; end if;
  update public.products set stock_quantity = stock_quantity + p_quantity_delta where id = p_product_id;
  insert into public.stock_movements (product_id, quantity_delta, reason, actor_user_id)
  values (p_product_id, p_quantity_delta, trim(p_reason), (select auth.uid()))
  returning * into v_movement;
  return to_jsonb(v_movement);
end;
$$;

revoke all on function public.adjust_product_stock(text, integer, text) from public, anon;
grant execute on function public.adjust_product_stock(text, integer, text) to authenticated;
