import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { addDaysISO, dayBounds, instantToDateISO, wallClockToInstant } from "@/lib/timezone";
import { generateSlots, type Modality, type Slot } from "@/domain/scheduling/slots";
import { validateAvailabilityRules } from "@/domain/scheduling/availability-rules";
import { canPatientModify, canTransition, isActive, type AppointmentStatus } from "@/domain/scheduling/state-machine";
import { getAppointmentById, type AppointmentListItem } from "@/data/appointments";
import { getAvailabilityRules, getBusyIntervals, getSchedulingSettings, type SchedulingSettings } from "@/data/scheduling";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import { recordNotificationEvent } from "@/services/notifications";
import type {
  BlockedTimeInput,
  CreateAppointmentInput,
  PatientBookingInput,
  RescheduleAppointmentInput,
  SaveAvailabilityInput,
  SchedulingSettingsInput,
  UpdateAppointmentInput,
} from "@/validators/scheduling";

/**
 * Casos de uso da agenda (prompt Fase 6 §64). O banco é a fonte final da
 * verdade: criação/reagendamento passam pelas funções SQL
 * `book_appointment`/`reschedule_appointment` (validação de disponibilidade
 * + exclusion constraint). Aqui: ownership explícito, máquina de estados,
 * auditoria e eventos internos de notificação.
 */

// --- Slots -----------------------------------------------------------------

/**
 * Horários livres de uma data (§12). O mesmo cálculo serve ao dashboard e
 * ao portal; para o paciente, `busy_intervals` (SECURITY DEFINER) garante
 * que nenhuma consulta alheia é lida.
 */
export async function getAvailableSlots(input: {
  nutritionistId: string;
  date: string;
  asPatient: boolean;
  modality?: Modality | null;
  now?: Date;
  /** Reagendamento: ignora a própria consulta ao calcular ocupação. */
  ignoreAppointment?: { startsAt: string; endsAt: string } | null;
}): Promise<{ slots: Slot[]; settings: SchedulingSettings }> {
  const settings = await getSchedulingSettings(input.nutritionistId);
  const { start, end } = dayBounds(input.date, settings.timeZone);
  const [rules, busy] = await Promise.all([
    getAvailabilityRules(input.nutritionistId),
    getBusyIntervals(input.nutritionistId, start.toISOString(), end.toISOString()),
  ]);

  const effectiveBusy = input.ignoreAppointment
    ? busy.filter(
        (interval) =>
          !(interval.starts_at === input.ignoreAppointment!.startsAt && interval.ends_at === input.ignoreAppointment!.endsAt),
      )
    : busy;

  const slots = generateSlots({
    date: input.date,
    timeZone: settings.timeZone,
    rules,
    busy: effectiveBusy,
    durationMinutes: settings.defaultDurationMinutes,
    granularityMinutes: settings.slotGranularityMinutes,
    now: input.now ?? new Date(),
    modality: input.modality ?? null,
    minNoticeHours: input.asPatient ? settings.minBookingNoticeHours : 0,
    maxHorizonDays: input.asPatient ? settings.maxBookingHorizonDays : null,
  });

  return { slots, settings };
}

// --- Ownership --------------------------------------------------------------

export async function requireOwnedAppointment(nutritionistId: string, appointmentId: string) {
  const appointment = await getAppointmentById(appointmentId);
  if (!appointment) throw new DomainError("APPOINTMENT_NOT_FOUND");
  if (appointment.nutritionistId !== nutritionistId) throw new DomainError("APPOINTMENT_NOT_AUTHORIZED");
  return appointment;
}

/** Consulta do próprio paciente (sessão) — id alheio é indistinguível de inexistente. */
export async function requirePatientAppointment(patientId: string, appointmentId: string) {
  const appointment = await getAppointmentById(appointmentId);
  if (!appointment || appointment.patientId !== patientId) throw new DomainError("APPOINTMENT_NOT_FOUND");
  return appointment;
}

// --- Nutricionista ----------------------------------------------------------

function toInstantRange(date: string, time: string, durationMinutes: number, timeZone: string) {
  const startsAt = wallClockToInstant(date, time, timeZone);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return { startsAt, endsAt };
}

export async function createAppointment(nutritionistId: string, input: CreateAppointmentInput): Promise<{ appointmentId: string }> {
  await requireOwnedPatient(nutritionistId, input.patientId);
  const settings = await getSchedulingSettings(nutritionistId);
  const { startsAt, endsAt } = toInstantRange(input.date, input.time, input.durationMinutes, settings.timeZone);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_patient_id: input.patientId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_modality: input.modality,
    ...(input.contractId ? { p_contract_id: input.contractId } : {}),
    ...(input.amountCents != null ? { p_amount_cents: input.amountCents } : {}),
    p_status: input.initialStatus,
    p_allow_outside_availability: input.allowOutsideAvailability,
  });
  if (error || !data) throw domainErrorFromDatabase(error);

  if (input.note) {
    // Observação interna: vive em appointment_notes (RLS só do nutricionista),
    // nunca numa coluna que o paciente lê.
    const { error: noteError } = await supabase.from("appointment_notes").insert({
      appointment_id: data,
      patient_id: input.patientId,
      author_id: nutritionistId,
      content: input.note,
    });
    if (noteError) console.error(`[scheduling] observação não salva para ${data}: ${noteError.message}`);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "APPOINTMENT_CREATED",
    entityType: "appointment",
    entityId: data,
    metadata: {
      patient_id: input.patientId,
      starts_at: startsAt.toISOString(),
      modality: input.modality,
      outside_availability: input.allowOutsideAvailability,
    },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_CREATED", entityType: "appointment", entityId: data });
  return { appointmentId: data };
}

/**
 * Edição de data/hora/duração/tipo (§24) SEM trocar a identidade da
 * consulta — para mudança de horário com histórico use `rescheduleAppointment`.
 * Aqui o UPDATE direto continua protegido pela exclusion constraint.
 */
export async function updateAppointment(nutritionistId: string, appointmentId: string, input: UpdateAppointmentInput): Promise<void> {
  const current = await requireOwnedAppointment(nutritionistId, appointmentId);
  if (!isActive(current.status)) throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");

  const settings = await getSchedulingSettings(nutritionistId);
  const { startsAt, endsAt } = toInstantRange(input.date, input.time, input.durationMinutes, settings.timeZone);
  if (startsAt.getTime() <= Date.now()) throw new DomainError("APPOINTMENT_IN_PAST");

  const supabase = await createClient();
  if (!input.allowOutsideAvailability) {
    const { error: windowError } = await supabase.rpc("validate_booking_window", {
      p_nutritionist_id: nutritionistId,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_modality: input.modality,
      p_as_patient: false,
    });
    if (windowError) throw domainErrorFromDatabase(windowError);
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      modality: input.modality,
      amount_cents: input.amountCents ?? null,
    })
    .eq("id", appointmentId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "APPOINTMENT_UPDATED",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { starts_at: startsAt.toISOString(), modality: input.modality, outside_availability: input.allowOutsideAvailability },
  });
}

const STATUS_AUDIT: Record<"CONFIRMED" | "COMPLETED" | "NO_SHOW", "APPOINTMENT_CONFIRMED" | "APPOINTMENT_COMPLETED" | "APPOINTMENT_NO_SHOW"> = {
  CONFIRMED: "APPOINTMENT_CONFIRMED",
  COMPLETED: "APPOINTMENT_COMPLETED",
  NO_SHOW: "APPOINTMENT_NO_SHOW",
};

export async function changeAppointmentStatus(
  nutritionistId: string,
  appointmentId: string,
  to: "CONFIRMED" | "COMPLETED" | "NO_SHOW",
): Promise<void> {
  const current = await requireOwnedAppointment(nutritionistId, appointmentId);
  if (!canTransition(current.status, to, "NUTRITIONIST")) throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: to })
    .eq("id", appointmentId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({ actorId: nutritionistId, action: STATUS_AUDIT[to], entityType: "appointment", entityId: appointmentId });
  if (to === "CONFIRMED") {
    await recordNotificationEvent({ type: "APPOINTMENT_CONFIRMED", entityType: "appointment", entityId: appointmentId });
  }
}

async function cancelRow(appointmentId: string, reason: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: reason })
    .eq("id", appointmentId);
  if (error) throw domainErrorFromDatabase(error);
}

export async function cancelAppointmentAsNutritionist(nutritionistId: string, appointmentId: string, reason: string | null): Promise<void> {
  const current = await requireOwnedAppointment(nutritionistId, appointmentId);
  if (!canTransition(current.status, "CANCELLED", "NUTRITIONIST")) throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");
  await cancelRow(appointmentId, reason);
  await recordAudit({
    actorId: nutritionistId,
    action: "APPOINTMENT_CANCELLED",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { has_reason: reason !== null },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_CANCELLED", entityType: "appointment", entityId: appointmentId });
}

async function rescheduleViaDatabase(
  appointmentId: string,
  input: { startsAt: Date; endsAt: Date; modality?: Modality; allowOutsideAvailability: boolean },
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
    ...(input.modality ? { p_modality: input.modality } : {}),
    p_allow_outside_availability: input.allowOutsideAvailability,
  });
  if (error || !data) throw domainErrorFromDatabase(error);
  return data;
}

/** Reagendamento pelo nutricionista: mantém a duração original. */
export async function rescheduleAppointmentAsNutritionist(
  nutritionistId: string,
  appointmentId: string,
  input: RescheduleAppointmentInput,
): Promise<{ newAppointmentId: string }> {
  const current = await requireOwnedAppointment(nutritionistId, appointmentId);
  if (!canTransition(current.status, "RESCHEDULED", "NUTRITIONIST")) throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");
  const settings = await getSchedulingSettings(nutritionistId);
  const durationMinutes = Math.round((new Date(current.endsAt).getTime() - new Date(current.startsAt).getTime()) / 60_000);
  const { startsAt, endsAt } = toInstantRange(input.date, input.time, durationMinutes, settings.timeZone);

  const newAppointmentId = await rescheduleViaDatabase(appointmentId, {
    startsAt,
    endsAt,
    modality: input.modality,
    allowOutsideAvailability: input.allowOutsideAvailability,
  });

  await recordAudit({
    actorId: nutritionistId,
    action: "APPOINTMENT_RESCHEDULED",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { new_appointment_id: newAppointmentId, starts_at: startsAt.toISOString() },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_RESCHEDULED", entityType: "appointment", entityId: newAppointmentId });
  return { newAppointmentId };
}

// --- Paciente ---------------------------------------------------------------

/** Dados do paciente logado + regras de elegibilidade para o portal (§41). */
export async function getPatientBookingContext(profileId: string): Promise<{
  patientId: string;
  nutritionistId: string;
  settings: SchedulingSettings;
  eligible: boolean;
  reason: "OK" | "PATIENT_INACTIVE" | "BOOKING_DISABLED";
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, nutritionist_id, status")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;

  const settings = await getSchedulingSettings(data.nutritionist_id);
  const reason = data.status !== "ACTIVE" ? "PATIENT_INACTIVE" : !settings.patientCanBook ? "BOOKING_DISABLED" : "OK";
  return { patientId: data.id, nutritionistId: data.nutritionist_id, settings, eligible: reason === "OK", reason };
}

/** Paciente agenda para si (§39–§40). patient_id vem da sessão; o banco valida tudo de novo. */
export async function bookAsPatient(
  profileId: string,
  input: PatientBookingInput,
): Promise<{ appointmentId: string }> {
  const context = await getPatientBookingContext(profileId);
  if (!context) throw new DomainError("PATIENT_NOT_FOUND");
  if (!context.eligible) throw new DomainError("PATIENT_NOT_ELIGIBLE");
  if (!context.settings.patientCanChooseModality && input.modality !== "IN_PERSON") {
    // Sem escolha liberada, a modalidade é decidida pelo nutricionista —
    // mantemos IN_PERSON como registro neutro até haver regra (PENDENTE).
    throw new DomainError("VALIDATION_ERROR", "A modalidade da consulta é definida pelo nutricionista.");
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + context.settings.defaultDurationMinutes * 60_000);

  // Revalidação server-side dos slots antes do INSERT (§45/§49): o slot
  // precisa continuar existindo agora — o banco decide de novo no INSERT.
  const date = instantToDateISO(startsAt, context.settings.timeZone);
  const { slots } = await getAvailableSlots({ nutritionistId: context.nutritionistId, date, asPatient: true, modality: input.modality });
  if (!slots.some((slot) => slot.startsAt === startsAt.toISOString())) throw new DomainError("APPOINTMENT_SLOT_UNAVAILABLE");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_patient_id: context.patientId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_modality: input.modality,
  });
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: profileId,
    action: "APPOINTMENT_CREATED",
    entityType: "appointment",
    entityId: data,
    metadata: { by: "PATIENT", starts_at: startsAt.toISOString(), modality: input.modality },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_CREATED", entityType: "appointment", entityId: data });
  return { appointmentId: data };
}

export async function rescheduleAsPatient(
  profileId: string,
  appointmentId: string,
  input: PatientBookingInput,
): Promise<{ newAppointmentId: string }> {
  const context = await getPatientBookingContext(profileId);
  if (!context) throw new DomainError("PATIENT_NOT_FOUND");
  const current = await requirePatientAppointment(context.patientId, appointmentId);
  if (
    !canPatientModify({
      status: current.status,
      startsAt: new Date(current.startsAt),
      now: new Date(),
      minCancellationNoticeHours: context.settings.minCancellationNoticeHours,
    })
  ) {
    throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");
  }

  const startsAt = new Date(input.startsAt);
  const durationMs = new Date(current.endsAt).getTime() - new Date(current.startsAt).getTime();
  const endsAt = new Date(startsAt.getTime() + durationMs);

  const date = instantToDateISO(startsAt, context.settings.timeZone);
  const { slots } = await getAvailableSlots({
    nutritionistId: context.nutritionistId,
    date,
    asPatient: true,
    modality: input.modality,
    ignoreAppointment: { startsAt: current.startsAt, endsAt: current.endsAt },
  });
  if (!slots.some((slot) => slot.startsAt === startsAt.toISOString())) throw new DomainError("APPOINTMENT_SLOT_UNAVAILABLE");

  const newAppointmentId = await rescheduleViaDatabase(appointmentId, {
    startsAt,
    endsAt,
    modality: input.modality,
    allowOutsideAvailability: false,
  });

  await recordAudit({
    actorId: profileId,
    action: "APPOINTMENT_RESCHEDULED",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { by: "PATIENT", new_appointment_id: newAppointmentId, starts_at: startsAt.toISOString() },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_RESCHEDULED", entityType: "appointment", entityId: newAppointmentId });
  return { newAppointmentId };
}

export async function cancelAsPatient(profileId: string, appointmentId: string, reason: string | null): Promise<void> {
  const context = await getPatientBookingContext(profileId);
  if (!context) throw new DomainError("PATIENT_NOT_FOUND");
  const current = await requirePatientAppointment(context.patientId, appointmentId);
  if (
    !canPatientModify({
      status: current.status,
      startsAt: new Date(current.startsAt),
      now: new Date(),
      minCancellationNoticeHours: context.settings.minCancellationNoticeHours,
    })
  ) {
    throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");
  }
  await cancelRow(appointmentId, reason);
  await recordAudit({
    actorId: profileId,
    action: "APPOINTMENT_CANCELLED",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { by: "PATIENT", has_reason: reason !== null },
  });
  await recordNotificationEvent({ type: "APPOINTMENT_CANCELLED", entityType: "appointment", entityId: appointmentId });
}

// --- Bloqueios --------------------------------------------------------------

export async function createBlockedTime(nutritionistId: string, input: BlockedTimeInput): Promise<{ blockedTimeId: string }> {
  const settings = await getSchedulingSettings(nutritionistId);
  const startsAt = input.allDay
    ? dayBounds(input.startDate, settings.timeZone).start
    : wallClockToInstant(input.startDate, input.startTime!, settings.timeZone);
  const endsAt = input.allDay
    ? dayBounds(input.endDate, settings.timeZone).end
    : wallClockToInstant(input.endDate, input.endTime!, settings.timeZone);
  if (endsAt.getTime() <= startsAt.getTime()) throw new DomainError("INVALID_AVAILABILITY", "O fim do bloqueio precisa ser depois do início.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .insert({
      nutritionist_id: nutritionistId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: input.reason ?? null,
      all_day: input.allDay,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOCKED_TIME_CREATED",
    entityType: "blocked_time",
    entityId: data.id,
    metadata: { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), all_day: input.allDay },
  });
  return { blockedTimeId: data.id };
}

export async function removeBlockedTime(nutritionistId: string, blockedTimeId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .delete()
    .eq("id", blockedTimeId)
    .eq("nutritionist_id", nutritionistId)
    .select("id");
  if (error) throw domainErrorFromDatabase(error);
  if (!data || data.length === 0) throw new DomainError("BLOCKED_TIME_NOT_FOUND");
  await recordAudit({ actorId: nutritionistId, action: "BLOCKED_TIME_REMOVED", entityType: "blocked_time", entityId: blockedTimeId });
}

// --- Disponibilidade e configuração ------------------------------------------

/**
 * Substitui o conjunto de regras semanais (§6): valida em memória
 * (`validateAvailabilityRules`), apaga as regras atuais e insere as novas.
 * Duas escritas sem transação única: regras não têm dependentes (consultas
 * já criadas não referenciam regra), então um erro no meio deixa no máximo
 * a agenda "sem regras" até o próximo salvamento — aceitável e visível.
 */
export async function saveAvailability(nutritionistId: string, input: SaveAvailabilityInput): Promise<void> {
  const errors = validateAvailabilityRules(input.rules);
  if (errors.length > 0) throw new DomainError("INVALID_AVAILABILITY", errors[0]!.message);

  const supabase = await createClient();
  const { error: deleteError } = await supabase.from("availability_rules").delete().eq("nutritionist_id", nutritionistId);
  if (deleteError) throw domainErrorFromDatabase(deleteError);

  if (input.rules.length > 0) {
    const { error: insertError } = await supabase.from("availability_rules").insert(
      input.rules.map((rule) => ({
        nutritionist_id: nutritionistId,
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
        modality: rule.modality,
        active: rule.active,
      })),
    );
    if (insertError) throw domainErrorFromDatabase(insertError);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "AVAILABILITY_UPDATED",
    entityType: "availability",
    entityId: nutritionistId,
    metadata: { rules: input.rules.length },
  });
}

export async function saveSchedulingSettings(nutritionistId: string, input: SchedulingSettingsInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("scheduling_settings").upsert({
    nutritionist_id: nutritionistId,
    default_duration_minutes: input.defaultDurationMinutes,
    slot_granularity_minutes: input.slotGranularityMinutes,
    min_booking_notice_hours: input.minBookingNoticeHours,
    min_cancellation_notice_hours: input.minCancellationNoticeHours,
    max_booking_horizon_days: input.maxBookingHorizonDays,
    patient_can_book: input.patientCanBook,
    patient_can_choose_modality: input.patientCanChooseModality,
  });
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: nutritionistId,
    action: "SCHEDULING_SETTINGS_UPDATED",
    entityType: "scheduling_settings",
    entityId: nutritionistId,
    metadata: { default_duration_minutes: input.defaultDurationMinutes, slot_granularity_minutes: input.slotGranularityMinutes },
  });
}

// --- Helpers de leitura usados pelas páginas -----------------------------------

export type { AppointmentListItem, SchedulingSettings };

/** Datas civis com pelo menos um slot livre nos próximos N dias (portal: seleção de data). */
export async function getDatesWithAvailability(input: {
  nutritionistId: string;
  fromDate: string;
  days: number;
  asPatient: boolean;
}): Promise<string[]> {
  const settings = await getSchedulingSettings(input.nutritionistId);
  const rules = await getAvailabilityRules(input.nutritionistId);
  const from = dayBounds(input.fromDate, settings.timeZone).start;
  const toDate = addDaysISO(input.fromDate, input.days);
  const to = dayBounds(toDate, settings.timeZone).start;
  const busy = await getBusyIntervals(input.nutritionistId, from.toISOString(), to.toISOString());
  const now = new Date();
  const result: string[] = [];
  for (let offset = 0; offset < input.days; offset += 1) {
    const date = addDaysISO(input.fromDate, offset);
    const slots = generateSlots({
      date,
      timeZone: settings.timeZone,
      rules,
      busy,
      durationMinutes: settings.defaultDurationMinutes,
      granularityMinutes: settings.slotGranularityMinutes,
      now,
      minNoticeHours: input.asPatient ? settings.minBookingNoticeHours : 0,
      maxHorizonDays: input.asPatient ? settings.maxBookingHorizonDays : null,
    });
    if (slots.length > 0) result.push(date);
  }
  return result;
}

/** Lookup do paciente pela sessão (para páginas do portal). */
export async function getPatientForProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("id, nutritionist_id, full_name, status").eq("profile_id", profileId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data;
}

export type { AppointmentStatus };
