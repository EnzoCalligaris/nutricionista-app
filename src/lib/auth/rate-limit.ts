import "server-only";

import { headers } from "next/headers";
import { InMemoryRateLimiter, type RateLimiter } from "@/lib/auth/rate-limiter";

export type { RateLimiter, RateLimitResult } from "@/lib/auth/rate-limiter";

// Um limitador nomeado por fluxo público sensível (prompt Fase 3 §27/§28):
// login, esqueci-senha, e ações administrativas de onboarding de paciente.
// Lógica de janela/contagem em src/lib/auth/rate-limiter.ts (sem
// "server-only", testada em rate-limiter.test.ts).
export const loginRateLimiter: RateLimiter = new InMemoryRateLimiter(10, 5 * 60 * 1000);
export const forgotPasswordRateLimiter: RateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);
export const patientInviteRateLimiter: RateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
// Fase 11 (§51–§52): proteção TÉCNICA contra rajada de análises de IA por
// paciente (chave = patient_id) — não é quota comercial ("N fotos por dia"
// continua sem decisão de negócio). Mesma ressalva de produção acima.
export const mealAnalysisRateLimiter: RateLimiter = new InMemoryRateLimiter(12, 10 * 60 * 1000);
// Fase 12 (§84–§85): reprocessamento manual/teste de entregas por
// nutricionista e ação pública tokenizada (confirmar por link) por IP. O job
// autenticado por CRON_SECRET NÃO passa por aqui — limitar o worker seria
// atrapalhar o envio legítimo.
export const notificationRetryRateLimiter: RateLimiter = new InMemoryRateLimiter(30, 10 * 60 * 1000);
export const tokenActionRateLimiter: RateLimiter = new InMemoryRateLimiter(20, 10 * 60 * 1000);

/** IP do cliente a partir dos headers de proxy — usado para compor a chave de rate limit. */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return requestHeaders.get("x-real-ip") ?? "unknown";
}
