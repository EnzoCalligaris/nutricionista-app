import { describe, expect, it } from "vitest";
import { sortAvailabilityRules, validateAvailabilityRules } from "@/domain/scheduling/availability-rules";
import { monthGridDatesISO, parseCalendarView, shiftDate, startOfWeekISO, viewRange, weekDatesISO } from "@/domain/scheduling/calendar-views";
import { availabilityWindowsForDate, itemsForDate, visibleHourRange } from "@/domain/scheduling/calendar-layout";
import { canPatientModify, canTransition, isActive, isFinal } from "@/domain/scheduling/state-machine";

const rule = (weekday: number, start_time: string, end_time: string, active = true) => ({ weekday, start_time, end_time, modality: null, active });

describe("validateAvailabilityRules (§7)", () => {
  it("aceita intervalos válidos e adjacentes", () => {
    expect(validateAvailabilityRules([rule(1, "08:00", "12:00"), rule(1, "12:00", "16:00"), rule(2, "08:00", "12:00")])).toEqual([]);
  });

  it("rejeita fim <= início e horário inválido", () => {
    expect(validateAvailabilityRules([rule(1, "12:00", "12:00")])[0]?.message).toMatch(/fim precisa ser depois/);
    expect(validateAvailabilityRules([rule(1, "12:00", "08:00")])[0]?.message).toMatch(/fim precisa ser depois/);
    expect(validateAvailabilityRules([rule(1, "25:00", "26:00")])[0]?.message).toMatch(/inválido/);
    expect(validateAvailabilityRules([rule(7, "08:00", "09:00")])[0]?.message).toMatch(/Dia da semana/);
  });

  it("rejeita duplicados e sobrepostos no mesmo dia (não em dias diferentes)", () => {
    expect(validateAvailabilityRules([rule(1, "08:00", "12:00"), rule(1, "08:00", "12:00")])).toEqual([{ index: 1, message: "Intervalo duplicado neste dia." }]);
    expect(validateAvailabilityRules([rule(1, "08:00", "12:00"), rule(1, "11:00", "13:00")])).toEqual([{ index: 1, message: "Intervalo sobrepõe outro do mesmo dia." }]);
    expect(validateAvailabilityRules([rule(1, "08:00", "12:00"), rule(2, "11:00", "13:00")])).toEqual([]);
  });

  it("regra inativa não conta para sobreposição", () => {
    expect(validateAvailabilityRules([rule(1, "08:00", "12:00"), rule(1, "11:00", "13:00", false)])).toEqual([]);
  });

  it("ordena por dia e horário", () => {
    expect(sortAvailabilityRules([rule(2, "08:00", "09:00"), rule(1, "14:00", "15:00"), rule(1, "08:00", "09:00")]).map((r) => `${r.weekday}-${r.start_time}`)).toEqual(["1-08:00", "1-14:00", "2-08:00"]);
  });
});

describe("máquina de estados (§32)", () => {
  it("transições permitidas ao nutricionista", () => {
    expect(canTransition("SCHEDULED", "CONFIRMED", "NUTRITIONIST")).toBe(true);
    expect(canTransition("SCHEDULED", "COMPLETED", "NUTRITIONIST")).toBe(true);
    expect(canTransition("CONFIRMED", "NO_SHOW", "NUTRITIONIST")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED", "NUTRITIONIST")).toBe(true);
    expect(canTransition("CONFIRMED", "RESCHEDULED", "NUTRITIONIST")).toBe(true);
  });

  it("transições absurdas são negadas", () => {
    expect(canTransition("CANCELLED", "COMPLETED", "NUTRITIONIST")).toBe(false);
    expect(canTransition("COMPLETED", "SCHEDULED", "NUTRITIONIST")).toBe(false);
    expect(canTransition("RESCHEDULED", "SCHEDULED", "NUTRITIONIST")).toBe(false);
    expect(canTransition("RESCHEDULED", "CONFIRMED", "NUTRITIONIST")).toBe(false);
    expect(canTransition("NO_SHOW", "CANCELLED", "NUTRITIONIST")).toBe(false);
    expect(canTransition("CONFIRMED", "SCHEDULED", "NUTRITIONIST")).toBe(false);
  });

  it("paciente só cancela e reagenda", () => {
    expect(canTransition("SCHEDULED", "CANCELLED", "PATIENT")).toBe(true);
    expect(canTransition("CONFIRMED", "RESCHEDULED", "PATIENT")).toBe(true);
    expect(canTransition("SCHEDULED", "CONFIRMED", "PATIENT")).toBe(false);
    expect(canTransition("SCHEDULED", "COMPLETED", "PATIENT")).toBe(false);
    expect(canTransition("SCHEDULED", "NO_SHOW", "PATIENT")).toBe(false);
  });

  it("isActive / isFinal", () => {
    expect(isActive("SCHEDULED")).toBe(true);
    expect(isActive("CANCELLED")).toBe(false);
    expect(isFinal("COMPLETED")).toBe(true);
    expect(isFinal("CONFIRMED")).toBe(false);
  });

  it("canPatientModify: ativa, futura e com antecedência (§68–§69)", () => {
    const now = new Date("2026-09-20T12:00:00Z");
    const in3h = new Date("2026-09-20T15:00:00Z");
    expect(canPatientModify({ status: "SCHEDULED", startsAt: in3h, now })).toBe(true);
    expect(canPatientModify({ status: "SCHEDULED", startsAt: in3h, now, minCancellationNoticeHours: 2 })).toBe(true);
    expect(canPatientModify({ status: "SCHEDULED", startsAt: in3h, now, minCancellationNoticeHours: 4 })).toBe(false);
    expect(canPatientModify({ status: "COMPLETED", startsAt: in3h, now })).toBe(false);
    expect(canPatientModify({ status: "SCHEDULED", startsAt: new Date("2026-09-20T11:00:00Z"), now })).toBe(false);
  });
});

describe("visões do calendário", () => {
  it("semana começa na segunda", () => {
    expect(startOfWeekISO("2026-09-20")).toBe("2026-09-14"); // domingo -> segunda anterior
    expect(startOfWeekISO("2026-09-21")).toBe("2026-09-21");
    expect(weekDatesISO("2026-09-23")).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  });

  it("faixas por visão e navegação", () => {
    expect(viewRange("day", "2026-09-21")).toEqual({ start: "2026-09-21", endExclusive: "2026-09-22" });
    expect(viewRange("week", "2026-09-23")).toEqual({ start: "2026-09-21", endExclusive: "2026-09-28" });
    expect(viewRange("month", "2026-09-15")).toEqual({ start: "2026-08-31", endExclusive: "2026-10-05" });
    expect(monthGridDatesISO("2026-09-15")).toHaveLength(35);
    expect(shiftDate("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDate("week", "2026-09-21", -1)).toBe("2026-09-14");
    expect(shiftDate("day", "2026-12-31", 1)).toBe("2027-01-01");
    expect(parseCalendarView("x")).toBe("week");
    expect(parseCalendarView("month")).toBe("month");
  });
});

describe("geometria da grade", () => {
  it("posiciona itens por minutos no fuso e recorta ao dia", () => {
    const items = itemsForDate(
      [
        { id: "a", startsAt: "2026-09-21T13:00:00Z", endsAt: "2026-09-21T14:00:00Z" }, // 10:00–11:00 SP
        { id: "b", startsAt: "2026-09-21T03:00:00Z", endsAt: "2026-09-22T03:00:00Z" }, // dia inteiro SP
        { id: "c", startsAt: "2026-09-22T13:00:00Z", endsAt: "2026-09-22T14:00:00Z" }, // outro dia
      ],
      "2026-09-21",
      "America/Sao_Paulo",
    );
    expect(items.map((item) => [item.id, item.topMinutes, item.heightMinutes])).toEqual([
      ["b", 0, 1440],
      ["a", 600, 60],
    ]);
  });

  it("janelas de disponibilidade e faixa de horas visível", () => {
    const windows = availabilityWindowsForDate([rule(1, "08:00", "12:00"), rule(1, "14:00", "18:00"), rule(2, "07:00", "08:00")], "2026-09-21");
    expect(windows).toEqual([
      { start: 480, end: 720 },
      { start: 840, end: 1080 },
    ]);
    expect(visibleHourRange({ windows, items: [] })).toEqual({ startHour: 7, endHour: 19 });
    expect(visibleHourRange({ windows: [], items: [] })).toEqual({ startHour: 7, endHour: 19 });
    expect(visibleHourRange({ windows: [], items: [{ startsAt: "", endsAt: "", topMinutes: 20 * 60, heightMinutes: 60 }] })).toEqual({ startHour: 7, endHour: 22 });
  });
});
