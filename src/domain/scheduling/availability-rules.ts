import { timeToMinutes } from "@/lib/timezone";
import type { Modality } from "@/domain/scheduling/slots";

/**
 * Validação da disponibilidade semanal (prompt Fase 6 §6–§7), pura.
 * Regras por dia: fim > início, sem duplicata, sem sobreposição no mesmo
 * dia. Intervalos ADJACENTES (08–12 e 12–16) são permitidos e mantidos como
 * duas linhas (não consolidamos automaticamente — o nutricionista pode
 * querer modalidades diferentes em cada um); na geração de slots eles
 * funcionam como blocos independentes, e uma consulta não atravessa a
 * fronteira entre dois. Decisão registrada em docs/DECISIONS.md.
 */

export type AvailabilityRuleDraft = {
  weekday: number;
  start_time: string; // "HH:mm"
  end_time: string;
  modality: Modality | null;
  active: boolean;
};

export type AvailabilityValidationError = { index: number; message: string };

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateAvailabilityRules(rules: AvailabilityRuleDraft[]): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];

  rules.forEach((rule, index) => {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      errors.push({ index, message: "Dia da semana inválido." });
      return;
    }
    if (!TIME.test(rule.start_time) || !TIME.test(rule.end_time)) {
      errors.push({ index, message: "Horário inválido (use HH:mm)." });
      return;
    }
    if (timeToMinutes(rule.end_time) <= timeToMinutes(rule.start_time)) {
      errors.push({ index, message: "O fim precisa ser depois do início." });
    }
  });

  if (errors.length > 0) return errors;

  // Sobreposição/duplicata dentro do mesmo dia — só entre regras ativas
  // (uma regra desativada não ocupa a agenda).
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i]!;
      const b = rules[j]!;
      if (a.weekday !== b.weekday || !a.active || !b.active) continue;
      const aStart = timeToMinutes(a.start_time);
      const aEnd = timeToMinutes(a.end_time);
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      if (aStart === bStart && aEnd === bEnd) {
        errors.push({ index: j, message: "Intervalo duplicado neste dia." });
      } else if (aStart < bEnd && bStart < aEnd) {
        errors.push({ index: j, message: "Intervalo sobrepõe outro do mesmo dia." });
      }
    }
  }

  return errors;
}

/** Ordena por dia e horário — ordem estável para exibição/persistência. */
export function sortAvailabilityRules<T extends AvailabilityRuleDraft>(rules: T[]): T[] {
  return [...rules].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}
