-- Contratos e parcelas. Paciente, plano e contrato são entidades distintas —
-- um paciente pode ter vários contratos ao longo do tempo, histórico nunca é
-- substituído (docs/PROJECT_SPEC.md §37 do prompt / §10 do DATABASE.md).

create type public.contract_status as enum ('ACTIVE', 'COMPLETED', 'CANCELLED');

create table public.patient_contracts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  plan_price_id uuid references public.plan_prices (id) on delete restrict,
  start_date date not null,
  end_date date,
  status public.contract_status not null default 'ACTIVE',
  contracted_amount_cents integer not null check (contracted_amount_cents >= 0),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (status = 'CANCELLED' or cancelled_at is null)
);

comment on table public.patient_contracts is
  'contracted_amount_cents é um snapshot do valor no momento da assinatura — não recalcula se plan_prices mudar depois. plan_price_id é só rastreabilidade de qual preço foi usado.';

create index patient_contracts_patient_id_status_idx
  on public.patient_contracts (patient_id, status);

create trigger set_patient_contracts_updated_at
  before update on public.patient_contracts
  for each row
  execute function public.set_updated_at();

create type public.installment_status as enum ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

create table public.contract_installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.patient_contracts (id) on delete cascade,
  number integer not null check (number >= 1),
  amount_cents integer not null check (amount_cents >= 0),
  due_date date not null,
  paid_at timestamptz,
  status public.installment_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, number),
  check (status = 'PAID' or paid_at is null)
);

comment on table public.contract_installments is
  'Parcela é distinta de payment: parcela é o "combinado" (o quanto e quando), payment é o dinheiro que efetivamente entrou.';

create index contract_installments_contract_id_due_date_idx
  on public.contract_installments (contract_id, due_date);

create trigger set_contract_installments_updated_at
  before update on public.contract_installments
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.patient_contracts enable row level security;
alter table public.contract_installments enable row level security;

create policy "patient_contracts_select"
  on public.patient_contracts
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "patient_contracts_write_nutritionist"
  on public.patient_contracts
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

create policy "contract_installments_select"
  on public.contract_installments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.patient_contracts c
      where c.id = contract_installments.contract_id
        and (public.is_nutritionist_of_patient(c.patient_id) or public.is_patient_self(c.patient_id))
    )
  );

create policy "contract_installments_write_nutritionist"
  on public.contract_installments
  for all
  to authenticated
  using (
    exists (
      select 1 from public.patient_contracts c
      where c.id = contract_installments.contract_id
        and public.is_nutritionist_of_patient(c.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.patient_contracts c
      where c.id = contract_installments.contract_id
        and public.is_nutritionist_of_patient(c.patient_id)
    )
  );
