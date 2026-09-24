// QA visual da Fase 14 (CLAUDE.md — regra permanente): captura as telas REAIS
// da consolidação administrativa na aplicação rodando em
// http://localhost:3000 com o Supabase local + seed.
//
// Dashboard: hub de configurações, perfil profissional, contato/endereço,
// atendimento online, site público, planos (lista + detalhe com preços,
// benefícios e prévia do card), resultados (lista, novo, detalhe com fotos +
// consentimento + prévia, tela de consentimento) e blog (lista, novo, edição).
// Público: home, sobre, planos, resultados (com um antes/depois publicado),
// contato e blog.
//
// Saída: ./screenshots/fase-14/{desktop,tablet,mobile}/ (ignorada pelo git).
//
// Uso: node scripts/screenshots-fase-14.mjs [--extra]
//   --extra  também captura 1024 (dashboard) e 375/430 (público).
//
// Prepara dados FICTÍCIOS só no banco local (configurações de exemplo, um
// resultado publicado com consentimento e um post) — `npm run db:reset`
// restaura. Nenhum dado real de contato/CRN/endereço é usado: os valores
// abaixo são claramente de demonstração.

import { chromium } from "playwright";
import sharp from "sharp";
import pg from "pg";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT_ID = "90000000-0000-0000-0000-000000000010";
const OUT = path.resolve("screenshots", "fase-14");
const extra = process.argv.includes("--extra");

const QA_RESULT_ID = "d4000000-0000-0000-0000-000000000001";
const QA_CONSENT_ID = "d4000000-0000-0000-0000-000000000002";
const QA_POST_ID = "d4000000-0000-0000-0000-000000000003";

async function withDb(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Valores de DEMONSTRAÇÃO para o QA visual — explicitamente fictícios. O
 * produto continua sem telefone/CRN/endereço reais (PENDENTE DE DEFINIÇÃO).
 */
const QA_SETTINGS = [
  ["professional.name", '"Enzo Mangili"', true],
  ["professional.title", '"Nutricionista clínico"', true],
  ["professional.crn", '"CRN-0 00000 (exemplo de QA)"', true],
  ["professional.bio_short", '"Bio curta de exemplo para o QA visual."', true],
  ["professional.specialties", '["Emagrecimento funcional", "Hipertrofia", "Saúde"]', true],
  ["professional.experience_years", "2", true],
  ["contact.phone", '"+5511900000000"', true],
  ["contact.whatsapp", '"+5511900000000"', true],
  ["contact.email", '"exemplo-qa@example.test"', true],
  ["social.instagram", '"https://instagram.com/exemplo_qa"', true],
  ["address.place_name", '"Consultório (exemplo de QA)"', true],
  ["address.street", '"Rua de Exemplo"', true],
  ["address.number", '"100"', true],
  ["address.district", '"Centro"', true],
  ["address.city", '"Cidade Exemplo"', true],
  ["address.state", '"SP"', true],
  ["address.postal_code", '"01234-567"', true],
  ["address.show_public", "true", true],
  ["attendance.online_platform", '"Plataforma de exemplo (QA)"', true],
  ["attendance.online_instructions", '"Instruções de exemplo para o QA visual."', false],
  ["seo.default_title", '"Método EM — exemplo de QA"', true],
  ["seo.default_description", '"Descrição de SEO de exemplo usada só no QA visual."', true],
];

async function reset() {
  await withDb(async (client) => {
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.before_after_results where id = $1`, [QA_RESULT_ID]);
    await client.query(`delete from public.media_consents where id = $1`, [QA_CONSENT_ID]);
    await client.query(`delete from public.blog_post_slug_aliases where post_id = $1`, [QA_POST_ID]);
    await client.query(`delete from public.blog_posts where id = $1`, [QA_POST_ID]);
    await client.query(`delete from public.site_settings where key = any($1::text[])`, [QA_SETTINGS.map(([key]) => key)]);
    await client.query(`update public.plan_prices set is_primary = false where plan_id = (select id from public.plans where code = 'TRIMESTRAL')`);
    await client.query(`set session_replication_role = origin`);
  });
}

async function seedQa() {
  await withDb(async (client) => {
    for (const [key, value, isPublic] of QA_SETTINGS) {
      await client.query(
        `insert into public.site_settings (key, value, is_public, updated_by) values ($1, $2::jsonb, $3, $4)
         on conflict (key) do update set value = excluded.value, is_public = excluded.is_public, updated_by = excluded.updated_by`,
        [key, value, isPublic, NUTRITIONIST.id],
      );
    }

    await client.query(
      `insert into public.media_consents (id, patient_id, consent_type, consent_version, name_display_mode, evidence_reference, granted_by)
       values ($1, $2, 'BEFORE_AFTER_PHOTOS', 'image_use_v1', 'FIRST_NAME', 'Exemplo de QA — termo assinado arquivado', $3)`,
      [QA_CONSENT_ID, PATIENT_ID, NUTRITIONIST.id],
    );

    await client.query(
      `insert into public.before_after_results
         (id, nutritionist_id, patient_id, title, description, period, image_alt, display_name, sort_order, media_consent_id)
       values ($1, $2, $3, 'Doze semanas de acompanhamento', 'Depoimento de exemplo usado só no QA visual desta fase.', '12 semanas', 'Evolução corporal ao longo do acompanhamento', 'Fulana', 1, $4)`,
      [QA_RESULT_ID, NUTRITIONIST.id, PATIENT_ID, QA_CONSENT_ID],
    );

    await client.query(
      `insert into public.blog_posts (id, title, slug, excerpt, content, author_id, status, published_at)
       values ($1, 'Exemplo de QA: montando o prato', 'exemplo-qa-montando-o-prato',
         'Post de exemplo criado apenas para o QA visual da Fase 14.',
         $2::jsonb, $3, 'PUBLISHED', now() - interval '2 days')`,
      [
        QA_POST_ID,
        JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Conteúdo de exemplo para o QA visual do CMS." }] },
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Um subtítulo" }] },
            { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Primeiro item" }] }] }] },
          ],
        }),
        NUTRITIONIST.id,
      ],
    );
  });
}

/**
 * Imagem WEBP de QA gerada na hora (gradiente neutro com faixa), no formato
 * retrato 3:4 que o card usa. NENHUMA foto real de paciente entra no QA
 * visual — o objetivo é só validar enquadramento, proporção e alinhamento.
 */
async function qaImage(label) {
  const width = 900;
  const height = 1200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c8d2d4"/><stop offset="100%" stop-color="#8fa2a6"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="0" y="${height / 2 - 60}" width="${width}" height="120" fill="#1f3b44" opacity="0.85"/>
    <text x="50%" y="${height / 2 + 18}" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#ffffff">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
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
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, `${name}-${width}-viewport.png`), fullPage: false });
  if (full) await page.screenshot({ path: path.join(dir, `${name}-${width}-full.png`), fullPage: true });
}

const viewportsDashboard = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  ...(extra ? [{ name: "tablet", width: 1024, height: 768 }] : []),
];
const viewportsPublic = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  ...(extra ? [{ name: "mobile", width: 375, height: 812 }, { name: "mobile", width: 430, height: 932 }] : []),
];

await reset();
await seedQa();

const dir0 = await mkdtemp(path.join(os.tmpdir(), "em-qa-f14-"));
const beforeImagePath = path.join(dir0, "antes.webp");
const afterImagePath = path.join(dir0, "depois.webp");
await writeFile(beforeImagePath, await qaImage("ANTES (exemplo de QA)"));
await writeFile(afterImagePath, await qaImage("DEPOIS (exemplo de QA)"));

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
});

const nutriContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
{
  const page = await nutriContext.newPage();
  await login(page, NUTRITIONIST, /\/dashboard$/);

  // Fotos do resultado de QA pelo fluxo real (bucket privado).
  await page.goto(`${BASE_URL}/dashboard/resultados/${QA_RESULT_ID}`);
  await page.locator('input[type="file"]').first().setInputFiles(beforeImagePath);
  await page.getByRole("button", { name: /Enviar foto de antes/i }).click();
  await page.getByText("Foto atualizada.").first().waitFor();
  await page.locator('input[type="file"]').nth(1).setInputFiles(afterImagePath);
  await page.getByRole("button", { name: /Enviar foto de depois/i }).click();
  await page.getByText("Foto atualizada.").first().waitFor();

  // Publica para o site público ter o que mostrar.
  await page.getByRole("button", { name: "Publicar no site" }).click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await page.getByText("Publicado", { exact: true }).first().waitFor();
  await page.close();
}

const planId = await withDb(async (client) => {
  const { rows } = await client.query(`select id from public.plans where code = 'TRIMESTRAL'`);
  return rows[0].id;
});

// 1. Dashboard administrativo.
for (const viewport of viewportsDashboard) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await nutriContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Dashboard ${viewport.name} (${w})...`);

  await page.goto(`${BASE_URL}/dashboard/configuracoes`);
  await page.getByRole("heading", { name: "Configurações", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-hub", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/perfil`);
  await page.getByRole("heading", { name: "Perfil profissional", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-perfil", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/contato`);
  await page.getByRole("heading", { name: "Contato e localização", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-contato", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/atendimento`);
  await page.getByRole("heading", { name: "Atendimento online", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-atendimento", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/site`);
  await page.getByRole("heading", { name: "Site público", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-site", w);

  await page.goto(`${BASE_URL}/dashboard/planos`);
  await page.getByRole("heading", { name: "Planos", level: 1 }).waitFor();
  await shoot(page, dir, "planos-lista", w);

  await page.goto(`${BASE_URL}/dashboard/planos/${planId}`);
  await page.getByRole("heading", { name: "Plano Trimestral", level: 1 }).waitFor();
  await shoot(page, dir, "planos-detalhe", w);

  await page.goto(`${BASE_URL}/dashboard/resultados`);
  await page.getByRole("heading", { name: "Resultados", level: 1 }).waitFor();
  await shoot(page, dir, "resultados-lista", w);

  await page.goto(`${BASE_URL}/dashboard/resultados/novo`);
  await page.getByRole("heading", { name: "Novo resultado", level: 1 }).waitFor();
  await shoot(page, dir, "resultados-novo", w);

  await page.goto(`${BASE_URL}/dashboard/resultados/${QA_RESULT_ID}`);
  await page.getByRole("heading", { name: "Doze semanas de acompanhamento", level: 1 }).waitFor();
  await shoot(page, dir, "resultados-detalhe", w);

  await page.goto(`${BASE_URL}/dashboard/resultados/${QA_RESULT_ID}/consentimento`);
  await page.getByRole("heading", { name: "Consentimento de uso de imagem", level: 1 }).waitFor();
  await shoot(page, dir, "resultados-consentimento", w);

  await page.goto(`${BASE_URL}/dashboard/blog`);
  await page.getByRole("heading", { name: "Blog", level: 1 }).waitFor();
  await shoot(page, dir, "blog-lista", w);

  await page.goto(`${BASE_URL}/dashboard/blog/novo`);
  await page.getByRole("heading", { name: "Novo post", level: 1 }).waitFor();
  await shoot(page, dir, "blog-novo", w);

  await page.goto(`${BASE_URL}/dashboard/blog/${QA_POST_ID}`);
  await page.getByRole("heading", { name: "Exemplo de QA: montando o prato", level: 1 }).waitFor();
  await shoot(page, dir, "blog-edicao", w);

  // Telas linkadas pelo hub (Fases 12/13) — §81.
  await page.goto(`${BASE_URL}/dashboard/configuracoes/notificacoes`);
  await page.getByRole("heading", { name: "Notificações", level: 1 }).waitFor();
  await shoot(page, dir, "configuracoes-notificacoes", w);

  await page.goto(`${BASE_URL}/dashboard/configuracoes/pagamentos`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await shoot(page, dir, "configuracoes-pagamentos", w);

  await page.close();
}

// 2. Site público (com as configurações de QA aplicadas).
const publicContext = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
for (const viewport of viewportsPublic) {
  const dir = path.join(OUT, viewport.name);
  await mkdir(dir, { recursive: true });
  const page = await publicContext.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const w = viewport.width;
  console.log(`Público ${viewport.name} (${w})...`);

  for (const [name, url, heading] of [
    ["publico-home", "/", null],
    ["publico-sobre", "/sobre", null],
    ["publico-planos", "/planos", null],
    ["publico-resultados", "/resultados", null],
    ["publico-contato", "/contato", null],
    ["publico-blog", "/blog", null],
  ]) {
    await page.goto(`${BASE_URL}${url}`);
    if (heading) await page.getByRole("heading", { name: heading }).waitFor();
    await shoot(page, dir, name, w);
  }

  await page.close();
}

await browser.close();
console.log(`\nScreenshots em ${OUT}`);
console.log("Dados de QA continuam no banco local — rode `npm run db:reset` para restaurar.");
