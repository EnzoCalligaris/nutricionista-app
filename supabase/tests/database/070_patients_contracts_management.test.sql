-- Fase 5 — gestão de pacientes/contratos no banco: índice único de e-mail,
-- view patient_overview (status derivado + contrato atual + RLS), funções
-- transacionais create_contract_with_installments / cancel_contract /
-- complete_contract (validação, ownership sob RLS, preservação de histórico)
-- e resumo financeiro do contrato recém-criado.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Fixtures (superuser) --------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'e-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'e-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('e0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('e0000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Pacientes de A: um com contrato ativo, um sem contrato, um desativado com contrato ativo (override).
insert into public.patients (id, nutritionist_id, full_name, email, status, archived_at) values
  ('e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000001', 'A Com Contrato', 'com.contrato@example.test', 'ACTIVE', null),
  ('e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'A Sem Contrato', 'sem.contrato@example.test', 'ACTIVE', null),
  ('e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'A Desativado', 'desativado@example.test', 'INACTIVE', now());

-- Paciente de B.
insert into public.patients (id, nutritionist_id, full_name, email) values
  ('e0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000002', 'B Paciente', 'b.paciente@example.test');

insert into public.plans (id, code, name, duration_months, active) values
  ('e0000000-0000-0000-0000-000000000030', 'TRI_TESTE', 'Trimestral (teste)', 3, true),
  ('e0000000-0000-0000-0000-000000000031', 'SEM_TESTE', 'Semestral (teste)', 6, true),
  ('e0000000-0000-0000-0000-000000000032', 'INATIVO_TESTE', 'Plano inativo (teste)', 3, false);

insert into public.plan_prices (id, plan_id, label, amount_cents, installments, payment_type, active) values
  ('e0000000-0000-0000-0000-000000000040', 'e0000000-0000-0000-0000-000000000030', '3x', 68037, 3, 'PARCELADO', true),
  ('e0000000-0000-0000-0000-000000000041', 'e0000000-0000-0000-0000-000000000031', '6x', 128760, 6, 'PARCELADO', true);

-- Contrato antigo (encerrado) + contrato ativo mais recente para o mesmo paciente.
insert into public.patient_contracts (id, patient_id, plan_id, start_date, end_date, status, contracted_amount_cents) values
  ('e0000000-0000-0000-0000-000000000050', 'e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000030', current_date - 200, current_date - 110, 'COMPLETED', 68037),
  ('e0000000-0000-0000-0000-000000000051', 'e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000031', current_date - 30, current_date + 150, 'ACTIVE', 128760),
  ('e0000000-0000-0000-0000-000000000052', 'e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000030', current_date - 10, current_date + 80, 'ACTIVE', 68037);

-- 1. Índice único de e-mail por nutricionista ---------------------------
select throws_ok(
  $$ insert into public.patients (nutritionist_id, full_name, email)
     values ('e0000000-0000-0000-0000-000000000001', 'Duplicado', 'COM.CONTRATO@example.test') $$,
  '23505',
  null,
  'Mesmo nutricionista não cadastra dois pacientes com o mesmo e-mail (case-insensitive)'
);

select lives_ok(
  $$ insert into public.patients (nutritionist_id, full_name, email)
     values ('e0000000-0000-0000-0000-000000000002', 'Outro nutri, mesmo e-mail', 'com.contrato@example.test') $$,
  'Outro nutricionista pode ter paciente com o mesmo e-mail'
);

select lives_ok(
  $$ insert into public.patients (nutritionist_id, full_name, email)
     values ('e0000000-0000-0000-0000-000000000001', 'Sem e-mail 1', null),
            ('e0000000-0000-0000-0000-000000000001', 'Sem e-mail 2', null) $$,
  'E-mail nulo não participa da unicidade'
);

-- 2. patient_overview (como Nutri A, sob RLS) -------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select is(
  (select is_effectively_active from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000010'),
  true,
  'patient_overview: status ACTIVE + contrato ACTIVE => is_effectively_active'
);

select is(
  (select is_effectively_active from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000011'),
  false,
  'patient_overview: status ACTIVE sem contrato => não é ativo'
);

select is(
  (select is_effectively_active from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000012'),
  false,
  'patient_overview: override INACTIVE vence contrato ACTIVE'
);

select is(
  (select current_contract_id from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000010'),
  'e0000000-0000-0000-0000-000000000051'::uuid,
  'patient_overview: contrato atual é o ACTIVE mais recente, não o COMPLETED antigo'
);

select is(
  (select current_plan_code from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000010'),
  'SEM_TESTE',
  'patient_overview: plano atual vem do contrato atual'
);

select is(
  (select count(*)::int from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000020'),
  0,
  'patient_overview: Nutri A não enxerga paciente de Nutri B (security_invoker + RLS)'
);

-- 3. create_contract_with_installments — sucesso ---------------------------
select lives_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011',
       'e0000000-0000-0000-0000-000000000030',
       date '2026-01-31',
       100000,
       '[{"number":1,"amount_cents":33334,"due_date":"2026-01-31"},
         {"number":2,"amount_cents":33333,"due_date":"2026-02-28"},
         {"number":3,"amount_cents":33333,"due_date":"2026-03-31"}]'::jsonb,
       'e0000000-0000-0000-0000-000000000040',
       date '2026-04-30',
       '  obs  ') $$,
  'Nutri A cria contrato com 3 parcelas para o próprio paciente'
);

select is(
  (select count(*)::int from public.patient_contracts where patient_id = 'e0000000-0000-0000-0000-000000000011' and status = 'ACTIVE'),
  1,
  'Contrato criado como ACTIVE'
);

select is(
  (select notes from public.patient_contracts where patient_id = 'e0000000-0000-0000-0000-000000000011'),
  'obs',
  'Observações são trimadas'
);

select is(
  (select count(*)::int from public.contract_installments ci
     join public.patient_contracts c on c.id = ci.contract_id
    where c.patient_id = 'e0000000-0000-0000-0000-000000000011'),
  3,
  '3 parcelas geradas'
);

select is(
  (select sum(ci.amount_cents)::int from public.contract_installments ci
     join public.patient_contracts c on c.id = ci.contract_id
    where c.patient_id = 'e0000000-0000-0000-0000-000000000011'),
  100000,
  'Soma das parcelas = contratado (nenhum centavo perdido)'
);

select is(
  (select array_agg(ci.status::text order by ci.number) from public.contract_installments ci
     join public.patient_contracts c on c.id = ci.contract_id
    where c.patient_id = 'e0000000-0000-0000-0000-000000000011'),
  array['PENDING', 'PENDING', 'PENDING'],
  'Nenhuma parcela nasce paga'
);

select is(
  (select is_effectively_active from public.patient_overview where patient_id = 'e0000000-0000-0000-0000-000000000011'),
  true,
  'Paciente passa a ser ativo após o contrato'
);

-- Resumo financeiro do contrato recém-criado (view da Fase 2).
select is(
  (select array[contracted_amount_cents, received_cents, pending_cents, forecast_cents]::int[]
     from public.contract_financial_summary
    where patient_id = 'e0000000-0000-0000-0000-000000000011'),
  array[100000, 0, 100000, 100000],
  'Resumo financeiro: contratado 100000, recebido 0, pendente 100000, previsto 100000'
);

-- 4. create_contract_with_installments — validações -----------------------
select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100000,
       '[{"number":1,"amount_cents":50000,"due_date":"2026-01-31"},{"number":2,"amount_cents":49999,"due_date":"2026-02-28"}]'::jsonb) $$,
  'INVALID_INSTALLMENTS',
  'Soma das parcelas diferente do contratado é rejeitada'
);

select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100000,
       '[{"number":1,"amount_cents":50000,"due_date":"2026-01-31"},{"number":1,"amount_cents":50000,"due_date":"2026-02-28"}]'::jsonb) $$,
  'INVALID_INSTALLMENTS',
  'Numeração repetida é rejeitada'
);

select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100000,
       '[]'::jsonb) $$,
  'INVALID_INSTALLMENTS',
  'Sem parcelas é rejeitado'
);

select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100,
       '[{"number":1,"amount_cents":100,"due_date":"2026-01-31"}]'::jsonb, null, date '2026-01-30') $$,
  'INVALID_CONTRACT_PERIOD',
  'Término antes do início é rejeitado'
);

select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000032', date '2026-01-31', 100,
       '[{"number":1,"amount_cents":100,"due_date":"2026-01-31"}]'::jsonb) $$,
  'PLAN_NOT_AVAILABLE',
  'Plano inativo é rejeitado'
);

select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100,
       '[{"number":1,"amount_cents":100,"due_date":"2026-01-31"}]'::jsonb, 'e0000000-0000-0000-0000-000000000041') $$,
  'PLAN_NOT_AVAILABLE',
  'Condição de preço de OUTRO plano é rejeitada'
);

-- 5. Ownership: Nutri A tentando agir sobre paciente/contrato de B -----------
select throws_ok(
  $$ select public.create_contract_with_installments(
       'e0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000030', date '2026-01-31', 100,
       '[{"number":1,"amount_cents":100,"due_date":"2026-01-31"}]'::jsonb) $$,
  'PATIENT_NOT_FOUND',
  'Nutri A NÃO cria contrato para paciente de Nutri B (patient_id adulterado)'
);

-- Como Nutri B, o contrato de A não existe.
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ select public.cancel_contract('e0000000-0000-0000-0000-000000000051') $$,
  'CONTRACT_NOT_FOUND',
  'Nutri B NÃO cancela contrato de paciente de Nutri A (contract_id adulterado)'
);

select is(
  (select count(*)::int from public.patients where id = 'e0000000-0000-0000-0000-000000000010'),
  0,
  'Nutri B não lê paciente de Nutri A (RLS)'
);

select is(
  (select count(*)::int from public.patient_contracts where id = 'e0000000-0000-0000-0000-000000000051'),
  0,
  'Nutri B não lê contrato de paciente de Nutri A (RLS)'
);

-- 6. cancel_contract / complete_contract (de volta como Nutri A) -----------
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

-- Parcelas do contrato ativo 51: 1 paga (com pagamento), 2 pendentes.
reset role;
insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('e0000000-0000-0000-0000-000000000060', 'e0000000-0000-0000-0000-000000000051', 1, 42920, current_date - 30, 'PAID', now() - interval '30 days'),
  ('e0000000-0000-0000-0000-000000000061', 'e0000000-0000-0000-0000-000000000051', 2, 42920, current_date, 'PENDING', null),
  ('e0000000-0000-0000-0000-000000000062', 'e0000000-0000-0000-0000-000000000051', 3, 42920, current_date + 30, 'OVERDUE', null);
insert into public.payments (id, patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('e0000000-0000-0000-0000-000000000070', 'e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000051', 'e0000000-0000-0000-0000-000000000060', 42920, 'PIX', 'CONFIRMED', now() - interval '30 days');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select lives_ok(
  $$ select public.cancel_contract('e0000000-0000-0000-0000-000000000051') $$,
  'Nutri A cancela o próprio contrato ativo'
);

select is(
  (select array[status::text, (cancelled_at is not null)::text] from public.patient_contracts where id = 'e0000000-0000-0000-0000-000000000051'),
  array['CANCELLED', 'true'],
  'Contrato CANCELLED com cancelled_at'
);

select is(
  (select array_agg(status::text order by number) from public.contract_installments where contract_id = 'e0000000-0000-0000-0000-000000000051'),
  array['PAID', 'CANCELLED', 'CANCELLED'],
  'Parcela paga preservada; pendentes/atrasadas viram CANCELLED (nada apagado)'
);

select is(
  (select count(*)::int from public.payments where contract_id = 'e0000000-0000-0000-0000-000000000051'),
  1,
  'Pagamento do contrato cancelado é preservado'
);

select throws_ok(
  $$ select public.cancel_contract('e0000000-0000-0000-0000-000000000051') $$,
  'INVALID_STATUS_TRANSITION',
  'Cancelar de novo é rejeitado'
);

-- Histórico: trimestral encerrado (50) + semestral cancelado (51) + o novo do
-- paciente 11 continuam todos consultáveis; complete_contract encerra o novo.
select lives_ok(
  $$ select public.complete_contract((select id from public.patient_contracts where patient_id = 'e0000000-0000-0000-0000-000000000011')) $$,
  'complete_contract encerra o contrato ativo'
);

select is(
  (select array_agg(status::text order by start_date) from public.patient_contracts where patient_id = 'e0000000-0000-0000-0000-000000000010'),
  array['COMPLETED', 'CANCELLED'],
  'Histórico do paciente preserva todos os contratos, nenhum sobrescrito'
);

select * from finish();
rollback;
