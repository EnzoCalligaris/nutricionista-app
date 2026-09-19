import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { ContractStatus, InstallmentStatus } from "@/domain/contracts/status";
import type { Database } from "@/types/database";

/**
 * Queries de contratos/parcelas (prompt Fase 5 §44). O resumo financeiro
 * vem SEMPRE da view `contract_financial_summary` (Fase 2) — o frontend
 * nunca recalcula contratado/recebido/pendente/previsto por conta própria
 * (§41).
 */

export type ContractInstallment = {
  id: string;
  number: number;
  amountCents: number;
  dueDate: string;
  status: InstallmentStatus;
  paidAt: string | null;
  /** Fase 7: pagamentos CONFIRMED vinculados e saldo restante (view installment_payment_summary). */
  receivedCents: number;
  remainingCents: number;
};

export type ContractFinancials = {
  contractedCents: number;
  receivedCents: number;
  pendingCents: number;
  forecastCents: number;
};

export type PatientContract = {
  id: string;
  patientId: string;
  plan: { id: string; code: string; name: string; durationMonths: number | null };
  planPrice: { id: string; label: string; paymentType: Database["public"]["Enums"]["plan_price_payment_type"] } | null;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  contractedAmountCents: number;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  installments: ContractInstallment[];
  financials: ContractFinancials;
};

const CONTRACT_SELECT =
  "id, patient_id, start_date, end_date, status, contracted_amount_cents, cancelled_at, notes, created_at, plans!inner(id, code, name, duration_months), plan_prices(id, label, payment_type), contract_installments(id, number, amount_cents, due_date, status, paid_at)";

type ContractQueryRow = {
  id: string;
  patient_id: string;
  start_date: string;
  end_date: string | null;
  status: ContractStatus;
  contracted_amount_cents: number;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  plans: { id: string; code: string; name: string; duration_months: number | null };
  plan_prices: { id: string; label: string; payment_type: Database["public"]["Enums"]["plan_price_payment_type"] } | null;
  contract_installments: {
    id: string;
    number: number;
    amount_cents: number;
    due_date: string;
    status: InstallmentStatus;
    paid_at: string | null;
  }[];
};

type SummaryRow = Database["public"]["Views"]["contract_financial_summary"]["Row"];

type InstallmentBalanceRow = { installment_id: string | null; received_cents: number | null; remaining_cents: number | null };

function toContract(row: ContractQueryRow, summary: SummaryRow | undefined, balances: Map<string, InstallmentBalanceRow>): PatientContract {
  return {
    id: row.id,
    patientId: row.patient_id,
    plan: {
      id: row.plans.id,
      code: row.plans.code,
      name: row.plans.name,
      durationMonths: row.plans.duration_months,
    },
    planPrice: row.plan_prices
      ? { id: row.plan_prices.id, label: row.plan_prices.label, paymentType: row.plan_prices.payment_type }
      : null,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    contractedAmountCents: row.contracted_amount_cents,
    cancelledAt: row.cancelled_at,
    notes: row.notes,
    createdAt: row.created_at,
    installments: [...row.contract_installments]
      .sort((a, b) => a.number - b.number)
      .map((installment) => {
        const balance = balances.get(installment.id);
        const received = balance?.received_cents ?? 0;
        return {
          id: installment.id,
          number: installment.number,
          amountCents: installment.amount_cents,
          dueDate: installment.due_date,
          status: installment.status,
          paidAt: installment.paid_at,
          receivedCents: received,
          remainingCents:
            balance?.remaining_cents ??
            (installment.status === "PAID" || installment.status === "CANCELLED" ? 0 : Math.max(installment.amount_cents - received, 0)),
        };
      }),
    financials: {
      contractedCents: summary?.contracted_amount_cents ?? row.contracted_amount_cents,
      receivedCents: summary?.received_cents ?? 0,
      pendingCents: summary?.pending_cents ?? 0,
      forecastCents: summary?.forecast_cents ?? 0,
    },
  };
}

/**
 * Todos os contratos do paciente (histórico completo, nunca sobrescrito —
 * §36), com parcelas (recebido/restante) e resumo financeiro. Três queries
 * no total, não N+1.
 * O escopo do nutricionista é garantido pela RLS de `patient_contracts`
 * (`is_nutritionist_of_patient`) e, antes disso, pela página que só chama
 * isto depois de `getPatientById(nutritionistId, ...)` confirmar ownership.
 */
export async function getPatientContracts(patientId: string): Promise<PatientContract[]> {
  const supabase = await createClient();

  const [contractsResult, summaryResult] = await Promise.all([
    supabase
      .from("patient_contracts")
      .select(CONTRACT_SELECT)
      .eq("patient_id", patientId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("contract_financial_summary").select("*").eq("patient_id", patientId),
  ]);

  if (contractsResult.error) throw domainErrorFromDatabase(contractsResult.error);
  if (summaryResult.error) throw domainErrorFromDatabase(summaryResult.error);

  const contractIds = (contractsResult.data ?? []).map((row) => row.id);
  const balances = new Map<string, InstallmentBalanceRow>();
  if (contractIds.length > 0) {
    const { data: balanceRows, error: balanceError } = await supabase
      .from("installment_payment_summary")
      .select("installment_id, received_cents, remaining_cents")
      .in("contract_id", contractIds);
    if (balanceError) throw domainErrorFromDatabase(balanceError);
    for (const row of balanceRows ?? []) if (row.installment_id) balances.set(row.installment_id, row);
  }

  const summaries = new Map((summaryResult.data ?? []).map((row) => [row.contract_id, row]));
  return (contractsResult.data as unknown as ContractQueryRow[]).map((row) =>
    toContract(row, summaries.get(row.id), balances),
  );
}

/** Um contrato com o `nutritionist_id` do paciente, para checagem de ownership no service. */
export async function getContractForOwnership(
  contractId: string,
): Promise<{ id: string; patientId: string; nutritionistId: string; status: ContractStatus; planName: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_contracts")
    .select("id, patient_id, status, patients!inner(nutritionist_id), plans!inner(name)")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  return {
    id: data.id,
    patientId: data.patient_id,
    nutritionistId: data.patients.nutritionist_id,
    status: data.status,
    planName: data.plans.name,
  };
}
