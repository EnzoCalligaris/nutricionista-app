import { addMonthsISO } from "@/lib/calendar";

/**
 * Sugestão de término do contrato (prompt Fase 5 §33): `start_date +
 * duration_months` do plano (TRIMESTRAL +3, SEMESTRAL +6, ANUAL +12), com o
 * mesmo clamp de fim de mês das parcelas. Plano sem duração (AVULSA) não
 * ganha duração artificial: sugere o próprio dia da consulta. Em ambos os
 * casos o nutricionista revisa antes de salvar.
 */
export function suggestEndDate(startDate: string, durationMonths: number | null): string {
  if (!durationMonths || durationMonths < 1) return startDate;
  return addMonthsISO(startDate, durationMonths);
}
