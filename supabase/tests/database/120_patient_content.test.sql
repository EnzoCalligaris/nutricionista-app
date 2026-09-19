-- Fase 10 — suplementos, feedbacks e materiais no banco: ownership nutri A x B,
-- paciente A x B, suplemento ativo visível / encerrado e arquivado invisíveis,
-- feedback rascunho invisível / disponibilizado visível / arquivado invisível,
-- paciente só marca como lido, disponibilizar é definitivo, material não
-- atribuído invisível / atribuído visível / revogado invisível / arquivado
-- invisível, material de outro nutricionista nunca é atribuído, URL insegura
-- recusada, path fora do padrão recusado, DELETE só onde não há histórico e
-- RLS do bucket privado patient-documents.

begin;
create extension if not exists pgtap with schema extensions;

select plan(75);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fa-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'fa-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'fa-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fa000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'fa-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('fa000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('fa000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('fa000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('fa000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Paciente A é de Nutri A; Paciente B é de Nutri B (ownership cruzado real).
insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('fa000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('fa000000-0000-0000-0000-000000000011', 'fa000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000002', 'Patient B (row)');

select is((select public from storage.buckets where id = 'patient-documents'), false, 'Bucket patient-documents continua privado');

-- =====================================================================
-- 1. SUPLEMENTOS
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

insert into public.supplement_recommendations (id, patient_id, name, instructions, dose_text, schedule_text, purchase_url)
values ('fa000000-0000-0000-0000-000000000100', 'fa000000-0000-0000-0000-000000000010', 'Whey', 'Após o treino', '1 dose', '1x ao dia', 'https://example.com/whey');
select is((select created_by from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000100'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'Suplemento: created_by preenchido pelo trigger');
select is((select active from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000100'), true, 'Suplemento nasce ativo');

insert into public.supplement_recommendations (id, patient_id, name, active)
values ('fa000000-0000-0000-0000-000000000101', 'fa000000-0000-0000-0000-000000000010', 'Creatina (encerrada)', false);
insert into public.supplement_recommendations (id, patient_id, name)
values ('fa000000-0000-0000-0000-000000000102', 'fa000000-0000-0000-0000-000000000010', 'Ômega 3 (será arquivado)');
update public.supplement_recommendations set archived_at = now() where id = 'fa000000-0000-0000-0000-000000000102';
select is((select active from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000102'), false, 'Arquivar também encerra (active = false)');
select is((select archived_by from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000102'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'archived_by preenchido pelo trigger');

select throws_ok(
  $$ update public.supplement_recommendations set instructions = 'edição silenciosa' where id = 'fa000000-0000-0000-0000-000000000102' $$,
  'SUPPLEMENT_ARCHIVED', 'Suplemento arquivado é só leitura (§13)'
);
select throws_ok(
  $$ update public.supplement_recommendations set archived_at = null where id = 'fa000000-0000-0000-0000-000000000102' $$,
  'SUPPLEMENT_ARCHIVED', 'Arquivamento é irreversível'
);
select throws_ok(
  $$ insert into public.supplement_recommendations (patient_id, name, purchase_url) values ('fa000000-0000-0000-0000-000000000010', 'X', 'javascript:alert(1)') $$,
  '23514', null, 'URL javascript: recusada no banco (§9)'
);
select throws_ok(
  $$ insert into public.supplement_recommendations (patient_id, name, starts_on, ends_on) values ('fa000000-0000-0000-0000-000000000010', 'X', current_date, current_date - 1) $$,
  '23514', null, 'Período com fim antes do início recusado'
);
select throws_ok(
  $$ update public.supplement_recommendations set patient_id = 'fa000000-0000-0000-0000-000000000011' where id = 'fa000000-0000-0000-0000-000000000100' $$,
  'SUPPLEMENT_NOT_AUTHORIZED', 'patient_id do suplemento é imutável'
);
select throws_ok(
  $$ delete from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000101' $$,
  '42501', null, 'Suplemento nunca é apagado (§14)'
);
select throws_ok(
  $$ insert into public.supplement_recommendations (patient_id, name) values ('fa000000-0000-0000-0000-000000000011', 'Alheio') $$,
  '42501', null, 'Nutri A não cadastra suplemento para paciente de B'
);

-- Paciente A: só o ativo, sem escrita.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is(
  (select array_agg(name order by name) from public.supplement_recommendations where patient_id = 'fa000000-0000-0000-0000-000000000010'),
  array['Whey'],
  'Paciente A vê só o suplemento ATIVO (não o encerrado nem o arquivado)'
);
select is((select count(*)::int from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000100' and instructions = 'alterado'), 0, 'Paciente não altera suplemento (update não afeta linha)');
update public.supplement_recommendations set instructions = 'alterado' where id = 'fa000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ insert into public.supplement_recommendations (patient_id, name) values ('fa000000-0000-0000-0000-000000000010', 'Auto-prescrição') $$,
  '42501', null, 'Paciente não cadastra suplemento'
);

-- Paciente B e Nutri B: nada.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.supplement_recommendations where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê suplementos de A');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.supplement_recommendations where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Nutri B não vê suplementos de paciente de A');
update public.supplement_recommendations set active = false where id = 'fa000000-0000-0000-0000-000000000100';
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select instructions from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000100'), 'Após o treino', 'Nem paciente nem Nutri B alteraram o suplemento de A');
select is((select active from public.supplement_recommendations where id = 'fa000000-0000-0000-0000-000000000100'), true, 'Nutri B não encerrou suplemento de A');

-- =====================================================================
-- 2. FEEDBACKS
-- =====================================================================
insert into public.feedback_messages (id, patient_id, author_id, title, content)
values ('fa000000-0000-0000-0000-000000000200', 'fa000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000001', 'Rascunho', 'Conteúdo privado');
select is((select published_at from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000200'), null, 'Feedback nasce como rascunho (§22)');
select throws_ok(
  $$ insert into public.feedback_messages (patient_id, author_id, content) values ('fa000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000002', 'autor forjado') $$,
  '42501', null, 'author_id precisa ser o próprio nutricionista'
);
select throws_ok(
  $$ insert into public.feedback_messages (patient_id, author_id, content) values ('fa000000-0000-0000-0000-000000000011', 'fa000000-0000-0000-0000-000000000001', 'alheio') $$,
  '42501', null, 'Nutri A não escreve feedback para paciente de B'
);

-- Paciente A não vê o rascunho.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.feedback_messages where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Paciente A não vê feedback em rascunho');

-- Disponibiliza; edição do rascunho antes disso é livre.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.feedback_messages set content = 'Conteúdo revisado' where id = 'fa000000-0000-0000-0000-000000000200';
update public.feedback_messages set published_at = now() where id = 'fa000000-0000-0000-0000-000000000200';
select is((select updated_by from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000200'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'updated_by preenchido pelo trigger');
select throws_ok(
  $$ update public.feedback_messages set published_at = null where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'INVALID_STATUS_TRANSITION', 'Disponibilizar é definitivo: não volta a rascunho (§24)'
);
select lives_ok(
  $$ update public.feedback_messages set content = 'Conteúdo corrigido após disponibilizar' where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'Feedback disponibilizado ainda pode ser corrigido pelo nutricionista (com updated_at, §25)'
);
select throws_ok(
  $$ delete from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'FEEDBACK_NOT_DELETABLE', 'Feedback já disponibilizado nunca é apagado (§26)'
);
select throws_ok(
  $$ update public.feedback_messages set patient_id = 'fa000000-0000-0000-0000-000000000011' where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'FEEDBACK_NOT_AUTHORIZED', 'patient_id do feedback é imutável'
);

-- Paciente A vê o disponibilizado, só marca como lido.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select content from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000200'), 'Conteúdo corrigido após disponibilizar', 'Paciente A vê o feedback disponibilizado');
select lives_ok(
  $$ update public.feedback_messages set read_at = now() where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'Paciente marca como lido'
);
select isnt((select read_at from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000200'), null, 'read_at gravado');
select throws_ok(
  $$ update public.feedback_messages set content = 'hack' where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'FEEDBACK_NOT_AUTHORIZED', 'Paciente não altera o conteúdo'
);
select throws_ok(
  $$ update public.feedback_messages set archived_at = now() where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'FEEDBACK_NOT_AUTHORIZED', 'Paciente não arquiva'
);
select throws_ok(
  $$ insert into public.feedback_messages (patient_id, author_id, content) values ('fa000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000003', 'resposta') $$,
  '42501', null, 'Paciente não escreve feedback (não é chat, §19)'
);

-- Paciente B / Nutri B: nada.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.feedback_messages where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê feedback de A');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.feedback_messages where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Nutri B não vê feedback de paciente de A');

-- Arquivar: paciente deixa de ver; arquivado é só leitura. Rascunho pode ser apagado.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.feedback_messages set archived_at = now() where id = 'fa000000-0000-0000-0000-000000000200';
select throws_ok(
  $$ update public.feedback_messages set content = 'x' where id = 'fa000000-0000-0000-0000-000000000200' $$,
  'FEEDBACK_ARCHIVED', 'Feedback arquivado é só leitura'
);
insert into public.feedback_messages (id, patient_id, author_id, content)
values ('fa000000-0000-0000-0000-000000000201', 'fa000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000001', 'rascunho descartável');
delete from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000201';
select is((select count(*)::int from public.feedback_messages where id = 'fa000000-0000-0000-0000-000000000201'), 0, 'Rascunho nunca exibido pode ser apagado');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.feedback_messages where patient_id = 'fa000000-0000-0000-0000-000000000010'), 0, 'Paciente A não vê feedback arquivado');

-- =====================================================================
-- 3. MATERIAIS E ATRIBUIÇÕES
-- =====================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

insert into public.patient_materials (id, nutritionist_id, kind, title, external_url)
values ('fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000001', 'LINK', 'Guia (link)', 'https://example.com/guia');
insert into public.patient_materials (id, nutritionist_id, kind, title)
values ('fa000000-0000-0000-0000-000000000301', 'fa000000-0000-0000-0000-000000000001', 'FILE', 'PDF (upload pendente)');

select throws_ok(
  $$ insert into public.patient_materials (nutritionist_id, kind, title, external_url) values ('fa000000-0000-0000-0000-000000000001', 'LINK', 'x', 'javascript:alert(1)') $$,
  '23514', null, 'Material com URL javascript: recusado (§48)'
);
select throws_ok(
  $$ insert into public.patient_materials (nutritionist_id, kind, title, external_url) values ('fa000000-0000-0000-0000-000000000001', 'LINK', 'x', 'ftp://example.com/a') $$,
  '23514', null, 'Material com URL ftp: recusado'
);
select throws_ok(
  $$ insert into public.patient_materials (id, nutritionist_id, kind, title, external_url, storage_path) values ('fa000000-0000-0000-0000-000000000303', 'fa000000-0000-0000-0000-000000000001', 'FILE', 'x', 'https://example.com', 'fa000000-0000-0000-0000-000000000303/b.pdf') $$,
  '23514', null, 'Arquivo E link ao mesmo tempo recusado (§35)'
);
select throws_ok(
  $$ update public.patient_materials set storage_path = 'fa000000-0000-0000-0000-000000000300/x.pdf' where id = 'fa000000-0000-0000-0000-000000000301' $$,
  'MATERIAL_PATH_INVALID', 'storage_path fora de <material_id>/ recusado (§40)'
);
select throws_ok(
  $$ insert into public.material_assignments (material_id, patient_id) values ('fa000000-0000-0000-0000-000000000301', 'fa000000-0000-0000-0000-000000000010') $$,
  'MATERIAL_INCOMPLETE', 'Material de arquivo sem upload não é atribuído'
);
update public.patient_materials
  set storage_path = 'fa000000-0000-0000-0000-000000000301/11111111-1111-1111-1111-111111111111.pdf', mime_type = 'application/pdf', file_name = 'guia.pdf', file_size_bytes = 1234
  where id = 'fa000000-0000-0000-0000-000000000301';
select throws_ok(
  $$ insert into public.patient_materials (nutritionist_id, kind, title, external_url) values ('fa000000-0000-0000-0000-000000000002', 'LINK', 'x', 'https://example.com') $$,
  '42501', null, 'Nutri A não cria material em nome de B'
);

-- Paciente A antes da atribuição: nada.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials), 0, 'Paciente A não vê material não atribuído');

-- Atribui os dois.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
insert into public.material_assignments (id, material_id, patient_id) values
  ('fa000000-0000-0000-0000-000000000400', 'fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000010'),
  ('fa000000-0000-0000-0000-000000000401', 'fa000000-0000-0000-0000-000000000301', 'fa000000-0000-0000-0000-000000000010');
select is((select assigned_by from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000400'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'assigned_by preenchido pelo trigger');
select throws_ok(
  $$ insert into public.material_assignments (material_id, patient_id) values ('fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000011') $$,
  'MATERIAL_NOT_AUTHORIZED', 'Nutri A não atribui material a paciente de B'
);
select throws_ok(
  $$ insert into public.material_assignments (material_id, patient_id) values ('fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000010') $$,
  '23505', null, 'Atribuição duplicada é recusada (única por material+paciente)'
);
select throws_ok(
  $$ delete from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000400' $$,
  '42501', null, 'Atribuição nunca é apagada (revogar = revoked_at, §43)'
);
select throws_ok(
  $$ delete from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000300' $$,
  'MATERIAL_NOT_DELETABLE', 'Material já atribuído não é apagado (§45)'
);
insert into public.patient_materials (id, nutritionist_id, kind, title, external_url)
values ('fa000000-0000-0000-0000-000000000302', 'fa000000-0000-0000-0000-000000000001', 'LINK', 'Nunca atribuído', 'https://example.com/tmp');
delete from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000302';
select is((select count(*)::int from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000302'), 0, 'Material nunca atribuído pode ser apagado');

-- Nutri B não vê nem atribui material de A (mesmo para o próprio paciente).
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials where nutritionist_id = 'fa000000-0000-0000-0000-000000000001'), 0, 'Nutri B não vê materiais de A');
select throws_ok(
  $$ insert into public.material_assignments (material_id, patient_id) values ('fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000011') $$,
  'MATERIAL_NOT_AUTHORIZED', 'Nutri B não atribui material de A ao próprio paciente (trigger além da RLS)'
);

-- Objetos no bucket (como superusuário, para provar a policy).
reset role;
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('patient-documents', 'fa000000-0000-0000-0000-000000000301/11111111-1111-1111-1111-111111111111.pdf', 'fa000000-0000-0000-0000-000000000001', '{}');
set local role authenticated;

-- Paciente A vê material atribuído (tabela, atribuição e bucket).
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials), 2, 'Paciente A vê os dois materiais atribuídos');
select is((select count(*)::int from public.material_assignments where patient_id = 'fa000000-0000-0000-0000-000000000010'), 2, 'Paciente A vê as próprias atribuições');
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 1, 'Paciente A lê o arquivo do material atribuído');
update public.patient_materials set title = 'hack' where id = 'fa000000-0000-0000-0000-000000000300';
select is((select title from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000300'), 'Guia (link)', 'Paciente não altera material (update não afeta linha)');
select throws_ok(
  $$ insert into public.material_assignments (material_id, patient_id) values ('fa000000-0000-0000-0000-000000000300', 'fa000000-0000-0000-0000-000000000010') $$,
  '42501', null, 'Paciente não se auto-atribui material'
);

-- Paciente B / Nutri B: nada no bucket.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials), 0, 'Paciente B não vê materiais de A');
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 0, 'Paciente B não lê o arquivo');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 0, 'Nutri B não lê o arquivo de A');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('patient-documents', 'fa000000-0000-0000-0000-000000000301/hack.pdf', 'fa000000-0000-0000-0000-000000000002', '{}') $$,
  '42501', null, 'Nutri B não grava no material de A'
);

-- Revogar: paciente perde acesso (tabela + bucket); reatribuir devolve.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.material_assignments set revoked_at = now() where id = 'fa000000-0000-0000-0000-000000000401';
select is((select revoked_by from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000401'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'revoked_by preenchido pelo trigger');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000301'), 0, 'Após revogar, paciente não vê o material');
select is((select count(*)::int from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000401'), 0, 'Após revogar, paciente não vê a atribuição');
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 0, 'Após revogar, paciente não lê o arquivo');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.material_assignments set revoked_at = null where id = 'fa000000-0000-0000-0000-000000000401';
select is((select revoked_by from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000401'), null, 'Reatribuir limpa revoked_by');
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 1, 'Após reatribuir, paciente lê o arquivo de novo');

-- Arquivar material: paciente perde acesso mesmo com atribuição ativa; não reatribuível; só leitura.
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.patient_materials set archived_at = now() where id = 'fa000000-0000-0000-0000-000000000301';
select is((select archived_by from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000301'), 'fa000000-0000-0000-0000-000000000001'::uuid, 'Material: archived_by preenchido');
select is((select revoked_at from public.material_assignments where id = 'fa000000-0000-0000-0000-000000000401'), null, 'Histórico administrativo da atribuição permanece (§44)');
select throws_ok(
  $$ update public.patient_materials set title = 'x' where id = 'fa000000-0000-0000-0000-000000000301' $$,
  'MATERIAL_ARCHIVED', 'Material arquivado é só leitura'
);
update public.material_assignments set revoked_at = now() where id = 'fa000000-0000-0000-0000-000000000401';
select throws_ok(
  $$ update public.material_assignments set revoked_at = null where id = 'fa000000-0000-0000-0000-000000000401' $$,
  'MATERIAL_ARCHIVED', 'Material arquivado não é reatribuído (§44)'
);
select set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.patient_materials where id = 'fa000000-0000-0000-0000-000000000301'), 0, 'Paciente não vê material arquivado');
select is((select count(*)::int from storage.objects where bucket_id = 'patient-documents' and name like 'fa000000-0000-0000-0000-000000000301/%'), 0, 'Paciente não lê arquivo de material arquivado');

select * from finish();
rollback;
