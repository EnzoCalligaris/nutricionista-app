-- Consentimento de uso de imagem e resultados antes/depois. Uma foto NUNCA é
-- considerada autorizada só por ter sido enviada (prompt Fase 2 §31) — a
-- publicação exige um media_consent_id explícito e válido.

create table public.media_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  consent_type text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= granted_at)
);

comment on table public.media_consents is
  'Consentimento específico de uso de imagem — separado do consentimento geral de tratamento de dados (LGPD). evidence_reference documenta onde/como o consentimento foi capturado.';

create index media_consents_patient_id_idx on public.media_consents (patient_id);

create trigger set_media_consents_updated_at
  before update on public.media_consents
  for each row
  execute function public.set_updated_at();

create table public.before_after_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients (id) on delete set null,
  title text not null,
  description text,
  period text,
  before_path text not null,
  after_path text not null,
  published boolean not null default false,
  media_consent_id uuid references public.media_consents (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Regra crítica: nunca publica sem consentimento registrado
  -- (docs/PROJECT_SPEC.md §4 e §30).
  check (published = false or media_consent_id is not null)
);

create index before_after_results_patient_id_idx on public.before_after_results (patient_id);

create trigger set_before_after_results_updated_at
  before update on public.before_after_results
  for each row
  execute function public.set_updated_at();

-- Garante que o consentimento referenciado (quando presente) é do mesmo
-- paciente do resultado — evita anexar por engano o consentimento de outra
-- pessoa.
create or replace function public.validate_before_after_consent()
returns trigger
language plpgsql
as $$
declare
  consent_patient_id uuid;
begin
  if new.media_consent_id is not null then
    select patient_id into consent_patient_id
    from public.media_consents where id = new.media_consent_id;

    if new.patient_id is not null and consent_patient_id is distinct from new.patient_id then
      raise exception 'media_consent_id (%) não pertence ao patient_id (%) deste resultado', new.media_consent_id, new.patient_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_before_after_results_consent
  before insert or update on public.before_after_results
  for each row
  execute function public.validate_before_after_consent();

-- Checa se existe consentimento válido (não revogado) para o resultado,
-- sem depender da RLS de media_consents — necessário porque a policy
-- pública de before_after_results (visitante anônimo) precisa confirmar
-- consentimento sem ter (nem dever ter) acesso direto à tabela
-- media_consents. SECURITY DEFINER com search_path fixo, mesmo padrão dos
-- helpers em 20260913210054_rls_helper_functions.sql.
create or replace function public.has_valid_media_consent(target_consent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media_consents
    where id = target_consent_id
      and revoked_at is null
  );
$$;

comment on function public.has_valid_media_consent(uuid) is
  'True se o consentimento existe e não foi revogado. Usado pela policy pública de before_after_results.';

revoke execute on function public.has_valid_media_consent(uuid) from public;
grant execute on function public.has_valid_media_consent(uuid) to anon, authenticated;

-- RLS ---------------------------------------------------------------------

alter table public.media_consents enable row level security;
alter table public.before_after_results enable row level security;

create policy "media_consents_select"
  on public.media_consents
  for select
  to authenticated
  using (
    public.current_profile_role() = 'NUTRITIONIST'
    or public.is_patient_self(patient_id)
  );

create policy "media_consents_write_nutritionist"
  on public.media_consents
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

-- Público: só published=true E consentimento existente e não revogado
-- (prompt Fase 2 §41 — checado diretamente na policy, não só na aplicação).
create policy "before_after_results_select_public"
  on public.before_after_results
  for select
  to anon, authenticated
  using (
    published = true
    and media_consent_id is not null
    and public.has_valid_media_consent(media_consent_id)
  );

create policy "before_after_results_select_nutritionist_all"
  on public.before_after_results
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "before_after_results_write_nutritionist"
  on public.before_after_results
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');
