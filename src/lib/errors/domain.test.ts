import { describe, expect, it } from "vitest";
import { DomainError, domainErrorFromDatabase, domainErrorMessage, isDomainError } from "@/lib/errors/domain";

describe("DomainError", () => {
  it("carrega código e mensagem amigável", () => {
    const error = new DomainError("PATIENT_NOT_FOUND");
    expect(isDomainError(error)).toBe(true);
    expect(error.code).toBe("PATIENT_NOT_FOUND");
    expect(error.message).toBe(domainErrorMessage("PATIENT_NOT_FOUND"));
    expect(isDomainError(new Error("x"))).toBe(false);
  });
});

describe("domainErrorFromDatabase", () => {
  it("reconhece os códigos lançados pelas funções SQL da Fase 5", () => {
    expect(domainErrorFromDatabase({ message: "INVALID_INSTALLMENTS" }).code).toBe("INVALID_INSTALLMENTS");
    expect(domainErrorFromDatabase({ message: "PLAN_NOT_AVAILABLE" }).code).toBe("PLAN_NOT_AVAILABLE");
    expect(domainErrorFromDatabase({ message: "CONTRACT_NOT_FOUND" }).code).toBe("CONTRACT_NOT_FOUND");
    expect(domainErrorFromDatabase({ message: "INVALID_STATUS_TRANSITION" }).code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("mapeia o índice único de e-mail por nutricionista", () => {
    const error = domainErrorFromDatabase({
      code: "23505",
      message: 'duplicate key value violates unique constraint "patients_nutritionist_email_unique_idx"',
    });
    expect(error.code).toBe("PATIENT_EMAIL_ALREADY_EXISTS");
  });

  it("nunca repassa a mensagem crua do banco", () => {
    const error = domainErrorFromDatabase({ code: "42P01", message: 'relation "secret_table" does not exist' });
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).not.toContain("secret_table");
    expect(domainErrorFromDatabase(null).code).toBe("UNKNOWN");
  });
});
