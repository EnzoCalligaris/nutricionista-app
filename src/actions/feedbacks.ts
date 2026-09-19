"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { feedbackIdSchema, feedbackSchema } from "@/validators/patient-content";
import { patientIdSchema } from "@/validators/patients";
import * as service from "@/services/feedbacks";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions dos feedbacks (prompt Fase 10 §65): requireNutritionist,
 * Zod só com campos de negócio (patient_id da rota reconferido por
 * ownership; author_id/published_at/archived_at nunca do client), service,
 * auditoria (no service), revalidação. Paciente não escreve (não é chat).
 */

export type FeedbackFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  // Nunca logar a mensagem do feedback: só a mensagem técnica do erro.
  console.error("[feedbacks] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function revalidateFeedbacks(patientId: string) {
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath(`/dashboard/pacientes/${patientId}/feedbacks`, "layout");
  revalidatePath("/paciente/feedbacks");
  revalidatePath("/paciente");
}

/** `intent` = "draft" | "publish" (dois botões de submit, §22/§24). */
function parseForm(formData: FormData) {
  const values: Record<string, string> = {
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
    referenceDate: String(formData.get("referenceDate") ?? ""),
    intent: String(formData.get("intent") ?? "draft"),
  };
  const parsed = feedbackSchema.safeParse({ title: values.title, content: values.content, referenceDate: values.referenceDate, publish: values.intent === "publish" });
  if (parsed.success) return { ok: true as const, values, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false as const, values, fieldErrors };
}

export async function createFeedbackAction(patientId: string, _prev: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  const form = parseForm(formData);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };
  let created: { published: boolean };
  try {
    created = await service.createFeedback(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateFeedbacks(id.data);
  redirect(`/dashboard/pacientes/${id.data}?tab=feedbacks&toast=${created.published ? "feedback_published" : "feedback_saved"}`);
}

export async function updateFeedbackAction(feedbackId: string, patientId: string, _prev: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const nutritionist = await requireNutritionist();
  const id = feedbackIdSchema.safeParse(feedbackId);
  const form = parseForm(formData);
  if (!id.success) return { error: domainErrorMessage("FEEDBACK_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };
  let result: { publishedNow: boolean };
  try {
    result = await service.updateFeedback(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateFeedbacks(patientId);
  redirect(`/dashboard/pacientes/${patientId}?tab=feedbacks&toast=${result.publishedNow ? "feedback_published" : "feedback_updated"}`);
}

async function statusAction(feedbackId: string, run: (nutritionistId: string, id: string) => Promise<{ patientId: string }>): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = feedbackIdSchema.safeParse(feedbackId);
  if (!id.success) return { ok: false, error: domainErrorMessage("FEEDBACK_NOT_FOUND") };
  try {
    const result = await run(nutritionist.id, id.data);
    revalidateFeedbacks(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function publishFeedbackAction(feedbackId: string): Promise<ActionResult> {
  return statusAction(feedbackId, service.publishFeedback);
}

export async function archiveFeedbackAction(feedbackId: string): Promise<ActionResult> {
  return statusAction(feedbackId, service.archiveFeedback);
}

export async function deleteFeedbackAction(feedbackId: string): Promise<ActionResult> {
  return statusAction(feedbackId, service.deleteFeedback);
}
