-- Perfis de autenticação (identidade). Dados de negócio do paciente ficam em
-- `patients`, não aqui — ver docs/PROJECT_SPEC.md e docs/DATABASE.md.
-- ADMIN existe no enum para não exigir migration futura, mas nenhum usuário
-- ADMIN é criado nesta fase (docs/PROJECT_SPEC.md §12: "não criar admin
-- desnecessariamente").

create type public.profile_role as enum ('NUTRITIONIST', 'PATIENT', 'ADMIN');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Identidade/autenticação. Um profile por usuário do Supabase Auth. Papel (role) determina o que a pessoa pode acessar.';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Impede que o próprio usuário eleve seu papel (ex.: PATIENT -> NUTRITIONIST)
-- por uma requisição comum. Só o service role (que não passa por este
-- trigger de aplicação, mas sim por rotas server-side controladas) deveria
-- mudar role — na prática, nesta fase, role é definida uma única vez na
-- criação do profile (Fase 3) e não deveria mudar depois.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Alterar o papel (role) de um profile não é permitido por esta via.';
  end if;
  return new;
end;
$$;

create trigger prevent_profiles_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_role_change();

-- RLS ---------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Cada usuário lê o próprio profile.
create policy "profiles_select_self"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Nota: a policy "profiles_select_by_nutritionist" (nutricionista lê o
-- profile de pacientes sob sua gestão) é criada em
-- 20260913210053_patients.sql, porque depende da tabela `patients`, que
-- ainda não existe neste ponto da migration.

-- Um profile só é criado para o próprio usuário autenticado (ex.: logo após
-- o signup, na Fase 3). Nunca por outra pessoa.
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Cada usuário só atualiza o próprio profile (role protegida pelo trigger
-- acima, independentemente desta policy).
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Sem policy de delete: nenhum papel apaga profiles via API — a exclusão
-- do usuário (e cascade do profile) é uma operação administrativa fora do
-- escopo desta fase.
