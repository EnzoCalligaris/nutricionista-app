import type { ProviderChargeStatus } from "@/domain/payments/status";

/**
 * Regras puras do webhook (prompt Fase 13 §31–§38/§109–§111). A verificação
 * de assinatura em si é do adapter (depende do provider); aqui ficam as
 * decisões que valem para qualquer provider e são testáveis sem rede.
 */

export type ProviderWebhookEvent = {
  /** Id do evento no provider — chave de idempotência junto com o provider. */
  eventId: string;
  /** Tipo cru do provider, só para o registro técnico. */
  type: string;
  /** Cobrança referenciada (id do provider). */
  providerChargeId: string;
  /** Id do pagamento no provider, quando houver. */
  providerPaymentId?: string | null;
  status: ProviderChargeStatus;
  amountCents: number | null;
  currency: string | null;
  occurredAt: string | null;
};

export type WebhookVerification = { valid: true } | { valid: false; reason: "MISSING_SIGNATURE" | "INVALID_SIGNATURE" | "MISSING_SECRET" | "STALE_TIMESTAMP" };

/** Resumo sanitizado guardado em `payment_webhook_events.summary` (§38/§83/§86). */
export function sanitizeEventSummary(event: ProviderWebhookEvent): Record<string, string | number | null> {
  return {
    type: event.type.slice(0, 120),
    status: event.status,
    provider_charge_id: event.providerChargeId.slice(0, 120),
    provider_payment_id: event.providerPaymentId ? event.providerPaymentId.slice(0, 120) : null,
    amount_cents: event.amountCents,
    currency: event.currency ? event.currency.slice(0, 8) : null,
    occurred_at: event.occurredAt,
  };
}

export type WebhookProcessingOutcome =
  | "PAID"
  | "ALREADY_PAID"
  | "STATUS_UPDATED"
  | "DUPLICATE_EVENT"
  | "OUT_OF_ORDER"
  | "UNKNOWN_STATUS"
  | "CHARGE_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INSTALLMENT_ALREADY_SETTLED"
  | "REFUND_REPORTED"
  | "IGNORED";

/** Um evento só vira efeito financeiro no caso PAID; o resto é registro técnico. */
export function isFinancialOutcome(outcome: WebhookProcessingOutcome): boolean {
  return outcome === "PAID";
}

/** Outcomes que exigem decisão humana (abrem item de reconciliação). */
export function needsReconciliation(outcome: WebhookProcessingOutcome): boolean {
  return outcome === "AMOUNT_MISMATCH" || outcome === "CURRENCY_MISMATCH" || outcome === "INSTALLMENT_ALREADY_SETTLED" || outcome === "UNKNOWN_STATUS" || outcome === "REFUND_REPORTED";
}

/**
 * Valor/moeda do evento têm de bater com a cobrança (§112/§113): o provider
 * informa, o sistema valida. Divergência nunca quita em silêncio.
 */
export type AmountCheck = { ok: true } | { ok: false; reason: "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" };

export function checkEventAmount(event: Pick<ProviderWebhookEvent, "amountCents" | "currency">, charge: { amountCents: number; currency: string }): AmountCheck {
  const currency = (event.currency ?? charge.currency).toUpperCase();
  if (currency !== charge.currency.toUpperCase()) return { ok: false, reason: "CURRENCY_MISMATCH" };
  if (event.amountCents === null || event.amountCents !== charge.amountCents) return { ok: false, reason: "AMOUNT_MISMATCH" };
  return { ok: true };
}

/** Chave de idempotência do evento (§35): mesmo provider + mesmo event id = um efeito. */
export function webhookEventKey(provider: string, eventId: string): string {
  return `${provider}:${eventId}`;
}
