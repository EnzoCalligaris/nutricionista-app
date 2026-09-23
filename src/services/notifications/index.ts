import "server-only";

import { getServerEnv } from "@/lib/env";
import { FakeEmailProvider, FakeWhatsAppProvider } from "@/services/notifications/fake-providers";
import { ProviderConfigError, type EmailProvider, type WhatsAppProvider } from "@/services/notifications/providers";
import { ResendEmailProvider } from "@/services/notifications/resend-email-provider";

export type { EmailProvider, WhatsAppProvider, ProviderResult } from "@/services/notifications/providers";
export { ProviderConfigError } from "@/services/notifications/providers";

let fakeEmail: FakeEmailProvider | undefined;
let fakeWhatsApp: FakeWhatsAppProvider | undefined;

/**
 * Fábrica do EmailProvider por `EMAIL_PROVIDER` (prompt Fase 12 §16–§17):
 * `fake` (default) ou `resend`. `resend` sem `RESEND_API_KEY`/`EMAIL_FROM`
 * é ERRO DE CONFIGURAÇÃO — nunca cai no fake em silêncio. Qualquer outro
 * identificador também é erro (sem adapter).
 */
export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  switch (env.EMAIL_PROVIDER) {
    case "fake":
      return (fakeEmail ??= new FakeEmailProvider());
    case "resend": {
      if (!env.RESEND_API_KEY) throw new ProviderConfigError("EMAIL", "EMAIL_PROVIDER=resend exige RESEND_API_KEY");
      if (!env.EMAIL_FROM) throw new ProviderConfigError("EMAIL", "EMAIL_PROVIDER=resend exige EMAIL_FROM");
      return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM, env.EMAIL_REPLY_TO);
    }
    default:
      throw new ProviderConfigError("EMAIL", `EMAIL_PROVIDER="${env.EMAIL_PROVIDER}" não tem adapter`);
  }
}

/**
 * Fábrica do WhatsAppProvider por `WHATSAPP_PROVIDER` (§23–§25): só `fake`
 * existe — o BSP oficial é PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md). Um
 * adapter real entra aqui quando o provedor for definido e a documentação
 * oficial consultada; até lá, qualquer outro valor é erro de configuração.
 * Nunca automação de WhatsApp Web.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  const env = getServerEnv();
  switch (env.WHATSAPP_PROVIDER) {
    case "fake":
      return (fakeWhatsApp ??= new FakeWhatsAppProvider());
    default:
      throw new ProviderConfigError("WHATSAPP", `WHATSAPP_PROVIDER="${env.WHATSAPP_PROVIDER}" não tem adapter (BSP pendente de definição)`);
  }
}

export type ProviderConfigStatus = {
  channel: "EMAIL" | "WHATSAPP";
  provider: string;
  configured: boolean;
  simulated: boolean;
  /** Motivo técnico curto quando não configurado — nunca o valor de uma chave. */
  problem: string | null;
  from?: string | null;
};

/** Estado da configuração para a UI (§75: "Configurado / Não configurado" — nunca valores de chave). */
export function getProviderConfigStatus(): ProviderConfigStatus[] {
  const env = getServerEnv();
  const statuses: ProviderConfigStatus[] = [];
  try {
    const email = getEmailProvider();
    statuses.push({ channel: "EMAIL", provider: email.id, configured: true, simulated: email.simulated, problem: null, from: email.simulated ? null : (env.EMAIL_FROM ?? null) });
  } catch (error) {
    statuses.push({ channel: "EMAIL", provider: env.EMAIL_PROVIDER, configured: false, simulated: false, problem: error instanceof Error ? error.message : "Configuração inválida" });
  }
  try {
    const wa = getWhatsAppProvider();
    statuses.push({ channel: "WHATSAPP", provider: wa.id, configured: true, simulated: wa.simulated, problem: null });
  } catch (error) {
    statuses.push({ channel: "WHATSAPP", provider: env.WHATSAPP_PROVIDER, configured: false, simulated: false, problem: error instanceof Error ? error.message : "Configuração inválida" });
  }
  return statuses;
}

/** Mapa `chave interna → nome aprovado no BSP` (§25). Sem mapa, a chave interna é usada como nome — documentado como pendência. */
export function getWhatsAppTemplateMap(): Record<string, string> {
  const raw = getServerEnv().WHATSAPP_TEMPLATE_MAP;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}
