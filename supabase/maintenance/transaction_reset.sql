-- Ejecutar únicamente después de revisar el preview y vaciar las colas offline de cada POS.
begin;

lock table public.sales in share row exclusive mode;
lock table public.sale_items in share row exclusive mode;
lock table public.student_movements in share row exclusive mode;
lock table public.stock_movements in share row exclusive mode;
lock table public.students in share row exclusive mode;
lock table public.products in share row exclusive mode;

do $$
declare
  v_principal_sales bigint;
  v_principal_cash bigint;
  v_sancha_sales bigint;
begin
  if (select count(*) from public.cash_registers
      where name in ('Caja principal', 'Cardenal Sancha') and active) <> 2 then
    raise exception 'both target cash registers must exist and be active';
  end if;

  select count(s.id), coalesce(sum(s.total_amount) filter (
    where s.status = 'completed' and s.payment_method = 'cash'
  ), 0)
  into v_principal_sales, v_principal_cash
  from public.cash_registers cr
  left join public.sales s on s.cash_register_id = cr.id
  where cr.name = 'Caja principal';

  select count(s.id) into v_sancha_sales
  from public.cash_registers cr
  left join public.sales s on s.cash_register_id = cr.id
  where cr.name = 'Cardenal Sancha';

  if v_principal_sales <> 26 or v_principal_cash <> 239500 or v_sancha_sales <> 0 then
    raise exception 'unexpected totals: principal sales %, cash %, Cardenal Sancha sales %',
      v_principal_sales, v_principal_cash, v_sancha_sales;
  end if;

  if exists (
    with target_sales as (
      select s.* from public.sales s join public.cash_registers cr on cr.id = s.cash_register_id
      where cr.name in ('Caja principal', 'Cardenal Sancha')
    ), item_totals as (
      select si.sale_id, sum(si.line_total) as total
      from public.sale_items si join target_sales s on s.id = si.sale_id group by si.sale_id
    )
    select 1 from target_sales s left join item_totals i on i.sale_id = s.id
    where coalesce(i.total, 0) <> s.total_amount
  ) then raise exception 'sale items do not match sale totals'; end if;

  if exists (
    with target_sales as (
      select s.* from public.sales s join public.cash_registers cr on cr.id = s.cash_register_id
      where cr.name in ('Caja principal', 'Cardenal Sancha')
    ), sold as (
      select si.sale_id, si.product_id, sum(si.quantity) as quantity
      from public.sale_items si join target_sales s on s.id = si.sale_id
      group by si.sale_id, si.product_id
    ), effects as (
      select sm.source_sale_id as sale_id, sm.product_id, sum(sm.quantity_delta) as quantity_delta
      from public.stock_movements sm join target_sales s on s.id = sm.source_sale_id
      group by sm.source_sale_id, sm.product_id
    )
    select 1 from sold full join effects e
      on e.sale_id = sold.sale_id and e.product_id = sold.product_id
    join target_sales s on s.id = coalesce(sold.sale_id, e.sale_id)
    where sold.sale_id is null or e.sale_id is null
      or e.quantity_delta <>
        case when s.status = 'completed' then -sold.quantity else 0 end
  ) then raise exception 'inventory movements do not match sale status and items'; end if;

  if exists (
    with target_sales as (
      select s.* from public.sales s join public.cash_registers cr on cr.id = s.cash_register_id
      where cr.name in ('Caja principal', 'Cardenal Sancha')
        and s.payment_method = 'student-account'
    ), original as (
      select s.id as sale_id, s.status, s.total_amount, sm.id as movement_id, sm.amount
      from target_sales s left join public.student_movements sm
        on sm.idempotency_key = 'sale:' || s.idempotency_key
    ), effects as (
      select sale_id, sum(amount) as amount from (
        select sale_id, amount from original
        union all
        select o.sale_id, r.amount from original o
        join public.student_movements r on r.reverses_movement_id = o.movement_id
      ) movements group by sale_id
    )
    select 1 from original o left join effects e on e.sale_id = o.sale_id
    where o.movement_id is null or o.amount <> -o.total_amount
      or coalesce(e.amount, 0) <>
        case when o.status = 'completed' then -o.total_amount else 0 end
  ) then raise exception 'student movements do not match sale status and totals'; end if;

  if exists (
    with target_sales as (
      select s.id from public.sales s join public.cash_registers cr on cr.id = s.cash_register_id
      where cr.name in ('Caja principal', 'Cardenal Sancha')
    ), effects as (
      select sm.product_id, sum(sm.quantity_delta) as quantity_delta
      from public.stock_movements sm join target_sales s on s.id = sm.source_sale_id
      group by sm.product_id
    )
    select 1 from public.products p join effects e on e.product_id = p.id
    where p.stock_quantity - e.quantity_delta < 0
  ) then raise exception 'reset would create negative stock'; end if;
end;
$$;

-- Respaldos persistentes. La ejecución falla si estos nombres ya existen.
create table private.reset_20261104_cash_registers as
select * from public.cash_registers
where name in ('Caja principal', 'Cardenal Sancha');

create table private.reset_20261104_sales as
select s.* from public.sales s
join public.cash_registers cr on cr.id = s.cash_register_id
where cr.name in ('Caja principal', 'Cardenal Sancha');

create table private.reset_20261104_sale_items as
select si.* from public.sale_items si
join private.reset_20261104_sales s on s.id = si.sale_id;

create table private.reset_20261104_stock_movements as
select sm.* from public.stock_movements sm
join private.reset_20261104_sales s on s.id = sm.source_sale_id;

create table private.reset_20261104_student_movements as
with original as (
  select sm.* from public.student_movements sm
  join private.reset_20261104_sales s
    on sm.idempotency_key = 'sale:' || s.idempotency_key
)
select * from original
union all
select reversal.* from public.student_movements reversal
join original on reversal.reverses_movement_id = original.id;

create table private.reset_20261104_students as
select distinct st.* from public.students st
join private.reset_20261104_sales s on s.student_id = st.id;

create table private.reset_20261104_products as
select distinct p.* from public.products p
join private.reset_20261104_stock_movements sm on sm.product_id = p.id;

do $$
begin
  if (select count(*) from private.reset_20261104_sales) <> 26
     or (select count(distinct id) from private.reset_20261104_sales) <> 26 then
    raise exception 'backup does not contain exactly 26 unique sales';
  end if;
end;
$$;

-- Revierte únicamente el efecto neto documentado de las ventas seleccionadas.
with effects as (
  select product_id, sum(quantity_delta) as quantity_delta
  from private.reset_20261104_stock_movements
  group by product_id
)
update public.products p
set stock_quantity = p.stock_quantity - effects.quantity_delta
from effects
where p.id = effects.product_id;

with effects as (
  select student_id, sum(amount) as amount
  from private.reset_20261104_student_movements
  group by student_id
)
update public.students st
set net_balance = st.net_balance - effects.amount
from effects
where st.id = effects.student_id;

-- Elimina primero reversos y detalles para respetar las claves foráneas.
delete from public.stock_movements sm
using private.reset_20261104_stock_movements backup
where sm.id = backup.id and sm.reverses_movement_id is not null;

delete from public.stock_movements sm
using private.reset_20261104_stock_movements backup
where sm.id = backup.id;

delete from public.student_movements sm
using private.reset_20261104_student_movements backup
where sm.id = backup.id and sm.reverses_movement_id is not null;

delete from public.student_movements sm
using private.reset_20261104_student_movements backup
where sm.id = backup.id;

delete from public.sale_items si
using private.reset_20261104_sales backup
where si.sale_id = backup.id;

delete from public.sales s
using private.reset_20261104_sales backup
where s.id = backup.id;

do $$
begin
  if exists (
    select 1 from public.sales s
    join public.cash_registers cr on cr.id = s.cash_register_id
    where cr.name in ('Caja principal', 'Cardenal Sancha')
  ) then raise exception 'target sales remain after reset'; end if;
  if exists (
    select 1 from public.cash_registers
    where name in ('Caja principal', 'Cardenal Sancha') and active = false
  ) then raise exception 'a target cash register is inactive'; end if;
end;
$$;

select
  cr.name,
  cr.active,
  count(s.id) filter (where s.status = 'completed') as completed_sales,
  count(s.id) filter (where s.status = 'voided') as voided_sales,
  coalesce(sum(s.total_amount) filter (
    where s.status = 'completed' and s.payment_method = 'cash'
  ), 0) as cash_total
from public.cash_registers cr
left join public.sales s on s.cash_register_id = cr.id
where cr.name in ('Caja principal', 'Cardenal Sancha')
group by cr.id, cr.name, cr.active
order by cr.name;

commit;
