import { parseISODate } from "@/lib/calendar";

/**
 * Idade nunca é armazenada (docs/DATABASE.md): calculada de `birth_date`
 * em relação a "hoje" no fuso do negócio. Puro — `today` é injetado para
 * testes determinísticos.
 */
export function calculateAge(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate) return null;
  const birth = parseISODate(birthDate);
  const now = parseISODate(today);
  if (!birth || !now) return null;
  if (birthDate > today) return null;

  let age = now.year - birth.year;
  const hadBirthdayThisYear =
    now.month > birth.month || (now.month === birth.month && now.day >= birth.day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function formatAge(age: number | null): string {
  if (age === null) return "Não informado";
  return `${age} ${age === 1 ? "ano" : "anos"}`;
}
