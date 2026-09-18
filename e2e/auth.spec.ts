import { test, expect, type Page } from "@playwright/test";

// Testes de auth compartilham estado externo real (Supabase local, rate
// limiter em memória do processo do server) — rodar em série evita
// flakiness de contas/sessão disputadas entre workers paralelos, que não
// tem relação com corretude da aplicação.
test.describe.configure({ mode: "serial" });

// Chaves de demonstração padrão do Supabase local — iguais em qualquer
// instalação local, não são segredo de produção (README.md). Usadas aqui
// para bater direto na API em alguns testes (role escalation), sem passar
// pela UI.
const SUPABASE_URL = "http://127.0.0.1:55421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Usuários fictícios do supabase/seed.sql (Fase 2) — senha de dev
// documentada ali, válida só localmente.
const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("rotas protegidas — anônimo", () => {
  test("anon em /dashboard é redirecionado para /login com next", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("anon em /paciente é redirecionado para /login com next", async ({ page }) => {
    await page.goto("/paciente");
    await expect(page).toHaveURL(/\/login\?next=%2Fpaciente/);
  });
});

test.describe("login por role", () => {
  test("NUTRITIONIST loga e vai para /dashboard", async ({ page }) => {
    await page.goto("/login");
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Nutricionista Demo (dev)")).toBeVisible();
  });

  test("PATIENT loga e vai para /paciente", async ({ page }) => {
    await page.goto("/login");
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
  });

  test("credenciais inválidas mostram mensagem genérica", async ({ page }) => {
    await page.goto("/login");
    await login(page, { email: NUTRITIONIST.email, password: "senha-errada" });
    await expect(page.locator("#login-error")).toHaveText("E-mail ou senha inválidos.");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("bloqueio cruzado de role", () => {
  test("PATIENT tentando /dashboard é redirecionado para /paciente", async ({ page }) => {
    await page.goto("/login");
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/paciente$/);
  });

  test("NUTRITIONIST tentando /paciente é redirecionado para /dashboard", async ({ page }) => {
    await page.goto("/login");
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/paciente");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("logout", () => {
  test("depois do logout, a rota privada volta a exigir login (Back não recupera acesso)", async ({
    page,
  }) => {
    await page.goto("/login");
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator('button:has-text("Nutricionista Demo")').click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // "Voltar" no browser não deve reabrir a área privada — a próxima
    // requisição ao servidor (o proxy) não tem mais sessão válida.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });
});

test.describe("proteção contra open redirect (prompt Fase 3 §12/§44)", () => {
  const attackVectors = [
    ["https://evil.example", "https%3A%2F%2Fevil.example"],
    ["//evil.example", "%2F%2Fevil.example"],
    ["/%2F%2Fevil.example (percent-encoding duplo)", "%252F%252Fevil.example"],
  ] as const;

  for (const [label, encodedNext] of attackVectors) {
    test(`next=${label} é rejeitado — login vai para a home do role, não para o domínio externo`, async ({
      page,
    }) => {
      await page.goto(`/login?next=${encodedNext}`);
      await login(page, NUTRITIONIST);
      await expect(page).toHaveURL("http://localhost:3000/dashboard");
    });
  }
});

test.describe("proteção contra role escalation (prompt Fase 3 §20/§45)", () => {
  test("PATIENT não consegue alterar a própria role via REST direto", async ({ request }) => {
    const tokenResponse = await request.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        data: PATIENT,
      },
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const session = await tokenResponse.json();

    const patchResponse = await request.patch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        data: { role: "NUTRITIONIST" },
      },
    );

    expect(patchResponse.ok()).toBeFalsy();

    const verifyResponse = await request.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=role`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` } },
    );
    const rows = (await verifyResponse.json()) as Array<{ role: string }>;
    expect(rows[0]?.role).toBe("PATIENT");
  });
});
