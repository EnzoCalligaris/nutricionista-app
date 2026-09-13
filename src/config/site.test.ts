import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, siteConfig } from "@/config/site";

describe("siteConfig", () => {
  it("usa o fuso horário America/Sao_Paulo", () => {
    expect(siteConfig.timeZone).toBe("America/Sao_Paulo");
    expect(DEFAULT_TIME_ZONE).toBe("America/Sao_Paulo");
  });

  it("usa o locale pt-BR", () => {
    expect(siteConfig.locale).toBe("pt-BR");
  });

  it("não contém dados de contato ainda pendentes (telefone, CRN, endereço)", () => {
    const serialized = JSON.stringify(siteConfig).toLowerCase();
    expect(serialized).not.toMatch(/crn|telefone|endereço|endereco/);
  });
});
