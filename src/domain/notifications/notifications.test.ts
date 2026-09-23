import { describe, expect, it } from "vitest";
import { DEFAULT_CHANNELS, deliveryIdempotencyKey, isChannelEnabledForEvent, routeEvent, NOTIFICATION_EVENT_TYPES, TEMPLATE_KEY, PORTAL_PATH } from "@/domain/notifications/events";
import { maskEmail, maskPhone, normalizePhoneE164 } from "@/domain/notifications/phone";
import { decideReminder, reminderDueAt } from "@/domain/notifications/reminder";
import { backoffMs, canRetryManually, classifyHttpStatus, decideAfterFailure, isRetryable, MAX_ATTEMPTS } from "@/domain/notifications/retry";
import { buildTemplateVariables, emailSubject, formatDateTimePtBR, inAppContent, offersPresenceConfirmation, whatsappVariables } from "@/domain/notifications/templates";
import { confirmTokenExpiresAt, evaluateToken, isWellFormedToken } from "@/domain/notifications/tokens";

const TZ = "America/Sao_Paulo";

describe("roteamento por canal", () => {
  const recipient = { email: "a@example.com", phoneE164: "+5511999990001" };

  it("todo evento tem template, caminho do portal e IN_APP sempre elegível", () => {
    for (const type of NOTIFICATION_EVENT_TYPES) {
      expect(TEMPLATE_KEY[type]).toMatch(/^[a-z_]+$/);
      expect(PORTAL_PATH[type]).toMatch(/^\/paciente\//);
      expect(DEFAULT_CHANNELS[type]).toContain("IN_APP");
      const decisions = routeEvent({ eventType: type, nutritionistPreferences: [], patientPreference: null, recipient });
      expect(decisions.find((d) => d.channel === "IN_APP")?.eligible).toBe(true);
    }
  });

  it("consulta agendada sai por e-mail e WhatsApp por default; feedback só por e-mail", () => {
    const created = routeEvent({ eventType: "APPOINTMENT_CREATED", nutritionistPreferences: [], patientPreference: null, recipient });
    expect(created.filter((d) => d.eligible).map((d) => d.channel)).toEqual(["IN_APP", "EMAIL", "WHATSAPP"]);
    const feedback = routeEvent({ eventType: "FEEDBACK_PUBLISHED", nutritionistPreferences: [], patientPreference: null, recipient });
    expect(feedback.find((d) => d.channel === "WHATSAPP")).toEqual({ channel: "WHATSAPP", eligible: false, reason: "CHANNEL_DISABLED_BY_DEFAULT" });
  });

  it("preferência do nutricionista desliga ou liga canal por evento", () => {
    const off = routeEvent({ eventType: "APPOINTMENT_REMINDER", nutritionistPreferences: [{ event_type: "APPOINTMENT_REMINDER", channel: "WHATSAPP", enabled: false }], patientPreference: null, recipient });
    expect(off.find((d) => d.channel === "WHATSAPP")).toEqual({ channel: "WHATSAPP", eligible: false, reason: "CHANNEL_DISABLED_BY_NUTRITIONIST" });
    expect(isChannelEnabledForEvent("FEEDBACK_PUBLISHED", "WHATSAPP", [{ event_type: "FEEDBACK_PUBLISHED", channel: "WHATSAPP", enabled: true }])).toBe(true);
    expect(isChannelEnabledForEvent("FEEDBACK_PUBLISHED", "IN_APP", [{ event_type: "FEEDBACK_PUBLISHED", channel: "IN_APP", enabled: false }])).toBe(true);
  });

  it("preferência do paciente desliga canal externo; sem e-mail/telefone → SKIPPED com motivo", () => {
    const patientOff = routeEvent({ eventType: "APPOINTMENT_CREATED", nutritionistPreferences: [], patientPreference: { email_enabled: false, whatsapp_enabled: true }, recipient });
    expect(patientOff.find((d) => d.channel === "EMAIL")).toEqual({ channel: "EMAIL", eligible: false, reason: "CHANNEL_DISABLED_BY_PATIENT" });
    const missing = routeEvent({ eventType: "APPOINTMENT_CREATED", nutritionistPreferences: [], patientPreference: null, recipient: { email: null, phoneE164: null } });
    expect(missing.find((d) => d.channel === "EMAIL")).toEqual({ channel: "EMAIL", eligible: false, reason: "MISSING_EMAIL" });
    expect(missing.find((d) => d.channel === "WHATSAPP")).toEqual({ channel: "WHATSAPP", eligible: false, reason: "MISSING_PHONE" });
    expect(missing.find((d) => d.channel === "IN_APP")?.eligible).toBe(true);
  });

  it("chave de idempotência é evento + canal + destinatário", () => {
    expect(deliveryIdempotencyKey("ev", "EMAIL", "pt")).toBe("ev:EMAIL:pt");
    expect(deliveryIdempotencyKey("ev", "EMAIL", "pt")).toBe(deliveryIdempotencyKey("ev", "EMAIL", "pt"));
    expect(deliveryIdempotencyKey("ev", "WHATSAPP", "pt")).not.toBe(deliveryIdempotencyKey("ev", "EMAIL", "pt"));
  });
});

describe("normalização de telefone", () => {
  it("formatos brasileiros comuns viram +55DDDNÚMERO", () => {
    expect(normalizePhoneE164("(11) 99999-0001")).toEqual({ ok: true, e164: "+5511999990001" });
    expect(normalizePhoneE164("11 9 9999 0001")).toEqual({ ok: true, e164: "+5511999990001" });
    expect(normalizePhoneE164("+55 (11) 99999-0001")).toEqual({ ok: true, e164: "+5511999990001" });
    expect(normalizePhoneE164("5511999990001")).toEqual({ ok: true, e164: "+5511999990001" });
    expect(normalizePhoneE164("011 99999-0001")).toEqual({ ok: true, e164: "+5511999990001" });
    expect(normalizePhoneE164("(21) 3333-4444")).toEqual({ ok: true, e164: "+552133334444" });
  });

  it("vazio e inválidos são recusados sem inventar número", () => {
    expect(normalizePhoneE164(null)).toEqual({ ok: false, reason: "EMPTY" });
    expect(normalizePhoneE164("   ")).toEqual({ ok: false, reason: "EMPTY" });
    expect(normalizePhoneE164("abc")).toEqual({ ok: false, reason: "INVALID" });
    expect(normalizePhoneE164("1199")).toEqual({ ok: false, reason: "INVALID" });
    expect(normalizePhoneE164("(00) 99999-0001")).toEqual({ ok: false, reason: "INVALID" });
    expect(normalizePhoneE164("(11) 89999-0001")).toEqual({ ok: false, reason: "INVALID" });
    expect(normalizePhoneE164("(11) 99999-9999")).toEqual({ ok: false, reason: "INVALID" });
  });

  it("DDI estrangeiro explícito é mantido", () => {
    expect(normalizePhoneE164("+351 912 345 678")).toEqual({ ok: true, e164: "+351912345678" });
  });

  it("máscaras nunca expõem o contato inteiro", () => {
    expect(maskPhone("+5511999990001")).toBe("+5511 •••• 0001");
    expect(maskEmail("enzo@example.com")).toBe("e••••@example.com");
  });
});

describe("lembrete de 5 dias (America/Sao_Paulo)", () => {
  it("consulta 20/10/2026 14:00 SP → lembrete 15/10/2026 14:00 SP, mesmo com o job em UTC", () => {
    const startsAt = new Date("2026-10-20T14:00:00-03:00");
    expect(reminderDueAt(startsAt, TZ).toISOString()).toBe("2026-10-15T17:00:00.000Z");
  });

  it("consulta criada 2 dias antes não recebe lembrete retroativo", () => {
    const startsAt = new Date("2026-10-20T14:00:00-03:00");
    const now = new Date("2026-10-18T10:00:00-03:00");
    expect(decideReminder({ startsAt, status: "SCHEDULED", now, timeZone: TZ })).toEqual({ eligible: false, reason: "TOO_CLOSE" });
  });

  it("consulta a 20 dias tem lembrete elegível; cancelada/concluída não", () => {
    const startsAt = new Date("2026-10-20T14:00:00-03:00");
    const now = new Date("2026-10-01T10:00:00-03:00");
    const ok = decideReminder({ startsAt, status: "SCHEDULED", now, timeZone: TZ });
    expect(ok.eligible).toBe(true);
    if (ok.eligible) expect(ok.dueAt.toISOString()).toBe("2026-10-15T17:00:00.000Z");
    expect(decideReminder({ startsAt, status: "CANCELLED", now, timeZone: TZ })).toEqual({ eligible: false, reason: "INACTIVE_STATUS" });
    expect(decideReminder({ startsAt, status: "COMPLETED", now, timeZone: TZ })).toEqual({ eligible: false, reason: "INACTIVE_STATUS" });
    expect(decideReminder({ startsAt: new Date("2026-09-01T14:00:00-03:00"), status: "SCHEDULED", now, timeZone: TZ })).toEqual({ eligible: false, reason: "IN_PAST" });
  });

  it("reagendar 20/10 → 30/10: o lembrete novo é 25/10 14:00 SP", () => {
    const rescheduled = new Date("2026-10-30T14:00:00-03:00");
    const now = new Date("2026-10-18T10:00:00-03:00");
    const decision = decideReminder({ startsAt: rescheduled, status: "SCHEDULED", now, timeZone: TZ });
    expect(decision.eligible).toBe(true);
    if (decision.eligible) expect(formatDateTimePtBR(decision.dueAt, TZ)).toBe("25/10/2026 às 14:00");
  });
});

describe("retry, backoff e classificação de erro", () => {
  it("timeout/429/5xx são transitórios; destinatário inválido e config são permanentes", () => {
    expect(isRetryable({ code: "PROVIDER_TIMEOUT" })).toBe(true);
    expect(isRetryable({ code: "RATE_LIMITED", httpStatus: 429 })).toBe(true);
    expect(isRetryable({ code: "PROVIDER_UNAVAILABLE", httpStatus: 503 })).toBe(true);
    expect(isRetryable({ code: "INVALID_RECIPIENT", httpStatus: 422 })).toBe(false);
    expect(isRetryable({ code: "PROVIDER_NOT_CONFIGURED" })).toBe(false);
    expect(isRetryable({ code: "UNAUTHORIZED", httpStatus: 401 })).toBe(false);
    expect(isRetryable({ code: "INVALID_REQUEST", httpStatus: 500, retryable: false })).toBe(false);
    expect(classifyHttpStatus(429)).toBe("RATE_LIMITED");
    expect(classifyHttpStatus(502)).toBe("PROVIDER_UNAVAILABLE");
    expect(classifyHttpStatus(422)).toBe("INVALID_REQUEST");
  });

  it("backoff cresce por tentativa e satura", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(5 * 60_000);
    expect(backoffMs(3)).toBe(30 * 60_000);
    expect(backoffMs(4)).toBe(120 * 60_000);
    expect(backoffMs(9)).toBe(120 * 60_000);
  });

  it("falha transitória agenda nova tentativa; permanente ou limite → FAILED", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(decideAfterFailure({ failure: { code: "PROVIDER_TIMEOUT" }, attemptCount: 1, now })).toEqual({ status: "PENDING", nextAttemptAt: new Date("2026-10-01T10:01:00Z") });
    expect(decideAfterFailure({ failure: { code: "INVALID_RECIPIENT" }, attemptCount: 1, now })).toEqual({ status: "FAILED", reason: "PERMANENT" });
    expect(decideAfterFailure({ failure: { code: "PROVIDER_UNAVAILABLE" }, attemptCount: MAX_ATTEMPTS, now })).toEqual({ status: "FAILED", reason: "MAX_ATTEMPTS" });
  });

  it("só FAILED pode ser reprocessado manualmente", () => {
    expect(canRetryManually("FAILED")).toBe(true);
    expect(canRetryManually("SENT")).toBe(false);
    expect(canRetryManually("PENDING")).toBe(false);
    expect(canRetryManually("SKIPPED")).toBe(false);
  });
});

describe("variáveis de template (pt-BR, fuso configurado)", () => {
  const payload = { appointment_id: "a1", starts_at: "2026-09-24T17:30:00Z", ends_at: "2026-09-24T18:30:00Z", modality: "IN_PERSON" as const };

  it("formata a consulta como 24/09/2026 às 14:30 e nunca em UTC", () => {
    const vars = buildTemplateVariables({ eventType: "APPOINTMENT_CREATED", payload, patientName: "Maria da Silva", nutritionistName: "Enzo Mangili" });
    expect(vars.appointmentDateTime).toBe("24/09/2026 às 14:30");
    expect(vars.appointmentDate).toBe("24/09/2026");
    expect(vars.appointmentTime).toBe("14:30");
    expect(vars.patientFirstName).toBe("Maria");
    expect(vars.modality).toBe("Presencial");
    expect(vars.address).toBeUndefined();
    expect(vars.portalPath).toBe("/paciente/consultas");
  });

  it("endereço só entra quando existe; reagendamento carrega o horário anterior", () => {
    const withAddress = buildTemplateVariables({ eventType: "APPOINTMENT_CREATED", payload, patientName: "Maria", nutritionistName: null, address: "Rua X, 1" });
    expect(withAddress.address).toBe("Rua X, 1");
    expect(withAddress.nutritionistName).toBe("Enzo Mangili");
    const online = buildTemplateVariables({ eventType: "APPOINTMENT_CREATED", payload: { ...payload, modality: "ONLINE" }, patientName: "Maria", nutritionistName: null, address: "Rua X, 1" });
    expect(online.address).toBeUndefined();
    const resched = buildTemplateVariables({ eventType: "APPOINTMENT_RESCHEDULED", payload: { ...payload, previous_starts_at: "2026-09-20T17:00:00Z" }, patientName: null, nutritionistName: null });
    expect(resched.previousDateTime).toBe("20/09/2026 às 14:00");
    expect(resched.patientFirstName).toBe("Paciente");
  });

  it("in-app e assunto sem conteúdo clínico; feedback só aponta o portal", () => {
    const vars = buildTemplateVariables({ eventType: "FEEDBACK_PUBLISHED", payload: { feedback_id: "f" }, patientName: "Ana", nutritionistName: null });
    const item = inAppContent("FEEDBACK_PUBLISHED", vars);
    expect(item).toEqual({ title: "Novo feedback", body: "Você recebeu um novo feedback. Acesse o portal para ler.", link: "/paciente/feedbacks" });
    expect(emailSubject("FEEDBACK_PUBLISHED", vars)).toBe("Você recebeu um novo feedback");
    const material = buildTemplateVariables({ eventType: "MATERIAL_ASSIGNED", payload: { material_title: "Guia" }, patientName: "Ana", nutritionistName: null });
    expect(inAppContent("MATERIAL_ASSIGNED", material).body).toContain('"Guia"');
    const reminder = buildTemplateVariables({ eventType: "APPOINTMENT_REMINDER", payload, patientName: "Ana", nutritionistName: null });
    expect(emailSubject("APPOINTMENT_REMINDER", reminder)).toBe("Lembrete: sua consulta é em 24/09/2026 às 14:30");
    expect(inAppContent("APPOINTMENT_REMINDER", reminder).body).toContain("Confirme sua presença");
  });

  it("lembrete e solicitação de confirmação oferecem confirmar presença; WhatsApp recebe variáveis posicionais", () => {
    expect(offersPresenceConfirmation("APPOINTMENT_REMINDER")).toBe(true);
    expect(offersPresenceConfirmation("APPOINTMENT_CREATED")).toBe(false);
    const vars = buildTemplateVariables({ eventType: "APPOINTMENT_REMINDER", payload, patientName: "Ana Lima", nutritionistName: null });
    expect(whatsappVariables("APPOINTMENT_REMINDER", vars, "https://x/confirmar/t")).toEqual(["Ana", "24/09/2026 às 14:30", "Presencial", "https://x/confirmar/t"]);
    expect(whatsappVariables("FEEDBACK_PUBLISHED", vars)).toEqual(["Ana"]);
  });
});

describe("tokens de ação por link", () => {
  it("expira no menor entre 7 dias e a hora da consulta", () => {
    const now = new Date("2026-10-15T14:00:00Z");
    expect(confirmTokenExpiresAt({ now, appointmentStartsAt: new Date("2026-10-20T17:00:00Z") }).toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(confirmTokenExpiresAt({ now, appointmentStartsAt: new Date("2026-11-20T17:00:00Z") }).toISOString()).toBe("2026-10-22T14:00:00.000Z");
  });

  it("valida propósito, uso único e expiração", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    const base = { purpose: "APPOINTMENT_CONFIRM", expires_at: "2026-10-20T00:00:00Z", used_at: null };
    expect(evaluateToken(base, "APPOINTMENT_CONFIRM", now)).toBe("VALID");
    expect(evaluateToken({ ...base, used_at: "2026-10-15T00:00:00Z" }, "APPOINTMENT_CONFIRM", now)).toBe("USED");
    expect(evaluateToken({ ...base, expires_at: "2026-10-15T00:00:00Z" }, "APPOINTMENT_CONFIRM", now)).toBe("EXPIRED");
    expect(evaluateToken({ ...base, purpose: "OTHER" }, "APPOINTMENT_CONFIRM", now)).toBe("WRONG_PURPOSE");
    expect(evaluateToken(null, "APPOINTMENT_CONFIRM", now)).toBe("NOT_FOUND");
  });

  it("só tokens bem formados chegam ao banco", () => {
    expect(isWellFormedToken("A".repeat(43))).toBe(true);
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("A".repeat(43) + "/")).toBe(false);
  });
});
