import { describe, expect, it } from "vitest";
import { toPublicPlanPreview } from "@/domain/plans/preview";
import { presentPlanPrices } from "@/domain/plans/pricing";

/**
 * Condição principal de preço (prompt Fase 14 §16/§17/§66/§67). A troca
 * atômica é garantida pelo banco (`set_plan_primary_price` + índice único);
 * aqui está a regra de APRESENTAÇÃO: exatamente uma em destaque quando
 * marcada, nenhuma eleita quando não há marcação.
 */
const price = (id: string, amountCents: number, isPrimary: boolean, active = true) => ({
  id,
  label: `Condição ${id}`,
  amountCents,
  installments: 1,
  paymentType: "AVISTA" as const,
  isPrimary,
  active,
});

const plan = (prices: ReturnType<typeof price>[]) => ({
  id: "plan-1",
  code: "TRIMESTRAL",
  name: "Plano Trimestral",
  durationMonths: 3,
  sessionsInPerson: 3,
  sessionsOnline: 2,
  availableForSale: true,
  prices,
  benefits: [
    { label: "Benefício ativo", sortOrder: 2, active: true },
    { label: "Benefício desativado", sortOrder: 1, active: false },
  ],
});

describe("toPublicPlanPreview", () => {
  it("com A marcada, só A está em destaque (§66)", () => {
    const preview = toPublicPlanPreview(plan([price("A", 60000, true), price("B", 68037, false), price("C", 105000, false)]));
    expect(preview.pricing.primary?.id).toBe("A");
    expect(preview.pricing.options.map((option) => option.id)).toEqual(["B", "C"]);
    expect(preview.pricing.pendingPrimary).toBe(false);
  });

  it("trocando para B, o destaque passa a ser SOMENTE B (§66)", () => {
    const preview = toPublicPlanPreview(plan([price("A", 60000, false), price("B", 68037, true), price("C", 105000, false)]));
    expect(preview.pricing.primary?.id).toBe("B");
    expect(preview.pricing.options.some((option) => option.id === "A")).toBe(true);
    expect(preview.pricing.options.some((option) => option.id === "B")).toBe(false);
  });

  it("sem nenhuma marcada, o site lista todas sem inventar principal (§67)", () => {
    const preview = toPublicPlanPreview(plan([price("A", 60000, false), price("B", 68037, false), price("C", 105000, false)]));
    expect(preview.pricing.primary).toBeNull();
    expect(preview.pricing.pendingPrimary).toBe(true);
    expect(preview.pricing.options).toHaveLength(3);
  });

  it("condição inativa não aparece no site", () => {
    const preview = toPublicPlanPreview(plan([price("A", 60000, false), price("B", 68037, false, false)]));
    expect(preview.pricing.options.map((option) => option.id)).toEqual(["A"]);
  });

  it("benefício desativado não aparece, e a ordem é a configurada (§19)", () => {
    const preview = toPublicPlanPreview(plan([price("A", 60000, true)]));
    expect(preview.benefits).toEqual(["Benefício ativo"]);
  });
});

describe("presentPlanPrices", () => {
  it("duas linhas marcadas (estado que o banco impede) nunca produzem dois destaques", () => {
    const presentation = presentPlanPrices([
      { id: "A", label: "A", amount_cents: 100, installments: 1, payment_type: "AVISTA", is_primary: true, active: true },
      { id: "B", label: "B", amount_cents: 200, installments: 1, payment_type: "AVISTA", is_primary: true, active: true },
    ]);
    expect(presentation.primary?.id).toBe("A");
    expect(presentation.options).toHaveLength(1);
  });
});
