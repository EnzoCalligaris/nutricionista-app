-- Fase 13 — pagamentos online no banco: criação de cobrança com valor
-- derivado do SALDO da parcela (nunca do cliente), autorização (paciente
-- dono / nutricionista / terceiros negados), uma cobrança ativa por parcela
-- (clique duplo e recarga reaproveitam), expiração, cancelamento,
-- confirmação atômica (payment + baixa da parcela + lançamento + status da
-- cobrança + evento de notificação), idempotência, valor/moeda divergentes,
-- conflito manual x online, evento de webhook único por (provider, id),
-- reconciliação, RLS (paciente vê as suas cobranças e os seus pagamentos;
-- nutricionista as dos seus pacientes; eventos técnicos por ninguém) e
-- privilégios das funções.

begin;
create extension if not exists pgtap with schema extensions;

select plan(72);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'fe000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fe-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fe000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'fe-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fe000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'fe-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'fe000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'fe-patient-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('fe000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('fe000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('fe000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A'),
  ('fe000000-0000-0000-0000-000000000004', 'PATIENT', 'Patient B')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('fe000000-0000-0000-0000-000000000010', 'fe000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-000000000001', 'Patient A (row)'),
  ('fe000000-0000-0000-0000-000000000011', 'fe000000-0000-0000-0000-000000000004', 'fe000000-0000-0000-0000-000000000002', 'Patient B (row)');

insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents)
select 'fe000000-0000-0000-0000-000000000020', 'fe000000-0000-0000-0000-000000000010', id, current_date, 'ACTIVE', 60000 from public.plans order by code limit 1;
insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents)
select 'fe000000-0000-0000-0000-000000000021', 'fe000000-0000-0000-0000-000000000011', id, current_date, 'ACTIVE', 20000 from public.plans order by code limit 1;

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date) values
  ('fe000000-0000-0000-0000-000000000030', 'fe000000-0000-0000-0000-000000000020', 1, 20000, current_date + 5),
  ('fe000000-0000-0000-0000-000000000031', 'fe000000-0000-0000-0000-000000000020', 2, 20000, current_date + 35),
  ('fe000000-0000-0000-0000-000000000032', 'fe000000-0000-0000-0000-000000000020', 3, 20000, current_date + 65),
  ('fe000000-0000-0000-0000-000000000033', 'fe000000-0000-0000-0000-000000000021', 1, 20000, current_date + 5);

-- =====================================================================
-- 1. CRIAÇÃO DA COBRANÇA (valor derivado, autorização, reuso)
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select is(
  (select amount_cents from public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'PIX', 'key-a-1', 'fake')),
  20000,
  'Valor da cobrança vem do saldo da parcela (paciente não escolhe valor)'
);
select is((select count(*)::int from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 1, 'Uma cobrança criada');
select is((select status::text from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 'CREATED', 'Cobrança nasce CREATED (ainda sem provider)');
select is((select nutritionist_id from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 'fe000000-0000-0000-0000-000000000001'::uuid, 'Cobrança carrega o nutricionista dono');
select is((select currency from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 'BRL', 'Moeda é sempre BRL');

-- Mesma chave (clique duplo/retry) e nova chave para a mesma parcela: sempre a MESMA cobrança.
select is(
  (select id from public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'PIX', 'key-a-1', 'fake')),
  (select id from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'),
  'Mesma chave de idempotência devolve a mesma cobrança'
);
select is(
  (select id from public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'PIX', 'key-a-2', 'fake')),
  (select id from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030' and status = 'CREATED'),
  'Recarregar a tela reaproveita a cobrança ativa (não gera Pix novo)'
);
select is((select count(*)::int from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 1, 'Continua UMA cobrança para a parcela');

-- Método diferente: a anterior é cancelada, nunca duas ativas.
select is((select method::text from public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'CARD', 'key-a-3', 'fake')), 'CARD', 'Trocar de método cria a cobrança do novo método');
select is((select count(*)::int from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030' and status in ('CREATED', 'PENDING')), 1, 'Só uma cobrança ativa por parcela');
select is((select count(*)::int from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030' and status = 'CANCELLED'), 1, 'A cobrança anterior foi cancelada (histórico preservado)');

select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000033', 'PIX', 'key-cross', 'fake') $$,
  'PAYMENT_NOT_AUTHORIZED', 'Paciente A não gera cobrança para parcela de outro paciente'
);
select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'CASH', 'key-cash', 'fake') $$,
  'PAYMENT_METHOD_NOT_AVAILABLE', 'Dinheiro não é método de checkout online'
);
select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'PIX', '   ', 'fake') $$,
  'VALIDATION_ERROR', 'Chave de idempotência é obrigatória'
);

-- Nutricionista também pode gerar (§61); paciente B e nutri B não.
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is((select amount_cents from public.create_installment_charge('fe000000-0000-0000-0000-000000000031', 'PIX', 'key-nutri-1', 'fake')), 20000, 'Nutricionista gera cobrança do próprio paciente');
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000032', 'PIX', 'key-nutri-b', 'fake') $$,
  'PAYMENT_NOT_AUTHORIZED', 'Nutri B não gera cobrança para paciente de A'
);
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000032', 'PIX', 'key-patient-b', 'fake') $$,
  'PAYMENT_NOT_AUTHORIZED', 'Paciente B não gera cobrança para parcela de A'
);

-- =====================================================================
-- 2. EXPIRAÇÃO E CANCELAMENTO
-- =====================================================================
reset role;
update public.payment_charges set status = 'PENDING', provider_charge_id = 'fake_ch_a', expires_at = now() + interval '30 minutes'
where installment_id = 'fe000000-0000-0000-0000-000000000030' and status = 'CREATED';

select is(public.expire_payment_charges(), 0, 'Cobrança dentro do prazo não expira');
update public.payment_charges set expires_at = now() - interval '1 minute' where provider_charge_id = 'fake_ch_a';
select is(public.expire_payment_charges(), 1, 'Cobrança vencida expira');
select is((select status::text from public.payment_charges where provider_charge_id = 'fake_ch_a'), 'EXPIRED', 'Status vira EXPIRED');

-- Expirada libera a criação de uma nova (§48).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select status::text from public.create_installment_charge('fe000000-0000-0000-0000-000000000030', 'PIX', 'key-a-4', 'fake')), 'CREATED', 'Depois de expirar, nova cobrança é criada');
select is((select count(*)::int from public.payment_charges where installment_id = 'fe000000-0000-0000-0000-000000000030'), 3, 'Histórico mantém as cobranças anteriores');

select is((select status::text from public.cancel_payment_charge((select id from public.payment_charges where idempotency_key = 'key-a-4'), 'CANCELLED_BY_PATIENT')), 'CANCELLED', 'Paciente cancela a própria cobrança');
select is((select status::text from public.cancel_payment_charge((select id from public.payment_charges where idempotency_key = 'key-a-4'), null)), 'CANCELLED', 'Cancelar de novo é idempotente');
-- Id da cobrança de A guardado fora da RLS: o teste precisa passar um id VÁLIDO
-- para provar que a recusa é de autorização, não de visibilidade.
reset role;
create temporary table charge_ids as select idempotency_key, id from public.payment_charges;
grant select on charge_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.cancel_payment_charge((select id from charge_ids where idempotency_key = 'key-nutri-1'), null) $$,
  'PAYMENT_NOT_AUTHORIZED', 'Paciente B não cancela cobrança de A (id válido, autorização negada)'
);

-- =====================================================================
-- 3. CONFIRMAÇÃO ATÔMICA (payment + parcela + lançamento + evento)
-- =====================================================================
reset role;
update public.payment_charges set status = 'PENDING', provider_charge_id = 'fake_ch_b', expires_at = now() + interval '30 minutes'
where idempotency_key = 'key-nutri-1';

select is(
  public.record_online_payment((select id from public.payment_charges where idempotency_key = 'key-nutri-1'), 'fake_pay_b', 20000, 'BRL', now()),
  'PAID',
  'Webhook confirma o pagamento'
);
select is((select status::text from public.payment_charges where idempotency_key = 'key-nutri-1'), 'PAID', 'Cobrança fica PAID');
select isnt((select payment_id from public.payment_charges where idempotency_key = 'key-nutri-1'), null, 'Cobrança aponta o pagamento gerado');
select is((select count(*)::int from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000031' and status = 'CONFIRMED'), 1, 'Um pagamento CONFIRMED criado');
select is((select provider from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000031'), 'fake', 'Pagamento registra o provider real (não MANUAL)');
select is((select external_id from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000031'), 'fake_pay_b', 'Id externo do provider guardado');
select is((select status::text from public.contract_installments where id = 'fe000000-0000-0000-0000-000000000031'), 'PAID', 'Parcela quitada');
select is((select count(*)::int from public.financial_transactions where origin = 'PAYMENT' and origin_payment_id = (select payment_id from public.payment_charges where idempotency_key = 'key-nutri-1')), 1, 'Um lançamento INCOME criado');
select is((select type::text from public.financial_transactions where origin_payment_id = (select payment_id from public.payment_charges where idempotency_key = 'key-nutri-1')), 'INCOME', 'Lançamento é receita');
select is((select nutritionist_id from public.financial_transactions where origin_payment_id = (select payment_id from public.payment_charges where idempotency_key = 'key-nutri-1')), 'fe000000-0000-0000-0000-000000000001'::uuid, 'Lançamento pertence ao nutricionista dono');
select is((select count(*)::int from public.notification_events where event_type = 'PAYMENT_CONFIRMED' and patient_id = 'fe000000-0000-0000-0000-000000000010'), 1, 'Evento PAYMENT_CONFIRMED enfileirado na mesma transação');
select is((select payload ? 'method' from public.notification_events where event_type = 'PAYMENT_CONFIRMED' and patient_id = 'fe000000-0000-0000-0000-000000000010'), true, 'Payload do aviso tem só valor/método/ids');

-- Repetição do mesmo evento: nenhum efeito financeiro novo (§41/§109).
select is(
  public.record_online_payment((select id from public.payment_charges where idempotency_key = 'key-nutri-1'), 'fake_pay_b', 20000, 'BRL', now()),
  'ALREADY_PAID',
  'Confirmar de novo é idempotente'
);
select is((select count(*)::int from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000031'), 1, 'Continua UM pagamento');
select is((select count(*)::int from public.financial_transactions where origin_payment_id is not null and origin_payment_id = (select payment_id from public.payment_charges where idempotency_key = 'key-nutri-1')), 1, 'Continua UM lançamento');

-- =====================================================================
-- 4. DIVERGÊNCIAS: valor, moeda, parcela já quitada
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is((select amount_cents from public.create_installment_charge('fe000000-0000-0000-0000-000000000032', 'PIX', 'key-a-5', 'fake')), 20000, 'Nova cobrança para a parcela 3');
reset role;
update public.payment_charges set status = 'PENDING', provider_charge_id = 'fake_ch_c' where idempotency_key = 'key-a-5';

select is(
  public.record_online_payment((select id from public.payment_charges where idempotency_key = 'key-a-5'), 'fake_pay_c', 19900, 'BRL', now()),
  'AMOUNT_MISMATCH',
  'Valor divergente NÃO confirma (R$ 199 para cobrança de R$ 200)'
);
select is((select status::text from public.payment_charges where idempotency_key = 'key-a-5'), 'PENDING', 'Cobrança continua pendente após divergência de valor');
select is((select count(*)::int from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000032'), 0, 'Nenhum pagamento criado com valor divergente');
select is(
  public.record_online_payment((select id from public.payment_charges where idempotency_key = 'key-a-5'), 'fake_pay_c', 20000, 'USD', now()),
  'CURRENCY_MISMATCH',
  'Moeda divergente NÃO confirma'
);
select is((select count(*)::int from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000032'), 0, 'Nenhum pagamento criado com moeda divergente');

-- Conflito manual x online (§52/§114): o nutricionista recebe no caixa antes do webhook.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select isnt(public.record_manual_payment('fe000000-0000-0000-0000-000000000010', 20000, 'CASH', now(), 'manual-key-1', 'fe000000-0000-0000-0000-000000000032'), null, 'Pagamento manual quita a parcela 3');
reset role;
select is((select status::text from public.contract_installments where id = 'fe000000-0000-0000-0000-000000000032'), 'PAID', 'Parcela 3 quitada no caixa');
select is(
  public.record_online_payment((select id from public.payment_charges where idempotency_key = 'key-a-5'), 'fake_pay_c', 20000, 'BRL', now()),
  'INSTALLMENT_ALREADY_SETTLED',
  'Webhook posterior NÃO duplica receita de parcela já quitada'
);
select is((select count(*)::int from public.payments where installment_id = 'fe000000-0000-0000-0000-000000000032' and status = 'CONFIRMED'), 1, 'Continua UM pagamento na parcela 3 (o manual)');
select is(
  (select count(*)::int from public.financial_transactions t join public.payments p on p.id = t.origin_payment_id where p.installment_id = 'fe000000-0000-0000-0000-000000000032' and t.status = 'CONFIRMED'),
  1,
  'Continua UM lançamento para a parcela 3'
);

-- Cobrança paga não gera nova cobrança para a parcela quitada.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select public.create_installment_charge('fe000000-0000-0000-0000-000000000031', 'PIX', 'key-paid', 'fake') $$,
  'PAYMENT_ALREADY_PAID', 'Parcela paga não aceita nova cobrança'
);
reset role;

-- =====================================================================
-- 5. EVENTOS DE WEBHOOK E RECONCILIAÇÃO
-- =====================================================================
insert into public.payment_webhook_events (provider, provider_event_id, event_type, provider_charge_id, summary)
values ('fake', 'evt-1', 'payment.updated', 'fake_ch_b', '{"status":"PAID"}'::jsonb);
select throws_ok(
  $$ insert into public.payment_webhook_events (provider, provider_event_id, event_type) values ('fake', 'evt-1', 'payment.updated') $$,
  '23505', null, 'Mesmo evento do mesmo provider nunca é registrado duas vezes'
);
insert into public.payment_webhook_events (provider, provider_event_id, event_type) values ('outro', 'evt-1', 'payment.updated');
select is((select count(*)::int from public.payment_webhook_events where provider_event_id = 'evt-1'), 2, 'Ids iguais de providers diferentes coexistem');
select is((select summary ? 'card_number' from public.payment_webhook_events where provider = 'fake' and provider_event_id = 'evt-1'), false, 'Resumo do evento não guarda dado de cartão');

insert into public.payment_reconciliation_items (nutritionist_id, patient_id, charge_id, kind, detail)
values ('fe000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000010', (select id from public.payment_charges where idempotency_key = 'key-a-5'), 'AMOUNT_MISMATCH', '{"expected_amount_cents":20000}'::jsonb);
select throws_ok(
  $$ insert into public.payment_reconciliation_items (nutritionist_id, patient_id, charge_id, kind) values ('fe000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000010', (select id from public.payment_charges where idempotency_key = 'key-a-5'), 'AMOUNT_MISMATCH') $$,
  '23505', null, 'A mesma divergência aberta não duplica'
);
select throws_ok(
  $$ insert into public.payment_reconciliation_items (nutritionist_id, kind, status) values ('fe000000-0000-0000-0000-000000000001', 'AMOUNT_MISMATCH', 'RESOLVED') $$,
  '23514', null, 'Item resolvido precisa de data de resolução'
);

-- =====================================================================
-- 6. RLS E PRIVILÉGIOS
-- =====================================================================
set local role authenticated;
-- Paciente A: vê as próprias cobranças e os próprios pagamentos; nada de terceiros.
select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select ok((select count(*) from public.payment_charges) >= 3, 'Paciente A vê as próprias cobranças');
select is((select count(*)::int from public.payment_charges where patient_id <> 'fe000000-0000-0000-0000-000000000010'), 0, 'Paciente A não vê cobrança de outro paciente');
select ok((select count(*) from public.payments where patient_id = 'fe000000-0000-0000-0000-000000000010') >= 1, 'Paciente A vê os próprios pagamentos (portal financeiro)');
select is((select count(*)::int from public.payment_webhook_events), 0, 'Paciente não lê eventos técnicos do provider');
select is((select count(*)::int from public.payment_reconciliation_items), 0, 'Paciente não lê itens de reconciliação');
select throws_ok(
  $$ insert into public.payment_charges (patient_id, nutritionist_id, provider, method, amount_cents, idempotency_key) values ('fe000000-0000-0000-0000-000000000010', 'fe000000-0000-0000-0000-000000000001', 'fake', 'PIX', 1, 'forjada') $$,
  '42501', null, 'Paciente não cria cobrança direto na tabela (só pela função)'
);
select throws_ok(
  $$ select public.record_online_payment((select id from public.payment_charges limit 1), 'x', 1, 'BRL', now()) $$,
  '42501', null, 'Confirmação de pagamento é exclusiva do service role'
);
select throws_ok(
  $$ select public.expire_payment_charges() $$,
  '42501', null, 'Expiração é exclusiva do service role'
);

select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.payment_charges where patient_id = 'fe000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê cobranças de A');
select is((select count(*)::int from public.payments where patient_id = 'fe000000-0000-0000-0000-000000000010'), 0, 'Paciente B não vê pagamentos de A');

select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.payment_charges where nutritionist_id = 'fe000000-0000-0000-0000-000000000001'), 0, 'Nutri B não vê cobranças de A');
select is((select count(*)::int from public.payment_reconciliation_items), 0, 'Nutri B não vê divergências de A');

select set_config('request.jwt.claims', json_build_object('sub', 'fe000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select ok((select count(*) from public.payment_reconciliation_items) >= 1, 'Nutri A vê as próprias divergências');
update public.payment_reconciliation_items set status = 'RESOLVED', resolved_at = now(), resolved_by = 'fe000000-0000-0000-0000-000000000001'
where nutritionist_id = 'fe000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.payment_reconciliation_items where status = 'OPEN'), 0, 'Nutri A resolve a própria divergência');
-- Sem policy de UPDATE, a linha simplesmente não é alcançada (0 linhas afetadas).
update public.payment_charges set status = 'PAID' where idempotency_key = 'key-a-5';
reset role;
select is((select status::text from public.payment_charges where idempotency_key = 'key-a-5'), 'PENDING', 'Nutricionista não marca cobrança como paga pela API (update sem efeito)');

select * from finish();
rollback;
