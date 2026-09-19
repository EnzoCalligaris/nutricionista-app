-- Fase 10 — Suplementos + feedbacks + materiais do paciente (prompt Fase 10).
--
-- As quatro tabelas da Fase 2 (`supplement_recommendations`,
-- `feedback_messages`, `patient_materials`, `material_assignments`) e o
-- bucket privado `patient-documents` são REUTILIZADOS. Esta migration
-- acrescenta só o que faltava para operar de verdade:
--   1. Suplementos: dose textual, período opcional (início/fim), arquivamento
--      (`archived_at/by`, irreversível — histórico), `updated_by`, URL de
--      compra só http(s). Status continua derivado de `active` +
--      `archived_at` (ATIVA / ENCERRADA / ARQUIVADA) — nenhum enum novo.
--   2. Feedbacks: título e data de referência opcionais, rascunho x
--      disponibilizado (`published_at` — null = rascunho, nunca visto pelo
--      paciente), arquivamento, `updated_at/updated_by`. Paciente só pode
--      tocar em `read_at` (trigger por comparação de todas as outras colunas).
--   3. Materiais: arquivo OU link externo (`kind` FILE/LINK, `external_url`),
--      descrição, metadados do arquivo (nome/tamanho), arquivamento.
--      `storage_path` passa a ser nullable (material de link não tem arquivo;
--      material de arquivo nasce sem path e recebe o path após o upload —
--      o bucket exige a linha para autorizar a escrita).
--   4. Atribuições: `assigned_by/revoked_by`; material só é atribuído a
--      paciente do MESMO nutricionista (trigger — a FK ignora RLS), nunca
--      arquivado nem incompleto; revogar = `revoked_at`; reatribuir limpa
--      `revoked_at` explicitamente. DELETE revogado (histórico).
--   5. RLS do paciente restrita: suplemento ATIVO e não arquivado; feedback
--      DISPONIBILIZADO e não arquivado; material ATRIBUÍDO (não revogado),
--      não arquivado e completo — tabela e bucket, via helper SECURITY
--      DEFINER (CLAUDE.md regra 11). Nutricionista continua só nos próprios.
-- Nenhuma migration anterior é editada.

-- 1. Suplementos ------------------------------------------------------------------

alter table public.supplement_recommendations
  add column dose_text text,
  add column starts_on date,
  add column ends_on date,
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null;

alter table public.supplement_recommendations
  add constraint supplement_recommendations_period_check check (starts_on is null or ends_on is null or ends_on >= starts_on),
  add constraint supplement_recommendations_purchase_url_check check (purchase_url is null or purchase_url ~* '^https?://[^\s]+$');

comment on column public.supplement_recommendations.instructions is 'Orientação do nutricionista (texto livre). O sistema nunca sugere, calcula ou altera — só registra e apresenta (prompt Fase 10 §1).';
comment on column public.supplement_recommendations.dose_text is 'Dose/quantidade em texto ("1 cápsula", "5 g", "conforme orientação") — sem engine farmacológica (§6).';
comment on column public.supplement_recommendations.schedule_text is 'Frequência/momento em texto livre ("1x ao dia", "após o treino") — sem lista rígida (§7).';
comment on column public.supplement_recommendations.purchase_url is 'Link externo de compra configurado pelo nutricionista; só http(s). Sem cupom, afiliado ou comissão (§9–§10).';
comment on column public.supplement_recommendations.active is 'true = ATIVA (paciente vê); false = ENCERRADA (reativação explícita). Arquivada = archived_at (irreversível).';

create index supplement_recommendations_patient_active_idx
  on public.supplement_recommendations (patient_id, active) where archived_at is null;

create or replace function public.guard_supplement_recommendation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.archived_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    return new;
  end if;

  if new.patient_id <> old.patient_id then
    raise exception 'SUPPLEMENT_NOT_AUTHORIZED';
  end if;
  if old.archived_at is not null then
    -- Arquivada é só leitura (§13–§14): nem reativação, nem edição silenciosa.
    raise exception 'SUPPLEMENT_ARCHIVED';
  end if;
  if new.archived_at is not null then
    new.archived_by := coalesce(auth.uid(), new.archived_by);
    new.active := false;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger guard_supplement_recommendations
  before insert or update on public.supplement_recommendations
  for each row execute function public.guard_supplement_recommendation();

drop policy "supplement_recommendations_select" on public.supplement_recommendations;
create policy "supplement_recommendations_select"
  on public.supplement_recommendations
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or (active = true and archived_at is null and public.is_patient_self(patient_id))
  );

-- Histórico nunca é apagado (§14): arquivar é o único "remover".
revoke delete on public.supplement_recommendations from authenticated, anon;

-- 2. Feedbacks ---------------------------------------------------------------------

alter table public.feedback_messages
  add column title text,
  add column reference_date date,
  add column published_at timestamptz,
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references public.profiles (id) on delete set null;

-- Linhas anteriores a esta migration eram visíveis ao paciente (não havia
-- rascunho): preservam a visibilidade que já tinham.
update public.feedback_messages set published_at = created_at where published_at is null;

comment on column public.feedback_messages.published_at is 'null = rascunho (só o nutricionista vê). Preenchido em "Disponibilizar ao paciente" — nunca volta a null; para ocultar, arquive (§22–§26).';
comment on column public.feedback_messages.reference_date is 'Data/referência opcional do feedback (ex.: consulta ou semana a que se refere).';

create index feedback_messages_patient_published_idx
  on public.feedback_messages (patient_id, published_at desc) where archived_at is null;

create trigger set_feedback_messages_updated_at
  before update on public.feedback_messages
  for each row
  execute function public.set_updated_at();

-- Paciente só marca como lido: qualquer outra coluna alterada é recusada,
-- inclusive as novas (substitui o trigger da Fase 2, que listava colunas).
create or replace function public.prevent_feedback_tampering_by_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_profile_role() = 'PATIENT' then
    if (to_jsonb(new) - 'read_at' - 'updated_at') is distinct from (to_jsonb(old) - 'read_at' - 'updated_at') then
      raise exception 'FEEDBACK_NOT_AUTHORIZED';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_feedback_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Conteúdo já disponibilizado nunca some (§26): arquive.
    if old.published_at is not null then
      raise exception 'FEEDBACK_NOT_DELETABLE';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.archived_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    return new;
  end if;

  if public.current_profile_role() = 'PATIENT' then
    return new; -- o trigger de tamper-proofing acima já limitou a read_at
  end if;
  if new.patient_id <> old.patient_id or new.author_id <> old.author_id then
    raise exception 'FEEDBACK_NOT_AUTHORIZED';
  end if;
  if old.archived_at is not null then
    raise exception 'FEEDBACK_ARCHIVED';
  end if;
  if old.published_at is not null and new.published_at is distinct from old.published_at then
    -- Disponibilizado é definitivo (o paciente pode já ter lido).
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  if new.archived_at is not null then
    new.archived_by := coalesce(auth.uid(), new.archived_by);
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger guard_feedback_messages
  before insert or update or delete on public.feedback_messages
  for each row execute function public.guard_feedback_message();

drop policy "feedback_messages_select" on public.feedback_messages;
create policy "feedback_messages_select"
  on public.feedback_messages
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or (published_at is not null and archived_at is null and public.is_patient_self(patient_id))
  );

drop policy "feedback_messages_update" on public.feedback_messages;
create policy "feedback_messages_update"
  on public.feedback_messages
  for update
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or (published_at is not null and archived_at is null and public.is_patient_self(patient_id))
  )
  with check (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

-- Só rascunho pode ser apagado (trigger); a policy limita ao nutricionista dono.
create policy "feedback_messages_delete_nutritionist"
  on public.feedback_messages
  for delete
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id));

-- 3. Materiais ---------------------------------------------------------------------

alter table public.patient_materials
  alter column storage_path drop not null,
  add column kind text not null default 'FILE',
  add column description text,
  add column external_url text,
  add column file_name text,
  add column file_size_bytes integer check (file_size_bytes is null or file_size_bytes > 0),
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null;

alter table public.patient_materials
  add constraint patient_materials_kind_check check (kind in ('FILE', 'LINK')),
  add constraint patient_materials_source_check check (
    (kind = 'LINK' and external_url is not null and storage_path is null)
    or (kind = 'FILE' and external_url is null)
  ),
  add constraint patient_materials_external_url_check check (external_url is null or external_url ~* '^https?://[^\s]+$'),
  -- Metadados do arquivo só quando há arquivo (path sem metadados é tolerado
  -- para linhas legadas; a aplicação sempre grava os três).
  add constraint patient_materials_file_meta_check check (
    storage_path is not null or (mime_type is null and file_name is null and file_size_bytes is null)
  );

comment on column public.patient_materials.kind is 'FILE = arquivo no bucket privado patient-documents; LINK = URL externa (§35). Nunca os dois.';
comment on column public.patient_materials.storage_path is 'Objeto no bucket privado: <material_id>/<uuid>.<ext> (trigger valida o prefixo). Nunca nome de paciente nem nome original. null enquanto o upload não concluiu (material incompleto — invisível ao paciente, não atribuível).';
comment on column public.patient_materials.external_url is 'Link externo (só http(s)); aberto com noopener/noreferrer.';

create index patient_materials_nutritionist_active_idx
  on public.patient_materials (nutritionist_id, created_at desc) where archived_at is null;

create or replace function public.guard_patient_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Material que já foi atribuído alguma vez fica no histórico (§45).
    if exists (select 1 from public.material_assignments ma where ma.material_id = old.id) then
      raise exception 'MATERIAL_NOT_DELETABLE';
    end if;
    return old;
  end if;

  if new.storage_path is not null and new.storage_path !~ ('^' || new.id::text || '/') then
    raise exception 'MATERIAL_PATH_INVALID';
  end if;

  if tg_op = 'INSERT' then
    if new.archived_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    return new;
  end if;

  if new.nutritionist_id <> old.nutritionist_id or new.kind <> old.kind then
    raise exception 'MATERIAL_NOT_AUTHORIZED';
  end if;
  if old.archived_at is not null then
    raise exception 'MATERIAL_ARCHIVED';
  end if;
  if new.archived_at is not null then
    new.archived_by := coalesce(auth.uid(), new.archived_by);
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger guard_patient_materials
  before insert or update or delete on public.patient_materials
  for each row execute function public.guard_patient_material();

-- 4. Atribuições --------------------------------------------------------------------

alter table public.material_assignments
  add column assigned_by uuid references public.profiles (id) on delete set null,
  add column revoked_by uuid references public.profiles (id) on delete set null;

create or replace function public.guard_material_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.patient_materials%rowtype;
  v_patient_nutritionist uuid;
begin
  select * into v_material from public.patient_materials where id = new.material_id;
  select nutritionist_id into v_patient_nutritionist from public.patients where id = new.patient_id;
  if v_material.id is null or v_patient_nutritionist is null then
    raise exception 'MATERIAL_NOT_FOUND';
  end if;
  -- A FK não passa pela RLS: material de outro nutricionista nunca é atribuído (§57).
  if v_material.nutritionist_id <> v_patient_nutritionist then
    raise exception 'MATERIAL_NOT_AUTHORIZED';
  end if;

  if tg_op = 'INSERT' then
    if new.revoked_at is not null then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    if v_material.archived_at is not null then
      raise exception 'MATERIAL_ARCHIVED';
    end if;
    if v_material.storage_path is null and v_material.external_url is null then
      raise exception 'MATERIAL_INCOMPLETE';
    end if;
    new.assigned_by := coalesce(new.assigned_by, auth.uid());
    return new;
  end if;

  if new.material_id <> old.material_id or new.patient_id <> old.patient_id then
    raise exception 'MATERIAL_NOT_AUTHORIZED';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then
    new.revoked_by := coalesce(auth.uid(), new.revoked_by);
  elsif new.revoked_at is null and old.revoked_at is not null then
    -- Reatribuição explícita (a linha é única por material+paciente).
    if v_material.archived_at is not null then
      raise exception 'MATERIAL_ARCHIVED';
    end if;
    new.assigned_at := now();
    new.assigned_by := coalesce(auth.uid(), new.assigned_by);
    new.revoked_by := null;
  end if;
  return new;
end;
$$;

create trigger guard_material_assignments
  before insert or update on public.material_assignments
  for each row execute function public.guard_material_assignment();

-- Revogar = revoked_at; a linha nunca some (§43).
revoke delete on public.material_assignments from authenticated, anon;

-- 5. Visibilidade do paciente (helper SECURITY DEFINER — CLAUDE.md regra 11) -------

create or replace function public.material_visible_to_patient(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.material_assignments ma
    join public.patient_materials pm on pm.id = ma.material_id
    where ma.material_id = p_material_id
      and ma.revoked_at is null
      and pm.archived_at is null
      and (pm.storage_path is not null or pm.external_url is not null)
      and public.is_patient_self(ma.patient_id)
  );
$$;

revoke execute on function public.material_visible_to_patient(uuid) from public;
grant execute on function public.material_visible_to_patient(uuid) to authenticated;

drop policy "patient_materials_select_assigned_patient" on public.patient_materials;
create policy "patient_materials_select_assigned_patient"
  on public.patient_materials
  for select
  to authenticated
  using (public.material_visible_to_patient(id));

drop policy "material_assignments_select" on public.material_assignments;
create policy "material_assignments_select"
  on public.material_assignments
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or (revoked_at is null and public.is_patient_self(patient_id) and public.material_visible_to_patient(material_id))
  );

drop policy "patient_documents_select_assigned_patient" on storage.objects;
create policy "patient_documents_select_assigned_patient"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and public.material_visible_to_patient(public.safe_uuid((storage.foldername(name))[1]))
  );
