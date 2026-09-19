import { addMonthsISO, daysInMonth, parseISODate, toISODate } from "@/lib/calendar";
import { addDaysISO, weekdayOfDate } from "@/lib/timezone";

/**
 * Faixas de datas civis das visões da agenda (prompt Fase 6 §14/§96). Tudo
 * em data civil no fuso do nutricionista; a conversão para instantes
 * (query no banco) acontece em `dayBounds` na borda.
 */
export type CalendarView = "day" | "week" | "month";

export function parseCalendarView(value: string | undefined): CalendarView {
  return value === "day" || value === "month" ? value : "week";
}

/** Segunda-feira da semana que contém `date` (semana começa na segunda). */
export function startOfWeekISO(date: string): string {
  const weekday = weekdayOfDate(date); // 0 = domingo
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addDaysISO(date, -offset);
}

export function weekDatesISO(date: string): string[] {
  const start = startOfWeekISO(date);
  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

/** Faixa [start, endExclusive) em datas civis para a visão. */
export function viewRange(view: CalendarView, date: string): { start: string; endExclusive: string } {
  if (view === "day") return { start: date, endExclusive: addDaysISO(date, 1) };
  if (view === "week") {
    const start = startOfWeekISO(date);
    return { start, endExclusive: addDaysISO(start, 7) };
  }
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Data inválida: ${date}`);
  const first = toISODate({ ...parsed, day: 1 });
  // Grade do mês: da segunda anterior ao dia 1 até o domingo após o último dia.
  const gridStart = startOfWeekISO(first);
  const last = toISODate({ ...parsed, day: daysInMonth(parsed.year, parsed.month) });
  const gridEnd = addDaysISO(startOfWeekISO(last), 7);
  return { start: gridStart, endExclusive: gridEnd };
}

/** Datas da grade mensal (sempre múltiplo de 7, começando na segunda). */
export function monthGridDatesISO(date: string): string[] {
  const { start, endExclusive } = viewRange("month", date);
  const dates: string[] = [];
  for (let cursor = start; cursor < endExclusive; cursor = addDaysISO(cursor, 1)) dates.push(cursor);
  return dates;
}

export function shiftDate(view: CalendarView, date: string, direction: 1 | -1): string {
  if (view === "day") return addDaysISO(date, direction);
  if (view === "week") return addDaysISO(date, 7 * direction);
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Data inválida: ${date}`);
  return addMonthsISO(toISODate({ ...parsed, day: 1 }), direction);
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
