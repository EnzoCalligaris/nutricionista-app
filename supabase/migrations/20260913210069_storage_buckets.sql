-- Storage: buckets e políticas de storage.objects. Nenhum bucket privado tem
-- policy aberta — cada um é checado contra a tabela de domínio equivalente
-- (prompt Fase 2 §42/§43). "before-after" fica PRIVADO mesmo quando
-- published=true: a entrega pública passa por uma rota server-side que
-- confere published+consentimento e gera signed URL (Fase 14) — não expomos
-- isso via storage RLS para anon, por segurança adicional dado o requisito
-- de consentimento.

-- Cast seguro de texto para uuid: usado para validar o primeiro segmento do
-- path do objeto sem derrubar a policy inteira em caso de path malformado
-- (retorna NULL em vez de lançar exceção).
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('patient-documents', 'patient-documents', false, 52428800),
  ('meal-photos', 'meal-photos', false, 20971520),
  ('bioimpedance-reports', 'bioimpedance-reports', false, 20971520),
  ('before-after', 'before-after', false, 20971520),
  ('blog', 'blog', true, 10485760)
on conflict (id) do nothing;

-- patient-documents: path = "<material_id>/<filename>" ------------------
-- (um material pode ser atribuído a vários pacientes via material_assignments,
-- então o path é por material, não por paciente.)

create policy "patient_documents_select_nutritionist"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and exists (
      select 1 from public.patient_materials pm
      where pm.id = public.safe_uuid((storage.foldername(name))[1])
        and pm.nutritionist_id = auth.uid()
    )
  );

create policy "patient_documents_select_assigned_patient"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and exists (
      select 1
      from public.material_assignments ma
      join public.patient_materials pm on pm.id = ma.material_id
      where pm.id = public.safe_uuid((storage.foldername(name))[1])
        and ma.revoked_at is null
        and public.is_patient_self(ma.patient_id)
    )
  );

create policy "patient_documents_write_nutritionist"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and exists (
      select 1 from public.patient_materials pm
      where pm.id = public.safe_uuid((storage.foldername(name))[1])
        and pm.nutritionist_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'patient-documents'
    and exists (
      select 1 from public.patient_materials pm
      where pm.id = public.safe_uuid((storage.foldername(name))[1])
        and pm.nutritionist_id = auth.uid()
    )
  );

-- meal-photos: path = "<patient_id>/<filename>" ---------------------------

create policy "meal_photos_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (
      public.is_patient_self(public.safe_uuid((storage.foldername(name))[1]))
      or public.is_nutritionist_of_patient(public.safe_uuid((storage.foldername(name))[1]))
    )
  );

create policy "meal_photos_write_patient"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'meal-photos' and public.is_patient_self(public.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'meal-photos' and public.is_patient_self(public.safe_uuid((storage.foldername(name))[1])));

-- bioimpedance-reports: path = "<patient_id>/<filename>" ------------------

create policy "bioimpedance_reports_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bioimpedance-reports'
    and (
      public.is_patient_self(public.safe_uuid((storage.foldername(name))[1]))
      or public.is_nutritionist_of_patient(public.safe_uuid((storage.foldername(name))[1]))
    )
  );

create policy "bioimpedance_reports_write_nutritionist"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'bioimpedance-reports' and public.is_nutritionist_of_patient(public.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'bioimpedance-reports' and public.is_nutritionist_of_patient(public.safe_uuid((storage.foldername(name))[1])));

-- before-after: path = "<before_after_results.id>/<filename>" ------------
-- Privado mesmo quando published=true — entrega pública é server-side
-- (signed URL), não via storage RLS direta para anon.

create policy "before_after_select_nutritionist"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'before-after' and public.current_profile_role() = 'NUTRITIONIST');

create policy "before_after_select_own_patient"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'before-after'
    and exists (
      select 1 from public.before_after_results r
      where r.id = public.safe_uuid((storage.foldername(name))[1])
        and public.is_patient_self(r.patient_id)
    )
  );

create policy "before_after_write_nutritionist"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'before-after' and public.current_profile_role() = 'NUTRITIONIST')
  with check (bucket_id = 'before-after' and public.current_profile_role() = 'NUTRITIONIST');

-- blog: bucket público (capas de post/OG image) --------------------------

create policy "blog_assets_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'blog');

create policy "blog_assets_write_nutritionist"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'blog' and public.current_profile_role() = 'NUTRITIONIST')
  with check (bucket_id = 'blog' and public.current_profile_role() = 'NUTRITIONIST');
