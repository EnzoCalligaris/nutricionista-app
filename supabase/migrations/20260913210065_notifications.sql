-- Notificações: item in-app (notifications) + evento de domínio + entrega
-- por canal. Nenhum envio real acontece nesta fase (Fase 12) — só a
-- modelagem. Escrita de events/deliveries é feita por jobs server-side com
-- service role (que ignora RLS por padrão no Supabase); por isso não há
-- policy de INSERT/UPDATE para authenticated nessas duas tabelas.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_read_at_idx
  on public.notifications (recipient_id, read_at);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index notification_events_related_entity_idx
  on public.notification_events (related_entity_type, related_entity_id);

create type public.notification_channel as enum ('IN_APP', 'EMAIL', 'WHATSAPP');
create type public.notification_delivery_status as enum ('PENDING', 'SENT', 'FAILED');

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  channel public.notification_channel not null,
  -- Endereço genérico (e-mail/telefone) quando aplicável.
  recipient text not null,
  -- Quando o destinatário é um usuário do sistema (ex.: canal IN_APP),
  -- referência forte para integridade; nullable porque nem todo canal tem
  -- profile (ex.: e-mail avulso).
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  status public.notification_delivery_status not null default 'PENDING',
  provider_message_id text,
  sent_at timestamptz,
  failed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  -- Idempotência: reenviar o mesmo evento no mesmo canal nunca duplica.
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'SENT' or sent_at is not null),
  check (status <> 'FAILED' or failed_at is not null)
);

create index notification_deliveries_event_id_idx
  on public.notification_deliveries (event_id);
create index notification_deliveries_recipient_profile_id_idx
  on public.notification_deliveries (recipient_profile_id);

create trigger set_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.notifications enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

-- Só o próprio destinatário marca como lida (read_at) — mais nenhuma outra
-- coluna deveria mudar via API; como a única escrita client-side esperada é
-- "marcar como lida", uma policy simples é suficiente por ora (sem trigger
-- de tamper-proofing adicional, diferente de feedback_messages, porque
-- notifications não carrega conteúdo clínico sensível a proteger de edição).
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- notification_events/notification_deliveries: leitura só para o
-- nutricionista (auditoria operacional). Escrita é feita server-side com
-- service role, fora de RLS — nenhuma policy de insert/update/delete para
-- authenticated é intencional.
create policy "notification_events_select_nutritionist"
  on public.notification_events
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');

create policy "notification_deliveries_select_nutritionist"
  on public.notification_deliveries
  for select
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST');
