-- Corrige bug de RLS descoberto testando o fluxo real de onboarding da
-- Fase 3 (docs/DECISIONS.md) — nunca apareceu na Fase 2 porque toda escrita
-- de teste/seed em `patients` rodava como superuser (bypassa RLS de
-- qualquer forma), nunca como o `authenticated` real de um nutricionista
-- via PostgREST.
--
-- `validate_patient_profile_roles()` (20260913210053_patients.sql) não é
-- SECURITY DEFINER, então roda com os privilégios (e RLS) do usuário que
-- disparou o INSERT/UPDATE em `patients` — normalmente o próprio
-- nutricionista autenticado. Ao convidar um paciente novo
-- (src/actions/onboarding.ts), a policy `profiles_select_by_nutritionist`
-- só libera a leitura do profile do paciente depois que a linha em
-- `patients` que os vincula já existe — mas é EXATAMENTE essa linha que
-- este trigger está validando antes de permitir o INSERT. Dependência
-- circular: sem SECURITY DEFINER, `select role from public.profiles where
-- id = new.profile_id` roda sob RLS, não enxerga a linha (paciente ainda
-- não vinculado) e falha com "profile_id precisa referenciar um profile
-- com role PATIENT" mesmo quando o profile é PATIENT de verdade.
--
-- Mesma lógica das funções auxiliares de RLS em
-- 20260913210054_rls_helper_functions.sql: SECURITY DEFINER com
-- search_path fixo vazio (identificadores já são schema-qualificados no
-- corpo). Função só valida uma regra de integridade (role correto) e nunca
-- expõe dado de outra pessoa para quem chama — seguro rodar com privilégio
-- elevado.
create or replace function public.validate_patient_profile_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nutritionist_role public.profile_role;
  patient_role public.profile_role;
begin
  select role into nutritionist_role from public.profiles where id = new.nutritionist_id;
  if nutritionist_role is distinct from 'NUTRITIONIST' then
    raise exception 'nutritionist_id (%) precisa referenciar um profile com role NUTRITIONIST', new.nutritionist_id;
  end if;

  if new.profile_id is not null then
    select role into patient_role from public.profiles where id = new.profile_id;
    if patient_role is distinct from 'PATIENT' then
      raise exception 'profile_id (%) precisa referenciar um profile com role PATIENT', new.profile_id;
    end if;
  end if;

  return new;
end;
$$;
