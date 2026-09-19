"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { parseBRLToCents } from "@/lib/money";
import {
  appointmentIdSchema,
  appointmentStatusActionSchema,
  blockedTimeIdSchema,
  blockedTimeSchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  saveAvailabilitySchema,
  schedulingSettingsSchema,
  updateAppointmentSchema,
} from "@/validators/scheduling";
import {
  cancelAppointmentAsNutritionist,
  changeAppointmentStatus,
  createAppointment,
  createBlockedTime,
  getAvailableSlots,
  removeBlockedTime,
  rescheduleAppointmentAsNutritionist,
  requireOwnedAppointment,
  saveAvailability,
  saveSchedulingSettings,
  updateAppointment,
} from "@/services/scheduling";
import { searchPatientsForScheduling, getActiveContractsForPatient } from "@/data/appointments";
import { requireOwnedPatient } from "@/services/patients";
import { patientIdSchema } from "@/validators/patients";
import type { ActionResult } from "@/actions/patients";
import type { Slot } from "@/domain/scheduling/slots";

/**
 * Server Actions da agenda do NUTRICIONISTA (prompt Fase 6 §65): todas
 * passam por `requireNutritionist()`; ids vêm vinculados no servidor ou
 * validados como UUID e reconferidos por ownership no service; erros de
 * domínio viram mensagem — nunca o erro cru do Postgres (§74).
 */

export type SchedulingFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[scheduling] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateAgenda(extra: string[] = []) {
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  for (const path of extra) revalidatePath(path);
}

// --- Consultas ----------------------------------------------------------------

export async function createAppointmentAction(_prev: SchedulingFormState, formData: FormData): Promise<SchedulingFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    patientId: str(formData, "patientId"),
    patientName: str(formData, "patientName"),
    date: str(formData, "date"),
    time: str(formData, "time"),
    durationMinutes: str(formData, "durationMinutes"),
    modality: str(formData, "modality"),
    contractId: str(formData, "contractId"),
    amount: str(formData, "amount"),
    initialStatus: str(formData, "initialStatus") || "SCHEDULED",
    allowOutsideAvailability: formData.get("allowOutsideAvailability") === "on" ? "on" : "",
    note: str(formData, "note"),
  };

  const amountCents = values.amount.trim() === "" ? null : parseBRLToCents(values.amount);
  const parsed = createAppointmentSchema.safeParse({
    patientId: values.patientId,
    date: values.date,
    time: values.time,
    durationMinutes: Number(values.durationMinutes),
    modality: values.modality,
    contractId: values.contractId,
    amountCents: amountCents === null && values.amount.trim() !== "" ? Number.NaN : amountCents,
    initialStatus: values.initialStatus,
    allowOutsideAvailability: values.allowOutsideAvailability === "on",
    note: values.note,
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.amountCents) fieldErrors.amount = "Informe um valor válido (ex.: 230,00).";
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };
  }

  let appointmentId: string;
  try {
    ({ appointmentId } = await createAppointment(nutritionist.id, parsed.data));
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidateAgenda([`/dashboard/pacientes/${parsed.data.patientId}`]);
  redirect(`/dashboard/agenda/${appointmentId}?toast=appointment_created`);
}

export async function updateAppointmentAction(
  appointmentId: string,
  _prev: SchedulingFormState,
  formData: FormData,
): Promise<SchedulingFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    date: str(formData, "date"),
    time: str(formData, "time"),
    durationMinutes: str(formData, "durationMinutes"),
    modality: str(formData, "modality"),
    amount: str(formData, "amount"),
    allowOutsideAvailability: formData.get("allowOutsideAvailability") === "on" ? "on" : "",
  };
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { error: domainErrorMessage("APPOINTMENT_NOT_FOUND"), values };

  const amountCents = values.amount.trim() === "" ? null : parseBRLToCents(values.amount);
  const parsed = updateAppointmentSchema.safeParse({
    date: values.date,
    time: values.time,
    durationMinutes: Number(values.durationMinutes),
    modality: values.modality,
    amountCents: amountCents === null && values.amount.trim() !== "" ? Number.NaN : amountCents,
    allowOutsideAvailability: values.allowOutsideAvailability === "on",
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.amountCents) fieldErrors.amount = "Informe um valor válido (ex.: 230,00).";
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };
  }

  try {
    await updateAppointment(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidateAgenda([`/dashboard/agenda/${id.data}`]);
  redirect(`/dashboard/agenda/${id.data}?toast=appointment_updated`);
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  _prev: SchedulingFormState,
  formData: FormData,
): Promise<SchedulingFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    date: str(formData, "date"),
    time: str(formData, "time"),
    modality: str(formData, "modality"),
    allowOutsideAvailability: formData.get("allowOutsideAvailability") === "on" ? "on" : "",
  };
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { error: domainErrorMessage("APPOINTMENT_NOT_FOUND"), values };

  const parsed = rescheduleAppointmentSchema.safeParse({
    date: values.date,
    time: values.time,
    modality: values.modality || undefined,
    allowOutsideAvailability: values.allowOutsideAvailability === "on",
  });
  if (!parsed.success) {
    return { error: "Selecione um novo horário.", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  let newAppointmentId: string;
  try {
    ({ newAppointmentId } = await rescheduleAppointmentAsNutritionist(nutritionist.id, id.data, parsed.data));
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidateAgenda([`/dashboard/agenda/${id.data}`]);
  redirect(`/dashboard/agenda/${newAppointmentId}?toast=appointment_rescheduled`);
}

export async function changeAppointmentStatusAction(appointmentId: string, status: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = appointmentIdSchema.safeParse(appointmentId);
  const to = appointmentStatusActionSchema.safeParse(status);
  if (!id.success) return { ok: false, error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };
  if (!to.success) return { ok: false, error: domainErrorMessage("INVALID_APPOINTMENT_STATUS_TRANSITION") };

  try {
    await changeAppointmentStatus(nutritionist.id, id.data, to.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateAgenda([`/dashboard/agenda/${id.data}`]);
  return { ok: true };
}

export async function cancelAppointmentAction(appointmentId: string, reason: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };
  const parsed = cancelAppointmentSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  try {
    await cancelAppointmentAsNutritionist(nutritionist.id, id.data, parsed.data.reason ?? null);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateAgenda([`/dashboard/agenda/${id.data}`]);
  return { ok: true };
}

/** Slots livres de uma data para o dashboard (nova consulta / reagendamento). */
export async function getSlotsForDateAction(
  date: string,
  options: { ignoreAppointmentId?: string } = {},
): Promise<{ ok: true; slots: Slot[] } | { ok: false; error: string }> {
  const nutritionist = await requireNutritionist();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Data inválida." };
  try {
    let ignore: { startsAt: string; endsAt: string } | null = null;
    if (options.ignoreAppointmentId) {
      const current = await requireOwnedAppointment(nutritionist.id, options.ignoreAppointmentId);
      ignore = { startsAt: current.startsAt, endsAt: current.endsAt };
    }
    const { slots } = await getAvailableSlots({ nutritionistId: nutritionist.id, date, asPatient: false, ignoreAppointment: ignore });
    return { ok: true, slots };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Autocomplete de pacientes (§20): só pacientes do nutricionista autenticado, ≤ 10. */
export async function searchPatientsAction(term: string) {
  const nutritionist = await requireNutritionist();
  const safeTerm = String(term ?? "").slice(0, 80);
  return searchPatientsForScheduling(nutritionist.id, safeTerm);
}

/** Contratos ativos do paciente selecionado (§21) — ownership reconferido. */
export async function getPatientContractOptionsAction(patientId: string) {
  const nutritionist = await requireNutritionist();
  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return [];
  try {
    await requireOwnedPatient(nutritionist.id, id.data);
  } catch {
    return [];
  }
  return getActiveContractsForPatient(id.data);
}

// --- Bloqueios ----------------------------------------------------------------

export async function createBlockedTimeAction(_prev: SchedulingFormState, formData: FormData): Promise<SchedulingFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate") || str(formData, "startDate"),
    allDay: formData.get("allDay") === "on" ? "on" : "",
    startTime: str(formData, "startTime"),
    endTime: str(formData, "endTime"),
    reason: str(formData, "reason"),
  };
  const parsed = blockedTimeSchema.safeParse({
    startDate: values.startDate,
    endDate: values.endDate,
    allDay: values.allDay === "on",
    startTime: values.startTime || undefined,
    endTime: values.endTime || undefined,
    reason: values.reason,
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  try {
    await createBlockedTime(nutritionist.id, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidateAgenda(["/dashboard/agenda/configuracoes"]);
  redirect(`/dashboard/agenda?view=day&date=${parsed.data.startDate}&toast=blocked_time_created`);
}

export async function removeBlockedTimeAction(blockedTimeId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = blockedTimeIdSchema.safeParse(blockedTimeId);
  if (!id.success) return { ok: false, error: domainErrorMessage("BLOCKED_TIME_NOT_FOUND") };
  try {
    await removeBlockedTime(nutritionist.id, id.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateAgenda(["/dashboard/agenda/configuracoes"]);
  return { ok: true };
}

// --- Disponibilidade e configuração -------------------------------------------

export async function saveAvailabilityAction(rulesJson: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  let raw: unknown;
  try {
    raw = JSON.parse(rulesJson);
  } catch {
    return { ok: false, error: domainErrorMessage("VALIDATION_ERROR") };
  }
  const parsed = saveAvailabilitySchema.safeParse({ rules: raw });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  try {
    await saveAvailability(nutritionist.id, parsed.data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateAgenda(["/dashboard/agenda/configuracoes"]);
  return { ok: true };
}

export async function saveSchedulingSettingsAction(_prev: SchedulingFormState, formData: FormData): Promise<SchedulingFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    defaultDurationMinutes: str(formData, "defaultDurationMinutes"),
    slotGranularityMinutes: str(formData, "slotGranularityMinutes"),
    minBookingNoticeHours: str(formData, "minBookingNoticeHours"),
    minCancellationNoticeHours: str(formData, "minCancellationNoticeHours"),
    maxBookingHorizonDays: str(formData, "maxBookingHorizonDays"),
    patientCanBook: formData.get("patientCanBook") === "on" ? "on" : "",
    patientCanChooseModality: formData.get("patientCanChooseModality") === "on" ? "on" : "",
  };
  const optionalInt = (value: string) => (value.trim() === "" ? null : Number(value));
  const parsed = schedulingSettingsSchema.safeParse({
    defaultDurationMinutes: Number(values.defaultDurationMinutes),
    slotGranularityMinutes: Number(values.slotGranularityMinutes),
    minBookingNoticeHours: optionalInt(values.minBookingNoticeHours),
    minCancellationNoticeHours: optionalInt(values.minCancellationNoticeHours),
    maxBookingHorizonDays: optionalInt(values.maxBookingHorizonDays),
    patientCanBook: values.patientCanBook === "on",
    patientCanChooseModality: values.patientCanChooseModality === "on",
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  try {
    await saveSchedulingSettings(nutritionist.id, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateAgenda(["/dashboard/agenda/configuracoes"]);
  redirect("/dashboard/agenda/configuracoes?toast=settings_saved");
}
