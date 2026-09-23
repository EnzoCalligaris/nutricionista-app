/**
 * Política de retry/backoff e classificação de erros de provider (prompt
 * Fase 12 §12–§14/§62). Regras puras, testadas em isolamento.
 *
 * - Transitório (timeout, 429, 5xx, rede): tenta de novo com backoff
 *   exponencial até `MAX_ATTEMPTS`; depois FAILED definitivo (§14).
 * - Permanente (destinatário inválido, template inexistente, 4xx de
 *   validação, config errada): FAILED na hora — nunca repete (§13).
 * - O nutricionista pode reprocessar um FAILED manualmente (§86), o que
 *   reinicia a contagem.
 */

export const MAX_ATTEMPTS = 5;

/** Espera antes da tentativa N+1, indexada pelo número da tentativa que falhou (1 → 1 min … 4 → 2 h). */
export const BACKOFF_MINUTES: readonly number[] = [1, 5, 30, 120];

export type ProviderErrorCode =
  | "PROVIDER_TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "INVALID_RECIPIENT"
  | "TEMPLATE_NOT_FOUND"
  | "INVALID_REQUEST"
  | "PROVIDER_NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "RENDER_ERROR"
  | "UNKNOWN";

export type ProviderFailure = { code: ProviderErrorCode; httpStatus?: number | null; retryable?: boolean };

const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set(["PROVIDER_TIMEOUT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "NETWORK_ERROR", "UNKNOWN"]);

/** Retentável = transitório. Um `retryable` explícito do adapter vence a heurística por código. */
export function isRetryable(failure: ProviderFailure): boolean {
  if (typeof failure.retryable === "boolean") return failure.retryable;
  if (RETRYABLE.has(failure.code)) return true;
  const status = failure.httpStatus ?? null;
  return status !== null && (status === 408 || status === 429 || status >= 500);
}

/** Classifica um status HTTP genérico quando o adapter não conhece o erro (429/5xx → transitório; 4xx → permanente). */
export function classifyHttpStatus(status: number): ProviderErrorCode {
  if (status === 429) return "RATE_LIMITED";
  if (status === 408 || status === 504) return "PROVIDER_TIMEOUT";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return "TEMPLATE_NOT_FOUND";
  if (status === 422 || status === 400) return "INVALID_REQUEST";
  return "UNKNOWN";
}

export function backoffMs(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount, 1), BACKOFF_MINUTES.length) - 1;
  return BACKOFF_MINUTES[index]! * 60 * 1000;
}

export type FailureOutcome =
  | { status: "PENDING"; nextAttemptAt: Date }
  | { status: "FAILED"; reason: "PERMANENT" | "MAX_ATTEMPTS" };

/**
 * Próximo estado após uma falha na tentativa `attemptCount` (já contada pelo
 * claim). Retentável e abaixo do limite → PENDING com `next_attempt_at`;
 * senão FAILED.
 */
export function decideAfterFailure(input: { failure: ProviderFailure; attemptCount: number; now: Date; maxAttempts?: number }): FailureOutcome {
  const max = input.maxAttempts ?? MAX_ATTEMPTS;
  if (!isRetryable(input.failure)) return { status: "FAILED", reason: "PERMANENT" };
  if (input.attemptCount >= max) return { status: "FAILED", reason: "MAX_ATTEMPTS" };
  return { status: "PENDING", nextAttemptAt: new Date(input.now.getTime() + backoffMs(input.attemptCount)) };
}

export type DeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED" | "SKIPPED";

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  SKIPPED: "Ignorada",
};

/** Só FAILED pode ser reprocessado manualmente — nunca uma SENT/DELIVERED (duplicaria) nem PENDING/PROCESSING (o worker já cuida). */
export function canRetryManually(status: DeliveryStatus): boolean {
  return status === "FAILED";
}

export const SKIP_REASON_LABEL: Record<string, string> = {
  MISSING_EMAIL: "Paciente sem e-mail cadastrado",
  MISSING_PHONE: "Paciente sem telefone cadastrado",
  CHANNEL_DISABLED_BY_DEFAULT: "Canal desligado para este evento",
  CHANNEL_DISABLED_BY_NUTRITIONIST: "Canal desligado nas configurações",
  CHANNEL_DISABLED_BY_PATIENT: "Canal desligado pelo paciente",
  RECIPIENT_NOT_FOUND: "Paciente sem acesso ao portal",
};

export const ERROR_CODE_LABEL: Record<ProviderErrorCode, string> = {
  PROVIDER_TIMEOUT: "Tempo esgotado no provedor",
  RATE_LIMITED: "Limite do provedor atingido",
  PROVIDER_UNAVAILABLE: "Provedor indisponível",
  NETWORK_ERROR: "Falha de rede",
  INVALID_RECIPIENT: "Destinatário inválido",
  TEMPLATE_NOT_FOUND: "Template não encontrado no provedor",
  INVALID_REQUEST: "Requisição recusada pelo provedor",
  PROVIDER_NOT_CONFIGURED: "Provedor não configurado",
  UNAUTHORIZED: "Credencial recusada pelo provedor",
  RENDER_ERROR: "Falha ao montar a mensagem",
  UNKNOWN: "Erro desconhecido",
};
