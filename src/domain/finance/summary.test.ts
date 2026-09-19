import { describe, expect, it } from "vitest";
import { computeBalance, sumContractFinancials, totalForecast } from "@/domain/finance/summary";
import { isTransactionCancellable, isTransactionEditable, presentTransactionStatus } from "@/domain/finance/definitions";

describe("computeBalance", () => {
  it("saldo = receita − despesa (pode ser negativo)", () => {
    expect(computeBalance(165417, 135000)).toBe(30417);
    expect(computeBalance(0, 5000)).toBe(-5000);
  });
});

describe("previsão por contrato (§89–§90)", () => {
  // Contrato de R$ 1.200 em 6x com 2 parcelas pagas => contratado 1200,
  // recebido 400, pendente 800, previsto 800.
  const active = { contractStatus: "ACTIVE" as const, contractedCents: 120000, receivedCents: 40000, pendingCents: 80000, forecastCents: 80000 };
  const cancelled = { contractStatus: "CANCELLED" as const, contractedCents: 68037, receivedCents: 22679, pendingCents: 0, forecastCents: 0 };

  it("soma os contratos do paciente", () => {
    expect(sumContractFinancials([active, cancelled])).toEqual({ contractedCents: 188037, receivedCents: 62679, pendingCents: 80000, forecastCents: 80000 });
  });

  it("contrato cancelado não gera previsão", () => {
    expect(totalForecast([active, cancelled])).toBe(80000);
    expect(totalForecast([cancelled])).toBe(0);
  });
});

describe("status de lançamento apresentado (§70)", () => {
  it("deriva atrasado de pendente com vencimento passado", () => {
    expect(presentTransactionStatus("PENDING", "2026-09-17", "2026-09-18")).toBe("OVERDUE");
    expect(presentTransactionStatus("PENDING", "2026-09-18", "2026-09-18")).toBe("PENDING");
    expect(presentTransactionStatus("PENDING", null, "2026-09-18")).toBe("PENDING");
    expect(presentTransactionStatus("CONFIRMED", "2026-01-01", "2026-09-18")).toBe("PAID");
    expect(presentTransactionStatus("CANCELLED", null, "2026-09-18")).toBe("CANCELLED");
  });
});

describe("edição/cancelamento de lançamentos (§18)", () => {
  it("só lançamentos manuais não cancelados são editáveis", () => {
    expect(isTransactionEditable("MANUAL", "CONFIRMED")).toBe(true);
    expect(isTransactionEditable("MANUAL", "PENDING")).toBe(true);
    expect(isTransactionEditable("MANUAL", "CANCELLED")).toBe(false);
    expect(isTransactionEditable("PAYMENT", "CONFIRMED")).toBe(false);
    expect(isTransactionCancellable("PAYMENT", "CONFIRMED")).toBe(false);
    expect(isTransactionCancellable("MANUAL", "CONFIRMED")).toBe(true);
  });
});
