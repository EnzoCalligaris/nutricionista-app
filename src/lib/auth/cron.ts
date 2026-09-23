import { timingSafeEqual } from "node:crypto";

/**
 * Autenticação do scheduler (prompt Fase 12 §50–§56): o job só roda com
 * `Authorization: Bearer <CRON_SECRET>` (formato que a Vercel Cron envia
 * automaticamente quando a env `CRON_SECRET` existe). Comparação em tempo
 * constante; sem segredo configurado em produção → fail closed (recusa
 * tudo). Em dev sem segredo, aceita só chamadas locais explícitas com o
 * header `x-cron-dev: 1`, para o desenvolvedor disparar o ciclo à mão.
 * O segredo nunca é logado. Lógica pura (sem next/headers) para ser
 * testável em isolamento.
 */
export type CronAuthResult = { ok: true; mode: "SECRET" | "DEV" } | { ok: false; reason: "NO_SECRET_CONFIGURED" | "MISSING_HEADER" | "INVALID_SECRET" };

export function authorizeCronRequest(input: { authorization: string | null; secret: string | undefined; isProduction: boolean; devHeader?: string | null }): CronAuthResult {
  if (!input.secret) {
    if (!input.isProduction && input.devHeader === "1") return { ok: true, mode: "DEV" };
    return { ok: false, reason: "NO_SECRET_CONFIGURED" };
  }
  const header = input.authorization ?? "";
  if (!header.startsWith("Bearer ")) return { ok: false, reason: "MISSING_HEADER" };
  const presented = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(input.secret);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return { ok: false, reason: "INVALID_SECRET" };
  return { ok: true, mode: "SECRET" };
}
