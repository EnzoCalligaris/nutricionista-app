import { z } from "zod";
import { NOTIFICATION_EVENT_TYPES } from "@/domain/notifications/events";

/** Validação das Server Actions de notificações (prompt Fase 12 §92): só ids e flags — nunca status/tentativas do client. */
export const notificationIdSchema = z.guid({ error: "Notificação inválida." });
export const deliveryIdSchema = z.guid({ error: "Entrega inválida." });
export const appointmentIdSchema = z.guid({ error: "Consulta inválida." });

export const patientPreferenceSchema = z.object({
  emailEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
});

export const nutritionistPreferenceRowSchema = z.object({
  eventType: z.enum(NOTIFICATION_EVENT_TYPES),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  enabled: z.boolean(),
});

export const nutritionistPreferencesSchema = z.array(nutritionistPreferenceRowSchema).max(NOTIFICATION_EVENT_TYPES.length * 2);

export const deliveryFiltersSchema = z.object({
  status: z.enum(["ALL", "PENDING", "PROCESSING", "SENT", "DELIVERED", "FAILED", "CANCELLED", "SKIPPED"]).default("ALL"),
  channel: z.enum(["ALL", "IN_APP", "EMAIL", "WHATSAPP"]).default("ALL"),
  eventType: z.enum(["ALL", ...NOTIFICATION_EVENT_TYPES]).default("ALL"),
});
