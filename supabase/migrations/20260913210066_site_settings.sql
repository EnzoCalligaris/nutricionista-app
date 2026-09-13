-- Configurações do site como chave/valor — evita hardcode de telefone,
-- WhatsApp, endereço, CRN, redes sociais no frontend (prompt Fase 2 §33).
-- NENHUM valor é inserido aqui: essas informações continuam
-- PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md) até Enzo fornecê-las — nunca
-- inventadas no seed.

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'Configuração editável pelo dashboard (Fase 14). Tabela vazia nesta fase — nenhum valor de contato é inventado.';

create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.site_settings enable row level security;

create policy "site_settings_select_public"
  on public.site_settings
  for select
  to anon, authenticated
  using (is_public = true);

create policy "site_settings_select_nutritionist_all"
  on public.site_settings
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "site_settings_write_nutritionist"
  on public.site_settings
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');
