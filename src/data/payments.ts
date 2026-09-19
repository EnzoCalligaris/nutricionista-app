import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { PaymentMethod, PaymentStatus } from "@/domain/finance/definitions";

/**
 * Queries de pagamentos (prompt Fase 7 §22/§50/§59). Cliente de sessão:
 * RLS `payments_nutritionist_only` (via `is_nutritionist_of_patient`).
 */

export type PaymentListItem = {
  id: string;
  patientId: string;
  patientName: string;
  contractId: string | null;
  installmentId: string | null;
  installmentNumber: number | null;
  appointmentId: string | null;
  planName: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  provider: string;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
};

const PAYMENT_SELECT =
  "id, patient_id, contract_id, installment_id, appointment_id, amount_cents, method, status, paid_at, provider, notes, cancelled_at, cancellation_reason, created_at, patients!inner(full_name, nutritionist_id), contract_installments(number), patient_contracts(plans(name))";

type Row = {
  id: string;
  patient_id: string;
  contract_id: string | null;
  installment_id: string | null;
  appointment_id: string | null;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
  provider: string;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  patients: { full_name: string; nutritionist_id: string };
  contract_installments: { number: number } | null;
  patient_contracts: { plans: { name: string } | null } | null;
};

function toItem(row: Row): PaymentListItem {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients.full_name,
    contractId: row.contract_id,
    installmentId: row.installment_id,
    installmentNumber: row.contract_installments?.number ?? null,
    appointmentId: row.appointment_id,
    planName: row.patient_contracts?.plans?.name ?? null,
    amountCents: row.amount_cents,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    provider: row.provider,
    notes: row.notes,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
  };
}

/** Pagamentos de um paciente (todos os status), mais recentes primeiro. */
export async function listPatientPayments(nutritionistId: string, patientId: string): Promise<PaymentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("patient_id", patientId)
    .eq("patients.nutritionist_id", nutritionistId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as unknown as Row[]).map(toItem);
}

/** Um pagamento com o nutricionista do paciente (ownership no service). */
export async function getPaymentById(paymentId: string): Promise<(PaymentListItem & { nutritionistId: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select(PAYMENT_SELECT).eq("id", paymentId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const row = data as unknown as Row;
  return { ...toItem(row), nutritionistId: row.patients.nutritionist_id };
}

export type OpenInstallmentOption = {
  id: string;
  contractId: string;
  planName: string;
  number: number;
  dueDate: string;
  amountCents: number;
  remainingCents: number;
};

/** Parcelas ainda pagáveis do paciente (para o formulário de pagamento). */
export async function listOpenInstallments(patientId: string): Promise<OpenInstallmentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_installments")
    .select("id, contract_id, number, due_date, amount_cents, status, patient_contracts!inner(patient_id, status, plans!inner(name))")
    .eq("patient_contracts.patient_id", patientId)
    .neq("patient_contracts.status", "CANCELLED")
    .in("status", ["PENDING", "OVERDUE"])
    .order("due_date", { ascending: true });
  if (error) throw domainErrorFromDatabase(error);
  const rows = (data ?? []) as unknown as {
    id: string;
    contract_id: string;
    number: number;
    due_date: string;
    amount_cents: number;
    patient_contracts: { plans: { name: string } };
  }[];
  if (rows.length === 0) return [];

  // Saldo por parcela vem da view (sem FK para embed — ver getReceivablesForecast).
  const { data: balances, error: balanceError } = await supabase
    .from("installment_payment_summary")
    .select("installment_id, remaining_cents")
    .in("installment_id", rows.map((row) => row.id));
  if (balanceError) throw domainErrorFromDatabase(balanceError);
  const remainingById = new Map((balances ?? []).map((row) => [row.installment_id, row.remaining_cents ?? 0]));

  return rows
    .map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      planName: row.patient_contracts.plans.name,
      number: row.number,
      dueDate: row.due_date,
      amountCents: row.amount_cents,
      remainingCents: remainingById.get(row.id) ?? row.amount_cents,
    }))
    .filter((row) => row.remainingCents > 0);
}
