/**
 * Converte o plano do dashboard no shape que o card PÚBLICO consome, para o
 * preview mostrar exatamente o que o visitante veria (prompt Fase 14 §64).
 * Só preços/benefícios ATIVOS entram — é o que a RLS pública entrega.
 */

import { presentPlanPrices } from "@/domain/plans/pricing";

export type PlanPreviewInput = {
  id: string;
  code: string;
  name: string;
  durationMonths: number | null;
  sessionsInPerson: number | null;
  sessionsOnline: number | null;
  availableForSale: boolean;
  prices: {
    id: string;
    label: string;
    amountCents: number;
    installments: number;
    paymentType: "AVISTA" | "PARCELADO" | "REFERENCIA";
    isPrimary: boolean;
    active: boolean;
  }[];
  benefits: { label: string; sortOrder: number; active: boolean }[];
};

export function toPublicPlanPreview(plan: PlanPreviewInput) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    durationMonths: plan.durationMonths,
    sessionsInPerson: plan.sessionsInPerson,
    sessionsOnline: plan.sessionsOnline,
    availableForSale: plan.availableForSale,
    benefits: plan.benefits
      .filter((benefit) => benefit.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((benefit) => benefit.label),
    pricing: presentPlanPrices(
      plan.prices.map((price) => ({
        id: price.id,
        label: price.label,
        amount_cents: price.amountCents,
        installments: price.installments,
        payment_type: price.paymentType,
        is_primary: price.isPrimary,
        active: price.active,
      })),
    ),
  };
}
