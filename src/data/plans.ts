import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { safeQuery, type QueryResult } from "@/data/safe-query";
import { filterPublicPlans, sortPlansForDisplay } from "@/domain/plans/visibility";
import { presentPlanPrices, type PlanPricePresentation } from "@/domain/plans/pricing";
import type { Database } from "@/types/database";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type PlanPriceRow = Database["public"]["Tables"]["plan_prices"]["Row"];
type PlanBenefitRow = Database["public"]["Tables"]["plan_benefits"]["Row"];

export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  durationMonths: number | null;
  sessionsInPerson: number | null;
  sessionsOnline: number | null;
  availableForSale: boolean;
  benefits: string[];
  pricing: PlanPricePresentation;
};

function toPublicPlan(
  plan: PlanRow & { plan_prices: PlanPriceRow[]; plan_benefits: PlanBenefitRow[] },
): PublicPlan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    durationMonths: plan.duration_months,
    sessionsInPerson: plan.sessions_in_person,
    sessionsOnline: plan.sessions_online,
    availableForSale: plan.available_for_sale,
    benefits: plan.plan_benefits
      .filter((benefit) => benefit.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((benefit) => benefit.label),
    pricing: presentPlanPrices(plan.plan_prices),
  };
}

/**
 * Planos publicamente visíveis, com preços e benefícios (prompt Fase 4 §6):
 * nada de preço/visibilidade/benefício hardcoded — tudo vem de
 * `plans`/`plan_prices`/`plan_benefits`. A RLS `to anon` já esconde o ANUAL
 * (`publicly_visible = false`); `filterPublicPlans` reaplica a regra em
 * memória como segunda camada. `cache()` deduplica dentro de uma mesma
 * renderização (a Home e /planos pedem a mesma lista).
 */
export const getPublicPlans = cache(async (): Promise<QueryResult<PublicPlan[]>> => {
  return safeQuery("getPublicPlans", [], async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("plans")
      .select("*, plan_prices(*), plan_benefits(*)")
      .eq("active", true)
      .eq("publicly_visible", true);

    if (error) throw new Error(error.message);

    return sortPlansForDisplay(filterPublicPlans(data ?? []).map(toPublicPlan));
  });
});
