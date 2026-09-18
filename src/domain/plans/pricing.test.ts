import { describe, expect, it } from "vitest";
import { formatBRL, presentPlanPrices, type PlanPriceInput } from "@/domain/plans/pricing";

function price(overrides: Partial<PlanPriceInput>): PlanPriceInput {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    label: "x",
    amount_cents: 1000,
    installments: 1,
    payment_type: "AVISTA",
    is_primary: false,
    active: true,
    ...overrides,
  };
}

describe("formatBRL", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(23000).replace(/ /g, " ")).toBe("R$ 230,00");
    expect(formatBRL(22679).replace(/ /g, " ")).toBe("R$ 226,79");
  });
});

describe("presentPlanPrices", () => {
  it("destaca o preço marcado como is_primary (consulta avulsa R$ 230)", () => {
    const result = presentPlanPrices([price({ amount_cents: 23000, is_primary: true, label: "Consulta avulsa" })]);
    expect(result.primary?.total.replace(/ /g, " ")).toBe("R$ 230,00");
    expect(result.pendingPrimary).toBe(false);
    expect(result.options).toHaveLength(0);
  });

  it("NÃO inventa preço principal quando nenhum é is_primary (trimestral)", () => {
    const result = presentPlanPrices([
      price({ amount_cents: 105000, payment_type: "REFERENCIA", label: "Valor cheio (de)" }),
      price({ amount_cents: 68037, installments: 3, payment_type: "PARCELADO", label: "Parcelado" }),
      price({ amount_cents: 60000, payment_type: "AVISTA", label: "À vista" }),
    ]);
    expect(result.primary).toBeNull();
    expect(result.pendingPrimary).toBe(true);
    expect(result.options).toHaveLength(3);
  });

  it("ordena opções: à vista, parcelado, referência", () => {
    const result = presentPlanPrices([
      price({ payment_type: "REFERENCIA" }),
      price({ payment_type: "PARCELADO", installments: 6, amount_cents: 128760 }),
      price({ payment_type: "AVISTA" }),
    ]);
    expect(result.options.map((o) => o.paymentType)).toEqual(["AVISTA", "PARCELADO", "REFERENCIA"]);
  });

  it("calcula o valor da parcela do parcelado", () => {
    const result = presentPlanPrices([
      price({ payment_type: "PARCELADO", installments: 6, amount_cents: 128760 }),
    ]);
    expect(result.options[0]?.installment?.replace(/ /g, " ")).toBe("R$ 214,60");
    expect(result.options[0]?.installments).toBe(6);
  });

  it("ignora preços inativos", () => {
    const result = presentPlanPrices([price({ active: false, is_primary: true })]);
    expect(result.primary).toBeNull();
    expect(result.pendingPrimary).toBe(false);
    expect(result.options).toHaveLength(0);
  });

  it("marca REFERENCIA como valor informativo, não opção de compra", () => {
    const result = presentPlanPrices([price({ payment_type: "REFERENCIA" })]);
    expect(result.options[0]?.isReference).toBe(true);
  });
});
