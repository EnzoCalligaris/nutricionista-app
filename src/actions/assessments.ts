"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { instantToDateISO } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { parseDecimalPtBr } from "@/domain/assessments/numbers";
import { METRIC_VALIDATION_MESSAGE, validateMetricValue } from "@/domain/assessments/metrics";
import { assessmentIdSchema, assessmentSchema, refineNotFuture, reportFileSchema } from "@/validators/assessments";
import { getMetricTypes } from "@/data/assessments";
import * as service from "@/services/assessments";
import { patientIdSchema } from "@/validators/patients";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions das avaliações (prompt Fase 9 §57–§58): requireNutritionist,
 * Zod só com campos de negócio (patient_id da rota reconferido por
 * ownership; nutritionist_id/created_by/published_by/path/ator nunca do
 * client), service, revalidação. Valores chegam como texto pt-BR e viram
 * número aqui; a mensagem de erro fica no campo.
 */

export type AssessmentFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  // Nunca logar valores de saúde: só a mensagem técnica do erro.
  console.error("[assessments] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateAssessments(patientId: string) {
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath(`/dashboard/pacientes/${patientId}/avaliacoes`, "layout");
  revalidatePath("/dashboard/avaliacoes");
  revalidatePath("/paciente/evolucao");
  revalidatePath("/paciente");
}

/** Lê o formulário: campos `metric:<CODE>` em texto pt-BR (vazio = não informado). */
async function parseAssessmentForm(formData: FormData) {
  const types = await getMetricTypes();
  const values: Record<string, string> = {
    assessmentDate: str(formData, "assessmentDate"),
    notes: str(formData, "notes"),
    internalNotes: str(formData, "internalNotes"),
    visibleToPatient: formData.get("visibleToPatient") ? "on" : "",
  };
  const fieldErrors: Record<string, string> = {};
  const measurements: { code: string; value: number }[] = [];
  for (const type of types) {
    const raw = str(formData, `metric:${type.code}`);
    values[`metric:${type.code}`] = raw;
    if (raw.trim() === "") continue;
    const parsed = parseDecimalPtBr(raw);
    if (parsed === null) {
      fieldErrors[`metric:${type.code}`] = METRIC_VALIDATION_MESSAGE.NOT_A_NUMBER;
      continue;
    }
    const check = validateMetricValue(parsed, type.unit);
    if (check !== "OK") {
      fieldErrors[`metric:${type.code}`] = METRIC_VALIDATION_MESSAGE[check];
      continue;
    }
    measurements.push({ code: type.code, value: parsed });
  }

  const today = instantToDateISO(new Date(), DEFAULT_TIME_ZONE);
  const parsed = refineNotFuture(assessmentSchema, today).safeParse({
    assessmentDate: values.assessmentDate,
    notes: values.notes,
    internalNotes: values.internalNotes,
    visibleToPatient: values.visibleToPatient === "on",
    measurements,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  if (Object.keys(fieldErrors).length > 0 || !parsed.success) return { ok: false as const, values, fieldErrors };
  return { ok: true as const, values, data: parsed.data };
}

export async function createAssessmentAction(patientId: string, _prev: AssessmentFormState, formData: FormData): Promise<AssessmentFormState> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  const form = await parseAssessmentForm(formData);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };

  let created: { assessmentId: string };
  try {
    created = await service.createAssessment(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateAssessments(id.data);
  redirect(`/dashboard/pacientes/${id.data}/avaliacoes/${created.assessmentId}?toast=assessment_created`);
}

export async function updateAssessmentAction(assessmentId: string, patientId: string, _prev: AssessmentFormState, formData: FormData): Promise<AssessmentFormState> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  const form = await parseAssessmentForm(formData);
  if (!id.success) return { error: domainErrorMessage("ASSESSMENT_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };

  try {
    await service.updateAssessment(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateAssessments(patientId);
  redirect(`/dashboard/pacientes/${patientId}/avaliacoes/${id.data}?toast=assessment_updated`);
}

export async function setVisibilityAction(assessmentId: string, visible: boolean): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    const result = await service.setAssessmentVisibility(nutritionist.id, id.data, visible);
    revalidateAssessments(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function archiveAssessmentAction(assessmentId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    const result = await service.archiveAssessment(nutritionist.id, id.data);
    revalidateAssessments(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteAssessmentAction(assessmentId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    const result = await service.deleteAssessment(nutritionist.id, id.data);
    revalidateAssessments(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Upload do relatório (multipart via Server Action). Tipo real é conferido pela assinatura no service. */
export async function uploadReportAction(assessmentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("ASSESSMENT_NOT_FOUND") };
  const file = formData.get("report");
  if (!(file instanceof File)) return { ok: false, error: domainErrorMessage("REPORT_INVALID_FILE") };
  const meta = reportFileSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (!meta.success) return { ok: false, error: meta.error.issues[0]?.message ?? domainErrorMessage("REPORT_INVALID_FILE") };
  try {
    const result = await service.attachReport(nutritionist.id, id.data, file);
    revalidateAssessments(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function removeReportAction(assessmentId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assessmentIdSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    const result = await service.removeReport(nutritionist.id, id.data);
    revalidateAssessments(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
