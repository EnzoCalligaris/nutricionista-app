import { expect, test } from "@playwright/test";

test.describe("site público — páginas", () => {
  test("home conta a história do Método EM com hero, fases, pilares, planos e CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Nutrição que vai além de receber uma dieta/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Antes, durante e depois." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "O que sustenta o acompanhamento." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Prazer, Enzo Mangili/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Um formato para cada momento." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Vamos caminhar lado a lado/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Enzo Mangili, nutricionista/ })).toBeVisible();
  });

  test("método EM explica antes, durante e depois com 4 pilares", async ({ page }) => {
    await page.goto("/metodo-em");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Além de contar calorias/);
    await expect(page.getByText("Antes da consulta", { exact: true })).toBeVisible();
    await expect(page.getByText("Na consulta", { exact: true })).toBeVisible();
    await expect(page.getByText("Depois da consulta", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quatro pilares, um acompanhamento." })).toBeVisible();
  });

  test("sobre usa fotografia e dados reais, sem CRN inventado", async ({ page }) => {
    await page.goto("/sobre");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Prazer, Enzo Mangili/);
    await expect(page.getByRole("img", { name: /Enzo Mangili sentado/ })).toBeVisible();
    await expect(page.getByText(/emagrecimento funcional, hipertrofia e saúde/)).toBeVisible();
    await expect(page.getByText(/CRN/)).toHaveCount(0);
  });

  test("acompanhamento mostra o passo a passo", async ({ page }) => {
    await page.goto("/acompanhamento");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Como funciona/);
    await expect(page.getByRole("heading", { name: "Pré-consulta gratuita" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check-list quinzenal e ajustes" })).toBeVisible();
  });

  test("resultados mostra empty state honesto sem antes/depois fictício", async ({ page }) => {
    await page.goto("/resultados");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Evoluções acompanhadas de perto/);
    await expect(page.getByRole("status")).toContainText(/consentimento/i);
    await expect(page.locator("img[alt*='antes']")).toHaveCount(0);
  });

  test("blog lista posts publicados e abre o detalhe; rascunho dá 404", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Nutrição para a vida real/);
    await expect(page.getByText("Rascunho: ideias para o próximo artigo")).toHaveCount(0);

    const firstPost = page.getByRole("link", { name: /Exemplo: organizando a rotina alimentar da semana/ }).first();
    await firstPost.click();
    await expect(page).toHaveURL(/\/blog\/exemplo-rotina-alimentar-semana$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/organizando a rotina alimentar/);
    await expect(page.getByText(/Por Enzo Mangili/)).toBeVisible();

    const response = await page.goto("/blog/rascunho-ideias-proximo-artigo");
    expect(response?.status()).toBe(404);
  });

  test("contato valida e não finge envio", async ({ page }) => {
    await page.goto("/contato");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Vamos conversar/);

    await page.getByLabel("Nome").fill("Maria");
    await page.getByLabel("E-mail").fill("maria@example.com");
    await page.getByLabel("Mensagem").fill("oi");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.locator("#contact-message-error")).toBeVisible();
    // Valores digitados são preservados após o erro de validação.
    await expect(page.getByLabel("Nome")).toHaveValue("Maria");

    await page.getByLabel("Mensagem").fill("Quero saber mais sobre o plano trimestral, por favor.");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByRole("status")).toContainText(/ainda não enviada/);
  });

  test("agendar explica o próximo passo sem calendário falso", async ({ page }) => {
    await page.goto("/agendar?plano=trimestral");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/pré-consulta gratuita/i);
    await expect(page.getByText(/Você se interessou pelo Plano Trimestral/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Já sou paciente/ })).toHaveAttribute("href", "/login?next=%2Fpaciente%2Fagendar");
  });

  test("páginas legais existem e não inventam CNPJ", async ({ page }) => {
    await page.goto("/politica-de-privacidade");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidade");
    await expect(page.getByText(/CNPJ/)).toHaveCount(0);
    await page.goto("/termos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Termos de uso");
    await expect(page.getByText(/CNPJ/)).toHaveCount(0);
  });

  test("sitemap e robots respondem", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("/metodo-em");
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /dashboard");
  });
});

test.describe("planos (prompt Fase 4 §47)", () => {
  test("mostra só avulsa, trimestral e semestral com as regras de preço corretas", async ({ page }) => {
    await page.goto("/planos");

    await expect(page.getByTestId("plan-avulsa")).toBeVisible();
    await expect(page.getByTestId("plan-trimestral")).toBeVisible();
    await expect(page.getByTestId("plan-semestral")).toBeVisible();
    await expect(page.getByTestId("plan-anual")).toHaveCount(0);
    await expect(page.getByText(/Plano Anual/)).toHaveCount(0);

    const body = (await page.locator("main").textContent()) ?? "";
    expect(body).not.toMatch(/grupo exclusivo/i);
    expect(body).not.toMatch(/comunidade vip/i);
    expect(body).not.toMatch(/mais vendido|melhor escolha|recomendado/i);

    await expect(page.getByTestId("plan-avulsa")).toContainText(/R\$\s?230,00/);

    for (const id of ["plan-trimestral", "plan-semestral"]) {
      const card = page.getByTestId(id);
      await expect(card).toContainText(/Opções de investimento/i);
      await expect(card.locator(".text-4xl")).toHaveCount(0);
    }
    await expect(page.getByTestId("plan-trimestral")).toContainText(/3 consultas presenciais/);
    await expect(page.getByTestId("plan-trimestral")).toContainText(/2 consultas online/);
    await expect(page.getByTestId("plan-semestral")).toContainText(/6 consultas presenciais/);
    await expect(page.getByTestId("plan-semestral")).toContainText(/5 consultas online/);
  });
});

test.describe("navegação mobile", () => {
  test("menu abre, navega e o hero não depende de crop desktop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("img", { name: /Enzo Mangili, nutricionista/ })).toBeVisible();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.getByRole("navigation", { name: "Principal (mobile)" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Planos" }).click();
    await expect(page).toHaveURL(/\/planos$/);
    await expect(page.getByTestId("plan-avulsa")).toBeVisible();

    // Sem overflow horizontal em 390px.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
