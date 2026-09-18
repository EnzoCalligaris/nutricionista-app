-- Fase 3 — provisionamento automático de profile a partir de auth.users, e
-- proteção contra role escalation (prompt Fase 3 §18-20, §45).
-- Cada teste roda dentro de uma transação que é revertida no final —
-- nenhum dado de fixture permanece no banco depois.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- 1) Trigger cria profile PATIENT automaticamente, com full_name do metadata
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f-newuser@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{"full_name":"Novo Paciente"}', '', '', '', '');

select is(
  (select role from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  'PATIENT'::public.profile_role,
  'trigger on_auth_user_created cria profile com role PATIENT por padrão'
);

select is(
  (select full_name from public.profiles where id = 'f0000000-0000-0000-0000-000000000001'),
  'Novo Paciente',
  'trigger usa full_name de raw_user_meta_data quando presente'
);

-- 2) Sem full_name no metadata, cai para o prefixo do e-mail
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f-semmetadata@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

select is(
  (select full_name from public.profiles where id = 'f0000000-0000-0000-0000-000000000002'),
  'f-semmetadata',
  'trigger cai para o prefixo do e-mail quando full_name não está em metadata'
);

-- 3) Role em raw_user_meta_data é ignorada — nunca vira fonte de autorização
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'f-tentativa@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{"role":"NUTRITIONIST","full_name":"Tentativa"}', '', '', '', '');

select is(
  (select role from public.profiles where id = 'f0000000-0000-0000-0000-000000000003'),
  'PATIENT'::public.profile_role,
  'role em raw_user_meta_data (fornecida pelo client) é ignorada pelo trigger — default PATIENT sempre'
);

-- 4) Role escalation via UPDATE continua bloqueada para o próprio usuário
-- (trigger prevent_role_change, Fase 2 — reverificado aqui como parte do
-- conjunto de garantias de autorização da Fase 3).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select throws_ok(
  $$update public.profiles set role = 'NUTRITIONIST' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  'P0001',
  null,
  'paciente não consegue se autopromover a NUTRITIONIST via UPDATE (trigger prevent_role_change)'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- 5) INSERT direto de profile com role diferente de PATIENT é negado por RLS
-- (policy profiles_insert_self apertada nesta migration). Apaga o profile
-- criado pelo trigger no passo 2 (como superuser) para simular o caso de um
-- profile ausente e um insert manual tentando se auto-promover.
delete from public.profiles where id = 'f0000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

select throws_ok(
  $$insert into public.profiles (id, role, full_name) values ('f0000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Tentativa Insert')$$,
  '42501',
  null,
  'auto-inserção de profile com role != PATIENT é negada pela policy profiles_insert_self'
);

reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
