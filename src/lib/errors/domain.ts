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
  | "APPOINTMENT_NOT_FOUND"
  | "APPOINTMENT_NOT_AUTHORIZED"
  | "APPOINTMENT_SLOT_UNAVAILABLE"
  | "APPOINTMENT_IN_PAST"
  | "INVALID_APPOINTMENT_STATUS_TRANSITION"
  | "INVALID_AVAILABILITY"
  | "BLOCKED_TIME_CONFLICT"
  | "BLOCKED_TIME_NOT_FOUND"
  | "PATIENT_NOT_ELIGIBLE"
  | "INVALID_AMOUNT"
  | "FINANCIAL_TRANSACTION_NOT_FOUND"
  | "FINANCIAL_TRANSACTION_NOT_EDITABLE"
  | "FINANCIAL_TRANSACTION_NOT_AUTHORIZED"
  | "PAYMENT_NOT_FOUND"
  | "INSTALLMENT_NOT_FOUND"
  | "INSTALLMENT_NOT_PAYABLE"
  | "PAYMENT_EXCEEDS_INSTALLMENT"
  | "CATEGORY_NOT_FOUND"
  | "MEAL_PLAN_NOT_FOUND"
  | "MEAL_PLAN_NOT_EDITABLE"
  | "MEAL_PLAN_ARCHIVED"
  | "MEAL_PLAN_ACTIVE_EXISTS"
  | "MEAL_PLAN_VERSION_NOT_FOUND"
  | "MEAL_PLAN_VERSION_NOT_EDITABLE"
  | "MEAL_PLAN_ALREADY_PUBLISHED"
  | "MEAL_PLAN_DRAFT_EXISTS"
  | "INVALID_MEAL_PLAN_STRUCTURE"
  | "MEAL_PLAN_DAY_NOT_FOUND"
  | "MEAL_PLAN_DAY_EXISTS"
  | "MEAL_PLAN_DAY_NOT_EMPTY"
  | "MEAL_NOT_FOUND"
  | "MEAL_ITEM_NOT_FOUND"
  | "MEAL_SUBSTITUTION_NOT_FOUND"
  | "PUBLISH_CONFLICT"
  | "CONCURRENT_UPDATE"
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
  APPOINTMENT_NOT_FOUND: "Consulta não encontrada.",
  APPOINTMENT_NOT_AUTHORIZED: "Você não tem permissão para alterar esta consulta.",
  APPOINTMENT_SLOT_UNAVAILABLE: "Esse horário acabou de ser reservado. Escolha outro horário.",
  APPOINTMENT_IN_PAST: "Escolha um horário futuro (respeitando a antecedência mínima configurada).",
  INVALID_APPOINTMENT_STATUS_TRANSITION: "Esta ação não é permitida no status atual da consulta.",
  INVALID_AVAILABILITY: "Esse horário está fora da disponibilidade da agenda.",
  BLOCKED_TIME_CONFLICT: "O período conflita com um bloqueio ou com uma consulta ativa.",
  BLOCKED_TIME_NOT_FOUND: "Bloqueio não encontrado.",
  PATIENT_NOT_ELIGIBLE: "O agendamento online não está disponível para este paciente no momento.",
  INVALID_AMOUNT: "Informe um valor maior que zero (ex.: 230,00).",
  FINANCIAL_TRANSACTION_NOT_FOUND: "Lançamento não encontrado.",
  FINANCIAL_TRANSACTION_NOT_EDITABLE: "Lançamento gerado por pagamento ou consulta não pode ter valor, tipo ou data alterados.",
  FINANCIAL_TRANSACTION_NOT_AUTHORIZED: "Você não tem permissão para alterar este lançamento.",
  PAYMENT_NOT_FOUND: "Pagamento não encontrado.",
  INSTALLMENT_NOT_FOUND: "Parcela não encontrada.",
  INSTALLMENT_NOT_PAYABLE: "Esta parcela já está quitada ou cancelada.",
  PAYMENT_EXCEEDS_INSTALLMENT: "O valor excede o restante da parcela. Registre o excedente como pagamento avulso.",
  CATEGORY_NOT_FOUND: "Categoria inválida.",
  MEAL_PLAN_NOT_FOUND: "Plano alimentar não encontrado.",
  MEAL_PLAN_NOT_EDITABLE: "Este plano alimentar não pode ser alterado.",
  MEAL_PLAN_ARCHIVED: "Este plano alimentar está arquivado. Crie um novo plano para continuar.",
  MEAL_PLAN_ACTIVE_EXISTS: "O paciente já tem um plano alimentar ativo. Arquive o plano atual antes de criar outro.",
  MEAL_PLAN_VERSION_NOT_FOUND: "Versão do plano alimentar não encontrada.",
  MEAL_PLAN_VERSION_NOT_EDITABLE: "Esta versão já foi publicada ou arquivada e não pode ser alterada. Crie uma nova versão.",
  MEAL_PLAN_ALREADY_PUBLISHED: "Esta versão já está publicada.",
  MEAL_PLAN_DRAFT_EXISTS: "Já existe um rascunho em andamento para este plano. Publique ou descarte antes de criar outro.",
  INVALID_MEAL_PLAN_STRUCTURE: "Para publicar, o plano precisa de pelo menos um dia com uma refeição e um alimento.",
  MEAL_PLAN_DAY_NOT_FOUND: "Dia não encontrado nesta versão.",
  MEAL_PLAN_DAY_EXISTS: "Este dia da semana já existe nesta versão.",
  MEAL_PLAN_DAY_NOT_EMPTY: "O dia de destino já tem refeições. Confirme a substituição para continuar.",
  MEAL_NOT_FOUND: "Refeição não encontrada.",
  MEAL_ITEM_NOT_FOUND: "Alimento não encontrado.",
  MEAL_SUBSTITUTION_NOT_FOUND: "Substituição não encontrada.",
  PUBLISH_CONFLICT: "Outra versão foi publicada ao mesmo tempo. Recarregue a página e tente de novo.",
  CONCURRENT_UPDATE: "Este registro foi alterado em outra sessão. Recarregue a página para ver a versão atual.",
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
  if (error?.code === "23505" && message.includes("meal_plan_days_version_id_weekday_key")) {
    return new DomainError("MEAL_PLAN_DAY_EXISTS");
  }
  if (error?.code === "23505" && message.includes("meal_plan_versions_one_published_per_plan")) {
    return new DomainError("PUBLISH_CONFLICT");
  }
  if (error?.code === "23505" && message.includes("meal_plans_one_active_per_patient")) {
    return new DomainError("MEAL_PLAN_ACTIVE_EXISTS");
  }
  // 23P01 = exclusion_violation: a constraint anti-double-booking da Fase 2
  // (`appointments_no_overlap`) recusou o horário — nunca mostrar o SQL.
  if (error?.code === "23P01" || message.includes("appointments_no_overlap")) {
    return new DomainError("APPOINTMENT_SLOT_UNAVAILABLE");
  }
  // 40P01 = deadlock_detected: com duas inserções realmente simultâneas na
  // exclusion constraint, o Postgres pode abortar uma delas por deadlock
  // em vez de 23P01 (cada uma espera a outra ao checar a sobreposição).
  // O invariante (nunca duas consultas no horário) está garantido; para
  // quem perdeu a corrida a resposta é a mesma: o horário acabou de ser
  // reservado.
  if (error?.code === "40P01") {
    return new DomainError("APPOINTMENT_SLOT_UNAVAILABLE");
  }
  return new DomainError("UNKNOWN");
}
