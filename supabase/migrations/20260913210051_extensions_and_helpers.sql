-- Fase 2 — fundação: extensões e helpers reutilizados por todas as tabelas.

-- pgcrypto: gen_random_uuid() para todas as PKs.
create extension if not exists pgcrypto with schema extensions;

-- btree_gist: necessário para a exclusion constraint anti-double-booking
-- (EXCLUDE USING gist com igualdade + tstzrange) em appointments.
create extension if not exists btree_gist with schema extensions;

-- Trigger reutilizável para manter updated_at sempre atual, em vez de
-- duplicar a lógica em cada tabela (docs/DATABASE.md, seção "created_at/
-- updated_at").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE que mantém updated_at sincronizado. Anexar em toda tabela que tenha a coluna updated_at.';
