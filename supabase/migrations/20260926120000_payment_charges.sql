-- Fase 13 — Pagamentos online: cobrança (charge) x pagamento (payment).
--
-- O provider NÃO é a contabilidade do produto. A fonte continua sendo
-- `payments` + `contract_installments` + `financial_transactions` (Fase 7).
-- Esta migration acrescenta só o que falta para receber dinheiro online:
--
--   payment_charges              cobrança criada no provider (PIX/cartão),
--                                com expiração, idempotência e vínculo com a
--                                parcela/consulta. Uma cobrança ATIVA por
--                                parcela (índice único parcial).
--   payment_webhook_events       evento técnico recebido do provider
--                                (idempotente por provider + event_id).
--   payment_reconciliation_items divergências que NUNCA são corrigidas em
--                                silêncio (valor divergente, moeda, parcela
--                                já quitada, status desconhecido…).
--
-- A baixa financeira é UMA só implementação: `apply_payment_effects`
-- (insere `payments`, quita a parcela quando o recebido cobre o valor e
-- cria o lançamento INCOME). `record_manual_payment` (Fase 7) passa a
-- delegar para ela — mesma regra para manual e online, sem segunda versão
-- de "marcar parcela paga". Nenhuma migration anterior é editada.

-- 1. Enums ------------------------------------------------------------------

create type public.payment_charge_status as enum ('CREATED', 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED');
comment on type public.payment_charge_status is
  'CREATED (cobrança nossa, ainda sem provider) → PENDING (aguardando pagamento) → PAID | EXPIRED | CANCELLED | FAILED. Só o webhook/consulta ao provider confirma PAID.';

create type public.payment_webhook_status as enum ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

create type public.payment_reconciliation_status as enum ('OPEN', 'RESOLVED', 'IGNORED');

-- 2. Cobranças --------------------------------------------------------------

create table public.payment_charges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  contract_id uuid references public.patient_contracts (id) on delete set null,
  installment_id uuid references public.contract_installments (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  -- Identificador técnico do adapter (`fake`, e o real quando existir).
  provider text not null,
  provider_charge_id text,
  -- Ambiente do provider no momento da criação ('sandbox' | 'production' | 'simulated').
  provider_environment text not null default 'simulated',
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status public.payment_charge_status not null default 'CREATED',
  -- Idempotência da CRIAÇÃO (clique duplo / retry): mesma chave = mesma cobrança.
  idempotency_key text not null,
  -- URL de checkout hospedado do provider (quando houver). Sempre https.
  checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
  -- "Pix copia e cola" (EMV). É um código de pagamento, não um segredo, mas
  -- nunca vai para log, auditoria ou e-mail.
  pix_payload text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  -- Pagamento resultante (a contabilidade fica em `payments`).
  payment_id uuid references public.payments (id) on delete set null,
  last_error_code text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'PAID' or (paid_at is not null and payment_id is not null)),
  check (status <> 'CANCELLED' or cancelled_at is not null)
);

comment on table public.payment_charges is
  'Cobrança online (intenção de pagamento). NÃO é receita: só o `payment` CONFIRMED vinculado entra no financeiro. Criada pelo paciente ou pelo nutricionista; confirmada apenas server-side (webhook assinado ou consulta ao provider).';
comment on column public.payment_charges.pix_payload is
  'Código EMV do Pix devolvido pelo provider, para exibir/copiar. Nunca logado nem auditado por extenso.';

create unique index payment_charges_idempotency_key_idx on public.payment_charges (idempotency_key);
create unique index payment_charges_provider_charge_idx on public.payment_charges (provider, provider_charge_id) where provider_charge_id is not null;
-- Uma cobrança ativa por parcela (§47/§49): recarregar a tela reaproveita, não cria outra.
create unique index payment_charges_active_installment_idx
  on public.payment_charges (installment_id)
  where installment_id is not null and status in ('CREATED', 'PENDING');
create unique index payment_charges_active_appointment_idx
  on public.payment_charges (appointment_id)
  where appointment_id is not null and status in ('CREATED', 'PENDING');
create index payment_charges_patient_idx on public.payment_charges (patient_id, created_at desc);
create index payment_charges_nutritionist_idx on public.payment_charges (nutritionist_id, created_at desc);
create index payment_charges_open_idx on public.payment_charges (status, expires_at) where status in ('CREATED', 'PENDING');

create trigger set_payment_charges_updated_at
  before update on public.payment_charges
  for each row execute function public.set_updated_at();

-- 3. Eventos de webhook (técnico) -------------------------------------------

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  charge_id uuid references public.payment_charges (id) on delete set null,
  provider_charge_id text,
  status public.payment_webhook_status not null default 'RECEIVED',
  -- Só o resumo sanitizado (status, valor, moeda, ids) — nunca o payload cru.
  summary jsonb not null default '{}'::jsonb,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.payment_webhook_events is
  'Idempotência do webhook: o mesmo (provider, provider_event_id) nunca produz dois efeitos financeiros. `summary` guarda só o mínimo sanitizado para reconciliação/auditoria técnica — nunca dados de cartão, PII desnecessária ou payload completo.';

create unique index payment_webhook_events_provider_event_idx on public.payment_webhook_events (provider, provider_event_id);
create index payment_webhook_events_charge_idx on public.payment_webhook_events (charge_id, received_at desc);

-- 4. Reconciliação -----------------------------------------------------------

create table public.payment_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  charge_id uuid references public.payment_charges (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  kind text not null check (kind ~ '^[A-Z_]{3,40}$'),
  status public.payment_reconciliation_status not null default 'OPEN',
  detail jsonb not null default '{}'::jsonb,
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status = 'OPEN' or resolved_at is not null)
);

comment on table public.payment_reconciliation_items is
  'Divergência financeira que exige decisão humana (valor/moeda divergente, cobrança paga para parcela já quitada, status desconhecido, pendente antiga). Nada é corrigido em silêncio: dinheiro não some.';

create unique index payment_reconciliation_open_idx
  on public.payment_reconciliation_items (kind, coalesce(charge_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(payment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'OPEN';
create index payment_reconciliation_nutritionist_idx on public.payment_reconciliation_items (nutritionist_id, status, created_at desc);

-- 5. RLS ---------------------------------------------------------------------

alter table public.payment_charges enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.payment_reconciliation_items enable row level security;

-- Leitura: nutricionista dono e o próprio paciente (o paciente precisa ver a
-- própria cobrança para pagar). Escrita só pelas funções abaixo / service role.
create policy "payment_charges_select"
  on public.payment_charges
  for select
  to authenticated
  using (
    nutritionist_id = auth.uid()
    or public.is_patient_self(patient_id)
  );

-- payment_webhook_events: sem policy nenhuma (só service role). Evento técnico
-- do provider não é dado de paciente nem de nutricionista.

create policy "payment_reconciliation_owner"
  on public.payment_reconciliation_items
  for select
  to authenticated
  using (nutritionist_id = auth.uid());

create policy "payment_reconciliation_resolve"
  on public.payment_reconciliation_items
  for update
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

-- O paciente passa a ver os PRÓPRIOS pagamentos (portal financeiro). A policy
-- da Fase 2/7 (`payments_nutritionist_only`, FOR ALL) continua valendo para o
-- nutricionista; esta é só de SELECT e só do próprio paciente.
create policy "payments_select_patient_self"
  on public.payments
  for select
  to authenticated
  using (public.is_patient_self(patient_id));

-- 6. Baixa financeira única (manual e online usam a MESMA implementação) -----

/**
 * Efeitos de um pagamento confirmado: linha em `payments`, baixa da parcela
 * quando o recebido cobre o valor e lançamento INCOME. Idempotente por
 * `p_idempotency_key`. SECURITY DEFINER porque o webhook roda sem sessão —
 * a AUTORIZAÇÃO é responsabilidade de quem chama (record_manual_payment
 * confere ownership sob RLS; record_online_payment parte de uma cobrança
 * existente). EXECUTE não é concedido a authenticated.
 */
create or replace function public.apply_payment_effects(
  p_patient_id uuid,
  p_amount_cents integer,
  p_method public.payment_method,
  p_paid_at timestamptz,
  p_idempotency_key text,
  p_provider text,
  p_external_id text,
  p_nutritionist_id uuid,
  p_recorded_by uuid,
  p_installment_id uuid default null,
  p_contract_id uuid default null,
  p_appointment_id uuid default null,
  p_category_id uuid default null,
  p_notes text default null,
  p_timezone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_patient_name text;
  v_installment public.contract_installments%rowtype;
  v_contract_id uuid;
  v_received integer;
  v_payment_id uuid;
  v_description text;
  v_category uuid;
begin
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

  select full_name into v_patient_name from public.patients where id = p_patient_id;
  if v_patient_name is null then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  v_contract_id := p_contract_id;

  if p_installment_id is not null then
    -- Trava a parcela: dois pagamentos simultâneos não podem ultrapassar o valor.
    select * into v_installment from public.contract_installments where id = p_installment_id for update;
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
    -- Pagamento a maior é bloqueado (Fase 7 §28): o excedente entra à parte.
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
    patient_id, contract_id, installment_id, appointment_id, provider, external_id, amount_cents, method, status, paid_at,
    idempotency_key, notes, recorded_by
  ) values (
    p_patient_id, v_contract_id, p_installment_id, p_appointment_id, p_provider, p_external_id, p_amount_cents, p_method, 'CONFIRMED', p_paid_at,
    p_idempotency_key, nullif(btrim(p_notes), ''), p_recorded_by
  )
  returning id into v_payment_id;

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
    p_nutritionist_id, p_patient_id, 'INCOME', v_category, v_description, p_amount_cents, 'CONFIRMED',
    (p_paid_at at time zone p_timezone)::date, p_paid_at,
    p_method, 'PAYMENT', v_payment_id, p_recorded_by, nullif(btrim(p_notes), '')
  );

  return v_payment_id;
exception
  when unique_violation then
    select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
    raise;
end;
$$;

revoke execute on function public.apply_payment_effects(uuid, integer, public.payment_method, timestamptz, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_payment_effects(uuid, integer, public.payment_method, timestamptz, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text) to service_role;

/**
 * Pagamento manual (Fase 7) — mesma assinatura, mesmas regras, agora
 * delegando a baixa para `apply_payment_effects`. Continua SECURITY INVOKER:
 * a validação de ownership acontece sob a RLS de quem chama.
 */
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
  v_nutritionist uuid;
begin
  -- Ownership: sob RLS um paciente alheio não existe.
  select nutritionist_id into v_nutritionist from public.patients where id = p_patient_id;
  if v_nutritionist is null or v_nutritionist <> auth.uid() then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  return public.apply_payment_effects(
    p_patient_id, p_amount_cents, p_method, p_paid_at, p_idempotency_key,
    'MANUAL', null, v_nutritionist, auth.uid(),
    p_installment_id, p_contract_id, p_appointment_id, p_category_id, p_notes, p_timezone
  );
end;
$$;

-- `apply_payment_effects` é DEFINER e não é concedida a authenticated; o
-- INVOKER acima precisa poder chamá-la, então a permissão vem do owner da
-- função (postgres) — em Postgres, SECURITY DEFINER executa com os direitos
-- do dono, mas o EXECUTE ainda é checado: concedemos explicitamente.
grant execute on function public.apply_payment_effects(uuid, integer, public.payment_method, timestamptz, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text) to authenticated;

-- 7. Criar / cancelar cobrança ----------------------------------------------

/**
 * Cria (ou reaproveita) a cobrança de uma parcela. O VALOR vem do banco —
 * saldo restante da parcela —, nunca do cliente. Autorização interna: o
 * próprio paciente ou o nutricionista responsável. Se já existir cobrança
 * ativa (CREATED/PENDING não expirada) para a parcela, devolve a existente
 * (§47): recarregar a tela não gera um Pix novo.
 */
create or replace function public.create_installment_charge(
  p_installment_id uuid,
  p_method public.payment_method,
  p_idempotency_key text,
  p_provider text,
  p_provider_environment text default 'simulated'
)
returns public.payment_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installment public.contract_installments%rowtype;
  v_contract public.patient_contracts%rowtype;
  v_patient public.patients%rowtype;
  v_received integer;
  v_remaining integer;
  v_existing public.payment_charges;
  v_charge public.payment_charges;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_method not in ('PIX', 'CARD') then
    raise exception 'PAYMENT_METHOD_NOT_AVAILABLE';
  end if;

  select * into v_existing from public.payment_charges where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return v_existing;
  end if;

  select * into v_installment from public.contract_installments where id = p_installment_id for update;
  if v_installment.id is null then
    raise exception 'INSTALLMENT_NOT_FOUND';
  end if;
  select * into v_contract from public.patient_contracts where id = v_installment.contract_id;
  select * into v_patient from public.patients where id = v_contract.patient_id;
  if v_patient.id is null then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  -- Autorização explícita (a função é DEFINER: RLS não protege aqui).
  if not (public.is_patient_self(v_patient.id) or v_patient.nutritionist_id = auth.uid()) then
    raise exception 'PAYMENT_NOT_AUTHORIZED';
  end if;
  if v_contract.status = 'CANCELLED' then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;
  if v_installment.status = 'CANCELLED' then
    raise exception 'INSTALLMENT_NOT_PAYABLE';
  end if;

  select coalesce(sum(amount_cents), 0) into v_received
  from public.payments where installment_id = p_installment_id and status = 'CONFIRMED';
  v_remaining := v_installment.amount_cents - v_received;
  if v_installment.status = 'PAID' or v_remaining <= 0 then
    raise exception 'PAYMENT_ALREADY_PAID';
  end if;

  -- Reaproveita cobrança ativa ainda válida; expira a vencida antes de criar outra.
  update public.payment_charges
    set status = 'EXPIRED'
  where installment_id = p_installment_id
    and status in ('CREATED', 'PENDING')
    and expires_at is not null
    and expires_at <= now();

  select * into v_existing from public.payment_charges
  where installment_id = p_installment_id and status in ('CREATED', 'PENDING')
  limit 1;
  if v_existing.id is not null then
    if v_existing.method = p_method and v_existing.amount_cents = v_remaining then
      return v_existing;
    end if;
    -- Método ou valor mudou: a anterior deixa de valer (histórico preservado).
    update public.payment_charges
      set status = 'CANCELLED', cancelled_at = now(), last_error_code = 'REPLACED_BY_NEW_CHARGE'
    where id = v_existing.id;
  end if;

  insert into public.payment_charges (
    patient_id, nutritionist_id, contract_id, installment_id, provider, provider_environment,
    method, amount_cents, status, idempotency_key, created_by
  ) values (
    v_patient.id, v_patient.nutritionist_id, v_contract.id, p_installment_id, p_provider, coalesce(p_provider_environment, 'simulated'),
    p_method, v_remaining, 'CREATED', p_idempotency_key, auth.uid()
  )
  returning * into v_charge;

  return v_charge;
exception
  when unique_violation then
    -- Corrida (clique duplo / duas abas): devolve a cobrança que venceu.
    select * into v_existing from public.payment_charges where idempotency_key = p_idempotency_key;
    if v_existing.id is not null then
      return v_existing;
    end if;
    select * into v_existing from public.payment_charges
    where installment_id = p_installment_id and status in ('CREATED', 'PENDING') limit 1;
    if v_existing.id is not null then
      return v_existing;
    end if;
    raise;
end;
$$;

revoke execute on function public.create_installment_charge(uuid, public.payment_method, text, text, text) from public, anon;
grant execute on function public.create_installment_charge(uuid, public.payment_method, text, text, text) to authenticated, service_role;

/** Cancela uma cobrança ainda aberta (paciente dono ou nutricionista). Cobrança paga nunca é cancelada. */
create or replace function public.cancel_payment_charge(p_charge_id uuid, p_reason text default null)
returns public.payment_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.payment_charges;
begin
  select * into v_charge from public.payment_charges where id = p_charge_id for update;
  if v_charge.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if not (public.is_patient_self(v_charge.patient_id) or v_charge.nutritionist_id = auth.uid()) then
    raise exception 'PAYMENT_NOT_AUTHORIZED';
  end if;
  if v_charge.status = 'PAID' then
    raise exception 'PAYMENT_ALREADY_PAID';
  end if;
  if v_charge.status in ('CANCELLED', 'EXPIRED', 'FAILED') then
    return v_charge;
  end if;
  update public.payment_charges
    set status = 'CANCELLED', cancelled_at = now(), last_error_code = nullif(btrim(p_reason), '')
  where id = p_charge_id
  returning * into v_charge;
  return v_charge;
end;
$$;

revoke execute on function public.cancel_payment_charge(uuid, text) from public, anon;
grant execute on function public.cancel_payment_charge(uuid, text) to authenticated, service_role;

-- 8. Confirmação online (só server-side) -------------------------------------

/**
 * Confirma o pagamento de uma cobrança a partir de um evento do provider já
 * VERIFICADO (assinatura conferida) ou de uma consulta server-side ao
 * provider. Tudo numa transação: `payments` + baixa da parcela +
 * lançamento + status da cobrança.
 *
 * Retorna um código: PAID (confirmou), ALREADY_PAID (idempotente — o mesmo
 * evento chegou de novo), AMOUNT_MISMATCH / CURRENCY_MISMATCH /
 * INSTALLMENT_ALREADY_SETTLED (não confirma nada; abre reconciliação).
 */
create or replace function public.record_online_payment(
  p_charge_id uuid,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text,
  p_paid_at timestamptz,
  p_timezone text default 'America/Sao_Paulo'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.payment_charges;
  v_received integer;
  v_installment public.contract_installments%rowtype;
  v_payment_id uuid;
begin
  select * into v_charge from public.payment_charges where id = p_charge_id for update;
  if v_charge.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_charge.status = 'PAID' then
    return 'ALREADY_PAID';
  end if;
  if upper(coalesce(p_currency, 'BRL')) <> v_charge.currency then
    return 'CURRENCY_MISMATCH';
  end if;
  if p_amount_cents is distinct from v_charge.amount_cents then
    return 'AMOUNT_MISMATCH';
  end if;

  if v_charge.installment_id is not null then
    select * into v_installment from public.contract_installments where id = v_charge.installment_id for update;
    select coalesce(sum(amount_cents), 0) into v_received
    from public.payments where installment_id = v_charge.installment_id and status = 'CONFIRMED';
    -- Alguém pagou no caixa enquanto o Pix estava aberto (§52/§114).
    if v_installment.status = 'PAID' or v_received >= v_installment.amount_cents or v_received + v_charge.amount_cents > v_installment.amount_cents then
      return 'INSTALLMENT_ALREADY_SETTLED';
    end if;
  end if;

  v_payment_id := public.apply_payment_effects(
    v_charge.patient_id,
    v_charge.amount_cents,
    v_charge.method,
    coalesce(p_paid_at, now()),
    'charge:' || v_charge.id::text,
    v_charge.provider,
    p_provider_payment_id,
    v_charge.nutritionist_id,
    v_charge.created_by,
    v_charge.installment_id,
    v_charge.contract_id,
    v_charge.appointment_id,
    null,
    null,
    p_timezone
  );

  update public.payment_charges
    set status = 'PAID', paid_at = coalesce(p_paid_at, now()), payment_id = v_payment_id, last_error_code = null
  where id = p_charge_id;

  -- Outbox da Fase 12, na MESMA transação: aviso in-app/e-mail de pagamento
  -- confirmado (sem recibo fiscal — §70). Falha de envio nunca desfaz a baixa.
  perform public.enqueue_notification_event(
    'PAYMENT_CONFIRMED', 'payment', v_payment_id, v_charge.patient_id, v_charge.nutritionist_id,
    jsonb_build_object('payment_id', v_payment_id, 'charge_id', v_charge.id, 'amount_cents', v_charge.amount_cents, 'method', v_charge.method),
    'payment_confirmed:' || v_payment_id::text
  );

  return 'PAID';
end;
$$;

revoke execute on function public.record_online_payment(uuid, text, integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_online_payment(uuid, text, integer, text, timestamptz, text) to service_role;

/** Marca cobranças abertas cujo prazo passou (job). Não toca em nada pago. */
create or replace function public.expire_payment_charges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.payment_charges
      set status = 'EXPIRED'
    where status in ('CREATED', 'PENDING')
      and expires_at is not null
      and expires_at <= now()
    returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

revoke execute on function public.expire_payment_charges() from public, anon, authenticated;
grant execute on function public.expire_payment_charges() to service_role;

-- 9. Views auxiliares ---------------------------------------------------------

/** Cobrança ativa (se houver) por parcela — o portal usa para decidir entre "Pagar" e "Ver cobrança". */
create or replace view public.installment_active_charge
with (security_invoker = true) as
select distinct on (c.installment_id)
  c.installment_id,
  c.id as charge_id,
  c.status,
  c.method,
  c.amount_cents,
  c.expires_at,
  c.created_at
from public.payment_charges c
where c.installment_id is not null and c.status in ('CREATED', 'PENDING')
order by c.installment_id, c.created_at desc;

comment on view public.installment_active_charge is
  'Cobrança online ainda aberta por parcela. `security_invoker` mantém a RLS de payment_charges (paciente vê só as suas).';
