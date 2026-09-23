"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NOTIFICATION_EVENT_TYPES } from "@/domain/notifications/events";
import { getClientIp, notificationRetryRateLimiter, tokenActionRateLimiter } from "@/lib/auth/rate-limit";
import { requireNutritionist, requirePatient } from "@/lib/auth/session";
import { DomainError, domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { getPatientBookingContext } from "@/services/scheduling";
import * as management from "@/services/notifications/management";
import { runNotificationCycle } from "@/services/notifications/service";
import { isWellFormedToken } from "@/domain/notifications/tokens";
import { appointmentIdSchema, deliveryIdSchema, notificationIdSchema } from "@/validators/notifications";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions de notificações (prompt Fase 12 §92): `requirePatient` /
 * `requireNutritionist` sempre; Zod só com ids/flags; status, tentativas e
 * destinatário NUNCA vêm do client. Jobs têm autenticação própria
 * (`/api/cron/notifications`) e não passam por aqui.
 */

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[notifications] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

// Portal ------------------------------------------------------------------

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  await requirePatient();
  const id = notificationIdSchema.safeParse(notificationId);
  if (!id.success) return { ok: false, error: domainErrorMessage("NOTIFICATION_NOT_FOUND") };
  try {
    await management.markNotificationRead(id.data);
    revalidatePath("/paciente", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const profile = await requirePatient();
  try {
    await management.markAllNotificationsRead(profile.id);
    revalidatePath("/paciente", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updatePatientNotificationPreferencesAction(formData: FormData): Promise<void> {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) redirect("/paciente/notificacoes");
  try {
    await management.updatePatientNotificationPreferences(context.patientId, {
      emailEnabled: formData.get("emailEnabled") === "on",
      whatsappEnabled: formData.get("whatsappEnabled") === "on",
    });
  } catch (error) {
    console.error("[notifications] preferências do paciente:", error instanceof Error ? error.message : "erro");
    redirect("/paciente/notificacoes");
  }
  revalidatePath("/paciente/notificacoes");
  redirect("/paciente/notificacoes?toast=notification_preferences_saved");
}

/** Confirmar presença pelo portal (§48–§49): SCHEDULED → CONFIRMED pela função SQL, com a sessão do paciente. */
export async function confirmPresenceAction(appointmentId: string): Promise<ActionResult & { outcome?: "CONFIRMED" | "ALREADY_CONFIRMED" }> {
  await requirePatient();
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };
  try {
    const outcome = await management.confirmAppointmentPresence(id.data);
    revalidatePath("/paciente/consultas");
    revalidatePath("/paciente");
    revalidatePath("/dashboard/agenda", "layout");
    return { ok: true, outcome };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// Dashboard ---------------------------------------------------------------

export async function retryDeliveryAction(deliveryId: string): Promise<ActionResult & { status?: string }> {
  const nutritionist = await requireNutritionist();
  const id = deliveryIdSchema.safeParse(deliveryId);
  if (!id.success) return { ok: false, error: domainErrorMessage("NOTIFICATION_DELIVERY_NOT_FOUND") };
  const limit = await notificationRetryRateLimiter.consume(`retry:${nutritionist.id}`);
  if (!limit.success) return { ok: false, error: domainErrorMessage("NOTIFICATION_RATE_LIMITED") };
  try {
    const result = await management.retryDelivery(nutritionist.id, id.data);
    revalidatePath("/dashboard/notificacoes");
    return { ok: true, status: result.status };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** "Processar fila agora" (uso operacional/local): mesmo ciclo do cron, autorizado pela sessão do nutricionista e limitado. */
export async function runNotificationCycleAction(): Promise<ActionResult & { summary?: string }> {
  const nutritionist = await requireNutritionist();
  const limit = await notificationRetryRateLimiter.consume(`cycle:${nutritionist.id}`);
  if (!limit.success) return { ok: false, error: domainErrorMessage("NOTIFICATION_RATE_LIMITED") };
  try {
    const result = await runNotificationCycle({ eventLimit: 100, deliveryLimit: 50 });
    revalidatePath("/dashboard/notificacoes");
    return { ok: true, summary: `${result.generate.events} evento(s) processado(s), ${result.process.claimed} entrega(s) tentada(s), ${result.process.sent} enviada(s), ${result.process.failed} com falha.` };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function requestAppointmentConfirmationAction(appointmentId: string): Promise<ActionResult & { queued?: boolean }> {
  const nutritionist = await requireNutritionist();
  const id = appointmentIdSchema.safeParse(appointmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("APPOINTMENT_NOT_FOUND") };
  try {
    const result = await management.requestAppointmentConfirmation(nutritionist.id, id.data);
    revalidatePath(`/dashboard/agenda/${id.data}`);
    revalidatePath("/dashboard/notificacoes");
    return { ok: true, queued: result.queued };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateNutritionistNotificationPreferencesAction(formData: FormData): Promise<void> {
  const nutritionist = await requireNutritionist();
  const rows = NOTIFICATION_EVENT_TYPES.flatMap((eventType) =>
    (["EMAIL", "WHATSAPP"] as const).map((channel) => ({ eventType, channel, enabled: formData.get(`${eventType}:${channel}`) === "on" })),
  );
  try {
    await management.updateNutritionistNotificationPreferences(nutritionist.id, rows);
  } catch (error) {
    if (!(error instanceof DomainError)) console.error("[notifications] preferências:", error instanceof Error ? error.message : "erro");
    redirect("/dashboard/configuracoes/notificacoes");
  }
  revalidatePath("/dashboard/configuracoes/notificacoes");
  redirect("/dashboard/configuracoes/notificacoes?toast=notification_settings_saved");
}

// Público (link tokenizado) ----------------------------------------------

export type TokenConfirmState = "confirmed" | "already" | "expired" | "used" | "invalid" | "unavailable" | "limited";

/**
 * Confirmar presença por link (§20/§48/§93–§95): sem sessão; a autorização é
 * o token de uso único. Rate limit por IP (§84). O resultado volta pela
 * query string da própria página (o token já está na URL do link).
 */
export async function confirmByTokenAction(token: string): Promise<void> {
  const safeToken = isWellFormedToken(token) ? token : "";
  const ip = await getClientIp();
  const limit = await tokenActionRateLimiter.consume(`confirm:${ip}`);
  let state: TokenConfirmState;
  if (!limit.success) state = "limited";
  else if (!safeToken) state = "invalid";
  else {
    const result = await management.confirmAppointmentByToken(safeToken);
    if (result.ok) state = result.outcome === "CONFIRMED" ? "confirmed" : "already";
    else if (result.reason === "EXPIRED") state = "expired";
    else if (result.reason === "USED") state = "used";
    else if (result.reason === "APPOINTMENT_UNAVAILABLE") state = "unavailable";
    else state = "invalid";
  }
  if (state === "confirmed") {
    revalidatePath("/paciente/consultas");
    revalidatePath("/dashboard/agenda", "layout");
  }
  redirect(`/confirmar/${safeToken || "invalido"}?s=${state}`);
}
