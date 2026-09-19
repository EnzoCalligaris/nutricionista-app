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
  // Servidor de PRODUÇÃO sempre (Fase 7, docs/DECISIONS.md): nunca reutiliza
  // algo que já esteja em :3000 — um `next dev` órfão fazia a suíte rodar
  // contra o servidor errado e ainda inflava a memória. Se a porta estiver
  // ocupada, o Playwright falha em vez de testar o servidor errado.
  // `E2E_SKIP_BUILD=1` usa o build já gerado (`npm run build` rodado antes,
  // em sequência) em vez de compilar de novo; ao terminar, o Playwright
  // encerra o `next start` que ele mesmo subiu.
  // `E2E_DEV_SERVER=1` (só para iterar localmente num spec com `next dev`
  // já rodando) desliga o webServer; a validação final NUNCA usa isso.
  webServer: process.env.E2E_DEV_SERVER
    ? undefined
    : {
        command: process.env.E2E_SKIP_BUILD ? "npm run start" : "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
