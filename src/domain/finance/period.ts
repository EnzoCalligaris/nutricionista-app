import { addMonthsISO, daysInMonth, isValidISODate, monthBoundsISO, parseISODate, toISODate } from "@/lib/calendar";

/**
 * Períodos do financeiro (prompt Fase 7 §4/§68) em datas civis no fuso do
 * negócio — `today` é injetado (já calculado em America/Sao_Paulo).
 */
export type PeriodPreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year" | "custom";

export type Period = { preset: PeriodPreset; from: string; to: string };

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_3_months: "Últimos 3 meses",
  last_6_months: "Últimos 6 meses",
  this_year: "Ano atual",
  custom: "Personalizado",
};

export function parsePeriodPreset(value: string | null | undefined): PeriodPreset {
  return value && value in PERIOD_LABEL ? (value as PeriodPreset) : "this_month";
}

function firstDayOfMonth(iso: string): string {
  const parsed = parseISODate(iso)!;
  return toISODate({ ...parsed, day: 1 });
}

function lastDayOfMonth(iso: string): string {
  const parsed = parseISODate(iso)!;
  return toISODate({ ...parsed, day: daysInMonth(parsed.year, parsed.month) });
}

/**
 * Resolve o período. "Últimos N meses" = do 1º dia de (N-1) meses atrás até
 * o fim do mês atual (inclui o mês corrente). Personalizado exige
 * `from <= to`; inválido cai em "este mês".
 */
export function resolvePeriod(preset: PeriodPreset, today: string, custom?: { from?: string | null; to?: string | null }): Period {
  const month = monthBoundsISO(today);
  switch (preset) {
    case "this_month":
      return { preset, from: month.start, to: month.end };
    case "last_month": {
      const previous = addMonthsISO(month.start, -1);
      return { preset, from: previous, to: lastDayOfMonth(previous) };
    }
    case "last_3_months":
      return { preset, from: addMonthsISO(month.start, -2), to: month.end };
    case "last_6_months":
      return { preset, from: addMonthsISO(month.start, -5), to: month.end };
    case "this_year": {
      const year = today.slice(0, 4);
      return { preset, from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case "custom": {
      const from = custom?.from ?? "";
      const to = custom?.to ?? "";
      if (isValidISODate(from) && isValidISODate(to) && from <= to) return { preset, from, to };
      return { preset: "this_month", from: month.start, to: month.end };
    }
  }
}

export { firstDayOfMonth };
