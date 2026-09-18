-- Regra financeira do prompt Fase 2 §56: contrato de R$1.200 em 6 parcelas
-- de R$200, 2 pagas -> contratado=1200, recebido=400, pendente=800,
-- previsto=800. NUNCA registrar o total do contrato como receita de uma vez.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'd-nutri@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');
insert into public.profiles (id, role, full_name) values ('d0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'D Nutri')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, nutritionist_id, full_name)
values ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'D Patient');

insert into public.plans (id, code, name, duration_months)
values ('d0000000-0000-0000-0000-000000000003', 'SEMESTRAL_TESTE', 'Semestral (teste)', 6);

insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents)
values ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', current_date, 'ACTIVE', 120000);

-- 6 parcelas de R$200 (20000 centavos).
insert into public.contract_installments (contract_id, number, amount_cents, due_date, status, paid_at)
values
  ('d0000000-0000-0000-0000-000000000004', 1, 20000, current_date - 60, 'PAID', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-000000000004', 2, 20000, current_date - 30, 'PAID', now() - interval '30 days'),
  ('d0000000-0000-0000-0000-000000000004', 3, 20000, current_date, 'PENDING', null),
  ('d0000000-0000-0000-0000-000000000004', 4, 20000, current_date + 30, 'PENDING', null),
  ('d0000000-0000-0000-0000-000000000004', 5, 20000, current_date + 60, 'PENDING', null),
  ('d0000000-0000-0000-0000-000000000004', 6, 20000, current_date + 90, 'PENDING', null);

-- 2 pagamentos confirmados (R$200 cada = R$400 recebido).
insert into public.payments (patient_id, contract_id, amount_cents, method, status, paid_at)
values
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 20000, 'PIX', 'CONFIRMED', now() - interval '60 days'),
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 20000, 'PIX', 'CONFIRMED', now() - interval '30 days');

select is(
  (select contracted_amount_cents::int from public.contract_financial_summary where contract_id = 'd0000000-0000-0000-0000-000000000004'),
  120000,
  'Contratado = R$1.200,00 (120000 centavos)'
);

select is(
  (select received_cents::int from public.contract_financial_summary where contract_id = 'd0000000-0000-0000-0000-000000000004'),
  40000,
  'Recebido = R$400,00 (2 parcelas pagas) — NÃO o valor total do contrato'
);

select is(
  (select pending_cents::int from public.contract_financial_summary where contract_id = 'd0000000-0000-0000-0000-000000000004'),
  80000,
  'Pendente = R$800,00 (4 parcelas ainda não pagas)'
);

select is(
  (select forecast_cents::int from public.contract_financial_summary where contract_id = 'd0000000-0000-0000-0000-000000000004'),
  80000,
  'Previsto = R$800,00 (contrato ainda ACTIVE)'
);

-- Contrato cancelado não projeta previsão de receita futura.
update public.patient_contracts set status = 'CANCELLED', cancelled_at = now()
where id = 'd0000000-0000-0000-0000-000000000004';

select is(
  (select forecast_cents::int from public.contract_financial_summary where contract_id = 'd0000000-0000-0000-0000-000000000004'),
  0,
  'Previsto cai para R$0,00 quando o contrato é cancelado (pendente continua existindo como histórico)'
);

select * from finish();
rollback;
