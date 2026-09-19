-- Fase 6 — agenda no banco: integridade de appointments (ownership,
-- restrições do paciente), bloqueio x consulta ativa, busy_intervals sem
-- vazamento, book_appointment / reschedule_appointment (janela de
-- disponibilidade, ids adulterados, histórico), adjacência, cancelamento
-- liberando o horário e policy de auditoria do paciente.

begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'f6000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f6-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f6000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f6-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f6000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f6-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f6000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f6-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('f6000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('f6000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('f6000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('f6000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Pacientes A e B são do Nutri A; paciente C é do Nutri B.
insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('f6000000-0000-0000-0000-000000000010', 'f6000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('f6000000-0000-0000-0000-000000000011', 'f6000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000001', 'Patient B (row)'),
  ('f6000000-0000-0000-0000-000000000012', null, 'f6000000-0000-0000-0000-000000000002', 'Patient C of Nutri B');

-- Disponibilidade do Nutri A: segunda 08:00–18:00 (fuso America/Sao_Paulo).
insert into public.availability_rules (nutritionist_id, weekday, start_time, end_time, active)
values ('f6000000-0000-0000-0000-000000000001', 1, '08:00', '18:00', true);

-- Datas: 2027-03-01 é segunda-feira. Instantes no fuso -03.
-- 1. Trigger: nutritionist_id precisa ser o responsável pelo paciente ----------
select throws_ok(
  $$ insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ('f6000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000010', '2027-03-01 10:00-03', '2027-03-01 11:00-03', 'IN_PERSON', 'SCHEDULED') $$,
  'APPOINTMENT_NOT_AUTHORIZED',
  'nutritionist_id diferente do responsável pelo paciente é rejeitado (mesmo como superuser)'
);

-- 2. Adjacência continua permitida; sobreposição continua rejeitada -------------
insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('f6000000-0000-0000-0000-000000000100', 'f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000010', '2027-03-01 10:00-03', '2027-03-01 11:00-03', 'IN_PERSON', 'SCHEDULED');

select lives_ok(
  $$ insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ('f6000000-0000-0000-0000-000000000101', 'f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000011', '2027-03-01 11:00-03', '2027-03-01 12:00-03', 'IN_PERSON', 'SCHEDULED') $$,
  '10–11 e 11–12 persistem (adjacência)'
);

select throws_ok(
  $$ insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ('f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000011', '2027-03-01 10:30-03', '2027-03-01 11:30-03', 'IN_PERSON', 'SCHEDULED') $$,
  '23P01',
  null,
  '10:30–11:30 conflita com 10–11 (exclusion constraint intacta)'
);

-- 3. Bloqueio não cobre consulta ativa ---------------------------------------
select throws_ok(
  $$ insert into public.blocked_times (nutritionist_id, starts_at, ends_at, reason)
     values ('f6000000-0000-0000-0000-000000000001', '2027-03-01 09:30-03', '2027-03-01 10:30-03', 'teste') $$,
  'BLOCKED_TIME_CONFLICT',
  'Bloqueio sobre consulta SCHEDULED é recusado'
);

select lives_ok(
  $$ insert into public.blocked_times (id, nutritionist_id, starts_at, ends_at, reason)
     values ('f6000000-0000-0000-0000-000000000200', 'f6000000-0000-0000-0000-000000000001', '2027-03-01 12:00-03', '2027-03-01 14:00-03', 'almoço') $$,
  'Bloqueio 12–14 sem consulta é aceito'
);

-- 4. Cancelamento libera o horário -------------------------------------------
update public.appointments set status = 'CANCELLED', cancelled_at = now() where id = 'f6000000-0000-0000-0000-000000000101';
select lives_ok(
  $$ insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ('f6000000-0000-0000-0000-000000000102', 'f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000011', '2027-03-01 11:00-03', '2027-03-01 12:00-03', 'IN_PERSON', 'SCHEDULED') $$,
  'Após cancelar 11–12, novo 11–12 funciona'
);

-- 5. busy_intervals como PACIENTE A: vê intervalos, nunca ids/pacientes ----------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f6000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.busy_intervals('f6000000-0000-0000-0000-000000000001', '2027-03-01 00:00-03', '2027-03-02 00:00-03')),
  3,
  'busy_intervals devolve 2 consultas ativas + 1 bloqueio (cancelada não entra)'
);

select is(
  (select count(*)::int from public.appointments where patient_id = 'f6000000-0000-0000-0000-000000000011'),
  0,
  'Paciente A não lê consultas do Paciente B (RLS)'
);

select is(
  (select count(*)::int from public.availability_rules where nutritionist_id = 'f6000000-0000-0000-0000-000000000001'),
  1,
  'Paciente lê a disponibilidade ativa do nutricionista'
);

-- 6. book_appointment como paciente --------------------------------------------
select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000011', '2027-03-01 14:00-03', '2027-03-01 15:00-03', 'IN_PERSON') $$,
  'PATIENT_NOT_FOUND',
  'Paciente A não agenda para o Paciente B (patient_id adulterado — sob RLS o paciente alheio não existe)'
);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-02 10:00-03', '2027-03-02 11:00-03', 'IN_PERSON') $$,
  'INVALID_AVAILABILITY',
  'Fora da disponibilidade (terça sem regra) é negado no servidor'
);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-01 17:30-03', '2027-03-01 18:30-03', 'IN_PERSON') $$,
  'INVALID_AVAILABILITY',
  'Consulta que ultrapassa o fim da regra (17:30–18:30) é negada'
);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-01 12:30-03', '2027-03-01 13:30-03', 'IN_PERSON') $$,
  'BLOCKED_TIME_CONFLICT',
  'Dentro de bloqueio é negado'
);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2020-03-02 10:00-03', '2020-03-02 11:00-03', 'IN_PERSON') $$,
  'APPOINTMENT_IN_PAST',
  'Passado é negado'
);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-01 10:30-03', '2027-03-01 11:30-03', 'IN_PERSON') $$,
  '23P01',
  null,
  'Sobreposição com consulta existente é decidida pela exclusion constraint (23P01)'
);

select lives_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-01 15:00-03', '2027-03-01 16:00-03', 'ONLINE') $$,
  'Paciente A agenda para si em horário válido'
);

select is(
  (select array[status::text, created_by::text, (amount_cents is null)::text] from public.appointments
    where patient_id = 'f6000000-0000-0000-0000-000000000010' and starts_at = '2027-03-01 15:00-03'),
  array['SCHEDULED', 'f6000000-0000-0000-0000-000000000003', 'true'],
  'Consulta do paciente nasce SCHEDULED, com created_by = paciente e sem valor'
);

-- 7. Restrições do paciente via UPDATE direto -------------------------------------
select throws_ok(
  $$ update public.appointments set status = 'COMPLETED' where patient_id = 'f6000000-0000-0000-0000-000000000010' and starts_at = '2027-03-01 15:00-03' $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION',
  'Paciente não marca a própria consulta como COMPLETED'
);

select throws_ok(
  $$ update public.appointments set status = 'CONFIRMED' where patient_id = 'f6000000-0000-0000-0000-000000000010' and starts_at = '2027-03-01 15:00-03' $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION',
  'Paciente não se auto-confirma'
);

select throws_ok(
  $$ update public.appointments set amount_cents = 1 where patient_id = 'f6000000-0000-0000-0000-000000000010' and starts_at = '2027-03-01 15:00-03' $$,
  'APPOINTMENT_NOT_AUTHORIZED',
  'Paciente não altera valor'
);

select throws_ok(
  $$ insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ('f6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000010', '2027-03-01 16:00-03', '2027-03-01 17:00-03', 'IN_PERSON', 'COMPLETED') $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION',
  'Paciente não insere consulta já COMPLETED'
);

-- 8. Reagendamento pelo paciente: histórico preservado --------------------------
select lives_ok(
  $$ select public.reschedule_appointment('f6000000-0000-0000-0000-000000000100', '2027-03-01 16:00-03', '2027-03-01 17:00-03') $$,
  'Paciente A reagenda a própria consulta 10–11 para 16–17'
);

select is(
  (select array[status::text, (rescheduled_to_id is not null)::text] from public.appointments where id = 'f6000000-0000-0000-0000-000000000100'),
  array['RESCHEDULED', 'true'],
  'Original vira RESCHEDULED e aponta para a nova'
);

select is(
  (select array[a.status::text, a.starts_at::text, a.modality::text] from public.appointments a
    where a.id = (select rescheduled_to_id from public.appointments where id = 'f6000000-0000-0000-0000-000000000100')),
  array['SCHEDULED', '2027-03-01 19:00:00+00', 'IN_PERSON'],
  'Nova consulta SCHEDULED em 16:00-03 com a mesma modalidade'
);

select throws_ok(
  $$ select public.reschedule_appointment('f6000000-0000-0000-0000-000000000100', '2027-03-01 09:00-03', '2027-03-01 10:00-03') $$,
  'INVALID_APPOINTMENT_STATUS_TRANSITION',
  'RESCHEDULED antiga não pode ser reagendada de novo'
);

select throws_ok(
  $$ select public.reschedule_appointment('f6000000-0000-0000-0000-000000000102', '2027-03-01 09:00-03', '2027-03-01 10:00-03') $$,
  'APPOINTMENT_NOT_FOUND',
  'Paciente A não reagenda consulta do Paciente B (appointment_id adulterado — indistinguível de inexistente)'
);

-- Sob RLS o UPDATE do Paciente A não enxerga a linha do Paciente B: 0 linhas
-- afetadas, sem erro — a contagem abaixo prova que nada mudou.
update public.appointments set status = 'CANCELLED', cancelled_at = now() where id = 'f6000000-0000-0000-0000-000000000102';
select is(
  (select count(*)::int from public.appointments where id = 'f6000000-0000-0000-0000-000000000102'),
  0,
  'Consulta do Paciente B é invisível (e intocável) para o Paciente A'
);

-- 9. Auditoria pelo paciente -------------------------------------------------------
select lives_ok(
  $$ insert into public.audit_logs (actor_id, action, entity_type, entity_id)
     values ('f6000000-0000-0000-0000-000000000003', 'APPOINTMENT_CREATED', 'appointment', 'f6000000-0000-0000-0000-000000000100') $$,
  'Paciente registra auditoria de appointment com o próprio actor_id'
);

select throws_ok(
  $$ insert into public.audit_logs (actor_id, action, entity_type, entity_id)
     values ('f6000000-0000-0000-0000-000000000001', 'APPOINTMENT_CREATED', 'appointment', 'f6000000-0000-0000-0000-000000000100') $$,
  '42501',
  null,
  'Paciente não registra auditoria em nome de outro ator'
);

select throws_ok(
  $$ insert into public.audit_logs (actor_id, action, entity_type, entity_id)
     values ('f6000000-0000-0000-0000-000000000003', 'PATIENT_UPDATED', 'patient', 'f6000000-0000-0000-0000-000000000010') $$,
  '42501',
  null,
  'Paciente não registra auditoria de outra entidade'
);

-- 10. Nutri B tenta mexer na agenda do Nutri A ---------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f6000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-01 08:00-03', '2027-03-01 09:00-03', 'IN_PERSON') $$,
  'PATIENT_NOT_FOUND',
  'Nutri B não agenda para paciente de Nutri A'
);

select throws_ok(
  $$ select public.reschedule_appointment('f6000000-0000-0000-0000-000000000102', '2027-03-01 08:00-03', '2027-03-01 09:00-03') $$,
  'APPOINTMENT_NOT_FOUND',
  'Nutri B não reagenda consulta de Nutri A (indistinguível de inexistente)'
);

select is(
  (select count(*)::int from public.blocked_times where nutritionist_id = 'f6000000-0000-0000-0000-000000000001'),
  1,
  'Bloqueios são legíveis por qualquer autenticado (necessário para calcular horários)'
);

delete from public.blocked_times where id = 'f6000000-0000-0000-0000-000000000200';
select is(
  (select count(*)::int from public.blocked_times where id = 'f6000000-0000-0000-0000-000000000200'),
  1,
  'Nutri B não apaga bloqueio de Nutri A (RLS: 0 linhas afetadas)'
);

-- 11. Nutri A: override administrativo e status inicial ---------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f6000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-02 10:00-03', '2027-03-02 11:00-03', 'IN_PERSON') $$,
  'INVALID_AVAILABILITY',
  'Sem override, nutricionista também respeita a disponibilidade'
);

select lives_ok(
  $$ select public.book_appointment('f6000000-0000-0000-0000-000000000010', '2027-03-02 10:00-03', '2027-03-02 11:00-03', 'IN_PERSON', null, 23000, 'CONFIRMED', true) $$,
  'Com override explícito, nutricionista cria fora da disponibilidade (CONFIRMED, com valor)'
);

select * from finish();
rollback;
