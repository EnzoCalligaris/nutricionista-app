// Bootstrap administrativo do NUTRITIONIST (prompt Fase 3 §21) — não existe
// cadastro público de nutricionista por design ("Nutricionista não possui
// cadastro público"). Este script é a via oficial documentada para criar o
// primeiro (e, por ora, único) usuário NUTRITIONIST em qualquer ambiente,
// incluindo produção — roda manualmente, uma única vez por pessoa, por
// quem tiver a service role key em mãos (nunca por uma rota HTTP pública).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SITE_URL=https://... \
//   node scripts/bootstrap-nutritionist.mjs --email enzo@example.com --full-name "Enzo Mangili"
//
// (Localmente, sem SUPABASE_URL/SITE_URL explícitos, usa os padrões do
// Supabase local e http://localhost:3000.)
//
// O script convida o e-mail pelo fluxo oficial do Supabase Auth — o MESMO
// usado para pacientes em src/actions/onboarding.ts — então nunca definimos
// ou vemos a senha aqui (prompt Fase 3 §23). O trigger
// `handle_new_auth_user` (supabase/migrations/20260917120000_auth_profile_provisioning.sql)
// cria o profile automaticamente com role PATIENT (default seguro); este
// script então promove esse profile a NUTRITIONIST usando a service role
// key, a única via legítima para essa mudança de role — o trigger
// `prevent_role_change` (Fase 2) bloqueia UPDATE de role vindo de qualquer
// outro papel.

import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = { email: null, fullName: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--email") args.email = argv[i + 1];
    else if (argv[i] === "--full-name") args.fullName = argv[i + 1];
  }
  return args;
}

async function main() {
  const { email, fullName } = parseArgs(process.argv.slice(2));

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55421";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!email || !fullName) {
    console.error(
      'Uso: node scripts/bootstrap-nutritionist.mjs --email <email> --full-name "<nome completo>"',
    );
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error("Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Convidando ${email} ...`);
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    // Convite via Admin API (servidor) -> GoTrue devolve o token no
    // fragmento da URL, não em ?code= -> destino direto /redefinir-senha
    // (ver src/components/auth/reset-password-gate.tsx).
    redirectTo: `${siteUrl}/redefinir-senha`,
  });

  if (inviteError || !inviteData?.user) {
    console.error("Falha ao convidar:", inviteError?.message ?? "usuário não retornado pela API");
    process.exit(1);
  }

  const userId = inviteData.user.id;

  console.log(`Promovendo profile ${userId} a NUTRITIONIST ...`);
  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: "NUTRITIONIST", full_name: fullName })
    .eq("id", userId);

  if (updateError) {
    console.error(
      "Falha ao promover role (o usuário de Auth já foi criado — revise manualmente no Studio antes de rodar de novo):",
      updateError.message,
    );
    process.exit(1);
  }

  console.log(`✅ ${email} convidado e promovido a NUTRITIONIST (id ${userId}).`);
  console.log(
    "O e-mail de ativação foi enviado pelo Supabase Auth — a pessoa define a própria senha em /redefinir-senha.",
  );
}

main().catch((error) => {
  console.error("Erro inesperado:", error);
  process.exit(1);
});
