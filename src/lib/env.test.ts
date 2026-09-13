import { describe, expect, it } from "vitest";
import { env, getServerEnv } from "@/lib/env";

describe("env", () => {
  it("resolve NEXT_PUBLIC_SITE_URL com default local quando não configurado", () => {
    expect(env.NEXT_PUBLIC_SITE_URL).toMatch(/^https?:\/\//);
  });

  it("getServerEnv() nunca pode ser chamado no browser (regra de segurança)", () => {
    // O ambiente de teste roda em jsdom, então `window` está definido —
    // exatamente o cenário que getServerEnv() deve recusar.
    expect(typeof window).not.toBe("undefined");
    expect(() => getServerEnv()).toThrow(/não pode ser chamado no browser/);
  });
});
