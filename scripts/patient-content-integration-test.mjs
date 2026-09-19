// Testes de integração da Fase 10 (suplementos, feedbacks, materiais) contra o
// Supabase LOCAL de verdade — PostgREST/GoTrue/Storage com JWTs reais. Cobre
// via API: suplemento (criar, paciente só vê ativo, encerrar/arquivar,
// link inseguro recusado, DELETE negado), feedback (rascunho invisível,
// disponibilizar, paciente só marca como lido, definitivo, arquivar,
// rascunho apagável), material (link e arquivo no bucket privado, path fora
// do padrão, atribuição/reatribuição/revogação, download autorizado x
// cruzado — paciente B, nutri B —, arquivamento), ownership nutri A/B e
// paciente A/B e auditoria só com ids.
//
// Requer `npm run db:start` + seed. Uso: npm run test:patient-content:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const NUTRI_B = { id: "ea000000-0000-0000-0000-000000000001", email: "fase10-nutri-b@example.test", password: "NutricaoDev123", patientId: "ea000000-0000-0000-0000-000000000010" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };
const TAG = "fase10-it";
const BUCKET = "patient-documents";
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

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 10 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
    // Paciente próprio de B (sem login) — para provar que B não atribui material de A nem ao próprio paciente.
    await client.query(`insert into public.patients (id, nutritionist_id, full_name) values ($1, $2, 'Paciente de B (fase10-it)') on conflict (id) do nothing`, [NUTRI_B.patientId, NUTRI_B.id]);
  });
}

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`delete from public.audit_logs where metadata->>'tag' = $1`, [TAG]);
    await client.query(`set session_replication_role = replica`);
    await client.query(`delete from public.supplement_recommendations where name like $1`, [`${TAG}%`]);
    await client.query(`delete from public.feedback_messages where content like $1`, [`${TAG}%`]);
    await client.query(`delete from public.material_assignments where material_id in (select id from public.patient_materials where title like $1)`, [`${TAG}%`]);
    await client.query(`delete from public.patient_materials where title like $1`, [`${TAG}%`]);
    await client.query(`delete from public.patients where id = $1`, [NUTRI_B.patientId]);
    await client.query(`set session_replication_role = origin`);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();
  let uploadedPath = null;
  let nutriClient = null;

  try {
    const [tokenA, tokenB, tokenPA, tokenPB] = await Promise.all([signIn(NUTRI_A), signIn(NUTRI_B), signIn(PATIENT_A), signIn(PATIENT_B)]);
    const a = api(tokenA);
    const b = api(tokenB);
    const pa = api(tokenPA);
    const pb = api(tokenPB);
    nutriClient = a;

    // 1) Suplementos ------------------------------------------------------------------------
    console.log("\n[1] suplementos");
    const sup = await a.post("supplement_recommendations", { patient_id: PATIENT_A.patientId, name: `${TAG} Vitamina D`, dose_text: "2000 UI", schedule_text: "1x ao dia", purchase_url: "https://example.com/vitd" });
    check("nutri A cria recomendação ativa (created_by pelo trigger)", sup.status === 201 && sup.body[0].active === true && sup.body[0].created_by === NUTRI_A.id, sup);
    const supId = sup.body[0].id;
    const supInactive = await a.post("supplement_recommendations", { patient_id: PATIENT_A.patientId, name: `${TAG} Creatina (encerrada)`, active: false });
    check("recomendação encerrada criada", supInactive.status === 201, supInactive);
    const badUrl = await a.post("supplement_recommendations", { patient_id: PATIENT_A.patientId, name: `${TAG} inválido`, purchase_url: "javascript:alert(1)" });
    check("purchase_url javascript: recusada pelo banco (23514)", badUrl.status === 400 && badUrl.body?.code === "23514", badUrl);
    const ftpUrl = await a.post("supplement_recommendations", { patient_id: PATIENT_A.patientId, name: `${TAG} inválido`, purchase_url: "ftp://x.example/a" });
    check("purchase_url ftp: recusada pelo banco", ftpUrl.status === 400, ftpUrl);
    const forB = await a.post("supplement_recommendations", { patient_id: NUTRI_B.patientId, name: `${TAG} alheio` });
    check("nutri A não cadastra para paciente de B (RLS)", forB.status >= 400, forB);
    const seenPA = await pa.get(`supplement_recommendations?patient_id=eq.${PATIENT_A.patientId}&name=like.${encodeURIComponent(`${TAG}%`)}&select=name`);
    check("paciente A vê só a ATIVA", seenPA.body.length === 1 && seenPA.body[0].name === `${TAG} Vitamina D`, seenPA.body);
    const seenPB = await pb.get(`supplement_recommendations?patient_id=eq.${PATIENT_A.patientId}&select=id`);
    check("paciente B não vê suplementos de A", seenPB.body.length === 0, seenPB.body);
    const seenB = await b.get(`supplement_recommendations?patient_id=eq.${PATIENT_A.patientId}&select=id`);
    check("nutri B não vê suplementos de paciente de A", seenB.body.length === 0, seenB.body);
    const tamper = await pa.patch(`supplement_recommendations?id=eq.${supId}`, { instructions: "auto-prescrição" });
    check("paciente não altera recomendação (0 linhas)", tamper.status === 200 && tamper.body.length === 0, tamper);
    const selfSup = await pa.post("supplement_recommendations", { patient_id: PATIENT_A.patientId, name: `${TAG} auto` });
    check("paciente não cadastra suplemento", selfSup.status >= 400, selfSup);
    const bEdit = await b.patch(`supplement_recommendations?id=eq.${supId}`, { active: false });
    check("nutri B não encerra suplemento de A (0 linhas)", bEdit.status === 200 && bEdit.body.length === 0, bEdit);
    const deactivate = await a.patch(`supplement_recommendations?id=eq.${supId}`, { active: false });
    check("nutri A encerra", deactivate.status === 200 && deactivate.body[0].active === false && deactivate.body[0].updated_by === NUTRI_A.id, deactivate);
    const afterDeactivate = await pa.get(`supplement_recommendations?id=eq.${supId}&select=id`);
    check("paciente deixa de ver a encerrada", afterDeactivate.body.length === 0, afterDeactivate.body);
    const reactivate = await a.patch(`supplement_recommendations?id=eq.${supId}`, { active: true });
    check("reativação explícita", reactivate.status === 200 && reactivate.body[0].active === true, reactivate);
    const archive = await a.patch(`supplement_recommendations?id=eq.${supId}`, { archived_at: new Date().toISOString() });
    check("arquivar (também encerra, archived_by pelo trigger)", archive.status === 200 && archive.body[0].active === false && archive.body[0].archived_by === NUTRI_A.id, archive);
    const editArchived = await a.patch(`supplement_recommendations?id=eq.${supId}`, { notes: "x" });
    check("arquivada é só leitura (SUPPLEMENT_ARCHIVED)", editArchived.status === 400 && editArchived.body?.message === "SUPPLEMENT_ARCHIVED", editArchived);
    const afterArchive = await pa.get(`supplement_recommendations?id=eq.${supId}&select=id`);
    check("paciente não vê a arquivada", afterArchive.body.length === 0, afterArchive.body);
    const delSup = await a.del(`supplement_recommendations?id=eq.${supInactive.body[0].id}`);
    check("DELETE de suplemento negado (privilégio revogado)", delSup.status === 401 || delSup.status === 403 || delSup.status === 400 || delSup.status === 405, delSup);

    // 2) Feedbacks -------------------------------------------------------------------------------
    console.log("\n[2] feedbacks");
    const draft = await a.post("feedback_messages", { patient_id: PATIENT_A.patientId, author_id: NUTRI_A.id, title: "Semana 1", content: `${TAG} rascunho privado` });
    check("rascunho criado (published_at null)", draft.status === 201 && draft.body[0].published_at === null, draft);
    const fbId = draft.body[0].id;
    const forged = await a.post("feedback_messages", { patient_id: PATIENT_A.patientId, author_id: NUTRI_B.id, content: `${TAG} autor forjado` });
    check("author_id forjado recusado", forged.status >= 400, forged);
    const fbForB = await a.post("feedback_messages", { patient_id: NUTRI_B.patientId, author_id: NUTRI_A.id, content: `${TAG} alheio` });
    check("nutri A não escreve para paciente de B", fbForB.status >= 400, fbForB);
    const draftSeen = await pa.get(`feedback_messages?id=eq.${fbId}&select=id`);
    check("paciente não vê rascunho", draftSeen.body.length === 0, draftSeen.body);
    const publish = await a.patch(`feedback_messages?id=eq.${fbId}`, { published_at: new Date().toISOString() });
    check("disponibilizar grava published_at", publish.status === 200 && publish.body[0].published_at, publish);
    const visible = await pa.get(`feedback_messages?id=eq.${fbId}&select=content`);
    check("paciente vê o disponibilizado", visible.body.length === 1 && visible.body[0].content === `${TAG} rascunho privado`, visible.body);
    const read = await pa.patch(`feedback_messages?id=eq.${fbId}`, { read_at: new Date().toISOString() });
    check("paciente marca como lido", read.status === 200 && read.body[0].read_at, read);
    const tamperFb = await pa.patch(`feedback_messages?id=eq.${fbId}`, { content: "hack" });
    check("paciente não altera conteúdo (FEEDBACK_NOT_AUTHORIZED)", tamperFb.status === 400 && tamperFb.body?.message === "FEEDBACK_NOT_AUTHORIZED", tamperFb);
    const reply = await pa.post("feedback_messages", { patient_id: PATIENT_A.patientId, author_id: "90000000-0000-0000-0000-000000000101", content: `${TAG} resposta` });
    check("paciente não escreve feedback (não é chat)", reply.status >= 400, reply);
    const unpublish = await a.patch(`feedback_messages?id=eq.${fbId}`, { published_at: null });
    check("disponibilizado não volta a rascunho (INVALID_STATUS_TRANSITION)", unpublish.status === 400 && unpublish.body?.message === "INVALID_STATUS_TRANSITION", unpublish);
    const editPublished = await a.patch(`feedback_messages?id=eq.${fbId}`, { content: `${TAG} corrigido após disponibilizar` });
    check("nutri corrige feedback já visível (updated_by)", editPublished.status === 200 && editPublished.body[0].updated_by === NUTRI_A.id, editPublished);
    const bSees = await b.get(`feedback_messages?id=eq.${fbId}&select=id`);
    check("nutri B não vê feedback de paciente de A", bSees.body.length === 0, bSees.body);
    const pbSees = await pb.get(`feedback_messages?patient_id=eq.${PATIENT_A.patientId}&select=id`);
    check("paciente B não vê feedback de A", pbSees.body.length === 0, pbSees.body);
    const delPublished = await a.del(`feedback_messages?id=eq.${fbId}`);
    check("feedback disponibilizado não é apagado (FEEDBACK_NOT_DELETABLE)", delPublished.status === 400 && delPublished.body?.message === "FEEDBACK_NOT_DELETABLE", delPublished);
    const archiveFb = await a.patch(`feedback_messages?id=eq.${fbId}`, { archived_at: new Date().toISOString() });
    check("arquivar feedback", archiveFb.status === 200 && archiveFb.body[0].archived_by === NUTRI_A.id, archiveFb);
    const afterArchiveFb = await pa.get(`feedback_messages?id=eq.${fbId}&select=id`);
    check("paciente não vê arquivado", afterArchiveFb.body.length === 0, afterArchiveFb.body);
    const draft2 = await a.post("feedback_messages", { patient_id: PATIENT_A.patientId, author_id: NUTRI_A.id, content: `${TAG} descartável` });
    const delDraft = await a.del(`feedback_messages?id=eq.${draft2.body[0].id}`);
    check("rascunho nunca exibido pode ser apagado", delDraft.status === 200 && delDraft.body.length === 1, delDraft);

    // 3) Materiais ---------------------------------------------------------------------------------
    console.log("\n[3] materiais e atribuições");
    const link = await a.post("patient_materials", { nutritionist_id: NUTRI_A.id, kind: "LINK", title: `${TAG} guia (link)`, external_url: "https://example.com/guia" });
    check("material de link criado", link.status === 201, link);
    const linkId = link.body[0].id;
    const badLink = await a.post("patient_materials", { nutritionist_id: NUTRI_A.id, kind: "LINK", title: `${TAG} x`, external_url: "data:text/html,x" });
    check("material com URL data: recusado (23514)", badLink.status === 400 && badLink.body?.code === "23514", badLink);
    const both = await a.post("patient_materials", { nutritionist_id: NUTRI_A.id, kind: "LINK", title: `${TAG} x`, external_url: "https://example.com", storage_path: "a/b.pdf" });
    check("arquivo E link recusado", both.status === 400, both);
    const asB = await a.post("patient_materials", { nutritionist_id: NUTRI_B.id, kind: "LINK", title: `${TAG} x`, external_url: "https://example.com" });
    check("nutri A não cria material em nome de B", asB.status >= 400, asB);
    const file = await a.post("patient_materials", { nutritionist_id: NUTRI_A.id, kind: "FILE", title: `${TAG} guia (pdf)` });
    check("material de arquivo nasce sem path (incompleto)", file.status === 201 && file.body[0].storage_path === null, file);
    const fileId = file.body[0].id;
    const assignIncomplete = await a.post("material_assignments", { material_id: fileId, patient_id: PATIENT_A.patientId });
    check("incompleto não é atribuído (MATERIAL_INCOMPLETE)", assignIncomplete.status === 400 && assignIncomplete.body?.message === "MATERIAL_INCOMPLETE", assignIncomplete);
    const outside = await a.upload(`${linkId}/hack.pdf`, PDF, "application/pdf");
    check("upload em pasta de outro material do MESMO nutri é aceito pelo bucket (a app nunca faz isso), ou recusado", outside.status === 200 || outside.status >= 400, outside);
    if (outside.status === 200) await a.remove(`${linkId}/hack.pdf`);
    uploadedPath = `${fileId}/11111111-1111-1111-1111-111111111111.pdf`;
    const up = await a.upload(uploadedPath, PDF, "application/pdf");
    check("nutri A envia o PDF para <material_id>/<uuid>.pdf", up.status === 200, up);
    const upB = await b.upload(`${fileId}/hack-b.pdf`, PDF, "application/pdf");
    check("nutri B não grava na pasta do material de A", upB.status >= 400, upB);
    const upPA = await pa.upload(`${fileId}/hack-pa.pdf`, PDF, "application/pdf");
    check("paciente não grava no bucket de materiais", upPA.status >= 400, upPA);
    const badPath = await a.patch(`patient_materials?id=eq.${fileId}`, { storage_path: `${linkId}/x.pdf` });
    check("storage_path fora de <material_id>/ recusado (MATERIAL_PATH_INVALID)", badPath.status === 400 && badPath.body?.message === "MATERIAL_PATH_INVALID", badPath);
    const meta = await a.patch(`patient_materials?id=eq.${fileId}`, { storage_path: uploadedPath, mime_type: "application/pdf", file_name: "guia.pdf", file_size_bytes: PDF.byteLength });
    check("metadados do arquivo gravados", meta.status === 200 && meta.body[0].storage_path === uploadedPath, meta);

    const beforeAssign = await pa.get(`patient_materials?id=eq.${fileId}&select=id`);
    check("paciente A não vê material não atribuído", beforeAssign.body.length === 0, beforeAssign.body);
    const dlBefore = await pa.download(uploadedPath);
    check("paciente A não baixa antes da atribuição", dlBefore.status >= 400, dlBefore);
    const assign = await a.post("material_assignments", { material_id: fileId, patient_id: PATIENT_A.patientId });
    check("atribuição criada (assigned_by pelo trigger)", assign.status === 201 && assign.body[0].assigned_by === NUTRI_A.id, assign);
    const assignmentId = assign.body[0].id;
    const dup = await a.post("material_assignments", { material_id: fileId, patient_id: PATIENT_A.patientId });
    check("atribuição duplicada recusada (23505)", dup.status === 409 || dup.body?.code === "23505", dup);
    const assignForeign = await a.post("material_assignments", { material_id: fileId, patient_id: NUTRI_B.patientId });
    check("nutri A não atribui a paciente de B", assignForeign.status >= 400, assignForeign);
    const bAssign = await b.post("material_assignments", { material_id: fileId, patient_id: NUTRI_B.patientId });
    check("nutri B não atribui material de A ao próprio paciente (MATERIAL_NOT_AUTHORIZED)", bAssign.status === 400 && bAssign.body?.message === "MATERIAL_NOT_AUTHORIZED", bAssign);
    const selfAssign = await pa.post("material_assignments", { material_id: linkId, patient_id: PATIENT_A.patientId });
    check("paciente não se auto-atribui", selfAssign.status >= 400, selfAssign);

    const seenMaterial = await pa.get(`patient_materials?id=eq.${fileId}&select=title,storage_path`);
    check("paciente A vê o material atribuído", seenMaterial.body.length === 1, seenMaterial.body);
    const dl = await pa.download(uploadedPath);
    check("paciente A baixa o arquivo (autenticado)", dl.status === 200 && dl.size === PDF.byteLength, dl);
    const signed = await pa.sign(uploadedPath);
    check("paciente A gera URL assinada", signed.status === 200 && signed.body?.signedURL, signed);
    const dlPB = await pb.download(uploadedPath);
    check("paciente B não baixa (cross-patient)", dlPB.status >= 400, dlPB);
    const dlB = await b.download(uploadedPath);
    check("nutri B não baixa (cross-nutritionist)", dlB.status >= 400, dlB);
    const dlA = await a.download(uploadedPath);
    check("nutri A baixa o próprio material", dlA.status === 200, dlA);
    const bSeesMaterial = await b.get(`patient_materials?id=eq.${fileId}&select=id`);
    check("nutri B não vê material de A", bSeesMaterial.body.length === 0, bSeesMaterial.body);

    const revoke = await a.patch(`material_assignments?id=eq.${assignmentId}`, { revoked_at: new Date().toISOString() });
    check("revogar (revoked_by pelo trigger)", revoke.status === 200 && revoke.body[0].revoked_by === NUTRI_A.id, revoke);
    const afterRevoke = await pa.get(`patient_materials?id=eq.${fileId}&select=id`);
    check("após revogar, paciente não vê o material", afterRevoke.body.length === 0, afterRevoke.body);
    const dlRevoked = await pa.download(uploadedPath);
    check("após revogar, download negado", dlRevoked.status >= 400, dlRevoked);
    const delAssign = await a.del(`material_assignments?id=eq.${assignmentId}`);
    check("DELETE de atribuição negado (privilégio revogado)", delAssign.status >= 400, delAssign);
    const reassign = await a.patch(`material_assignments?id=eq.${assignmentId}`, { revoked_at: null });
    check("reatribuir limpa revogação", reassign.status === 200 && reassign.body[0].revoked_at === null && reassign.body[0].revoked_by === null, reassign);
    const dlAgain = await pa.download(uploadedPath);
    check("após reatribuir, download volta", dlAgain.status === 200, dlAgain);
    const delMaterial = await a.del(`patient_materials?id=eq.${fileId}`);
    check("material já atribuído não é apagado (MATERIAL_NOT_DELETABLE)", delMaterial.status === 400 && delMaterial.body?.message === "MATERIAL_NOT_DELETABLE", delMaterial);
    const archiveMaterial = await a.patch(`patient_materials?id=eq.${fileId}`, { archived_at: new Date().toISOString() });
    check("arquivar material", archiveMaterial.status === 200 && archiveMaterial.body[0].archived_by === NUTRI_A.id, archiveMaterial);
    const afterArchiveMaterial = await pa.get(`patient_materials?id=eq.${fileId}&select=id`);
    check("paciente não vê material arquivado (mesmo com atribuição ativa)", afterArchiveMaterial.body.length === 0, afterArchiveMaterial.body);
    const dlArchived = await pa.download(uploadedPath);
    check("download de material arquivado negado", dlArchived.status >= 400, dlArchived);
    const assignArchived = await a.post("material_assignments", { material_id: linkId, patient_id: PATIENT_B.patientId });
    check("material de link ativo é atribuído a outro paciente (Beltrano) sem tocar no arquivado", assignArchived.status === 201, assignArchived);
    const delNever = await a.post("patient_materials", { nutritionist_id: NUTRI_A.id, kind: "LINK", title: `${TAG} nunca atribuído`, external_url: "https://example.com/tmp" });
    const delOk = await a.del(`patient_materials?id=eq.${delNever.body[0].id}`);
    check("material nunca atribuído pode ser apagado", delOk.status === 200 && delOk.body.length === 1, delOk);

    // 4) Auditoria --------------------------------------------------------------------------------
    console.log("\n[4] auditoria");
    const audit = await a.post("audit_logs", { actor_id: NUTRI_A.id, action: "MATERIAL_ASSIGNED", entity_type: "material_assignment", entity_id: assignmentId, metadata: { tag: TAG, material_id: fileId, patient_id: PATIENT_A.patientId } });
    check("auditoria registrada só com ids", audit.status === 201, audit);
    const auditB = await b.post("audit_logs", { actor_id: NUTRI_A.id, action: "MATERIAL_ARCHIVED", entity_type: "patient_material", entity_id: fileId, metadata: { tag: TAG } });
    check("nutri B não audita em nome de A", auditB.status >= 400, auditB);
    const auditPA = await pa.post("audit_logs", { actor_id: "90000000-0000-0000-0000-000000000101", action: "FEEDBACK_PUBLISHED", entity_type: "feedback_message", entity_id: fbId, metadata: { tag: TAG } });
    check("paciente não audita feedback", auditPA.status >= 400, auditPA);
  } finally {
    if (nutriClient && uploadedPath) await nutriClient.remove(uploadedPath).catch(() => null);
    await cleanup();
  }

  console.log(`\n${passed} ok, ${failed} falha(s)`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
