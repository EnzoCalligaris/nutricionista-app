import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

describe("sanitizeRedirectPath", () => {
  it("aceita um path interno simples", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/paciente/consultas")).toBe("/paciente/consultas");
  });

  it("aceita path interno com query string", () => {
    expect(sanitizeRedirectPath("/dashboard?tab=agenda")).toBe("/dashboard?tab=agenda");
  });

  it("usa o fallback quando next é nulo/vazio", () => {
    expect(sanitizeRedirectPath(null)).toBe("/");
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
    expect(sanitizeRedirectPath(undefined, "/dashboard")).toBe("/dashboard");
  });

  // Vetores de ataque obrigatórios (prompt Fase 3 §12) — todos devem cair
  // no fallback, nunca ser aceitos como destino de redirect.
  it("rejeita URL absoluta (https://evil.example)", () => {
    expect(sanitizeRedirectPath("https://evil.example")).toBe("/");
    expect(sanitizeRedirectPath("http://evil.example/dashboard")).toBe("/");
  });

  it("rejeita protocol-relative (//evil.example)", () => {
    expect(sanitizeRedirectPath("//evil.example")).toBe("/");
  });

  it("rejeita variante com percent-encoding (/%2F%2Fevil.example)", () => {
    expect(sanitizeRedirectPath("/%2F%2Fevil.example")).toBe("/");
  });

  it("rejeita percent-encoding duplo", () => {
    expect(sanitizeRedirectPath("/%252F%252Fevil.example")).toBe("/");
  });

  it("rejeita javascript:", () => {
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("rejeita data:", () => {
    expect(sanitizeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("rejeita backslash como variante de protocol-relative (/\\evil.example)", () => {
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/");
  });

  it("rejeita percent-encoding malformado (falha fechado)", () => {
    expect(sanitizeRedirectPath("/%")).toBe("/");
  });

  it("rejeita path que não começa com /", () => {
    expect(sanitizeRedirectPath("dashboard")).toBe("/");
    expect(sanitizeRedirectPath("evil.example/dashboard")).toBe("/");
  });
});
