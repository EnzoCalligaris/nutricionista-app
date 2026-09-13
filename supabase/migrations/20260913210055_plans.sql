-- Planos, preços versionados e benefícios configuráveis. Ver
-- docs/DECISIONS.md — preço do trimestral/semestral é ambíguo no material de
-- origem (3 representações possíveis: valor cheio, parcelado, à vista) e
-- NENHUMA é escolhida silenciosamente aqui como "a" principal.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  duration_months integer check (duration_months is null or duration_months > 0),
  sessions_in_person integer check (sessions_in_person is null or sessions_in_person >= 0),
  sessions_online integer check (sessions_online is null or sessions_online >= 0),
  active boolean not null default true,
  publicly_visible boolean not null default false,
  available_for_sale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Catálogo de planos. code é livre (não enum) para permitir novo plano sem migration. Plano ANUAL existe com publicly_visible=false/available_for_sale=false — docs/PROJECT_SPEC.md §3.';

create trigger set_plans_updated_at
  before update on public.plans
  for each row
  execute function public.set_updated_at();

create type public.plan_price_payment_type as enum ('AVISTA', 'PARCELADO', 'REFERENCIA');

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  installments integer not null default 1 check (installments >= 1),
  payment_type public.plan_price_payment_type not null,
  valid_from date not null default current_date,
  valid_until date,
  active boolean not null default true,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);

comment on table public.plan_prices is
  'Preço é versionado, nunca sobrescrito. payment_type=REFERENCIA representa um valor "de" informativo (âncora), não uma opção de compra real.';
comment on column public.plan_prices.is_primary is
  'Marca qual preço é o "principal" a exibir. Deixado false para TRIMESTRAL/SEMESTRAL (PENDENTE DE DEFINIÇÃO — docs/DECISIONS.md); só AVULSA tem preço primário definido pelo prompt do produto.';

-- No máximo um preço "principal" ativo por plano.
create unique index plan_prices_one_primary_per_plan
  on public.plan_prices (plan_id)
  where is_primary and active;

create index plan_prices_plan_id_idx on public.plan_prices (plan_id);

create trigger set_plan_prices_updated_at
  before update on public.plan_prices
  for each row
  execute function public.set_updated_at();

create table public.plan_benefits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_benefits is
  '"Grupo exclusivo" nunca é inserido aqui como benefício ativo — removido da oferta (docs/DECISIONS.md). "Comunidade VIP" fica PENDENTE DE DEFINIÇÃO e não é assumido como benefício ativo.';

create index plan_benefits_plan_id_idx on public.plan_benefits (plan_id);

create trigger set_plan_benefits_updated_at
  before update on public.plan_benefits
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.plan_benefits enable row level security;

create policy "plans_select_public"
  on public.plans
  for select
  to anon, authenticated
  using (publicly_visible = true and active = true);

create policy "plans_select_nutritionist"
  on public.plans
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "plans_write_nutritionist"
  on public.plans
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

create policy "plan_prices_select_public"
  on public.plan_prices
  for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.plans
      where id = plan_prices.plan_id and publicly_visible = true and active = true
    )
  );

create policy "plan_prices_select_nutritionist"
  on public.plan_prices
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "plan_prices_write_nutritionist"
  on public.plan_prices
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

create policy "plan_benefits_select_public"
  on public.plan_benefits
  for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.plans
      where id = plan_benefits.plan_id and publicly_visible = true and active = true
    )
  );

create policy "plan_benefits_select_nutritionist"
  on public.plan_benefits
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "plan_benefits_write_nutritionist"
  on public.plan_benefits
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

-- Sem policy de delete adicional além de "for all" acima (que já cobre
-- delete) — planos/preços/benefícios raramente deveriam ser hard-deletados
-- (contratos referenciam plan_id), mas o nutricionista é o único que pode
-- fazê-lo caso realmente necessário; preferir active=false na prática.
