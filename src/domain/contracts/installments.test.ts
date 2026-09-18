import { describe, expect, it } from "vitest";
import {
  generateDueDates,
  generateInstallments,
  MAX_INSTALLMENTS,
  splitAmountCents,
  sumInstallments,
} from "@/domain/contracts/installments";

describe("splitAmountCents — remainder de centavos (prompt Fase 5 §38/§64)", () => {
  it("60000 / 3 = 20000, 20000, 20000", () => {
    expect(splitAmountCents(60000, 3)).toEqual([20000, 20000, 20000]);
  });

  it("100000 / 3 = 33334, 33333, 33333", () => {
    expect(splitAmountCents(100000, 3)).toEqual([33334, 33333, 33333]);
  });

  it("100 / 3 = 34, 33, 33", () => {
    expect(splitAmountCents(100, 3)).toEqual([34, 33, 33]);
  });

  it("R$ 1.000 / 3 = 333,34 + 333,33 + 333,33", () => {
    expect(splitAmountCents(100000, 3)).toEqual([33334, 33333, 33333]);
  });

  it("nunca perde centavo: a soma é sempre idêntica ao total", () => {
    const cases: [number, number][] = [
      [68037, 3],
      [128760, 6],
      [252396, 12],
      [1, 5],
      [0, 4],
      [99999, 7],
      [23000, 1],
      [1234567, 24],
    ];
    for (const [total, count] of cases) {
      const parts = splitAmountCents(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
      // Diferença máxima de 1 centavo entre parcelas; as maiores vêm primeiro.
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      expect([...parts].sort((a, b) => b - a)).toEqual(parts);
    }
  });

  it("rejeita entradas inválidas", () => {
    expect(() => splitAmountCents(-1, 3)).toThrow(RangeError);
    expect(() => splitAmountCents(100.5, 3)).toThrow(RangeError);
    expect(() => splitAmountCents(100, 0)).toThrow(RangeError);
    expect(() => splitAmountCents(100, 1.5)).toThrow(RangeError);
  });
});

describe("generateDueDates — dia 31 e fevereiro (prompt Fase 5 §39/§65)", () => {
  it("31/01 -> 28/02 -> 31/03 -> 30/04", () => {
    expect(generateDueDates("2026-01-31", 4)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("31/01 em ano bissexto -> 29/02", () => {
    expect(generateDueDates("2028-01-31", 3)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("dia 30 e dia 29", () => {
    expect(generateDueDates("2026-01-30", 3)).toEqual(["2026-01-30", "2026-02-28", "2026-03-30"]);
    expect(generateDueDates("2026-01-29", 3)).toEqual(["2026-01-29", "2026-02-28", "2026-03-29"]);
  });

  it("dia 28 nunca muda", () => {
    expect(generateDueDates("2026-01-28", 3)).toEqual(["2026-01-28", "2026-02-28", "2026-03-28"]);
  });

  it("atravessa o ano", () => {
    expect(generateDueDates("2026-11-30", 4)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"]);
  });

  it("rejeita data inválida", () => {
    expect(() => generateDueDates("2026-02-30", 2)).toThrow(RangeError);
  });
});

describe("generateInstallments", () => {
  it("combina numeração 1..n, valores e vencimentos", () => {
    const installments = generateInstallments({ totalCents: 68037, count: 3, firstDueDate: "2026-01-31" });
    expect(installments).toEqual([
      { number: 1, amount_cents: 22679, due_date: "2026-01-31" },
      { number: 2, amount_cents: 22679, due_date: "2026-02-28" },
      { number: 3, amount_cents: 22679, due_date: "2026-03-31" },
    ]);
    expect(sumInstallments(installments)).toBe(68037);
  });

  it("parcela única = valor integral no primeiro vencimento", () => {
    expect(generateInstallments({ totalCents: 23000, count: 1, firstDueDate: "2026-09-18" })).toEqual([
      { number: 1, amount_cents: 23000, due_date: "2026-09-18" },
    ]);
  });

  it("limite de parcelas é exposto para o validador", () => {
    expect(MAX_INSTALLMENTS).toBeGreaterThanOrEqual(12);
  });
});
