import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { wallClockToInstant } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { isTransactionCancellable, isTransactionEditable } from "@/domain/finance/definitions";
import { getTransactionById } from "@/data/financial";
import { getPaymentById } from "@/data/payments";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import type { ManualTransactionInput, RecordPaymentInput } from "@/validators/finance";

/**
 * Casos de uso do financeiro (prompt Fase 7 §61). Escrita transacional de
 * pagamento pelas funções SQL (`record_manual_payment`/`cancel_payment`);
 * lançamentos manuais via RLS escopada por `nutritionist_id`; ownership
 * explícito antes de qualquer escrita; auditoria com metadata mínima.
 */

async function patientOwnedOrNull(nutritionistId: string, patientId: string | null | undefined) {
  if (!patientId) return null;
  await requireOwnedPatient(nutritionistId, patientId);
  return patientId;
}

function noonInstant(dateISO: string): string {
  // Lançamento manual tem data civil; `paid_at` só marca o instante nominal.
  return wallClockToInstant(dateISO, "12:00", DEFAULT_TIME_ZONE).toISOString();
}

export async function createManualTransaction(nutritionistId: string, input: ManualTransactionInput): Promise<{ transactionId: string }> {
  const patientId = await patientOwnedOrNull(nutritionistId, input.patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      nutritionist_id: nutritionistId,
      patient_id: patientId,
      type: input.type,
      category_id: input.categoryId ?? null,
      description: input.description,
      amount_cents: input.amountCents,
      status: input.status,
      occurred_on: input.occurredOn,
      due_on: input.dueOn ?? null,
      paid_at: input.status === "CONFIRMED" ? noonInstant(input.occurredOn) : null,
      payment_method: input.paymentMethod ?? null,
      origin: "MANUAL",
      created_by: nutritionistId,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "FINANCIAL_TRANSACTION_CREATED",
    entityType: "financial_transaction",
    entityId: data.id,
    metadata: { type: input.type, amount_cents: input.amountCents, status: input.status },
  });
  return { transactionId: data.id };
}

export async function updateManualTransaction(
  nutritionistId: string,
  transactionId: string,
  input: ManualTransactionInput,
  today: string,
): Promise<void> {
  const current = await getTransactionById(nutritionistId, transactionId, today);
  if (!current) throw new DomainError("FINANCIAL_TRANSACTION_NOT_FOUND");
  if (!isTransactionEditable(current.origin, current.status)) throw new DomainError("FINANCIAL_TRANSACTION_NOT_EDITABLE");
  const patientId = await patientOwnedOrNull(nutritionistId, input.patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_transactions")
    .update({
      patient_id: patientId,
      type: input.type,
      category_id: input.categoryId ?? null,
      description: input.description,
      amount_cents: input.amountCents,
      status: input.status,
      occurred_on: input.occurredOn,
      due_on: input.dueOn ?? null,
      paid_at: input.status === "CONFIRMED" ? (current.paidAt ?? noonInstant(input.occurredOn)) : null,
      payment_method: input.paymentMethod ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", transactionId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "FINANCIAL_TRANSACTION_UPDATED",
    entityType: "financial_transaction",
    entityId: transactionId,
    metadata: { type: input.type, amount_cents: input.amountCents, status: input.status },
  });
}

/** Cancela lançamento MANUAL (§21): status CANCELLED, nada apagado. */
export async function cancelManualTransaction(nutritionistId: string, transactionId: string, reason: string | null, today: string): Promise<void> {
  const current = await getTransactionById(nutritionistId, transactionId, today);
  if (!current) throw new DomainError("FINANCIAL_TRANSACTION_NOT_FOUND");
  if (!isTransactionCancellable(current.origin, current.status)) throw new DomainError("FINANCIAL_TRANSACTION_NOT_EDITABLE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: reason })
    .eq("id", transactionId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "FINANCIAL_TRANSACTION_CANCELLED",
    entityType: "financial_transaction",
    entityId: transactionId,
    metadata: { has_reason: reason !== null },
  });
}

/**
 * Pagamento manual (§22–§26): ownership do paciente aqui; parcela/contrato/
 * consulta reconferidos DENTRO da função SQL, que grava payment + baixa +
 * lançamento numa transação e é idempotente pela chave do formulário.
 */
export async function recordManualPayment(
  nutritionistId: string,
  input: RecordPaymentInput,
): Promise<{ paymentId: string; alreadyExisted: boolean }> {
  await requireOwnedPatient(nutritionistId, input.patientId);
  const paidAt = wallClockToInstant(input.paidOn, "12:00", DEFAULT_TIME_ZONE);

  const supabase = await createClient();
  const { data: existing } = await supabase.from("payments").select("id").eq("idempotency_key", input.idempotencyKey).maybeSingle();

  const { data, error } = await supabase.rpc("record_manual_payment", {
    p_patient_id: input.patientId,
    p_amount_cents: input.amountCents,
    p_method: input.method,
    p_paid_at: paidAt.toISOString(),
    p_idempotency_key: input.idempotencyKey,
    ...(input.installmentId ? { p_installment_id: input.installmentId } : {}),
    ...(input.contractId ? { p_contract_id: input.contractId } : {}),
    ...(input.appointmentId ? { p_appointment_id: input.appointmentId } : {}),
    ...(input.categoryId ? { p_category_id: input.categoryId } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
    p_timezone: DEFAULT_TIME_ZONE,
  });
  if (error || !data) throw domainErrorFromDatabase(error);

  if (existing) return { paymentId: data, alreadyExisted: true };

  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_RECORDED",
    entityType: "payment",
    entityId: data,
    metadata: {
      patient_id: input.patientId,
      amount_cents: input.amountCents,
      method: input.method,
      installment_id: input.installmentId ?? null,
    },
  });
  if (input.installmentId) {
    await recordAudit({
      actorId: nutritionistId,
      action: "INSTALLMENT_PAYMENT_APPLIED",
      entityType: "installment",
      entityId: input.installmentId,
      metadata: { payment_id: data, amount_cents: input.amountCents },
    });
  }
  return { paymentId: data, alreadyExisted: false };
}

/** Reversão de pagamento manual (§31): payment REFUNDED + lançamento CANCELLED + parcela reaberta. */
export async function cancelPayment(nutritionistId: string, paymentId: string, reason: string | null): Promise<{ patientId: string }> {
  const payment = await getPaymentById(paymentId);
  if (!payment || payment.nutritionistId !== nutritionistId) throw new DomainError("PAYMENT_NOT_FOUND");
  if (payment.status !== "CONFIRMED") throw new DomainError("INVALID_STATUS_TRANSITION");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_payment", { p_payment_id: paymentId, ...(reason ? { p_reason: reason } : {}) });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_CANCELLED",
    entityType: "payment",
    entityId: paymentId,
    metadata: { patient_id: payment.patientId, amount_cents: payment.amountCents, has_reason: reason !== null },
  });
  return { patientId: payment.patientId };
}
