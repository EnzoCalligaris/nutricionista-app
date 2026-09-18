import { DEFAULT_TIME_ZONE } from "@/config/site";

/**
 * Aritmética de DATA DE CALENDÁRIO (strings "YYYY-MM-DD"), sem `Date` com
 * hora/fuso — datas de contrato, vencimento de parcela e nascimento são
 * datas civis (`date` no Postgres), e usar `Date` local aqui seria depender
 * do timezone da máquina (CLAUDE.md, regra 5). Tudo puro e determinístico.
 */

export type CalendarDate = { year: number; month: number; day: number }; // month 1-12

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: string): CalendarDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function toISODate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidISODate(value: string): boolean {
  return parseISODate(value) !== null;
}

export function daysInMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte = último dia do mês — Date.UTC evita fuso local.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Soma meses mantendo o DIA-ÂNCORA original e limitando ao último dia do
 * mês de destino quando ele não existe. Regra documentada (docs/DECISIONS.md,
 * Fase 5): 31/01 + 1 = 28/02 (ou 29/02), 31/01 + 2 = 31/03, 31/01 + 3 = 30/04
 * — o dia 31 "volta" nos meses que o têm, porque a âncora é a data original,
 * não a data anterior já reduzida.
 */
export function addMonthsClamped(date: CalendarDate, months: number): CalendarDate {
  const zeroBased = date.month - 1 + months;
  const year = date.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  return { year, month, day };
}

export function addMonthsISO(iso: string, months: number): string {
  const parsed = parseISODate(iso);
  if (!parsed) throw new Error(`Data inválida: ${iso}`);
  return toISODate(addMonthsClamped(parsed, months));
}

export function compareISODates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "Hoje" no fuso do negócio (America/Sao_Paulo), como "YYYY-MM-DD". */
export function todayISO(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
  // en-CA formata como YYYY-MM-DD; o fuso explícito evita depender da máquina.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Primeiro e último dia (inclusive) do mês civil de `iso` — usado para o
 * "período" do ticket médio (mês corrente em São Paulo).
 */
export function monthBoundsISO(iso: string): { start: string; end: string } {
  const parsed = parseISODate(iso);
  if (!parsed) throw new Error(`Data inválida: ${iso}`);
  return {
    start: toISODate({ ...parsed, day: 1 }),
    end: toISODate({ ...parsed, day: daysInMonth(parsed.year, parsed.month) }),
  };
}
