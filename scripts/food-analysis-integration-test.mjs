// Testes de integração da Fase 11 (foto da refeição + análise por IA) contra
// o Supabase LOCAL de verdade — PostgREST/GoTrue/Storage com JWTs reais.
// Cobre via API: consentimento versionado (só o paciente registra/revoga; só
// revoked_at muda), upload da foto no bucket privado meal-photos (paciente A
// ok; B e nutri não escrevem na pasta de A), criação da análise (consentimento
// obrigatório, path <patient_id>/<analysis_id>/, sem status privilegiado),
// claim atômico de processamento com DUAS requisições simultâneas (uma
// vence), persistência do resultado (ANALYZED), revisão/confirmação com o
// original imutável, histórico, ownership (paciente B / nutri B: nada; nutri
// A: só leitura), download cruzado negado, revogação bloqueia análise nova,
// arquivamento com remoção do objeto e auditoria só pelo próprio paciente.
// A chamada ao provider (fake) e a validação Zod da resposta são cobertas
// pelos testes unitários e pelo E2E (o script fala com o banco, não com o app).
//
// Requer `npm run db:start` + seed. Uso: npm run test:food-analysis:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const NUTRI_B = { id: "eb000000-0000-0000-0000-000000000001", email: "fase11-nutri-b@example.test", password: "NutricaoDev123" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", profileId: "90000000-0000-0000-0000-000000000101", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", profileId: "90000000-0000-0000-0000-000000000102", patientId: "90000000-0000-0000-0000-000000000011" };
const TAG = "fase11-it";
const BUCKET = "meal-photos";
const CONSENT = { type: "MEAL_PHOTO_AI", version: "meal_photo_ai_v1" };
// WebP mínimo válido (1×1) — fixture sintética, nunca foto real.
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00]);
const ANALYSIS_ID = "eb000000-0000-0000-0000-000000000100";
const ANALYSIS_ID_2 = "eb000000-0000-0000-0000-000000000101";
const AI_RESULT = {
  items: [{ id: "it-1", name: "Arroz", quantity: 150, unit: "g", preparation: "cozido", calories: 195, proteinG: 4, carbsG: 42, fatG: 0.5, confidence: 0.8, uncertain: false, source: "AI" }],
  totals: { calories: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
  ambiguities: ["Confirme se houve uso de óleo."],
  assumptions: [],
};

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

function api(token) {
  const headers = (extra = {}) => ({ apikey: ANON_KEY, Authorization: `Bearer ${token}`, ...extra });
  const json = { "Content-Type": "application/json" };
  return {
    async get(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
      return { status: response.status, body: await response.json() };
    },
    async post(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "POST", headers: headers({ ...json, Prefer: "return=representation" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    /** Sem RETURNING: o paciente não tem policy de SELECT em audit_logs (append-only) — igual ao app. */
    async postMinimal(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "POST", headers: headers({ ...json, Prefer: "return=minimal" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.text().catch(() => null) };
    },
    async patch(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: headers({ ...json, Prefer: "return=representation" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async del(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "DELETE", headers: headers({ Prefer: "return=representation" }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async upload(objectPath, bytes, contentType) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, { method: "POST", headers: headers({ "Content-Type": contentType }), body: bytes });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async download(objectPath) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${objectPath}`, { headers: headers() });
      return { status: response.status, size: (await response.arrayBuffer()).byteLength };
    },
    async remove(objectPath) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: headers(json), body: JSON.stringify({ prefixes: [objectPath] }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
  };
}

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 11 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
  });
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`delete from public.audit_logs where metadata->>'tag' = $1 or (metadata->>'tag') = 'dbg'`, [TAG]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.food_photo_analyses where id in ($1, $2)`, [ANALYSIS_ID, ANALYSIS_ID_2]);
    await client.query(`delete from public.patient_consents where patient_id in ($1, $2) and consent_type = $3`, [PATIENT_A.patientId, PATIENT_B.patientId, CONSENT.type]);
    await client.query(`set session_replication_role = origin`);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();
  const objectPath = `${PATIENT_A.patientId}/${ANALYSIS_ID}/11111111-1111-1111-1111-111111111111.webp`;
  let pa = null;

  try {
    const [tokenA, tokenB, tokenPA, tokenPB] = await Promise.all([signIn(NUTRI_A), signIn(NUTRI_B), signIn(PATIENT_A), signIn(PATIENT_B)]);
    const a = api(tokenA);
    const b = api(tokenB);
    pa = api(tokenPA);
    const pb = api(tokenPB);

    // 1) Consentimento -------------------------------------------------------------------
    console.log("\n[1] consentimento");
    const noConsent = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_A.patientId, storage_path: objectPath, consent_version: CONSENT.version });
    check("sem consentimento a análise é recusada (MEAL_AI_CONSENT_REQUIRED)", noConsent.status === 400 && noConsent.body?.message === "MEAL_AI_CONSENT_REQUIRED", noConsent);
    const byNutri = await a.post("patient_consents", { patient_id: PATIENT_A.patientId, consent_type: CONSENT.type, consent_version: CONSENT.version });
    check("nutricionista não registra consentimento pelo paciente", byNutri.status >= 400, byNutri);
    const forOther = await pb.post("patient_consents", { patient_id: PATIENT_A.patientId, consent_type: CONSENT.type, consent_version: CONSENT.version });
    check("paciente B não registra consentimento em nome de A", forOther.status >= 400, forOther);
    const consent = await pa.post("patient_consents", { patient_id: PATIENT_A.patientId, consent_type: CONSENT.type, consent_version: CONSENT.version });
    check("paciente A aceita (versão meal_photo_ai_v1)", consent.status === 201 && consent.body[0].revoked_at === null, consent);
    const consentId = consent.body[0].id;
    const dup = await pa.post("patient_consents", { patient_id: PATIENT_A.patientId, consent_type: CONSENT.type, consent_version: CONSENT.version });
    check("um consentimento ativo por versão", dup.status === 409 || dup.body?.code === "23505", dup);
    const tamper = await pa.patch(`patient_consents?id=eq.${consentId}`, { consent_version: "meal_photo_ai_v9" });
    check("só revoked_at muda depois de aceito", tamper.status === 400 && tamper.body?.message === "CONSENT_NOT_AUTHORIZED", tamper);
    const seenByNutri = await a.get(`patient_consents?patient_id=eq.${PATIENT_A.patientId}&select=id`);
    check("nutri A vê o consentimento do próprio paciente", seenByNutri.body.length === 1, seenByNutri.body);
    const seenByB = await pb.get(`patient_consents?patient_id=eq.${PATIENT_A.patientId}&select=id`);
    check("paciente B não vê consentimento de A", seenByB.body.length === 0, seenByB.body);

    // 2) Upload + criação -----------------------------------------------------------------
    console.log("\n[2] foto e criação da análise");
    const upB = await pb.upload(`${PATIENT_A.patientId}/${ANALYSIS_ID}/hack.webp`, WEBP, "image/webp");
    check("paciente B não grava na pasta de A", upB.status >= 400, upB);
    const upNutri = await a.upload(`${PATIENT_A.patientId}/${ANALYSIS_ID}/hack.webp`, WEBP, "image/webp");
    check("nutricionista não grava foto de refeição", upNutri.status >= 400, upNutri);
    const up = await pa.upload(objectPath, WEBP, "image/webp");
    check("paciente A envia a foto para <patient_id>/<analysis_id>/<uuid>.webp", up.status === 200, up);
    const badPath = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_A.patientId, storage_path: `${PATIENT_A.patientId}/solto.webp`, consent_version: CONSENT.version });
    check("path sem <analysis_id> recusado (MEAL_PHOTO_INVALID)", badPath.status === 400 && badPath.body?.message === "MEAL_PHOTO_INVALID", badPath);
    const privileged = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_A.patientId, storage_path: objectPath, consent_version: CONSENT.version, status: "CONFIRMED" });
    check("status privilegiado no insert recusado (§74)", privileged.status === 400 && privileged.body?.message === "INVALID_STATUS_TRANSITION", privileged);
    const future = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_A.patientId, storage_path: objectPath, consent_version: CONSENT.version, meal_at: new Date(Date.now() + 3600_000).toISOString() });
    check("refeição no futuro recusada (INVALID_MEAL_TIME)", future.status === 400 && future.body?.message === "INVALID_MEAL_TIME", future);
    const forB = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_B.patientId, storage_path: `${PATIENT_B.patientId}/${ANALYSIS_ID}/x.webp`, consent_version: CONSENT.version });
    check("paciente A não cria análise para B", forB.status >= 400, forB);
    const created = await pa.post("food_photo_analyses", { id: ANALYSIS_ID, patient_id: PATIENT_A.patientId, storage_path: objectPath, consent_version: CONSENT.version, image_mime: "image/webp", image_size_bytes: WEBP.byteLength });
    check("análise criada PENDING", created.status === 201 && created.body[0].status === "PENDING", created);

    // 3) Claim atômico com duas requisições simultâneas ------------------------------------
    console.log("\n[3] idempotência do 'Analisar' (duas requisições simultâneas)");
    const stale = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const claimPath = `food_photo_analyses?id=eq.${ANALYSIS_ID}&status=in.(PENDING,FAILED)&or=(processing_started_at.is.null,processing_started_at.lt.${stale})`;
    const [claim1, claim2] = await Promise.all([pa.patch(claimPath, { processing_started_at: new Date().toISOString() }), pa.patch(claimPath, { processing_started_at: new Date().toISOString() })]);
    const won = [claim1, claim2].filter((r) => r.status === 200 && Array.isArray(r.body) && r.body.length === 1).length;
    check("exatamente uma requisição pega a análise (§91)", won === 1, { claim1: claim1.body?.length, claim2: claim2.body?.length });
    const third = await pa.patch(claimPath, { processing_started_at: new Date().toISOString() });
    check("terceira tentativa enquanto processa: 0 linhas", third.status === 200 && third.body.length === 0, third);

    // 4) Resultado, revisão e confirmação -----------------------------------------------------
    console.log("\n[4] resultado da IA, revisão e confirmação");
    const noResult = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { status: "ANALYZED" });
    check("ANALYZED sem resultado recusado", noResult.status === 400 && noResult.body?.message === "INVALID_STATUS_TRANSITION", noResult);
    const analyzed = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { status: "ANALYZED", provider: "fake", model: "fake-deterministic-v1", structured_result: AI_RESULT, attempts: 1 });
    check("ANALYZED com resultado normalizado; claim liberado", analyzed.status === 200 && analyzed.body[0].processing_started_at === null && analyzed.body[0].analyzed_at, analyzed);
    const immutable = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { structured_result: { ...AI_RESULT, items: [] } });
    check("original da IA imutável (FOOD_ANALYSIS_ORIGINAL_IMMUTABLE)", immutable.status === 400 && immutable.body?.message === "FOOD_ANALYSIS_ORIGINAL_IMMUTABLE", immutable);
    const providerChange = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { provider: "outro" });
    check("provider do original imutável", providerChange.status === 400 && providerChange.body?.message === "FOOD_ANALYSIS_ORIGINAL_IMMUTABLE", providerChange);
    const confirmNoBody = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { status: "CONFIRMED" });
    check("confirmar sem versão confirmada recusado", confirmNoBody.status === 400, confirmNoBody);
    const confirmedResult = { ...AI_RESULT, items: [{ ...AI_RESULT.items[0], quantity: 100, calories: 130 }, { id: "p-1", name: "Azeite", quantity: 1, unit: "colher_sopa", preparation: "nao_informado", calories: 120, proteinG: 0, carbsG: 0, fatG: 13.5, confidence: null, uncertain: false, source: "PATIENT" }], totals: { calories: 250, proteinG: 4, carbsG: 42, fatG: 14 } };
    const confirmed = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { status: "CONFIRMED", corrected_result: confirmedResult });
    check("CONFIRMED com versão revisada (confirmed_at)", confirmed.status === 200 && confirmed.body[0].confirmed_at, confirmed);
    check("original continua 150 g; confirmado tem 100 g + azeite", confirmed.body[0].structured_result.items[0].quantity === 150 && confirmed.body[0].corrected_result.items[0].quantity === 100 && confirmed.body[0].corrected_result.items[1].name === "Azeite", confirmed.body[0]);
    const patientId = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { patient_id: PATIENT_B.patientId });
    check("patient_id imutável", patientId.status === 400 && patientId.body?.message === "FOOD_ANALYSIS_NOT_AUTHORIZED", patientId);

    // 5) Histórico e ownership ------------------------------------------------------------------
    console.log("\n[5] histórico, ownership e download");
    const history = await pa.get(`food_photo_analyses?patient_id=eq.${PATIENT_A.patientId}&archived_at=is.null&select=id,status&order=meal_at.desc`);
    check("histórico do paciente A traz a confirmada", history.body.some((row) => row.id === ANALYSIS_ID && row.status === "CONFIRMED"), history.body);
    const seenPB = await pb.get(`food_photo_analyses?id=eq.${ANALYSIS_ID}&select=id`);
    check("paciente B não vê análise de A", seenPB.body.length === 0, seenPB.body);
    const seenB = await b.get(`food_photo_analyses?id=eq.${ANALYSIS_ID}&select=id`);
    check("nutri B não vê análise de paciente de A", seenB.body.length === 0, seenB.body);
    const seenA = await a.get(`food_photo_analyses?id=eq.${ANALYSIS_ID}&select=id,status,corrected_result`);
    check("nutri A vê a análise confirmada do próprio paciente", seenA.body.length === 1 && seenA.body[0].status === "CONFIRMED", seenA.body);
    const nutriEdit = await a.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { corrected_result: { ...confirmedResult, items: [] } });
    check("nutri A não altera o que o paciente confirmou (0 linhas, §79)", nutriEdit.status === 200 && nutriEdit.body.length === 0, nutriEdit);
    const pbEdit = await pb.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { status: "ANALYZED" });
    check("paciente B não edita análise de A (0 linhas)", pbEdit.status === 200 && pbEdit.body.length === 0, pbEdit);
    const dlA = await pa.download(objectPath);
    check("paciente A baixa a própria foto", dlA.status === 200 && dlA.size === WEBP.byteLength, dlA);
    const dlN = await a.download(objectPath);
    check("nutri A baixa a foto do paciente", dlN.status === 200, dlN);
    const dlPB = await pb.download(objectPath);
    check("paciente B não baixa (cross-patient)", dlPB.status >= 400, dlPB);
    const dlB = await b.download(objectPath);
    check("nutri B não baixa (cross-nutritionist)", dlB.status >= 400, dlB);
    const rmB = await pb.remove(objectPath);
    check("paciente B não apaga a foto de A", rmB.status >= 400 || (Array.isArray(rmB.body) && rmB.body.length === 0), rmB);

    // 6) Falha/retry, revogação, arquivamento -------------------------------------------------------
    console.log("\n[6] retry, revogação e arquivamento");
    const created2 = await pa.post("food_photo_analyses", { id: ANALYSIS_ID_2, patient_id: PATIENT_A.patientId, storage_path: `${PATIENT_A.patientId}/${ANALYSIS_ID_2}/22222222-2222-2222-2222-222222222222.webp`, consent_version: CONSENT.version });
    check("segunda análise criada", created2.status === 201, created2);
    await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID_2}`, { processing_started_at: new Date().toISOString() });
    const fail = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID_2}`, { status: "FAILED", failure_code: "PROVIDER_TIMEOUT", attempts: 1 });
    check("timeout → FAILED com código técnico e claim liberado", fail.status === 200 && fail.body[0].processing_started_at === null, fail);
    const retry = await pa.patch(`${claimPath.replace(ANALYSIS_ID, ANALYSIS_ID_2)}`, { status: "PENDING", processing_started_at: new Date().toISOString() });
    check("tentar de novo reaproveita o MESMO registro (FAILED → PENDING)", retry.status === 200 && retry.body.length === 1 && retry.body[0].status === "PENDING", retry);
    const countA = await pa.get(`food_photo_analyses?id=in.(${ANALYSIS_ID},${ANALYSIS_ID_2})&archived_at=is.null&select=id`);
    check("nenhum registro duplicado (as 2 análises deste teste)", countA.body.length === 2, countA.body.map((r) => r.id));

    const revoke = await pa.patch(`patient_consents?id=eq.${consentId}`, { revoked_at: new Date().toISOString() });
    check("paciente revoga o consentimento", revoke.status === 200 && revoke.body[0].revoked_at, revoke);
    const afterRevoke = await pa.post("food_photo_analyses", { id: "eb000000-0000-0000-0000-000000000102", patient_id: PATIENT_A.patientId, storage_path: `${PATIENT_A.patientId}/eb000000-0000-0000-0000-000000000102/x.webp`, consent_version: CONSENT.version });
    check("após revogar, análise nova é bloqueada", afterRevoke.status === 400 && afterRevoke.body?.message === "MEAL_AI_CONSENT_REQUIRED", afterRevoke);
    const stillThere = await pa.get(`food_photo_analyses?id=eq.${ANALYSIS_ID}&select=id`);
    check("análises anteriores permanecem após revogar (política documentada)", stillThere.body.length === 1, stillThere.body);
    const revokeAgain = await pa.patch(`patient_consents?id=eq.${consentId}`, { revoked_at: new Date(Date.now() + 1000).toISOString() });
    check("revogação registrada uma vez só", revokeAgain.status === 400 && revokeAgain.body?.message === "INVALID_STATUS_TRANSITION", revokeAgain);

    const archive = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { archived_at: new Date().toISOString() });
    check("paciente arquiva a análise", archive.status === 200 && archive.body[0].archived_at, archive);
    const rm = await pa.remove(objectPath);
    check("paciente remove a foto do bucket ao arquivar", rm.status === 200, rm);
    const dlGone = await a.download(objectPath);
    check("nutricionista perde a foto após arquivar", dlGone.status >= 400, dlGone);
    const editArchived = await pa.patch(`food_photo_analyses?id=eq.${ANALYSIS_ID}`, { corrected_result: confirmedResult });
    check("arquivada é só leitura (FOOD_ANALYSIS_ARCHIVED)", editArchived.status === 400 && editArchived.body?.message === "FOOD_ANALYSIS_ARCHIVED", editArchived);
    const delRow = await pa.del(`food_photo_analyses?id=eq.${ANALYSIS_ID}`);
    check("paciente não apaga a linha (sem policy de delete)", delRow.status >= 400 || (Array.isArray(delRow.body) && delRow.body.length === 0), delRow);

    // 7) Auditoria --------------------------------------------------------------------------------
    console.log("\n[7] auditoria");
    const audit = await pa.postMinimal("audit_logs", { actor_id: PATIENT_A.profileId, action: "MEAL_ANALYSIS_CONFIRMED", entity_type: "food_photo_analysis", entity_id: ANALYSIS_ID, metadata: { tag: TAG, patient_id: PATIENT_A.patientId, items: 2 } });
    check("paciente audita a própria análise (só ids/contagens)", audit.status === 201, audit);
    const auditOther = await pa.postMinimal("audit_logs", { actor_id: PATIENT_A.profileId, action: "PATIENT_UPDATED", entity_type: "patient", entity_id: PATIENT_A.patientId, metadata: { tag: TAG } });
    check("paciente não audita outras entidades", auditOther.status >= 400, auditOther);
    const auditForged = await pb.postMinimal("audit_logs", { actor_id: PATIENT_A.profileId, action: "MEAL_ANALYSIS_ARCHIVED", entity_type: "food_photo_analysis", entity_id: ANALYSIS_ID, metadata: { tag: TAG } });
    check("paciente B não audita em nome de A", auditForged.status >= 400, auditForged);
  } finally {
    if (pa) await pa.remove(objectPath).catch(() => null);
    await cleanup();
  }

  console.log(`\n${passed} ok, ${failed} falha(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
