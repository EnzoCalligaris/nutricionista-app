import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors/domain";

/**
 * Convite de paciente para o portal — a ÚNICA implementação (prompt Fase 5
 * §14: "reutilizar exatamente a infraestrutura segura da Fase 3, não
 * duplicar lógica de Auth"). Extraída de `src/actions/onboarding.ts`
 * (Fase 3) para ser chamada tanto pela tela de convite quanto por
 * "Novo paciente + enviar convite" e por "Enviar convite" no perfil.
 *
 * Regras preservadas da Fase 3:
 *  - o nutricionista nunca define/vê senha: `inviteUserByEmail` (Admin API,
 *    server-only) manda o e-mail oficial com link para /redefinir-senha;
 *  - o trigger `handle_new_auth_user` cria o profile PATIENT;
 *  - se já existe linha em `patients` (mesmo nutricionista, mesmo e-mail,
 *    sem profile_id) ela é VINCULADA, nunca duplicada;
 *  - se já existe conta Auth para o e-mail (qualquer origem), não
 *    reaproveitamos silenciosamente: erro `INVITE_NOT_SENT`;
 *  - compensação: Auth user criado aqui e vínculo falhou => Auth user removido.
 *
 * Quem chama já validou `requireNutritionist()` e (quando aplicável) o
 * ownership do paciente.
 */
export async function invitePatientToPortal(input: {
  nutritionistId: string;
  email: string;
  fullName: string;
}): Promise<{ patientId: string; authUserId: string }> {
  const email = input.email.toLowerCase();
  const supabase = await createClient();

  const { data: existingLinked } = await supabase
    .from("patients")
    .select("id")
    .eq("nutritionist_id", input.nutritionistId)
    .eq("email", email)
    .not("profile_id", "is", null)
    .maybeSingle();

  if (existingLinked) {
    throw new DomainError("PATIENT_ALREADY_LINKED");
  }

  const admin = createAdminClient();

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: input.fullName },
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/redefinir-senha`,
  });

  if (inviteError || !inviteData?.user) {
    throw new DomainError("INVITE_NOT_SENT");
  }

  const createdAuthUserId = inviteData.user.id;

  const { data: existingUnlinked } = await supabase
    .from("patients")
    .select("id")
    .eq("nutritionist_id", input.nutritionistId)
    .eq("email", email)
    .is("profile_id", null)
    .maybeSingle();

  const result = existingUnlinked
    ? await supabase
        .from("patients")
        .update({ profile_id: createdAuthUserId, full_name: input.fullName })
        .eq("id", existingUnlinked.id)
        .select("id")
        .single()
    : await supabase
        .from("patients")
        .insert({
          nutritionist_id: input.nutritionistId,
          profile_id: createdAuthUserId,
          full_name: input.fullName,
          email,
        })
        .select("id")
        .single();

  if (result.error || !result.data) {
    await admin.auth.admin.deleteUser(createdAuthUserId);
    throw new DomainError("UNKNOWN");
  }

  return { patientId: result.data.id, authUserId: createdAuthUserId };
}

/**
 * Estado do usuário Auth vinculado a um paciente (para o status de acesso
 * ao portal, §24). Só chamar depois de confirmar ownership do paciente —
 * usa a Admin API, que ignora RLS.
 */
export async function getPortalAuthUser(profileId: string): Promise<{
  invitedAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  email: string | null;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error || !data?.user) return null;
  return {
    invitedAt: data.user.invited_at ?? null,
    lastSignInAt: data.user.last_sign_in_at ?? null,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    email: data.user.email ?? null,
  };
}
