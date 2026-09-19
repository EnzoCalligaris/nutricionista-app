"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { supplementIdSchema, supplementSchema } from "@/validators/patient-content";
import { patientIdSchema } from "@/validators/patients";
import * as service from "@/services/supplements";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions dos suplementos (prompt Fase 10 §65): requireNutritionist,
 * Zod só com campos de negócio (patient_id da rota reconferido por
 * ownership; created_by/active/archived_at nunca do client), service,
 * auditoria (no service), revalidação. Toasts só após o servidor.
 */

export type SupplementFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const FIELDS = ["name", "brand", "instructions", "doseText", "scheduleText", "startsOn", "endsOn", "notes", "purchaseUrl"] as const;

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  // Nunca logar orientação/dose: só a mensagem técnica do erro.
  console.error("[supplements] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function revalidateSupplements(patientId: string) {
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath(`/dashboard/pacientes/${patientId}/suplementos`, "layout");
  revalidatePath("/paciente/suplementos");
  revalidatePath("/paciente");
}

function parseForm(formData: FormData) {
  const values: Record<string, string> = {};
  for (const field of FIELDS) values[field] = String(formData.get(field) ?? "");
  const parsed = supplementSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, values, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false as const, values, fieldErrors };
}

export async function createSupplementAction(patientId: string, _prev: SupplementFormState, formData: FormData): Promise<SupplementFormState> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  const form = parseForm(formData);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };
  try {
    await service.createSupplement(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateSupplements(id.data);
  redirect(`/dashboard/pacientes/${id.data}?tab=suplementos&toast=supplement_created`);
}

export async function updateSupplementAction(supplementId: string, patientId: string, _prev: SupplementFormState, formData: FormData): Promise<SupplementFormState> {
  const nutritionist = await requireNutritionist();
  const id = supplementIdSchema.safeParse(supplementId);
  const form = parseForm(formData);
  if (!id.success) return { error: domainErrorMessage("SUPPLEMENT_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };
  try {
    await service.updateSupplement(nutritionist.id, id.data, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateSupplements(patientId);
  redirect(`/dashboard/pacientes/${patientId}?tab=suplementos&toast=supplement_updated`);
}

async function statusAction(supplementId: string, run: (nutritionistId: string, id: string) => Promise<{ patientId: string }>): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = supplementIdSchema.safeParse(supplementId);
  if (!id.success) return { ok: false, error: domainErrorMessage("SUPPLEMENT_NOT_FOUND") };
  try {
    const result = await run(nutritionist.id, id.data);
    revalidateSupplements(result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deactivateSupplementAction(supplementId: string): Promise<ActionResult> {
  return statusAction(supplementId, service.deactivateSupplement);
}

export async function reactivateSupplementAction(supplementId: string): Promise<ActionResult> {
  return statusAction(supplementId, service.reactivateSupplement);
}

export async function archiveSupplementAction(supplementId: string): Promise<ActionResult> {
  return statusAction(supplementId, service.archiveSupplement);
}
