import { siteConfig } from "@/config/site";

const longDate = new Intl.DateTimeFormat(siteConfig.locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: siteConfig.timeZone,
});

/** Data por extenso em pt-BR, sempre no fuso America/Sao_Paulo (CLAUDE.md, regra 5). */
export function formatDate(iso: string): string {
  return longDate.format(new Date(iso));
}
