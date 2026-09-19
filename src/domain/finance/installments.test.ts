import { describe, expect, it } from "vitest";
import { allocatePayment, computeInstallmentBalance, nextDueInstallment } from "@/domain/finance/installments";

const TODAY = "2026-09-18";

describe("computeInstallmentBalance", () => {
  it("parcela sem pagamento e no prazo fica pendente", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 0, status: "PENDING", dueDate: "2026-10-09" }, TODAY);
    expect(balance).toEqual({ receivedCents: 0, remainingCents: 20000, uiStatus: "PENDING", payable: true });
  });

  it("parcela vencida sem pagamento aparece em atraso (derivado, não gravado)", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 0, status: "PENDING", dueDate: "2026-09-17" }, TODAY);
    expect(balance.uiStatus).toBe("OVERDUE");
    expect(balance.payable).toBe(true);
  });

  it("vencimento no próprio dia ainda não está em atraso", () => {
    expect(computeInstallmentBalance({ amountCents: 100, receivedCents: 0, status: "PENDING", dueDate: TODAY }, TODAY).uiStatus).toBe("PENDING");
  });

  it("pagamento parcial: R$ 200 com R$ 50 pagos => restante R$ 150 e status parcial (§79)", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 5000, status: "PENDING", dueDate: "2026-09-01" }, TODAY);
    expect(balance.remainingCents).toBe(15000);
    expect(balance.uiStatus).toBe("PARTIAL");
    expect(balance.payable).toBe(true);
  });

  it("pagamento total quita a parcela (§80)", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 20000, status: "PENDING", dueDate: "2026-10-09" }, TODAY);
    expect(balance).toEqual({ receivedCents: 20000, remainingCents: 0, uiStatus: "PAID", payable: false });
  });

  it("parcela marcada PAID tem restante 0 mesmo sem pagamentos vinculados (seed/histórico)", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 0, status: "PAID", dueDate: "2026-01-01" }, TODAY);
    expect(balance.remainingCents).toBe(0);
    expect(balance.uiStatus).toBe("PAID");
  });

  it("parcela cancelada nunca é pagável", () => {
    const balance = computeInstallmentBalance({ amountCents: 20000, receivedCents: 0, status: "CANCELLED", dueDate: "2026-01-01" }, TODAY);
    expect(balance).toEqual({ receivedCents: 0, remainingCents: 0, uiStatus: "CANCELLED", payable: false });
  });
});

describe("allocatePayment", () => {
  const open = computeInstallmentBalance({ amountCents: 20000, receivedCents: 5000, status: "PENDING", dueDate: "2026-10-09" }, TODAY);

  it("aceita parcial e informa o restante", () => {
    expect(allocatePayment(open, 5000)).toEqual({ ok: true, fullyPaid: false, remainingAfter: 10000 });
  });

  it("aceita o valor exato do restante e quita", () => {
    expect(allocatePayment(open, 15000)).toEqual({ ok: true, fullyPaid: true, remainingAfter: 0 });
  });

  it("bloqueia pagamento a maior (R$ 201 em parcela de R$ 200 — §81)", () => {
    const fresh = computeInstallmentBalance({ amountCents: 20000, receivedCents: 0, status: "PENDING", dueDate: "2026-10-09" }, TODAY);
    expect(allocatePayment(fresh, 20100)).toEqual({ ok: false, reason: "EXCEEDS_INSTALLMENT" });
    expect(allocatePayment(open, 15001)).toEqual({ ok: false, reason: "EXCEEDS_INSTALLMENT" });
  });

  it("rejeita valor zero, negativo ou não inteiro", () => {
    expect(allocatePayment(open, 0)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
    expect(allocatePayment(open, -100)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
    expect(allocatePayment(open, 10.5)).toEqual({ ok: false, reason: "INVALID_AMOUNT" });
  });

  it("recusa parcela já paga ou cancelada", () => {
    const paid = computeInstallmentBalance({ amountCents: 100, receivedCents: 100, status: "PENDING", dueDate: "2026-10-09" }, TODAY);
    expect(allocatePayment(paid, 1)).toEqual({ ok: false, reason: "NOT_PAYABLE" });
  });
});

describe("nextDueInstallment", () => {
  it("devolve a parcela aberta com vencimento mais próximo, ignorando pagas e canceladas", () => {
    const next = nextDueInstallment([
      { id: "c", dueDate: "2026-12-08", status: "PENDING", remainingCents: 100 },
      { id: "a", dueDate: "2026-08-10", status: "PAID", remainingCents: 0 },
      { id: "b", dueDate: "2026-10-09", status: "PENDING", remainingCents: 100 },
      { id: "x", dueDate: "2026-07-01", status: "CANCELLED", remainingCents: 0 },
    ]);
    expect(next?.id).toBe("b");
  });

  it("devolve null quando não há parcela em aberto", () => {
    expect(nextDueInstallment([{ dueDate: "2026-08-10", status: "PAID", remainingCents: 0 }])).toBeNull();
  });
});
