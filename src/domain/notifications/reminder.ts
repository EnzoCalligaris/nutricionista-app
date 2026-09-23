import { DEFAULT_TIME_ZONE } from "@/config/site";
import { addDaysISO, instantToDateISO, instantToTime, wallClockToInstant } from "@/lib/timezone";

/**
 * Lembrete de consulta ~5 dias antes (prompt Fase 12 §42–§47/§108–§112),
 * calculado em dias CIVIS do fuso configurado (America/Sao_Paulo por
 * padrão): consulta 20/10 14:00 SP → lembrete 15/10 14:00 SP, mesmo que o
 * job rode em UTC. Espelha `appointment_reminder_due_at` no banco — o
 * trigger é quem agenda; este módulo serve à UI/testes/relatórios.
 */

export const REMINDER_DAYS_BEFORE = 5;

export function reminderDueAt(startsAt: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const date = addDaysISO(instantToDateISO(startsAt, timeZone), -REMINDER_DAYS_BEFORE);
  return wallClockToInstant(date, instantToTime(startsAt, timeZone), timeZone);
}

export type ReminderDecision = { eligible: true; dueAt: Date } | { eligible: false; reason: "TOO_CLOSE" | "IN_PAST" | "INACTIVE_STATUS" };

/**
 * Consulta criada com menos de 5 dias de antecedência não recebe lembrete
 * retroativo (o evento de agendamento já comunica — §43). Só SCHEDULED /
 * CONFIRMED têm lembrete (§46).
 */
export function decideReminder(input: { startsAt: Date; status: string; now: Date; timeZone?: string }): ReminderDecision {
  if (input.status !== "SCHEDULED" && input.status !== "CONFIRMED") return { eligible: false, reason: "INACTIVE_STATUS" };
  if (input.startsAt.getTime() <= input.now.getTime()) return { eligible: false, reason: "IN_PAST" };
  const dueAt = reminderDueAt(input.startsAt, input.timeZone);
  if (dueAt.getTime() <= input.now.getTime()) return { eligible: false, reason: "TOO_CLOSE" };
  return { eligible: true, dueAt };
}
