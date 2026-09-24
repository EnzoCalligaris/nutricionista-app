-- Visibilidade pública (prompt Fase 2 §40/§41): rascunho de blog nunca
-- vaza; antes/depois só é público com published=true E consentimento válido
-- e não revogado.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'e-nutri@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '');
insert into public.profiles (id, role, full_name) values ('e0000000-0000-0000-0000-000000000001', 'NUTRITIONIST', 'E Nutri')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.patients (id, nutritionist_id, full_name)
values ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'E Patient');

-- Blog: um post DRAFT e um PUBLISHED.
insert into public.blog_posts (id, title, slug, author_id, status, published_at)
values ('e0000000-0000-0000-0000-000000000010', 'Rascunho interno', 'rascunho-interno', 'e0000000-0000-0000-0000-000000000001', 'DRAFT', null);

insert into public.blog_posts (id, title, slug, author_id, status, published_at)
values ('e0000000-0000-0000-0000-000000000011', 'Artigo publicado', 'artigo-publicado', 'e0000000-0000-0000-0000-000000000001', 'PUBLISHED', now() - interval '1 day');

-- Um post "publicado no futuro" (agendado) também não deve vazar ainda.
insert into public.blog_posts (id, title, slug, author_id, status, published_at)
values ('e0000000-0000-0000-0000-000000000012', 'Agendado para o futuro', 'agendado-futuro', 'e0000000-0000-0000-0000-000000000001', 'PUBLISHED', now() + interval '7 days');

-- Antes/depois: sem consentimento, com consentimento revogado, e com
-- consentimento válido.
insert into public.before_after_results (id, nutritionist_id, patient_id, title, before_path, after_path, published)
values ('e0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Sem consentimento', 'x/b.jpg', 'x/a.jpg', false);

insert into public.media_consents (id, patient_id, consent_type, revoked_at)
values ('e0000000-0000-0000-0000-000000000030', 'e0000000-0000-0000-0000-000000000002', 'BEFORE_AFTER_PHOTOS', now());

-- Publicar com consentimento REVOGADO passou a ser recusado pelo trigger
-- validate_before_after_publication (Fase 14): a linha é criada publicada
-- com o consentimento válido e o consentimento é revogado DEPOIS — que é
-- exatamente o cenário real da revogação (prompt Fase 14 §31).
insert into public.media_consents (id, patient_id, consent_type)
values ('e0000000-0000-0000-0000-000000000032', 'e0000000-0000-0000-0000-000000000002', 'BEFORE_AFTER_PHOTOS');

insert into public.before_after_results (id, nutritionist_id, patient_id, title, before_path, after_path, published, published_at, media_consent_id)
values ('e0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Consentimento revogado', 'x/b.jpg', 'x/a.jpg', true, now(), 'e0000000-0000-0000-0000-000000000032');

update public.media_consents set revoked_at = now() where id = 'e0000000-0000-0000-0000-000000000032';

insert into public.media_consents (id, patient_id, consent_type)
values ('e0000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000002', 'BEFORE_AFTER_PHOTOS');

insert into public.before_after_results (id, nutritionist_id, patient_id, title, before_path, after_path, published, published_at, media_consent_id)
values ('e0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Publicado e consentido', 'x/b.jpg', 'x/a.jpg', true, now(), 'e0000000-0000-0000-0000-000000000031');

-- Simula visitante anônimo do site público.
set local role anon;

select is(
  (select count(*)::int from public.blog_posts where id = 'e0000000-0000-0000-0000-000000000010'),
  0,
  'Post DRAFT não aparece publicamente'
);

select is(
  (select count(*)::int from public.blog_posts where id = 'e0000000-0000-0000-0000-000000000012'),
  0,
  'Post PUBLISHED com published_at no futuro ainda não aparece publicamente'
);

select is(
  (select count(*)::int from public.blog_posts where id = 'e0000000-0000-0000-0000-000000000011'),
  1,
  'Post PUBLISHED com published_at no passado aparece publicamente'
);

select is(
  (select count(*)::int from public.before_after_results where id = 'e0000000-0000-0000-0000-000000000020'),
  0,
  'Antes/depois sem media_consent_id não aparece publicamente'
);

select is(
  (select count(*)::int from public.before_after_results where id = 'e0000000-0000-0000-0000-000000000021'),
  0,
  'Antes/depois com consentimento revogado não aparece publicamente'
);

select is(
  (select count(*)::int from public.before_after_results where id = 'e0000000-0000-0000-0000-000000000022'),
  1,
  'Antes/depois publicado com consentimento válido aparece publicamente'
);

select * from finish();
rollback;
