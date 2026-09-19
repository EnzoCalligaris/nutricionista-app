"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePatient } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { appointmentIdSchema, cancelAppointmentSchema, patientBookingSchema } from "@/validators/scheduling";
import { bookAsPatient, cancelAsPatient, rescheduleAsPatient } from "@/services/scheduling";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions do PORTAL DO PACIENTE (prompt Fase 6 §40/§65/§67). O
 * paciente é derivado da sessão (`requirePatient()` -> profile ->
 * patients.profile_id) — NUNCA de um patient_id enviado pelo browser. O
 * paciente só agenda, reagenda e cancela; nenhum status clínico/admin.
 */

export type BookingFormState = {
  error?: string;
  /** True quando o horário escolhido deixou de existir — a UI recarrega os slots. */
  slotUnavailable?: boolean;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[patient-booking] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

function isSlotUnavailable(error: unknown): boolean {
  return isDomainError(error) && (error.code === "APPOINTMENT_SLOT_UNAVAILABLE" || error.code === "BLOCKED_TIME_CONFLICT" || error.code === "INVALID_AVAILABILITY");
}

export async function bookAppointmentAction(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const profile = await requirePatient();
  const parsed = patientBookingSchema.safeParse({
    startsAt: String(formData.get("startsAt") ?? ""),
    modality: String(formData.get("modality") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  const rescheduleOfRaw = String(formData.get("rescheduleOf") ?? "");
  const rescheduleOf = rescheduleOfRaw ? appointmentIdSchema.safeParse(rescheduleOfRaw) : null;
  if (rescheduleOf && !rescheduleOf.success) return { error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };

  let targetId: string;
  try {
    if (rescheduleOf?.success) {
      ({ newAppointmentId: targetId } = await rescheduleAsPatient(profile.id, rescheduleOf.data, parsed.data));
    } else {
      ({ appointmentId: targetId } = await bookAsPatient(profile.id, parsed.data));
    }
  } catch (error) {
    return { error: errorMessage(error), slotUnavailable: isSlotUnavailable(error) };
  }

  revalidatePath("/paciente");
  revalidatePath("/paciente/consultas");
  revalidatePath("/dashboard/agenda");
  redirect(`/paciente/consultas?toast=${rescheduleOf ? "booking_rescheduled" : "booking_created"}&destaque=${targetId}`);
}

export async function cancelOwnAppointmentAction(appointmentId: string, reason: string): Promise<ActionResult> {
  const profile = await requirePatient();
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };
  const parsed = cancelAppointmentSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  try {
    await cancelAsPatient(profile.id, id.data, parsed.data.reason ?? null);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/paciente");
  revalidatePath("/paciente/consultas");
  revalidatePath("/dashboard/agenda");
  return { ok: true };
}
