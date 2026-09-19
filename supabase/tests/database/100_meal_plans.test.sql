-- Fase 8 — cardápio no banco: create_meal_plan (um ativo por paciente),
-- imutabilidade de versão publicada, create_meal_plan_version (cópia
-- profunda, um rascunho por vez), publish_meal_plan_version (atômica, v1
-- vira ARCHIVED, estrutura mínima, nunca duas publicadas), duplicate_meal /
-- duplicate_meal_plan_day (ids novos, destino preservado sem `replace`),
-- discard/archive, RLS: nutri A x B, paciente A x B, rascunho invisível.

begin;
create extension if not exists pgtap with schema extensions;

select plan(54);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'f8000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f8-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f8000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f8-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f8000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f8-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f8000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'f8-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('f8000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('f8000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('f8000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('f8000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('f8000000-0000-0000-0000-000000000010', 'f8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('f8000000-0000-0000-0000-000000000011', 'f8000000-0000-0000-0000-000000000004', 'f8000000-0000-0000-0000-000000000001', 'Patient B (row)');

-- 1. Como Nutri A: cria plano, monta v1 --------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f8000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select lives_ok(
  $$ select set_config('f8.plan', public.create_meal_plan('f8000000-0000-0000-0000-000000000010', 'Plano A', null, 'obs')::text, true) $$,
  'create_meal_plan cria o plano do paciente A'
);
select is(
  (select count(*)::int from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid and version_number = 1 and status = 'DRAFT'),
  1, 'Plano nasce com v1 DRAFT'
);
select throws_ok(
  $$ select public.create_meal_plan('f8000000-0000-0000-0000-000000000010', 'Outro') $$,
  'MEAL_PLAN_ACTIVE_EXISTS', 'Só um plano ativo por paciente'
);
select throws_ok(
  $$ select public.create_meal_plan('f8000000-0000-0000-0000-000000000010', '  ') $$,
  'VALIDATION_ERROR', 'Nome vazio é recusado'
);

select set_config('f8.v1', (select id::text from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid), true);

-- Publicar sem conteúdo é recusado.
select throws_ok(
  $$ select public.publish_meal_plan_version(current_setting('f8.v1')::uuid) $$,
  'INVALID_MEAL_PLAN_STRUCTURE', 'Publicar exige dia + refeição + alimento'
);

-- Segunda: café (2 itens, 1 substituição) e almoço.
insert into public.meal_plan_days (id, version_id, weekday) values ('f8000000-0000-0000-0000-000000000100', current_setting('f8.v1')::uuid, 1);
insert into public.meals (id, day_id, name, time_of_day, sort_order) values
  ('f8000000-0000-0000-0000-000000000110', 'f8000000-0000-0000-0000-000000000100', 'Café da manhã', '07:30', 1),
  ('f8000000-0000-0000-0000-000000000111', 'f8000000-0000-0000-0000-000000000100', 'Almoço', '12:30', 2);
insert into public.meal_items (id, meal_id, food_name, quantity, unit, sort_order) values
  ('f8000000-0000-0000-0000-000000000120', 'f8000000-0000-0000-0000-000000000110', 'Ovos', 2, 'unidade', 1),
  ('f8000000-0000-0000-0000-000000000121', 'f8000000-0000-0000-0000-000000000110', 'Pão', 1, 'fatia', 2),
  ('f8000000-0000-0000-0000-000000000122', 'f8000000-0000-0000-0000-000000000111', 'Arroz', 100, 'g', 1);
insert into public.meal_substitutions (id, meal_item_id, substitute_food_name, quantity, unit) values
  ('f8000000-0000-0000-0000-000000000130', 'f8000000-0000-0000-0000-000000000122', 'Batata doce', 150, 'g');

select throws_ok(
  $$ insert into public.meal_plan_days (version_id, weekday) values (current_setting('f8.v1')::uuid, 1) $$,
  '23505', null, 'Um registro por dia da semana na versão'
);

-- 2. Duplicar refeição e dia (§70–§71) ---------------------------------------
select lives_ok(
  $$ select set_config('f8.meal_copy', public.duplicate_meal('f8000000-0000-0000-0000-000000000110')::text, true) $$,
  'duplicate_meal no mesmo dia'
);
select isnt(current_setting('f8.meal_copy')::uuid, 'f8000000-0000-0000-0000-000000000110'::uuid, 'Refeição copiada tem id novo');
select is(
  (select array[name, sort_order::text] from public.meals where id = current_setting('f8.meal_copy')::uuid),
  array['Café da manhã', '3'], 'Cópia mantém nome e vai para o fim (sort_order 3)'
);
select is(
  (select count(*)::int from public.meal_items where meal_id = current_setting('f8.meal_copy')::uuid),
  2, 'Cópia tem os 2 alimentos com ids próprios'
);
select is(
  (select count(*)::int from public.meal_items where meal_id = 'f8000000-0000-0000-0000-000000000110'),
  2, 'Original continua com 2 alimentos (nada compartilhado)'
);

select lives_ok(
  $$ select set_config('f8.day_copy', public.duplicate_meal_plan_day('f8000000-0000-0000-0000-000000000100', 3::smallint)::text, true) $$,
  'duplicate_meal_plan_day para quarta (dia novo)'
);
select is(
  (select array[count(*)::int] from public.meals where day_id = current_setting('f8.day_copy')::uuid),
  array[3], 'Quarta recebeu as 3 refeições'
);
select is(
  (select count(*)::int
   from public.meal_substitutions s join public.meal_items i on i.id = s.meal_item_id join public.meals m on m.id = i.meal_id
   where m.day_id = current_setting('f8.day_copy')::uuid),
  1, 'Substituição copiada junto (id novo)'
);
select throws_ok(
  $$ select public.duplicate_meal_plan_day('f8000000-0000-0000-0000-000000000100', 3::smallint) $$,
  'MEAL_PLAN_DAY_NOT_EMPTY', 'Destino com conteúdo não é sobrescrito sem confirmação'
);
select is(
  (select count(*)::int from public.meals where day_id = current_setting('f8.day_copy')::uuid),
  3, 'Destino intacto após recusa'
);
select lives_ok(
  $$ select public.duplicate_meal_plan_day('f8000000-0000-0000-0000-000000000100', 3::smallint, true) $$,
  'Com replace = true substitui o destino'
);
select is(
  (select count(*)::int from public.meals where day_id = current_setting('f8.day_copy')::uuid),
  3, 'Destino substituído (3 refeições, não 6)'
);
select throws_ok(
  $$ select public.duplicate_meal_plan_day('f8000000-0000-0000-0000-000000000100', 1::smallint) $$,
  'VALIDATION_ERROR', 'Duplicar para o mesmo dia é recusado'
);

-- 3. Publicação ------------------------------------------------------------------
select lives_ok(
  $$ select public.publish_meal_plan_version(current_setting('f8.v1')::uuid) $$,
  'Publica v1'
);
select is(
  (select array[status::text, (published_at is not null)::text, (published_by = auth.uid())::text] from public.meal_plan_versions where id = current_setting('f8.v1')::uuid),
  array['PUBLISHED', 'true', 'true'], 'v1 PUBLISHED com published_at/published_by'
);
select throws_ok(
  $$ select public.publish_meal_plan_version(current_setting('f8.v1')::uuid) $$,
  'MEAL_PLAN_ALREADY_PUBLISHED', 'Publicar de novo é recusado'
);

-- Imutabilidade da versão publicada.
select throws_ok(
  $$ insert into public.meals (day_id, name, sort_order) values ('f8000000-0000-0000-0000-000000000100', 'Ceia', 9) $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'Versão publicada não aceita refeição nova'
);
select throws_ok(
  $$ update public.meal_items set quantity = 999 where id = 'f8000000-0000-0000-0000-000000000120' $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'Versão publicada não aceita alteração de alimento'
);
select throws_ok(
  $$ delete from public.meal_substitutions where id = 'f8000000-0000-0000-0000-000000000130' $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'Versão publicada não aceita remoção de substituição'
);
select throws_ok(
  $$ update public.meal_plan_versions set status = 'DRAFT' where id = current_setting('f8.v1')::uuid $$,
  'INVALID_STATUS_TRANSITION', 'PUBLISHED não volta a DRAFT'
);
select throws_ok(
  $$ update public.meal_plan_versions set version_number = 9 where id = current_setting('f8.v1')::uuid $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'version_number é imutável'
);
select throws_ok(
  $$ delete from public.meal_plan_versions where id = current_setting('f8.v1')::uuid $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'Versão publicada não pode ser apagada'
);

-- 4. Nova versão (§72) e publicação atômica (§73) ---------------------------------
select lives_ok(
  $$ select set_config('f8.v2', public.create_meal_plan_version(current_setting('f8.plan')::uuid)::text, true) $$,
  'create_meal_plan_version cria v2'
);
select is(
  (select array[version_number::text, status::text] from public.meal_plan_versions where id = current_setting('f8.v2')::uuid),
  array['2', 'DRAFT'], 'v2 é DRAFT'
);
select is(
  (select status::text from public.meal_plan_versions where id = current_setting('f8.v1')::uuid),
  'PUBLISHED', 'v1 continua publicada enquanto v2 é rascunho'
);
select is(
  (select count(*)::int from public.meal_items i join public.meals m on m.id = i.meal_id join public.meal_plan_days d on d.id = m.day_id where d.version_id = current_setting('f8.v2')::uuid),
  10, 'v2 copiou a estrutura inteira (10 alimentos: 5 de segunda + 5 de quarta)'
);
select throws_ok(
  $$ select public.create_meal_plan_version(current_setting('f8.plan')::uuid) $$,
  'MEAL_PLAN_DRAFT_EXISTS', 'Um rascunho por vez'
);

-- Edita v2 (permitido) e publica.
update public.meal_items set quantity = 3 where id = (select i.id from public.meal_items i join public.meals m on m.id = i.meal_id join public.meal_plan_days d on d.id = m.day_id where d.version_id = current_setting('f8.v2')::uuid and i.food_name = 'Ovos' limit 1);
select lives_ok(
  $$ select public.publish_meal_plan_version(current_setting('f8.v2')::uuid) $$,
  'Publica v2'
);
select is(
  (select array[
     (select status::text from public.meal_plan_versions where id = current_setting('f8.v1')::uuid),
     (select status::text from public.meal_plan_versions where id = current_setting('f8.v2')::uuid)]),
  array['ARCHIVED', 'PUBLISHED'], 'v2 publicada, v1 arquivada (histórico preservado)'
);
select is(
  (select count(*)::int from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid and status = 'PUBLISHED'),
  1, 'Nunca duas publicadas'
);
select is(
  (select quantity::int from public.meal_items where id = 'f8000000-0000-0000-0000-000000000120'),
  2, 'Conteúdo de v1 permanece intacto no histórico'
);

-- Descartar: só rascunho, nunca v1.
select lives_ok($$ select set_config('f8.v3', public.create_meal_plan_version(current_setting('f8.plan')::uuid)::text, true) $$, 'Cria v3 rascunho');
select lives_ok($$ select public.discard_meal_plan_version(current_setting('f8.v3')::uuid) $$, 'Descarta v3');
select is((select count(*)::int from public.meal_plan_versions where id = current_setting('f8.v3')::uuid), 0, 'v3 apagada (única exclusão física permitida)');
select throws_ok(
  $$ select public.discard_meal_plan_version(current_setting('f8.v2')::uuid) $$,
  'MEAL_PLAN_VERSION_NOT_EDITABLE', 'Publicada não pode ser descartada'
);

-- 5. Paciente A vê só PUBLISHED; paciente B não vê nada (§39/§75) ----------------
select lives_ok($$ select set_config('f8.v4', public.create_meal_plan_version(current_setting('f8.plan')::uuid)::text, true) $$, 'Cria v4 rascunho para o teste de visibilidade');

select set_config('request.jwt.claims', json_build_object('sub', 'f8000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is(
  (select array_agg(status::text order by status) from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid),
  array['PUBLISHED'], 'Paciente A lê só a versão PUBLISHED (nem DRAFT nem ARCHIVED)'
);
select is(
  (select count(*)::int from public.meal_plan_days where version_id = current_setting('f8.v4')::uuid),
  0, 'Paciente A não lê dias do rascunho'
);
select is(
  (select count(*)::int from public.meal_items i join public.meals m on m.id = i.meal_id join public.meal_plan_days d on d.id = m.day_id where d.version_id = current_setting('f8.v2')::uuid),
  10, 'Paciente A lê os alimentos da versão publicada'
);
select throws_ok(
  $$ insert into public.meal_plan_days (version_id, weekday) values (current_setting('f8.v4')::uuid, 5) $$,
  '42501', null, 'Paciente não escreve no cardápio'
);

select set_config('request.jwt.claims', json_build_object('sub', 'f8000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid),
  0, 'Paciente B não vê o plano de A'
);

-- 6. Nutri B x plano de A -----------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f8000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.meal_plans where id = current_setting('f8.plan')::uuid), 0, 'Nutri B não lê o plano de A');
select throws_ok(
  $$ select public.create_meal_plan_version(current_setting('f8.plan')::uuid) $$,
  'MEAL_PLAN_NOT_FOUND', 'Nutri B não cria versão no plano de A'
);
select throws_ok(
  $$ select public.publish_meal_plan_version(current_setting('f8.v4')::uuid) $$,
  'MEAL_PLAN_VERSION_NOT_FOUND', 'Nutri B não publica versão de A'
);
select throws_ok(
  $$ select public.create_meal_plan('f8000000-0000-0000-0000-000000000011', 'Invasão') $$,
  'PATIENT_NOT_FOUND', 'Nutri B não cria plano para paciente de A'
);

-- 7. Arquivar plano --------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'f8000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select lives_ok($$ select public.archive_meal_plan(current_setting('f8.plan')::uuid) $$, 'Arquiva o plano');
select is(
  (select count(*)::int from public.meal_plan_versions where meal_plan_id = current_setting('f8.plan')::uuid and status <> 'ARCHIVED'),
  0, 'Todas as versões ficam ARCHIVED e o paciente deixa de ver'
);
select lives_ok(
  $$ select public.create_meal_plan('f8000000-0000-0000-0000-000000000010', 'Plano novo', null, null, current_setting('f8.v2')::uuid) $$,
  'Novo plano usando a v2 arquivada como base'
);

select * from finish();
rollback;
