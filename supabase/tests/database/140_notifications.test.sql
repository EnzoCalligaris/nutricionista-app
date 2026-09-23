-- Fase 12 — outbox de notificações no banco: eventos nascem na MESMA
-- transação da operação (consulta agendada + lembrete de 5 dias civis em
-- America/Sao_Paulo; criada a menos de 5 dias sem lembrete; reagendamento
-- cancela CREATED da nova + lembrete da antiga e gera RESCHEDULED + lembrete
-- novo; cancelamento gera CANCELLED e cancela lembrete; concluída cancela
-- lembrete; edição de horário move o lembrete; dedupe_key idempotente),
-- feedback/material/suplemento sem conteúdo clínico no payload, confirmação
-- de presença pelo paciente (função + trigger de ownership), tokens sem
-- acesso via API, claim atômico de entregas (segundo claim = 0, stale
-- recovery, limite), cancelamento de entregas pendentes, RLS de
-- eventos/entregas/preferências/in-app restrita ao dono.

begin;
create extension if not exists pgtap with schema extensions;

select plan(88);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'fc000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fc-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fc000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'fc-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fc000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'fc-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fc000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'fc-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('fc000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('fc000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('fc000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('fc000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Paciente A é de Nutri A; Paciente B é de Nutri B (ownership cruzado real).
insert into public.patients (id, profile_id, nutritionist_id, full_name, email, phone) values
  ('fc000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000001', 'Patient A (row)', 'fc-patient-a@example.com', '(11) 99999-0001'),
  ('fc000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000004', 'fc000000-0000-0000-0000-000000000002', 'Patient B (row)', null, null);

insert into public.scheduling_settings (nutritionist_id, timezone) values ('fc000000-0000-0000-0000-000000000001', 'America/Sao_Paulo') on conflict (nutritionist_id) do nothing;

-- =====================================================================
-- 1. OUTBOX DE CONSULTAS (mesma transação da operação)
-- =====================================================================
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000100', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '20 days', now() + interval '20 days 1 hour', 'IN_PERSON', 'SCHEDULED');

select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_CREATED'), 1, 'Consulta criada gera APPOINTMENT_CREATED na mesma transação');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 1, 'Consulta a 20 dias gera lembrete de 5 dias');
select is(
  (select scheduled_for from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER'),
  (select public.appointment_reminder_due_at(starts_at, 'America/Sao_Paulo') from public.appointments where id = 'fc000000-0000-0000-0000-000000000100'),
  'Lembrete agendado para 5 dias civis antes em America/Sao_Paulo'
);
select is((select patient_id from public.notification_events where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100'), 'fc000000-0000-0000-0000-000000000010'::uuid, 'Evento carrega o paciente destinatário');
select is((select nutritionist_id from public.notification_events where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100'), 'fc000000-0000-0000-0000-000000000001'::uuid, 'Evento carrega o nutricionista dono');
select is((select payload->>'modality' from public.notification_events where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100'), 'IN_PERSON', 'Payload mínimo (modalidade/instante) — sem dado clínico');

-- 5 dias civis, mesmo relógio de parede (não "- interval 5 days" cego em UTC).
select is(public.appointment_reminder_due_at('2026-10-20 14:00:00-03'::timestamptz, 'America/Sao_Paulo'), '2026-10-15 14:00:00-03'::timestamptz, 'Consulta 20/10 14:00 (SP) → lembrete 15/10 14:00 (SP)');
select is(public.appointment_reminder_due_at('2026-10-20 17:00:00+00'::timestamptz, 'America/Sao_Paulo'), '2026-10-15 17:00:00+00'::timestamptz, 'Mesma consulta expressa em UTC dá o mesmo instante');

-- Dedupe: reenfileirar o mesmo evento não duplica.
select is(public.enqueue_notification_event('APPOINTMENT_CREATED', 'appointment', 'fc000000-0000-0000-0000-000000000100', 'fc000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000001', '{}'::jsonb, 'appointment_created:fc000000-0000-0000-0000-000000000100'), null, 'dedupe_key repetido = nada enfileirado (idempotente)');
select is((select count(*)::int from public.notification_events where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100'), 1, 'Continua 1 evento CREATED');

-- Consulta criada a 2 dias → CREATED sem lembrete retroativo (§43/§109).
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000101', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '2 days', now() + interval '2 days 1 hour', 'ONLINE', 'SCHEDULED');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000101' and event_type = 'APPOINTMENT_CREATED'), 1, 'Consulta a 2 dias gera CREATED');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000101' and event_type = 'APPOINTMENT_REMINDER'), 0, 'Consulta a 2 dias NÃO gera lembrete de 5 dias (sem retroativo)');

-- Edição de horário (sem reagendamento) move o lembrete.
update public.appointments set starts_at = now() + interval '30 days', ends_at = now() + interval '30 days 1 hour' where id = 'fc000000-0000-0000-0000-000000000100';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is not null), 1, 'Edição de horário cancela o lembrete antigo');
select is((select cancel_reason from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is not null), 'TIME_CHANGED', 'Motivo do cancelamento registrado');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 1, 'Edição de horário cria lembrete novo');

-- Reagendamento (mesma sequência de reschedule_appointment): antiga → RESCHEDULED, nova inserida, vínculo.
update public.appointments set status = 'RESCHEDULED' where id = 'fc000000-0000-0000-0000-000000000100';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000100' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 0, 'Reagendar cancela o lembrete da consulta antiga (§44/§110)');
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000102', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '40 days', now() + interval '40 days 1 hour', 'IN_PERSON', 'SCHEDULED');
update public.appointments set rescheduled_to_id = 'fc000000-0000-0000-0000-000000000102' where id = 'fc000000-0000-0000-0000-000000000100';
select is((select cancelled_at is not null from public.notification_events where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000102'), true, 'CREATED da consulta nova é cancelado (é reagendamento, não agendamento novo)');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000102' and event_type = 'APPOINTMENT_RESCHEDULED'), 1, 'Gera APPOINTMENT_RESCHEDULED para a consulta nova');
select is((select payload->>'previous_appointment_id' from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000102' and event_type = 'APPOINTMENT_RESCHEDULED'), 'fc000000-0000-0000-0000-000000000100', 'Payload do reagendamento aponta a consulta anterior');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000102' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 1, 'Consulta nova (40 dias) tem lembrete novo elegível');

-- Cancelamento: CANCELLED + lembrete cancelado (§39/§45/§111).
update public.appointments set status = 'CANCELLED', cancelled_at = now() where id = 'fc000000-0000-0000-0000-000000000102';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000102' and event_type = 'APPOINTMENT_CANCELLED'), 1, 'Cancelar gera APPOINTMENT_CANCELLED');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000102' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 0, 'Cancelar cancela o lembrete pendente');

-- Concluída: lembrete cancelado, sem evento externo (§46).
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000103', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '10 days', now() + interval '10 days 1 hour', 'IN_PERSON', 'SCHEDULED');
update public.appointments set status = 'COMPLETED' where id = 'fc000000-0000-0000-0000-000000000103';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000103' and event_type = 'APPOINTMENT_REMINDER' and cancelled_at is null), 0, 'Concluída cancela lembrete');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000103' and event_type not in ('APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER')), 0, 'Concluir não gera evento de aviso');

-- Confirmação administrativa pelo nutricionista → APPOINTMENT_CONFIRMED.
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000104', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '3 days', now() + interval '3 days 1 hour', 'IN_PERSON', 'SCHEDULED');
update public.appointments set status = 'CONFIRMED' where id = 'fc000000-0000-0000-0000-000000000104';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000104' and event_type = 'APPOINTMENT_CONFIRMED'), 1, 'Confirmação pelo nutricionista gera APPOINTMENT_CONFIRMED');

-- =====================================================================
-- 2. OUTBOX DA FASE 10 (feedback / material / suplemento)
-- =====================================================================
insert into public.feedback_messages (id, patient_id, author_id, content) values ('fc000000-0000-0000-0000-000000000200', 'fc000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000001', 'Rascunho privado');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000200'), 0, 'Rascunho de feedback não notifica');
update public.feedback_messages set published_at = now() where id = 'fc000000-0000-0000-0000-000000000200';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000200' and event_type = 'FEEDBACK_PUBLISHED'), 1, 'Disponibilizar feedback gera FEEDBACK_PUBLISHED');
select is((select nutritionist_id from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000200'), 'fc000000-0000-0000-0000-000000000001'::uuid, 'Evento de feedback resolve o nutricionista do paciente');
select is((select payload ? 'content' from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000200'), false, 'Payload do feedback não carrega o texto (§18/§71)');
update public.feedback_messages set read_at = now() where id = 'fc000000-0000-0000-0000-000000000200';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000200'), 1, 'Outras alterações no feedback já disponibilizado não notificam de novo');

insert into public.patient_materials (id, nutritionist_id, kind, title, external_url) values ('fc000000-0000-0000-0000-000000000300', 'fc000000-0000-0000-0000-000000000001', 'LINK', 'Guia de rotulagem', 'https://example.com/g');
insert into public.material_assignments (id, material_id, patient_id) values ('fc000000-0000-0000-0000-000000000400', 'fc000000-0000-0000-0000-000000000300', 'fc000000-0000-0000-0000-000000000010');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000400' and event_type = 'MATERIAL_ASSIGNED'), 1, 'Atribuir material gera MATERIAL_ASSIGNED');
select is((select payload->>'material_title' from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000400'), 'Guia de rotulagem', 'Payload leva só o título do material');
update public.material_assignments set revoked_at = now() where id = 'fc000000-0000-0000-0000-000000000400';
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000400'), 1, 'Revogar material não notifica');

insert into public.supplement_recommendations (id, patient_id, name, dose_text, instructions) values ('fc000000-0000-0000-0000-000000000500', 'fc000000-0000-0000-0000-000000000010', 'Whey', '1 dose', 'Após o treino');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000500' and event_type = 'SUPPLEMENT_RECOMMENDATION_CREATED'), 1, 'Recomendação ativa gera SUPPLEMENT_RECOMMENDATION_CREATED');
select is((select payload - 'supplement_id' from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000500'), '{}'::jsonb, 'Payload do suplemento só tem o id — sem nome/dose/orientação (§73)');
insert into public.supplement_recommendations (id, patient_id, name, active) values ('fc000000-0000-0000-0000-000000000501', 'fc000000-0000-0000-0000-000000000010', 'Encerrado', false);
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000501'), 0, 'Recomendação já encerrada não notifica');

-- =====================================================================
-- 3. CONFIRMAÇÃO DE PRESENÇA PELO PACIENTE
-- =====================================================================
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000105', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '6 days', now() + interval '6 days 1 hour', 'IN_PERSON', 'SCHEDULED');
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('fc000000-0000-0000-0000-000000000106', 'fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'IN_PERSON', 'SCHEDULED');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ update public.appointments set status = 'CONFIRMED' where id = 'fc000000-0000-0000-0000-000000000105' $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION', 'Paciente não confirma "administrativamente" (sem patient_confirmed_at)'
);
select throws_ok(
  $$ update public.appointments set patient_confirmed_at = now() where id = 'fc000000-0000-0000-0000-000000000105' $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION', 'patient_confirmed_at sem virar CONFIRMED é recusado'
);
select throws_ok(
  $$ insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status, patient_confirmed_at) values ('fc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000010', now() + interval '50 days', now() + interval '50 days 1 hour', 'ONLINE', 'SCHEDULED', now()) $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION', 'Paciente não nasce consulta já confirmada'
);
select is(public.confirm_appointment_presence('fc000000-0000-0000-0000-000000000105'), 'CONFIRMED', 'Paciente confirma presença pela função (SCHEDULED → CONFIRMED)');
select is((select status::text from public.appointments where id = 'fc000000-0000-0000-0000-000000000105'), 'CONFIRMED', 'Consulta virou CONFIRMED');
select isnt((select patient_confirmed_at from public.appointments where id = 'fc000000-0000-0000-0000-000000000105'), null, 'patient_confirmed_at gravado');
select is(public.confirm_appointment_presence('fc000000-0000-0000-0000-000000000105'), 'ALREADY_CONFIRMED', 'Confirmar de novo = sem efeito (replay/duplo clique, §94)');
select is((select count(*)::int from public.notification_events where related_entity_id = 'fc000000-0000-0000-0000-000000000105' and event_type = 'APPOINTMENT_CONFIRMED'), 0, 'Confirmação do próprio paciente não gera aviso para ele mesmo');
select throws_ok(
  $$ select public.confirm_appointment_presence('fc000000-0000-0000-0000-000000000106') $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION', 'Consulta passada não é confirmada'
);
select throws_ok(
  $$ select public.confirm_appointment_presence('fc000000-0000-0000-0000-000000000102') $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION', 'Consulta cancelada não é confirmada'
);

-- Paciente B: consulta de A é invisível → NOT_FOUND (nunca vaza existência nem confirma).
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.confirm_appointment_presence('fc000000-0000-0000-0000-000000000101') $$,
  'APPOINTMENT_NOT_FOUND', 'Paciente B não confirma consulta de A'
);

-- Nutricionista continua confirmando pelo fluxo administrativo normal (sem patient_confirmed_at).
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.appointments set status = 'CONFIRMED' where id = 'fc000000-0000-0000-0000-000000000101';
select is((select status::text from public.appointments where id = 'fc000000-0000-0000-0000-000000000101'), 'CONFIRMED', 'Nutri confirma administrativamente');
select is((select patient_confirmed_at from public.appointments where id = 'fc000000-0000-0000-0000-000000000101'), null, 'Confirmação administrativa não finge confirmação do paciente');

-- =====================================================================
-- 4. TOKENS: nenhum papel autenticado lê/escreve
-- =====================================================================
reset role;
insert into public.notification_action_tokens (id, token_hash, purpose, appointment_id, patient_id, expires_at)
values ('fc000000-0000-0000-0000-000000000600', 'hash-a', 'APPOINTMENT_CONFIRM', 'fc000000-0000-0000-0000-000000000105', 'fc000000-0000-0000-0000-000000000010', now() + interval '7 days');
select throws_ok(
  $$ insert into public.notification_action_tokens (token_hash, purpose, appointment_id, patient_id, expires_at) values ('h', 'PASSWORD_RESET', 'fc000000-0000-0000-0000-000000000105', 'fc000000-0000-0000-0000-000000000010', now()) $$,
  '23514', null, 'Propósito do token é restrito'
);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notification_action_tokens), 0, 'Nutricionista não lê tokens');
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notification_action_tokens), 0, 'Paciente não lê tokens (nem os próprios)');
select throws_ok(
  $$ insert into public.notification_action_tokens (token_hash, purpose, appointment_id, patient_id, expires_at) values ('h2', 'APPOINTMENT_CONFIRM', 'fc000000-0000-0000-0000-000000000105', 'fc000000-0000-0000-0000-000000000010', now() + interval '1 day') $$,
  '42501', null, 'Paciente não forja token'
);
reset role;

-- =====================================================================
-- 5. ENTREGAS: idempotência, claim atômico, stale recovery, cancelamento
-- =====================================================================
insert into public.notification_deliveries (id, event_id, channel, recipient, patient_id, nutritionist_id, event_type, idempotency_key, status, next_attempt_at)
select 'fc000000-0000-0000-0000-000000000700', e.id, 'EMAIL', 'fc-patient-a@example.com', e.patient_id, e.nutritionist_id, e.event_type, e.id::text || ':EMAIL:' || e.patient_id::text, 'PENDING', null
from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ insert into public.notification_deliveries (event_id, channel, recipient, idempotency_key)
     select e.id, 'EMAIL', 'fc-patient-a@example.com', e.id::text || ':EMAIL:' || e.patient_id::text from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100' $$,
  '23505', null, 'Mesma entrega (evento+canal+destinatário) nunca é criada duas vezes'
);
-- Entrega futura (backoff) e entrega PROCESSING recente (worker vivo) não são elegíveis.
insert into public.notification_deliveries (id, event_id, channel, recipient, patient_id, nutritionist_id, idempotency_key, status, next_attempt_at)
select 'fc000000-0000-0000-0000-000000000701', e.id, 'WHATSAPP', '+5511999990001', e.patient_id, e.nutritionist_id, e.id::text || ':WHATSAPP:x', 'PENDING', now() + interval '1 hour'
from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
insert into public.notification_deliveries (id, event_id, channel, recipient, patient_id, nutritionist_id, idempotency_key, status, processing_started_at, attempt_count)
select 'fc000000-0000-0000-0000-000000000702', e.id, 'EMAIL', 'x@example.com', e.patient_id, e.nutritionist_id, e.id::text || ':EMAIL:fresh', 'PROCESSING', now() - interval '1 minute', 1
from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
-- PROCESSING antigo (worker morto) volta a ser elegível.
insert into public.notification_deliveries (id, event_id, channel, recipient, patient_id, nutritionist_id, idempotency_key, status, processing_started_at, attempt_count)
select 'fc000000-0000-0000-0000-000000000703', e.id, 'EMAIL', 'y@example.com', e.patient_id, e.nutritionist_id, e.id::text || ':EMAIL:stale', 'PROCESSING', now() - interval '30 minutes', 1
from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';

select is(
  (select array_agg(id order by id) from public.claim_notification_deliveries(50, 10)),
  array['fc000000-0000-0000-0000-000000000700'::uuid, 'fc000000-0000-0000-0000-000000000703'::uuid],
  'Claim pega a PENDING devida e a PROCESSING travada; ignora backoff futuro e PROCESSING recente'
);
select is((select status::text from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000700'), 'PROCESSING', 'Entrega reclamada vira PROCESSING');
select is((select attempt_count from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000700'), 1, 'attempt_count incrementado no claim');
select is((select attempt_count from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000703'), 2, 'Stale recovery conta nova tentativa');
select isnt((select processing_started_at from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000703'), now() - interval '30 minutes', 'processing_started_at renovado no stale recovery');
select is((select count(*)::int from public.claim_notification_deliveries(50, 10)), 0, 'Segundo claim imediato = 0 (nada é entregue duas vezes)');

-- Limite do lote.
insert into public.notification_deliveries (event_id, channel, recipient, idempotency_key, status)
select e.id, 'EMAIL', 'lote' || g || '@example.com', e.id::text || ':EMAIL:lote' || g, 'PENDING'
from public.notification_events e, generate_series(1, 3) g where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
select is((select count(*)::int from public.claim_notification_deliveries(2, 10)), 2, 'Claim respeita o limite do lote');
select is((select count(*)::int from public.claim_notification_deliveries(50, 10)), 1, 'Próximo claim pega o restante');

-- Cancelar evento cancela entregas ainda não enviadas, nunca as enviadas.
update public.notification_deliveries set status = 'SENT', sent_at = now() where id = 'fc000000-0000-0000-0000-000000000700';
update public.notification_deliveries set status = 'PENDING', next_attempt_at = now() + interval '5 minutes' where id = 'fc000000-0000-0000-0000-000000000703';
update public.notification_events set processed_at = now() where dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
select is(public.cancel_pending_notification_events('appointment', 'fc000000-0000-0000-0000-000000000100', array['APPOINTMENT_CREATED'], 'TEST'), 0, 'Evento já processado não é re-cancelado (retorna 0)');
select is((select status::text from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000703'), 'CANCELLED', 'Entrega PENDING do evento vira CANCELLED');
select is((select status::text from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000700'), 'SENT', 'Entrega SENT nunca é revertida');

-- Eventos devidos: lembrete futuro não aparece; evento imediato aparece.
select is((select count(*)::int from public.claim_notification_events(100) where event_type = 'APPOINTMENT_REMINDER'), 0, 'Lembrete futuro não é devido ainda');
select ok((select count(*) from public.claim_notification_events(100) where event_type = 'APPOINTMENT_CANCELLED') >= 1, 'Eventos imediatos são devidos');

-- =====================================================================
-- 6. RLS: eventos/entregas só do dono; preferências; in-app
-- =====================================================================
insert into public.notifications (id, recipient_id, type, title, body, link, event_id)
select 'fc000000-0000-0000-0000-000000000800', 'fc000000-0000-0000-0000-000000000003', 'APPOINTMENT_CREATED', 'Consulta agendada', 'Sua consulta foi agendada.', '/paciente/consultas', e.id
from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ insert into public.notifications (recipient_id, type, title, event_id) select 'fc000000-0000-0000-0000-000000000003', 'APPOINTMENT_CREATED', 'dup', e.id from public.notification_events e where e.dedupe_key = 'appointment_created:fc000000-0000-0000-0000-000000000100' $$,
  '23505', null, 'Item in-app único por evento e destinatário (idempotência IN_APP)'
);
select throws_ok(
  $$ insert into public.notifications (recipient_id, type, title, link) values ('fc000000-0000-0000-0000-000000000003', 'X', 'x', 'https://evil.example/phish') $$,
  '23514', null, 'Link in-app é sempre caminho relativo'
);

set local role authenticated;
-- Nutri A vê os próprios eventos/entregas; Nutri B nada; paciente nada.
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select ok((select count(*) from public.notification_events) >= 10, 'Nutri A vê seus eventos');
select ok((select count(*) from public.notification_deliveries where nutritionist_id = 'fc000000-0000-0000-0000-000000000001') >= 1, 'Nutri A vê suas entregas');
update public.notification_deliveries set status = 'SENT', sent_at = now() where id = 'fc000000-0000-0000-0000-000000000703';
select is((select status::text from public.notification_deliveries where id = 'fc000000-0000-0000-0000-000000000703'), 'CANCELLED', 'Nutricionista não altera entregas pela API (só o worker/service role)');
select throws_ok(
  $$ select * from public.claim_notification_deliveries(1, 10) $$,
  '42501', null, 'Claim é exclusivo do service role'
);
select throws_ok(
  $$ select public.enqueue_notification_event('APPOINTMENT_CREATED', 'appointment', 'fc000000-0000-0000-0000-000000000100', 'fc000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000001', '{}'::jsonb, 'forjado') $$,
  '42501', null, 'Ninguém enfileira evento pela API'
);
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notification_events), 0, 'Nutri B não vê eventos de A');
select is((select count(*)::int from public.notification_deliveries), 0, 'Nutri B não vê entregas de A');
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notification_events), 0, 'Paciente não vê eventos');
select is((select count(*)::int from public.notification_deliveries), 0, 'Paciente não vê entregas (provider ids, erros, tentativas)');

-- In-app: paciente A lê e marca como lida; paciente B não vê.
select is((select count(*)::int from public.notifications where read_at is null), 1, 'Paciente A tem 1 não lida');
update public.notifications set read_at = now() where id = 'fc000000-0000-0000-0000-000000000800';
select is((select count(*)::int from public.notifications where read_at is null), 0, 'Paciente A marcou como lida');
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notifications), 0, 'Paciente B não vê notificações de A');

-- Preferências do paciente: só o próprio escreve; o nutricionista dono lê.
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
insert into public.patient_notification_preferences (patient_id, email_enabled, whatsapp_enabled) values ('fc000000-0000-0000-0000-000000000010', true, false);
select throws_ok(
  $$ insert into public.patient_notification_preferences (patient_id, email_enabled, whatsapp_enabled) values ('fc000000-0000-0000-0000-000000000011', false, false) $$,
  '42501', null, 'Paciente A não altera preferência de B'
);
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select whatsapp_enabled from public.patient_notification_preferences where patient_id = 'fc000000-0000-0000-0000-000000000010'), false, 'Nutri A lê a preferência do seu paciente');
update public.patient_notification_preferences set whatsapp_enabled = true where patient_id = 'fc000000-0000-0000-0000-000000000010';
select is((select whatsapp_enabled from public.patient_notification_preferences where patient_id = 'fc000000-0000-0000-0000-000000000010'), false, 'Nutricionista não altera preferência do paciente (update sem efeito)');
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_notification_preferences), 0, 'Nutri B não lê preferência de paciente de A');

-- Preferências do nutricionista: cada um só as suas.
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
insert into public.notification_preferences (nutritionist_id, event_type, channel, enabled) values ('fc000000-0000-0000-0000-000000000001', 'APPOINTMENT_REMINDER', 'WHATSAPP', false);
select throws_ok(
  $$ insert into public.notification_preferences (nutritionist_id, event_type, channel, enabled) values ('fc000000-0000-0000-0000-000000000002', 'APPOINTMENT_REMINDER', 'EMAIL', false) $$,
  '42501', null, 'Nutri A não grava preferência de B'
);
select throws_ok(
  $$ insert into public.notification_preferences (nutritionist_id, event_type, channel, enabled) values ('fc000000-0000-0000-0000-000000000001', 'bad type', 'EMAIL', false) $$,
  '23514', null, 'event_type fora do padrão é recusado'
);
select set_config('request.jwt.claims', json_build_object('sub', 'fc000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.notification_preferences), 0, 'Nutri B não vê preferências de A');

select * from finish();
rollback;
