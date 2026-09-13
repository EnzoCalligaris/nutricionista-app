-- Log de auditoria, append-only. Sem segredos, sem snapshot clínico
-- completo — só o necessário para rastrear quem fez o quê (prompt Fase 2
-- §34).

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only: sem policy de UPDATE/DELETE para nenhum papel, e os privilégios de UPDATE/DELETE são revogados de anon/authenticated como defesa em profundidade.';

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

-- RLS ---------------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_nutritionist"
  on public.audit_logs
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "audit_logs_insert_nutritionist"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    public.current_profile_role() = 'NUTRITIONIST'
    and actor_id = auth.uid()
  );

-- Sem policy de update/delete (default deny) + revogação explícita dos
-- privilégios correspondentes, como reforço além do RLS.
revoke update, delete on public.audit_logs from authenticated, anon;
