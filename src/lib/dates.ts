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
