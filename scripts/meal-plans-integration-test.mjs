// Testes de integração da Fase 8 (cardápio) contra o Supabase LOCAL de
// verdade — PostgREST/GoTrue com JWTs reais. Cobre via API: criação do
// plano, estrutura (dia/refeição/alimento/substituição), duplicação com ids
// novos, nova versão + publicação atômica (v1 arquivada, paciente passa a
// ver v2), DUAS PUBLICAÇÕES SIMULTÂNEAS (nunca duas publicadas),
// concorrência otimista na edição (updated_at), imutabilidade da versão
// publicada, ownership nutri B x A, paciente A x B, rascunho invisível,
// arquivamento e auditoria.
//
// Requer `npm run db:start` + seed. Uso: npm run test:meal-plans:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const NUTRI_B = { id: "e8000000-0000-0000-0000-000000000001", email: "fase8-nutri-b@example.test", password: "NutricaoDev123" };
const PATIENT_A = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const PATIENT_B = { email: "beltrano.dasilva@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000011" };
const TAG = "fase8-it";

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

async function setup() {
  await withClient(async (client) => {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
       on conflict (id) do nothing`,
      [NUTRI_B.id, NUTRI_B.email, NUTRI_B.password],
    );
    await client.query(`insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 8 Nutri B') on conflict (id) do update set role = excluded.role`, [NUTRI_B.id]);
  });
}

async function cleanup() {
  await withClient(async (client) => {
    // Planos criados por este teste para o Beltrano (título com prefixo).
    // Versões publicadas/arquivadas são imutáveis por trigger (histórico),
    // então a limpeza desliga os triggers da sessão e apaga em ordem.
    await client.query(`delete from public.audit_logs where metadata->>'tag' = $1`, [TAG]);
    await client.query(`set session_replication_role = replica`);
    await client.query(
      `with plans as (select id from public.meal_plans where patient_id = $1 and title like $2),
            versions as (select id from public.meal_plan_versions where meal_plan_id in (select id from plans)),
            days as (select id from public.meal_plan_days where version_id in (select id from versions)),
            ms as (select id from public.meals where day_id in (select id from days)),
            items as (select id from public.meal_items where meal_id in (select id from ms)),
            d1 as (delete from public.meal_substitutions where meal_item_id in (select id from items)),
            d2 as (delete from public.meal_items where id in (select id from items)),
            d3 as (delete from public.meals where id in (select id from ms)),
            d4 as (delete from public.meal_plan_days where id in (select id from days)),
            d5 as (delete from public.meal_plan_versions where id in (select id from versions))
       delete from public.meal_plans where id in (select id from plans)`,
      [PATIENT_B.patientId, `${TAG}%`],
    );
    await client.query(`set session_replication_role = origin`);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B.id]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B.id]);
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();

  try {
    const [tokenA, tokenB, tokenPA, tokenPB] = await Promise.all([signIn(NUTRI_A), signIn(NUTRI_B), signIn(PATIENT_A), signIn(PATIENT_B)]);
    const a = rest(tokenA);
    const b = rest(tokenB);
    const pa = rest(tokenPA);
    const pb = rest(tokenPB);

    // 1) Plano + estrutura -----------------------------------------------------------
    console.log("\n[1] criar plano e estrutura (Beltrano)");
    const created = await a.rpc("create_meal_plan", { p_patient_id: PATIENT_B.patientId, p_title: `${TAG} plano`, p_notes: "obs geral" });
    check("create_meal_plan devolve o id", created.status === 200 && typeof created.body === "string", created);
    const planId = created.body;
    const versions = await a.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id,version_number,status`);
    check("plano nasce com v1 DRAFT", versions.body.length === 1 && versions.body[0].status === "DRAFT" && versions.body[0].version_number === 1, versions.body);
    const v1 = versions.body[0].id;
    const dup = await a.rpc("create_meal_plan", { p_patient_id: PATIENT_B.patientId, p_title: `${TAG} outro` });
    check("segundo plano ativo é recusado (MEAL_PLAN_ACTIVE_EXISTS)", dup.status === 400 && dup.body?.message === "MEAL_PLAN_ACTIVE_EXISTS", dup);

    const day = await a.post("meal_plan_days", { version_id: v1, weekday: 1 });
    check("dia (segunda) criado", day.status === 201, day);
    const dayId = day.body[0].id;
    const meal = await a.post("meals", { day_id: dayId, name: "Café da manhã", time_of_day: "07:30", sort_order: 1 });
    check("refeição criada", meal.status === 201, meal);
    const mealId = meal.body[0].id;
    const item = await a.post("meal_items", { meal_id: mealId, food_name: "Ovos", quantity: 2, unit: "unidade", sort_order: 1 });
    check("alimento criado", item.status === 201, item);
    const itemId = item.body[0].id;
    const sub = await a.post("meal_substitutions", { meal_item_id: itemId, substitute_food_name: "Iogurte", quantity: 170, unit: "g" });
    check("substituição criada", sub.status === 201, sub);
    const badItem = await a.post("meal_items", { meal_id: mealId, food_name: "Zero", quantity: 0, unit: "g" });
    check("quantidade 0 é recusada pelo banco (check)", badItem.status >= 400, badItem);

    // 2) Duplicação ---------------------------------------------------------------------
    console.log("\n[2] duplicar refeição e dia");
    const mealCopy = await a.rpc("duplicate_meal", { p_meal_id: mealId });
    check("duplicate_meal devolve id novo", mealCopy.status === 200 && mealCopy.body !== mealId, mealCopy);
    const copyItems = await a.get(`meal_items?meal_id=eq.${mealCopy.body}&select=id,food_name,meal_substitutions(id,substitute_food_name)`);
    check("cópia tem alimento + substituição com ids próprios", copyItems.body.length === 1 && copyItems.body[0].id !== itemId && copyItems.body[0].meal_substitutions.length === 1 && copyItems.body[0].meal_substitutions[0].id !== sub.body[0].id, copyItems.body);
    const dayCopy = await a.rpc("duplicate_meal_plan_day", { p_day_id: dayId, p_target_weekday: 3 });
    check("duplicate_meal_plan_day cria quarta", dayCopy.status === 200, dayCopy);
    const wedMeals = await a.get(`meals?day_id=eq.${dayCopy.body}&select=id`);
    check("quarta tem as 2 refeições copiadas", wedMeals.body.length === 2, wedMeals.body);
    const notEmpty = await a.rpc("duplicate_meal_plan_day", { p_day_id: dayId, p_target_weekday: 3 });
    check("destino com conteúdo não é sobrescrito sem replace", notEmpty.status === 400 && notEmpty.body?.message === "MEAL_PLAN_DAY_NOT_EMPTY", notEmpty);

    // 3) Concorrência otimista -----------------------------------------------------------
    console.log("\n[3] concorrência otimista (updated_at)");
    const fresh = (await a.get(`meal_items?id=eq.${itemId}&select=updated_at`)).body[0];
    const first = await a.patch(`meal_items?id=eq.${itemId}&updated_at=eq.${encodeURIComponent(fresh.updated_at)}`, { quantity: 3 });
    check("primeira edição com carimbo atual aplica (1 linha)", first.status === 200 && first.body.length === 1, first);
    const stale = await a.patch(`meal_items?id=eq.${itemId}&updated_at=eq.${encodeURIComponent(fresh.updated_at)}`, { quantity: 4 });
    check("segunda edição com carimbo antigo NÃO aplica (0 linhas => CONCURRENT_UPDATE na app)", stale.status === 200 && stale.body.length === 0, stale);
    const after = (await a.get(`meal_items?id=eq.${itemId}&select=quantity`)).body[0];
    check("valor final é o da primeira edição (3)", Number(after.quantity) === 3, after);

    // 4) Publicar v1; paciente passa a ver -------------------------------------------------
    console.log("\n[4] publicar v1");
    const beforePublish = await pb.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id,status`);
    check("paciente B não vê rascunho", beforePublish.body.length === 0, beforePublish.body);
    const pub1 = await a.rpc("publish_meal_plan_version", { p_version_id: v1 });
    check("publica v1", pub1.status === 200, pub1);
    const seen = await pb.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id,status,meal_plan_days(weekday,meals(name,meal_items(food_name,quantity,meal_substitutions(substitute_food_name))))`);
    check("paciente B vê a v1 publicada com dias/refeições/alimentos/substituições", seen.body.length === 1 && seen.body[0].status === "PUBLISHED" && seen.body[0].meal_plan_days.length === 2 && seen.body[0].meal_plan_days[0].meals[0].meal_items[0].meal_substitutions.length === 1, seen.body);
    const frozen = await a.patch(`meal_items?id=eq.${itemId}`, { quantity: 9 });
    check("versão publicada é imutável (MEAL_PLAN_VERSION_NOT_EDITABLE)", frozen.status === 400 && frozen.body?.message === "MEAL_PLAN_VERSION_NOT_EDITABLE", frozen);
    const delPub = await a.del(`meals?id=eq.${mealId}`);
    check("refeição publicada não pode ser apagada", delPub.status === 400 && delPub.body?.message === "MEAL_PLAN_VERSION_NOT_EDITABLE", delPub);

    // 5) Nova versão + publicação; paciente passa a ver v2 -------------------------------
    console.log("\n[5] nova versão e publicação atômica");
    const v2res = await a.rpc("create_meal_plan_version", { p_plan_id: planId });
    check("create_meal_plan_version cria v2", v2res.status === 200, v2res);
    const v2 = v2res.body;
    const v2meta = (await a.get(`meal_plan_versions?id=eq.${v2}&select=version_number,status`)).body[0];
    const v1meta = (await a.get(`meal_plan_versions?id=eq.${v1}&select=status`)).body[0];
    check("v2 = DRAFT e v1 continua PUBLISHED", v2meta.version_number === 2 && v2meta.status === "DRAFT" && v1meta.status === "PUBLISHED", { v2meta, v1meta });
    const v2items = await a.get(`meal_items?select=id,meals!inner(meal_plan_days!inner(version_id))&meals.meal_plan_days.version_id=eq.${v2}`);
    check("v2 copiou os alimentos (4)", v2items.body.length === 4, v2items.body.length);
    const draftTwice = await a.rpc("create_meal_plan_version", { p_plan_id: planId });
    check("um rascunho por vez (MEAL_PLAN_DRAFT_EXISTS)", draftTwice.status === 400 && draftTwice.body?.message === "MEAL_PLAN_DRAFT_EXISTS", draftTwice);
    const v2item = v2items.body[0].id;
    const editV2 = await a.patch(`meal_items?id=eq.${v2item}`, { food_name: "Ovos caipiras" });
    check("rascunho v2 é editável", editV2.status === 200 && editV2.body.length === 1, editV2);

    const pub2 = await a.rpc("publish_meal_plan_version", { p_version_id: v2 });
    check("publica v2", pub2.status === 200, pub2);
    const statuses = (await a.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=version_number,status&order=version_number`)).body;
    check("v1 ARCHIVED, v2 PUBLISHED (histórico preservado)", statuses.length === 2 && statuses[0].status === "ARCHIVED" && statuses[1].status === "PUBLISHED", statuses);
    const seenNow = await pb.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id,status`);
    check("paciente B passa a ver só a v2", seenNow.body.length === 1 && seenNow.body[0].id === v2, seenNow.body);
    const v1content = (await a.get(`meal_items?id=eq.${itemId}&select=food_name,quantity`)).body[0];
    check("conteúdo de v1 permanece intacto no histórico", v1content.food_name === "Ovos" && Number(v1content.quantity) === 3, v1content);

    // 6) Publicação concorrente ------------------------------------------------------------
    console.log("\n[6] duas publicações simultâneas");
    const v3 = (await a.rpc("create_meal_plan_version", { p_plan_id: planId })).body;
    const [r1, r2] = await Promise.all([a.rpc("publish_meal_plan_version", { p_version_id: v3 }), a.rpc("publish_meal_plan_version", { p_version_id: v3 })]);
    const okCount = [r1, r2].filter((r) => r.status === 200).length;
    const conflict = [r1, r2].find((r) => r.status !== 200);
    check("exatamente 1 sucesso e 1 recusa amigável", okCount === 1 && conflict && ["MEAL_PLAN_ALREADY_PUBLISHED", "PUBLISH_CONFLICT"].includes(conflict.body?.message), { r1, r2 });
    const publishedCount = (await a.get(`meal_plan_versions?meal_plan_id=eq.${planId}&status=eq.PUBLISHED&select=id`)).body;
    check("nunca duas publicadas (1 linha PUBLISHED)", publishedCount.length === 1 && publishedCount[0].id === v3, publishedCount);
    const v4 = (await a.rpc("create_meal_plan_version", { p_plan_id: planId })).body;
    const v5attempt = await a.rpc("create_meal_plan_version", { p_plan_id: planId });
    check("v4 rascunho; v5 bloqueada por rascunho existente", typeof v4 === "string" && v5attempt.status === 400, v5attempt);
    const discard = await a.rpc("discard_meal_plan_version", { p_version_id: v4 });
    check("descarta v4", discard.status === 200 || discard.status === 204, discard);

    // 7) Ownership ---------------------------------------------------------------------------
    console.log("\n[7] ownership: Nutri B x plano de A; paciente A x paciente B");
    const bReads = await b.get(`meal_plans?id=eq.${planId}&select=id`);
    check("Nutri B não lê o plano", bReads.body.length === 0, bReads.body);
    const bVersion = await b.rpc("create_meal_plan_version", { p_plan_id: planId });
    check("Nutri B não cria versão (MEAL_PLAN_NOT_FOUND)", bVersion.status === 400 && bVersion.body?.message === "MEAL_PLAN_NOT_FOUND", bVersion);
    const bPublish = await b.rpc("publish_meal_plan_version", { p_version_id: v3 });
    check("Nutri B não publica (MEAL_PLAN_VERSION_NOT_FOUND)", bPublish.status === 400 && bPublish.body?.message === "MEAL_PLAN_VERSION_NOT_FOUND", bPublish);
    const bInsert = await b.post("meal_plan_days", { version_id: v3, weekday: 5 });
    check("Nutri B não insere dia no plano de A", bInsert.status >= 400, bInsert);
    const bCreate = await b.rpc("create_meal_plan", { p_patient_id: PATIENT_B.patientId, p_title: "invasão" });
    check("Nutri B não cria plano para paciente de A (PATIENT_NOT_FOUND)", bCreate.status === 400 && bCreate.body?.message === "PATIENT_NOT_FOUND", bCreate);
    const paSees = await pa.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id`);
    check("paciente A não vê o plano do paciente B", paSees.body.length === 0, paSees.body);
    const paWrite = await pa.post("meals", { day_id: dayId, name: "hack", sort_order: 9 });
    check("paciente não escreve no cardápio", paWrite.status >= 400, paWrite);
    const pbRpc = await pb.rpc("publish_meal_plan_version", { p_version_id: v3 });
    check("paciente não publica o próprio plano", pbRpc.status >= 400, pbRpc);

    // 8) Arquivar + auditoria --------------------------------------------------------------
    console.log("\n[8] arquivar e auditoria");
    const archive = await a.rpc("archive_meal_plan", { p_plan_id: planId });
    check("arquiva o plano", archive.status === 200 || archive.status === 204, archive);
    const afterArchive = await pb.get(`meal_plan_versions?meal_plan_id=eq.${planId}&select=id`);
    check("paciente deixa de ver após arquivar", afterArchive.body.length === 0, afterArchive.body);
    const reuse = await a.rpc("create_meal_plan", { p_patient_id: PATIENT_B.patientId, p_title: `${TAG} plano 2`, p_source_version_id: v3 });
    check("novo plano com a v3 arquivada como base", reuse.status === 200, reuse);
    const reuseItems = await a.get(`meal_items?select=id,meals!inner(meal_plan_days!inner(meal_plan_versions!inner(meal_plan_id)))&meals.meal_plan_days.meal_plan_versions.meal_plan_id=eq.${reuse.body}`);
    check("novo plano recebeu a estrutura copiada (4 alimentos)", reuseItems.body.length === 4, reuseItems.body.length);
    const audit = await a.post("audit_logs", { actor_id: NUTRI_A.id, action: "MEAL_PLAN_VERSION_PUBLISHED", entity_type: "meal_plan_version", entity_id: v3, metadata: { tag: TAG, plan_id: planId } });
    check("auditoria de publicação registrada (só ids)", audit.status === 201, audit);
    const auditB = await b.post("audit_logs", { actor_id: NUTRI_A.id, action: "MEAL_PLAN_ARCHIVED", entity_type: "meal_plan", entity_id: planId, metadata: { tag: TAG } });
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
