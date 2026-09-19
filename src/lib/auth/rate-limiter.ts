/**
 * Lógica pura de rate limiting — sem dependência de Next.js/server-only, de
 * propósito, para poder ser testada em isolamento (`rate-limiter.test.ts`).
 * A instância configurada para cada fluxo (login, esqueci-senha, convite) e
 * o helper `getClientIp()` (que precisa de `next/headers`) ficam em
 * `rate-limit.ts`, esse sim `server-only`.
 */

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
  /** Zera o contador da chave (ex.: login bem-sucedido — o limite é para tentativas falhas). */
  reset(key: string): Promise<void>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Limitador em memória do processo Node — correto para desenvolvimento
 * local e testes, e para um único servidor Node de longa duração (ex.:
 * `npm run start` num container). NÃO é confiável como única defesa em
 * produção na Vercel: funções serverless não compartilham memória entre
 * invocações/instâncias, então o limite real observado pode ficar bem acima
 * de `max` sob tráfego distribuído entre instâncias (prompt Fase 3 §27).
 *
 * Para produção, troque a implementação por um store externo compartilhado
 * (ex.: Upstash Redis, compatível com runtime serverless/edge) que
 * implemente esta mesma interface `RateLimiter` — nenhum código de chamada
 * (actions de login/esqueci-senha/onboarding) precisa mudar. Não integramos
 * um fornecedor pago nesta fase (prompt Fase 3 §27: "não exigir integração
 * paga agora") — fica registrado como pendência em docs/DECISIONS.md.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { success: true, remaining: this.max - 1, resetAt };
    }

    if (bucket.count >= this.max) {
      return { success: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return {
      success: true,
      remaining: this.max - bucket.count,
      resetAt: bucket.resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}
