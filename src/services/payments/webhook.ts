import "server-only";

import type { ChargeStatus } from "@/domain/payments/charges";
import { decideChargeTransition, isStalePendingCharge, type ReconciliationKind } from "@/domain/payments/status";
import { checkEventAmount, needsReconciliation, sanitizeEventSummary, type ProviderWebhookEvent, type WebhookProcessingOutcome } from "@/domain/payments/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { getPaymentProvider } from "@/services/payments/index";

/**
 * Processamento do webhook (prompt Fase 13 §29–§41/§109–§114).
 *
 * Regras que não se negociam:
 *  - só um evento com **assinatura válida** chega aqui (a rota verifica);
 *  - o mesmo `(provider, event_id)` produz **um** efeito financeiro
 *    (unique no banco): o décimo reenvio é `DUPLICATE_EVENT`;
 *  - evento fora de ordem nunca rebaixa um pagamento confirmado;
 *  - valor/moeda divergentes, parcela já quitada e status desconhecido
 *    **não** confirmam nada: abrem item de reconciliação;
 *  - a baixa financeira é atômica no banco (`record_online_payment`).
 *
 * Roda com o cliente admin (service role): não há sessão num webhook. A
 * autorização é a assinatura do provider + o vínculo da cobrança.
 */

type Admin = ReturnType<typeof createAdminClient>;

function log(message: string): void {
  console.info(`[payments:webhook] ${message}`);
}

async function openReconciliation(
  admin: Admin,
  input: { kind: ReconciliationKind; chargeId: string | null; paymentId?: string | null; nutritionistId: string; patientId: string | null; detail: Record<string, unknown> },
): Promise<void> {
  const { error } = await admin.from("payment_reconciliation_items").insert({
    nutritionist_id: input.nutritionistId,
    patient_id: input.patientId,
    charge_id: input.chargeId,
    payment_id: input.paymentId ?? null,
    kind: input.kind,
    detail: input.detail as Json,
  });
  // Índice único parcial: já existe um item ABERTO igual — nada a fazer.
  if (error && error.code !== "23505") log(`falha ao abrir reconciliação ${input.kind}: ${error.code ?? "?"}`);
}

export type WebhookResult = { outcome: WebhookProcessingOutcome; chargeId: string | null };

/**
 * Processa um evento já verificado. `rawBody` não é persistido: só o resumo
 * sanitizado (§38/§86).
 */
export async function processPaymentWebhookEvent(event: ProviderWebhookEvent): Promise<WebhookResult> {
  const provider = getPaymentProvider();
  const admin = createAdminClient();

  const { data: charge } = await admin
    .from("payment_charges")
    .select("id, patient_id, nutritionist_id, installment_id, amount_cents, currency, status, provider")
    .eq("provider", provider.id)
    .eq("provider_charge_id", event.providerChargeId)
    .maybeSingle();

  // Registro técnico idempotente: a unique (provider, provider_event_id) é a defesa contra reenvio.
  const { data: inserted, error: insertError } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: provider.id,
      provider_event_id: event.eventId,
      event_type: event.type.slice(0, 120),
      charge_id: charge?.id ?? null,
      provider_charge_id: event.providerChargeId.slice(0, 120),
      summary: sanitizeEventSummary(event) as Json,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      log(`evento ${event.eventId} já processado (duplicado)`);
      return { outcome: "DUPLICATE_EVENT", chargeId: charge?.id ?? null };
    }
    throw new Error(`[payments] falha ao registrar evento: ${insertError.code ?? insertError.message}`);
  }
  const eventRowId = inserted?.id ?? null;

  async function finish(outcome: WebhookProcessingOutcome, errorCode?: string): Promise<WebhookResult> {
    if (eventRowId) {
      await admin
        .from("payment_webhook_events")
        .update({
          status: outcome === "PAID" || outcome === "STATUS_UPDATED" || outcome === "ALREADY_PAID" ? "PROCESSED" : outcome === "CHARGE_NOT_FOUND" ? "FAILED" : "IGNORED",
          processed_at: new Date().toISOString(),
          error_code: errorCode ?? null,
        })
        .eq("id", eventRowId);
    }
    log(`evento ${event.eventId} (${event.type}) → ${outcome}`);
    return { outcome, chargeId: charge?.id ?? null };
  }

  if (!charge) return finish("CHARGE_NOT_FOUND", "CHARGE_NOT_FOUND");

  const decision = decideChargeTransition(charge.status as ChargeStatus, event.status);
  if (decision.action === "IGNORE") {
    if (decision.reason === "UNKNOWN_STATUS") {
      await openReconciliation(admin, {
        kind: "UNKNOWN_PROVIDER_STATUS",
        chargeId: charge.id,
        nutritionistId: charge.nutritionist_id,
        patientId: charge.patient_id,
        detail: { event_type: event.type.slice(0, 120), provider_status: "UNKNOWN" },
      });
      return finish("UNKNOWN_STATUS", "UNKNOWN_STATUS");
    }
    if (decision.reason === "REFUND_NOT_SUPPORTED") {
      await openReconciliation(admin, {
        kind: "REFUND_REPORTED",
        chargeId: charge.id,
        nutritionistId: charge.nutritionist_id,
        patientId: charge.patient_id,
        detail: { event_type: event.type.slice(0, 120), amount_cents: event.amountCents },
      });
      return finish("REFUND_REPORTED", "REFUND_REPORTED");
    }
    if (decision.reason === "TERMINAL" && charge.status === "PAID" && event.status === "PAID") return finish("ALREADY_PAID");
    if (decision.reason === "OUT_OF_ORDER" || decision.reason === "TERMINAL") return finish("OUT_OF_ORDER");
    return finish("IGNORED");
  }

  if (decision.action === "APPLY") {
    await admin.from("payment_charges").update({ status: decision.next }).eq("id", charge.id).in("status", ["CREATED", "PENDING"]);
    return finish("STATUS_UPDATED");
  }

  // CONFIRM_PAYMENT: valor e moeda precisam bater antes de tocar no financeiro.
  const amountCheck = checkEventAmount(event, { amountCents: charge.amount_cents, currency: charge.currency });
  if (!amountCheck.ok) {
    await openReconciliation(admin, {
      kind: amountCheck.reason,
      chargeId: charge.id,
      nutritionistId: charge.nutritionist_id,
      patientId: charge.patient_id,
      detail: { expected_amount_cents: charge.amount_cents, reported_amount_cents: event.amountCents, expected_currency: charge.currency, reported_currency: event.currency },
    });
    return finish(amountCheck.reason, amountCheck.reason);
  }

  const { data: outcome, error: confirmError } = await admin.rpc("record_online_payment", {
    p_charge_id: charge.id,
    p_provider_payment_id: event.providerPaymentId ?? "",
    p_amount_cents: event.amountCents ?? charge.amount_cents,
    p_currency: event.currency ?? "BRL",
    p_paid_at: event.occurredAt ?? new Date().toISOString(),
  });
  if (confirmError) {
    log(`confirmação da cobrança ${charge.id} falhou: ${confirmError.code ?? "?"}`);
    return finish("IGNORED", confirmError.code ?? "CONFIRM_FAILED");
  }

  if (outcome === "PAID") return finish("PAID");
  if (outcome === "ALREADY_PAID") return finish("ALREADY_PAID");

  const kind: ReconciliationKind = outcome === "AMOUNT_MISMATCH" ? "AMOUNT_MISMATCH" : outcome === "CURRENCY_MISMATCH" ? "CURRENCY_MISMATCH" : "INSTALLMENT_ALREADY_SETTLED";
  await openReconciliation(admin, {
    kind,
    chargeId: charge.id,
    nutritionistId: charge.nutritionist_id,
    patientId: charge.patient_id,
    detail: { outcome, amount_cents: charge.amount_cents, installment_id: charge.installment_id },
  });
  return finish(outcome as WebhookProcessingOutcome, String(outcome));
}

export type ExpireSummary = { expired: number };

/** Job: cobranças vencidas deixam de ser pagáveis (§12). */
export async function expireStaleCharges(): Promise<ExpireSummary> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_payment_charges");
  if (error) throw new Error(`[payments] expiração falhou: ${error.code ?? error.message}`);
  return { expired: typeof data === "number" ? data : 0 };
}

export type ReconcileSummary = { checked: number; opened: number; confirmed: number };

/**
 * Reconciliação server-side (§53/§56/§57): para cobranças pendentes antigas,
 * pergunta ao provider (quando o adapter suportar) e, se ele disser que foi
 * paga, confirma pelo mesmo caminho atômico. O que não for conclusivo vira
 * item de revisão — nunca é "corrigido" em silêncio.
 */
export async function reconcilePendingCharges(options: { limit?: number } = {}): Promise<ReconcileSummary> {
  const provider = getPaymentProvider();
  const admin = createAdminClient();
  const summary: ReconcileSummary = { checked: 0, opened: 0, confirmed: 0 };
  const now = new Date();

  const { data: charges } = await admin
    .from("payment_charges")
    .select("id, patient_id, nutritionist_id, provider_charge_id, amount_cents, currency, status, created_at, expires_at")
    .eq("provider", provider.id)
    .in("status", ["CREATED", "PENDING"])
    .order("created_at", { ascending: true })
    .limit(options.limit ?? 50);

  for (const charge of charges ?? []) {
    summary.checked += 1;
    if (charge.provider_charge_id && !provider.simulated) {
      const result = await provider.getCharge(charge.provider_charge_id, AbortSignal.timeout(10_000));
      if (result.ok && result.data.status === "PAID") {
        const { data: outcome } = await admin.rpc("record_online_payment", {
          p_charge_id: charge.id,
          p_provider_payment_id: result.data.providerPaymentId ?? "",
          p_amount_cents: result.data.amountCents ?? charge.amount_cents,
          p_currency: result.data.currency ?? charge.currency,
          p_paid_at: new Date().toISOString(),
        });
        if (outcome === "PAID") {
          summary.confirmed += 1;
          continue;
        }
      }
    }
    if (isStalePendingCharge({ status: charge.status as ChargeStatus, createdAt: charge.created_at, expiresAt: charge.expires_at }, now)) {
      await openReconciliation(admin, {
        kind: "STALE_PENDING_CHARGE",
        chargeId: charge.id,
        nutritionistId: charge.nutritionist_id,
        patientId: charge.patient_id,
        detail: { created_at: charge.created_at, amount_cents: charge.amount_cents },
      });
      summary.opened += 1;
    }
  }
  return summary;
}

export { needsReconciliation };
