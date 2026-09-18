/**
 * Erros de domínio de autenticação/autorização (prompt Fase 3 §36). Toda
 * action/rota que fala com Supabase Auth deve mapear o erro para um destes
 * códigos antes de expor qualquer coisa à UI — nunca repassar
 * `error.message` cru do Supabase (pode variar por versão, vazar detalhes
 * internos, ou revelar existência de conta).
 */
export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "INVITE_ALREADY_EXISTS"
  | "PATIENT_ALREADY_LINKED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

const MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_REQUIRED: "Você precisa entrar para continuar.",
  // Mensagem deliberadamente genérica — nunca diferenciar "usuário não
  // existe" de "senha errada" (prompt Fase 3 §10, prevenção de enumeração).
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  FORBIDDEN: "Você não tem permissão para acessar este recurso.",
  SESSION_EXPIRED: "Sua sessão expirou. Entre novamente.",
  INVITE_ALREADY_EXISTS: "Já existe uma conta ou convite pendente para este e-mail.",
  PATIENT_ALREADY_LINKED: "Este paciente já tem acesso ativado.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  VALIDATION_ERROR: "Verifique os dados informados.",
  UNKNOWN: "Não foi possível concluir a operação. Tente novamente.",
};

export function authErrorMessage(code: AuthErrorCode): string {
  return MESSAGES[code];
}

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? authErrorMessage(code));
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Traduz um erro cru do Supabase Auth (signIn/signUp/resetPassword/invite)
 * para um AuthError de domínio, sem nunca repassar `error.message` original
 * para quem chama. Baseado em substring porque o SDK do Supabase não expõe
 * um código de erro estável e tipado para todos os casos.
 */
export function mapSupabaseAuthError(error: unknown): AuthError {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return new AuthError("INVALID_CREDENTIALS");
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user_already_exists") ||
    normalized.includes("email_exists")
  ) {
    return new AuthError("INVITE_ALREADY_EXISTS");
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return new AuthError("RATE_LIMITED");
  }
  if (normalized.includes("session") && normalized.includes("expired")) {
    return new AuthError("SESSION_EXPIRED");
  }

  return new AuthError("UNKNOWN");
}
