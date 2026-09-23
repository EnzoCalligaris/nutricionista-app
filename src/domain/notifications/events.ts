/**
 * Catálogo de eventos de notificação e roteamento por canal (prompt Fase 12
 * §5–§9/§31/§75). Regras puras: nenhum acesso a banco/provider.
 *
 * Evento ≠ entrega: um evento vira N entregas (uma por canal elegível). O
 * canal IN_APP é sempre entregue; EMAIL/WHATSAPP dependem (1) do default
 * técnico abaixo, (2) da preferência do nutricionista por evento/canal e (3)
 * da preferência do paciente por canal externo. Os defaults NÃO são
 * preferências reais do Enzo — são o ponto de partida técnico documentado em
 * docs/DECISIONS.md (PENDENTE DE DEFINIÇÃO).
 */

export const NOTIFICATION_EVENT_TYPES = [
  "APPOINTMENT_CREATED",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_CONFIRMATION_REQUEST",
  "FEEDBACK_PUBLISHED",
  "MATERIAL_ASSIGNED",
  "SUPPLEMENT_RECOMMENDATION_CREATED",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "WHATSAPP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const EXTERNAL_CHANNELS: readonly NotificationChannel[] = ["EMAIL", "WHATSAPP"];

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

export const EVENT_LABEL: Record<NotificationEventType, string> = {
  APPOINTMENT_CREATED: "Consulta agendada",
  APPOINTMENT_RESCHEDULED: "Consulta reagendada",
  APPOINTMENT_CANCELLED: "Consulta cancelada",
  APPOINTMENT_CONFIRMED: "Consulta confirmada",
  APPOINTMENT_REMINDER: "Lembrete de consulta",
  APPOINTMENT_CONFIRMATION_REQUEST: "Solicitação de confirmação",
  FEEDBACK_PUBLISHED: "Feedback disponibilizado",
  MATERIAL_ASSIGNED: "Material disponibilizado",
  SUPPLEMENT_RECOMMENDATION_CREATED: "Recomendação de suplemento",
};

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  IN_APP: "Portal",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
};

/**
 * Chave de template por evento (§33/§70). A mesma chave serve para e-mail
 * (`src/emails/<key>.tsx`) e para WhatsApp (mapeada para o nome aprovado no
 * BSP via `WHATSAPP_TEMPLATE_MAP` — nunca assumimos o nome aprovado).
 */
export const TEMPLATE_KEY: Record<NotificationEventType, string> = {
  APPOINTMENT_CREATED: "appointment_created",
  APPOINTMENT_RESCHEDULED: "appointment_rescheduled",
  APPOINTMENT_CANCELLED: "appointment_cancelled",
  APPOINTMENT_CONFIRMED: "appointment_confirmed",
  APPOINTMENT_REMINDER: "appointment_reminder",
  APPOINTMENT_CONFIRMATION_REQUEST: "appointment_confirmation_request",
  FEEDBACK_PUBLISHED: "feedback_published",
  MATERIAL_ASSIGNED: "material_assigned",
  SUPPLEMENT_RECOMMENDATION_CREATED: "supplement_recommendation_created",
};

/**
 * Default técnico de canais por evento. IN_APP sempre. Externos ligados para
 * o que é operacional e relevante fora do portal (agenda, lembrete); avisos
 * de conteúdo (feedback/material/suplemento) saem só por e-mail por padrão
 * — WhatsApp para eles fica desligado até o BSP e os templates existirem.
 * APPOINTMENT_CONFIRMED (confirmação administrativa) é só in-app.
 */
export const DEFAULT_CHANNELS: Record<NotificationEventType, readonly NotificationChannel[]> = {
  APPOINTMENT_CREATED: ["IN_APP", "EMAIL", "WHATSAPP"],
  APPOINTMENT_RESCHEDULED: ["IN_APP", "EMAIL", "WHATSAPP"],
  APPOINTMENT_CANCELLED: ["IN_APP", "EMAIL", "WHATSAPP"],
  APPOINTMENT_CONFIRMED: ["IN_APP"],
  APPOINTMENT_REMINDER: ["IN_APP", "EMAIL", "WHATSAPP"],
  APPOINTMENT_CONFIRMATION_REQUEST: ["IN_APP", "EMAIL", "WHATSAPP"],
  FEEDBACK_PUBLISHED: ["IN_APP", "EMAIL"],
  MATERIAL_ASSIGNED: ["IN_APP", "EMAIL"],
  SUPPLEMENT_RECOMMENDATION_CREATED: ["IN_APP", "EMAIL"],
};

/** Caminho RELATIVO do portal para o CTA de cada evento (nunca URL absoluta, nunca token). */
export const PORTAL_PATH: Record<NotificationEventType, string> = {
  APPOINTMENT_CREATED: "/paciente/consultas",
  APPOINTMENT_RESCHEDULED: "/paciente/consultas",
  APPOINTMENT_CANCELLED: "/paciente/consultas",
  APPOINTMENT_CONFIRMED: "/paciente/consultas",
  APPOINTMENT_REMINDER: "/paciente/consultas",
  APPOINTMENT_CONFIRMATION_REQUEST: "/paciente/consultas",
  FEEDBACK_PUBLISHED: "/paciente/feedbacks",
  MATERIAL_ASSIGNED: "/paciente/materiais",
  SUPPLEMENT_RECOMMENDATION_CREATED: "/paciente/suplementos",
};

export type NutritionistChannelPreference = { event_type: string; channel: NotificationChannel; enabled: boolean };
export type PatientChannelPreference = { email_enabled: boolean; whatsapp_enabled: boolean } | null;

export type ChannelDecision =
  | { channel: NotificationChannel; eligible: true }
  | { channel: NotificationChannel; eligible: false; reason: ChannelSkipReason };

export type ChannelSkipReason =
  | "CHANNEL_DISABLED_BY_DEFAULT"
  | "CHANNEL_DISABLED_BY_NUTRITIONIST"
  | "CHANNEL_DISABLED_BY_PATIENT"
  | "MISSING_EMAIL"
  | "MISSING_PHONE";

/** Canal ligado para o evento: preferência explícita do nutricionista vence o default técnico. */
export function isChannelEnabledForEvent(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  nutritionistPreferences: readonly NutritionistChannelPreference[],
): boolean {
  if (channel === "IN_APP") return true;
  const explicit = nutritionistPreferences.find((p) => p.event_type === eventType && p.channel === channel);
  if (explicit) return explicit.enabled;
  return DEFAULT_CHANNELS[eventType].includes(channel);
}

/**
 * Decide, canal a canal, se o evento gera entrega e por quê não (§27–§28:
 * sem e-mail → SKIPPED MISSING_EMAIL; sem telefone → SKIPPED MISSING_PHONE;
 * canal desligado → SKIPPED com o motivo). Nunca falha o evento inteiro.
 */
export function routeEvent(input: {
  eventType: NotificationEventType;
  nutritionistPreferences: readonly NutritionistChannelPreference[];
  patientPreference: PatientChannelPreference;
  recipient: { email: string | null; phoneE164: string | null };
}): ChannelDecision[] {
  return NOTIFICATION_CHANNELS.map((channel): ChannelDecision => {
    if (channel === "IN_APP") return { channel, eligible: true };
    if (!isChannelEnabledForEvent(input.eventType, channel, input.nutritionistPreferences)) {
      const explicit = input.nutritionistPreferences.some((p) => p.event_type === input.eventType && p.channel === channel);
      return { channel, eligible: false, reason: explicit ? "CHANNEL_DISABLED_BY_NUTRITIONIST" : "CHANNEL_DISABLED_BY_DEFAULT" };
    }
    if (channel === "EMAIL") {
      if (input.patientPreference && !input.patientPreference.email_enabled) return { channel, eligible: false, reason: "CHANNEL_DISABLED_BY_PATIENT" };
      if (!input.recipient.email) return { channel, eligible: false, reason: "MISSING_EMAIL" };
    }
    if (channel === "WHATSAPP") {
      if (input.patientPreference && !input.patientPreference.whatsapp_enabled) return { channel, eligible: false, reason: "CHANNEL_DISABLED_BY_PATIENT" };
      if (!input.recipient.phoneE164) return { channel, eligible: false, reason: "MISSING_PHONE" };
    }
    return { channel, eligible: true };
  });
}

/** Chave de idempotência da entrega: `<event_id>:<canal>:<patient_id>` (§11/§104). */
export function deliveryIdempotencyKey(eventId: string, channel: NotificationChannel, patientId: string): string {
  return `${eventId}:${channel}:${patientId}`;
}
