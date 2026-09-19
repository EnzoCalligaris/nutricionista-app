import { describe, expect, it } from "vitest";
import {
  canHardDelete,
  chartableMetrics,
  compareAssessments,
  deltaBetween,
  isVisibleToPatient,
  latestAndPrevious,
  seriesForMetric,
  sortByDateDesc,
  trendForMetric,
  type AssessmentSummary,
} from "@/domain/assessments/evolution";

const m = (code: string, value: number) => {
  const meta: Record<string, { name: string; unit: string }> = {
    WEIGHT: { name: "Peso", unit: "kg" },
    HEIGHT: { name: "Altura", unit: "cm" },
    BODY_FAT_PCT: { name: "Percentual de gordura", unit: "%" },
    WAIST_CIRCUMFERENCE: { name: "Circunferência da cintura", unit: "cm" },
  };
  return { code, value, ...meta[code]! };
};
const a = (id: string, assessmentDate: string, measurements: ReturnType<typeof m>[], createdAt = "2026-01-01T00:00:00Z"): AssessmentSummary => ({
  id,
  assessmentDate,
  visibleToPatient: true,
  archivedAt: null,
  hasReport: false,
  measurements,
  createdAt,
});

describe("ordenação por assessment_date (§32)", () => {
  it("mais recente primeiro, ignorando created_at (desempate só em datas iguais)", () => {
    const sorted = sortByDateDesc([
      a("old-created-last", "2026-01-10", [], "2026-09-01T00:00:00Z"),
      a("new", "2026-03-01", [], "2026-01-01T00:00:00Z"),
      a("same-day-late", "2026-03-01", [], "2026-03-01T10:00:00Z"),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["same-day-late", "new", "old-created-last"]);
  });

  it("latestAndPrevious", () => {
    const { latest, previous } = latestAndPrevious([a("1", "2026-01-01", []), a("2", "2026-02-01", [])]);
    expect(latest?.id).toBe("2");
    expect(previous?.id).toBe("1");
    expect(latestAndPrevious([]).latest).toBeNull();
  });
});

describe("comparação (§72)", () => {
  it("peso 80 → 78,5 = −1,5 kg; gordura 20 → 18 = −2 p.p.", () => {
    const before = a("A", "2026-01-01", [m("WEIGHT", 80), m("BODY_FAT_PCT", 20)]);
    const after = a("B", "2026-02-01", [m("WEIGHT", 78.5), m("BODY_FAT_PCT", 18)]);
    const rows = compareAssessments(before, after);
    expect(rows.find((row) => row.code === "WEIGHT")).toMatchObject({ from: 80, to: 78.5, delta: -1.5, direction: "DOWN", unit: "kg" });
    expect(rows.find((row) => row.code === "BODY_FAT_PCT")).toMatchObject({ from: 20, to: 18, delta: -2, direction: "DOWN", unit: "%" });
  });

  it("métrica só de um lado fica sem delta; iguais = sem alteração", () => {
    const before = a("A", "2026-01-01", [m("WEIGHT", 80)]);
    const after = a("B", "2026-02-01", [m("WEIGHT", 80), m("WAIST_CIRCUMFERENCE", 90)]);
    const rows = compareAssessments(before, after);
    expect(rows.find((row) => row.code === "WAIST_CIRCUMFERENCE")).toMatchObject({ from: null, to: 90, delta: null, direction: null });
    expect(rows.find((row) => row.code === "WEIGHT")).toMatchObject({ delta: 0, direction: "SAME" });
    expect(deltaBetween(null, 5)).toEqual({ delta: null, direction: null });
  });
});

describe("séries e nulls (§42/§73)", () => {
  const first = a("1", "2026-01-01", [m("WEIGHT", 80)]);
  const second = a("2", "2026-02-01", [m("WEIGHT", 79), m("BODY_FAT_PCT", 18)]);

  it("gráfico de gordura não cria zero para a avaliação sem a métrica", () => {
    expect(seriesForMetric([second, first], "BODY_FAT_PCT")).toEqual([{ date: "2026-02-01", value: 18, assessmentId: "2" }]);
    expect(seriesForMetric([second, first], "WEIGHT").map((point) => point.value)).toEqual([80, 79]);
  });

  it("só métricas com ≥ 2 pontos viram gráfico; altura nunca", () => {
    const third = a("3", "2026-03-01", [m("WEIGHT", 78), m("BODY_FAT_PCT", 17), m("HEIGHT", 170)]);
    const codes = chartableMetrics([first, second, third]).map((metric) => metric.code).sort();
    expect(codes).toEqual(["BODY_FAT_PCT", "WEIGHT"]);
    expect(chartableMetrics([first])).toEqual([]);
  });
});

describe("variação e primeira avaliação (§40–§41)", () => {
  it("compara com a anterior QUE TEM a métrica", () => {
    const list = [a("1", "2026-01-01", [m("WEIGHT", 80), m("BODY_FAT_PCT", 20)]), a("2", "2026-02-01", [m("WEIGHT", 79)]), a("3", "2026-03-01", [m("WEIGHT", 78), m("BODY_FAT_PCT", 18)])];
    expect(trendForMetric(list, "WEIGHT")).toMatchObject({ current: 78, previous: 79, delta: -1, direction: "DOWN", first: false });
    expect(trendForMetric(list, "BODY_FAT_PCT")).toMatchObject({ current: 18, previous: 20, previousDate: "2026-01-01", delta: -2, first: false });
  });

  it("primeira avaliação: sem baseline, nunca 0%", () => {
    const trend = trendForMetric([a("1", "2026-01-01", [m("WEIGHT", 80)])], "WEIGHT");
    expect(trend).toMatchObject({ current: 80, previous: null, delta: null, direction: null, first: true });
    expect(trendForMetric([], "WEIGHT")).toBeNull();
  });
});

describe("visibilidade e exclusão (§18/§29)", () => {
  it("visível = liberada e não arquivada", () => {
    expect(isVisibleToPatient({ visibleToPatient: true, archivedAt: null })).toBe(true);
    expect(isVisibleToPatient({ visibleToPatient: true, archivedAt: "x" })).toBe(false);
    expect(isVisibleToPatient({ visibleToPatient: false, archivedAt: null })).toBe(false);
  });
  it("delete físico só se nunca foi exibida", () => {
    expect(canHardDelete({ publishedAt: null, archivedAt: null })).toBe(true);
    expect(canHardDelete({ publishedAt: "2026-01-01", archivedAt: null })).toBe(false);
    expect(canHardDelete({ publishedAt: null, archivedAt: "2026-01-01" })).toBe(false);
  });
});
