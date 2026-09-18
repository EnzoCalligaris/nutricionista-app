import { describe, expect, it } from "vitest";
import {
  canCancelContract,
  canCompleteContract,
  CONTRACT_STATUS_LABEL,
  INSTALLMENT_STATUS_LABEL,
  presentInstallmentStatus,
} from "@/domain/contracts/status";
import { suggestEndDate } from "@/domain/contracts/dates";

describe("mapeamento de status (enums reais do banco)", () => {
  it("contract_status -> rótulo", () => {
    expect(CONTRACT_STATUS_LABEL).toEqual({ ACTIVE: "Ativo", COMPLETED: "Encerrado", CANCELLED: "Cancelado" });
  });

  it("installment_status -> rótulo", () => {
    expect(INSTALLMENT_STATUS_LABEL).toEqual({
      PENDING: "Pendente",
      PAID: "Paga",
      OVERDUE: "Em atraso",
      CANCELLED: "Cancelada",
    });
  });

  it("cancelar/encerrar só a partir de ACTIVE", () => {
    expect(canCancelContract("ACTIVE")).toBe(true);
    expect(canCancelContract("COMPLETED")).toBe(false);
    expect(canCancelContract("CANCELLED")).toBe(false);
    expect(canCompleteContract("ACTIVE")).toBe(true);
    expect(canCompleteContract("CANCELLED")).toBe(false);
  });
});

describe("presentInstallmentStatus", () => {
  it("PENDING vencida aparece como OVERDUE sem alterar o banco", () => {
    expect(presentInstallmentStatus("PENDING", "2026-09-01", "2026-09-18")).toBe("OVERDUE");
    expect(presentInstallmentStatus("PENDING", "2026-09-18", "2026-09-18")).toBe("PENDING");
    expect(presentInstallmentStatus("PENDING", "2026-10-01", "2026-09-18")).toBe("PENDING");
  });

  it("outros status passam intactos", () => {
    expect(presentInstallmentStatus("PAID", "2026-01-01", "2026-09-18")).toBe("PAID");
    expect(presentInstallmentStatus("CANCELLED", "2026-01-01", "2026-09-18")).toBe("CANCELLED");
  });
});

describe("suggestEndDate (prompt Fase 5 §33)", () => {
  it("TRIMESTRAL +3, SEMESTRAL +6, ANUAL +12 meses", () => {
    expect(suggestEndDate("2026-01-15", 3)).toBe("2026-04-15");
    expect(suggestEndDate("2026-01-15", 6)).toBe("2026-07-15");
    expect(suggestEndDate("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("usa o clamp de fim de mês", () => {
    expect(suggestEndDate("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("AVULSA (sem duração) não ganha duração artificial", () => {
    expect(suggestEndDate("2026-09-18", null)).toBe("2026-09-18");
    expect(suggestEndDate("2026-09-18", 0)).toBe("2026-09-18");
  });
});
