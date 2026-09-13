-- Financeiro: categorias, pagamentos (dinheiro real/tentativas) e lançamentos
-- (ledger). payments e financial_transactions são propositalmente
-- separados — ver docs/DATABASE.md e prompt Fase 2 §13/§14.
--
-- Regra de não-duplicação: um payment CONFIRMED deve gerar no máximo um
-- financial_transaction (origin_payment_id único quando presente).

create type public.payment_method as enum ('PIX', 'CARD', 'CASH', 'BANK_TRANSFER', 'OTHER');
create type public.financial_type as enum ('INCOME', 'EXPENSE');

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.financial_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, type)
);

create trigger set_financial_categories_updated_at
  before update on public.financial_categories
  for each row
  execute function public.set_updated_at();

create type public.payment_status as enum ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  contract_id uuid references public.patient_contracts (id) on delete set null,
  installment_id uuid references public.contract_installments (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  -- 'MANUAL' = lançado à mão pelo nutricionista (sem gateway). Fase 13
  -- introduz providers reais (PaymentProvider) sem precisar de migration.
  provider text not null default 'MANUAL',
  external_id text,
  amount_cents integer not null check (amount_cents >= 0),
  method public.payment_method not null,
  status public.payment_status not null default 'PENDING',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'CONFIRMED' or paid_at is null)
);

comment on table public.payments is
  'Pagamento real ou tentativa. external_id (por provider) é a chave de idempotência de webhook — nunca confirmar pagamento só pela resposta do frontend (docs/SECURITY.md).';

-- Idempotência: mesmo provider + external_id nunca gera duas linhas.
create unique index payments_provider_external_id_idx
  on public.payments (provider, external_id)
  where external_id is not null;

create index payments_patient_id_idx on public.payments (patient_id);
create index payments_contract_id_idx on public.payments (contract_id);
create index payments_installment_id_idx on public.payments (installment_id);

create trigger set_payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

create type public.financial_transaction_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED');
create type public.financial_origin as enum ('MANUAL', 'APPOINTMENT', 'PAYMENT');

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  type public.financial_type not null,
  category_id uuid references public.financial_categories (id) on delete restrict,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status public.financial_transaction_status not null default 'CONFIRMED',
  occurred_on date not null default current_date,
  due_on date,
  paid_at timestamptz,
  payment_method public.payment_method,
  origin public.financial_origin not null default 'MANUAL',
  origin_payment_id uuid references public.payments (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> 'PAYMENT' or origin_payment_id is not null)
);

comment on table public.financial_transactions is
  'Ledger financeiro (receita/despesa). Faturamento do mês soma estas linhas, NUNCA o valor total de um contrato (prompt Fase 2 §56 — R$1.200 parcelado em 6x não vira R$1.200 de receita no ato).';

-- Um payment nunca gera duas transações (dupla contabilização).
create unique index financial_transactions_origin_payment_id_idx
  on public.financial_transactions (origin_payment_id)
  where origin_payment_id is not null;

create index financial_transactions_occurred_on_idx
  on public.financial_transactions (occurred_on);
create index financial_transactions_category_id_idx
  on public.financial_transactions (category_id);

create trigger set_financial_transactions_updated_at
  before update on public.financial_transactions
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------
-- Financeiro é operação do nutricionista. O portal do paciente (Fase 0/1)
-- não expõe financeiro/pagamentos — só contrato/parcelas (já com RLS
-- própria em 20260913210056_contracts.sql). Nenhuma policy de SELECT para
-- paciente aqui é intencional.

alter table public.financial_categories enable row level security;
alter table public.payments enable row level security;
alter table public.financial_transactions enable row level security;

create policy "financial_categories_nutritionist_only"
  on public.financial_categories
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

create policy "payments_nutritionist_only"
  on public.payments
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

create policy "financial_transactions_nutritionist_only"
  on public.financial_transactions
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');
