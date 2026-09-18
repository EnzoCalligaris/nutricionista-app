import { describe, expect, it } from "vitest";
import { buildPatientTimeline } from "@/domain/patients/timeline";

describe("buildPatientTimeline", () => {
  it("monta eventos reais e ordena do mais recente ao mais antigo", () => {
    const events = buildPatientTimeline({
      patient: { created_at: "2026-01-10T12:00:00Z", archived_at: null, status: "ACTIVE" },
      contracts: [
        {
          id: "c1",
          plan_name: "Plano Trimestral",
          start_date: "2026-02-01",
          end_date: "2026-05-01",
          status: "COMPLETED",
          cancelled_at: null,
          created_at: "2026-01-31T12:00:00Z",
        },
        {
          id: "c2",
          plan_name: "Plano Semestral",
          start_date: "2026-06-01",
          end_date: "2026-12-01",
          status: "CANCELLED",
          cancelled_at: "2026-07-15T12:00:00Z",
          created_at: "2026-05-30T12:00:00Z",
        },
      ],
      payments: [
        {
          amount_label: "R$ 226,79",
          paid_at: "2026-02-01T15:00:00Z",
          status: "CONFIRMED",
          contract_plan_name: "Plano Trimestral",
        },
        { amount_label: "R$ 1,00", paid_at: null, status: "PENDING" },
      ],
      auditEvents: [],
    });

    expect(events.map((event) => event.kind)).toEqual([
      "CONTRACT_CANCELLED",
      "CONTRACT_STARTED",
      "CONTRACT_COMPLETED",
      "PAYMENT_CONFIRMED",
      "CONTRACT_STARTED",
      "PATIENT_CREATED",
    ]);
    expect(events.find((event) => event.kind === "PAYMENT_CONFIRMED")?.description).toBe(
      "R$ 226,79 · Plano Trimestral",
    );
  });

  it("inclui desativação atual e reativações do audit log, sem inventar eventos", () => {
    const events = buildPatientTimeline({
      patient: { created_at: "2026-01-10T12:00:00Z", archived_at: "2026-03-01T12:00:00Z", status: "INACTIVE" },
      contracts: [],
      payments: [],
      auditEvents: [
        { action: "PATIENT_REACTIVATED", created_at: "2026-02-01T12:00:00Z" },
        { action: "PATIENT_UPDATED", created_at: "2026-02-02T12:00:00Z" },
      ],
    });
    expect(events.map((event) => event.kind)).toEqual(["PATIENT_ARCHIVED", "PATIENT_REACTIVATED", "PATIENT_CREATED"]);
  });

  it("desativação antiga já revertida vem só do audit log", () => {
    const events = buildPatientTimeline({
      patient: { created_at: "2026-01-10T12:00:00Z", archived_at: null, status: "ACTIVE" },
      contracts: [],
      payments: [],
      auditEvents: [
        { action: "PATIENT_ARCHIVED", created_at: "2026-02-01T12:00:00Z" },
        { action: "PATIENT_REACTIVATED", created_at: "2026-02-05T12:00:00Z" },
      ],
    });
    expect(events.map((event) => event.kind)).toEqual(["PATIENT_REACTIVATED", "PATIENT_ARCHIVED", "PATIENT_CREATED"]);
  });
});
