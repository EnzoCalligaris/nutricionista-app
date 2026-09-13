-- Funções auxiliares para políticas de RLS (docs/SECURITY.md §"Funções
-- auxiliares para RLS"). SECURITY DEFINER com search_path fixo vazio
-- (todos os identificadores são schema-qualificados no corpo) para evitar
-- sequestro de search_path e escalonamento de privilégio. Cada função
-- retorna só um boolean/role — nunca dados de outra pessoa — então é seguro
-- liberar EXECUTE para qualquer usuário autenticado.

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_profile_role() is
  'Role do profile autenticado atual, ou NULL se não houver profile. Uso em policies de RLS.';

create or replace function public.is_nutritionist_of_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patients
    where id = target_patient_id
      and nutritionist_id = auth.uid()
  );
$$;

comment on function public.is_nutritionist_of_patient(uuid) is
  'True se o usuário autenticado é o nutricionista responsável pelo paciente informado.';

create or replace function public.is_patient_self(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patients
    where id = target_patient_id
      and profile_id = auth.uid()
  );
$$;

comment on function public.is_patient_self(uuid) is
  'True se o usuário autenticado é o próprio paciente informado (via patients.profile_id).';

-- Revoga execução pública por padrão e libera só para authenticated — anon
-- não deveria nem tentar checar vínculo de paciente.
revoke execute on function public.current_profile_role() from public;
revoke execute on function public.is_nutritionist_of_patient(uuid) from public;
revoke execute on function public.is_patient_self(uuid) from public;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_nutritionist_of_patient(uuid) to authenticated;
grant execute on function public.is_patient_self(uuid) to authenticated;
