-- Solo lectura. Ejecutar antes de aprobar cualquier eliminación.
with target_registers as (
  select id, name, active from public.cash_registers
  where name in ('Caja principal', 'Cardenal Sancha')
)
select
  cr.name,
  cr.active,
  count(s.id) filter (where s.status = 'completed') as completed_sales,
  count(s.id) filter (where s.status = 'voided') as voided_sales,
  coalesce(sum(s.total_amount) filter (
    where s.status = 'completed' and s.payment_method = 'cash'
  ), 0) as cash_total
from target_registers cr
left join public.sales s on s.cash_register_id = cr.id
group by cr.id, cr.name, cr.active
order by cr.name;

select
  s.id,
  cr.name as cash_register,
  s.occurred_at,
  s.status,
  s.payment_method,
  s.total_amount,
  s.student_id,
  p.display_name as actor,
  s.idempotency_key,
  (s.idempotency_key like 'audit:%' or s.idempotency_key like 'test:%') as explicit_test_marker
from public.sales s
join public.cash_registers cr on cr.id = s.cash_register_id
left join public.profiles p on p.user_id = s.actor_user_id
where cr.name in ('Caja principal', 'Cardenal Sancha')
order by s.occurred_at, s.id;

with target_sales as (
  select s.* from public.sales s
  join public.cash_registers cr on cr.id = s.cash_register_id
  where cr.name in ('Caja principal', 'Cardenal Sancha')
), original_movements as (
  select sm.* from public.student_movements sm
  join target_sales s on sm.idempotency_key = 'sale:' || s.idempotency_key
), linked_movements as (
  select * from original_movements
  union all
  select reversal.* from public.student_movements reversal
  join original_movements original on reversal.reverses_movement_id = original.id
), target_students as (
  select distinct student_id from target_sales where student_id is not null
)
select
  st.id as student_id,
  st.code,
  st.first_name,
  st.last_name,
  st.net_balance as current_balance,
  coalesce(sum(lm.amount), 0) as sale_movement_effect,
  st.net_balance - coalesce(sum(lm.amount), 0) as balance_after_reset,
  count(lm.id) as linked_movements
from public.students st
join target_students ts on ts.student_id = st.id
left join linked_movements lm on lm.student_id = st.id
group by st.id, st.code, st.first_name, st.last_name, st.net_balance
order by st.code;

-- Abonos, recargas, deudas y otros movimientos NO vinculados a las ventas objetivo.
with target_sales as (
  select s.* from public.sales s
  join public.cash_registers cr on cr.id = s.cash_register_id
  where cr.name in ('Caja principal', 'Cardenal Sancha')
), target_students as (
  select distinct student_id from target_sales where student_id is not null
), original_sale_movements as (
  select sm.id from public.student_movements sm
  join target_sales s on sm.idempotency_key = 'sale:' || s.idempotency_key
), linked_sale_movements as (
  select id from original_sale_movements
  union
  select reversal.id from public.student_movements reversal
  join original_sale_movements original on reversal.reverses_movement_id = original.id
)
select
  st.code,
  st.first_name,
  st.last_name,
  st.net_balance,
  sm.id as movement_id,
  sm.occurred_at,
  sm.type,
  sm.amount,
  sm.detail,
  sm.idempotency_key,
  true as must_be_preserved
from public.student_movements sm
join target_students ts on ts.student_id = sm.student_id
join public.students st on st.id = sm.student_id
where not exists (select 1 from linked_sale_movements linked where linked.id = sm.id)
order by st.code, sm.occurred_at, sm.id;

with target_sales as (
  select s.id from public.sales s
  join public.cash_registers cr on cr.id = s.cash_register_id
  where cr.name in ('Caja principal', 'Cardenal Sancha')
)
select
  p.id as product_id,
  p.name,
  p.stock_quantity as current_stock,
  coalesce(sum(sm.quantity_delta), 0) as sale_stock_effect,
  p.stock_quantity - coalesce(sum(sm.quantity_delta), 0) as stock_after_reset,
  count(sm.id) as linked_movements
from public.products p
join public.stock_movements sm on sm.product_id = p.id
join target_sales s on s.id = sm.source_sale_id
group by p.id, p.name, p.stock_quantity
order by p.name;

-- Respaldos que bloquearían una nueva ejecución para evitar sobrescrituras.
select
  schemaname,
  tablename,
  true as already_exists
from pg_tables
where schemaname = 'private'
  and tablename like 'reset_20261104\_%' escape '\'
order by tablename;

-- Relaciones declaradas hacia ventas; revisar si aparecen tablas adicionales.
select
  conrelid::regclass as referencing_table,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and confrelid = 'public.sales'::regclass
order by conrelid::regclass::text, conname;

-- Debe devolver cero filas: relaciones inesperadas que impedirían el borrado.
select s.id as sale_id, 'sale_without_items' as issue
from public.sales s
join public.cash_registers cr on cr.id = s.cash_register_id
where cr.name in ('Caja principal', 'Cardenal Sancha')
  and not exists (select 1 from public.sale_items si where si.sale_id = s.id);

-- Inconsistencias financieras, de inventario o de pertenencia. Debe devolver cero filas.
with target_sales as (
  select s.* from public.sales s
  join public.cash_registers cr on cr.id = s.cash_register_id
  where cr.name in ('Caja principal', 'Cardenal Sancha')
), item_totals as (
  select si.sale_id, sum(si.line_total) as item_total
  from public.sale_items si
  join target_sales s on s.id = si.sale_id
  group by si.sale_id
), stock_by_item as (
  select si.sale_id, si.product_id, sum(si.quantity) as sold_quantity
  from public.sale_items si
  join target_sales s on s.id = si.sale_id
  group by si.sale_id, si.product_id
), stock_by_movement as (
  select sm.source_sale_id as sale_id, sm.product_id,
    -sum(sm.quantity_delta) filter (where sm.movement_type = 'sale') as moved_quantity
  from public.stock_movements sm
  join target_sales s on s.id = sm.source_sale_id
  group by sm.source_sale_id, sm.product_id
), student_sale_movements as (
  select s.id as sale_id, sm.id as movement_id, sm.amount
  from target_sales s
  left join public.student_movements sm
    on sm.idempotency_key = 'sale:' || s.idempotency_key
  where s.payment_method = 'student-account'
)
select s.id as sale_id, 'sale_total_differs_from_items' as issue
from target_sales s
left join item_totals items on items.sale_id = s.id
where coalesce(items.item_total, 0) <> s.total_amount
union all
select items.sale_id, 'stock_movement_differs_from_items'
from stock_by_item items
left join stock_by_movement movements
  on movements.sale_id = items.sale_id and movements.product_id = items.product_id
where coalesce(movements.moved_quantity, 0) <> items.sold_quantity
union all
select movements.sale_id, 'stock_movement_without_sale_item'
from stock_by_movement movements
left join stock_by_item items
  on items.sale_id = movements.sale_id and items.product_id = movements.product_id
where items.sale_id is null
union all
select movement.sale_id, 'missing_or_invalid_student_movement'
from student_sale_movements movement
join target_sales s on s.id = movement.sale_id
where movement.movement_id is null or movement.amount <> -s.total_amount
union all
select s.id, 'sale_without_target_register'
from target_sales s
where s.cash_register_id is null;
