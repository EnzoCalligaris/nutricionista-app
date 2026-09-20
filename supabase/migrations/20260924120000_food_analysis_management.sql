-- Fase 11 — Foto da refeição + análise por IA (prompt Fase 11).
--
-- `food_photo_analyses` (Fase 2) e o bucket privado `meal-photos` (path
-- `<patient_id>/…`, paciente escreve/lê o próprio, nutricionista lê os dos
-- seus pacientes) são REUTILIZADOS. O enum `food_photo_analysis_status`
-- (PENDING / ANALYZED / CONFIRMED / FAILED) também: "processando" é PENDING
-- com `processing_started_at` (claim atômico — idempotência) e "arquivada" é
-- `archived_at` — nenhum valor de enum novo. Esta migration acrescenta:
--   1. `patient_consents`: consentimento explícito e VERSIONADO do paciente
--      (ex.: MEAL_PHOTO_AI / meal_photo_ai_v1) antes da primeira análise,
--      registrado pelo próprio paciente; revogável para análises futuras.
--      `media_consents` (Fase 2) não serve: é consentimento de USO DE IMAGEM
--      capturado pelo nutricionista, com escrita só do nutricionista.
--   2. Colunas da análise: instante da refeição, metadados da imagem
--      processada (mime/tamanho/sha256 — só a imagem processada é guardada,
--      sem EXIF), versão do consentimento usada, claim/tempo de
--      processamento, código técnico de falha, tentativas, confirmação e
--      arquivamento. `raw_result` continua existindo mas NÃO é preenchido
--      (decisão: só a estrutura normalizada é persistida).
--   3. Guards: consentimento ativo obrigatório para criar; path do objeto
--      `<patient_id>/<analysis_id>/…`; refeição não pode ser futura (10 min
--      de tolerância de relógio); `patient_id`/`storage_path` imutáveis;
--      ORIGINAL DA IA (`structured_result`, `provider`, `model`) imutável
--      depois de gravado; máquina de estados (PENDING→ANALYZED exige
--      resultado; ANALYZED→CONFIRMED exige versão confirmada;
--      FAILED→PENDING = tentar de novo; CONFIRMED→ANALYZED = reabrir
--      revisão); arquivada é só leitura e irreversível.
-- Nenhuma migration anterior é editada.

-- 1. Consentimentos do paciente ---------------------------------------------------

create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  consent_type text not null check (consent_type ~ '^[A-Z_]{3,60}$'),
  consent_version text not null check (consent_version ~ '^[a-z0-9_]{3,60}$'),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= accepted_at)
);

comment on table public.patient_consents is
  'Consentimento explícito do PACIENTE, por tipo e versão de texto (ex.: MEAL_PHOTO_AI / meal_photo_ai_v1). Revogar = revoked_at (bloqueia usos FUTUROS; não apaga dados já processados — docs/DECISIONS.md, Fase 11). Distinto de media_consents (uso de imagem, capturado pelo nutricionista).';

-- Um consentimento ATIVO por paciente/tipo/versão; revogados ficam como histórico.
create unique index patient_consents_active_unique_idx
  on public.patient_consents (patient_id, consent_type, consent_version)
  where revoked_at is null;

create index patient_consents_patient_id_idx on public.patient_consents (patient_id);

create trigger set_patient_consents_updated_at
  before update on public.patient_consents
  for each row
  execute function public.set_updated_at();

-- Só revoked_at muda depois de aceito, e só uma vez.
create or replace function public.guard_patient_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.revoked_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'revoked_at' - 'updated_at') is distinct from (to_jsonb(old) - 'revoked_at' - 'updated_at') then
    raise exception 'CONSENT_NOT_AUTHORIZED';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  return new;
end;
$$;

create trigger guard_patient_consents
  before insert or update on public.patient_consents
  for each row execute function public.guard_patient_consent();

/** Consentimento ativo (não revogado) do paciente para o tipo/versão — usado pelo guard da análise (CLAUDE.md regra 11). */
create or replace function public.patient_has_consent(p_patient_id uuid, p_type text, p_version text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient_consents c
    where c.patient_id = p_patient_id
      and c.consent_type = p_type
      and c.consent_version = p_version
      and c.revoked_at is null
  );
$$;

revoke execute on function public.patient_has_consent(uuid, text, text) from public;
grant execute on function public.patient_has_consent(uuid, text, text) to authenticated;

alter table public.patient_consents enable row level security;

create policy "patient_consents_select"
  on public.patient_consents
  for select
  to authenticated
  using (public.is_patient_self(patient_id) or public.is_nutritionist_of_patient(patient_id));

-- O consentimento é do paciente: só ele registra e só ele revoga.
create policy "patient_consents_insert_self"
  on public.patient_consents
  for insert
  to authenticated
  with check (public.is_patient_self(patient_id));

create policy "patient_consents_update_self"
  on public.patient_consents
  for update
  to authenticated
  using (public.is_patient_self(patient_id))
  with check (public.is_patient_self(patient_id));

-- Sem policy de delete: histórico de consentimento nunca some.

-- 2. Análises ------------------------------------------------------------------------

alter table public.food_photo_analyses
  add column meal_at timestamptz not null default now(),
  add column image_mime text,
  add column image_size_bytes integer check (image_size_bytes is null or image_size_bytes > 0),
  add column image_sha256 text check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  add column consent_version text,
  add column processing_started_at timestamptz,
  add column processing_ms integer check (processing_ms is null or processing_ms >= 0),
  add column provider_request_id text,
  add column failure_code text,
  add column attempts integer not null default 0 check (attempts >= 0),
  add column confirmed_at timestamptz,
  add column archived_at timestamptz;

comment on column public.food_photo_analyses.storage_path is
  'Objeto no bucket privado meal-photos: <patient_id>/<analysis_id>/<uuid>.webp — só a imagem PROCESSADA (redimensionada, sem EXIF/GPS). Entrega sempre por URL assinada server-side.';
comment on column public.food_photo_analyses.structured_result is
  'Resultado ORIGINAL da IA, normalizado e validado (Zod) — imutável depois de gravado. Sempre estimativa.';
comment on column public.food_photo_analyses.corrected_result is
  'Versão revisada/CONFIRMADA pelo paciente (itens, quantidades, totais recalculados). Nunca sobrescreve structured_result.';
comment on column public.food_photo_analyses.raw_result is
  'NÃO preenchido desde a Fase 11 (decisão: só a estrutura normalizada é persistida).';
comment on column public.food_photo_analyses.processing_started_at is
  'Claim atômico da análise (idempotência): enquanto recente, outra requisição para a mesma foto é recusada. Limpo ao concluir/falhar.';

create index food_photo_analyses_patient_meal_idx
  on public.food_photo_analyses (patient_id, meal_at desc) where archived_at is null;

create or replace function public.guard_food_photo_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING' or new.structured_result is not null or new.corrected_result is not null or new.archived_at is not null or new.confirmed_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    if new.storage_path !~ ('^' || new.patient_id::text || '/' || new.id::text || '/') then
      raise exception 'MEAL_PHOTO_INVALID';
    end if;
    if new.meal_at > v_now + interval '10 minutes' then
      raise exception 'INVALID_MEAL_TIME';
    end if;
    if new.consent_version is null or not public.patient_has_consent(new.patient_id, 'MEAL_PHOTO_AI', new.consent_version) then
      raise exception 'MEAL_AI_CONSENT_REQUIRED';
    end if;
    return new;
  end if;

  if new.patient_id <> old.patient_id or new.storage_path <> old.storage_path or new.consent_version is distinct from old.consent_version then
    raise exception 'FOOD_ANALYSIS_NOT_AUTHORIZED';
  end if;
  if old.archived_at is not null then
    raise exception 'FOOD_ANALYSIS_ARCHIVED';
  end if;
  if new.meal_at > v_now + interval '10 minutes' then
    raise exception 'INVALID_MEAL_TIME';
  end if;
  -- O original da IA nunca é sobrescrito (§33).
  if old.structured_result is not null and (
    new.structured_result is distinct from old.structured_result
    or new.provider is distinct from old.provider
    or new.model is distinct from old.model
    or new.analyzed_at is distinct from old.analyzed_at
  ) then
    raise exception 'FOOD_ANALYSIS_ORIGINAL_IMMUTABLE';
  end if;

  if new.status <> old.status then
    if old.status = 'PENDING' and new.status = 'ANALYZED' then
      if new.structured_result is null or new.provider is null or new.model is null then
        raise exception 'INVALID_STATUS_TRANSITION';
      end if;
      new.analyzed_at := coalesce(new.analyzed_at, v_now);
      new.processing_started_at := null;
    elsif old.status = 'PENDING' and new.status = 'FAILED' then
      new.processing_started_at := null;
    elsif old.status = 'FAILED' and new.status = 'PENDING' then
      null; -- tentar de novo
    elsif old.status = 'ANALYZED' and new.status = 'CONFIRMED' then
      if new.corrected_result is null then
        raise exception 'INVALID_STATUS_TRANSITION';
      end if;
      new.confirmed_at := coalesce(new.confirmed_at, v_now);
    elsif old.status = 'CONFIRMED' and new.status = 'ANALYZED' then
      null; -- reabrir revisão explicitamente
    else
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
  elsif old.status in ('PENDING', 'FAILED') and new.corrected_result is not null then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  if new.archived_at is not null and old.archived_at is null then
    new.processing_started_at := null;
  end if;
  return new;
end;
$$;

create trigger guard_food_photo_analyses
  before insert or update on public.food_photo_analyses
  for each row execute function public.guard_food_photo_analysis();

-- Sem policy de delete (Fase 2 já não tinha): arquivar é o único "remover";
-- o objeto do bucket pode ser apagado pelo paciente (policy de storage da
-- Fase 2), a linha permanece com metadados mínimos.

-- 3. Auditoria pelo paciente (§48) -----------------------------------------------
-- O fluxo é iniciado pelo paciente; ele audita só as próprias entidades desta
-- fase (mesmo padrão da policy de consulta da Fase 6).
create policy "audit_logs_insert_patient_food_analysis"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    public.current_profile_role() = 'PATIENT'
    and actor_id = auth.uid()
    and entity_type in ('food_photo_analysis', 'patient_consent')
  );
