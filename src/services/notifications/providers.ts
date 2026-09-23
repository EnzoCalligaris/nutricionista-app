import type { ProviderErrorCode } from "@/domain/notifications/retry";

/**
 * Abstrações de provider (prompt Fase 12 §15–§17/§23–§25/§66): o worker só
 * conhece estas interfaces. Resposta NORMALIZADA — nunca a resposta crua do
 * fornecedor (§66): `providerMessageId`, `accepted`, `errorCode` sanitizado,
 * `httpStatus`, `retryable`. Nada de payload completo, token ou segredo.
 *
 * Um adapter nunca lança para erro de envio: devolve `ProviderResult`. Só
 * lança `ProviderConfigError` (na fábrica) quando a configuração é
 * impossível — e isso é falha PERMANENTE (não retenta), visível no
 * dashboard como "Provedor não configurado".
 */

export type ProviderResult =
  | { accepted: true; providerMessageId: string | null; delivered?: boolean }
  | { accepted: false; errorCode: ProviderErrorCode; httpStatus?: number | null; retryable?: boolean; detail?: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** `Idempotency-Key` do fornecedor (Resend: 24 h, ≤ 256 chars) — mesma entrega, mesmo e-mail. */
  idempotencyKey: string;
  /** Tentativa atual (o fake usa para cenários determinísticos). */
  attempt: number;
  signal: AbortSignal;
};

export interface EmailProvider {
  readonly id: string;
  readonly simulated: boolean;
  send(message: EmailMessage): Promise<ProviderResult>;
}

export type WhatsAppMessage = {
  /** E.164 (+55…), já normalizado. */
  to: string;
  /** Chave interna do template (§25) — o adapter mapeia para o nome aprovado no BSP. */
  templateKey: string;
  /** Variáveis posicionais, na ordem do template. */
  variables: string[];
  idempotencyKey: string;
  attempt: number;
  signal: AbortSignal;
};

export interface WhatsAppProvider {
  readonly id: string;
  readonly simulated: boolean;
  send(message: WhatsAppMessage): Promise<ProviderResult>;
}

export class ProviderConfigError extends Error {
  constructor(
    readonly channel: "EMAIL" | "WHATSAPP",
    message: string,
  ) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

/** Timeout único por tentativa (transitório → retry com backoff). */
export const PROVIDER_TIMEOUT_MS = 15_000;
