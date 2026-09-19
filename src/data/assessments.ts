import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { MetricType } from "@/domain/assessments/metrics";
import { sortByDateDesc, type AssessmentSummary } from "@/domain/assessments/evolution";

/**
 * Queries de avaliações (prompt Fase 9 §54). Cliente de sessão: RLS decide
 * quem vê (nutricionista = próprios pacientes; paciente = só visíveis e não
 * arquivadas). `internal_notes` NUNCA é selecionada nas queries do portal.
 */

export async function getMetricTypes(includeInactive = false): Promise<MetricType[]> {
  const supabase = await createClient();
  let query = supabase.from("measurement_types").select("id, code, name, unit, active").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return data ?? [];
}

export type AssessmentDetail = AssessmentSummary & {
  patientId: string;
  assessedAt: string;
  notes: string | null;
  internalNotes: string | null;
  publishedAt: string | null;
  report: { path: string; name: string; mime: string; sizeBytes: number; uploadedAt: string } | null;
  updatedAt: string;
};

const NUTRI_SELECT =
  "id, patient_id, assessed_at, assessment_date, notes, internal_notes, visible_to_patient, published_at, archived_at, report_path, report_name, report_mime, report_size_bytes, report_uploaded_at, created_at, updated_at, assessment_measurements(value, measurement_types(code, name, unit))";

// Portal: mesma forma, mas sem `internal_notes` (dado interno do nutricionista).
const PATIENT_SELECT =
  "id, patient_id, assessed_at, assessment_date, notes, visible_to_patient, published_at, archived_at, report_path, report_name, report_mime, report_size_bytes, report_uploaded_at, created_at, updated_at, assessment_measurements(value, measurement_types(code, name, unit))";

type Row = {
  id: string;
  patient_id: string;
  assessed_at: string;
  assessment_date: string;
  notes: string | null;
  internal_notes?: string | null;
  visible_to_patient: boolean;
  published_at: string | null;
  archived_at: string | null;
  report_path: string | null;
  report_name: string | null;
  report_mime: string | null;
  report_size_bytes: number | null;
  report_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  assessment_measurements: { value: number | string; measurement_types: { code: string; name: string; unit: string } | null }[];
};

function toDetail(row: Row): AssessmentDetail {
  return {
    id: row.id,
    patientId: row.patient_id,
    assessedAt: row.assessed_at,
    assessmentDate: row.assessment_date,
    notes: row.notes,
    internalNotes: row.internal_notes ?? null,
    visibleToPatient: row.visible_to_patient,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    hasReport: row.report_path !== null,
    report:
      row.report_path && row.report_name && row.report_mime && row.report_size_bytes != null && row.report_uploaded_at
        ? { path: row.report_path, name: row.report_name, mime: row.report_mime, sizeBytes: row.report_size_bytes, uploadedAt: row.report_uploaded_at }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    measurements: row.assessment_measurements
      .filter((entry) => entry.measurement_types)
      .map((entry) => ({ code: entry.measurement_types!.code, name: entry.measurement_types!.name, unit: entry.measurement_types!.unit, value: Number(entry.value) })),
  };
}

/** Todas as avaliações do paciente para o nutricionista (arquivadas incluídas), mais recente primeiro. */
export async function listPatientAssessments(patientId: string): Promise<AssessmentDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assessments").select(NUTRI_SELECT).eq("patient_id", patientId);
  if (error) throw domainErrorFromDatabase(error);
  return sortByDateDesc(((data ?? []) as unknown as Row[]).map(toDetail));
}

export async function getAssessmentById(assessmentId: string): Promise<AssessmentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assessments").select(NUTRI_SELECT).eq("id", assessmentId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as unknown as Row) : null;
}

/**
 * Avaliações VISÍVEIS do paciente (portal). A RLS já filtra; a query repete
 * o filtro e nunca lê `internal_notes`.
 */
export async function listVisibleAssessments(patientId: string): Promise<AssessmentDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(PATIENT_SELECT)
    .eq("patient_id", patientId)
    .eq("visible_to_patient", true)
    .is("archived_at", null);
  if (error) throw domainErrorFromDatabase(error);
  return sortByDateDesc(((data ?? []) as unknown as Row[]).map(toDetail));
}

export async function getVisibleAssessment(patientId: string, assessmentId: string): Promise<AssessmentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(PATIENT_SELECT)
    .eq("id", assessmentId)
    .eq("patient_id", patientId)
    .eq("visible_to_patient", true)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as unknown as Row) : null;
}

/** Visão geral para `/dashboard/avaliacoes`: última avaliação por paciente. */
export type PatientAssessmentOverview = {
  patientId: string;
  patientName: string;
  patientStatus: string;
  total: number;
  latest: { id: string; assessmentDate: string; visibleToPatient: boolean; weight: number | null } | null;
};

export async function listAssessmentOverview(nutritionistId: string): Promise<PatientAssessmentOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, status, assessments(id, assessment_date, created_at, visible_to_patient, archived_at, assessment_measurements(value, measurement_types(code)))")
    .eq("nutritionist_id", nutritionistId)
    .order("full_name");
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((patient) => {
    const rows = (patient.assessments as unknown as { id: string; assessment_date: string; created_at: string; visible_to_patient: boolean; archived_at: string | null; assessment_measurements: { value: number | string; measurement_types: { code: string } | null }[] }[]).filter(
      (row) => row.archived_at === null,
    );
    const latest = sortByDateDesc(rows.map((row) => ({ ...row, assessmentDate: row.assessment_date, createdAt: row.created_at })))[0] ?? null;
    const weight = latest?.assessment_measurements.find((entry) => entry.measurement_types?.code === "WEIGHT");
    return {
      patientId: patient.id,
      patientName: patient.full_name,
      patientStatus: patient.status,
      total: rows.length,
      latest: latest ? { id: latest.id, assessmentDate: latest.assessment_date, visibleToPatient: latest.visible_to_patient, weight: weight ? Number(weight.value) : null } : null,
    };
  });
}
