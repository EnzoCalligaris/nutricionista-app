-- Testa constraints críticas de integridade (prompt Fase 2 §50).
-- Cada teste roda dentro de uma transação que é revertida no final —
-- nenhum dado de fixture permanece no banco depois.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Fixtures ------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'a-nutri@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}');
insert into public.profiles (id, role, full_name) values ('a0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'A Nutri');

insert into public.patients (id, nutritionist_id, full_name)
values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'A Patient');

insert into public.plans (id, code, name)
values ('a0000000-0000-0000-0000-000000000003', 'TESTE', 'Plano de Teste');

insert into public.patient_contracts (id, patient_id, plan_id, start_date, contracted_amount_cents)
values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', current_date, 120000);

insert into public.meal_plans (id, patient_id, nutritionist_id)
values ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001');

-- 1) plan_prices: só um preço "primário" ativo por plano ---------------
insert into public.plan_prices (plan_id, label, amount_cents, payment_type, is_primary, active)
values ('a0000000-0000-0000-0000-000000000003', 'Preço A', 10000, 'AVISTA', true, true);

select throws_ok(
  $$insert into public.plan_prices (plan_id, label, amount_cents, payment_type, is_primary, active)
    values ('a0000000-0000-0000-0000-000000000003', 'Preço B', 20000, 'AVISTA', true, true)$$,
  '23505',
  null,
  'plan_prices: não permite dois preços primários ativos no mesmo plano'
);

-- 2) contract_installments: unique(contract_id, number) ----------------
insert into public.contract_installments (contract_id, number, amount_cents, due_date)
values ('a0000000-0000-0000-0000-000000000004', 1, 20000, current_date + 30);

select throws_ok(
  $$insert into public.contract_installments (contract_id, number, amount_cents, due_date)
    values ('a0000000-0000-0000-0000-000000000004', 1, 20000, current_date + 60)$$,
  '23505',
  null,
  'contract_installments: número de parcela duplicado no mesmo contrato é rejeitado'
);

-- 3) payments: idempotência por (provider, external_id) -----------------
insert into public.payments (patient_id, contract_id, provider, external_id, amount_cents, method, status)
values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'STRIPE', 'ext-123', 20000, 'PIX', 'CONFIRMED');

select throws_ok(
  $$insert into public.payments (patient_id, contract_id, provider, external_id, amount_cents, method, status)
    values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'STRIPE', 'ext-123', 20000, 'PIX', 'CONFIRMED')$$,
  '23505',
  null,
  'payments: mesmo provider+external_id não gera duas linhas (idempotência de webhook)'
);

-- 4) financial_transactions: um payment não gera duas transações --------
insert into public.financial_transactions (type, description, amount_cents, origin, origin_payment_id)
select 'INCOME', 'Pagamento parcela 1', 20000, 'PAYMENT', id from public.payments
where provider = 'STRIPE' and external_id = 'ext-123';

select throws_ok(
  $$insert into public.financial_transactions (type, description, amount_cents, origin, origin_payment_id)
    select 'INCOME', 'Duplicata indevida', 20000, 'PAYMENT', id from public.payments
    where provider = 'STRIPE' and external_id = 'ext-123'$$,
  '23505',
  null,
  'financial_transactions: origin_payment_id único — sem dupla contabilização'
);

-- 5) meal_plan_versions: só uma versão PUBLISHED por cardápio ------------
insert into public.meal_plan_versions (meal_plan_id, version_number, status, published_at)
values ('a0000000-0000-0000-0000-000000000005', 1, 'PUBLISHED', now());

select throws_ok(
  $$insert into public.meal_plan_versions (meal_plan_id, version_number, status, published_at)
    values ('a0000000-0000-0000-0000-000000000005', 2, 'PUBLISHED', now())$$,
  '23505',
  null,
  'meal_plan_versions: não permite duas versões PUBLISHED no mesmo cardápio'
);

-- 6) before_after_results: nunca publica sem consentimento ---------------
select throws_ok(
  $$insert into public.before_after_results (title, before_path, after_path, published)
    values ('Resultado sem consentimento', 'x/before.jpg', 'x/after.jpg', true)$$,
  '23514',
  null,
  'before_after_results: published=true sem media_consent_id é rejeitado pelo check constraint'
);

select * from finish();
rollback;
