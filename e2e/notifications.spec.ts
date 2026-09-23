import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// Fase 12 — notificações ponta a ponta contra o app real (build de produção)
// + Supabase local com o seed e providers FAKE (nada sai para a rede).
// Nutricionista e paciente em CONTEXTOS separados. Cobre: fila processada
// pelo dashboard → sino com contador → lista lida/não lida → marcar lida /
// todas; consulta agendada e lembrete no portal; confirmação de presença
// pelo portal e por link tokenizado (uso único, expirado/inválido);
// eventos da Fase 10 (feedback) chegando ao portal; entrega FAILED e
// reprocessamento no dashboard; configurações (status dos providers,
// canais por evento); job protegido por CRON_SECRET (401 sem segredo);
// mobile 390 sem overflow.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010", profileId: "90000000-0000-0000-0000-000000000101" };
const SEED_APPOINTMENT = "90000000-0000-0000-0000-000000000402"; // Fulana, SCHEDULED, futura
const E2E_APPOINTMENT = "e2000000-0000-0000-0000-000000000001";
// Consulta futura própria do E2E cujo lembrete de 5 dias é forçado para "já venceu" (o seed é sensível ao relógio).
const E2E_REMINDER_APPOINTMENT = "e2000000-0000-0000-0000-000000000002";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 12";

function readLocalEnv(key: string): string | undefined {
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Estado limpo e re-executável: fila do nutricionista de volta ao zero, seed intacto. */
async function resetQueue() {
  await withDb(async (client) => {
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.appointments where id = any($1::uuid[])`, [[E2E_APPOINTMENT, E2E_REMINDER_APPOINTMENT]]);
    await client.query(`delete from public.notification_action_tokens where patient_id = $1`, [PATIENT.patientId]);
    await client.query(`delete from public.notification_deliveries where nutritionist_id = $1`, [NUTRITIONIST.id]);
    await client.query(`delete from public.notifications where recipient_id in (select profile_id from public.patients where nutritionist_id = $1 and profile_id is not null)`, [NUTRITIONIST.id]);
    await client.query(`delete from public.notification_events where nutritionist_id = $1 and (related_entity_id = any($2::uuid[]) or event_type = 'APPOINTMENT_CONFIRMATION_REQUEST' or related_entity_type = 'feedback_message' and created_at >= $3)`, [NUTRITIONIST.id, [E2E_APPOINTMENT, E2E_REMINDER_APPOINTMENT], STARTED_AT]);
    await client.query(`update public.notification_events set processed_at = null where nutritionist_id = $1 and cancelled_at is null`, [NUTRITIONIST.id]);
    await client.query(`delete from public.feedback_messages where title like $1`, [`${TAG}%`]);
    await client.query(`delete from public.notification_preferences where nutritionist_id = $1`, [NUTRITIONIST.id]);
    await client.query(`delete from public.patient_notification_preferences where patient_id = $1`, [PATIENT.patientId]);
    await client.query(`update public.appointments set status = 'SCHEDULED', patient_confirmed_at = null where id = $1`, [SEED_APPOINTMENT]);
    await client.query(`update public.patients set email = $2 where id = $1`, [PATIENT.patientId, PATIENT.email]);
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('notification_delivery', 'notification_preferences')`, [STARTED_AT]);
    await client.query(`set session_replication_role = origin`);
  });
}

/** Consulta a 20 dias com o lembrete já "vencido": o ciclo gera o item "Lembrete de consulta" de forma determinística. */
async function seedReminderAppointment() {
  await withDb(async (client) => {
    await client.query(
      `insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status) values ($1, $2, $3, now() + interval '20 days 5 hours', now() + interval '20 days 6 hours', 'IN_PERSON', 'SCHEDULED')`,
      [E2E_REMINDER_APPOINTMENT, NUTRITIONIST.id, PATIENT.patientId],
    );
    await client.query(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [E2E_REMINDER_APPOINTMENT]);
  });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

const STARTED_AT = new Date().toISOString();
let nutriContext: BrowserContext;
let patientContext: BrowserContext;
let nutri: Page;
let patient: Page;

async function openContexts(browser: Browser) {
  nutriContext = await browser.newContext();
  patientContext = await browser.newContext();
  nutri = await nutriContext.newPage();
  patient = await patientContext.newPage();
  await login(nutri, NUTRITIONIST);
  await expect(nutri).toHaveURL(/\/dashboard$/);
  await login(patient, PATIENT);
  await expect(patient).toHaveURL(/\/paciente$/);
}

async function runCycle() {
  await nutri.goto("/dashboard/notificacoes");
  await nutri.getByTestId("run-cycle").click();
  await expect(nutri.getByText("Fila processada.")).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  await resetQueue();
  await seedReminderAppointment();
  await openContexts(browser);
});

test.afterAll(async () => {
  await resetQueue();
  await nutriContext?.close();
  await patientContext?.close();
});

test("job protegido: sem CRON_SECRET no header responde 401 (fail closed)", async ({ request }) => {
  const anonymous = await request.get("/api/cron/notifications");
  expect(anonymous.status()).toBe(401);
  const wrong = await request.get("/api/cron/notifications", { headers: { Authorization: "Bearer definitely-wrong" } });
  expect(wrong.status()).toBe(401);
  const secret = readLocalEnv("CRON_SECRET");
  test.skip(!secret, "CRON_SECRET não configurado em .env.local");
  const ok = await request.get("/api/cron/notifications?task=generate&limit=5", { headers: { Authorization: `Bearer ${secret}` } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.task).toBe("generate");
  expect(body.generate).toBeTruthy();
});

test("nutricionista processa a fila; paciente vê o sino com contador e a lista", async () => {
  await runCycle();
  await expect(nutri.getByTestId("delivery-row").first()).toBeVisible();
  const counts = nutri.getByTestId("delivery-counts");
  await expect(counts).toContainText("Enviada");

  await patient.goto("/paciente");
  const bell = patient.getByTestId("notifications-bell");
  await expect(bell).toBeVisible();
  const badge = patient.getByTestId("notifications-unread-count");
  await expect(badge).toBeVisible();
  const unread = Number(await badge.textContent());
  expect(unread).toBeGreaterThan(0);

  await bell.click();
  await expect(patient).toHaveURL(/\/paciente\/notificacoes$/);
  await expect(patient.getByRole("heading", { name: "Notificações" })).toBeVisible();
  const items = patient.getByTestId("notification-item");
  expect(await items.count()).toBeGreaterThanOrEqual(unread);
  await expect(items.filter({ hasText: "Consulta agendada" }).first()).toBeVisible();
  await expect(items.filter({ hasText: "Lembrete de consulta" }).first()).toBeVisible();
  await expect(items.filter({ hasText: "Novo material" }).first()).toBeVisible();
  // O portal nunca mostra ids de provider/tentativas.
  await expect(patient.getByText(/fake-email|tentativa|PROVIDER/i)).toHaveCount(0);
});

test("marcar como lida individualmente e todas; contador some", async () => {
  await patient.goto("/paciente/notificacoes");
  const unreadItems = patient.getByTestId("notification-item").filter({ has: patient.locator('[data-unread="true"]') });
  const firstUnread = patient.locator('[data-testid="notification-item"][data-unread="true"]').first();
  await expect(firstUnread).toBeVisible();
  const before = await patient.locator('[data-testid="notification-item"][data-unread="true"]').count();
  await firstUnread.getByRole("button", { name: "Marcar como lida" }).click();
  await expect(patient.locator('[data-testid="notification-item"][data-unread="true"]')).toHaveCount(before - 1);
  expect(unreadItems).toBeTruthy();

  await patient.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(patient.getByText("Todas marcadas como lidas.")).toBeVisible();
  await expect(patient.locator('[data-testid="notification-item"][data-unread="true"]')).toHaveCount(0);
  await expect(patient.getByText("Tudo lido.")).toBeVisible();
  await patient.goto("/paciente");
  await expect(patient.getByTestId("notifications-unread-count")).toHaveCount(0);
});

test("confirmação por link tokenizado: uso único, replay recusado, link inválido e expirado", async ({ page }) => {
  const pepper = readLocalEnv("NOTIFICATIONS_TOKEN_SECRET");
  test.skip(!pepper, "NOTIFICATIONS_TOKEN_SECRET não configurado em .env.local");
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(`${raw}:${pepper}`).digest("hex");
  const expiredRaw = randomBytes(32).toString("base64url");
  const expiredHash = createHash("sha256").update(`${expiredRaw}:${pepper}`).digest("hex");
  await withDb(async (client) => {
    await client.query(
      `insert into public.notification_action_tokens (token_hash, purpose, appointment_id, patient_id, expires_at) values ($1, 'APPOINTMENT_CONFIRM', $3, $4, now() + interval '1 day'), ($2, 'APPOINTMENT_CONFIRM', $3, $4, now() - interval '1 minute')`,
      [hash, expiredHash, SEED_APPOINTMENT, PATIENT.patientId],
    );
  });

  // Sem sessão: a página pública NÃO consome no GET; só no clique.
  await page.goto(`/confirmar/${raw}`);
  await expect(page.getByText("Toque no botão abaixo para confirmar")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(page.getByText("Presença confirmada", { exact: true })).toBeVisible();
  const status = await withDb(async (client) => (await client.query(`select status, patient_confirmed_at from public.appointments where id = $1`, [SEED_APPOINTMENT])).rows[0]);
  expect(status.status).toBe("CONFIRMED");
  expect(status.patient_confirmed_at).not.toBeNull();

  await page.goto(`/confirmar/${raw}`);
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(page.getByText("Link já utilizado", { exact: true })).toBeVisible();

  await page.goto(`/confirmar/${expiredRaw}`);
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(page.getByText("Este link expirou", { exact: true })).toBeVisible();
  await expect(page.getByText("Este link expirou. Entre no portal para continuar.")).toBeVisible();

  await page.goto("/confirmar/nao-e-um-token");
  await expect(page.getByText("Link inválido", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar presença" })).toHaveCount(0);

  // Volta a consulta para SCHEDULED para o fluxo do portal abaixo.
  await withDb((client) => client.query(`update public.appointments set status = 'SCHEDULED', patient_confirmed_at = null where id = $1`, [SEED_APPOINTMENT]));
});

test("paciente confirma presença pelo portal; nutricionista vê a confirmação e pede confirmação", async () => {
  await patient.goto("/paciente/consultas");
  const card = patient.locator(`#consulta-${SEED_APPOINTMENT}`);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(patient.getByText("Presença confirmada.")).toBeVisible();
  await expect(card.getByText("Confirmada", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Confirmar presença" })).toHaveCount(0);

  await nutri.goto(`/dashboard/agenda/${SEED_APPOINTMENT}`);
  await expect(nutri.getByText(/Confirmada pelo paciente em/)).toBeVisible();
  await expect(nutri.getByTestId("request-confirmation")).toHaveCount(0);

  // De volta a SCHEDULED: "Pedir confirmação" enfileira APPOINTMENT_CONFIRMATION_REQUEST (um por dia).
  await withDb((client) => client.query(`update public.appointments set status = 'SCHEDULED', patient_confirmed_at = null where id = $1`, [SEED_APPOINTMENT]));
  await nutri.goto(`/dashboard/agenda/${SEED_APPOINTMENT}`);
  await nutri.getByTestId("request-confirmation").click();
  await expect(nutri.getByText("Pedido de confirmação enviado à fila de notificações.")).toBeVisible();
  await nutri.getByTestId("request-confirmation").click();
  await expect(nutri.getByText("Já existe um pedido de confirmação de hoje para esta consulta.")).toBeVisible();
  await runCycle();
  await patient.goto("/paciente/notificacoes");
  await expect(patient.getByTestId("notification-item").filter({ hasText: "Confirme sua consulta" }).first()).toBeVisible();
});

test("feedback disponibilizado (Fase 10) vira notificação genérica com link para o portal", async () => {
  await withDb((client) =>
    client.query(`insert into public.feedback_messages (patient_id, author_id, title, content, published_at) values ($1, $2, $3, 'Conteúdo clínico que NÃO deve aparecer no aviso', now())`, [
      PATIENT.patientId,
      NUTRITIONIST.id,
      `${TAG} feedback`,
    ]),
  );
  await runCycle();
  await patient.goto("/paciente");
  await expect(patient.getByTestId("notifications-unread-count")).toBeVisible();
  await patient.goto("/paciente/notificacoes");
  const item = patient.getByTestId("notification-item").filter({ hasText: "Novo feedback" }).first();
  await expect(item).toBeVisible();
  await expect(item).toContainText("Acesse o portal para ler.");
  await expect(item).not.toContainText("Conteúdo clínico");
  await item.getByRole("link", { name: "Abrir" }).click();
  await expect(patient).toHaveURL(/\/paciente\/feedbacks$/);
  await patient.goto("/paciente/notificacoes");
  await expect(patient.getByTestId("notification-item").filter({ hasText: "Novo feedback" }).first()).toHaveAttribute("data-unread", "false");
});

test("entrega FAILED no dashboard e reprocessamento manual (permanente vs. corrigida)", async () => {
  await withDb(async (client) => {
    await client.query(`update public.patients set email = 'invalid@example.test' where id = $1`, [PATIENT.patientId]);
    await client.query(
      `insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status) values ($1, $2, $3, now() + interval '9 days 3 hours', now() + interval '9 days 4 hours', 'IN_PERSON', 'SCHEDULED')`,
      [E2E_APPOINTMENT, NUTRITIONIST.id, PATIENT.patientId],
    );
  });
  await runCycle();
  await nutri.goto("/dashboard/notificacoes?status=FAILED&channel=EMAIL");
  const failed = nutri.getByTestId("delivery-row").first();
  await expect(failed).toBeVisible();
  await expect(failed).toContainText("Falhou");
  await expect(failed).toContainText("Destinatário inválido");
  await expect(failed).toContainText("i••••@example.test");
  await expect(failed).not.toContainText("invalid@example.test");

  // Reprocessar com o e-mail ainda inválido: falha de novo (permanente, sem duplicar nada).
  await failed.getByTestId("retry-delivery").click();
  await expect(nutri.getByText(/Entrega reprocessada, mas ainda não enviada \(status: FAILED\)/)).toBeVisible();

  // Corrige o cadastro e reprocessa: o reenvio relê o contato atual → SENT.
  await withDb((client) => client.query(`update public.patients set email = $2 where id = $1`, [PATIENT.patientId, PATIENT.email]));
  await nutri.goto("/dashboard/notificacoes?status=FAILED&channel=EMAIL");
  await nutri.getByTestId("delivery-row").first().getByTestId("retry-delivery").click();
  await expect(nutri.getByText("Entrega reenviada com sucesso.")).toBeVisible();
  await nutri.goto("/dashboard/notificacoes?status=FAILED&channel=EMAIL");
  await expect(nutri.getByText("Nenhuma entrega registrada com estes filtros.")).toBeVisible();

  const audit = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.audit_logs where action = 'NOTIFICATION_RETRY_REQUESTED' and actor_id = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT])).rows[0]);
  expect(audit.n).toBeGreaterThanOrEqual(2);
});

test("configurações: status dos providers (simulado) e canais por evento persistem com auditoria", async () => {
  await nutri.goto("/dashboard/configuracoes/notificacoes");
  await expect(nutri.getByTestId("provider-email")).toContainText("Simulado (fake)");
  await expect(nutri.getByTestId("provider-whatsapp")).toContainText("Simulado (fake)");
  await expect(nutri.getByText(/re_[A-Za-z0-9]{8,}/)).toHaveCount(0);

  const whatsapp = nutri.getByTestId("pref-APPOINTMENT_CREATED").getByRole("checkbox", { name: "Consulta agendada por WhatsApp" });
  await expect(whatsapp).toBeChecked();
  await whatsapp.uncheck();
  await nutri.getByRole("button", { name: "Salvar canais" }).click();
  await expect(nutri.getByText("Preferências de notificação salvas.")).toBeVisible();
  await nutri.goto("/dashboard/configuracoes/notificacoes");
  await expect(nutri.getByTestId("pref-APPOINTMENT_CREATED").getByRole("checkbox", { name: "Consulta agendada por WhatsApp" })).not.toBeChecked();
  const audit = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.audit_logs where action = 'NOTIFICATION_SETTINGS_UPDATED' and actor_id = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT])).rows[0]);
  expect(audit.n).toBeGreaterThanOrEqual(1);

  // Paciente desliga e-mail para si.
  await patient.goto("/paciente/notificacoes");
  await patient.getByRole("checkbox", { name: /E-mail/ }).uncheck();
  await patient.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(patient.getByText("Preferências de aviso salvas.")).toBeVisible();
  await patient.goto("/paciente/notificacoes");
  await expect(patient.getByRole("checkbox", { name: /E-mail/ })).not.toBeChecked();
});

test("mobile 390: portal de notificações e sino sem overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await login(page, PATIENT);
  await expect(page).toHaveURL(/\/paciente$/);
  await expect(page.getByTestId("notifications-bell")).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/paciente/notificacoes");
  await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible();
  await expect(page.getByTestId("notification-item").first()).toBeVisible();
  await noHorizontalOverflow(page);
  await page.goto("/paciente/consultas");
  await noHorizontalOverflow(page);
  await context.close();
});
