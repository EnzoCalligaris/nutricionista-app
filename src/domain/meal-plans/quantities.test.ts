import { describe, expect, it } from "vitest";
import { formatNutrient, formatQuantity, formatTimeOfDay, parseQuantity } from "@/domain/meal-plans/quantities";
import { UNIT_VALUES, isKnownUnit, isWeekday, weekPosition } from "@/domain/meal-plans/definitions";

describe("formatQuantity", () => {
  it("usa singular/plural da unidade e formato pt-BR", () => {
    expect(formatQuantity(100, "g")).toBe("100 g");
    expect(formatQuantity(1, "unidade")).toBe("1 unidade");
    expect(formatQuantity(2, "unidade")).toBe("2 unidades");
    expect(formatQuantity(1.5, "xícara")).toBe("1,5 xícaras");
    expect(formatQuantity(2, "colher de sopa")).toBe("2 colheres de sopa");
    expect(formatQuantity(1, "a gosto")).toBe("1 a gosto");
  });

  it("unidade desconhecida (dado antigo) é mostrada como veio; sem quantidade mostra só a unidade", () => {
    expect(formatQuantity(3, "pote")).toBe("3 pote");
    expect(formatQuantity(null, "g")).toBe("g");
    expect(formatQuantity(null, null)).toBe("");
  });
});

describe("parseQuantity", () => {
  it("aceita vírgula ou ponto com até 2 casas, > 0", () => {
    expect(parseQuantity("100")).toBe(100);
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("0.25")).toBe(0.25);
    expect(parseQuantity(" 2 ")).toBe(2);
  });
  it("rejeita zero, negativo, texto e 3 casas", () => {
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("1,234")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});

describe("helpers", () => {
  it("formatNutrient só quando informado", () => {
    expect(formatNutrient(null, "kcal")).toBeNull();
    expect(formatNutrient(140, "kcal")).toBe("140 kcal");
    expect(formatNutrient(12.5, "g prot.")).toBe("12,5 g prot.");
  });
  it("formatTimeOfDay corta segundos", () => {
    expect(formatTimeOfDay("07:30:00")).toBe("07:30");
    expect(formatTimeOfDay(null)).toBeNull();
  });
  it("unidades controladas e dias da semana", () => {
    expect(UNIT_VALUES).toContain("g");
    expect(isKnownUnit("fatia")).toBe(true);
    expect(isKnownUnit("kg")).toBe(false);
    expect(isWeekday(6)).toBe(true);
    expect(isWeekday(7)).toBe(false);
    expect(weekPosition(1)).toBe(0);
    expect(weekPosition(0)).toBe(6);
  });
});
