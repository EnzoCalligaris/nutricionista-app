-- Fase 9 — avaliações no banco: data futura recusada, ranges técnicos
-- (valor ≤ 0, percentual > 100), set_assessment_measurements (upsert +
-- remoção), visibilidade (paciente só vê visível e não arquivada; nota
-- interna nunca), publicação/arquivamento (delete só se nunca exibida),
-- ownership nutri A x B, paciente A x B, mass assignment (patient_id,
-- report_path fora do padrão) e RLS do bucket privado (paciente só lê
-- objeto de avaliação visível; nutri B nada).

begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'f9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f9-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f9000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f9-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f9000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f9-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f9000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f9-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('f9000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('f9000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('f9000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('f9000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('f9000000-0000-0000-0000-000000000010', 'f9000000-0000-0000-0000-000000000003', 'f9000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('f9000000-0000-0000-0000-000000000011', 'f9000000-0000-0000-0000-000000000004', 'f9000000-0000-0000-0000-000000000001', 'Patient B (row)');

-- 1. Catálogo e bucket -------------------------------------------------------------
select is((select public from storage.buckets where id = 'bioimpedance-reports'), false, 'Bucket bioimpedance-reports continua privado');
select is((select active from public.measurement_types where code = 'BMI'), false, 'IMC não é métrica registrável (derivado)');
select ok((select count(*) from public.measurement_types where code in ('HEIGHT', 'FAT_MASS', 'BASAL_METABOLIC_RATE', 'ABDOMEN_CIRCUMFERENCE')) = 4, 'Catálogo ganhou altura, massa de gordura, metabolismo basal e abdômen');

-- 2. Como Nutri A: cria, valida, mede ------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ insert into public.assessments (patient_id, assessment_date) values ('f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date + 1) $$,
  'INVALID_ASSESSMENT_DATE', 'Avaliação amanhã é recusada (§77)'
);

insert into public.assessments (id, patient_id, assessment_date, notes, internal_notes)
values ('f9000000-0000-0000-0000-000000000100', 'f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date - 30, 'Visível ao paciente', 'Segredo do nutricionista');
select is((select created_by from public.assessments where id = 'f9000000-0000-0000-0000-000000000100'), 'f9000000-0000-0000-0000-000000000001'::uuid, 'created_by preenchido pelo trigger');
select is((select visible_to_patient from public.assessments where id = 'f9000000-0000-0000-0000-000000000100'), false, 'Nasce invisível ao paciente');

select lives_ok(
  $$ insert into public.assessments (patient_id, assessment_date) values ('f9000000-0000-0000-0000-000000000011', (now() at time zone 'America/Sao_Paulo')::date) $$,
  'Nutri A cadastra para paciente B (também seu)'
);

-- Medidas: função transacional + ranges técnicos.
select lives_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":80},{"code":"BODY_FAT_PCT","value":20},{"code":"WAIST_CIRCUMFERENCE","value":92.5}]'::jsonb) $$,
  'Grava 3 medidas'
);
select is((select count(*)::int from public.assessment_measurements where assessment_id = 'f9000000-0000-0000-0000-000000000100'), 3, '3 medidas gravadas');
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":0}]'::jsonb) $$,
  'INVALID_MEASUREMENT', 'Peso 0 recusado (§79)'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":-1}]'::jsonb) $$,
  'INVALID_MEASUREMENT', 'Peso negativo recusado'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"BODY_FAT_PCT","value":101}]'::jsonb) $$,
  'INVALID_MEASUREMENT', 'Gordura 101% recusada (§78)'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"BMI","value":25}]'::jsonb) $$,
  'INVALID_MEASUREMENT', 'Métrica inativa (IMC) recusada'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"NOPE","value":1}]'::jsonb) $$,
  'INVALID_MEASUREMENT', 'Código desconhecido recusado'
);
-- Edição = estado completo: atualiza peso, remove cintura, mantém gordura.
select lives_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":78.5},{"code":"BODY_FAT_PCT","value":20}]'::jsonb) $$,
  'Reenvio com 2 medidas'
);
select is(
  (select array_agg(mt.code order by mt.code) from public.assessment_measurements am join public.measurement_types mt on mt.id = am.measurement_type_id where am.assessment_id = 'f9000000-0000-0000-0000-000000000100'),
  array['BODY_FAT_PCT', 'WEIGHT'], 'Cintura removida, peso e gordura mantidos'
);
select is(
  (select value::text from public.assessment_measurements am join public.measurement_types mt on mt.id = am.measurement_type_id where am.assessment_id = 'f9000000-0000-0000-0000-000000000100' and mt.code = 'WEIGHT'),
  '78.500', 'Peso atualizado com precisão de 3 casas (§51)'
);

-- 3. Mass assignment / ownership imutável ---------------------------------------------
select throws_ok(
  $$ update public.assessments set patient_id = 'f9000000-0000-0000-0000-000000000011' where id = 'f9000000-0000-0000-0000-000000000100' $$,
  'ASSESSMENT_NOT_AUTHORIZED', 'patient_id não muda (§76)'
);
select throws_ok(
  $$ update public.assessments set report_path = 'outro-paciente/x.pdf', report_name = 'x.pdf', report_mime = 'application/pdf', report_size_bytes = 10, report_uploaded_at = now() where id = 'f9000000-0000-0000-0000-000000000100' $$,
  'REPORT_PATH_INVALID', 'report_path fora de <patient_id>/<assessment_id>/ é recusado'
);
select throws_ok(
  $$ update public.assessments set report_path = 'f9000000-0000-0000-0000-000000000010/f9000000-0000-0000-0000-000000000100/a.pdf' where id = 'f9000000-0000-0000-0000-000000000100' $$,
  '23514', null, 'Metadados do relatório precisam vir completos (check)'
);

-- 4. Visibilidade: paciente A ----------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.assessments where patient_id = 'f9000000-0000-0000-0000-000000000010'), 0, 'Paciente A não vê avaliação não liberada');
select is((select count(*)::int from public.assessment_measurements where assessment_id = 'f9000000-0000-0000-0000-000000000100'), 0, 'Paciente A não vê medidas de avaliação não liberada');

select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.assessments set visible_to_patient = true where id = 'f9000000-0000-0000-0000-000000000100';
select isnt((select published_at from public.assessments where id = 'f9000000-0000-0000-0000-000000000100'), null, 'Liberar preenche published_at');

select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.assessments where patient_id = 'f9000000-0000-0000-0000-000000000010'), 1, 'Paciente A vê a avaliação liberada');
select is((select count(*)::int from public.assessment_measurements where assessment_id = 'f9000000-0000-0000-0000-000000000100'), 2, 'Paciente A vê as medidas liberadas');
select lives_ok(
  $$ update public.assessments set notes = 'hack' where id = 'f9000000-0000-0000-0000-000000000100' $$,
  'Update do paciente é ignorado pela RLS (0 linhas)'
);
select is((select notes from public.assessments where id = 'f9000000-0000-0000-0000-000000000100'), 'Visível ao paciente', 'Observação intacta após tentativa do paciente');
select throws_ok(
  $$ insert into public.assessment_measurements (assessment_id, measurement_type_id, value) select 'f9000000-0000-0000-0000-000000000100', id, 1 from public.measurement_types where code = 'HEIGHT' $$,
  '42501', null, 'Paciente não insere medida'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":1}]'::jsonb) $$,
  '42501', null, 'Paciente não grava medidas pela função (RLS de escrita)'
);

-- Paciente B: nada.
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.assessments where patient_id = 'f9000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê avaliação de A');

-- 5. Nutri B: nada -----------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.assessments where patient_id = 'f9000000-0000-0000-0000-000000000010'), 0, 'Nutri B não vê avaliações de paciente de A');
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":1}]'::jsonb) $$,
  'ASSESSMENT_NOT_FOUND', 'Nutri B não grava medidas (avaliação inexistente para ele)'
);
select throws_ok(
  $$ insert into public.assessments (patient_id, assessment_date) values ('f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date) $$,
  '42501', null, 'Nutri B não cria avaliação para paciente de A'
);

-- 6. Arquivar/excluir ----------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ delete from public.assessments where id = 'f9000000-0000-0000-0000-000000000100' $$,
  'ASSESSMENT_NOT_DELETABLE', 'Avaliação já exibida ao paciente não pode ser apagada (§29)'
);
update public.assessments set archived_at = now() where id = 'f9000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ update public.assessments set archived_at = null where id = 'f9000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'Arquivada não volta'
);
select throws_ok(
  $$ select public.set_assessment_measurements('f9000000-0000-0000-0000-000000000100', '[{"code":"WEIGHT","value":70}]'::jsonb) $$,
  'ASSESSMENT_ARCHIVED', 'Arquivada não recebe medidas'
);
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.assessments where patient_id = 'f9000000-0000-0000-0000-000000000010'), 0, 'Paciente deixa de ver a avaliação arquivada');

select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
insert into public.assessments (id, patient_id, assessment_date) values ('f9000000-0000-0000-0000-000000000101', 'f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date);
select lives_ok($$ delete from public.assessments where id = 'f9000000-0000-0000-0000-000000000101' $$, 'Avaliação nunca exibida pode ser apagada');

-- 7. Bucket privado (RLS do storage) --------------------------------------------------------
insert into public.assessments (id, patient_id, assessment_date, visible_to_patient) values
  ('f9000000-0000-0000-0000-000000000102', 'f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date - 2, true),
  ('f9000000-0000-0000-0000-000000000103', 'f9000000-0000-0000-0000-000000000010', (now() at time zone 'America/Sao_Paulo')::date - 1, false);
reset role;
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('bioimpedance-reports', 'f9000000-0000-0000-0000-000000000010/f9000000-0000-0000-0000-000000000102/r1.pdf', 'f9000000-0000-0000-0000-000000000001', '{}'),
  ('bioimpedance-reports', 'f9000000-0000-0000-0000-000000000010/f9000000-0000-0000-0000-000000000103/r2.pdf', 'f9000000-0000-0000-0000-000000000001', '{}');
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is(
  (select array_agg(name order by name) from storage.objects where bucket_id = 'bioimpedance-reports' and name like 'f9000000-0000-0000-0000-000000000010/%'),
  array['f9000000-0000-0000-0000-000000000010/f9000000-0000-0000-0000-000000000102/r1.pdf'],
  'Paciente A lê só o relatório da avaliação visível (não o da oculta)'
);
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from storage.objects where bucket_id = 'bioimpedance-reports' and name like 'f9000000-0000-0000-0000-000000000010/%'), 0, 'Paciente B não lê relatórios de A');
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from storage.objects where bucket_id = 'bioimpedance-reports' and name like 'f9000000-0000-0000-0000-000000000010/%'), 0, 'Nutri B não lê relatórios de paciente de A');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('bioimpedance-reports', 'f9000000-0000-0000-0000-000000000010/f9000000-0000-0000-0000-000000000102/hack.pdf', 'f9000000-0000-0000-0000-000000000002', '{}') $$,
  '42501', null, 'Nutri B não grava no bucket do paciente de A'
);
select set_config('request.jwt.claims', json_build_object('sub', 'f9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select count(*)::int from storage.objects where bucket_id = 'bioimpedance-reports' and name like 'f9000000-0000-0000-0000-000000000010/%'), 2, 'Nutri A lê os dois relatórios');

select * from finish();
rollback;
