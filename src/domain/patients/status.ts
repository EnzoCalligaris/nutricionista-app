/**
 * Status de paciente na UI (prompt Fase 5 §3/§42). Regra da Fase 2
 * (views `patient_active_status`/`patient_overview`): paciente ATIVO =
 * `patients.status = 'ACTIVE'` E existe contrato `ACTIVE`. Aqui só
 * mapeamos o que o banco já calculou para três estados legíveis:
 *
 *   ACTIVE       — ativo de verdade (status manual + contrato vigente)
 *   NO_CONTRACT  — status manual ACTIVE, mas sem contrato vigente
 *                  (recém-cadastrado, contrato encerrado/cancelado) —
 *                  conta como "inativo" nas métricas e no filtro
 *   INACTIVE     — desativado pelo nutricionista (`status = 'INACTIVE'`,
 *                  o override administrativo previsto na Fase 2)
 */
export type PatientDbStatus = "ACTIVE" | "INACTIVE";
export type PatientUiStatus = "ACTIVE" | "NO_CONTRACT" | "INACTIVE";

export type PatientStatusInput = {
  patient_status: PatientDbStatus;
  has_active_contract: boolean;
};

export function derivePatientStatus(input: PatientStatusInput): PatientUiStatus {
  if (input.patient_status === "INACTIVE") return "INACTIVE";
  return input.has_active_contract ? "ACTIVE" : "NO_CONTRACT";
}

export function isEffectivelyActive(input: PatientStatusInput): boolean {
  return derivePatientStatus(input) === "ACTIVE";
}

export const PATIENT_STATUS_LABEL: Record<PatientUiStatus, string> = {
  ACTIVE: "Ativo",
  NO_CONTRACT: "Sem contrato",
  INACTIVE: "Inativo",
};

export const PATIENT_STATUS_DESCRIPTION: Record<PatientUiStatus, string> = {
  ACTIVE: "Cadastro ativo e contrato vigente.",
  NO_CONTRACT: "Cadastro ativo, mas sem contrato vigente — não conta como paciente ativo.",
  INACTIVE: "Desativado pelo nutricionista. Histórico preservado.",
};

/** Filtro da listagem (query param `status`). */
export type PatientListFilter = "all" | "active" | "inactive";

export function parsePatientListFilter(value: string | null | undefined): PatientListFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

/** Ações permitidas conforme o status manual real (`patients.status`). */
export function canArchivePatient(status: PatientDbStatus): boolean {
  return status === "ACTIVE";
}

export function canReactivatePatient(status: PatientDbStatus): boolean {
  return status === "INACTIVE";
}
