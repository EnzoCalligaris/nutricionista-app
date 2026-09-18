"use server";

import { requireNutritionist } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { invitePatientSchema } from "@/validators/auth";
import { authErrorMessage } from "@/lib/auth/errors";
import { patientInviteRateLimiter, getClientIp } from "@/lib/auth/rate-limit";

export type InvitePatientState = { error?: string; success?: string };

/**
 * Núcleo mínimo de onboarding de paciente (prompt Fase 3 §22-26) — convida
 * um paciente por e-mail via Supabase Auth. NÃO é a tela de gestão de
 * pacientes completa (isso é Fase 5); existe só para exercitar o fluxo de
 * autenticação ponta a ponta.
 *
 * Fluxo: nutricionista autenticado -> `requireNutritionist()` revalida role
 * no server (nunca confia em role vindo do client) -> convite via Auth
 * Admin API (server-only) -> o trigger `handle_new_auth_user`
 * (supabase/migrations/20260917120000_auth_profile_provisioning.sql) cria o
 * profile PATIENT automaticamente -> vincula/cria a linha de negócio em
 * `patients`.
 *
 * O nutricionista NUNCA define, vê ou envia a senha do paciente (prompt
 * Fase 3 §23) — `inviteUserByEmail` manda o e-mail oficial do Supabase Auth
 * (capturado localmente pelo Mailpit em dev, prompt Fase 3 §47) com um link
 * de ativação; o paciente escolhe a própria senha em /redefinir-senha.
 */
export async function invitePatientAction(
  _prevState: InvitePatientState,
  formData: FormData,
): Promise<InvitePatientState> {
  const nutritionist = await requireNutritionist();

  const parsed = invitePatientSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? authErrorMessage("VALIDATION_ERROR") };
  }

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName;

  const ip = await getClientIp();
  const rate = await patientInviteRateLimiter.consume(`${ip}:${nutritionist.id}`);
  if (!rate.success) {
    return { error: authErrorMessage("RATE_LIMITED") };
  }

  const supabase = await createClient();

  // Já existe, para ESTE nutricionista, um paciente com este e-mail e
  // acesso já ativado? Não duplica, não reenvia convite silenciosamente
  // (prompt Fase 3 §25).
  const { data: existingLinked } = await supabase
    .from("patients")
    .select("id")
    .eq("nutritionist_id", nutritionist.id)
    .eq("email", email)
    .not("profile_id", "is", null)
    .maybeSingle();

  if (existingLinked) {
    return { error: authErrorMessage("PATIENT_ALREADY_LINKED") };
  }

  const admin = createAdminClient();

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    // Convite é sempre iniciado pelo servidor (Admin API) — GoTrue devolve
    // o token no fragmento da URL, então o destino é /redefinir-senha
    // diretamente (ver src/components/auth/reset-password-gate.tsx).
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/redefinir-senha`,
  });

  // Cobre tanto erro explícito quanto (defensivamente) ausência de user —
  // inclui o caso de já existir uma conta Auth para este e-mail (ex.: outro
  // nutricionista, ou um profile não vinculado a nenhum paciente ainda) —
  // não tentamos adivinhar/reaproveitar essa conta automaticamente (prompt
  // Fase 3 §25/§26: nunca vincular silenciosamente uma conta existente).
  if (inviteError || !inviteData?.user) {
    return { error: authErrorMessage("INVITE_ALREADY_EXISTS") };
  }

  const createdAuthUserId = inviteData.user.id;

  // Vincula a um paciente já cadastrado manualmente (mesmo nutricionista,
  // mesmo e-mail, ainda sem profile_id) em vez de duplicar a linha; senão,
  // cria uma linha nova em `patients`.
  const { data: existingUnlinked } = await supabase
    .from("patients")
    .select("id")
    .eq("nutritionist_id", nutritionist.id)
    .eq("email", email)
    .is("profile_id", null)
    .maybeSingle();

  const { error: patientError } = existingUnlinked
    ? await supabase
        .from("patients")
        .update({ profile_id: createdAuthUserId, full_name: fullName })
        .eq("id", existingUnlinked.id)
    : await supabase
        .from("patients")
        .insert({ nutritionist_id: nutritionist.id, profile_id: createdAuthUserId, full_name: fullName, email });

  if (patientError) {
    // Compensação (prompt Fase 3 §26): o auth user foi criado só nesta
    // chamada — remove para não deixar um usuário órfão (auth existente,
    // sem paciente vinculado) por uma falha na segunda escrita. Onboarding
    // cruza Auth + Database e não há uma transação única cobrindo os dois.
    await admin.auth.admin.deleteUser(createdAuthUserId);
    return { error: authErrorMessage("UNKNOWN") };
  }

  return { success: `Convite enviado para ${email}.` };
}
