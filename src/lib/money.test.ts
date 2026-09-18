import { describe, expect, it } from "vitest";
import { formatBRL, parseBRLToCents } from "@/lib/money";

const nbsp = (value: string) => value.replace(/ /g, " ");

describe("formatBRL", () => {
  it("formata centavos em BRL", () => {
    expect(nbsp(formatBRL(0))).toBe("R$ 0,00");
    expect(nbsp(formatBRL(1))).toBe("R$ 0,01");
    expect(nbsp(formatBRL(105000))).toBe("R$ 1.050,00");
    expect(nbsp(formatBRL(22679))).toBe("R$ 226,79");
    expect(nbsp(formatBRL(128760))).toBe("R$ 1.287,60");
  });
});

describe("parseBRLToCents", () => {
  it("interpreta formato brasileiro com milhar e decimal", () => {
    expect(parseBRLToCents("1.050,00")).toBe(105000);
    expect(parseBRLToCents("R$ 1.050,00")).toBe(105000);
    expect(parseBRLToCents("226,79")).toBe(22679);
    expect(parseBRLToCents("600,5")).toBe(60050);
    expect(parseBRLToCents("1050")).toBe(105000);
    expect(parseBRLToCents(" 230 ")).toBe(23000);
    expect(parseBRLToCents("0")).toBe(0);
  });

  it("rejeita entradas ambíguas ou inválidas", () => {
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("1,2,3")).toBeNull();
    expect(parseBRLToCents("10,999")).toBeNull();
    expect(parseBRLToCents("-5")).toBeNull();
    expect(parseBRLToCents("1e5")).toBeNull();
  });
});
