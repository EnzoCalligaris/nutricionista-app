-- Fase 11 — foto da refeição + análise por IA no banco: consentimento
-- versionado do paciente (só ele registra/revoga, só revoked_at muda, uma
-- vez), análise só com consentimento ativo, path <patient_id>/<analysis_id>/,
-- refeição futura recusada, máquina de estados (PENDING→ANALYZED exige
-- resultado; ANALYZED→CONFIRMED exige versão confirmada; FAILED→PENDING;
-- CONFIRMED→ANALYZED), original da IA imutável, arquivada só leitura,
-- ownership paciente A x B e nutri A x B (tabela e bucket meal-photos),
-- paciente não muda patient_id/storage_path, nutricionista não escreve.

begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'fb000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fb-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fb000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'fb-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fb000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'fb-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fb000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'fb-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('fb000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('fb000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('fb000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('fb000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000003', 'fb000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('fb000000-0000-0000-0000-000000000011', 'fb000000-0000-0000-0000-000000000004', 'fb000000-0000-0000-0000-000000000002', 'Patient B (row)');

select is((select public from storage.buckets where id = 'meal-photos'), false, 'Bucket meal-photos continua privado');

-- =====================================================================
-- 1. CONSENTIMENTO
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fb000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1') $$,
  'MEAL_AI_CONSENT_REQUIRED', 'Sem consentimento ativo a análise não é criada (§19/§90)'
);
select throws_ok(
  $$ insert into public.patient_consents (patient_id, consent_type, consent_version) values ('fb000000-0000-0000-0000-000000000011', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1') $$,
  '42501', null, 'Paciente A não registra consentimento em nome de B'
);
select throws_ok(
  $$ insert into public.patient_consents (patient_id, consent_type, consent_version) values ('fb000000-0000-0000-0000-000000000010', 'meal', 'meal_photo_ai_v1') $$,
  '23514', null, 'Tipo de consentimento fora do padrão recusado'
);
insert into public.patient_consents (id, patient_id, consent_type, consent_version)
values ('fb000000-0000-0000-0000-000000000200', 'fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1');
select is((select public.patient_has_consent('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1')), true, 'Consentimento ativo (helper)');
select is((select public.patient_has_consent('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v2')), false, 'Outra versão do texto não conta (§21)');
select throws_ok(
  $$ insert into public.patient_consents (patient_id, consent_type, consent_version) values ('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1') $$,
  '23505', null, 'Um consentimento ativo por versão'
);
select throws_ok(
  $$ update public.patient_consents set consent_version = 'meal_photo_ai_v2' where id = 'fb000000-0000-0000-0000-000000000200' $$,
  'CONSENT_NOT_AUTHORIZED', 'Só revoked_at muda depois de aceito'
);
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v2') $$,
  'MEAL_AI_CONSENT_REQUIRED', 'Análise com versão de consentimento não aceita é recusada'
);

-- =====================================================================
-- 2. CRIAÇÃO E GUARDS
-- =====================================================================
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/x.webp', 'meal_photo_ai_v1') $$,
  'MEAL_PHOTO_INVALID', 'Path sem <analysis_id> recusado (§15)'
);
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000011/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1') $$,
  'MEAL_PHOTO_INVALID', 'Path na pasta de outro paciente recusado'
);
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version, meal_at) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1', now() + interval '2 hours') $$,
  'INVALID_MEAL_TIME', 'Refeição no futuro recusada (§59)'
);
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version, status) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1', 'CONFIRMED') $$,
  'INVALID_STATUS_TRANSITION', 'Nasce sempre PENDING (status privilegiado recusado — §74)'
);
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000011', 'fb000000-0000-0000-0000-000000000011/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1') $$,
  'MEAL_AI_CONSENT_REQUIRED', 'Paciente A não cria análise para B (trigger — B não tem consentimento; a RLS também recusaria)'
);
select lives_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version, meal_at) values ('fb000000-0000-0000-0000-000000000100', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'meal_photo_ai_v1', now() + interval '5 minutes') $$,
  'Análise criada (5 min de tolerância de relógio aceitos)'
);
select is((select status::text from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), 'PENDING', 'Nasce PENDING');

-- =====================================================================
-- 3. MÁQUINA DE ESTADOS E ORIGINAL IMUTÁVEL
-- =====================================================================
select throws_ok(
  $$ update public.food_photo_analyses set status = 'ANALYZED' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'ANALYZED sem resultado/provider recusado'
);
select throws_ok(
  $$ update public.food_photo_analyses set status = 'CONFIRMED', corrected_result = '{"items":[]}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'PENDING → CONFIRMED direto recusado (§35)'
);
select throws_ok(
  $$ update public.food_photo_analyses set corrected_result = '{"items":[]}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'Versão confirmada não existe antes da análise'
);
-- Claim de processamento (idempotência §25): só uma requisição pega a análise.
update public.food_photo_analyses set processing_started_at = now()
  where id = 'fb000000-0000-0000-0000-000000000100' and status = 'PENDING' and (processing_started_at is null or processing_started_at < now() - interval '2 minutes');
create temp table claim_result as
  with c as (
    update public.food_photo_analyses set processing_started_at = now()
    where id = 'fb000000-0000-0000-0000-000000000100' and status = 'PENDING' and (processing_started_at is null or processing_started_at < now() - interval '2 minutes')
    returning id
  ) select count(*)::int as n from c;
select is((select n from claim_result), 0, 'Segundo claim simultâneo não pega a análise (§91)');
update public.food_photo_analyses set status = 'FAILED', failure_code = 'TIMEOUT', attempts = 1 where id = 'fb000000-0000-0000-0000-000000000100';
select is((select processing_started_at from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), null, 'Falha libera o claim (§27)');
select lives_ok(
  $$ update public.food_photo_analyses set status = 'PENDING', processing_started_at = now() where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FAILED → PENDING = tentar de novo, sem registro novo'
);
select lives_ok(
  $$ update public.food_photo_analyses set status = 'ANALYZED', provider = 'fake', model = 'fake-v1', structured_result = '{"items":[{"name":"Arroz","quantity":150,"unit":"g","calories":195,"protein":4,"carbs":42,"fat":0.5}],"totals":{"calories":195,"protein":4,"carbs":42,"fat":0.5}}'::jsonb, attempts = 2 where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'PENDING → ANALYZED com resultado'
);
select isnt((select analyzed_at from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), null, 'analyzed_at preenchido');
select is((select processing_started_at from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), null, 'Concluir libera o claim');
select throws_ok(
  $$ update public.food_photo_analyses set structured_result = '{"items":[]}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_ORIGINAL_IMMUTABLE', 'Original da IA nunca é sobrescrito (§33/§86)'
);
select throws_ok(
  $$ update public.food_photo_analyses set provider = 'outro' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_ORIGINAL_IMMUTABLE', 'Provider do original imutável (§78)'
);
select throws_ok(
  $$ update public.food_photo_analyses set status = 'CONFIRMED' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'Confirmar sem versão confirmada recusado'
);
select throws_ok(
  $$ update public.food_photo_analyses set status = 'PENDING' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_STATUS_TRANSITION', 'ANALYZED → PENDING recusado'
);
select lives_ok(
  $$ update public.food_photo_analyses set status = 'CONFIRMED', corrected_result = '{"items":[{"name":"Arroz","quantity":100,"unit":"g","calories":130,"protein":2.5,"carbs":28,"fat":0.3}],"totals":{"calories":130,"protein":2.5,"carbs":28,"fat":0.3}}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'ANALYZED → CONFIRMED com versão confirmada'
);
select isnt((select confirmed_at from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), null, 'confirmed_at preenchido');
select is((select structured_result->'items'->0->>'quantity' from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), '150', 'Original continua 150 g depois da confirmação com 100 g (§86)');
select lives_ok(
  $$ update public.food_photo_analyses set corrected_result = '{"items":[],"totals":{"calories":0,"protein":0,"carbs":0,"fat":0}}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'Correção posterior da versão confirmada permitida (updated_at, §40)'
);
select lives_ok(
  $$ update public.food_photo_analyses set status = 'ANALYZED' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'CONFIRMED → ANALYZED = reabrir revisão explicitamente'
);
update public.food_photo_analyses set status = 'CONFIRMED' where id = 'fb000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ update public.food_photo_analyses set patient_id = 'fb000000-0000-0000-0000-000000000011' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_NOT_AUTHORIZED', 'patient_id imutável (§78)'
);
select throws_ok(
  $$ update public.food_photo_analyses set storage_path = 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/b.webp' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_NOT_AUTHORIZED', 'storage_path imutável'
);
select throws_ok(
  $$ update public.food_photo_analyses set meal_at = now() + interval '1 day' where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'INVALID_MEAL_TIME', 'Ajuste da data para o futuro recusado'
);
delete from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100';
select is((select count(*)::int from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), 1, 'Paciente não apaga análise — sem policy de delete (arquivar)');

-- =====================================================================
-- 4. OWNERSHIP (tabela + bucket)
-- =====================================================================
reset role;
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('meal-photos', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/a.webp', 'fb000000-0000-0000-0000-000000000003', '{}');
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', 'fb000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.food_photo_analyses where patient_id = 'fb000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê análise de A');
select is((select count(*)::int from public.patient_consents where patient_id = 'fb000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê consentimento de A');
select is((select count(*)::int from storage.objects where bucket_id = 'meal-photos' and name like 'fb000000-0000-0000-0000-000000000010/%'), 0, 'Paciente B não lê a foto de A');
update public.food_photo_analyses set status = 'ANALYZED' where id = 'fb000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('meal-photos', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/hack.webp', 'fb000000-0000-0000-0000-000000000004', '{}') $$,
  '42501', null, 'Paciente B não grava na pasta de A (path adulterado — §83)'
);

select set_config('request.jwt.claims', json_build_object('sub', 'fb000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.food_photo_analyses where patient_id = 'fb000000-0000-0000-0000-000000000010'), 0, 'Nutri B não vê análise de paciente de A');
select is((select count(*)::int from storage.objects where bucket_id = 'meal-photos' and name like 'fb000000-0000-0000-0000-000000000010/%'), 0, 'Nutri B não lê a foto');

select set_config('request.jwt.claims', json_build_object('sub', 'fb000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select status::text from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), 'CONFIRMED', 'Nutri A vê a análise confirmada do próprio paciente (e ninguém a reabriu)');
select is((select count(*)::int from storage.objects where bucket_id = 'meal-photos' and name like 'fb000000-0000-0000-0000-000000000010/%'), 1, 'Nutri A lê a foto');
select is((select count(*)::int from public.patient_consents where patient_id = 'fb000000-0000-0000-0000-000000000010'), 1, 'Nutri A vê o consentimento do próprio paciente');
update public.food_photo_analyses set corrected_result = '{"items":[]}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ insert into public.patient_consents (patient_id, consent_type, consent_version) values ('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v9') $$,
  '42501', null, 'Nutricionista não registra consentimento pelo paciente (§20)'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata) values ('meal-photos', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000100/n.webp', 'fb000000-0000-0000-0000-000000000001', '{}') $$,
  '42501', null, 'Nutricionista não grava foto de refeição'
);

-- =====================================================================
-- 5. REVOGAÇÃO E ARQUIVAMENTO (paciente A)
-- =====================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'fb000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select corrected_result->'items' from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), '[]'::jsonb, 'Nutricionista não alterou a versão confirmada (sem policy de update — §79)');
update public.food_photo_analyses set archived_at = now() where id = 'fb000000-0000-0000-0000-000000000100';
select throws_ok(
  $$ update public.food_photo_analyses set corrected_result = '{"items":[{"name":"x"}]}'::jsonb where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_ARCHIVED', 'Arquivada é só leitura (§41)'
);
select throws_ok(
  $$ update public.food_photo_analyses set archived_at = null where id = 'fb000000-0000-0000-0000-000000000100' $$,
  'FOOD_ANALYSIS_ARCHIVED', 'Arquivamento irreversível'
);
update public.patient_consents set revoked_at = now() where id = 'fb000000-0000-0000-0000-000000000200';
select is((select public.patient_has_consent('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1')), false, 'Revogado deixa de contar (§22)');
select throws_ok(
  $$ insert into public.food_photo_analyses (id, patient_id, storage_path, consent_version) values ('fb000000-0000-0000-0000-000000000101', 'fb000000-0000-0000-0000-000000000010', 'fb000000-0000-0000-0000-000000000010/fb000000-0000-0000-0000-000000000101/a.webp', 'meal_photo_ai_v1') $$,
  'MEAL_AI_CONSENT_REQUIRED', 'Após revogar, novas análises são bloqueadas (§90)'
);
select is((select count(*)::int from public.food_photo_analyses where id = 'fb000000-0000-0000-0000-000000000100'), 1, 'Análise anterior permanece (revogar não apaga — política documentada)');
select throws_ok(
  $$ update public.patient_consents set revoked_at = now() + interval '1 day' where id = 'fb000000-0000-0000-0000-000000000200' $$,
  'INVALID_STATUS_TRANSITION', 'Revogação registrada uma única vez'
);
select lives_ok(
  $$ insert into public.patient_consents (patient_id, consent_type, consent_version) values ('fb000000-0000-0000-0000-000000000010', 'MEAL_PHOTO_AI', 'meal_photo_ai_v1') $$,
  'Aceitar de novo cria um consentimento novo (histórico preservado)'
);

select * from finish();
rollback;
