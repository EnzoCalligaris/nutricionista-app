// QA visual da Fase 13 (CLAUDE.md — regra permanente): captura as telas REAIS
// de pagamentos online (portal: lista de parcelas, resumo antes de pagar,
// Pix com QR + copia e cola, aguardando confirmação, pago, expirado;
// dashboard: financeiro com cobranças, reconciliação, configurações de
// pagamento e a parcela com "Gerar cobrança Pix") na aplicação rodando em
// http://localhost:3000 com o Supabase local + seed e o gateway FAKE.
// Saída: ./screenshots/fase-13/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-13.mjs [--extra]
//   --extra  também captura 375/430 (portal) e 1024 (dashboard).
//
// Prepara dados só no banco local (cobranças em estados diferentes e uma
// divergência de reconciliação) — `npm run db:reset` restaura.

import { chromium } from "playwright";
import pg from "pg";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const OUT = path.resolve("screenshots", "fase-13");
const extra = process.argv.includes("--extra");

function webhookSecret() {
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((entry) => entry.startsWith("PAYMENT_PROVIDER_WEBHOOK_SECRET="));
    return line?.slice("PAYMENT_PROVIDER_WEBHOOK_SECRET=".length).trim() || "dev-only-payment-webhook-secret";
  } catch {
    return "dev-only-payment-webhook-secret";
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

// Parcelas extras SÓ para o QA visual (o seed tem uma única parcela em aberto,
// e cada cenário — pendente, pago, expirado, divergente — precisa da sua).
const QA_INSTALLMENTS = [
  "d3000000-0000-0000-0000-000000000001",
  "d3000000-0000-0000-0000-000000000002",
  "d3000000-0000-0000-0000-000000000003",
  "d3000000-0000-0000-0000-000000000004",
];

/** Zera cobranças/divergências e devolve as parcelas pagas online para "em aberto". */
async function resetPayments() {
  await withDb(async (client) => {
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.payment_reconciliation_items where nutritionist_id = $1`, [NUTRITIONIST.id]);
    await client.query(`delete from public.payment_webhook_events`);
    await client.query(`delete from public.financial_transactions t using public.payments p where t.origin_payment_id = p.id and p.provider <> 'MANUAL'`);
    await client.query(`delete from public.payments where provider <> 'MANUAL'`);
    await client.query(`delete from public.payment_charges`);
    await client.query(`delete from public.notification_events where event_type = 'PAYMENT_CONFIRMED'`);
    await client.query(
      `update public.contract_installments i set status = 'PENDING', paid_at = null
         from public.patient_contracts c
        where c.id = i.contract_id and i.status = 'PAID'
          and coalesce((select sum(p.amount_cents) from public.payments p where p.installment_id = i.id and p.status = 'CONFIRMED'), 0) < i.amount_cents`,
    );
    await client.query(`delete from public.contract_installments where id = any($1::uuid[])`, [QA_INSTALLMENTS]);
    await client.query(`set session_replication_role = origin`);

    const { rows } = await client.query(
      `select c.id, coalesce(max(i.number), 0) as last_number, max(i.amount_cents) as amount_cents
         from public.patient_contracts c join public.contract_installments i on i.contract_id = c.id
        where c.patient_id = $1 and c.status = 'ACTIVE' group by c.id limit 1`,
      [PATIENT.patientId],
    );
    const contract = rows[0];
    for (const [index, id] of QA_INSTALLMENTS.entries()) {
      await client.query(
        `insert into public.contract_installments (id, contract_id, number, amount_cents, due_date) values ($1, $2, $3, $4, current_date + (($5)::int))`,
        [id, contract.id, Number(contract.last_number) + index + 1, contract.amount_cents, (index + 1) * 30],
      );
    }
  });
}

async function openInstallment() {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select i.id, i.number, i.amount_cents
         from public.contract_installments i
         join public.patient_contracts c on c.id = i.contract_id
        where c.patient_id = $1 and i.status = 'PENDING'
          and coalesce((select sum(p.amount_cents) from public.payments p where p.installment_id = i.id and p.status = 'CONFIRMED'), 0) < i.amount_cents
        order by i.due_date limit 1`,
      [PATIENT.patientId],
    );
    if (rows.length === 0) throw new Error("sem parcela em aberto no seed");
    return rows[0];
  });
}

/** Evento assinado entregue ao webhook real (mesmo caminho de produção). */
async function deliverEvent(page, chargeId, status, overrides = {}) {
  const charge = await withDb(async (client) => (await client.query(`select provider_charge_id, amount_cents, currency from public.payment_charges where id = $1`, [chargeId])).rows[0]);
  const payload = JSON.stringify({
    event_id: `qa-${Math.random().toString(36).slice(2, 10)}`,
    type: "payment.updated",
    charge_id: charge.provider_charge_id,
    payment_id: status === "PAID" ? `fake_pay_${chargeId.slice(0, 8)}` : null,
    status,
    amount_cents: overrides.amountCents ?? charge.amount_cents,
    currency: overrides.currency ?? charge.currency,
    occurred_at: new Date().toISOString(),
  });
  const signature = createHmac("sha256", webhookSecret()).update(payload).digest("hex");
  const response = await page.request.post(`${BASE_URL}/api/webhooks/payments/fake`, {
    data: payload,
    headers: { "content-type": "application/json", "x-payment-signature": signature },
  });
  return (await response.json()).outcome;
}

async function login(page, credentials, urlPattern) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(urlPattern);
}

async function shoot(page, dir, name, width, { full = true, idle = true } = {}) {
  if (idle) await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

/** Cria uma cobrança pelo fluxo real do paciente e devolve o id. */
async function createChargeViaUi(page, installmentId) {
  await page.goto(`${BASE_URL}/paciente/pagamentos/${installmentId}`);
  const startButton = page.getByTestId("start-checkout");
  if ((await startButton.count()) === 0) {
    // Já existe cobrança aberta: segue para ela.
    await page.getByRole("link", { name: "Ver cobrança em aberto" }).click();
  } else {
    await page.getByRole("radio", { name: /Pix/ }).first().check();
    await startButton.click();
  }
  await page.waitForURL(/\/checkout\//);
  return new URL(page.url()).pathname.split("/").pop();
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

await resetPayments();
const browser = await chromium.launch();

const patientContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const page = await patientContext.newPage();
  await login(page, PATIENT, /\/paciente$/);
  await page.close();
}
const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const page = await nutriContext.newPage();
  await login(page, NUTRITIONIST, /\/dashboard$/);
  await page.close();
}

// 1. Portal em cada viewport: lista, resumo, Pix aguardando.
let paidChargeId = null;
for (const viewport of viewportsPortal) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await patientContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Portal ${viewport.name} (${w})...`);

  await page.goto(`${BASE_URL}/paciente/pagamentos`);
  await page.getByRole("heading", { name: "Pagamentos" }).waitFor();
  await shoot(page, dir, "pagamentos", w);

  const installment = await openInstallment();
  await page.goto(`${BASE_URL}/paciente/pagamentos/${installment.id}`);
  await page.getByTestId("amount-to-pay").waitFor();
  await shoot(page, dir, "checkout-resumo", w);

  const chargeId = await createChargeViaUi(page, installment.id);
  await page.getByTestId("pix-payload").waitFor();
  await shoot(page, dir, "checkout-pix-aguardando", w);

  if (!paidChargeId) {
    // Confirma este (pelo webhook assinado) para render do estado "pago".
    await deliverEvent(page, chargeId, "PAID");
    paidChargeId = chargeId;
    await page.reload();
    await page.getByTestId("charge-paid").waitFor();
    await shoot(page, dir, "checkout-pago", w);
  } else {
    await page.goto(`${BASE_URL}/paciente/pagamentos/checkout/${paidChargeId}`);
    await page.getByTestId("charge-paid").waitFor();
    await shoot(page, dir, "checkout-pago", w, { full: false });
    // A cobrança recém-criada vira a "expirada" da próxima captura.
    await deliverEvent(page, chargeId, "EXPIRED");
  }
  await page.close();
}

// 2. Cobrança expirada (390 e 1440).
{
  const installment = await openInstallment();
  const page = await patientContext.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  const chargeId = await createChargeViaUi(page, installment.id);
  await deliverEvent(page, chargeId, "EXPIRED");
  for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 900 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE_URL}/paciente/pagamentos/checkout/${chargeId}`);
    await page.getByTestId("charge-closed").waitFor();
    await shoot(page, path.join(OUT, viewport.name), "checkout-expirado", viewport.width, { full: false });
  }
  await page.close();
}

// 3. Divergência de valor para a tela de reconciliação.
{
  const installment = await openInstallment();
  const page = await patientContext.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const chargeId = await createChargeViaUi(page, installment.id);
  await deliverEvent(page, chargeId, "PAID", { amountCents: 1 });
  await page.close();
}

await patientContext.close();

// 4. Dashboard.
for (const viewport of viewportsDashboard) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await nutriContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Dashboard ${viewport.name} (${w})...`);

  await page.goto(`${BASE_URL}/dashboard/financeiro`);
  await page.getByRole("heading", { name: "Financeiro" }).waitFor();
  await shoot(page, dir, "financeiro-com-cobrancas", w);

  await page.goto(`${BASE_URL}/dashboard/financeiro/reconciliacao`);
  await page.getByRole("heading", { name: "Reconciliação" }).waitFor();
  await shoot(page, dir, "reconciliacao", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/pagamentos`);
  await page.getByTestId("payment-provider-card").waitFor();
  await shoot(page, dir, "configuracoes-pagamentos", w);

  await page.goto(`${BASE_URL}/dashboard/pacientes/${PATIENT.patientId}?tab=financeiro`);
  await page.getByRole("heading", { name: "Contratos e parcelas" }).waitFor();
  await shoot(page, dir, "paciente-financeiro-cobranca", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes`);
  await page.getByRole("heading", { name: "Configurações" }).waitFor();
  await shoot(page, dir, "configuracoes-hub", w, { full: false });
  await page.close();
}
await nutriContext.close();

await browser.close();
console.log(`Screenshots em ${OUT}`);
