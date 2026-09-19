import { UNIT_OPTIONS } from "@/domain/meal-plans/definitions";

/**
 * Quantidades e unidades — só apresentação e parsing (prompt Fase 8
 * §13–§14): nada de conversão para gramas nem cálculo nutricional.
 */

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** "100 g", "2 unidades", "1,5 xícara", "meia fatia" não — só números. */
export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit ?? "";
  const option = UNIT_OPTIONS.find((entry) => entry.value === unit);
  const number = decimal.format(quantity);
  if (!option) return unit ? `${number} ${unit}` : number;
  const label = quantity === 1 ? option.singular : option.plural;
  return `${number} ${label}`;
}

/**
 * Entrada humana → número com até 2 casas ("1,5", "100", "0.5"). Devolve
 * null quando inválido ou ≤ 0.
 */
export function parseQuantity(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

/** Formata número opcional (calorias/macros) só quando informado. */
export function formatNutrient(value: number | null, suffix: string): string | null {
  if (value == null) return null;
  return `${decimal.format(value)} ${suffix}`;
}

export function formatTimeOfDay(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}
