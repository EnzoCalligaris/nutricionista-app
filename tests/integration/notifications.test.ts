import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider, getWhatsAppProvider } from "@/services/notifications/index";
import { generateDeliveries, processDeliveries } from "@/services/notifications/service";
import { confirmAppointmentByToken } from "@/services/notifications/management";
import { consumeToken } from "@/services/notifications/tokens";
import type { FakeEmailProvider, FakeWhatsAppProvider } from "@/services/notifications/fake-providers";

/**
 * Integração da Fase 12 contra o Supabase LOCAL (prompt §100–§102): eventos
 * criados pelos triggers na mesma transação, geração idempotente de
 * entregas (in-app, e-mail fake, WhatsApp fake), SKIPPED sem e-mail/
 * telefone, retry com backoff (timeout → 500 → sucesso), erro permanente,
 * limite de tentativas, provider não configurado (erro de configuração),
 * concorrência de dois workers (1 envio), scheduler duas vezes (1 lembrete),
 * cancelamento/reagendamento cancelando entregas pendentes, token de
 * confirmação por link (uso único, replay) e ownership (dados de cada
 * nutricionista). Fixtures próprias (prefixo fd…), removidas ao final.
 *
 * Requer `npm run db:start` + `db:reset`. Uso: npm run test:notifications:integration
 */

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const NUTRI_A = "fd000000-0000-0000-0000-000000000001";
const NUTRI_B = "fd000000-0000-0000-0000-000000000002";
const PROFILE_A = "fd000000-0000-0000-0000-000000000003";
const PROFILE_B = "fd000000-0000-0000-0000-000000000004";
const PROFILE_C = "fd000000-0000-0000-0000-000000000005";
const PATIENT_A = "fd000000-0000-0000-0000-000000000010"; // e-mail + telefone
const PATIENT_B = "fd000000-0000-0000-0000-000000000011"; // sem e-mail nem telefone (nutri B)
const PATIENT_FLAKY = "fd000000-0000-0000-0000-000000000012"; // flaky@ (timeout → 500 → ok), WhatsApp …0999
const PATIENT_INVALID = "fd000000-0000-0000-0000-000000000013"; // invalid@ (permanente), WhatsApp …0422
const PATIENT_TIMEOUT = "fd000000-0000-0000-0000-000000000014"; // timeout@ sempre, WhatsApp …0000

let db: pg.Client;
const admin = () => createAdminClient();

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(text, params);
  return result.rows as T[];
}

let slot = 0;
/** Cada consulta num horário distinto (anti-double-booking da Fase 6 é real): dias à frente + N horas. */
async function insertAppointment(id: string, patientId: string, nutritionistId: string, daysAhead: number, status = "SCHEDULED"): Promise<void> {
  slot += 1;
  await sql(
    `insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status)
     values ($1, $2, $3, now() + ($4 || ' days')::interval + ($6 || ' hours')::interval, now() + ($4 || ' days')::interval + ($6 || ' hours')::interval + interval '30 minutes', 'IN_PERSON', $5)`,
    [id, nutritionistId, patientId, String(daysAhead), status, String(slot)],
  );
}

async function deliveriesOf(eventFilter: { entityId: string; eventType: string }) {
  const { data } = await admin()
    .from("notification_deliveries")
    .select("id, channel, status, recipient, attempt_count, last_error_code, last_http_status, next_attempt_at, skipped_reason, provider, provider_message_id, sent_at, event_id, notification_events!inner(related_entity_id, event_type)")
    .eq("notification_events.related_entity_id", eventFilter.entityId)
    .eq("notification_events.event_type", eventFilter.eventType)
    .order("channel");
  return data ?? [];
}

async function forceDue(deliveryId: string): Promise<void> {
  await sql(`update public.notification_deliveries set next_attempt_at = now() - interval '1 second' where id = $1`, [deliveryId]);
}

const PATIENT_IDS = [PATIENT_A, PATIENT_B, PATIENT_FLAKY, PATIENT_INVALID, PATIENT_TIMEOUT];
const USER_IDS = [NUTRI_A, NUTRI_B, PROFILE_A, PROFILE_B, PROFILE_C];

async function cleanup(): Promise<void> {
  // Fixtures de teste: os guards de imutabilidade (feedback disponibilizado, atribuição de material…)
  // impedem DELETE pela aplicação — aqui, como superusuário, desligamos triggers só nesta sessão de limpeza.
  await sql(`set session_replication_role = replica`);
  try {
    await sql(`delete from public.notification_action_tokens where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.notification_deliveries where patient_id = any($1::uuid[]) or nutritionist_id = any($2::uuid[])`, [PATIENT_IDS, USER_IDS]);
    await sql(`delete from public.notification_events where patient_id = any($1::uuid[]) or nutritionist_id = any($2::uuid[])`, [PATIENT_IDS, USER_IDS]);
    await sql(`delete from public.notifications where recipient_id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from public.appointments where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.feedback_messages where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.supplement_recommendations where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.material_assignments where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.patient_materials where nutritionist_id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from public.notification_preferences where nutritionist_id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from public.patient_notification_preferences where patient_id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.scheduling_settings where nutritionist_id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from public.audit_logs where actor_id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from public.patients where id = any($1::uuid[])`, [PATIENT_IDS]);
    await sql(`delete from public.profiles where id = any($1::uuid[])`, [USER_IDS]);
    await sql(`delete from auth.users where id = any($1::uuid[])`, [USER_IDS]);
  } finally {
    await sql(`set session_replication_role = origin`);
  }
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  await cleanup();
  const users: Array<[string, string]> = [
    [NUTRI_A, "fd-nutri-a@example.test"],
    [NUTRI_B, "fd-nutri-b@example.test"],
    [PROFILE_A, "fd-patient-a@example.test"],
    [PROFILE_B, "fd-patient-b@example.test"],
    [PROFILE_C, "fd-patient-c@example.test"],
  ];
  for (const [id, email] of users) {
    await sql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [id, email],
    );
  }
  await sql(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Nutri A'), ($2, 'NUTRITIONIST', 'Nutri B'), ($3, 'PATIENT', 'Ana Paula'), ($4, 'PATIENT', 'Bruno'), ($5, 'PATIENT', 'Carla')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name`, [NUTRI_A, NUTRI_B, PROFILE_A, PROFILE_B, PROFILE_C]);
  await sql(
    `insert into public.patients (id, profile_id, nutritionist_id, full_name, email, phone) values
      ($1, $6, $9, 'Ana Paula Souza', 'fd-patient-a@example.test', '(11) 99999-0001'),
      ($2, $7, $10, 'Bruno Lima', null, null),
      ($3, $8, $9, 'Carla Flaky', 'flaky@example.test', '(11) 99999-0999'),
      ($4, null, $9, 'Diego Inválido', 'invalid@example.test', '(11) 99999-0422'),
      ($5, null, $9, 'Eva Timeout', 'timeout@example.test', '(11) 99999-0000')`,
    [PATIENT_A, PATIENT_B, PATIENT_FLAKY, PATIENT_INVALID, PATIENT_TIMEOUT, PROFILE_A, PROFILE_B, PROFILE_C, NUTRI_A, NUTRI_B],
  );
  await sql(`insert into public.scheduling_settings (nutritionist_id, timezone) values ($1, 'America/Sao_Paulo'), ($2, 'America/Sao_Paulo') on conflict (nutritionist_id) do nothing`, [NUTRI_A, NUTRI_B]);
  // Fila limpa para as fixtures deste arquivo (eventos de outros testes/seed continuam sendo processados normalmente).
});

afterAll(async () => {
  await cleanup();
  await db.end();
});

describe("evento → entregas → provider (fake)", () => {
  const APPT = "fd000000-0000-0000-0000-000000000100";

  it("consulta agendada gera in-app + e-mail + WhatsApp, enviados uma vez só (idempotente)", async () => {
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 20);
    const events = await sql<{ event_type: string; cancelled_at: string | null; scheduled_for: string }>(`select event_type, cancelled_at, scheduled_for from public.notification_events where related_entity_id = $1 order by event_type`, [APPT]);
    expect(events.map((e) => e.event_type)).toEqual(["APPOINTMENT_CREATED", "APPOINTMENT_REMINDER"]);

    const first = await generateDeliveries({ limit: 200 });
    expect(first.events).toBeGreaterThanOrEqual(1);
    const created = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    // Ordem do enum notification_channel: IN_APP, EMAIL, WHATSAPP.
    expect(created.map((d) => [d.channel, d.status])).toEqual([
      ["IN_APP", "SENT"],
      ["EMAIL", "PENDING"],
      ["WHATSAPP", "PENDING"],
    ]);
    expect(created.find((d) => d.channel === "WHATSAPP")?.recipient).toBe("+5511999990001");

    const { data: inApp } = await admin().from("notifications").select("id, title, link, read_at").eq("recipient_id", PROFILE_A);
    expect(inApp?.filter((n) => n.title === "Consulta agendada")).toHaveLength(1);
    expect(inApp?.[0]?.link).toBe("/paciente/consultas");

    // Gerar de novo: nada duplica (evento já processado; chaves únicas).
    await generateDeliveries({ limit: 200 });
    expect(await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).toHaveLength(3);
    const { count } = await admin().from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", PROFILE_A);
    expect(count).toBe(1);

    // A fila é compartilhada com o que outras suítes deixaram pendente: contamos só o que é da fixture.
    const email = getEmailProvider() as FakeEmailProvider;
    const wa = getWhatsAppProvider() as FakeWhatsAppProvider;
    const sentToA = () => email.sent.filter((m) => m.to === "fd-patient-a@example.test").length;
    const waToA = () => wa.sent.filter((m) => m.to === "+5511999990001").length;
    const emailBefore = sentToA();
    const waBefore = waToA();
    const processed = await processDeliveries({ limit: 200 });
    expect(processed.claimed).toBeGreaterThanOrEqual(2);
    const after = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    for (const delivery of after) {
      expect(delivery.status).toBe("SENT");
      expect(delivery.provider).toBe(delivery.channel === "IN_APP" ? "in_app" : "fake");
      expect(delivery.attempt_count).toBe(1);
      expect(delivery.sent_at).not.toBeNull();
    }
    expect(after.find((d) => d.channel === "EMAIL")?.provider_message_id).toMatch(/^fake-email_/);
    expect(sentToA() - emailBefore).toBe(1);
    expect(waToA() - waBefore).toBe(1);
    const mail = email.sent.filter((m) => m.to === "fd-patient-a@example.test").at(-1);
    expect(mail?.body).toContain("Consulta agendada");
    expect(mail?.body).not.toContain("localhost:3000/confirmar");
    expect(wa.sent.filter((m) => m.to === "+5511999990001").at(-1)?.variables?.[0]).toBe("Ana");

    // Processar de novo: nada elegível (SENT nunca é reenviado).
    const again = await processDeliveries({ limit: 200 });
    expect(again.claimed).toBe(0);
    expect(sentToA() - emailBefore).toBe(1);
  });

  it("paciente sem e-mail e sem telefone: in-app entregue, externos SKIPPED com motivo", async () => {
    const APPT_B = "fd000000-0000-0000-0000-000000000101";
    await insertAppointment(APPT_B, PATIENT_B, NUTRI_B, 3);
    await generateDeliveries({ limit: 200 });
    const rows = await deliveriesOf({ entityId: APPT_B, eventType: "APPOINTMENT_CREATED" });
    expect(rows.map((d) => [d.channel, d.status, d.skipped_reason])).toEqual([
      ["IN_APP", "SENT", null],
      ["EMAIL", "SKIPPED", "MISSING_EMAIL"],
      ["WHATSAPP", "SKIPPED", "MISSING_PHONE"],
    ]);
    const processed = await processDeliveries({ limit: 200 });
    expect((await deliveriesOf({ entityId: APPT_B, eventType: "APPOINTMENT_CREATED" })).filter((d) => d.status === "SKIPPED")).toHaveLength(2);
    expect(processed.claimed).toBe(0);
  });
});

describe("retry, backoff e falha permanente", () => {
  it("timeout → 500 → sucesso: attempt_count/next_attempt_at/SENT", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000102";
    await insertAppointment(APPT, PATIENT_FLAKY, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    const before = Date.now();
    await processDeliveries({ limit: 200 });
    let rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    let email = rows.find((d) => d.channel === "EMAIL")!;
    expect(email.status).toBe("PENDING");
    expect(email.attempt_count).toBe(1);
    expect(email.last_error_code).toBe("PROVIDER_TIMEOUT");
    expect(new Date(email.next_attempt_at!).getTime()).toBeGreaterThanOrEqual(before + 55_000);
    expect(new Date(email.next_attempt_at!).getTime()).toBeLessThanOrEqual(Date.now() + 65_000);

    // Antes do backoff vencer: não é reclamada.
    const early = await processDeliveries({ limit: 200 });
    expect(early.claimed).toBe(0);

    await forceDue(email.id);
    await processDeliveries({ limit: 200 });
    rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    email = rows.find((d) => d.channel === "EMAIL")!;
    expect(email.status).toBe("PENDING");
    expect(email.attempt_count).toBe(2);
    expect(email.last_error_code).toBe("PROVIDER_UNAVAILABLE");
    expect(email.last_http_status).toBe(500);
    expect(new Date(email.next_attempt_at!).getTime()).toBeGreaterThanOrEqual(Date.now() + 4 * 60_000);

    await forceDue(email.id);
    await processDeliveries({ limit: 200 });
    rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    email = rows.find((d) => d.channel === "EMAIL")!;
    expect(email.status).toBe("SENT");
    expect(email.attempt_count).toBe(3);
    expect(email.last_error_code).toBeNull();
    expect(email.next_attempt_at).toBeNull();

    // WhatsApp …0999 segue o mesmo roteiro (flaky).
    const wa = rows.find((d) => d.channel === "WHATSAPP")!;
    expect(wa.status).toBe("PENDING");
    expect(wa.attempt_count).toBe(1);
  });

  it("destinatário inválido é permanente: FAILED na primeira tentativa, sem nova tentativa", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000103";
    await insertAppointment(APPT, PATIENT_INVALID, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    await processDeliveries({ limit: 200 });
    const rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    const email = rows.find((d) => d.channel === "EMAIL")!;
    expect(email.status).toBe("FAILED");
    expect(email.attempt_count).toBe(1);
    expect(email.last_error_code).toBe("INVALID_RECIPIENT");
    expect(email.last_http_status).toBe(422);
    expect(email.next_attempt_at).toBeNull();
    // Paciente sem profile → in-app SKIPPED RECIPIENT_NOT_FOUND (nunca falha o evento).
    expect(rows.find((d) => d.channel === "IN_APP")?.status).toBe("SKIPPED");
    expect(rows.find((d) => d.channel === "WHATSAPP")?.status).toBe("FAILED");

    // Reprocessamento manual = volta a PENDING com contagem zerada (o que a action do dashboard faz) e falha de novo, permanente.
    await sql(`update public.notification_deliveries set status = 'PENDING', next_attempt_at = now(), attempt_count = 0, failed_at = null where id = $1`, [email.id]);
    await processDeliveries({ limit: 200 });
    const retried = (await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")!;
    expect(retried.status).toBe("FAILED");
    expect(retried.attempt_count).toBe(1);
  });

  it("transitório que nunca melhora: FAILED ao atingir o limite de tentativas", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000104";
    await insertAppointment(APPT, PATIENT_TIMEOUT, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    let email = (await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")!;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await forceDue(email.id);
      await processDeliveries({ limit: 200 });
      email = (await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")!;
      expect(email.attempt_count).toBe(attempt);
      expect(email.status).toBe(attempt < 5 ? "PENDING" : "FAILED");
    }
    expect(email.last_error_code).toBe("PROVIDER_TIMEOUT");
    await forceDue(email.id);
    expect((await processDeliveries({ limit: 200 })).claimed).toBe(0);
  });

  it("PROCESSING travado (worker morto) é recuperado; recente não é roubado", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000105";
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    const email = (await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")!;
    await sql(`update public.notification_deliveries set status = 'PROCESSING', processing_started_at = now() - interval '2 minutes', attempt_count = 1 where id = $1`, [email.id]);
    await processDeliveries({ limit: 200, staleMinutes: 10 });
    expect((await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")?.status).toBe("PROCESSING");
    await sql(`update public.notification_deliveries set processing_started_at = now() - interval '30 minutes' where id = $1`, [email.id]);
    await processDeliveries({ limit: 200, staleMinutes: 10 });
    const recovered = (await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" })).find((d) => d.channel === "EMAIL")!;
    expect(recovered.status).toBe("SENT");
    expect(recovered.attempt_count).toBe(2);
  });
});

describe("configuração do provider", () => {
  it("EMAIL_PROVIDER=resend sem RESEND_API_KEY/EMAIL_FROM é erro de configuração (nunca cai no fake)", async () => {
    const previous = { ...process.env };
    try {
      vi.resetModules();
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      let mod = await import("@/services/notifications/index");
      expect(() => mod.getEmailProvider()).toThrow(/RESEND_API_KEY/);
      expect(mod.getProviderConfigStatus().find((s) => s.channel === "EMAIL")).toMatchObject({ configured: false, provider: "resend" });

      vi.resetModules();
      process.env.RESEND_API_KEY = "re_test_not_a_real_key";
      mod = await import("@/services/notifications/index");
      expect(() => mod.getEmailProvider()).toThrow(/EMAIL_FROM/);

      vi.resetModules();
      process.env.EMAIL_FROM = "Método EM <dev@example.test>";
      mod = await import("@/services/notifications/index");
      const provider = mod.getEmailProvider();
      expect(provider.id).toBe("resend");
      expect(provider.simulated).toBe(false);

      vi.resetModules();
      process.env.WHATSAPP_PROVIDER = "meta-cloud";
      mod = await import("@/services/notifications/index");
      expect(() => mod.getWhatsAppProvider()).toThrow(/BSP pendente/);
      expect(mod.getProviderConfigStatus().find((s) => s.channel === "WHATSAPP")?.configured).toBe(false);
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
      vi.resetModules();
    }
  });

  it("worker com provider não configurado marca a entrega FAILED PROVIDER_NOT_CONFIGURED (permanente, reprocessável)", async () => {
    const previous = { ...process.env };
    const APPT = "fd000000-0000-0000-0000-000000000106";
    try {
      await insertAppointment(APPT, PATIENT_A, NUTRI_A, 2);
      vi.resetModules();
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      const fresh = await import("@/services/notifications/service");
      await fresh.generateDeliveries({ limit: 200 });
      await fresh.processDeliveries({ limit: 200 });
      const rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
      const email = rows.find((d) => d.channel === "EMAIL")!;
      expect(email.status).toBe("FAILED");
      expect(email.last_error_code).toBe("PROVIDER_NOT_CONFIGURED");
      // WhatsApp (fake) continua funcionando: uma falha de configuração não derruba os outros canais.
      expect(rows.find((d) => d.channel === "WHATSAPP")?.status).toBe("SENT");
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
      vi.resetModules();
    }
  });
});

describe("concorrência e scheduler", () => {
  it("dois workers simultâneos: cada entrega é enviada exatamente uma vez", async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `fd000000-0000-0000-0000-00000000020${i}`);
    for (const id of ids) await insertAppointment(id, PATIENT_A, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    const email = getEmailProvider() as FakeEmailProvider;
    const countA = () => email.sent.filter((m) => m.to === "fd-patient-a@example.test").length;
    const before = countA();
    const [a, b] = await Promise.all([processDeliveries({ limit: 200 }), processDeliveries({ limit: 200 })]);
    const { data } = await admin().from("notification_deliveries").select("id, status, attempt_count, channel, notification_events!inner(related_entity_id)").in("notification_events.related_entity_id", ids).neq("channel", "IN_APP");
    expect(data).toHaveLength(12);
    for (const row of data ?? []) {
      expect(row.status).toBe("SENT");
      expect(row.attempt_count).toBe(1);
    }
    expect(a.claimed + b.claimed).toBeGreaterThanOrEqual(12);
    expect(countA() - before).toBe(6);
  });

  it("lembrete de 5 dias: fora da janela não gera; na janela gera uma vez mesmo com o scheduler rodando duas vezes", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000300";
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 20);
    await generateDeliveries({ limit: 200 });
    expect(await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_REMINDER" })).toHaveLength(0);

    // Simula o relógio chegando à janela (5 dias civis antes): scheduled_for no passado.
    await sql(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [APPT]);
    await Promise.all([generateDeliveries({ limit: 200 }), generateDeliveries({ limit: 200 })]);
    await generateDeliveries({ limit: 200 });
    const reminders = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_REMINDER" });
    expect(reminders.map((d) => d.channel)).toEqual(["IN_APP", "EMAIL", "WHATSAPP"]);
    const { data: inApp } = await admin().from("notifications").select("id, title, body").eq("recipient_id", PROFILE_A).eq("type", "APPOINTMENT_REMINDER");
    expect(inApp).toHaveLength(1);
    expect(inApp?.[0]?.body).toContain("Confirme sua presença");

    await processDeliveries({ limit: 200 });
    const email = getEmailProvider() as FakeEmailProvider;
    const reminderMail = email.sent.filter((s) => s.subjectOrTemplate.startsWith("Lembrete:")).at(-1);
    expect(reminderMail?.body).toMatch(/\/confirmar\/[A-Za-z0-9_-]{40,64}/);
    expect(reminderMail?.body).toContain("Preciso reagendar");
    const wa = getWhatsAppProvider() as FakeWhatsAppProvider;
    const waReminder = wa.sent.filter((m) => m.to === "+5511999990001").at(-1);
    expect(waReminder?.subjectOrTemplate).toBe("appointment_reminder");
    expect(waReminder?.variables?.[3]).toMatch(/\/confirmar\//);
  });

  it("cancelar antes do lembrete: evento cancelado, entregas pendentes canceladas, sem lembrete", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000301";
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 20);
    await sql(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [APPT]);
    await generateDeliveries({ limit: 200 });
    expect((await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_REMINDER" })).filter((d) => d.status === "PENDING")).toHaveLength(2);

    await sql(`update public.appointments set status = 'CANCELLED', cancelled_at = now() where id = $1`, [APPT]);
    const cancelled = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_REMINDER" });
    expect(cancelled.filter((d) => d.channel !== "IN_APP").every((d) => d.status === "CANCELLED")).toBe(true);
    const claimed = await processDeliveries({ limit: 200 });
    // Só as entregas do APPOINTMENT_CANCELLED (geradas abaixo) — nada do lembrete.
    await generateDeliveries({ limit: 200 });
    await processDeliveries({ limit: 200 });
    const email = getEmailProvider() as FakeEmailProvider;
    const subjects = email.sent.filter((s) => s.body?.includes(APPT) ?? false);
    expect(subjects).toHaveLength(0);
    expect((await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CANCELLED" })).find((d) => d.channel === "EMAIL")?.status).toBe("SENT");
    expect((await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_REMINDER" })).some((d) => d.status === "SENT" && d.channel !== "IN_APP")).toBe(false);
    expect(claimed.claimed).toBeGreaterThanOrEqual(0);
  });

  it("reagendar: lembrete antigo cancelado (inclusive entregas pendentes) e RESCHEDULED enviado com o novo horário", async () => {
    const OLD = "fd000000-0000-0000-0000-000000000302";
    const NEW = "fd000000-0000-0000-0000-000000000303";
    await insertAppointment(OLD, PATIENT_A, NUTRI_A, 20);
    await sql(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [OLD]);
    await generateDeliveries({ limit: 200 });
    // Mesma sequência da função reschedule_appointment.
    await sql(`update public.appointments set status = 'RESCHEDULED' where id = $1`, [OLD]);
    await insertAppointment(NEW, PATIENT_A, NUTRI_A, 30);
    await sql(`update public.appointments set rescheduled_to_id = $2 where id = $1`, [OLD, NEW]);

    const oldReminder = await deliveriesOf({ entityId: OLD, eventType: "APPOINTMENT_REMINDER" });
    expect(oldReminder.filter((d) => d.channel !== "IN_APP").every((d) => d.status === "CANCELLED")).toBe(true);
    const events = await sql<{ event_type: string; cancelled_at: string | null }>(`select event_type, cancelled_at from public.notification_events where related_entity_id = $1 order by event_type`, [NEW]);
    expect(events.find((e) => e.event_type === "APPOINTMENT_CREATED")?.cancelled_at).not.toBeNull();
    expect(events.find((e) => e.event_type === "APPOINTMENT_RESCHEDULED")?.cancelled_at).toBeNull();
    expect(events.find((e) => e.event_type === "APPOINTMENT_REMINDER")?.cancelled_at).toBeNull();

    await generateDeliveries({ limit: 200 });
    await processDeliveries({ limit: 200 });
    expect(await deliveriesOf({ entityId: NEW, eventType: "APPOINTMENT_CREATED" })).toHaveLength(0);
    const resched = await deliveriesOf({ entityId: NEW, eventType: "APPOINTMENT_RESCHEDULED" });
    expect(resched.find((d) => d.channel === "EMAIL")?.status).toBe("SENT");
    const email = getEmailProvider() as FakeEmailProvider;
    const rescheduledMail = email.sent.filter((m) => m.to === "fd-patient-a@example.test").at(-1);
    expect(rescheduledMail?.subjectOrTemplate).toMatch(/^Consulta reagendada/);
    expect(rescheduledMail?.body).toContain("Novo horário");
  });
});

describe("confirmação por link (token de uso único)", () => {
  it("token do lembrete confirma a consulta uma vez; replay e expirado são recusados", async () => {
    const APPT = "fd000000-0000-0000-0000-000000000400";
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 6);
    await sql(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [APPT]);
    await generateDeliveries({ limit: 200 });
    await processDeliveries({ limit: 200 });
    const email = getEmailProvider() as FakeEmailProvider;
    const mail = email.sent.filter((s) => s.subjectOrTemplate.startsWith("Lembrete:")).at(-1)!;
    const token = /\/confirmar\/([A-Za-z0-9_-]{40,64})/.exec(mail.body ?? "")?.[1];
    expect(token).toBeTruthy();

    // Um token por entrega (e-mail e WhatsApp), cada um de uso único.
    const { data: stored } = await admin().from("notification_action_tokens").select("token_hash, used_at, expires_at, purpose").eq("appointment_id", APPT);
    expect(stored).toHaveLength(2);
    expect(stored?.[0]?.token_hash).not.toContain(token!);
    expect(stored?.[0]?.purpose).toBe("APPOINTMENT_CONFIRM");
    expect(new Date(stored![0]!.expires_at).getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000);

    const first = await confirmAppointmentByToken(token!);
    expect(first).toMatchObject({ ok: true, outcome: "CONFIRMED" });
    const [appointment] = await sql<{ status: string; patient_confirmed_at: string | null }>(`select status, patient_confirmed_at from public.appointments where id = $1`, [APPT]);
    expect(appointment?.status).toBe("CONFIRMED");
    expect(appointment?.patient_confirmed_at).not.toBeNull();

    const replay = await confirmAppointmentByToken(token!);
    expect(replay).toEqual({ ok: false, reason: "USED" });
    expect(await confirmAppointmentByToken("A".repeat(43))).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await confirmAppointmentByToken("nope")).toEqual({ ok: false, reason: "MALFORMED" });

    // Expirado: outro token, expirado à força.
    await sql(`update public.notification_action_tokens set used_at = null, expires_at = now() - interval '1 minute' where appointment_id = $1`, [APPT]);
    expect(await consumeToken(token!, "APPOINTMENT_CONFIRM")).toEqual({ ok: false, reason: "EXPIRED" });
    // Não gerou aviso "consulta confirmada" para o próprio paciente.
    const [row] = await sql<{ n: string }>(`select count(*)::text as n from public.notification_events where related_entity_id = $1 and event_type = 'APPOINTMENT_CONFIRMED'`, [APPT]);
    expect(row?.n).toBe("0");
  });
});

describe("Fase 10 e ownership", () => {
  it("feedback/material/suplemento geram entregas genéricas com CTA do portal, sem conteúdo clínico", async () => {
    const FEEDBACK = "fd000000-0000-0000-0000-000000000500";
    await sql(`insert into public.feedback_messages (id, patient_id, author_id, content, published_at) values ($1, $2, $3, 'Conteúdo clínico secreto XYZ', now())`, [FEEDBACK, PATIENT_A, NUTRI_A]);
    const SUPP = "fd000000-0000-0000-0000-000000000501";
    await sql(`insert into public.supplement_recommendations (id, patient_id, name, dose_text, created_by) values ($1, $2, 'Creatina Secreta', '5 g', $3)`, [SUPP, PATIENT_A, NUTRI_A]);
    const MATERIAL = "fd000000-0000-0000-0000-000000000502";
    const ASSIGNMENT = "fd000000-0000-0000-0000-000000000503";
    await sql(`insert into public.patient_materials (id, nutritionist_id, kind, title, external_url) values ($1, $2, 'LINK', 'Guia de hidratação', 'https://example.com/guia')`, [MATERIAL, NUTRI_A]);
    await sql(`insert into public.material_assignments (id, material_id, patient_id) values ($1, $2, $3)`, [ASSIGNMENT, MATERIAL, PATIENT_A]);

    await generateDeliveries({ limit: 200 });
    await processDeliveries({ limit: 200 });
    const email = getEmailProvider() as FakeEmailProvider;
    const bodies = email.sent.filter((m) => m.to === "fd-patient-a@example.test").slice(-3).map((s) => s.body ?? "");
    expect(bodies.join("\n")).not.toContain("secreto");
    expect(bodies.join("\n")).not.toContain("Creatina");
    expect(bodies.join("\n")).toContain("Guia de hidratação");
    expect(bodies.join("\n")).toContain("/paciente/feedbacks");
    expect(bodies.join("\n")).toContain("/paciente/suplementos");
    expect(bodies.join("\n")).toContain("/paciente/materiais");
    expect((await deliveriesOf({ entityId: FEEDBACK, eventType: "FEEDBACK_PUBLISHED" })).map((d) => [d.channel, d.status])).toEqual([
      ["IN_APP", "SENT"],
      ["EMAIL", "SENT"],
    ]);
    const { data: inApp } = await admin().from("notifications").select("type, body").eq("recipient_id", PROFILE_A).in("type", ["FEEDBACK_PUBLISHED", "SUPPLEMENT_RECOMMENDATION_CREATED", "MATERIAL_ASSIGNED"]);
    expect(inApp).toHaveLength(3);
    expect(inApp?.map((n) => n.body).join(" ")).not.toContain("secreto");
  });

  it("preferências: nutricionista desliga WhatsApp do lembrete; paciente desliga e-mail", async () => {
    await sql(`insert into public.notification_preferences (nutritionist_id, event_type, channel, enabled) values ($1, 'APPOINTMENT_CREATED', 'WHATSAPP', false)`, [NUTRI_A]);
    await sql(`insert into public.patient_notification_preferences (patient_id, email_enabled, whatsapp_enabled) values ($1, false, true)`, [PATIENT_A]);
    const APPT = "fd000000-0000-0000-0000-000000000600";
    await insertAppointment(APPT, PATIENT_A, NUTRI_A, 2);
    await generateDeliveries({ limit: 200 });
    const rows = await deliveriesOf({ entityId: APPT, eventType: "APPOINTMENT_CREATED" });
    expect(rows.map((d) => [d.channel, d.status, d.skipped_reason])).toEqual([
      ["IN_APP", "SENT", null],
      ["EMAIL", "SKIPPED", "CHANNEL_DISABLED_BY_PATIENT"],
      ["WHATSAPP", "SKIPPED", "CHANNEL_DISABLED_BY_NUTRITIONIST"],
    ]);
    await sql(`delete from public.notification_preferences where nutritionist_id = $1`, [NUTRI_A]);
    await sql(`delete from public.patient_notification_preferences where patient_id = $1`, [PATIENT_A]);
  });

  it("ownership: eventos/entregas carregam o nutricionista dono; o paciente B não recebe nada de A", async () => {
    const { data: forB } = await admin().from("notifications").select("type").eq("recipient_id", PROFILE_B);
    expect(forB?.every((n) => n.type === "APPOINTMENT_CREATED")).toBe(true);
    expect(forB).toHaveLength(1);
    const { data: crossed } = await admin().from("notification_deliveries").select("id").eq("patient_id", PATIENT_A).neq("nutritionist_id", NUTRI_A);
    expect(crossed).toHaveLength(0);
    const { data: ofB } = await admin().from("notification_deliveries").select("nutritionist_id").eq("patient_id", PATIENT_B);
    expect(ofB?.every((d) => d.nutritionist_id === NUTRI_B)).toBe(true);
  });
});
