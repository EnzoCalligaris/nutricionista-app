import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationEventType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_CONFIRMED";

/**
 * Evento interno de notificação (prompt Fase 6 §59): só a linha em
 * `notification_events`, exatamente como a Fase 2 modelou ("escrita feita
 * por rotinas server-side com service role"). NENHUMA entrega acontece
 * aqui — e-mail/WhatsApp/lembrete de 5 dias são Fase 12, que lerá estes
 * eventos. Falha é logada e não desfaz a operação de agenda.
 */
export async function recordNotificationEvent(input: {
  type: NotificationEventType;
  entityType: "appointment";
  entityId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notification_events").insert({
      event_type: input.type,
      related_entity_type: input.entityType,
      related_entity_id: input.entityId,
    });
    if (error) console.error(`[notifications] falha ao registrar ${input.type}: ${error.message}`);
  } catch (error) {
    console.error(`[notifications] falha ao registrar ${input.type}: ${error instanceof Error ? error.message : error}`);
  }
}
