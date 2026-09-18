/**
 * Erros de domínio da gestão de pacientes/contratos (prompt Fase 5 §48).
 * Serviços lançam `DomainError` com um código estável; a Server Action mapeia
 * para a mensagem amigável abaixo — o erro cru do banco/PostgREST nunca
 * chega ao usuário. As funções SQL da Fase 5 (`create_contract_with_
 * installments`, `cancel_contract`, `complete_contract`) lançam exatamente
 * estes códigos como mensagem, para que `domainErrorFromDatabase` os
 * reconheça sem parsing frágil.
 */
export type DomainErrorCode =
  | "PATIENT_NOT_FOUND"
  | "PATIENT_EMAIL_ALREADY_EXISTS"
  | "PATIENT_NOT_AUTHORIZED"
  | "PATIENT_ALREADY_LINKED"
  | "PATIENT_INVALID_STATUS"
  | "CONTRACT_NOT_FOUND"
  | "CONTRACT_NOT_AUTHORIZED"
  | "PLAN_NOT_AVAILABLE"
  | "INVALID_CONTRACT_PERIOD"
  | "INVALID_INSTALLMENTS"
  | "INVALID_STATUS_TRANSITION"
  | "INVITE_NOT_SENT"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

const MESSAGES: Record<DomainErrorCode, string> = {
  PATIENT_NOT_FOUND: "Paciente não encontrado.",
  PATIENT_EMAIL_ALREADY_EXISTS: "Já existe um paciente cadastrado com este e-mail.",
  PATIENT_NOT_AUTHORIZED: "Você não tem permissão para acessar este paciente.",
  PATIENT_ALREADY_LINKED: "Este paciente já tem acesso ao portal ativado.",
  PATIENT_INVALID_STATUS: "O paciente já está neste status.",
  CONTRACT_NOT_FOUND: "Contrato não encontrado.",
  CONTRACT_NOT_AUTHORIZED: "Você não tem permissão para acessar este contrato.",
  PLAN_NOT_AVAILABLE: "Este plano (ou condição de preço) não está disponível.",
  INVALID_CONTRACT_PERIOD: "Período do contrato inválido: a data de término não pode ser anterior ao início.",
  INVALID_INSTALLMENTS: "Parcelamento inválido: verifique quantidade, valores e vencimentos.",
  INVALID_STATUS_TRANSITION: "Esta ação não é permitida no status atual do contrato.",
  INVITE_NOT_SENT: "O paciente foi salvo, mas o convite não pôde ser enviado: já existe uma conta ou convite pendente para este e-mail.",
  VALIDATION_ERROR: "Verifique os dados informados.",
  UNKNOWN: "Não foi possível concluir a operação. Tente novamente.",
};

export function domainErrorMessage(code: DomainErrorCode): string {
  return MESSAGES[code];
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? domainErrorMessage(code));
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

const KNOWN_CODES = new Set<string>(Object.keys(MESSAGES));

/**
 * Traduz um erro vindo do Supabase/PostgREST. As funções SQL desta fase usam
 * `raise exception 'CODIGO'`; o PostgREST devolve isso em `message`. Também
 * reconhece a violação do índice único de e-mail por nutricionista.
 */
export function domainErrorFromDatabase(error: { message?: string; code?: string } | null | undefined): DomainError {
  const message = error?.message ?? "";
  if (KNOWN_CODES.has(message)) {
    return new DomainError(message as DomainErrorCode);
  }
  if (error?.code === "23505" && message.includes("patients_nutritionist_email_unique_idx")) {
    return new DomainError("PATIENT_EMAIL_ALREADY_EXISTS");
  }
  return new DomainError("UNKNOWN");
}
