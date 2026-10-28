begin;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.profiles where role = 'administrator' and active limit 1),
  true
);
select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', user_id, 'role', 'authenticated')::text
   from public.profiles where role = 'administrator' and active limit 1),
  true
);
set local role authenticated;

select public.record_stock_movement(
  'agua-bolsa', 10, 'entry', 'Prueba transaccional de inventario', 'audit:inventory:entry'
);
select public.record_stock_movement(
  'agua-bolsa', 10, 'entry', 'Prueba transaccional de inventario', 'audit:inventory:entry'
);

select public.record_cash_sale(
  '20000000-0000-4000-8000-000000000001',
  800,
  '[{"productId":"agua-bolsa","productName":"ignorado","unitPrice":1,"quantity":1}]'::jsonb,
  'audit:cash-sale'
);
select public.record_cash_sale(
  '20000000-0000-4000-8000-000000000002',
  800,
  '[{"productId":"agua-bolsa","productName":"ignorado","unitPrice":1,"quantity":1}]'::jsonb,
  'audit:cash-sale'
);

do $$
declare
  v_stock integer;
  v_sales integer;
  v_cash_total bigint;
  v_register uuid;
begin
  select stock_quantity into v_stock from public.products where id = 'agua-bolsa';
  select count(*) into v_sales from public.sales where idempotency_key = 'audit:cash-sale';
  select cash_register_id into v_register from public.sales where idempotency_key = 'audit:cash-sale';
  select coalesce(sum(total_amount), 0) into v_cash_total from public.sales
  where idempotency_key = 'audit:cash-sale' and payment_method = 'cash' and status = 'completed';
  if v_stock <> 9 then raise exception 'expected stock 9 after one sale, got %', v_stock; end if;
  if v_sales <> 1 then raise exception 'expected one sale, got %', v_sales; end if;
  if v_register is null then raise exception 'expected cash register assignment'; end if;
  if v_cash_total <> 800 then raise exception 'expected cash report 800, got %', v_cash_total; end if;
end;
$$;

select public.void_sale(
  '20000000-0000-4000-8000-000000000001', 'Prueba de reverso auditable', 'audit-device'
);
select public.void_sale(
  '20000000-0000-4000-8000-000000000001', 'Prueba de reverso auditable', 'audit-device'
);

do $$
declare
  v_stock integer;
  v_movements integer;
begin
  select stock_quantity into v_stock from public.products where id = 'agua-bolsa';
  if v_stock <> 10 then raise exception 'expected stock 10, got %', v_stock; end if;

  select count(*) into v_movements from public.stock_movements
  where idempotency_key like 'audit:%'
     or source_sale_id = '20000000-0000-4000-8000-000000000001';
  if v_movements <> 3 then raise exception 'expected 3 movements, got %', v_movements; end if;
end;
$$;

rollback;
