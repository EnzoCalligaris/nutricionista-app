"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { paymentCheckoutRateLimiter } from "@/lib/auth/rate-limit";
import { requireNutritionist, requirePatient } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { cancelCharge, cancelChargeAsNutritionist, createChargeAsNutritionist, createInstallmentCheckout } from "@/services/payments/checkout";
import { resolveReconciliationItem, runReconciliation } from "@/services/payments/reconciliation";
import { chargeIdSchema, createCheckoutSchema, resolveReconciliationSchema } from "@/validators/payments";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions de pagamento (prompt Fase 13 §95–§97). O cliente manda
 * apenas a REFERÊNCIA (parcela/cobrança) e o método; valor, moeda,
 * paciente e provider vêm do banco. Rate limit no que é acionável por
 * pessoa — o webhook do provider não passa por aqui.
 */

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[payments] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function revalidatePayments(patientId?: string | null) {
  revalidatePath("/paciente/pagamentos", "layout");
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/reconciliacao");
  if (patientId) revalidatePath(`/dashboard/pacientes/${patientId}`);
}

// Paciente ----------------------------------------------------------------

export async function createCheckoutAction(formData: FormData): Promise<void> {
  const profile = await requirePatient();
  const parsed = createCheckoutSchema.safeParse({
    installmentId: formData.get("installmentId"),
    method: formData.get("method"),
  });
  if (!parsed.success) redirect("/paciente/pagamentos?toast=payment_invalid");

  const limit = await paymentCheckoutRateLimiter.consume(`checkout:${profile.id}`);
  if (!limit.success) redirect("/paciente/pagamentos?toast=payment_rate_limited");

  let chargeId: string;
  try {
    const charge = await createInstallmentCheckout(parsed.data);
    chargeId = charge.id;
  } catch (error) {
    console.error("[payments] checkout:", isDomainError(error) ? error.code : "erro");
    redirect(`/paciente/pagamentos/${parsed.data.installmentId}?erro=${isDomainError(error) ? error.code : "UNKNOWN"}`);
  }
  revalidatePayments();
  redirect(`/paciente/pagamentos/checkout/${chargeId}`);
}

export async function cancelChargeAction(chargeId: string): Promise<ActionResult> {
  await requirePatient();
  const id = chargeIdSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PAYMENT_NOT_FOUND") };
  try {
    await cancelCharge(id.data, "CANCELLED_BY_PATIENT");
    revalidatePayments();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// Nutricionista -----------------------------------------------------------

export async function createChargeForInstallmentAction(installmentId: string, method: "PIX" | "CARD"): Promise<ActionResult & { chargeId?: string }> {
  const nutritionist = await requireNutritionist();
  const parsed = createCheckoutSchema.safeParse({ installmentId, method });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR") };
  const limit = await paymentCheckoutRateLimiter.consume(`charge:${nutritionist.id}`);
  if (!limit.success) return { ok: false, error: domainErrorMessage("PAYMENT_RATE_LIMITED") };
  try {
    const charge = await createChargeAsNutritionist(nutritionist.id, parsed.data);
    revalidatePayments(charge.patientId);
    return { ok: true, chargeId: charge.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function cancelChargeAsNutritionistAction(chargeId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = chargeIdSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PAYMENT_NOT_FOUND") };
  try {
    const charge = await cancelChargeAsNutritionist(nutritionist.id, id.data, "CANCELLED_BY_NUTRITIONIST");
    revalidatePayments(charge.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runReconciliationAction(): Promise<ActionResult & { summary?: string }> {
  const nutritionist = await requireNutritionist();
  const limit = await paymentCheckoutRateLimiter.consume(`reconcile:${nutritionist.id}`);
  if (!limit.success) return { ok: false, error: domainErrorMessage("PAYMENT_RATE_LIMITED") };
  try {
    const result = await runReconciliation(nutritionist.id);
    revalidatePath("/dashboard/financeiro/reconciliacao");
    return {
      ok: true,
      summary: `${result.expired} cobrança(s) expirada(s), ${result.checked} verificada(s), ${result.confirmed} confirmada(s), ${result.opened} divergência(s) aberta(s).`,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function resolveReconciliationAction(itemId: string, outcome: "RESOLVED" | "IGNORED", note: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const parsed = resolveReconciliationSchema.safeParse({ itemId, outcome, note });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR") };
  try {
    await resolveReconciliationItem(nutritionist.id, parsed.data.itemId, parsed.data.note ?? null, parsed.data.outcome);
    revalidatePath("/dashboard/financeiro/reconciliacao");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
