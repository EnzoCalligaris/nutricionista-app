-- Suplementos, feedbacks e materiais. A IA nunca é autora de recomendação de
-- suplemento (docs/PROJECT_SPEC.md §23) — não há coluna/flag para isso
-- porque created_by sempre referencia um profile humano (nutricionista).

create table public.supplement_recommendations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null,
  brand text,
  instructions text,
  schedule_text text,
  notes text,
  purchase_url text,
  image_path text,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.supplement_recommendations.image_path is
  'Path no Storage (bucket privado), nunca binário no Postgres.';

create index supplement_recommendations_patient_id_idx
  on public.supplement_recommendations (patient_id);

create trigger set_supplement_recommendations_updated_at
  before update on public.supplement_recommendations
  for each row
  execute function public.set_updated_at();

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.feedback_messages is
  'Mensagem do nutricionista para o paciente. Não é chat em tempo real (docs/PROJECT_SPEC.md §24).';

create index feedback_messages_patient_id_idx on public.feedback_messages (patient_id);

-- Paciente só pode alterar read_at (marcar como lida) — nunca o conteúdo.
create or replace function public.prevent_feedback_tampering_by_patient()
returns trigger
language plpgsql
as $$
begin
  if public.current_profile_role() = 'PATIENT' then
    if new.content is distinct from old.content
      or new.author_id is distinct from old.author_id
      or new.patient_id is distinct from old.patient_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Paciente só pode marcar feedback como lido (read_at).';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_feedback_messages_tampering
  before update on public.feedback_messages
  for each row
  execute function public.prevent_feedback_tampering_by_patient();

create table public.patient_materials (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_materials is
  'Metadata do arquivo; o binário vive no Storage privado (docs/SECURITY.md).';

create index patient_materials_nutritionist_id_idx
  on public.patient_materials (nutritionist_id);

create trigger set_patient_materials_updated_at
  before update on public.patient_materials
  for each row
  execute function public.set_updated_at();

create table public.material_assignments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.patient_materials (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (material_id, patient_id)
);

comment on table public.material_assignments is
  'Revogar acesso = preencher revoked_at, nunca apagar a linha (histórico de quem teve acesso a quê).';

create index material_assignments_patient_id_idx on public.material_assignments (patient_id);
create index material_assignments_material_id_idx on public.material_assignments (material_id);

-- RLS ---------------------------------------------------------------------

alter table public.supplement_recommendations enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.patient_materials enable row level security;
alter table public.material_assignments enable row level security;

create policy "supplement_recommendations_select"
  on public.supplement_recommendations
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "supplement_recommendations_write_nutritionist"
  on public.supplement_recommendations
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

create policy "feedback_messages_select"
  on public.feedback_messages
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "feedback_messages_insert_nutritionist"
  on public.feedback_messages
  for insert
  to authenticated
  with check (
    public.is_nutritionist_of_patient(patient_id)
    and author_id = auth.uid()
  );

-- Update liberado para nutricionista (dono) e paciente (só read_at, forçado
-- pelo trigger acima).
create policy "feedback_messages_update"
  on public.feedback_messages
  for update
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  )
  with check (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "patient_materials_select_nutritionist"
  on public.patient_materials
  for select
  to authenticated
  using (nutritionist_id = auth.uid());

create policy "patient_materials_select_assigned_patient"
  on public.patient_materials
  for select
  to authenticated
  using (
    exists (
      select 1 from public.material_assignments ma
      where ma.material_id = patient_materials.id
        and ma.revoked_at is null
        and public.is_patient_self(ma.patient_id)
    )
  );

create policy "patient_materials_write_nutritionist"
  on public.patient_materials
  for all
  to authenticated
  using (nutritionist_id = auth.uid())
  with check (nutritionist_id = auth.uid());

create policy "material_assignments_select"
  on public.material_assignments
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "material_assignments_write_nutritionist"
  on public.material_assignments
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));
