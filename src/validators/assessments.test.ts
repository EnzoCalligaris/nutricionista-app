import { describe, expect, it } from "vitest";
import { assessmentSchema, measurementInputSchema, refineNotFuture, reportFileSchema } from "@/validators/assessments";

const TODAY = "2026-09-19";

describe("assessmentSchema", () => {
  const valid = { assessmentDate: "2026-09-18", measurements: [{ code: "WEIGHT", value: 78.45 }] };

  it("aceita avaliação mínima e normaliza observações vazias", () => {
    const parsed = refineNotFuture(assessmentSchema, TODAY).parse({ ...valid, notes: "", internalNotes: "  " });
    expect(parsed.notes).toBeNull();
    expect(parsed.internalNotes).toBeNull();
    expect(parsed.visibleToPatient).toBe(false);
    expect(parsed.measurements[0]!.value).toBe(78.45);
  });

  it("data futura é recusada (§77); hoje é aceito", () => {
    expect(refineNotFuture(assessmentSchema, TODAY).safeParse({ ...valid, assessmentDate: "2026-09-20" }).success).toBe(false);
    expect(refineNotFuture(assessmentSchema, TODAY).safeParse({ ...valid, assessmentDate: TODAY }).success).toBe(true);
    expect(assessmentSchema.safeParse({ ...valid, assessmentDate: "2026-02-30" }).success).toBe(false);
  });

  it("aceita zero medidas (dados parciais — §11) e recusa métrica repetida", () => {
    expect(assessmentSchema.safeParse({ assessmentDate: "2026-09-18", measurements: [] }).success).toBe(true);
    expect(assessmentSchema.safeParse({ ...valid, measurements: [{ code: "WEIGHT", value: 1 }, { code: "WEIGHT", value: 2 }] }).success).toBe(false);
  });
});

describe("measurementInputSchema", () => {
  it("valor > 0 e código em maiúsculas", () => {
    expect(measurementInputSchema.safeParse({ code: "WEIGHT", value: 0 }).success).toBe(false);
    expect(measurementInputSchema.safeParse({ code: "WEIGHT", value: -1 }).success).toBe(false);
    expect(measurementInputSchema.safeParse({ code: "WEIGHT", value: Number.NaN }).success).toBe(false);
    expect(measurementInputSchema.safeParse({ code: "weight", value: 1 }).success).toBe(false);
    expect(measurementInputSchema.safeParse({ code: "WAIST_CIRCUMFERENCE", value: 92 }).success).toBe(true);
  });
});

describe("reportFileSchema (§19/§22)", () => {
  it("só PDF/JPG/PNG até 10 MB, nunca vazio", () => {
    expect(reportFileSchema.safeParse({ name: "r.pdf", type: "application/pdf", size: 1024 }).success).toBe(true);
    expect(reportFileSchema.safeParse({ name: "r.png", type: "image/png", size: 1024 }).success).toBe(true);
    expect(reportFileSchema.safeParse({ name: "r.exe", type: "application/octet-stream", size: 1024 }).success).toBe(false);
    expect(reportFileSchema.safeParse({ name: "r.pdf", type: "application/pdf", size: 0 }).success).toBe(false);
    expect(reportFileSchema.safeParse({ name: "r.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});
