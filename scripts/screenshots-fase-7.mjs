// QA visual da Fase 7 (CLAUDE.md — regra permanente): captura as telas REAIS
// do financeiro na aplicação rodando em http://localhost:3000 com o Supabase
// local + seed. Saída: ./screenshots/fase-7/{desktop,tablet,mobile}/
// (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-7.mjs [--extra]
//   --extra  também captura 1024 (tablet paisagem) e 1280 (desktop).
//
// O fluxo cria um lançamento manual e registra um pagamento parcial na
// parcela 3 da Fulana (seed) para as telas não ficarem vazias — só no banco
// local de desenvolvimento (`npm run db:reset` restaura).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const FULANA_INSTALLMENT_3 = "90000000-0000-0000-0000-000000000313";
const OUT = path.resolve("screenshots", "fase-7");
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

async function ensureSampleData(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Lançamento manual de despesa (se ainda não existir).
  await page.goto(`${BASE_URL}/dashboard/financeiro?q=Aluguel%20da%20sala`);
  await page.getByRole("heading", { name: "Financeiro" }).waitFor();
  const hasExpense = (await page.getByText("Aluguel da sala (QA visual)").count()) > 0;
  if (!hasExpense) {
    await page.goto(`${BASE_URL}/dashboard/financeiro/novo`);
    await page.getByRole("heading", { name: "Novo lançamento" }).waitFor();
    await page.getByLabel("Tipo").selectOption("EXPENSE");
    await page.getByLabel("Descrição").fill("Aluguel da sala (QA visual)");
    await page.getByLabel("Valor (R$)").fill("1.200,00");
    await page.getByLabel("Método de pagamento").selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Criar lançamento" }).click();
    await page.waitForURL(/\/dashboard\/financeiro\?toast=transaction_created/);
  }

  // Pagamento parcial (R$ 100,00) na parcela 3 da Fulana, se ainda estiver pendente por inteiro.
  await page.goto(`${BASE_URL}/dashboard/financeiro/pagamentos/novo?paciente=${FULANA_ID}&parcela=${FULANA_INSTALLMENT_3}`);
  await page.getByRole("heading", { name: "Registrar pagamento" }).waitFor();
  const amount = await page.getByLabel("Valor (R$)").inputValue();
  if (amount === "226,79") {
    await page.getByLabel("Valor (R$)").fill("100,00");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await page.waitForURL(/toast=payment_recorded/);
  }
  await page.close();
}

async function dashboard(context, viewport, { core }) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;

  await page.goto(`${BASE_URL}/dashboard/financeiro?periodo=last_6_months`);
  await page.getByRole("heading", { name: "Financeiro" }).waitFor();
  await shoot(page, dir, "financeiro", w);

  await page.goto(`${BASE_URL}/dashboard`);
  await page.getByRole("heading", { name: "Visão Geral" }).waitFor();
  await shoot(page, dir, "dashboard-geral", w);

  await page.goto(`${BASE_URL}/dashboard/financeiro/previsao`);
  await page.getByRole("heading", { name: "Previsão de recebimentos" }).waitFor();
  await shoot(page, dir, "previsao-recebimentos", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=financeiro`);
  await page.getByRole("heading", { name: "Fulana de Tal" }).waitFor();
  await shoot(page, dir, "financeiro-paciente", w);

  if (core) {
    await page.goto(`${BASE_URL}/dashboard/financeiro?periodo=last_6_months&tipo=EXPENSE`);
    await page.getByRole("heading", { name: "Financeiro" }).waitFor();
    await shoot(page, dir, "financeiro-filtro-despesas", w, { full: false });

    await page.goto(`${BASE_URL}/dashboard/financeiro/novo`);
    await page.getByRole("heading", { name: "Novo lançamento" }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Descrição").last().fill("Consulta avulsa — pagamento no dia");
    await page.getByLabel("Valor (R$)").last().fill("230,00");
    await shoot(page, dir, "novo-lancamento", w);

    // Editar o lançamento manual criado para o QA.
    await page.goto(`${BASE_URL}/dashboard/financeiro?periodo=last_6_months&q=Aluguel%20da%20sala`);
    await page.getByRole("heading", { name: "Financeiro" }).waitFor();
    await page.getByRole("button", { name: /Ações do lançamento Aluguel/ }).first().click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await page.getByRole("heading", { name: "Editar lançamento" }).waitFor();
    await shoot(page, dir, "editar-lancamento", w);

    await page.goto(`${BASE_URL}/dashboard/financeiro/pagamentos/novo?paciente=${FULANA_ID}&parcela=${FULANA_INSTALLMENT_3}`);
    await page.getByRole("heading", { name: "Registrar pagamento" }).waitFor();
    await shoot(page, dir, "registrar-pagamento", w);

    // Parcelas do contrato (aba Contratos, card do contrato trimestral da Fulana).
    await page.goto(`${BASE_URL}/dashboard/pacientes/${FULANA_ID}?tab=contratos`);
    await page.getByRole("heading", { name: "Fulana de Tal" }).waitFor();
    await shoot(page, dir, "parcelas-contrato", w);

    // Diálogo de cancelamento de lançamento manual.
    await page.goto(`${BASE_URL}/dashboard/financeiro?periodo=last_6_months&q=Aluguel%20da%20sala`);
    await page.getByRole("heading", { name: "Financeiro" }).waitFor();
    await page.getByRole("button", { name: /Ações do lançamento Aluguel/ }).first().click();
    await page.getByRole("menuitem", { name: "Cancelar lançamento" }).click();
    await page.getByRole("alertdialog").waitFor();
    await shoot(page, dir, "confirmar-cancelamento-lancamento", w, { full: false });
    await page.keyboard.press("Escape");
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
console.log("Preparando dados de exemplo...");
await ensureSampleData(nutriContext);

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
await browser.close();
console.log(`Screenshots em ${OUT}`);
