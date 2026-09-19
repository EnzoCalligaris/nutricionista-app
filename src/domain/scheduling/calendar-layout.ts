import { instantToDateISO, minutesOfDay, timeToMinutes, weekdayOfDate } from "@/lib/timezone";
import type { AvailabilityRuleInput } from "@/domain/scheduling/slots";

/**
 * Geometria pura para as visões semana/dia: agrupa itens por data civil no
 * fuso e converte instantes em posição/altura em minutos. Sem React aqui.
 */

export type TimedItem = { startsAt: string; endsAt: string };

export type PositionedItem<T extends TimedItem> = T & {
  /** Minutos desde a meia-noite do dia (no fuso) — recortado ao dia. */
  topMinutes: number;
  heightMinutes: number;
};

/** Itens que tocam a data civil `date` (no fuso), com posição recortada ao dia. */
export function itemsForDate<T extends TimedItem>(items: T[], date: string, timeZone: string): PositionedItem<T>[] {
  const result: PositionedItem<T>[] = [];
  for (const item of items) {
    const start = new Date(item.startsAt);
    const end = new Date(item.endsAt);
    const startDate = instantToDateISO(start, timeZone);
    const endDate = instantToDateISO(new Date(end.getTime() - 1), timeZone);
    if (date < startDate || date > endDate) continue;
    const topMinutes = startDate === date ? minutesOfDay(start, timeZone) : 0;
    const endMinutes = endDate === date ? minutesOfDay(new Date(end.getTime() - 1), timeZone) + 1 : 24 * 60;
    result.push({ ...item, topMinutes, heightMinutes: Math.max(endMinutes - topMinutes, 1) });
  }
  return result.sort((a, b) => a.topMinutes - b.topMinutes);
}

/** Janelas de disponibilidade (minutos) de uma data, pelas regras ativas do dia da semana. */
export function availabilityWindowsForDate(rules: AvailabilityRuleInput[], date: string): { start: number; end: number }[] {
  const weekday = weekdayOfDate(date);
  return rules
    .filter((rule) => rule.active && rule.weekday === weekday)
    .map((rule) => ({ start: timeToMinutes(rule.start_time), end: timeToMinutes(rule.end_time) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Faixa de horas exibida na grade: cobre disponibilidade e consultas do
 * período, com folga de 1h, dentro de 06:00–22:00 por padrão (nunca menos
 * de 8h de altura para a grade não ficar espremida).
 */
export function visibleHourRange(input: { windows: { start: number; end: number }[]; items: PositionedItem<TimedItem>[] }): {
  startHour: number;
  endHour: number;
} {
  let min = 8 * 60;
  let max = 18 * 60;
  for (const window of input.windows) {
    min = Math.min(min, window.start);
    max = Math.max(max, window.end);
  }
  for (const item of input.items) {
    min = Math.min(min, item.topMinutes);
    max = Math.max(max, item.topMinutes + item.heightMinutes);
  }
  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(24, Math.ceil(max / 60) + 1);
  return { startHour, endHour: Math.max(endHour, startHour + 8) };
}

/** Agrupa por data civil (para a visão mês). */
export function countByDate<T extends TimedItem>(items: T[], timeZone: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const date = instantToDateISO(new Date(item.startsAt), timeZone);
    const list = map.get(date) ?? [];
    list.push(item);
    map.set(date, list);
  }
  return map;
}
