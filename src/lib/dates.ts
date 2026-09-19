import { siteConfig } from "@/config/site";
import { parseISODate } from "@/lib/calendar";

const longDate = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: siteConfig.timeZone,
});

// Data CIVIL não tem fuso: formatada em UTC a partir de Date.UTC para que
// "2026-03-01" nunca vire 29/02 por causa do fuso da máquina.
const civilDate = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const instantDate = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: siteConfig.timeZone,
});

const instantDateTime = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: siteConfig.timeZone,
});

/** Data por extenso em pt-BR, sempre no fuso America/Sao_Paulo (CLAUDE.md, regra 5). */
export function formatDate(iso: string): string {
  return longDate.format(new Date(iso));
}

/** Data civil ("YYYY-MM-DD", coluna `date` do Postgres) como "dd/mm/aaaa". */
export function formatCalendarDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = parseISODate(iso);
  if (!parsed) return "—";
  return civilDate.format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

/** Instante (timestamptz) como "dd/mm/aaaa" em America/Sao_Paulo. */
export function formatInstantDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return instantDate.format(new Date(iso));
}

/** Instante (timestamptz) como "dd/mm/aaaa hh:mm" em America/Sao_Paulo. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return instantDateTime.format(new Date(iso));
}

function civilDateAsUtc(iso: string): Date | null {
  const parsed = parseISODate(iso);
  return parsed ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)) : null;
}

const monthYear = new Intl.DateTimeFormat(siteConfig.locale, { month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat(siteConfig.locale, { day: "2-digit", month: "short", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat(siteConfig.locale, { weekday: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat(siteConfig.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const instantTime = new Intl.DateTimeFormat(siteConfig.locale, { hour: "2-digit", minute: "2-digit", timeZone: siteConfig.timeZone });
const instantWeekdayDate = new Intl.DateTimeFormat(siteConfig.locale, {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: siteConfig.timeZone,
});

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "setembro de 2026" -> "Setembro de 2026" (data civil). */
export function formatMonthYear(iso: string): string {
  const date = civilDateAsUtc(iso);
  return date ? capitalize(monthYear.format(date)) : "—";
}

/** "18 de set." (data civil). */
export function formatDayMonth(iso: string): string {
  const date = civilDateAsUtc(iso);
  return date ? dayMonth.format(date).replace(".", "") : "—";
}

/** "seg." -> "Seg" (data civil). */
export function formatWeekdayShort(iso: string): string {
  const date = civilDateAsUtc(iso);
  return date ? capitalize(weekdayShort.format(date).replace(".", "")) : "—";
}

/** "sexta-feira, 18 de setembro" (data civil). */
export function formatWeekdayLong(iso: string): string {
  const date = civilDateAsUtc(iso);
  return date ? capitalize(weekdayLong.format(date)) : "—";
}

/** "14:30" de um instante em America/Sao_Paulo. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return instantTime.format(new Date(iso));
}

/** "sex., 18/09" de um instante em America/Sao_Paulo. */
export function formatInstantWeekdayDate(iso: string): string {
  return capitalize(instantWeekdayDate.format(new Date(iso)).replace(".", ""));
}

/** "14:00 – 15:00". */
export function formatTimeRange(startISO: string, endISO: string): string {
  return `${formatTime(startISO)} – ${formatTime(endISO)}`;
}
