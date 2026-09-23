import { describe, expect, it } from "vitest";
import { buildTemplateVariables } from "@/domain/notifications/templates";
import { NOTIFICATION_EVENT_TYPES } from "@/domain/notifications/events";
import { FakeEmailProvider, FakeWhatsAppProvider } from "@/services/notifications/fake-providers";
import { renderNotificationEmail } from "@/services/notifications/render";

const signal = new AbortController().signal;

describe("FakeEmailProvider", () => {
  it("aceita, é determinístico e registra a entrega simulada", async () => {
    const provider = new FakeEmailProvider();
    const message = { to: "maria@example.com", subject: "x", html: "<p>x</p>", text: "x", idempotencyKey: "ev:EMAIL:pt", attempt: 1, signal };
    const first = await provider.send(message);
    const second = await provider.send({ ...message, attempt: 2 });
    expect(first.accepted && second.accepted && first.providerMessageId === second.providerMessageId).toBe(true);
    expect(provider.sent).toHaveLength(2);
    expect(provider.simulated).toBe(true);
  });

  it("cenários por destinatário: timeout/500 transitórios, inválido permanente, flaky recupera na 3ª", async () => {
    const provider = new FakeEmailProvider();
    const base = { subject: "x", html: "x", text: "x", idempotencyKey: "k", attempt: 1, signal };
    expect(await provider.send({ ...base, to: "timeout@example.com" })).toMatchObject({ accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true });
    expect(await provider.send({ ...base, to: "fail500@example.com" })).toMatchObject({ accepted: false, errorCode: "PROVIDER_UNAVAILABLE", httpStatus: 500 });
    expect(await provider.send({ ...base, to: "invalid@example.com" })).toMatchObject({ accepted: false, errorCode: "INVALID_RECIPIENT", retryable: false });
    expect(await provider.send({ ...base, to: "flaky@example.com", attempt: 1 })).toMatchObject({ accepted: false, errorCode: "PROVIDER_TIMEOUT" });
    expect(await provider.send({ ...base, to: "flaky@example.com", attempt: 2 })).toMatchObject({ accepted: false, httpStatus: 500 });
    expect(await provider.send({ ...base, to: "flaky@example.com", attempt: 3 })).toMatchObject({ accepted: true });
    expect(provider.sent).toHaveLength(1);
  });
});

describe("FakeWhatsAppProvider", () => {
  it("usa chave de template + variáveis e cenários pelo sufixo do número", async () => {
    const provider = new FakeWhatsAppProvider();
    const base = { templateKey: "appointment_reminder", variables: ["Ana", "24/09/2026 às 14:30"], idempotencyKey: "k", attempt: 1, signal };
    expect(await provider.send({ ...base, to: "+5511999990001" })).toMatchObject({ accepted: true });
    expect(await provider.send({ ...base, to: "+5511999990000" })).toMatchObject({ accepted: false, errorCode: "PROVIDER_TIMEOUT" });
    expect(await provider.send({ ...base, to: "+5511999990422" })).toMatchObject({ accepted: false, errorCode: "INVALID_RECIPIENT" });
    expect(provider.sent[0]?.subjectOrTemplate).toBe("appointment_reminder");
  });
});

describe("renderNotificationEmail", () => {
  const payload = { appointment_id: "a1", starts_at: "2026-09-24T17:30:00Z", ends_at: "2026-09-24T18:30:00Z", modality: "IN_PERSON" as const, material_title: "Guia" };

  it("renderiza todos os templates com HTML + texto, links a partir do siteUrl e sem localhost fixo", async () => {
    for (const eventType of NOTIFICATION_EVENT_TYPES) {
      const vars = buildTemplateVariables({ eventType, payload, patientName: "Maria Silva", nutritionistName: "Enzo Mangili" });
      const rendered = await renderNotificationEmail({ eventType, vars, siteUrl: "https://exemplo.test/" });
      expect(rendered.subject.length).toBeGreaterThan(5);
      expect(rendered.html).toContain("Método EM");
      expect(rendered.html).toContain(`https://exemplo.test${vars.portalPath}`);
      expect(rendered.html).not.toContain("localhost");
      expect(rendered.text).toContain("Maria");
    }
  });

  it("lembrete traz o link de confirmação e o de reagendar; feedback nunca traz conteúdo clínico", async () => {
    const vars = buildTemplateVariables({ eventType: "APPOINTMENT_REMINDER", payload, patientName: "Maria", nutritionistName: null });
    const reminder = await renderNotificationEmail({ eventType: "APPOINTMENT_REMINDER", vars, siteUrl: "https://exemplo.test", confirmUrl: "https://exemplo.test/confirmar/TOKEN" });
    expect(reminder.html).toContain("https://exemplo.test/confirmar/TOKEN");
    expect(reminder.html).toContain("Confirmar presença");
    expect(reminder.html).toContain("Preciso reagendar");
    expect(reminder.html).toContain("24/09/2026");
    expect(reminder.html).toContain("14:30");

    const feedbackVars = buildTemplateVariables({ eventType: "FEEDBACK_PUBLISHED", payload: { feedback_id: "f" }, patientName: "Maria", nutritionistName: null });
    const feedback = await renderNotificationEmail({ eventType: "FEEDBACK_PUBLISHED", vars: feedbackVars, siteUrl: "https://exemplo.test" });
    expect(feedback.text).toContain("Acesse o portal");
    expect(feedback.html).toContain("https://exemplo.test/paciente/feedbacks");
  });
});
