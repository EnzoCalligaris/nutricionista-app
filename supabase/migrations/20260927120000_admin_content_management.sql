-- =========================================================================
-- FASE 14 — Consolidação administrativa: configurações, conteúdo público,
-- planos/preços/benefícios, resultados antes/depois com consentimento e CMS
-- do blog.
--
-- Nenhuma migration anterior é editada (CLAUDE.md / prompt Fase 14 §101).
-- Nenhum dado real de contato, CRN, endereço, plataforma online, preço novo
-- ou depoimento é inserido aqui: tudo continua PENDENTE DE DEFINIÇÃO até
-- Enzo preencher pelo dashboard (regra inegociável nº 1).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. site_settings — quem alterou + formato de chave controlado
-- -------------------------------------------------------------------------
-- A tabela nasceu na Fase 2 como key/value (`20260913210066_site_settings.sql`)
-- e continua sendo a fonte única das configurações públicas (prompt §8).
-- A Fase 14 acrescenta rastreabilidade e um formato de chave restrito: a
-- aplicação só grava chaves de um registry fechado (src/domain/site-settings/
-- registry.ts), e o banco recusa chave fora do padrão como defesa em
-- profundidade contra mass assignment de chave arbitrária (prompt §56).

alter table public.site_settings
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

comment on column public.site_settings.updated_by is
  'Último nutricionista que gravou a chave. Preenchido pela aplicação com auth.uid() — nunca vem do client.';

alter table public.site_settings
  add constraint site_settings_key_format
  check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$' and length(key) <= 120);

-- -------------------------------------------------------------------------
-- 2. plan_prices / plans — validação de preço no BANCO (prompt §18)
-- -------------------------------------------------------------------------
-- `amount_cents >= 0` (Fase 2) permitia preço zero; a regra da Fase 14 é
-- valor sempre POSITIVO. `installments >= 1` e o índice único
-- `plan_prices_one_primary_per_plan` (uma condição principal ativa por
-- plano) já vinham da Fase 2 e continuam valendo — a UI da Fase 14 nunca é
-- a única guardiã dessas regras.

alter table public.plan_prices
  add constraint plan_prices_amount_positive check (amount_cents > 0);

-- Plano visível publicamente tem de estar ativo: a RLS pública já exige
-- `publicly_visible and active`, então o estado "visível mas inativo" só
-- confundiria o admin (prompt §13/§14).
alter table public.plans
  add constraint plans_public_requires_active
  check (not (publicly_visible and not active));

-- Vender exige estar ativo pelo mesmo motivo.
alter table public.plans
  add constraint plans_sale_requires_active
  check (not (available_for_sale and not active));

-- -------------------------------------------------------------------------
-- 3. media_consents — consentimento de imagem versionado (prompt §29/§30)
-- -------------------------------------------------------------------------

alter table public.media_consents
  add column if not exists consent_version text not null default 'image_use_v1',
  add column if not exists granted_by uuid references public.profiles (id) on delete set null,
  add column if not exists revoked_by uuid references public.profiles (id) on delete set null,
  add column if not exists revoke_reason text,
  add column if not exists name_display_mode text not null default 'ANONYMOUS';

comment on column public.media_consents.consent_version is
  'Versão do texto de consentimento aceito. O texto operacional v1 está em src/domain/results/consent-document.ts e tem REVISÃO JURÍDICA PENDENTE antes de produção (prompt §88).';
comment on column public.media_consents.name_display_mode is
  'Como a pessoa autorizou ser identificada publicamente (prompt §36). ANONYMOUS nunca expõe nome. Nenhum nome é inventado pela aplicação.';

alter table public.media_consents
  add constraint media_consents_name_display_mode_check
  check (name_display_mode in ('ANONYMOUS', 'FIRST_NAME', 'INITIALS', 'FULL_NAME'));

-- consent_type NÃO ganha CHECK fechado: `media_consents` é genérica e a
-- convenção já estabelecida na Fase 2 é 'BEFORE_AFTER_PHOTOS'. Fechar o
-- domínio aqui exigiria migration para cada novo tipo de consentimento de
-- mídia; a validação do valor gravado fica no Zod da aplicação
-- (src/validators/results.ts).

alter table public.media_consents
  add constraint media_consents_revoke_fields
  check (revoked_at is not null or (revoked_by is null and revoke_reason is null));

-- -------------------------------------------------------------------------
-- 4. before_after_results — ownership, arquivamento, publicação e vitrine
-- -------------------------------------------------------------------------

alter table public.before_after_results
  add column if not exists nutritionist_id uuid references public.profiles (id) on delete restrict,
  add column if not exists archived_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles (id) on delete set null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists display_name text,
  add column if not exists image_alt text;

comment on column public.before_after_results.nutritionist_id is
  'Dono do resultado (prompt §54). O produto é single-nutritionist, mas a coluna existe para a autorização ser verificada de verdade, nunca presumida.';
comment on column public.before_after_results.display_name is
  'Nome exibido publicamente, já no formato autorizado pelo consentimento (primeiro nome / iniciais). NULL = anônimo. Nunca inventado (prompt §36/§91).';
comment on column public.before_after_results.image_alt is
  'Texto alternativo das imagens. Deve descrever a evolução sem expor dado sensível (prompt §85); quando vazio, a aplicação usa um alt genérico.';

-- Backfill do dono antes do NOT NULL. Em base nova a tabela está vazia (não
-- há resultado real nem fictício em supabase/seed.sql) — o update é no-op.
update public.before_after_results r
  set nutritionist_id = coalesce(
    (select p.nutritionist_id from public.patients p where p.id = r.patient_id),
    (select id from public.profiles where role = 'NUTRITIONIST' order by created_at limit 1)
  )
where r.nutritionist_id is null;

-- Se sobrou linha órfã (base sem nenhum nutricionista), aborta em vez de
-- deixar dado sem dono.
do $$
begin
  if exists (select 1 from public.before_after_results where nutritionist_id is null) then
    raise exception 'before_after_results sem nutritionist_id: backfill não encontrou dono';
  end if;
end;
$$;

alter table public.before_after_results
  alter column nutritionist_id set not null;

-- O fluxo real é criar o resultado, DEPOIS subir as duas fotos (o path do
-- objeto é "<result_id>/..."), registrar consentimento e só então publicar.
-- Por isso os paths deixam de ser obrigatórios na criação — mas continuam
-- obrigatórios para publicar (constraint abaixo).
alter table public.before_after_results
  alter column before_path drop not null,
  alter column after_path drop not null;

alter table public.before_after_results
  add constraint before_after_published_requires_images
  check (published = false or (before_path is not null and after_path is not null));

alter table public.before_after_results
  add constraint before_after_published_not_archived
  check (published = false or archived_at is null);

alter table public.before_after_results
  add constraint before_after_published_at_present
  check (published = false or published_at is not null);

create index if not exists before_after_results_nutritionist_idx
  on public.before_after_results (nutritionist_id);
create index if not exists before_after_results_public_idx
  on public.before_after_results (published, archived_at, sort_order);

-- Publicar exige consentimento VÁLIDO (não revogado), não só "algum"
-- consentimento. A checagem CHECK da Fase 2 garante `media_consent_id is not
-- null`; este trigger fecha o buraco de publicar com consentimento já
-- revogado (prompt §29/§70).
create or replace function public.validate_before_after_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published then
    if new.media_consent_id is null then
      raise exception 'RESULT_CONSENT_REQUIRED' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.media_consents
      where id = new.media_consent_id and revoked_at is null
    ) then
      raise exception 'RESULT_CONSENT_REVOKED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.validate_before_after_publication() is
  'Impede publicar resultado com consentimento revogado/inexistente. SECURITY DEFINER com search_path fixo porque lê media_consents, que tem RLS própria (CLAUDE.md regra 11).';

create trigger validate_before_after_results_publication
  before insert or update on public.before_after_results
  for each row
  execute function public.validate_before_after_publication();

-- Ownership: o resultado pertence ao nutricionista autenticado e, quando há
-- paciente vinculado, esse paciente é dele (prompt §54/§56).
create or replace function public.validate_before_after_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_of_patient uuid;
begin
  if new.patient_id is not null then
    select nutritionist_id into owner_of_patient
    from public.patients where id = new.patient_id;

    if owner_of_patient is distinct from new.nutritionist_id then
      raise exception 'PATIENT_NOT_AUTHORIZED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_before_after_results_ownership
  before insert or update on public.before_after_results
  for each row
  execute function public.validate_before_after_ownership();

-- RLS pública: além de published + consentimento válido (Fase 2), arquivado
-- nunca aparece.
drop policy if exists "before_after_results_select_public" on public.before_after_results;
create policy "before_after_results_select_public"
  on public.before_after_results
  for select
  to anon, authenticated
  using (
    published = true
    and archived_at is null
    and media_consent_id is not null
    and public.has_valid_media_consent(media_consent_id)
  );

-- Escrita do nutricionista: só as PRÓPRIAS linhas (a policy da Fase 2 dava
-- acesso a qualquer linha para qualquer NUTRITIONIST).
drop policy if exists "before_after_results_write_nutritionist" on public.before_after_results;
create policy "before_after_results_write_nutritionist"
  on public.before_after_results
  for all
  to authenticated
  using (
    public.current_profile_role() = 'NUTRITIONIST'
    and nutritionist_id = auth.uid()
  )
  with check (
    public.current_profile_role() = 'NUTRITIONIST'
    and nutritionist_id = auth.uid()
  );

-- -------------------------------------------------------------------------
-- 5. media_consents — RLS restrita aos próprios pacientes (prompt §55)
-- -------------------------------------------------------------------------
-- A policy da Fase 2 liberava qualquer linha para qualquer NUTRITIONIST.
-- Single-nutritionist continua sendo o produto, mas a autorização passa a
-- ser verificada de verdade (prompt §54).

drop policy if exists "media_consents_select" on public.media_consents;
create policy "media_consents_select"
  on public.media_consents
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

drop policy if exists "media_consents_write_nutritionist" on public.media_consents;
create policy "media_consents_write_nutritionist"
  on public.media_consents
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

-- -------------------------------------------------------------------------
-- 6. Publicação/arquivamento/revogação atômicos (prompt §31/§47)
-- -------------------------------------------------------------------------
-- Publicar depende de várias condições (imagens + consentimento válido +
-- não arquivado). Numa única função o estado nunca fica parcial, e a
-- mensagem de erro é específica o suficiente para a UI explicar o motivo.

create or replace function public.publish_before_after_result(p_result_id uuid)
returns public.before_after_results
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.before_after_results;
begin
  -- FOR UPDATE: a leitura passa pela RLS de escrita do nutricionista, então
  -- um id de outra pessoa simplesmente não é encontrado (nunca vaza).
  select * into result
  from public.before_after_results
  where id = p_result_id
  for update;

  if not found then
    raise exception 'RESULT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if result.archived_at is not null then
    raise exception 'RESULT_ARCHIVED' using errcode = 'P0001';
  end if;
  if result.before_path is null or result.after_path is null then
    raise exception 'RESULT_IMAGES_MISSING' using errcode = 'P0001';
  end if;
  if result.media_consent_id is null then
    raise exception 'RESULT_CONSENT_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.media_consents
    where id = result.media_consent_id and revoked_at is null
  ) then
    raise exception 'RESULT_CONSENT_REVOKED' using errcode = 'P0001';
  end if;

  update public.before_after_results
     set published = true,
         published_at = coalesce(published_at, now()),
         published_by = auth.uid()
   where id = p_result_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.unpublish_before_after_result(p_result_id uuid)
returns public.before_after_results
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.before_after_results;
begin
  update public.before_after_results
     set published = false,
         published_at = null,
         published_by = null
   where id = p_result_id
  returning * into result;

  if not found then
    raise exception 'RESULT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Arquivar em vez de apagar (prompt §37): despublica e preserva histórico.
create or replace function public.archive_before_after_result(p_result_id uuid)
returns public.before_after_results
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.before_after_results;
begin
  update public.before_after_results
     set published = false,
         published_at = null,
         published_by = null,
         archived_at = coalesce(archived_at, now())
   where id = p_result_id
  returning * into result;

  if not found then
    raise exception 'RESULT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.restore_before_after_result(p_result_id uuid)
returns public.before_after_results
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.before_after_results;
begin
  update public.before_after_results
     set archived_at = null
   where id = p_result_id
  returning * into result;

  if not found then
    raise exception 'RESULT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Revogar consentimento: o resultado deixa de ser público IMEDIATAMENTE
-- porque a policy pública chama has_valid_media_consent() — não depende de
-- nenhuma edição manual do resultado (prompt §31). `published` continua
-- true de propósito: o histórico do que foi publicado é preservado, e o
-- dashboard mostra o estado "publicado, sem consentimento válido".
create or replace function public.revoke_media_consent(p_consent_id uuid, p_reason text default null)
returns public.media_consents
language plpgsql
security invoker
set search_path = public
as $$
declare
  consent public.media_consents;
begin
  select * into consent
  from public.media_consents
  where id = p_consent_id
  for update;

  if not found then
    raise exception 'CONSENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if consent.revoked_at is not null then
    raise exception 'CONSENT_ALREADY_REVOKED' using errcode = 'P0001';
  end if;

  update public.media_consents
     set revoked_at = now(),
         revoked_by = auth.uid(),
         revoke_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_consent_id
  returning * into consent;

  return consent;
end;
$$;

revoke execute on function public.publish_before_after_result(uuid) from public, anon;
revoke execute on function public.unpublish_before_after_result(uuid) from public, anon;
revoke execute on function public.archive_before_after_result(uuid) from public, anon;
revoke execute on function public.restore_before_after_result(uuid) from public, anon;
revoke execute on function public.revoke_media_consent(uuid, text) from public, anon;
grant execute on function public.publish_before_after_result(uuid) to authenticated;
grant execute on function public.unpublish_before_after_result(uuid) to authenticated;
grant execute on function public.archive_before_after_result(uuid) to authenticated;
grant execute on function public.restore_before_after_result(uuid) to authenticated;
grant execute on function public.revoke_media_consent(uuid, text) to authenticated;

-- -------------------------------------------------------------------------
-- 7. Entrega pública das imagens do bucket PRIVADO (prompt §32/§33)
-- -------------------------------------------------------------------------
-- O bucket `before-after` continua privado (nenhuma policy para anon em
-- storage.objects). O site público resolve o path por esta função, que só
-- responde para resultado elegível; a rota server-side então assina a URL
-- com o service role e devolve os bytes. O visitante nunca recebe URL
-- assinada nem path de storage.

create or replace function public.public_result_image_path(p_result_id uuid, p_slot text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_slot when 'before' then r.before_path when 'after' then r.after_path else null end
  from public.before_after_results r
  where r.id = p_result_id
    and r.published = true
    and r.archived_at is null
    and r.media_consent_id is not null
    and public.has_valid_media_consent(r.media_consent_id);
$$;

comment on function public.public_result_image_path(uuid, text) is
  'Path da imagem antes/depois APENAS para resultado publicado, não arquivado e com consentimento válido. SECURITY DEFINER porque a rota pública roda como anon e não deve ler before_after_results direto para isso.';

revoke execute on function public.public_result_image_path(uuid, text) from public;
grant execute on function public.public_result_image_path(uuid, text) to anon, authenticated;

-- Leitura do nutricionista restrita às próprias linhas (a policy da Fase 2
-- liberava todas). Com isso `publish_...` e afins simplesmente não
-- encontram um id de outra pessoa, em vez de encontrar e falhar no update.
drop policy if exists "before_after_results_select_nutritionist_all" on public.before_after_results;
create policy "before_after_results_select_nutritionist_own"
  on public.before_after_results
  for select
  to authenticated
  using (
    public.current_profile_role() = 'NUTRITIONIST'
    and nutritionist_id = auth.uid()
  );

-- -------------------------------------------------------------------------
-- 8. Blog — autoria da publicação e histórico de slug (prompt §39/§42)
-- -------------------------------------------------------------------------

alter table public.blog_posts
  add column if not exists published_by uuid references public.profiles (id) on delete set null,
  add column if not exists archived_at timestamptz;

comment on column public.blog_posts.archived_at is
  'Quando o post foi arquivado. status=ARCHIVED continua sendo a fonte da regra de visibilidade; a data serve ao histórico.';

-- Trocar o slug de um post já publicado quebraria a URL indexada. Em vez de
-- proibir, guardamos o slug antigo como alias e redirecionamos (prompt §42).
create table if not exists public.blog_post_slug_aliases (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  slug text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.blog_post_slug_aliases is
  'Slugs antigos de posts publicados. /blog/<slug antigo> responde 308 para o slug atual — nenhuma URL publicada morre (prompt §42).';

create index if not exists blog_post_slug_aliases_post_id_idx
  on public.blog_post_slug_aliases (post_id);

-- Um alias nunca pode colidir com o slug vivo de outro post, nem o slug de
-- um post com um alias existente (as duas direções, senão a resolução fica
-- ambígua).
create or replace function public.validate_blog_slug_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.blog_posts p where p.slug = new.slug and p.id <> new.post_id) then
    raise exception 'POST_SLUG_TAKEN' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validate_blog_post_slug_alias
  before insert or update on public.blog_post_slug_aliases
  for each row
  execute function public.validate_blog_slug_alias();

create or replace function public.register_blog_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    if exists (select 1 from public.blog_post_slug_aliases a where a.slug = new.slug and a.post_id <> new.id) then
      raise exception 'POST_SLUG_TAKEN' using errcode = 'P0001';
    end if;
    -- O novo slug deixa de ser alias do próprio post (evita auto-redirect).
    delete from public.blog_post_slug_aliases where post_id = new.id and slug = new.slug;
    -- Só guarda alias de post que já esteve público: rascunho nunca teve URL.
    if old.status = 'PUBLISHED' then
      insert into public.blog_post_slug_aliases (post_id, slug)
      values (new.id, old.slug)
      on conflict (slug) do nothing;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.register_blog_slug_change() is
  'Guarda o slug anterior como alias quando um post PUBLICADO troca de endereço. SECURITY DEFINER porque escreve em blog_post_slug_aliases, que tem RLS própria (CLAUDE.md regra 11).';

create trigger register_blog_post_slug_change
  after update of slug on public.blog_posts
  for each row
  execute function public.register_blog_slug_change();

alter table public.blog_post_slug_aliases enable row level security;

-- Público lê o alias só de post atualmente visível (mesmo cuidado de
-- blog_post_tags: não vazar a existência de rascunho/arquivado).
create policy "blog_post_slug_aliases_select"
  on public.blog_post_slug_aliases
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts p
      where p.id = blog_post_slug_aliases.post_id
        and (
          (p.status = 'PUBLISHED' and p.published_at <= now())
          or public.current_profile_role() = 'NUTRITIONIST'
        )
    )
  );

create policy "blog_post_slug_aliases_write_nutritionist"
  on public.blog_post_slug_aliases
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

-- -------------------------------------------------------------------------
-- 9. Bucket de assets institucionais (prompt §45/§46)
-- -------------------------------------------------------------------------
-- JUSTIFICATIVA do bucket novo: foto profissional, logo e imagem de OG são
-- assets INSTITUCIONAIS, públicos por natureza. Misturá-los com `blog`
-- (capas de post) confundiria a curadoria, e colocá-los em qualquer bucket
-- de paciente violaria a separação exigida pelo §45. Nenhuma foto clínica,
-- de paciente ou de antes/depois entra aqui — essas continuam nos buckets
-- privados (`before-after`, `meal-photos`, `bioimpedance-reports`,
-- `patient-documents`), cujas policies não são tocadas por esta migration.

insert into storage.buckets (id, name, public, file_size_limit)
values ('site-assets', 'site-assets', true, 5242880)
on conflict (id) do nothing;

create policy "site_assets_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-assets');

create policy "site_assets_write_nutritionist"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'site-assets' and public.current_profile_role() = 'NUTRITIONIST')
  with check (bucket_id = 'site-assets' and public.current_profile_role() = 'NUTRITIONIST');

-- -------------------------------------------------------------------------
-- 10. Condição principal de preço e ordem dos benefícios (prompt §17/§19)
-- -------------------------------------------------------------------------
-- `plan_prices_one_primary_per_plan` (Fase 2) é um índice único parcial: não
-- dá para marcar B como principal antes de desmarcar A. Numa função só, a
-- troca é atômica e nunca deixa o plano com dois principais nem com nenhum
-- por engano (prompt §66).

create or replace function public.set_plan_primary_price(p_plan_id uuid, p_price_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.plan_prices;
begin
  if p_price_id is not null then
    select * into target
    from public.plan_prices
    where id = p_price_id and plan_id = p_plan_id
    for update;

    if not found then
      raise exception 'PLAN_PRICE_NOT_FOUND' using errcode = 'P0002';
    end if;
    if not target.active then
      raise exception 'PLAN_PRICE_INACTIVE' using errcode = 'P0001';
    end if;
  end if;

  -- Limpa primeiro (inclusive quando p_price_id é null: "nenhuma principal",
  -- que é o estado legítimo de TRIMESTRAL/SEMESTRAL — §16/§17/§67).
  update public.plan_prices
     set is_primary = false
   where plan_id = p_plan_id and is_primary;

  if p_price_id is not null then
    update public.plan_prices
       set is_primary = true
     where id = p_price_id;
  end if;
end;
$$;

-- Troca a posição de dois benefícios do mesmo plano numa transação.
create or replace function public.swap_plan_benefit_order(p_benefit_id uuid, p_other_benefit_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  first_row public.plan_benefits;
  second_row public.plan_benefits;
begin
  -- Ordem de lock estável (por id) para não criar deadlock entre duas
  -- reordenações simultâneas.
  select * into first_row from public.plan_benefits
   where id = least(p_benefit_id, p_other_benefit_id) for update;
  select * into second_row from public.plan_benefits
   where id = greatest(p_benefit_id, p_other_benefit_id) for update;

  if first_row.id is null or second_row.id is null then
    raise exception 'PLAN_BENEFIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if first_row.plan_id is distinct from second_row.plan_id then
    raise exception 'PLAN_BENEFIT_MISMATCH' using errcode = 'P0001';
  end if;

  update public.plan_benefits set sort_order = second_row.sort_order where id = first_row.id;
  update public.plan_benefits set sort_order = first_row.sort_order where id = second_row.id;
end;
$$;

revoke execute on function public.set_plan_primary_price(uuid, uuid) from public, anon;
revoke execute on function public.swap_plan_benefit_order(uuid, uuid) from public, anon;
grant execute on function public.set_plan_primary_price(uuid, uuid) to authenticated;
grant execute on function public.swap_plan_benefit_order(uuid, uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 11. plans.description — texto administrável do plano (prompt §13)
-- -------------------------------------------------------------------------
alter table public.plans
  add column if not exists description text;

comment on column public.plans.description is
  'Descrição editável pelo dashboard. Vazia por padrão — nenhum texto é inventado para os planos do catálogo (regra inegociável nº 1).';

-- "Nenhuma condição principal" é um estado legítimo (§16/§17/§67) e ganha
-- função própria: assim o cliente tipado não precisa passar NULL num
-- parâmetro uuid, e a intenção fica explícita na chamada.
create or replace function public.clear_plan_primary_price(p_plan_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.plan_prices set is_primary = false where plan_id = p_plan_id and is_primary;
$$;

revoke execute on function public.clear_plan_primary_price(uuid) from public, anon;
grant execute on function public.clear_plan_primary_price(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 12. Storage do antes/depois: escopo por DONO (prompt §55/§71/§73)
-- -------------------------------------------------------------------------
-- As policies da Fase 2 liberavam qualquer objeto de `before-after` para
-- qualquer NUTRITIONIST (`current_profile_role() = 'NUTRITIONIST'`). O produto
-- é single-nutritionist, mas isso é autorização presumida, não verificada — e
-- o teste de integração da Fase 14 pegou o vazamento: o nutricionista B
-- conseguia BAIXAR a foto do resultado do nutricionista A.
--
-- Helpers SECURITY DEFINER com `search_path = ''` em vez de EXISTS direto
-- (CLAUDE.md regra 11): a policy de storage precisa consultar
-- `before_after_results`, que tem RLS própria, e um EXISTS comum herdaria
-- essa RLS e poderia falhar em silêncio.

create or replace function public.is_owner_of_before_after_result(target_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.before_after_results r
    where r.id = target_result_id
      and r.nutritionist_id = auth.uid()
  );
$$;

comment on function public.is_owner_of_before_after_result(uuid) is
  'True quando o resultado antes/depois pertence ao nutricionista autenticado. Usada pelas policies do bucket before-after.';

create or replace function public.is_patient_of_before_after_result(target_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.before_after_results r
    where r.id = target_result_id
      and r.patient_id is not null
      and public.is_patient_self(r.patient_id)
  );
$$;

revoke execute on function public.is_owner_of_before_after_result(uuid) from public, anon;
revoke execute on function public.is_patient_of_before_after_result(uuid) from public, anon;
grant execute on function public.is_owner_of_before_after_result(uuid) to authenticated;
grant execute on function public.is_patient_of_before_after_result(uuid) to authenticated;

drop policy if exists "before_after_select_nutritionist" on storage.objects;
create policy "before_after_select_nutritionist_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'before-after'
    and public.is_owner_of_before_after_result(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists "before_after_write_nutritionist" on storage.objects;
create policy "before_after_write_nutritionist_own"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'before-after'
    and public.is_owner_of_before_after_result(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'before-after'
    and public.is_owner_of_before_after_result(public.safe_uuid((storage.foldername(name))[1]))
  );

-- Paciente continua vendo as fotos do PRÓPRIO resultado (intenção da Fase 2),
-- agora por função definer — o EXISTS anterior herdava a RLS de
-- before_after_results e falharia em silêncio para resultado não publicado.
drop policy if exists "before_after_select_own_patient" on storage.objects;
create policy "before_after_select_own_patient"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'before-after'
    and public.is_patient_of_before_after_result(public.safe_uuid((storage.foldername(name))[1]))
  );
