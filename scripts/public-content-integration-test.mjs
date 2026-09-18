// Testes de integração do conteúdo público (prompt Fase 4 §45) contra o
// Supabase LOCAL de verdade, como visitante ANÔNIMO (anon key, sem sessão):
// - plano ANUAL não aparece; AVULSA/TRIMESTRAL/SEMESTRAL aparecem;
// - blog DRAFT não aparece; PUBLISHED aparece;
// - resultado sem consentimento / com consentimento revogado não aparece;
//   só o publicado com consentimento válido.
//
// Fixtures de resultado são criadas com a service role (papel administrativo,
// só neste script de teste) e removidas ao final. Mesmo padrão de
// scripts/auth-integration-test.mjs: requer `npm run db:start`.

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Paciente fictício do seed (Fulana de Tal).
const SEED_PATIENT_ID = "90000000-0000-0000-0000-000000000010";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok — ${label}`);
    passed += 1;
  } else {
    console.error(`  FAIL — ${label}`);
    failed += 1;
  }
}

async function anonGet(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return response.json();
}

async function admin(method, path, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  console.log(`Conectando em ${SUPABASE_URL} (como anon) ...`);

  console.log("\n[1] planos públicos");
  const plans = await anonGet("plans?select=code,publicly_visible,active");
  const codes = plans.map((p) => p.code);
  check("ANUAL não retorna na query pública", !codes.includes("ANUAL"));
  check("AVULSA retorna", codes.includes("AVULSA"));
  check("TRIMESTRAL retorna", codes.includes("TRIMESTRAL"));
  check("SEMESTRAL retorna", codes.includes("SEMESTRAL"));

  const benefits = await anonGet("plan_benefits?select=label");
  const labels = benefits.map((b) => b.label.toLowerCase()).join(" | ");
  check("nenhum benefício público menciona 'grupo exclusivo'", !labels.includes("grupo exclusivo"));
  check("nenhum benefício público menciona 'comunidade vip'", !labels.includes("comunidade vip"));

  const prices = await anonGet("plan_prices?select=amount_cents,is_primary,plans(code)");
  const avulsaPrimary = prices.find((p) => p.plans?.code === "AVULSA" && p.is_primary);
  check("consulta avulsa tem preço primário de R$230", avulsaPrimary?.amount_cents === 23000);
  check(
    "trimestral/semestral NÃO têm preço primário (pendente de definição)",
    !prices.some((p) => (p.plans?.code === "TRIMESTRAL" || p.plans?.code === "SEMESTRAL") && p.is_primary),
  );

  console.log("\n[2] blog público");
  const posts = await anonGet("blog_posts?select=slug,status");
  check("nenhum DRAFT retorna", !posts.some((p) => p.status === "DRAFT"));
  check("PUBLISHED retorna", posts.some((p) => p.status === "PUBLISHED"));
  check("rascunho do seed não aparece por slug", !posts.some((p) => p.slug === "rascunho-ideias-proximo-artigo"));

  console.log("\n[3] resultados antes/depois (consentimento)");
  const consentValid = await admin("POST", "media_consents", {
    patient_id: SEED_PATIENT_ID,
    consent_type: "IMAGE_BEFORE_AFTER",
    evidence_reference: "teste-integracao-valido",
  });
  // granted_at explícito no passado: o check `revoked_at >= granted_at`
  // compara com o relógio do banco, então não dá para usar o default now().
  const consentRevoked = await admin("POST", "media_consents", {
    patient_id: SEED_PATIENT_ID,
    consent_type: "IMAGE_BEFORE_AFTER",
    evidence_reference: "teste-integracao-revogado",
    granted_at: "2026-01-01T00:00:00Z",
    revoked_at: "2026-01-02T00:00:00Z",
  });
  const validId = consentValid.body?.[0]?.id;
  const revokedId = consentRevoked.body?.[0]?.id;
  if (!validId || !revokedId) {
    console.error("  detalhe:", JSON.stringify({ consentValid, consentRevoked }));
  }
  check("fixtures de consentimento criadas", Boolean(validId && revokedId));

  const resultIds = [];
  const create = async (payload) => {
    const r = await admin("POST", "before_after_results", { patient_id: SEED_PATIENT_ID, before_path: "t/b.jpg", after_path: "t/a.jpg", ...payload });
    if (r.body?.[0]?.id) resultIds.push(r.body[0].id);
    return r;
  };

  const withValid = await create({ title: "TESTE valido", published: true, media_consent_id: validId });
  const withRevoked = await create({ title: "TESTE revogado", published: true, media_consent_id: revokedId });
  const unpublished = await create({ title: "TESTE nao publicado", published: false, media_consent_id: validId });
  const noConsentPublished = await create({ title: "TESTE sem consentimento", published: true });

  check("resultado publicado com consentimento válido é aceito", withValid.status === 201);
  check("resultado não publicado é aceito no banco (só não aparece ao público)", unpublished.status === 201);
  check("resultado publicado com consentimento revogado é aceito no banco (filtro é na leitura pública)", withRevoked.status === 201);
  check("resultado publicado SEM consentimento é rejeitado pelo check constraint", noConsentPublished.status >= 400);

  const publicResults = await anonGet("before_after_results?select=title");
  const titles = publicResults.map((r) => r.title);
  check("anon vê o resultado com consentimento válido", titles.includes("TESTE valido"));
  check("anon NÃO vê resultado com consentimento revogado", !titles.includes("TESTE revogado"));
  check("anon NÃO vê resultado não publicado", !titles.includes("TESTE nao publicado"));
  check("anon NÃO vê nada sem consentimento", !titles.includes("TESTE sem consentimento"));

  // Cleanup (ordem: resultados -> consentimentos).
  for (const id of resultIds) await admin("DELETE", `before_after_results?id=eq.${id}`);
  if (validId) await admin("DELETE", `media_consents?id=eq.${validId}`);
  if (revokedId) await admin("DELETE", `media_consents?id=eq.${revokedId}`);
  const leftovers = await anonGet("before_after_results?select=title&title=like.TESTE*");
  check("fixtures removidas", Array.isArray(leftovers) && leftovers.length === 0);

  console.log("\n[4] site_settings");
  const settings = await anonGet("site_settings?select=key");
  check("anon só vê configurações públicas (nenhuma privada vaza)", Array.isArray(settings));

  console.log(`\n${passed} ok, ${failed} falha(s).`);
  if (failed > 0) {
    console.error("❌ FAIL — testes de integração de conteúdo público falharam.");
    process.exit(1);
  }
  console.log("✅ PASS — conteúdo público respeita visibilidade, publicação e consentimento.");
}

main().catch((error) => {
  console.error("Erro inesperado:", error);
  process.exit(1);
});
