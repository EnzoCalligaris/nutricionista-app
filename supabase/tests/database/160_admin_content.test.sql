-- Fase 14 — configurações, planos/preços/benefícios, resultados antes/depois
-- com consentimento e CMS do blog, no BANCO:
--   * site_settings: formato de chave, público x privado para anon, paciente
--     não escreve;
--   * plan_prices: valor > 0, parcelas >= 1, UMA condição principal (troca
--     atômica A -> B), "nenhuma principal" como estado válido;
--   * plans: ANUAL ativo mas fora do site; visível exige ativo;
--   * before_after_results: publicar exige imagens + consentimento VÁLIDO,
--     revogação tira do site na hora, arquivado invisível, nutri B não lê nem
--     altera resultado de A, paciente não escreve;
--   * storage: bucket before-after privado para anon, entrega pública só pela
--     função de elegibilidade;
--   * blog: rascunho/arquivado 404 e publicado visível, alias de slug criado
--     na troca de endereço de post publicado, colisão de alias recusada.

begin;
create extension if not exists pgtap with schema extensions;

select plan(71);

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ad-nutri-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ad-nutri-b@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ad-patient-a@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');

insert into public.profiles (id, role, full_name) values
  ('ad000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'Nutri A'),
  ('ad000000-0000-0000-0000-000000000002', 'NUTRITIONIST', 'Nutri B'),
  ('ad000000-0000-0000-0000-000000000003', 'PATIENT', 'Patient A')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, profile_id, nutritionist_id, full_name) values
  ('ad000000-0000-0000-0000-000000000010', 'ad000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'Maria Aparecida Souza'),
  ('ad000000-0000-0000-0000-000000000011', null, 'ad000000-0000-0000-0000-000000000002', 'Paciente de B');

-- =====================================================================
-- 1. site_settings — formato de chave e visibilidade
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

select lives_ok(
  $$insert into public.site_settings (key, value, is_public, updated_by)
    values ('contact.phone', '"+5511999990001"'::jsonb, true, 'ad000000-0000-0000-0000-000000000001')$$,
  'site_settings: nutricionista grava chave pública'
);

select is(
  (select updated_by from public.site_settings where key = 'contact.phone'),
  'ad000000-0000-0000-0000-000000000001'::uuid,
  'site_settings: updated_by registrado'
);

select throws_ok(
  $$insert into public.site_settings (key, value) values ('Contact.Phone', '"x"'::jsonb)$$,
  '23514', null,
  'site_settings: chave com maiúscula é recusada pelo formato'
);

select throws_ok(
  $$insert into public.site_settings (key, value) values ('contact phone', '"x"'::jsonb)$$,
  '23514', null,
  'site_settings: chave com espaço é recusada'
);

select throws_ok(
  $$insert into public.site_settings (key, value) values ('../../etc/passwd', '"x"'::jsonb)$$,
  '23514', null,
  'site_settings: chave com path traversal é recusada'
);

-- Uma chave privada (instruções da consulta online) e o endereço escondido.
insert into public.site_settings (key, value, is_public) values
  ('attendance.online_instructions', '"Entre 5 minutos antes."'::jsonb, false),
  ('attendance.online_platform', '"Plataforma X"'::jsonb, true),
  ('address.street', '"Rua Exemplo"'::jsonb, false),
  ('address.show_public', 'false'::jsonb, true);

-- =====================================================================
-- 2. Visitante anônimo (site público)
-- =====================================================================
set local role anon;

select is(
  (select count(*)::int from public.site_settings where key = 'contact.phone'),
  1, 'anon lê configuração pública'
);
select is(
  (select count(*)::int from public.site_settings where key = 'attendance.online_instructions'),
  0, 'anon NUNCA lê as instruções da consulta online (is_public = false)'
);
select is(
  (select count(*)::int from public.site_settings where key = 'address.street'),
  0, 'anon não lê o endereço quando show_public está desligado (§6)'
);
select throws_ok(
  $$insert into public.site_settings (key, value) values ('contact.email', '"x@y.com"'::jsonb)$$,
  '42501', null,
  'anon não escreve configuração'
);

-- =====================================================================
-- 3. Paciente não administra o site (§43/§73)
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.site_settings where key = 'attendance.online_instructions'),
  0, 'paciente não lê configuração privada'
);
select throws_ok(
  $$insert into public.site_settings (key, value) values ('home.headline', '"hack"'::jsonb)$$,
  '42501', null,
  'paciente não grava configuração'
);
-- Sob RLS um UPDATE sem linha visível não lança erro: simplesmente não afeta
-- linha nenhuma. O paciente também não LÊ o ANUAL, então a conferência do
-- valor roda com o papel restaurado (§43/§73).
update public.plans set publicly_visible = true where code = 'ANUAL';
reset role;
select is(
  (select publicly_visible from public.plans where code = 'ANUAL'),
  false,
  'paciente não altera plano (UPDATE não afeta nenhuma linha)'
);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select throws_ok(
  $$insert into public.blog_posts (title, slug, author_id, status) values ('Hack', 'hack', 'ad000000-0000-0000-0000-000000000003', 'PUBLISHED')$$,
  '42501', null,
  'paciente não cria post'
);
select throws_ok(
  $$insert into public.before_after_results (nutritionist_id, title) values ('ad000000-0000-0000-0000-000000000003', 'Hack')$$,
  '42501', null,
  'paciente não cria resultado'
);

-- =====================================================================
-- 4. Preço: valor positivo, parcelas e UMA condição principal
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

insert into public.plans (id, code, name, active, publicly_visible, available_for_sale)
values ('ad000000-0000-0000-0000-000000000100', 'TESTE14', 'Plano de Teste 14', true, true, true);

select throws_ok(
  $$insert into public.plan_prices (plan_id, label, amount_cents, payment_type)
    values ('ad000000-0000-0000-0000-000000000100', 'Zero', 0, 'AVISTA')$$,
  '23514', null,
  'plan_prices: valor zero é recusado pelo banco (§18)'
);
select throws_ok(
  $$insert into public.plan_prices (plan_id, label, amount_cents, payment_type)
    values ('ad000000-0000-0000-0000-000000000100', 'Negativo', -100, 'AVISTA')$$,
  '23514', null,
  'plan_prices: valor negativo é recusado'
);
select throws_ok(
  $$insert into public.plan_prices (plan_id, label, amount_cents, installments, payment_type)
    values ('ad000000-0000-0000-0000-000000000100', 'Zero parcelas', 10000, 0, 'AVISTA')$$,
  '23514', null,
  'plan_prices: parcelas zero é recusado (§18)'
);

-- Três condições, como o trimestral real.
insert into public.plan_prices (id, plan_id, label, amount_cents, installments, payment_type, is_primary, active) values
  ('ad000000-0000-0000-0000-000000000110', 'ad000000-0000-0000-0000-000000000100', 'A (à vista)', 60000, 1, 'AVISTA', false, true),
  ('ad000000-0000-0000-0000-000000000111', 'ad000000-0000-0000-0000-000000000100', 'B (parcelado)', 68037, 3, 'PARCELADO', false, true),
  ('ad000000-0000-0000-0000-000000000112', 'ad000000-0000-0000-0000-000000000100', 'C (referência)', 105000, 1, 'REFERENCIA', false, true);

select is(
  (select count(*)::int from public.plan_prices where plan_id = 'ad000000-0000-0000-0000-000000000100' and is_primary),
  0, 'Nenhuma condição principal é eleita automaticamente (§16/§67)'
);

-- Marca A como principal.
select lives_ok(
  $$select public.set_plan_primary_price('ad000000-0000-0000-0000-000000000100', 'ad000000-0000-0000-0000-000000000110')$$,
  'set_plan_primary_price: marca A'
);
select is(
  (select id from public.plan_prices where plan_id = 'ad000000-0000-0000-0000-000000000100' and is_primary),
  'ad000000-0000-0000-0000-000000000110'::uuid,
  'Somente A é principal'
);

-- Troca para B: A tem de sair na MESMA operação (§66).
select lives_ok(
  $$select public.set_plan_primary_price('ad000000-0000-0000-0000-000000000100', 'ad000000-0000-0000-0000-000000000111')$$,
  'set_plan_primary_price: troca para B'
);
select is(
  (select count(*)::int from public.plan_prices where plan_id = 'ad000000-0000-0000-0000-000000000100' and is_primary),
  1, 'Continua existindo exatamente UMA condição principal (§66)'
);
select is(
  (select id from public.plan_prices where plan_id = 'ad000000-0000-0000-0000-000000000100' and is_primary),
  'ad000000-0000-0000-0000-000000000111'::uuid,
  'Depois da troca, SOMENTE B é principal (§66)'
);

-- Voltar para "nenhuma" é estado legítimo (§17/§67).
select lives_ok(
  $$select public.clear_plan_primary_price('ad000000-0000-0000-0000-000000000100')$$,
  'clear_plan_primary_price: nenhuma principal'
);
select is(
  (select count(*)::int from public.plan_prices where plan_id = 'ad000000-0000-0000-0000-000000000100' and is_primary),
  0, 'Nenhuma principal é aceito (§17/§67)'
);

-- Condição inativa não pode ser a principal.
update public.plan_prices set active = false where id = 'ad000000-0000-0000-0000-000000000112';
select throws_ok(
  $$select public.set_plan_primary_price('ad000000-0000-0000-0000-000000000100', 'ad000000-0000-0000-0000-000000000112')$$,
  'PLAN_PRICE_INACTIVE',
  'Condição inativa não vira principal'
);
select throws_ok(
  $$select public.set_plan_primary_price('ad000000-0000-0000-0000-000000000100', 'ad000000-0000-0000-0000-000000000999')$$,
  'PLAN_PRICE_NOT_FOUND',
  'Condição de outro plano/inexistente é recusada'
);

-- Índice único continua impedindo dois principais por INSERT direto.
update public.plan_prices set is_primary = true where id = 'ad000000-0000-0000-0000-000000000110';
select throws_ok(
  $$update public.plan_prices set is_primary = true where id = 'ad000000-0000-0000-0000-000000000111'$$,
  '23505', null,
  'Duas condições principais simultâneas continuam impossíveis (§18)'
);

-- =====================================================================
-- 5. Benefícios: ordenação atômica
-- =====================================================================
insert into public.plan_benefits (id, plan_id, label, sort_order, active) values
  ('ad000000-0000-0000-0000-000000000120', 'ad000000-0000-0000-0000-000000000100', 'Primeiro', 1, true),
  ('ad000000-0000-0000-0000-000000000121', 'ad000000-0000-0000-0000-000000000100', 'Segundo', 2, true);

select lives_ok(
  $$select public.swap_plan_benefit_order('ad000000-0000-0000-0000-000000000120', 'ad000000-0000-0000-0000-000000000121')$$,
  'swap_plan_benefit_order: troca posições'
);
select is(
  (select sort_order from public.plan_benefits where id = 'ad000000-0000-0000-0000-000000000120'),
  2, 'Benefício desceu'
);
select is(
  (select sort_order from public.plan_benefits where id = 'ad000000-0000-0000-0000-000000000121'),
  1, 'Benefício subiu'
);

-- =====================================================================
-- 6. Plano: visível exige ativo; ANUAL fora do site (§68)
-- =====================================================================
select throws_ok(
  $$update public.plans set active = false where id = 'ad000000-0000-0000-0000-000000000100'$$,
  '23514', null,
  'Plano visível/à venda não pode ser desativado sem sair do site (§13)'
);

select is(
  (select active from public.plans where code = 'ANUAL'), true,
  'ANUAL continua ativo (§68)'
);
select is(
  (select publicly_visible from public.plans where code = 'ANUAL'), false,
  'ANUAL continua invisível no site (§68)'
);
select is(
  (select available_for_sale from public.plans where code = 'ANUAL'), false,
  'ANUAL continua indisponível para venda (§68)'
);

-- =====================================================================
-- 7. Resultados antes/depois e consentimento
-- =====================================================================
insert into public.before_after_results (id, nutritionist_id, patient_id, title, sort_order)
values ('ad000000-0000-0000-0000-000000000200', 'ad000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000010', 'Evolução A', 1);

select is(
  (select published from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  false, 'Resultado nasce não publicado'
);

-- Publicar sem imagens nem consentimento (§70).
select throws_ok(
  $$select public.publish_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'RESULT_IMAGES_MISSING',
  'Publicar sem as duas fotos é recusado (§70)'
);

update public.before_after_results
   set before_path = 'ad000000-0000-0000-0000-000000000200/b.webp',
       after_path = 'ad000000-0000-0000-0000-000000000200/a.webp'
 where id = 'ad000000-0000-0000-0000-000000000200';

select throws_ok(
  $$select public.publish_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'RESULT_CONSENT_REQUIRED',
  'Publicar sem consentimento é recusado (§29/§70)'
);

-- Consentimento já REVOGADO não habilita publicação.
insert into public.media_consents (id, patient_id, consent_type, consent_version, name_display_mode, revoked_at, granted_by)
values ('ad000000-0000-0000-0000-000000000210', 'ad000000-0000-0000-0000-000000000010', 'BEFORE_AFTER_PHOTOS', 'image_use_v1', 'FIRST_NAME', now(), 'ad000000-0000-0000-0000-000000000001');
update public.before_after_results set media_consent_id = 'ad000000-0000-0000-0000-000000000210'
 where id = 'ad000000-0000-0000-0000-000000000200';

select throws_ok(
  $$select public.publish_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'RESULT_CONSENT_REVOKED',
  'Publicar com consentimento revogado é recusado (§70)'
);

-- Consentimento válido: publica.
insert into public.media_consents (id, patient_id, consent_type, consent_version, name_display_mode, evidence_reference, granted_by)
values ('ad000000-0000-0000-0000-000000000211', 'ad000000-0000-0000-0000-000000000010', 'BEFORE_AFTER_PHOTOS', 'image_use_v1', 'FIRST_NAME', 'Termo assinado arquivado', 'ad000000-0000-0000-0000-000000000001');
update public.before_after_results
   set media_consent_id = 'ad000000-0000-0000-0000-000000000211', display_name = 'Maria'
 where id = 'ad000000-0000-0000-0000-000000000200';

select lives_ok(
  $$select public.publish_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'Publica com imagens + consentimento válido (§69)'
);
select isnt(
  (select published_at from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  null, 'published_at preenchido'
);
select is(
  (select published_by from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  'ad000000-0000-0000-0000-000000000001'::uuid,
  'published_by é o nutricionista autenticado (§56)'
);

-- Paciente de OUTRO nutricionista nunca entra no resultado (§54). Testado num
-- resultado sem consentimento anexado, para isolar o trigger de ownership do
-- trigger de consentimento da Fase 2.
insert into public.before_after_results (id, nutritionist_id, title)
values ('ad000000-0000-0000-0000-000000000201', 'ad000000-0000-0000-0000-000000000001', 'Sem paciente');
select throws_ok(
  $$update public.before_after_results set patient_id = 'ad000000-0000-0000-0000-000000000011'
     where id = 'ad000000-0000-0000-0000-000000000201'$$,
  'PATIENT_NOT_AUTHORIZED',
  'Paciente de outro nutricionista não é aceito no resultado (§54)'
);

-- Visível para o site.
set local role anon;
select is(
  (select count(*)::int from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  1, 'Resultado publicado com consentimento válido é visível ao visitante (§69)'
);
select isnt(
  (select public.public_result_image_path('ad000000-0000-0000-0000-000000000200', 'before')),
  null, 'Elegível: a função devolve o path para a rota pública (§71)'
);
select is(
  (select public.public_result_image_path('ad000000-0000-0000-0000-000000000200', 'inexistente')),
  null, 'Slot inválido não devolve path'
);

-- Objeto do bucket privado NUNCA é lido direto por anon (§71). A tabela
-- storage.buckets em si não é legível por anon, então a checagem do flag roda
-- com o papel restaurado.
reset role;
select is(
  (select public from storage.buckets where id = 'before-after'), false,
  'Bucket before-after continua privado mesmo com resultado publicado (§32)'
);
set local role anon;

-- Revogação: sai do site IMEDIATAMENTE, sem editar o resultado (§31/§69).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select lives_ok(
  $$select public.revoke_media_consent('ad000000-0000-0000-0000-000000000211', 'pedido do paciente')$$,
  'revoke_media_consent: revoga'
);
select is(
  (select published from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  true, 'published continua true — o histórico do que foi publicado é preservado'
);
select throws_ok(
  $$select public.revoke_media_consent('ad000000-0000-0000-0000-000000000211', null)$$,
  'CONSENT_ALREADY_REVOKED',
  'Revogar duas vezes é recusado'
);

set local role anon;
select is(
  (select count(*)::int from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  0, 'Revogado o consentimento, o resultado desaparece do site na hora (§31/§69)'
);
select is(
  (select public.public_result_image_path('ad000000-0000-0000-0000-000000000200', 'before')),
  null, 'Revogado: a rota pública deixa de receber o path (§71)'
);

-- Arquivar despublica e mantém histórico (§37).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select lives_ok(
  $$select public.archive_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'archive_before_after_result: arquiva'
);
select is(
  (select published from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  false, 'Arquivar despublica'
);
select isnt(
  (select archived_at from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  null, 'archived_at preenchido (histórico preservado, §37)'
);

-- Nutri B não vê nem altera resultado de A (§73).
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.before_after_results where id = 'ad000000-0000-0000-0000-000000000200'),
  0, 'Nutri B não lê resultado de Nutri A (§73)'
);
select throws_ok(
  $$select public.publish_before_after_result('ad000000-0000-0000-0000-000000000200')$$,
  'RESULT_NOT_FOUND',
  'Nutri B não publica resultado de Nutri A (§73)'
);
select is(
  (select count(*)::int from public.media_consents where id = 'ad000000-0000-0000-0000-000000000211'),
  0, 'Nutri B não lê consentimento de paciente de A (§55)'
);

-- =====================================================================
-- 8. Blog: rascunho/arquivado invisíveis, alias de slug
-- =====================================================================
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

insert into public.blog_posts (id, title, slug, author_id, status, published_at, content) values
  ('ad000000-0000-0000-0000-000000000300', 'Rascunho 14', 'rascunho-14', 'ad000000-0000-0000-0000-000000000001', 'DRAFT', null, '{"type":"doc","content":[]}'::jsonb),
  ('ad000000-0000-0000-0000-000000000301', 'Publicado 14', 'publicado-14', 'ad000000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '1 hour', '{"type":"doc","content":[]}'::jsonb);

set local role anon;
select is((select count(*)::int from public.blog_posts where id = 'ad000000-0000-0000-0000-000000000300'), 0, 'Rascunho: 404 no público (§72)');
select is((select count(*)::int from public.blog_posts where id = 'ad000000-0000-0000-0000-000000000301'), 1, 'Publicado: visível (§72)');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.blog_posts set status = 'ARCHIVED', archived_at = now() where id = 'ad000000-0000-0000-0000-000000000301';

set local role anon;
select is((select count(*)::int from public.blog_posts where id = 'ad000000-0000-0000-0000-000000000301'), 0, 'Arquivado: 404 no público (§72)');

-- Alias: trocar o slug de um post PUBLICADO guarda o endereço antigo (§42).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.blog_posts set status = 'PUBLISHED', archived_at = null where id = 'ad000000-0000-0000-0000-000000000301';
update public.blog_posts set slug = 'publicado-14-novo' where id = 'ad000000-0000-0000-0000-000000000301';

select is(
  (select count(*)::int from public.blog_post_slug_aliases where post_id = 'ad000000-0000-0000-0000-000000000301' and slug = 'publicado-14'),
  1, 'Slug antigo de post publicado é guardado como alias (§42)'
);

-- Rascunho que troca de slug NÃO gera alias (nunca teve URL pública).
update public.blog_posts set slug = 'rascunho-14-novo' where id = 'ad000000-0000-0000-0000-000000000300';
select is(
  (select count(*)::int from public.blog_post_slug_aliases where post_id = 'ad000000-0000-0000-0000-000000000300'),
  0, 'Rascunho que muda de endereço não cria alias'
);

-- Alias não pode colidir com o slug vivo de outro post.
select throws_ok(
  $$insert into public.blog_post_slug_aliases (post_id, slug)
    values ('ad000000-0000-0000-0000-000000000300', 'publicado-14-novo')$$,
  'POST_SLUG_TAKEN',
  'Alias que colide com slug de outro post é recusado (§42)'
);

-- Nem um post pode assumir um slug reservado como alias de outro.
select throws_ok(
  $$update public.blog_posts set slug = 'publicado-14' where id = 'ad000000-0000-0000-0000-000000000300'$$,
  'POST_SLUG_TAKEN',
  'Post não assume endereço antigo de outro post (§42)'
);

-- Slug duplicado continua impossível.
select throws_ok(
  $$insert into public.blog_posts (title, slug, author_id, status) values ('Dup', 'publicado-14-novo', 'ad000000-0000-0000-0000-000000000001', 'DRAFT')$$,
  '23505', null,
  'blog_posts: slug é único'
);

-- Alias de post arquivado não vaza para o público.
update public.blog_posts set status = 'ARCHIVED', archived_at = now() where id = 'ad000000-0000-0000-0000-000000000301';
set local role anon;
select is(
  (select count(*)::int from public.blog_post_slug_aliases where post_id = 'ad000000-0000-0000-0000-000000000301'),
  0, 'Alias de post arquivado não é lido pelo público (§42/§72)'
);

-- =====================================================================
-- 9. Bucket de assets institucionais (§45/§46)
-- =====================================================================
reset role;
select is((select public from storage.buckets where id = 'site-assets'), true, 'site-assets é público (asset institucional)');
select is((select public from storage.buckets where id = 'meal-photos'), false, 'meal-photos continua privado');
select is((select public from storage.buckets where id = 'bioimpedance-reports'), false, 'bioimpedance-reports continua privado');
select is((select public from storage.buckets where id = 'patient-documents'), false, 'patient-documents continua privado');

select * from finish();
rollback;
