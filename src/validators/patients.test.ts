import { describe, expect, it } from "vitest";
import {
  createPatientSchema,
  patientIdSchema,
  patientListQuerySchema,
  updatePatientSchema,
} from "@/validators/patients";

describe("createPatientSchema", () => {
  it("aceita o mínimo (nome) e normaliza vazios para null", () => {
    const result = createPatientSchema.safeParse({ fullName: "  Maria Silva ", email: "", phone: "", birthDate: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ fullName: "Maria Silva", email: null, phone: null, birthDate: null, sendInvite: false });
    }
  });

  it("normaliza e-mail para minúsculas", () => {
    const result = createPatientSchema.safeParse({ fullName: "Maria", email: "  Maria@Example.TEST " });
    expect(result.success && result.data.email).toBe("maria@example.test");
  });

  it("rejeita nome curto, e-mail inválido, telefone inválido e data futura", () => {
    expect(createPatientSchema.safeParse({ fullName: "M" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ fullName: "Maria", email: "nao-e-email" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ fullName: "Maria", phone: "abc" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ fullName: "Maria", birthDate: "2999-01-01" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ fullName: "Maria", birthDate: "2026-02-30" }).success).toBe(false);
    expect(createPatientSchema.safeParse({ fullName: "Maria", birthDate: "1899-12-31" }).success).toBe(false);
  });

  it("convite exige e-mail", () => {
    const result = createPatientSchema.safeParse({ fullName: "Maria", email: "", sendInvite: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
    expect(createPatientSchema.safeParse({ fullName: "Maria", email: "m@example.test", sendInvite: true }).success).toBe(true);
  });

  it("ignora campos que não pertencem ao schema (mass assignment)", () => {
    const result = createPatientSchema.safeParse({
      fullName: "Maria",
      nutritionist_id: "x",
      profile_id: "y",
      role: "NUTRITIONIST",
      status: "INACTIVE",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Só as chaves do schema sobrevivem (opcionais ausentes não são criadas).
      for (const key of Object.keys(result.data)) {
        expect(["birthDate", "email", "fullName", "phone", "sendInvite"]).toContain(key);
      }
      expect("nutritionist_id" in result.data).toBe(false);
      expect("role" in result.data).toBe(false);
      expect("status" in result.data).toBe(false);
    }
  });
});

describe("updatePatientSchema", () => {
  it("não aceita alterar vínculos internos", () => {
    const result = updatePatientSchema.safeParse({ fullName: "Maria", profile_id: "abc", nutritionist_id: "def" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("profile_id" in result.data).toBe(false);
      expect("nutritionist_id" in result.data).toBe(false);
    }
  });
});

describe("patientListQuerySchema", () => {
  it("aplica defaults seguros a valores inválidos", () => {
    expect(patientListQuerySchema.parse({})).toEqual({ q: undefined, status: "all", page: 1, pageSize: 20 });
    expect(patientListQuerySchema.parse({ status: "x", page: "-3", pageSize: "9999" })).toEqual({
      q: undefined,
      status: "all",
      page: 1,
      pageSize: 20,
    });
    expect(patientListQuerySchema.parse({ q: " joao ", status: "active", page: "2", pageSize: "10" })).toEqual({
      q: "joao",
      status: "active",
      page: 2,
      pageSize: 10,
    });
  });
});

describe("patientIdSchema", () => {
  it("aceita UUIDs (inclusive os do seed, que não seguem a versão RFC) e rejeita o resto", () => {
    expect(patientIdSchema.safeParse("90000000-0000-0000-0000-000000000010").success).toBe(true);
    expect(patientIdSchema.safeParse("c0a80101-0000-4000-8000-000000000000").success).toBe(true);
    expect(patientIdSchema.safeParse("1").success).toBe(false);
    expect(patientIdSchema.safeParse("' or 1=1 --").success).toBe(false);
  });
});
