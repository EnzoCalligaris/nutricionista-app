-- Avaliações/bioimpedância com modelagem flexível (catálogo de métricas +
-- valores), em vez de dezenas de colunas fixas — decisão explícita do prompt
-- Fase 2 §24, substituindo o desenho de `bioimpedance_assessments` com
-- colunas fixas proposto na Fase 0 (registrado em docs/DECISIONS.md).

create table public.measurement_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.measurement_types is
  'Catálogo de métricas possíveis (peso, %gordura, circunferências, e futuras). Nenhum campo é obrigatório por paciente — o nutricionista só registra o que usa.';

create trigger set_measurement_types_updated_at
  before update on public.measurement_types
  for each row
  execute function public.set_updated_at();

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  assessed_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assessments is
  'Uma avaliação = um "encontro de medição" (data + observações). Os valores em si ficam em assessment_measurements. Nunca vira diagnóstico automático (docs/PROJECT_SPEC.md §22).';

create index assessments_patient_id_assessed_at_idx
  on public.assessments (patient_id, assessed_at);

create trigger set_assessments_updated_at
  before update on public.assessments
  for each row
  execute function public.set_updated_at();

create table public.assessment_measurements (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  measurement_type_id uuid not null references public.measurement_types (id) on delete restrict,
  value numeric(10, 3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, measurement_type_id)
);

create index assessment_measurements_assessment_id_idx
  on public.assessment_measurements (assessment_id);
create index assessment_measurements_type_id_idx
  on public.assessment_measurements (measurement_type_id);

create trigger set_assessment_measurements_updated_at
  before update on public.assessment_measurements
  for each row
  execute function public.set_updated_at();

-- Catálogo inicial de métricas comuns (dado de referência, não dado de
-- paciente — pode crescer sem migration, isto é só um seed de conveniência).
insert into public.measurement_types (code, name, unit) values
  ('WEIGHT', 'Peso', 'kg'),
  ('BODY_FAT_PCT', 'Percentual de gordura', '%'),
  ('LEAN_MASS', 'Massa magra', 'kg'),
  ('MUSCLE_MASS', 'Massa muscular', 'kg'),
  ('BODY_WATER_PCT', 'Água corporal', '%'),
  ('VISCERAL_FAT', 'Gordura visceral', 'nível'),
  ('BMI', 'IMC', 'kg/m²'),
  ('WAIST_CIRCUMFERENCE', 'Circunferência da cintura', 'cm'),
  ('HIP_CIRCUMFERENCE', 'Circunferência do quadril', 'cm'),
  ('ARM_CIRCUMFERENCE', 'Circunferência do braço', 'cm')
on conflict (code) do nothing;

-- RLS ---------------------------------------------------------------------

alter table public.measurement_types enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_measurements enable row level security;

-- Catálogo de métricas: qualquer autenticado lê (precisa para exibir
-- rótulos), só nutricionista escreve.
create policy "measurement_types_select_authenticated"
  on public.measurement_types
  for select
  to authenticated
  using (active = true);

create policy "measurement_types_write_nutritionist"
  on public.measurement_types
  for all
  to authenticated
  using (public.current_profile_role() = 'NUTRITIONIST')
  with check (public.current_profile_role() = 'NUTRITIONIST');

create policy "assessments_select"
  on public.assessments
  for select
  to authenticated
  using (
    public.is_nutritionist_of_patient(patient_id)
    or public.is_patient_self(patient_id)
  );

create policy "assessments_write_nutritionist"
  on public.assessments
  for all
  to authenticated
  using (public.is_nutritionist_of_patient(patient_id))
  with check (public.is_nutritionist_of_patient(patient_id));

create policy "assessment_measurements_select"
  on public.assessment_measurements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_measurements.assessment_id
        and (
          public.is_nutritionist_of_patient(a.patient_id)
          or public.is_patient_self(a.patient_id)
        )
    )
  );

create policy "assessment_measurements_write_nutritionist"
  on public.assessment_measurements
  for all
  to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_measurements.assessment_id
        and public.is_nutritionist_of_patient(a.patient_id)
    )
  )
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_measurements.assessment_id
        and public.is_nutritionist_of_patient(a.patient_id)
    )
  );
