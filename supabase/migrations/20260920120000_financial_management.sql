-- Fase 7 — financeiro completo (docs/DECISIONS.md, Fase 7).
--
-- O ledger da Fase 2 (payments ≠ financial_transactions, origin_payment_id
-- único, provider+external_id único) é mantido. Esta migration adiciona o
-- que a gestão real precisa:
--
--   1. `financial_transactions.nutritionist_id` (+ patient_id, notes,
--      cancelled_at, cancellation_reason): o ledger passa a ter dono e a
--      RLS deixa de ser "qualquer NUTRITIONIST" para "o dono" (ownership
--      real entre nutricionistas, prompt Fase 7 §57/§89).
--   2. `payments.idempotency_key` (único) + notes/cancelled_at/
--      cancellation_reason/recorded_by — pagamento manual nunca é registrado
--      duas vezes por clique duplo/retry (§26/§82).
--   3. View `installment_payment_summary` (recebido por parcela) e
--      `contract_financial_summary` redefinida para pagamento PARCIAL:
--      pendente/previsto = valor da parcela − recebido (§27/§30).
--   4. Funções transacionais SECURITY INVOKER: `record_manual_payment`
--      (payment + baixa da parcela + lançamento, tudo ou nada; recusa
--      pagamento a maior; idempotente) e `cancel_payment` (reversão com
--      histórico: payment REFUNDED, lançamento CANCELLED, parcela volta a
--      PENDING).
--   5. Funções de agregação SECURITY INVOKER: `financial_period_summary`
--      (receita/despesa/saldo/recebido/pendente/previsto/atrasado do
--      período) e `monthly_financial_series` (série mensal para gráficos) —
--      agregação no banco, não no JS (§96).
--   6. Trigger que impede editar valor/tipo/data de lançamento gerado por
--      pagamento (só lançamento MANUAL é editável — §20) e que preenche
--      nutritionist_id.
--
-- OVERDUE (parcela) e PARTIALLY_PAID NÃO são persistidos: são derivados
-- (vencimento < hoje e não paga; 0 < recebido < valor). Nenhum job diário.

-- 1. Ledger com dono --------------------------------------------------------

alter table public.financial_transactions
  add column nutritionist_id uuid references public.profiles (id) on delete restrict,
  add column patient_id uuid references public.patients (id) on delete set null,
  add column notes text,
  add column cancelled_at timestamptz,
  add column cancellation_reason text;

comment on column public.financial_transactions.nutritionist_id is
  'Dono do lançamento (escopo da RLS). Preenchido pelo trigger a partir de created_by/auth.uid() quando omitido.';
comment on column public.financial_transactions.patient_id is
  'Paciente relacionado quando aplicável (receita de contrato/consulta ou lançamento manual vinculado).';

update public.financial_transactions
  set nutritionist_id = created_by
where nutritionist_id is null and created_by is not null;

-- Lançamentos gerados por pagamento (Fase 2) passam a apontar o paciente.
update public.financial_transactions t
  set patient_id = p.patient_id
from public.payments p
where t.origin_payment_id = p.id and t.patient_id is null;

create index financial_transactions_nutritionist_occurred_idx
  on public.financial_transactions (nutritionist_id, occurred_on desc);
create index financial_transactions_patient_id_idx
  on public.financial_transactions (patient_id);

create or replace function public.guard_financial_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.nutritionist_id is null then
      new.nutritionist_id := coalesce(new.created_by, auth.uid());
    end if;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.amount_cents <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;
    return new;
  end if;

  -- UPDATE: lançamento gerado por pagamento/consulta não tem valor, tipo,
  -- data ou origem editáveis (§20) — só status/observações/categoria.
  if old.origin <> 'MANUAL' and (
       new.amount_cents <> old.amount_cents
    or new.type <> old.type
    or new.occurred_on <> old.occurred_on
    or new.origin <> old.origin
    or new.origin_payment_id is distinct from old.origin_payment_id
  ) then
    raise exception 'FINANCIAL_TRANSACTION_NOT_EDITABLE';
  end if;
  if new.nutritionist_id is distinct from old.nutritionist_id then
    raise exception 'FINANCIAL_TRANSACTION_NOT_AUTHORIZED';
  end if;
  if new.amount_cents <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  -- CANCELLED é final.
  if old.status = 'CANCELLED' and new.status <> 'CANCELLED' then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  return new;
end;
$$;

create trigger guard_financial_transactions
  before insert or update on public.financial_transactions
  for each row
  execute function public.guard_financial_transaction();

drop policy "financial_transactions_nutritionist_only" on public.financial_transactions;

create policy "financial_transactions_select_owner"
  on public.financial_transactions
  for select
  to authenticated
  using (nutritionist_id = auth.uid());

create policy "financial_transactions_insert_owner"
  on public.financial_transactions
  for insert
  to authenticated
  with check (
    public.current_profile_role() = 'NUTRITIONIST'
    and (nutritionist_id is null or nutritionist_id = auth.uid())
    and (patient_id is null or public.is_nutritionist_of_patient(patient_id))
  );

create policy "financial_transactions_update_owner"
  on public.financial_transactions
  for update
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid() and (patient_id is null or public.is_nutritionist_of_patient(patient_id)));

-- Sem policy de DELETE: lançamento errado vira CANCELLED (histórico
-- preservado, §21). Privilégio revogado como reforço.
revoke delete on public.financial_transactions from authenticated, anon;

-- 2. Pagamentos manuais: idempotência e histórico -----------------------------

alter table public.payments
  add column idempotency_key text,
  add column notes text,
  add column recorded_by uuid references public.profiles (id) on delete set null,
  add column cancelled_at timestamptz,
  add column cancellation_reason text;

comment on column public.payments.idempotency_key is
  'Chave gerada pelo formulário de pagamento manual: dois envios iguais (clique duplo/retry) resultam num único pagamento.';

-- Estorno preserva o histórico: um pagamento REFUNDED mantém o paid_at
-- original (a Fase 2 só permitia paid_at em CONFIRMED).
alter table public.payments drop constraint payments_check;
alter table public.payments
  add constraint payments_paid_at_status_check check (status in ('CONFIRMED', 'REFUNDED') or paid_at is null);

create unique index payments_idempotency_key_idx
  on public.payments (idempotency_key)
  where idempotency_key is not null;

revoke delete on public.payments from authenticated, anon;

-- 3. Recebido por parcela + resumo do contrato com pagamento parcial -----------

create view public.installment_payment_summary
with (security_invoker = true) as
select
  i.id as installment_id,
  i.contract_id,
  i.amount_cents,
  coalesce(sum(p.amount_cents) filter (where p.status = 'CONFIRMED'), 0)::integer as received_cents,
  case
    when i.status in ('PAID', 'CANCELLED') then 0
    else greatest(i.amount_cents - coalesce(sum(p.amount_cents) filter (where p.status = 'CONFIRMED'), 0), 0)::integer
  end as remaining_cents
from public.contract_installments i
left join public.payments p on p.installment_id = i.id
group by i.id, i.contract_id, i.amount_cents, i.status;

comment on view public.installment_payment_summary is
  'Recebido (payments CONFIRMED) e restante por parcela. Parcela PAID/CANCELLED tem restante 0 por definição.';

grant select on public.installment_payment_summary to authenticated;

-- Mesmas colunas da Fase 2 (CREATE OR REPLACE exige), agora com
-- pendente/previsto descontando pagamentos parciais.
create or replace view public.contract_financial_summary
with (security_invoker = true) as
select
  c.id as contract_id,
  c.patient_id,
  c.plan_id,
  c.status as contract_status,
  c.contracted_amount_cents,
  coalesce(pay.received_cents, 0) as received_cents,
  coalesce(inst.pending_cents, 0) as pending_cents,
  case when c.status = 'ACTIVE' then coalesce(inst.pending_cents, 0) else 0 end as forecast_cents
from public.patient_contracts c
left join (
  select contract_id, sum(amount_cents) as received_cents
  from public.payments
  where status = 'CONFIRMED' and contract_id is not null
  group by contract_id
) pay on pay.contract_id = c.id
left join (
  select contract_id, sum(remaining_cents) as pending_cents
  from public.installment_payment_summary
  group by contract_id
) inst on inst.contract_id = c.id;

-- 4. Pagamento manual transacional --------------------------------------------

create or replace function public.record_manual_payment(
  p_patient_id uuid,
  p_amount_cents integer,
  p_method public.payment_method,
  p_paid_at timestamptz,
  p_idempotency_key text,
  p_installment_id uuid default null,
  p_contract_id uuid default null,
  p_appointment_id uuid default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_timezone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing uuid;
  v_nutritionist uuid;
  v_patient_name text;
  v_installment public.contract_installments%rowtype;
  v_contract_id uuid;
  v_received integer;
  v_payment_id uuid;
  v_description text;
  v_category uuid;
begin
  -- Idempotência: mesma chave => mesmo pagamento, sem duplicar nada.
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'VALIDATION_ERROR';
  end if;
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then
    raise exception 'VALIDATION_ERROR';
  end if;

  -- Ownership: sob RLS um paciente alheio não existe.
  select nutritionist_id, full_name into v_nutritionist, v_patient_name
  from public.patients where id = p_patient_id;
  if v_nutritionist is null or v_nutritionist <> auth.uid() then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  v_contract_id := p_contract_id;

  if p_installment_id is not null then
    select * into v_installment from public.contract_installments where id = p_installment_id;
    if v_installment.id is null then
      raise exception 'INSTALLMENT_NOT_FOUND';
    end if;
    if not exists (
      select 1 from public.patient_contracts c
      where c.id = v_installment.contract_id and c.patient_id = p_patient_id
        and (p_contract_id is null or c.id = p_contract_id)
    ) then
      raise exception 'INSTALLMENT_NOT_FOUND';
    end if;
    if v_installment.status = 'CANCELLED' then
      raise exception 'INSTALLMENT_NOT_PAYABLE';
    end if;
    select coalesce(sum(amount_cents), 0) into v_received
    from public.payments where installment_id = p_installment_id and status = 'CONFIRMED';
    if v_received >= v_installment.amount_cents then
      raise exception 'INSTALLMENT_NOT_PAYABLE';
    end if;
    -- Pagamento a maior é bloqueado (§28): registre o excedente à parte.
    if v_received + p_amount_cents > v_installment.amount_cents then
      raise exception 'PAYMENT_EXCEEDS_INSTALLMENT';
    end if;
    v_contract_id := v_installment.contract_id;
  elsif p_contract_id is not null then
    if not exists (select 1 from public.patient_contracts c where c.id = p_contract_id and c.patient_id = p_patient_id) then
      raise exception 'CONTRACT_NOT_FOUND';
    end if;
  end if;

  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = p_appointment_id and a.patient_id = p_patient_id
  ) then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  if p_category_id is not null then
    select id into v_category from public.financial_categories where id = p_category_id and type = 'INCOME' and active = true;
    if v_category is null then
      raise exception 'CATEGORY_NOT_FOUND';
    end if;
  else
    select id into v_category from public.financial_categories
    where type = 'INCOME' and active = true order by created_at limit 1;
  end if;

  insert into public.payments (
    patient_id, contract_id, installment_id, appointment_id, provider, amount_cents, method, status, paid_at,
    idempotency_key, notes, recorded_by
  ) values (
    p_patient_id, v_contract_id, p_installment_id, p_appointment_id, 'MANUAL', p_amount_cents, p_method, 'CONFIRMED', p_paid_at,
    p_idempotency_key, nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_payment_id;

  -- Baixa da parcela só quando o recebido cobre o valor (§30).
  if p_installment_id is not null and v_received + p_amount_cents = v_installment.amount_cents then
    update public.contract_installments
      set status = 'PAID', paid_at = p_paid_at
    where id = p_installment_id;
  end if;

  v_description := case
    when p_installment_id is not null then
      'Parcela ' || v_installment.number || ' — ' || v_patient_name
    when p_appointment_id is not null then
      'Consulta — ' || v_patient_name
    else 'Pagamento — ' || v_patient_name
  end;

  insert into public.financial_transactions (
    nutritionist_id, patient_id, type, category_id, description, amount_cents, status, occurred_on, paid_at,
    payment_method, origin, origin_payment_id, created_by, notes
  ) values (
    auth.uid(), p_patient_id, 'INCOME', v_category, v_description, p_amount_cents, 'CONFIRMED',
    (p_paid_at at time zone p_timezone)::date, p_paid_at,
    p_method, 'PAYMENT', v_payment_id, auth.uid(), nullif(btrim(p_notes), '')
  );

  return v_payment_id;
exception
  when unique_violation then
    -- Corrida entre dois envios com a mesma chave: devolve o que venceu.
    select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
    raise;
end;
$$;

comment on function public.record_manual_payment(uuid, integer, public.payment_method, timestamptz, text, uuid, uuid, uuid, uuid, text, text) is
  'Pagamento manual atômico: payment CONFIRMED + baixa da parcela (quando quitada) + lançamento INCOME (origin PAYMENT). Idempotente por idempotency_key. Recusa pagamento a maior.';

create or replace function public.cancel_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_received integer;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status <> 'CONFIRMED' then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.payments
    set status = 'REFUNDED', cancelled_at = now(), cancellation_reason = nullif(btrim(p_reason), '')
  where id = p_payment_id;

  update public.financial_transactions
    set status = 'CANCELLED', cancelled_at = now(), cancellation_reason = nullif(btrim(p_reason), '')
  where origin_payment_id = p_payment_id and status <> 'CANCELLED';

  -- A parcela volta a PENDING (ou continua PENDING com saldo parcial).
  if v_payment.installment_id is not null then
    select coalesce(sum(amount_cents), 0) into v_received
    from public.payments where installment_id = v_payment.installment_id and status = 'CONFIRMED';
    update public.contract_installments i
      set status = 'PENDING', paid_at = null
    where i.id = v_payment.installment_id
      and i.status = 'PAID'
      and v_received < i.amount_cents;
  end if;
end;
$$;

comment on function public.cancel_payment(uuid, text) is
  'Reversão manual: payment REFUNDED, lançamento CANCELLED, parcela reaberta. Nada é apagado.';

-- 5. Agregações -----------------------------------------------------------------

-- Receita/despesa/saldo por lançamentos CONFIRMED (occurred_on no período);
-- recebido por pagamentos CONFIRMED (paid_at no período, no fuso);
-- pendente/previsto/atrasado por parcelas em aberto (vencimento no período).
create or replace function public.financial_period_summary(
  p_from date,
  p_to date,
  p_timezone text default 'America/Sao_Paulo'
)
returns table (
  income_cents bigint,
  expense_cents bigint,
  balance_cents bigint,
  received_cents bigint,
  pending_cents bigint,
  forecast_cents bigint,
  overdue_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tx as (
    select
      coalesce(sum(amount_cents) filter (where type = 'INCOME'), 0)::bigint as income_cents,
      coalesce(sum(amount_cents) filter (where type = 'EXPENSE'), 0)::bigint as expense_cents
    from public.financial_transactions
    where nutritionist_id = auth.uid()
      and status = 'CONFIRMED'
      and occurred_on between p_from and p_to
  ),
  pay as (
    select coalesce(sum(p.amount_cents), 0)::bigint as received_cents
    from public.payments p
    join public.patients pt on pt.id = p.patient_id
    where pt.nutritionist_id = auth.uid()
      and p.status = 'CONFIRMED'
      and (p.paid_at at time zone p_timezone)::date between p_from and p_to
  ),
  inst as (
    select
      coalesce(sum(s.remaining_cents), 0)::bigint as pending_cents,
      coalesce(sum(s.remaining_cents) filter (where c.status = 'ACTIVE'), 0)::bigint as forecast_cents,
      coalesce(sum(s.remaining_cents) filter (where i.due_date < (now() at time zone p_timezone)::date), 0)::bigint as overdue_cents
    from public.installment_payment_summary s
    join public.contract_installments i on i.id = s.installment_id
    join public.patient_contracts c on c.id = i.contract_id
    join public.patients pt on pt.id = c.patient_id
    where pt.nutritionist_id = auth.uid()
      and c.status <> 'CANCELLED'
      and i.status not in ('CANCELLED', 'PAID')
      and i.due_date between p_from and p_to
  )
  select
    tx.income_cents,
    tx.expense_cents,
    tx.income_cents - tx.expense_cents as balance_cents,
    pay.received_cents,
    inst.pending_cents,
    inst.forecast_cents,
    inst.overdue_cents
  from tx, pay, inst;
$$;

-- Série mensal (últimos N meses até o mês corrente, no fuso): receita e
-- despesa CONFIRMED por occurred_on; recebido por paid_at; previsto por
-- vencimento de parcelas abertas de contratos ACTIVE.
create or replace function public.monthly_financial_series(
  p_months integer default 6,
  p_timezone text default 'America/Sao_Paulo',
  p_months_ahead integer default 0
)
returns table (
  month_start date,
  income_cents bigint,
  expense_cents bigint,
  received_cents bigint,
  due_cents bigint,
  forecast_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select (date_trunc('month', (now() at time zone p_timezone)::date) - make_interval(months => g))::date as month_start
    from generate_series(-greatest(p_months_ahead, 0), greatest(p_months, 1) - 1) as g
  )
  select
    m.month_start,
    coalesce((
      select sum(t.amount_cents) from public.financial_transactions t
      where t.nutritionist_id = auth.uid() and t.status = 'CONFIRMED' and t.type = 'INCOME'
        and t.occurred_on >= m.month_start and t.occurred_on < (m.month_start + interval '1 month')::date
    ), 0)::bigint as income_cents,
    coalesce((
      select sum(t.amount_cents) from public.financial_transactions t
      where t.nutritionist_id = auth.uid() and t.status = 'CONFIRMED' and t.type = 'EXPENSE'
        and t.occurred_on >= m.month_start and t.occurred_on < (m.month_start + interval '1 month')::date
    ), 0)::bigint as expense_cents,
    coalesce((
      select sum(p.amount_cents) from public.payments p
      join public.patients pt on pt.id = p.patient_id
      where pt.nutritionist_id = auth.uid() and p.status = 'CONFIRMED'
        and (p.paid_at at time zone p_timezone)::date >= m.month_start
        and (p.paid_at at time zone p_timezone)::date < (m.month_start + interval '1 month')::date
    ), 0)::bigint as received_cents,
    -- Vencimentos do mês (contratos e parcelas não cancelados): o que estava
    -- planejado receber, pago ou não — base do gráfico "recebido x previsto".
    coalesce((
      select sum(i.amount_cents)
      from public.contract_installments i
      join public.patient_contracts c on c.id = i.contract_id
      join public.patients pt on pt.id = c.patient_id
      where pt.nutritionist_id = auth.uid() and c.status <> 'CANCELLED'
        and i.status <> 'CANCELLED'
        and i.due_date >= m.month_start and i.due_date < (m.month_start + interval '1 month')::date
    ), 0)::bigint as due_cents,
    coalesce((
      select sum(s.remaining_cents)
      from public.installment_payment_summary s
      join public.contract_installments i on i.id = s.installment_id
      join public.patient_contracts c on c.id = i.contract_id
      join public.patients pt on pt.id = c.patient_id
      where pt.nutritionist_id = auth.uid() and c.status = 'ACTIVE'
        and i.status not in ('CANCELLED', 'PAID')
        and i.due_date >= m.month_start and i.due_date < (m.month_start + interval '1 month')::date
    ), 0)::bigint as forecast_cents
  from months m
  order by m.month_start;
$$;

revoke execute on function public.record_manual_payment(uuid, integer, public.payment_method, timestamptz, text, uuid, uuid, uuid, uuid, text, text) from public;
revoke execute on function public.cancel_payment(uuid, text) from public;
revoke execute on function public.financial_period_summary(date, date, text) from public;
revoke execute on function public.monthly_financial_series(integer, text, integer) from public;

grant execute on function public.record_manual_payment(uuid, integer, public.payment_method, timestamptz, text, uuid, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.cancel_payment(uuid, text) to authenticated;
grant execute on function public.financial_period_summary(date, date, text) to authenticated;
grant execute on function public.monthly_financial_series(integer, text, integer) to authenticated;
