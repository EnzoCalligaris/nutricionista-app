// QA visual da Fase 11 (CLAUDE.md — regra permanente): captura as telas REAIS
// do fluxo de foto da refeição + análise por IA (portal, mobile-first) e da
// visão do nutricionista, na aplicação rodando em http://localhost:3000 com
// o Supabase local + seed e o provider FAKE.
// Saída: ./screenshots/fase-11/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-11.mjs [--extra]
//   --extra  também captura 375/430 (portal) e 1024 (dashboard).
//
// Prepara dados só no banco local com imagens SINTÉTICAS geradas aqui (nunca
// foto real): consentimento da Fulana, uma refeição confirmada com correções
// e uma em revisão — `npm run db:reset` restaura.

import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const OUT = path.resolve("screenshots", "fase-11");
const extra = process.argv.includes("--extra");

/** Imagem sintética de "prato" (fundo + círculo) — o fake escolhe o cardápio pelos bytes. */
async function fixture(name, seed) {
  const dir = path.join(os.tmpdir(), "em-qa-f11");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#e9dccb"/><circle cx="400" cy="300" r="230" fill="#f7f3ea" stroke="#c9b9a2" stroke-width="10"/><circle cx="330" cy="280" r="90" fill="#d9a46b"/><circle cx="470" cy="320" r="80" fill="#8c5a3c"/><ellipse cx="400" cy="400" rx="120" ry="45" fill="#6f9a5a"/><text x="20" y="580" font-size="14" fill="#a89f93">fixture ${seed}</text></svg>`;
  await writeFile(file, await sharp(Buffer.from(svg)).png().toBuffer());
  return file;
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

let confirmedUrl = null;
let reviewUrl = null;
let confirmedId = null;

/** Prepara os dados capturando, no caminho, as telas do fluxo em 390 (mobile-first). */
async function prepareAndShootFlow(context) {
  const dir = path.join(OUT, "mobile");
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  const w = 390;

  // Consentimento (se ainda não aceito).
  await page.goto(`${BASE_URL}/paciente/refeicoes/consentimento?next=nova`);
  await page.getByRole("heading", { name: "Consentimento" }).waitFor();
  await shoot(page, dir, "consentimento", w);
  const accept = page.getByRole("button", { name: "Aceitar e continuar" });
  if ((await accept.count()) > 0) {
    await page.getByLabel(/Li e aceito/).check();
    await accept.click();
    await page.waitForURL(/\/refeicoes\/nova$/);
  } else {
    await page.goto(`${BASE_URL}/paciente/refeicoes/nova`);
  }

  // Nova refeição → preview → analisar → revisar → confirmar.
  await page.getByRole("heading", { name: "Nova refeição" }).waitFor();
  await shoot(page, dir, "nova-refeicao", w);
  await page.locator('input[name="photo"]').last().setInputFiles(await fixture("prato-qa-1.png", 1));
  await page.getByRole("img", { name: "Prévia da foto da refeição selecionada" }).waitFor();
  await shoot(page, dir, "preview", w);
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await page.waitForURL(/\/paciente\/refeicoes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  confirmedUrl = page.url();
  confirmedId = confirmedUrl.split("/").pop();
  await page.getByRole("button", { name: "Analisar refeição" }).waitFor();
  await shoot(page, dir, "foto-enviada", w);
  await page.getByRole("button", { name: "Analisar refeição" }).click();
  await page.getByRole("heading", { name: "Revise sua refeição" }).waitFor({ timeout: 60_000 });
  await shoot(page, dir, "revisao-ia", w);
  const rows = page.getByRole("list", { name: "Alimentos da refeição" }).getByRole("listitem");
  await rows.nth(0).getByLabel("Quantidade").fill("100");
  await shoot(page, dir, "edicao-item", w, { full: false });
  await page.getByRole("button", { name: "+ Óleo / azeite" }).click();
  const added = rows.last();
  await added.getByLabel("kcal (est.)").fill("120");
  await added.getByLabel("Proteína g").fill("0");
  await added.getByLabel("Carbo g").fill("0");
  await added.getByLabel("Gordura g").fill("13,5");
  await added.scrollIntoViewIfNeeded();
  await shoot(page, dir, "item-adicionado", w, { full: false });
  await page.getByRole("button", { name: "Confirmar refeição" }).click();
  await page.getByText("Refeição confirmada.").waitFor({ timeout: 30_000 });
  await page.getByRole("heading", { name: "Refeição confirmada" }).waitFor();
  await shoot(page, dir, "confirmacao", w);
  await page.getByText("O que a IA estimou inicialmente").click();
  await page.getByRole("list", { name: "Alimentos estimados pela IA" }).waitFor();
  await shoot(page, dir, "detalhe-confirmado-original", w);

  // Segunda refeição: só analisada (revisão pendente) + estado "analisando" com o cenário de timeout do fake (2×1 px).
  await page.goto(`${BASE_URL}/paciente/refeicoes/nova`);
  await page.locator('input[name="photo"]').last().setInputFiles(await fixture("prato-qa-2.png", 2));
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await page.waitForURL(/\/paciente\/refeicoes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  reviewUrl = page.url();
  await page.getByRole("button", { name: "Analisar refeição" }).click();
  await page.getByRole("heading", { name: "Revise sua refeição" }).waitFor({ timeout: 60_000 });

  await page.goto(`${BASE_URL}/paciente/refeicoes/nova`);
  const timeoutFixture = path.join(os.tmpdir(), "em-qa-f11", "timeout-qa.png");
  await writeFile(timeoutFixture, await sharp({ create: { width: 2, height: 1, channels: 3, background: { r: 20, g: 20, b: 20 } } }).png().toBuffer());
  await page.locator('input[name="photo"]').last().setInputFiles(timeoutFixture);
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await page.waitForURL(/\/paciente\/refeicoes\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const timeoutUrl = page.url();
  await page.getByRole("button", { name: "Analisar refeição" }).click();
  await page.getByText("Analisando sua refeição...").waitFor();
  // A Server Action fica pendente até o timeout do provider: não esperar networkidle.
  await shoot(page, dir, "analisando", w, { full: false, idle: false });
  // Aguarda o timeout do provider (FOOD_ANALYSIS_TIMEOUT_MS, 45 s por padrão) e captura o estado de falha + retry.
  await page.getByRole("button", { name: "Tentar novamente" }).waitFor({ timeout: 120_000 });
  await shoot(page, dir, "falha-tentar-novamente", w, { full: false });
  await page.goto(timeoutUrl);
  await page.getByRole("button", { name: "Arquivar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Arquivar" }).click();
  await page.waitForURL(/\/paciente\/refeicoes$/);

  await page.goto(`${BASE_URL}/paciente/refeicoes`);
  await page.getByRole("list", { name: "Refeições registradas" }).waitFor();
  await shoot(page, dir, "lista-refeicoes", w);
  await page.goto(`${BASE_URL}/paciente`);
  await page.getByRole("heading", { name: "Início" }).waitFor();
  await shoot(page, dir, "portal-inicio", w, { full: false });
  await page.close();
}

async function portal(context, viewport) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  await page.goto(`${BASE_URL}/paciente/refeicoes`);
  await page.getByRole("heading", { name: "Refeições" }).waitFor();
  await shoot(page, dir, "lista-refeicoes", w);
  await page.goto(confirmedUrl);
  await page.getByRole("heading", { name: "Refeição confirmada" }).waitFor();
  await shoot(page, dir, "detalhe-confirmado", w);
  await page.goto(reviewUrl);
  await page.getByRole("heading", { name: "Revise sua refeição" }).waitFor();
  await shoot(page, dir, "revisao-ia", w);
  await page.goto(`${BASE_URL}/paciente/refeicoes/nova`);
  await page.getByRole("heading", { name: "Nova refeição" }).waitFor();
  await shoot(page, dir, "nova-refeicao", w, { full: false });
  await page.goto(`${BASE_URL}/paciente/refeicoes/consentimento`);
  await page.getByRole("heading", { name: "Consentimento" }).waitFor();
  await shoot(page, dir, "consentimento", w, { full: false });
  await page.close();
}

async function portalEmpty(browser, viewport) {
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" }, /\/paciente$/);
  await page.goto(`${BASE_URL}/paciente/refeicoes`);
  await page.getByText("Você ainda não registrou nenhuma refeição.").waitFor();
  await shoot(page, path.join(OUT, viewport.name), "lista-refeicoes-vazia", viewport.width, { full: false });
  await context.close();
}

async function dashboard(context, viewport) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=refeicoes`);
  await page.getByRole("heading", { name: "Refeições" }).waitFor();
  await shoot(page, dir, "aba-refeicoes", w);
  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}/refeicoes/${confirmedId}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "refeicao-detalhe", w);
  await page.getByText("O que a IA estimou inicialmente").click();
  await page.getByRole("list", { name: "Alimentos estimados pela IA" }).waitFor();
  await page.getByRole("list", { name: "Diferenças entre a IA e a versão confirmada" }).scrollIntoViewIfNeeded();
  await shoot(page, dir, "refeicao-ia-x-paciente", w);
  await page.close();
}

const browser = await chromium.launch();

const patientContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const p = await patientContext.newPage();
  await login(p, PATIENT, /\/paciente$/);
  await p.close();
}
console.log("Fluxo do paciente em 390 (preparando dados)...");
await prepareAndShootFlow(patientContext);
for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  ...(extra ? [{ name: "mobile", width: 375, height: 812 }, { name: "mobile", width: 430, height: 932 }] : []),
]) {
  console.log(`Portal ${viewport.name} (${viewport.width})...`);
  await portal(patientContext, viewport);
}
await patientContext.close();

console.log("Portal vazio (Beltrano) 390...");
await portalEmpty(browser, { name: "mobile", width: 390, height: 844 });

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
  ...(extra ? [{ name: "tablet", width: 1024, height: 768 }] : []),
]) {
  console.log(`Dashboard ${viewport.name} (${viewport.width})...`);
  await dashboard(nutriContext, viewport);
}
await nutriContext.close();

await browser.close();
console.log(`Screenshots em ${OUT}`);
