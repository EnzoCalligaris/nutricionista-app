import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
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

// ---------------------------------------------------------------------------
// Dashboard (Fase 5) — catálogo completo para vender/registrar contrato.
// ---------------------------------------------------------------------------

export type DashboardPlanPrice = {
  id: string;
  label: string;
  amountCents: number;
  installments: number;
  paymentType: PlanPriceRow["payment_type"];
  isPrimary: boolean;
};

export type DashboardPlan = {
  id: string;
  code: string;
  name: string;
  durationMonths: number | null;
  sessionsInPerson: number | null;
  sessionsOnline: number | null;
  publiclyVisible: boolean;
  availableForSale: boolean;
  benefits: string[];
  /** Todas as condições de preço ativas — o nutricionista escolhe a vendida (§29). */
  prices: DashboardPlanPrice[];
};

const DASHBOARD_ORDER = ["AVULSA", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];

/**
 * Planos ATIVOS lidos com o cliente de sessão do nutricionista (policy
 * `plans_select_nutritionist`), incluindo o ANUAL que o site não mostra
 * (`publicly_visible = false`) — no dashboard ele existe para histórico,
 * clientes antigos e contratos manuais (prompt Fase 5 §31). Nenhum preço é
 * eleito "principal" aqui: `isPrimary` só reflete o banco.
 */
export async function getDashboardPlans(): Promise<DashboardPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*, plan_prices(*), plan_benefits(*)")
    .eq("active", true);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      durationMonths: plan.duration_months,
      sessionsInPerson: plan.sessions_in_person,
      sessionsOnline: plan.sessions_online,
      publiclyVisible: plan.publicly_visible,
      availableForSale: plan.available_for_sale,
      benefits: plan.plan_benefits
        .filter((benefit) => benefit.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((benefit) => benefit.label),
      prices: plan.plan_prices
        .filter((price) => price.active)
        .sort((a, b) => a.amount_cents - b.amount_cents)
        .map((price) => ({
          id: price.id,
          label: price.label,
          amountCents: price.amount_cents,
          installments: price.installments,
          paymentType: price.payment_type,
          isPrimary: price.is_primary,
        })),
    }))
    .sort((a, b) => {
      const ia = DASHBOARD_ORDER.indexOf(a.code);
      const ib = DASHBOARD_ORDER.indexOf(b.code);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });
}

// ---------------------------------------------------------------------------
// Administração de planos (Fase 14) — catálogo COMPLETO, inclusive inativos.
// ---------------------------------------------------------------------------

export type AdminPlanPrice = {
  id: string;
  label: string;
  amountCents: number;
  installments: number;
  paymentType: PlanPriceRow["payment_type"];
  isPrimary: boolean;
  active: boolean;
  validFrom: string;
  validUntil: string | null;
};

export type AdminPlanBenefit = { id: string; label: string; sortOrder: number; active: boolean };

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationMonths: number | null;
  sessionsInPerson: number | null;
  sessionsOnline: number | null;
  active: boolean;
  publiclyVisible: boolean;
  availableForSale: boolean;
  prices: AdminPlanPrice[];
  benefits: AdminPlanBenefit[];
  /** Tem preço ativo mas nenhum marcado como principal (§16/§17). */
  pendingPrimary: boolean;
};

const ADMIN_ORDER = ["AVULSA", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];

function toAdminPlan(
  plan: PlanRow & { plan_prices: PlanPriceRow[]; plan_benefits: PlanBenefitRow[] },
): AdminPlan {
  const prices = [...plan.plan_prices]
    .sort((a, b) => Number(b.active) - Number(a.active) || a.amount_cents - b.amount_cents)
    .map((price) => ({
      id: price.id,
      label: price.label,
      amountCents: price.amount_cents,
      installments: price.installments,
      paymentType: price.payment_type,
      isPrimary: price.is_primary,
      active: price.active,
      validFrom: price.valid_from,
      validUntil: price.valid_until,
    }));

  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    durationMonths: plan.duration_months,
    sessionsInPerson: plan.sessions_in_person,
    sessionsOnline: plan.sessions_online,
    active: plan.active,
    publiclyVisible: plan.publicly_visible,
    availableForSale: plan.available_for_sale,
    prices,
    benefits: [...plan.plan_benefits]
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "pt-BR"))
      .map((benefit) => ({ id: benefit.id, label: benefit.label, sortOrder: benefit.sort_order, active: benefit.active })),
    pendingPrimary: prices.some((price) => price.active) && !prices.some((price) => price.active && price.isPrimary),
  };
}

/**
 * Todos os planos, inclusive inativos e com preços/benefícios desativados —
 * o admin precisa ver e controlar o que o site não mostra (§14: o ANUAL
 * existe aqui com `publicly_visible = false`, e continua assim por padrão).
 */
export async function getAdminPlans(): Promise<AdminPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("*, plan_prices(*), plan_benefits(*)");
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map(toAdminPlan)
    .sort((a, b) => {
      const ia = ADMIN_ORDER.indexOf(a.code);
      const ib = ADMIN_ORDER.indexOf(b.code);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });
}

export async function getAdminPlan(planId: string): Promise<AdminPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("*, plan_prices(*), plan_benefits(*)").eq("id", planId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAdminPlan(data) : null;
}
