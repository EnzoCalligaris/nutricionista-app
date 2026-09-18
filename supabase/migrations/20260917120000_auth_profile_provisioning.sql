-- Fase 3 — provisionamento automático de profiles a partir de auth.users, e
-- reforço de defesa contra role escalation na criação do profile.
-- Ver docs/DECISIONS.md (Fase 3) e docs/SECURITY.md.

-- Cria automaticamente um profile PATIENT para todo novo usuário do
-- Supabase Auth (signup direto ou convite via admin.inviteUserByEmail).
-- Requisito crítico (prompt Fase 3 §19): role NUNCA é decidida por
-- raw_user_meta_data (metadata é fornecida pelo browser/client e não é
-- fonte confiável de autorização) — só full_name é lido dali, com fallback
-- para o prefixo do e-mail. Promover alguém a NUTRITIONIST é sempre uma
-- operação administrativa separada e explícita via service_role (ver
-- scripts/bootstrap-nutritionist.mjs), nunca decidida por este trigger.
--
-- SECURITY DEFINER com search_path fixo vazio (mesmo padrão das funções
-- auxiliares de RLS em 20260913210054_rls_helper_functions.sql) — todos os
-- identificadores são schema-qualificados no corpo. Como a função é
-- proprietária de `postgres` (papel usado para aplicar migrations, com
-- bypassrls), o insert em public.profiles ignora RLS — correto aqui, já que
-- é exatamente o mecanismo de provisionamento inicial do profile.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'PATIENT',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Cria profile PATIENT automaticamente para todo novo usuário de auth.users. Role default seguro — nunca lê role de metadata fornecida pelo client (docs/SECURITY.md, prompt Fase 3 §19).';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Reforço de defesa em profundidade: mesmo a policy de auto-inserção do
-- próprio profile (existente desde a Fase 2, mantida como fallback caso o
-- trigger acima não tenha rodado — ex.: ambientes onde auth.users já tinha
-- linhas antes desta migration) não pode ser usada para se auto-promover a
-- NUTRITIONIST/ADMIN. Combinado com o trigger `prevent_role_change`
-- (Fase 2, que já bloqueia UPDATE de role fora de service_role), fecha o
-- caminho de role escalation tanto na criação quanto na atualização do
-- profile (prompt Fase 3 §20, "Role Escalation").
drop policy if exists "profiles_insert_self" on public.profiles;

create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() and role = 'PATIENT');
