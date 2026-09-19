import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Fase 9 — avaliações/evolução ponta a ponta contra o app real + Supabase
// local com o seed (Fulana: v1 visível em 10/08 e reavaliação oculta em
// 09/09; Beltrano sem avaliação). UMA sessão de nutricionista para o bloco
// (rate limit de login). Nutricionista: abre paciente → Avaliações → cria
// (peso, composição, medidas) → histórico → edita → compara → gráfico →
// anexa relatório → remove. Paciente: vê só as liberadas, evolução, gráficos,
// histórico, relatório; não vê privada; não acessa outro. Mobile 390.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const SICRANA_ID = "90000000-0000-0000-0000-000000000012";
const FULANA_HIDDEN = "90000000-0000-0000-0000-000000000602";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 9";
const STARTED_AT = new Date().toISOString();

function spDate(offsetDays: number): string {
  const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = sp.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + offsetDays)).toISOString().slice(0, 10);
}
const br = (iso: string) => iso.split("-").reverse().join("/");

/** Abre uma seção colapsável do formulário só se ainda estiver fechada (na edição ela já vem aberta quando tem valores). */
async function ensureOpen(page: Page, name: RegExp) {
  const button = page.getByRole("button", { name });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

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

/** Remove o que este arquivo criou (Sicrana); avaliações já exibidas exigem triggers desligados. */
async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type = 'assessment'`, [STARTED_AT]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.assessment_measurements where assessment_id in (select id from public.assessments where patient_id = $1)`, [SICRANA_ID]);
    await client.query(`delete from public.assessments where patient_id = $1`, [SICRANA_ID]);
    await client.query(`set session_replication_role = origin`);
  });
}

test.beforeAll(async () => {
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
});

test.describe("nutricionista — avaliações", () => {
  let page: Page;
  let detailUrl = "";
  let pdfPath = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);
    const dir = await mkdtemp(path.join(os.tmpdir(), "em-e2e-"));
    pdfPath = path.join(dir, "relatorio-qa.pdf");
    await writeFile(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("abre o paciente, a aba Avaliações e cria a primeira avaliação", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=avaliacoes`);
    await expect(page.getByText("Nenhuma avaliação registrada.").first()).toBeVisible();
    await page.getByRole("link", { name: "Nova avaliação" }).click();
    await expect(page.getByRole("heading", { name: "Nova avaliação" })).toBeVisible();
    await page.getByLabel("Data da avaliação").fill(spDate(-30));
    await page.getByLabel(/^Peso/).fill("80");
    await page.getByLabel(/^Altura/).fill("170");
    await expect(page.getByText(/IMC \(derivado de peso e altura/)).toContainText("27,7");
    await page.getByRole("button", { name: /Composição corporal/ }).click();
    await page.getByLabel(/^Percentual de gordura/).fill("20");
    await page.getByRole("button", { name: /Medidas corporais/ }).click();
    await page.getByLabel(/^Cintura/).fill("92");
    await page.getByLabel("Nota interna (nunca visível ao paciente)").fill(`${TAG} nota interna`);
    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await expect(page.getByText("Avaliação registrada.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `Avaliação de ${br(spDate(-30))}` })).toBeVisible();
    await expect(page.getByText("Só nutricionista")).toBeVisible();
    await expect(page.getByText("80 kg")).toBeVisible();
    await expect(page.getByText("20%")).toBeVisible();
    await expect(page.getByText("92 cm")).toBeVisible();
  });

  test("valida valores técnicos e data futura sem sair do formulário", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/nova`);
    await page.getByLabel("Data da avaliação").fill(spDate(1));
    await page.getByLabel(/^Peso/).fill("0");
    await page.getByRole("button", { name: /Composição corporal/ }).click();
    await page.getByLabel(/^Percentual de gordura/).fill("101");
    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await expect(page.getByText("A data da avaliação não pode estar no futuro.")).toBeVisible();
    await expect(page.getByText("O valor precisa ser maior que zero.")).toBeVisible();
    await expect(page.getByText("Percentual não pode passar de 100.")).toBeVisible();
    await expect(page).toHaveURL(/\/avaliacoes\/nova/);
  });

  test("segunda avaliação, histórico ordenado e cards de variação", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/nova`);
    await page.getByLabel("Data da avaliação").fill(spDate(-1));
    await page.getByLabel(/^Peso/).fill("78,5");
    await page.getByRole("button", { name: /Composição corporal/ }).click();
    await page.getByLabel(/^Percentual de gordura/).fill("18");
    await page.getByLabel("Visível para o paciente").check();
    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await expect(page.getByText("Avaliação registrada.")).toBeVisible();
    detailUrl = page.url().split("?")[0]!;

    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=avaliacoes`);
    // Os gráficos têm tabelas sr-only antes do histórico: escopo na seção.
    const rows = page.locator('section[aria-labelledby="hist-avaliacoes"]').getByRole("table").getByRole("row");
    await expect(rows.nth(1)).toContainText(br(spDate(-1)));
    await expect(rows.nth(2)).toContainText(br(spDate(-30)));
    const weightCard = page.locator("[data-slot=card]").filter({ hasText: "Peso" }).first();
    await expect(weightCard).toContainText("78,5 kg");
    await expect(weightCard).toContainText("−1,5 kg");
    await expect(weightCard).toContainText("desceu");
    const fatCard = page.locator("[data-slot=card]").filter({ hasText: "Percentual de gordura" }).first();
    await expect(fatCard).toContainText("−2 p.p.");
    const waistCard = page.locator("[data-slot=card]").filter({ hasText: "Circunferência da cintura" }).first();
    await expect(waistCard).toContainText("Primeira avaliação com esta métrica");
    await expect(page.getByRole("img", { name: /Peso ao longo do tempo/ })).toBeVisible();
    await expect(page.getByRole("table").filter({ hasText: "Peso por data" })).toHaveCount(1);
  });

  test("edita a avaliação (corrige peso, remove medida) com auditoria", async () => {
    await page.goto(`${detailUrl}/editar`);
    await expect(page.getByLabel(/^Peso/)).toHaveValue("78,5");
    await page.getByLabel(/^Peso/).fill("78,45");
    await ensureOpen(page, /Composição corporal/);
    await page.getByLabel(/^Percentual de gordura/).fill("");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Avaliação atualizada.")).toBeVisible();
    await expect(page.getByText("78,45 kg")).toBeVisible();
    await expect(page.getByText("Percentual de gordura")).toHaveCount(0);
  });

  test("compara duas avaliações", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=avaliacoes`);
    await page.getByRole("link", { name: "Comparar" }).click();
    await expect(page.getByRole("heading", { name: "Comparar avaliações" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Peso" });
    await expect(row).toContainText("80 kg");
    await expect(row).toContainText("78,45 kg");
    await expect(row).toContainText("−1,55 kg");
    await expect(row).toContainText("desceu");
    await expect(page.getByRole("row").filter({ hasText: "Circunferência da cintura" })).toContainText("sem par");
  });

  test("anexa e remove o relatório de bioimpedância", async () => {
    await page.goto(detailUrl);
    await page.getByLabel(/Anexar relatório/).setInputFiles(pdfPath);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Relatório anexado.", { exact: true })).toBeVisible();
    await expect(page.getByText("relatorio-qa.pdf")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", /\/relatorio$/);
    const response = await page.request.get(`${detailUrl}/relatorio`, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toContain("/storage/v1/object/sign/");
    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remover relatório" }).click();
    await expect(page.getByText("Relatório removido.")).toBeVisible();
    await expect(page.getByText("Nenhum relatório anexado.")).toBeVisible();
    const gone = await page.request.get(`${detailUrl}/relatorio`, { maxRedirects: 0 });
    expect(gone.status()).toBe(404);
  });

  test("tipo de arquivo inválido é recusado", async () => {
    await page.goto(detailUrl);
    await page.getByLabel(/Anexar relatório/).setInputFiles({ name: "malware.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Envie um PDF ou imagem (JPG/PNG) de até 10 MB.")).toBeVisible();
  });

  test("ids adulterados caem em não encontrado", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/00000000-0000-0000-0000-000000000000`);
    await expect(page.getByRole("heading", { name: "Avaliação não encontrada" })).toBeVisible();
    // Avaliação da Fulana pela URL da Sicrana.
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/${FULANA_HIDDEN}`);
    await expect(page.getByRole("heading", { name: "Avaliação não encontrada" })).toBeVisible();
    const cross = await page.request.get(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/${FULANA_HIDDEN}/relatorio`, { maxRedirects: 0 });
    expect(cross.status()).toBe(404);
  });

  test("auditoria registrou os eventos sem valores de saúde", async () => {
    const rows = await withDb(async (client) => {
      const result = await client.query(`select action, metadata::text as meta from public.audit_logs where actor_id = $1 and created_at >= $2 and entity_type = 'assessment'`, [NUTRITIONIST.id, STARTED_AT]);
      return result.rows as { action: string; meta: string }[];
    });
    const actions = new Set(rows.map((row) => row.action));
    expect([...actions]).toEqual(expect.arrayContaining(["ASSESSMENT_CREATED", "ASSESSMENT_UPDATED", "BIOIMPEDANCE_REPORT_UPLOADED", "BIOIMPEDANCE_REPORT_REMOVED"]));
    for (const row of rows) {
      expect(row.meta).not.toMatch(/78[.,]45|"80"|nota interna|relatorio-qa|"92"/);
    }
  });

  test("mobile 390: aba e detalhe sem overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=avaliacoes`);
    await expect(page.getByRole("list", { name: "Avaliações" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.goto(detailUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});

test.describe("paciente — minha evolução", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("início mostra a última avaliação liberada e a página lista só as visíveis", async () => {
    const card = page.locator("[data-slot=card]").filter({ hasText: "Última avaliação" });
    await expect(card).toContainText("78,4 kg");
    await page.goto("/paciente/evolucao");
    await expect(page.getByRole("heading", { name: "Minha Evolução" })).toBeVisible();
    await expect(page.getByText("1 avaliação(ões)")).toBeVisible();
    await expect(page.getByRole("list", { name: "Avaliações" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("09/09/2026")).toHaveCount(0);
    await expect(page.getByText("Nota interna")).toHaveCount(0);
  });

  test("detalhe da avaliação liberada com medidas e IMC derivado; privada dá 404", async () => {
    await page.getByRole("link", { name: "Ver detalhes" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Avaliação de");
    await expect(page.getByText("78,4 kg")).toBeVisible();
    await expect(page.getByText("IMC (derivado)")).toBeVisible();
    await expect(page.getByText("Primeira avaliação disponível")).toBeVisible();
    await page.goto(`/paciente/evolucao/${FULANA_HIDDEN}`);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Avaliação de 09/09");
    const hidden = await page.request.get(`/paciente/evolucao/${FULANA_HIDDEN}/relatorio`, { maxRedirects: 0 });
    expect(hidden.status()).toBe(404);
  });

  test("não acessa avaliações de outro paciente nem o dashboard", async () => {
    await page.goto(`/dashboard/pacientes/${SICRANA_ID}?tab=avaliacoes`);
    await expect(page).not.toHaveURL(/\/dashboard\/pacientes/);
    const other = await page.request.get(`/dashboard/pacientes/${SICRANA_ID}/avaliacoes/nova`, { maxRedirects: 0 });
    expect([302, 307]).toContain(other.status());
  });

  test("mobile 390: evolução legível, sem overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/paciente/evolucao");
    await expect(page.getByRole("heading", { name: "Minha Evolução" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
});

test("paciente sem avaliação vê o empty state", async ({ page }) => {
  await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" });
  await expect(page).toHaveURL(/\/paciente$/);
  await page.goto("/paciente/evolucao");
  await expect(page.getByText("Nenhuma avaliação disponível ainda.")).toBeVisible();
});
