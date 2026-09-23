/**
 * Regras puras de cobrança online (prompt Fase 13 §92). Sem I/O: o mesmo
 * raciocínio que o banco aplica (`create_installment_charge`,
 * `record_online_payment`) fica aqui testável e alimenta a UI.
 *
 * Vocabulário (§76): **cobrança** (`payment_charges`) é intenção de
 * pagamento — não é receita. **Pagamento** (`payments` CONFIRMED) é o
 * dinheiro que entrou e é o que alimenta o financeiro da Fase 7.
 */

export type ChargeStatus = "CREATED" | "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED";

/** Métodos que fazem sentido em checkout online (o resto continua manual — §79/§80). */
export type OnlinePaymentMethod = "PIX" | "CARD";

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  CREATED: "Gerando cobrança",
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
};

export const ONLINE_METHOD_LABEL: Record<OnlinePaymentMethod, string> = {
  PIX: "Pix",
  CARD: "Cartão de crédito",
};

/** Cobrança aberta: ainda pode ser paga (se não venceu). */
export function isChargeOpen(status: ChargeStatus): boolean {
  return status === "CREATED" || status === "PENDING";
}

export function isChargeFinal(status: ChargeStatus): boolean {
  return !isChargeOpen(status);
}

export type ChargeLike = { status: ChargeStatus; expiresAt: string | null };

/** Uma cobrança vencida deixa de parecer pagável mesmo antes do job rodar (§12). */
export function isChargeExpired(charge: ChargeLike, now: Date): boolean {
  if (charge.status === "EXPIRED") return true;
  if (!isChargeOpen(charge.status) || !charge.expiresAt) return false;
  return new Date(charge.expiresAt).getTime() <= now.getTime();
}

/** Status como a UI mostra (expiração derivada, sem esperar o job). */
export function presentChargeStatus(charge: ChargeLike, now: Date): ChargeStatus {
  return isChargeExpired(charge, now) ? "EXPIRED" : charge.status;
}

export function isChargePayable(charge: ChargeLike, now: Date): boolean {
  return isChargeOpen(charge.status) && !isChargeExpired(charge, now);
}

/** Depois de expirar/cancelar/falhar, a ação passa a ser "gerar nova cobrança" (§48). */
export function canCreateNewCharge(charge: ChargeLike | null, now: Date): boolean {
  if (!charge) return true;
  return !isChargePayable(charge, now);
}

export type InstallmentEligibility =
  | { eligible: true; amountCents: number }
  | { eligible: false; reason: "ALREADY_PAID" | "CANCELLED" | "CONTRACT_CANCELLED" | "NO_BALANCE" };

/**
 * O que pode ser cobrado de uma parcela: SEMPRE o saldo restante derivado do
 * banco (§21/§22/§50/§51) — nunca um valor vindo do browser, nunca parcial,
 * nunca a maior.
 */
export function installmentChargeEligibility(input: {
  installmentStatus: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  contractStatus: "ACTIVE" | "COMPLETED" | "CANCELLED";
  amountCents: number;
  receivedCents: number;
}): InstallmentEligibility {
  if (input.contractStatus === "CANCELLED") return { eligible: false, reason: "CONTRACT_CANCELLED" };
  if (input.installmentStatus === "CANCELLED") return { eligible: false, reason: "CANCELLED" };
  if (input.installmentStatus === "PAID") return { eligible: false, reason: "ALREADY_PAID" };
  const remaining = input.amountCents - Math.max(0, input.receivedCents);
  if (remaining <= 0) return { eligible: false, reason: "NO_BALANCE" };
  return { eligible: true, amountCents: remaining };
}

/** Métodos oferecidos no checkout = interseção entre o que o provider suporta e o que a cobrança permite (§78). */
export function availableCheckoutMethods(providerMethods: readonly OnlinePaymentMethod[]): OnlinePaymentMethod[] {
  const allowed: OnlinePaymentMethod[] = ["PIX", "CARD"];
  return allowed.filter((method) => providerMethods.includes(method));
}

/**
 * Chave de idempotência da criação da cobrança (§45/§46): determinística por
 * parcela + método + tentativa. Duas requisições simultâneas com a mesma
 * chave produzem UMA cobrança (o banco tem índice único).
 */
export function chargeIdempotencyKey(input: { installmentId: string; method: OnlinePaymentMethod; attempt: number }): string {
  return `installment:${input.installmentId}:${input.method}:${input.attempt}`;
}

/** Expiração padrão do Pix quando o provider não define uma (30 min — igual ao fake). */
export const DEFAULT_PIX_TTL_MS = 30 * 60 * 1000;

export function defaultExpiresAt(now: Date, ttlMs: number = DEFAULT_PIX_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}

/** "Pix copia e cola" mascarado para telas operacionais/log (nunca o código inteiro fora do checkout do paciente). */
export function maskPixPayload(payload: string | null | undefined): string {
  if (!payload) return "—";
  const trimmed = payload.trim();
  if (trimmed.length <= 12) return "•••";
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)} (${trimmed.length} caracteres)`;
}
