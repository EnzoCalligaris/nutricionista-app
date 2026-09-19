// QA visual da Fase 9 (CLAUDE.md — regra permanente): captura as telas REAIS
// de avaliações/evolução (dashboard + portal) na aplicação rodando em
// http://localhost:3000 com o Supabase local + seed.
// Saída: ./screenshots/fase-9/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-9.mjs [--extra]
//   --extra  também captura 1024/1280 (dashboard) e 375/430 (portal).
//
// Prepara dados de exemplo só no banco local: uma terceira avaliação da
// Fulana (visível, com relatório PDF fictício gerado aqui) e libera a
// reavaliação do seed — `npm run db:reset` restaura.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const SEED_ASSESSMENT_2 = "90000000-0000-0000-0000-000000000602";
const OUT = path.resolve("screenshots", "fase-9");
const extra = process.argv.includes("--extra");

function spDate(daysAgo) {
  const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = sp.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysAgo)).toISOString().slice(0, 10);
}

/** PDF mínimo válido (só para o QA — nunca um relatório real). */
async function fakePdf() {
  const file = path.join(os.tmpdir(), "relatorio-bioimpedancia-qa.pdf");
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

let newAssessmentUrl = null;

async function ensureData(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Libera a reavaliação do seed para o paciente (se ainda não estiver).
  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/avaliacoes/${SEED_ASSESSMENT_2}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  const release = page.getByRole("button", { name: "Liberar para o paciente" });
  if ((await release.count()) > 0) {
    await release.click();
    await page.getByText("Avaliação liberada para o paciente.").waitFor();
  }

  // Terceira avaliação (visível) com composição e medidas — se ainda não existe.
  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=avaliacoes`);
  await page.getByRole("heading", { name: "Histórico" }).waitFor();
  const existing = page.getByRole("row").filter({ hasText: spDate(1).split("-").reverse().join("/") });
  if ((await existing.count()) === 0) {
    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/avaliacoes/nova`);
    await page.getByLabel("Data da avaliação").fill(spDate(1));
    await page.getByLabel(/^Peso/).fill("75,8");
    await page.getByLabel(/^Altura/).fill("165");
    await page.getByRole("button", { name: /Composição corporal/ }).click();
    await page.getByLabel(/^Percentual de gordura/).fill("26,4");
    await page.getByLabel(/^Massa muscular/).fill("24,9");
    await page.getByLabel(/^Água corporal/).fill("54");
    await page.getByRole("button", { name: /Medidas corporais/ }).click();
    await page.getByLabel(/^Cintura/).fill("87,5");
    await page.getByLabel(/^Quadril/).fill("101");
    await page.getByLabel("Observação para o paciente (opcional)").fill("Avaliação de acompanhamento (dado fictício de QA).");
    await page.getByLabel("Nota interna (nunca visível ao paciente)").fill("Nota interna de QA — não aparece no portal.");
    await page.getByLabel("Visível para o paciente").check();
    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await page.waitForURL(/\/avaliacoes\/[0-9a-f-]{36}/);
    await page.getByText("Avaliação registrada.").waitFor();
  } else {
    await existing.getByRole("link", { name: "Abrir" }).click();
    await page.waitForURL(/\/avaliacoes\/[0-9a-f-]{36}/);
  }
  newAssessmentUrl = page.url().split("?")[0];

  // `count()` não espera a página renderizar: aguarda a seção antes de decidir.
  await page.getByRole("heading", { name: "Relatório de bioimpedância" }).waitFor();
  if ((await page.getByText("Nenhum relatório anexado.").count()) > 0) {
    await page.getByLabel(/Anexar relatório/).setInputFiles(await fakePdf());
    await page.getByRole("button", { name: "Enviar" }).click();
    await page.getByText("Relatório anexado.", { exact: true }).waitFor();
  }
  await page.close();
}

async function dashboard(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=avaliacoes`);
  await page.getByRole("heading", { name: "Histórico" }).waitFor();
  await shoot(page, dir, "aba-avaliacoes", w);

  await page.goto(newAssessmentUrl);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "avaliacao-detalhe-relatorio", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/avaliacoes/comparar`);
  await page.getByRole("heading", { name: "Comparar avaliações" }).waitFor();
  await shoot(page, dir, "comparacao", w);

  if (core) {
    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/avaliacoes/nova`);
    await page.getByRole("heading", { name: "Nova avaliação" }).waitFor();
    await shoot(page, dir, "nova-avaliacao", w);
    await page.getByLabel(/^Peso/).fill("75,2");
    await page.getByLabel(/^Altura/).fill("165");
    await page.getByRole("button", { name: /Composição corporal/ }).click();
    await page.getByLabel(/^Percentual de gordura/).fill("26");
    await page.getByRole("button", { name: /Medidas corporais/ }).click();
    await page.getByLabel(/^Cintura/).fill("87");
    await shoot(page, dir, "nova-avaliacao-preenchida", w);

    await page.goto(`${newAssessmentUrl}/editar`);
    await page.getByRole("heading", { name: "Editar avaliação" }).waitFor();
    await shoot(page, dir, "editar-avaliacao", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/avaliacoes`);
    await page.getByRole("heading", { name: "Avaliações" }).waitFor();
    await shoot(page, dir, "avaliacoes-visao-geral", w, { full: false });
  }
  await page.close();
}

async function portal(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/paciente`);
  await page.getByRole("heading", { name: "Início" }).waitFor();
  await shoot(page, dir, "portal-inicio-evolucao", w, { full: false });

  await page.goto(`${BASE_URL}/paciente/evolucao`);
  await page.getByRole("heading", { name: "Minha Evolução" }).waitFor();
  await shoot(page, dir, "portal-evolucao", w);

  await page.getByRole("link", { name: "Ver detalhes" }).first().click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "portal-avaliacao-detalhe", w);

  if (core) {
    await page.goto(`${BASE_URL}/paciente/evolucao`);
    await page.getByRole("heading", { name: "Gráficos" }).scrollIntoViewIfNeeded();
    await shoot(page, dir, "portal-graficos", w, { full: false });
  }
  await page.close();
}

async function portalEmpty(browser, viewport) {
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" }, /\/paciente$/);
  await page.goto(`${BASE_URL}/paciente/evolucao`);
  await page.getByText("Nenhuma avaliação disponível ainda.").waitFor();
  await shoot(page, path.join(OUT, viewport.name), "portal-evolucao-vazia", viewport.width, { full: false });
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
  await portal(patientContext, viewport, { core: viewport.name === "mobile" });
}
if (extra) {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "mobile", width: 430, height: 932 },
  ]) {
    console.log(`Portal extra ${viewport.width}...`);
    await portal(patientContext, viewport, { core: false });
  }
}
await patientContext.close();

await portalEmpty(browser, { name: "mobile", width: 390, height: 844 });

await browser.close();
console.log(`Screenshots em ${OUT}`);
