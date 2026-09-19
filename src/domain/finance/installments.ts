/**
 * Regras puras de parcela x pagamentos (prompt Fase 7 §27–§31). O banco
 * (`record_manual_payment`) aplica as mesmas regras; aqui elas ficam
 * testáveis e alimentam a UI (restante, status derivado, validação de
 * valor antes do envio).
 */

export type PersistedInstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

/** Status exibido: PARTIAL e OVERDUE são derivados, nunca gravados. */
export type InstallmentUiStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export const INSTALLMENT_UI_STATUS_LABEL: Record<InstallmentUiStatus, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Paga",
  OVERDUE: "Em atraso",
  CANCELLED: "Cancelada",
};

export type InstallmentBalanceInput = {
  amountCents: number;
  /** Soma dos pagamentos CONFIRMED vinculados à parcela. */
  receivedCents: number;
  status: PersistedInstallmentStatus;
  dueDate: string; // YYYY-MM-DD
};

export type InstallmentBalance = {
  receivedCents: number;
  remainingCents: number;
  uiStatus: InstallmentUiStatus;
  /** True quando ainda aceita pagamento. */
  payable: boolean;
};

export function computeInstallmentBalance(input: InstallmentBalanceInput, today: string): InstallmentBalance {
  const received = Math.max(0, input.receivedCents);
  if (input.status === "CANCELLED") {
    return { receivedCents: received, remainingCents: 0, uiStatus: "CANCELLED", payable: false };
  }
  if (input.status === "PAID" || received >= input.amountCents) {
    return { receivedCents: received, remainingCents: 0, uiStatus: "PAID", payable: false };
  }
  const remaining = input.amountCents - received;
  const overdue = input.dueDate < today;
  const uiStatus: InstallmentUiStatus = received > 0 ? "PARTIAL" : overdue ? "OVERDUE" : "PENDING";
  return { receivedCents: received, remainingCents: remaining, uiStatus, payable: true };
}

export type PaymentAllocationResult =
  | { ok: true; fullyPaid: boolean; remainingAfter: number }
  | { ok: false; reason: "NOT_PAYABLE" | "EXCEEDS_INSTALLMENT" | "INVALID_AMOUNT" };

/**
 * Aplica um pagamento a uma parcela: parcial permitido (R$ 200 − R$ 50 =
 * restante R$ 150), total quita, a maior é bloqueado (§28 — o excedente
 * deve ser registrado à parte).
 */
export function allocatePayment(balance: InstallmentBalance, amountCents: number): PaymentAllocationResult {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, reason: "INVALID_AMOUNT" };
  if (!balance.payable) return { ok: false, reason: "NOT_PAYABLE" };
  if (amountCents > balance.remainingCents) return { ok: false, reason: "EXCEEDS_INSTALLMENT" };
  const remainingAfter = balance.remainingCents - amountCents;
  return { ok: true, fullyPaid: remainingAfter === 0, remainingAfter };
}

/** Primeira parcela futura (ou vencida) ainda não quitada nem cancelada (§53). */
export function nextDueInstallment<T extends { dueDate: string; status: PersistedInstallmentStatus; remainingCents: number }>(
  installments: T[],
): T | null {
  return (
    [...installments]
      .filter((installment) => installment.status !== "CANCELLED" && installment.status !== "PAID" && installment.remainingCents > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
  );
}
