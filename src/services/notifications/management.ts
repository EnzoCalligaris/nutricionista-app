import "server-only";

import { EXTERNAL_CHANNELS, isNotificationEventType, NOTIFICATION_EVENT_TYPES, type NotificationChannel, type NotificationEventType } from "@/domain/notifications/events";
import { normalizePhoneE164 } from "@/domain/notifications/phone";
import { canRetryManually } from "@/domain/notifications/retry";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/services/audit";
import { processDeliveries } from "@/services/notifications/service";
import { consumeToken } from "@/services/notifications/tokens";
import { requireOwnedPatient } from "@/services/patients";

/**
 * Casos de uso acionados por pessoas (prompt Fase 12 §21/§48–§49/§75/§86):
 * marcar lida, preferências, reprocessar entrega, solicitar/confirmar
 * presença, confirmar por link. Tudo que é do usuário usa o cliente de
 * SESSÃO (RLS decide); o admin só entra depois de a autorização já ter sido
 * provada (reprocessar entrega própria, enfileirar evento de paciente
 * próprio, consumir token).
 */

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).is("read_at", null);
  if (error) throw domainErrorFromDatabase(error);
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", recipientId).is("read_at", null);
  if (error) throw domainErrorFromDatabase(error);
}

export async function updatePatientNotificationPreferences(patientId: string, input: { emailEnabled: boolean; whatsappEnabled: boolean }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_notification_preferences")
    .upsert({ patient_id: patientId, email_enabled: input.emailEnabled, whatsapp_enabled: input.whatsappEnabled }, { onConflict: "patient_id" });
  if (error) throw domainErrorFromDatabase(error);
}

export type NutritionistPreferenceInput = { eventType: NotificationEventType; channel: NotificationChannel; enabled: boolean };

/** Preferências por evento/canal do nutricionista (§75) + auditoria NOTIFICATION_SETTINGS_UPDATED (§89). */
export async function updateNutritionistNotificationPreferences(nutritionistId: string, rows: NutritionistPreferenceInput[]): Promise<void> {
  const supabase = await createClient();
  const payload = rows
    .filter((r) => isNotificationEventType(r.eventType) && EXTERNAL_CHANNELS.includes(r.channel))
    .map((r) => ({ nutritionist_id: nutritionistId, event_type: r.eventType, channel: r.channel, enabled: r.enabled }));
  if (payload.length === 0) return;
  const { error } = await supabase.from("notification_preferences").upsert(payload, { onConflict: "nutritionist_id,event_type,channel" });
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: nutritionistId,
    action: "NOTIFICATION_SETTINGS_UPDATED",
    entityType: "notification_preferences",
    entityId: nutritionistId,
    metadata: { changed: payload.map((p) => `${p.event_type}:${p.channel}=${p.enabled ? "on" : "off"}`) },
  });
}

/**
 * Reprocessar entrega FAILED (§86): só o dono (RLS de leitura já garante
 * que só vê as suas), só FAILED — nunca uma SENT (duplicaria). Reinicia a
 * contagem e processa em seguida para o resultado aparecer na hora.
 */
export async function retryDelivery(nutritionistId: string, deliveryId: string): Promise<{ status: string }> {
  const supabase = await createClient();
  const { data: delivery, error } = await supabase.from("notification_deliveries").select("id, status, channel, nutritionist_id, event_id, patient_id, recipient").eq("id", deliveryId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!delivery || delivery.nutritionist_id !== nutritionistId) throw new DomainError("NOTIFICATION_DELIVERY_NOT_FOUND");
  if (!canRetryManually(delivery.status)) throw new DomainError("NOTIFICATION_DELIVERY_NOT_RETRYABLE");

  // O contato é relido do cadastro atual: o caso típico de FAILED permanente é
  // "destinatário inválido" corrigido pelo nutricionista antes de reenviar.
  let recipient = delivery.recipient;
  if (delivery.patient_id && (delivery.channel === "EMAIL" || delivery.channel === "WHATSAPP")) {
    const { data: patient } = await supabase.from("patients").select("email, phone").eq("id", delivery.patient_id).maybeSingle();
    if (delivery.channel === "EMAIL" && patient?.email?.trim()) recipient = patient.email.trim();
    if (delivery.channel === "WHATSAPP") {
      const phone = normalizePhoneE164(patient?.phone);
      if (phone.ok) recipient = phone.e164;
    }
  }

  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("notification_deliveries")
    .update({ status: "PENDING", recipient, next_attempt_at: new Date().toISOString(), attempt_count: 0, failed_at: null, processing_started_at: null })
    .eq("id", deliveryId)
    .eq("status", "FAILED")
    .select("id")
    .maybeSingle();
  if (!updated) throw new DomainError("NOTIFICATION_DELIVERY_NOT_RETRYABLE");

  await recordAudit({ actorId: nutritionistId, action: "NOTIFICATION_RETRY_REQUESTED", entityType: "notification_delivery", entityId: deliveryId, metadata: { channel: delivery.channel, event_id: delivery.event_id } });
  await processDeliveries({ limit: 25 });
  const { data: after } = await supabase.from("notification_deliveries").select("status").eq("id", deliveryId).maybeSingle();
  return { status: after?.status ?? "PENDING" };
}

/** Paciente confirma presença pelo portal (§48–§49): RPC com a sessão dele — a RLS e o trigger decidem. */
export async function confirmAppointmentPresence(appointmentId: string): Promise<"CONFIRMED" | "ALREADY_CONFIRMED"> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_appointment_presence", { p_appointment_id: appointmentId });
  if (error) throw domainErrorFromDatabase(error);
  return data === "ALREADY_CONFIRMED" ? "ALREADY_CONFIRMED" : "CONFIRMED";
}

/**
 * Nutricionista pede confirmação de presença (evento
 * APPOINTMENT_CONFIRMATION_REQUEST): ownership provada pela sessão antes de
 * enfileirar com o admin. Dedupe por consulta + dia (um pedido por dia).
 */
export async function requestAppointmentConfirmation(nutritionistId: string, appointmentId: string): Promise<{ queued: boolean }> {
  const supabase = await createClient();
  const { data: appointment, error } = await supabase.from("appointments").select("id, patient_id, nutritionist_id, status, starts_at, ends_at, modality").eq("id", appointmentId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!appointment || appointment.nutritionist_id !== nutritionistId) throw new DomainError("APPOINTMENT_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, appointment.patient_id);
  if (appointment.status !== "SCHEDULED" || new Date(appointment.starts_at).getTime() <= Date.now()) throw new DomainError("INVALID_APPOINTMENT_STATUS_TRANSITION");

  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const { data: eventId, error: enqueueError } = await admin.rpc("enqueue_notification_event", {
    p_event_type: "APPOINTMENT_CONFIRMATION_REQUEST",
    p_entity_type: "appointment",
    p_entity_id: appointment.id,
    p_patient_id: appointment.patient_id,
    p_nutritionist_id: nutritionistId,
    p_payload: { appointment_id: appointment.id, starts_at: appointment.starts_at, ends_at: appointment.ends_at, modality: appointment.modality },
    p_dedupe_key: `appointment_confirmation_request:${appointment.id}:${day}`,
  });
  if (enqueueError) throw domainErrorFromDatabase(enqueueError);
  await recordAudit({ actorId: nutritionistId, action: "APPOINTMENT_CONFIRMATION_REQUESTED", entityType: "appointment", entityId: appointment.id, metadata: { queued: eventId != null } });
  return { queued: eventId != null };
}

export type ConfirmByTokenResult =
  | { ok: true; outcome: "CONFIRMED" | "ALREADY_CONFIRMED"; startsAt: string }
  | { ok: false; reason: "EXPIRED" | "USED" | "NOT_FOUND" | "MALFORMED" | "WRONG_PURPOSE" | "APPOINTMENT_UNAVAILABLE" };

/**
 * Confirmação por link (§20/§48/§93–§95): token consumido atomicamente
 * (uso único), depois a mesma função SQL do portal — o link não é
 * autorização ampla: só confirma aquela consulta daquele paciente.
 */
export async function confirmAppointmentByToken(rawToken: string): Promise<ConfirmByTokenResult> {
  const consumed = await consumeToken(rawToken, "APPOINTMENT_CONFIRM");
  if (!consumed.ok) return { ok: false, reason: consumed.reason };
  const admin = createAdminClient();
  const { data: appointment } = await admin.from("appointments").select("id, patient_id, status, starts_at").eq("id", consumed.appointmentId).maybeSingle();
  if (!appointment || appointment.patient_id !== consumed.patientId) return { ok: false, reason: "APPOINTMENT_UNAVAILABLE" };
  const { data, error } = await admin.rpc("confirm_appointment_presence", { p_appointment_id: appointment.id });
  if (error) return { ok: false, reason: "APPOINTMENT_UNAVAILABLE" };
  return { ok: true, outcome: data === "ALREADY_CONFIRMED" ? "ALREADY_CONFIRMED" : "CONFIRMED", startsAt: appointment.starts_at };
}

export const ALL_EVENT_TYPES = NOTIFICATION_EVENT_TYPES;
