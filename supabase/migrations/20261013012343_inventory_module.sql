create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column category_id uuid references public.product_categories(id),
  add column subcategory text not null default 'General' check (length(trim(subcategory)) between 1 and 80),
  add column cost bigint not null default 0 check (cost >= 0),
  add column minimum_stock integer not null default 0 check (minimum_stock >= 0),
  add column sku text,
  add column created_at timestamptz not null default now();

create unique index products_sku_unique_idx on public.products (lower(sku)) where sku is not null;
create index products_category_id_idx on public.products(category_id);
create index products_active_category_idx on public.products(active, category_id);

alter table public.stock_movements
  add column movement_type text not null default 'adjustment'
    check (movement_type in ('opening', 'entry', 'adjustment', 'sale', 'sale_reversal')),
  add column source_sale_id uuid references public.sales(id),
  add column idempotency_key text,
  add column reverses_movement_id uuid references public.stock_movements(id);

create unique index stock_movements_idempotency_key_idx
  on public.stock_movements(idempotency_key) where idempotency_key is not null;
create unique index stock_movements_reverses_movement_id_idx
  on public.stock_movements(reverses_movement_id) where reverses_movement_id is not null;
create index stock_movements_source_sale_id_idx on public.stock_movements(source_sale_id);
create index stock_movements_occurred_at_idx on public.stock_movements(occurred_at desc);

alter table public.sales
  add column status text not null default 'completed' check (status in ('completed', 'voided')),
  add column voided_at timestamptz,
  add column voided_by uuid references auth.users(id),
  add column void_reason text,
  add constraint sales_void_fields_check check (
    (status = 'completed' and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'voided' and voided_at is not null and voided_by is not null and length(trim(void_reason)) between 3 and 300)
  );

insert into public.product_categories (id, name, slug) values
  ('10000000-0000-4000-8000-000000000001', 'Bebidas', 'bebidas'),
  ('10000000-0000-4000-8000-000000000002', 'Paquetes', 'paquetes'),
  ('10000000-0000-4000-8000-000000000003', 'Pasteles', 'pasteles'),
  ('10000000-0000-4000-8000-000000000004', 'Panadería', 'panaderia'),
  ('10000000-0000-4000-8000-000000000005', 'Rápidos', 'rapidos'),
  ('10000000-0000-4000-8000-000000000006', 'General', 'general')
on conflict (slug) do nothing;

update public.products
set category_id = (select id from public.product_categories where slug = 'general')
where category_id is null;

insert into public.products (id, name, price, category_id, subcategory, active) values
  ('agua-bolsa', 'Agua bolsa', 800, '10000000-0000-4000-8000-000000000001', 'Agua', true),
  ('agua-pequena', 'Agua pequeña', 1200, '10000000-0000-4000-8000-000000000001', 'Agua', true),
  ('agua-grande', 'Agua grande', 1800, '10000000-0000-4000-8000-000000000001', 'Agua', true),
  ('gatorade', 'Gatorade', 3500, '10000000-0000-4000-8000-000000000001', 'Tés y bebidas', true),
  ('gaseosa-pequena', 'Gaseosa pequeña', 2000, '10000000-0000-4000-8000-000000000001', 'Gaseosas', true),
  ('gaseosa-grande', 'Gaseosa grande', 3000, '10000000-0000-4000-8000-000000000001', 'Gaseosas', true),
  ('hit-pequeno', 'Hit pequeño', 1500, '10000000-0000-4000-8000-000000000001', 'Jugos', true),
  ('hit-grande', 'Hit grande', 2500, '10000000-0000-4000-8000-000000000001', 'Jugos', true),
  ('hit-caja', 'Hit caja', 1800, '10000000-0000-4000-8000-000000000001', 'Jugos', true),
  ('mr-tea', 'Mr Tea', 3000, '10000000-0000-4000-8000-000000000001', 'Tés y bebidas', true),
  ('jugo-vaso', 'Jugo en vaso', 2000, '10000000-0000-4000-8000-000000000001', 'Jugos', true),
  ('leche', 'Leche', 1800, '10000000-0000-4000-8000-000000000001', 'Lácteos', true),
  ('papas-medianas', 'Papas medianas', 2000, '10000000-0000-4000-8000-000000000002', 'Papas', true),
  ('galleta-chocolate', 'Galleta chocolate', 1200, '10000000-0000-4000-8000-000000000002', 'Galletas', true),
  ('mani', 'Maní salado', 1500, '10000000-0000-4000-8000-000000000002', 'Snacks', true),
  ('pastel-carne', 'Pastel de carne', 2500, '10000000-0000-4000-8000-000000000003', 'Carne', true),
  ('pastel-pollo', 'Pastel de pollo', 2500, '10000000-0000-4000-8000-000000000003', 'Pollo', true),
  ('pastel-queso', 'Pastel de queso', 2200, '10000000-0000-4000-8000-000000000003', 'Queso', true),
  ('croissant', 'Croissant', 2000, '10000000-0000-4000-8000-000000000004', 'Dulce', true),
  ('pan-queso', 'Pan de queso', 1800, '10000000-0000-4000-8000-000000000004', 'Salado', true),
  ('hamburguesa', 'Hamburguesa', 6500, '10000000-0000-4000-8000-000000000005', 'Hamburguesas', true),
  ('pizza', 'Porción de pizza', 4500, '10000000-0000-4000-8000-000000000005', 'Pizza', true)
on conflict (id) do update set
  category_id = excluded.category_id,
  subcategory = excluded.subcategory;

alter table public.products alter column category_id set not null;

create trigger product_categories_updated_at before update on public.product_categories
for each row execute function private.set_updated_at();

alter table public.product_categories enable row level security;

create policy categories_select_authorized on public.product_categories for select to authenticated
using ((select private.current_app_role()) in ('administrator', 'cashier', 'inventory'));

revoke all on public.product_categories from anon, authenticated;
grant select on public.product_categories to authenticated;
grant select (category_id, subcategory, cost, minimum_stock, sku, created_at) on public.products to authenticated;
grant update (category_id, subcategory, cost, minimum_stock, sku) on public.products to authenticated;
grant select (status, voided_at, voided_by, void_reason) on public.sales to authenticated;
grant select (movement_type, source_sale_id, idempotency_key, reverses_movement_id) on public.stock_movements to authenticated;

create function public.save_inventory_category(
  p_id uuid,
  p_name text,
  p_slug text,
  p_active boolean
)
returns public.product_categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_category public.product_categories%rowtype;
begin
  select role into v_role from public.profiles
  where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'inventory') then
    raise exception 'operation not authorized';
  end if;
  if length(trim(p_name)) not between 1 and 80 then raise exception 'invalid category name'; end if;
  if trim(p_slug) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid category slug'; end if;

  insert into public.product_categories (id, name, slug, active)
  values (coalesce(p_id, gen_random_uuid()), trim(p_name), trim(p_slug), coalesce(p_active, true))
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    active = excluded.active
  returning * into v_category;
  return v_category;
end;
$$;

create function public.save_inventory_product(
  p_id text,
  p_name text,
  p_category_id uuid,
  p_subcategory text,
  p_price bigint,
  p_cost bigint,
  p_minimum_stock integer,
  p_sku text,
  p_active boolean
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_product public.products%rowtype;
  v_id text := coalesce(nullif(trim(p_id), ''), gen_random_uuid()::text);
begin
  select role into v_role from public.profiles
  where user_id = (select auth.uid()) and active = true;
  if v_role is null or v_role not in ('administrator', 'inventory') then
    raise exception 'operation not authorized';
  end if;
  if length(trim(p_name)) not between 1 and 150 then raise exception 'invalid product name'; end if;
  if length(trim(p_subcategory)) not between 1 and 80 then raise exception 'invalid subcategory'; end if;
  if p_price < 0 or p_cost < 0 or p_minimum_stock < 0 then raise exception 'values cannot be negative'; end if;
  if not exists (select 1 from public.product_categories where id = p_category_id and active = true) then
    raise exception 'active category required';
  end if;

  insert into public.products (id, name, category_id, subcategory, price, cost, minimum_stock, sku, active)
  values (v_id, trim(p_name), p_category_id, trim(p_subcategory), p_price, p_cost, p_minimum_stock, nullif(trim(p_sku), ''), coalesce(p_active, true))
  on conflict (id) do update set
    name = excluded.name,
    category_id = excluded.category_id,
    subcategory = excluded.subcategory,
    price = excluded.price,
    cost = excluded.cost,
    minimum_stock = excluded.minimum_stock,
    sku = excluded.sku,
    active = excluded.active
  returning * into v_product;
  return v_product;
end;
$$;

create function public.record_stock_movement(
  p_product_id text,
  p_quantity_delta integer,
  p_movement_type text,
  p_reason text,
  p_idempotency_key text
)
returns public.stock_movements
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
  if p_movement_type not in ('opening', 'entry', 'adjustment') then raise exception 'invalid manual movement type'; end if;
  if length(trim(p_reason)) not between 3 and 300 then raise exception 'reason is required'; end if;
  if length(trim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key is required'; end if;

  select * into v_movement from public.stock_movements where idempotency_key = p_idempotency_key;
  if found then return v_movement; end if;
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'product not found'; end if;
  if v_product.stock_quantity + p_quantity_delta < 0 then raise exception 'insufficient stock'; end if;

  update public.products set stock_quantity = stock_quantity + p_quantity_delta where id = p_product_id;
  insert into public.stock_movements (
    product_id, quantity_delta, reason, actor_user_id, movement_type, idempotency_key
  ) values (
    p_product_id, p_quantity_delta, trim(p_reason), (select auth.uid()), p_movement_type, trim(p_idempotency_key)
  ) returning * into v_movement;
  return v_movement;
end;
$$;

create function private.record_sale_stock(p_sale_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_product public.products%rowtype;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'sale items required'; end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct item->>'productId') from jsonb_array_elements(p_items) item) then
    raise exception 'duplicate sale items';
  end if;

  perform 1 from public.products
  where id in (select item->>'productId' from jsonb_array_elements(p_items) item)
  order by id for update;

  for v_item in
    select item->>'productId' as product_id, (item->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items) item
    order by item->>'productId'
  loop
    if v_item.quantity <= 0 then raise exception 'invalid sale quantity'; end if;
    select * into v_product from public.products where id = v_item.product_id;
    if not found or not v_product.active then raise exception 'product unavailable: %', v_item.product_id; end if;
    if v_product.stock_quantity < v_item.quantity then raise exception 'insufficient stock: %', v_product.name; end if;

    update public.products set stock_quantity = stock_quantity - v_item.quantity where id = v_item.product_id;
    insert into public.stock_movements (
      product_id, quantity_delta, reason, actor_user_id, movement_type, source_sale_id, idempotency_key
    ) values (
      v_item.product_id, -v_item.quantity, 'Venta confirmada', (select auth.uid()), 'sale', p_sale_id,
      'sale:' || p_sale_id::text || ':' || v_item.product_id
    );
  end loop;
end;
$$;

create or replace function public.record_student_sale(
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

  select * into v_sale from public.sales where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_sale); end if;

  select coalesce(sum(p.price * (item->>'quantity')::integer), 0)
  into v_calculated_total
  from jsonb_array_elements(p_items) item
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
  return to_jsonb(v_sale);
end;
$$;

create function public.record_cash_sale(
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
  if v_role = 'cashier' and v_register is null then raise exception 'cash register assignment required'; end if;

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

create function public.void_sale(p_sale_id uuid, p_reason text, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_original public.stock_movements%rowtype;
  v_student_movement_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and active = true and role = 'administrator'
  ) then raise exception 'operation not authorized'; end if;
  if length(trim(p_reason)) not between 3 and 300 then raise exception 'reason is required'; end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'sale not found'; end if;
  if v_sale.status = 'voided' then return to_jsonb(v_sale); end if;

  for v_original in
    select * from public.stock_movements
    where source_sale_id = p_sale_id and movement_type = 'sale'
    order by product_id for update
  loop
    update public.products
    set stock_quantity = stock_quantity - v_original.quantity_delta
    where id = v_original.product_id;
    insert into public.stock_movements (
      product_id, quantity_delta, reason, actor_user_id, movement_type,
      source_sale_id, idempotency_key, reverses_movement_id
    ) values (
      v_original.product_id, -v_original.quantity_delta, 'Anulación: ' || trim(p_reason),
      (select auth.uid()), 'sale_reversal', p_sale_id,
      'sale-reversal:' || v_original.id::text, v_original.id
    );
  end loop;

  if v_sale.student_id is not null then
    select id into v_student_movement_id from public.student_movements
    where idempotency_key = 'sale:' || v_sale.idempotency_key;
    if v_student_movement_id is not null then
      perform public.reverse_student_movement(v_sale.student_id, v_student_movement_id, p_device_id);
    end if;
  end if;

  update public.sales set
    status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = trim(p_reason)
  where id = p_sale_id returning * into v_sale;
  return to_jsonb(v_sale);
end;
$$;

revoke all on function public.save_inventory_category(uuid, text, text, boolean) from public, anon;
revoke all on function public.save_inventory_product(text, text, uuid, text, bigint, bigint, integer, text, boolean) from public, anon;
revoke all on function public.record_stock_movement(text, integer, text, text, text) from public, anon;
revoke all on function public.adjust_product_stock(text, integer, text) from authenticated;
revoke all on function private.record_sale_stock(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_cash_sale(uuid, bigint, jsonb, text) from public, anon;
revoke all on function public.void_sale(uuid, text, text) from public, anon;
grant execute on function public.save_inventory_category(uuid, text, text, boolean) to authenticated;
grant execute on function public.save_inventory_product(text, text, uuid, text, bigint, bigint, integer, text, boolean) to authenticated;
grant execute on function public.record_stock_movement(text, integer, text, text, text) to authenticated;
grant execute on function public.record_cash_sale(uuid, bigint, jsonb, text) to authenticated;
grant execute on function public.void_sale(uuid, text, text) to authenticated;
