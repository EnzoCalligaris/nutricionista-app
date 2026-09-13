-- Paciente é uma entidade de negócio separada de profile (identidade de
-- login). Um paciente pode existir sem conta própria (cadastro manual pelo
-- nutricionista) — profile_id só é preenchido quando/se o paciente ativar
-- acesso ao portal (Fase 3). Idade nunca é armazenada: calculada a partir de
-- birth_date quando necessário (docs/DATABASE.md).

create type public.patient_status as enum ('ACTIVE', 'INACTIVE');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  birth_date date,
  status public.patient_status not null default 'ACTIVE',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is
  'Dados de negócio do paciente. Separado de profiles: nem todo paciente tem login próprio ainda.';
comment on column public.patients.archived_at is
  'Soft delete — preenchido quando o nutricionista "exclui" um paciente com histórico. Nunca hard delete (docs/PROJECT_SPEC.md §13).';

create index patients_nutritionist_id_idx on public.patients (nutritionist_id);
create index patients_profile_id_idx on public.patients (profile_id);
create index patients_status_idx on public.patients (status);

create trigger set_patients_updated_at
  before update on public.patients
  for each row
  execute function public.set_updated_at();

-- Garante que nutritionist_id de fato aponta para um profile com role
-- NUTRITIONIST, e profile_id (quando presente) para um profile com role
-- PATIENT — FKs sozinhas não conseguem expressar essa regra.
create or replace function public.validate_patient_profile_roles()
returns trigger
language plpgsql
as $$
declare
  nutritionist_role public.profile_role;
  patient_role public.profile_role;
begin
  select role into nutritionist_role from public.profiles where id = new.nutritionist_id;
  if nutritionist_role is distinct from 'NUTRITIONIST' then
    raise exception 'nutritionist_id (%) precisa referenciar um profile com role NUTRITIONIST', new.nutritionist_id;
  end if;

  if new.profile_id is not null then
    select role into patient_role from public.profiles where id = new.profile_id;
    if patient_role is distinct from 'PATIENT' then
      raise exception 'profile_id (%) precisa referenciar um profile com role PATIENT', new.profile_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_patients_profile_roles
  before insert or update on public.patients
  for each row
  execute function public.validate_patient_profile_roles();

-- RLS ---------------------------------------------------------------------

alter table public.patients enable row level security;

create policy "patients_select_own_or_managed"
  on public.patients
  for select
  to authenticated
  using (
    nutritionist_id = auth.uid()
    or profile_id = auth.uid()
  );

create policy "patients_insert_by_nutritionist"
  on public.patients
  for insert
  to authenticated
  with check (
    nutritionist_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'NUTRITIONIST')
  );

create policy "patients_update_by_nutritionist"
  on public.patients
  for update
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

-- Sem policy de delete — desativação é feita via status/archived_at (UPDATE),
-- nunca DELETE (docs/PROJECT_SPEC.md §13).

-- Policy adiada de 20260913210052_profiles.sql: agora que `patients` existe,
-- o nutricionista pode ler o profile (identidade) dos pacientes que gerencia.
create policy "profiles_select_by_nutritionist"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.patients p
      where p.profile_id = profiles.id
        and p.nutritionist_id = auth.uid()
    )
  );
