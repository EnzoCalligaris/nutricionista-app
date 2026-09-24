// Testes de integração da Fase 14 (configurações, planos/preços/benefícios,
// resultados antes/depois com consentimento, storage e CMS do blog) contra o
// Supabase LOCAL de verdade — PostgREST/GoTrue/Storage com JWTs reais, como a
// aplicação faz. Cobre o que o pgTAP (transação única como superuser) não
// exercita: RLS via API, ownership entre DOIS nutricionistas, ids adulterados
// na request, RPCs, policies do Storage e a visibilidade pública real.
//
// Mesmo padrão dos scripts das fases anteriores: requer `npm run db:start` e o
// seed; fica fora do `npm run test:run`.
//
// Uso: npm run test:admin-content:integration

import pg from "pg";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
// Chave de service role do Supabase LOCAL (a mesma de tests/integration/setup.ts).
// Usada SÓ para limpar os objetos de teste pela Storage API — objetos de
// storage não podem ser apagados por SQL direto.
const SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const NUTRI_A = { email: "dev-nutricionista@example.test", password: "NutricaoDev123" };
const PATIENT_LOGIN = { email: "fulana.detal@example.test", password: "NutricaoDev123" };
const FULANA_ID = "90000000-0000-0000-0000-000000000010";

// Nutricionista B e paciente dele: criados por este script, removidos no fim.
const NUTRI_B_ID = "e1400000-0000-0000-0000-000000000001";
const NUTRI_B = { email: "fase14-nutri-b@example.test", password: "NutricaoDev123" };
const NUTRI_B_PATIENT_ID = "e1400000-0000-0000-0000-000000000010";

const TEST_KEY_PREFIX = "fase14";

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok — ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL — ${label}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ""}`);
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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  });
  return {
    async get(path) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async post(path, payload, prefer = "return=representation") {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: "POST",
        headers: headers({ Prefer: prefer }),
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
    async uploadObject(bucket, path, bytes, contentType) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": contentType,
        },
        body: bytes,
      });
      return { status: response.status, body: await response.text() };
    },
    async downloadObject(bucket, path) {
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        headers: { apikey: ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return { status: response.status };
    },
  };
}

/** WEBP mínimo válido (assinatura RIFF....WEBP) — nenhuma foto real. */
function fakeWebp() {
  const header = Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "binary");
  return Buffer.concat([header, Buffer.alloc(64, 0)]);
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
      `insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Fase 14 Nutri B')
       on conflict (id) do update set role = excluded.role, full_name = excluded.full_name`,
      [NUTRI_B_ID],
    );
    await client.query(
      `insert into public.patients (id, nutritionist_id, full_name, email) values ($1, $2, 'Paciente de B', 'fase14-paciente-b@example.test')
       on conflict (id) do nothing`,
      [NUTRI_B_PATIENT_ID, NUTRI_B_ID],
    );
    await client.query("commit");
  });
}

/**
 * Remove objetos de teste pela Storage API (SQL direto é bloqueado por
 * `storage.protect_delete`). Lista os nomes no banco e apaga pela API.
 */
async function cleanupStorage() {
  const buckets = await withClient(async (client) => {
    const { rows } = await client.query(
      `select bucket_id, name from storage.objects
        where bucket_id in ('before-after', 'site-assets', 'blog')
          and (
            name like '%${TEST_KEY_PREFIX}%'
            or (storage.foldername(name))[1] in (select id::text from public.before_after_results where title like 'Fase 14%')
          )`,
    );
    return rows;
  });

  const byBucket = new Map();
  for (const row of buckets) {
    if (!byBucket.has(row.bucket_id)) byBucket.set(row.bucket_id, []);
    byBucket.get(row.bucket_id).push(row.name);
  }

  for (const [bucket, names] of byBucket) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: names }),
    });
    if (!response.ok) {
      console.warn(`  aviso — não removeu objetos de ${bucket}: ${response.status}`);
    }
  }
}

async function cleanup() {
  await cleanupStorage();
  await withClient(async (client) => {
    await client.query("begin");
    await client.query(`delete from public.audit_logs where entity_id in (select id from public.before_after_results where title like 'Fase 14%')`);
    await client.query(`delete from public.before_after_results where title like 'Fase 14%'`);
    await client.query(`delete from public.media_consents where evidence_reference like 'Fase 14%'`);
    await client.query(`delete from public.blog_post_slug_aliases where slug like 'fase14-%'`);
    await client.query(`delete from public.audit_logs where entity_id in (select id from public.blog_posts where slug like 'fase14-%')`);
    await client.query(`delete from public.blog_posts where slug like 'fase14-%'`);
    await client.query(`delete from public.site_settings where key like 'home.%' or key like 'address.%' or key like 'attendance.%' or key in ('contact.phone','contact.whatsapp','contact.email','social.instagram','social.linkedin','professional.crn','professional.name','seo.default_title')`);
    await client.query(`delete from public.plan_benefits where label like 'Fase 14%'`);
    await client.query(`delete from public.plan_prices where label like 'Fase 14%'`);
    await client.query(`delete from public.plans where code = 'FASE14'`);
    await client.query(`delete from public.audit_logs where actor_id = $1`, [NUTRI_B_ID]);
    await client.query(`delete from public.patients where id = $1`, [NUTRI_B_PATIENT_ID]);
    await client.query(`delete from public.profiles where id = $1`, [NUTRI_B_ID]);
    await client.query(`delete from auth.users where id = $1`, [NUTRI_B_ID]);
    // Restaura o catálogo real: nenhuma condição principal em TRIMESTRAL.
    await client.query(
      `update public.plan_prices set is_primary = false
        where plan_id = (select id from public.plans where code = 'TRIMESTRAL')`,
    );
    await client.query("commit");
  });
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} ...`);
  await cleanup();
  await setup();

  try {
    const aSession = await signIn(NUTRI_A);
    const a = rest(aSession.token);
    const bSession = await signIn(NUTRI_B);
    const b = rest(bSession.token);
    const patientSession = await signIn(PATIENT_LOGIN);
    const p = rest(patientSession.token);
    const anon = rest(null);

    // ================================================================
    console.log("\n[1] site_settings — escrita, visibilidade e mass assignment");
    // ================================================================
    const savePhone = await a.post(
      "site_settings",
      { key: "contact.phone", value: "+5511999990001", is_public: true, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    check("nutricionista grava configuração pública", savePhone.status === 201, savePhone.body);

    const savePrivate = await a.post(
      "site_settings",
      { key: "attendance.online_instructions", value: "Entre 5 minutos antes.", is_public: false, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    check("nutricionista grava configuração privada", savePrivate.status === 201, savePrivate.body);

    const badKey = await a.post("site_settings", { key: "Contact.Phone", value: "x" });
    check("chave fora do formato é recusada pelo banco", badKey.status === 400, badKey.status);

    const anonPublic = await anon.get("site_settings?key=eq.contact.phone&select=key,value");
    check("anon lê configuração pública", Array.isArray(anonPublic.body) && anonPublic.body.length === 1, anonPublic.body);

    const anonPrivate = await anon.get("site_settings?key=eq.attendance.online_instructions&select=key");
    check(
      "anon NUNCA lê instruções da consulta online",
      Array.isArray(anonPrivate.body) && anonPrivate.body.length === 0,
      anonPrivate.body,
    );

    const patientWrite = await p.post("site_settings", { key: "home.headline", value: "hack" });
    check("paciente não grava configuração (§43)", patientWrite.status === 401 || patientWrite.status === 403, patientWrite.status);

    // Endereço escondido: gravado com is_public=false, invisível ao anon (§6).
    await a.post(
      "site_settings",
      { key: "address.street", value: "Rua Exemplo", is_public: false, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    await a.post(
      "site_settings",
      { key: "address.show_public", value: false, is_public: true, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    const anonAddressHidden = await anon.get("site_settings?key=eq.address.street&select=key");
    check(
      "endereço não vaza para anon com show_public desligado (§6)",
      Array.isArray(anonAddressHidden.body) && anonAddressHidden.body.length === 0,
      anonAddressHidden.body,
    );

    // Liberar: a aplicação regrava a linha com is_public=true.
    await a.post(
      "site_settings",
      { key: "address.street", value: "Rua Exemplo", is_public: true, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    await a.post(
      "site_settings",
      { key: "address.show_public", value: true, is_public: true, updated_by: aSession.userId },
      "return=representation,resolution=merge-duplicates",
    );
    const anonAddressVisible = await anon.get("site_settings?key=eq.address.street&select=key,value");
    check(
      "endereço aparece para anon quando autorizado (§6)",
      Array.isArray(anonAddressVisible.body) && anonAddressVisible.body.length === 1,
      anonAddressVisible.body,
    );

    // ================================================================
    console.log("\n[2] Planos, preços e condição principal");
    // ================================================================
    const planCreate = await a.post("plans", {
      code: "FASE14",
      name: "Plano Fase 14",
      active: true,
      publicly_visible: false,
      available_for_sale: false,
    });
    const planId = Array.isArray(planCreate.body) ? planCreate.body[0]?.id : null;
    check("nutricionista cria plano", Boolean(planId), planCreate.body);

    const zeroPrice = await a.post("plan_prices", {
      plan_id: planId,
      label: "Fase 14 zero",
      amount_cents: 0,
      payment_type: "AVISTA",
    });
    check("preço zero é recusado pelo banco (§18)", zeroPrice.status === 400, zeroPrice.status);

    const negativeInstallments = await a.post("plan_prices", {
      plan_id: planId,
      label: "Fase 14 parcelas",
      amount_cents: 10000,
      installments: 0,
      payment_type: "AVISTA",
    });
    check("parcelas zero é recusado pelo banco (§18)", negativeInstallments.status === 400, negativeInstallments.status);

    const priceA = await a.post("plan_prices", {
      plan_id: planId,
      label: "Fase 14 A",
      amount_cents: 60000,
      installments: 1,
      payment_type: "AVISTA",
    });
    const priceB = await a.post("plan_prices", {
      plan_id: planId,
      label: "Fase 14 B",
      amount_cents: 68037,
      installments: 3,
      payment_type: "PARCELADO",
    });
    const priceAId = priceA.body?.[0]?.id;
    const priceBId = priceB.body?.[0]?.id;
    check("duas condições criadas sem principal (§16)", Boolean(priceAId && priceBId), { priceA: priceA.body, priceB: priceB.body });

    await a.rpc("set_plan_primary_price", { p_plan_id: planId, p_price_id: priceAId });
    let primaries = await a.get(`plan_prices?plan_id=eq.${planId}&is_primary=eq.true&select=id`);
    check("A é a única principal", primaries.body?.length === 1 && primaries.body[0].id === priceAId, primaries.body);

    await a.rpc("set_plan_primary_price", { p_plan_id: planId, p_price_id: priceBId });
    primaries = await a.get(`plan_prices?plan_id=eq.${planId}&is_primary=eq.true&select=id`);
    check(
      "trocando para B, SOMENTE B é principal (§66)",
      primaries.body?.length === 1 && primaries.body[0].id === priceBId,
      primaries.body,
    );

    await a.rpc("clear_plan_primary_price", { p_plan_id: planId });
    primaries = await a.get(`plan_prices?plan_id=eq.${planId}&is_primary=eq.true&select=id`);
    check("nenhuma principal é estado válido (§17/§67)", primaries.body?.length === 0, primaries.body);

    // Plano não público não vaza para anon.
    const anonPlan = await anon.get(`plans?id=eq.${planId}&select=id`);
    check("plano não público é invisível ao visitante", anonPlan.body?.length === 0, anonPlan.body);

    // ANUAL continua fora do site (§68).
    const anonAnnual = await anon.get("plans?code=eq.ANUAL&select=id");
    check("ANUAL não aparece no site (§68)", anonAnnual.body?.length === 0, anonAnnual.body);
    const adminAnnual = await a.get("plans?code=eq.ANUAL&select=active,publicly_visible,available_for_sale");
    check(
      "ANUAL: ativo, invisível e sem venda — visível só no dashboard (§68)",
      adminAnnual.body?.[0]?.active === true &&
        adminAnnual.body?.[0]?.publicly_visible === false &&
        adminAnnual.body?.[0]?.available_for_sale === false,
      adminAnnual.body,
    );

    // Consulta avulsa mantém o valor já definido (§15).
    const avulsa = await anon.get("plan_prices?select=amount_cents,is_primary,plans!inner(code)&plans.code=eq.AVULSA");
    check(
      "consulta avulsa continua R$ 230,00 como condição principal (§15)",
      avulsa.body?.some((row) => row.amount_cents === 23000 && row.is_primary === true),
      avulsa.body,
    );

    // Benefícios: ordenação atômica.
    const benefit1 = await a.post("plan_benefits", { plan_id: planId, label: "Fase 14 benefício 1", sort_order: 1 });
    const benefit2 = await a.post("plan_benefits", { plan_id: planId, label: "Fase 14 benefício 2", sort_order: 2 });
    const swap = await a.rpc("swap_plan_benefit_order", {
      p_benefit_id: benefit1.body?.[0]?.id,
      p_other_benefit_id: benefit2.body?.[0]?.id,
    });
    const benefits = await a.get(`plan_benefits?plan_id=eq.${planId}&select=label,sort_order&order=sort_order`);
    check(
      "benefícios reordenados atomicamente (§19)",
      swap.status < 300 && benefits.body?.[0]?.label === "Fase 14 benefício 2",
      benefits.body,
    );

    const patientPlan = await p.patch(`plans?id=eq.${planId}`, { publicly_visible: true });
    const stillHidden = await a.get(`plans?id=eq.${planId}&select=publicly_visible`);
    check(
      "paciente não altera plano (§73)",
      stillHidden.body?.[0]?.publicly_visible === false,
      { status: patientPlan.status, plan: stillHidden.body },
    );

    // ================================================================
    console.log("\n[3] Resultado antes/depois, consentimento e storage");
    // ================================================================
    const resultCreate = await a.post("before_after_results", {
      nutritionist_id: aSession.userId,
      patient_id: FULANA_ID,
      title: "Fase 14 — evolução de teste",
      sort_order: 1,
    });
    const resultId = resultCreate.body?.[0]?.id;
    check("resultado criado como rascunho", Boolean(resultId) && resultCreate.body[0].published === false, resultCreate.body);

    // Mass assignment: nutritionist_id de outra pessoa é recusado (§56).
    const forged = await a.post("before_after_results", {
      nutritionist_id: NUTRI_B_ID,
      title: "Fase 14 — forjado",
    });
    check("não cria resultado no nome de outro nutricionista (§56)", forged.status === 403 || forged.status === 401, forged.status);

    // Publicar sem imagens.
    let publish = await a.rpc("publish_before_after_result", { p_result_id: resultId });
    check(
      "publicar sem as duas fotos é recusado (§70)",
      publish.status >= 400 && JSON.stringify(publish.body).includes("RESULT_IMAGES_MISSING"),
      publish.body,
    );

    // Upload real das duas fotos no bucket PRIVADO.
    const webp = fakeWebp();
    const beforePath = `${resultId}/before.webp`;
    const afterPath = `${resultId}/after.webp`;
    const upBefore = await a.uploadObject("before-after", beforePath, webp, "image/webp");
    const upAfter = await a.uploadObject("before-after", afterPath, webp, "image/webp");
    check("nutricionista sobe as fotos no bucket privado", upBefore.status === 200 && upAfter.status === 200, {
      before: upBefore.status,
      after: upAfter.status,
    });

    const anonUpload = await anon.uploadObject("before-after", `${resultId}/anon.webp`, webp, "image/webp");
    check("anon não escreve no bucket before-after", anonUpload.status >= 400, anonUpload.status);

    await a.patch(`before_after_results?id=eq.${resultId}`, { before_path: beforePath, after_path: afterPath });

    publish = await a.rpc("publish_before_after_result", { p_result_id: resultId });
    check(
      "publicar sem consentimento é recusado (§29/§70)",
      publish.status >= 400 && JSON.stringify(publish.body).includes("RESULT_CONSENT_REQUIRED"),
      publish.body,
    );

    // Consentimento válido.
    const consent = await a.post("media_consents", {
      patient_id: FULANA_ID,
      consent_type: "BEFORE_AFTER_PHOTOS",
      consent_version: "image_use_v1",
      name_display_mode: "FIRST_NAME",
      evidence_reference: "Fase 14 — termo assinado arquivado",
      granted_by: aSession.userId,
    });
    const consentId = consent.body?.[0]?.id;
    check("consentimento registrado com versão e modo de identificação (§30)", Boolean(consentId), consent.body);

    await a.patch(`before_after_results?id=eq.${resultId}`, { media_consent_id: consentId, display_name: "Fulana" });

    publish = await a.rpc("publish_before_after_result", { p_result_id: resultId });
    check("publica com fotos + consentimento válido (§69)", publish.status < 300, publish.body);

    const anonResult = await anon.get(`before_after_results?id=eq.${resultId}&select=id,title,display_name`);
    check("resultado publicado aparece para o visitante (§69)", anonResult.body?.length === 1, anonResult.body);

    const anonPath = await anon.rpc("public_result_image_path", { p_result_id: resultId, p_slot: "before" });
    check("elegível: a função devolve o path para a rota pública (§71)", typeof anonPath.body === "string", anonPath.body);

    const anonDirect = await anon.downloadObject("before-after", beforePath);
    check("objeto do bucket privado NÃO é público (§71)", anonDirect.status >= 400, anonDirect.status);

    // Revogação: sai do site na hora (§31/§69).
    const revoke = await a.rpc("revoke_media_consent", { p_consent_id: consentId, p_reason: "teste de revogação" });
    check("consentimento revogado", revoke.status < 300, revoke.body);

    const anonAfterRevoke = await anon.get(`before_after_results?id=eq.${resultId}&select=id`);
    check("resultado desaparece do site imediatamente após a revogação (§31/§69)", anonAfterRevoke.body?.length === 0, anonAfterRevoke.body);

    const anonPathAfterRevoke = await anon.rpc("public_result_image_path", { p_result_id: resultId, p_slot: "before" });
    check("rota pública deixa de receber o path após a revogação (§71)", anonPathAfterRevoke.body === null, anonPathAfterRevoke.body);

    const stillPublished = await a.get(`before_after_results?id=eq.${resultId}&select=published`);
    check(
      "published continua true — histórico do que foi publicado é preservado",
      stillPublished.body?.[0]?.published === true,
      stillPublished.body,
    );

    const republish = await a.rpc("publish_before_after_result", { p_result_id: resultId });
    check(
      "não republica com consentimento revogado (§70)",
      republish.status >= 400 && JSON.stringify(republish.body).includes("RESULT_CONSENT_REVOKED"),
      republish.body,
    );

    // Ownership entre nutricionistas (§73).
    const bReads = await b.get(`before_after_results?id=eq.${resultId}&select=id`);
    check("nutri B não lê resultado de A (§73)", bReads.body?.length === 0, bReads.body);

    const bPublishes = await b.rpc("publish_before_after_result", { p_result_id: resultId });
    check(
      "nutri B não publica resultado de A (§73)",
      bPublishes.status >= 400 && JSON.stringify(bPublishes.body).includes("RESULT_NOT_FOUND"),
      bPublishes.body,
    );

    const bConsent = await b.get(`media_consents?id=eq.${consentId}&select=id`);
    check("nutri B não lê consentimento de paciente de A (§55)", bConsent.body?.length === 0, bConsent.body);

    const bDownload = await b.downloadObject("before-after", beforePath);
    check("nutri B não baixa a foto do resultado de A (§71/§73)", bDownload.status >= 400, bDownload.status);

    const bUpload = await b.uploadObject("before-after", `${resultId}/invasao.webp`, webp, "image/webp");
    check("nutri B não sobe foto na pasta do resultado de A (§71/§73)", bUpload.status >= 400, bUpload.status);

    const patientDownload = await p.downloadObject("before-after", beforePath);
    check("paciente do resultado continua vendo a própria foto", patientDownload.status === 200, patientDownload.status);

    const patientResult = await p.post("before_after_results", { nutritionist_id: aSession.userId, title: "Fase 14 hack" });
    check("paciente não cria resultado (§73)", patientResult.status === 401 || patientResult.status === 403, patientResult.status);

    // Arquivar preserva histórico (§37).
    const archive = await a.rpc("archive_before_after_result", { p_result_id: resultId });
    const archived = await a.get(`before_after_results?id=eq.${resultId}&select=published,archived_at`);
    check(
      "arquivar despublica e mantém histórico (§37)",
      archive.status < 300 && archived.body?.[0]?.published === false && archived.body?.[0]?.archived_at !== null,
      archived.body,
    );

    // ================================================================
    console.log("\n[4] Blog — rascunho, publicação, arquivamento e alias");
    // ================================================================
    const draft = await a.post("blog_posts", {
      title: "Fase 14 — rascunho",
      slug: "fase14-rascunho",
      author_id: aSession.userId,
      status: "DRAFT",
      content: { type: "doc", content: [] },
    });
    const draftId = draft.body?.[0]?.id;
    check("post criado como rascunho", Boolean(draftId) && draft.body[0].status === "DRAFT", draft.body);

    const anonDraft = await anon.get(`blog_posts?id=eq.${draftId}&select=id`);
    check("rascunho não vaza para o público (§72)", anonDraft.body?.length === 0, anonDraft.body);

    await a.patch(`blog_posts?id=eq.${draftId}`, {
      status: "PUBLISHED",
      published_at: new Date().toISOString(),
      published_by: aSession.userId,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Conteúdo." }] }] },
    });
    const anonPublished = await anon.get(`blog_posts?id=eq.${draftId}&select=id,slug`);
    check("publicado fica visível (§72)", anonPublished.body?.length === 1, anonPublished.body);

    // Troca de slug de post publicado gera alias (§42).
    await a.patch(`blog_posts?id=eq.${draftId}`, { slug: "fase14-rascunho-novo" });
    const aliases = await a.get(`blog_post_slug_aliases?post_id=eq.${draftId}&select=slug`);
    check(
      "endereço antigo guardado como alias (§42)",
      aliases.body?.some((row) => row.slug === "fase14-rascunho"),
      aliases.body,
    );

    const anonAlias = await anon.get("blog_post_slug_aliases?slug=eq.fase14-rascunho&select=slug");
    check("alias de post publicado é legível pelo público (redirect §42)", anonAlias.body?.length === 1, anonAlias.body);

    // Slug já usado é recusado.
    const dupSlug = await a.post("blog_posts", {
      title: "Fase 14 — duplicado",
      slug: "fase14-rascunho-novo",
      author_id: aSession.userId,
      status: "DRAFT",
      content: { type: "doc", content: [] },
    });
    check("slug duplicado é recusado (§42)", dupSlug.status === 409 || dupSlug.status === 400, dupSlug.status);

    // Arquivar: 404 no público (§72).
    await a.patch(`blog_posts?id=eq.${draftId}`, { status: "ARCHIVED", archived_at: new Date().toISOString() });
    const anonArchived = await anon.get(`blog_posts?id=eq.${draftId}&select=id`);
    check("arquivado volta a ser 404 no público (§72)", anonArchived.body?.length === 0, anonArchived.body);

    const anonAliasArchived = await anon.get("blog_post_slug_aliases?slug=eq.fase14-rascunho&select=slug");
    check("alias de post arquivado não vaza (§72)", anonAliasArchived.body?.length === 0, anonAliasArchived.body);

    const patientPost = await p.post("blog_posts", {
      title: "Fase 14 hack",
      slug: "fase14-hack",
      author_id: patientSession.userId,
      status: "PUBLISHED",
    });
    check("paciente não cria post (§43/§73)", patientPost.status === 401 || patientPost.status === 403, patientPost.status);

    // ================================================================
    console.log("\n[5] Assets institucionais e auditoria");
    // ================================================================
    const assetPath = `professional-photo_path/fase14.webp`;
    const assetUpload = await a.uploadObject("site-assets", assetPath, webp, "image/webp");
    check("nutricionista sobe asset institucional", assetUpload.status === 200, assetUpload.body);

    const anonAsset = await anon.downloadObject("site-assets", assetPath);
    check("asset institucional é público (§45/§46)", anonAsset.status === 200, anonAsset.status);

    const patientAsset = await p.uploadObject("site-assets", "professional-photo_path/hack.webp", webp, "image/webp");
    check("paciente não sobe asset institucional", patientAsset.status >= 400, patientAsset.status);

    // Auditoria: ator é sempre o autenticado (§56).
    const auditForged = await a.post("audit_logs", {
      actor_id: NUTRI_B_ID,
      action: "RESULT_PUBLISHED",
      entity_type: "before_after_result",
      entity_id: resultId,
    });
    check("não registra auditoria no nome de outro ator (§56)", auditForged.status === 403 || auditForged.status === 401, auditForged.status);

    const auditOk = await a.post("audit_logs", {
      actor_id: aSession.userId,
      action: "RESULT_PUBLISHED",
      entity_type: "before_after_result",
      entity_id: resultId,
      metadata: { published: true },
    });
    check("auditoria gravada com o ator autenticado (§52)", auditOk.status === 201, auditOk.body);

    const auditRead = await p.get("audit_logs?select=id&limit=1");
    check("paciente não lê auditoria", auditRead.body?.length === 0 || auditRead.status >= 400, auditRead.body);

    const settingsAudit = await a.post("audit_logs", {
      actor_id: aSession.userId,
      action: "SETTINGS_UPDATED",
      entity_type: "site_settings",
      entity_id: null,
      metadata: { group: "contact", changed_keys: ["contact.phone"] },
    });
    check("auditoria de configuração aceita entity_id nulo (§52)", settingsAudit.status === 201, settingsAudit.body);
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
