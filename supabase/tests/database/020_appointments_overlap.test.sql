-- Anti-double-booking (prompt Fase 2 §19/§53/§54/§55). Cobre: sobreposição
-- real é rejeitada; consultas adjacentes são permitidas; CANCELLED e
-- RESCHEDULED liberam o horário.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'b-nutri@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}');
insert into public.profiles (id, role, full_name) values ('b0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'B Nutri');

insert into public.patients (id, nutritionist_id, full_name)
values ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'B Patient');

insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
        '2027-03-01 10:00:00-03', '2027-03-01 11:00:00-03', 'IN_PERSON', 'SCHEDULED');

-- 1) Consulta adjacente (11:00-12:00) é permitida — não é sobreposição.
select lives_ok(
  $$insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
    values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
            '2027-03-01 11:00:00-03', '2027-03-01 12:00:00-03', 'IN_PERSON', 'SCHEDULED')$$,
  'appointments: consultas adjacentes (10-11 e 11-12) não conflitam'
);

-- 2) Sobreposição real com status que bloqueia agenda é rejeitada.
select throws_ok(
  $$insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
    values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
            '2027-03-01 10:30:00-03', '2027-03-01 11:15:00-03', 'IN_PERSON', 'CONFIRMED')$$,
  '23P01',
  null,
  'appointments: sobreposição real (10:30-11:15 vs 10:00-11:00) é rejeitada pela exclusion constraint'
);

-- 3) Sobreposição com uma consulta CANCELLED é permitida (não bloqueia).
select lives_ok(
  $$insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status, cancelled_at)
    values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
            '2027-03-01 10:15:00-03', '2027-03-01 10:45:00-03', 'IN_PERSON', 'CANCELLED', now())$$,
  'appointments: sobreposição com consulta CANCELLED é permitida (cancelada libera o horário)'
);

-- 4) Sobreposição com uma consulta RESCHEDULED é permitida (não bloqueia).
select lives_ok(
  $$insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
    values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
            '2027-03-01 10:15:00-03', '2027-03-01 10:45:00-03', 'IN_PERSON', 'RESCHEDULED')$$,
  'appointments: sobreposição com consulta RESCHEDULED é permitida (reagendada libera o horário)'
);

select * from finish();
rollback;
