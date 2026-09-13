-- Catálogo real de planos (não é dado fictício de seed — são os 4 planos
-- definidos no prompt do produto / docs/PROJECT_SPEC.md §3, por isso entram
-- como migration, existindo em todo ambiente, e não em supabase/seed.sql).
--
-- Preços do TRIMESTRAL e SEMESTRAL ficam com is_primary = false nas três
-- linhas — qual representação (cheia/parcelada/à vista) é "a" principal
-- está PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md). Não escolhemos por eles.
-- "Grupo exclusivo" nunca entra como benefício. "Comunidade VIP" fica de
-- fora por ainda estar pendente.

-- CONSULTA AVULSA -----------------------------------------------------
insert into public.plans (code, name, duration_months, sessions_in_person, sessions_online, active, publicly_visible, available_for_sale)
values ('AVULSA', 'Consulta Avulsa', null, 1, 0, true, true, true);

insert into public.plan_prices (plan_id, label, amount_cents, installments, payment_type, is_primary, active)
select id, 'Consulta avulsa', 23000, 1, 'AVISTA', true, true
from public.plans where code = 'AVULSA';

-- TRIMESTRAL ------------------------------------------------------------
insert into public.plans (code, name, duration_months, sessions_in_person, sessions_online, active, publicly_visible, available_for_sale)
values ('TRIMESTRAL', 'Plano Trimestral', 3, 3, 2, true, true, true);

insert into public.plan_prices (plan_id, label, amount_cents, installments, payment_type, is_primary, active)
select id, v.label, v.amount_cents, v.installments, v.payment_type, false, true
from public.plans,
  (values
    ('Valor cheio (de)', 105000, 1, 'REFERENCIA'::public.plan_price_payment_type),
    ('Parcelado 3x de R$226,79', 68037, 3, 'PARCELADO'::public.plan_price_payment_type),
    ('À vista', 60000, 1, 'AVISTA'::public.plan_price_payment_type)
  ) as v(label, amount_cents, installments, payment_type)
where plans.code = 'TRIMESTRAL';

insert into public.plan_benefits (plan_id, label, sort_order)
select id, b.label, b.sort_order
from public.plans,
  (values
    ('Avaliação antropométrica e/ou bioimpedância', 1),
    ('Formulário de anamnese pré-consulta', 2),
    ('Planejamento alimentar', 3),
    ('Prescrição e análise de exames laboratoriais', 4),
    ('Check-list quinzenal com feedback e acompanhamento (avaliação física por foto)', 5),
    ('Acesso a aplicativo de dieta', 6),
    ('Prescrição de manipulados e suplementos', 7),
    ('Suporte de segunda a sábado (08h–18h)', 8),
    ('Lista de compras e materiais complementares', 9)
  ) as b(label, sort_order)
where plans.code = 'TRIMESTRAL';

-- SEMESTRAL ---------------------------------------------------------------
insert into public.plans (code, name, duration_months, sessions_in_person, sessions_online, active, publicly_visible, available_for_sale)
values ('SEMESTRAL', 'Plano Semestral', 6, 6, 5, true, true, true);

insert into public.plan_prices (plan_id, label, amount_cents, installments, payment_type, is_primary, active)
select id, v.label, v.amount_cents, v.installments, v.payment_type, false, true
from public.plans,
  (values
    ('Valor cheio (de)', 210000, 1, 'REFERENCIA'::public.plan_price_payment_type),
    ('Parcelado 6x de R$214,60', 128760, 6, 'PARCELADO'::public.plan_price_payment_type),
    ('À vista', 108000, 1, 'AVISTA'::public.plan_price_payment_type)
  ) as v(label, amount_cents, installments, payment_type)
where plans.code = 'SEMESTRAL';

insert into public.plan_benefits (plan_id, label, sort_order)
select id, b.label, b.sort_order
from public.plans,
  (values
    ('Avaliação antropométrica e/ou bioimpedância', 1),
    ('Formulário de anamnese pré-consulta', 2),
    ('Planejamento alimentar', 3),
    ('Prescrição e análise de exames laboratoriais', 4),
    ('Check-list quinzenal com feedback e acompanhamento (avaliação física por foto)', 5),
    ('Acesso a aplicativo de dieta', 6),
    ('Prescrição de manipulados e suplementos', 7),
    ('Suporte de segunda a sábado (08h–18h)', 8),
    ('Lista de compras e materiais complementares', 9)
  ) as b(label, sort_order)
where plans.code = 'SEMESTRAL';

-- ANUAL — histórico, não vendido publicamente (docs/PROJECT_SPEC.md §3) --
insert into public.plans (code, name, duration_months, sessions_in_person, sessions_online, active, publicly_visible, available_for_sale)
values ('ANUAL', 'Plano Anual', 12, null, null, true, false, false);

comment on column public.plans.sessions_in_person is
  'NULL quando a composição presencial/online não é conhecida (ex.: ANUAL — PDF só menciona "12 consultas", sem split. Ver docs/DECISIONS.md).';

insert into public.plan_prices (plan_id, label, amount_cents, installments, payment_type, is_primary, active)
select id, v.label, v.amount_cents, v.installments, v.payment_type, false, true
from public.plans,
  (values
    ('Valor cheio (de)', 420000, 1, 'REFERENCIA'::public.plan_price_payment_type),
    ('Parcelado 12x de R$210,33', 252396, 12, 'PARCELADO'::public.plan_price_payment_type),
    ('À vista', 192000, 1, 'AVISTA'::public.plan_price_payment_type)
  ) as v(label, amount_cents, installments, payment_type)
where plans.code = 'ANUAL';

insert into public.plan_benefits (plan_id, label, sort_order)
select id, b.label, b.sort_order
from public.plans,
  (values
    ('Avaliação antropométrica e/ou bioimpedância', 1),
    ('Formulário de anamnese pré-consulta', 2),
    ('Planejamento alimentar', 3),
    ('Prescrição e análise de exames laboratoriais', 4),
    ('Check-list quinzenal com feedback e acompanhamento (avaliação física por foto)', 5),
    ('Acesso a aplicativo de dieta', 6),
    ('Prescrição de manipulados e suplementos', 7),
    ('Suporte de segunda a sábado (08h–18h)', 8),
    ('Lista de compras e materiais complementares', 9)
  ) as b(label, sort_order)
where plans.code = 'ANUAL';
