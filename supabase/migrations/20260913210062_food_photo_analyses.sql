-- Análise de foto de refeição — modelagem apenas, sem IA real ainda (Fase
-- 11). Resultado é sempre estimativa/faixa, nunca valor exato
-- (docs/PROJECT_SPEC.md §9/§27) — refletido em structured_result (jsonb, com
-- min/max) em vez de colunas de calorias exatas.

create type public.food_photo_analysis_status as enum ('PENDING', 'ANALYZED', 'CONFIRMED', 'FAILED');

create table public.food_photo_analyses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  storage_path text not null,
  status public.food_photo_analysis_status not null default 'PENDING',
  provider text,
  model text,
  raw_result jsonb,
  structured_result jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  corrected_result jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.food_photo_analyses is
  'storage_path aponta para bucket privado (meal-photos) — nunca público. raw_result só é preenchido quando o payload do provider é seguro de reter (sem dado sensível de terceiros).';

create index food_photo_analyses_patient_id_idx
  on public.food_photo_analyses (patient_id);

create trigger set_food_photo_analyses_updated_at
  before update on public.food_photo_analyses
  for each row
  execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------
-- Paciente: só as próprias fotos/análises. Nutricionista: leitura das fotos
-- de pacientes sob sua gestão (docs/PROJECT_SPEC.md §30). Sem escrita do
-- nutricionista — o fluxo é sempre iniciado pelo paciente.

alter table public.food_photo_analyses enable row level security;

create policy "food_photo_analyses_select"
  on public.food_photo_analyses
  for select
  to authenticated
  using (
    public.is_patient_self(patient_id)
    or public.is_nutritionist_of_patient(patient_id)
  );

create policy "food_photo_analyses_insert_patient"
  on public.food_photo_analyses
  for insert
  to authenticated
  with check (public.is_patient_self(patient_id));

create policy "food_photo_analyses_update_patient"
  on public.food_photo_analyses
  for update
  to authenticated
  using (public.is_patient_self(patient_id))
  with check (public.is_patient_self(patient_id));
