-- Cardápios: modelagem apenas (sem UI funcional nesta fase — prompt Fase 2
-- §22). Versionado; paciente só vê a versão PUBLISHED mais recente; versões
-- antigas nunca são destruídas (docs/PROJECT_SPEC.md §19).

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  title text not null default 'Cardápio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meal_plans is
  'Container do cardápio de um paciente. A versão vigente é resolvida via meal_plan_versions.status = PUBLISHED, não por um ponteiro redundante.';

create index meal_plans_patient_id_idx on public.meal_plans (patient_id);

create trigger set_meal_plans_updated_at
  before update on public.meal_plans
  for each row
  execute function public.set_updated_at();

-- Garante que nutritionist_id do cardápio é o mesmo nutricionista do
-- paciente (evita drift caso um paciente troque de nutricionista no futuro).
create or replace function public.validate_meal_plan_nutritionist()
returns trigger
language plpgsql
as $$
declare
  patient_nutritionist_id uuid;
begin
  select nutritionist_id into patient_nutritionist_id
  from public.patients where id = new.patient_id;

  if patient_nutritionist_id is distinct from new.nutritionist_id then
    raise exception 'nutritionist_id do cardápio precisa ser o mesmo nutricionista do paciente (%)', new.patient_id;
  end if;

  return new;
end;
$$;

create trigger validate_meal_plans_nutritionist
  before insert or update on public.meal_plans
  for each row
  execute function public.validate_meal_plan_nutritionist();

create type public.meal_plan_version_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

create table public.meal_plan_versions (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  status public.meal_plan_version_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, version_number)
);

comment on table public.meal_plan_versions is
  'Apenas uma versão PUBLISHED por cardápio ao mesmo tempo (índice único parcial abaixo).';

-- Regra de domínio: no máximo uma versão publicada por cardápio.
create unique index meal_plan_versions_one_published_per_plan
  on public.meal_plan_versions (meal_plan_id)
  where status = 'PUBLISHED';

create index meal_plan_versions_meal_plan_id_idx on public.meal_plan_versions (meal_plan_id);

create trigger set_meal_plan_versions_updated_at
  before update on public.meal_plan_versions
  for each row
  execute function public.set_updated_at();

create table public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.meal_plan_versions (id) on delete cascade,
  -- 0 = domingo .. 6 = sábado (mesma convenção usada em availability_rules).
  weekday smallint not null check (weekday between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, weekday)
);

create trigger set_meal_plan_days_updated_at
  before update on public.meal_plan_days
  for each row
  execute function public.set_updated_at();

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.meal_plan_days (id) on delete cascade,
  -- Nome livre e configurável (não enum) — docs/PROJECT_SPEC.md §17: "as
  -- refeições devem ser configuráveis" (ex.: Café da manhã, Lanche, Almoço...).
  name text not null,
  time_of_day time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meals_day_id_idx on public.meals (day_id);

create trigger set_meals_updated_at
  before update on public.meals
  for each row
  execute function public.set_updated_at();

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_name text not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null,
  calories numeric(10, 2) check (calories is null or calories >= 0),
  protein_g numeric(10, 2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10, 2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10, 2) check (fat_g is null or fat_g >= 0),
  fiber_g numeric(10, 2) check (fiber_g is null or fiber_g >= 0),
  instructions text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_items_meal_id_idx on public.meal_items (meal_id);

create trigger set_meal_items_updated_at
  before update on public.meal_items
  for each row
  execute function public.set_updated_at();

create table public.meal_substitutions (
  id uuid primary key default gen_random_uuid(),
  meal_item_id uuid not null references public.meal_items (id) on delete cascade,
  substitute_food_name text not null,
  quantity numeric(10, 2) check (quantity is null or quantity > 0),
  unit text,
  calories numeric(10, 2) check (calories is null or calories >= 0),
  protein_g numeric(10, 2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10, 2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10, 2) check (fat_g is null or fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_substitutions_meal_item_id_idx on public.meal_substitutions (meal_item_id);

create trigger set_meal_substitutions_updated_at
  before update on public.meal_substitutions
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------
-- Padrão em cascata: nutricionista responsável pelo paciente tem acesso
-- total; paciente só enxerga a versão PUBLISHED (e o que pende dela).

alter table public.meal_plans enable row level security;
alter table public.meal_plan_versions enable row level security;
alter table public.meal_plan_days enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.meal_substitutions enable row level security;

create policy "meal_plans_select"
  on public.meal_plans
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "meal_plans_write_nutritionist"
  on public.meal_plans
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

create policy "meal_plan_versions_select"
  on public.meal_plan_versions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_versions.meal_plan_id
        and (
          public.is_nutritionist_of_patient(mp.patient_id)
          or (meal_plan_versions.status = 'PUBLISHED' and public.is_patient_self(mp.patient_id))
        )
    )
  );

create policy "meal_plan_versions_write_nutritionist"
  on public.meal_plan_versions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_versions.meal_plan_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.meal_plans mp
      where mp.id = meal_plan_versions.meal_plan_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  );

create policy "meal_plan_days_select"
  on public.meal_plan_days
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meal_plan_versions v
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where v.id = meal_plan_days.version_id
        and (
          public.is_nutritionist_of_patient(mp.patient_id)
          or (v.status = 'PUBLISHED' and public.is_patient_self(mp.patient_id))
        )
    )
  );

create policy "meal_plan_days_write_nutritionist"
  on public.meal_plan_days
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.meal_plan_versions v
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where v.id = meal_plan_days.version_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meal_plan_versions v
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where v.id = meal_plan_days.version_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  );

create policy "meals_select"
  on public.meals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meal_plan_days d
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where d.id = meals.day_id
        and (
          public.is_nutritionist_of_patient(mp.patient_id)
          or (v.status = 'PUBLISHED' and public.is_patient_self(mp.patient_id))
        )
    )
  );

create policy "meals_write_nutritionist"
  on public.meals
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.meal_plan_days d
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where d.id = meals.day_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meal_plan_days d
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where d.id = meals.day_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  );

create policy "meal_items_select"
  on public.meal_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meals m
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where m.id = meal_items.meal_id
        and (
          public.is_nutritionist_of_patient(mp.patient_id)
          or (v.status = 'PUBLISHED' and public.is_patient_self(mp.patient_id))
        )
    )
  );

create policy "meal_items_write_nutritionist"
  on public.meal_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.meals m
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where m.id = meal_items.meal_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meals m
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where m.id = meal_items.meal_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  );

create policy "meal_substitutions_select"
  on public.meal_substitutions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meal_items mi
      join public.meals m on m.id = mi.meal_id
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where mi.id = meal_substitutions.meal_item_id
        and (
          public.is_nutritionist_of_patient(mp.patient_id)
          or (v.status = 'PUBLISHED' and public.is_patient_self(mp.patient_id))
        )
    )
  );

create policy "meal_substitutions_write_nutritionist"
  on public.meal_substitutions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.meal_items mi
      join public.meals m on m.id = mi.meal_id
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where mi.id = meal_substitutions.meal_item_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meal_items mi
      join public.meals m on m.id = mi.meal_id
      join public.meal_plan_days d on d.id = m.day_id
      join public.meal_plan_versions v on v.id = d.version_id
      join public.meal_plans mp on mp.id = v.meal_plan_id
      where mi.id = meal_substitutions.meal_item_id
        and public.is_nutritionist_of_patient(mp.patient_id)
    )
  );
