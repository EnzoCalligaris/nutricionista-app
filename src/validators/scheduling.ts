import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";

// Schemas Zod da agenda (prompt Fase 6 §65–§66). Só campos de negócio:
// nutritionist_id, patient_id (quando derivado da sessão), status
// privilegiado, created_at e ids internos NUNCA passam por aqui.

const isoDate = (label: string) => z.string().trim().refine(isValidISODate, { message: `${label} inválida.` });
const time = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: `${label} inválido (use HH:mm).` });

export const modalitySchema = z.enum(["IN_PERSON", "ONLINE"], { error: "Selecione presencial ou online." });

/** Nutricionista cria consulta (§19). patient_id é um guid escolhido no autocomplete e reconferido por ownership. */
export const createAppointmentSchema = z.object({
  patientId: z.guid({ error: "Selecione um paciente." }),
  date: isoDate("Data"),
  time: time("Horário"),
  durationMinutes: z.number({ error: "Informe a duração." }).int().min(10, "Mínimo de 10 minutos.").max(480, "Máximo de 8 horas."),
  modality: modalitySchema,
  contractId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || z.guid().safeParse(value).success, { message: "Contrato inválido." }),
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  initialStatus: z.enum(["SCHEDULED", "CONFIRMED"]).default("SCHEDULED"),
  allowOutsideAvailability: z.boolean().default(false),
  note: z
    .string()
    .trim()
    .max(2000, "Observação muito longa.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
});

/** Nutricionista edita data/hora/duração/tipo (§24) — sempre revalidado no banco. */
export const updateAppointmentSchema = z.object({
  date: isoDate("Data"),
  time: time("Horário"),
  durationMinutes: z.number({ error: "Informe a duração." }).int().min(10).max(480),
  modality: modalitySchema,
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  allowOutsideAvailability: z.boolean().default(false),
});

/** Reagendamento (§25) — nutricionista ou paciente; o paciente não pode override. */
export const rescheduleAppointmentSchema = z.object({
  date: isoDate("Data"),
  time: time("Horário"),
  modality: modalitySchema.optional(),
  allowOutsideAvailability: z.boolean().default(false),
});

export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Motivo muito longo.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional(),
});

export const appointmentStatusActionSchema = z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]);

/** Paciente agenda (§39–§40): só horário e tipo — patient_id vem da sessão. */
export const patientBookingSchema = z.object({
  startsAt: z.iso.datetime({ offset: true, error: "Selecione um horário." }),
  modality: modalitySchema,
});

export const blockedTimeSchema = z
  .object({
    startDate: isoDate("Data inicial"),
    endDate: isoDate("Data final"),
    allDay: z.boolean().default(false),
    startTime: time("Horário inicial").optional(),
    endTime: time("Horário final").optional(),
    reason: z
      .string()
      .trim()
      .max(200, "Motivo muito longo.")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional(),
  })
  .refine((data) => data.endDate >= data.startDate, { message: "A data final não pode ser anterior à inicial.", path: ["endDate"] })
  .refine((data) => data.allDay || (data.startTime && data.endTime), {
    message: "Informe o horário inicial e final ou marque dia inteiro.",
    path: ["startTime"],
  });

export const availabilityRuleDraftSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: time("Início"),
  end_time: time("Fim"),
  modality: modalitySchema.nullable(),
  active: z.boolean(),
});

export const saveAvailabilitySchema = z.object({
  rules: z.array(availabilityRuleDraftSchema).max(50, "Muitos intervalos."),
});

export const schedulingSettingsSchema = z.object({
  defaultDurationMinutes: z.number().int().min(10, "Mínimo de 10 minutos.").max(480, "Máximo de 8 horas."),
  slotGranularityMinutes: z.number().int().min(5, "Mínimo de 5 minutos.").max(240, "Máximo de 4 horas."),
  minBookingNoticeHours: z.number().int().min(0).max(720).nullable(),
  minCancellationNoticeHours: z.number().int().min(0).max(720).nullable(),
  maxBookingHorizonDays: z.number().int().min(1).max(365).nullable(),
  patientCanBook: z.boolean(),
  patientCanChooseModality: z.boolean(),
});

export const appointmentIdSchema = z.guid({ error: "Identificador de consulta inválido." });
export const blockedTimeIdSchema = z.guid({ error: "Identificador de bloqueio inválido." });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type PatientBookingInput = z.infer<typeof patientBookingSchema>;
export type BlockedTimeInput = z.infer<typeof blockedTimeSchema>;
export type SaveAvailabilityInput = z.infer<typeof saveAvailabilitySchema>;
export type SchedulingSettingsInput = z.infer<typeof schedulingSettingsSchema>;
