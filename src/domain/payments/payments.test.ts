import { describe, expect, it } from "vitest";
import {
  availableCheckoutMethods,
  canCreateNewCharge,
  chargeIdempotencyKey,
  defaultExpiresAt,
  installmentChargeEligibility,
  isChargeExpired,
  isChargePayable,
  maskPixPayload,
  presentChargeStatus,
  type ChargeStatus,
} from "@/domain/payments/charges";
import { decideChargeTransition, isStalePendingCharge, mapProviderStatus, PROVIDER_STATUS_VALUES, type ProviderChargeStatus } from "@/domain/payments/status";
import { checkEventAmount, isFinancialOutcome, needsReconciliation, sanitizeEventSummary, webhookEventKey } from "@/domain/payments/webhook";

const NOW = new Date("2026-10-01T12:00:00Z");

describe("elegibilidade e valor da cobrança", () => {
  it("valor cobrado é SEMPRE o saldo restante da parcela (nunca o que o cliente mandar)", () => {
    expect(installmentChargeEligibility({ installmentStatus: "PENDING", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 0 })).toEqual({ eligible: true, amountCents: 20000 });
    // Pagamento manual parcial de R$ 50 já registrado: o checkout cobra o restante integral (§50).
    expect(installmentChargeEligibility({ installmentStatus: "PENDING", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 5000 })).toEqual({ eligible: true, amountCents: 15000 });
    expect(installmentChargeEligibility({ installmentStatus: "OVERDUE", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 0 })).toEqual({ eligible: true, amountCents: 20000 });
  });

  it("parcela paga, cancelada, sem saldo ou de contrato cancelado não gera cobrança", () => {
    expect(installmentChargeEligibility({ installmentStatus: "PAID", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 20000 })).toEqual({ eligible: false, reason: "ALREADY_PAID" });
    expect(installmentChargeEligibility({ installmentStatus: "CANCELLED", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 0 })).toEqual({ eligible: false, reason: "CANCELLED" });
    expect(installmentChargeEligibility({ installmentStatus: "PENDING", contractStatus: "CANCELLED", amountCents: 20000, receivedCents: 0 })).toEqual({ eligible: false, reason: "CONTRACT_CANCELLED" });
    expect(installmentChargeEligibility({ installmentStatus: "PENDING", contractStatus: "ACTIVE", amountCents: 20000, receivedCents: 20000 })).toEqual({ eligible: false, reason: "NO_BALANCE" });
  });

  it("métodos do checkout vêm do provider — nunca hardcoded", () => {
    expect(availableCheckoutMethods(["PIX", "CARD"])).toEqual(["PIX", "CARD"]);
    expect(availableCheckoutMethods(["PIX"])).toEqual(["PIX"]);
    expect(availableCheckoutMethods([])).toEqual([]);
  });

  it("chave de idempotência é estável por parcela/método/tentativa", () => {
    const key = chargeIdempotencyKey({ installmentId: "i1", method: "PIX", attempt: 1 });
    expect(key).toBe(chargeIdempotencyKey({ installmentId: "i1", method: "PIX", attempt: 1 }));
    expect(key).not.toBe(chargeIdempotencyKey({ installmentId: "i1", method: "PIX", attempt: 2 }));
    expect(key).not.toBe(chargeIdempotencyKey({ installmentId: "i1", method: "CARD", attempt: 1 }));
  });
});

describe("expiração e reuso de cobrança", () => {
  it("cobrança vencida deixa de ser pagável mesmo antes do job", () => {
    const expired = { status: "PENDING" as ChargeStatus, expiresAt: "2026-10-01T11:59:00Z" };
    expect(isChargeExpired(expired, NOW)).toBe(true);
    expect(isChargePayable(expired, NOW)).toBe(false);
    expect(presentChargeStatus(expired, NOW)).toBe("EXPIRED");
    const valid = { status: "PENDING" as ChargeStatus, expiresAt: "2026-10-01T12:30:00Z" };
    expect(isChargePayable(valid, NOW)).toBe(true);
    expect(presentChargeStatus(valid, NOW)).toBe("PENDING");
  });

  it("nova cobrança só depois de expirar/cancelar/falhar — recarregar a tela reaproveita a válida", () => {
    expect(canCreateNewCharge(null, NOW)).toBe(true);
    expect(canCreateNewCharge({ status: "PENDING", expiresAt: "2026-10-01T12:30:00Z" }, NOW)).toBe(false);
    expect(canCreateNewCharge({ status: "PENDING", expiresAt: "2026-10-01T11:00:00Z" }, NOW)).toBe(true);
    expect(canCreateNewCharge({ status: "EXPIRED", expiresAt: null }, NOW)).toBe(true);
    expect(canCreateNewCharge({ status: "CANCELLED", expiresAt: null }, NOW)).toBe(true);
    expect(canCreateNewCharge({ status: "PAID", expiresAt: null }, NOW)).toBe(true);
  });

  it("expiração padrão do Pix e máscara do copia e cola", () => {
    expect(defaultExpiresAt(NOW).toISOString()).toBe("2026-10-01T12:30:00.000Z");
    expect(maskPixPayload(null)).toBe("—");
    const payload = "00020126580014BR.GOV.BCB.PIX0136chave-exemplo5204000053039865802BR6009SAO PAULO62070503***63041D3D";
    const masked = maskPixPayload(payload);
    expect(masked.startsWith("000201")).toBe(true);
    expect(masked).not.toContain("chave-exemplo");
  });
});

describe("mapeamento e transição de status do provider", () => {
  it("status desconhecido nunca vira PAID (fail closed)", () => {
    expect(mapProviderStatus("UNKNOWN")).toBeNull();
    expect(decideChargeTransition("PENDING", "UNKNOWN")).toEqual({ action: "IGNORE", reason: "UNKNOWN_STATUS" });
    // Qualquer string que o provider invente cai no normalizador do adapter como UNKNOWN.
    const unknownFromProvider = (PROVIDER_STATUS_VALUES.includes("SUPER_NEW_STATUS" as ProviderChargeStatus) ? "SUPER_NEW_STATUS" : "UNKNOWN") as ProviderChargeStatus;
    expect(decideChargeTransition("PENDING", unknownFromProvider).action).toBe("IGNORE");
  });

  it("PAID confirma o pagamento; PAID repetido é idempotente", () => {
    expect(decideChargeTransition("PENDING", "PAID")).toEqual({ action: "CONFIRM_PAYMENT" });
    expect(decideChargeTransition("CREATED", "PAID")).toEqual({ action: "CONFIRM_PAYMENT" });
    expect(decideChargeTransition("PAID", "PAID")).toEqual({ action: "IGNORE", reason: "TERMINAL" });
  });

  it("evento atrasado nunca rebaixa pagamento confirmado", () => {
    expect(decideChargeTransition("PAID", "PENDING")).toEqual({ action: "IGNORE", reason: "TERMINAL" });
    expect(decideChargeTransition("PAID", "EXPIRED")).toEqual({ action: "IGNORE", reason: "TERMINAL" });
    expect(decideChargeTransition("EXPIRED", "PENDING")).toEqual({ action: "IGNORE", reason: "OUT_OF_ORDER" });
    expect(decideChargeTransition("PENDING", "PENDING")).toEqual({ action: "IGNORE", reason: "SAME_STATUS" });
    expect(decideChargeTransition("CREATED", "PENDING")).toEqual({ action: "APPLY", next: "PENDING" });
    expect(decideChargeTransition("PENDING", "EXPIRED")).toEqual({ action: "APPLY", next: "EXPIRED" });
  });

  it("estorno informado pelo provider nunca mexe no financeiro sozinho (vira reconciliação)", () => {
    expect(decideChargeTransition("PAID", "REFUNDED")).toEqual({ action: "IGNORE", reason: "REFUND_NOT_SUPPORTED" });
    expect(decideChargeTransition("PENDING", "REFUNDED")).toEqual({ action: "IGNORE", reason: "REFUND_NOT_SUPPORTED" });
  });

  it("cobrança aberta há mais de 24 h entra em reconciliação", () => {
    expect(isStalePendingCharge({ status: "PENDING", createdAt: "2026-09-30T11:00:00Z", expiresAt: null }, NOW)).toBe(true);
    expect(isStalePendingCharge({ status: "PENDING", createdAt: "2026-10-01T11:00:00Z", expiresAt: null }, NOW)).toBe(false);
    expect(isStalePendingCharge({ status: "PENDING", createdAt: "2026-09-29T11:00:00Z", expiresAt: "2026-09-29T12:00:00Z" }, NOW)).toBe(false);
    expect(isStalePendingCharge({ status: "PAID", createdAt: "2026-09-01T11:00:00Z", expiresAt: null }, NOW)).toBe(false);
  });
});

describe("webhook", () => {
  const event = {
    eventId: "evt_1",
    type: "payment.updated",
    providerChargeId: "ch_1",
    providerPaymentId: "pay_1",
    status: "PAID" as ProviderChargeStatus,
    amountCents: 20000,
    currency: "BRL",
    occurredAt: "2026-10-01T11:58:00Z",
  };

  it("valor e moeda precisam bater com a cobrança", () => {
    expect(checkEventAmount(event, { amountCents: 20000, currency: "BRL" })).toEqual({ ok: true });
    expect(checkEventAmount({ ...event, amountCents: 19900 }, { amountCents: 20000, currency: "BRL" })).toEqual({ ok: false, reason: "AMOUNT_MISMATCH" });
    expect(checkEventAmount({ ...event, amountCents: null }, { amountCents: 20000, currency: "BRL" })).toEqual({ ok: false, reason: "AMOUNT_MISMATCH" });
    expect(checkEventAmount({ ...event, currency: "USD" }, { amountCents: 20000, currency: "BRL" })).toEqual({ ok: false, reason: "CURRENCY_MISMATCH" });
  });

  it("resumo persistido é sanitizado e limitado", () => {
    const summary = sanitizeEventSummary({ ...event, type: "x".repeat(200) });
    expect(String(summary.type)).toHaveLength(120);
    expect(summary).toEqual(expect.objectContaining({ status: "PAID", amount_cents: 20000, currency: "BRL", provider_charge_id: "ch_1", provider_payment_id: "pay_1" }));
    expect(Object.keys(summary)).not.toContain("payload");
  });

  it("chave do evento e classificação do resultado", () => {
    expect(webhookEventKey("fake", "evt_1")).toBe("fake:evt_1");
    expect(isFinancialOutcome("PAID")).toBe(true);
    expect(isFinancialOutcome("ALREADY_PAID")).toBe(false);
    expect(isFinancialOutcome("DUPLICATE_EVENT")).toBe(false);
    expect(needsReconciliation("AMOUNT_MISMATCH")).toBe(true);
    expect(needsReconciliation("CURRENCY_MISMATCH")).toBe(true);
    expect(needsReconciliation("INSTALLMENT_ALREADY_SETTLED")).toBe(true);
    expect(needsReconciliation("UNKNOWN_STATUS")).toBe(true);
    expect(needsReconciliation("STATUS_UPDATED")).toBe(false);
    expect(needsReconciliation("DUPLICATE_EVENT")).toBe(false);
  });
});
