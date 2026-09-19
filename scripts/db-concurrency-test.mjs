// Teste real de concorrência (prompt Fase 2 §53): duas conexões separadas
// disparam, ao mesmo tempo, um INSERT de appointment para o MESMO horário do
// mesmo nutricionista. pgTAP (supabase/tests/database) roda tudo dentro de
// uma única transação/conexão, o que não prova proteção contra uma
// verdadeira corrida entre duas conexões concorrentes — por isso este script
// separado, usando duas conexões `pg` reais.
//
// Requer o Supabase local rodando (`npm run db:start`). Conecta direto no
// Postgres (não pela API), como o papel `postgres`, porque o alvo aqui é a
// exclusion constraint em si, não RLS (já coberta pelos testes pgTAP).

import pg from "pg";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRITIONIST_ID = "f0000000-0000-0000-0000-000000000001";
const PATIENT_ID = "f0000000-0000-0000-0000-000000000002";
const STARTS_AT = "2027-05-10 10:00:00-03";
const ENDS_AT = "2027-05-10 11:00:00-03";

async function withClient(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setup() {
  await withClient(async (client) => {
    await client.query("begin");
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', 'concurrency-test-nutri@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRITIONIST_ID],
    );
    // on conflict DO UPDATE (não "do nothing"): o trigger on_auth_user_created
    // (Fase 3) já criou um profile PATIENT a partir do insert em auth.users
    // acima — precisa sobrescrever para NUTRITIONIST explicitamente.
    await client.query(
      `insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Concurrency Test Nutri')
       on conflict (id) do update set role = excluded.role, full_name = excluded.full_name`,
      [NUTRITIONIST_ID],
    );
    await client.query(
      `insert into public.patients (id, nutritionist_id, full_name) values ($1, $2, 'Concurrency Test Patient')
       on conflict (id) do nothing`,
      [PATIENT_ID, NUTRITIONIST_ID],
    );
    // Limpa tentativas anteriores do mesmo horário, se o script rodou antes.
    await client.query(
      `delete from public.appointments where nutritionist_id = $1 and starts_at = $2`,
      [NUTRITIONIST_ID, STARTS_AT],
    );
    await client.query("commit");
  });
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query("delete from public.appointments where nutritionist_id = $1", [NUTRITIONIST_ID]);
    await client.query("delete from public.patients where id = $1", [PATIENT_ID]);
    await client.query("delete from public.profiles where id = $1", [NUTRITIONIST_ID]);
    await client.query("delete from auth.users where id = $1", [NUTRITIONIST_ID]);
  });
}

async function attemptBooking(label) {
  return withClient(async (client) => {
    try {
      await client.query(
        `insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
         values ($1, $2, $3, $4, 'IN_PERSON', 'SCHEDULED')`,
        [NUTRITIONIST_ID, PATIENT_ID, STARTS_AT, ENDS_AT],
      );
      return { label, ok: true };
    } catch (error) {
      return { label, ok: false, code: error.code, message: error.message };
    }
  });
}

async function main() {
  console.log(`Conectando em ${DATABASE_URL} ...`);
  await setup();

  console.log("Disparando 2 requests concorrentes para o MESMO horário...");
  const [resultA, resultB] = await Promise.all([
    attemptBooking("request-A"),
    attemptBooking("request-B"),
  ]);

  const results = [resultA, resultB];
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);

  console.log(JSON.stringify(results, null, 2));

  const finalCount = await withClient(async (client) => {
    const { rows } = await client.query(
      `select count(*)::int as count from public.appointments where nutritionist_id = $1 and starts_at = $2 and status in ('SCHEDULED','CONFIRMED','COMPLETED','NO_SHOW')`,
      [NUTRITIONIST_ID, STARTS_AT],
    );
    return rows[0].count;
  });

  await cleanup();

  // 23P01 = exclusion_violation. 40P01 = deadlock_detected: quando as duas
  // inserções entram na exclusion constraint ao mesmo tempo, o Postgres pode
  // abortar uma por deadlock (cada uma espera a outra na checagem de
  // sobreposição). Ambas são recusas legítimas — o invariante é 1 sucesso e
  // 1 consulta ativa (a aplicação mapeia os dois códigos para a mesma
  // mensagem amigável, ver src/lib/errors/domain.ts).
  const exclusionFailure = failures.find((f) => f.code === "23P01" || f.code === "40P01");

  if (successes.length === 1 && failures.length === 1 && exclusionFailure && finalCount === 1) {
    console.log(
      `✅ PASS — exatamente 1 sucesso, 1 conflito (${exclusionFailure.code} — exclusion_violation ou deadlock entre as duas inserções), 1 consulta ativa no horário.`,
    );
    process.exit(0);
  }

  console.error(
    `❌ FAIL — esperado 1 sucesso + 1 conflito + 1 linha ativa. Obtido: ${successes.length} sucesso(s), ${failures.length} falha(s), ${finalCount} linha(s) ativa(s) no banco.`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("Erro inesperado no teste de concorrência:", error);
  process.exit(1);
});
