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
