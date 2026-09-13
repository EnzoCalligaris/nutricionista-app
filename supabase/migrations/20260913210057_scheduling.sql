-- Agenda: disponibilidade, bloqueios, consultas e anotações internas.
-- REQUISITO CRÍTICO (docs/SECURITY.md / prompt Fase 2 §19): dupla reserva do
-- mesmo horário é impedida pelo próprio Postgres via exclusion constraint,
-- não apenas por lógica de aplicação.

-- Nomenclatura: o prompt da Fase 2 sugere o campo "type" (IN_PERSON/ONLINE);
-- usamos "modality" (já adotado desde a Fase 0 em docs/DATABASE.md) para não
-- confundir com "tipo de consulta" em um sentido clínico futuro. Mesmos
-- valores, nome mais específico — decisão registrada em docs/DECISIONS.md.
create type public.appointment_modality as enum ('IN_PERSON', 'ONLINE');

create type public.appointment_status as enum (
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
  'RESCHEDULED'
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 = domingo .. 6 = sábado, mesma convenção de EXTRACT(DOW) do Postgres.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  -- NULL = disponível para ambas as modalidades neste intervalo.
  modality public.appointment_modality,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

comment on table public.availability_rules is
  'Regras recorrentes de horário de trabalho. Múltiplos intervalos no mesmo dia (ex.: 08-12 e 14-19) são múltiplas linhas com o mesmo weekday.';

create index availability_rules_nutritionist_id_idx
  on public.availability_rules (nutritionist_id);

create trigger set_availability_rules_updated_at
  before update on public.availability_rules
  for each row
  execute function public.set_updated_at();

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

comment on table public.blocked_times is
  'Férias, ausências, compromissos e outros bloqueios manuais da agenda do nutricionista.';

create index blocked_times_nutritionist_id_starts_at_idx
  on public.blocked_times (nutritionist_id, starts_at);

create trigger set_blocked_times_updated_at
  before update on public.blocked_times
  for each row
  execute function public.set_updated_at();

-- appointments ---------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  contract_id uuid references public.patient_contracts (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  modality public.appointment_modality not null,
  status public.appointment_status not null default 'SCHEDULED',
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  -- Quando status = RESCHEDULED, aponta para a nova consulta que a substitui
  -- (rastreabilidade; a consulta antiga para de bloquear a agenda — ver
  -- constraint de exclusão abaixo).
  rescheduled_to_id uuid references public.appointments (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status = 'CANCELLED' or cancelled_at is null)
);

comment on table public.appointments is
  'starts_at/ends_at em timestamptz (UTC) — conversão para America/Sao_Paulo só na camada de apresentação (docs/ARCHITECTURE.md §Timezone).';

-- ANTI-DOUBLE-BOOKING: dois appointments do mesmo nutricionista não podem ter
-- intervalos [starts_at, ends_at) sobrepostos, mas SÓ quando ambos estão em
-- status que realmente ocupam a agenda. CANCELLED e RESCHEDULED liberam o
-- horário (prompt Fase 2 §19). Limite '[)' (fechado no início, aberto no
-- fim) permite consultas adjacentes (10:00–11:00 e 11:00–12:00) sem
-- conflito (prompt Fase 2 §54).
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    nutritionist_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'));

create index appointments_nutritionist_id_starts_at_idx
  on public.appointments (nutritionist_id, starts_at);
create index appointments_patient_id_starts_at_idx
  on public.appointments (patient_id, starts_at);
create index appointments_contract_id_idx
  on public.appointments (contract_id);

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

create table public.appointment_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid not null references public.patients (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.appointment_notes is
  'Anotações clínicas/internas do nutricionista sobre o paciente. Privadas — o paciente nunca as vê (distinto de feedback_messages, que é a mensagem enviada ao paciente).';

create index appointment_notes_patient_id_idx on public.appointment_notes (patient_id);
create index appointment_notes_appointment_id_idx on public.appointment_notes (appointment_id);

create trigger set_appointment_notes_updated_at
  before update on public.appointment_notes
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.availability_rules enable row level security;
alter table public.blocked_times enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_notes enable row level security;

-- Disponibilidade e bloqueios são lidos publicamente (para o site calcular
-- horários livres no agendamento) mas só o próprio nutricionista escreve.
create policy "availability_rules_select_public"
  on public.availability_rules
  for select
  to anon, authenticated
  using (active = true);

create policy "availability_rules_select_nutritionist_all"
  on public.availability_rules
  for select
  to authenticated
  using (nutritionist_id = auth.uid());

create policy "availability_rules_write_nutritionist"
  on public.availability_rules
  for all
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "blocked_times_select_public"
  on public.blocked_times
  for select
  to anon, authenticated
  using (true);

create policy "blocked_times_write_nutritionist"
  on public.blocked_times
  for all
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

-- Appointments: paciente vê/gerencia as próprias consultas; nutricionista
-- vê/gerencia as consultas dos seus pacientes.
create policy "appointments_select"
  on public.appointments
  for select
  to authenticated
  using (
    nutritionist_id = auth.uid()
    or public.is_patient_self(patient_id)
  );

create policy "appointments_insert"
  on public.appointments
  for insert
  to authenticated
  with check (
    nutritionist_id = auth.uid()
    or public.is_patient_self(patient_id)
  );

create policy "appointments_update"
  on public.appointments
  for update
  to authenticated
  using (
    nutritionist_id = auth.uid()
    or public.is_patient_self(patient_id)
  )
  with check (
    nutritionist_id = auth.uid()
    or public.is_patient_self(patient_id)
  );

-- Sem policy de delete — cancelamento é UPDATE de status, nunca DELETE.

-- Appointment notes: só o nutricionista responsável pelo paciente. O
-- paciente NUNCA lê (são anotações internas/clínicas).
create policy "appointment_notes_select_nutritionist"
  on public.appointment_notes
  for select
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id));

create policy "appointment_notes_write_nutritionist"
  on public.appointment_notes
  for insert
  to authenticated
  with check (
    public.is_nutritionist_of_patient(patient_id)
    and author_id = auth.uid()
  );

create policy "appointment_notes_update_nutritionist"
  on public.appointment_notes
  for update
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

-- Sem policy de delete — "não destruir comentários antigos indiscriminadamente"
-- (docs/PROJECT_SPEC.md §15).
