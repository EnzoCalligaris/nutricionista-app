import { describe, expect, it } from "vitest";
import { generateSlots, isWithinAvailability, type AvailabilityRuleInput } from "@/domain/scheduling/slots";

const TZ = "America/Sao_Paulo";
// 2026-09-21 é segunda-feira. "Agora" = domingo 20/09 às 12:00 SP (15:00Z).
const NOW = new Date("2026-09-20T15:00:00Z");
const MONDAY = "2026-09-21";

const rule = (overrides: Partial<AvailabilityRuleInput> = {}): AvailabilityRuleInput => ({
  weekday: 1,
  start_time: "08:00",
  end_time: "12:00",
  modality: null,
  active: true,
  ...overrides,
});

const spIso = (time: string, date = MONDAY) => {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(2026, 8, Number(date.slice(8, 10)), hour! + 3, minute)).toISOString();
};

describe("generateSlots — regras básicas", () => {
  it("consulta de 60 min começando a cada 30 min dentro de 08:00–12:00", () => {
    const slots = generateSlots({ date: MONDAY, timeZone: TZ, rules: [rule()], busy: [], durationMinutes: 60, granularityMinutes: 30, now: NOW });
    expect(slots.map((slot) => slot.label)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]);
    expect(slots[0]).toMatchObject({ startsAt: "2026-09-21T11:00:00.000Z", endsAt: "2026-09-21T12:00:00.000Z", modalities: ["IN_PERSON", "ONLINE"] });
  });

  it("granularidade independe da duração (30 min a cada 60)", () => {
    const slots = generateSlots({ date: MONDAY, timeZone: TZ, rules: [rule()], busy: [], durationMinutes: 30, granularityMinutes: 60, now: NOW });
    expect(slots.map((slot) => slot.label)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("dia sem regra ativa => nenhum slot; regra inativa não conta", () => {
    expect(generateSlots({ date: "2026-09-20", timeZone: TZ, rules: [rule()], busy: [], durationMinutes: 60, granularityMinutes: 30, now: NOW })).toEqual([]);
    expect(generateSlots({ date: MONDAY, timeZone: TZ, rules: [rule({ active: false })], busy: [], durationMinutes: 60, granularityMinutes: 30, now: NOW })).toEqual([]);
  });

  it("dois intervalos no dia (08–12 e 14–18): consulta não atravessa o almoço", () => {
    const slots = generateSlots({
      date: MONDAY,
      timeZone: TZ,
      rules: [rule(), rule({ start_time: "14:00", end_time: "18:00" })],
      busy: [],
      durationMinutes: 60,
      granularityMinutes: 60,
      now: NOW,
    });
    expect(slots.map((slot) => slot.label)).toEqual(["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("intervalos adjacentes (08–12 e 12–16) são blocos independentes: 11:30 (60 min) não existe", () => {
    const slots = generateSlots({
      date: MONDAY,
      timeZone: TZ,
      rules: [rule(), rule({ start_time: "12:00", end_time: "16:00" })],
      busy: [],
      durationMinutes: 60,
      granularityMinutes: 30,
      now: NOW,
    });
    expect(slots.map((slot) => slot.label)).not.toContain("11:30");
    expect(slots.map((slot) => slot.label)).toContain("11:00");
    expect(slots.map((slot) => slot.label)).toContain("12:00");
  });
});

describe("generateSlots — exclusões", () => {
  it("bloqueio 12–14 em disponibilidade 08–18 => zero slots nesse período", () => {
    const slots = generateSlots({
      date: MONDAY,
      timeZone: TZ,
      rules: [rule({ end_time: "18:00" })],
      busy: [{ starts_at: spIso("12:00"), ends_at: spIso("14:00") }],
      durationMinutes: 60,
      granularityMinutes: 60,
      now: NOW,
    });
    const labels = slots.map((slot) => slot.label);
    expect(labels).toEqual(["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]);
    expect(labels.some((label) => label >= "12:00" && label < "14:00")).toBe(false);
  });

  it("consulta existente 10–11 remove 09:30 e 10:00/10:30, mantém 09:00 e 11:00 (adjacentes)", () => {
    const slots = generateSlots({
      date: MONDAY,
      timeZone: TZ,
      rules: [rule()],
      busy: [{ starts_at: spIso("10:00"), ends_at: spIso("11:00") }],
      durationMinutes: 60,
      granularityMinutes: 30,
      now: NOW,
    });
    expect(slots.map((slot) => slot.label)).toEqual(["08:00", "08:30", "09:00", "11:00"]);
  });

  it("horário já passado no dia atual não aparece; antecedência mínima e horizonte valem para o paciente", () => {
    const nowMonday = new Date("2026-09-21T12:10:00Z"); // 09:10 SP
    const base = { date: MONDAY, timeZone: TZ, rules: [rule()], busy: [], durationMinutes: 60, granularityMinutes: 30 };
    expect(generateSlots({ ...base, now: nowMonday }).map((slot) => slot.label)).toEqual(["09:30", "10:00", "10:30", "11:00"]);
    expect(generateSlots({ ...base, now: nowMonday, minNoticeHours: 1 }).map((slot) => slot.label)).toEqual(["10:30", "11:00"]);
    expect(generateSlots({ ...base, now: new Date("2026-09-01T12:00:00Z"), maxHorizonDays: 7 })).toEqual([]);
    expect(generateSlots({ ...base, now: new Date("2026-09-15T12:00:00Z"), maxHorizonDays: 7 }).length).toBeGreaterThan(0);
  });

  it("filtra por modalidade e agrega modalidades de regras sobrepostas por modalidade", () => {
    const rules = [rule({ modality: "IN_PERSON" }), rule({ modality: "ONLINE", start_time: "10:00", end_time: "12:00" })];
    const all = generateSlots({ date: MONDAY, timeZone: TZ, rules, busy: [], durationMinutes: 60, granularityMinutes: 60, now: NOW });
    expect(all.find((slot) => slot.label === "08:00")?.modalities).toEqual(["IN_PERSON"]);
    expect(all.find((slot) => slot.label === "10:00")?.modalities).toEqual(["IN_PERSON", "ONLINE"]);
    const online = generateSlots({ date: MONDAY, timeZone: TZ, rules, busy: [], durationMinutes: 60, granularityMinutes: 60, now: NOW, modality: "ONLINE" });
    expect(online.map((slot) => slot.label)).toEqual(["10:00", "11:00"]);
  });

  it("duração/granularidade inválidas não geram nada", () => {
    expect(generateSlots({ date: MONDAY, timeZone: TZ, rules: [rule()], busy: [], durationMinutes: 0, granularityMinutes: 30, now: NOW })).toEqual([]);
  });
});

describe("isWithinAvailability (mesma checagem da função SQL)", () => {
  it("cabe inteira numa regra do dia", () => {
    expect(isWithinAvailability({ startsAt: new Date(spIso("10:00")), endsAt: new Date(spIso("11:00")), timeZone: TZ, rules: [rule()], modality: "IN_PERSON" })).toBe(true);
    expect(isWithinAvailability({ startsAt: new Date(spIso("11:30")), endsAt: new Date(spIso("12:30")), timeZone: TZ, rules: [rule()], modality: "IN_PERSON" })).toBe(false);
    expect(isWithinAvailability({ startsAt: new Date(spIso("10:00")), endsAt: new Date(spIso("11:00")), timeZone: TZ, rules: [rule({ modality: "ONLINE" })], modality: "IN_PERSON" })).toBe(false);
  });
});
