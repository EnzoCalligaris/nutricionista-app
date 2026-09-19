import { describe, expect, it } from "vitest";
import { parsePeriodPreset, resolvePeriod } from "@/domain/finance/period";
import { instantToDateISO } from "@/lib/timezone";

describe("resolvePeriod", () => {
  it("este mês cobre do dia 1 ao último dia (fevereiro bissexto incluído)", () => {
    expect(resolvePeriod("this_month", "2026-09-18")).toEqual({ preset: "this_month", from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("this_month", "2028-02-10")).toEqual({ preset: "this_month", from: "2028-02-01", to: "2028-02-29" });
  });

  it("mês passado vira o ano em janeiro", () => {
    expect(resolvePeriod("last_month", "2027-01-05")).toEqual({ preset: "last_month", from: "2026-12-01", to: "2026-12-31" });
  });

  it("últimos 3/6 meses incluem o mês atual", () => {
    expect(resolvePeriod("last_3_months", "2026-09-18")).toEqual({ preset: "last_3_months", from: "2026-07-01", to: "2026-09-30" });
    expect(resolvePeriod("last_6_months", "2026-02-15")).toEqual({ preset: "last_6_months", from: "2025-09-01", to: "2026-02-28" });
  });

  it("ano atual é o ano civil completo", () => {
    expect(resolvePeriod("this_year", "2026-09-18")).toEqual({ preset: "this_year", from: "2026-01-01", to: "2026-12-31" });
  });

  it("personalizado aceita intervalo válido e cai em este mês quando inválido", () => {
    expect(resolvePeriod("custom", "2026-09-18", { from: "2026-03-10", to: "2026-04-05" })).toEqual({ preset: "custom", from: "2026-03-10", to: "2026-04-05" });
    expect(resolvePeriod("custom", "2026-09-18", { from: "2026-04-05", to: "2026-03-10" }).preset).toBe("this_month");
    expect(resolvePeriod("custom", "2026-09-18", { from: "2026-02-30", to: "2026-03-10" }).preset).toBe("this_month");
    expect(resolvePeriod("custom", "2026-09-18").preset).toBe("this_month");
  });

  it("parsePeriodPreset ignora valores desconhecidos", () => {
    expect(parsePeriodPreset("last_month")).toBe("last_month");
    expect(parsePeriodPreset("xyz")).toBe("this_month");
    expect(parsePeriodPreset(undefined)).toBe("this_month");
  });
});

describe("virada de mês no fuso America/Sao_Paulo (§68/§84)", () => {
  it("00:30 de 1º de outubro em São Paulo (03:30Z) já é outubro, não setembro", () => {
    const today = instantToDateISO(new Date("2026-10-01T03:30:00Z"), "America/Sao_Paulo");
    expect(today).toBe("2026-10-01");
    expect(resolvePeriod("this_month", today).from).toBe("2026-10-01");
  });

  it("23:30 de 30 de setembro em São Paulo (02:30Z do dia 1) ainda é setembro", () => {
    const today = instantToDateISO(new Date("2026-10-01T02:30:00Z"), "America/Sao_Paulo");
    expect(today).toBe("2026-09-30");
    expect(resolvePeriod("this_month", today)).toEqual({ preset: "this_month", from: "2026-09-01", to: "2026-09-30" });
  });
});
