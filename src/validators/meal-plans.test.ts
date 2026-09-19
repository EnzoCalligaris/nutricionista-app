import { describe, expect, it } from "vitest";
import {
  addDaySchema,
  createMealPlanSchema,
  duplicateDaySchema,
  mealItemSchema,
  mealSchema,
  substitutionSchema,
  updateMealItemSchema,
} from "@/validators/meal-plans";

const GUID = "90000000-0000-0000-0000-000000000510";

describe("createMealPlanSchema", () => {
  it("exige nome; normaliza opcionais; aceita versão base", () => {
    const parsed = createMealPlanSchema.parse({ title: "  Plano de verão ", startDate: "", notes: " ", sourceVersionId: GUID });
    expect(parsed).toEqual({ title: "Plano de verão", startDate: null, notes: null, sourceVersionId: GUID });
    expect(createMealPlanSchema.safeParse({ title: "A" }).success).toBe(false);
    expect(createMealPlanSchema.safeParse({ title: "Plano", startDate: "2026-02-30" }).success).toBe(false);
    expect(createMealPlanSchema.safeParse({ title: "Plano", sourceVersionId: "abc" }).success).toBe(false);
  });
});

describe("mealSchema", () => {
  it("nome livre obrigatório, horário HH:mm opcional", () => {
    expect(mealSchema.parse({ name: "Ceia", timeOfDay: "", notes: "" })).toEqual({ name: "Ceia", timeOfDay: null, notes: null });
    expect(mealSchema.parse({ name: "Café", timeOfDay: "07:30" }).timeOfDay).toBe("07:30");
    expect(mealSchema.safeParse({ name: "Café", timeOfDay: "7h" }).success).toBe(false);
    expect(mealSchema.safeParse({ name: "Café", timeOfDay: "25:00" }).success).toBe(false);
    expect(mealSchema.safeParse({ name: "X" }).success).toBe(false);
  });
});

describe("mealItemSchema (quantidade/unidade — §13)", () => {
  const valid = { foodName: "Arroz", quantity: 100, unit: "g" };

  it("aceita unidades controladas e quantidade > 0", () => {
    expect(mealItemSchema.safeParse(valid).success).toBe(true);
    expect(mealItemSchema.safeParse({ ...valid, quantity: 1.5, unit: "xícara" }).success).toBe(true);
    expect(mealItemSchema.safeParse({ ...valid, unit: "colher de sopa" }).success).toBe(true);
  });

  it("rejeita quantidade 0/negativa/NaN, unidade fora da lista e nutriente negativo", () => {
    for (const quantity of [0, -1, Number.NaN]) {
      expect(mealItemSchema.safeParse({ ...valid, quantity }).success, String(quantity)).toBe(false);
    }
    expect(mealItemSchema.safeParse({ ...valid, unit: "kg" }).success).toBe(false);
    expect(mealItemSchema.safeParse({ ...valid, unit: "" }).success).toBe(false);
    expect(mealItemSchema.safeParse({ ...valid, calories: -5 }).success).toBe(false);
    expect(mealItemSchema.safeParse({ ...valid, calories: Number.NaN }).success).toBe(false);
  });

  it("nutrientes opcionais e observações vazias viram null", () => {
    const parsed = mealItemSchema.parse({ ...valid, calories: 130, proteinG: null, notes: "", instructions: "  " });
    expect(parsed.calories).toBe(130);
    expect(parsed.proteinG).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.instructions).toBeNull();
  });

  it("update exige o carimbo de concorrência", () => {
    expect(updateMealItemSchema.safeParse({ ...valid, expectedUpdatedAt: "" }).success).toBe(false);
    expect(updateMealItemSchema.safeParse({ ...valid, expectedUpdatedAt: "2026-09-19T00:00:00Z" }).success).toBe(true);
  });
});

describe("substitutionSchema (§15)", () => {
  it("quantidade/unidade opcionais, nome obrigatório", () => {
    expect(substitutionSchema.parse({ substituteFoodName: "Batata doce" })).toMatchObject({ substituteFoodName: "Batata doce" });
    expect(substitutionSchema.safeParse({ substituteFoodName: "Batata", quantity: 150, unit: "g" }).success).toBe(true);
    expect(substitutionSchema.safeParse({ substituteFoodName: "B" }).success).toBe(false);
    expect(substitutionSchema.safeParse({ substituteFoodName: "Batata", quantity: 0 }).success).toBe(false);
    expect(substitutionSchema.safeParse({ substituteFoodName: "Batata", unit: "balde" }).success).toBe(false);
  });
});

describe("dias", () => {
  it("weekday 0..6; duplicação exige destino válido", () => {
    expect(addDaySchema.parse({ weekday: "3" })).toEqual({ weekday: 3 });
    expect(addDaySchema.safeParse({ weekday: 7 }).success).toBe(false);
    expect(duplicateDaySchema.parse({ targetWeekday: 2 })).toEqual({ targetWeekday: 2, replace: false });
    expect(duplicateDaySchema.safeParse({ targetWeekday: -1 }).success).toBe(false);
  });
});
