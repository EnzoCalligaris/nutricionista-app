import { describe, expect, it } from "vitest";
import { manualTransactionSchema, recordPaymentSchema, transactionListQuerySchema } from "@/validators/finance";
import { parseBRLToCents } from "@/lib/money";
import { MAX_AMOUNT_CENTS } from "@/domain/finance/definitions";

const GUID = "90000000-0000-0000-0000-000000000010";

describe("manualTransactionSchema", () => {
  const valid = { description: "Aluguel", type: "EXPENSE", amountCents: 120000, occurredOn: "2026-09-18", status: "CONFIRMED" };

  it("aceita lançamento mínimo e normaliza opcionais vazios", () => {
    const parsed = manualTransactionSchema.parse({ ...valid, categoryId: "", dueOn: "", notes: "  ", patientId: "" });
    expect(parsed.categoryId).toBeNull();
    expect(parsed.dueOn).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.patientId).toBeNull();
  });

  it("rejeita valor zero, negativo, não inteiro e acima do limite (§107–§109)", () => {
    for (const amountCents of [0, -1, 10.5, MAX_AMOUNT_CENTS + 1, Number.NaN]) {
      const result = manualTransactionSchema.safeParse({ ...valid, amountCents });
      expect(result.success, String(amountCents)).toBe(false);
      expect(result.success ? [] : result.error.issues.map((issue) => issue.path[0])).toContain("amountCents");
    }
  });

  it("rejeita vencimento anterior à data e datas inválidas", () => {
    expect(manualTransactionSchema.safeParse({ ...valid, dueOn: "2026-09-17" }).success).toBe(false);
    expect(manualTransactionSchema.safeParse({ ...valid, occurredOn: "2026-02-30" }).success).toBe(false);
    expect(manualTransactionSchema.safeParse({ ...valid, dueOn: "2026-10-01" }).success).toBe(true);
  });

  it("rejeita tipo, status e ids inválidos", () => {
    expect(manualTransactionSchema.safeParse({ ...valid, type: "TRANSFER" }).success).toBe(false);
    expect(manualTransactionSchema.safeParse({ ...valid, status: "CANCELLED" }).success).toBe(false);
    expect(manualTransactionSchema.safeParse({ ...valid, patientId: "abc" }).success).toBe(false);
    expect(manualTransactionSchema.safeParse({ ...valid, patientId: GUID }).success).toBe(true);
  });

  it("entrada humana de valor vira centavos antes do schema", () => {
    expect(parseBRLToCents("230")).toBe(23000);
    expect(parseBRLToCents("230,00")).toBe(23000);
    expect(parseBRLToCents("1.080,00")).toBe(108000);
    expect(parseBRLToCents("0,01")).toBe(1);
    expect(parseBRLToCents("10,00")).toBe(1000);
    expect(parseBRLToCents("1.234,56")).toBe(123456);
  });
});

describe("recordPaymentSchema", () => {
  const valid = { patientId: GUID, amountCents: 22679, method: "PIX", paidOn: "2026-09-18", idempotencyKey: "0f2a4b8c-1d2e-4f30-9a1b-2c3d4e5f6a7b" };

  it("aceita pagamento avulso e com parcela", () => {
    expect(recordPaymentSchema.safeParse(valid).success).toBe(true);
    expect(recordPaymentSchema.safeParse({ ...valid, installmentId: GUID, contractId: GUID }).success).toBe(true);
  });

  it("exige paciente, método válido, data válida e chave de idempotência", () => {
    expect(recordPaymentSchema.safeParse({ ...valid, patientId: "" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...valid, method: "BOLETO" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...valid, paidOn: "18/09/2026" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...valid, idempotencyKey: "x" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
  });
});

describe("transactionListQuerySchema", () => {
  it("aplica padrões seguros a valores ausentes ou inválidos", () => {
    const parsed = transactionListQuerySchema.parse({ periodo: "nope", tipo: "X", status: "Y", metodo: "Z", page: "0", pageSize: "999", categoria: "abc", q: "   " });
    expect(parsed).toMatchObject({ periodo: "this_month", tipo: "all", status: "all", metodo: "all", page: 1, pageSize: 20, categoria: undefined, q: undefined });
  });

  it("mantém filtros válidos", () => {
    const parsed = transactionListQuerySchema.parse({ periodo: "custom", de: "2026-01-01", ate: "2026-01-31", tipo: "INCOME", status: "OVERDUE", metodo: "PIX", page: "2", categoria: GUID, q: "Fulana" });
    expect(parsed).toMatchObject({ periodo: "custom", de: "2026-01-01", ate: "2026-01-31", tipo: "INCOME", status: "OVERDUE", metodo: "PIX", page: 2, categoria: GUID, q: "Fulana" });
  });
});
