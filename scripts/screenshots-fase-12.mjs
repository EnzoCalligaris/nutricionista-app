// QA visual da Fase 12 (CLAUDE.md — regra permanente): captura as telas REAIS
// de notificações (portal: lista, contador no sino, lida/não lida, consulta
// com "Confirmar presença", empty state; público: confirmação por link;
// dashboard: histórico de entregas com FAILED e reprocessamento,
// configurações com status dos providers) na aplicação rodando em
// http://localhost:3000 com o Supabase local + seed e providers FAKE.
// Saída: ./screenshots/fase-12/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-12.mjs [--extra]
//   --extra  também captura 375/430 (portal) e 1024 (dashboard).
//
// Prepara dados só no banco local (uma consulta extra com e-mail inválido
// para gerar uma entrega FAILED, um feedback disponibilizado e um token de
// confirmação de exemplo) — `npm run db:reset` restaura.

import { chromium } from "playwright";
import pg from "pg";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir as mkdirAsync } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const EMPTY_PATIENT = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", profileId: "90000000-0000-0000-0000-000000000102" };
const SEED_APPOINTMENT = "90000000-0000-0000-0000-000000000402";
const QA_APPOINTMENT = "5c000000-0000-0000-0000-000000000012";
const QA_REMINDER_APPOINTMENT = "5c000000-0000-0000-0000-000000000013"; // lembrete forçado "já vencido" (o seed depende do relógio)
const OUT = path.resolve("screenshots", "fase-12");
const extra = process.argv.includes("--extra");

function localEnv(key) {
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function withDb(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Fila zerada + cenários: e-mail inválido numa consulta extra (FAILED), feedback novo, token de exemplo. */
async function prepare() {
  const pepper = localEnv("NOTIFICATIONS_TOKEN_SECRET") ?? "dev-only-pepper";
  const raw = randomBytes(32).toString("base64url");
  const expiredRaw = randomBytes(32).toString("base64url");
  await withDb(async (client) => {
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.appointments where id = any($1::uuid[])`, [[QA_APPOINTMENT, QA_REMINDER_APPOINTMENT]]);
    await client.query(`delete from public.notification_action_tokens where patient_id = $1`, [PATIENT.patientId]);
    await client.query(`delete from public.notification_deliveries where nutritionist_id = $1`, [NUTRITIONIST.id]);
    await client.query(`delete from public.notifications where recipient_id in (select profile_id from public.patients where nutritionist_id = $1 and profile_id is not null)`, [NUTRITIONIST.id]);
    await client.query(`delete from public.notification_events where nutritionist_id = $1 and (related_entity_id = any($2::uuid[]) or event_type = 'APPOINTMENT_CONFIRMATION_REQUEST')`, [NUTRITIONIST.id, [QA_APPOINTMENT, QA_REMINDER_APPOINTMENT]]);
    await client.query(`update public.notification_events set processed_at = null where nutritionist_id = $1 and cancelled_at is null`, [NUTRITIONIST.id]);
    await client.query(`delete from public.feedback_messages where title = 'QA Fase 12 — retorno da semana'`);
    await client.query(`delete from public.notification_events where related_entity_type = 'feedback_message' and related_entity_id not in (select id from public.feedback_messages)`);
    await client.query(`update public.appointments set status = 'SCHEDULED', patient_confirmed_at = null where id = $1`, [SEED_APPOINTMENT]);
    await client.query(`set session_replication_role = origin`);
    // Entrega FAILED: consulta extra enquanto o e-mail do cadastro é inválido (restaurado logo abaixo).
    await client.query(`update public.patients set email = 'invalid@example.test' where id = $1`, [PATIENT.patientId]);
    await client.query(
      `insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status) values ($1, $2, $3, now() + interval '12 days 2 hours', now() + interval '12 days 3 hours', 'IN_PERSON', 'SCHEDULED')`,
      [QA_APPOINTMENT, NUTRITIONIST.id, PATIENT.patientId],
    );
    await client.query(
      `insert into public.appointments (id, nutritionist_id, patient_id, starts_at, ends_at, modality, status) values ($1, $2, $3, now() + interval '20 days 5 hours', now() + interval '20 days 6 hours', 'IN_PERSON', 'SCHEDULED')`,
      [QA_REMINDER_APPOINTMENT, NUTRITIONIST.id, PATIENT.patientId],
    );
    await client.query(`update public.notification_events set scheduled_for = now() - interval '1 minute' where related_entity_id = $1 and event_type = 'APPOINTMENT_REMINDER'`, [QA_REMINDER_APPOINTMENT]);
    await client.query(`insert into public.feedback_messages (patient_id, author_id, title, content, published_at) values ($1, $2, 'QA Fase 12 — retorno da semana', 'Conteúdo do feedback (não aparece no aviso).', now())`, [PATIENT.patientId, NUTRITIONIST.id]);
    await client.query(
      `insert into public.notification_action_tokens (token_hash, purpose, appointment_id, patient_id, expires_at) values ($1, 'APPOINTMENT_CONFIRM', $3, $4, now() + interval '1 day'), ($2, 'APPOINTMENT_CONFIRM', $3, $4, now() - interval '1 minute')`,
      [createHash("sha256").update(`${raw}:${pepper}`).digest("hex"), createHash("sha256").update(`${expiredRaw}:${pepper}`).digest("hex"), SEED_APPOINTMENT, PATIENT.patientId],
    );
  });
  return { raw, expiredRaw };
}

async function restorePatientEmail() {
  await withDb((client) => client.query(`update public.patients set email = $2 where id = $1`, [PATIENT.patientId, PATIENT.email]));
}

async function login(page, credentials, urlPattern) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(urlPattern);
}

async function shoot(page, dir, name, width, { full = true, idle = true } = {}) {
  if (idle) await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

const viewportsPortal = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  ...(extra ? [{ name: "mobile", width: 375, height: 812 }, { name: "mobile", width: 430, height: 932 }] : []),
];
const viewportsDashboard = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  ...(extra ? [{ name: "tablet", width: 1024, height: 768 }] : []),
];

const tokens = await prepare();
const browser = await chromium.launch();

// 1. Nutricionista processa a fila (gera as notificações do seed + cenários).
const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const page = await nutriContext.newPage();
  await login(page, NUTRITIONIST, /\/dashboard$/);
  await page.goto(`${BASE_URL}/dashboard/notificacoes`);
  await page.getByTestId("run-cycle").click();
  await page.getByText("Fila processada.").waitFor();
  await page.close();
}
await restorePatientEmail();

// 2. Dashboard.
for (const viewport of viewportsDashboard) {
  const dir = path.join(OUT, viewport.name);
  await mkdirAsync(dir, { recursive: true });
  const page = await nutriContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Dashboard ${viewport.name} (${w})...`);
  await page.goto(`${BASE_URL}/dashboard/notificacoes`);
  await page.getByRole("heading", { name: "Notificações" }).waitFor();
  await shoot(page, dir, "historico-entregas", w);
  await page.goto(`${BASE_URL}/dashboard/notificacoes?status=FAILED&channel=ALL&eventType=ALL`);
  await page.getByRole("heading", { name: "Notificações" }).waitFor();
  await shoot(page, dir, "entregas-falhas", w);
  await page.goto(`${BASE_URL}/dashboard/configuracoes/notificacoes`);
  await page.getByText("Provedores", { exact: true }).waitFor();
  await shoot(page, dir, "configuracoes-notificacoes", w);
  await page.goto(`${BASE_URL}/dashboard/configuracoes`);
  await page.getByRole("heading", { name: "Configurações" }).waitFor();
  await shoot(page, dir, "configuracoes-hub", w, { full: false });
  await page.goto(`${BASE_URL}/dashboard/agenda/${SEED_APPOINTMENT}`);
  // Sob carga o `next start` local às vezes demora a responder esta rota; um reload resolve (não é estado da app).
  try {
    await page.getByTestId("request-confirmation").first().waitFor({ timeout: 15_000 });
  } catch {
    await page.reload();
    await page.getByTestId("request-confirmation").first().waitFor();
  }
  await shoot(page, dir, "consulta-pedir-confirmacao", w, { full: false });
  await page.close();
}
// Reprocessamento (só 1440): FAILED → clique → toast.
{
  const dir = path.join(OUT, "desktop");
  const page = await nutriContext.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dashboard/notificacoes?status=FAILED&channel=EMAIL&eventType=ALL`);
  const retry = page.getByTestId("retry-delivery").first();
  await retry.waitFor();
  await retry.click();
  await page.getByText(/Entrega re(processada|enviada)/).waitFor();
  await shoot(page, dir, "entrega-reprocessada-toast", 1440, { full: false, idle: false });
  await page.close();
}
await nutriContext.close();

// 3. Portal do paciente (Fulana).
const patientContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const page = await patientContext.newPage();
  await login(page, PATIENT, /\/paciente$/);
  await page.close();
}
for (const viewport of viewportsPortal) {
  const dir = path.join(OUT, viewport.name);
  await mkdirAsync(dir, { recursive: true });
  const page = await patientContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Portal ${viewport.name} (${w})...`);
  await page.goto(`${BASE_URL}/paciente`);
  await page.getByTestId("notifications-unread-count").waitFor();
  await shoot(page, dir, "portal-sino-contador", w, { full: false });
  await page.goto(`${BASE_URL}/paciente/notificacoes`);
  await page.getByRole("heading", { name: "Notificações" }).waitFor();
  await shoot(page, dir, "notificacoes", w);
  await page.goto(`${BASE_URL}/paciente/consultas`);
  await page.getByRole("button", { name: "Confirmar presença" }).first().waitFor();
  await shoot(page, dir, "consultas-confirmar-presenca", w);
  await page.close();
}
// Lida/não lida (390): marca a primeira como lida e captura o estado misto.
{
  const dir = path.join(OUT, "mobile");
  const page = await patientContext.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/paciente/notificacoes`);
  await page.getByRole("button", { name: "Marcar como lida" }).first().click();
  await page.locator('[data-testid="notification-item"][data-unread="false"]').first().waitFor();
  await shoot(page, dir, "notificacoes-lida-nao-lida", 390);
  await page.close();
}
await patientContext.close();

// 4. Empty state (Beltrano sem notificações).
{
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await login(page, EMPTY_PATIENT, /\/paciente$/);
  await withDb((client) => client.query(`delete from public.notifications where recipient_id = $1`, [EMPTY_PATIENT.profileId]));
  for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 900 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE_URL}/paciente/notificacoes`);
    await page.getByText("Nenhuma notificação por enquanto.").first().waitFor();
    await shoot(page, path.join(OUT, viewport.name), "notificacoes-vazio", viewport.width, { full: false, idle: false });
  }
  await context.close();
}

// 5. Página pública de confirmação por link (sem sessão).
{
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 900 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const dir = path.join(OUT, viewport.name);
    await page.goto(`${BASE_URL}/confirmar/${tokens.raw}`);
    await page.getByText("Toque no botão abaixo para confirmar").waitFor();
    await shoot(page, dir, "confirmar-link", viewport.width, { full: false, idle: false });
    await page.goto(`${BASE_URL}/confirmar/${tokens.expiredRaw}?s=expired`);
    await page.getByText("Este link expirou", { exact: true }).waitFor();
    await shoot(page, dir, "confirmar-link-expirado", viewport.width, { full: false, idle: false });
  }
  // Confirma de verdade (1440) e captura o resultado.
  await page.goto(`${BASE_URL}/confirmar/${tokens.raw}`);
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await page.getByText("Presença confirmada", { exact: true }).waitFor();
  await shoot(page, path.join(OUT, "desktop"), "confirmar-link-confirmado", 1440, { full: false, idle: false });
  await context.close();
}

await browser.close();
console.log(`Screenshots em ${OUT}`);
