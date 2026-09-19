import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

// Fase 8 — cardápio ponta a ponta contra o app real + Supabase local com o
// seed (Fulana tem o cardápio v1 publicado; Sicrana não tem plano). Em
// série, UMA sessão de nutricionista para o bloco (rate limit de login —
// docs/DECISIONS.md, Fase 5). Fluxo do nutricionista: abre paciente → aba
// Cardápio → cria plano → dia → refeição → alimento → substituição →
// duplica refeição → publica → nova versão → histórico. Paciente: vê o
// publicado, troca dia, abre substituições, não vê rascunho, não acessa o
// plano de outro. Mobile 390.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const SICRANA_ID = "90000000-0000-0000-0000-000000000012";
const FULANA_PUBLISHED_VERSION = "90000000-0000-0000-0000-000000000510";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 8";
const STARTED_AT = new Date().toISOString();

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

/** Remove planos criados por este arquivo (Sicrana) e rascunhos novos da Fulana; versões imutáveis exigem triggers desligados. */
async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('meal_plan','meal_plan_version')`, [STARTED_AT]);
    await client.query(`set session_replication_role = replica`);
    await client.query(
      `with plans as (select id from public.meal_plans where patient_id = $1 and title like $2),
            versions as (select id from public.meal_plan_versions where meal_plan_id in (select id from plans)),
            days as (select id from public.meal_plan_days where version_id in (select id from versions)),
            ms as (select id from public.meals where day_id in (select id from days)),
            items as (select id from public.meal_items where meal_id in (select id from ms)),
            d1 as (delete from public.meal_substitutions where meal_item_id in (select id from items)),
            d2 as (delete from public.meal_items where id in (select id from items)),
            d3 as (delete from public.meals where id in (select id from ms)),
            d4 as (delete from public.meal_plan_days where id in (select id from days)),
            d5 as (delete from public.meal_plan_versions where id in (select id from versions))
       delete from public.meal_plans where id in (select id from plans)`,
      [SICRANA_ID, `${TAG}%`],
    );
    // Rascunhos extras no cardápio da Fulana (deixados por QA visual local): o seed só tem a v1.
    await client.query(
      `with versions as (select id from public.meal_plan_versions where meal_plan_id = '90000000-0000-0000-0000-000000000501' and version_number > 1),
            days as (select id from public.meal_plan_days where version_id in (select id from versions)),
            ms as (select id from public.meals where day_id in (select id from days)),
            items as (select id from public.meal_items where meal_id in (select id from ms)),
            d1 as (delete from public.meal_substitutions where meal_item_id in (select id from items)),
            d2 as (delete from public.meal_items where id in (select id from items)),
            d3 as (delete from public.meals where id in (select id from ms)),
            d4 as (delete from public.meal_plan_days where id in (select id from days))
       delete from public.meal_plan_versions where id in (select id from versions)`,
    );
    await client.query(`set session_replication_role = origin`);
  });
}

test.beforeAll(async () => {
  await cleanup();
});

test.afterAll(async () => {
  await cleanup();
});

test.describe("nutricionista — cardápio", () => {
  let page: Page;
  let editorUrl = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("abre o paciente, a aba Cardápio e cria o plano", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=cardapio`);
    await expect(page.getByText("Nenhum plano alimentar ativo.")).toBeVisible();
    await page.getByRole("link", { name: "Criar plano alimentar" }).click();
    await expect(page.getByRole("heading", { name: "Novo plano alimentar" })).toBeVisible();
    await page.getByLabel("Nome do plano").fill(`${TAG} — plano da Sicrana`);
    await page.getByLabel("Observação geral (opcional)").fill("Beber água ao longo do dia.");
    await page.getByRole("button", { name: "Criar plano" }).click();
    await expect(page.getByText("Plano criado.")).toBeVisible();
    await expect(page).toHaveURL(/\/cardapio\/[0-9a-f-]{36}/);
    await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
    editorUrl = page.url().split("?")[0]!;
  });

  test("adiciona dia, refeição, alimento e substituição", async () => {
    await expect(page.getByText("Adicione o primeiro dia da semana")).toBeVisible();
    await page.getByLabel("Adicionar dia").selectOption("1");
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Segunda-feira" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Este dia ainda não possui refeições.")).toBeVisible();

    await page.getByRole("button", { name: "Adicionar a primeira refeição" }).click();
    await page.getByLabel("Nome da refeição").fill("Café da manhã");
    await page.getByLabel("Horário (opcional)").fill("07:30");
    await page.getByRole("button", { name: "Adicionar refeição" }).click();
    await expect(page.getByText("Refeição adicionada.")).toBeVisible();
    await expect(page.getByText("Esta refeição ainda não possui alimentos.")).toBeVisible();

    await page.getByRole("button", { name: "Adicionar alimento" }).click();
    await page.getByRole("textbox", { name: "Alimento", exact: true }).fill("Ovos mexidos");
    await page.getByLabel("Quantidade").fill("2");
    await page.getByLabel("Unidade").selectOption("unidade");
    await page.getByRole("button", { name: "Adicionar alimento" }).last().click();
    await expect(page.getByText("Alimento adicionado.")).toBeVisible();
    await expect(page.getByText("2 unidades")).toBeVisible();

    await page.getByRole("button", { name: "Substituição" }).click();
    await page.getByLabel("Alimento substituto").fill("Iogurte natural");
    await page.getByLabel("Quantidade").last().fill("170");
    await page.getByLabel("Unidade").last().selectOption("g");
    await page.getByRole("button", { name: "Adicionar substituição" }).click();
    await expect(page.getByText("Substituição adicionada.")).toBeVisible();
    await expect(page.getByText("Iogurte natural")).toBeVisible();
  });

  test("valida quantidade inválida sem sair do formulário", async () => {
    await page.getByRole("button", { name: "Adicionar alimento" }).click();
    await page.getByRole("textbox", { name: "Alimento", exact: true }).fill("Pão");
    await page.getByLabel("Quantidade").fill("0");
    await page.getByRole("button", { name: "Adicionar alimento" }).last().click();
    await expect(page.getByText("Informe a quantidade (ex.: 100 ou 1,5).")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  test("duplica a refeição (ids novos, mesmo conteúdo) e move a ordem", async () => {
    await page.getByRole("button", { name: "Duplicar refeição Café da manhã" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Duplicar" }).click();
    await expect(page.getByText("Refeição duplicada.")).toBeVisible();
    const meals = page.getByRole("list", { name: "Refeições de Segunda-feira" }).getByRole("listitem").filter({ hasText: "Café da manhã" });
    await expect(meals).toHaveCount(2);
    await expect(page.getByText("Iogurte natural")).toHaveCount(2);
    await page.getByRole("button", { name: "Subir refeição Café da manhã" }).last().click();
    await expect(page.getByText("Ordem atualizada.")).toBeVisible();
  });

  test("duplica o dia para terça e a aba aparece", async () => {
    await page.getByRole("button", { name: "Duplicar dia" }).click();
    await page.getByLabel("Dia de destino").selectOption("2");
    await page.getByRole("alertdialog").getByRole("button", { name: "Duplicar" }).click();
    await expect(page.getByText("Dia copiado para terça-feira.")).toBeVisible();
    await page.getByRole("tab", { name: "Terça-feira" }).click();
    await expect(page.getByRole("heading", { name: "Terça-feira" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Refeições de Terça-feira" }).getByRole("listitem").filter({ hasText: "Café da manhã" })).toHaveCount(2);
  });

  test("publica a v1 e o histórico mostra a versão publicada", async () => {
    await page.getByRole("button", { name: "Publicar versão 1" }).click();
    await expect(page.getByText("Plano publicado.")).toBeVisible();
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=cardapio`);
    const row = page.getByRole("row").filter({ hasText: "v1" });
    await expect(row).toContainText("Publicado");
    await expect(page.getByRole("link", { name: "Ver versão publicada (v1)" })).toBeVisible();
  });

  test("cria nova versão (v2 rascunho, v1 continua publicada), edita e publica; v1 vira histórico", async () => {
    await page.getByRole("button", { name: "Criar nova versão" }).click();
    await expect(page.getByText("Nova versão criada.")).toBeVisible();
    await expect(page).toHaveURL(/\/cardapio\/[0-9a-f-]{36}$/);
    await expect(page.getByText("v2", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Segunda-feira" })).toBeVisible();

    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=cardapio`);
    await expect(page.getByRole("row").filter({ hasText: "v2" })).toContainText("Rascunho");
    await expect(page.getByRole("row").filter({ hasText: "v1" })).toContainText("Publicado");

    await page.getByRole("button", { name: "Publicar versão 2" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("A versão 1 deixa de ser a atual");
    await page.getByRole("alertdialog").getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Plano publicado.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "v2" })).toContainText("Publicado");
    await expect(page.getByRole("row").filter({ hasText: "v1" })).toContainText("Arquivado");

    await page.getByRole("row").filter({ hasText: "v1" }).getByRole("link", { name: "Visualizar" }).click();
    await expect(page.getByText("Versão arquivada — histórico somente leitura.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Segunda-feira" })).toBeVisible();
  });

  test("versão publicada é somente leitura e orienta a criar nova versão", async () => {
    await page.goto(`/dashboard/pacientes/${PATIENT.patientId}/cardapio/${FULANA_PUBLISHED_VERSION}`);
    await expect(page.getByText("Esta é a versão que o paciente vê no portal.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar alimento" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Criar nova versão" })).toBeVisible();
  });

  test("ids adulterados caem em não encontrado, sem vazar", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/cardapio/00000000-0000-0000-0000-000000000000`);
    await expect(page.getByRole("heading", { name: "Plano alimentar não encontrado" })).toBeVisible();
    // Versão da Fulana pela URL da Sicrana: não é do paciente da rota.
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/cardapio/${FULANA_PUBLISHED_VERSION}`);
    await expect(page.getByRole("heading", { name: "Plano alimentar não encontrado" })).toBeVisible();
  });

  test("auditoria registrou os eventos do cardápio", async () => {
    await withDb(async (client) => {
      const result = await client.query(
        `select distinct action from public.audit_logs where actor_id = $1 and created_at >= $2 and action like 'MEAL_%' order by action`,
        [NUTRITIONIST.id, STARTED_AT],
      );
      const actions = result.rows.map((row) => row.action);
      expect(actions).toEqual(expect.arrayContaining(["MEAL_PLAN_CREATED", "MEAL_PLAN_UPDATED", "MEAL_PLAN_VERSION_CREATED", "MEAL_PLAN_VERSION_PUBLISHED", "MEAL_DUPLICATED", "MEAL_PLAN_DAY_DUPLICATED"]));
      const leaked = await client.query(`select count(*)::int as n from public.audit_logs where created_at >= $1 and metadata::text ilike '%Ovos mexidos%'`, [STARTED_AT]);
      expect(leaked.rows[0].n).toBe(0);
    });
  });

  test("mobile 390: editor navegável sem overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(editorUrl.replace(/[0-9a-f-]{36}$/, "") + (await latestDraftOrPublished()));
    await expect(page.getByRole("tab", { name: /Seg/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  async function latestDraftOrPublished(): Promise<string> {
    let id = "";
    await withDb(async (client) => {
      const result = await client.query(
        `select v.id from public.meal_plan_versions v join public.meal_plans p on p.id = v.meal_plan_id where p.patient_id = $1 and p.archived_at is null order by v.version_number desc limit 1`,
        [SICRANA_ID],
      );
      id = result.rows[0]?.id ?? "";
    });
    return id;
  }
});

test.describe("paciente — meu cardápio", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("início mostra o cardápio do dia e a página mostra o plano publicado", async () => {
    await expect(page.getByText("Cardápio do dia")).toBeVisible();
    await page.goto("/paciente/cardapio");
    await expect(page.getByRole("heading", { name: "Meu Cardápio" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Seg/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Qua/ })).toBeVisible();
  });

  test("troca de dia e abre substituições", async () => {
    await page.getByRole("tab", { name: /Qua/ }).click();
    await expect(page.getByRole("heading", { name: "Quarta-feira" })).toBeVisible();
    await expect(page.getByText("Salmão grelhado")).toBeVisible();
    await page.getByRole("button", { name: /Ver substituições/ }).click();
    await expect(page.getByText("Tilápia grelhada")).toBeVisible();
    await expect(page.getByText("No lugar de Salmão grelhado")).toBeVisible();
  });

  test("não vê rascunho: mudanças só aparecem depois de publicadas", async () => {
    // O seed tem só a v1 publicada; nenhum texto de rascunho existe no portal.
    await expect(page.getByText("Rascunho")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Publicar/ })).toHaveCount(0);
  });

  test("não acessa o editor do dashboard nem a versão de outro paciente", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=cardapio`);
    await expect(page).not.toHaveURL(/\/dashboard\/pacientes/);
    await page.goto("/dashboard/cardapios");
    await expect(page).not.toHaveURL(/\/dashboard\/cardapios/);
  });

  test("mobile 390: cardápio legível, dias navegáveis, substituições acessíveis", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/paciente/cardapio");
    await expect(page.getByRole("tab", { name: "Seg" })).toBeVisible();
    await page.getByRole("tab", { name: "Sex" }).click();
    await expect(page.getByRole("heading", { name: "Sexta-feira" })).toBeVisible();
    await expect(page.getByText("300 ml")).toBeVisible();
    await page.getByRole("tab", { name: "Seg" }).click();
    await page.getByRole("button", { name: /Ver substituições/ }).click();
    await expect(page.getByText("Peixe grelhado")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

test("paciente sem plano vê o empty state", async ({ page }) => {
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" });
  await expect(page).toHaveURL(/\/paciente$/);
  await page.goto("/paciente/cardapio");
  await expect(page.getByText("Seu plano alimentar ainda não foi publicado.")).toBeVisible();
});
