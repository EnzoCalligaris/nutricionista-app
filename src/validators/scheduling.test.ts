import { describe, expect, it } from "vitest";
import {
  blockedTimeSchema,
  createAppointmentSchema,
  patientBookingSchema,
  rescheduleAppointmentSchema,
  saveAvailabilitySchema,
  schedulingSettingsSchema,
} from "@/validators/scheduling";

const valid = {
  patientId: "90000000-0000-0000-0000-000000000010",
  date: "2026-09-21",
  time: "10:00",
  durationMinutes: 60,
  modality: "IN_PERSON",
  contractId: "",
  amountCents: null,
  initialStatus: "SCHEDULED",
  allowOutsideAvailability: false,
  note: "",
};

describe("createAppointmentSchema", () => {
  it("aceita e normaliza", () => {
    const result = createAppointmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contractId).toBeNull();
      expect(result.data.note).toBeNull();
    }
  });

  it("rejeita horário/data/duração/status inválidos", () => {
    expect(createAppointmentSchema.safeParse({ ...valid, time: "9:00" }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...valid, date: "2026-02-30" }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...valid, durationMinutes: 5 }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...valid, initialStatus: "COMPLETED" }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...valid, modality: "PHONE" }).success).toBe(false);
  });

  it("descarta nutritionist_id, status privilegiado e ids internos (mass assignment)", () => {
    const result = createAppointmentSchema.safeParse({ ...valid, nutritionist_id: "x", status: "COMPLETED", id: "y", created_at: "z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("nutritionist_id" in result.data).toBe(false);
      expect("status" in result.data).toBe(false);
      expect("id" in result.data).toBe(false);
    }
  });
});

describe("patientBookingSchema — paciente nunca envia patient_id", () => {
  it("só startsAt e modality sobrevivem", () => {
    const result = patientBookingSchema.safeParse({ startsAt: "2026-09-21T13:00:00.000Z", modality: "ONLINE", patient_id: "outro", status: "COMPLETED" });
    expect(result.success).toBe(true);
    if (result.success) expect(Object.keys(result.data).sort()).toEqual(["modality", "startsAt"]);
  });

  it("rejeita instante inválido", () => {
    expect(patientBookingSchema.safeParse({ startsAt: "amanhã", modality: "ONLINE" }).success).toBe(false);
  });
});

describe("rescheduleAppointmentSchema / blockedTimeSchema", () => {
  it("reagendamento exige data e hora", () => {
    expect(rescheduleAppointmentSchema.safeParse({ date: "2026-09-21", time: "10:00" }).success).toBe(true);
    expect(rescheduleAppointmentSchema.safeParse({ date: "2026-09-21", time: "" }).success).toBe(false);
  });

  it("bloqueio: dia inteiro dispensa horas; intervalo exige as duas; datas coerentes", () => {
    expect(blockedTimeSchema.safeParse({ startDate: "2026-09-21", endDate: "2026-09-22", allDay: true }).success).toBe(true);
    expect(blockedTimeSchema.safeParse({ startDate: "2026-09-21", endDate: "2026-09-21", allDay: false, startTime: "12:00" }).success).toBe(false);
    expect(blockedTimeSchema.safeParse({ startDate: "2026-09-21", endDate: "2026-09-21", allDay: false, startTime: "12:00", endTime: "14:00" }).success).toBe(true);
    expect(blockedTimeSchema.safeParse({ startDate: "2026-09-22", endDate: "2026-09-21", allDay: true }).success).toBe(false);
  });
});

describe("saveAvailabilitySchema / schedulingSettingsSchema", () => {
  it("valida regras e limites", () => {
    expect(saveAvailabilitySchema.safeParse({ rules: [{ weekday: 1, start_time: "08:00", end_time: "12:00", modality: null, active: true }] }).success).toBe(true);
    expect(saveAvailabilitySchema.safeParse({ rules: [{ weekday: 9, start_time: "08:00", end_time: "12:00", modality: null, active: true }] }).success).toBe(false);
    expect(
      schedulingSettingsSchema.safeParse({
        defaultDurationMinutes: 60,
        slotGranularityMinutes: 30,
        minBookingNoticeHours: null,
        minCancellationNoticeHours: 24,
        maxBookingHorizonDays: null,
        patientCanBook: true,
        patientCanChooseModality: false,
      }).success,
    ).toBe(true);
    expect(schedulingSettingsSchema.safeParse({ defaultDurationMinutes: 5, slotGranularityMinutes: 30, minBookingNoticeHours: null, minCancellationNoticeHours: null, maxBookingHorizonDays: null, patientCanBook: true, patientCanChooseModality: true }).success).toBe(false);
  });
});
