-- CMS do blog. PDFs/materiais de pacientes NUNCA viram post automaticamente
-- (docs/PROJECT_SPEC.md §5) — não há nenhuma relação/trigger ligando
-- patient_materials a blog_posts.

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_blog_categories_updated_at
  before update on public.blog_categories
  for each row
  execute function public.set_updated_at();

create table public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_blog_tags_updated_at
  before update on public.blog_tags
  for each row
  execute function public.set_updated_at();

create type public.blog_post_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  cover_image_path text,
  content jsonb not null default '{}'::jsonb,
  category_id uuid references public.blog_categories (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  status public.blog_post_status not null default 'DRAFT',
  seo_title text,
  meta_description text,
  og_image_path text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blog_posts is
  'content é jsonb (documento rich text, compatível com TipTap). Só published_at <= now() e status=PUBLISHED aparecem publicamente (docs/DECISIONS.md prompt Fase 2 §40).';

create index blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at);
create index blog_posts_category_id_idx on public.blog_posts (category_id);

create trigger set_blog_posts_updated_at
  before update on public.blog_posts
  for each row
  execute function public.set_updated_at();

create table public.blog_post_tags (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

-- RLS ---------------------------------------------------------------------

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;

-- Taxonomia (categorias/tags) não é sensível — leitura pública liberada.
create policy "blog_categories_select_public"
  on public.blog_categories
  for select
  to anon, authenticated
  using (true);

create policy "blog_categories_write_nutritionist"
  on public.blog_categories
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

create policy "blog_tags_select_public"
  on public.blog_tags
  for select
  to anon, authenticated
  using (true);

create policy "blog_tags_write_nutritionist"
  on public.blog_tags
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

-- Posts: público só vê PUBLISHED com published_at no passado. Rascunho
-- nunca vaza (prompt Fase 2 §40).
create policy "blog_posts_select_public"
  on public.blog_posts
  for select
  to anon, authenticated
  using (status = 'PUBLISHED' and published_at <= now());

create policy "blog_posts_select_nutritionist_all"
  on public.blog_posts
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "blog_posts_write_nutritionist"
  on public.blog_posts
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

-- blog_post_tags: só expõe o vínculo se o post referenciado for público (ou
-- o viewer for o nutricionista) — evita vazar a existência de um rascunho
-- via tags.
create policy "blog_post_tags_select"
  on public.blog_post_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts p
      where p.id = blog_post_tags.post_id
        and (
          (p.status = 'PUBLISHED' and p.published_at <= now())
          or public.current_profile_role() = 'NUTRITIONIST'
        )
    )
  );

create policy "blog_post_tags_write_nutritionist"
  on public.blog_post_tags
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');
