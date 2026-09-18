import { describe, expect, it } from "vitest";
import { contactSchema } from "@/validators/contact";

describe("contactSchema", () => {
  it("aceita nome, e-mail e mensagem válidos", () => {
    expect(
      contactSchema.safeParse({ name: "Maria", email: "maria@example.com", message: "Quero saber mais sobre os planos." }).success,
    ).toBe(true);
  });

  it("rejeita mensagem curta demais", () => {
    expect(contactSchema.safeParse({ name: "Maria", email: "maria@example.com", message: "oi" }).success).toBe(false);
  });

  it("rejeita honeypot preenchido (bot)", () => {
    expect(
      contactSchema.safeParse({ name: "Bot", email: "bot@example.com", message: "mensagem automática", website: "http://spam" }).success,
    ).toBe(false);
  });
});
