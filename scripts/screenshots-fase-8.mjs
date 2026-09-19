// QA visual da Fase 8 (CLAUDE.md — regra permanente): captura as telas REAIS
// do cardápio (dashboard + portal) na aplicação rodando em
// http://localhost:3000 com o Supabase local + seed.
// Saída: ./screenshots/fase-8/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-8.mjs [--extra]
//   --extra  também captura 1024/1280 (dashboard) e 375/430 (portal).
//
// Prepara dados de exemplo só no banco local: rascunho v2 do cardápio da
// Fulana com um dia novo, refeição, alimento e substituição (não publica) —
// `npm run db:reset` restaura.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const SICRANA_ID = "90000000-0000-0000-0000-000000000012";
const PUBLISHED_VERSION = "90000000-0000-0000-0000-000000000510";
const OUT = path.resolve("screenshots", "fase-8");
const extra = process.argv.includes("--extra");

async function login(page, credentials, urlPattern) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(urlPattern);
}

async function shoot(page, dir, name, width, { full = true } = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

let draftUrl = null;

/** Garante um rascunho v2 com conteúdo novo (terça) para o editor não ficar vazio. */
async function ensureDraft(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=cardapio`);
  await page.getByRole("heading", { name: "Histórico de versões" }).waitFor();
  const openDraft = page.getByRole("link", { name: /Abrir editor/ });
  if ((await openDraft.count()) === 0) {
    await page.getByRole("button", { name: "Criar nova versão" }).click();
    await page.waitForURL(/\/cardapio\/[0-9a-f-]{36}$/);
  } else {
    await openDraft.click();
    await page.waitForURL(/\/cardapio\/[0-9a-f-]{36}$/);
  }
  draftUrl = page.url();
  await page.waitForLoadState("networkidle");

  if ((await page.getByRole("tab", { name: "Terça-feira" }).count()) === 0) {
    await page.getByLabel("Adicionar dia").selectOption("2");
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByRole("tab", { name: "Terça-feira" }).waitFor();
    await page.getByRole("button", { name: "Adicionar a primeira refeição" }).click();
    await page.getByLabel("Nome da refeição").fill("Lanche da tarde");
    await page.getByLabel("Horário (opcional)").fill("16:00");
    await page.getByRole("button", { name: "Adicionar refeição" }).click();
    await page.getByRole("button", { name: "Adicionar alimento" }).waitFor();
    await page.getByRole("button", { name: "Adicionar alimento" }).click();
    await page.getByRole("textbox", { name: "Alimento", exact: true }).fill("Banana");
    await page.getByLabel("Quantidade").fill("1");
    await page.getByLabel("Unidade").selectOption("unidade");
    await page.getByRole("button", { name: "Adicionar alimento" }).last().click();
    await page.getByRole("button", { name: "Substituição" }).waitFor();
    await page.getByRole("button", { name: "Substituição" }).click();
    await page.getByLabel("Alimento substituto").fill("Maçã");
    await page.getByLabel("Quantidade").last().fill("1");
    await page.getByLabel("Unidade").last().selectOption("unidade");
    await page.getByRole("button", { name: "Adicionar substituição" }).click();
    await page.getByText("1 substituição(ões)").waitFor();
  }
  await page.close();
}

async function dashboard(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=cardapio`);
  await page.getByRole("heading", { name: "Histórico de versões" }).waitFor();
  await shoot(page, dir, "aba-cardapio", w);

  await page.goto(draftUrl);
  await page.getByRole("tab", { name: /Seg/ }).waitFor();
  await shoot(page, dir, "editor-plano", w);

  await page.getByRole("tab", { name: /Ter/ }).click();
  await page.getByRole("heading", { name: "Terça-feira" }).waitFor();
  await shoot(page, dir, "editor-dia-refeicoes", w);

  if (core) {
    await page.goto(`${BASE_URL}/dashboard/pacientes/${SICRANA_ID}/cardapio/novo`);
    await page.getByRole("heading", { name: "Novo plano alimentar" }).waitFor();
    await shoot(page, dir, "novo-plano", w);

    await page.goto(draftUrl);
    await page.getByRole("tab", { name: /Ter/ }).click();
    await page.getByRole("heading", { name: "Terça-feira" }).waitFor();
    await page.getByRole("button", { name: "Adicionar alimento" }).first().click();
    await page.getByRole("textbox", { name: "Alimento", exact: true }).fill("Iogurte natural");
    await shoot(page, dir, "editor-refeicao-expandida-form-alimento", w);
    await page.getByRole("button", { name: "Cancelar" }).first().click();

    await page.getByRole("button", { name: /^Substituição$/ }).first().click();
    await page.getByLabel("Alimento substituto").waitFor();
    await shoot(page, dir, "editor-substituicoes", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=cardapio`);
    await page.getByRole("heading", { name: "Histórico de versões" }).waitFor();
    await page.getByRole("button", { name: /Publicar versão/ }).click();
    await page.getByRole("alertdialog").waitFor();
    await shoot(page, dir, "dialog-publicar", w, { full: false });
    await page.keyboard.press("Escape");

    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/cardapio/${PUBLISHED_VERSION}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shoot(page, dir, "versao-publicada-leitura", w);

    await page.goto(`${BASE_URL}/dashboard/cardapios`);
    await page.getByRole("heading", { name: "Cardápios" }).waitFor();
    await shoot(page, dir, "cardapios-visao-geral", w);
  }
  await page.close();
}

async function portal(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/paciente/cardapio`);
  await page.getByRole("heading", { name: "Meu Cardápio" }).waitFor();
  await shoot(page, dir, "portal-cardapio", w);

  await page.getByRole("tab", { name: /Qua/ }).click();
  await page.getByRole("heading", { name: "Quarta-feira" }).waitFor();
  await shoot(page, dir, "portal-troca-dia", w);

  await page.getByRole("tab", { name: /Seg/ }).click();
  await page.getByRole("button", { name: /Ver substituições/ }).first().click();
  await page.getByText(/No lugar de/).waitFor();
  await shoot(page, dir, "portal-substituicoes-abertas", w);

  if (core) {
    await page.goto(`${BASE_URL}/paciente`);
    await page.getByRole("heading", { name: "Início" }).waitFor();
    await shoot(page, dir, "portal-inicio-cardapio-do-dia", w, { full: false });
  }
  await page.close();
}

async function portalEmpty(browser, viewport) {
  // Beltrano não tem plano: empty state.
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" }, /\/paciente$/);
  await page.goto(`${BASE_URL}/paciente/cardapio`);
  await page.getByText("Seu plano alimentar ainda não foi publicado.").waitFor();
  await shoot(page, path.join(OUT, viewport.name), "portal-sem-plano", viewport.width, { full: false });
  await context.close();
}

const browser = await chromium.launch();

const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const p = await nutriContext.newPage();
  await login(p, NUTRITIONIST, /\/dashboard$/);
  await p.close();
}
console.log("Preparando rascunho de exemplo...");
await ensureDraft(nutriContext);
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
