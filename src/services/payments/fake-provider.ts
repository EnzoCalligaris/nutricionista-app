import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { defaultExpiresAt, type OnlinePaymentMethod } from "@/domain/payments/charges";
import type { ProviderChargeStatus } from "@/domain/payments/status";
import { PROVIDER_STATUS_VALUES } from "@/domain/payments/status";
import type { ProviderWebhookEvent, WebhookVerification } from "@/domain/payments/webhook";
import type { CreateChargeInput, PaymentProvider, ProviderCharge, ProviderResult } from "@/services/payments/provider";

/**
 * Provider FAKE (prompt Fase 13 §4/§65/§66/§68): determinístico, sem rede,
 * sem dado de cartão. Existe para que o produto inteiro — checkout,
 * webhook assinado, idempotência, reconciliação e financeiro — funcione e
 * seja testável antes de existir um gateway contratado.
 *
 * - `providerChargeId` é derivado do id interno: reprocessar dá o mesmo id.
 * - O "Pix copia e cola" é um texto claramente fictício (prefixo
 *   `FAKE-PIX-`), jamais um payload EMV válido — ninguém consegue pagar.
 * - Cartão: o checkout é uma PÁGINA NOSSA de simulação com botões
 *   "aprovar"/"recusar". Nunca pedimos número de cartão.
 * - O webhook simulado é assinado com HMAC-SHA256 do corpo bruto usando o
 *   mesmo segredo que o verificador exige — o caminho de produção (assinatura
 *   → idempotência → transição → baixa) é exercitado de verdade.
 */

export const FAKE_PIX_PREFIX = "FAKE-PIX-";

export function fakeProviderChargeId(chargeId: string): string {
  return `fake_ch_${createHash("sha256").update(chargeId).digest("hex").slice(0, 24)}`;
}

export function fakeProviderPaymentId(chargeId: string): string {
  return `fake_pay_${createHash("sha256").update(`payment:${chargeId}`).digest("hex").slice(0, 24)}`;
}

/** Corpo do webhook do fake: JSON estável e mínimo. */
export type FakeWebhookBody = {
  event_id: string;
  type: string;
  charge_id: string;
  payment_id?: string | null;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  occurred_at: string;
};

export function signFakeWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export class FakePaymentProvider implements PaymentProvider {
  readonly id = "fake";
  readonly environment = "simulated" as const;
  readonly simulated = true;

  constructor(
    private readonly webhookSecret: string,
    private readonly methods: readonly OnlinePaymentMethod[] = ["PIX", "CARD"],
  ) {}

  availableMethods(): readonly OnlinePaymentMethod[] {
    return this.methods;
  }

  async createCharge(input: CreateChargeInput): Promise<ProviderResult<ProviderCharge>> {
    if (!this.methods.includes(input.method)) {
      return { ok: false, errorCode: "METHOD_NOT_AVAILABLE", retryable: false };
    }
    const providerChargeId = fakeProviderChargeId(input.chargeId);
    const expiresAt = (input.expiresAt ?? defaultExpiresAt(new Date())).toISOString();
    const base: ProviderCharge = {
      providerChargeId,
      status: "PENDING",
      expiresAt,
      amountCents: input.amountCents,
      currency: input.currency,
    };
    if (input.method === "PIX") {
      // Texto propositalmente inválido como EMV: não é uma cobrança real.
      return { ok: true, data: { ...base, pixPayload: `${FAKE_PIX_PREFIX}${providerChargeId}-${input.amountCents}` } };
    }
    // Cartão: checkout simulado servido pela própria aplicação (nunca coletamos PAN/CVV).
    return { ok: true, data: { ...base, checkoutUrl: null } };
  }

  async getCharge(providerChargeId: string): Promise<ProviderResult<ProviderCharge>> {
    // O fake não guarda estado externo: quem conhece o estado é o nosso banco.
    return { ok: true, data: { providerChargeId, status: "PENDING" } };
  }

  async cancelCharge(providerChargeId: string): Promise<ProviderResult<ProviderCharge>> {
    return { ok: true, data: { providerChargeId, status: "CANCELLED" } };
  }

  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification {
    if (!this.webhookSecret) return { valid: false, reason: "MISSING_SECRET" };
    const signature = headers.get("x-payment-signature");
    if (!signature) return { valid: false, reason: "MISSING_SIGNATURE" };
    const expected = signFakeWebhook(rawBody, this.webhookSecret);
    const presented = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (presented.length !== expectedBuffer.length || !timingSafeEqual(presented, expectedBuffer)) {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }
    return { valid: true };
  }

  parseWebhook(rawBody: string): ProviderWebhookEvent | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const body = parsed as Partial<FakeWebhookBody>;
    if (typeof body.event_id !== "string" || typeof body.charge_id !== "string") return null;
    const rawStatus = typeof body.status === "string" ? body.status.toUpperCase() : "";
    // Status que não conhecemos vira UNKNOWN — nunca PAID por fallback (§28/§117).
    const status: ProviderChargeStatus = (PROVIDER_STATUS_VALUES as readonly string[]).includes(rawStatus) ? (rawStatus as ProviderChargeStatus) : "UNKNOWN";
    return {
      eventId: body.event_id,
      type: typeof body.type === "string" ? body.type : "payment.updated",
      providerChargeId: body.charge_id,
      providerPaymentId: typeof body.payment_id === "string" ? body.payment_id : null,
      status,
      amountCents: typeof body.amount_cents === "number" && Number.isInteger(body.amount_cents) ? body.amount_cents : null,
      currency: typeof body.currency === "string" ? body.currency : null,
      occurredAt: typeof body.occurred_at === "string" ? body.occurred_at : null,
    };
  }
}
