-- Fase 9 — Avaliações físicas + bioimpedância + evolução (prompt Fase 9).
--
-- A modelagem flexível da Fase 2 (assessments + catálogo measurement_types +
-- assessment_measurements numeric(10,3)) é mantida: nenhuma coluna fixa por
-- métrica, nenhum enum novo, nenhum protocolo/fórmula. Esta migration
-- acrescenta só o que faltava para operar com dado de saúde:
--   1. Data civil da avaliação (`assessment_date`, obrigatória, nunca no
--      futuro), visibilidade para o paciente (`visible_to_patient` +
--      `published_at`), observação interna do nutricionista (`internal_notes`,
--      nunca visível ao paciente), arquivamento (`archived_at/by`) e
--      metadados do relatório de bioimpedância (path/nome/mime/tamanho —
--      o arquivo fica no bucket privado `bioimpedance-reports`).
--   2. Catálogo de métricas ampliado por migration (dado de produto): altura,
--      massa de gordura, metabolismo basal e circunferências adicionais.
--      IMC deixa de ser métrica registrável (é derivado de peso + altura na
--      apresentação; nunca armazenado).
--   3. RLS do paciente restrita a avaliações VISÍVEIS e não arquivadas
--      (tabelas e bucket). Nutricionista continua só nos próprios pacientes.
--   4. Guards: data futura, valores técnicos (não clínicos), delete físico só
--      de avaliação nunca exibida ao paciente, ownership imutável.
-- Nenhuma migration anterior é editada.

-- 1. Colunas ----------------------------------------------------------------

alter table public.assessments
  add column assessment_date date,
  add column visible_to_patient boolean not null default false,
  add column published_at timestamptz,
  add column internal_notes text,
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column report_path text,
  add column report_name text,
  add column report_mime text,
  add column report_size_bytes integer check (report_size_bytes is null or report_size_bytes > 0),
  add column report_uploaded_at timestamptz;

-- Backfill: data civil a partir do instante, no fuso do negócio.
update public.assessments
  set assessment_date = (assessed_at at time zone 'America/Sao_Paulo')::date
where assessment_date is null;

alter table public.assessments alter column assessment_date set not null;

comment on column public.assessments.assessment_date is
  'Data civil da avaliação (America/Sao_Paulo). É a fonte da ordenação e dos gráficos; assessed_at é só o instante nominal.';
comment on column public.assessments.notes is
  'Observação VISÍVEL ao paciente (quando a avaliação estiver visível).';
comment on column public.assessments.internal_notes is
  'Observação interna do nutricionista — nunca lida pelo paciente (RLS por coluna não existe: a query do portal não seleciona esta coluna e a policy de escrita é só do nutricionista).';
comment on column public.assessments.visible_to_patient is
  'Só quando true (e não arquivada) o paciente vê a avaliação, suas medidas e o relatório.';
comment on column public.assessments.report_path is
  'Objeto no bucket privado bioimpedance-reports: <patient_id>/<assessment_id>/<uuid>.<ext>. Entrega sempre por URL assinada server-side.';

create index assessments_patient_date_idx on public.assessments (patient_id, assessment_date desc);

alter table public.assessments
  add constraint assessments_report_consistent check (
    (report_path is null and report_name is null and report_mime is null and report_size_bytes is null and report_uploaded_at is null)
    or (report_path is not null and report_name is not null and report_mime is not null and report_size_bytes is not null and report_uploaded_at is not null)
  );

-- 2. Catálogo de métricas -------------------------------------------------------
-- Dado de produto (regra 10 do CLAUDE.md): entra por migration. Só métricas
-- coerentes com o material do projeto (docs/PROJECT_SPEC.md §22) e com
-- equipamentos de bioimpedância comuns. Nenhuma é obrigatória.
insert into public.measurement_types (code, name, unit) values
  ('HEIGHT', 'Altura', 'cm'),
  ('FAT_MASS', 'Massa de gordura', 'kg'),
  ('BASAL_METABOLIC_RATE', 'Metabolismo basal', 'kcal'),
  ('ABDOMEN_CIRCUMFERENCE', 'Circunferência do abdômen', 'cm'),
  ('CHEST_CIRCUMFERENCE', 'Circunferência do tórax', 'cm'),
  ('THIGH_CIRCUMFERENCE', 'Circunferência da coxa', 'cm'),
  ('CALF_CIRCUMFERENCE', 'Circunferência da panturrilha', 'cm')
on conflict (code) do nothing;

-- IMC é derivado (peso / altura²) na apresentação; não se registra.
update public.measurement_types set active = false where code = 'BMI';

-- 3. Visibilidade (helper SECURITY DEFINER — CLAUDE.md regra 11) ----------------

create or replace function public.assessment_visible_to_patient(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and a.visible_to_patient = true
      and a.archived_at is null
      and public.is_patient_self(a.patient_id)
  );
$$;

revoke execute on function public.assessment_visible_to_patient(uuid) from public;
grant execute on function public.assessment_visible_to_patient(uuid) to authenticated;

drop policy "assessments_select" on public.assessments;
create policy "assessments_select"
  on public.assessments
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or (visible_to_patient = true and archived_at is null and public.is_patient_self(patient_id))
  );

drop policy "assessment_measurements_select" on public.assessment_measurements;
create policy "assessment_measurements_select"
  on public.assessment_measurements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_measurements.assessment_id
        and public.is_nutritionist_of_patient(a.patient_id)
    )
    or public.assessment_visible_to_patient(assessment_id)
  );

-- Bucket privado: paciente só lê relatório de avaliação visível; path é
-- <patient_id>/<assessment_id>/<arquivo>.
drop policy "bioimpedance_reports_select" on storage.objects;
create policy "bioimpedance_reports_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bioimpedance-reports'
    and (
      public.is_nutritionist_of_patient(public.safe_uuid((storage.foldername(name))[1]))
      or (
        public.is_patient_self(public.safe_uuid((storage.foldername(name))[1]))
        and public.assessment_visible_to_patient(public.safe_uuid((storage.foldername(name))[2]))
      )
    )
  );

-- 4. Guards ----------------------------------------------------------------------

create or replace function public.guard_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Dado de saúde já exibido ao paciente nunca some: arquive.
    if old.published_at is not null then
      raise exception 'ASSESSMENT_NOT_DELETABLE';
    end if;
    return old;
  end if;

  -- Data civil derivada do instante quando o chamador não informa (fixtures
  -- antigas, integrações da Fase 2). A aplicação sempre informa.
  if new.assessment_date is null then
    new.assessment_date := (coalesce(new.assessed_at, now()) at time zone 'America/Sao_Paulo')::date;
  end if;
  if new.assessment_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'INVALID_ASSESSMENT_DATE';
  end if;
  if new.report_path is not null and new.report_path !~ ('^' || new.patient_id::text || '/' || new.id::text || '/') then
    raise exception 'REPORT_PATH_INVALID';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.visible_to_patient then
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  if new.patient_id <> old.patient_id then
    raise exception 'ASSESSMENT_NOT_AUTHORIZED';
  end if;
  if old.archived_at is not null and new.archived_at is null then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  if new.visible_to_patient and not old.visible_to_patient then
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger guard_assessments
  before insert or update or delete on public.assessments
  for each row execute function public.guard_assessment();

-- Valores: só ranges TÉCNICOS (nunca clínicos): > 0 sempre; percentuais ≤ 100.
create or replace function public.guard_assessment_measurement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit text;
  v_archived timestamptz;
begin
  if tg_op = 'DELETE' then
    select archived_at into v_archived from public.assessments where id = old.assessment_id;
    if v_archived is not null then
      raise exception 'ASSESSMENT_ARCHIVED';
    end if;
    return old;
  end if;
  if new.value is null or new.value <= 0 then
    raise exception 'INVALID_MEASUREMENT';
  end if;
  select unit into v_unit from public.measurement_types where id = new.measurement_type_id;
  if v_unit = '%' and new.value > 100 then
    raise exception 'INVALID_MEASUREMENT';
  end if;
  select archived_at into v_archived from public.assessments where id = new.assessment_id;
  if v_archived is not null then
    raise exception 'ASSESSMENT_ARCHIVED';
  end if;
  return new;
end;
$$;

create trigger guard_assessment_measurements
  before insert or update or delete on public.assessment_measurements
  for each row execute function public.guard_assessment_measurement();

-- 5. Funções de caso de uso (SECURITY INVOKER, sob RLS) --------------------------

-- Grava/atualiza o conjunto de medidas de uma avaliação numa transação:
-- `p_values` = [{"code": "WEIGHT", "value": 78.45}, ...]; códigos ausentes são
-- removidos (edição = estado completo do formulário).
create or replace function public.set_assessment_measurements(p_assessment_id uuid, p_values jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assessment public.assessments%rowtype;
  v_entry jsonb;
  v_type uuid;
  v_keep uuid[] := '{}';
begin
  select * into v_assessment from public.assessments where id = p_assessment_id;
  if v_assessment.id is null then
    raise exception 'ASSESSMENT_NOT_FOUND';
  end if;
  if v_assessment.archived_at is not null then
    raise exception 'ASSESSMENT_ARCHIVED';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'array' then
    raise exception 'VALIDATION_ERROR';
  end if;

  for v_entry in select * from jsonb_array_elements(p_values) loop
    select id into v_type from public.measurement_types where code = v_entry->>'code' and active = true;
    if v_type is null then
      raise exception 'INVALID_MEASUREMENT';
    end if;
    insert into public.assessment_measurements (assessment_id, measurement_type_id, value)
    values (p_assessment_id, v_type, (v_entry->>'value')::numeric)
    on conflict (assessment_id, measurement_type_id) do update set value = excluded.value;
    v_keep := array_append(v_keep, v_type);
  end loop;

  delete from public.assessment_measurements
  where assessment_id = p_assessment_id and not (measurement_type_id = any (v_keep));
end;
$$;

revoke execute on function public.set_assessment_measurements(uuid, jsonb) from public;
grant execute on function public.set_assessment_measurements(uuid, jsonb) to authenticated;

comment on function public.set_assessment_measurements(uuid, jsonb) is
  'Substitui o conjunto de medidas da avaliação (upsert + remoção do que saiu) numa transação. Valores passam pelos guards técnicos.';
