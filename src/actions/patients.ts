"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { patientInviteRateLimiter, getClientIp } from "@/lib/auth/rate-limit";
import { authErrorMessage } from "@/lib/auth/errors";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { createPatientSchema, patientIdSchema, updatePatientSchema } from "@/validators/patients";
import {
  archivePatient,
  createPatient,
  invitePatientFromProfile,
  reactivatePatient,
  updatePatient,
} from "@/services/patients";
import type { FlashToastCode } from "@/components/shared/flash-toast";

/**
 * Server Actions de paciente (prompt Fase 5 §46): validam input (Zod),
 * autenticam (`requireNutritionist`), delegam ownership + regra ao service,
 * revalidam caminhos e mapeiam erros de domínio para mensagens — nunca o
 * erro cru do banco. IDs vêm SEMPRE como argumento vinculado no server
 * (`action.bind(null, id)`) ou são validados como UUID e reconferidos por
 * ownership no service; nunca são confiados por si só.
 */

export type PatientFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "birthDate", string>>;
  values?: Record<string, string>;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: PatientFormState["fieldErrors"] = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key === "fullName" || key === "email" || key === "phone" || key === "birthDate") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}

function formValues(formData: FormData): Record<string, string> {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    sendInvite: formData.get("sendInvite") === "on" ? "on" : "",
  };
}

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[patients] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

export async function createPatientAction(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const nutritionist = await requireNutritionist();
  const values = formValues(formData);

  const parsed = createPatientSchema.safeParse({
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    birthDate: values.birthDate,
    sendInvite: values.sendInvite === "on",
  });

  if (!parsed.success) {
    return {
      error: domainErrorMessage("VALIDATION_ERROR"),
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }

  if (parsed.data.sendInvite) {
    const ip = await getClientIp();
    const rate = await patientInviteRateLimiter.consume(`${ip}:${nutritionist.id}`);
    if (!rate.success) return { error: authErrorMessage("RATE_LIMITED"), values };
  }

  let toast: FlashToastCode;
  let patientId: string;
  try {
    const result = await createPatient(nutritionist.id, parsed.data);
    patientId = result.patientId;
    toast = !result.invite ? "patient_created" : result.invite.sent ? "patient_created_invited" : "patient_created_invite_failed";
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidatePath("/dashboard/pacientes");
  redirect(`/dashboard/pacientes/${patientId}?toast=${toast}`);
}

export async function updatePatientAction(
  patientId: string,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const nutritionist = await requireNutritionist();
  const values = formValues(formData);

  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values };

  const parsed = updatePatientSchema.safeParse({
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    birthDate: values.birthDate,
  });

  if (!parsed.success) {
    return {
      error: domainErrorMessage("VALIDATION_ERROR"),
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values,
    };
  }

  try {
    await updatePatient(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id.data}`);
  redirect(`/dashboard/pacientes/${id.data}?toast=patient_updated`);
}

export async function archivePatientAction(patientId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PATIENT_NOT_FOUND") };

  try {
    await archivePatient(nutritionist.id, id.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id.data}`);
  return { ok: true };
}

export async function reactivatePatientAction(patientId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PATIENT_NOT_FOUND") };

  try {
    await reactivatePatient(nutritionist.id, id.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id.data}`);
  return { ok: true };
}

export async function sendPortalInviteAction(patientId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PATIENT_NOT_FOUND") };

  const ip = await getClientIp();
  const rate = await patientInviteRateLimiter.consume(`${ip}:${nutritionist.id}`);
  if (!rate.success) return { ok: false, error: authErrorMessage("RATE_LIMITED") };

  try {
    await invitePatientFromProfile(nutritionist.id, id.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidatePath(`/dashboard/pacientes/${id.data}`);
  return { ok: true };
}
