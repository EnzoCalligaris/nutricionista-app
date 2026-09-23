import "server-only";

import { availableCheckoutMethods, type OnlinePaymentMethod } from "@/domain/payments/charges";
import { getServerEnv } from "@/lib/env";
import { FakePaymentProvider } from "@/services/payments/fake-provider";
import { PaymentProviderConfigError, type PaymentProvider } from "@/services/payments/provider";

export type { PaymentProvider } from "@/services/payments/provider";
export { PaymentProviderConfigError } from "@/services/payments/provider";

let fakeProvider: FakePaymentProvider | undefined;

/** Segredo do webhook: obrigatório em produção; em dev o fake usa um valor fixo e claramente não secreto. */
function webhookSecret(): string {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER_WEBHOOK_SECRET) return env.PAYMENT_PROVIDER_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new PaymentProviderConfigError("PAYMENT_PROVIDER_WEBHOOK_SECRET é obrigatório em produção.");
  }
  return "dev-only-payment-webhook-secret";
}

/**
 * Fábrica do gateway por `PAYMENT_PROVIDER` (prompt Fase 13 §2/§5):
 * `fake` (default) ou um adapter real — que ainda **não existe**, porque o
 * fornecedor é PENDENTE DE DEFINIÇÃO. Um identificador sem adapter é erro
 * de configuração; nunca há fallback silencioso para o fake.
 */
export function getPaymentProvider(): PaymentProvider {
  const env = getServerEnv();
  switch (env.PAYMENT_PROVIDER) {
    case "fake": {
      if (env.PAYMENT_PROVIDER_ENVIRONMENT === "production") {
        throw new PaymentProviderConfigError("PAYMENT_PROVIDER=fake não pode rodar com PAYMENT_PROVIDER_ENVIRONMENT=production.");
      }
      return (fakeProvider ??= new FakePaymentProvider(webhookSecret()));
    }
    default:
      throw new PaymentProviderConfigError(
        `PAYMENT_PROVIDER="${env.PAYMENT_PROVIDER}" não tem adapter. O gateway real é PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md, Fase 13).`,
      );
  }
}

export type PaymentProviderStatus = {
  provider: string;
  environment: string;
  configured: boolean;
  simulated: boolean;
  methods: OnlinePaymentMethod[];
  webhookConfigured: boolean;
  /** Motivo técnico curto quando não configurado — nunca o valor de uma chave. */
  problem: string | null;
};

/** Estado do gateway para a tela de configurações (§77): nunca expõe segredo. */
export function getPaymentProviderStatus(): PaymentProviderStatus {
  const env = getServerEnv();
  const webhookConfigured = Boolean(env.PAYMENT_PROVIDER_WEBHOOK_SECRET);
  try {
    const provider = getPaymentProvider();
    return {
      provider: provider.id,
      environment: provider.environment,
      configured: true,
      simulated: provider.simulated,
      methods: availableCheckoutMethods(provider.availableMethods()),
      webhookConfigured,
      problem: null,
    };
  } catch (error) {
    return {
      provider: env.PAYMENT_PROVIDER,
      environment: env.PAYMENT_PROVIDER_ENVIRONMENT,
      configured: false,
      simulated: false,
      methods: [],
      webhookConfigured,
      problem: error instanceof Error ? error.message : "Configuração inválida",
    };
  }
}

/** Métodos realmente oferecidos no checkout (vazio quando o gateway não está configurado). */
export function getAvailableCheckoutMethods(): OnlinePaymentMethod[] {
  return getPaymentProviderStatus().methods;
}

/** Ferramentas de simulação só existem fora de produção (§69). */
export function isPaymentSimulationAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && getPaymentProviderStatus().simulated;
}

export { webhookSecret as paymentWebhookSecret };
