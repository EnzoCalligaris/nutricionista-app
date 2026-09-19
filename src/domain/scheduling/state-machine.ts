/**
 * Máquina de estados da consulta (prompt Fase 6 §29–§32), sobre o enum REAL
 * `appointment_status` da Fase 2. Nenhum enum novo.
 *
 *   SCHEDULED  -> CONFIRMED | COMPLETED | NO_SHOW | CANCELLED | RESCHEDULED
 *   CONFIRMED  -> COMPLETED | NO_SHOW | CANCELLED | RESCHEDULED
 *   COMPLETED, NO_SHOW, CANCELLED, RESCHEDULED -> (finais)
 *
 * RESCHEDULED nunca volta a ativo: reagendar cria OUTRA consulta vinculada
 * (`rescheduled_to_id`). O paciente só cancela/reagenda (nunca confirma,
 * realiza ou marca falta — §67).
 */
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "RESCHEDULED";
export type Actor = "NUTRITIONIST" | "PATIENT";

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED", "RESCHEDULED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED", "RESCHEDULED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
  RESCHEDULED: [],
};

const PATIENT_ALLOWED: readonly AppointmentStatus[] = ["CANCELLED", "RESCHEDULED"];

export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["SCHEDULED", "CONFIRMED"];

/** Status que ocupam a agenda (mesmo predicado da exclusion constraint). */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"];

export function canTransition(from: AppointmentStatus, to: AppointmentStatus, actor: Actor): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (actor === "PATIENT" && !PATIENT_ALLOWED.includes(to)) return false;
  return true;
}

export function isActive(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isFinal(status: AppointmentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Elegibilidade para cancelar/reagendar (§68–§69): consulta ativa, futura
 * e — para o paciente — respeitando a antecedência mínima configurada
 * (NULL = sem regra; política comercial PENDENTE DE DEFINIÇÃO).
 */
export function canPatientModify(input: {
  status: AppointmentStatus;
  startsAt: Date;
  now: Date;
  minCancellationNoticeHours?: number | null;
}): boolean {
  if (!isActive(input.status)) return false;
  const noticeMs = (input.minCancellationNoticeHours ?? 0) * 3_600_000;
  return input.startsAt.getTime() > input.now.getTime() + noticeMs;
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  NO_SHOW: "Faltou",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reagendada",
};

export const MODALITY_LABEL = {
  IN_PERSON: "Presencial",
  ONLINE: "Online",
} as const;
