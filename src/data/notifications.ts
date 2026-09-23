import "server-only";

import { EXTERNAL_CHANNELS, NOTIFICATION_EVENT_TYPES, isChannelEnabledForEvent, type NotificationChannel, type NotificationEventType } from "@/domain/notifications/events";
import type { DeliveryStatus } from "@/domain/notifications/retry";
import { maskEmail, maskPhone } from "@/domain/notifications/phone";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { createClient } from "@/lib/supabase/server";

/**
 * Queries de notificações (prompt Fase 12 §21/§75/§80/§97–§99). Cliente de
 * SESSÃO: RLS garante que o paciente só vê os próprios itens in-app e que o
 * nutricionista só vê eventos/entregas dos seus pacientes. O portal nunca
 * lê `notification_deliveries` (ids de provider, erros, tentativas —
 * §99): a área do paciente é só `notifications`.
 */

export type PortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listPortalNotifications(recipientId: string, limit = 50): Promise<PortalNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({ id: row.id, type: row.type, title: row.title, body: row.body, link: row.link, readAt: row.read_at, createdAt: row.created_at }));
}

export async function countUnreadNotifications(recipientId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", recipientId).is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export type PatientPreference = { emailEnabled: boolean; whatsappEnabled: boolean };

export async function getPatientNotificationPreference(patientId: string): Promise<PatientPreference> {
  const supabase = await createClient();
  const { data } = await supabase.from("patient_notification_preferences").select("email_enabled, whatsapp_enabled").eq("patient_id", patientId).maybeSingle();
  return { emailEnabled: data?.email_enabled ?? true, whatsappEnabled: data?.whatsapp_enabled ?? true };
}

// Dashboard ---------------------------------------------------------------

export type DeliveryListItem = {
  id: string;
  eventId: string;
  eventType: string | null;
  channel: NotificationChannel;
  status: DeliveryStatus;
  /** Destinatário MASCARADO (§80/§90): nunca e-mail/telefone inteiro na listagem. */
  recipientMasked: string;
  patientId: string | null;
  patientName: string | null;
  provider: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  lastHttpStatus: number | null;
  skippedReason: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryFilters = { status?: DeliveryStatus | "ALL"; channel?: NotificationChannel | "ALL"; eventType?: NotificationEventType | "ALL"; limit?: number };

function maskRecipient(channel: NotificationChannel, recipient: string): string {
  if (channel === "EMAIL") return recipient.includes("@") ? maskEmail(recipient) : "—";
  if (channel === "WHATSAPP") return recipient.startsWith("+") ? maskPhone(recipient) : "—";
  return "Portal";
}

export async function listDeliveries(nutritionistId: string, filters: DeliveryFilters = {}): Promise<DeliveryListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notification_deliveries")
    .select("id, event_id, event_type, channel, status, recipient, patient_id, provider, attempt_count, last_error_code, last_http_status, skipped_reason, next_attempt_at, sent_at, failed_at, created_at, updated_at")
    .eq("nutritionist_id", nutritionistId)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.channel && filters.channel !== "ALL") query = query.eq("channel", filters.channel);
  if (filters.eventType && filters.eventType !== "ALL") query = query.eq("event_type", filters.eventType);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  const rows = data ?? [];

  // Views/joins: nome do paciente lido à parte (sem embed — docs/DECISIONS.md, Fase 7).
  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id).filter((id): id is string => Boolean(id))));
  const names = new Map<string, string>();
  if (patientIds.length > 0) {
    const { data: patients } = await supabase.from("patients").select("id, full_name").in("id", patientIds);
    for (const p of patients ?? []) names.set(p.id, p.full_name);
  }

  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    channel: row.channel,
    status: row.status,
    recipientMasked: maskRecipient(row.channel, row.recipient),
    patientId: row.patient_id,
    patientName: row.patient_id ? (names.get(row.patient_id) ?? null) : null,
    provider: row.provider,
    attemptCount: row.attempt_count,
    lastErrorCode: row.last_error_code,
    lastHttpStatus: row.last_http_status,
    skippedReason: row.skipped_reason,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export type DeliveryCounts = Record<DeliveryStatus, number>;

export async function countDeliveriesByStatus(nutritionistId: string): Promise<DeliveryCounts> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_deliveries").select("status").eq("nutritionist_id", nutritionistId).limit(5000);
  const counts: DeliveryCounts = { PENDING: 0, PROCESSING: 0, SENT: 0, DELIVERED: 0, FAILED: 0, CANCELLED: 0, SKIPPED: 0 };
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

export type PendingEventSummary = { id: string; eventType: string; scheduledFor: string; patientId: string | null };

/** Lembretes agendados e ainda não processados (visão operacional). */
export async function listScheduledEvents(nutritionistId: string, limit = 20): Promise<PendingEventSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_events")
    .select("id, event_type, scheduled_for, patient_id")
    .eq("nutritionist_id", nutritionistId)
    .is("processed_at", null)
    .is("cancelled_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  return (data ?? []).map((row) => ({ id: row.id, eventType: row.event_type, scheduledFor: row.scheduled_for, patientId: row.patient_id }));
}

export type PreferenceMatrixRow = { eventType: NotificationEventType; channels: Record<"EMAIL" | "WHATSAPP", boolean> };

/** Matriz evento × canal externo já resolvida (explícito ou default técnico). */
export async function getNutritionistPreferenceMatrix(nutritionistId: string): Promise<PreferenceMatrixRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_preferences").select("event_type, channel, enabled").eq("nutritionist_id", nutritionistId);
  const prefs = (data ?? []).map((p) => ({ event_type: p.event_type, channel: p.channel, enabled: p.enabled }));
  return NOTIFICATION_EVENT_TYPES.map((eventType) => ({
    eventType,
    channels: {
      EMAIL: isChannelEnabledForEvent(eventType, "EMAIL", prefs),
      WHATSAPP: isChannelEnabledForEvent(eventType, "WHATSAPP", prefs),
    },
  }));
}

export const EXTERNAL_CHANNEL_LIST = EXTERNAL_CHANNELS;
