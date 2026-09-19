import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Um worker só (Fase 6): `logoutAction` faz signOut GLOBAL no Supabase
  // (revoga todas as sessões do usuário — decisão de segurança da Fase 3),
  // então o teste de logout de e2e/auth.spec.ts derrubava, em paralelo, a
  // sessão compartilhada do nutricionista nos outros arquivos (a
  // "troca esporádica de sessão" registrada em docs/DECISIONS.md, Fase 3,
  // item 14, tinha esta causa). Em série, cada arquivo loga depois do logout.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
