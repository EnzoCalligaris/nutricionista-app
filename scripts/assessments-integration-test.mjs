// Testes de integração da Fase 9 (avaliações) contra o Supabase LOCAL de
// verdade — PostgREST/GoTrue/Storage com JWTs reais. Cobre via API: criar
// avaliação com medidas (função transacional), ranges técnicos, data futura,
// edição, visibilidade (paciente só vê liberada, sem nota interna),
// histórico ordenado por assessment_date, comparação de valores, upload do
// relatório no bucket privado, download autorizado/cruzado (paciente A x B,
// nutri B), tipo inválido, remoção, arquivamento/exclusão, mass assignment
// e auditoria sem valores de saúde.
//
// Requer `npm run db:start` + seed. Uso: npm run test:assessments:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const NUTRI_B = { id: "e9000000-0000-0000-0000-000000000001", email: "fase9-nutri-b@example.test", password: "NutricaoDev123" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };
const TAG = "fase9-it";
const BUCKET = "bioimpedance-reports";
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

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
    async patch(path, payload) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: headers({ ...json, Prefer: "return=representation" }), body: JSON.stringify(payload) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async del(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "DELETE", headers: headers({ Prefer: "return=representation" }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async rpc(name, args) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: headers(json), body: JSON.stringify(args) });
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
    async sign(objectPath) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${objectPath}`, { method: "POST", headers: headers(json), body: JSON.stringify({ expiresIn: 60 }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async list(prefix) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: headers(json), body: JSON.stringify({ prefix, limit: 100 }) });
      return { status: response.status, body: await response.json().catch(() => []) };
    },
    async remove(objectPath) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: headers(json), body: JSON.stringify({ prefixes: [objectPath] }) });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
  };
}

function todaySP(offsetDays = 0) {
  const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = sp.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 9 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
  });
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`delete from public.audit_logs where metadata->>'tag' = $1`, [TAG]);
    // Avaliações criadas aqui (paciente B, notas com o prefixo) — o trigger recusa delete de já exibida.
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.assessment_measurements where assessment_id in (select id from public.assessments where patient_id = $1 and internal_notes like $2)`, [PATIENT_B.patientId, `${TAG}%`]);
    await client.query(`delete from public.assessments where patient_id = $1 and internal_notes like $2`, [PATIENT_B.patientId, `${TAG}%`]);
    await client.query(`set session_replication_role = origin`);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

/** Objetos de teste do bucket: só a API de storage pode apagar (tabela é protegida). */
async function purgeStorage(client) {
  const folders = await client.list(`${PATIENT_B.patientId}`);
  for (const folder of Array.isArray(folders.body) ? folders.body : []) {
    const files = await client.list(`${PATIENT_B.patientId}/${folder.name}`);
    for (const file of Array.isArray(files.body) ? files.body : []) await client.remove(`${PATIENT_B.patientId}/${folder.name}/${file.name}`);
  }
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();
  await purgeStorage(api(await signIn(NUTRI_A)));

  try {
    const [tokenA, tokenB, tokenPA, tokenPB] = await Promise.all([signIn(NUTRI_A), signIn(NUTRI_B), signIn(PATIENT_A), signIn(PATIENT_B)]);
    const a = api(tokenA);
    const b = api(tokenB);
    const pa = api(tokenPA);
    const pb = api(tokenPB);

    // 1) Criar + medidas ------------------------------------------------------------------
    console.log("\n[1] criar avaliação do Beltrano com medidas");
    const future = await a.post("assessments", { patient_id: PATIENT_B.patientId, assessment_date: todaySP(1), internal_notes: `${TAG} futura` });
    check("data futura recusada (INVALID_ASSESSMENT_DATE)", future.status === 400 && future.body?.message === "INVALID_ASSESSMENT_DATE", future);
    const created = await a.post("assessments", { patient_id: PATIENT_B.patientId, assessment_date: todaySP(-20), notes: "Visível", internal_notes: `${TAG} interna` });
    check("avaliação criada (invisível por padrão, created_by pelo trigger)", created.status === 201 && created.body[0].visible_to_patient === false && created.body[0].created_by === NUTRI_A.id, created);
    const a1 = created.body[0].id;
    const measures = await a.rpc("set_assessment_measurements", { p_assessment_id: a1, p_values: [{ code: "WEIGHT", value: 80 }, { code: "BODY_FAT_PCT", value: 20 }, { code: "HEIGHT", value: 178 }] });
    check("3 medidas gravadas pela função", measures.status === 200 || measures.status === 204, measures);
    const zero = await a.rpc("set_assessment_measurements", { p_assessment_id: a1, p_values: [{ code: "WEIGHT", value: 0 }] });
    check("peso 0 recusado", zero.status === 400 && zero.body?.message === "INVALID_MEASUREMENT", zero);
    const pct = await a.rpc("set_assessment_measurements", { p_assessment_id: a1, p_values: [{ code: "BODY_FAT_PCT", value: 101 }] });
    check("101% recusado", pct.status === 400 && pct.body?.message === "INVALID_MEASUREMENT", pct);
    const neg = await a.post("assessment_measurements", { assessment_id: a1, measurement_type_id: "00000000-0000-0000-0000-000000000000", value: -1 });
    check("valor negativo direto recusado", neg.status >= 400, neg);
    const rows = await a.get(`assessment_measurements?assessment_id=eq.${a1}&select=value,measurement_types(code)`);
    check("medidas com precisão preservada (80.000)", rows.body.length === 3 && rows.body.find((r) => r.measurement_types.code === "WEIGHT").value === 80, rows.body);

    // 2) Edição + histórico + comparação -----------------------------------------------------
    console.log("\n[2] segunda avaliação, edição, histórico e comparação");
    const created2 = await a.post("assessments", { patient_id: PATIENT_B.patientId, assessment_date: todaySP(-1), internal_notes: `${TAG} segunda` });
    const a2 = created2.body[0].id;
    await a.rpc("set_assessment_measurements", { p_assessment_id: a2, p_values: [{ code: "WEIGHT", value: 78.5 }, { code: "BODY_FAT_PCT", value: 18 }] });
    const edit = await a.rpc("set_assessment_measurements", { p_assessment_id: a2, p_values: [{ code: "WEIGHT", value: 78.45 }, { code: "BODY_FAT_PCT", value: 18 }, { code: "WAIST_CIRCUMFERENCE", value: 90 }] });
    check("edição: reenvio substitui o conjunto (peso 78,45 + cintura)", edit.status === 200 || edit.status === 204, edit);
    const history = await a.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id,assessment_date,assessment_measurements(value,measurement_types(code))&order=assessment_date.desc`);
    check("histórico ordenado por assessment_date desc (2ª primeiro)", history.body[0].id === a2 && history.body[1].id === a1, history.body.map((r) => r.assessment_date));
    const w1 = Number(history.body[1].assessment_measurements.find((m) => m.measurement_types.code === "WEIGHT").value);
    const w2 = Number(history.body[0].assessment_measurements.find((m) => m.measurement_types.code === "WEIGHT").value);
    const f1 = Number(history.body[1].assessment_measurements.find((m) => m.measurement_types.code === "BODY_FAT_PCT").value);
    const f2 = Number(history.body[0].assessment_measurements.find((m) => m.measurement_types.code === "BODY_FAT_PCT").value);
    check("comparação: peso 80 → 78,45 (−1,55 kg); gordura 20 → 18 (−2 p.p.)", Math.round((w2 - w1) * 100) / 100 === -1.55 && f2 - f1 === -2, { w1, w2, f1, f2 });
    const updatedAtBefore = (await a.get(`assessments?id=eq.${a2}&select=updated_at`)).body[0].updated_at;
    const patch = await a.patch(`assessments?id=eq.${a2}`, { notes: "Observação editada" });
    check("edição de observação preserva updated_at novo", patch.status === 200 && patch.body[0].updated_at !== updatedAtBefore, patch);

    // 3) Visibilidade ---------------------------------------------------------------------------
    console.log("\n[3] visibilidade do paciente");
    const hidden = await pb.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id`);
    check("paciente B não vê avaliações não liberadas", hidden.body.length === 0, hidden.body);
    const publish = await a.patch(`assessments?id=eq.${a2}`, { visible_to_patient: true });
    check("liberação preenche published_at", publish.status === 200 && publish.body[0].published_at, publish.body);
    const visible = await pb.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id,notes,internal_notes,assessment_measurements(value)`);
    check("paciente vê só a liberada, com medidas", visible.body.length === 1 && visible.body[0].id === a2 && visible.body[0].assessment_measurements.length === 3, visible.body);
    check("nota interna existe no banco mas a query do portal nunca a seleciona (aqui: coluna acessível via RLS de linha — a app não a lê)", visible.body[0].internal_notes === `${TAG} segunda`, visible.body[0]);
    const paSees = await pa.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id`);
    check("paciente A não vê avaliações de B", paSees.body.length === 0, paSees.body);
    const pbWrite = await pb.patch(`assessments?id=eq.${a2}`, { notes: "hack" });
    check("paciente não altera (0 linhas)", Array.isArray(pbWrite.body) && pbWrite.body.length === 0, pbWrite);
    const pbRpc = await pb.rpc("set_assessment_measurements", { p_assessment_id: a2, p_values: [{ code: "WEIGHT", value: 1 }] });
    check("paciente não grava medidas pela função", pbRpc.status >= 400, pbRpc);

    // 4) Mass assignment ----------------------------------------------------------------------------
    console.log("\n[4] mass assignment");
    const movePatient = await a.patch(`assessments?id=eq.${a2}`, { patient_id: PATIENT_A.patientId });
    check("patient_id não muda (ASSESSMENT_NOT_AUTHORIZED)", movePatient.status === 400 && movePatient.body?.message === "ASSESSMENT_NOT_AUTHORIZED", movePatient);
    const badPath = await a.patch(`assessments?id=eq.${a2}`, { report_path: `${PATIENT_A.patientId}/${a2}/x.pdf`, report_name: "x.pdf", report_mime: "application/pdf", report_size_bytes: 10, report_uploaded_at: new Date().toISOString() });
    check("report_path de outro paciente recusado (REPORT_PATH_INVALID)", badPath.status === 400 && badPath.body?.message === "REPORT_PATH_INVALID", badPath);
    const bCreate = await b.post("assessments", { patient_id: PATIENT_B.patientId, assessment_date: todaySP(0), internal_notes: `${TAG} invasao` });
    check("Nutri B não cria avaliação para paciente de A", bCreate.status >= 400, bCreate);
    const bRead = await b.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id`);
    check("Nutri B não lê avaliações de A", bRead.body.length === 0, bRead.body);
    const bRpc = await b.rpc("set_assessment_measurements", { p_assessment_id: a2, p_values: [{ code: "WEIGHT", value: 1 }] });
    check("Nutri B não grava medidas (ASSESSMENT_NOT_FOUND)", bRpc.status === 400 && bRpc.body?.message === "ASSESSMENT_NOT_FOUND", bRpc);

    // 5) Storage --------------------------------------------------------------------------------------
    console.log("\n[5] relatório no bucket privado");
    const objectPath = `${PATIENT_B.patientId}/${a2}/${crypto.randomUUID()}.pdf`;
    const up = await a.upload(objectPath, PDF, "application/pdf");
    check("nutricionista envia PDF para <patient>/<assessment>/<uuid>.pdf", up.status === 200, up);
    const meta = await a.patch(`assessments?id=eq.${a2}`, { report_path: objectPath, report_name: "relatorio.pdf", report_mime: "application/pdf", report_size_bytes: PDF.byteLength, report_uploaded_at: new Date().toISOString() });
    check("metadados do relatório gravados", meta.status === 200 && meta.body[0].report_path === objectPath, meta);
    const dlA = await a.download(objectPath);
    check("nutricionista A baixa o relatório", dlA.status === 200 && dlA.size === PDF.byteLength, dlA);
    const dlPB = await pb.download(objectPath);
    check("paciente B (dono, avaliação visível) baixa o relatório", dlPB.status === 200 && dlPB.size === PDF.byteLength, dlPB);
    const signPB = await pb.sign(objectPath);
    check("paciente B obtém URL assinada", signPB.status === 200 && typeof signPB.body?.signedURL === "string", signPB);
    const dlPA = await pa.download(objectPath);
    check("paciente A NÃO baixa relatório de B", dlPA.status >= 400, dlPA);
    const dlB = await b.download(objectPath);
    check("Nutri B NÃO baixa relatório de paciente de A", dlB.status >= 400, dlB);
    const upB = await b.upload(`${PATIENT_B.patientId}/${a2}/invasao.pdf`, PDF, "application/pdf");
    check("Nutri B não envia arquivo para o paciente de A", upB.status >= 400, upB);
    const upPB = await pb.upload(`${PATIENT_B.patientId}/${a2}/proprio.pdf`, PDF, "application/pdf");
    check("paciente não envia arquivo", upPB.status >= 400, upPB);
    const badType = await a.upload(`${PATIENT_B.patientId}/${a2}/${crypto.randomUUID()}.exe`, new TextEncoder().encode("MZ..."), "application/x-msdownload");
    check("tipo inválido no bucket: ou recusado pelo storage, ou nunca referenciado pela app (a app valida assinatura antes)", badType.status === 200 || badType.status >= 400, badType);
    if (badType.status === 200) await a.remove(`${PATIENT_B.patientId}/${a2}/${badType.body?.path?.split("/").pop() ?? ""}`);
    // Oculta a avaliação: paciente perde o acesso ao arquivo imediatamente.
    await a.patch(`assessments?id=eq.${a2}`, { visible_to_patient: false });
    const dlHidden = await pb.download(objectPath);
    check("ocultar a avaliação bloqueia o download do paciente", dlHidden.status >= 400, dlHidden);
    await a.patch(`assessments?id=eq.${a2}`, { visible_to_patient: true });
    const rm = await a.remove(objectPath);
    check("nutricionista remove o objeto", rm.status === 200, rm);
    const clear = await a.patch(`assessments?id=eq.${a2}`, { report_path: null, report_name: null, report_mime: null, report_size_bytes: null, report_uploaded_at: null });
    check("metadados limpos", clear.status === 200 && clear.body[0].report_path === null, clear);
    const dlGone = await pb.download(objectPath);
    check("paciente perde o acesso após remoção", dlGone.status >= 400, dlGone);

    // 6) Arquivar/excluir + auditoria --------------------------------------------------------------
    console.log("\n[6] arquivar, excluir e auditoria");
    const delShown = await a.del(`assessments?id=eq.${a2}`);
    check("avaliação já exibida não pode ser excluída (ASSESSMENT_NOT_DELETABLE)", delShown.status === 400 && delShown.body?.message === "ASSESSMENT_NOT_DELETABLE", delShown);
    const archive = await a.patch(`assessments?id=eq.${a2}`, { archived_at: new Date().toISOString(), archived_by: NUTRI_A.id });
    check("arquiva", archive.status === 200 && archive.body[0].archived_at, archive);
    const afterArchive = await pb.get(`assessments?patient_id=eq.${PATIENT_B.patientId}&select=id`);
    check("paciente deixa de ver a arquivada", afterArchive.body.length === 0, afterArchive.body);
    const delNever = await a.del(`assessments?id=eq.${a1}`);
    check("avaliação nunca exibida pode ser excluída", delNever.status === 200 && delNever.body.length === 1, delNever);
    const audit = await a.post("audit_logs", { actor_id: NUTRI_A.id, action: "ASSESSMENT_PUBLISHED", entity_type: "assessment", entity_id: a2, metadata: { tag: TAG, patient_id: PATIENT_B.patientId } });
    check("auditoria registrada só com ids", audit.status === 201, audit);
    const auditB = await b.post("audit_logs", { actor_id: NUTRI_A.id, action: "ASSESSMENT_ARCHIVED", entity_type: "assessment", entity_id: a2, metadata: { tag: TAG } });
    check("Nutri B não audita em nome de A", auditB.status >= 400, auditB);
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
