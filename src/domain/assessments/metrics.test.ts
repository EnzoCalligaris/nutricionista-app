import { describe, expect, it } from "vitest";
import { computeBmi, groupMetricTypes, inferKind, metricGroup, shortMetricName, sortMetricTypes, validateMetricValue } from "@/domain/assessments/metrics";

describe("ranges técnicos (§50/§78–§79)", () => {
  it("peso 0, negativo e NaN recusados; qualquer positivo aceito (sem limite clínico)", () => {
    expect(validateMetricValue(0, "kg")).toBe("NOT_POSITIVE");
    expect(validateMetricValue(-5, "kg")).toBe("NOT_POSITIVE");
    expect(validateMetricValue(Number.NaN, "kg")).toBe("NOT_A_NUMBER");
    expect(validateMetricValue(0.5, "kg")).toBe("OK");
    expect(validateMetricValue(300, "kg")).toBe("OK");
  });

  it("percentual: −1 e 101 recusados, 100 aceito", () => {
    expect(validateMetricValue(-1, "%")).toBe("NOT_POSITIVE");
    expect(validateMetricValue(101, "%")).toBe("PERCENT_OVER_100");
    expect(validateMetricValue(100, "%")).toBe("OK");
    expect(validateMetricValue(28.5, "%")).toBe("OK");
  });

  it("limite técnico do numeric(10,3)", () => {
    expect(validateMetricValue(10_000_000, "kcal")).toBe("TOO_LARGE");
  });
});

describe("IMC derivado (§9)", () => {
  it("peso 78,4 / altura 165 → 28,8; null quando falta um lado", () => {
    expect(computeBmi(78.4, 165)).toBe(28.8);
    expect(computeBmi(78.4, null)).toBeNull();
    expect(computeBmi(null, 165)).toBeNull();
    expect(computeBmi(78.4, 0)).toBeNull();
  });
});

describe("seleção e agrupamento de métricas", () => {
  const types = [
    { code: "HIP_CIRCUMFERENCE", name: "Circunferência do quadril" },
    { code: "WEIGHT", name: "Peso" },
    { code: "BODY_FAT_PCT", name: "Percentual de gordura" },
    { code: "HEIGHT", name: "Altura" },
    { code: "CUSTOM_X", name: "Zeta" },
  ];
  it("grupos: básicos, composição, medidas; desconhecidos caem em composição", () => {
    expect(metricGroup("WEIGHT")).toBe("BASIC");
    expect(metricGroup("HIP_CIRCUMFERENCE")).toBe("CIRCUMFERENCE");
    expect(metricGroup("CUSTOM_X")).toBe("COMPOSITION");
    const groups = groupMetricTypes(types);
    expect(groups.BASIC.map((t) => t.code)).toEqual(["WEIGHT", "HEIGHT"]);
    expect(groups.COMPOSITION.map((t) => t.code)).toEqual(["BODY_FAT_PCT", "CUSTOM_X"]);
    expect(groups.CIRCUMFERENCE.map((t) => t.code)).toEqual(["HIP_CIRCUMFERENCE"]);
  });
  it("ordem de exibição conhecida primeiro, depois por nome", () => {
    expect(sortMetricTypes(types).map((t) => t.code)).toEqual(["WEIGHT", "HEIGHT", "BODY_FAT_PCT", "HIP_CIRCUMFERENCE", "CUSTOM_X"]);
  });
  it("rótulo curto das circunferências", () => {
    expect(shortMetricName("Circunferência da cintura")).toBe("Cintura");
    expect(shortMetricName("Circunferência do abdômen")).toBe("Abdômen");
    expect(shortMetricName("Peso")).toBe("Peso");
  });
  it("tipo derivado das métricas (sem enum novo — §6)", () => {
    expect(inferKind(["WEIGHT", "BODY_FAT_PCT"])).toBe("BIOIMPEDANCE");
    expect(inferKind(["WEIGHT", "WAIST_CIRCUMFERENCE"])).toBe("ANTHROPOMETRY");
    expect(inferKind(["WEIGHT"])).toBe("GENERAL");
  });
});
