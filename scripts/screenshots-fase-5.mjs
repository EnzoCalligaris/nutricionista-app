// QA visual da Fase 5 (CLAUDE.md — regra permanente de screenshots): captura
// as telas REAIS do módulo de pacientes/contratos, na aplicação rodando
// (`npm run dev` ou `npm run start` em http://localhost:3000, com o
// Supabase local e o seed da Fase 2), em 1440/768/390 px (+ larguras extras
// opcionais). Saída em ./screenshots/fase-5/{desktop,tablet,mobile}/ —
// pasta ignorada pelo git, uso exclusivo de revisão local.
//
// Uso: node scripts/screenshots-fase-5.mjs [--extra]
//   --extra  também captura 375, 430, 1024 e 1280 px para a listagem e o perfil.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT_ID = "90000000-0000-0000-0000-000000000010"; // Fulana de Tal (seed)
const OUT = path.resolve("screenshots", "fase-5");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const EXTRA_VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile", width: 430, height: 932 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 800 },
];

const extra = process.argv.includes("--extra");

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(NUTRITIONIST.email);
  await page.getByLabel("Senha").fill(NUTRITIONIST.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function shoot(page, dir, name, width, { full = true } = {}) {
  await page.waitForLoadState("networkidle");
  // Fontes web + animações de entrada (fade) — espera curta e determinística.
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) {
    await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
  }
}

async function captureViewport(context, viewport) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  // 1. Listagem
  await page.goto(`${BASE_URL}/dashboard/pacientes`);
  await page.getByRole("heading", { name: "Pacientes" }).waitFor();
  await shoot(page, dir, "pacientes", w);

  // 1b. Listagem com busca + filtro
  await page.goto(`${BASE_URL}/dashboard/pacientes?status=inactive`);
  await page.getByRole("heading", { name: "Pacientes" }).waitFor();
  await shoot(page, dir, "pacientes-inativos", w, { full: false });

  // 1c. Empty state de busca
  await page.goto(`${BASE_URL}/dashboard/pacientes?q=zzzz-nao-existe`);
  await page.getByText("Nenhum paciente encontrado.").waitFor();
  await shoot(page, dir, "pacientes-busca-vazia", w, { full: false });

  // 2. Perfil — visão geral
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-perfil", w);

  // 3. Perfil — contratos (histórico + parcelas)
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}?tab=contratos`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-contratos", w);

  // 3b. Perfil — financeiro (pagamentos existentes) e seção placeholder
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}?tab=financeiro`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-financeiro", w, { full: false });

  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}?tab=consultas`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-consultas-placeholder", w, { full: false });

  // 4. Formulário novo paciente
  await page.goto(`${BASE_URL}/dashboard/pacientes/novo`);
  await page.getByRole("heading", { name: "Novo paciente" }).waitFor();
  await shoot(page, dir, "novo-paciente", w);

  // 4b. Formulário novo paciente com erro de validação
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await page.getByRole("alert").waitFor();
  await shoot(page, dir, "novo-paciente-erro", w, { full: false });

  // 5. Formulário editar paciente
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}/editar`);
  await page.getByRole("heading", { name: "Editar paciente" }).waitFor();
  await shoot(page, dir, "editar-paciente", w, { full: false });

  // 6. Formulário novo contrato (com condição escolhida => parcelas)
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}/contratos/novo`);
  await page.getByRole("heading", { name: "Novo contrato" }).waitFor();
  const planSelect = page.getByLabel("Plano", { exact: true });
  const trimestralValue = await planSelect.locator("option", { hasText: "Plano Trimestral" }).getAttribute("value");
  await planSelect.selectOption(trimestralValue);
  const priceSelect = page.getByLabel("Condição de preço");
  const parceladoValue = await priceSelect.locator("option", { hasText: "Parcelado 3x" }).getAttribute("value");
  await priceSelect.selectOption(parceladoValue);
  await shoot(page, dir, "novo-contrato", w);

  // 7. Confirmação de desativação (perfil)
  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}`);
  await page.getByRole("button", { name: "Desativar" }).click();
  await page.getByRole("alertdialog").waitFor();
  await shoot(page, dir, "confirmar-desativacao", w, { full: false });
  await page.keyboard.press("Escape");

  // 8. Menu de ações na listagem + confirmação de cancelamento de contrato
  await page.goto(`${BASE_URL}/dashboard/pacientes`);
  await page.getByRole("button", { name: /Ações de Fulana de Tal/ }).first().click();
  await page.getByRole("menu").waitFor();
  await shoot(page, dir, "pacientes-menu-acoes", w, { full: false });
  await page.keyboard.press("Escape");

  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}?tab=contratos`);
  await page.getByRole("button", { name: /Ações do contrato/ }).first().click();
  await page.getByRole("menuitem", { name: "Cancelar contrato" }).click();
  await page.getByRole("alertdialog").waitFor();
  await shoot(page, dir, "confirmar-cancelamento-contrato", w, { full: false });
  await page.keyboard.press("Escape");

  await page.close();
}

async function captureExtra(context, viewport) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/pacientes`);
  await page.getByRole("heading", { name: "Pacientes" }).waitFor();
  await shoot(page, dir, "pacientes", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-perfil", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT_ID}?tab=contratos`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shoot(page, dir, "paciente-contratos", w, { full: false });

  await page.close();
}

const browser = await chromium.launch();
const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const loginPage = await context.newPage();
await login(loginPage);
await loginPage.close();

for (const viewport of VIEWPORTS) {
  console.log(`Capturando ${viewport.name} (${viewport.width}px)...`);
  await captureViewport(context, viewport);
}

if (extra) {
  for (const viewport of EXTRA_VIEWPORTS) {
    console.log(`Capturando extra ${viewport.name} (${viewport.width}px)...`);
    await captureExtra(context, viewport);
  }
}

await browser.close();
console.log(`Screenshots em ${OUT}`);
