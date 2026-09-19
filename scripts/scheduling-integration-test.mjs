// Testes de integração da Fase 6 (agenda) contra o Supabase LOCAL de
// verdade — PostgREST/GoTrue com JWTs reais. Cobre via API o que a UI não
// pode provar sozinha: ownership entre pacientes (A x B) e entre
// nutricionistas (B x A), ids adulterados nas funções SQL, agendamento fora
// da disponibilidade/dentro de bloqueio negado no servidor, bloqueio sobre
// consulta ativa recusado, busy_intervals sem vazar paciente, status
// privilegiado pelo paciente e configuração de agenda.
//
// Requer `npm run db:start` + seed. Uso: npm run test:scheduling:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };
const NUTRI_B = { id: "e6000000-0000-0000-0000-000000000001", email: "fase6-nutri-b@example.test", password: "NutricaoDev123" };

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

async function withClient(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function signIn({ email, password }) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
}

function rest(token) {
  const headers = (extra = {}) => ({ apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra });
  return {
    async get(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
      return { status: response.status, body: await response.json() };
    },
    async post(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "POST", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async patch(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async del(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "DELETE", headers: headers({ Prefer: "return=representation" }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async rpc(name, args) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: headers(), body: JSON.stringify(args) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
  };
}

function spSlot(daysAhead, hour) {
  const spDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = spDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + daysAhead));
  const dateISO = target.toISOString().slice(0, 10);
  return { dateISO, weekday: target.getUTCDay(), startsAt: `${dateISO}T${String(hour).padStart(2, "0")}:00:00-03:00`, endsAt: `${dateISO}T${String(hour + 1).padStart(2, "0")}:00:00-03:00` };
}

// Próximo dia útil (seg–sex) a partir de +21 dias, e o próximo sábado (sem regra no seed).
function nextWeekday() {
  for (let offset = 21; offset < 30; offset += 1) {
    const slot = spSlot(offset, 9);
    if (slot.weekday >= 1 && slot.weekday <= 5) return offset;
  }
  throw new Error("sem dia útil");
}
function nextSaturday() {
  for (let offset = 21; offset < 30; offset += 1) {
    if (spSlot(offset, 9).weekday === 6) return offset;
  }
  throw new Error("sem sábado");
}

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 6 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
  });
}

async function cleanup(dates) {
  await withClient(async (client) => {
    for (const dateISO of dates) {
      await client.query(`delete from public.audit_logs where entity_id in (select id from public.appointments where nutritionist_id = $1 and starts_at::date = $2::date)`, [NUTRI_A.id, dateISO]);
      await client.query(`update public.appointments set rescheduled_to_id = null where nutritionist_id = $1 and starts_at::date = $2::date`, [NUTRI_A.id, dateISO]);
      await client.query(`delete from public.appointments where nutritionist_id = $1 and starts_at::date = $2::date`, [NUTRI_A.id, dateISO]);
      await client.query(`delete from public.blocked_times where nutritionist_id = $1 and reason like 'fase6-%' `, [NUTRI_A.id]);
    }
    await client.query(`delete from public.audit_logs where actor_id = $1`, [NUTRI_B.id]);
    await client.query(`delete from public.scheduling_settings where nutritionist_id = $1`, [NUTRI_B.id]);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  const weekdayOffset = nextWeekday();
  const saturdayOffset = nextSaturday();
  const day = spSlot(weekdayOffset, 9);
  const saturday = spSlot(saturdayOffset, 9);
  await cleanup([day.dateISO, saturday.dateISO]);
  await setup();

  try {
    const [tokenA, tokenPA, tokenPB, tokenB] = await Promise.all([signIn(NUTRI_A), signIn(PATIENT_A), signIn(PATIENT_B), signIn(NUTRI_B)]);
    const a = rest(tokenA);
    const pa = rest(tokenPA);
    const pb = rest(tokenPB);
    const b = rest(tokenB);

    // 1) Paciente A agenda para si ------------------------------------------
    console.log(`\n[1] paciente agenda dentro da disponibilidade (${day.startsAt})`);
    const booked = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: day.startsAt, p_ends_at: day.endsAt, p_modality: "IN_PERSON" });
    check("book_appointment devolve uuid", booked.status === 200 && typeof booked.body === "string", booked);
    const apptA = booked.body;

    const row = await pa.get(`appointments?id=eq.${apptA}&select=status,created_by,nutritionist_id,amount_cents`);
    check("consulta SCHEDULED, created_by = paciente, nutritionist_id derivado, sem valor", row.body[0]?.status === "SCHEDULED" && row.body[0]?.nutritionist_id === NUTRI_A.id && row.body[0]?.amount_cents === null, row.body);

    // 2) Fora da disponibilidade / bloqueio / passado negados no servidor --------
    console.log("\n[2] validações no servidor");
    const outside = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: saturday.startsAt, p_ends_at: saturday.endsAt, p_modality: "IN_PERSON" });
    check("sábado (sem regra) -> INVALID_AVAILABILITY", outside.body?.message === "INVALID_AVAILABILITY", outside);
    const lunch = spSlot(weekdayOffset, 12);
    const inGap = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: lunch.startsAt, p_ends_at: lunch.endsAt, p_modality: "IN_PERSON" });
    check("12:00–13:00 (entre os dois intervalos) -> INVALID_AVAILABILITY", inGap.body?.message === "INVALID_AVAILABILITY", inGap);
    const past = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: "2020-01-06T12:00:00-03:00", p_ends_at: "2020-01-06T13:00:00-03:00", p_modality: "IN_PERSON" });
    check("passado -> APPOINTMENT_IN_PAST", past.body?.message === "APPOINTMENT_IN_PAST", past);
    const overlap = await pb.rpc("book_appointment", { p_patient_id: PATIENT_B.patientId, p_starts_at: spSlot(weekdayOffset, 9).startsAt.replace("T09:00", "T09:30"), p_ends_at: spSlot(weekdayOffset, 10).endsAt.replace("T11:00", "T10:30"), p_modality: "IN_PERSON" });
    check("09:30–10:30 sobre 09–10 -> 23P01 (exclusion constraint)", overlap.body?.code === "23P01", overlap);
    const adjacent = await pb.rpc("book_appointment", { p_patient_id: PATIENT_B.patientId, p_starts_at: spSlot(weekdayOffset, 10).startsAt, p_ends_at: spSlot(weekdayOffset, 10).endsAt, p_modality: "ONLINE" });
    check("10–11 adjacente a 09–10 persiste", adjacent.status === 200, adjacent);
    const apptB = adjacent.body;

    // 3) Bloqueio ----------------------------------------------------------------
    console.log("\n[3] bloqueios");
    const blockOver = await a.post("blocked_times", { nutritionist_id: NUTRI_A.id, starts_at: day.startsAt, ends_at: spSlot(weekdayOffset, 10).endsAt, reason: "fase6-conflito" });
    check("bloqueio sobre consultas ativas -> BLOCKED_TIME_CONFLICT", blockOver.body?.message === "BLOCKED_TIME_CONFLICT", blockOver);
    const blockFree = await a.post("blocked_times", { nutritionist_id: NUTRI_A.id, starts_at: spSlot(weekdayOffset, 15).startsAt, ends_at: spSlot(weekdayOffset, 16).endsAt, reason: "fase6-livre" });
    check("bloqueio 15–17 sem consulta é criado", blockFree.status === 201, blockFree);
    const inBlock = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: spSlot(weekdayOffset, 15).startsAt, p_ends_at: spSlot(weekdayOffset, 15).endsAt, p_modality: "IN_PERSON" });
    check("agendar dentro do bloqueio -> BLOCKED_TIME_CONFLICT", inBlock.body?.message === "BLOCKED_TIME_CONFLICT", inBlock);
    const forgedBlock = await b.post("blocked_times", { nutritionist_id: NUTRI_A.id, starts_at: spSlot(weekdayOffset, 16).startsAt, ends_at: spSlot(weekdayOffset, 16).endsAt, reason: "fase6-forjado" });
    check("Nutri B não cria bloqueio na agenda de A (nutritionist_id adulterado)", forgedBlock.status >= 400, forgedBlock);

    // 4) busy_intervals sem vazamento -----------------------------------------------
    console.log("\n[4] busy_intervals");
    const busy = await pb.rpc("busy_intervals", { p_nutritionist_id: NUTRI_A.id, p_from: `${day.dateISO}T00:00:00-03:00`, p_to: `${day.dateISO}T23:59:59-03:00` });
    check("paciente B vê os intervalos ocupados do dia (2 consultas + 1 bloqueio)", busy.status === 200 && busy.body.length === 3, busy.body);
    check("nenhum id ou paciente nos intervalos", busy.body.every((item) => Object.keys(item).sort().join(",") === "ends_at,kind,starts_at"), busy.body?.[0]);
    const otherAppt = await pb.get(`appointments?id=eq.${apptA}&select=id`);
    check("paciente B não lê a consulta do paciente A", otherAppt.body.length === 0);

    // 5) IDOR paciente x paciente ---------------------------------------------------
    console.log("\n[5] paciente B tenta mexer na consulta de A");
    const cancelOther = await pb.patch(`appointments?id=eq.${apptA}`, { status: "CANCELLED", cancelled_at: new Date().toISOString() });
    check("cancelar consulta alheia: 0 linhas afetadas", Array.isArray(cancelOther.body) && cancelOther.body.length === 0, cancelOther);
    const reschedOther = await pb.rpc("reschedule_appointment", { p_appointment_id: apptA, p_starts_at: spSlot(weekdayOffset, 11).startsAt, p_ends_at: spSlot(weekdayOffset, 11).endsAt });
    check("reagendar consulta alheia -> APPOINTMENT_NOT_FOUND", reschedOther.body?.message === "APPOINTMENT_NOT_FOUND", reschedOther);
    const bookForOther = await pb.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: spSlot(weekdayOffset, 11).startsAt, p_ends_at: spSlot(weekdayOffset, 11).endsAt, p_modality: "IN_PERSON" });
    check("agendar para outro paciente -> PATIENT_NOT_FOUND", bookForOther.body?.message === "PATIENT_NOT_FOUND", bookForOther);
    const stillActive = await pa.get(`appointments?id=eq.${apptA}&select=status`);
    check("consulta de A continua SCHEDULED", stillActive.body[0]?.status === "SCHEDULED");

    // 6) Status privilegiado pelo paciente ------------------------------------------
    console.log("\n[6] paciente não altera status clínico/admin");
    for (const status of ["COMPLETED", "NO_SHOW", "CONFIRMED"]) {
      const attempt = await pa.patch(`appointments?id=eq.${apptA}`, { status });
      check(`PATCH status=${status} pelo paciente é recusado`, attempt.status >= 400 && attempt.body?.message === "INVALID_APPOINTMENT_STATUS_TRANSITION", attempt);
    }
    const forgedAmount = await pa.patch(`appointments?id=eq.${apptA}`, { amount_cents: 1 });
    check("paciente não altera amount_cents", forgedAmount.status >= 400, forgedAmount);

    // 7) IDOR nutricionista x nutricionista ---------------------------------------------
    console.log("\n[7] Nutri B tenta mexer na agenda de A");
    const bReads = await b.get(`appointments?id=eq.${apptA}&select=id`);
    check("Nutri B não lê consulta de A", bReads.body.length === 0);
    const bConfirms = await b.patch(`appointments?id=eq.${apptA}`, { status: "CONFIRMED" });
    check("Nutri B não confirma consulta de A (0 linhas)", Array.isArray(bConfirms.body) && bConfirms.body.length === 0, bConfirms);
    const bBooks = await b.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: spSlot(weekdayOffset, 11).startsAt, p_ends_at: spSlot(weekdayOffset, 11).endsAt, p_modality: "IN_PERSON", p_allow_outside_availability: true });
    check("Nutri B não agenda para paciente de A -> PATIENT_NOT_FOUND", bBooks.body?.message === "PATIENT_NOT_FOUND", bBooks);
    const bSettings = await b.post("scheduling_settings", { nutritionist_id: NUTRI_A.id, default_duration_minutes: 15 });
    check("Nutri B não grava configuração de A", bSettings.status >= 400, bSettings);
    const bRules = await b.del(`availability_rules?nutritionist_id=eq.${NUTRI_A.id}`);
    check("Nutri B não apaga disponibilidade de A (0 linhas)", Array.isArray(bRules.body) && bRules.body.length === 0, bRules);

    // 8) Nutricionista A: transições e reagendamento com histórico --------------------------
    console.log("\n[8] transições pelo nutricionista A");
    const confirm = await a.patch(`appointments?id=eq.${apptA}`, { status: "CONFIRMED" });
    check("A confirma a consulta", confirm.body?.[0]?.status === "CONFIRMED", confirm);
    const resched = await a.rpc("reschedule_appointment", { p_appointment_id: apptA, p_starts_at: spSlot(weekdayOffset, 11).startsAt, p_ends_at: spSlot(weekdayOffset, 11).endsAt });
    check("A reagenda para 11:00 (nova consulta criada)", resched.status === 200 && typeof resched.body === "string", resched);
    const chain = await a.get(`appointments?id=in.(${apptA},${resched.body})&select=id,status,rescheduled_to_id,amount_cents,contract_id&order=starts_at`);
    check("original RESCHEDULED apontando para a nova; nova SCHEDULED", chain.body.find((r) => r.id === apptA)?.status === "RESCHEDULED" && chain.body.find((r) => r.id === apptA)?.rescheduled_to_id === resched.body && chain.body.find((r) => r.id === resched.body)?.status === "SCHEDULED", chain.body);
    const reopen = await a.patch(`appointments?id=eq.${apptA}`, { status: "SCHEDULED" });
    // O trigger não impede o nutricionista de tudo; a máquina de estados da
    // aplicação é quem barra — aqui só garantimos que a linha antiga continua
    // sendo histórico (o service nunca chama isto).
    check("linha antiga continua existindo (histórico preservado)", reopen.status < 500);
    await a.patch(`appointments?id=eq.${apptA}`, { status: "RESCHEDULED" });

    const cancelB = await pb.patch(`appointments?id=eq.${apptB}`, { status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: "teste" });
    check("paciente B cancela a própria consulta", cancelB.body?.[0]?.status === "CANCELLED", cancelB);
    const rebook = await pa.rpc("book_appointment", { p_patient_id: PATIENT_A.patientId, p_starts_at: spSlot(weekdayOffset, 10).startsAt, p_ends_at: spSlot(weekdayOffset, 10).endsAt, p_modality: "IN_PERSON" });
    check("horário cancelado (10–11) volta a ficar disponível", rebook.status === 200, rebook);

    // 9) Configuração --------------------------------------------------------------------
    console.log("\n[9] scheduling_settings");
    const readSettings = await pa.get(`scheduling_settings?nutritionist_id=eq.${NUTRI_A.id}&select=default_duration_minutes,timezone`);
    check("paciente lê a configuração do nutricionista", readSettings.body[0]?.timezone === "America/Sao_Paulo");
    const patientWrites = await pa.patch(`scheduling_settings?nutritionist_id=eq.${NUTRI_A.id}`, { default_duration_minutes: 5 });
    check("paciente não altera a configuração (0 linhas)", Array.isArray(patientWrites.body) && patientWrites.body.length === 0, patientWrites);
    const ownSettings = await b.post("scheduling_settings", { nutritionist_id: NUTRI_B.id, default_duration_minutes: 45, slot_granularity_minutes: 15 });
    check("Nutri B cria a própria configuração", ownSettings.status === 201, ownSettings);
  } finally {
    await cleanup([day.dateISO, saturday.dateISO]);
  }

  console.log(`\n${passed} ok, ${failed} falha(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
