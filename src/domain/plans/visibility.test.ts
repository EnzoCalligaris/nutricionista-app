import { describe, expect, it } from "vitest";
import { filterPublicPlans, isSellable, sortPlansForDisplay } from "@/domain/plans/visibility";

const plans = [
  { code: "ANUAL", active: true, publicly_visible: false, available_for_sale: false },
  { code: "SEMESTRAL", active: true, publicly_visible: true, available_for_sale: true },
  { code: "AVULSA", active: true, publicly_visible: true, available_for_sale: true },
  { code: "TRIMESTRAL", active: true, publicly_visible: true, available_for_sale: true },
  { code: "ANTIGO", active: false, publicly_visible: true, available_for_sale: true },
];

describe("filterPublicPlans", () => {
  it("nunca inclui o plano ANUAL (publicly_visible = false)", () => {
    const codes = filterPublicPlans(plans).map((p) => p.code);
    expect(codes).not.toContain("ANUAL");
  });

  it("exclui planos inativos mesmo se publicly_visible", () => {
    expect(filterPublicPlans(plans).map((p) => p.code)).not.toContain("ANTIGO");
  });

  it("mantém avulsa, trimestral e semestral", () => {
    expect(filterPublicPlans(plans).map((p) => p.code).sort()).toEqual(["AVULSA", "SEMESTRAL", "TRIMESTRAL"]);
  });
});

describe("sortPlansForDisplay", () => {
  it("ordena avulsa, trimestral, semestral", () => {
    expect(sortPlansForDisplay(filterPublicPlans(plans)).map((p) => p.code)).toEqual([
      "AVULSA",
      "TRIMESTRAL",
      "SEMESTRAL",
    ]);
  });
});

describe("isSellable", () => {
  it("exige as três flags", () => {
    expect(isSellable({ active: true, publicly_visible: true, available_for_sale: false })).toBe(false);
    expect(isSellable({ active: true, publicly_visible: true, available_for_sale: true })).toBe(true);
  });
});
