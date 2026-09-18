import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

// Fase 5 — pacientes e contratos ponta a ponta, contra o app real + Supabase
// local com o seed. Em série pelo mesmo motivo de e2e/auth.spec.ts (um único
// servidor + um único Postgres local, sessões compartilhadas).
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

// Nome começa com "Zz" para ordenar por último e não empurrar os pacientes
// do seed para fora da primeira página em execuções repetidas.
const RUN = Date.now().toString(36);
const NEW_PATIENT = {
  fullName: `Zz E2E Paciente ${RUN}`,
  email: `e2e-${RUN}@example.test`,
  phone: "+55 11 90000-1234",
  birthDate: "1990-05-20",
};

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

// As seções do perfil e a sidebar do dashboard têm links com o mesmo nome
// ("Contratos", "Consultas") — escopa para a navegação das seções.
function sectionNav(page: Page) {
  return page.getByRole("navigation", { name: "Seções do paciente" });
}

async function loginAsNutritionist(page: Page) {
  await login(page, NUTRITIONIST);
  await expect(page).toHaveURL(/\/dashboard$/);
}

// Remove só o que este arquivo criou (e-mails e2e-*), preservando o seed.
test.afterAll(async () => {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `delete from public.audit_logs where entity_id in (
         select id from public.patients where email like 'e2e-%@example.test'
       ) or entity_id in (
         select c.id from public.patient_contracts c join public.patients p on p.id = c.patient_id where p.email like 'e2e-%@example.test'
       )`,
    );
    await client.query(
      `delete from public.contract_installments where contract_id in (
         select c.id from public.patient_contracts c join public.patients p on p.id = c.patient_id where p.email like 'e2e-%@example.test')`,
    );
    await client.query(
      `delete from public.patient_contracts where patient_id in (select id from public.patients where email like 'e2e-%@example.test')`,
    );
    await client.query(`delete from public.patients where email like 'e2e-%@example.test'`);
  } finally {
    await client.end();
  }
});

test.describe("controle de acesso", () => {
  test("anônimo em /dashboard/pacientes vai para /login", async ({ page }) => {
    await page.goto("/dashboard/pacientes");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fpacientes/);
  });

  test("PATIENT não acessa a gestão de pacientes", async ({ page }) => {
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
    await page.goto("/dashboard/pacientes");
    await expect(page).toHaveURL(/\/paciente$/);
    await page.goto(`/dashboard/pacientes/${FULANA_ID}`);
    await expect(page).toHaveURL(/\/paciente$/);
  });

});

test.describe("listagem", () => {
  // Uma única sessão de nutricionista para o bloco inteiro: o login tem
  // rate limit em memória (10 por 5 min por IP+e-mail) e a suíte E2E
  // completa já consome vários logins — logar por teste estouraria o limite.
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsNutritionist(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("id inexistente/alheio mostra 'Paciente não encontrado' sem vazar nada", async () => {
    await page.goto("/dashboard/pacientes/e5000000-0000-0000-0000-00000000dead");
    await expect(page.getByRole("heading", { name: "Paciente não encontrado" })).toBeVisible();
    await page.goto("/dashboard/pacientes/nao-e-uuid");
    await expect(page.getByRole("heading", { name: "Paciente não encontrado" })).toBeVisible();
  });

  test("mostra cards, tabela e dados reais do seed", async () => {
    await page.goto("/dashboard/pacientes");
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    await expect(page.getByText("Pacientes ativos")).toBeVisible();
    await expect(page.getByText("Ticket médio")).toBeVisible();
    await expect(page.getByText("Total de pacientes")).toBeVisible();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Nome" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Idade" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Plano atual" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Status" })).toBeVisible();

    const fulana = table.getByRole("row", { name: /Fulana de Tal/ });
    await expect(fulana).toContainText("Plano Trimestral");
    await expect(fulana).toContainText("Ativo");
    await expect(fulana).toContainText("R$");

    const ciclano = table.getByRole("row", { name: /Ciclano Souza/ });
    await expect(ciclano).toContainText("Inativo");
    await expect(ciclano).toContainText("Sem consulta agendada");
  });

  test("busca por nome e empty state", async () => {
    await page.goto("/dashboard/pacientes");
    await page.getByRole("searchbox").fill("fulana");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=fulana/);
    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /Fulana de Tal/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /Beltrano/ })).toHaveCount(0);

    await page.goto("/dashboard/pacientes?q=zzzz-nao-existe");
    await expect(page.getByText("Nenhum paciente encontrado.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Limpar filtros" })).toBeVisible();
  });

  test("filtros ativos/inativos", async () => {
    await page.goto("/dashboard/pacientes");
    await page.getByRole("link", { name: "Inativos" }).click();
    await expect(page).toHaveURL(/status=inactive/);
    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /Ciclano Souza/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /Sicrana Pereira/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /Fulana de Tal/ })).toHaveCount(0);

    await page.getByRole("link", { name: "Ativos", exact: true }).click();
    await expect(page).toHaveURL(/status=active/);
    await expect(table.getByRole("row", { name: /Fulana de Tal/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /Ciclano Souza/ })).toHaveCount(0);
  });

  test("mobile: cards com ações acessíveis e sem overflow horizontal", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/pacientes");
    await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.getByRole("list", { name: "Pacientes" })).toBeVisible();
    await page.getByRole("button", { name: "Ações de Fulana de Tal" }).click();
    await expect(page.getByRole("menuitem", { name: "Visualizar" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Desativar" })).toBeVisible();
    await page.keyboard.press("Escape");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

test.describe("perfil, cadastro e contratos", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsNutritionist(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("perfil de paciente do seed mostra visão geral e contratos", async () => {
    await page.goto(`/dashboard/pacientes/${FULANA_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Fulana de Tal" })).toBeVisible();
    await expect(page.getByText("Dados do paciente")).toBeVisible();
    await expect(page.getByText("34 anos")).toBeVisible();
    await expect(page.getByText("Linha do tempo")).toBeVisible();
    await expect(page.getByText("Paciente cadastrado")).toBeVisible();

    await sectionNav(page).getByRole("link", { name: "Contratos" }).click();
    await expect(page).toHaveURL(/tab=contratos/);
    await expect(page.getByRole("heading", { level: 3, name: "Plano Trimestral" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Parcela" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1/3" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3/3" })).toBeVisible();

    await sectionNav(page).getByRole("link", { name: "Consultas" }).click();
    await expect(page.getByText("Disponível em uma próxima etapa")).toBeVisible();
  });

  test("cria paciente sem convite e abre o perfil", async () => {
    await page.goto("/dashboard/pacientes/novo");
    await page.getByLabel("Nome completo").fill(NEW_PATIENT.fullName);
    await page.getByLabel("E-mail").fill(NEW_PATIENT.email);
    await page.getByLabel("Telefone").fill(NEW_PATIENT.phone);
    await page.getByLabel("Data de nascimento").fill(NEW_PATIENT.birthDate);
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();

    await expect(page).toHaveURL(/\/dashboard\/pacientes\/[0-9a-f-]{36}/);
    await expect(page.getByText("Paciente cadastrado com sucesso.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: NEW_PATIENT.fullName })).toBeVisible();
    await expect(page.getByText("Sem contrato vigente", { exact: true })).toBeVisible();
    await expect(page.getByText("Portal: Sem conta")).toBeVisible();
    await expect(page.getByText("36 anos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar convite" })).toBeVisible();
  });

  test("rejeita e-mail duplicado e valida campos", async () => {
    await page.goto("/dashboard/pacientes/novo");
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    await expect(page.getByText("Informe o nome completo do paciente.")).toBeVisible();

    await page.getByLabel("Nome completo").fill("Duplicado E2E");
    await page.getByLabel("E-mail").fill(NEW_PATIENT.email.toUpperCase());
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Já existe um paciente cadastrado com este e-mail.");
    await expect(page).toHaveURL(/\/dashboard\/pacientes\/novo/);
  });

  test("edita o paciente", async () => {
    await page.goto(`/dashboard/pacientes?q=${encodeURIComponent(NEW_PATIENT.fullName)}`);
    await page.getByRole("table").getByRole("link", { name: NEW_PATIENT.fullName }).click();
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: "Editar paciente" })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toHaveValue(NEW_PATIENT.fullName);
    await page.getByLabel("Telefone").fill("+55 11 90000-9999");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Paciente atualizado.")).toBeVisible();
    await expect(page.getByText("+55 11 90000-9999")).toBeVisible();
  });

  test("cria contrato com parcelas e vê o histórico", async () => {
    await page.goto(`/dashboard/pacientes?q=${encodeURIComponent(NEW_PATIENT.fullName)}`);
    await page.getByRole("table").getByRole("link", { name: NEW_PATIENT.fullName }).click();
    await page.getByRole("link", { name: "Novo contrato" }).first().click();
    await expect(page.getByRole("heading", { name: "Novo contrato" })).toBeVisible();

    const planSelect = page.getByLabel("Plano", { exact: true });
    const trimestral = await planSelect.locator("option", { hasText: "Plano Trimestral" }).getAttribute("value");
    await planSelect.selectOption(trimestral!);
    const priceSelect = page.getByLabel("Condição de preço");
    const parcelado = await priceSelect.locator("option", { hasText: "Parcelado 3x" }).getAttribute("value");
    await priceSelect.selectOption(parcelado!);

    await expect(page.getByLabel("Valor contratado (R$)")).toHaveValue("680,37");
    await expect(page.getByLabel("Parcelas")).toHaveValue("3");
    await page.getByLabel("Data de início").fill("2026-01-31");
    await page.getByLabel("Primeiro vencimento").fill("2026-01-31");
    await expect(page.getByLabel("Data de término")).toHaveValue("2026-04-30");
    // Pré-visualização: 31/01 -> 28/02 -> 31/03 e soma exata.
    await expect(page.getByRole("cell", { name: "28/02/2026" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "31/03/2026" })).toBeVisible();
    await page.getByLabel("Observações administrativas").fill("Contrato criado pelo E2E");
    await page.getByRole("button", { name: "Criar contrato" }).click();

    await expect(page).toHaveURL(/tab=contratos/);
    await expect(page.getByText("Contrato criado.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Plano Trimestral" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1/3" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3/3" })).toBeVisible();
    await expect(page.getByText("Contrato criado pelo E2E")).toBeVisible();
    // Header agora reflete contrato vigente.
    await expect(page.getByText("Plano Trimestral · início em 31/01/2026")).toBeVisible();
  });

  test("cancela o contrato com confirmação; parcelas preservadas", async () => {
    await page.goto(`/dashboard/pacientes?q=${encodeURIComponent(NEW_PATIENT.fullName)}`);
    await page.getByRole("table").getByRole("link", { name: NEW_PATIENT.fullName }).click();
    await sectionNav(page).getByRole("link", { name: "Contratos" }).click();
    await page.getByRole("button", { name: /Ações do contrato/ }).first().click();
    await page.getByRole("menuitem", { name: "Cancelar contrato" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Cancelar o contrato Plano Trimestral?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar contrato" }).click();
    await expect(page.getByText("Contrato cancelado.")).toBeVisible();
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cancelada" })).toHaveCount(3);
    await expect(page.getByRole("cell", { name: "1/3" })).toBeVisible();
  });

  test("desativa e reativa o paciente com confirmação", async () => {
    await page.goto(`/dashboard/pacientes?q=${encodeURIComponent(NEW_PATIENT.fullName)}`);
    await page.getByRole("table").getByRole("link", { name: NEW_PATIENT.fullName }).click();

    await page.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("nada é excluído");
    await page.getByRole("alertdialog").getByRole("button", { name: "Desativar paciente" }).click();
    await expect(page.getByText("Paciente desativado.")).toBeVisible();
    await expect(page.getByText("Inativo", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reativar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo contrato" })).toHaveCount(0);
    // Histórico preservado após desativar.
    await sectionNav(page).getByRole("link", { name: "Contratos" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Plano Trimestral" })).toBeVisible();

    await page.getByRole("button", { name: "Reativar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reativar paciente" }).click();
    await expect(page.getByText("Paciente reativado.")).toBeVisible();
    await expect(page.getByText("Sem contrato", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Desativar" })).toBeVisible();

    await sectionNav(page).getByRole("link", { name: "Visão Geral" }).click();
    await expect(page.getByText("Paciente reativado")).toBeVisible();
    await expect(page.getByText("Paciente desativado")).toBeVisible();
  });
});
