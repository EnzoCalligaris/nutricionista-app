import { describe, expect, it } from "vitest";
import { formatDecimalPtBr, formatDelta, formatMetric, parseDecimalPtBr, subtractPrecise, toInputValue } from "@/domain/assessments/numbers";

describe("parseDecimalPtBr (§52)", () => {
  it("aceita 78, 78,5 e 78.5", () => {
    expect(parseDecimalPtBr("78")).toBe(78);
    expect(parseDecimalPtBr("78,5")).toBe(78.5);
    expect(parseDecimalPtBr("78.5")).toBe(78.5);
    expect(parseDecimalPtBr(" 78,45 ")).toBe(78.45);
  });

  it("1.234,56 é milhar com ponto (nunca parseFloat ingênuo)", () => {
    expect(parseDecimalPtBr("1.234,56")).toBe(1234.56);
    expect(parseDecimalPtBr("1.234.567")).toBe(1234567);
    expect(parseDecimalPtBr("1450")).toBe(1450);
  });

  it("preserva 3 casas e rejeita mais que isso, texto e vazio", () => {
    expect(parseDecimalPtBr("0,125")).toBe(0.125);
    expect(parseDecimalPtBr("78,4567")).toBeNull();
    expect(parseDecimalPtBr("abc")).toBeNull();
    expect(parseDecimalPtBr("")).toBeNull();
    expect(parseDecimalPtBr("1,2,3")).toBeNull();
  });

  it("negativo e zero são números (o range técnico decide depois)", () => {
    expect(parseDecimalPtBr("-1")).toBe(-1);
    expect(parseDecimalPtBr("0")).toBe(0);
  });
});

describe("formatação", () => {
  it("formatMetric usa a unidade e pt-BR sem zeros à direita", () => {
    expect(formatMetric(78.45, "kg")).toBe("78,45 kg");
    expect(formatMetric(165, "cm")).toBe("165 cm");
    expect(formatMetric(28.5, "%")).toBe("28,5%");
    expect(formatMetric(1450, "kcal")).toBe("1.450 kcal");
  });

  it("formatDelta com sinal, unidade e p.p. para percentual (§34)", () => {
    expect(formatDelta(-1.5, "kg")).toBe("−1,5 kg");
    expect(formatDelta(0.5, "kg")).toBe("+0,5 kg");
    expect(formatDelta(0, "kg")).toBe("0 kg");
    expect(formatDelta(-2, "%")).toBe("−2 p.p.");
  });

  it("subtractPrecise evita ruído binário", () => {
    expect(subtractPrecise(78.5, 80)).toBe(-1.5);
    expect(subtractPrecise(0.3, 0.1)).toBe(0.2);
    expect(subtractPrecise(76.9, 78.4)).toBe(-1.5);
  });

  it("toInputValue devolve texto editável e formatDecimalPtBr respeita casas", () => {
    expect(toInputValue(78.45)).toBe("78,45");
    expect(toInputValue(1234.5)).toBe("1234,5");
    expect(toInputValue(null)).toBe("");
    expect(formatDecimalPtBr(27.84, 1)).toBe("27,8");
  });
});
