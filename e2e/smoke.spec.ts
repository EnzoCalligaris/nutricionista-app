import { expect, test } from "@playwright/test";

test("home renderiza o design system básico", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Método EM" })).toBeVisible();
  await expect(page.getByText(/em desenvolvimento/i).first()).toBeVisible();
});

test("shell do dashboard responde (sidebar + navegação)", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Visão Geral" })).toBeVisible();
  await page.getByRole("link", { name: "Agenda" }).click();
  await expect(page).toHaveURL(/\/dashboard\/agenda$/);
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
});

test("shell do portal do paciente responde em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/paciente");
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
});
