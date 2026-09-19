import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import type {
  FinancialType,
  PaymentMethod,
  TransactionOrigin,
  TransactionStatus,
  TransactionUiStatus,
} from "@/domain/finance/definitions";
import { presentTransactionStatus } from "@/domain/finance/definitions";
import type { PeriodSummary } from "@/domain/finance/summary";
import type { Database } from "@/types/database";

/**
 * Queries do financeiro (prompt Fase 7 §59/§96). Cliente de sessão (RLS
 * escopada por `nutritionist_id`), agregações no banco (funções SQL /
 * views), listagem paginada server-side. UI nunca acessa Supabase.
 */

export type FinancialCategory = { id: string; name: string; type: FinancialType; active: boolean };

export async function getFinancialCategories(): Promise<FinancialCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("financial_categories").select("id, name, type, active").order("type").order("name");
  if (error) throw domainErrorFromDatabase(error);
  return data ?? [];
}

export async function getPeriodSummary(from: string, to: string, timeZone: string = DEFAULT_TIME_ZONE): Promise<PeriodSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("financial_period_summary", { p_from: from, p_to: to, p_timezone: timeZone });
  if (error) throw domainErrorFromDatabase(error);
  const row = data?.[0];
  return {
    incomeCents: Number(row?.income_cents ?? 0),
    expenseCents: Number(row?.expense_cents ?? 0),
    balanceCents: Number(row?.balance_cents ?? 0),
    receivedCents: Number(row?.received_cents ?? 0),
    pendingCents: Number(row?.pending_cents ?? 0),
    forecastCents: Number(row?.forecast_cents ?? 0),
    overdueCents: Number(row?.overdue_cents ?? 0),
  };
}

export type MonthlyPoint = {
  monthStart: string;
  incomeCents: number;
  expenseCents: number;
  receivedCents: number;
  /** Parcelas com vencimento no mês (contratos/parcelas não cancelados), pagas ou não. */
  dueCents: number;
  /** Saldo em aberto de parcelas de contratos ATIVOS vencendo no mês. */
  forecastCents: number;
};

/** Série mensal para os gráficos: `months` meses passados (incluindo o atual) + `monthsAhead` futuros. */
export async function getMonthlySeries(months = 6, timeZone: string = DEFAULT_TIME_ZONE, monthsAhead = 0): Promise<MonthlyPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("monthly_financial_series", { p_months: months, p_timezone: timeZone, p_months_ahead: monthsAhead });
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    monthStart: row.month_start,
    incomeCents: Number(row.income_cents),
    expenseCents: Number(row.expense_cents),
    receivedCents: Number(row.received_cents),
    dueCents: Number(row.due_cents),
    forecastCents: Number(row.forecast_cents),
  }));
}

export type TransactionListItem = {
  id: string;
  type: FinancialType;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  amountCents: number;
  status: TransactionStatus;
  uiStatus: TransactionUiStatus;
  occurredOn: string;
  dueOn: string | null;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  origin: TransactionOrigin;
  originPaymentId: string | null;
  patientId: string | null;
  patientName: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
};

type Row = Database["public"]["Tables"]["financial_transactions"]["Row"] & {
  financial_categories: { name: string } | null;
  patients: { full_name: string } | null;
};

function toItem(row: Row, today: string): TransactionListItem {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.financial_categories?.name ?? null,
    amountCents: row.amount_cents,
    status: row.status,
    uiStatus: presentTransactionStatus(row.status, row.due_on, today),
    occurredOn: row.occurred_on,
    dueOn: row.due_on,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    origin: row.origin,
    originPaymentId: row.origin_payment_id,
    patientId: row.patient_id,
    patientName: row.patients?.full_name ?? null,
    notes: row.notes,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
  };
}

const TRANSACTION_SELECT = "*, financial_categories(name), patients(full_name)";

export type TransactionListFilters = {
  from: string;
  to: string;
  type: "all" | FinancialType;
  status: "all" | TransactionUiStatus;
  categoryId?: string;
  method: "all" | PaymentMethod;
  q?: string;
  page: number;
  pageSize: number;
};

export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

/** Lançamentos do período, paginados e filtrados no servidor (§10–§14). OVERDUE = PENDING com due_on < hoje. */
export async function listTransactions(
  nutritionistId: string,
  filters: TransactionListFilters,
  today: string,
): Promise<{ items: TransactionListItem[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const term = filters.q ? sanitizeSearchTerm(filters.q) : "";

  // Busca por paciente: resolve os ids pelo nome (escopado) e filtra por
  // `patient_id in (...)` — PostgREST não aceita coluna de tabela embutida
  // dentro de um `or` no nível do pai.
  let patientIds: string[] = [];
  if (term) {
    const { data: matches, error: matchError } = await supabase
      .from("patients")
      .select("id")
      .eq("nutritionist_id", nutritionistId)
      .ilike("full_name", `%${term}%`)
      .limit(50);
    if (matchError) throw domainErrorFromDatabase(matchError);
    patientIds = (matches ?? []).map((row) => row.id);
  }

  let query = supabase
    .from("financial_transactions")
    .select(TRANSACTION_SELECT, { count: "exact" })
    .eq("nutritionist_id", nutritionistId)
    .gte("occurred_on", filters.from)
    .lte("occurred_on", filters.to);

  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.method !== "all") query = query.eq("payment_method", filters.method);
  if (filters.status === "PAID") query = query.eq("status", "CONFIRMED");
  if (filters.status === "CANCELLED") query = query.eq("status", "CANCELLED");
  if (filters.status === "PENDING") query = query.eq("status", "PENDING").or(`due_on.is.null,due_on.gte.${today}`);
  if (filters.status === "OVERDUE") query = query.eq("status", "PENDING").lt("due_on", today);
  if (term) {
    query = patientIds.length > 0
      ? query.or(`description.ilike.*${term}*,patient_id.in.(${patientIds.join(",")})`)
      : query.ilike("description", `%${term}%`);
  }

  const { data, error, count } = await query.order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw domainErrorFromDatabase(error);

  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as Row[]).map((row) => toItem(row, today)),
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function getTransactionById(nutritionistId: string, id: string, today: string): Promise<TransactionListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .select(TRANSACTION_SELECT)
    .eq("id", id)
    .eq("nutritionist_id", nutritionistId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toItem(data as unknown as Row, today) : null;
}

/** Lançamentos de um paciente (aba Financeiro do perfil), mais recentes primeiro. */
export async function listPatientTransactions(nutritionistId: string, patientId: string, today: string): Promise<TransactionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .select(TRANSACTION_SELECT)
    .eq("nutritionist_id", nutritionistId)
    .eq("patient_id", patientId)
    .order("occurred_on", { ascending: false })
    .limit(100);
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as unknown as Row[]).map((row) => toItem(row, today));
}

// --- Previsão de recebimentos (§39) ----------------------------------------------

export type ReceivableRow = {
  contractId: string;
  patientId: string;
  patientName: string;
  planName: string;
  durationMonths: number | null;
  contractStatus: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate: string | null;
  contractedCents: number;
  receivedCents: number;
  pendingCents: number;
  forecastCents: number;
  nextDueDate: string | null;
  nextDueRemainingCents: number | null;
  overdue: boolean;
  mainMethod: PaymentMethod | null;
};

/**
 * Previsão por contrato: junta `patient_contracts` (com paciente/plano),
 * `contract_financial_summary`, parcelas em aberto (próximo vencimento) e o
 * método mais usado nos pagamentos — 3 queries no total, sem N+1.
 */
export async function getReceivablesForecast(nutritionistId: string, today: string): Promise<ReceivableRow[]> {
  const supabase = await createClient();
  const [contractsResult, summaryResult, installmentsResult, balancesResult, paymentsResult] = await Promise.all([
    supabase
      .from("patient_contracts")
      .select("id, patient_id, status, start_date, end_date, patients!inner(full_name, nutritionist_id), plans!inner(name, duration_months)")
      .eq("patients.nutritionist_id", nutritionistId)
      .neq("status", "CANCELLED")
      .order("start_date", { ascending: false }),
    supabase.from("contract_financial_summary").select("*"),
    // A view não expõe FK para `contract_installments` (PostgREST não infere
    // relação por PK), então parcela e saldo são lidos separados e unidos aqui.
    supabase.from("contract_installments").select("id, contract_id, due_date, status").in("status", ["PENDING", "OVERDUE"]),
    supabase.from("installment_payment_summary").select("installment_id, remaining_cents").gt("remaining_cents", 0),
    supabase.from("payments").select("contract_id, method").eq("status", "CONFIRMED").not("contract_id", "is", null),
  ]);
  if (contractsResult.error) throw domainErrorFromDatabase(contractsResult.error);
  if (summaryResult.error) throw domainErrorFromDatabase(summaryResult.error);
  if (installmentsResult.error) throw domainErrorFromDatabase(installmentsResult.error);
  if (balancesResult.error) throw domainErrorFromDatabase(balancesResult.error);
  if (paymentsResult.error) throw domainErrorFromDatabase(paymentsResult.error);

  const summaries = new Map((summaryResult.data ?? []).map((row) => [row.contract_id, row]));

  const remainingById = new Map((balancesResult.data ?? []).map((row) => [row.installment_id, row.remaining_cents ?? 0]));
  const nextDue = new Map<string, { dueDate: string; remaining: number }>();
  for (const installment of installmentsResult.data ?? []) {
    const remaining = remainingById.get(installment.id);
    if (!remaining) continue;
    const current = nextDue.get(installment.contract_id);
    if (!current || installment.due_date < current.dueDate) nextDue.set(installment.contract_id, { dueDate: installment.due_date, remaining });
  }

  const methodCounts = new Map<string, Map<PaymentMethod, number>>();
  for (const row of paymentsResult.data ?? []) {
    if (!row.contract_id) continue;
    const counts = methodCounts.get(row.contract_id) ?? new Map<PaymentMethod, number>();
    counts.set(row.method, (counts.get(row.method) ?? 0) + 1);
    methodCounts.set(row.contract_id, counts);
  }

  return (contractsResult.data ?? []).map((row) => {
    const summary = summaries.get(row.id);
    const next = nextDue.get(row.id) ?? null;
    const methods = methodCounts.get(row.id);
    const mainMethod = methods ? ([...methods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) : null;
    const patient = row.patients as unknown as { full_name: string };
    const plan = row.plans as unknown as { name: string; duration_months: number | null };
    return {
      contractId: row.id,
      patientId: row.patient_id,
      patientName: patient.full_name,
      planName: plan.name,
      durationMonths: plan.duration_months,
      contractStatus: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      contractedCents: summary?.contracted_amount_cents ?? 0,
      receivedCents: Number(summary?.received_cents ?? 0),
      pendingCents: Number(summary?.pending_cents ?? 0),
      forecastCents: Number(summary?.forecast_cents ?? 0),
      nextDueDate: next?.dueDate ?? null,
      nextDueRemainingCents: next?.remaining ?? null,
      overdue: next ? next.dueDate < today : false,
      mainMethod,
    };
  });
}
