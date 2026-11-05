begin;

create temporary table cash_register_test_context as
select
  cashier.user_id as cashier_user_id,
  cashier.cash_register_id as assigned_register_id,
  (select id from public.cash_registers where active and id <> cashier.cash_register_id order by id limit 1) as other_register_id,
  (select user_id from public.profiles where role = 'administrator' and active order by created_at limit 1) as administrator_user_id
from public.profiles cashier
where cashier.role = 'cashier' and cashier.active and cashier.cash_register_id is not null
order by cashier.created_at
limit 1;

grant select on cash_register_test_context to authenticated;

do $$
begin
  if not exists (
    select 1 from cash_register_test_context
    where cashier_user_id is not null and assigned_register_id is not null
      and other_register_id is not null and administrator_user_id is not null
  ) then raise exception 'authorization test requires an active cashier, administrator and two active registers'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', cashier_user_id::text, true)
from cash_register_test_context;
set local role authenticated;

do $$
declare
  v_assigned uuid;
  v_other uuid;
begin
  select assigned_register_id, other_register_id into v_assigned, v_other
  from cash_register_test_context;

  if (select count(*) from public.cash_registers) <> 1 then
    raise exception 'cashier must only see the assigned register';
  end if;

  begin
    perform public.record_cash_sale(
      gen_random_uuid(), 1, '[]'::jsonb, 'test:assigned-register', v_assigned
    );
  exception when others then
    if sqlerrm <> 'sale total mismatch' then raise; end if;
  end;

  begin
    perform public.record_cash_sale(
      gen_random_uuid(), 1, '[]'::jsonb, 'test:other-register', v_other
    );
    raise exception 'cashier sale in another register was not rejected';
  exception when others then
    if sqlerrm <> 'cash register not assigned to cashier' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', administrator_user_id::text, true)
from cash_register_test_context;
set local role authenticated;

do $$
declare
  v_other uuid;
begin
  select other_register_id into v_other from cash_register_test_context;
  begin
    perform public.record_cash_sale(
      gen_random_uuid(), 1, '[]'::jsonb, 'test:administrator-register', v_other
    );
  exception when others then
    if sqlerrm <> 'sale total mismatch' then raise; end if;
  end;
end;
$$;

rollback;
