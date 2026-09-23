-- Fase 12 — Notificações + e-mail + WhatsApp + lembretes (parte 2/2).
--
-- Modelo de OUTBOX transacional sobre as tabelas da Fase 2:
--   operação de negócio (consulta, feedback, material, suplemento)
--     → trigger AFTER na MESMA transação enfileira `notification_events`
--       (idempotente por `dedupe_key`; lembrete de 5 dias já nasce com
--       `scheduled_for`)
--     → job gera `notification_deliveries` por canal (IN_APP / EMAIL /
--       WHATSAPP; idempotente por `idempotency_key`)
--     → worker faz claim atômico (`FOR UPDATE SKIP LOCKED`), chama o provider
--       e grava o status/tentativas/backoff.
-- Falha de provider NUNCA desfaz a operação de negócio: o evento já está
-- gravado e a entrega é reprocessada. Nenhuma migration anterior é editada.
--
-- Acrescenta ainda: `appointments.patient_confirmed_at` + regra do trigger
-- de ownership permitindo ao PACIENTE confirmar presença (SCHEDULED →
-- CONFIRMED só junto com `patient_confirmed_at`), função
-- `confirm_appointment_presence`, tokens single-use para confirmação por
-- link (hash, expiração, propósito), preferências por evento/canal do
-- nutricionista e por canal do paciente, e RLS de leitura restrita ao dono.

-- 1. Eventos (outbox) ----------------------------------------------------------------

alter table public.notification_events
  add column patient_id uuid references public.patients (id) on delete cascade,
  add column nutritionist_id uuid references public.profiles (id) on delete cascade,
  add column payload jsonb not null default '{}'::jsonb,
  add column dedupe_key text,
  add column scheduled_for timestamptz not null default now(),
  add column processed_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancel_reason text;

comment on column public.notification_events.dedupe_key is
  'Idempotência da CRIAÇÃO do evento (ex.: appointment_created:<id>, appointment_reminder_5d:<id>:<starts_at>). Conflito = evento já enfileirado.';
comment on column public.notification_events.payload is
  'Só o mínimo para renderizar a mensagem (ids, instante da consulta, modalidade, título de material). Nunca conteúdo clínico (feedback, dose, orientação).';
comment on column public.notification_events.scheduled_for is
  'Quando o evento passa a gerar entregas (lembrete de 5 dias = instante da consulta - 5 dias civis em America/Sao_Paulo). Eventos imediatos usam now().';

create unique index notification_events_dedupe_key_idx on public.notification_events (dedupe_key) where dedupe_key is not null;
create index notification_events_due_idx on public.notification_events (scheduled_for) where processed_at is null and cancelled_at is null;
create index notification_events_nutritionist_idx on public.notification_events (nutritionist_id, created_at desc);

-- 1b. Item in-app (Fase 2) ganha link para o portal e vínculo com o evento -------------------
alter table public.notifications
  add column link text check (link is null or link ~ '^/[^/].*$' or link = '/'),
  add column event_id uuid references public.notification_events (id) on delete set null;

comment on column public.notifications.link is
  'Caminho RELATIVO do portal (ex.: /paciente/consultas). Nunca URL absoluta nem token — a autorização é a sessão.';

-- Um item in-app por evento e destinatário (idempotência da entrega IN_APP).
-- (Índice não parcial de propósito: o upsert do PostgREST infere ON CONFLICT pelas colunas; NULL em event_id nunca colide.)
create unique index notifications_event_recipient_idx on public.notifications (event_id, recipient_id);

-- 2. Entregas -------------------------------------------------------------------------

alter table public.notification_deliveries
  add column patient_id uuid references public.patients (id) on delete cascade,
  add column nutritionist_id uuid references public.profiles (id) on delete cascade,
  add column event_type text,
  add column template_key text,
  add column provider text,
  add column variables jsonb not null default '{}'::jsonb,
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column last_attempt_at timestamptz,
  add column next_attempt_at timestamptz,
  add column last_error_code text,
  add column last_http_status integer,
  add column processing_started_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column skipped_reason text;

comment on column public.notification_deliveries.idempotency_key is
  'Fase 12: <event_id>:<canal>:<patient_id> — a mesma mensagem nunca é criada duas vezes para o mesmo evento/canal/destinatário.';
comment on column public.notification_deliveries.last_error_code is
  'Só o código técnico sanitizado (PROVIDER_TIMEOUT, RATE_LIMITED, INVALID_RECIPIENT…). Nunca payload/resposta do provider.';
comment on column public.notification_deliveries.variables is
  'Variáveis de template (datas formatadas, modalidade, título). Nunca conteúdo clínico, token ou segredo.';

create index notification_deliveries_due_idx on public.notification_deliveries (next_attempt_at, created_at) where status in ('PENDING', 'PROCESSING');
create index notification_deliveries_nutritionist_idx on public.notification_deliveries (nutritionist_id, created_at desc);
create index notification_deliveries_patient_idx on public.notification_deliveries (patient_id, created_at desc);

-- 3. Leitura restrita ao dono (a policy da Fase 2 liberava a qualquer nutricionista) ----

drop policy "notification_events_select_nutritionist" on public.notification_events;
create policy "notification_events_select_owner"
  on public.notification_events
  for select
  to authenticated
  using (nutritionist_id = auth.uid());

drop policy "notification_deliveries_select_nutritionist" on public.notification_deliveries;
create policy "notification_deliveries_select_owner"
  on public.notification_deliveries
  for select
  to authenticated
  using (nutritionist_id = auth.uid());
-- Escrita continua exclusiva do service role (jobs) — sem policy de insert/update/delete.

-- 4. Enfileirar / cancelar (usadas pelos triggers; SECURITY DEFINER, search_path vazio) ---

create or replace function public.enqueue_notification_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_patient_id uuid,
  p_nutritionist_id uuid,
  p_payload jsonb,
  p_dedupe_key text,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notification_events (event_type, related_entity_type, related_entity_id, patient_id, nutritionist_id, payload, dedupe_key, scheduled_for)
  values (p_event_type, p_entity_type, p_entity_id, p_patient_id, p_nutritionist_id, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_scheduled_for, now()))
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

/** Cancela eventos ainda não processados (e entregas PENDING deles) de uma entidade, por tipo. */
create or replace function public.cancel_pending_notification_events(p_entity_type text, p_entity_id uuid, p_event_types text[], p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with cancelled as (
    update public.notification_events e
      set cancelled_at = now(), cancel_reason = p_reason
    where e.related_entity_type = p_entity_type
      and e.related_entity_id = p_entity_id
      and e.event_type = any (p_event_types)
      and e.cancelled_at is null
      and e.processed_at is null
    returning e.id
  )
  select count(*) into v_count from cancelled;
  -- Entregas já geradas mas ainda não enviadas (evento processado antes do cancelamento).
  update public.notification_deliveries d
    set status = 'CANCELLED', cancelled_at = now(), next_attempt_at = null
  from public.notification_events e
  where d.event_id = e.id
    and e.related_entity_type = p_entity_type
    and e.related_entity_id = p_entity_id
    and e.event_type = any (p_event_types)
    and d.status in ('PENDING', 'PROCESSING');
  return v_count;
end;
$$;

/** Instante do lembrete: 5 dias civis antes, no mesmo relógio de parede do fuso (não "starts_at - 5 days" cego). */
create or replace function public.appointment_reminder_due_at(p_starts_at timestamptz, p_timezone text default 'America/Sao_Paulo')
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (((p_starts_at at time zone p_timezone) - interval '5 days') at time zone p_timezone);
$$;

-- 5. Outbox de consultas (trigger AFTER — mesma transação de book/reschedule/cancel) --------

create or replace function public.notify_appointment_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_due timestamptz;
  v_payload jsonb;
begin
  select coalesce(s.timezone, 'America/Sao_Paulo') into v_tz from public.scheduling_settings s where s.nutritionist_id = new.nutritionist_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_payload := jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at, 'ends_at', new.ends_at, 'modality', new.modality);

  if tg_op = 'INSERT' then
    if new.status in ('SCHEDULED', 'CONFIRMED') then
      perform public.enqueue_notification_event('APPOINTMENT_CREATED', 'appointment', new.id, new.patient_id, new.nutritionist_id, v_payload, 'appointment_created:' || new.id::text);
      v_due := public.appointment_reminder_due_at(new.starts_at, v_tz);
      -- Consulta criada com menos de 5 dias: o evento de agendamento já comunica; sem lembrete retroativo (§43).
      if v_due > now() then
        perform public.enqueue_notification_event('APPOINTMENT_REMINDER', 'appointment', new.id, new.patient_id, new.nutritionist_id, v_payload, 'appointment_reminder_5d:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text, v_due);
      end if;
    end if;
    return new;
  end if;

  -- Segundo passo do reagendamento: a antiga recebe o vínculo com a nova.
  if old.status = 'RESCHEDULED' and new.status = 'RESCHEDULED' and old.rescheduled_to_id is null and new.rescheduled_to_id is not null then
    perform public.cancel_pending_notification_events('appointment', new.rescheduled_to_id, array['APPOINTMENT_CREATED'], 'RESCHEDULED_FROM_EXISTING');
    perform public.enqueue_notification_event(
      'APPOINTMENT_RESCHEDULED', 'appointment', new.rescheduled_to_id, new.patient_id, new.nutritionist_id,
      (select jsonb_build_object('appointment_id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'modality', a.modality, 'previous_appointment_id', new.id, 'previous_starts_at', new.starts_at) from public.appointments a where a.id = new.rescheduled_to_id),
      'appointment_rescheduled:' || new.rescheduled_to_id::text
    );
    return new;
  end if;

  if new.status <> old.status then
    if new.status in ('CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW') then
      perform public.cancel_pending_notification_events('appointment', new.id, array['APPOINTMENT_REMINDER'], new.status::text);
    end if;
    if new.status = 'CANCELLED' then
      perform public.enqueue_notification_event('APPOINTMENT_CANCELLED', 'appointment', new.id, new.patient_id, new.nutritionist_id, v_payload, 'appointment_cancelled:' || new.id::text);
    elsif new.status = 'CONFIRMED' and new.patient_confirmed_at is null then
      -- Confirmação administrativa pelo nutricionista → aviso in-app (roteamento decide os canais).
      perform public.enqueue_notification_event('APPOINTMENT_CONFIRMED', 'appointment', new.id, new.patient_id, new.nutritionist_id, v_payload, 'appointment_confirmed:' || new.id::text);
    end if;
    return new;
  end if;

  -- Edição de data/hora sem reagendamento (Fase 6 §24): lembrete acompanha o novo horário.
  if new.starts_at <> old.starts_at and new.status in ('SCHEDULED', 'CONFIRMED') then
    perform public.cancel_pending_notification_events('appointment', new.id, array['APPOINTMENT_REMINDER'], 'TIME_CHANGED');
    v_due := public.appointment_reminder_due_at(new.starts_at, v_tz);
    if v_due > now() then
      perform public.enqueue_notification_event('APPOINTMENT_REMINDER', 'appointment', new.id, new.patient_id, new.nutritionist_id, v_payload, 'appointment_reminder_5d:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text, v_due);
    end if;
  end if;
  return new;
end;
$$;

create trigger notify_appointment_changes
  after insert or update on public.appointments
  for each row execute function public.notify_appointment_changes();

-- 6. Outbox de feedback / material / suplemento (Fase 10) ---------------------------------

create or replace function public.notify_feedback_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nutri uuid;
begin
  if new.published_at is not null and new.archived_at is null and (tg_op = 'INSERT' or old.published_at is null) then
    select nutritionist_id into v_nutri from public.patients where id = new.patient_id;
    -- Só ids: nunca título nem conteúdo (§18/§71).
    perform public.enqueue_notification_event('FEEDBACK_PUBLISHED', 'feedback_message', new.id, new.patient_id, v_nutri, jsonb_build_object('feedback_id', new.id), 'feedback_published:' || new.id::text);
  end if;
  return new;
end;
$$;

create trigger notify_feedback_published
  after insert or update on public.feedback_messages
  for each row execute function public.notify_feedback_published();

create or replace function public.notify_material_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nutri uuid;
  v_title text;
begin
  if new.revoked_at is null and (tg_op = 'INSERT' or old.revoked_at is not null) then
    select p.nutritionist_id into v_nutri from public.patients p where p.id = new.patient_id;
    select m.title into v_title from public.patient_materials m where m.id = new.material_id;
    perform public.enqueue_notification_event(
      'MATERIAL_ASSIGNED', 'material_assignment', new.id, new.patient_id, v_nutri,
      jsonb_build_object('assignment_id', new.id, 'material_id', new.material_id, 'material_title', left(coalesce(v_title, ''), 120)),
      'material_assigned:' || new.id::text || ':' || extract(epoch from new.assigned_at)::bigint::text
    );
  end if;
  return new;
end;
$$;

create trigger notify_material_assigned
  after insert or update on public.material_assignments
  for each row execute function public.notify_material_assigned();

create or replace function public.notify_supplement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nutri uuid;
begin
  if new.active and new.archived_at is null then
    select nutritionist_id into v_nutri from public.patients where id = new.patient_id;
    -- Sem dose/orientação (§73): só o id.
    perform public.enqueue_notification_event('SUPPLEMENT_RECOMMENDATION_CREATED', 'supplement_recommendation', new.id, new.patient_id, v_nutri, jsonb_build_object('supplement_id', new.id), 'supplement_created:' || new.id::text);
  end if;
  return new;
end;
$$;

create trigger notify_supplement_created
  after insert on public.supplement_recommendations
  for each row execute function public.notify_supplement_created();

-- 7. Confirmação de presença pelo paciente (§48–§49) -----------------------------------

alter table public.appointments add column patient_confirmed_at timestamptz;
comment on column public.appointments.patient_confirmed_at is
  'Quando o PACIENTE confirmou presença (portal ou link tokenizado). SCHEDULED → CONFIRMED pelo paciente só é aceito junto com esta coluna.';

-- Mesma função da Fase 6 (20260919120000), com UMA regra a mais: o paciente
-- pode levar SCHEDULED → CONFIRMED apenas se estiver registrando
-- patient_confirmed_at (confirmação de presença), nunca "administrativamente".
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
    raise exception 'APPOINTMENT_NOT_AUTHORIZED';
  end if;

  if new.created_by is null and tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;

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
      if new.patient_confirmed_at is not null then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
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
      -- Paciente só "confirma" como confirmação de PRESENÇA (Fase 12 §48–§49).
      if new.status = 'CONFIRMED' and old.status <> 'CONFIRMED'
         and (new.patient_confirmed_at is null or old.patient_confirmed_at is not null) then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
      if new.patient_confirmed_at is distinct from old.patient_confirmed_at and new.status <> 'CONFIRMED' then
        raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
      end if;
    end if;
  end if;

  return new;
end;
$$;

/**
 * Confirmar presença (SECURITY INVOKER — vale a RLS de quem chama):
 * SCHEDULED e futura → CONFIRMED + patient_confirmed_at. Já confirmada = sem
 * efeito (idempotente); outro status/passado → INVALID_APPOINTMENT_STATUS_TRANSITION;
 * consulta invisível → APPOINTMENT_NOT_FOUND.
 */
create or replace function public.confirm_appointment_presence(p_appointment_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.appointments%rowtype;
begin
  select * into v_row from public.appointments where id = p_appointment_id for update;
  if v_row.id is null then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;
  if v_row.status = 'CONFIRMED' then
    return 'ALREADY_CONFIRMED';
  end if;
  if v_row.status <> 'SCHEDULED' or v_row.starts_at <= now() then
    raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION';
  end if;
  update public.appointments set status = 'CONFIRMED', patient_confirmed_at = now() where id = p_appointment_id;
  return 'CONFIRMED';
end;
$$;

revoke execute on function public.confirm_appointment_presence(uuid) from public, anon;
grant execute on function public.confirm_appointment_presence(uuid) to authenticated, service_role;

-- 8. Tokens de ação por link (§20/§93–§95) --------------------------------------------------

create table public.notification_action_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  purpose text not null check (purpose in ('APPOINTMENT_CONFIRM')),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  delivery_id uuid references public.notification_deliveries (id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notification_action_tokens is
  'Só o HASH (sha256) do token aleatório; o token em si vive apenas no link enviado. Propósito único, expira, uso único (used_at). Escrita/leitura só via service role.';

create index notification_action_tokens_appointment_idx on public.notification_action_tokens (appointment_id);

alter table public.notification_action_tokens enable row level security;
-- Sem policies: nenhum papel autenticado lê ou escreve tokens via API.

-- 9. Preferências (§31/§75) ----------------------------------------------------------------

create table public.notification_preferences (
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type ~ '^[A-Z_]{3,60}$'),
  channel public.notification_channel not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (nutritionist_id, event_type, channel)
);

comment on table public.notification_preferences is
  'Canal ligado/desligado por tipo de evento, por nutricionista. Sem linha = default técnico da aplicação (docs/DECISIONS.md, Fase 12) — nunca afirmado como preferência real.';

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_owner"
  on public.notification_preferences
  for all
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create table public.patient_notification_preferences (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.patient_notification_preferences is
  'Preferência do paciente por canal EXTERNO (e-mail/WhatsApp) para avisos operacionais. In-app é sempre entregue. Sem linha = ambos ligados. Não é opt-in de marketing (não existe marketing).';

create trigger set_patient_notification_preferences_updated_at
  before update on public.patient_notification_preferences
  for each row execute function public.set_updated_at();

alter table public.patient_notification_preferences enable row level security;

create policy "patient_notification_preferences_self"
  on public.patient_notification_preferences
  for all
  to authenticated
  using (public.is_patient_self(patient_id))
  with check (public.is_patient_self(patient_id));

create policy "patient_notification_preferences_select_nutritionist"
  on public.patient_notification_preferences
  for select
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id));

-- 10. Claim atômico do worker (§59–§60) -------------------------------------------------------

create or replace function public.claim_notification_deliveries(p_limit integer default 50, p_stale_minutes integer default 10)
returns setof public.notification_deliveries
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where (d.status = 'PENDING' and (d.next_attempt_at is null or d.next_attempt_at <= now()))
       or (d.status = 'PROCESSING' and d.processing_started_at < now() - make_interval(mins => p_stale_minutes))
    order by coalesce(d.next_attempt_at, d.created_at)
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  update public.notification_deliveries d
    set status = 'PROCESSING',
        processing_started_at = now(),
        attempt_count = d.attempt_count + 1,
        last_attempt_at = now()
  from candidates c
  where d.id = c.id
  returning d.*;
$$;

-- Supabase concede EXECUTE por default a anon/authenticated em funções de public: revogar explicitamente.
revoke execute on function public.claim_notification_deliveries(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer, integer) to service_role;

comment on function public.claim_notification_deliveries(integer, integer) is
  'Worker: pega até p_limit entregas elegíveis com FOR UPDATE SKIP LOCKED (dois workers nunca pegam a mesma). PROCESSING mais antigo que p_stale_minutes volta a ser elegível (worker morto).';

/** Eventos devidos (agendados até agora, não processados, não cancelados) — o processamento é idempotente pelas entregas. */
create or replace function public.claim_notification_events(p_limit integer default 100)
returns setof public.notification_events
language sql
security definer
set search_path = ''
as $$
  select e.*
  from public.notification_events e
  where e.processed_at is null and e.cancelled_at is null and e.scheduled_for <= now()
  order by e.scheduled_for
  limit greatest(1, least(p_limit, 500))
  for update skip locked;
$$;

revoke execute on function public.claim_notification_events(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_events(integer) to service_role;

-- enqueue/cancel são chamadas pelos triggers (SECURITY DEFINER); ninguém enfileira pela API.
revoke execute on function public.enqueue_notification_event(text, text, uuid, uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.cancel_pending_notification_events(text, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.enqueue_notification_event(text, text, uuid, uuid, uuid, jsonb, text, timestamptz) to service_role;
grant execute on function public.cancel_pending_notification_events(text, uuid, text[], text) to service_role;
