import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Fase 10 — suplementos, feedbacks e materiais ponta a ponta contra o app
// real + Supabase local com o seed (Fulana: Whey ativo, Creatina encerrada,
// 1 feedback disponibilizado + 1 rascunho, 1 material de link atribuído).
// Nutricionista e paciente rodam em CONTEXTOS separados (sessões
// independentes) para alternar ações e verificações: cria → paciente não
// vê / vê → edita → arquiva/remove → paciente perde. Mobile 390.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const FULANA_ID = PATIENT.patientId;
const BELTRANO_ID = "90000000-0000-0000-0000-000000000011";
const SEED_UNASSIGNED_MATERIAL = "90000000-0000-0000-0000-000000000822";
const SEED_DRAFT_FEEDBACK = "90000000-0000-0000-0000-000000000812";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 10";
const STARTED_AT = new Date().toISOString();

const SUPPLEMENT_NAME = `${TAG} Vitamina D`;
const FEEDBACK_TITLE = `${TAG} retorno da semana`;
const FEEDBACK_CONTENT = `${TAG}: você manteve a constância nas refeições principais. Vamos ajustar os lanches na próxima consulta.`;
const MATERIAL_TITLE = `${TAG} guia em PDF`;

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Remove o que este arquivo criou (triggers desligados para o histórico arquivado). */
async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('supplement_recommendation', 'feedback_message', 'patient_material', 'material_assignment')`, [STARTED_AT]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.supplement_recommendations where name like $1`, [`${TAG}%`]);
    await client.query(`delete from public.feedback_messages where title like $1`, [`${TAG}%`]);
    await client.query(`delete from public.material_assignments where material_id in (select id from public.patient_materials where title like $1)`, [`${TAG}%`]);
    await client.query(`delete from public.patient_materials where title like $1`, [`${TAG}%`]);
    await client.query(`set session_replication_role = origin`);
  });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

let nutriContext: BrowserContext;
let patientContext: BrowserContext;
let nutri: Page;
let patient: Page;
let pdfPath = "";
let materialUrl = "";

async function openContexts(browser: Browser) {
  nutriContext = await browser.newContext();
  patientContext = await browser.newContext();
  nutri = await nutriContext.newPage();
  patient = await patientContext.newPage();
  await login(nutri, NUTRITIONIST);
  await expect(nutri).toHaveURL(/\/dashboard$/);
  await login(patient, PATIENT);
  await expect(patient).toHaveURL(/\/paciente$/);
  const dir = await mkdtemp(path.join(os.tmpdir(), "em-e2e-f10-"));
  pdfPath = path.join(dir, "guia-qa.pdf");
  await writeFile(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

test.beforeAll(async ({ browser }) => {
  await cleanup();
  await openContexts(browser);
});

test.afterAll(async () => {
  await nutriContext?.close();
  await patientContext?.close();
  await cleanup();
});

test.describe("suplementos", () => {
  test("nutricionista cria uma recomendação com link de compra", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=suplementos`);
    await expect(nutri.getByRole("heading", { name: "Suplementos" })).toBeVisible();
    await expect(nutri.getByText("Whey Protein", { exact: true }).first()).toBeVisible();
    await nutri.getByRole("link", { name: "Nova recomendação" }).click();
    await expect(nutri.getByRole("heading", { name: "Nova recomendação de suplemento" })).toBeVisible();
    await nutri.getByLabel("Nome do suplemento").fill(SUPPLEMENT_NAME);
    await nutri.getByLabel("Dose / quantidade (opcional)").fill("2000 UI");
    await nutri.getByLabel("Frequência / momento (opcional)").fill("1x ao dia, no almoço");
    await nutri.getByLabel("Orientação", { exact: true }).fill("Tomar junto com uma refeição que contenha gordura.");
    await nutri.getByLabel("Link de compra (opcional)").fill("https://example.com/vitamina-d-e2e");
    await nutri.getByRole("button", { name: "Salvar recomendação" }).click();
    await expect(nutri.getByText("Recomendação criada.")).toBeVisible();
    const row = nutri.getByRole("row").filter({ hasText: SUPPLEMENT_NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText("Ativa")).toBeVisible();
    const link = row.getByRole("link", { name: /Ver produto/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", "https://example.com/vitamina-d-e2e");
  });

  test("link malicioso é recusado sem sair do formulário", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}/suplementos/novo`);
    await nutri.getByLabel("Nome do suplemento").fill(`${TAG} inválido`);
    await nutri.getByLabel("Link de compra (opcional)").fill("javascript:alert(1)");
    await nutri.getByRole("button", { name: "Salvar recomendação" }).click();
    await expect(nutri.getByText("Só links http:// ou https:// são aceitos.")).toBeVisible();
    await nutri.getByLabel("Link de compra (opcional)").fill("//evil.example");
    await nutri.getByRole("button", { name: "Salvar recomendação" }).click();
    await expect(nutri.getByText("Só links http:// ou https:// são aceitos.")).toBeVisible();
    await expect(nutri).toHaveURL(/\/suplementos\/novo$/);
  });

  test("paciente vê a recomendação ativa com link seguro e não vê a encerrada", async () => {
    await patient.goto("/paciente/suplementos");
    await expect(patient.getByRole("heading", { name: "Suplementos" })).toBeVisible();
    const list = patient.getByRole("list", { name: "Recomendações ativas" });
    await expect(list.getByRole("heading", { name: SUPPLEMENT_NAME })).toBeVisible();
    await expect(list.getByRole("heading", { name: "Whey Protein" })).toBeVisible();
    await expect(patient.getByText("Creatina")).toHaveCount(0);
    await expect(patient.getByText("2000 UI")).toBeVisible();
    const link = list.getByRole("listitem").filter({ hasText: SUPPLEMENT_NAME }).getByRole("link", { name: /Ver produto/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await patient.goto("/paciente");
    await expect(patient.locator("[data-slot=card]").filter({ hasText: "Suplementos ativos" })).toContainText(SUPPLEMENT_NAME);
  });

  test("nutricionista edita, encerra, reativa e arquiva", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=suplementos`);
    const row = () => nutri.getByRole("row").filter({ hasText: SUPPLEMENT_NAME });
    await row().getByRole("button", { name: `Ações de ${SUPPLEMENT_NAME}` }).click();
    await nutri.getByRole("menuitem", { name: "Editar" }).click();
    await expect(nutri.getByRole("heading", { name: "Editar recomendação" })).toBeVisible();
    await nutri.getByLabel("Dose / quantidade (opcional)").fill("1000 UI");
    await nutri.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(nutri.getByText("Recomendação atualizada.")).toBeVisible();
    await expect(row()).toContainText("1000 UI");

    await row().getByRole("button", { name: `Ações de ${SUPPLEMENT_NAME}` }).click();
    await nutri.getByRole("menuitem", { name: "Encerrar recomendação" }).click();
    await nutri.getByRole("button", { name: "Encerrar" }).click();
    await expect(nutri.getByText("Recomendação encerrada.")).toBeVisible();
    await expect(row().getByText("Encerrada")).toBeVisible();

    await patient.goto("/paciente/suplementos");
    await expect(patient.getByText(SUPPLEMENT_NAME)).toHaveCount(0);

    await row().getByRole("button", { name: `Ações de ${SUPPLEMENT_NAME}` }).click();
    await nutri.getByRole("menuitem", { name: "Reativar" }).click();
    await expect(nutri.getByText("Recomendação reativada.")).toBeVisible();
    await expect(row().getByText("Ativa")).toBeVisible();

    await row().getByRole("button", { name: `Ações de ${SUPPLEMENT_NAME}` }).click();
    await nutri.getByRole("menuitem", { name: "Arquivar" }).click();
    await nutri.getByRole("button", { name: "Arquivar" }).click();
    await expect(nutri.getByText("Recomendação arquivada.")).toBeVisible();
    await expect(row().getByText("Arquivada")).toBeVisible();
    await expect(row().getByRole("button", { name: `Ações de ${SUPPLEMENT_NAME}` })).toHaveCount(0);

    await patient.goto("/paciente/suplementos");
    await expect(patient.getByText(SUPPLEMENT_NAME)).toHaveCount(0);
    await expect(patient.getByRole("heading", { name: "Whey Protein" })).toBeVisible();
  });
});

test.describe("feedbacks", () => {
  test("nutricionista salva um rascunho; paciente não vê rascunhos", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=feedbacks`);
    await expect(nutri.getByRole("heading", { name: "Feedbacks" })).toBeVisible();
    await expect(nutri.getByRole("link", { name: "Duas semanas de acompanhamento" })).toBeVisible();
    await nutri.getByRole("link", { name: "Novo feedback" }).click();
    await nutri.getByLabel("Título (opcional)").fill(FEEDBACK_TITLE);
    await nutri.getByLabel("Mensagem").fill(FEEDBACK_CONTENT);
    await nutri.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(nutri.getByText("Feedback salvo como rascunho.")).toBeVisible();
    const row = nutri.getByRole("row").filter({ hasText: FEEDBACK_TITLE });
    await expect(row.getByText("Rascunho")).toBeVisible();

    await patient.goto("/paciente/feedbacks");
    await expect(patient.getByRole("heading", { name: "Feedbacks" })).toBeVisible();
    await expect(patient.getByText(FEEDBACK_TITLE)).toHaveCount(0);
    await expect(patient.getByText("Rascunho fictício")).toHaveCount(0);
    await expect(patient.getByRole("heading", { name: "Duas semanas de acompanhamento" })).toBeVisible();
    await expect(patient.getByText("Seu nutricionista").first()).toBeVisible();
  });

  test("disponibilizar torna o feedback visível; a home mostra o último", async () => {
    const row = nutri.getByRole("row").filter({ hasText: FEEDBACK_TITLE });
    await row.getByRole("button", { name: `Ações de ${FEEDBACK_TITLE}` }).click();
    await nutri.getByRole("menuitem", { name: "Disponibilizar ao paciente" }).click();
    await nutri.getByRole("button", { name: "Disponibilizar" }).click();
    await expect(nutri.getByText("Feedback disponibilizado.")).toBeVisible();
    await expect(row.getByText("Disponibilizado")).toBeVisible();

    await patient.goto("/paciente/feedbacks");
    const card = patient.getByRole("list", { name: "Feedbacks recebidos" }).getByRole("listitem").filter({ hasText: FEEDBACK_TITLE });
    await expect(card).toBeVisible();
    await expect(card).toContainText("constância nas refeições principais");
    await patient.goto("/paciente");
    await expect(patient.locator("[data-slot=card]").filter({ hasText: "Último feedback" })).toContainText(FEEDBACK_TITLE);
    await expect(patient.getByRole("link", { name: "Ver feedbacks" })).toBeVisible();
  });

  test("edição de feedback já visível é auditada e aparece no portal; arquivar oculta", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=feedbacks`);
    await nutri.getByRole("row").filter({ hasText: FEEDBACK_TITLE }).getByRole("link", { name: FEEDBACK_TITLE }).click();
    await expect(nutri.getByRole("heading", { level: 1, name: FEEDBACK_TITLE })).toBeVisible();
    await expect(nutri.getByRole("button", { name: "Disponibilizar ao paciente" })).toHaveCount(0);
    await nutri.getByLabel("Mensagem").fill(`${FEEDBACK_CONTENT} Complemento após revisão.`);
    await nutri.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(nutri.getByText("Feedback atualizado.")).toBeVisible();

    await patient.goto("/paciente/feedbacks");
    await expect(patient.getByText("Complemento após revisão.")).toBeVisible();

    const row = nutri.getByRole("row").filter({ hasText: FEEDBACK_TITLE });
    await row.getByRole("button", { name: `Ações de ${FEEDBACK_TITLE}` }).click();
    await nutri.getByRole("menuitem", { name: "Arquivar" }).click();
    await nutri.getByRole("button", { name: "Arquivar" }).click();
    await expect(nutri.getByText("Feedback arquivado.")).toBeVisible();
    await expect(row.getByText("Arquivado")).toBeVisible();

    await patient.goto("/paciente/feedbacks");
    await expect(patient.getByText(FEEDBACK_TITLE)).toHaveCount(0);
  });

  test("rascunho do seed nunca chega ao portal, nem por URL", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}/feedbacks/${SEED_DRAFT_FEEDBACK}/editar`);
    await expect(nutri.getByText("Rascunho: só você vê.")).toBeVisible();
    await nutri.goto(`/dashboard/pacientes/${BELTRANO_ID}/feedbacks/${SEED_DRAFT_FEEDBACK}/editar`);
    await expect(nutri.getByRole("heading", { level: 1 })).not.toContainText("Feedback de");
  });
});

test.describe("materiais", () => {
  test("nutricionista cria um material em PDF e atribui à paciente", async () => {
    await nutri.goto("/dashboard/materiais");
    await expect(nutri.getByRole("heading", { name: "Materiais" })).toBeVisible();
    await expect(nutri.getByRole("link", { name: "Exemplo: guia de hidratação (link fictício)" }).first()).toBeVisible();
    await nutri.getByRole("link", { name: "Novo material" }).click();
    await nutri.getByLabel("Título").fill(MATERIAL_TITLE);
    await nutri.getByLabel("Descrição (opcional)").fill("Material fictício de QA.");
    await nutri.getByLabel(/^Arquivo \(PDF/).setInputFiles(pdfPath);
    await nutri.getByRole("button", { name: "Criar material" }).click();
    await nutri.waitForURL(/\/dashboard\/materiais\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(nutri.getByText("Material criado.")).toBeVisible({ timeout: 10_000 });
    await expect(nutri.getByRole("heading", { level: 1, name: MATERIAL_TITLE })).toBeVisible();
    await expect(nutri.getByText("guia-qa.pdf")).toBeVisible();
    materialUrl = nutri.url().split("?")[0]!;

    await nutri.getByRole("combobox").fill("Fulana");
    await nutri.getByRole("option").filter({ hasText: "Fulana de Tal" }).getByRole("button").click();
    await nutri.getByRole("button", { name: "Atribuir material" }).click();
    await expect(nutri.getByText("Material atribuído a Fulana de Tal.")).toBeVisible();
    await expect(nutri.getByRole("row").filter({ hasText: "Fulana de Tal" })).toContainText("Disponível");
  });

  test("tipo de arquivo inválido é recusado", async () => {
    await nutri.goto("/dashboard/materiais/novo");
    await nutri.getByLabel("Título").fill(`${TAG} inválido`);
    await nutri.getByLabel(/^Arquivo \(PDF/).setInputFiles({ name: "malicioso.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ este nao e um pdf") });
    await nutri.getByRole("button", { name: "Criar material" }).click();
    await expect(nutri.getByText("Envie um PDF ou imagem (JPG/PNG) de até 10 MB.")).toBeVisible();
    await expect(nutri).toHaveURL(/\/materiais\/novo$/);
  });

  test("paciente vê e baixa o material atribuído; abre link externo com segurança", async () => {
    await patient.goto("/paciente/materiais");
    await expect(patient.getByRole("heading", { name: "Materiais" })).toBeVisible();
    const list = patient.getByRole("list", { name: "Materiais disponíveis" });
    const card = list.getByRole("listitem").filter({ hasText: MATERIAL_TITLE });
    await expect(card).toBeVisible();
    await expect(card.getByText("PDF", { exact: true })).toBeVisible();
    const seedCard = list.getByRole("listitem").filter({ hasText: "Exemplo: guia de hidratação" });
    const open = seedCard.getByRole("link", { name: /Abrir/ });
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    await expect(patient.getByText("lista de compras (link fictício)")).toHaveCount(0);

    const href = await card.getByRole("link", { name: /Baixar/ }).getAttribute("href");
    expect(href).toMatch(/\/paciente\/materiais\/[0-9a-f-]{36}\/arquivo$/);
    const redirect = await patient.request.get(href!, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()["cache-control"]).toContain("no-store");
    const file = await patient.request.get(redirect.headers().location!);
    expect(file.status()).toBe(200);
    expect((await file.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const unassigned = await patient.request.get(`/paciente/materiais/${SEED_UNASSIGNED_MATERIAL}/arquivo`, { maxRedirects: 0 });
    expect(unassigned.status()).toBe(404);
    await patient.goto("/paciente");
    await expect(patient.locator("[data-slot=card]").filter({ hasText: "Materiais recentes" })).toContainText(MATERIAL_TITLE);
  });

  test("remover a atribuição pelo perfil tira o acesso do paciente", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=materiais`);
    await expect(nutri.getByRole("heading", { name: "Materiais" })).toBeVisible();
    const row = nutri.getByRole("row").filter({ hasText: MATERIAL_TITLE });
    await expect(row.getByText("Disponível ao paciente")).toBeVisible();
    await row.getByRole("button", { name: /Remover atribuição/ }).click();
    await nutri.getByRole("button", { name: "Remover acesso" }).click();
    await expect(nutri.getByText("Atribuição removida.")).toBeVisible();
    await expect(row.getByText("Acesso removido")).toBeVisible();

    await patient.goto("/paciente/materiais");
    await expect(patient.getByText(MATERIAL_TITLE)).toHaveCount(0);
    const materialId = materialUrl.split("/").pop()!;
    const denied = await patient.request.get(`/paciente/materiais/${materialId}/arquivo`, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
  });

  test("reatribuir pela biblioteca do perfil e arquivar o material", async () => {
    await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=materiais`);
    await nutri.getByLabel("Material da biblioteca").selectOption({ label: `${MATERIAL_TITLE} (PDF)` });
    await nutri.getByRole("button", { name: "Atribuir", exact: true }).click();
    await expect(nutri.getByText(`Material atribuído: ${MATERIAL_TITLE}`)).toBeVisible();
    await expect(nutri.getByRole("row").filter({ hasText: MATERIAL_TITLE }).getByText("Disponível ao paciente")).toBeVisible();
    await patient.goto("/paciente/materiais");
    await expect(patient.getByText(MATERIAL_TITLE)).toBeVisible();

    await nutri.goto(materialUrl);
    await nutri.getByRole("button", { name: "Arquivar" }).click();
    await nutri.getByRole("alertdialog").getByRole("button", { name: "Arquivar" }).click();
    await expect(nutri.getByText("Material arquivado.")).toBeVisible();
    await expect(nutri.getByText("Material arquivado: não pode ser atribuído.")).toBeVisible();
    await patient.goto("/paciente/materiais");
    await expect(patient.getByText(MATERIAL_TITLE)).toHaveCount(0);
  });
});

test.describe("segurança, auditoria e mobile", () => {
  test("ids adulterados caem em não encontrado", async () => {
    await nutri.goto(`/dashboard/pacientes/${BELTRANO_ID}/suplementos/00000000-0000-0000-0000-000000000000/editar`);
    await expect(nutri.getByRole("heading", { level: 1 })).not.toContainText("Editar recomendação");
    const cross = await nutri.request.get(`/dashboard/materiais/00000000-0000-0000-0000-000000000000/arquivo`, { maxRedirects: 0 });
    expect(cross.status()).toBe(404);
    await patient.goto("/dashboard/materiais");
    await expect(patient).not.toHaveURL(/\/dashboard/);
  });

  test("auditoria registrou os eventos sem conteúdo clínico", async () => {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `select action, metadata::text as meta from public.audit_logs where actor_id = $1 and created_at >= $2 and entity_type in ('supplement_recommendation', 'feedback_message', 'patient_material', 'material_assignment')`,
        [NUTRITIONIST.id, STARTED_AT],
      );
      return result.rows as { action: string; meta: string }[];
    });
    const actions = new Set(rows.map((row) => row.action));
    expect([...actions]).toEqual(
      expect.arrayContaining([
        "SUPPLEMENT_RECOMMENDATION_CREATED",
        "SUPPLEMENT_RECOMMENDATION_UPDATED",
        "SUPPLEMENT_RECOMMENDATION_DEACTIVATED",
        "SUPPLEMENT_RECOMMENDATION_REACTIVATED",
        "SUPPLEMENT_RECOMMENDATION_ARCHIVED",
        "FEEDBACK_CREATED",
        "FEEDBACK_PUBLISHED",
        "FEEDBACK_UPDATED",
        "FEEDBACK_ARCHIVED",
        "MATERIAL_CREATED",
        "MATERIAL_FILE_UPLOADED",
        "MATERIAL_ASSIGNED",
        "MATERIAL_UNASSIGNED",
        "MATERIAL_ARCHIVED",
      ]),
    );
    for (const row of rows) {
      expect(row.meta).not.toMatch(/Vitamina D|2000 UI|1000 UI|constância|Complemento|guia-qa|guia em PDF|example\.com/i);
    }
  });

  test("mobile 390: portal e abas do dashboard sem overflow", async () => {
    await patient.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/paciente", "/paciente/suplementos", "/paciente/feedbacks", "/paciente/materiais"]) {
      await patient.goto(url);
      await expect(patient.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(patient);
    }
    await nutri.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["suplementos", "feedbacks", "materiais"]) {
      await nutri.goto(`/dashboard/pacientes/${FULANA_ID}?tab=${tab}`);
      await expect(nutri.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(nutri);
    }
    await nutri.goto("/dashboard/materiais");
    await noHorizontalOverflow(nutri);
  });
});

test("paciente sem conteúdo vê os empty states", async ({ page }) => {
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" });
  await expect(page).toHaveURL(/\/paciente$/);
  await page.goto("/paciente/suplementos");
  await expect(page.getByText("Você não possui recomendações de suplementos no momento.")).toBeVisible();
  await page.goto("/paciente/feedbacks");
  await expect(page.getByText("Nenhum feedback disponível ainda.")).toBeVisible();
  await page.goto("/paciente/materiais");
  await expect(page.getByText("Você ainda não possui materiais disponíveis.")).toBeVisible();
});
