// Testes de integração de autenticação/autorização contra o Supabase LOCAL
// de verdade (prompt Fase 3 §42) — login válido/inválido, enumeração de
// usuário, lookup de profile sob RLS e role escalation via API. Separado
// de `npm run test:run` (Vitest) de propósito, seguindo o mesmo padrão de
// scripts/db-concurrency-test.mjs: requer `npm run db:start` rodando, então
// fica fora da suíte que "roda sem Supabase" (docs/ROADMAP.md, Fase 1).
//
// Usa fetch cru contra as APIs REST do GoTrue/PostgREST em vez de
// `@supabase/supabase-js` para manter o script sem dependências além do
// runtime — mesma filosofia de scripts/db-concurrency-test.mjs (usa `pg`
// cru em vez do client Supabase).

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123" };

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok — ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL — ${label}`);
    failed += 1;
  }
}

async function signIn({ email, password }) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);

  // 1) Login válido — NUTRITIONIST ------------------------------------
  console.log("\n[1] login NUTRITIONIST válido");
  const nutriLogin = await signIn(NUTRITIONIST);
  check("HTTP 200", nutriLogin.status === 200);
  check("retorna access_token", typeof nutriLogin.body.access_token === "string");
  check("retorna refresh_token", typeof nutriLogin.body.refresh_token === "string");
  const nutriToken = nutriLogin.body.access_token;
  const nutriId = nutriLogin.body.user?.id;

  // 2) Login válido — PATIENT ------------------------------------------
  console.log("\n[2] login PATIENT válido");
  const patientLogin = await signIn(PATIENT);
  check("HTTP 200", patientLogin.status === 200);
  const patientToken = patientLogin.body.access_token;
  const patientId = patientLogin.body.user?.id;

  // 3) Senha errada — genérico, sem distinguir de usuário inexistente ---
  console.log("\n[3] senha errada vs. usuário inexistente (não pode ser distinguível)");
  const wrongPassword = await signIn({ email: NUTRITIONIST.email, password: "senha-errada-xyz" });
  const nonExistentUser = await signIn({ email: "ninguem-existe-xyz@example.test", password: "qualquer" });
  check("senha errada -> HTTP 400", wrongPassword.status === 400);
  check("usuário inexistente -> HTTP 400 (mesmo status)", nonExistentUser.status === 400);
  check(
    "mesmo error_code para os dois casos (não revela existência da conta)",
    wrongPassword.body.error_code === nonExistentUser.body.error_code,
  );

  // 4) Profile lookup sob RLS -------------------------------------------
  console.log("\n[4] profile lookup respeita RLS");
  const ownProfile = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${nutriId}&select=role,full_name`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${nutriToken}` },
  }).then((r) => r.json());
  check("nutricionista lê o próprio profile", ownProfile[0]?.role === "NUTRITIONIST");

  const patientOwnProfile = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${patientId}&select=role`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${patientToken}` },
  }).then((r) => r.json());
  check("paciente lê o próprio profile", patientOwnProfile[0]?.role === "PATIENT");

  // Paciente tentando ler o profile de OUTRO usuário (o nutricionista) —
  // RLS deve devolver lista vazia (nenhuma linha visível), não um erro.
  const patientReadsNutriProfile = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${nutriId}&select=role`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${patientToken}` } },
  ).then((r) => r.json());
  check(
    "paciente NÃO enxerga o profile de outro usuário sem vínculo (IDOR)",
    Array.isArray(patientReadsNutriProfile) && patientReadsNutriProfile.length === 0,
  );

  // 5) Role escalation via UPDATE direto ---------------------------------
  console.log("\n[5] role escalation bloqueada (UPDATE direto)");
  const escalationAttempt = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${patientId}`, {
    method: "PATCH",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${patientToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ role: "NUTRITIONIST" }),
  });
  check("UPDATE de role recusado (não é 2xx)", !escalationAttempt.ok);

  const verifyRole = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${patientId}&select=role`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${patientToken}` },
  }).then((r) => r.json());
  check("role continua PATIENT depois da tentativa", verifyRole[0]?.role === "PATIENT");

  // 6) Logout (signOut) — sessão local encerrada -------------------------
  console.log("\n[6] logout (signOut) aceito pelo servidor");
  const logoutResponse = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${patientToken}` },
  });
  check("logout retorna 204", logoutResponse.status === 204);

  console.log(`\n${passed} ok, ${failed} falha(s).`);
  if (failed > 0) {
    console.error("❌ FAIL — testes de integração de autenticação falharam.");
    process.exit(1);
  }
  console.log("✅ PASS — todos os testes de integração de autenticação passaram.");
}

main().catch((error) => {
  console.error("Erro inesperado nos testes de integração:", error);
  process.exit(1);
});
