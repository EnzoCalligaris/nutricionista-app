-- IDOR/RLS crítico (prompt Fase 2 §51/§52): Paciente A não pode ler dados do
-- Paciente B trocando o ID na query, mesmo estando autenticado. Também
-- confere que um SEGUNDO nutricionista não enxerga pacientes de outro
-- nutricionista (prepara terreno para múltiplos nutricionistas no futuro,
-- sem torná-lo uma permissão global insegura — docs/ARCHITECTURE.md).

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Fixtures (como superuser, ignora RLS) --------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'c-nutri1@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'c-nutri2@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'c-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'c-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('c0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri 1'),
  ('c0000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri 2'),
  ('c0000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('c0000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Paciente B é gerido pelo Nutri 1 e tem profile próprio (login).
insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Patient B (row)');

-- Paciente A também é do Nutri 1, mas é uma pessoa diferente.
insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Patient A (row)');

-- Dados sensíveis do Paciente B, em todas as entidades do teste crítico:
insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
values ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', '2027-04-01 10:00:00-03', '2027-04-01 11:00:00-03', 'IN_PERSON', 'SCHEDULED');

insert into public.meal_plans (id, patient_id, nutritionist_id)
values ('c0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001');
insert into public.meal_plan_versions (id, meal_plan_id, version_number, status, published_at)
values ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000020', 1, 'PUBLISHED', now());

insert into public.assessments (id, patient_id) values ('c0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000010');

insert into public.feedback_messages (patient_id, author_id, content)
values ('c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'Mensagem confidencial para B');

insert into public.patient_materials (id, nutritionist_id, title, storage_path)
values ('c0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000001', 'Material de B', 'c0000000-0000-0000-0000-000000000040/arquivo.pdf');
insert into public.material_assignments (material_id, patient_id)
values ('c0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000010');

-- Fase 11: a análise exige consentimento ativo e path <patient_id>/<analysis_id>/… (trigger).
insert into public.patient_consents (patient_id, consent_type, consent_version)
values ('c0000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1');
insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version)
values ('c0000000-0000-0000-0000-000000000050', 'c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000010/c0000000-0000-0000-0000-000000000050/refeicao.webp', 'meal_photo_ai_v1');

-- Autentica como Paciente A e tenta ler dados do Paciente B -------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.appointments where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê consultas do Paciente B'
);

select is(
  (select count(*)::int from public.meal_plan_versions where meal_plan_id = 'c0000000-0000-0000-0000-000000000020'),
  0,
  'Paciente A não vê cardápio do Paciente B'
);

select is(
  (select count(*)::int from public.assessments where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê avaliação do Paciente B'
);

select is(
  (select count(*)::int from public.feedback_messages where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê feedback do Paciente B'
);

select is(
  (select count(*)::int from public.material_assignments where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê atribuição de material do Paciente B'
);

select is(
  (select count(*)::int from public.food_photo_analyses where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê foto de refeição do Paciente B'
);

select is(
  (select count(*)::int from public.patients where id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Paciente A não vê a própria linha de cadastro do Paciente B'
);

-- Volta a superuser para testar o segundo nutricionista ------------------
reset role;
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.patients where id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Nutricionista 2 não vê paciente gerido pelo Nutricionista 1'
);

select is(
  (select count(*)::int from public.appointments where patient_id = 'c0000000-0000-0000-0000-000000000010'),
  0,
  'Nutricionista 2 não vê consultas de paciente de outro nutricionista'
);

select * from finish();
rollback;
