import { Resend } from "resend";
import { classifyHttpStatus, type ProviderErrorCode } from "@/domain/notifications/retry";
import type { EmailMessage, EmailProvider, ProviderResult } from "@/services/notifications/providers";

/**
 * Adapter Resend (prompt Fase 12 §16) — escrito a partir da documentação
 * oficial vigente (resend.com/docs/api-reference/emails/send-email e
 * SDK `resend` 6.x): `POST /emails` com `from`, `to`, `subject`, `html`,
 * `text`, `replyTo`, `tags`; header opcional `Idempotency-Key` (válido por
 * 24 h, ≤ 256 chars) enviado via `{ idempotencyKey }`; sucesso `{ id }`;
 * erros como `{ message, statusCode, name }` (422 validação, 429 rate limit,
 * 5xx). Nada aqui foi inventado — e nada é enviado sem `RESEND_API_KEY` +
 * `EMAIL_FROM` (a fábrica recusa a configuração incompleta).
 *
 * Só o código de erro sanitizado e o status HTTP saem daqui; a mensagem do
 * fornecedor nunca vai ao banco nem ao log (§90–§91).
 */

const PERMANENT_ERROR_NAMES = new Set([
  "validation_error",
  "missing_api_key",
  "restricted_api_key",
  "invalid_api_key",
  "invalid_from_address",
  "invalid_access",
  "invalid_parameter",
  "invalid_region",
  "missing_required_field",
  "invalid_attachment",
  "not_found",
  "method_not_allowed",
  "invalid_idempotency_key",
  "invalid_idempotent_request",
  "security_error",
]);

function mapResendError(name: string, statusCode: number | null): { code: ProviderErrorCode; retryable: boolean } {
  switch (name) {
    case "rate_limit_exceeded":
    case "concurrent_idempotent_requests":
      return { code: "RATE_LIMITED", retryable: true };
    case "daily_quota_exceeded":
    case "monthly_quota_exceeded":
      return { code: "RATE_LIMITED", retryable: false };
    case "invalid_api_key":
    case "missing_api_key":
    case "restricted_api_key":
    case "invalid_access":
      return { code: "UNAUTHORIZED", retryable: false };
    case "invalid_from_address":
      return { code: "PROVIDER_NOT_CONFIGURED", retryable: false };
    case "validation_error":
    case "invalid_parameter":
    case "missing_required_field":
      return { code: "INVALID_REQUEST", retryable: false };
    case "internal_server_error":
    case "application_error":
      return { code: "PROVIDER_UNAVAILABLE", retryable: true };
    default: {
      if (PERMANENT_ERROR_NAMES.has(name)) return { code: "INVALID_REQUEST", retryable: false };
      const code = statusCode ? classifyHttpStatus(statusCode) : "UNKNOWN";
      return { code, retryable: statusCode ? statusCode === 429 || statusCode >= 500 : true };
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend";
  readonly simulated = false;
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly replyTo: string | undefined,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<ProviderResult> {
    try {
      const { data, error } = await this.client.emails.send(
        {
          from: this.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: this.replyTo,
          tags: [{ name: "app", value: "metodo-em" }],
        },
        { idempotencyKey: message.idempotencyKey.slice(0, 256) },
      );
      if (error) {
        const mapped = mapResendError(error.name, error.statusCode);
        return { accepted: false, errorCode: mapped.code, httpStatus: error.statusCode, retryable: mapped.retryable };
      }
      return { accepted: true, providerMessageId: data?.id ?? null };
    } catch (cause) {
      if (message.signal.aborted) return { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true };
      const name = cause instanceof Error ? cause.name : "";
      if (name === "AbortError" || name === "TimeoutError") return { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true };
      return { accepted: false, errorCode: "NETWORK_ERROR", retryable: true };
    }
  }
}
