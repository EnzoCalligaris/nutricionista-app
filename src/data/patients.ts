import "server-only";

import { createClient } from "@/lib/supabase/server";
import { monthBoundsISO, todayISO } from "@/lib/calendar";
import { derivePatientStatus, type PatientListFilter, type PatientUiStatus } from "@/domain/patients/status";
import { computeAverageTicket, type AverageTicket } from "@/domain/patients/metrics";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { Database } from "@/types/database";

/**
 * Queries do módulo de pacientes (prompt Fase 5 §44). Sempre server-side,
 * sempre com o cliente de sessão (RLS ativa) E escopadas explicitamente por
 * `nutritionist_id` — a RLS é a defesa adicional, não a única (§1).
 * Nenhum componente de UI importa daqui: páginas usam estas funções em
 * Server Components; mutações passam por `src/actions` -> `src/services`.
 */

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type OverviewRow = Database["public"]["Views"]["patient_overview"]["Row"];

export type PatientListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  dbStatus: "ACTIVE" | "INACTIVE";
  uiStatus: PatientUiStatus;
  hasPortalAccount: boolean;
  currentContract: {
    id: string;
    planCode: string;
    planName: string;
    contractedAmountCents: number;
    startDate: string;
    endDate: string | null;
  } | null;
  nextAppointmentAt: string | null;
  createdAt: string;
};

export type PatientListResult = {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type PatientMetrics = {
  activePatients: number;
  totalPatients: number;
  averageTicket: AverageTicket;
  /** Mês civil (YYYY-MM) do período do ticket médio, em America/Sao_Paulo. */
  ticketPeriod: { start: string; end: string };
};

function toListItem(row: OverviewRow): PatientListItem {
  // Colunas de view chegam tipadas como nullable pelo gerador; as de
  // `patients` nunca são null de fato (NOT NULL na tabela).
  if (!row.patient_id || !row.full_name || !row.patient_status || !row.created_at) {
    throw new Error("patient_overview devolveu linha incompleta");
  }
  const dbStatus = row.patient_status;
  const hasActiveContract = row.has_active_contract === true;
  return {
    id: row.patient_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    birthDate: row.birth_date,
    dbStatus,
    uiStatus: derivePatientStatus({ patient_status: dbStatus, has_active_contract: hasActiveContract }),
    hasPortalAccount: row.profile_id !== null,
    currentContract:
      row.current_contract_id && row.current_plan_code && row.current_plan_name && row.current_start_date
        ? {
            id: row.current_contract_id,
            planCode: row.current_plan_code,
            planName: row.current_plan_name,
            contractedAmountCents: row.current_contracted_amount_cents ?? 0,
            startDate: row.current_start_date,
            endDate: row.current_end_date,
          }
        : null,
    nextAppointmentAt: row.next_appointment_at,
    createdAt: row.created_at,
  };
}

/**
 * Termo de busca para o filtro `or(...)` do PostgREST: remove os
 * caracteres que têm significado sintático no filtro (vírgula, parênteses,
 * curingas, aspas) — o termo vira só texto a procurar com ILIKE.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

export async function listPatients(
  nutritionistId: string,
  query: { q?: string; status: PatientListFilter; page: number; pageSize: number },
): Promise<PatientListResult> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let request = supabase
    .from("patient_overview")
    .select("*", { count: "exact" })
    .eq("nutritionist_id", nutritionistId);

  if (query.status === "active") request = request.eq("is_effectively_active", true);
  if (query.status === "inactive") request = request.eq("is_effectively_active", false);

  const term = query.q ? sanitizeSearchTerm(query.q) : "";
  if (term) {
    // Nome é a prioridade (§6); e-mail e telefone entram porque custam a
    // mesma query. Busca server-side, nunca filtrando a lista no browser.
    request = request.or(`full_name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);
  }

  const { data, error, count } = await request
    .order("full_name", { ascending: true })
    .range(from, to);

  if (error) throw domainErrorFromDatabase(error);

  const total = count ?? 0;
  return {
    items: (data ?? []).map(toListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/**
 * Cards da listagem (§3–§5):
 *  - Pacientes ativos: `is_effectively_active` (status ACTIVE + contrato ACTIVE).
 *  - Total: todos os pacientes do nutricionista (ativos + inativos, incluindo
 *    desativados — nada é destruído, então nada some da contagem).
 *  - Ticket médio: ver `computeAverageTicket` (recebido no mês ÷ pagantes).
 */
export async function getPatientMetrics(nutritionistId: string, now: Date = new Date()): Promise<PatientMetrics> {
  const supabase = await createClient();
  const period = monthBoundsISO(todayISO(now));

  const [activeResult, totalResult, paymentsResult] = await Promise.all([
    supabase
      .from("patient_overview")
      .select("patient_id", { count: "exact", head: true })
      .eq("nutritionist_id", nutritionistId)
      .eq("is_effectively_active", true),
    supabase
      .from("patient_overview")
      .select("patient_id", { count: "exact", head: true })
      .eq("nutritionist_id", nutritionistId),
    // paid_at é timestamptz: o intervalo do mês civil de São Paulo é
    // convertido para instantes explícitos (-03:00) — nunca o fuso da máquina.
    supabase
      .from("payments")
      .select("patient_id, amount_cents, patients!inner(nutritionist_id)")
      .eq("status", "CONFIRMED")
      .eq("patients.nutritionist_id", nutritionistId)
      .gte("paid_at", `${period.start}T00:00:00-03:00`)
      .lte("paid_at", `${period.end}T23:59:59.999-03:00`),
  ]);

  if (activeResult.error) throw domainErrorFromDatabase(activeResult.error);
  if (totalResult.error) throw domainErrorFromDatabase(totalResult.error);
  if (paymentsResult.error) throw domainErrorFromDatabase(paymentsResult.error);

  return {
    activePatients: activeResult.count ?? 0,
    totalPatients: totalResult.count ?? 0,
    averageTicket: computeAverageTicket(
      (paymentsResult.data ?? []).map((row) => ({ patient_id: row.patient_id, amount_cents: row.amount_cents })),
    ),
    ticketPeriod: period,
  };
}

/** Linha crua de `patients`, só se pertencer ao nutricionista. */
export async function getPatientById(nutritionistId: string, patientId: string): Promise<PatientRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data;
}

/** Linha de `patient_overview` (status derivado + contrato atual) para o perfil. */
export async function getPatientOverview(nutritionistId: string, patientId: string): Promise<PatientListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_overview")
    .select("*")
    .eq("patient_id", patientId)
    .eq("nutritionist_id", nutritionistId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toListItem(data) : null;
}

export type PatientPaymentRow = {
  id: string;
  amount_cents: number;
  method: Database["public"]["Enums"]["payment_method"];
  status: Database["public"]["Enums"]["payment_status"];
  paid_at: string | null;
  contract_id: string | null;
  installment_id: string | null;
  created_at: string;
};

/** Pagamentos do paciente (somente leitura nesta fase — registro manual é Fase 7). */
export async function getPatientPayments(nutritionistId: string, patientId: string): Promise<PatientPaymentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount_cents, method, status, paid_at, contract_id, installment_id, created_at, patients!inner(nutritionist_id)")
    .eq("patient_id", patientId)
    .eq("patients.nutritionist_id", nutritionistId)
    .order("paid_at", { ascending: false, nullsFirst: false });
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    amount_cents: row.amount_cents,
    method: row.method,
    status: row.status,
    paid_at: row.paid_at,
    contract_id: row.contract_id,
    installment_id: row.installment_id,
    created_at: row.created_at,
  }));
}

export type PatientAuditEvent = { action: string; created_at: string };

/** Eventos de auditoria do próprio paciente (reativação/desativação) para a timeline. */
export async function getPatientAuditEvents(patientId: string): Promise<PatientAuditEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action, created_at")
    .eq("entity_type", "patient")
    .eq("entity_id", patientId)
    .in("action", ["PATIENT_ARCHIVED", "PATIENT_REACTIVATED"])
    .order("created_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return data ?? [];
}

export type PatientModuleCounts = {
  appointments: number;
  mealPlans: number;
  assessments: number;
  appointmentNotes: number;
  feedbacks: number;
  materials: number;
};

/**
 * Contagens simples por módulo para o perfil (prompt Fase 5 §22): resumo
 * real quando existe dado, sem implementar as fases futuras. Queries
 * `head` em paralelo — só o count, nenhuma linha trafega.
 */
export async function getPatientModuleCounts(patientId: string): Promise<PatientModuleCounts> {
  const supabase = await createClient();
  const count = (table: "appointments" | "meal_plans" | "assessments" | "appointment_notes" | "feedback_messages" | "material_assignments") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("patient_id", patientId);

  const [appointments, mealPlans, assessments, notes, feedbacks, materials] = await Promise.all([
    count("appointments"),
    count("meal_plans"),
    count("assessments"),
    count("appointment_notes"),
    count("feedback_messages"),
    count("material_assignments"),
  ]);

  return {
    appointments: appointments.count ?? 0,
    mealPlans: mealPlans.count ?? 0,
    assessments: assessments.count ?? 0,
    appointmentNotes: notes.count ?? 0,
    feedbacks: feedbacks.count ?? 0,
    materials: materials.count ?? 0,
  };
}
