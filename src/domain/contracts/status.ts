/**
 * Mapeamento dos enums REAIS do banco (Fase 2) para rótulos da UI (prompt
 * Fase 5 §34) — nenhum enum novo. `contract_status` não tem PENDING: um
 * contrato nasce ACTIVE (a data de início pode ser futura).
 */
export type ContractStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIVE: "Ativo",
  COMPLETED: "Encerrado",
  CANCELLED: "Cancelado",
};

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Paga",
  OVERDUE: "Em atraso",
  CANCELLED: "Cancelada",
};

export function canCancelContract(status: ContractStatus): boolean {
  return status === "ACTIVE";
}

export function canCompleteContract(status: ContractStatus): boolean {
  return status === "ACTIVE";
}

/**
 * Parcela PENDING com vencimento já passado é exibida como "Em atraso" sem
 * alterar o banco — o status OVERDUE persistido é responsabilidade do
 * módulo financeiro (Fase 7).
 */
export function presentInstallmentStatus(
  status: InstallmentStatus,
  dueDate: string,
  today: string,
): InstallmentStatus {
  if (status === "PENDING" && dueDate < today) return "OVERDUE";
  return status;
}
