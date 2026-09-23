import type { OnlinePaymentMethod } from "@/domain/payments/charges";
import type { ProviderChargeStatus } from "@/domain/payments/status";
import type { ProviderWebhookEvent, WebhookVerification } from "@/domain/payments/webhook";

/**
 * Abstração do gateway (prompt Fase 13 §1/§93; `docs/ARCHITECTURE.md`).
 * Nenhuma parte da aplicação fala com Mercado Pago/Asaas/Pagar.me/Stripe
 * fora de um adapter que implemente esta interface. O fornecedor real
 * continua **PENDENTE DE DEFINIÇÃO**: só o `FakePaymentProvider` existe.
 *
 * A aplicação nunca recebe número de cartão/CVV (§7/§8): o adapter real
 * deve usar checkout hospedado ou tokenização oficial no browser, e só um
 * token/URL chega ao backend.
 */

export type ProviderEnvironment = "simulated" | "sandbox" | "production";

export type CreateChargeInput = {
  /** Id interno da cobrança — vai como referência externa no provider. */
  chargeId: string;
  amountCents: number;
  currency: "BRL";
  method: OnlinePaymentMethod;
  description: string;
  /** Chave de idempotência do provider (§45). */
  idempotencyKey: string;
  /** Para onde o checkout hospedado devolve o paciente — sempre uma URL interna (§89). */
  returnUrl: string;
  payer: { name: string; email: string | null };
  expiresAt: Date | null;
  signal: AbortSignal;
};

export type ProviderCharge = {
  providerChargeId: string;
  status: ProviderChargeStatus;
  /** Checkout hospedado/tokenização do provider (cartão). Sempre https. */
  checkoutUrl?: string | null;
  /** Código "Pix copia e cola" (EMV) devolvido pelo provider. */
  pixPayload?: string | null;
  expiresAt?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  providerPaymentId?: string | null;
};

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; errorCode: ProviderErrorCode; httpStatus?: number | null; retryable: boolean };

export type ProviderErrorCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "METHOD_NOT_AVAILABLE"
  | "UNKNOWN";

export interface PaymentProvider {
  readonly id: string;
  readonly environment: ProviderEnvironment;
  /** true quando nada real acontece (fake) — a UI precisa deixar isso explícito (§4/§65). */
  readonly simulated: boolean;
  /** Métodos realmente suportados/configurados (§9/§78) — nada de fingir débito. */
  availableMethods(): readonly OnlinePaymentMethod[];
  createCharge(input: CreateChargeInput): Promise<ProviderResult<ProviderCharge>>;
  getCharge(providerChargeId: string, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>;
  cancelCharge(providerChargeId: string, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>;
  /** Verifica a assinatura do webhook sobre o BODY BRUTO (§32/§33). */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification;
  /** Normaliza o corpo já verificado em um evento do domínio; `null` quando não é um evento que nos interessa. */
  parseWebhook(rawBody: string): ProviderWebhookEvent | null;
  /** Estorno: só quando o provider real existir e a operação for suportada (§58). */
  refundCharge?(providerChargeId: string, amountCents: number, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>;
}

export class PaymentProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderConfigError";
  }
}

/** Timeout de qualquer chamada ao provider (§99). */
export const PAYMENT_PROVIDER_TIMEOUT_MS = 15_000;
