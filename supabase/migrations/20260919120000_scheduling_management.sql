-- Fase 6 — agenda, disponibilidade e agendamento (docs/DECISIONS.md, Fase 6).
--
-- A constraint anti-double-booking da Fase 2 (`appointments_no_overlap`,
-- EXCLUDE USING gist) continua sendo a fonte final da verdade e NÃO é
-- tocada aqui. Esta migration adiciona o que a Fase 2 deixou explicitamente
-- para depois:
--
--   1. `scheduling_settings` — configuração de agenda por nutricionista
--      (duração padrão, granularidade de slots, antecedências, horizonte,
--      permissões do paciente, fuso). Nenhum valor REAL de Enzo é inserido
--      pela migration; os defaults de coluna são valores técnicos de
--      desenvolvimento, documentados como tal (prompt Fase 6 §8/§13).
--   2. `appointments.cancellation_reason` + `appointments.created_by` —
--      motivo opcional de cancelamento (§28) e quem criou a consulta.
--   3. Trigger de integridade em `appointments`: `nutritionist_id` sempre
--      igual ao responsável pelo paciente (fecha a brecha da policy da
--      Fase 2, que deixava o paciente informar qualquer nutritionist_id), e
--      um PATIENT só cria SCHEDULED / muda para CANCELLED ou RESCHEDULED —
--      status clínicos/administrativos são do nutricionista (§67).
--   4. Trigger em `blocked_times`: bloqueio não pode cobrir consulta ativa
--      (§50) — inconsistência invisível é proibida.
--   5. Função `busy_intervals` (SECURITY DEFINER, só devolve intervalos, sem
--      ids) — o paciente calcula horários livres sem enxergar consultas de
--      outros pacientes.
--   6. Funções `book_appointment` e `reschedule_appointment` (SECURITY
--      INVOKER): validam disponibilidade/bloqueio/antecedência NO BANCO
--      (§11/§88), inserem sob a exclusion constraint (23P01 = horário
--      indisponível) e, no reagendamento, marcam a consulta antiga como
--      RESCHEDULED + vinculam a nova na mesma transação (§25).
--   7. Policy de INSERT em `audit_logs` para PATIENT (só `entity_type =
--      'appointment'`, `actor_id = auth.uid()`) — trilha com ator correto
--      quando o paciente agenda/reagenda/cancela (§61).

-- 1. Configuração de agenda ---------------------------------------------

create table public.scheduling_settings (
  nutritionist_id uuid primary key references public.profiles (id) on delete cascade,
  -- Defaults técnicos de desenvolvimento (NÃO são a duração/granularidade
  -- reais de Enzo — PENDENTE DE DEFINIÇÃO; docs/DECISIONS.md, Fase 6).
  default_duration_minutes integer not null default 60 check (default_duration_minutes between 10 and 480),
  slot_granularity_minutes integer not null default 30 check (slot_granularity_minutes between 5 and 240),
  -- Antecedência mínima para o paciente agendar/cancelar e horizonte máximo
  -- de agendamento. NULL = sem regra (PENDENTE DE DEFINIÇÃO comercial).
  min_booking_notice_hours integer check (min_booking_notice_hours is null or min_booking_notice_hours >= 0),
  min_cancellation_notice_hours integer check (min_cancellation_notice_hours is null or min_cancellation_notice_hours >= 0),
  max_booking_horizon_days integer check (max_booking_horizon_days is null or max_booking_horizon_days between 1 and 365),
  patient_can_book boolean not null default true,
  patient_can_choose_modality boolean not null default true,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scheduling_settings is
  'Uma linha por nutricionista. Defaults de coluna são valores técnicos de desenvolvimento — os valores reais de Enzo são PENDENTE DE DEFINIÇÃO e entram pela tela /dashboard/agenda/configuracoes.';

create trigger set_scheduling_settings_updated_at
  before update on public.scheduling_settings
  for each row
  execute function public.set_updated_at();

alter table public.scheduling_settings enable row level security;

-- Paciente (e qualquer autenticado) lê a configuração — precisa dela para
-- montar os horários; nada aqui é sensível. Só o dono escreve.
create policy "scheduling_settings_select_authenticated"
  on public.scheduling_settings
  for select
  to authenticated
  using (true);

create policy "scheduling_settings_write_owner"
  on public.scheduling_settings
  for all
  to authenticated
  using (nutritionist_id = auth.uid() and public.current_profile_role() = 'NUTRITIONIST')
  with check (nutritionist_id = auth.uid() and public.current_profile_role() = 'NUTRITIONIST');

-- 2. Colunas novas em appointments --------------------------------------

alter table public.appointments
  add column cancellation_reason text,
  add column created_by uuid references public.profiles (id) on delete set null;

comment on column public.appointments.cancellation_reason is
  'Motivo livre e opcional do cancelamento. Nunca dado clínico obrigatório (prompt Fase 6 §28).';
comment on column public.appointments.created_by is
  'Profile que criou a consulta (nutricionista ou o próprio paciente pelo portal).';

-- 3. Integridade de appointments ----------------------------------------

create or replace function public.validate_appointment_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_role public.profile_role;
begin
  select nutritionist_id into v_owner from public.patients where id = new.patient_id;
  if v_owner is null then
    raise exception 'PATIENT_NOT_FOUND';
  end if;
  if new.nutritionist_id <> v_owner then
    -- nutritionist_id adulterado (paciente de outro nutricionista, ou
    -- paciente informando um nutricionista qualquer).
    raise exception 'APPOINTMENT_NOT_AUTHORIZED';
  end if;

  if new.created_by is null and tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  -- Restrições quando quem escreve é um PATIENT (defesa em profundidade —
  -- os services da aplicação já limitam mais; aqui vale mesmo via API
  -- direta). service_role e nutricionista passam sem restrição.
  -- Segundo passo do reagendamento (reschedule_appointment): a consulta já
  -- está RESCHEDULED e só recebe o vínculo com a nova — liberado para
  -- qualquer papel.
  if tg_op = 'UPDATE' and old.status = 'RESCHEDULED' and new.status = 'RESCHEDULED'
     and old.rescheduled_to_id is null and new.rescheduled_to_id is not null then
    return new;
  end if;

  v_role := public.current_profile_role();
  if v_role = 'PATIENT' then
    if tg_op = 'INSERT' then
      if new.status <> 'SCHEDULED' then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
      if new.amount_cents is not null then
        raise exception 'APPOINTMENT_NOT_AUTHORIZED';
      end if;
    else
      if new.patient_id <> old.patient_id or new.nutritionist_id <> old.nutritionist_id
         or new.amount_cents is distinct from old.amount_cents
         or new.contract_id is distinct from old.contract_id then
        raise exception 'APPOINTMENT_NOT_AUTHORIZED';
      end if;
      if old.status not in ('SCHEDULED', 'CONFIRMED') then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
      if new.status not in ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED') then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
      -- Paciente não "confirma" administrativamente (§67).
      if new.status = 'CONFIRMED' and old.status <> 'CONFIRMED' then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_appointments_ownership
  before insert or update on public.appointments
  for each row
  execute function public.validate_appointment_ownership();

-- 4. Bloqueio não cobre consulta ativa ----------------------------------

create or replace function public.validate_blocked_time_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.appointments a
    where a.nutritionist_id = new.nutritionist_id
      and a.status in ('SCHEDULED', 'CONFIRMED')
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'BLOCKED_TIME_CONFLICT';
  end if;
  return new;
end;
$$;

create trigger validate_blocked_times_conflicts
  before insert or update on public.blocked_times
  for each row
  execute function public.validate_blocked_time_conflicts();

-- 5. Intervalos ocupados sem vazar quem ocupa ---------------------------

create or replace function public.busy_intervals(
  p_nutritionist_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.starts_at, a.ends_at, 'APPOINTMENT'::text
  from public.appointments a
  where a.nutritionist_id = p_nutritionist_id
    and a.status in ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW')
    and a.starts_at < p_to and a.ends_at > p_from
  union all
  select b.starts_at, b.ends_at, 'BLOCKED'::text
  from public.blocked_times b
  where b.nutritionist_id = p_nutritionist_id
    and b.starts_at < p_to and b.ends_at > p_from;
$$;

comment on function public.busy_intervals(uuid, timestamptz, timestamptz) is
  'Intervalos ocupados (consultas ativas + bloqueios) de um nutricionista num período — só início/fim, nunca paciente. Para o paciente calcular horários livres sem ler consultas alheias.';

revoke execute on function public.busy_intervals(uuid, timestamptz, timestamptz) from public;
grant execute on function public.busy_intervals(uuid, timestamptz, timestamptz) to authenticated;

-- 6. Validação de agendamento no banco ----------------------------------

-- Regras que valem para o PACIENTE (e para o nutricionista sem override):
-- futuro + antecedência mínima, horizonte máximo, dentro de uma
-- availability_rule ativa (no fuso configurado), fora de bloqueio,
-- modalidade permitida pela regra. A sobreposição com outra consulta NÃO é
-- checada aqui — é a exclusion constraint que decide (fonte final da
-- verdade; prompt Fase 6 §4).
create or replace function public.validate_booking_window(
  p_nutritionist_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality public.appointment_modality,
  p_as_patient boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_min_notice integer;
  v_horizon integer;
  v_can_book boolean;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday smallint;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_AVAILABILITY';
  end if;

  select timezone, min_booking_notice_hours, max_booking_horizon_days, patient_can_book
    into v_tz, v_min_notice, v_horizon, v_can_book
  from public.scheduling_settings
  where nutritionist_id = p_nutritionist_id;

  -- Sem linha de configuração: defaults técnicos (mesmos da tabela).
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_can_book := coalesce(v_can_book, true);

  if p_as_patient and not v_can_book then
    raise exception 'PATIENT_NOT_ELIGIBLE';
  end if;

  if p_starts_at <= now() then
    raise exception 'APPOINTMENT_IN_PAST';
  end if;

  if p_as_patient then
    if v_min_notice is not null and p_starts_at < now() + make_interval(hours => v_min_notice) then
      raise exception 'APPOINTMENT_IN_PAST';
    end if;
    if v_horizon is not null and p_starts_at > now() + make_interval(days => v_horizon) then
      raise exception 'INVALID_AVAILABILITY';
    end if;
  end if;

  v_local_start := p_starts_at at time zone v_tz;
  v_local_end := p_ends_at at time zone v_tz;
  v_weekday := extract(dow from v_local_start)::smallint;

  -- Precisa caber inteira numa única regra ativa do mesmo dia civil (regras
  -- adjacentes são permitidas na configuração, mas uma consulta não
  -- atravessa a fronteira entre duas nem a meia-noite — decisão documentada).
  if v_local_start::date <> v_local_end::date then
    raise exception 'INVALID_AVAILABILITY';
  end if;

  if not exists (
    select 1 from public.availability_rules r
    where r.nutritionist_id = p_nutritionist_id
      and r.active = true
      and r.weekday = v_weekday
      and (r.modality is null or r.modality = p_modality)
      and r.start_time <= v_local_start::time
      and r.end_time >= v_local_end::time
  ) then
    raise exception 'INVALID_AVAILABILITY';
  end if;

  if exists (
    select 1 from public.blocked_times b
    where b.nutritionist_id = p_nutritionist_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'BLOCKED_TIME_CONFLICT';
  end if;
end;
$$;

revoke execute on function public.validate_booking_window(uuid, timestamptz, timestamptz, public.appointment_modality, boolean) from public;
grant execute on function public.validate_booking_window(uuid, timestamptz, timestamptz, public.appointment_modality, boolean) to authenticated;

-- Cria uma consulta. Quem chama:
--  * PATIENT: só para si (`is_patient_self`), sempre validado pela janela de
--    disponibilidade, status SCHEDULED, sem valor;
--  * NUTRITIONIST: para paciente próprio; validado pela janela salvo
--    `p_allow_outside_availability = true` (override administrativo
--    explícito — §51). Pode informar contrato, valor e status inicial
--    SCHEDULED/CONFIRMED.
create or replace function public.book_appointment(
  p_patient_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality public.appointment_modality,
  p_contract_id uuid default null,
  p_amount_cents integer default null,
  p_status public.appointment_status default 'SCHEDULED',
  p_allow_outside_availability boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.profile_role;
  v_nutritionist_id uuid;
  v_patient_status public.patient_status;
  v_id uuid;
begin
  v_role := public.current_profile_role();

  select nutritionist_id, status into v_nutritionist_id, v_patient_status
  from public.patients where id = p_patient_id;

  if v_nutritionist_id is null then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  if v_role = 'PATIENT' then
    if not public.is_patient_self(p_patient_id) then
      raise exception 'APPOINTMENT_NOT_AUTHORIZED';
    end if;
    if v_patient_status <> 'ACTIVE' then
      raise exception 'PATIENT_NOT_ELIGIBLE';
    end if;
    perform public.validate_booking_window(v_nutritionist_id, p_starts_at, p_ends_at, p_modality, true);
    insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status, created_by)
    values (v_nutritionist_id, p_patient_id, p_starts_at, p_ends_at, p_modality, 'SCHEDULED', auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  if v_role <> 'NUTRITIONIST' or v_nutritionist_id <> auth.uid() then
    raise exception 'PATIENT_NOT_FOUND';
  end if;

  if p_status not in ('SCHEDULED', 'CONFIRMED') then
    raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
  end if;

  if p_contract_id is not null and not exists (
    select 1 from public.patient_contracts c where c.id = p_contract_id and c.patient_id = p_patient_id
  ) then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;

  if not p_allow_outside_availability then
    perform public.validate_booking_window(v_nutritionist_id, p_starts_at, p_ends_at, p_modality, false);
  elsif p_starts_at <= now() then
    raise exception 'APPOINTMENT_IN_PAST';
  end if;

  insert into public.appointments (nutritionist_id, patient_id, contract_id, starts_at, ends_at, modality, status, amount_cents, created_by)
  values (v_nutritionist_id, p_patient_id, p_contract_id, p_starts_at, p_ends_at, p_modality, p_status, p_amount_cents, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.book_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, uuid, integer, public.appointment_status, boolean) is
  'Cria consulta validando janela de disponibilidade no banco. Sobreposição é decidida pela exclusion constraint appointments_no_overlap (23P01).';

-- Reagenda preservando histórico (§25): a consulta original vira
-- RESCHEDULED (libera o horário) e uma NOVA consulta é criada, vinculada
-- por `rescheduled_to_id`, na mesma transação. Contrato e valor são
-- copiados — reagendar não gera nova cobrança (§26).
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality public.appointment_modality default null,
  p_allow_outside_availability boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.profile_role;
  v_old public.appointments%rowtype;
  v_modality public.appointment_modality;
  v_new_id uuid;
begin
  v_role := public.current_profile_role();

  select * into v_old from public.appointments where id = p_appointment_id;
  if v_old.id is null then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  if v_old.status not in ('SCHEDULED', 'CONFIRMED') then
    raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
  end if;

  v_modality := coalesce(p_modality, v_old.modality);

  if v_role = 'PATIENT' then
    if not public.is_patient_self(v_old.patient_id) then
      raise exception 'APPOINTMENT_NOT_AUTHORIZED';
    end if;
    if v_old.starts_at <= now() then
      raise exception 'APPOINTMENT_IN_PAST';
    end if;
    perform public.validate_booking_window(v_old.nutritionist_id, p_starts_at, p_ends_at, v_modality, true);
  elsif v_role = 'NUTRITIONIST' and v_old.nutritionist_id = auth.uid() then
    if not p_allow_outside_availability then
      perform public.validate_booking_window(v_old.nutritionist_id, p_starts_at, p_ends_at, v_modality, false);
    elsif p_starts_at <= now() then
      raise exception 'APPOINTMENT_IN_PAST';
    end if;
  else
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  -- Primeiro libera o horário antigo, depois insere o novo — assim
  -- reagendar para um horário que sobrepõe o próprio antigo funciona.
  update public.appointments
    set status = 'RESCHEDULED'
  where id = p_appointment_id;

  insert into public.appointments (nutritionist_id, patient_id, contract_id, starts_at, ends_at, modality, status, amount_cents, created_by)
  values (v_old.nutritionist_id, v_old.patient_id, v_old.contract_id, p_starts_at, p_ends_at, v_modality, 'SCHEDULED', v_old.amount_cents, auth.uid())
  returning id into v_new_id;

  update public.appointments
    set rescheduled_to_id = v_new_id
  where id = p_appointment_id;

  return v_new_id;
end;
$$;

comment on function public.reschedule_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, boolean) is
  'Original -> RESCHEDULED + nova consulta vinculada (rescheduled_to_id), numa transação. Nunca UPDATE de starts_at sem histórico.';

revoke execute on function public.book_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, uuid, integer, public.appointment_status, boolean) from public;
revoke execute on function public.reschedule_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, boolean) from public;
grant execute on function public.book_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, uuid, integer, public.appointment_status, boolean) to authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz, timestamptz, public.appointment_modality, boolean) to authenticated;

-- 7. Auditoria pelo paciente ---------------------------------------------

create policy "audit_logs_insert_patient_appointment"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    public.current_profile_role() = 'PATIENT'
    and actor_id = auth.uid()
    and entity_type = 'appointment'
  );

-- Índice para "próximas sessões"/faixas por status (Fase 2 já cobre
-- nutritionist_id + starts_at e patient_id + starts_at).
create index appointments_status_starts_at_idx
  on public.appointments (status, starts_at);
