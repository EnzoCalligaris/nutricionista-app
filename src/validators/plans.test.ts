import { describe, expect, it } from "vitest";
import {
  parseAmountToCents,
  planBenefitIdSchema,
  planBenefitSchema,
  planFlagErrors,
  planIdSchema,
  planPriceIdSchema,
  planPriceSchema,
  planSchema,
} from "@/validators/plans";

/** Validação de plano/preço/benefício (prompt Fase 14 §18/§65). */
describe("parseAmountToCents", () => {
  it("aceita os formatos que o nutricionista realmente digita", () => {
    expect(parseAmountToCents("230")).toBe(23000);
    expect(parseAmountToCents("230,00")).toBe(23000);
    expect(parseAmountToCents("1.050,00")).toBe(105000);
    expect(parseAmountToCents("R$ 1.050,00")).toBe(105000);
    expect(parseAmountToCents("226,79")).toBe(22679);
  });

  it("trata ponto de milhar sem decimais como milhar, não como decimal", () => {
    expect(parseAmountToCents("1.050")).toBe(105000);
  });

  it("recusa texto e valor vazio", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("12,345")).toBeNull();
  });
});

describe("planPriceSchema", () => {
  const base = { label: "À vista", installments: "1", paymentType: "AVISTA" as const, isPrimary: false, active: true };

  it("converte para centavos inteiros", () => {
    const parsed = planPriceSchema.safeParse({ ...base, amount: "230,00" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.amountCents).toBe(23000);
  });

  it("recusa valor zero ou negativo (§18)", () => {
    expect(planPriceSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(planPriceSchema.safeParse({ ...base, amount: "0,00" }).success).toBe(false);
  });

  it("recusa parcelas <= 0 (§18)", () => {
    expect(planPriceSchema.safeParse({ ...base, amount: "100", installments: "0" }).success).toBe(false);
    expect(planPriceSchema.safeParse({ ...base, amount: "100", installments: "-3" }).success).toBe(false);
  });

  it("recusa forma de pagamento desconhecida", () => {
    expect(planPriceSchema.safeParse({ ...base, amount: "100", paymentType: "PIX" }).success).toBe(false);
  });
});

describe("planFlagErrors", () => {
  it("plano inativo não pode ser público nem vendável (§13/§14)", () => {
    const errors = planFlagErrors({ active: false, publiclyVisible: true, availableForSale: true });
    expect(errors.publiclyVisible).toBeDefined();
    expect(errors.availableForSale).toBeDefined();
  });

  it("combinação coerente não gera erro", () => {
    expect(planFlagErrors({ active: true, publiclyVisible: false, availableForSale: false })).toEqual({});
    expect(planFlagErrors({ active: true, publiclyVisible: true, availableForSale: true })).toEqual({});
  });

  it("plano ativo fora do site é estado válido — é o do ANUAL (§14)", () => {
    expect(planFlagErrors({ active: true, publiclyVisible: false, availableForSale: false })).toEqual({});
  });
});

describe("planSchema", () => {
  it("aceita composição não definida (null), que não é zero", () => {
    const parsed = planSchema.safeParse({
      name: "Plano Anual",
      description: "",
      durationMonths: 12,
      sessionsInPerson: null,
      sessionsOnline: null,
      active: true,
      publiclyVisible: false,
      availableForSale: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sessionsInPerson).toBeNull();
      expect(parsed.data.description).toBeNull();
    }
  });

  it("recusa nome curto", () => {
    expect(
      planSchema.safeParse({
        name: "ab",
        description: "",
        durationMonths: null,
        sessionsInPerson: null,
        sessionsOnline: null,
        active: true,
        publiclyVisible: false,
        availableForSale: false,
      }).success,
    ).toBe(false);
  });
});

describe("planBenefitSchema", () => {
  it("exige um rótulo mínimo", () => {
    expect(planBenefitSchema.safeParse({ label: "a", active: true }).success).toBe(false);
    expect(planBenefitSchema.safeParse({ label: "Planejamento alimentar", active: true }).success).toBe(true);
  });
});

describe("formato de id (mesma convenção de src/validators/patients.ts)", () => {
  const SEED_STYLE_ID = "90000000-0000-0000-0000-000000000010";

  it("aceita os ids do seed/migrations (z.guid, não z.uuid)", () => {
    expect(planIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
    expect(planPriceIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
    expect(planBenefitIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
  });
});
