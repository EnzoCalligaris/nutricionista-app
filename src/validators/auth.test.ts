import { describe, expect, it } from "vitest";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  invitePatientSchema,
} from "@/validators/auth";

describe("loginSchema", () => {
  it("aceita e-mail e senha válidos", () => {
    const result = loginSchema.safeParse({ email: "a@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    expect(loginSchema.safeParse({ email: "não-é-email", password: "x" }).success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("rejeita e-mail inválido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "invalido" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("aceita senha >= 8 caracteres com confirmação igual", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita senha curta", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "1234567", confirmPassword: "1234567" }).success,
    ).toBe(false);
  });

  it("rejeita quando as senhas não coincidem", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "87654321",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });
});

describe("invitePatientSchema", () => {
  it("aceita nome e e-mail válidos", () => {
    expect(
      invitePatientSchema.safeParse({ email: "p@example.com", fullName: "Paciente Teste" }).success,
    ).toBe(true);
  });

  it("rejeita nome muito curto", () => {
    expect(invitePatientSchema.safeParse({ email: "p@example.com", fullName: "A" }).success).toBe(
      false,
    );
  });

  it("rejeita e-mail inválido", () => {
    expect(
      invitePatientSchema.safeParse({ email: "invalido", fullName: "Paciente Teste" }).success,
    ).toBe(false);
  });
});
