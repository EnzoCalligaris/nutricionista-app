/**
 * Timeline simples do paciente (prompt Fase 5 §25): eventos derivados de
 * dados REAIS já existentes (cadastro, contratos, pagamentos, desativação,
 * reativação via audit log). Sem event sourcing, sem evento inventado.
 */
export type TimelineEventKind =
  | "PATIENT_CREATED"
  | "PATIENT_ARCHIVED"
  | "PATIENT_REACTIVATED"
  | "CONTRACT_STARTED"
  | "CONTRACT_COMPLETED"
  | "CONTRACT_CANCELLED"
  | "PAYMENT_CONFIRMED";

export type TimelineEvent = {
  kind: TimelineEventKind;
  /** Instante ISO (timestamptz) ou data civil (YYYY-MM-DD) — usado para ordenar. */
  at: string;
  /** True quando `at` é uma data civil (sem hora). */
  isCalendarDate: boolean;
  title: string;
  description?: string;
};

export type TimelineSources = {
  patient: { created_at: string; archived_at: string | null; status: "ACTIVE" | "INACTIVE" };
  contracts: {
    id: string;
    plan_name: string;
    start_date: string;
    end_date: string | null;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    cancelled_at: string | null;
    created_at: string;
  }[];
  payments: { amount_label: string; paid_at: string | null; status: string; contract_plan_name?: string | null }[];
  auditEvents: { action: string; created_at: string }[];
};

function sortKey(event: TimelineEvent): string {
  // Data civil ordena como meia-noite UTC daquele dia; suficiente para uma
  // timeline de leitura.
  return event.isCalendarDate ? `${event.at}T00:00:00.000Z` : new Date(event.at).toISOString();
}

export function buildPatientTimeline(sources: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    kind: "PATIENT_CREATED",
    at: sources.patient.created_at,
    isCalendarDate: false,
    title: "Paciente cadastrado",
  });

  for (const contract of sources.contracts) {
    events.push({
      kind: "CONTRACT_STARTED",
      at: contract.start_date,
      isCalendarDate: true,
      title: "Contrato iniciado",
      description: contract.plan_name,
    });
    if (contract.status === "CANCELLED" && contract.cancelled_at) {
      events.push({
        kind: "CONTRACT_CANCELLED",
        at: contract.cancelled_at,
        isCalendarDate: false,
        title: "Contrato cancelado",
        description: contract.plan_name,
      });
    }
    if (contract.status === "COMPLETED" && contract.end_date) {
      events.push({
        kind: "CONTRACT_COMPLETED",
        at: contract.end_date,
        isCalendarDate: true,
        title: "Contrato encerrado",
        description: contract.plan_name,
      });
    }
  }

  for (const payment of sources.payments) {
    if (payment.status !== "CONFIRMED" || !payment.paid_at) continue;
    events.push({
      kind: "PAYMENT_CONFIRMED",
      at: payment.paid_at,
      isCalendarDate: false,
      title: "Pagamento registrado",
      description: payment.contract_plan_name
        ? `${payment.amount_label} · ${payment.contract_plan_name}`
        : payment.amount_label,
    });
  }

  if (sources.patient.status === "INACTIVE" && sources.patient.archived_at) {
    events.push({
      kind: "PATIENT_ARCHIVED",
      at: sources.patient.archived_at,
      isCalendarDate: false,
      title: "Paciente desativado",
    });
  }

  for (const audit of sources.auditEvents) {
    if (audit.action === "PATIENT_REACTIVATED") {
      events.push({
        kind: "PATIENT_REACTIVATED",
        at: audit.created_at,
        isCalendarDate: false,
        title: "Paciente reativado",
      });
    }
    if (audit.action === "PATIENT_ARCHIVED" && sources.patient.status !== "INACTIVE") {
      // Desativação passada, já revertida — só existe no audit log.
      events.push({
        kind: "PATIENT_ARCHIVED",
        at: audit.created_at,
        isCalendarDate: false,
        title: "Paciente desativado",
      });
    }
  }

  return events.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0));
}
