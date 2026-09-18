import { describe, expect, it } from "vitest";
import { authErrorMessage, mapSupabaseAuthError, AuthError } from "@/lib/auth/errors";

describe("authErrorMessage", () => {
  it("mensagem de credenciais inválidas é genérica (prevenção de enumeração)", () => {
    const message = authErrorMessage("INVALID_CREDENTIALS");
    expect(message.toLowerCase()).not.toContain("existe");
    expect(message.toLowerCase()).not.toContain("cadastr");
    expect(message).toBe("E-mail ou senha inválidos.");
  });

  it("cobre todos os códigos sem lançar", () => {
    const codes = [
      "AUTH_REQUIRED",
      "INVALID_CREDENTIALS",
      "FORBIDDEN",
      "SESSION_EXPIRED",
      "INVITE_ALREADY_EXISTS",
      "PATIENT_ALREADY_LINKED",
      "RATE_LIMITED",
      "VALIDATION_ERROR",
      "UNKNOWN",
    ] as const;

    for (const code of codes) {
      expect(authErrorMessage(code)).toBeTruthy();
    }
  });
});

describe("mapSupabaseAuthError", () => {
  it("mapeia 'Invalid login credentials' para INVALID_CREDENTIALS", () => {
    const err = mapSupabaseAuthError(new Error("Invalid login credentials"));
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe("INVALID_CREDENTIALS");
  });

  it("mapeia usuário já existente para INVITE_ALREADY_EXISTS", () => {
    expect(mapSupabaseAuthError(new Error("User already registered")).code).toBe(
      "INVITE_ALREADY_EXISTS",
    );
    expect(mapSupabaseAuthError(new Error("email_exists")).code).toBe("INVITE_ALREADY_EXISTS");
  });

  it("mapeia rate limit para RATE_LIMITED", () => {
    expect(mapSupabaseAuthError(new Error("Email rate limit exceeded")).code).toBe(
      "RATE_LIMITED",
    );
  });

  it("nunca repassa a mensagem crua do Supabase — sempre uma mensagem de domínio", () => {
    const raw = "some internal supabase implementation detail xyz123";
    const err = mapSupabaseAuthError(new Error(raw));
    expect(err.message).not.toContain(raw);
  });

  it("erro desconhecido cai em UNKNOWN", () => {
    expect(mapSupabaseAuthError(new Error("um erro nunca visto antes")).code).toBe("UNKNOWN");
    expect(mapSupabaseAuthError("string crua, não Error").code).toBe("UNKNOWN");
  });
});
