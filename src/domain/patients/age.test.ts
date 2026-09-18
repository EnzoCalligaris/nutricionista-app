import { describe, expect, it } from "vitest";
import { calculateAge, formatAge } from "@/domain/patients/age";

describe("calculateAge", () => {
  it("calcula a idade a partir de birth_date sem armazená-la", () => {
    expect(calculateAge("1992-03-14", "2026-09-18")).toBe(34);
    expect(calculateAge("1988-07-22", "2026-09-18")).toBe(38);
  });

  it("só completa o ano no dia do aniversário", () => {
    expect(calculateAge("2000-09-18", "2026-09-17")).toBe(25);
    expect(calculateAge("2000-09-18", "2026-09-18")).toBe(26);
    expect(calculateAge("2000-09-18", "2026-09-19")).toBe(26);
  });

  it("nascido em 29/02 faz aniversário em 01/03 nos anos não bissextos", () => {
    expect(calculateAge("2000-02-29", "2026-02-28")).toBe(25);
    expect(calculateAge("2000-02-29", "2026-03-01")).toBe(26);
  });

  it("devolve null sem data, com data inválida ou futura", () => {
    expect(calculateAge(null, "2026-09-18")).toBeNull();
    expect(calculateAge(undefined, "2026-09-18")).toBeNull();
    expect(calculateAge("2026-02-30", "2026-09-18")).toBeNull();
    expect(calculateAge("2030-01-01", "2026-09-18")).toBeNull();
  });
});

describe("formatAge", () => {
  it("pluraliza e trata ausência", () => {
    expect(formatAge(null)).toBe("Não informado");
    expect(formatAge(1)).toBe("1 ano");
    expect(formatAge(34)).toBe("34 anos");
    expect(formatAge(0)).toBe("0 anos");
  });
});
