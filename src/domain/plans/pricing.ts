import { formatBRL } from "@/lib/money";

/**
 * Regras puras de apresentação de preço de plano (sem I/O). Ver
 * docs/DECISIONS.md — para TRIMESTRAL/SEMESTRAL nenhuma das três
 * representações (valor cheio / parcelado / à vista) é "a" principal
 * ainda (PENDENTE DE DEFINIÇÃO). O site NUNCA escolhe uma sozinho: só
 * destaca o preço marcado como `is_primary = true` no banco; sem primário,
 * apresenta as opções lado a lado, sem eleger nenhuma.
 */

export type PlanPriceInput = {
  id: string;
  label: string;
  amount_cents: number;
  installments: number;
  payment_type: "AVISTA" | "PARCELADO" | "REFERENCIA";
  is_primary: boolean;
  active: boolean;
};

export type PriceView = {
  id: string;
  label: string;
  /** Valor total formatado em BRL (ex.: "R$ 600,00"). */
  total: string;
  /** Valor da parcela formatado quando PARCELADO (ex.: "R$ 226,79"). */
  installment: string | null;
  installments: number;
  paymentType: PlanPriceInput["payment_type"];
  /** REFERENCIA é um valor "de" informativo, não uma opção de compra. */
  isReference: boolean;
};

export type PlanPricePresentation = {
  /** Preço em destaque — só existe quando o banco marca is_primary. */
  primary: PriceView | null;
  /** Demais opções ativas (ou todas, quando não há primário). */
  options: PriceView[];
  /** True quando o plano tem preço(s) mas nenhum foi eleito principal. */
  pendingPrimary: boolean;
};

export { formatBRL };

export function toPriceView(price: PlanPriceInput): PriceView {
  const isInstallments = price.payment_type === "PARCELADO" && price.installments > 1;
  return {
    id: price.id,
    label: price.label,
    total: formatBRL(price.amount_cents),
    installment: isInstallments ? formatBRL(Math.round(price.amount_cents / price.installments)) : null,
    installments: price.installments,
    paymentType: price.payment_type,
    isReference: price.payment_type === "REFERENCIA",
  };
}

const PAYMENT_TYPE_ORDER: Record<PlanPriceInput["payment_type"], number> = {
  AVISTA: 0,
  PARCELADO: 1,
  REFERENCIA: 2,
};

export function presentPlanPrices(prices: PlanPriceInput[]): PlanPricePresentation {
  const active = prices
    .filter((price) => price.active)
    .sort((a, b) => PAYMENT_TYPE_ORDER[a.payment_type] - PAYMENT_TYPE_ORDER[b.payment_type]);

  const primaryRow = active.find((price) => price.is_primary) ?? null;
  const primary = primaryRow ? toPriceView(primaryRow) : null;
  const options = active.filter((price) => price !== primaryRow).map(toPriceView);

  return {
    primary,
    options,
    pendingPrimary: active.length > 0 && primary === null,
  };
}
