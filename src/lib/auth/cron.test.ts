import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "@/lib/auth/cron";

describe("authorizeCronRequest", () => {
  const secret = "s3cr3t-with-enough-length";

  it("aceita Bearer com o segredo exato", () => {
    expect(authorizeCronRequest({ authorization: `Bearer ${secret}`, secret, isProduction: true })).toEqual({ ok: true, mode: "SECRET" });
  });

  it("recusa header ausente, esquema errado, segredo errado ou prefixo", () => {
    expect(authorizeCronRequest({ authorization: null, secret, isProduction: true })).toEqual({ ok: false, reason: "MISSING_HEADER" });
    expect(authorizeCronRequest({ authorization: secret, secret, isProduction: true })).toEqual({ ok: false, reason: "MISSING_HEADER" });
    expect(authorizeCronRequest({ authorization: "Bearer nope", secret, isProduction: true })).toEqual({ ok: false, reason: "INVALID_SECRET" });
    expect(authorizeCronRequest({ authorization: `Bearer ${secret}x`, secret, isProduction: true })).toEqual({ ok: false, reason: "INVALID_SECRET" });
  });

  it("sem segredo em produção recusa tudo (fail closed)", () => {
    expect(authorizeCronRequest({ authorization: "Bearer anything", secret: undefined, isProduction: true, devHeader: "1" })).toEqual({ ok: false, reason: "NO_SECRET_CONFIGURED" });
  });

  it("sem segredo em dev aceita só com o header explícito de desenvolvimento", () => {
    expect(authorizeCronRequest({ authorization: null, secret: undefined, isProduction: false, devHeader: "1" })).toEqual({ ok: true, mode: "DEV" });
    expect(authorizeCronRequest({ authorization: null, secret: undefined, isProduction: false, devHeader: null })).toEqual({ ok: false, reason: "NO_SECRET_CONFIGURED" });
  });
});
