/**
 * Definições financeiras (prompt Fase 7 §1–§2) — fonte única de significado
 * para UI, services e SQL (docs/DECISIONS.md, Fase 7):
 *
 *   CONTRATADO  valor total acordado no contrato (`patient_contracts.
 *               contracted_amount_cents`, snapshot da venda).
 *   RECEBIDO    pagamentos CONFIRMED efetivamente recebidos
 *               (`payments.status = 'CONFIRMED'`), por `paid_at`.
 *   PENDENTE    saldo em aberto das parcelas não canceladas de contratos não
 *               cancelados: valor da parcela − recebido nela (pagamento
 *               parcial desconta). Parcela PAID/CANCELLED = 0.
 *   PREVISTO    o mesmo saldo, mas só de contratos ACTIVE (contrato
 *               cancelado/encerrado não projeta receita futura).
 *   ATRASADO    subconjunto do pendente com vencimento antes de hoje (no
 *               fuso). Derivado — nunca persistido.
 *   RECEITA     lançamentos INCOME com status CONFIRMED (dinheiro que entrou:
 *               pagamentos de contrato/consulta e receitas manuais), por
 *               `occurred_on`.
 *   DESPESA     lançamentos EXPENSE com status CONFIRMED, por `occurred_on`.
 *   SALDO       RECEITA − DESPESA (só o realizado; pendente nunca entra).
 *   FATURAMENTO DO MÊS  RECEITA do mês civil corrente em America/Sao_Paulo.
 *
 * Um contrato de R$ 1.200 em 6x é R$ 1.200 CONTRATADO e R$ 0 de RECEITA até o
 * primeiro pagamento confirmado.
 */

export type FinancialType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export type TransactionOrigin = "MANUAL" | "APPOINTMENT" | "PAYMENT";
export type PaymentMethod = "PIX" | "CARD" | "CASH" | "BANK_TRANSFER" | "OTHER";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";

/** Status de lançamento como a UI mostra: OVERDUE é derivado (PENDING vencido). */
export type TransactionUiStatus = "PAID" | "PENDING" | "OVERDUE" | "CANCELLED";

export const FINANCIAL_TYPE_LABEL: Record<FinancialType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionUiStatus, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  CANCELLED: "Cancelado",
};

export const TRANSACTION_ORIGIN_LABEL: Record<TransactionOrigin, string> = {
  MANUAL: "Lançamento manual",
  APPOINTMENT: "Consulta",
  PAYMENT: "Pagamento",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  CASH: "Dinheiro",
  BANK_TRANSFER: "Transferência",
  OTHER: "Outro",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  FAILED: "Falhou",
  REFUNDED: "Estornado",
};

/** Limite seguro (integer do schema = 2^31-1 centavos ≈ R$ 21 milhões; usamos R$ 10 milhões). */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

/**
 * Lançamento de origem PAYMENT/APPOINTMENT: valor/tipo/data não editáveis;
 * só MANUAL é editável livremente (§20). Espelha o trigger do banco.
 */
export function isTransactionEditable(origin: TransactionOrigin, status: TransactionStatus): boolean {
  return origin === "MANUAL" && status !== "CANCELLED";
}

export function isTransactionCancellable(origin: TransactionOrigin, status: TransactionStatus): boolean {
  return origin === "MANUAL" && status !== "CANCELLED";
}

/** Status exibido de um lançamento: PENDING vencido vira ATRASADO (derivado, sem job). */
export function presentTransactionStatus(status: TransactionStatus, dueOn: string | null, today: string): TransactionUiStatus {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "CONFIRMED") return "PAID";
  if (dueOn && dueOn < today) return "OVERDUE";
  return "PENDING";
}

/**
 * Política de cobrança de consulta (prompt Fase 7 §33–§34): QUANDO uma
 * consulta avulsa gera lançamento é PENDENTE DE DEFINIÇÃO comercial. A
 * arquitetura suporta as três opções; nesta fase só MANUAL está ativa —
 * nada é gerado automaticamente ao agendar/confirmar/realizar, e consulta
 * incluída em contrato NUNCA gera receita além da parcela (§35).
 */
export type AppointmentChargePolicy = "ON_SCHEDULE" | "ON_CONFIRM" | "MANUAL";
export const APPOINTMENT_CHARGE_POLICY: AppointmentChargePolicy = "MANUAL";
