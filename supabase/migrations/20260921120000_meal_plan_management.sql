-- Fase 8 — Cardápios / plano alimentar funcional (prompt Fase 8).
--
-- A modelagem da Fase 2 (meal_plans → meal_plan_versions → meal_plan_days →
-- meals → meal_items → meal_substitutions, índice único de UMA versão
-- PUBLISHED por plano, RLS em cascata) é mantida. Esta migration adiciona
-- só o que faltava para operar de verdade:
--   1. Observações (plano, versão, dia, refeição, substituição), data de
--      início, arquivamento do plano, `published_by` da versão e ordem das
--      substituições.
--   2. Um único plano ATIVO (não arquivado) por paciente — novos planos
--      nascem depois de arquivar o anterior; a evolução normal é por versão.
--   3. Imutabilidade: conteúdo (dias/refeições/itens/substituições) só muda
--      em versão DRAFT; versão PUBLISHED/ARCHIVED é histórico. Transições de
--      status controladas por trigger; version_number nunca muda.
--   4. Funções transacionais (SECURITY INVOKER, sob RLS): create_meal_plan,
--      create_meal_plan_version (cópia profunda), publish_meal_plan_version
--      (atômica, serializada por lock no plano — nunca duas publicadas),
--      archive_meal_plan, discard_meal_plan_version, duplicate_meal,
--      duplicate_meal_plan_day. Erros com código estável (mapeados em
--      src/lib/errors/domain.ts). Nenhuma migration anterior é editada.

-- 1. Colunas ----------------------------------------------------------------

alter table public.meal_plans
  add column notes text,
  add column start_date date,
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null;

comment on column public.meal_plans.archived_at is
  'Plano arquivado: todas as versões ficam ARCHIVED e o paciente deixa de ver o cardápio. Só um plano não arquivado por paciente.';

-- Um plano ativo por paciente (a evolução é por versão; novo plano = arquivar o atual).
create unique index meal_plans_one_active_per_patient
  on public.meal_plans (patient_id)
  where archived_at is null;

alter table public.meal_plan_versions
  add column notes text,
  add column published_by uuid references public.profiles (id) on delete set null,
  add column archived_at timestamptz;

alter table public.meal_plan_days add column notes text;
alter table public.meals add column notes text;
alter table public.meal_substitutions
  add column notes text,
  add column sort_order integer not null default 0;

-- 2. Imutabilidade e transições ------------------------------------------------

-- Versão de um dia/refeição/item/substituição (usada pelos guards).
create or replace function public.meal_plan_version_status_of_day(p_day_id uuid)
returns public.meal_plan_version_status
language sql
stable
security definer
set search_path = ''
as $$
  select v.status
  from public.meal_plan_days d
  join public.meal_plan_versions v on v.id = d.version_id
  where d.id = p_day_id;
$$;

revoke execute on function public.meal_plan_version_status_of_day(uuid) from public;
grant execute on function public.meal_plan_version_status_of_day(uuid) to authenticated;

create or replace function public.guard_meal_plan_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_id uuid;
  v_status public.meal_plan_version_status;
begin
  -- Descobre o dia a partir da tabela que disparou.
  if tg_table_name = 'meal_plan_days' then
    if tg_op = 'DELETE' then
      select status into v_status from public.meal_plan_versions where id = old.version_id;
    else
      select status into v_status from public.meal_plan_versions where id = new.version_id;
      if tg_op = 'UPDATE' and new.version_id <> old.version_id then
        raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
      end if;
    end if;
  else
    if tg_table_name = 'meals' then
      v_day_id := case when tg_op = 'DELETE' then old.day_id else new.day_id end;
    elsif tg_table_name = 'meal_items' then
      select m.day_id into v_day_id from public.meals m
      where m.id = case when tg_op = 'DELETE' then old.meal_id else new.meal_id end;
    else
      select m.day_id into v_day_id
      from public.meal_items mi join public.meals m on m.id = mi.meal_id
      where mi.id = case when tg_op = 'DELETE' then old.meal_item_id else new.meal_item_id end;
    end if;
    v_status := public.meal_plan_version_status_of_day(v_day_id);
  end if;

  -- Cascata de exclusão de uma versão DRAFT descartada chega aqui com a
  -- versão já removida (status nulo): permitido. Qualquer outro caso exige DRAFT.
  if v_status is not null and v_status <> 'DRAFT' then
    raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guard_meal_plan_days_content
  before insert or update or delete on public.meal_plan_days
  for each row execute function public.guard_meal_plan_content();
create trigger guard_meals_content
  before insert or update or delete on public.meals
  for each row execute function public.guard_meal_plan_content();
create trigger guard_meal_items_content
  before insert or update or delete on public.meal_items
  for each row execute function public.guard_meal_plan_content();
create trigger guard_meal_substitutions_content
  before insert or update or delete on public.meal_substitutions
  for each row execute function public.guard_meal_plan_content();

-- Versões: número imutável, transições DRAFT→PUBLISHED, DRAFT→ARCHIVED,
-- PUBLISHED→ARCHIVED; ARCHIVED é final; só DRAFT pode ser apagada.
create or replace function public.guard_meal_plan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- A aplicação só insere DRAFT (publicar é pela função transacional);
    -- inserts diretos com PUBLISHED (seed/fixtures) continuam protegidos
    -- pelo índice único parcial da Fase 2 e recebem os carimbos.
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.status = 'PUBLISHED' then
      new.published_at := coalesce(new.published_at, now());
      new.published_by := coalesce(new.published_by, auth.uid());
    end if;
    return new;
  end if;

  if new.meal_plan_id <> old.meal_plan_id or new.version_number <> old.version_number then
    raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
  end if;
  if new.status <> old.status then
    if old.status = 'ARCHIVED' then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    if old.status = 'PUBLISHED' and new.status <> 'ARCHIVED' then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;
    if new.status = 'PUBLISHED' then
      new.published_at := coalesce(new.published_at, now());
      new.published_by := coalesce(new.published_by, auth.uid());
    end if;
    if new.status = 'ARCHIVED' then
      new.archived_at := coalesce(new.archived_at, now());
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_meal_plan_versions
  before insert or update or delete on public.meal_plan_versions
  for each row execute function public.guard_meal_plan_version();

-- Plano: paciente/nutricionista nunca mudam; plano arquivado não volta.
create or replace function public.guard_meal_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.patient_id <> old.patient_id or new.nutritionist_id <> old.nutritionist_id then
    raise exception 'MEAL_PLAN_NOT_EDITABLE';
  end if;
  if old.archived_at is not null and new.archived_at is null then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  return new;
end;
$$;

create trigger guard_meal_plans
  before update on public.meal_plans
  for each row execute function public.guard_meal_plan();

-- Sem DELETE de planos/versões pela aplicação (histórico); rascunho é
-- descartado por função própria.
revoke delete on public.meal_plans from anon, authenticated;

-- 3. Cópias profundas (privadas: usadas só pelas funções abaixo) ------------

create or replace function public.copy_meal_into_day(p_meal_id uuid, p_target_day_id uuid, p_sort_order integer)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_meal uuid;
  v_item record;
  v_new_item uuid;
begin
  insert into public.meals (day_id, name, time_of_day, sort_order, notes)
  select p_target_day_id, name, time_of_day, p_sort_order, notes
  from public.meals where id = p_meal_id
  returning id into v_new_meal;

  for v_item in
    select * from public.meal_items where meal_id = p_meal_id order by sort_order, created_at
  loop
    insert into public.meal_items (meal_id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, instructions, notes, sort_order)
    values (v_new_meal, v_item.food_name, v_item.quantity, v_item.unit, v_item.calories, v_item.protein_g, v_item.carbs_g, v_item.fat_g, v_item.fiber_g, v_item.instructions, v_item.notes, v_item.sort_order)
    returning id into v_new_item;

    insert into public.meal_substitutions (meal_item_id, substitute_food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, notes, sort_order)
    select v_new_item, substitute_food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, notes, sort_order
    from public.meal_substitutions where meal_item_id = v_item.id;
  end loop;

  return v_new_meal;
end;
$$;

create or replace function public.copy_day_meals(p_source_day_id uuid, p_target_day_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meal record;
  v_base integer;
begin
  select coalesce(max(sort_order), 0) into v_base from public.meals where day_id = p_target_day_id;
  for v_meal in
    select id, sort_order from public.meals where day_id = p_source_day_id order by sort_order, created_at
  loop
    v_base := v_base + 1;
    perform public.copy_meal_into_day(v_meal.id, p_target_day_id, v_base);
  end loop;
end;
$$;

revoke execute on function public.copy_meal_into_day(uuid, uuid, integer) from public;
revoke execute on function public.copy_day_meals(uuid, uuid) from public;
grant execute on function public.copy_meal_into_day(uuid, uuid, integer) to authenticated;
grant execute on function public.copy_day_meals(uuid, uuid) to authenticated;

-- 4. Funções de caso de uso -------------------------------------------------

-- Cria o plano + versão 1 (DRAFT). `p_source_version_id` (opcional) copia a
-- estrutura de uma versão anterior (plano arquivado) como base.
create or replace function public.create_meal_plan(
  p_patient_id uuid,
  p_title text,
  p_start_date date default null,
  p_notes text default null,
  p_source_version_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nutritionist uuid;
  v_plan_id uuid;
  v_version_id uuid;
  v_day record;
  v_new_day uuid;
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'VALIDATION_ERROR';
  end if;
  select nutritionist_id into v_nutritionist from public.patients where id = p_patient_id;
  if v_nutritionist is null or v_nutritionist <> auth.uid() then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  if exists (select 1 from public.meal_plans where patient_id = p_patient_id and archived_at is null) then
    raise exception 'MEAL_PLAN_ACTIVE_EXISTS';
  end if;
  if p_source_version_id is not null and not exists (
    select 1 from public.meal_plan_versions v join public.meal_plans mp on mp.id = v.meal_plan_id
    where v.id = p_source_version_id and mp.patient_id = p_patient_id
  ) then
    raise exception 'MEAL_PLAN_VERSION_NOT_FOUND';
  end if;

  insert into public.meal_plans (patient_id, nutritionist_id, title, start_date, notes)
  values (p_patient_id, v_nutritionist, btrim(p_title), p_start_date, nullif(btrim(p_notes), ''))
  returning id into v_plan_id;

  insert into public.meal_plan_versions (meal_plan_id, version_number, status, created_by)
  values (v_plan_id, 1, 'DRAFT', auth.uid())
  returning id into v_version_id;

  if p_source_version_id is not null then
    for v_day in select id, weekday, notes from public.meal_plan_days where version_id = p_source_version_id loop
      insert into public.meal_plan_days (version_id, weekday, notes) values (v_version_id, v_day.weekday, v_day.notes)
      returning id into v_new_day;
      perform public.copy_day_meals(v_day.id, v_new_day);
    end loop;
  end if;

  return v_plan_id;
exception
  when unique_violation then
    raise exception 'MEAL_PLAN_ACTIVE_EXISTS';
end;
$$;

-- Nova versão DRAFT copiando a estrutura da versão publicada (ou da mais
-- recente). Só um rascunho por vez.
create or replace function public.create_meal_plan_version(p_plan_id uuid, p_source_version_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.meal_plans%rowtype;
  v_source uuid;
  v_number integer;
  v_version_id uuid;
  v_day record;
  v_new_day uuid;
begin
  select * into v_plan from public.meal_plans where id = p_plan_id for update;
  if v_plan.id is null or v_plan.nutritionist_id <> auth.uid() then
    raise exception 'MEAL_PLAN_NOT_FOUND';
  end if;
  if v_plan.archived_at is not null then
    raise exception 'MEAL_PLAN_ARCHIVED';
  end if;
  if exists (select 1 from public.meal_plan_versions where meal_plan_id = p_plan_id and status = 'DRAFT') then
    raise exception 'MEAL_PLAN_DRAFT_EXISTS';
  end if;

  if p_source_version_id is not null then
    select id into v_source from public.meal_plan_versions where id = p_source_version_id and meal_plan_id = p_plan_id;
    if v_source is null then
      raise exception 'MEAL_PLAN_VERSION_NOT_FOUND';
    end if;
  else
    select id into v_source from public.meal_plan_versions
    where meal_plan_id = p_plan_id
    order by (status = 'PUBLISHED') desc, version_number desc
    limit 1;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_number from public.meal_plan_versions where meal_plan_id = p_plan_id;

  insert into public.meal_plan_versions (meal_plan_id, version_number, status, created_by, notes)
  select p_plan_id, v_number, 'DRAFT', auth.uid(), notes from public.meal_plan_versions where id = v_source
  returning id into v_version_id;
  if v_version_id is null then
    insert into public.meal_plan_versions (meal_plan_id, version_number, status, created_by)
    values (p_plan_id, v_number, 'DRAFT', auth.uid())
    returning id into v_version_id;
  end if;

  if v_source is not null then
    for v_day in select id, weekday, notes from public.meal_plan_days where version_id = v_source order by weekday loop
      insert into public.meal_plan_days (version_id, weekday, notes) values (v_version_id, v_day.weekday, v_day.notes)
      returning id into v_new_day;
      perform public.copy_day_meals(v_day.id, v_new_day);
    end loop;
  end if;

  return v_version_id;
end;
$$;

-- Publicação atômica: lock no plano serializa tentativas concorrentes; a
-- versão publicada anterior vira ARCHIVED (histórico) e a nova PUBLISHED.
-- O índice único parcial da Fase 2 continua sendo a última linha de defesa.
create or replace function public.publish_meal_plan_version(p_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.meal_plan_versions%rowtype;
  v_plan public.meal_plans%rowtype;
begin
  select v.* into v_version from public.meal_plan_versions v where v.id = p_version_id;
  if v_version.id is null then
    raise exception 'MEAL_PLAN_VERSION_NOT_FOUND';
  end if;
  select * into v_plan from public.meal_plans where id = v_version.meal_plan_id for update;
  if v_plan.id is null or v_plan.nutritionist_id <> auth.uid() then
    raise exception 'MEAL_PLAN_VERSION_NOT_FOUND';
  end if;
  if v_plan.archived_at is not null then
    raise exception 'MEAL_PLAN_ARCHIVED';
  end if;

  -- Relê depois do lock: outra transação pode ter publicado enquanto esperávamos.
  select v.* into v_version from public.meal_plan_versions v where v.id = p_version_id;
  if v_version.status = 'PUBLISHED' then
    raise exception 'MEAL_PLAN_ALREADY_PUBLISHED';
  end if;
  if v_version.status <> 'DRAFT' then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  -- Estrutura mínima: pelo menos um dia com uma refeição com um alimento.
  if not exists (
    select 1
    from public.meal_plan_days d
    join public.meals m on m.day_id = d.id
    join public.meal_items mi on mi.meal_id = m.id
    where d.version_id = p_version_id
  ) then
    raise exception 'INVALID_MEAL_PLAN_STRUCTURE';
  end if;

  update public.meal_plan_versions
    set status = 'ARCHIVED', archived_at = now()
  where meal_plan_id = v_plan.id and status = 'PUBLISHED';

  update public.meal_plan_versions
    set status = 'PUBLISHED', published_at = now(), published_by = auth.uid()
  where id = p_version_id;

  return p_version_id;
exception
  when unique_violation then
    raise exception 'PUBLISH_CONFLICT';
end;
$$;

-- Arquiva o plano inteiro: todas as versões viram ARCHIVED, paciente deixa de ver.
create or replace function public.archive_meal_plan(p_plan_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.meal_plans%rowtype;
begin
  select * into v_plan from public.meal_plans where id = p_plan_id for update;
  if v_plan.id is null or v_plan.nutritionist_id <> auth.uid() then
    raise exception 'MEAL_PLAN_NOT_FOUND';
  end if;
  if v_plan.archived_at is not null then
    raise exception 'MEAL_PLAN_ARCHIVED';
  end if;

  update public.meal_plan_versions
    set status = 'ARCHIVED', archived_at = now()
  where meal_plan_id = p_plan_id and status <> 'ARCHIVED';

  update public.meal_plans
    set archived_at = now(), archived_by = auth.uid()
  where id = p_plan_id;
end;
$$;

-- Descarta um rascunho (única exclusão física permitida; histórico intacto).
create or replace function public.discard_meal_plan_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version public.meal_plan_versions%rowtype;
begin
  select v.* into v_version from public.meal_plan_versions v
  join public.meal_plans mp on mp.id = v.meal_plan_id
  where v.id = p_version_id and mp.nutritionist_id = auth.uid();
  if v_version.id is null then
    raise exception 'MEAL_PLAN_VERSION_NOT_FOUND';
  end if;
  if v_version.status <> 'DRAFT' then
    raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
  end if;
  if v_version.version_number = 1 then
    -- O plano ficaria sem versão nenhuma: use "arquivar plano".
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  delete from public.meal_plan_versions where id = p_version_id;
end;
$$;

-- Duplica uma refeição (estrutura + alimentos + substituições, ids novos)
-- para um dia da MESMA versão (DRAFT). Sem dia de destino = o próprio dia.
create or replace function public.duplicate_meal(p_meal_id uuid, p_target_day_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meal public.meals%rowtype;
  v_target uuid;
  v_order integer;
begin
  select * into v_meal from public.meals where id = p_meal_id;
  if v_meal.id is null then
    raise exception 'MEAL_NOT_FOUND';
  end if;
  v_target := coalesce(p_target_day_id, v_meal.day_id);
  if not exists (
    select 1 from public.meal_plan_days a join public.meal_plan_days b on a.version_id = b.version_id
    where a.id = v_meal.day_id and b.id = v_target
  ) then
    raise exception 'MEAL_PLAN_DAY_NOT_FOUND';
  end if;
  if public.meal_plan_version_status_of_day(v_target) <> 'DRAFT' then
    raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
  end if;
  select coalesce(max(sort_order), 0) + 1 into v_order from public.meals where day_id = v_target;
  return public.copy_meal_into_day(p_meal_id, v_target, v_order);
end;
$$;

-- Duplica um dia para outro dia da semana da mesma versão. Destino com
-- conteúdo só é substituído com `p_replace = true` (a UI confirma).
create or replace function public.duplicate_meal_plan_day(p_day_id uuid, p_target_weekday smallint, p_replace boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day public.meal_plan_days%rowtype;
  v_target public.meal_plan_days%rowtype;
begin
  select * into v_day from public.meal_plan_days where id = p_day_id;
  if v_day.id is null then
    raise exception 'MEAL_PLAN_DAY_NOT_FOUND';
  end if;
  if p_target_weekday is null or p_target_weekday < 0 or p_target_weekday > 6 or p_target_weekday = v_day.weekday then
    raise exception 'VALIDATION_ERROR';
  end if;
  if public.meal_plan_version_status_of_day(p_day_id) <> 'DRAFT' then
    raise exception 'MEAL_PLAN_VERSION_NOT_EDITABLE';
  end if;

  select * into v_target from public.meal_plan_days where version_id = v_day.version_id and weekday = p_target_weekday;
  if v_target.id is null then
    insert into public.meal_plan_days (version_id, weekday, notes) values (v_day.version_id, p_target_weekday, v_day.notes)
    returning * into v_target;
  elsif exists (select 1 from public.meals where day_id = v_target.id) then
    if not p_replace then
      raise exception 'MEAL_PLAN_DAY_NOT_EMPTY';
    end if;
    delete from public.meals where day_id = v_target.id;
  end if;

  perform public.copy_day_meals(v_day.id, v_target.id);
  return v_target.id;
end;
$$;

revoke execute on function public.create_meal_plan(uuid, text, date, text, uuid) from public;
revoke execute on function public.create_meal_plan_version(uuid, uuid) from public;
revoke execute on function public.publish_meal_plan_version(uuid) from public;
revoke execute on function public.archive_meal_plan(uuid) from public;
revoke execute on function public.discard_meal_plan_version(uuid) from public;
revoke execute on function public.duplicate_meal(uuid, uuid) from public;
revoke execute on function public.duplicate_meal_plan_day(uuid, smallint, boolean) from public;

grant execute on function public.create_meal_plan(uuid, text, date, text, uuid) to authenticated;
grant execute on function public.create_meal_plan_version(uuid, uuid) to authenticated;
grant execute on function public.publish_meal_plan_version(uuid) to authenticated;
grant execute on function public.archive_meal_plan(uuid) to authenticated;
grant execute on function public.discard_meal_plan_version(uuid) to authenticated;
grant execute on function public.duplicate_meal(uuid, uuid) to authenticated;
grant execute on function public.duplicate_meal_plan_day(uuid, smallint, boolean) to authenticated;

comment on function public.publish_meal_plan_version(uuid) is
  'Publica um rascunho: lock no plano, versão publicada anterior vira ARCHIVED, nova vira PUBLISHED — nunca duas publicadas (índice único parcial da Fase 2).';
