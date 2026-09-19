// QA visual da Fase 6 (CLAUDE.md — regra permanente): captura as telas REAIS
// da agenda (dashboard) e do agendamento (portal do paciente) na aplicação
// rodando em http://localhost:3000 com o Supabase local + seed.
// Saída: ./screenshots/fase-6/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-6.mjs [--extra]
//   --extra  também captura 375/430 (portal) e 1024/1280 (dashboard).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const OUT = path.resolve("screenshots", "fase-6");
const extra = process.argv.includes("--extra");

// Semana das consultas do seed (+5 dias) para a agenda não ficar vazia.
function plusDays(days) {
  const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = sp.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
// Data (em São Paulo) da consulta futura do seed (Fulana, id ...402): o
// seed usa current_date do Postgres (UTC), então lemos a data real do banco.
async function seedAppointmentDate() {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres" });
  await client.connect();
  try {
    const result = await client.query("select to_char(starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as d from public.appointments where id = '90000000-0000-0000-0000-000000000402'");
    return result.rows[0]?.d ?? plusDays(5);
  } finally {
    await client.end();
  }
}
const WEEK_DATE = await seedAppointmentDate();
// Próxima segunda ≥ 8 dias: dentro da disponibilidade fictícia do seed.
function nextMonday() {
  const base = plusDays(8);
  const dt = new Date(`${base}T00:00:00Z`);
  const toMonday = (8 - dt.getUTCDay()) % 7;
  return new Date(dt.getTime() + toMonday * 86_400_000).toISOString().slice(0, 10);
}
const MONDAY = nextMonday();

async function login(page, credentials, urlPattern) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(urlPattern);
}

async function shoot(page, dir, name, width, { full = true } = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

async function dashboard(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/agenda?view=week&date=${WEEK_DATE}`);
  await page.getByRole("heading", { name: "Agenda" }).waitFor();
  await shoot(page, dir, "agenda-semana", w);

  await page.goto(`${BASE_URL}/dashboard/agenda?view=month&date=${WEEK_DATE}`);
  await page.getByRole("heading", { name: "Agenda" }).waitFor();
  await shoot(page, dir, "agenda-mes", w);

  await page.goto(`${BASE_URL}/dashboard/agenda?view=day&date=${WEEK_DATE}`);
  await page.getByRole("heading", { name: "Agenda" }).waitFor();
  await shoot(page, dir, "agenda-dia", w);

  if (core) {
    await page.goto(`${BASE_URL}/dashboard/agenda/configuracoes`);
    await page.getByRole("heading", { name: "Configurações da agenda" }).waitFor();
    await shoot(page, dir, "agenda-configuracoes", w);

    await page.goto(`${BASE_URL}/dashboard/agenda/bloqueios/novo?date=${MONDAY}`);
    await page.getByRole("heading", { name: "Novo bloqueio" }).waitFor();
    await shoot(page, dir, "novo-bloqueio", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/agenda/nova?date=${MONDAY}`);
    await page.getByRole("heading", { name: "Nova consulta" }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Buscar paciente pelo nome...").first().fill("Sicrana");
    await page.getByRole("option").filter({ hasText: "Sicrana Pereira" }).click();
    await page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio").first().waitFor();
    await page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio").nth(2).click();
    await shoot(page, dir, "nova-consulta", w);

    // Detalhe da consulta do seed (Fulana, +5d)
    await page.goto(`${BASE_URL}/dashboard/agenda/90000000-0000-0000-0000-000000000402`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shoot(page, dir, "detalhe-consulta", w);

    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("alertdialog").waitFor();
    await shoot(page, dir, "confirmar-cancelamento-consulta", w, { full: false });
    await page.keyboard.press("Escape");

    await page.goto(`${BASE_URL}/dashboard/agenda/90000000-0000-0000-0000-000000000402/reagendar`);
    await page.getByRole("heading", { name: "Reagendar consulta" }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Data").first().fill(MONDAY);
    await page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio").first().waitFor();
    await shoot(page, dir, "reagendar-consulta", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/agenda?view=week&date=${WEEK_DATE}&periodo=month#proximas-sessoes`);
    await page.getByRole("heading", { name: "Próximas sessões" }).scrollIntoViewIfNeeded();
    await shoot(page, dir, "proximas-sessoes", w, { full: false });
  }

  await page.close();
}

async function portal(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/paciente/consultas`);
  await page.getByRole("heading", { level: 1, name: "Consultas" }).waitFor();
  await shoot(page, dir, "portal-consultas", w);

  await page.goto(`${BASE_URL}/paciente/agendar?date=${MONDAY}`);
  await page.getByRole("heading", { name: "Agendar consulta" }).waitFor();
  await shoot(page, dir, "portal-agendar-data", w, { full: core });

  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
  await slots.first().waitFor();
  await shoot(page, dir, "portal-agendar-slots", w, { full: false });

  await slots.first().click();
  await page.getByRole("radio", { name: "Online" }).click();
  await page.getByRole("button", { name: "Confirmar agendamento" }).scrollIntoViewIfNeeded();
  await shoot(page, dir, "portal-agendar-confirmacao", w, { full: core });

  if (core) {
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await page.waitForURL(/\/paciente\/consultas/);
    await page.getByRole("heading", { level: 1, name: "Consultas" }).waitFor();
    await shoot(page, dir, "portal-consulta-agendada", w);

    const card = page.locator("[id^=consulta-]").filter({ hasText: "Reagendar" }).first();
    await card.getByRole("link", { name: "Reagendar" }).click();
    await page.getByRole("heading", { name: "Reagendar consulta" }).waitFor();
    await shoot(page, dir, "portal-reagendamento", w);

    await page.goto(`${BASE_URL}/paciente`);
    await page.getByRole("heading", { name: "Início" }).waitFor();
    await shoot(page, dir, "portal-inicio", w, { full: false });
  }

  await page.close();
}

const browser = await chromium.launch();

const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const p = await nutriContext.newPage();
  await login(p, NUTRITIONIST, /\/dashboard$/);
  await p.close();
}
for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  console.log(`Dashboard ${viewport.name} (${viewport.width})...`);
  await dashboard(nutriContext, viewport, { core: true });
}
if (extra) {
  for (const viewport of [
    { name: "tablet", width: 1024, height: 768 },
    { name: "desktop", width: 1280, height: 800 },
  ]) {
    console.log(`Dashboard extra ${viewport.name} (${viewport.width})...`);
    await dashboard(nutriContext, viewport, { core: false });
  }
}
await nutriContext.close();

const patientContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const p = await patientContext.newPage();
  await login(p, PATIENT, /\/paciente$/);
  await p.close();
}
for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
]) {
  console.log(`Portal ${viewport.name} (${viewport.width})...`);
  await portal(patientContext, viewport, { core: viewport.width === 390 });
}
if (extra) {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "mobile", width: 430, height: 932 },
  ]) {
    console.log(`Portal extra ${viewport.name} (${viewport.width})...`);
    await portal(patientContext, viewport, { core: false });
  }
}
await patientContext.close();
await browser.close();
console.log(`Screenshots em ${OUT}`);
