import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Fase 11 — foto da refeição + análise por IA ponta a ponta contra o app
// real + Supabase local com o provider FAKE (determinístico, sem rede).
// Paciente (Fulana) e nutricionista em contextos separados: consentimento →
// nova refeição → preview → analisar → revisar (corrige, adiciona, remove)
// → confirmar → histórico → detalhe → nutricionista vê foto, original e
// correções → falha de provider com "Tentar novamente" → arquivar. Mobile 390.
// Fixtures são imagens sintéticas geradas aqui (nunca foto real, §98).
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", profileId: "90000000-0000-0000-0000-000000000101", patientId: "90000000-0000-0000-0000-000000000010" };
const BELTRANO_ID = "90000000-0000-0000-0000-000000000011";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const STARTED_AT = new Date().toISOString();

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

/** Remove análises/consentimentos da Fulana criados aqui (triggers desligados para o histórico). */
async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('food_photo_analysis', 'patient_consent')`, [STARTED_AT]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.food_photo_analyses where patient_id = $1`, [PATIENT.patientId]);
    await client.query(`delete from public.patient_consents where patient_id = $1`, [PATIENT.patientId]);
    await client.query(`set session_replication_role = origin`);
  });
}

/** Imagem sintética: fundo colorido com um bloco no meio (só para o QA; o fake escolhe o prato pelos bytes). */
async function fixture(name: string, width: number, height: number, color: { r: number; g: number; b: number }): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "em-e2e-f11-"));
  const file = path.join(dir, name);
  const png = await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
  await writeFile(file, png);
  return file;
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

let patientContext: BrowserContext;
let nutriContext: BrowserContext;
let patient: Page;
let nutri: Page;
let mealPhoto = "";
let brokenPhoto = "";
let mealUrl = "";
let mealId = "";

async function openContexts(browser: Browser) {
  patientContext = await browser.newContext();
  nutriContext = await browser.newContext();
  patient = await patientContext.newPage();
  nutri = await nutriContext.newPage();
  await login(patient, PATIENT);
  await expect(patient).toHaveURL(/\/paciente$/);
  await login(nutri, NUTRITIONIST);
  await expect(nutri).toHaveURL(/\/dashboard$/);
  mealPhoto = await fixture("prato-qa.png", 640, 480, { r: 210, g: 160, b: 90 });
  // 5×1 px = cenário "ERROR" do provider fake (§88–§89).
  brokenPhoto = await fixture("erro-qa.png", 5, 1, { r: 10, g: 10, b: 10 });
}

test.beforeAll(async ({ browser }) => {
  await cleanup();
  await openContexts(browser);
});

test.afterAll(async () => {
  await patientContext?.close();
  await nutriContext?.close();
  await cleanup();
});

test.describe("paciente — registrar e analisar uma refeição", () => {
  test("home tem o atalho; sem consentimento a nova refeição exige aceite", async () => {
    await patient.goto("/paciente");
    await patient.getByRole("link", { name: "Registrar refeição" }).click();
    await expect(patient).toHaveURL(/\/paciente\/refeicoes\/consentimento\?next=nova$/);
    await expect(patient.getByRole("heading", { name: "Consentimento" })).toBeVisible();
    await expect(patient.getByText(/inteligência artificial/).first()).toBeVisible();
    await expect(patient.getByRole("button", { name: "Aceitar e continuar" })).toBeDisabled();
    await patient.getByLabel(/Li e aceito/).check();
    await patient.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(patient).toHaveURL(/\/paciente\/refeicoes\/nova$/);
    const consent = await withDb(async (client) => (await client.query(`select consent_version, revoked_at from public.patient_consents where patient_id = $1`, [PATIENT.patientId])).rows);
    expect(consent).toEqual([{ consent_version: "meal_photo_ai_v1", revoked_at: null }]);
  });

  test("envia a foto (com preview) e recebe a estimativa do provider", async () => {
    await expect(patient.getByRole("heading", { name: "Nova refeição" })).toBeVisible();
    await patient.getByRole("button", { name: "Escolher da galeria" }).click({ trial: true });
    await patient.locator('input[name="photo"]').last().setInputFiles(mealPhoto);
    await expect(patient.getByRole("img", { name: "Prévia da foto da refeição selecionada" })).toBeVisible();
    await expect(patient.getByRole("button", { name: "Trocar foto" })).toBeVisible();
    await patient.getByRole("button", { name: "Enviar foto" }).click();
    await patient.waitForURL(/\/paciente\/refeicoes\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    mealUrl = patient.url();
    mealId = mealUrl.split("/").pop()!;
    await expect(patient.getByText("Aguardando análise")).toBeVisible();
    await expect(patient.getByText(/Os valores apresentados são estimativas/).first()).toBeVisible();

    const stored = await withDb(async (client) => (await client.query(`select storage_path, image_mime, status from public.food_photo_analyses where id = $1`, [mealId])).rows[0]);
    expect(stored.status).toBe("PENDING");
    expect(stored.image_mime).toBe("image/webp");
    expect(stored.storage_path).toMatch(new RegExp(`^${PATIENT.patientId}/${mealId}/[0-9a-f-]{36}\\.webp$`));
    const photo = await patient.request.get(`/paciente/refeicoes/${mealId}/foto`, { maxRedirects: 0 });
    expect(photo.status()).toBe(302);
    expect(photo.headers()["cache-control"]).toContain("no-store");

    await patient.getByRole("button", { name: "Analisar refeição" }).click();
    await expect(patient.getByText("Análise concluída. Revise antes de confirmar.")).toBeVisible({ timeout: 30_000 });
    await expect(patient.getByRole("heading", { name: "Revise sua refeição" })).toBeVisible();
    await expect(patient.getByText("Revisão pendente")).toBeVisible();
    await expect(patient.getByText(/estimativa é simulada/).first()).toBeVisible();
    await expect(patient.getByRole("list", { name: "Alimentos da refeição" }).getByRole("listitem")).not.toHaveCount(0);
  });

  test("revisa: corrige quantidade, remove um item, adiciona azeite, totais recalculam e confirma", async () => {
    const rows = patient.getByRole("list", { name: "Alimentos da refeição" }).getByRole("listitem");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const first = rows.nth(0);
    const originalName = await first.getByLabel("Alimento").inputValue();
    await first.getByLabel("Quantidade").fill("100");
    await first.getByLabel("kcal (est.)").fill("100");
    const totals = patient.locator('dl[aria-label="Totais estimados"]');
    const totalsBefore = await totals.textContent();
    const second = rows.nth(1);
    const removedName = await second.getByLabel("Alimento").inputValue();
    await second.getByRole("button", { name: `Remover ${removedName}` }).click();
    await expect(second.getByText("removido")).toBeVisible();
    await patient.getByRole("button", { name: "+ Óleo / azeite" }).click();
    const added = rows.last();
    await expect(added.getByLabel("Alimento")).toHaveValue("Azeite");
    await added.getByLabel("kcal (est.)").fill("120");
    await added.getByLabel("Proteína g").fill("0");
    await added.getByLabel("Carbo g").fill("0");
    await added.getByLabel("Gordura g").fill("13,5");
    await expect(totals).not.toHaveText(totalsBefore ?? "");
    await patient.getByRole("button", { name: "Confirmar refeição" }).click();
    await expect(patient.getByText("Refeição confirmada.")).toBeVisible({ timeout: 15_000 });
    await expect(patient.getByText("Confirmada", { exact: true })).toBeVisible();
    await expect(patient.getByRole("heading", { name: "Refeição confirmada" })).toBeVisible();
    const confirmedList = patient.getByRole("list", { name: "Alimentos confirmados" });
    await expect(confirmedList).toContainText("Azeite");
    await expect(confirmedList).toContainText("adicionado por você");
    await expect(confirmedList).not.toContainText(removedName);
    await patient.getByText("O que a IA estimou inicialmente").click();
    const original = patient.getByRole("list", { name: "Alimentos estimados pela IA" });
    await expect(original).toContainText(removedName);
    await expect(original).not.toContainText("Azeite");
    const diff = patient.getByRole("list", { name: "Diferenças entre a IA e a versão confirmada" });
    await expect(diff).toContainText("removido");
    await expect(diff).toContainText("adicionado");
    await expect(diff).toContainText(`alterado ${originalName}`);

    const stored = await withDb(async (client) => (await client.query(`select status, structured_result, corrected_result from public.food_photo_analyses where id = $1`, [mealId])).rows[0]);
    expect(stored.status).toBe("CONFIRMED");
    const aiFirst = stored.structured_result.items[0];
    const confirmedFirst = stored.corrected_result.items.find((item: { id: string }) => item.id === aiFirst.id);
    expect(aiFirst.quantity).not.toBe(100);
    expect(confirmedFirst.quantity).toBe(100);
    expect(stored.corrected_result.items.some((item: { name: string; source: string }) => item.name === "Azeite" && item.source === "PATIENT")).toBe(true);
    expect(stored.structured_result.items.some((item: { name: string }) => item.name === "Azeite")).toBe(false);
  });

  test("histórico lista a refeição confirmada; correção posterior preserva o original", async () => {
    await patient.goto("/paciente/refeicoes");
    const list = patient.getByRole("list", { name: "Refeições registradas" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText("Confirmada");
    await expect(list).toContainText("Azeite");
    await list.getByRole("link").first().click();
    await expect(patient).toHaveURL(mealUrl);
    await patient.getByRole("link", { name: "Corrigir itens" }).click();
    await expect(patient.getByRole("heading", { name: "Corrigir refeição" })).toBeVisible();
    await patient.getByRole("list", { name: "Alimentos da refeição" }).getByRole("listitem").first().getByLabel("Quantidade").fill("90");
    await patient.getByRole("button", { name: "Salvar correção" }).click();
    await expect(patient.getByText("Refeição atualizada.")).toBeVisible({ timeout: 15_000 });
    const stored = await withDb(async (client) => (await client.query(`select structured_result, corrected_result from public.food_photo_analyses where id = $1`, [mealId])).rows[0]);
    expect(stored.corrected_result.items[0].quantity).toBe(90);
    expect(stored.structured_result.items[0].quantity).not.toBe(90);
  });
});

test.describe("nutricionista — refeições do paciente", () => {
  test("aba Refeições mostra a confirmada; detalhe traz foto, original x correções e CTA de feedback", async () => {
    await nutri.goto(`/dashboard/pacientes/${PATIENT.patientId}?tab=refeicoes`);
    await expect(nutri.getByRole("heading", { name: "Refeições" })).toBeVisible();
    const list = nutri.getByRole("list", { name: "Refeições confirmadas" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await list.getByRole("link").first().click();
    await expect(nutri).toHaveURL(new RegExp(`/dashboard/pacientes/${PATIENT.patientId}/refeicoes/${mealId}$`));
    await expect(nutri.getByRole("img", { name: /Foto da refeição de Fulana/ })).toBeVisible();
    await expect(nutri.getByText("Estimativa revisada pelo paciente.")).toBeVisible();
    await nutri.getByText("O que a IA estimou inicialmente").click();
    await expect(nutri.getByRole("list", { name: "Diferenças entre a IA e a versão confirmada" })).toContainText("adicionado");
    await expect(nutri.getByText(/não é uma avaliação da refeição/)).toBeVisible();
    const photo = await nutri.request.get(`/dashboard/pacientes/${PATIENT.patientId}/refeicoes/${mealId}/foto`, { maxRedirects: 0 });
    expect(photo.status()).toBe(302);
    await nutri.getByRole("link", { name: "Escrever feedback" }).click();
    await expect(nutri.getByRole("heading", { name: "Novo feedback" })).toBeVisible();
  });

  test("ids adulterados caem em não encontrado", async () => {
    const cross = await nutri.request.get(`/dashboard/pacientes/${BELTRANO_ID}/refeicoes/${mealId}/foto`, { maxRedirects: 0 });
    expect(cross.status()).toBe(404);
    await nutri.goto(`/dashboard/pacientes/${BELTRANO_ID}/refeicoes/${mealId}`);
    await expect(nutri.getByRole("heading", { level: 1 })).not.toContainText("Refeição de");
  });
});

test.describe("paciente — falha do provider, retry, arquivamento e segurança", () => {
  let failedId = "";

  test("falha do provider mantém a foto e oferece tentar de novo; arquivar remove a foto", async () => {
    await patient.goto("/paciente/refeicoes/nova");
    await patient.locator('input[name="photo"]').last().setInputFiles(brokenPhoto);
    await patient.getByRole("button", { name: "Enviar foto" }).click();
    await patient.waitForURL(/\/paciente\/refeicoes\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    failedId = patient.url().split("/").pop()!;
    await patient.getByRole("button", { name: "Analisar refeição" }).click();
    await expect(patient.getByText("Não foi possível analisar esta foto agora. Tente novamente.")).toBeVisible({ timeout: 30_000 });
    await expect(patient.getByText("Falha na análise")).toBeVisible();
    await expect(patient.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    const stored = await withDb(async (client) => (await client.query(`select status, failure_code, attempts, processing_started_at from public.food_photo_analyses where id = $1`, [failedId])).rows[0]);
    expect(stored).toMatchObject({ status: "FAILED", failure_code: "PROVIDER_ERROR", attempts: 1, processing_started_at: null });
    const count = await withDb(async (client) => Number((await client.query(`select count(*) from public.food_photo_analyses where patient_id = $1`, [PATIENT.patientId])).rows[0].count));
    expect(count).toBe(2);

    await patient.getByRole("button", { name: "Arquivar" }).click();
    await patient.getByRole("alertdialog").getByRole("button", { name: "Arquivar" }).click();
    await expect(patient.getByText("Refeição arquivada.")).toBeVisible();
    await expect(patient).toHaveURL(/\/paciente\/refeicoes$/);
    await expect(patient.getByRole("list", { name: "Refeições registradas" }).getByRole("listitem")).toHaveCount(1);
    const gone = await patient.request.get(`/paciente/refeicoes/${failedId}/foto`, { maxRedirects: 0 });
    expect(gone.status()).toBe(404);
  });

  test("outro paciente não acessa; revogar consentimento bloqueia novas análises", async ({ browser }) => {
    const other = await browser.newContext();
    const page = await other.newPage();
    await login(page, { email: "beltrano.dasilva@example.test", password: "NutricaoDev123" });
    await expect(page).toHaveURL(/\/paciente$/);
    const denied = await page.request.get(`/paciente/refeicoes/${mealId}/foto`, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
    await page.goto(mealUrl);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Refeição de");
    await page.goto("/paciente/refeicoes");
    await expect(page.getByText("Você ainda não registrou nenhuma refeição.")).toBeVisible();
    await other.close();

    await patient.goto("/paciente/refeicoes/consentimento");
    await patient.getByRole("button", { name: "Revogar consentimento" }).click();
    await patient.getByRole("alertdialog").getByRole("button", { name: "Revogar" }).click();
    await expect(patient.getByText("Consentimento revogado para novas análises.")).toBeVisible();
    await patient.goto("/paciente/refeicoes/nova");
    await expect(patient).toHaveURL(/\/consentimento\?next=nova$/);
    await patient.goto("/paciente/refeicoes");
    await expect(patient.getByRole("list", { name: "Refeições registradas" }).getByRole("listitem")).toHaveCount(1);
  });

  test("auditoria registrou os eventos sem alimentos, macros ou imagem", async () => {
    const rows = await withDb(async (client) => {
      const result = await client.query(`select action, metadata::text as meta from public.audit_logs where actor_id = $1 and created_at >= $2 and entity_type in ('food_photo_analysis', 'patient_consent')`, [PATIENT.profileId, STARTED_AT]);
      return result.rows as { action: string; meta: string }[];
    });
    const actions = new Set(rows.map((row) => row.action));
    expect([...actions]).toEqual(expect.arrayContaining(["MEAL_AI_CONSENT_ACCEPTED", "MEAL_AI_CONSENT_REVOKED", "MEAL_PHOTO_UPLOADED", "MEAL_ANALYSIS_REQUESTED", "MEAL_ANALYSIS_COMPLETED", "MEAL_ANALYSIS_FAILED", "MEAL_ANALYSIS_CONFIRMED", "MEAL_ANALYSIS_UPDATED", "MEAL_ANALYSIS_ARCHIVED"]));
    for (const row of rows) {
      expect(row.meta).not.toMatch(/Azeite|Arroz|Frango|Pão|Macarrão|kcal|proteinG|base64|data:image|signedUrl|token=/i);
    }
  });

  test("mobile 390: histórico, consentimento, nova refeição e detalhe sem overflow", async () => {
    await patient.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/paciente/refeicoes", "/paciente/refeicoes/consentimento", mealUrl, `${mealUrl}?modo=corrigir`]) {
      await patient.goto(url);
      await expect(patient.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(patient);
    }
    await nutri.setViewportSize({ width: 390, height: 844 });
    await nutri.goto(`/dashboard/pacientes/${PATIENT.patientId}/refeicoes/${mealId}`);
    await expect(nutri.getByRole("heading", { level: 1 })).toBeVisible();
    await noHorizontalOverflow(nutri);
  });
});
