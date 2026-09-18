import { expect, test, type Page } from "@playwright/test";

// Roda em série: as duas rotas protegidas fazem login contra o mesmo
// servidor Next.js local (`npm run start`, um único processo) — sob alta
// concorrência de workers observamos troca esporádica de sessão entre
// requisições paralelas nesse setup de dev/CI local (um único servidor +
// um único Postgres local, sem isolamento entre workers). Mesma
// justificativa de e2e/auth.spec.ts.
test.describe.configure({ mode: "serial" });

// /dashboard e /paciente exigem autenticação desde a Fase 3 — usuários
// fictícios de supabase/seed.sql (Fase 2), senha de dev documentada ali.
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("home renderiza o site público com header e navegação", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nutrição que vai além");
  await expect(page.getByRole("navigation", { name: "Principal", exact: true }).getByRole("link", { name: "Método EM" })).toBeVisible();
});

test("shell do dashboard responde (sidebar + navegação)", async ({ page }) => {
  await login(page, "dev-nutricionista@example.test", "NutricaoDev123");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  await page.getByRole("link", { name: "Agenda" }).click();
  await expect(page).toHaveURL(/\/dashboard\/agenda$/);
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
});

test("shell do portal do paciente responde em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "fulana.detal@example.test", "NutricaoDev123");
  await expect(page).toHaveURL(/\/paciente$/);
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
});
