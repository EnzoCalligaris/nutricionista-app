import { describe, expect, it } from "vitest";
import {
  canArchivePatient,
  canReactivatePatient,
  derivePatientStatus,
  isEffectivelyActive,
  parsePatientListFilter,
} from "@/domain/patients/status";

describe("derivePatientStatus (regra da Fase 2: status ACTIVE + contrato ACTIVE)", () => {
  it("ativo só com status manual ACTIVE e contrato vigente", () => {
    expect(derivePatientStatus({ patient_status: "ACTIVE", has_active_contract: true })).toBe("ACTIVE");
    expect(isEffectivelyActive({ patient_status: "ACTIVE", has_active_contract: true })).toBe(true);
  });

  it("cadastro ativo sem contrato vigente é NO_CONTRACT e não conta como ativo", () => {
    expect(derivePatientStatus({ patient_status: "ACTIVE", has_active_contract: false })).toBe("NO_CONTRACT");
    expect(isEffectivelyActive({ patient_status: "ACTIVE", has_active_contract: false })).toBe(false);
  });

  it("override administrativo INACTIVE vence mesmo com contrato ativo", () => {
    expect(derivePatientStatus({ patient_status: "INACTIVE", has_active_contract: true })).toBe("INACTIVE");
    expect(isEffectivelyActive({ patient_status: "INACTIVE", has_active_contract: true })).toBe(false);
  });
});

describe("ações por status manual", () => {
  it("desativar só quando ACTIVE; reativar só quando INACTIVE", () => {
    expect(canArchivePatient("ACTIVE")).toBe(true);
    expect(canArchivePatient("INACTIVE")).toBe(false);
    expect(canReactivatePatient("INACTIVE")).toBe(true);
    expect(canReactivatePatient("ACTIVE")).toBe(false);
  });
});

describe("parsePatientListFilter", () => {
  it("aceita só os valores conhecidos, default all", () => {
    expect(parsePatientListFilter("active")).toBe("active");
    expect(parsePatientListFilter("inactive")).toBe("inactive");
    expect(parsePatientListFilter("all")).toBe("all");
    expect(parsePatientListFilter("hacker")).toBe("all");
    expect(parsePatientListFilter(undefined)).toBe("all");
  });
});
