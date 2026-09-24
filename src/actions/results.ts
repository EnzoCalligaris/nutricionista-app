"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { revalidatePublicSite } from "@/lib/revalidate";
import {
  consentIdSchema,
  consentRevokeSchema,
  mediaConsentSchema,
  resultIdSchema,
  resultSchema,
  resultSlotSchema,
} from "@/validators/results";
import * as service from "@/services/results";

/**
 * Server Actions dos resultados antes/depois (prompt Fase 14 §27–§38).
 *
 * Toda ação que muda a visibilidade pública (publicar, despublicar,
 * arquivar, revogar consentimento) revalida o site na hora — revogação
 * especialmente, que precisa tirar o resultado do ar imediatamente (§31/§49).
 */

export type ResultFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  savedAt?: number;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[results] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

function revalidateResults(resultId?: string) {
  revalidatePath("/dashboard/resultados");
  if (resultId) revalidatePath(`/dashboard/resultados/${resultId}`);
  revalidatePublicSite();
}

function parseResultForm(formData: FormData) {
  const patientId = String(formData.get("patientId") ?? "").trim();
  return resultSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    period: String(formData.get("period") ?? ""),
    imageAlt: String(formData.get("imageAlt") ?? ""),
    patientId: patientId === "" ? null : patientId,
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  });
}

export async function createResultAction(_prev: ResultFormState, formData: FormData): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    period: String(formData.get("period") ?? ""),
    imageAlt: String(formData.get("imageAlt") ?? ""),
    patientId: String(formData.get("patientId") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  };

  const parsed = parseResultForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  let created: { resultId: string };
  try {
    created = await service.createResult(nutritionist.id, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateResults(created.resultId);
  redirect(`/dashboard/resultados/${created.resultId}?toast=result_created`);
}

export async function updateResultAction(resultId: string, _prev: ResultFormState, formData: FormData): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const id = resultIdSchema.safeParse(resultId);
  if (!id.success) return { error: domainErrorMessage("RESULT_NOT_FOUND") };

  const parsed = parseResultForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  try {
    await service.updateResult(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateResults(id.data);
  return { ok: true, savedAt: Date.now() };
}

export async function uploadResultImageAction(
  resultId: string,
  slot: "before" | "after",
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const id = resultIdSchema.safeParse(resultId);
  const parsedSlot = resultSlotSchema.safeParse(slot);
  if (!id.success || !parsedSlot.success) return { error: domainErrorMessage("RESULT_NOT_FOUND") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem.", fieldErrors: { file: "Selecione uma imagem." } };
  }

  try {
    await service.uploadResultImage(nutritionist.id, id.data, parsedSlot.data, file);
  } catch (error) {
    const message = errorMessage(error);
    return { error: message, fieldErrors: { file: message } };
  }
  revalidateResults(id.data);
  return { ok: true, savedAt: Date.now() };
}

export async function registerConsentAction(resultId: string, _prev: ResultFormState, formData: FormData): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const id = resultIdSchema.safeParse(resultId);
  if (!id.success) return { error: domainErrorMessage("RESULT_NOT_FOUND") };

  const values = {
    patientId: String(formData.get("patientId") ?? ""),
    nameDisplayMode: String(formData.get("nameDisplayMode") ?? ""),
    evidenceReference: String(formData.get("evidenceReference") ?? ""),
  };

  const parsed = mediaConsentSchema.safeParse({
    patientId: values.patientId,
    nameDisplayMode: values.nameDisplayMode,
    evidenceReference: values.evidenceReference,
    acknowledged: formData.get("acknowledged") === "on",
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  try {
    await service.registerMediaConsent(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateResults(id.data);
  redirect(`/dashboard/resultados/${id.data}?toast=consent_registered`);
}

/**
 * Revoga o consentimento. Depois disto o resultado deixa de aparecer no site
 * imediatamente (a policy pública confere o consentimento) — nenhuma edição
 * manual do resultado é necessária (§31).
 */
export async function revokeConsentAction(resultId: string, consentId: string, reason: string | null): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const id = resultIdSchema.safeParse(resultId);
  const parsed = consentRevokeSchema.safeParse({ consentId, reason: reason ?? "" });
  if (!id.success || !parsed.success) return { error: domainErrorMessage("CONSENT_NOT_FOUND") };

  try {
    await service.revokeMediaConsent(nutritionist.id, parsed.data.consentId, parsed.data.reason);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateResults(id.data);
  return { ok: true, savedAt: Date.now() };
}

export async function revokeConsentFormAction(
  resultId: string,
  consentId: string,
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const reason = String(formData.get("reason") ?? "").trim();
  const parsedConsent = consentIdSchema.safeParse(consentId);
  if (!parsedConsent.success) return { error: domainErrorMessage("CONSENT_NOT_FOUND") };
  return revokeConsentAction(resultId, parsedConsent.data, reason === "" ? null : reason);
}

type ResultTransition = "publish" | "unpublish" | "archive" | "restore";

const TRANSITIONS: Record<ResultTransition, (nutritionistId: string, resultId: string) => Promise<void>> = {
  publish: service.publishResult,
  unpublish: service.unpublishResult,
  archive: service.archiveResult,
  restore: service.restoreResult,
};

export async function transitionResultAction(resultId: string, transition: ResultTransition): Promise<ResultFormState> {
  const nutritionist = await requireNutritionist();
  const id = resultIdSchema.safeParse(resultId);
  if (!id.success) return { error: domainErrorMessage("RESULT_NOT_FOUND") };

  const run = TRANSITIONS[transition];
  if (!run) return { error: domainErrorMessage("VALIDATION_ERROR") };

  try {
    await run(nutritionist.id, id.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateResults(id.data);
  return { ok: true, savedAt: Date.now() };
}
