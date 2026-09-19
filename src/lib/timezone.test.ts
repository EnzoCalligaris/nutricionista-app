import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  dayBounds,
  instantToDateISO,
  instantToTime,
  minutesOfDay,
  minutesToTime,
  timeToMinutes,
  toWallClock,
  wallClockToInstant,
  weekdayOfDate,
} from "@/lib/timezone";

// Estes testes rodam igual com TZ=UTC, TZ=America/Sao_Paulo ou qualquer
// outro fuso da máquina: nada aqui usa Date local.
describe("wallClockToInstant / toWallClock (America/Sao_Paulo, UTC-3)", () => {
  it("10:00 em São Paulo = 13:00Z", () => {
    expect(wallClockToInstant("2026-09-21", "10:00").toISOString()).toBe("2026-09-21T13:00:00.000Z");
    expect(wallClockToInstant("2026-09-21", "00:00").toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(wallClockToInstant("2026-09-21", "23:30").toISOString()).toBe("2026-09-22T02:30:00.000Z");
  });

  it("é o inverso de toWallClock", () => {
    const wall = toWallClock(new Date("2026-09-21T13:00:00Z"));
    expect(wall).toMatchObject({ year: 2026, month: 9, day: 21, hour: 10, minute: 0, weekday: 1 });
    expect(instantToTime(new Date("2026-09-21T13:00:00Z"))).toBe("10:00");
    expect(instantToDateISO(new Date("2026-09-22T02:30:00Z"))).toBe("2026-09-21");
  });

  it("respeita outros fusos, inclusive com horário de verão (Nova York)", () => {
    // 2026-07-01 10:00 em Nova York = 14:00Z (EDT, UTC-4); em janeiro = 15:00Z (EST, UTC-5).
    expect(wallClockToInstant("2026-07-01", "10:00", "America/New_York").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(wallClockToInstant("2026-01-15", "10:00", "America/New_York").toISOString()).toBe("2026-01-15T15:00:00.000Z");
    expect(instantToTime(new Date("2026-07-01T14:00:00Z"), "America/New_York")).toBe("10:00");
  });

  it("rejeita entradas inválidas", () => {
    expect(() => wallClockToInstant("2026-02-30", "10:00")).toThrow(RangeError);
    expect(() => wallClockToInstant("2026-02-10", "25:00")).toThrow(RangeError);
    expect(() => wallClockToInstant("2026-02-10", "10h")).toThrow(RangeError);
  });
});

describe("dayBounds", () => {
  it("cobre [00:00, 00:00 do dia seguinte) no fuso", () => {
    const { start, end } = dayBounds("2026-09-21");
    expect(start.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-22T03:00:00.000Z");
  });

  it("vira o mês e o ano", () => {
    expect(dayBounds("2026-12-31").end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("helpers de calendário", () => {
  it("addDaysISO, weekdayOfDate, minutos", () => {
    expect(addDaysISO("2026-09-18", 3)).toBe("2026-09-21");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
    expect(weekdayOfDate("2026-09-21")).toBe(1); // segunda
    expect(weekdayOfDate("2026-09-20")).toBe(0); // domingo
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
    expect(minutesOfDay(new Date("2026-09-21T13:30:00Z"))).toBe(630);
  });
});
