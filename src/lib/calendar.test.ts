import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  addMonthsISO,
  daysInMonth,
  isValidISODate,
  monthBoundsISO,
  parseISODate,
  todayISO,
  toISODate,
} from "@/lib/calendar";

describe("parseISODate / toISODate", () => {
  it("aceita datas civis válidas e rejeita inválidas", () => {
    expect(parseISODate("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseISODate("2026-02-29")).toBeNull(); // 2026 não é bissexto
    expect(parseISODate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-04-31")).toBeNull();
    expect(parseISODate("26-04-01")).toBeNull();
    expect(parseISODate("2026-04-01T00:00:00Z")).toBeNull();
    expect(isValidISODate("2026-04-30")).toBe(true);
  });

  it("serializa com zero à esquerda", () => {
    expect(toISODate({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
  });
});

describe("daysInMonth", () => {
  it("trata fevereiro e anos bissextos", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28); // século não divisível por 400
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("addMonthsClamped — regra do dia 31 (docs/DECISIONS.md)", () => {
  it("31/01 -> 28/02 -> 31/03 -> 30/04 mantendo o dia-âncora", () => {
    expect(addMonthsISO("2026-01-31", 0)).toBe("2026-01-31");
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsISO("2026-01-31", 3)).toBe("2026-04-30");
    expect(addMonthsISO("2026-01-31", 4)).toBe("2026-05-31");
  });

  it("29 e 30 de janeiro em ano bissexto e não bissexto", () => {
    expect(addMonthsISO("2028-01-29", 1)).toBe("2028-02-29");
    expect(addMonthsISO("2026-01-29", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-01-30", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-01-30", 3)).toBe("2026-04-30");
  });

  it("dia 28 nunca é ajustado", () => {
    expect(addMonthsISO("2026-01-28", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-01-28", 13)).toBe("2027-02-28");
  });

  it("vira o ano corretamente", () => {
    expect(addMonthsISO("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsISO("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonthsClamped({ year: 2026, month: 10, day: 31 }, 12)).toEqual({ year: 2027, month: 10, day: 31 });
  });

  it("lança em data inválida", () => {
    expect(() => addMonthsISO("2026-02-30", 1)).toThrow();
  });
});

describe("todayISO", () => {
  it("usa America/Sao_Paulo, não o fuso da máquina", () => {
    // 2026-03-01 01:30 UTC = 2026-02-28 22:30 em São Paulo (UTC-3).
    expect(todayISO(new Date("2026-03-01T01:30:00Z"))).toBe("2026-02-28");
    expect(todayISO(new Date("2026-03-01T03:00:00Z"))).toBe("2026-03-01");
  });
});

describe("monthBoundsISO", () => {
  it("devolve o primeiro e o último dia do mês civil", () => {
    expect(monthBoundsISO("2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthBoundsISO("2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthBoundsISO("2026-12-31")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
