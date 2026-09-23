import { createHash } from "node:crypto";
import type { EmailMessage, EmailProvider, ProviderResult, WhatsAppMessage, WhatsAppProvider } from "@/services/notifications/providers";

/**
 * Providers FAKE (prompt Fase 12 §76–§78): determinísticos, sem rede,
 * registram a entrega simulada. Cenários de falha são escolhidos pelo
 * DESTINATÁRIO (só em dev/teste — nunca há rede envolvida):
 *
 *   timeout@…      → PROVIDER_TIMEOUT (transitório) sempre
 *   fail500@…      → PROVIDER_UNAVAILABLE 500 (transitório) sempre
 *   ratelimit@…    → RATE_LIMITED 429 (transitório) sempre
 *   invalid@…      → INVALID_RECIPIENT 422 (permanente)
 *   flaky@…        → tentativa 1: timeout; tentativa 2: 500; tentativa 3+: aceito
 *   (WhatsApp)     → +5500…TIMEOUT? não: o fake de WhatsApp usa os sufixos
 *                    do número: …0000 timeout, …0500 500, …0422 inválido,
 *                    …0999 flaky.
 *
 * `providerMessageId` é derivado da idempotencyKey — reenviar a mesma
 * entrega devolve o mesmo id, como um fornecedor idempotente faria.
 */

function scenarioFor(marker: string, attempt: number): ProviderResult | null {
  switch (marker) {
    case "timeout":
      return { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true };
    case "fail500":
      return { accepted: false, errorCode: "PROVIDER_UNAVAILABLE", httpStatus: 500, retryable: true };
    case "ratelimit":
      return { accepted: false, errorCode: "RATE_LIMITED", httpStatus: 429, retryable: true };
    case "invalid":
      return { accepted: false, errorCode: "INVALID_RECIPIENT", httpStatus: 422, retryable: false };
    case "flaky":
      if (attempt <= 1) return { accepted: false, errorCode: "PROVIDER_TIMEOUT", retryable: true };
      if (attempt === 2) return { accepted: false, errorCode: "PROVIDER_UNAVAILABLE", httpStatus: 500, retryable: true };
      return null;
    default:
      return null;
  }
}

function fakeId(prefix: string, key: string): string {
  return `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

export type FakeSentRecord = { channel: "EMAIL" | "WHATSAPP"; to: string; idempotencyKey: string; subjectOrTemplate: string; attempt: number; /** Só em memória, para inspeção em testes — nunca persistido. */ body?: string; variables?: string[] };

export class FakeEmailProvider implements EmailProvider {
  readonly id = "fake";
  readonly simulated = true;
  readonly sent: FakeSentRecord[] = [];

  async send(message: EmailMessage): Promise<ProviderResult> {
    const local = message.to.split("@")[0]?.toLowerCase() ?? "";
    const scenario = scenarioFor(local, message.attempt);
    if (scenario) return scenario;
    this.sent.push({ channel: "EMAIL", to: message.to, idempotencyKey: message.idempotencyKey, subjectOrTemplate: message.subject, attempt: message.attempt, body: message.html });
    return { accepted: true, providerMessageId: fakeId("fake-email", message.idempotencyKey) };
  }
}

const WHATSAPP_SUFFIX_SCENARIO: Record<string, string> = { "0000": "timeout", "0500": "fail500", "0422": "invalid", "0999": "flaky", "0429": "ratelimit" };

export class FakeWhatsAppProvider implements WhatsAppProvider {
  readonly id = "fake";
  readonly simulated = true;
  readonly sent: FakeSentRecord[] = [];

  async send(message: WhatsAppMessage): Promise<ProviderResult> {
    const marker = WHATSAPP_SUFFIX_SCENARIO[message.to.slice(-4)];
    const scenario = marker ? scenarioFor(marker, message.attempt) : null;
    if (scenario) return scenario;
    this.sent.push({ channel: "WHATSAPP", to: message.to, idempotencyKey: message.idempotencyKey, subjectOrTemplate: message.templateKey, attempt: message.attempt, variables: message.variables });
    return { accepted: true, providerMessageId: fakeId("fake-wa", message.idempotencyKey) };
  }
}
