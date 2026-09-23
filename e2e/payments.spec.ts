import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

// Fase 13 — pagamentos online ponta a ponta contra o app real (build de
// produção) + Supabase local, com o FakePaymentProvider (nada sai para a
// rede e nenhum dado de cartão é pedido em lugar nenhum).
// Cobre: portal com parcelas e saldo, checkout (resumo → método → Pix),
// "estamos confirmando" enquanto o servidor não confirmou, confirmação via
// evento assinado do provedor, financeiro atualizado, cobrança expirada com
// nova cobrança, ownership (paciente não vê cobrança de outro), rota
// protegida para anônimo, webhook com assinatura inválida, dashboard
// (cobranças, reconciliação, configurações) e mobile 390 sem overflow.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const OTHER_PATIENT = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const STARTED_AT = new Date().toISOString();

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Estado re-executável: nenhuma cobrança do seed, parcelas do contrato da Fulana em aberto. */
async function resetPayments() {
  await withDb(async (client) => {
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.payment_reconciliation_items where nutritionist_id = $1`, [NUTRITIONIST.id]);
    await client.query(`delete from public.payment_webhook_events`);
    await client.query(
      `delete from public.financial_transactions t using public.payments p where t.origin_payment_id = p.id and p.provider <> 'MANUAL' and p.patient_id in ($1, $2)`,
      [PATIENT.patientId, OTHER_PATIENT.patientId],
    );
    await client.query(`delete from public.payments where provider <> 'MANUAL' and patient_id in ($1, $2)`, [PATIENT.patientId, OTHER_PATIENT.patientId]);
    await client.query(`delete from public.payment_charges where patient_id in ($1, $2)`, [PATIENT.patientId, OTHER_PATIENT.patientId]);
    await client.query(`delete from public.notification_events where event_type = 'PAYMENT_CONFIRMED'`);
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('payment_charge', 'payment_reconciliation')`, [STARTED_AT]);
    // Parcela quitada por pagamento ONLINE volta a ficar em aberto (o pagamento
    // manual do seed continua valendo e mantém as parcelas 1 e 2 pagas).
    await client.query(
      `update public.contract_installments i set status = 'PENDING', paid_at = null
         from public.patient_contracts c
        where c.id = i.contract_id and c.patient_id in ($1, $2) and i.status = 'PAID'
          and coalesce((select sum(p.amount_cents) from public.payments p where p.installment_id = i.id and p.status = 'CONFIRMED'), 0) < i.amount_cents`,
      [PATIENT.patientId, OTHER_PATIENT.patientId],
    );
    await client.query(`set session_replication_role = origin`);
  });
}

/** Parcela em aberto da paciente (a mais próxima do vencimento). */
async function openInstallment(): Promise<{ id: string; amount_cents: number; number: number }> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select i.id, i.amount_cents, i.number
         from public.contract_installments i
         join public.patient_contracts c on c.id = i.contract_id
        where c.patient_id = $1 and i.status = 'PENDING'
          and coalesce((select sum(p.amount_cents) from public.payments p where p.installment_id = i.id and p.status = 'CONFIRMED'), 0) < i.amount_cents
        order by i.due_date
        limit 1`,
      [PATIENT.patientId],
    );
    if (rows.length === 0) throw new Error("seed sem parcela em aberto para a paciente");
    return rows[0];
  });
}

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const WEBHOOK_SECRET = readSecretFromEnvFile();

/**
 * Entrega um evento ASSINADO ao webhook real — é o caminho de produção. O
 * painel de simulação da UI existe só em desenvolvimento (§69), e a suíte
 * roda contra o build de produção.
 */
async function deliverProviderEvent(page: Page, input: { chargeId: string; status: string; amountCents?: number; currency?: string; eventId?: string }): Promise<string> {
  const charge = await withDb(async (client) => (await client.query(`select provider_charge_id, amount_cents, currency from public.payment_charges where id = $1`, [input.chargeId])).rows[0]);
  const payload = JSON.stringify({
    event_id: input.eventId ?? `e2e-${Math.random().toString(36).slice(2, 10)}`,
    type: "payment.updated",
    charge_id: charge.provider_charge_id,
    payment_id: input.status === "PAID" ? `fake_pay_${input.chargeId.slice(0, 8)}` : null,
    status: input.status,
    amount_cents: input.amountCents ?? charge.amount_cents,
    currency: input.currency ?? charge.currency,
    occurred_at: new Date().toISOString(),
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  const response = await page.request.post("/api/webhooks/payments/fake", {
    data: payload,
    headers: { "content-type": "application/json", "x-payment-signature": signature },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).outcome as string;
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

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

test.beforeAll(async ({ browser }) => {
  await resetPayments();
  await openContexts(browser);
});

test.afterAll(async () => {
  await resetPayments();
  await nutriContext?.close();
  await patientContext?.close();
});

test("rota de pagamento exige sessão (anônimo vai para o login)", async ({ page }) => {
  await page.goto("/paciente/pagamentos");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/paciente/pagamentos/checkout/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login/);
});

test("webhook sem assinatura válida é recusado e não altera nada", async ({ request }) => {
  const body = { event_id: "e2e-invalid", type: "payment.updated", charge_id: "fake_ch_qualquer", status: "PAID", amount_cents: 1, currency: "BRL", occurred_at: new Date().toISOString() };
  const noSignature = await request.post("/api/webhooks/payments/fake", { data: body });
  expect(noSignature.status()).toBe(401);
  const wrongSignature = await request.post("/api/webhooks/payments/fake", { data: body, headers: { "x-payment-signature": "deadbeef" } });
  expect(wrongSignature.status()).toBe(401);
  const unknownProvider = await request.post("/api/webhooks/payments/mercado-pago", { data: body, headers: { "x-payment-signature": "deadbeef" } });
  expect(unknownProvider.status()).toBe(404);

  const events = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.payment_webhook_events`)).rows[0].n);
  expect(events).toBe(0);
});

test("paciente vê parcelas, abre o checkout e recebe o Pix", async () => {
  const installment = await openInstallment();
  await patient.goto("/paciente/pagamentos");
  await expect(patient.getByRole("heading", { name: "Pagamentos" })).toBeVisible();
  await expect(patient.getByTestId("payment-summary")).toBeVisible();
  await expect(patient.getByText("Ambiente de pagamentos simulado")).toBeVisible();
  const rows = patient.getByTestId("installment-row");
  expect(await rows.count()).toBeGreaterThan(0);

  await patient.goto(`/paciente/pagamentos/${installment.id}`);
  await expect(patient.getByTestId("amount-to-pay")).toContainText("R$");
  await patient.getByRole("radio", { name: /Pix/ }).check();
  await patient.getByTestId("start-checkout").click();

  await expect(patient).toHaveURL(/\/paciente\/pagamentos\/checkout\//);
  await expect(patient.getByTestId("pix-payload")).toContainText("FAKE-PIX-");
  await expect(patient.getByRole("img", { name: /QR Code/ })).toBeVisible();
  await expect(patient.getByTestId("charge-status-line")).toContainText("Estamos confirmando");
  // Nunca "aprovado" só porque a tela abriu.
  await expect(patient.getByText("Pagamento confirmado", { exact: true })).toHaveCount(0);

  const charge = await withDb(async (client) => (await client.query(`select id, status, amount_cents from public.payment_charges where installment_id = $1 order by created_at desc limit 1`, [installment.id])).rows[0]);
  expect(charge.status).toBe("PENDING");
  // O valor veio do banco, não do browser.
  expect(charge.amount_cents).toBe(installment.amount_cents);
});

test("abrir o checkout de novo reaproveita a mesma cobrança (não gera outro Pix)", async () => {
  const installment = await openInstallment();
  const before = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.payment_charges where installment_id = $1`, [installment.id])).rows[0].n);
  await patient.goto(`/paciente/pagamentos/${installment.id}`);
  await expect(patient.getByText("Já existe uma cobrança aberta para esta parcela.")).toBeVisible();
  await patient.getByRole("link", { name: "Ver cobrança em aberto" }).click();
  await expect(patient).toHaveURL(/\/checkout\//);
  const after = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.payment_charges where installment_id = $1`, [installment.id])).rows[0].n);
  expect(after).toBe(before);
});

test("confirmação vem do provedor: financeiro, parcela e portal atualizados", async () => {
  const installment = await openInstallment();
  const chargeId = await withDb(async (client) => (await client.query(`select id from public.payment_charges where installment_id = $1 and status = 'PENDING' order by created_at desc limit 1`, [installment.id])).rows[0].id);

  await patient.goto(`/paciente/pagamentos/checkout/${chargeId}`);
  await expect(patient.getByTestId("charge-status-line")).toContainText("Estamos confirmando");
  expect(await deliverProviderEvent(patient, { chargeId, status: "PAID" })).toBe("PAID");
  await patient.reload();
  await expect(patient.getByTestId("charge-paid")).toBeVisible({ timeout: 15_000 });
  await expect(patient.getByText("Recebemos seu pagamento.")).toBeVisible();

  const state = await withDb(async (client) => {
    const charge = (await client.query(`select status, payment_id from public.payment_charges where id = $1`, [chargeId])).rows[0];
    const payment = (await client.query(`select id, status, provider, amount_cents from public.payments where id = $1`, [charge.payment_id])).rows[0];
    const transaction = (await client.query(`select id, type, status, amount_cents from public.financial_transactions where origin_payment_id = $1`, [charge.payment_id])).rows;
    const inst = (await client.query(`select status from public.contract_installments where id = $1`, [installment.id])).rows[0];
    const events = (await client.query(`select count(*)::int as n from public.payment_webhook_events where status = 'PROCESSED'`)).rows[0].n;
    return { charge, payment, transaction, inst, events };
  });
  expect(state.charge.status).toBe("PAID");
  expect(state.payment).toMatchObject({ status: "CONFIRMED", provider: "fake", amount_cents: installment.amount_cents });
  expect(state.transaction).toHaveLength(1);
  expect(state.transaction[0]).toMatchObject({ type: "INCOME", status: "CONFIRMED", amount_cents: installment.amount_cents });
  expect(state.inst.status).toBe("PAID");
  expect(state.events).toBeGreaterThanOrEqual(1);

  // Portal: parcela quitada, sem botão de pagar.
  await patient.goto("/paciente/pagamentos");
  const paidRow = patient.getByTestId("installment-row").filter({ hasText: `Parcela ${installment.number}` }).first();
  await expect(paidRow).toHaveAttribute("data-status", "PAID");
  await expect(paidRow.getByTestId("pay-installment")).toHaveCount(0);

  // Dashboard: cobrança paga aparece no financeiro e o lançamento entrou.
  await nutri.goto("/dashboard/financeiro");
  await expect(nutri.getByTestId("finance-charge-row").first()).toBeVisible();
  await expect(nutri.getByTestId("finance-charge-row").first()).toContainText("Pago");
});

test("reenvio do mesmo evento não duplica receita", async () => {
  const before = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.payments where provider = 'fake'`)).rows[0].n);
  const charge = await withDb(async (client) => (await client.query(`select id from public.payment_charges where status = 'PAID' order by paid_at desc limit 1`)).rows[0]);
  // Mesmo evento reenviado 5x + um evento novo com o mesmo status: nenhum efeito extra.
  const repeatedId = `e2e-repeat-${charge.id}`;
  const outcomes = [] as string[];
  for (let i = 0; i < 5; i += 1) outcomes.push(await deliverProviderEvent(patient, { chargeId: charge.id, status: "PAID", eventId: repeatedId }));
  expect(outcomes.slice(1).every((outcome) => outcome === "DUPLICATE_EVENT")).toBe(true);
  expect(await deliverProviderEvent(patient, { chargeId: charge.id, status: "PAID" })).toBe("ALREADY_PAID");
  // Evento atrasado (PENDING depois de PAID) não rebaixa nada.
  expect(await deliverProviderEvent(patient, { chargeId: charge.id, status: "PENDING" })).toBe("OUT_OF_ORDER");
  const after = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.payments where provider = 'fake'`)).rows[0].n);
  expect(after).toBe(before);
});

test("cobrança expirada: paciente gera uma nova para a mesma parcela", async () => {
  await resetPayments();
  const installment = await openInstallment();
  await patient.goto(`/paciente/pagamentos/${installment.id}`);
  await patient.getByRole("radio", { name: /Pix/ }).check();
  await patient.getByTestId("start-checkout").click();
  await expect(patient).toHaveURL(/\/checkout\//);
  const chargeId = new URL(patient.url()).pathname.split("/").pop()!;

  expect(await deliverProviderEvent(patient, { chargeId, status: "EXPIRED" })).toBe("STATUS_UPDATED");
  await patient.reload();
  await expect(patient.getByTestId("charge-closed")).toBeVisible({ timeout: 15_000 });
  await expect(patient.getByText("Esta cobrança expirou.")).toBeVisible();
  await expect(patient.getByTestId("pix-payload")).toHaveCount(0);

  await patient.getByTestId("new-charge").click();
  await expect(patient).toHaveURL(new RegExp(`/paciente/pagamentos/${installment.id}$`));
  await patient.getByRole("radio", { name: /Pix/ }).check();
  await patient.getByTestId("start-checkout").click();
  await expect(patient).toHaveURL(/\/checkout\//);
  const newChargeId = new URL(patient.url()).pathname.split("/").pop()!;
  expect(newChargeId).not.toBe(chargeId);
  await expect(patient.getByTestId("pix-payload")).toBeVisible();
});

test("ownership: paciente não abre cobrança de outro paciente", async ({ browser }) => {
  const charge = await withDb(async (client) => (await client.query(`select id from public.payment_charges where patient_id = $1 limit 1`, [PATIENT.patientId])).rows[0]);
  const context = await browser.newContext();
  const other = await context.newPage();
  await login(other, OTHER_PATIENT);
  await expect(other).toHaveURL(/\/paciente$/);
  const response = await other.goto(`/paciente/pagamentos/checkout/${charge.id}`);
  expect(response?.status()).toBe(404);
  // 404 padrão do Next (a app não tem not-found próprio no portal) — o importante é não vazar nada da cobrança.
  await expect(other.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(other.getByText("FAKE-PIX-")).toHaveCount(0);
  // A ferramenta de simulação não existe fora de desenvolvimento (§69).
  const simulate = await other.request.post("/api/dev/payments/simulate", { data: { chargeId: charge.id, status: "PAID" } });
  expect(simulate.status()).toBe(404);
  await context.close();
});

test("nutricionista: gera cobrança da parcela, vê reconciliação e configurações", async () => {
  await resetPayments();
  const installment = await openInstallment();
  await nutri.goto(`/dashboard/pacientes/${PATIENT.patientId}?tab=financeiro`);
  const row = nutri.getByRole("row").filter({ has: nutri.getByRole("link", { name: `Registrar pagamento da parcela ${installment.number}` }) });
  await row.getByTestId("create-charge").click();
  await expect(nutri.getByText("Cobrança Pix gerada.")).toBeVisible();
  const created = await withDb(async (client) => (await client.query(`select id, status, amount_cents, created_by from public.payment_charges where installment_id = $1 order by created_at desc limit 1`, [installment.id])).rows[0]);
  expect(created.status).toBe("PENDING");
  expect(created.amount_cents).toBe(installment.amount_cents);
  expect(created.created_by).toBe(NUTRITIONIST.id);

  const audit = await withDb(async (client) => (await client.query(`select count(*)::int as n from public.audit_logs where action = 'PAYMENT_CHARGE_CREATED' and actor_id = $1`, [NUTRITIONIST.id])).rows[0].n);
  expect(audit).toBeGreaterThanOrEqual(1);

  // Cancelar a cobrança aberta.
  await nutri.goto(`/dashboard/pacientes/${PATIENT.patientId}?tab=financeiro`);
  await nutri.getByTestId("cancel-charge").first().click();
  await expect(nutri.getByText("Cobrança cancelada.")).toBeVisible();

  await nutri.goto("/dashboard/financeiro/reconciliacao");
  await expect(nutri.getByRole("heading", { name: "Reconciliação" })).toBeVisible();
  await nutri.getByTestId("run-reconciliation").click();
  await expect(nutri.getByText("Conferência concluída.")).toBeVisible();

  await nutri.goto("/dashboard/configuracoes/pagamentos");
  await expect(nutri.getByTestId("payment-provider-card")).toContainText("Simulado");
  await expect(nutri.getByTestId("payment-provider-card")).toContainText("Pix");
  await expect(nutri.getByText(/PAYMENT_PROVIDER_SECRET_KEY\s*=/)).toHaveCount(0);
});

test("divergência de valor aparece na reconciliação e não quita a parcela", async () => {
  await resetPayments();
  const installment = await openInstallment();
  await patient.goto(`/paciente/pagamentos/${installment.id}`);
  await patient.getByRole("radio", { name: /Pix/ }).check();
  await patient.getByTestId("start-checkout").click();
  await expect(patient).toHaveURL(/\/checkout\//);
  const chargeId = new URL(patient.url()).pathname.split("/").pop()!;

  // Provedor informa um valor menor: nada é quitado (§112).
  expect(await deliverProviderEvent(patient, { chargeId, status: "PAID", amountCents: 1 })).toBe("AMOUNT_MISMATCH");
  // Moeda diferente também não confirma (§113).
  expect(await deliverProviderEvent(patient, { chargeId, status: "PAID", currency: "USD" })).toBe("CURRENCY_MISMATCH");

  const state = await withDb(async (client) => ({
    charge: (await client.query(`select status from public.payment_charges where id = $1`, [chargeId])).rows[0],
    payments: (await client.query(`select count(*)::int as n from public.payments where installment_id = $1 and provider = 'fake'`, [installment.id])).rows[0].n,
  }));
  expect(state.charge.status).toBe("PENDING");
  expect(state.payments).toBe(0);

  await nutri.goto("/dashboard/financeiro/reconciliacao");
  const item = nutri.getByTestId("reconciliation-item").filter({ hasText: "Valor divergente" }).first();
  await expect(item).toBeVisible();
  await item.getByTestId("resolve-reconciliation").click();
  await nutri.getByRole("button", { name: "Marcar como resolvida" }).click();
  await expect(nutri.getByText("Divergência marcada como resolvida.")).toBeVisible();
});

function readSecretFromEnvFile(): string {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("PAYMENT_PROVIDER_WEBHOOK_SECRET="));
    return line?.slice("PAYMENT_PROVIDER_WEBHOOK_SECRET=".length).trim() || "dev-only-payment-webhook-secret";
  } catch {
    return "dev-only-payment-webhook-secret";
  }
}

test("mobile 390: pagamentos e checkout sem overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await resetPayments();
  await login(page, PATIENT);
  await expect(page).toHaveURL(/\/paciente$/);
  await page.goto("/paciente/pagamentos");
  await expect(page.getByRole("heading", { name: "Pagamentos" })).toBeVisible();
  await noHorizontalOverflow(page);

  const installment = await openInstallment();
  await page.goto(`/paciente/pagamentos/${installment.id}`);
  await noHorizontalOverflow(page);
  const existing = await withDb(async (client) => (await client.query(`select id from public.payment_charges where installment_id = $1 and status in ('CREATED','PENDING') limit 1`, [installment.id])).rows[0]);
  if (existing) {
    await page.goto(`/paciente/pagamentos/checkout/${existing.id}`);
    await expect(page.getByTestId("pix-payload")).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await context.close();
});
