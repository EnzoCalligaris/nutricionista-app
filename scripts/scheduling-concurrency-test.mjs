// Concorrência REAL da agenda (prompt Fase 6 §47/§84): requisições
// simultâneas às funções SQL de agendamento via PostgREST, com JWTs reais
// de dois pacientes e do nutricionista, contra o Supabase local.
//
//   1. Paciente A e Paciente B confirmam o MESMO slot ao mesmo tempo.
//   2. Nutricionista e paciente disputam o mesmo slot.
//   3. Dois reagendamentos simultâneos para o MESMO horário de destino.
//
// Em cada cenário: exatamente 1 sucesso e 1 recusa (23P01, a exclusion
// constraint da Fase 2), e exatamente 1 consulta ativa no horário. Complementa
// scripts/db-concurrency-test.mjs (que testa a constraint direto no Postgres).
//
// Requer `npm run db:start` + seed. Uso: npm run test:scheduling:concurrency

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok — ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL — ${label}${detail ? ` (${JSON.stringify(detail)})` : ""}`);
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
  if (!response.ok) throw new Error(`login falhou para ${email}`);
  return body.access_token;
}

async function rpc(token, name, args) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

// Próxima segunda-feira às HH:00 em America/Sao_Paulo (dentro da
// disponibilidade fictícia do seed: seg–sex 08–12 / 14–18), ≥ 8 dias à frente
// para não esbarrar nas consultas do seed (+5d e +15d ficam em outros horários).
function nextMondayAt(hour, weeksAhead = 2) {
  const now = new Date();
  const spDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = spDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const weekday = base.getUTCDay();
  const daysToMonday = ((8 - weekday) % 7 || 7) + 7 * (weeksAhead - 1);
  const monday = new Date(base.getTime() + daysToMonday * 86_400_000);
  const dateISO = monday.toISOString().slice(0, 10);
  // -03:00 fixo é o offset atual de São Paulo (sem horário de verão hoje);
  // o teste usa literal com offset para ser explícito.
  return { dateISO, startsAt: `${dateISO}T${String(hour).padStart(2, "0")}:00:00-03:00`, endsAt: `${dateISO}T${String(hour + 1).padStart(2, "0")}:00:00-03:00` };
}

async function withClient(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function activeCount(startsAt) {
  return withClient(async (client) => {
    const result = await client.query(
      `select count(*)::int as n from public.appointments where nutritionist_id = $1 and starts_at = $2::timestamptz and status in ('SCHEDULED','CONFIRMED','COMPLETED','NO_SHOW')`,
      [NUTRI.id, startsAt],
    );
    return result.rows[0].n;
  });
}

async function cleanup(dateISO) {
  await withClient(async (client) => {
    await client.query(
      `delete from public.audit_logs where entity_id in (select id from public.appointments where nutritionist_id = $1 and starts_at::date = $2::date)`,
      [NUTRI.id, dateISO],
    );
    await client.query(`update public.appointments set rescheduled_to_id = null where nutritionist_id = $1 and starts_at::date = $2::date`, [NUTRI.id, dateISO]);
    await client.query(`delete from public.appointments where nutritionist_id = $1 and starts_at::date = $2::date`, [NUTRI.id, dateISO]);
  });
}

function summarize(results) {
  const ok = results.filter((r) => r.status === 200 && typeof r.body === "string");
  // 23P01 (exclusion_violation) ou 40P01 (deadlock entre as duas inserções
  // simultâneas na exclusion constraint) — ambas viram "horário indisponível"
  // na aplicação (src/lib/errors/domain.ts). O invariante é 1 sucesso.
  const slotTaken = results.filter((r) => r.status >= 400 && (r.body?.code === "23P01" || r.body?.code === "40P01" || String(r.body?.message ?? "").includes("appointments_no_overlap")));
  return { ok: ok.length, slotTaken: slotTaken.length, raw: results.map((r) => [r.status, typeof r.body === "string" ? "uuid" : r.body?.message ?? r.body?.code]) };
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  const [nutriToken, tokenA, tokenB] = await Promise.all([signIn(NUTRI), signIn(PATIENT_A), signIn(PATIENT_B)]);
  const slot = nextMondayAt(9);
  await cleanup(slot.dateISO);

  try {
    // 1) Dois pacientes, mesmo slot ---------------------------------------------
    console.log(`\n[1] Paciente A e Paciente B confirmam ${slot.startsAt} ao mesmo tempo`);
    const s1 = summarize(
      await Promise.all([
        rpc(tokenA, "book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: slot.startsAt, p_ends_at: slot.endsAt, p_modality: "IN_PERSON" }),
        rpc(tokenB, "book_appointment", { p_patient_id: PATIENT_B.patientId, p_starts_at: slot.startsAt, p_ends_at: slot.endsAt, p_modality: "IN_PERSON" }),
      ]),
    );
    check("exatamente 1 sucesso", s1.ok === 1, s1.raw);
    check("exatamente 1 recusa por horário indisponível (23P01)", s1.slotTaken === 1, s1.raw);
    check("exatamente 1 consulta ativa no horário", (await activeCount(slot.startsAt)) === 1);

    // 2) Nutricionista + paciente, mesmo slot (10:00) -----------------------------
    const slot2 = nextMondayAt(10);
    console.log(`\n[2] Nutricionista e Paciente B disputam ${slot2.startsAt}`);
    const s2 = summarize(
      await Promise.all([
        rpc(nutriToken, "book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: slot2.startsAt, p_ends_at: slot2.endsAt, p_modality: "IN_PERSON" }),
        rpc(tokenB, "book_appointment", { p_patient_id: PATIENT_B.patientId, p_starts_at: slot2.startsAt, p_ends_at: slot2.endsAt, p_modality: "ONLINE" }),
      ]),
    );
    check("exatamente 1 sucesso", s2.ok === 1, s2.raw);
    check("exatamente 1 recusa (23P01)", s2.slotTaken === 1, s2.raw);
    check("exatamente 1 consulta ativa no horário", (await activeCount(slot2.startsAt)) === 1);

    // 3) Dois reagendamentos simultâneos para o mesmo destino (11:00) ----------------
    // Prepara duas consultas em horários distintos (14:00 e 15:00) para A e B.
    const a14 = nextMondayAt(14);
    const b15 = nextMondayAt(15);
    const target = nextMondayAt(11);
    const createdA = await rpc(tokenA, "book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: a14.startsAt, p_ends_at: a14.endsAt, p_modality: "IN_PERSON" });
    const createdB = await rpc(tokenB, "book_appointment", { p_patient_id: PATIENT_B.patientId, p_starts_at: b15.startsAt, p_ends_at: b15.endsAt, p_modality: "IN_PERSON" });
    check("preparação: consultas A (14h) e B (15h) criadas", createdA.status === 200 && createdB.status === 200, [createdA.body, createdB.body]);

    console.log(`\n[3] A e B reagendam simultaneamente para ${target.startsAt}`);
    const s3 = summarize(
      await Promise.all([
        rpc(tokenA, "reschedule_appointment", { p_appointment_id: createdA.body, p_starts_at: target.startsAt, p_ends_at: target.endsAt }),
        rpc(tokenB, "reschedule_appointment", { p_appointment_id: createdB.body, p_starts_at: target.startsAt, p_ends_at: target.endsAt }),
      ]),
    );
    check("exatamente 1 reagendamento bem-sucedido", s3.ok === 1, s3.raw);
    check("exatamente 1 recusa (23P01)", s3.slotTaken === 1, s3.raw);
    check("exatamente 1 consulta ativa no destino", (await activeCount(target.startsAt)) === 1);

    // Transação: o reagendamento que falhou NÃO deixou a original como RESCHEDULED.
    const states = await withClient(async (client) => {
      const result = await client.query(`select status from public.appointments where id = any($1::uuid[]) order by starts_at`, [[createdA.body, createdB.body]]);
      return result.rows.map((row) => row.status).sort();
    });
    check("original do reagendamento recusado continua SCHEDULED (rollback atômico)", JSON.stringify(states) === JSON.stringify(["RESCHEDULED", "SCHEDULED"]), states);
    check("nenhuma consulta ativa sobrou nos horários originais além da não reagendada", (await activeCount(a14.startsAt)) + (await activeCount(b15.startsAt)) === 1);
  } finally {
    await cleanup(slot.dateISO);
  }

  console.log(`\n${passed} ok, ${failed} falha(s)`);
  if (failed > 0) process.exit(1);
  console.log("✅ PASS — em cada disputa simultânea, exatamente 1 sucesso e 1 recusa amigável.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
