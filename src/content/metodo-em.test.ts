import { describe, expect, it } from "vitest";
import { ABOUT, BENEFITS, METHOD_PHASES, MISSION, PILLARS } from "@/content/metodo-em";

const ALL_TEXT = JSON.stringify({ ABOUT, BENEFITS, METHOD_PHASES, MISSION, PILLARS }).toLowerCase();

describe("conteúdo editorial do Método EM", () => {
  it("não menciona grupo exclusivo (removido da oferta)", () => {
    expect(ALL_TEXT).not.toContain("grupo exclusivo");
  });

  it("não menciona comunidade VIP (pendente de definição)", () => {
    expect(ALL_TEXT).not.toContain("comunidade vip");
    expect(ALL_TEXT).not.toContain("grupo vip");
  });

  it("não menciona o passo de WhatsApp do fluxo antigo", () => {
    expect(ALL_TEXT).not.toContain("whatsapp");
  });

  it("publica 4 pilares, não os 6 antigos", () => {
    expect(PILLARS).toHaveLength(4);
  });

  it("cobre antes, durante e depois", () => {
    expect(METHOD_PHASES.map((p) => p.key)).toEqual(["antes", "durante", "depois"]);
  });

  it("não inventa CRN, telefone, endereço, garantia, cashback ou estatísticas", () => {
    expect(ALL_TEXT).not.toMatch(/crn|telefone|endereço|cashback|garantia|\d+\s*pacientes|\d+\s*%/);
  });

  it("não usa clichês de IA", () => {
    expect(ALL_TEXT).not.toMatch(/transforme sua jornada|desbloqueie|eleve sua saúde|experiência única/);
  });
});
