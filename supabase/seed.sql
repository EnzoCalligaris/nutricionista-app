-- Seed de DESENVOLVIMENTO LOCAL. Todos os nomes, e-mails e dados abaixo são
-- fictícios (nenhum dado real de ./references é usado — prompt Fase 2 §47).
-- Rodado automaticamente por `supabase db reset` / `npm run db:reset`.
--
-- Usuários fictícios com login (nutricionista + 2 pacientes) usam a senha
-- de desenvolvimento "NutricaoDev123" — válida SÓ no ambiente local, nunca
-- em produção (prompt Fase 2 §48).
--
-- Desde a Fase 3, todo insert em auth.users dispara o trigger
-- `on_auth_user_created` (ver migration de provisionamento de profiles), que
-- já cria um profile PATIENT automaticamente. Por isso os inserts em
-- public.profiles abaixo usam `on conflict (id) do update` em vez de um
-- insert simples — sem isso, o insert explícito (ex.: promovendo a
-- NUTRITIONIST) colidiria com a linha já criada pelo trigger.

-- Nutricionista fictício ---------------------------------------------------
-- confirmation_token/recovery_token/email_change_token_new/email_change
-- precisam ser '' (nunca NULL) mesmo fora do fluxo real de signup: o
-- GoTrue faz Scan dessas colunas como string não-anulável, e elas não têm
-- DEFAULT no schema do Supabase Auth (docs/DECISIONS.md, Fase 3 — só
-- descoberto ao testar login de verdade pela primeira vez).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'dev-nutricionista@example.test',
  crypt('NutricaoDev123', gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
);

insert into public.profiles (id, role, full_name) values
  ('90000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutricionista Demo (dev)')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Pacientes fictícios com login (Fulana e Beltrano) ------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000101',
   'authenticated', 'authenticated', 'fulana.detal@example.test', crypt('NutricaoDev123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000102',
   'authenticated', 'authenticated', 'beltrano.dasilva@example.test', crypt('NutricaoDev123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('90000000-0000-0000-0000-000000000101', 'PATIENT', 'Fulana de Tal'),
  ('90000000-0000-0000-0000-000000000102', 'PATIENT', 'Beltrano da Silva')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

-- Pacientes ------------------------------------------------------------
-- Fulana e Beltrano têm profile_id (login ativo). Sicrana, Ciclano e Fulano
-- Neto ainda não ativaram conta — cadastro manual, profile_id nulo
-- (cenário comum: paciente cadastrado antes de existir portal — Fase 3).
insert into public.patients (id, profile_id, nutritionist_id, full_name, email, phone, birth_date, status) values
  ('90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000001',
   'Fulana de Tal', 'fulana.detal@example.test', '+55 11 90000-0001', '1992-03-14', 'ACTIVE'),
  ('90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000001',
   'Beltrano da Silva', 'beltrano.dasilva@example.test', '+55 11 90000-0002', '1988-07-22', 'ACTIVE'),
  ('90000000-0000-0000-0000-000000000012', null, '90000000-0000-0000-0000-000000000001',
   'Sicrana Pereira', 'sicrana.pereira@example.test', '+55 11 90000-0003', '1995-11-02', 'ACTIVE'),
  ('90000000-0000-0000-0000-000000000013', null, '90000000-0000-0000-0000-000000000001',
   'Ciclano Souza', 'ciclano.souza@example.test', '+55 11 90000-0004', '1980-01-30', 'INACTIVE'),
  ('90000000-0000-0000-0000-000000000014', null, '90000000-0000-0000-0000-000000000001',
   'Fulano de Tal Neto', 'fulano.detalneto@example.test', '+55 11 90000-0005', '1975-09-09', 'ACTIVE');

update public.patients set archived_at = now() - interval '10 days'
where id = '90000000-0000-0000-0000-000000000013';

-- Categorias financeiras -------------------------------------------------
insert into public.financial_categories (id, name, type) values
  ('90000000-0000-0000-0000-000000000201', 'Mensalidades e consultas', 'INCOME'),
  ('90000000-0000-0000-0000-000000000202', 'Despesas administrativas', 'EXPENSE');

-- Contrato 1: Fulana de Tal — TRIMESTRAL ativo, 2 de 3 parcelas pagas -------
insert into public.patient_contracts (id, patient_id, plan_id, plan_price_id, start_date, end_date, status, contracted_amount_cents)
select '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000010', p.id, pp.id,
  current_date - interval '40 days', current_date + interval '50 days', 'ACTIVE', 68037
from public.plans p
join public.plan_prices pp on pp.plan_id = p.id and pp.label = 'Parcelado 3x de R$226,79'
where p.code = 'TRIMESTRAL';

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('90000000-0000-0000-0000-000000000311', '90000000-0000-0000-0000-000000000301', 1, 22679, current_date - interval '40 days', 'PAID', now() - interval '40 days'),
  ('90000000-0000-0000-0000-000000000312', '90000000-0000-0000-0000-000000000301', 2, 22679, current_date - interval '10 days', 'PAID', now() - interval '10 days'),
  ('90000000-0000-0000-0000-000000000313', '90000000-0000-0000-0000-000000000301', 3, 22679, current_date + interval '20 days', 'PENDING', null);

insert into public.payments (id, patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('90000000-0000-0000-0000-000000000321', '90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000311', 22679, 'PIX', 'CONFIRMED', now() - interval '40 days'),
  ('90000000-0000-0000-0000-000000000322', '90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000301', '90000000-0000-0000-0000-000000000312', 22679, 'PIX', 'CONFIRMED', now() - interval '10 days');

insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Parcela 1/3 — Fulana de Tal', 22679, (now() - interval '40 days')::date, 'PIX', 'PAYMENT', id, '90000000-0000-0000-0000-000000000001'
from public.payments where id = '90000000-0000-0000-0000-000000000321';
insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Parcela 2/3 — Fulana de Tal', 22679, (now() - interval '10 days')::date, 'PIX', 'PAYMENT', id, '90000000-0000-0000-0000-000000000001'
from public.payments where id = '90000000-0000-0000-0000-000000000322';

-- Contrato 2: Beltrano da Silva — SEMESTRAL ativo, 3 de 6 parcelas pagas ---
insert into public.patient_contracts (id, patient_id, plan_id, plan_price_id, start_date, end_date, status, contracted_amount_cents)
select '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000011', p.id, pp.id,
  current_date - interval '70 days', current_date + interval '110 days', 'ACTIVE', 128760
from public.plans p
join public.plan_prices pp on pp.plan_id = p.id and pp.label = 'Parcelado 6x de R$214,60'
where p.code = 'SEMESTRAL';

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('90000000-0000-0000-0000-000000000331', '90000000-0000-0000-0000-000000000302', 1, 21460, current_date - interval '70 days', 'PAID', now() - interval '70 days'),
  ('90000000-0000-0000-0000-000000000332', '90000000-0000-0000-0000-000000000302', 2, 21460, current_date - interval '40 days', 'PAID', now() - interval '40 days'),
  ('90000000-0000-0000-0000-000000000333', '90000000-0000-0000-0000-000000000302', 3, 21460, current_date - interval '10 days', 'PAID', now() - interval '10 days'),
  ('90000000-0000-0000-0000-000000000334', '90000000-0000-0000-0000-000000000302', 4, 21460, current_date + interval '20 days', 'PENDING', null),
  ('90000000-0000-0000-0000-000000000335', '90000000-0000-0000-0000-000000000302', 5, 21460, current_date + interval '50 days', 'PENDING', null),
  ('90000000-0000-0000-0000-000000000336', '90000000-0000-0000-0000-000000000302', 6, 21460, current_date + interval '80 days', 'PENDING', null);

insert into public.payments (id, patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('90000000-0000-0000-0000-000000000341', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000331', 21460, 'CARD', 'CONFIRMED', now() - interval '70 days'),
  ('90000000-0000-0000-0000-000000000342', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000332', 21460, 'CARD', 'CONFIRMED', now() - interval '40 days'),
  ('90000000-0000-0000-0000-000000000343', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000302', '90000000-0000-0000-0000-000000000333', 21460, 'CARD', 'CONFIRMED', now() - interval '10 days');

insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Parcela ' || ci.number || '/6 — Beltrano da Silva', pay.amount_cents, pay.paid_at::date, 'CARD', 'PAYMENT', pay.id, '90000000-0000-0000-0000-000000000001'
from public.payments pay
join public.contract_installments ci on ci.id = pay.installment_id
where pay.contract_id = '90000000-0000-0000-0000-000000000302';

-- Contrato 3: Sicrana Pereira — AVULSA, paga e concluída -------------------
insert into public.patient_contracts (id, patient_id, plan_id, plan_price_id, start_date, end_date, status, contracted_amount_cents)
select '90000000-0000-0000-0000-000000000303', '90000000-0000-0000-0000-000000000012', p.id, pp.id,
  current_date - interval '5 days', current_date - interval '5 days', 'COMPLETED', 23000
from public.plans p
join public.plan_prices pp on pp.plan_id = p.id and pp.is_primary = true
where p.code = 'AVULSA';

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('90000000-0000-0000-0000-000000000351', '90000000-0000-0000-0000-000000000303', 1, 23000, current_date - interval '5 days', 'PAID', now() - interval '5 days');

insert into public.payments (id, patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('90000000-0000-0000-0000-000000000352', '90000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000303', '90000000-0000-0000-0000-000000000351', 23000, 'PIX', 'CONFIRMED', now() - interval '5 days');

insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Consulta avulsa — Sicrana Pereira', 23000, (now() - interval '5 days')::date, 'PIX', 'PAYMENT', id, '90000000-0000-0000-0000-000000000001'
from public.payments where id = '90000000-0000-0000-0000-000000000352';

-- Contrato 4: Ciclano Souza — TRIMESTRAL cancelado (paciente inativo) ------
insert into public.patient_contracts (id, patient_id, plan_id, start_date, end_date, status, contracted_amount_cents, cancelled_at)
select '90000000-0000-0000-0000-000000000304', '90000000-0000-0000-0000-000000000013', id,
  current_date - interval '100 days', current_date - interval '10 days', 'CANCELLED', 68037, now() - interval '10 days'
from public.plans where code = 'TRIMESTRAL';

insert into public.contract_installments (id, contract_id, number, amount_cents, due_date, status, paid_at) values
  ('90000000-0000-0000-0000-000000000361', '90000000-0000-0000-0000-000000000304', 1, 22679, current_date - interval '100 days', 'PAID', now() - interval '100 days'),
  ('90000000-0000-0000-0000-000000000362', '90000000-0000-0000-0000-000000000304', 2, 22679, current_date - interval '70 days', 'CANCELLED', null),
  ('90000000-0000-0000-0000-000000000363', '90000000-0000-0000-0000-000000000304', 3, 22679, current_date - interval '40 days', 'CANCELLED', null);

insert into public.payments (id, patient_id, contract_id, installment_id, amount_cents, method, status, paid_at) values
  ('90000000-0000-0000-0000-000000000364', '90000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000304', '90000000-0000-0000-0000-000000000361', 22679, 'PIX', 'CONFIRMED', now() - interval '100 days');

insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Parcela 1/3 — Ciclano Souza (contrato depois cancelado)', 22679, (now() - interval '100 days')::date, 'PIX', 'PAYMENT', id, '90000000-0000-0000-0000-000000000001'
from public.payments where id = '90000000-0000-0000-0000-000000000364';

-- Contrato 5: Fulano de Tal Neto — ANUAL histórico, já concluído -----------
insert into public.patient_contracts (id, patient_id, plan_id, plan_price_id, start_date, end_date, status, contracted_amount_cents)
select '90000000-0000-0000-0000-000000000305', '90000000-0000-0000-0000-000000000014', p.id, pp.id,
  current_date - interval '400 days', current_date - interval '35 days', 'COMPLETED', 192000
from public.plans p
join public.plan_prices pp on pp.plan_id = p.id and pp.label = 'À vista'
where p.code = 'ANUAL';

insert into public.payments (id, patient_id, contract_id, amount_cents, method, status, paid_at) values
  ('90000000-0000-0000-0000-000000000371', '90000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000305', 192000, 'BANK_TRANSFER', 'CONFIRMED', now() - interval '400 days');

insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, origin_payment_id, created_by)
select 'INCOME', '90000000-0000-0000-0000-000000000201', 'Plano anual à vista — Fulano de Tal Neto (histórico)', 192000, (now() - interval '400 days')::date, 'BANK_TRANSFER', 'PAYMENT', id, '90000000-0000-0000-0000-000000000001'
from public.payments where id = '90000000-0000-0000-0000-000000000371';

-- despesa manual de exemplo -------------------------------------------------
insert into public.financial_transactions (type, category_id, description, amount_cents, occurred_on, payment_method, origin, created_by)
values ('EXPENSE', '90000000-0000-0000-0000-000000000202', 'Assinatura de software de gestão (exemplo)', 15000, current_date - interval '3 days', 'CARD', 'MANUAL', '90000000-0000-0000-0000-000000000001');

-- Consultas ---------------------------------------------------------------
insert into public.appointments (id, nutritionist_id, patient_id, contract_id, starts_at, ends_at, modality, status, amount_cents) values
  ('90000000-0000-0000-0000-000000000401', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000301',
   now() - interval '40 days', now() - interval '40 days' + interval '50 minutes', 'IN_PERSON', 'COMPLETED', 22679),
  ('90000000-0000-0000-0000-000000000402', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000301',
   now() + interval '5 days', now() + interval '5 days' + interval '50 minutes', 'ONLINE', 'SCHEDULED', 22679),
  ('90000000-0000-0000-0000-000000000403', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000302',
   now() - interval '10 days', now() - interval '10 days' + interval '50 minutes', 'IN_PERSON', 'COMPLETED', 21460),
  ('90000000-0000-0000-0000-000000000404', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000302',
   now() + interval '15 days', now() + interval '15 days' + interval '50 minutes', 'IN_PERSON', 'CONFIRMED', 21460),
  ('90000000-0000-0000-0000-000000000405', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000303',
   now() - interval '5 days', now() - interval '5 days' + interval '50 minutes', 'IN_PERSON', 'COMPLETED', 23000);

insert into public.appointment_notes (patient_id, appointment_id, author_id, content) values
  ('90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000401', '90000000-0000-0000-0000-000000000001',
   'Primeira consulta (dado fictício de seed). Paciente relata rotina agitada durante a semana; combinamos planejamento com preparo em lote aos domingos.');

-- Cardápio (Fulana de Tal) — 3 dias ilustrativos, não a semana inteira -----
insert into public.meal_plans (id, patient_id, nutritionist_id, title) values
  ('90000000-0000-0000-0000-000000000501', '90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000001', 'Cardápio — Fulana de Tal');

insert into public.meal_plan_versions (id, meal_plan_id, version_number, status, published_at, created_by) values
  ('90000000-0000-0000-0000-000000000510', '90000000-0000-0000-0000-000000000501', 1, 'PUBLISHED', now() - interval '30 days', '90000000-0000-0000-0000-000000000001');

-- weekday: 1 = segunda, 3 = quarta, 5 = sexta
insert into public.meal_plan_days (id, version_id, weekday) values
  ('90000000-0000-0000-0000-000000000511', '90000000-0000-0000-0000-000000000510', 1),
  ('90000000-0000-0000-0000-000000000512', '90000000-0000-0000-0000-000000000510', 3),
  ('90000000-0000-0000-0000-000000000513', '90000000-0000-0000-0000-000000000510', 5);

insert into public.meals (id, day_id, name, time_of_day, sort_order) values
  ('90000000-0000-0000-0000-000000000521', '90000000-0000-0000-0000-000000000511', 'Café da manhã', '07:30', 1),
  ('90000000-0000-0000-0000-000000000522', '90000000-0000-0000-0000-000000000511', 'Almoço', '12:30', 2),
  ('90000000-0000-0000-0000-000000000523', '90000000-0000-0000-0000-000000000511', 'Jantar', '20:00', 3),
  ('90000000-0000-0000-0000-000000000524', '90000000-0000-0000-0000-000000000512', 'Café da manhã', '07:30', 1),
  ('90000000-0000-0000-0000-000000000525', '90000000-0000-0000-0000-000000000512', 'Almoço', '12:30', 2),
  ('90000000-0000-0000-0000-000000000526', '90000000-0000-0000-0000-000000000513', 'Café da manhã', '07:30', 1);

insert into public.meal_items (id, meal_id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, sort_order) values
  ('90000000-0000-0000-0000-000000000531', '90000000-0000-0000-0000-000000000521', 'Ovos mexidos', 2, 'unidade', 140, 12, 1, 10, 1),
  ('90000000-0000-0000-0000-000000000532', '90000000-0000-0000-0000-000000000521', 'Pão integral', 1, 'fatia', 70, 3, 12, 1, 2),
  ('90000000-0000-0000-0000-000000000533', '90000000-0000-0000-0000-000000000522', 'Arroz branco', 100, 'g', 130, 2, 28, 0, 1),
  ('90000000-0000-0000-0000-000000000534', '90000000-0000-0000-0000-000000000522', 'Frango grelhado', 120, 'g', 200, 37, 0, 5, 2),
  ('90000000-0000-0000-0000-000000000535', '90000000-0000-0000-0000-000000000522', 'Salada de folhas verdes', 80, 'g', 15, 1, 3, 0, 3),
  ('90000000-0000-0000-0000-000000000536', '90000000-0000-0000-0000-000000000523', 'Sopa de legumes', 300, 'ml', 150, 6, 20, 4, 1),
  ('90000000-0000-0000-0000-000000000537', '90000000-0000-0000-0000-000000000524', 'Iogurte natural', 170, 'g', 100, 6, 8, 4, 1),
  ('90000000-0000-0000-0000-000000000538', '90000000-0000-0000-0000-000000000524', 'Granola', 30, 'g', 120, 3, 18, 4, 2),
  ('90000000-0000-0000-0000-000000000539', '90000000-0000-0000-0000-000000000525', 'Salmão grelhado', 120, 'g', 230, 25, 0, 14, 1),
  ('90000000-0000-0000-0000-00000000053a', '90000000-0000-0000-0000-000000000525', 'Batata doce', 150, 'g', 130, 2, 30, 0, 2),
  ('90000000-0000-0000-0000-00000000053b', '90000000-0000-0000-0000-000000000526', 'Vitamina de banana com aveia', 300, 'ml', 220, 7, 35, 5, 1);

insert into public.meal_substitutions (meal_item_id, substitute_food_name, quantity, unit, calories, protein_g, carbs_g, fat_g) values
  ('90000000-0000-0000-0000-000000000534', 'Peixe grelhado', 120, 'g', 180, 32, 0, 4),
  ('90000000-0000-0000-0000-000000000539', 'Tilápia grelhada', 120, 'g', 150, 28, 0, 4);

-- Avaliações (Fulana de Tal) — 2 encontros, mostrando evolução -------------
insert into public.assessments (id, patient_id, assessed_at, notes, created_by) values
  ('90000000-0000-0000-0000-000000000601', '90000000-0000-0000-0000-000000000010', now() - interval '40 days', 'Avaliação inicial (dado fictício de seed).', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000602', '90000000-0000-0000-0000-000000000010', now() - interval '10 days', 'Reavaliação quinzenal (dado fictício de seed).', '90000000-0000-0000-0000-000000000001');

insert into public.assessment_measurements (assessment_id, measurement_type_id, value)
select '90000000-0000-0000-0000-000000000601', id, v.value
from public.measurement_types, (values ('WEIGHT', 78.4), ('BODY_FAT_PCT', 28.5), ('WAIST_CIRCUMFERENCE', 92.0)) as v(code, value)
where measurement_types.code = v.code;

insert into public.assessment_measurements (assessment_id, measurement_type_id, value)
select '90000000-0000-0000-0000-000000000602', id, v.value
from public.measurement_types, (values ('WEIGHT', 76.9), ('BODY_FAT_PCT', 27.1), ('WAIST_CIRCUMFERENCE', 89.5)) as v(code, value)
where measurement_types.code = v.code;

-- Suplementos e feedback (Fulana de Tal) ------------------------------------
insert into public.supplement_recommendations (patient_id, name, brand, instructions, schedule_text, active, created_by) values
  ('90000000-0000-0000-0000-000000000010', 'Whey Protein', 'Exemplo Nutrition (fictício)', 'Diluir 1 dose em água ou leite.', 'Após o treino', true, '90000000-0000-0000-0000-000000000001');

insert into public.feedback_messages (patient_id, author_id, content, created_at) values
  ('90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000001',
   'Parabéns pela evolução nas duas últimas semanas! Continue com a hidratação combinada na consulta.', now() - interval '9 days');

-- Blog (fictício) -----------------------------------------------------------
insert into public.blog_categories (id, name, slug) values
  ('90000000-0000-0000-0000-000000000701', 'Nutrição no dia a dia', 'nutricao-no-dia-a-dia'),
  ('90000000-0000-0000-0000-000000000702', 'Bastidores do consultório', 'bastidores-do-consultorio');

insert into public.blog_tags (id, name, slug) values
  ('90000000-0000-0000-0000-000000000711', 'hidratação', 'hidratacao'),
  ('90000000-0000-0000-0000-000000000712', 'rotina', 'rotina');

-- Conteúdo de DEMONSTRAÇÃO (título prefixado com "Exemplo:" e excerpt
-- explícito) — só para exercitar o renderizador do blog em dev. Nunca vira
-- conteúdo real de produção (prompt Fase 4 §28).
insert into public.blog_posts (id, title, slug, excerpt, content, category_id, author_id, status, published_at) values
  ('90000000-0000-0000-0000-000000000721', 'Exemplo: 5 dicas para se hidratar melhor', 'exemplo-5-dicas-hidratacao',
   'Post fictício de seed para validar o CMS do blog.',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Este é um conteúdo de demonstração do ambiente de desenvolvimento. Ele existe apenas para validar a renderização do blog."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Exemplo de subtítulo"}]},{"type":"paragraph","content":[{"type":"text","text":"Parágrafo com "},{"type":"text","marks":[{"type":"bold"}],"text":"negrito"},{"type":"text","text":" e "},{"type":"text","marks":[{"type":"italic"}],"text":"itálico"},{"type":"text","text":"."}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item de lista 1"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item de lista 2"}]}]}]}]}'::jsonb,
   '90000000-0000-0000-0000-000000000701', '90000000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '20 days'),
  ('90000000-0000-0000-0000-000000000722', 'Exemplo: organizando a rotina alimentar da semana', 'exemplo-rotina-alimentar-semana',
   'Post fictício de seed para validar o CMS do blog.',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Conteúdo de demonstração do ambiente de desenvolvimento — não é um artigo real."}]}]}'::jsonb,
   '90000000-0000-0000-0000-000000000701', '90000000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '5 days'),
  ('90000000-0000-0000-0000-000000000723', 'Rascunho: ideias para o próximo artigo', 'rascunho-ideias-proximo-artigo',
   'Rascunho fictício — nunca deve aparecer publicamente.', '{"type":"doc","content":[]}'::jsonb,
   '90000000-0000-0000-0000-000000000702', '90000000-0000-0000-0000-000000000001', 'DRAFT', null);

insert into public.blog_post_tags (post_id, tag_id) values
  ('90000000-0000-0000-0000-000000000721', '90000000-0000-0000-0000-000000000711'),
  ('90000000-0000-0000-0000-000000000722', '90000000-0000-0000-0000-000000000712');
