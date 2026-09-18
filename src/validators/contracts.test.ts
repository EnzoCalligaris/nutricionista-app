import { describe, expect, it } from "vitest";
import { createContractSchema, contractIdSchema } from "@/validators/contracts";

const valid = {
  planId: "90000000-0000-0000-0000-000000000001",
  planPriceId: "",
  startDate: "2026-09-18",
  endDate: "2026-12-18",
  contractedAmountCents: 68037,
  installmentsCount: 3,
  firstDueDate: "2026-09-18",
  notes: "",
};

describe("createContractSchema", () => {
  it("aceita um contrato válido e normaliza opcionais", () => {
    const result = createContractSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planPriceId).toBeNull();
      expect(result.data.notes).toBeNull();
      expect(result.data.endDate).toBe("2026-12-18");
    }
  });

  it("aceita término vazio (contrato sem data de fim)", () => {
    const result = createContractSchema.safeParse({ ...valid, endDate: "" });
    expect(result.success && result.data.endDate).toBeNull();
  });

  it("rejeita término anterior ao início", () => {
    const result = createContractSchema.safeParse({ ...valid, endDate: "2026-09-17" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejeita parcelamento inválido", () => {
    expect(createContractSchema.safeParse({ ...valid, installmentsCount: 0 }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, installmentsCount: 25 }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, installmentsCount: 1.5 }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, contractedAmountCents: -1 }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, contractedAmountCents: Number.NaN }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, firstDueDate: "2026-02-30" }).success).toBe(false);
  });

  it("rejeita ids malformados", () => {
    expect(createContractSchema.safeParse({ ...valid, planId: "1" }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...valid, planPriceId: "abc" }).success).toBe(false);
    expect(contractIdSchema.safeParse("nope").success).toBe(false);
  });

  it("não aceita status, patient_id ou contracted_amount vindo do client (mass assignment)", () => {
    const result = createContractSchema.safeParse({ ...valid, status: "COMPLETED", patient_id: "x", patientId: "y" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("status" in result.data).toBe(false);
      expect("patient_id" in result.data).toBe(false);
      expect("patientId" in result.data).toBe(false);
    }
  });
});
