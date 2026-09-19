import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { ACTIVE_STATUSES, type AppointmentStatus } from "@/domain/scheduling/state-machine";
import type { Modality } from "@/domain/scheduling/slots";
import type { Database } from "@/types/database";

/**
 * Queries de consultas (prompt Fase 6 §62/§95–§96). Sempre limitadas ao
 * período pedido — nunca "todas as consultas" para renderizar uma semana.
 * Cliente de sessão: o nutricionista vê as consultas dos seus pacientes, o
 * paciente só as próprias (RLS `appointments_select`).
 */

type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type AppointmentListItem = {
  id: string;
  patientId: string;
  patientName: string;
  contractId: string | null;
  planName: string | null;
  startsAt: string;
  endsAt: string;
  modality: Modality;
  status: AppointmentStatus;
  amountCents: number | null;
  /** Estado de pagamento JÁ existente (payments.appointment_id) — só leitura nesta fase. */
  payment: { status: PaymentStatus; amountCents: number } | null;
  rescheduledToId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdBy: string | null;
  createdAt: string;
};

const APPOINTMENT_SELECT =
  "id, patient_id, contract_id, starts_at, ends_at, modality, status, amount_cents, rescheduled_to_id, cancelled_at, cancellation_reason, created_by, created_at, patients!inner(full_name, nutritionist_id), patient_contracts(plans(name)), payments(status, amount_cents)";

type Row = {
  id: string;
  patient_id: string;
  contract_id: string | null;
  starts_at: string;
  ends_at: string;
  modality: Modality;
  status: AppointmentStatus;
  amount_cents: number | null;
  rescheduled_to_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  patients: { full_name: string; nutritionist_id: string };
  patient_contracts: { plans: { name: string } | null } | null;
  payments: { status: PaymentStatus; amount_cents: number }[];
};

function toItem(row: Row): AppointmentListItem {
  const payment = row.payments.find((candidate) => candidate.status === "CONFIRMED") ?? row.payments[0] ?? null;
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patients.full_name,
    contractId: row.contract_id,
    planName: row.patient_contracts?.plans?.name ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    modality: row.modality,
    status: row.status,
    amountCents: row.amount_cents,
    payment: payment ? { status: payment.status, amountCents: payment.amount_cents } : null,
    rescheduledToId: row.rescheduled_to_id,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Consultas do nutricionista num período [from, to) — todas as status (a UI decide o que mostrar). */
export async function listAppointmentsInRange(
  nutritionistId: string,
  fromISO: string,
  toISO: string,
): Promise<AppointmentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("nutritionist_id", nutritionistId)
    .lt("starts_at", toISO)
    .gt("ends_at", fromISO)
    .order("starts_at");
  if (error) throw domainErrorFromDatabase(error);
  return (data as unknown as Row[]).map(toItem);
}

/** Próximas sessões ativas (SCHEDULED/CONFIRMED), da mais próxima para a mais distante. */
export async function listUpcomingAppointments(
  nutritionistId: string,
  fromISO: string,
  toISO: string | null,
  limit = 50,
): Promise<AppointmentListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("nutritionist_id", nutritionistId)
    .in("status", [...ACTIVE_STATUSES])
    .gte("ends_at", fromISO)
    .order("starts_at")
    .limit(limit);
  if (toISO) query = query.lt("starts_at", toISO);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return (data as unknown as Row[]).map(toItem);
}

/** Uma consulta (com nutritionist_id do paciente para checagem de ownership). */
export async function getAppointmentById(appointmentId: string): Promise<(AppointmentListItem & { nutritionistId: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const row = data as unknown as Row;
  return { ...toItem(row), nutritionistId: row.patients.nutritionist_id };
}

/** Todas as consultas de um paciente (perfil no dashboard e portal), mais recente primeiro. */
export async function listPatientAppointments(patientId: string): Promise<AppointmentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return (data as unknown as Row[]).map(toItem);
}

/** Contagem de consultas por data civil (para a visão mês) é derivada em memória de listAppointmentsInRange. */

export type PatientSearchResult = { id: string; fullName: string; email: string | null; status: "ACTIVE" | "INACTIVE" };

/** Busca de pacientes do nutricionista para o autocomplete (≤ 10 resultados, server-side). */
export async function searchPatientsForScheduling(nutritionistId: string, term: string): Promise<PatientSearchResult[]> {
  const supabase = await createClient();
  const cleaned = term.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
  let query = supabase
    .from("patients")
    .select("id, full_name, email, status")
    .eq("nutritionist_id", nutritionistId)
    .eq("status", "ACTIVE")
    .order("full_name")
    .limit(10);
  if (cleaned) query = query.ilike("full_name", `%${cleaned}%`);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, status: row.status }));
}

export type ContractOption = { id: string; planName: string; startDate: string; endDate: string | null };

/** Contratos ACTIVE do paciente para vincular a consulta (§21). */
export async function getActiveContractsForPatient(patientId: string): Promise<ContractOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_contracts")
    .select("id, start_date, end_date, plans!inner(name)")
    .eq("patient_id", patientId)
    .eq("status", "ACTIVE")
    .order("start_date", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    planName: (row.plans as unknown as { name: string }).name,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

/** Observações internas da consulta (RLS: só o nutricionista responsável). */
export async function getAppointmentNotes(appointmentId: string): Promise<{ id: string; content: string; createdAt: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_notes")
    .select("id, content, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at");
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({ id: row.id, content: row.content, createdAt: row.created_at }));
}

/** Consulta original que foi reagendada para esta (rastreabilidade do histórico). */
export async function getRescheduleOrigin(appointmentId: string): Promise<{ id: string; startsAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("rescheduled_to_id", appointmentId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? { id: data.id, startsAt: data.starts_at } : null;
}
