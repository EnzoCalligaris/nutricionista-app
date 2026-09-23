import "server-only";

import { siteConfig } from "@/config/site";
import { chargeIdempotencyKey, defaultExpiresAt, isChargePayable, type OnlinePaymentMethod } from "@/domain/payments/charges";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getChargeById, type ChargeDetail } from "@/data/payment-charges";
import { recordAudit } from "@/services/audit";
import { getPaymentProvider, PaymentProviderConfigError } from "@/services/payments/index";
import { PAYMENT_PROVIDER_TIMEOUT_MS } from "@/services/payments/provider";

/**
 * Checkout online (prompt Fase 13 §21–§23/§45–§49/§94).
 *
 * O valor NUNCA vem do browser: a RPC `create_installment_charge` deriva o
 * saldo restante da parcela, confere a autorização (paciente dono ou
 * nutricionista responsável) e garante **uma** cobrança ativa por parcela —
 * clique duplo, duas abas ou recarregar a página reaproveitam a mesma.
 *
 * Só depois de a cobrança existir no banco o provider é chamado; o retorno
 * (id externo, Pix copia e cola, checkout hospedado, expiração) é anexado
 * com o cliente admin, porque a cobrança já foi autorizada na RPC.
 */

type CreateCheckoutInput = {
  installmentId: string;
  method: OnlinePaymentMethod;
};

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T | "TIMEOUT"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAYMENT_PROVIDER_TIMEOUT_MS);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<"TIMEOUT">((resolve) => controller.signal.addEventListener("abort", () => resolve("TIMEOUT"), { once: true })),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function log(message: string): void {
  console.info(`[payments] ${message}`);
}

/**
 * Cria (ou reaproveita) a cobrança de uma parcela e devolve o estado atual.
 * Erros do provider nunca deixam uma cobrança "meio criada" visível como
 * pagável: a linha fica FAILED com o código técnico.
 */
export async function createInstallmentCheckout(input: CreateCheckoutInput): Promise<ChargeDetail> {
  const provider = getPaymentProvider();
  if (!provider.availableMethods().includes(input.method)) {
    throw new DomainError("PAYMENT_METHOD_NOT_AVAILABLE");
  }

  const supabase = await createClient();
  // A "tentativa" (parte da chave de idempotência) é derivada do histórico no
  // servidor: o cliente nunca escolhe — repetir o POST cai na mesma chave
  // (uma cobrança), e uma cobrança expirada/cancelada libera a próxima.
  const { count } = await supabase
    .from("payment_charges")
    .select("id", { count: "exact", head: true })
    .eq("installment_id", input.installmentId)
    .eq("method", input.method);
  const attempt = Math.min((count ?? 0) + 1, 50);
  const { data: created, error } = await supabase.rpc("create_installment_charge", {
    p_installment_id: input.installmentId,
    p_method: input.method,
    p_idempotency_key: chargeIdempotencyKey({ installmentId: input.installmentId, method: input.method, attempt }),
    p_provider: provider.id,
    p_provider_environment: provider.environment,
  });
  if (error) throw domainErrorFromDatabase(error);
  const chargeRow = Array.isArray(created) ? created[0] : created;
  if (!chargeRow) throw new DomainError("PAYMENT_NOT_FOUND");

  const existing = await getChargeById(chargeRow.id);
  if (!existing) throw new DomainError("PAYMENT_NOT_FOUND");
  // Cobrança já preparada no provider e ainda válida: reaproveita (§47).
  if (existing.providerChargeId && isChargePayable(existing, new Date())) return existing;
  if (existing.status !== "CREATED" && existing.status !== "PENDING") return existing;

  const admin = createAdminClient();
  const { data: patient } = await admin.from("patients").select("full_name, email").eq("id", existing.patientId).maybeSingle();
  const expiresAt = existing.expiresAt ? new Date(existing.expiresAt) : defaultExpiresAt(new Date());
  const result = await withTimeout((signal) =>
    provider.createCharge({
      chargeId: existing.id,
      amountCents: existing.amountCents,
      currency: "BRL",
      method: existing.method,
      description: existing.installmentNumber ? `Parcela ${existing.installmentNumber}` : "Pagamento",
      idempotencyKey: `charge:${existing.id}`,
      returnUrl: `${siteConfig.url.replace(/\/+$/, "")}/paciente/pagamentos/checkout/${existing.id}`,
      payer: { name: patient?.full_name ?? "Paciente", email: patient?.email ?? null },
      expiresAt,
      signal,
    }),
  );

  if (result === "TIMEOUT" || !result.ok) {
    const errorCode = result === "TIMEOUT" ? "PROVIDER_TIMEOUT" : result.errorCode;
    const retryable = result === "TIMEOUT" ? true : result.retryable;
    await admin
      .from("payment_charges")
      .update({ status: retryable ? "CREATED" : "FAILED", last_error_code: errorCode })
      .eq("id", existing.id)
      .in("status", ["CREATED", "PENDING"]);
    log(`cobrança ${existing.id} não foi criada no provider (${errorCode})`);
    throw new DomainError(retryable ? "PAYMENT_PROVIDER_UNAVAILABLE" : "PAYMENT_PROVIDER_UNAVAILABLE");
  }

  const charge = result.data;
  const { error: updateError } = await admin
    .from("payment_charges")
    .update({
      provider_charge_id: charge.providerChargeId,
      status: "PENDING",
      checkout_url: charge.checkoutUrl ?? null,
      pix_payload: charge.pixPayload ?? null,
      expires_at: charge.expiresAt ?? expiresAt.toISOString(),
      last_error_code: null,
    })
    .eq("id", existing.id)
    .in("status", ["CREATED", "PENDING"]);
  if (updateError) throw domainErrorFromDatabase(updateError);

  const updated = await getChargeById(existing.id);
  if (!updated) throw new DomainError("PAYMENT_NOT_FOUND");
  return updated;
}

/** Cancela uma cobrança aberta (paciente dono ou nutricionista) e avisa o provider quando possível. */
export async function cancelCharge(chargeId: string, reason: string | null): Promise<ChargeDetail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_payment_charge", { p_charge_id: chargeId, p_reason: reason ?? undefined });
  if (error) throw domainErrorFromDatabase(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DomainError("PAYMENT_NOT_FOUND");

  if (row.provider_charge_id) {
    try {
      const provider = getPaymentProvider();
      await withTimeout((signal) => provider.cancelCharge(String(row.provider_charge_id), signal));
    } catch (cause) {
      // Provider indisponível não impede o cancelamento interno: a cobrança já
      // não é pagável aqui e um webhook posterior cai na reconciliação (§52).
      log(`cancelamento no provider falhou para ${chargeId}: ${cause instanceof PaymentProviderConfigError ? "PROVIDER_NOT_CONFIGURED" : "PROVIDER_ERROR"}`);
    }
  }

  const charge = await getChargeById(chargeId);
  if (!charge) throw new DomainError("PAYMENT_NOT_FOUND");
  return charge;
}

/** Cancelamento pelo nutricionista (com auditoria). */
export async function cancelChargeAsNutritionist(nutritionistId: string, chargeId: string, reason: string | null): Promise<ChargeDetail> {
  const charge = await cancelCharge(chargeId, reason);
  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_CHARGE_CANCELLED",
    entityType: "payment_charge",
    entityId: chargeId,
    metadata: { patient_id: charge.patientId, amount_cents: charge.amountCents, method: charge.method, provider: charge.provider },
  });
  return charge;
}

/** Criação pelo nutricionista, a partir do financeiro do paciente (§61). */
export async function createChargeAsNutritionist(nutritionistId: string, input: CreateCheckoutInput): Promise<ChargeDetail> {
  const charge = await createInstallmentCheckout(input);
  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_CHARGE_CREATED",
    entityType: "payment_charge",
    entityId: charge.id,
    metadata: { patient_id: charge.patientId, installment_id: charge.installmentId, amount_cents: charge.amountCents, method: charge.method, provider: charge.provider },
  });
  return charge;
}
