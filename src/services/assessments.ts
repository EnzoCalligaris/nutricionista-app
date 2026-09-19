import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { wallClockToInstant } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { canHardDelete } from "@/domain/assessments/evolution";
import { getAssessmentById, getVisibleAssessment, type AssessmentDetail } from "@/data/assessments";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import { REPORT_MAX_BYTES, REPORT_MIME_TO_EXT, type AssessmentInput } from "@/validators/assessments";

/**
 * Casos de uso das avaliações (prompt Fase 9 §56). Dado de saúde: ownership
 * reconferido no servidor além da RLS, auditoria só com ids/eventos (nunca
 * valores), relatório no bucket privado `bioimpedance-reports` com path
 * seguro `<patient_id>/<assessment_id>/<uuid>.<ext>` e entrega por URL
 * assinada de curta duração (nunca persistida).
 */

export const REPORT_BUCKET = "bioimpedance-reports";
export const SIGNED_URL_SECONDS = 60;

async function requireOwnedAssessment(nutritionistId: string, assessmentId: string): Promise<AssessmentDetail> {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) throw new DomainError("ASSESSMENT_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, assessment.patientId);
  return assessment;
}

function nominalInstant(dateISO: string): string {
  return wallClockToInstant(dateISO, "12:00", DEFAULT_TIME_ZONE).toISOString();
}

export async function createAssessment(nutritionistId: string, patientId: string, input: AssessmentInput): Promise<{ assessmentId: string }> {
  await requireOwnedPatient(nutritionistId, patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      patient_id: patientId,
      assessment_date: input.assessmentDate,
      assessed_at: nominalInstant(input.assessmentDate),
      notes: input.notes ?? null,
      internal_notes: input.internalNotes ?? null,
      visible_to_patient: input.visibleToPatient,
      created_by: nutritionistId,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  const { error: measureError } = await supabase.rpc("set_assessment_measurements", { p_assessment_id: data.id, p_values: input.measurements });
  if (measureError) {
    // Sem medidas válidas a avaliação não deve existir "pela metade".
    await supabase.from("assessments").delete().eq("id", data.id);
    throw domainErrorFromDatabase(measureError);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "ASSESSMENT_CREATED",
    entityType: "assessment",
    entityId: data.id,
    metadata: { patient_id: patientId, metrics: input.measurements.length, visible_to_patient: input.visibleToPatient },
  });
  return { assessmentId: data.id };
}

export async function updateAssessment(nutritionistId: string, assessmentId: string, input: AssessmentInput): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (assessment.archivedAt) throw new DomainError("ASSESSMENT_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessments")
    .update({
      assessment_date: input.assessmentDate,
      assessed_at: nominalInstant(input.assessmentDate),
      notes: input.notes ?? null,
      internal_notes: input.internalNotes ?? null,
      visible_to_patient: input.visibleToPatient,
    })
    .eq("id", assessmentId);
  if (error) throw domainErrorFromDatabase(error);
  const { error: measureError } = await supabase.rpc("set_assessment_measurements", { p_assessment_id: assessmentId, p_values: input.measurements });
  if (measureError) throw domainErrorFromDatabase(measureError);

  await recordAudit({
    actorId: nutritionistId,
    action: "ASSESSMENT_UPDATED",
    entityType: "assessment",
    entityId: assessmentId,
    metadata: { patient_id: assessment.patientId, metrics: input.measurements.length, visibility_changed: assessment.visibleToPatient !== input.visibleToPatient },
  });
  if (assessment.visibleToPatient !== input.visibleToPatient) {
    await recordAudit({ actorId: nutritionistId, action: input.visibleToPatient ? "ASSESSMENT_PUBLISHED" : "ASSESSMENT_UNPUBLISHED", entityType: "assessment", entityId: assessmentId, metadata: { patient_id: assessment.patientId } });
  }
  return { patientId: assessment.patientId };
}

export async function setAssessmentVisibility(nutritionistId: string, assessmentId: string, visible: boolean): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (assessment.archivedAt) throw new DomainError("ASSESSMENT_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").update({ visible_to_patient: visible }).eq("id", assessmentId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: visible ? "ASSESSMENT_PUBLISHED" : "ASSESSMENT_UNPUBLISHED", entityType: "assessment", entityId: assessmentId, metadata: { patient_id: assessment.patientId } });
  return { patientId: assessment.patientId };
}

export async function archiveAssessment(nutritionistId: string, assessmentId: string): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (assessment.archivedAt) throw new DomainError("ASSESSMENT_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").update({ archived_at: new Date().toISOString(), archived_by: nutritionistId }).eq("id", assessmentId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "ASSESSMENT_ARCHIVED", entityType: "assessment", entityId: assessmentId, metadata: { patient_id: assessment.patientId, had_report: assessment.report !== null } });
  return { patientId: assessment.patientId };
}

/** Exclusão física só de avaliação nunca exibida ao paciente (§29); o banco também recusa. */
export async function deleteAssessment(nutritionistId: string, assessmentId: string): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (!canHardDelete(assessment)) throw new DomainError("ASSESSMENT_NOT_DELETABLE");
  const supabase = await createClient();
  if (assessment.report) {
    const { error: removeError } = await supabase.storage.from(REPORT_BUCKET).remove([assessment.report.path]);
    if (removeError) throw new DomainError("REPORT_UPLOAD_FAILED");
  }
  const { error } = await supabase.from("assessments").delete().eq("id", assessmentId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "ASSESSMENT_DELETED", entityType: "assessment", entityId: assessmentId, metadata: { patient_id: assessment.patientId } });
  return { patientId: assessment.patientId };
}

// --- Relatório de bioimpedância --------------------------------------------------

/** Assinaturas de arquivo aceitas (o MIME do browser não é confiável). */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf"; // %PDF-
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  return null;
}

/** Nome exibido: só o basename original, sem separadores/controle, limitado. */
export function safeDisplayName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? "relatorio";
  const cleaned = base.replace(/[ -<>:"|?*]/g, "").trim();
  return (cleaned || "relatorio").slice(0, 120);
}

/**
 * Anexa (ou substitui) o relatório: valida tipo pela assinatura e tamanho,
 * envia para `<patient_id>/<assessment_id>/<uuid>.<ext>`, grava os
 * metadados e só então remove o arquivo anterior (nada de órfão silencioso;
 * §24: estratégia "substituir e remover o anterior após sucesso").
 */
export async function attachReport(nutritionistId: string, assessmentId: string, file: File): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (assessment.archivedAt) throw new DomainError("ASSESSMENT_ARCHIVED");
  if (file.size <= 0 || file.size > REPORT_MAX_BYTES) throw new DomainError("REPORT_INVALID_FILE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime || !(mime in REPORT_MIME_TO_EXT)) throw new DomainError("REPORT_INVALID_FILE");
  const ext = REPORT_MIME_TO_EXT[mime]!;
  const path = `${assessment.patientId}/${assessment.id}/${randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(REPORT_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[assessments] upload do relatório falhou:", uploadError.message);
    throw new DomainError("REPORT_UPLOAD_FAILED");
  }

  const { error } = await supabase
    .from("assessments")
    .update({ report_path: path, report_name: safeDisplayName(file.name), report_mime: mime, report_size_bytes: bytes.byteLength, report_uploaded_at: new Date().toISOString() })
    .eq("id", assessmentId);
  if (error) {
    await supabase.storage.from(REPORT_BUCKET).remove([path]);
    throw domainErrorFromDatabase(error);
  }
  if (assessment.report) {
    const { error: removeError } = await supabase.storage.from(REPORT_BUCKET).remove([assessment.report.path]);
    if (removeError) console.error("[assessments] arquivo anterior não removido:", removeError.message);
  }
  await recordAudit({
    actorId: nutritionistId,
    action: "BIOIMPEDANCE_REPORT_UPLOADED",
    entityType: "assessment",
    entityId: assessmentId,
    metadata: { patient_id: assessment.patientId, mime, size_bytes: bytes.byteLength, replaced: assessment.report !== null },
  });
  return { patientId: assessment.patientId };
}

export async function removeReport(nutritionistId: string, assessmentId: string): Promise<{ patientId: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (!assessment.report) throw new DomainError("REPORT_NOT_FOUND");
  const supabase = await createClient();
  // Primeiro os metadados (o paciente perde o acesso imediatamente), depois o objeto.
  const { error } = await supabase
    .from("assessments")
    .update({ report_path: null, report_name: null, report_mime: null, report_size_bytes: null, report_uploaded_at: null })
    .eq("id", assessmentId);
  if (error) throw domainErrorFromDatabase(error);
  const { error: removeError } = await supabase.storage.from(REPORT_BUCKET).remove([assessment.report.path]);
  if (removeError) console.error("[assessments] objeto do relatório não removido:", removeError.message);
  await recordAudit({ actorId: nutritionistId, action: "BIOIMPEDANCE_REPORT_REMOVED", entityType: "assessment", entityId: assessmentId, metadata: { patient_id: assessment.patientId } });
  return { patientId: assessment.patientId };
}

/** URL assinada de curta duração para o nutricionista (ownership no servidor). */
export async function signReportForNutritionist(nutritionistId: string, assessmentId: string): Promise<{ url: string; name: string }> {
  const assessment = await requireOwnedAssessment(nutritionistId, assessmentId);
  if (!assessment.report) throw new DomainError("REPORT_NOT_FOUND");
  return signReport(assessment.report.path, assessment.report.name);
}

/** URL assinada para o paciente: só avaliação própria, visível e não arquivada (a RLS do bucket repete a regra). */
export async function signReportForPatient(patientId: string, assessmentId: string): Promise<{ url: string; name: string }> {
  const assessment = await getVisibleAssessment(patientId, assessmentId);
  if (!assessment) throw new DomainError("ASSESSMENT_NOT_VISIBLE");
  if (!assessment.report) throw new DomainError("REPORT_NOT_FOUND");
  return signReport(assessment.report.path, assessment.report.name);
}

async function signReport(path: string, name: string): Promise<{ url: string; name: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(REPORT_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, { download: name });
  if (error || !data?.signedUrl) throw new DomainError("REPORT_NOT_FOUND");
  return { url: data.signedUrl, name };
}
