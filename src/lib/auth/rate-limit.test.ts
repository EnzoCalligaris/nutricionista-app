import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "@/lib/auth/rate-limiter";

describe("InMemoryRateLimiter", () => {
  it("permite até o limite configurado e bloqueia depois", async () => {
    const limiter = new InMemoryRateLimiter(10, 5 * 60 * 1000);
    const key = "test-key";

    for (let i = 0; i < 10; i += 1) {
      const result = await limiter.consume(key);
      expect(result.success).toBe(true);
    }

    const blocked = await limiter.consume(key);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("chaves diferentes têm limites independentes", async () => {
    const limiter = new InMemoryRateLimiter(10, 5 * 60 * 1000);

    for (let i = 0; i < 10; i += 1) {
      await limiter.consume("key-a");
    }

    expect((await limiter.consume("key-a")).success).toBe(false);
    expect((await limiter.consume("key-b")).success).toBe(true);
  });

  it("libera novamente após a janela expirar", async () => {
    const limiter = new InMemoryRateLimiter(1, 10);
    const key = "test-key-window";

    expect((await limiter.consume(key)).success).toBe(true);
    expect((await limiter.consume(key)).success).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect((await limiter.consume(key)).success).toBe(true);
  });
});

describe("InMemoryRateLimiter.reset (Fase 6)", () => {
  it("zera o contador da chave — login válido não consome o limite de tentativas falhas", async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    await limiter.consume("k");
    await limiter.consume("k");
    expect((await limiter.consume("k")).success).toBe(false);
    await limiter.reset("k");
    expect((await limiter.consume("k")).success).toBe(true);
  });
});
