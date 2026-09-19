// Testes de integração da Fase 7 (financeiro) contra o Supabase LOCAL de
// verdade — PostgREST/GoTrue com JWTs reais, exatamente o caminho que o
// app usa. Cobre: lançamento manual de receita/despesa (trigger de
// ownership e valor), resumo do período (receita/despesa/saldo), pagamento
// manual (parcial, total, a maior, idempotência), estorno, previsão por
// contrato (ativo x cancelado), ownership entre nutricionistas (B x A, ids
// adulterados) e o registro de auditoria.
//
// Requer `npm run db:start` + seed. Uso: npm run test:financial:integration

import pg from "pg";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const NUTRI_B = { id: "e7000000-0000-0000-0000-000000000001", email: "fase7-nutri-b@example.test", password: "NutricaoDev123" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const BELTRANO_ID = "90000000-0000-0000-0000-000000000011";
// Contrato semestral do Beltrano (seed): 6x de R$214,60, 3 pagas.
const CONTRACT_BELTRANO = "90000000-0000-0000-0000-000000000302";
const INSTALLMENT_BELTRANO_4 = "90000000-0000-0000-0000-000000000334";
const CONTRACT_CANCELLED = "90000000-0000-0000-0000-000000000304";
const CATEGORY_INCOME = "90000000-0000-0000-0000-000000000201";
const CATEGORY_EXPENSE = "90000000-0000-0000-0000-000000000202";
const TAG = "fase7-it";

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

function todaySP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 7 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
  });
}

async function cleanup() {
  await withClient(async (client) => {
    // Pagamentos deste teste (chave com prefixo) e seus lançamentos; a parcela 4 do Beltrano volta a PENDING.
    await client.query(`delete from public.audit_logs where metadata->>'tag' = $1`, [TAG]);
    await client.query(`delete from public.financial_transactions where origin_payment_id in (select id from public.payments where idempotency_key like $1)`, [`${TAG}%`]);
    await client.query(`delete from public.payments where idempotency_key like $1`, [`${TAG}%`]);
    await client.query(`update public.contract_installments set status = 'PENDING', paid_at = null where id = $1`, [INSTALLMENT_BELTRANO_4]);
    await client.query(`delete from public.financial_transactions where description like $1`, [`${TAG}%`]);
    await client.query(`delete from public.audit_logs where actor_id = $1`, [NUTRI_B.id]);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();
  const today = todaySP();

  try {
    const [tokenA, tokenB, tokenP] = await Promise.all([signIn(NUTRI_A), signIn(NUTRI_B), signIn(PATIENT_A)]);
    const a = rest(tokenA);
    const b = rest(tokenB);
    const p = rest(tokenP);

    // 1) Lançamentos manuais ------------------------------------------------------
    console.log("\n[1] lançamento manual de receita e despesa");
    const before = await a.rpc("financial_period_summary", { p_from: today, p_to: today, p_timezone: "America/Sao_Paulo" });
    check("resumo do período responde", before.status === 200 && Array.isArray(before.body), before);
    const base = before.body[0];

    const income = await a.post("financial_transactions", { type: "INCOME", category_id: CATEGORY_INCOME, description: `${TAG} receita`, amount_cents: 23000, status: "CONFIRMED", occurred_on: today, payment_method: "PIX", origin: "MANUAL" });
    check("receita manual criada (trigger preenche nutritionist_id)", income.status === 201 && income.body?.[0]?.nutritionist_id === NUTRI_A.id, income);
    const expense = await a.post("financial_transactions", { type: "EXPENSE", category_id: CATEGORY_EXPENSE, description: `${TAG} despesa`, amount_cents: 8000, status: "CONFIRMED", occurred_on: today, origin: "MANUAL" });
    check("despesa manual criada", expense.status === 201, expense);
    const pendingTx = await a.post("financial_transactions", { type: "INCOME", description: `${TAG} pendente`, amount_cents: 5000, status: "PENDING", occurred_on: today, due_on: today, origin: "MANUAL" });
    check("receita pendente criada", pendingTx.status === 201, pendingTx);
    const zero = await a.post("financial_transactions", { type: "INCOME", description: `${TAG} zero`, amount_cents: 0, status: "CONFIRMED", occurred_on: today, origin: "MANUAL" });
    check("valor zero é recusado (INVALID_AMOUNT)", zero.status === 400 && zero.body?.message === "INVALID_AMOUNT", zero);

    const after = await a.rpc("financial_period_summary", { p_from: today, p_to: today, p_timezone: "America/Sao_Paulo" });
    const now = after.body[0];
    check("receita do período subiu exatamente R$230 (pendente não conta)", Number(now.income_cents) - Number(base.income_cents) === 23000, { base, now });
    check("despesa do período subiu exatamente R$80", Number(now.expense_cents) - Number(base.expense_cents) === 8000, { base, now });
    check("saldo = receita − despesa", Number(now.balance_cents) === Number(now.income_cents) - Number(now.expense_cents), now);

    const edited = await a.patch(`financial_transactions?id=eq.${income.body[0].id}`, { amount_cents: 25000, description: `${TAG} receita editada` });
    check("lançamento manual é editável", edited.status === 200 && edited.body?.[0]?.amount_cents === 25000, edited);
    const cancelled = await a.patch(`financial_transactions?id=eq.${expense.body[0].id}`, { status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: "teste" });
    check("cancelar lançamento mantém a linha (status CANCELLED)", cancelled.status === 200 && cancelled.body?.[0]?.status === "CANCELLED", cancelled);
    const del = await a.del(`financial_transactions?id=eq.${expense.body[0].id}`);
    check("DELETE em lançamentos é negado", del.status === 401 || del.status === 403 || del.status === 404 || (del.status === 200 && Array.isArray(del.body) && del.body.length === 0), del);
    const afterCancel = await a.rpc("financial_period_summary", { p_from: today, p_to: today, p_timezone: "America/Sao_Paulo" });
    check("despesa cancelada sai do total", Number(afterCancel.body[0].expense_cents) === Number(base.expense_cents), afterCancel.body);

    // 2) Pagamento manual: parcial, total, a maior, idempotência ------------------
    console.log("\n[2] pagamento manual na parcela 4 do Beltrano (R$214,60)");
    const summary0 = (await a.get(`contract_financial_summary?contract_id=eq.${CONTRACT_BELTRANO}`)).body[0];
    check("baseline do contrato: 1287,60 / recebido 643,80 / pendente 643,80 / previsto 643,80", summary0 && Number(summary0.contracted_amount_cents) === 128760 && Number(summary0.received_cents) === 64380 && Number(summary0.pending_cents) === 64380 && Number(summary0.forecast_cents) === 64380, summary0);

    const keyPartial = `${TAG}-${randomUUID()}`;
    const partial = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 10000, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: keyPartial, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("pagamento parcial de R$100 aceito", partial.status === 200 && typeof partial.body === "string", partial);
    const balance1 = (await a.get(`installment_payment_summary?installment_id=eq.${INSTALLMENT_BELTRANO_4}`)).body[0];
    check("restante da parcela = R$114,60", balance1?.remaining_cents === 11460 && balance1?.received_cents === 10000, balance1);
    const inst1 = (await a.get(`contract_installments?id=eq.${INSTALLMENT_BELTRANO_4}&select=status`)).body[0];
    check("parcela continua PENDING após parcial", inst1?.status === "PENDING", inst1);
    const txPartial = (await a.get(`financial_transactions?origin_payment_id=eq.${partial.body}&select=type,status,amount_cents,patient_id,origin`)).body;
    check("1 lançamento INCOME CONFIRMED de R$100 vinculado ao paciente", txPartial.length === 1 && txPartial[0].type === "INCOME" && txPartial[0].status === "CONFIRMED" && txPartial[0].amount_cents === 10000 && txPartial[0].patient_id === BELTRANO_ID && txPartial[0].origin === "PAYMENT", txPartial);

    const again = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 10000, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: keyPartial, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("reenvio idêntico devolve o mesmo pagamento (idempotente)", again.status === 200 && again.body === partial.body, again);
    const paymentsForKey = (await a.get(`payments?idempotency_key=eq.${keyPartial}&select=id`)).body;
    check("só existe 1 pagamento para a chave", paymentsForKey.length === 1, paymentsForKey);

    // Duas requisições simultâneas com a mesma chave (clique duplo real).
    const keyRace = `${TAG}-${randomUUID()}`;
    const raceArgs = { p_patient_id: BELTRANO_ID, p_amount_cents: 1000, p_method: "CASH", p_paid_at: new Date().toISOString(), p_idempotency_key: keyRace, p_installment_id: INSTALLMENT_BELTRANO_4 };
    const [r1, r2] = await Promise.all([a.rpc("record_manual_payment", raceArgs), a.rpc("record_manual_payment", raceArgs)]);
    check("clique duplo simultâneo: ambos 200 com o mesmo id", r1.status === 200 && r2.status === 200 && r1.body === r2.body, { r1, r2 });
    const balanceRace = (await a.get(`installment_payment_summary?installment_id=eq.${INSTALLMENT_BELTRANO_4}`)).body[0];
    check("restante caiu só R$10 (uma vez)", balanceRace?.remaining_cents === 10460, balanceRace);

    const over = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 10461, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: `${TAG}-${randomUUID()}`, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("R$104,61 em restante de R$104,60 é recusado (PAYMENT_EXCEEDS_INSTALLMENT)", over.status === 400 && over.body?.message === "PAYMENT_EXCEEDS_INSTALLMENT", over);
    const neg = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: -5, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: `${TAG}-${randomUUID()}`, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("valor negativo é recusado (INVALID_AMOUNT)", neg.status === 400 && neg.body?.message === "INVALID_AMOUNT", neg);

    const keyRest = `${TAG}-${randomUUID()}`;
    const rest_ = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 10460, p_method: "CARD", p_paid_at: new Date().toISOString(), p_idempotency_key: keyRest, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("pagamento do restante aceito", rest_.status === 200, rest_);
    const inst2 = (await a.get(`contract_installments?id=eq.${INSTALLMENT_BELTRANO_4}&select=status,paid_at`)).body[0];
    check("parcela vira PAID com paid_at", inst2?.status === "PAID" && inst2?.paid_at, inst2);
    const summary1 = (await a.get(`contract_financial_summary?contract_id=eq.${CONTRACT_BELTRANO}`)).body[0];
    check("previsão recalculada: recebido 858,40 / pendente 429,20 / previsto 429,20", Number(summary1.received_cents) === 85840 && Number(summary1.pending_cents) === 42920 && Number(summary1.forecast_cents) === 42920, summary1);
    const paidAgain = await a.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 1, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: `${TAG}-${randomUUID()}`, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("parcela quitada não aceita novo pagamento", paidAgain.status === 400 && paidAgain.body?.message === "INSTALLMENT_NOT_PAYABLE", paidAgain);

    const notEditable = await a.patch(`financial_transactions?origin_payment_id=eq.${rest_.body}`, { amount_cents: 1 });
    check("lançamento gerado por pagamento não é editável", notEditable.status === 400 && notEditable.body?.message === "FINANCIAL_TRANSACTION_NOT_EDITABLE", notEditable);

    // 3) Estorno ------------------------------------------------------------------
    console.log("\n[3] estorno preserva histórico e reabre a parcela");
    const refund = await a.rpc("cancel_payment", { p_payment_id: rest_.body, p_reason: "teste" });
    check("estorno executa", refund.status === 200 || refund.status === 204, refund);
    const refunded = (await a.get(`payments?id=eq.${rest_.body}&select=status,paid_at,cancellation_reason`)).body[0];
    check("pagamento fica REFUNDED com paid_at preservado", refunded?.status === "REFUNDED" && refunded?.paid_at && refunded?.cancellation_reason === "teste", refunded);
    const inst3 = (await a.get(`contract_installments?id=eq.${INSTALLMENT_BELTRANO_4}&select=status`)).body[0];
    const balance3 = (await a.get(`installment_payment_summary?installment_id=eq.${INSTALLMENT_BELTRANO_4}`)).body[0];
    check("parcela volta a PENDING com restante R$104,60", inst3?.status === "PENDING" && balance3?.remaining_cents === 10460, { inst3, balance3 });
    const txRefund = (await a.get(`financial_transactions?origin_payment_id=eq.${rest_.body}&select=status`)).body[0];
    check("lançamento do pagamento estornado fica CANCELLED", txRefund?.status === "CANCELLED", txRefund);
    const twice = await a.rpc("cancel_payment", { p_payment_id: rest_.body });
    check("estornar duas vezes é recusado", twice.status === 400 && twice.body?.message === "INVALID_STATUS_TRANSITION", twice);

    // 4) Previsão: contrato cancelado ----------------------------------------------
    console.log("\n[4] previsão por contrato");
    const cancelledSummary = (await a.get(`contract_financial_summary?contract_id=eq.${CONTRACT_CANCELLED}`)).body[0];
    check("contrato cancelado: previsto 0 (histórico de recebido preservado)", cancelledSummary && Number(cancelledSummary.forecast_cents) === 0 && Number(cancelledSummary.received_cents) === 22679, cancelledSummary);
    const monthly = await a.rpc("monthly_financial_series", { p_months: 3, p_timezone: "America/Sao_Paulo", p_months_ahead: 3 });
    check("série mensal devolve 6 meses (3 passados + 3 futuros)", monthly.status === 200 && monthly.body?.length === 6, monthly);

    // 5) Ownership -----------------------------------------------------------------
    console.log("\n[5] ownership: Nutri B x dados de A; paciente x financeiro");
    const bReads = await b.get(`financial_transactions?select=id&nutritionist_id=eq.${NUTRI_A.id}`);
    check("Nutri B não lê lançamentos de A", bReads.status === 200 && bReads.body.length === 0, bReads);
    const bPatch = await b.patch(`financial_transactions?id=eq.${income.body[0].id}`, { amount_cents: 1 });
    check("Nutri B não edita lançamento de A (0 linhas)", Array.isArray(bPatch.body) && bPatch.body.length === 0, bPatch);
    const bPay = await b.rpc("record_manual_payment", { p_patient_id: BELTRANO_ID, p_amount_cents: 100, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: `${TAG}-${randomUUID()}`, p_installment_id: INSTALLMENT_BELTRANO_4 });
    check("Nutri B não registra pagamento para paciente de A (PATIENT_NOT_FOUND)", bPay.status === 400 && bPay.body?.message === "PATIENT_NOT_FOUND", bPay);
    const bRefund = await b.rpc("cancel_payment", { p_payment_id: partial.body });
    check("Nutri B não estorna pagamento de A (PAYMENT_NOT_FOUND)", bRefund.status === 400 && bRefund.body?.message === "PAYMENT_NOT_FOUND", bRefund);
    const bForecast = await b.get(`contract_financial_summary?contract_id=eq.${CONTRACT_BELTRANO}`);
    check("Nutri B não vê a previsão de A", bForecast.status === 200 && bForecast.body.length === 0, bForecast);
    const bInsertForA = await b.post("financial_transactions", { nutritionist_id: NUTRI_A.id, type: "INCOME", description: `${TAG} invasao`, amount_cents: 100, status: "CONFIRMED", occurred_on: today, origin: "MANUAL" });
    check("Nutri B não cria lançamento em nome de A", bInsertForA.status >= 400, bInsertForA);
    const pTx = await p.get(`financial_transactions?select=id`);
    check("paciente não lê lançamentos financeiros", pTx.status !== 200 || pTx.body.length === 0, pTx);
    const pPay = await p.rpc("record_manual_payment", { p_patient_id: PATIENT_A.patientId, p_amount_cents: 100, p_method: "PIX", p_paid_at: new Date().toISOString(), p_idempotency_key: `${TAG}-${randomUUID()}` });
    check("paciente não registra pagamento para si (PATIENT_NOT_FOUND)", pPay.status === 400 && pPay.body?.message === "PATIENT_NOT_FOUND", pPay);

    // 6) Auditoria ------------------------------------------------------------------
    console.log("\n[6] auditoria");
    const audit = await a.post("audit_logs", { actor_id: NUTRI_A.id, action: "PAYMENT_RECORDED", entity_type: "payment", entity_id: partial.body, metadata: { tag: TAG, amount_cents: 10000 } });
    check("nutricionista registra PAYMENT_RECORDED", audit.status === 201, audit);
    const auditB = await b.post("audit_logs", { actor_id: NUTRI_A.id, action: "PAYMENT_RECORDED", entity_type: "payment", entity_id: partial.body, metadata: { tag: TAG } });
    check("Nutri B não registra auditoria em nome de A", auditB.status >= 400, auditB);
    const auditEdit = await a.patch(`audit_logs?entity_id=eq.${partial.body}`, { action: "X" });
    check("auditoria é append-only (update negado)", auditEdit.status >= 400 || (Array.isArray(auditEdit.body) && auditEdit.body.length === 0), auditEdit);
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
