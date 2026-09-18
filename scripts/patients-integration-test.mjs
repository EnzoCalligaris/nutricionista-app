// Testes de integração da Fase 5 (pacientes + contratos) contra o Supabase
// LOCAL de verdade — PostgREST/GoTrue com JWTs reais, como a aplicação faz —
// cobrindo o que o pgTAP (que roda numa transação única como superuser)
// não exercita: RLS via API, ownership entre DOIS nutricionistas, IDs
// adulterados na request, funções SQL chamadas via RPC e o índice único de
// e-mail. Mesmo padrão de scripts/auth-integration-test.mjs: requer
// `npm run db:start` e o seed; fica fora do `npm run test:run`.
//
// Uso: npm run test:patients:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

// Nutricionista A e paciente Fulana: seed (supabase/seed.sql).
const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT_LOGIN = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";
const FULANA_CONTRACT_ID = "90000000-0000-0000-0000-000000000301";

// Nutricionista B: criado por este script (via pg), removido no fim.
const NUTRI_B_ID = "e5000000-0000-0000-0000-000000000001";
const NUTRI_B = { email: "fase5-nutri-b@example.test", password: "NutricaoDev123" };
const NUTRI_B_PATIENT_ID = "e5000000-0000-0000-0000-000000000010";

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
  return { token: body.access_token, userId: body.user.id };
}

function rest(token) {
  const headers = (extra = {}) => ({
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  });
  return {
    async get(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
      return { status: response.status, body: await response.json() };
    },
    async post(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "POST",
        headers: headers({ Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async patch(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=representation" }),
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async rpc(name, args) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(args),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
  };
}

async function setup() {
  await withClient(async (client) => {
    await client.query("begin");
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B_ID, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(
      `insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 5 Nutri B')
       on conflict (id) do update set role = excluded.role, full_name = excluded.full_name`,
      [NUTRI_B_ID],
    );
    await client.query(
      `insert into public.patients (id, nutritionist_id, full_name, email) values ($1, $2, 'Paciente de B', 'paciente.de.b@example.test')
       on conflict (id) do nothing`,
      [NUTRI_B_PATIENT_ID, NUTRI_B_ID],
    );
    await client.query("commit");
  });
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query("begin");
    // Contratos/parcelas/pagamentos criados pelo teste para pacientes de A.
    await client.query(
      `delete from public.audit_logs where entity_id in (select id from public.patients where email like 'fase5-%@example.test')`,
    );
    await client.query(
      `delete from public.contract_installments where contract_id in (
         select id from public.patient_contracts where patient_id in (select id from public.patients where email like 'fase5-%@example.test'))`,
    );
    await client.query(
      `delete from public.patient_contracts where patient_id in (select id from public.patients where email like 'fase5-%@example.test')`,
    );
    await client.query(`delete from public.patients where email like 'fase5-%@example.test'`);
    await client.query(`delete from public.patients where id = $1`, [NUTRI_B_PATIENT_ID]);
    await client.query(`delete from public.audit_logs where actor_id = $1`, [NUTRI_B_ID]);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B_ID]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B_ID]);
    await client.query("commit");
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await setup();

  try {
    const a = rest((await signIn(NUTRI_A)).token);
    const bSession = await signIn(NUTRI_B);
    const b = rest(bSession.token);
    const patientSession = await signIn(PATIENT_LOGIN);
    const p = rest(patientSession.token);

    // 1) Listagem via view -------------------------------------------------
    console.log("\n[1] patient_overview escopada por RLS");
    const aList = await a.get("patient_overview?select=patient_id,full_name,is_effectively_active&order=full_name");
    check("Nutri A lista os 5 pacientes do seed", aList.status === 200 && aList.body.length === 5, aList.body);
    check(
      "is_effectively_active = true só para quem tem contrato ACTIVE (Fulana, Beltrano)",
      aList.body.filter((row) => row.is_effectively_active).map((row) => row.full_name).sort().join(",") ===
        "Beltrano da Silva,Fulana de Tal",
    );
    const bList = await b.get("patient_overview?select=patient_id");
    check("Nutri B só vê o próprio paciente (não os de A)", bList.status === 200 && bList.body.length === 1, bList.body);

    // 2) IDOR: B lê/edita paciente de A --------------------------------------
    console.log("\n[2] ownership entre nutricionistas (IDOR)");
    const bReads = await b.get(`patients?id=eq.${FULANA_ID}&select=id`);
    check("Nutri B não lê paciente de A pelo id", bReads.status === 200 && bReads.body.length === 0);

    const bUpdates = await b.patch(`patients?id=eq.${FULANA_ID}`, { full_name: "HACKED" });
    check("Nutri B não edita paciente de A (0 linhas afetadas)", Array.isArray(bUpdates.body) && bUpdates.body.length === 0, bUpdates);
    const stillIntact = await a.get(`patients?id=eq.${FULANA_ID}&select=full_name`);
    check("Nome de Fulana continua intacto", stillIntact.body[0]?.full_name === "Fulana de Tal");

    const bArchives = await b.patch(`patients?id=eq.${FULANA_ID}`, { status: "INACTIVE" });
    check("Nutri B não desativa paciente de A", Array.isArray(bArchives.body) && bArchives.body.length === 0);

    const bContracts = await b.get(`patient_contracts?patient_id=eq.${FULANA_ID}&select=id`);
    check("Nutri B não lê contratos do paciente de A", bContracts.status === 200 && bContracts.body.length === 0);

    // 3) IDs adulterados nas funções SQL --------------------------------------
    console.log("\n[3] patient_id / contract_id adulterados via RPC");
    const bCreates = await b.rpc("create_contract_with_installments", {
      p_patient_id: FULANA_ID,
      p_plan_id: (await a.get("plans?code=eq.AVULSA&select=id")).body[0].id,
      p_start_date: "2026-09-18",
      p_contracted_amount_cents: 23000,
      p_installments: [{ number: 1, amount_cents: 23000, due_date: "2026-09-18" }],
    });
    check("B criando contrato para paciente de A -> PATIENT_NOT_FOUND", bCreates.status >= 400 && bCreates.body?.message === "PATIENT_NOT_FOUND", bCreates);

    const bCancels = await b.rpc("cancel_contract", { p_contract_id: FULANA_CONTRACT_ID });
    check("B cancelando contrato de A -> CONTRACT_NOT_FOUND", bCancels.status >= 400 && bCancels.body?.message === "CONTRACT_NOT_FOUND", bCancels);
    const contractStill = await a.get(`patient_contracts?id=eq.${FULANA_CONTRACT_ID}&select=status`);
    check("Contrato de Fulana continua ACTIVE", contractStill.body[0]?.status === "ACTIVE");

    const bCompletes = await b.rpc("complete_contract", { p_contract_id: FULANA_CONTRACT_ID });
    check("B encerrando contrato de A -> CONTRACT_NOT_FOUND", bCompletes.status >= 400 && bCompletes.body?.message === "CONTRACT_NOT_FOUND");

    // Paciente autenticado (role PATIENT) tentando agir como nutricionista.
    const pCreatesPatient = await p.post("patients", {
      nutritionist_id: patientSession.userId,
      full_name: "Escalação",
      email: "fase5-escalacao@example.test",
    });
    check("PATIENT não insere em patients (RLS)", pCreatesPatient.status >= 400, pCreatesPatient);
    const pCreatesContract = await p.rpc("create_contract_with_installments", {
      p_patient_id: FULANA_ID,
      p_plan_id: (await a.get("plans?code=eq.AVULSA&select=id")).body[0].id,
      p_start_date: "2026-09-18",
      p_contracted_amount_cents: 23000,
      p_installments: [{ number: 1, amount_cents: 23000, due_date: "2026-09-18" }],
    });
    check("PATIENT não cria contrato para si (PATIENT_NOT_FOUND)", pCreatesContract.status >= 400 && pCreatesContract.body?.message === "PATIENT_NOT_FOUND");

    // 4) Fluxo completo como Nutri A ----------------------------------------
    console.log("\n[4] criar paciente -> editar -> contrato -> parcelas -> cancelar -> histórico");
    const created = await a.post("patients", {
      nutritionist_id: (await signIn(NUTRI_A)).userId,
      full_name: "Fase 5 Integração",
      email: "fase5-integracao@example.test",
      birth_date: "1990-05-20",
    });
    check("A cria paciente", created.status === 201 && created.body?.[0]?.id, created);
    const newPatientId = created.body?.[0]?.id;

    const duplicate = await a.post("patients", {
      nutritionist_id: (await signIn(NUTRI_A)).userId,
      full_name: "Duplicado",
      email: "FASE5-INTEGRACAO@example.test",
    });
    check("E-mail duplicado (case-insensitive) é rejeitado pelo banco (23505)", duplicate.status === 409 && duplicate.body?.code === "23505", duplicate);

    const forgedOwner = await a.post("patients", {
      nutritionist_id: NUTRI_B_ID,
      full_name: "Dono forjado",
      email: "fase5-forjado@example.test",
    });
    check("A não cria paciente em nome de B (nutritionist_id adulterado)", forgedOwner.status >= 400, forgedOwner);

    const edited = await a.patch(`patients?id=eq.${newPatientId}`, { phone: "+55 11 90000-0099", full_name: "Fase 5 Integração Editada" });
    check("A edita o próprio paciente", edited.status === 200 && edited.body?.[0]?.phone === "+55 11 90000-0099", edited);

    const overviewBefore = await a.get(`patient_overview?patient_id=eq.${newPatientId}&select=is_effectively_active,current_contract_id`);
    check("Paciente novo sem contrato não é ativo", overviewBefore.body[0]?.is_effectively_active === false && overviewBefore.body[0]?.current_contract_id === null);

    const trimestral = (await a.get("plans?code=eq.TRIMESTRAL&select=id,plan_prices(id,label)")).body[0];
    const parcelado = trimestral.plan_prices.find((price) => price.label.startsWith("Parcelado"));
    const createdContract = await a.rpc("create_contract_with_installments", {
      p_patient_id: newPatientId,
      p_plan_id: trimestral.id,
      p_plan_price_id: parcelado.id,
      p_start_date: "2026-01-31",
      p_end_date: "2026-04-30",
      p_contracted_amount_cents: 100000,
      p_installments: [
        { number: 1, amount_cents: 33334, due_date: "2026-01-31" },
        { number: 2, amount_cents: 33333, due_date: "2026-02-28" },
        { number: 3, amount_cents: 33333, due_date: "2026-03-31" },
      ],
      p_notes: "contrato de integração",
    });
    check("A cria contrato via RPC (retorna uuid)", createdContract.status === 200 && typeof createdContract.body === "string", createdContract);
    const contractId = createdContract.body;

    const installments = await a.get(`contract_installments?contract_id=eq.${contractId}&select=number,amount_cents,due_date,status&order=number`);
    check(
      "3 parcelas PENDING com remainder e datas 31/01 -> 28/02 -> 31/03",
      installments.body.length === 3 &&
        installments.body.map((row) => row.amount_cents).join(",") === "33334,33333,33333" &&
        installments.body.map((row) => row.due_date).join(",") === "2026-01-31,2026-02-28,2026-03-31" &&
        installments.body.every((row) => row.status === "PENDING"),
      installments.body,
    );

    const summary = await a.get(`contract_financial_summary?contract_id=eq.${contractId}&select=contracted_amount_cents,received_cents,pending_cents,forecast_cents`);
    check(
      "contract_financial_summary: contratado 100000 / recebido 0 / pendente 100000 / previsto 100000",
      summary.body[0]?.contracted_amount_cents === 100000 &&
        summary.body[0]?.received_cents === 0 &&
        summary.body[0]?.pending_cents === 100000 &&
        summary.body[0]?.forecast_cents === 100000,
      summary.body,
    );

    const overviewAfter = await a.get(`patient_overview?patient_id=eq.${newPatientId}&select=is_effectively_active,current_contract_id,current_plan_code`);
    check(
      "Paciente passa a ativo com o contrato atual = TRIMESTRAL",
      overviewAfter.body[0]?.is_effectively_active === true && overviewAfter.body[0]?.current_contract_id === contractId && overviewAfter.body[0]?.current_plan_code === "TRIMESTRAL",
      overviewAfter.body,
    );

    const badSum = await a.rpc("create_contract_with_installments", {
      p_patient_id: newPatientId,
      p_plan_id: trimestral.id,
      p_start_date: "2026-01-31",
      p_contracted_amount_cents: 100000,
      p_installments: [{ number: 1, amount_cents: 99999, due_date: "2026-01-31" }],
    });
    check("Soma de parcelas errada -> INVALID_INSTALLMENTS", badSum.status >= 400 && badSum.body?.message === "INVALID_INSTALLMENTS", badSum);

    // Cancelamento preserva histórico.
    const cancelled = await a.rpc("cancel_contract", { p_contract_id: contractId });
    check("A cancela o próprio contrato", cancelled.status === 200 || cancelled.status === 204, cancelled);
    const afterCancel = await a.get(`patient_contracts?id=eq.${contractId}&select=status,cancelled_at,notes`);
    check("Contrato CANCELLED com cancelled_at e observações preservadas", afterCancel.body[0]?.status === "CANCELLED" && afterCancel.body[0]?.cancelled_at && afterCancel.body[0]?.notes === "contrato de integração");
    const installmentsAfter = await a.get(`contract_installments?contract_id=eq.${contractId}&select=status&order=number`);
    check("Parcelas continuam existindo, agora CANCELLED", installmentsAfter.body.length === 3 && installmentsAfter.body.every((row) => row.status === "CANCELLED"));
    const summaryAfter = await a.get(`contract_financial_summary?contract_id=eq.${contractId}&select=pending_cents,forecast_cents`);
    check("Após cancelar: pendente 0 e previsto 0", summaryAfter.body[0]?.pending_cents === 0 && summaryAfter.body[0]?.forecast_cents === 0, summaryAfter.body);

    // Novo contrato (semestral) após o cancelado — ambos consultáveis.
    const semestral = (await a.get("plans?code=eq.SEMESTRAL&select=id")).body[0];
    const second = await a.rpc("create_contract_with_installments", {
      p_patient_id: newPatientId,
      p_plan_id: semestral.id,
      p_start_date: "2026-05-01",
      p_end_date: "2026-11-01",
      p_contracted_amount_cents: 128760,
      p_installments: [
        { number: 1, amount_cents: 21460, due_date: "2026-05-01" },
        { number: 2, amount_cents: 21460, due_date: "2026-06-01" },
        { number: 3, amount_cents: 21460, due_date: "2026-07-01" },
        { number: 4, amount_cents: 21460, due_date: "2026-08-01" },
        { number: 5, amount_cents: 21460, due_date: "2026-09-01" },
        { number: 6, amount_cents: 21460, due_date: "2026-10-01" },
      ],
    });
    check("Segundo contrato (semestral) criado", second.status === 200, second);
    const history = await a.get(`patient_contracts?patient_id=eq.${newPatientId}&select=status,plans(code)&order=start_date`);
    check(
      "Histórico preserva os dois contratos (TRIMESTRAL cancelado + SEMESTRAL ativo)",
      history.body.length === 2 && history.body[0].status === "CANCELLED" && history.body[1].status === "ACTIVE" && history.body[1].plans.code === "SEMESTRAL",
      history.body,
    );

    const completed = await a.rpc("complete_contract", { p_contract_id: second.body });
    check("A encerra o segundo contrato", completed.status === 200 || completed.status === 204, completed);
    const installmentsCompleted = await a.get(`contract_installments?contract_id=eq.${second.body}&select=status`);
    check("Encerrar não altera parcelas (continuam PENDING)", installmentsCompleted.body.every((row) => row.status === "PENDING"));

    // Desativar/reativar preserva contratos.
    const archived = await a.patch(`patients?id=eq.${newPatientId}`, { status: "INACTIVE", archived_at: new Date().toISOString() });
    check("A desativa o paciente", archived.status === 200 && archived.body?.[0]?.status === "INACTIVE");
    const contractsAfterArchive = await a.get(`patient_contracts?patient_id=eq.${newPatientId}&select=id`);
    check("Contratos preservados após desativação", contractsAfterArchive.body.length === 2);
    const reactivated = await a.patch(`patients?id=eq.${newPatientId}`, { status: "ACTIVE", archived_at: null });
    check("A reativa o paciente", reactivated.status === 200 && reactivated.body?.[0]?.status === "ACTIVE" && reactivated.body?.[0]?.archived_at === null);

    // 5) Auditoria -----------------------------------------------------------
    console.log("\n[5] audit_logs");
    const forgedAudit = await a.post("audit_logs", {
      actor_id: NUTRI_B_ID,
      action: "PATIENT_CREATED",
      entity_type: "patient",
      entity_id: newPatientId,
    });
    check("Nutri A não registra auditoria em nome de B (actor_id adulterado)", forgedAudit.status >= 400, forgedAudit);
    const patientAudit = await p.post("audit_logs", {
      actor_id: patientSession.userId,
      action: "PATIENT_CREATED",
      entity_type: "patient",
      entity_id: FULANA_ID,
    });
    check("PATIENT não escreve em audit_logs", patientAudit.status >= 400, patientAudit);
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} ok, ${failed} falha(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
