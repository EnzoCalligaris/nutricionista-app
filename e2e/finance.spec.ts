import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

// Fase 7 — financeiro ponta a ponta contra o app real + Supabase local com
// o seed. Em série e com UMA sessão de nutricionista para o arquivo
// (rate limit de login — docs/DECISIONS.md, Fase 5). Fluxos: lançamento
// manual (criar/editar/cancelar), filtros, registrar pagamento parcial e
// total (dashboard atualiza), estorno, previsão, financeiro do paciente,
// ownership por URL e mobile 390.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const BELTRANO_ID = "90000000-0000-0000-0000-000000000011";
// Parcela 4 do contrato semestral do Beltrano (seed): R$214,60 pendente.
const INSTALLMENT_BELTRANO_4 = "90000000-0000-0000-0000-000000000334";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 7";
const STARTED_AT = new Date().toISOString();

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function withDb(fn: (client: pg.Client) => Promise<void>) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('financial_transaction','payment','installment')`, [STARTED_AT]);
    await client.query(`delete from public.financial_transactions where origin_payment_id in (select id from public.payments where recorded_by = $1 and created_at >= $2)`, [NUTRITIONIST.id, STARTED_AT]);
    await client.query(`delete from public.payments where recorded_by = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT]);
    await client.query(`update public.contract_installments set status = 'PENDING', paid_at = null where id = $1`, [INSTALLMENT_BELTRANO_4]);
    await client.query(`delete from public.financial_transactions where description like $1`, [`${TAG}%`]);
  });
}

test.beforeAll(async () => {
  // Estado limpo mesmo se uma execução anterior tiver sido interrompida.
  await withDb(async (client) => {
    await client.query(`delete from public.financial_transactions where origin_payment_id in (select id from public.payments where idempotency_key is not null and installment_id = $1)`, [INSTALLMENT_BELTRANO_4]);
    await client.query(`delete from public.payments where idempotency_key is not null and installment_id = $1`, [INSTALLMENT_BELTRANO_4]);
    await client.query(`update public.contract_installments set status = 'PENDING', paid_at = null where id = $1`, [INSTALLMENT_BELTRANO_4]);
    await client.query(`delete from public.financial_transactions where description like $1`, [`${TAG}%`]);
  });
});

test.afterAll(async () => {
  await cleanup();
});

test.describe("nutricionista — financeiro", () => {
  let page: Page;
  let monthIncomeBefore = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("home mostra cards reais e gráficos acessíveis", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
    const faturamento = page.locator("[data-slot=card]").filter({ hasText: "Faturamento do mês" });
    await expect(faturamento.getByText(/^R\$/)).toBeVisible();
    monthIncomeBefore = (await faturamento.locator("p.font-mono").textContent()) ?? "";
    await expect(page.locator("[data-slot=card]").filter({ hasText: "Pacientes ativos" }).locator("p.font-mono")).toHaveText(/^\d+$/);
    await expect(page.getByRole("img", { name: "Receita e despesa mensais dos últimos meses" })).toBeVisible();
    await expect(page.getByRole("table").filter({ hasText: "Receita e despesa por mês" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Previsão de recebimentos" })).toBeVisible();
  });

  test("cria lançamento manual (despesa) e ele aparece nos totais", async () => {
    await page.goto("/dashboard/financeiro");
    await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
    const despesasCard = page.locator("[data-slot=card]").filter({ hasText: "Despesas" });
    const despesasBefore = (await despesasCard.locator("p").first().textContent()) ?? "";

    await page.getByRole("link", { name: "Novo lançamento" }).click();
    await expect(page.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();
    await page.getByLabel("Tipo").selectOption("EXPENSE");
    await page.getByLabel("Descrição").fill(`${TAG} — aluguel`);
    await page.getByLabel("Valor (R$)").fill("1.080,00");
    await page.getByLabel("Método de pagamento").selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Criar lançamento" }).click();

    // O FlashToast remove `?toast=` da URL logo após exibir: afirmar o toast, não o query param.
    await expect(page.getByText("Lançamento criado.")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/financeiro(\?|$)/);
    const row = page.getByRole("row").filter({ hasText: `${TAG} — aluguel` });
    await expect(row).toBeVisible();
    await expect(row).toContainText("1.080,00");
    await expect(page.locator("[data-slot=card]").filter({ hasText: "Despesas" }).locator("p").first()).not.toHaveText(despesasBefore);
  });

  test("rejeita valor inválido e zero sem sair do formulário", async () => {
    await page.goto("/dashboard/financeiro/novo");
    await page.getByLabel("Descrição").fill(`${TAG} — inválido`);
    await page.getByLabel("Valor (R$)").fill("abc");
    await page.getByRole("button", { name: "Criar lançamento" }).click();
    await expect(page.getByText("Informe um valor válido (ex.: 230,00).")).toBeVisible();
    await page.getByLabel("Valor (R$)").fill("0");
    await page.getByRole("button", { name: "Criar lançamento" }).click();
    await expect(page.getByText("Informe um valor maior que zero.")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/financeiro\/novo/);
  });

  test("edita e cancela lançamento manual (histórico preservado)", async () => {
    await page.goto(`/dashboard/financeiro?q=${encodeURIComponent(TAG)}`);
    const row = page.getByRole("row").filter({ hasText: `${TAG} — aluguel` });
    await row.getByRole("button", { name: /Ações do lançamento/ }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible();
    await expect(page.getByLabel("Valor (R$)")).toHaveValue("1080,00");
    await page.getByLabel("Valor (R$)").fill("1.100,00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Lançamento atualizado.")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/financeiro(\?|$)/);

    await page.goto(`/dashboard/financeiro?q=${encodeURIComponent(TAG)}`);
    const updated = page.getByRole("row").filter({ hasText: `${TAG} — aluguel` });
    await expect(updated).toContainText("1.100,00");
    await updated.getByRole("button", { name: /Ações do lançamento/ }).click();
    await page.getByRole("menuitem", { name: "Cancelar lançamento" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar lançamento" }).click();
    await expect(page.getByText("Lançamento cancelado.")).toBeVisible();
    await page.goto(`/dashboard/financeiro?q=${encodeURIComponent(TAG)}&status=CANCELLED`);
    await expect(page.getByRole("row").filter({ hasText: `${TAG} — aluguel` })).toContainText("Cancelado");
  });

  test("filtros por período/tipo/status/busca funcionam pela URL", async () => {
    await page.goto("/dashboard/financeiro?periodo=last_6_months&tipo=INCOME&q=Beltrano");
    await expect(page.getByRole("navigation", { name: "Período" }).getByRole("link", { name: "Últimos 6 meses" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("row").filter({ hasText: "Beltrano da Silva" }).first()).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Fulana de Tal" })).toHaveCount(0);
    await page.goto("/dashboard/financeiro?periodo=last_6_months&tipo=EXPENSE&q=zzz-nada");
    await expect(page.getByText("Nenhum lançamento encontrado com esses filtros.")).toBeVisible();
  });

  test("registra pagamento parcial e total na parcela; dashboard atualiza", async () => {
    await page.goto(`/dashboard/pacientes/${BELTRANO_ID}?tab=financeiro`);
    await expect(page.getByRole("heading", { name: "Contratos e parcelas" })).toBeVisible();
    const installmentRow = page.getByRole("row").filter({ hasText: "4/6" });
    await expect(installmentRow).toContainText("Pendente");
    await installmentRow.getByRole("link", { name: "Registrar pagamento da parcela 4" }).click();

    await expect(page.getByRole("heading", { name: "Registrar pagamento" })).toBeVisible();
    await expect(page.getByLabel("Valor (R$)")).toHaveValue("214,60");
    // A maior: bloqueado no servidor.
    await page.getByLabel("Valor (R$)").fill("214,61");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("O valor excede o restante da parcela")).toBeVisible();
    // Parcial de R$ 100.
    await page.getByLabel("Valor (R$)").fill("100,00");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado.")).toBeVisible();
    await expect(page).toHaveURL(/tab=financeiro/);

    const partialRow = page.getByRole("row").filter({ hasText: "4/6" });
    await expect(partialRow).toContainText("Parcial");
    await expect(partialRow).toContainText(brl(11460));
    await expect(page.getByRole("row").filter({ hasText: "Plano Semestral · parcela 4" })).toContainText(brl(10000));

    // Restante: quita.
    await partialRow.getByRole("link", { name: "Registrar pagamento da parcela 4" }).click();
    await expect(page.getByLabel("Valor (R$)")).toHaveValue("114,60");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByText("Pagamento registrado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "4/6" })).toContainText("Paga");

    await page.goto("/dashboard");
    const faturamento = page.locator("[data-slot=card]").filter({ hasText: "Faturamento do mês" });
    await expect(faturamento.locator("p.font-mono")).not.toHaveText(monthIncomeBefore);
    await page.goto("/dashboard/financeiro");
    await expect(page.getByRole("row").filter({ hasText: "Parcela 4 — Beltrano da Silva" })).toHaveCount(2);
  });

  test("estorna pagamento: parcela reabre e lançamento é cancelado", async () => {
    await page.goto(`/dashboard/pacientes/${BELTRANO_ID}?tab=financeiro`);
    const payment = page.getByRole("row").filter({ hasText: "Plano Semestral · parcela 4" }).filter({ hasText: brl(11460) });
    await payment.getByRole("button", { name: /Estornar pagamento/ }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Estornar pagamento" }).click();
    await expect(page.getByText("Pagamento estornado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "4/6" })).toContainText("Parcial");
    await expect(page.getByRole("row").filter({ hasText: "Plano Semestral · parcela 4" }).filter({ hasText: "Estornado" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Parcela 4 — Beltrano da Silva" }).filter({ hasText: "Cancelado" })).toBeVisible();
  });

  test("previsão de recebimentos lista contratos com totais", async () => {
    await page.goto("/dashboard/financeiro/previsao");
    await expect(page.getByRole("heading", { name: "Previsão de recebimentos" })).toBeVisible();
    const beltrano = page.getByRole("row").filter({ hasText: "Beltrano da Silva" });
    await expect(beltrano).toContainText("Plano Semestral");
    await expect(beltrano).toContainText(brl(128760));
    await expect(beltrano).toContainText("Ativo");
    await expect(page.getByRole("row").filter({ hasText: "Fulano de Tal Neto" })).toContainText("Encerrado");
  });

  test("ownership: ids adulterados caem em 404 sem vazar dados", async () => {
    // Com `loading.tsx` a resposta é streamada (status 200 + conteúdo de
    // not-found), como em /dashboard/pacientes/[id]: a garantia é a página
    // "não encontrado" sem nenhum dado do registro.
    await page.goto("/dashboard/financeiro/00000000-0000-0000-0000-000000000000/editar");
    await expect(page.getByRole("heading", { name: "Registro financeiro não encontrado" })).toBeVisible();
    await page.goto("/dashboard/financeiro/pagamentos/novo?paciente=00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "Registro financeiro não encontrado" })).toBeVisible();
    await page.goto("/dashboard/financeiro/pagamentos/novo?paciente=nao-e-uuid");
    await expect(page.getByRole("heading", { name: "Registro financeiro não encontrado" })).toBeVisible();
    // Retorno inseguro é ignorado (fica no perfil do paciente).
    await page.goto(`/dashboard/financeiro/pagamentos/novo?paciente=${BELTRANO_ID}&voltar=https://evil.example`);
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", `/dashboard/pacientes/${BELTRANO_ID}?tab=financeiro`);
  });

  test("auditoria registrou os eventos financeiros", async () => {
    await withDb(async (client) => {
      const result = await client.query(
        `select action from public.audit_logs where actor_id = $1 and created_at >= $2 and action in ('FINANCIAL_TRANSACTION_CREATED','FINANCIAL_TRANSACTION_UPDATED','FINANCIAL_TRANSACTION_CANCELLED','PAYMENT_RECORDED','INSTALLMENT_PAYMENT_APPLIED','PAYMENT_CANCELLED')`,
        [NUTRITIONIST.id, STARTED_AT],
      );
      const actions = new Set(result.rows.map((row) => row.action));
      expect([...actions].sort()).toEqual(["FINANCIAL_TRANSACTION_CANCELLED", "FINANCIAL_TRANSACTION_CREATED", "FINANCIAL_TRANSACTION_UPDATED", "INSTALLMENT_PAYMENT_APPLIED", "PAYMENT_CANCELLED", "PAYMENT_RECORDED"]);
    });
  });

  test("mobile 390: financeiro em cards, sem overflow horizontal", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/financeiro?periodo=last_6_months");
    await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Lançamentos" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.goto("/dashboard");
    const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowHome).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});

test.describe("paciente", () => {
  test("não acessa o financeiro do dashboard", async ({ page }) => {
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
    await page.goto("/dashboard/financeiro");
    await expect(page).not.toHaveURL(/\/dashboard\/financeiro/);
  });
});
