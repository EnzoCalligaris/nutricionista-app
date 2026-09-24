import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Fase 14 — configurações, planos, resultados antes/depois com consentimento e
// CMS do blog ponta a ponta contra o app real + Supabase local com o seed.
//
// Cada bloco restaura o estado que alterou (§76), para a suíte poder rodar
// mais de uma vez e não deixar o site com dado de teste.
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const TAG = "E2E Fase 14";
const STARTED_AT = new Date().toISOString();

const RESULT_TITLE = `${TAG} evolução`;
const POST_TITLE = `${TAG} primeiro artigo`;
const POST_SLUG = "e2e-fase14-primeiro-artigo";
const HEADLINE = `${TAG} headline configurada`;
const PHONE_INPUT = "(11) 98888-7777";
const PHONE_DISPLAY = "(11) 98888-7777";

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

/** Remove o que este arquivo criou e restaura o catálogo real de planos. */
async function cleanup() {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('before_after_result', 'media_consent', 'blog_post', 'site_settings', 'plan', 'plan_price', 'plan_benefit')`, [STARTED_AT]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.before_after_results where title like $1`, [`${TAG}%`]);
    await client.query(`delete from public.media_consents where evidence_reference like $1`, [`${TAG}%`]);
    await client.query(`delete from public.blog_post_slug_aliases where slug like 'e2e-fase14-%'`);
    await client.query(`delete from public.blog_posts where slug like 'e2e-fase14-%'`);
    await client.query(`delete from public.site_settings where key in ('home.headline', 'contact.phone', 'contact.whatsapp', 'professional.crn')`);
    // Catálogo real: nenhuma condição principal em TRIMESTRAL (PENDENTE).
    await client.query(`update public.plan_prices set is_primary = false where plan_id = (select id from public.plans where code = 'TRIMESTRAL')`);
    await client.query(`set session_replication_role = origin`);
  });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

let nutriContext: BrowserContext;
let visitorContext: BrowserContext;
let nutri: Page;
let visitor: Page;
let beforeImagePath = "";
let afterImagePath = "";
let resultUrl = "";
let postUrl = "";

/** WEBP mínimo válido — nenhuma foto real de paciente entra no repositório. */
function fakeWebp(): Buffer {
  return Buffer.concat([Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "binary"), Buffer.alloc(64, 0)]);
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  await cleanup();
  nutriContext = await browser.newContext();
  visitorContext = await browser.newContext();
  nutri = await nutriContext.newPage();
  visitor = await visitorContext.newPage();
  await login(nutri, NUTRITIONIST);
  await expect(nutri).toHaveURL(/\/dashboard$/);

  const dir = await mkdtemp(path.join(os.tmpdir(), "em-e2e-f14-"));
  beforeImagePath = path.join(dir, "antes.webp");
  afterImagePath = path.join(dir, "depois.webp");
  await writeFile(beforeImagePath, fakeWebp());
  await writeFile(afterImagePath, fakeWebp());
});

test.afterAll(async () => {
  await nutriContext?.close();
  await visitorContext?.close();
  await cleanup();
});

// =====================================================================
// §75 — hub de configurações: edita perfil e contato, site público reflete
// =====================================================================
test("hub de configurações reúne as seções e abre cada uma", async () => {
  await nutri.goto("/dashboard/configuracoes");
  await expect(nutri.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();

  // Escopo nos títulos dos cards do hub: "Resultados" e "Blog" também são
  // itens da sidebar, e `getByText` casaria os dois (CardTitle é um div com
  // data-slot="card-title", não um heading — ver CLAUDE.md).
  for (const section of ["Perfil profissional", "Contato e localização", "Atendimento online", "Agenda", "Planos e preços", "Site público", "Resultados", "Blog", "Notificações", "Pagamentos"]) {
    await expect(nutri.locator('[data-slot="card-title"]', { hasText: section }).first()).toBeVisible();
  }
  // O CRN começa pendente — nenhum número fictício é mostrado.
  await expect(nutri.getByText("CRN pendente", { exact: true })).toBeVisible();
});

test("edita o perfil profissional e o site passa a exibir o CRN", async () => {
  await nutri.goto("/dashboard/configuracoes/perfil");
  await nutri.getByLabel("CRN").fill("CRN-0 12345");
  await nutri.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(nutri.getByText("Configurações salvas. O site público já reflete a mudança.")).toBeVisible();

  await visitor.goto("/sobre");
  // O CRN aparece no conteúdo e no rodapé: escopo no conteúdo principal.
  await expect(visitor.locator("#conteudo").getByText("CRN CRN-0 12345")).toBeVisible();
  await expect(visitor.getByRole("contentinfo").getByText("CRN CRN-0 12345")).toBeVisible();

  // Apagar o campo remove do site (§93).
  await nutri.goto("/dashboard/configuracoes/perfil");
  await nutri.getByLabel("CRN").fill("");
  await nutri.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(nutri.getByText("Configurações salvas. O site público já reflete a mudança.")).toBeVisible();

  await visitor.goto("/sobre");
  await expect(visitor.getByText("CRN CRN-0 12345")).toHaveCount(0);
});

test("edita o contato e o site público reflete o telefone normalizado", async () => {
  await nutri.goto("/dashboard/configuracoes/contato");
  await nutri.getByLabel("Telefone", { exact: true }).fill(PHONE_INPUT);
  await nutri.getByLabel("WhatsApp").fill(PHONE_INPUT);
  await nutri.getByRole("button", { name: "Salvar contato" }).click();
  await expect(nutri.getByText("Configurações salvas. O site público já reflete a mudança.").first()).toBeVisible();

  await visitor.goto("/contato");
  await expect(visitor.getByRole("link", { name: PHONE_DISPLAY }).first()).toBeVisible();
});

test("telefone inválido é recusado com mensagem, sem salvar", async () => {
  await nutri.goto("/dashboard/configuracoes/contato");
  await nutri.getByLabel("Telefone", { exact: true }).fill("123");
  await nutri.getByRole("button", { name: "Salvar contato" }).click();
  await expect(nutri.getByText("Informe um telefone válido com DDD, ex.: (11) 99999-0001.")).toBeVisible();
});

test("conteúdo da home é configurável e cai no texto atual quando limpo (§12)", async () => {
  await nutri.goto("/dashboard/configuracoes/site");
  await nutri.getByLabel("Headline", { exact: true }).fill(HEADLINE);
  await nutri.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(nutri.getByText("Configurações salvas. O site público já reflete a mudança.").first()).toBeVisible();

  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();

  await nutri.goto("/dashboard/configuracoes/site");
  await nutri.getByLabel("Headline", { exact: true }).fill("");
  await nutri.getByRole("button", { name: "Salvar conteúdo" }).click();
  await expect(nutri.getByText("Configurações salvas. O site público já reflete a mudança.").first()).toBeVisible();

  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1, name: "Nutrição que vai além de receber uma dieta." })).toBeVisible();
});

test("atendimento online não sugere nenhuma plataforma por padrão (§7/§91)", async () => {
  await nutri.goto("/dashboard/configuracoes/atendimento");
  await expect(nutri.getByLabel("Plataforma da consulta online")).toHaveValue("");
  await expect(nutri.getByLabel("Link base da sala")).toHaveValue("");
});

// =====================================================================
// §76 — planos: altera preço/visibilidade e o site reflete
// =====================================================================
test("plano anual aparece no dashboard mas nunca no site (§14/§68)", async () => {
  await nutri.goto("/dashboard/planos");
  // A lista tem cards (< lg) E tabela (>= lg): os dois existem no DOM, só um
  // está visível na viewport atual — daí o filtro por visibilidade.
  await expect(nutri.getByText("Plano Anual", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  await visitor.goto("/planos");
  await expect(visitor.getByText("Plano Anual", { exact: true })).toHaveCount(0);
});

test("definir e limpar a condição principal do trimestral reflete no site (§16/§17/§67)", async () => {
  await visitor.goto("/planos");
  // Escopo no card do TRIMESTRAL: o semestral também está sem condição
  // principal (catálogo real), então a asserção global casaria com ele.
  const trimestral = () => visitor.getByTestId("plan-trimestral");
  // Estado inicial (catálogo real): nenhuma condição principal.
  await expect(trimestral().getByText("Opções de investimento")).toBeVisible();

  const planId = await withDb(async (client) => {
    const { rows } = await client.query(`select id from public.plans where code = 'TRIMESTRAL'`);
    return rows[0].id as string;
  });

  await nutri.goto(`/dashboard/planos/${planId}`);
  await expect(nutri.getByRole("heading", { name: "Plano Trimestral", level: 1 })).toBeVisible();

  // Índice 1 = primeira condição ativa (a de menor valor: "À vista").
  await nutri.getByLabel("Condição principal").selectOption({ index: 1 });
  await nutri.getByRole("button", { name: "Definir" }).click();
  await expect(nutri.getByText("Condição principal atualizada.")).toBeVisible();

  await visitor.goto("/planos");
  await expect(trimestral().getByText("Opções de investimento")).toHaveCount(0);

  // Restaura o estado do catálogo dentro do próprio teste (§76).
  await nutri.goto(`/dashboard/planos/${planId}`);
  await nutri.getByLabel("Condição principal").selectOption({ value: "" });
  await nutri.getByRole("button", { name: "Definir" }).click();
  await expect(nutri.getByText("Condição principal atualizada.")).toBeVisible();

  await visitor.goto("/planos");
  await expect(trimestral().getByText("Opções de investimento")).toBeVisible();
});

test("preço zero é recusado com mensagem clara (§18)", async () => {
  const planId = await withDb(async (client) => {
    const { rows } = await client.query(`select id from public.plans where code = 'TRIMESTRAL'`);
    return rows[0].id as string;
  });
  await nutri.goto(`/dashboard/planos/${planId}`);
  // O formulário de nova condição vive num <details>: abre pelo summary.
  await nutri.getByText("Nova condição de preço").click();
  await nutri.getByLabel("Rótulo", { exact: true }).fill(`${TAG} inválida`);
  await nutri.getByLabel("Valor total (R$)").fill("0,00");
  await nutri.getByRole("button", { name: "Adicionar condição" }).click();
  await expect(nutri.getByText("O valor deve ser maior que zero.")).toBeVisible();
});

// =====================================================================
// §77 — resultados: criar, fotos, consentimento, publicar, revogar
// =====================================================================
test("cria resultado, envia fotos, registra consentimento, publica e o site exibe", async () => {
  await nutri.goto("/dashboard/resultados");
  await expect(nutri.getByText("Nenhum resultado cadastrado.")).toBeVisible();

  await nutri.getByRole("link", { name: "Criar o primeiro resultado" }).click();
  await nutri.getByLabel("Título", { exact: true }).fill(RESULT_TITLE);
  await nutri.getByLabel("Descrição / depoimento").fill(`${TAG}: evolução ao longo do acompanhamento.`);
  await nutri.getByLabel("Período").fill("6 meses de acompanhamento");
  await nutri.getByRole("button", { name: "Criar resultado" }).click();

  await expect(nutri).toHaveURL(/\/dashboard\/resultados\/[0-9a-f-]+/);
  resultUrl = nutri.url().split("?")[0]!;
  await expect(nutri.getByText("Rascunho", { exact: true })).toBeVisible();

  // Sem fotos nem consentimento, publicar está bloqueado e o motivo aparece.
  await expect(nutri.getByText("Falta a foto de antes.")).toBeVisible();
  await expect(nutri.getByText("Falta um consentimento de uso de imagem válido.")).toBeVisible();
  await expect(nutri.getByRole("button", { name: "Publicar no site" })).toBeDisabled();

  // Fotos.
  await nutri.locator('input[type="file"]').first().setInputFiles(beforeImagePath);
  await nutri.getByRole("button", { name: /Enviar foto de antes/i }).click();
  await expect(nutri.getByText("Foto atualizada.").first()).toBeVisible();

  await nutri.locator('input[type="file"]').nth(1).setInputFiles(afterImagePath);
  await nutri.getByRole("button", { name: /Enviar foto de depois/i }).click();
  await expect(nutri.getByText("Foto atualizada.").first()).toBeVisible();

  // Consentimento.
  await nutri.getByRole("link", { name: "Registrar consentimento" }).click();
  await expect(nutri.getByRole("heading", { name: "Consentimento de uso de imagem", level: 1 })).toBeVisible();
  await expect(nutri.getByText("REVISÃO JURÍDICA PENDENTE", { exact: false })).toBeVisible();

  // Mesmo padrão dos specs das fases anteriores para o autocomplete.
  await nutri.getByPlaceholder("Buscar paciente pelo nome...").fill("Fulana");
  await nutri.getByRole("option").filter({ hasText: "Fulana de Tal" }).getByRole("button").click();
  // Confirma que a seleção foi para o formulário antes de submeter.
  await expect(nutri.getByRole("button", { name: "Trocar paciente" })).toBeVisible();
  await nutri.getByLabel("Como a pessoa autorizou ser identificada").selectOption("FIRST_NAME");
  await nutri.getByLabel("Onde a autorização está registrada").fill(`${TAG} — termo assinado arquivado`);
  await nutri.getByLabel(/Confirmo que obtive esta autorização/).check();
  await nutri.getByRole("button", { name: "Registrar consentimento" }).click();

  await expect(nutri).toHaveURL(new RegExp(resultUrl.replace(/^https?:\/\/[^/]+/, "")));
  await expect(nutri.getByText("Válido", { exact: true })).toBeVisible();
  await expect(nutri.getByText("Pronto para publicar", { exact: true })).toBeVisible();

  // Preview antes de publicar (§38).
  await expect(nutri.getByText("Prévia do site")).toBeVisible();

  // Ainda não está no site.
  await visitor.goto("/resultados");
  await expect(visitor.getByText(RESULT_TITLE)).toHaveCount(0);

  // Publicar.
  await nutri.getByRole("button", { name: "Publicar no site" }).click();
  await nutri.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(nutri.getByText("Publicado", { exact: true })).toBeVisible();

  await visitor.goto("/resultados");
  await expect(visitor.getByRole("heading", { name: RESULT_TITLE })).toBeVisible();
  // Nome exibido no formato autorizado (primeiro nome), nunca o nome completo.
  await expect(visitor.getByText("Fulana", { exact: true }).first()).toBeVisible();
  await expect(visitor.getByText("Fulana de Tal")).toHaveCount(0);
  // As duas fotos são entregues pela rota server-side.
  await expect(visitor.getByRole("img", { name: /antes do acompanhamento/i }).first()).toBeVisible();
  await expect(visitor.getByRole("img", { name: /depois do acompanhamento/i }).first()).toBeVisible();
});

test("revogar o consentimento tira o resultado do site imediatamente (§31/§77)", async () => {
  await nutri.goto(resultUrl);
  await nutri.getByRole("button", { name: "Revogar consentimento" }).click();
  await nutri.getByLabel("Motivo (opcional)").fill(`${TAG} pedido do paciente`);
  await nutri.getByRole("button", { name: "Revogar", exact: true }).click();

  await expect(nutri.getByText("Fora do ar — consentimento revogado", { exact: true })).toBeVisible();

  await visitor.goto("/resultados");
  await expect(visitor.getByText(RESULT_TITLE)).toHaveCount(0);
  await expect(visitor.getByText("Resultados reais, com consentimento real.")).toBeVisible();
});

test("a imagem do resultado revogado deixa de ser servida pela rota pública (§33/§71)", async () => {
  const resultId = resultUrl.split("/").pop()!;
  const response = await visitor.request.get(`/api/resultados/${resultId}/before`);
  expect(response.status()).toBe(404);
});

// =====================================================================
// §78 — blog: rascunho, publicar, editar, arquivar
// =====================================================================
test("cria rascunho que não aparece no site, publica, edita o endereço e arquiva", async () => {
  await nutri.goto("/dashboard/blog");
  await nutri.getByRole("link", { name: "Novo post" }).click();

  await nutri.getByLabel("Título", { exact: true }).fill(POST_TITLE);
  await nutri.getByLabel("Endereço (slug)").fill(POST_SLUG);
  await nutri.getByLabel("Resumo").fill(`${TAG}: resumo do artigo.`);
  await nutri.getByLabel("Conteúdo", { exact: true }).fill("## Um subtítulo\n\nParágrafo com **negrito**.\n\n- item um\n- item dois");
  // A pré-visualização usa o mesmo renderizador do site.
  await expect(nutri.getByRole("heading", { name: "Um subtítulo" })).toBeVisible();
  await nutri.getByRole("button", { name: "Criar rascunho" }).click();

  await expect(nutri).toHaveURL(/\/dashboard\/blog\/[0-9a-f-]+/);
  postUrl = nutri.url().split("?")[0]!;
  await expect(nutri.getByText("Rascunho", { exact: true }).first()).toBeVisible();

  // Rascunho: 404 no público.
  const draftResponse = await visitor.request.get(`/blog/${POST_SLUG}`);
  expect(draftResponse.status()).toBe(404);

  // Publicar.
  await nutri.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(nutri.getByText("Publicado", { exact: true }).first()).toBeVisible();

  await visitor.goto(`/blog/${POST_SLUG}`);
  await expect(visitor.getByRole("heading", { level: 1, name: POST_TITLE })).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Um subtítulo" })).toBeVisible();

  // Trocar o endereço avisa e o antigo passa a redirecionar (§42).
  await nutri.goto(postUrl);
  await nutri.getByLabel("Endereço (slug)").fill(`${POST_SLUG}-v2`);
  await expect(nutri.getByText(/O endereço público muda de/)).toBeVisible();
  await nutri.getByRole("button", { name: "Salvar post" }).click();
  await expect(nutri.getByText("Post salvo.")).toBeVisible();

  await visitor.goto(`/blog/${POST_SLUG}`);
  await expect(visitor).toHaveURL(new RegExp(`/blog/${POST_SLUG}-v2$`));
  await expect(visitor.getByRole("heading", { level: 1, name: POST_TITLE })).toBeVisible();

  // Arquivar: volta a 404.
  await nutri.goto(postUrl);
  await nutri.getByRole("button", { name: "Arquivar" }).click();
  await nutri.getByRole("button", { name: "Arquivar", exact: true }).last().click();
  await expect(nutri.getByText("Arquivado", { exact: true }).first()).toBeVisible();

  const archivedResponse = await visitor.request.get(`/blog/${POST_SLUG}-v2`);
  expect(archivedResponse.status()).toBe(404);
});

test("HTML no conteúdo do post nunca é interpretado como marcação (§40)", async () => {
  await nutri.goto("/dashboard/blog/novo");
  await nutri.getByLabel("Título", { exact: true }).fill(`${TAG} xss`);
  await nutri.getByLabel("Conteúdo", { exact: true }).fill('<img src=x onerror="window.__xss=1">');
  // A pré-visualização (mesmo renderizador do site) mostra o texto LITERAL...
  const preview = nutri.locator(".prose-em");
  await expect(preview.getByText('<img src=x onerror="window.__xss=1">')).toBeVisible();
  // ...e nenhum elemento <img> é criado a partir dele.
  await expect(preview.locator("img")).toHaveCount(0);
  expect(await nutri.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

// =====================================================================
// §79 — mobile 390
// =====================================================================
test("mobile 390: hub, configurações, planos e resultados sem overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const url of ["/dashboard/configuracoes", "/dashboard/configuracoes/perfil", "/dashboard/configuracoes/contato", "/dashboard/planos", "/dashboard/resultados", "/dashboard/blog"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
    }
  } finally {
    await context.close();
  }
});

test("mobile 390: páginas públicas sem overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    for (const url of ["/", "/sobre", "/planos", "/resultados", "/contato", "/blog"]) {
      await page.goto(url);
      await noHorizontalOverflow(page);
    }
  } finally {
    await context.close();
  }
});
