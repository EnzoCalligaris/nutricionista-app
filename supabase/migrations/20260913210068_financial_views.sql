-- Views de leitura para cálculos recorrentes (prompt Fase 2 §57). Ambas usam
-- security_invoker = true: a view roda com o papel e o RLS de quem consulta,
-- não do dono da view — sem isso, uma view SECURITY DEFINER-like vazaria
-- dados além do que a RLS das tabelas base permitiria.

create view public.contract_financial_summary
with (security_invoker = true) as
select
  c.id as contract_id,
  c.patient_id,
  c.plan_id,
  c.status as contract_status,
  c.contracted_amount_cents,
  coalesce(pay.received_cents, 0) as received_cents,
  coalesce(inst.pending_cents, 0) as pending_cents,
  -- Previsto = pendente só enquanto o contrato ainda está ativo; um
  -- contrato cancelado não projeta receita futura (prompt Fase 2 §56).
  case when c.status = 'ACTIVE' then coalesce(inst.pending_cents, 0) else 0 end as forecast_cents
from public.patient_contracts c
left join (
  select contract_id, sum(amount_cents) as received_cents
  from public.payments
  where status = 'CONFIRMED' and contract_id is not null
  group by contract_id
) pay on pay.contract_id = c.id
left join (
  select contract_id, sum(amount_cents) as pending_cents
  from public.contract_installments
  where status in ('PENDING', 'OVERDUE')
  group by contract_id
) inst on inst.contract_id = c.id;

comment on view public.contract_financial_summary is
  'Contratado / recebido / pendente / previsto por contrato — nunca soma o valor total do contrato como receita de uma vez (prompt Fase 2 §56/§9).';

grant select on public.contract_financial_summary to authenticated;

-- "Paciente ativo" não depende só de patients.status (prompt Fase 2 §58) —
-- deriva também da existência de contrato ACTIVE. is_effectively_active
-- combina os dois: só é true quando o status manual permite E há contrato
-- vigente.
create view public.patient_active_status
with (security_invoker = true) as
select
  p.id as patient_id,
  p.nutritionist_id,
  p.status as patient_status,
  exists (
    select 1 from public.patient_contracts pc
    where pc.patient_id = p.id and pc.status = 'ACTIVE'
  ) as has_active_contract,
  (
    p.status = 'ACTIVE'
    and exists (
      select 1 from public.patient_contracts pc
      where pc.patient_id = p.id and pc.status = 'ACTIVE'
    )
  ) as is_effectively_active
from public.patients p;

comment on view public.patient_active_status is
  'is_effectively_active = patients.status = ACTIVE E existe patient_contracts.status = ACTIVE. Override administrativo continua possível via patients.status (docs/DECISIONS.md).';

grant select on public.patient_active_status to authenticated;
