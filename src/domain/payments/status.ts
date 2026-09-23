import type { ChargeStatus } from "@/domain/payments/charges";

/**
 * Tradução provider → domínio (prompt Fase 13 §27–§28/§36/§110/§117).
 *
 * Nenhum status textual do gateway circula pela aplicação: o adapter
 * devolve um `ProviderChargeStatus` já normalizado e este módulo decide a
 * transição. Status desconhecido **nunca** vira PAID (fail closed) e
 * evento atrasado nunca rebaixa um pagamento confirmado.
 */

export type ProviderChargeStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED" | "REFUNDED" | "UNKNOWN";

export const PROVIDER_STATUS_VALUES: readonly ProviderChargeStatus[] = ["PENDING", "PAID", "EXPIRED", "CANCELLED", "FAILED", "REFUNDED", "UNKNOWN"];

/**
 * Mapeia o status normalizado do provider para o status da cobrança.
 * `REFUNDED` e `UNKNOWN` não têm equivalente direto: o primeiro é tratado
 * como exceção de reconciliação (a cobrança segue PAID e o estorno é um
 * fluxo próprio), o segundo nunca confirma nada.
 */
export function mapProviderStatus(status: ProviderChargeStatus): ChargeStatus | null {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "PAID":
      return "PAID";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
      return "CANCELLED";
    case "FAILED":
      return "FAILED";
    default:
      return null;
  }
}

const RANK: Record<ChargeStatus, number> = {
  CREATED: 0,
  PENDING: 1,
  FAILED: 2,
  EXPIRED: 3,
  CANCELLED: 4,
  PAID: 5,
};

export type TransitionDecision =
  | { action: "APPLY"; next: ChargeStatus }
  | { action: "CONFIRM_PAYMENT" }
  | { action: "IGNORE"; reason: "SAME_STATUS" | "OUT_OF_ORDER" | "TERMINAL" | "UNKNOWN_STATUS" | "REFUND_NOT_SUPPORTED" };

/**
 * Decide o efeito de um evento do provider sobre a cobrança.
 *
 * - PAID sobre cobrança não paga → confirma o pagamento (atômico no banco).
 * - Evento com status "menor" que o atual (PENDING atrasado depois de PAID,
 *   §36/§110) → ignorado como fora de ordem.
 * - Cobrança já em estado final → ignorada (nada rebaixa PAID).
 * - Status desconhecido → ignorado, nunca PAID (§28/§117).
 */
export function decideChargeTransition(current: ChargeStatus, incoming: ProviderChargeStatus): TransitionDecision {
  if (incoming === "UNKNOWN") return { action: "IGNORE", reason: "UNKNOWN_STATUS" };
  if (incoming === "REFUNDED") return { action: "IGNORE", reason: "REFUND_NOT_SUPPORTED" };
  const next = mapProviderStatus(incoming);
  if (!next) return { action: "IGNORE", reason: "UNKNOWN_STATUS" };
  if (current === "PAID") return { action: "IGNORE", reason: "TERMINAL" };
  if (next === "PAID") return { action: "CONFIRM_PAYMENT" };
  if (current === next) return { action: "IGNORE", reason: "SAME_STATUS" };
  if (RANK[next] < RANK[current]) return { action: "IGNORE", reason: "OUT_OF_ORDER" };
  return { action: "APPLY", next };
}

export type ReconciliationKind =
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INSTALLMENT_ALREADY_SETTLED"
  | "UNKNOWN_PROVIDER_STATUS"
  | "PAID_WITHOUT_PAYMENT"
  | "STALE_PENDING_CHARGE"
  | "REFUND_REPORTED";

export const RECONCILIATION_KIND_LABEL: Record<ReconciliationKind, string> = {
  AMOUNT_MISMATCH: "Valor divergente do provedor",
  CURRENCY_MISMATCH: "Moeda divergente",
  INSTALLMENT_ALREADY_SETTLED: "Parcela já quitada por outro pagamento",
  UNKNOWN_PROVIDER_STATUS: "Status desconhecido do provedor",
  PAID_WITHOUT_PAYMENT: "Cobrança paga sem pagamento registrado",
  STALE_PENDING_CHARGE: "Cobrança pendente há muito tempo",
  REFUND_REPORTED: "Estorno informado pelo provedor",
};

export const RECONCILIATION_KIND_HINT: Record<ReconciliationKind, string> = {
  AMOUNT_MISMATCH: "O provedor informou um valor diferente do cobrado. Nada foi baixado — confira no painel do provedor antes de registrar o pagamento.",
  CURRENCY_MISMATCH: "O provedor informou outra moeda. Nada foi baixado.",
  INSTALLMENT_ALREADY_SETTLED: "A parcela já estava quitada (provavelmente por pagamento manual) quando o pagamento online chegou. Verifique se houve pagamento em duplicidade e devolva pelo provedor se for o caso.",
  UNKNOWN_PROVIDER_STATUS: "O provedor enviou um status que o sistema não conhece. Nada foi alterado.",
  PAID_WITHOUT_PAYMENT: "A cobrança está paga no provedor, mas não há pagamento registrado aqui.",
  STALE_PENDING_CHARGE: "Cobrança aberta há muito tempo sem retorno do provedor. Consulte o provedor para saber se foi paga.",
  REFUND_REPORTED: "O provedor informou um estorno. O estorno financeiro é registrado manualmente (Fase 7).",
};

/** Divergência aberta por um evento que NÃO pôde ser aplicado — nada é corrigido em silêncio (§55). */
export function reconciliationKindForOutcome(outcome: "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "INSTALLMENT_ALREADY_SETTLED"): ReconciliationKind {
  return outcome;
}

/** Cobrança aberta há mais de N horas sem retorno vira item de reconciliação (§53/§57). */
export const STALE_CHARGE_HOURS = 24;

export function isStalePendingCharge(input: { status: ChargeStatus; createdAt: string; expiresAt: string | null }, now: Date): boolean {
  if (input.status !== "PENDING" && input.status !== "CREATED") return false;
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= now.getTime()) return false;
  return now.getTime() - new Date(input.createdAt).getTime() >= STALE_CHARGE_HOURS * 60 * 60 * 1000;
}
