-- Fase 7 — financeiro no banco: record_manual_payment (parcial, total,
-- a maior, idempotência, ownership), cancel_payment (histórico preservado,
-- parcela reaberta), trigger de lançamentos (não editável quando gerado por
-- pagamento; cancelado é final), RLS entre nutricionistas, consultas x
-- financeiro (concluir/reagendar não geram receita) e previsão por
-- contrato (1200/6x/2 pagas; cancelado => previsto 0).

begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'f7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f7-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f7000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'f7-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('f7000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('f7000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, nutritionist_id, full_name) values
  ('f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000001', 'Paciente de A'),
  ('f7000000-0000-0000-0000-000000000011', 'f7000000-0000-0000-0000-000000000002', 'Paciente de B');

insert into public.plans (id, code, name, duration_months)
values ('f7000000-0000-0000-0000-000000000020', 'SEMESTRAL_F7', 'Semestral (teste F7)', 6);

-- Contrato de R$1.200 em 6x de R$200 (§89): 2 parcelas pagas via pagamentos reais.
insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents)
values ('f7000000-0000-0000-0000-000000000030', 'f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000020', current_date - 60, 'ACTIVE', 120000);

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('f7000000-0000-0000-0000-000000000031', 'f7000000-0000-0000-0000-000000000030', 1, 20000, current_date - 60, 'PAID', now() - interval '60 days'),
  ('f7000000-0000-0000-0000-000000000032', 'f7000000-0000-0000-0000-000000000030', 2, 20000, current_date - 30, 'PAID', now() - interval '30 days'),
  ('f7000000-0000-0000-0000-000000000033', 'f7000000-0000-0000-0000-000000000030', 3, 20000, current_date - 1, 'PENDING', null),
  ('f7000000-0000-0000-0000-000000000034', 'f7000000-0000-0000-0000-000000000030', 4, 20000, current_date + 30, 'PENDING', null),
  ('f7000000-0000-0000-0000-000000000035', 'f7000000-0000-0000-0000-000000000030', 5, 20000, current_date + 60, 'PENDING', null),
  ('f7000000-0000-0000-0000-000000000036', 'f7000000-0000-0000-0000-000000000030', 6, 20000, current_date + 90, 'CANCELLED', null);

insert into public.payments (patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000030', 'f7000000-0000-0000-0000-000000000031', 20000, 'PIX', 'CONFIRMED', now() - interval '60 days'),
  ('f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000030', 'f7000000-0000-0000-0000-000000000032', 20000, 'PIX', 'CONFIRMED', now() - interval '30 days');

-- Parcela cancelada (nº 6) não conta como pendente.
update public.contract_installments set status = 'CANCELLED' where id = 'f7000000-0000-0000-0000-000000000036';

-- Consulta do plano (Nutri A, paciente A), vinculada ao contrato.
insert into public.availability_rules (nutritionist_id, weekday, start_time, end_time, active)
values ('f7000000-0000-0000-0000-000000000001', 1, '08:00', '18:00', true);
insert into public.appointments (id, nutritionist_id, patient_id, contract_id, starts_at, ends_at, modality, status)
values ('f7000000-0000-0000-0000-000000000040', 'f7000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000030', '2027-03-01 10:00-03', '2027-03-01 11:00-03', 'IN_PERSON', 'SCHEDULED');

-- 1. Views: saldo por parcela e previsão por contrato (§89) -------------------
select is(
  (select remaining_cents from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000033'),
  20000, 'Parcela 3 sem pagamento: restante R$200'
);
select is(
  (select remaining_cents from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000036'),
  0, 'Parcela cancelada: restante 0'
);
select is(
  (select array[contracted_amount_cents::int, received_cents::int, pending_cents::int, forecast_cents::int]
   from public.contract_financial_summary where contract_id = 'f7000000-0000-0000-0000-000000000030'),
  array[120000, 40000, 60000, 60000],
  'Contrato 1200 / 6x / 2 pagas / 1 cancelada: contratado 1200, recebido 400, pendente 600, previsto 600'
);

-- 2. Como Nutri A ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'f7000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

-- Pagamento parcial de R$50 na parcela 3 (§79).
select lives_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 5000, 'PIX', now(), 'f7-key-partial', 'f7000000-0000-0000-0000-000000000033') $$,
  'Pagamento parcial de R$50 aceito'
);
select is(
  (select remaining_cents from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000033'),
  15000, 'Restante da parcela após R$50 = R$150'
);
select is(
  (select status::text from public.contract_installments where id = 'f7000000-0000-0000-0000-000000000033'),
  'PENDING', 'Parcela continua PENDING após pagamento parcial (PARTIAL é derivado)'
);
select is(
  (select count(*)::int from public.financial_transactions t join public.payments p on p.id = t.origin_payment_id
   where p.idempotency_key = 'f7-key-partial' and t.type = 'INCOME' and t.status = 'CONFIRMED' and t.amount_cents = 5000),
  1, 'Pagamento gera exatamente 1 lançamento INCOME CONFIRMED com o mesmo valor'
);
select is(
  (select t.patient_id from public.financial_transactions t join public.payments p on p.id = t.origin_payment_id where p.idempotency_key = 'f7-key-partial'),
  'f7000000-0000-0000-0000-000000000010'::uuid, 'Lançamento gerado aponta o paciente'
);

-- Idempotência (§82): mesma chave => mesmo pagamento, nada duplicado.
select is(
  public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 5000, 'PIX', now(), 'f7-key-partial', 'f7000000-0000-0000-0000-000000000033'),
  (select id from public.payments where idempotency_key = 'f7-key-partial'),
  'Reenvio com a mesma chave devolve o mesmo pagamento'
);
select is(
  (select count(*)::int from public.payments where idempotency_key = 'f7-key-partial'),
  1, 'Só existe um pagamento para a chave'
);
select is(
  (select remaining_cents from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000033'),
  15000, 'Restante não muda no reenvio'
);

-- A maior (§81): R$151 em restante de R$150.
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 15100, 'PIX', now(), 'f7-key-over', 'f7000000-0000-0000-0000-000000000033') $$,
  'PAYMENT_EXCEEDS_INSTALLMENT', 'Pagamento acima do restante é recusado'
);
select is((select count(*)::int from public.payments where idempotency_key = 'f7-key-over'), 0, 'Nada gravado quando recusado (atomicidade)');

-- Valor inválido.
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 0, 'PIX', now(), 'f7-key-zero', 'f7000000-0000-0000-0000-000000000033') $$,
  'INVALID_AMOUNT', 'Valor zero é recusado'
);
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', -100, 'PIX', now(), 'f7-key-neg', 'f7000000-0000-0000-0000-000000000033') $$,
  'INVALID_AMOUNT', 'Valor negativo é recusado'
);
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 100, 'PIX', now(), '', 'f7000000-0000-0000-0000-000000000033') $$,
  'VALIDATION_ERROR', 'Chave de idempotência vazia é recusada'
);

-- Parcela cancelada não recebe pagamento.
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 100, 'PIX', now(), 'f7-key-cancelled', 'f7000000-0000-0000-0000-000000000036') $$,
  'INSTALLMENT_NOT_PAYABLE', 'Parcela cancelada não é pagável'
);

-- Total (§80): R$150 quita a parcela.
select lives_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 15000, 'CASH', now(), 'f7-key-rest', 'f7000000-0000-0000-0000-000000000033') $$,
  'Pagamento do restante aceito'
);
select is(
  (select status::text from public.contract_installments where id = 'f7000000-0000-0000-0000-000000000033'),
  'PAID', 'Parcela vira PAID quando o recebido cobre o valor'
);
select is(
  (select remaining_cents from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000033'),
  0, 'Restante 0 após quitação'
);
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 1, 'PIX', now(), 'f7-key-again', 'f7000000-0000-0000-0000-000000000033') $$,
  'INSTALLMENT_NOT_PAYABLE', 'Parcela quitada não aceita mais pagamentos'
);
select is(
  (select array[received_cents::int, pending_cents::int, forecast_cents::int]
   from public.contract_financial_summary where contract_id = 'f7000000-0000-0000-0000-000000000030'),
  array[60000, 40000, 40000],
  'Previsão recalculada: recebido 600, pendente 400, previsto 400'
);

-- Pagamento avulso (sem parcela) de consulta — §33: só quando registrado manualmente.
select lives_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 23000, 'PIX', now(), 'f7-key-appt', null, null, 'f7000000-0000-0000-0000-000000000040') $$,
  'Pagamento vinculado a consulta é aceito'
);
select is(
  (select t.description from public.financial_transactions t join public.payments p on p.id = t.origin_payment_id where p.idempotency_key = 'f7-key-appt'),
  'Consulta — Paciente de A', 'Lançamento descreve a consulta'
);

-- 3. Lançamento gerado por pagamento não é editável; cancelado é final ---------
select throws_ok(
  $$ update public.financial_transactions set amount_cents = 1
     where origin_payment_id = (select id from public.payments where idempotency_key = 'f7-key-rest') $$,
  'FINANCIAL_TRANSACTION_NOT_EDITABLE', 'Valor de lançamento gerado por pagamento não pode ser alterado'
);
select lives_ok(
  $$ update public.financial_transactions set notes = 'obs'
     where origin_payment_id = (select id from public.payments where idempotency_key = 'f7-key-rest') $$,
  'Observação de lançamento gerado por pagamento pode ser alterada'
);

insert into public.financial_transactions (id, nutritionist_id, type, description, amount_cents, status, occurred_on, origin)
values ('f7000000-0000-0000-0000-000000000050', 'f7000000-0000-0000-0000-000000000001', 'EXPENSE', 'Aluguel', 100000, 'CONFIRMED', current_date, 'MANUAL');
select throws_ok(
  $$ insert into public.financial_transactions (nutritionist_id, type, description, amount_cents, status, occurred_on, origin)
     values ('f7000000-0000-0000-0000-000000000001', 'EXPENSE', 'Zero', 0, 'CONFIRMED', current_date, 'MANUAL') $$,
  'INVALID_AMOUNT', 'Lançamento com valor zero é recusado no banco'
);
update public.financial_transactions set status = 'CANCELLED', cancelled_at = now() where id = 'f7000000-0000-0000-0000-000000000050';
select throws_ok(
  $$ update public.financial_transactions set status = 'CONFIRMED' where id = 'f7000000-0000-0000-0000-000000000050' $$,
  'INVALID_STATUS_TRANSITION', 'Lançamento cancelado é final'
);
select throws_ok(
  $$ delete from public.financial_transactions where id = 'f7000000-0000-0000-0000-000000000050' $$,
  '42501', null, 'DELETE em financial_transactions é negado (histórico preservado)'
);

-- 4. Consultas x financeiro (§86–§88) ------------------------------------------
select is(
  (select count(*)::int from public.financial_transactions where nutritionist_id = 'f7000000-0000-0000-0000-000000000001'),
  4, 'Baseline: 3 lançamentos de pagamento + 1 manual'
);
update public.appointments set status = 'COMPLETED' where id = 'f7000000-0000-0000-0000-000000000040';
select is(
  (select count(*)::int from public.financial_transactions where nutritionist_id = 'f7000000-0000-0000-0000-000000000001'),
  4, 'Concluir consulta de plano NÃO gera lançamento'
);
insert into public.appointments (id, nutritionist_id, patient_id, contract_id, starts_at, ends_at, modality, status)
values ('f7000000-0000-0000-0000-000000000041', 'f7000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000010', 'f7000000-0000-0000-0000-000000000030', '2027-03-08 10:00-03', '2027-03-08 11:00-03', 'IN_PERSON', 'SCHEDULED');
select lives_ok(
  $$ select public.reschedule_appointment('f7000000-0000-0000-0000-000000000041', '2027-03-08 14:00-03', '2027-03-08 15:00-03') $$,
  'Reagendamento executa'
);
select is(
  (select count(*)::int from public.financial_transactions where nutritionist_id = 'f7000000-0000-0000-0000-000000000001'),
  4, 'Reagendar NÃO altera a contagem de lançamentos'
);
select is(
  (select count(*)::int from public.payments where patient_id = 'f7000000-0000-0000-0000-000000000010' and status = 'CONFIRMED'),
  5, 'Reagendar/concluir não mexem em pagamentos'
);

-- 5. cancel_payment: histórico preservado, parcela reaberta -------------------
select lives_ok(
  $$ select public.cancel_payment((select id from public.payments where idempotency_key = 'f7-key-rest'), 'erro de digitação') $$,
  'Estorno do pagamento do restante'
);
select is(
  (select status::text from public.payments where idempotency_key = 'f7-key-rest'),
  'REFUNDED', 'Pagamento fica no histórico como estornado (não é apagado)'
);
select is(
  (select array[(select status::text from public.contract_installments where id = 'f7000000-0000-0000-0000-000000000033'),
                (select remaining_cents::text from public.installment_payment_summary where installment_id = 'f7000000-0000-0000-0000-000000000033')]),
  array['PENDING', '15000'],
  'Parcela volta a PENDING com restante R$150 (o parcial de R$50 continua)'
);
select is(
  (select t.status::text from public.financial_transactions t join public.payments p on p.id = t.origin_payment_id where p.idempotency_key = 'f7-key-rest'),
  'CANCELLED', 'Lançamento do pagamento estornado fica CANCELLED'
);
select throws_ok(
  $$ select public.cancel_payment((select id from public.payments where idempotency_key = 'f7-key-rest')) $$,
  'INVALID_STATUS_TRANSITION', 'Estornar duas vezes é recusado'
);

-- 6. Ownership: Nutri B não enxerga nem mexe no financeiro de A ---------------
select set_config('request.jwt.claims', json_build_object('sub', 'f7000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.financial_transactions where nutritionist_id = 'f7000000-0000-0000-0000-000000000001'),
  0, 'Nutri B não lê lançamentos de A (RLS)'
);
select throws_ok(
  $$ select public.record_manual_payment('f7000000-0000-0000-0000-000000000010', 100, 'PIX', now(), 'f7-key-b', 'f7000000-0000-0000-0000-000000000034') $$,
  'PATIENT_NOT_FOUND', 'Nutri B não registra pagamento para paciente de A'
);
select throws_ok(
  $$ select public.cancel_payment((select id from public.payments where idempotency_key = 'f7-key-partial')) $$,
  'PAYMENT_NOT_FOUND', 'Nutri B não estorna pagamento de A (id adulterado => inexistente)'
);

select * from finish();
rollback;
