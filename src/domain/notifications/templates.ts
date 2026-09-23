import { DEFAULT_TIME_ZONE } from "@/config/site";
import { PORTAL_PATH, type NotificationEventType } from "@/domain/notifications/events";

/**
 * Camada de template tipada e central (prompt Fase 12 §70–§74/§32–§36):
 * a partir do payload MÍNIMO do evento produz as variáveis (strings já
 * formatadas em pt-BR no fuso configurado — nunca UTC para o paciente),
 * o título/corpo do item in-app e o assunto do e-mail. Nenhum conteúdo
 * clínico: feedback/suplemento só dizem "há algo novo no portal".
 *
 * `confirmUrl` (link tokenizado) NÃO nasce aqui nem é persistido em
 * `variables`: o worker o injeta na hora do envio (§20/§93).
 */

export type AppointmentPayload = {
  appointment_id: string;
  starts_at: string;
  ends_at?: string;
  modality: "IN_PERSON" | "ONLINE";
  previous_appointment_id?: string;
  previous_starts_at?: string;
};

export type EventPayload = Partial<AppointmentPayload> & {
  feedback_id?: string;
  assignment_id?: string;
  material_id?: string;
  material_title?: string;
  supplement_id?: string;
};

export type TemplateVariables = {
  patientFirstName: string;
  nutritionistName: string;
  portalPath: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentDateTime?: string;
  modality?: string;
  previousDateTime?: string;
  materialTitle?: string;
  /** Endereço só quando `site_settings` tem um cadastrado — nunca inventado (§37). */
  address?: string;
};

const MODALITY_LABEL: Record<"IN_PERSON" | "ONLINE", string> = { IN_PERSON: "Presencial", ONLINE: "Online" };

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** "24/09/2026" e "14:30" no fuso (America/Sao_Paulo por padrão). */
export function formatDateAndTime(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): { date: string; time: string } {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = read("hour") === "24" ? "00" : read("hour");
  return { date: `${read("day")}/${read("month")}/${read("year")}`, time: `${hour}:${read("minute")}` };
}

/** "24/09/2026 às 14:30" (§72). */
export function formatDateTimePtBR(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const { date, time } = formatDateAndTime(instant, timeZone);
  return `${date} às ${time}`;
}

export function firstName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "Paciente";
  return trimmed.split(/\s+/)[0]!;
}

export function buildTemplateVariables(input: {
  eventType: NotificationEventType;
  payload: EventPayload;
  patientName: string | null;
  nutritionistName: string | null;
  timeZone?: string;
  address?: string | null;
}): TemplateVariables {
  const tz = input.timeZone ?? DEFAULT_TIME_ZONE;
  const vars: TemplateVariables = {
    patientFirstName: firstName(input.patientName),
    nutritionistName: (input.nutritionistName ?? "").trim() || "Enzo Mangili",
    portalPath: PORTAL_PATH[input.eventType],
  };
  if (input.payload.starts_at) {
    const starts = new Date(input.payload.starts_at);
    if (!Number.isNaN(starts.getTime())) {
      const { date, time } = formatDateAndTime(starts, tz);
      vars.appointmentDate = date;
      vars.appointmentTime = time;
      vars.appointmentDateTime = `${date} às ${time}`;
    }
  }
  if (input.payload.modality && MODALITY_LABEL[input.payload.modality]) {
    vars.modality = MODALITY_LABEL[input.payload.modality];
    if (input.payload.modality === "IN_PERSON" && input.address?.trim()) vars.address = input.address.trim();
  }
  if (input.payload.previous_starts_at) {
    const prev = new Date(input.payload.previous_starts_at);
    if (!Number.isNaN(prev.getTime())) vars.previousDateTime = formatDateTimePtBR(prev, tz);
  }
  if (input.payload.material_title) vars.materialTitle = input.payload.material_title.slice(0, 120);
  return vars;
}

export type InAppContent = { title: string; body: string; link: string };

/** Item in-app (§21): título curto + descrição curta + link relativo do portal. */
export function inAppContent(eventType: NotificationEventType, vars: TemplateVariables): InAppContent {
  const when = vars.appointmentDateTime ?? "";
  const link = vars.portalPath;
  switch (eventType) {
    case "APPOINTMENT_CREATED":
      return { title: "Consulta agendada", body: `Sua consulta foi agendada para ${when}${vars.modality ? ` (${vars.modality.toLowerCase()})` : ""}.`, link };
    case "APPOINTMENT_RESCHEDULED":
      return { title: "Consulta reagendada", body: `Sua consulta foi reagendada para ${when}.`, link };
    case "APPOINTMENT_CANCELLED":
      return { title: "Consulta cancelada", body: `A consulta de ${when} foi cancelada.`, link };
    case "APPOINTMENT_CONFIRMED":
      return { title: "Consulta confirmada", body: `Sua consulta de ${when} está confirmada.`, link };
    case "APPOINTMENT_REMINDER":
      return { title: "Lembrete de consulta", body: `Sua consulta é em ${when}. Confirme sua presença ou reagende no portal.`, link };
    case "APPOINTMENT_CONFIRMATION_REQUEST":
      return { title: "Confirme sua consulta", body: `Confirme sua presença na consulta de ${when}.`, link };
    case "FEEDBACK_PUBLISHED":
      return { title: "Novo feedback", body: "Você recebeu um novo feedback. Acesse o portal para ler.", link };
    case "MATERIAL_ASSIGNED":
      return { title: "Novo material", body: vars.materialTitle ? `O material "${vars.materialTitle}" está disponível no portal.` : "Um novo material está disponível no portal.", link };
    case "SUPPLEMENT_RECOMMENDATION_CREATED":
      return { title: "Nova recomendação", body: "Uma nova recomendação de suplemento está disponível no portal.", link };
  }
}

/** Assunto do e-mail (§33): curto, sem conteúdo clínico. */
export function emailSubject(eventType: NotificationEventType, vars: TemplateVariables): string {
  const when = vars.appointmentDateTime ? ` — ${vars.appointmentDateTime}` : "";
  switch (eventType) {
    case "APPOINTMENT_CREATED":
      return `Consulta agendada${when}`;
    case "APPOINTMENT_RESCHEDULED":
      return `Consulta reagendada${when}`;
    case "APPOINTMENT_CANCELLED":
      return `Consulta cancelada${when}`;
    case "APPOINTMENT_CONFIRMED":
      return `Consulta confirmada${when}`;
    case "APPOINTMENT_REMINDER":
      return `Lembrete: sua consulta é em ${vars.appointmentDateTime ?? "breve"}`;
    case "APPOINTMENT_CONFIRMATION_REQUEST":
      return `Confirme sua consulta${when}`;
    case "FEEDBACK_PUBLISHED":
      return "Você recebeu um novo feedback";
    case "MATERIAL_ASSIGNED":
      return "Novo material disponível no portal";
    case "SUPPLEMENT_RECOMMENDATION_CREATED":
      return "Nova recomendação disponível no portal";
  }
}

/** Eventos cujo e-mail/WhatsApp levam o botão "Confirmar presença" por link tokenizado (§48). */
export function offersPresenceConfirmation(eventType: NotificationEventType): boolean {
  return eventType === "APPOINTMENT_REMINDER" || eventType === "APPOINTMENT_CONFIRMATION_REQUEST";
}

/** Variáveis posicionais do template de WhatsApp (ordem estável por chave — §25). */
export function whatsappVariables(eventType: NotificationEventType, vars: TemplateVariables, confirmUrl?: string | null): string[] {
  switch (eventType) {
    case "APPOINTMENT_CREATED":
    case "APPOINTMENT_RESCHEDULED":
    case "APPOINTMENT_CANCELLED":
    case "APPOINTMENT_CONFIRMED":
      return [vars.patientFirstName, vars.appointmentDateTime ?? "", vars.modality ?? ""];
    case "APPOINTMENT_REMINDER":
    case "APPOINTMENT_CONFIRMATION_REQUEST":
      return [vars.patientFirstName, vars.appointmentDateTime ?? "", vars.modality ?? "", confirmUrl ?? ""];
    case "MATERIAL_ASSIGNED":
      return [vars.patientFirstName, vars.materialTitle ?? "material"];
    case "FEEDBACK_PUBLISHED":
    case "SUPPLEMENT_RECOMMENDATION_CREATED":
      return [vars.patientFirstName];
  }
}
