import { describe, expect, it } from "vitest";
import { computeAverageTicket } from "@/domain/patients/metrics";

describe("computeAverageTicket (recebido no período ÷ pacientes pagantes)", () => {
  it("sem pagamentos => R$ 0,00, nunca NaN/Infinity", () => {
    const result = computeAverageTicket([]);
    expect(result).toEqual({ averageCents: 0, receivedCents: 0, payingPatients: 0 });
    expect(Number.isFinite(result.averageCents)).toBe(true);
  });

  it("agrupa vários pagamentos do mesmo paciente como um pagante", () => {
    const result = computeAverageTicket([
      { patient_id: "a", amount_cents: 22679 },
      { patient_id: "a", amount_cents: 22679 },
      { patient_id: "b", amount_cents: 21460 },
    ]);
    expect(result.payingPatients).toBe(2);
    expect(result.receivedCents).toBe(66818);
    expect(result.averageCents).toBe(33409);
  });

  it("arredonda para o centavo mais próximo", () => {
    const result = computeAverageTicket([
      { patient_id: "a", amount_cents: 100 },
      { patient_id: "b", amount_cents: 100 },
      { patient_id: "c", amount_cents: 101 },
    ]);
    expect(result.averageCents).toBe(100); // 301/3 = 100,33
  });

  it("ignora valores não positivos (zero não conta como pagante)", () => {
    const result = computeAverageTicket([
      { patient_id: "a", amount_cents: 0 },
      { patient_id: "b", amount_cents: 5000 },
    ]);
    expect(result.payingPatients).toBe(1);
    expect(result.averageCents).toBe(5000);
  });
});
