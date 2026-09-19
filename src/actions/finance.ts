"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { parseBRLToCents } from "@/lib/money";
import { todayISO } from "@/lib/calendar";
import {
  cancelPaymentSchema,
  cancelTransactionSchema,
  manualTransactionSchema,
  paymentIdSchema,
  recordPaymentSchema,
  transactionIdSchema,
} from "@/validators/finance";
import {
  cancelManualTransaction,
  cancelPayment,
  createManualTransaction,
  recordManualPayment,
  updateManualTransaction,
} from "@/services/finance";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions do financeiro (prompt Fase 7 §62–§63): requireNutritionist,
 * Zod (só campos de negócio — nutritionist_id/origin/origin_payment_id/
 * external_id/created_at nunca vêm do client), service com ownership,
 * revalidação e erro de domínio amigável.
 */

export type FinanceFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[finance] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateFinance(extra: string[] = []) {
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/previsao");
  revalidatePath("/dashboard");
  for (const path of extra) revalidatePath(path);
}

function parseTransactionForm(formData: FormData) {
  const values = {
    description: str(formData, "description"),
    type: str(formData, "type"),
    categoryId: str(formData, "categoryId"),
    amount: str(formData, "amount"),
    occurredOn: str(formData, "occurredOn"),
    dueOn: str(formData, "dueOn"),
    paymentMethod: str(formData, "paymentMethod"),
    status: str(formData, "status") || "CONFIRMED",
    notes: str(formData, "notes"),
    patientId: str(formData, "patientId"),
    patientName: str(formData, "patientName"),
  };
  const amountCents = parseBRLToCents(values.amount);
  const parsed = manualTransactionSchema.safeParse({
    description: values.description,
    type: values.type,
    categoryId: values.categoryId,
    amountCents: amountCents ?? Number.NaN,
    occurredOn: values.occurredOn,
    dueOn: values.dueOn,
    paymentMethod: values.paymentMethod || null,
    status: values.status,
    notes: values.notes,
    patientId: values.patientId,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.amountCents) {
      fieldErrors.amount = amountCents === null ? "Informe um valor válido (ex.: 230,00)." : fieldErrors.amountCents;
    }
    return { ok: false as const, values, fieldErrors };
  }
  return { ok: true as const, values, data: parsed.data };
}

export async function createTransactionAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const nutritionist = await requireNutritionist();
  const form = parseTransactionForm(formData);
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };

  try {
    await createManualTransaction(nutritionist.id, form.data);
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateFinance(form.data.patientId ? [`/dashboard/pacientes/${form.data.patientId}`] : []);
  redirect("/dashboard/financeiro?toast=transaction_created");
}

export async function updateTransactionAction(transactionId: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const nutritionist = await requireNutritionist();
  const id = transactionIdSchema.safeParse(transactionId);
  const form = parseTransactionForm(formData);
  if (!id.success) return { error: domainErrorMessage("FINANCIAL_TRANSACTION_NOT_FOUND"), values: form.values };
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors, values: form.values };

  try {
    await updateManualTransaction(nutritionist.id, id.data, form.data, todayISO());
  } catch (error) {
    return { error: errorMessage(error), values: form.values };
  }
  revalidateFinance(form.data.patientId ? [`/dashboard/pacientes/${form.data.patientId}`] : []);
  redirect("/dashboard/financeiro?toast=transaction_updated");
}

export async function cancelTransactionAction(transactionId: string, reason: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = transactionIdSchema.safeParse(transactionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("FINANCIAL_TRANSACTION_NOT_FOUND") };
  const parsed = cancelTransactionSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  try {
    await cancelManualTransaction(nutritionist.id, id.data, parsed.data.reason ?? null, todayISO());
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateFinance();
  return { ok: true };
}

export async function recordPaymentAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const nutritionist = await requireNutritionist();
  const values = {
    patientId: str(formData, "patientId"),
    patientName: str(formData, "patientName"),
    installmentId: str(formData, "installmentId"),
    contractId: str(formData, "contractId"),
    appointmentId: str(formData, "appointmentId"),
    categoryId: str(formData, "categoryId"),
    amount: str(formData, "amount"),
    method: str(formData, "method"),
    paidOn: str(formData, "paidOn"),
    notes: str(formData, "notes"),
    idempotencyKey: str(formData, "idempotencyKey"),
    returnTo: str(formData, "returnTo"),
  };
  const amountCents = parseBRLToCents(values.amount);
  const parsed = recordPaymentSchema.safeParse({
    patientId: values.patientId,
    installmentId: values.installmentId,
    contractId: values.contractId,
    appointmentId: values.appointmentId,
    categoryId: values.categoryId,
    amountCents: amountCents ?? Number.NaN,
    method: values.method,
    paidOn: values.paidOn,
    notes: values.notes,
    idempotencyKey: values.idempotencyKey,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.amountCents) fieldErrors.amount = amountCents === null ? "Informe um valor válido (ex.: 230,00)." : fieldErrors.amountCents;
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };
  }

  try {
    await recordManualPayment(nutritionist.id, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidateFinance([`/dashboard/pacientes/${parsed.data.patientId}`]);
  // `returnTo` só aceita caminhos internos do dashboard (nunca URL externa).
  const returnTo = values.returnTo.startsWith("/dashboard/") && !values.returnTo.includes("//") ? values.returnTo : `/dashboard/pacientes/${parsed.data.patientId}?tab=financeiro`;
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}toast=payment_recorded`);
}

export async function cancelPaymentAction(paymentId: string, reason: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = paymentIdSchema.safeParse(paymentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("PAYMENT_NOT_FOUND") };
  const parsed = cancelPaymentSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? domainErrorMessage("VALIDATION_ERROR") };

  let patientId: string;
  try {
    ({ patientId } = await cancelPayment(nutritionist.id, id.data, parsed.data.reason ?? null));
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidateFinance([`/dashboard/pacientes/${patientId}`]);
  return { ok: true };
}
