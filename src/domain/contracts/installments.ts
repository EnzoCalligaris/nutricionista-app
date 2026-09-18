import { addMonthsClamped, parseISODate, toISODate } from "@/lib/calendar";

/**
 * Geração de parcelas (prompt Fase 5 §37–§39). Puro e determinístico; o
 * resultado é validado de novo pela função SQL
 * `create_contract_with_installments` (soma exata, numeração 1..n).
 */

export type InstallmentDraft = {
  number: number;
  amount_cents: number;
  due_date: string; // YYYY-MM-DD
};

export const MAX_INSTALLMENTS = 24;

/**
 * Divide `totalCents` em `count` partes inteiras sem perder centavo: as
 * primeiras `resto` parcelas recebem +1 centavo.
 *   100000 / 3 => [33334, 33333, 33333]
 *      100 / 3 => [34, 33, 33]
 *    60000 / 3 => [20000, 20000, 20000]
 */
export function splitAmountCents(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new RangeError("totalCents precisa ser um inteiro >= 0");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("count precisa ser um inteiro >= 1");
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Vencimentos mensais a partir do primeiro, com o dia-âncora do primeiro
 * vencimento preservado e limitado ao último dia de cada mês
 * (`addMonthsClamped`): 31/01 -> 28/02 (ou 29/02) -> 31/03 -> 30/04.
 */
export function generateDueDates(firstDueDate: string, count: number): string[] {
  const anchor = parseISODate(firstDueDate);
  if (!anchor) throw new RangeError(`firstDueDate inválida: ${firstDueDate}`);
  return Array.from({ length: count }, (_, index) => toISODate(addMonthsClamped(anchor, index)));
}

export function generateInstallments(input: {
  totalCents: number;
  count: number;
  firstDueDate: string;
}): InstallmentDraft[] {
  const amounts = splitAmountCents(input.totalCents, input.count);
  const dueDates = generateDueDates(input.firstDueDate, input.count);
  return amounts.map((amount_cents, index) => ({
    number: index + 1,
    amount_cents,
    due_date: dueDates[index]!,
  }));
}

export function sumInstallments(installments: Pick<InstallmentDraft, "amount_cents">[]): number {
  return installments.reduce((total, installment) => total + installment.amount_cents, 0);
}
