import "server-only";

import { getServerEnv } from "@/lib/env";
import { FakeFoodAnalysisProvider } from "@/services/food-analysis/fake-provider";
import { FoodAnalysisProviderError, type FoodAnalysisProvider } from "@/services/food-analysis/provider";

export type { FoodAnalysisProvider } from "@/services/food-analysis/provider";
export { FoodAnalysisProviderError } from "@/services/food-analysis/provider";

/**
 * Fábrica do provider por configuração (prompt Fase 11 §5): `FOOD_ANALYSIS_PROVIDER`
 * (default `fake`), `FOOD_ANALYSIS_MODEL`, `FOOD_ANALYSIS_TIMEOUT_MS`. Um
 * fornecedor real entra aqui como novo adapter (`<provider-real>.ts`) — sem
 * credencial configurada, nada real é chamado e o app segue com o fake
 * (estimativa simulada, sinalizada na UI). Nunca inventa API key.
 */
export function getFoodAnalysisProvider(): FoodAnalysisProvider {
  const env = getServerEnv();
  const id = env.FOOD_ANALYSIS_PROVIDER;
  if (id === "fake") return new FakeFoodAnalysisProvider();
  // Vendor/modelo real: PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md, Fase 11).
  // Qualquer outro valor configurado sem adapter correspondente é indisponível — nunca cai no fake em silêncio.
  throw new FoodAnalysisProviderError("PROVIDER_UNAVAILABLE", `provider "${id}" não tem adapter configurado`);
}

/** Estado da configuração para a UI (§3: "estado claro quando análise real não estiver configurada"). */
export function getFoodAnalysisConfigStatus(): { provider: string; model: string; simulated: boolean; available: boolean } {
  try {
    const provider = getFoodAnalysisProvider();
    return { provider: provider.id, model: provider.model, simulated: provider.simulated, available: true };
  } catch {
    const env = getServerEnv();
    return { provider: env.FOOD_ANALYSIS_PROVIDER, model: env.FOOD_ANALYSIS_MODEL ?? "", simulated: false, available: false };
  }
}

export function getFoodAnalysisTimeoutMs(): number {
  return getServerEnv().FOOD_ANALYSIS_TIMEOUT_MS;
}
