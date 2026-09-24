import "server-only";

import { siteConfig } from "@/config/site";
import { deliveryIdempotencyKey, isNotificationEventType, routeEvent, TEMPLATE_KEY, type NotificationChannel, type NotificationEventType } from "@/domain/notifications/events";
import { normalizePhoneE164 } from "@/domain/notifications/phone";
import { decideAfterFailure, type ProviderErrorCode } from "@/domain/notifications/retry";
import { buildTemplateVariables, inAppContent, offersPresenceConfirmation, whatsappVariables, type EventPayload, type TemplateVariables } from "@/domain/notifications/templates";
import { confirmTokenExpiresAt } from "@/domain/notifications/tokens";
import { publicAddressLine, resolveAddress, resolveOnlineAttendance } from "@/domain/site-settings/resolve";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import { getEmailProvider, getWhatsAppProvider, getWhatsAppTemplateMap, ProviderConfigError } from "@/services/notifications/index";
import { PROVIDER_TIMEOUT_MS, type ProviderResult } from "@/services/notifications/providers";
import { renderNotificationEmail } from "@/services/notifications/render";
import { createAppointmentConfirmToken } from "@/services/notifications/tokens";

/**
 * Worker de notificações (prompt Fase 12 §2–§4/§10–§14/§57–§63):
 *
 *   evento (outbox, criado pelo trigger na transação da operação)
 *     → generateDeliveries: roteia por canal, grava entregas idempotentes
 *       (IN_APP já nasce entregue; EMAIL/WHATSAPP nascem PENDING; SKIPPED
 *       quando falta contato/canal desligado) e marca o evento processado
 *     → processDeliveries: claim atômico (SKIP LOCKED), renderiza, chama o
 *       provider com timeout, grava SENT / PENDING+backoff / FAILED.
 *
 * Tudo com o cliente admin (service role) — só jobs e ações já autorizadas
 * chamam este módulo. Nada aqui desfaz a operação de negócio: falha de
 * provider vira status da entrega, nunca exceção para quem agendou.
 * Logs: só ids, canal, código sanitizado — nunca conteúdo, token ou payload
 * do provider (§90–§91).
 */

type Admin = ReturnType<typeof createAdminClient>;
type EventRow = Database["public"]["Tables"]["notification_events"]["Row"];
type DeliveryRow = Database["public"]["Tables"]["notification_deliveries"]["Row"];

export type GenerateSummary = { events: number; deliveries: number; skipped: number; inApp: number };
export type ProcessSummary = { claimed: number; sent: number; retryScheduled: number; failed: number };

function log(message: string): void {
  console.info(`[notifications] ${message}`);
}

async function loadContext(admin: Admin, event: EventRow) {
  if (!event.patient_id || !event.nutritionist_id) return null;
  const [patient, nutritionist, prefs, patientPref, settings, address] = await Promise.all([
    admin.from("patients").select("id, profile_id, full_name, email, phone, nutritionist_id").eq("id", event.patient_id).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", event.nutritionist_id).maybeSingle(),
    admin.from("notification_preferences").select("event_type, channel, enabled").eq("nutritionist_id", event.nutritionist_id),
    admin.from("patient_notification_preferences").select("email_enabled, whatsapp_enabled").eq("patient_id", event.patient_id).maybeSingle(),
    admin.from("scheduling_settings").select("timezone").eq("nutritionist_id", event.nutritionist_id).maybeSingle(),
    // Fase 14: endereço estruturado + flag de exibição + atendimento online.
    // O worker usa o service role (sem RLS), então a permissão de exibir o
    // endereço é checada AQUI: e-mail só mostra endereço quando configurado E
    // autorizado (prompt Fase 14 §6).
    admin.from("site_settings").select("key, value"),
  ]);
  if (!patient.data) return null;
  const settingsMap = Object.fromEntries((address.data ?? []).map((row) => [row.key, row.value]));
  const resolvedAddress = resolveAddress(settingsMap);
  const online = resolveOnlineAttendance(settingsMap);
  return {
    patient: patient.data,
    nutritionistName: nutritionist.data?.full_name ?? null,
    preferences: prefs.data ?? [],
    patientPreference: patientPref.data ?? null,
    timeZone: settings.data?.timezone ?? siteConfig.timeZone,
    address: publicAddressLine(resolvedAddress) ?? readLegacyAddress(settingsMap),
    onlinePlatform: online.platform ?? null,
    onlineInstructions: online.instructions ?? null,
  };
}

/**
 * Chave legada `contact.address` (endereço em texto livre da Fase 4). Só vale
 * quando a flag de exibição está ligada — a mesma regra do endereço
 * estruturado.
 */
function readLegacyAddress(settings: Record<string, unknown>): string | null {
  if (settings["address.show_public"] !== true) return null;
  const legacy = settings["contact.address"];
  return typeof legacy === "string" && legacy.trim() ? legacy.trim() : null;
}

/**
 * Gera as entregas dos eventos devidos (§58). Idempotente: entregas por
 * `idempotency_key` e item in-app por (event_id, recipient_id) usam
 * `ignoreDuplicates`; um evento reprocessado por dois workers produz o mesmo
 * conjunto uma vez só.
 */
export async function generateDeliveries(options: { limit?: number } = {}): Promise<GenerateSummary> {
  const admin = createAdminClient();
  const summary: GenerateSummary = { events: 0, deliveries: 0, skipped: 0, inApp: 0 };
  const { data: events, error } = await admin.rpc("claim_notification_events", { p_limit: options.limit ?? 100 });
  if (error) throw new Error(`[notifications] claim de eventos falhou: ${error.code ?? error.message}`);

  for (const event of events ?? []) {
    summary.events += 1;
    if (!isNotificationEventType(event.event_type)) {
      await admin.from("notification_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
      log(`evento ${event.id} de tipo desconhecido (${event.event_type}) ignorado`);
      continue;
    }
    const ctx = await loadContext(admin, event);
    if (!ctx) {
      await admin.from("notification_events").update({ processed_at: new Date().toISOString(), cancelled_at: new Date().toISOString(), cancel_reason: "RECIPIENT_NOT_FOUND" }).eq("id", event.id);
      continue;
    }
    const eventType: NotificationEventType = event.event_type;
    const payload = (event.payload ?? {}) as EventPayload;
    const vars = buildTemplateVariables({
      eventType,
      payload,
      patientName: ctx.patient.full_name,
      nutritionistName: ctx.nutritionistName,
      timeZone: ctx.timeZone,
      address: ctx.address,
      onlinePlatform: ctx.onlinePlatform,
      onlineInstructions: ctx.onlineInstructions,
    });
    const phone = normalizePhoneE164(ctx.patient.phone);
    const email = ctx.patient.email?.trim() || null;
    const decisions = routeEvent({
      eventType,
      nutritionistPreferences: ctx.preferences.map((p) => ({ event_type: p.event_type, channel: p.channel, enabled: p.enabled })),
      patientPreference: ctx.patientPreference,
      recipient: { email, phoneE164: phone.ok ? phone.e164 : null },
    });

    let incomplete = false;
    for (const decision of decisions) {
      const base = {
        event_id: event.id,
        channel: decision.channel,
        patient_id: ctx.patient.id,
        nutritionist_id: event.nutritionist_id,
        event_type: eventType,
        template_key: TEMPLATE_KEY[eventType],
        variables: vars as unknown as Json,
        idempotency_key: deliveryIdempotencyKey(event.id, decision.channel, ctx.patient.id),
      };

      if (decision.channel === "IN_APP") {
        if (!ctx.patient.profile_id) {
          await admin.from("notification_deliveries").upsert({ ...base, recipient: "—", status: "SKIPPED", skipped_reason: "RECIPIENT_NOT_FOUND" }, { onConflict: "idempotency_key", ignoreDuplicates: true });
          summary.skipped += 1;
          continue;
        }
        const item = inAppContent(eventType, vars);
        const { error: inAppError } = await admin
          .from("notifications")
          .upsert({ recipient_id: ctx.patient.profile_id, type: eventType, title: item.title, body: item.body, link: item.link, event_id: event.id }, { onConflict: "event_id,recipient_id", ignoreDuplicates: true });
        if (inAppError) {
          log(`in-app do evento ${event.id} falhou: ${inAppError.code ?? "?"}`);
          incomplete = true; // evento fica sem processed_at → tentado de novo no próximo ciclo
          continue;
        }
        await admin.from("notification_deliveries").upsert(
          { ...base, recipient: ctx.patient.profile_id, recipient_profile_id: ctx.patient.profile_id, provider: "in_app", status: "SENT", sent_at: new Date().toISOString(), delivered_at: new Date().toISOString(), attempt_count: 1, last_attempt_at: new Date().toISOString() },
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        );
        summary.inApp += 1;
        continue;
      }

      if (!decision.eligible) {
        if (decision.reason === "CHANNEL_DISABLED_BY_DEFAULT") continue; // sem linha: não é uma entrega que "deveria" ter saído
        await admin.from("notification_deliveries").upsert({ ...base, recipient: "—", status: "SKIPPED", skipped_reason: decision.reason }, { onConflict: "idempotency_key", ignoreDuplicates: true });
        summary.skipped += 1;
        continue;
      }

      const recipient = decision.channel === "EMAIL" ? email! : (phone.ok ? phone.e164 : "");
      await admin.from("notification_deliveries").upsert({ ...base, recipient, recipient_profile_id: ctx.patient.profile_id, status: "PENDING", next_attempt_at: new Date().toISOString() }, { onConflict: "idempotency_key", ignoreDuplicates: true });
      summary.deliveries += 1;
    }

    if (!incomplete) await admin.from("notification_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  }
  return summary;
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | "TIMEOUT"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([run(controller.signal), new Promise<"TIMEOUT">((resolve) => controller.signal.addEventListener("abort", () => resolve("TIMEOUT"), { once: true }))]);
  } finally {
    clearTimeout(timer);
  }
}

async function sendOne(admin: Admin, delivery: DeliveryRow): Promise<ProviderResult> {
  const eventType = delivery.event_type;
  if (!eventType || !isNotificationEventType(eventType)) return { accepted: false, errorCode: "RENDER_ERROR", retryable: false };
  const vars = (delivery.variables ?? {}) as unknown as TemplateVariables;
  const channel: NotificationChannel = delivery.channel;

  let confirmUrl: string | null = null;
  if (offersPresenceConfirmation(eventType) && delivery.patient_id) {
    // Só consulta futura e ainda ativa recebe link de confirmação; o link vale até a consulta (máx. 7 dias).
    const { data: event } = await admin.from("notification_events").select("related_entity_id").eq("id", delivery.event_id).maybeSingle();
    const { data: appointment } = event?.related_entity_id
      ? await admin.from("appointments").select("id, starts_at, status").eq("id", event.related_entity_id).maybeSingle()
      : { data: null };
    if (appointment && appointment.status === "SCHEDULED" && new Date(appointment.starts_at).getTime() > Date.now()) {
      const token = await createAppointmentConfirmToken({
        appointmentId: appointment.id,
        patientId: delivery.patient_id,
        deliveryId: delivery.id,
        expiresAt: confirmTokenExpiresAt({ now: new Date(), appointmentStartsAt: new Date(appointment.starts_at) }),
      });
      confirmUrl = `${siteConfig.url.replace(/\/+$/, "")}/confirmar/${token}`;
    }
  }

  if (channel === "EMAIL") {
    const provider = getEmailProvider();
    const rendered = await renderNotificationEmail({ eventType, vars, siteUrl: siteConfig.url, confirmUrl });
    const result = await withTimeout(
      (signal) => provider.send({ to: delivery.recipient, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: delivery.idempotency_key, attempt: delivery.attempt_count, signal }),
      PROVIDER_TIMEOUT_MS,
    );
    return result === "TIMEOUT" ? { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true } : result;
  }

  if (channel === "WHATSAPP") {
    const provider = getWhatsAppProvider();
    const map = getWhatsAppTemplateMap();
    const key = TEMPLATE_KEY[eventType];
    const result = await withTimeout(
      (signal) => provider.send({ to: delivery.recipient, templateKey: map[key] ?? key, variables: whatsappVariables(eventType, vars, confirmUrl), idempotencyKey: delivery.idempotency_key, attempt: delivery.attempt_count, signal }),
      PROVIDER_TIMEOUT_MS,
    );
    return result === "TIMEOUT" ? { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true } : result;
  }

  return { accepted: false, errorCode: "INVALID_REQUEST", retryable: false };
}

/**
 * Processa entregas elegíveis (§59–§62). O claim já incrementou
 * `attempt_count` e marcou PROCESSING; aqui só o resultado é gravado.
 * Erro de configuração do provider é permanente (FAILED
 * PROVIDER_NOT_CONFIGURED) — fica visível no dashboard e reprocessável
 * depois de configurar.
 */
export async function processDeliveries(options: { limit?: number; staleMinutes?: number } = {}): Promise<ProcessSummary> {
  const admin = createAdminClient();
  const summary: ProcessSummary = { claimed: 0, sent: 0, retryScheduled: 0, failed: 0 };
  const { data: claimed, error } = await admin.rpc("claim_notification_deliveries", { p_limit: options.limit ?? 50, p_stale_minutes: options.staleMinutes ?? 10 });
  if (error) throw new Error(`[notifications] claim de entregas falhou: ${error.code ?? error.message}`);

  for (const delivery of claimed ?? []) {
    summary.claimed += 1;
    const now = new Date();
    let result: ProviderResult;
    try {
      result = await sendOne(admin, delivery);
    } catch (cause) {
      const code: ProviderErrorCode = cause instanceof ProviderConfigError ? "PROVIDER_NOT_CONFIGURED" : "RENDER_ERROR";
      result = { accepted: false, errorCode: code, retryable: false };
      log(`entrega ${delivery.id} (${delivery.channel}) falhou antes do envio: ${code}`);
    }

    if (result.accepted) {
      await admin
        .from("notification_deliveries")
        .update({ status: "SENT", sent_at: now.toISOString(), delivered_at: result.delivered ? now.toISOString() : null, provider: delivery.channel === "EMAIL" ? getEmailProvider().id : getWhatsAppProvider().id, provider_message_id: result.providerMessageId, next_attempt_at: null, processing_started_at: null, last_error_code: null, last_http_status: null })
        .eq("id", delivery.id);
      summary.sent += 1;
      continue;
    }

    const outcome = decideAfterFailure({ failure: { code: result.errorCode, httpStatus: result.httpStatus ?? null, retryable: result.retryable }, attemptCount: delivery.attempt_count, now });
    if (outcome.status === "PENDING") {
      await admin
        .from("notification_deliveries")
        .update({ status: "PENDING", next_attempt_at: outcome.nextAttemptAt.toISOString(), processing_started_at: null, last_error_code: result.errorCode, last_http_status: result.httpStatus ?? null, retry_count: delivery.retry_count + 1 })
        .eq("id", delivery.id);
      summary.retryScheduled += 1;
      log(`entrega ${delivery.id} (${delivery.channel}) tentativa ${delivery.attempt_count} falhou (${result.errorCode}${result.httpStatus ? ` ${result.httpStatus}` : ""}); próxima em ${outcome.nextAttemptAt.toISOString()}`);
    } else {
      await admin
        .from("notification_deliveries")
        .update({ status: "FAILED", failed_at: now.toISOString(), next_attempt_at: null, processing_started_at: null, last_error_code: result.errorCode, last_http_status: result.httpStatus ?? null })
        .eq("id", delivery.id);
      summary.failed += 1;
      log(`entrega ${delivery.id} (${delivery.channel}) FAILED (${outcome.reason}: ${result.errorCode}${result.httpStatus ? ` ${result.httpStatus}` : ""})`);
    }
  }
  return summary;
}

/** Ciclo completo do job (§57): gera entregas dos eventos devidos e processa a fila. */
export async function runNotificationCycle(options: { eventLimit?: number; deliveryLimit?: number } = {}): Promise<{ generate: GenerateSummary; process: ProcessSummary }> {
  const generate = await generateDeliveries({ limit: options.eventLimit });
  const process = await processDeliveries({ limit: options.deliveryLimit });
  return { generate, process };
}
