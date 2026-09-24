import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, instagramHandle, telHref } from "@/domain/site-settings/format";

describe("formatPhoneForDisplay", () => {
  it("formata celular e fixo brasileiros a partir do E.164", () => {
    expect(formatPhoneForDisplay("+5511999990001")).toBe("(11) 99999-0001");
    expect(formatPhoneForDisplay("+551133330001")).toBe("(11) 3333-0001");
  });

  it("número de outro DDI é exibido como está — sem adivinhar máscara", () => {
    expect(formatPhoneForDisplay("+14155550123")).toBe("+14155550123");
  });

  it("vazio continua vazio", () => {
    expect(formatPhoneForDisplay(undefined)).toBeUndefined();
    expect(formatPhoneForDisplay("  ")).toBeUndefined();
  });
});

describe("telHref", () => {
  it("usa o número normalizado", () => {
    expect(telHref("(11) 99999-0001")).toBe("tel:+5511999990001");
  });
});

describe("instagramHandle", () => {
  it("extrai o @usuario da URL salva", () => {
    expect(instagramHandle("https://instagram.com/exemplo")).toBe("@exemplo");
    expect(instagramHandle("https://instagram.com/exemplo/")).toBe("@exemplo");
  });

  it("mantém o handle quando já vem com @", () => {
    expect(instagramHandle("@exemplo")).toBe("@exemplo");
  });

  it("devolve undefined para valor inutilizável", () => {
    expect(instagramHandle(undefined)).toBeUndefined();
    expect(instagramHandle("não é url")).toBeUndefined();
  });
});
