// QA visual da Fase 10 (CLAUDE.md — regra permanente): captura as telas REAIS
// de suplementos/feedbacks/materiais (dashboard + portal) na aplicação
// rodando em http://localhost:3000 com o Supabase local + seed.
// Saída: ./screenshots/fase-10/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-10.mjs [--extra]
//   --extra  também captura 1024/1280 (dashboard) e 375/430 (portal).
//
// Prepara dados de exemplo só no banco local: um material em PDF (fictício,
// gerado aqui) atribuído à Fulana — `npm run db:reset` restaura.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const SEED_FEEDBACK = "90000000-0000-0000-0000-000000000811";
const QA_MATERIAL_TITLE = "QA Fase 10 — Guia de lanches (PDF fictício)";
const OUT = path.resolve("screenshots", "fase-10");
const extra = process.argv.includes("--extra");

/** PDF mínimo válido (só para o QA — nunca um material real). */
async function fakePdf() {
  const file = path.join(os.tmpdir(), "guia-lanches-qa.pdf");
  const body = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
  await writeFile(file, body);
  return file;
}

async function login(page, credentials, urlPattern) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(urlPattern);
}

async function shoot(page, dir, name, width, { full = true } = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

let materialUrl = null;

async function ensureData(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Material em PDF atribuído à Fulana — se ainda não existe.
  await page.goto(`${BASE_URL}/dashboard/materiais`);
  await page.getByRole("heading", { name: "Materiais" }).waitFor();
  const existing = page.getByRole("row").filter({ hasText: QA_MATERIAL_TITLE });
  if ((await existing.count()) === 0) {
    await page.goto(`${BASE_URL}/dashboard/materiais/novo`);
    await page.getByLabel("Título").fill(QA_MATERIAL_TITLE);
    await page.getByLabel("Descrição (opcional)").fill("Sugestões de lanches práticos para a rotina (conteúdo fictício de QA).");
    await page.getByLabel(/^Arquivo \(PDF/).setInputFiles(await fakePdf());
    await page.getByRole("button", { name: "Criar material" }).click();
    await page.waitForURL(/\/dashboard\/materiais\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await page.getByRole("heading", { level: 1, name: QA_MATERIAL_TITLE }).waitFor();
    await page.getByRole("combobox").fill("Fulana");
    await page.getByRole("option").filter({ hasText: "Fulana de Tal" }).getByRole("button").click();
    await page.getByRole("button", { name: "Atribuir material" }).click();
    await page.getByText("Material atribuído a Fulana de Tal.").waitFor();
  } else {
    await existing.getByRole("link", { name: "Abrir" }).click();
    await page.waitForURL(/\/dashboard\/materiais\/[0-9a-f-]{36}/);
  }
  materialUrl = page.url().split("?")[0];
  await page.close();
}

async function dashboard(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=suplementos`);
  await page.getByRole("heading", { name: "Suplementos" }).waitFor();
  await shoot(page, dir, "aba-suplementos", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=feedbacks`);
  await page.getByRole("heading", { name: "Feedbacks" }).waitFor();
  await shoot(page, dir, "aba-feedbacks", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=materiais`);
  await page.getByRole("heading", { name: "Materiais" }).waitFor();
  await shoot(page, dir, "aba-materiais", w);

  await page.goto(`${BASE_URL}/dashboard/materiais`);
  await page.getByRole("heading", { name: "Materiais" }).waitFor();
  await shoot(page, dir, "biblioteca-materiais", w);

  await page.goto(materialUrl);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "material-detalhe-atribuicao", w);

  if (core) {
    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/suplementos/novo`);
    await page.getByRole("heading", { name: "Nova recomendação de suplemento" }).waitFor();
    await shoot(page, dir, "novo-suplemento", w);
    await page.getByLabel("Nome do suplemento").fill("Ômega 3");
    await page.getByLabel("Dose / quantidade (opcional)").fill("2 cápsulas");
    await page.getByLabel("Frequência / momento (opcional)").fill("1x ao dia, no almoço");
    await page.getByLabel("Orientação", { exact: true }).fill("Tomar junto com a refeição principal.");
    await page.getByLabel("Link de compra (opcional)").fill("https://example.com/omega-3-ficticio");
    await shoot(page, dir, "novo-suplemento-preenchido", w);

    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/feedbacks/novo`);
    await page.getByRole("heading", { name: "Novo feedback" }).waitFor();
    await page.getByLabel("Título (opcional)").fill("Retorno da semana 3");
    await page.getByLabel("Mensagem").fill("Você manteve a constância nas refeições principais e a hidratação melhorou bastante. Na próxima consulta vamos ajustar os lanches da tarde (texto fictício de QA).");
    await shoot(page, dir, "novo-feedback", w);

    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/feedbacks/${SEED_FEEDBACK}/editar`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shoot(page, dir, "feedback-editar", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/materiais/novo`);
    await page.getByRole("heading", { name: "Novo material" }).waitFor();
    await shoot(page, dir, "novo-material", w);
    await page.getByRole("radio", { name: /Link externo/ }).check();
    await page.getByLabel("Título").fill("Lista de compras da semana");
    await page.getByLabel("Link externo", { exact: true }).fill("https://example.com/lista-ficticia");
    await shoot(page, dir, "novo-material-link", w, { full: false });
  }
  await page.close();
}

async function portal(context, viewport) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/paciente`);
  await page.getByRole("heading", { name: "Início" }).waitFor();
  await shoot(page, dir, "portal-inicio", w);

  await page.goto(`${BASE_URL}/paciente/suplementos`);
  await page.getByRole("heading", { name: "Suplementos" }).waitFor();
  await shoot(page, dir, "portal-suplementos", w);

  await page.goto(`${BASE_URL}/paciente/feedbacks`);
  await page.getByRole("heading", { name: "Feedbacks" }).waitFor();
  await shoot(page, dir, "portal-feedbacks", w);

  await page.goto(`${BASE_URL}/paciente/materiais`);
  await page.getByRole("heading", { name: "Materiais" }).waitFor();
  await shoot(page, dir, "portal-materiais", w);
  await page.close();
}

async function portalEmpty(browser, viewport) {
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" }, /\/paciente$/);
  const dir = path.join(OUT, viewport.name);
  await page.goto(`${BASE_URL}/paciente/suplementos`);
  await page.getByText("Você não possui recomendações de suplementos no momento.").waitFor();
  await shoot(page, dir, "portal-suplementos-vazio", viewport.width, { full: false });
  await page.goto(`${BASE_URL}/paciente/feedbacks`);
  await page.getByText("Nenhum feedback disponível ainda.").waitFor();
  await shoot(page, dir, "portal-feedbacks-vazio", viewport.width, { full: false });
  await page.goto(`${BASE_URL}/paciente/materiais`);
  await page.getByText("Você ainda não possui materiais disponíveis.").waitFor();
  await shoot(page, dir, "portal-materiais-vazio", viewport.width, { full: false });
  await context.close();
}

const browser = await chromium.launch();

const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const p = await nutriContext.newPage();
  await login(p, NUTRITIONIST, /\/dashboard$/);
  await p.close();
}
console.log("Preparando dados de exemplo...");
await ensureData(nutriContext);
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
  { name: "desktop", width: 1440, height: 900 },
]) {
  console.log(`Portal ${viewport.name} (${viewport.width})...`);
  await portal(patientContext, viewport);
}
if (extra) {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "mobile", width: 430, height: 932 },
  ]) {
    console.log(`Portal extra ${viewport.name} (${viewport.width})...`);
    await portal(patientContext, viewport);
  }
}
await patientContext.close();

console.log("Portal vazio (Beltrano) 390...");
await portalEmpty(browser, { name: "mobile", width: 390, height: 844 });

await browser.close();
console.log(`Screenshots em ${OUT}`);
