/**
 * Status do acesso ao portal (prompt Fase 5 §24), derivado só de dados
 * confiáveis: `patients.profile_id` + o usuário do Supabase Auth (lido
 * server-side via Admin API depois de validar ownership). Nada é
 * inferido além disso.
 */
export type PortalAccessStatus = "ACTIVE" | "INVITE_PENDING" | "NOT_ACTIVATED" | "NO_ACCOUNT";

export type PortalAccessInput = {
  profileId: string | null;
  authUser: { invitedAt: string | null; lastSignInAt: string | null; emailConfirmedAt: string | null } | null;
};

export function derivePortalAccess(input: PortalAccessInput): PortalAccessStatus {
  if (!input.profileId) return "NO_ACCOUNT";
  const user = input.authUser;
  if (!user) return "NOT_ACTIVATED";
  if (user.lastSignInAt) return "ACTIVE";
  if (user.invitedAt && !user.emailConfirmedAt) return "INVITE_PENDING";
  return "NOT_ACTIVATED";
}

export const PORTAL_ACCESS_LABEL: Record<PortalAccessStatus, string> = {
  ACTIVE: "Ativo",
  INVITE_PENDING: "Convite pendente",
  NOT_ACTIVATED: "Não ativado",
  NO_ACCOUNT: "Sem conta",
};

export const PORTAL_ACCESS_DESCRIPTION: Record<PortalAccessStatus, string> = {
  ACTIVE: "O paciente já entrou no portal pelo menos uma vez.",
  INVITE_PENDING: "Convite enviado por e-mail; o paciente ainda não definiu a senha.",
  NOT_ACTIVATED: "Conta vinculada, mas o acesso ainda não foi concluído.",
  NO_ACCOUNT: "Cadastrado sem acesso ao portal. Você pode enviar um convite.",
};
