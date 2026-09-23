import "server-only";

import type { ChargeStatus, OnlinePaymentMethod } from "@/domain/payments/charges";
import type { ReconciliationKind } from "@/domain/payments/status";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { createClient } from "@/lib/supabase/server";

/**
 * Queries de cobrança online (prompt Fase 13 §91). Cliente de SESSÃO: a RLS
 * decide (paciente vê só as próprias cobranças; nutricionista, as dos seus
 * pacientes). Eventos de webhook não aparecem aqui — são técnicos e só o
 * service role lê.
 */

export type ChargeDetail = {
  id: string;
  patientId: string;
  patientName: string | null;
  nutritionistId: string;
  contractId: string | null;
  installmentId: string | null;
  installmentNumber: number | null;
  appointmentId: string | null;
  provider: string;
  providerEnvironment: string;
  providerChargeId: string | null;
  method: OnlinePaymentMethod;
  amountCents: number;
  currency: string;
  status: ChargeStatus;
  checkoutUrl: string | null;
  pixPayload: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  paymentId: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

const CHARGE_SELECT =
  "id, patient_id, nutritionist_id, contract_id, installment_id, appointment_id, provider, provider_environment, provider_charge_id, method, amount_cents, currency, status, checkout_url, pix_payload, expires_at, paid_at, cancelled_at, payment_id, last_error_code, created_at, updated_at, patients(full_name), contract_installments(number)";

type ChargeRow = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  contract_id: string | null;
  installment_id: string | null;
  appointment_id: string | null;
  provider: string;
  provider_environment: string;
  provider_charge_id: string | null;
  method: OnlinePaymentMethod;
  amount_cents: number;
  currency: string;
  status: ChargeStatus;
  checkout_url: string | null;
  pix_payload: string | null;
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  payment_id: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  patients: { full_name: string } | null;
  contract_installments: { number: number } | null;
};

function toDetail(row: ChargeRow): ChargeDetail {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients?.full_name ?? null,
    nutritionistId: row.nutritionist_id,
    contractId: row.contract_id,
    installmentId: row.installment_id,
    installmentNumber: row.contract_installments?.number ?? null,
    appointmentId: row.appointment_id,
    provider: row.provider,
    providerEnvironment: row.provider_environment,
    providerChargeId: row.provider_charge_id,
    method: row.method,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    checkoutUrl: row.checkout_url,
    pixPayload: row.pix_payload,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    paymentId: row.payment_id,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Cobrança por id — RLS já garante que só o dono (paciente ou nutricionista) enxerga. */
export async function getChargeById(chargeId: string): Promise<ChargeDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_charges").select(CHARGE_SELECT).eq("id", chargeId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as unknown as ChargeRow) : null;
}

/** Cobranças do paciente (histórico), mais recentes primeiro. */
export async function listPatientCharges(patientId: string, limit = 50): Promise<ChargeDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_charges")
    .select(CHARGE_SELECT)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw domainErrorFromDatabase(error);
  return (data as unknown as ChargeRow[] | null)?.map(toDetail) ?? [];
}

/** Cobranças do nutricionista (dashboard), com filtro opcional de status. */
export async function listNutritionistCharges(nutritionistId: string, options: { status?: ChargeStatus | "ALL"; limit?: number } = {}): Promise<ChargeDetail[]> {
  const supabase = await createClient();
  let query = supabase
    .from("payment_charges")
    .select(CHARGE_SELECT)
    .eq("nutritionist_id", nutritionistId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.status && options.status !== "ALL") query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return (data as unknown as ChargeRow[] | null)?.map(toDetail) ?? [];
}

export type ActiveChargeByInstallment = Map<string, { chargeId: string; status: ChargeStatus; method: OnlinePaymentMethod; amountCents: number; expiresAt: string | null }>;

/** Cobrança aberta por parcela (view `installment_active_charge`, com RLS do invoker). */
export async function getActiveChargesForInstallments(installmentIds: string[]): Promise<ActiveChargeByInstallment> {
  const map: ActiveChargeByInstallment = new Map();
  if (installmentIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installment_active_charge")
    .select("installment_id, charge_id, status, method, amount_cents, expires_at")
    .in("installment_id", installmentIds);
  if (error) throw domainErrorFromDatabase(error);
  for (const row of data ?? []) {
    if (!row.installment_id || !row.charge_id) continue;
    map.set(row.installment_id, {
      chargeId: row.charge_id,
      status: row.status as ChargeStatus,
      method: row.method as OnlinePaymentMethod,
      amountCents: row.amount_cents ?? 0,
      expiresAt: row.expires_at,
    });
  }
  return map;
}

export type ReconciliationItem = {
  id: string;
  kind: ReconciliationKind | string;
  status: "OPEN" | "RESOLVED" | "IGNORED";
  patientId: string | null;
  patientName: string | null;
  chargeId: string | null;
  paymentId: string | null;
  detail: Record<string, unknown>;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

/** Divergências do nutricionista (abertas primeiro). */
export async function listReconciliationItems(nutritionistId: string, options: { status?: "OPEN" | "ALL" } = {}): Promise<ReconciliationItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("payment_reconciliation_items")
    .select("id, kind, status, patient_id, charge_id, payment_id, detail, resolution_note, created_at, resolved_at, patients(full_name)")
    .eq("nutritionist_id", nutritionistId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (options.status !== "ALL") query = query.eq("status", "OPEN");
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => {
    const patients = row.patients as { full_name: string } | null;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status as "OPEN" | "RESOLVED" | "IGNORED",
      patientId: row.patient_id,
      patientName: patients?.full_name ?? null,
      chargeId: row.charge_id,
      paymentId: row.payment_id,
      detail: (row.detail ?? {}) as Record<string, unknown>,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  });
}

export async function countOpenReconciliationItems(nutritionistId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("payment_reconciliation_items")
    .select("id", { count: "exact", head: true })
    .eq("nutritionist_id", nutritionistId)
    .eq("status", "OPEN");
  if (error) return 0;
  return count ?? 0;
}
