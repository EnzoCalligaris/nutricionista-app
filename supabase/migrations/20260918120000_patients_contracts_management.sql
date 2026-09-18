-- Fase 5 — gestão de pacientes, planos e contratos (docs/DECISIONS.md, Fase 5).
--
-- Nada aqui redesenha o schema da Fase 2: são complementos que a tela de
-- gestão precisa e que não dá para expressar com segurança só na aplicação:
--
--   1. `patient_contracts.notes` — observações administrativas do contrato
--      (prompt Fase 5 §27, "quando schema permitir": não existia).
--   2. Índice único parcial em `patients (nutritionist_id, lower(email))` —
--      e-mail duplicado para o mesmo nutricionista nunca é criado
--      silenciosamente, nem numa corrida entre duas requisições (§15).
--   3. View `patient_overview` (security_invoker) — a listagem de pacientes
--      com plano atual, valores e próxima consulta em UMA query paginável
--      via PostgREST, em vez de N+1 no servidor (§58). Respeita a RLS de
--      `patients`/`patient_contracts`/`plans`/`appointments` de quem
--      consulta.
--   4. Funções `create_contract_with_installments`, `cancel_contract` e
--      `complete_contract` — contrato + parcelas nascem/mudam de status numa
--      única transação (PostgREST não oferece transação entre dois inserts).
--      São SECURITY INVOKER de propósito: a RLS das tabelas continua valendo
--      dentro delas, então um nutricionista só cria/cancela contrato de
--      paciente que `is_nutritionist_of_patient()` autoriza.

-- 1. Observações administrativas do contrato ------------------------------

alter table public.patient_contracts
  add column notes text;

comment on column public.patient_contracts.notes is
  'Observações administrativas livres (condição negociada, contexto). Nunca dado clínico.';

-- 2. E-mail único por nutricionista -----------------------------------------

create unique index patients_nutritionist_email_unique_idx
  on public.patients (nutritionist_id, lower(email))
  where email is not null;

comment on index public.patients_nutritionist_email_unique_idx is
  'Um mesmo nutricionista não cadastra dois pacientes com o mesmo e-mail (case-insensitive). Vale também para arquivados: reativar > duplicar.';

-- 3. View de listagem -------------------------------------------------------

create view public.patient_overview
with (security_invoker = true) as
select
  p.id as patient_id,
  p.nutritionist_id,
  p.profile_id,
  p.full_name,
  p.email,
  p.phone,
  p.birth_date,
  p.status as patient_status,
  p.archived_at,
  p.created_at,
  p.updated_at,
  (cur.id is not null) as has_active_contract,
  -- Mesma regra da view patient_active_status (Fase 2): status manual
  -- ACTIVE E contrato vigente. Override administrativo continua sendo
  -- patients.status (docs/DECISIONS.md).
  (p.status = 'ACTIVE' and cur.id is not null) as is_effectively_active,
  cur.id as current_contract_id,
  cur.plan_id as current_plan_id,
  pl.code as current_plan_code,
  pl.name as current_plan_name,
  cur.contracted_amount_cents as current_contracted_amount_cents,
  cur.start_date as current_start_date,
  cur.end_date as current_end_date,
  nxt.starts_at as next_appointment_at,
  nxt.modality as next_appointment_modality
from public.patients p
-- "Contrato atual" = contrato ACTIVE mais recente (por start_date). Quando
-- coexistem plano principal + consulta avulsa (§43, PENDENTE DE DEFINIÇÃO),
-- vence o de início mais recente — os demais continuam no histórico.
left join lateral (
  select c.id, c.plan_id, c.contracted_amount_cents, c.start_date, c.end_date
  from public.patient_contracts c
  where c.patient_id = p.id and c.status = 'ACTIVE'
  order by c.start_date desc, c.created_at desc
  limit 1
) cur on true
left join public.plans pl on pl.id = cur.plan_id
left join lateral (
  select a.starts_at, a.modality
  from public.appointments a
  where a.patient_id = p.id
    and a.status in ('SCHEDULED', 'CONFIRMED')
    and a.starts_at >= now()
  order by a.starts_at asc
  limit 1
) nxt on true;

comment on view public.patient_overview is
  'Listagem do dashboard: paciente + contrato ACTIVE mais recente + próxima consulta, numa query só. security_invoker: RLS das tabelas base vale para quem consulta.';

grant select on public.patient_overview to authenticated;

-- 4. Funções transacionais de contrato ------------------------------------
--
-- Mensagens de erro são códigos estáveis (ex.: INVALID_INSTALLMENTS) que a
-- aplicação mapeia para texto amigável — nunca mostrados crus ao usuário
-- (prompt Fase 5 §48).

-- Parâmetros opcionais (preço, término, observações) vêm por último com
-- default null para que o cliente possa simplesmente omiti-los.
create or replace function public.create_contract_with_installments(
  p_patient_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_contracted_amount_cents integer,
  p_installments jsonb,
  p_plan_price_id uuid default null,
  p_end_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract_id uuid;
  v_count integer;
  v_sum bigint;
  v_expected_numbers integer;
  v_plan_active boolean;
  v_price_plan_id uuid;
begin
  -- Ownership: sob RLS, paciente de outro nutricionista simplesmente não
  -- existe para quem chama.
  if not exists (
    select 1 from public.patients where id = p_patient_id and nutritionist_id = auth.uid()
  ) then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  select active into v_plan_active from public.plans where id = p_plan_id;
  if v_plan_active is distinct from true then
    raise exception 'PLAN_NOT_AVAILABLE';
  end if;

  if p_plan_price_id is not null then
    select plan_id into v_price_plan_id from public.plan_prices where id = p_plan_price_id and active = true;
    if v_price_plan_id is null or v_price_plan_id <> p_plan_id then
      raise exception 'PLAN_NOT_AVAILABLE';
    end if;
  end if;

  if p_start_date is null or (p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'INVALID_CONTRACT_PERIOD';
  end if;

  if p_contracted_amount_cents is null or p_contracted_amount_cents < 0 then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  if p_installments is null or jsonb_typeof(p_installments) <> 'array' then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  select count(*), coalesce(sum((i->>'amount_cents')::bigint), 0)
    into v_count, v_sum
  from jsonb_array_elements(p_installments) as i;

  if v_count < 1 then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  -- Nenhum centavo se perde: a soma das parcelas é exatamente o contratado.
  if v_sum <> p_contracted_amount_cents then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  -- Numeração 1..n sem buracos nem repetição.
  select count(distinct (i->>'number')::integer)
    into v_expected_numbers
  from jsonb_array_elements(p_installments) as i
  where (i->>'number')::integer between 1 and v_count;

  if v_expected_numbers <> v_count then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_installments) as i
    where (i->>'amount_cents')::bigint < 0 or (i->>'due_date') is null
  ) then
    raise exception 'INVALID_INSTALLMENTS';
  end if;

  insert into public.patient_contracts (
    patient_id, plan_id, plan_price_id, start_date, end_date, status, contracted_amount_cents, notes
  ) values (
    p_patient_id, p_plan_id, p_plan_price_id, p_start_date, p_end_date, 'ACTIVE', p_contracted_amount_cents, nullif(btrim(p_notes), '')
  )
  returning id into v_contract_id;

  insert into public.contract_installments (contract_id, number, amount_cents, due_date, status)
  select
    v_contract_id,
    (i->>'number')::integer,
    (i->>'amount_cents')::integer,
    (i->>'due_date')::date,
    'PENDING'
  from jsonb_array_elements(p_installments) as i;

  return v_contract_id;
end;
$$;

comment on function public.create_contract_with_installments(uuid, uuid, date, integer, jsonb, uuid, date, text) is
  'Cria contrato + parcelas numa transação. SECURITY INVOKER: RLS continua valendo. Parcelas vêm calculadas pela aplicação (src/domain/contracts/installments.ts) e são validadas aqui (soma exata, numeração 1..n).';

create or replace function public.cancel_contract(p_contract_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.patient_contracts
    set status = 'CANCELLED', cancelled_at = now()
  where id = p_contract_id and status = 'ACTIVE';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Não existe, não é do nutricionista (RLS) ou já não está ACTIVE.
    if exists (select 1 from public.patient_contracts where id = p_contract_id) then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    raise exception 'CONTRACT_NOT_FOUND';
  end if;

  -- Parcelas em aberto deixam de ser cobradas; as PAID ficam intactas
  -- (histórico e financeiro preservados — prompt Fase 5 §35).
  update public.contract_installments
    set status = 'CANCELLED'
  where contract_id = p_contract_id and status in ('PENDING', 'OVERDUE');
end;
$$;

comment on function public.cancel_contract(uuid) is
  'ACTIVE -> CANCELLED + parcelas PENDING/OVERDUE -> CANCELLED, numa transação. Nada é apagado.';

create or replace function public.complete_contract(p_contract_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.patient_contracts
    set status = 'COMPLETED'
  where id = p_contract_id and status = 'ACTIVE';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    if exists (select 1 from public.patient_contracts where id = p_contract_id) then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    raise exception 'CONTRACT_NOT_FOUND';
  end if;
  -- Parcelas não mudam: uma parcela ainda pendente de um contrato encerrado
  -- continua sendo um valor a receber (pending_cents na view financeira).
end;
$$;

comment on function public.complete_contract(uuid) is
  'ACTIVE -> COMPLETED. Parcelas intactas.';

revoke execute on function public.create_contract_with_installments(uuid, uuid, date, integer, jsonb, uuid, date, text) from public;
revoke execute on function public.cancel_contract(uuid) from public;
revoke execute on function public.complete_contract(uuid) from public;

grant execute on function public.create_contract_with_installments(uuid, uuid, date, integer, jsonb, uuid, date, text) to authenticated;
grant execute on function public.cancel_contract(uuid) to authenticated;
grant execute on function public.complete_contract(uuid) to authenticated;
