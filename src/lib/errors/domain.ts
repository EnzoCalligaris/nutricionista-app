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
  | "ASSESSMENT_NOT_FOUND"
  | "ASSESSMENT_NOT_AUTHORIZED"
  | "ASSESSMENT_ARCHIVED"
  | "ASSESSMENT_NOT_DELETABLE"
  | "ASSESSMENT_NOT_VISIBLE"
  | "INVALID_MEASUREMENT"
  | "INVALID_ASSESSMENT_DATE"
  | "REPORT_UPLOAD_FAILED"
  | "REPORT_INVALID_FILE"
  | "REPORT_NOT_FOUND"
  | "REPORT_PATH_INVALID"
  | "SUPPLEMENT_NOT_FOUND"
  | "SUPPLEMENT_NOT_AUTHORIZED"
  | "SUPPLEMENT_ARCHIVED"
  | "INVALID_EXTERNAL_URL"
  | "FEEDBACK_NOT_FOUND"
  | "FEEDBACK_NOT_AUTHORIZED"
  | "FEEDBACK_NOT_VISIBLE"
  | "FEEDBACK_ARCHIVED"
  | "FEEDBACK_NOT_DELETABLE"
  | "MATERIAL_NOT_FOUND"
  | "MATERIAL_NOT_AUTHORIZED"
  | "MATERIAL_NOT_ASSIGNED"
  | "MATERIAL_ARCHIVED"
  | "MATERIAL_INCOMPLETE"
  | "MATERIAL_NOT_DELETABLE"
  | "MATERIAL_PATH_INVALID"
  | "MATERIAL_ALREADY_ASSIGNED"
  | "MATERIAL_ASSIGNMENT_NOT_FOUND"
  | "INVALID_MATERIAL_FILE"
  | "MATERIAL_UPLOAD_FAILED"
  | "FOOD_ANALYSIS_NOT_FOUND"
  | "FOOD_ANALYSIS_NOT_AUTHORIZED"
  | "FOOD_ANALYSIS_ARCHIVED"
  | "FOOD_ANALYSIS_ORIGINAL_IMMUTABLE"
  | "MEAL_PHOTO_INVALID"
  | "MEAL_PHOTO_TOO_LARGE"
  | "MEAL_PHOTO_UPLOAD_FAILED"
  | "MEAL_AI_CONSENT_REQUIRED"
  | "CONSENT_NOT_AUTHORIZED"
  | "FOOD_ANALYSIS_PROVIDER_UNAVAILABLE"
  | "FOOD_ANALYSIS_INVALID_RESPONSE"
  | "FOOD_ANALYSIS_FAILED"
  | "FOOD_ANALYSIS_ALREADY_PROCESSING"
  | "FOOD_ANALYSIS_ALREADY_CONFIRMED"
  | "FOOD_ANALYSIS_NOT_REVIEWABLE"
  | "FOOD_ANALYSIS_RATE_LIMITED"
  | "INVALID_MEAL_TIME"
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_DELIVERY_NOT_FOUND"
  | "NOTIFICATION_DELIVERY_NOT_RETRYABLE"
  | "NOTIFICATION_RATE_LIMITED"
  | "PAYMENT_NOT_AUTHORIZED"
  | "PAYMENT_ALREADY_PAID"
  | "PAYMENT_CHARGE_EXPIRED"
  | "PAYMENT_CHARGE_NOT_PAYABLE"
  | "PAYMENT_METHOD_NOT_AVAILABLE"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "PAYMENT_WEBHOOK_INVALID"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_RECONCILIATION_REQUIRED"
  | "PAYMENT_RATE_LIMITED"
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
  ASSESSMENT_NOT_FOUND: "Avaliação não encontrada.",
  ASSESSMENT_NOT_AUTHORIZED: "Você não tem permissão para acessar esta avaliação.",
  ASSESSMENT_ARCHIVED: "Esta avaliação está arquivada e não pode ser alterada.",
  ASSESSMENT_NOT_DELETABLE: "Esta avaliação já foi exibida ao paciente e não pode ser excluída. Arquive-a.",
  ASSESSMENT_NOT_VISIBLE: "Esta avaliação ainda não está disponível.",
  INVALID_MEASUREMENT: "Valor de medida inválido: use números maiores que zero (percentuais até 100).",
  INVALID_ASSESSMENT_DATE: "A data da avaliação não pode estar no futuro.",
  REPORT_UPLOAD_FAILED: "Não foi possível enviar o relatório. Tente novamente.",
  REPORT_INVALID_FILE: "Envie um PDF ou imagem (JPG/PNG) de até 10 MB.",
  REPORT_NOT_FOUND: "Relatório não encontrado.",
  REPORT_PATH_INVALID: "Caminho de arquivo inválido.",
  SUPPLEMENT_NOT_FOUND: "Recomendação de suplemento não encontrada.",
  SUPPLEMENT_NOT_AUTHORIZED: "Você não tem permissão para alterar esta recomendação.",
  SUPPLEMENT_ARCHIVED: "Esta recomendação está arquivada e não pode ser alterada.",
  INVALID_EXTERNAL_URL: "Link inválido. Use um endereço completo começando com https://.",
  FEEDBACK_NOT_FOUND: "Feedback não encontrado.",
  FEEDBACK_NOT_AUTHORIZED: "Você não tem permissão para alterar este feedback.",
  FEEDBACK_NOT_VISIBLE: "Este feedback não está disponível.",
  FEEDBACK_ARCHIVED: "Este feedback está arquivado e não pode ser alterado.",
  FEEDBACK_NOT_DELETABLE: "Este feedback já foi disponibilizado ao paciente e não pode ser excluído. Arquive-o.",
  MATERIAL_NOT_FOUND: "Material não encontrado.",
  MATERIAL_NOT_AUTHORIZED: "Você não tem permissão para usar este material.",
  MATERIAL_NOT_ASSIGNED: "Este material não está disponível para você.",
  MATERIAL_ARCHIVED: "Este material está arquivado e não pode ser alterado nem atribuído.",
  MATERIAL_INCOMPLETE: "O arquivo deste material ainda não foi enviado. Envie o arquivo antes de atribuir.",
  MATERIAL_NOT_DELETABLE: "Este material já foi atribuído a pacientes e não pode ser excluído. Arquive-o.",
  MATERIAL_PATH_INVALID: "Caminho de arquivo inválido.",
  MATERIAL_ALREADY_ASSIGNED: "Este material já está disponível para o paciente.",
  MATERIAL_ASSIGNMENT_NOT_FOUND: "Atribuição não encontrada.",
  INVALID_MATERIAL_FILE: "Envie um PDF ou imagem (JPG/PNG) de até 10 MB.",
  MATERIAL_UPLOAD_FAILED: "Não foi possível enviar o arquivo. Tente novamente.",
  FOOD_ANALYSIS_NOT_FOUND: "Refeição não encontrada.",
  FOOD_ANALYSIS_NOT_AUTHORIZED: "Você não tem permissão para alterar esta refeição.",
  FOOD_ANALYSIS_ARCHIVED: "Esta refeição foi arquivada e não pode ser alterada.",
  FOOD_ANALYSIS_ORIGINAL_IMMUTABLE: "A estimativa original da IA não pode ser alterada.",
  MEAL_PHOTO_INVALID: "Envie uma foto em JPG, PNG ou WebP.",
  MEAL_PHOTO_TOO_LARGE: "A foto precisa ter até 12 MB.",
  MEAL_PHOTO_UPLOAD_FAILED: "Não foi possível enviar a foto. Tente novamente.",
  MEAL_AI_CONSENT_REQUIRED: "Para analisar fotos de refeição, é preciso aceitar o consentimento primeiro.",
  CONSENT_NOT_AUTHORIZED: "Não foi possível alterar o consentimento.",
  FOOD_ANALYSIS_PROVIDER_UNAVAILABLE: "A análise por IA não está disponível no momento.",
  FOOD_ANALYSIS_INVALID_RESPONSE: "Não foi possível analisar esta foto agora. Tente novamente.",
  FOOD_ANALYSIS_FAILED: "Não foi possível analisar esta foto agora. Tente novamente.",
  FOOD_ANALYSIS_ALREADY_PROCESSING: "Esta foto já está sendo analisada. Aguarde alguns instantes.",
  FOOD_ANALYSIS_ALREADY_CONFIRMED: "Esta refeição já foi confirmada.",
  FOOD_ANALYSIS_NOT_REVIEWABLE: "Esta refeição ainda não tem uma análise para revisar.",
  FOOD_ANALYSIS_RATE_LIMITED: "Muitas análises em pouco tempo. Aguarde alguns minutos e tente novamente.",
  NOTIFICATION_NOT_FOUND: "Notificação não encontrada.",
  NOTIFICATION_DELIVERY_NOT_FOUND: "Entrega não encontrada.",
  NOTIFICATION_DELIVERY_NOT_RETRYABLE: "Só entregas com falha podem ser reprocessadas.",
  NOTIFICATION_RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
  PAYMENT_NOT_AUTHORIZED: "Você não tem permissão para acessar esta cobrança.",
  PAYMENT_ALREADY_PAID: "Esta cobrança já foi paga.",
  PAYMENT_CHARGE_EXPIRED: "Esta cobrança expirou. Gere uma nova para pagar.",
  PAYMENT_CHARGE_NOT_PAYABLE: "Esta cobrança não pode mais ser paga.",
  PAYMENT_METHOD_NOT_AVAILABLE: "Este método de pagamento não está disponível no momento.",
  PAYMENT_PROVIDER_UNAVAILABLE: "O sistema de pagamento está indisponível no momento. Tente novamente em alguns minutos.",
  PAYMENT_PROVIDER_NOT_CONFIGURED: "O pagamento online ainda não está configurado.",
  PAYMENT_WEBHOOK_INVALID: "Notificação de pagamento inválida.",
  PAYMENT_AMOUNT_MISMATCH: "O valor informado pelo provedor não confere com a cobrança.",
  PAYMENT_RECONCILIATION_REQUIRED: "Esta cobrança precisa de conferência manual.",
  PAYMENT_RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
  INVALID_MEAL_TIME: "A data e a hora da refeição não podem estar no futuro.",
  VALIDATION_ERROR: "Verifique os dados informados.",
  UNKNOWN: "Não foi possível concluir a operação. Tente novamente.",
};

export function domainErrorMessage(code: DomainErrorCode): string {
  return MESSAGES[code];
}

/** True quando a string é um código de domínio conhecido (ex.: query string de retorno). */
export function isDomainErrorCode(value: string | null | undefined): value is DomainErrorCode {
  return typeof value === "string" && value in MESSAGES;
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
  if (error?.code === "23505" && message.includes("material_assignments_material_id_patient_id_key")) {
    return new DomainError("MATERIAL_ALREADY_ASSIGNED");
  }
  // 23514 = check_violation: URL fora de http(s) recusada pelo banco (defesa em profundidade da Fase 10).
  if (error?.code === "23514" && (message.includes("purchase_url_check") || message.includes("external_url_check"))) {
    return new DomainError("INVALID_EXTERNAL_URL");
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
