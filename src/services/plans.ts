import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { recordAudit } from "@/services/audit";
import { getAdminPlan } from "@/data/plans";
import { planFlagErrors, type PlanBenefitInput, type PlanInput, type PlanPriceInput } from "@/validators/plans";

/**
 * Casos de uso de plano / condição de preço / benefício (prompt Fase 14
 * §13–§19).
 *
 * Decisões:
 * - `code` nunca muda: contratos e o catálogo real dependem dele;
 * - preço NÃO é sobrescrito quando já foi usado — desativar e criar outra
 *   condição preserva o histórico (`plan_prices` é versionado desde a Fase 2);
 * - a condição principal é trocada por uma única função SQL
 *   (`set_plan_primary_price`), porque o índice único parcial não permite
 *   dois primários nem por um instante (§66);
 * - o ANUAL continua `publicly_visible = false` por padrão: nada aqui liga
 *   visibilidade por conta própria (§14).
 */

async function requirePlan(planId: string) {
  const plan = await getAdminPlan(planId);
  if (!plan) throw new DomainError("PLAN_NOT_FOUND");
  return plan;
}

export async function updatePlan(nutritionistId: string, planId: string, input: PlanInput): Promise<void> {
  const plan = await requirePlan(planId);
  if (Object.keys(planFlagErrors(input)).length > 0) throw new DomainError("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: input.name,
      description: input.description,
      duration_months: input.durationMonths,
      sessions_in_person: input.sessionsInPerson,
      sessions_online: input.sessionsOnline,
      active: input.active,
      publicly_visible: input.publiclyVisible,
      available_for_sale: input.availableForSale,
    })
    .eq("id", planId);
  if (error) throw domainErrorFromDatabase(error);

  const changed = [
    ...(plan.name !== input.name ? ["name"] : []),
    ...((plan.description ?? null) !== input.description ? ["description"] : []),
    ...(plan.durationMonths !== input.durationMonths ? ["duration_months"] : []),
    ...(plan.sessionsInPerson !== input.sessionsInPerson ? ["sessions_in_person"] : []),
    ...(plan.sessionsOnline !== input.sessionsOnline ? ["sessions_online"] : []),
    ...(plan.active !== input.active ? ["active"] : []),
    ...(plan.publiclyVisible !== input.publiclyVisible ? ["publicly_visible"] : []),
    ...(plan.availableForSale !== input.availableForSale ? ["available_for_sale"] : []),
  ];

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_UPDATED",
    entityType: "plan",
    entityId: planId,
    metadata: {
      code: plan.code,
      changed_fields: changed,
      active: input.active,
      publicly_visible: input.publiclyVisible,
      available_for_sale: input.availableForSale,
    },
  });
}

export async function createPlanPrice(nutritionistId: string, planId: string, input: PlanPriceInput): Promise<{ priceId: string }> {
  await requirePlan(planId);
  const supabase = await createClient();

  // Criar já como principal exige limpar a anterior primeiro (índice único).
  const { data, error } = await supabase
    .from("plan_prices")
    .insert({
      plan_id: planId,
      label: input.label,
      amount_cents: input.amountCents,
      installments: input.installments,
      payment_type: input.paymentType,
      active: input.active,
      is_primary: false,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_PRICE_CREATED",
    entityType: "plan_price",
    entityId: data.id,
    metadata: { plan_id: planId, amount_cents: input.amountCents, installments: input.installments, payment_type: input.paymentType, active: input.active },
  });

  if (input.isPrimary && input.active) {
    await setPrimaryPrice(nutritionistId, planId, data.id);
  }
  return { priceId: data.id };
}

export async function updatePlanPrice(
  nutritionistId: string,
  planId: string,
  priceId: string,
  input: PlanPriceInput,
): Promise<void> {
  const plan = await requirePlan(planId);
  const price = plan.prices.find((candidate) => candidate.id === priceId);
  if (!price) throw new DomainError("PLAN_PRICE_NOT_FOUND");

  const supabase = await createClient();
  // Desativar uma condição principal também a tira do destaque, senão o
  // plano ficaria com um "principal" invisível no site.
  const keepPrimary = input.isPrimary && input.active;
  const { error } = await supabase
    .from("plan_prices")
    .update({
      label: input.label,
      amount_cents: input.amountCents,
      installments: input.installments,
      payment_type: input.paymentType,
      active: input.active,
      ...(price.isPrimary && !keepPrimary ? { is_primary: false } : {}),
    })
    .eq("id", priceId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_PRICE_UPDATED",
    entityType: "plan_price",
    entityId: priceId,
    metadata: {
      plan_id: planId,
      amount_cents: input.amountCents,
      installments: input.installments,
      payment_type: input.paymentType,
      active: input.active,
      is_primary: keepPrimary,
    },
  });

  if (keepPrimary && !price.isPrimary) await setPrimaryPrice(nutritionistId, planId, priceId);
}

/**
 * Define (ou limpa, com `priceId = null`) a condição principal do plano.
 * "Nenhuma principal" é um estado LEGÍTIMO — é o do trimestral/semestral
 * hoje, e o site então exibe as opções sem eleger nenhuma (§16/§17/§67).
 */
export async function setPrimaryPrice(nutritionistId: string, planId: string, priceId: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = priceId
    ? await supabase.rpc("set_plan_primary_price", { p_plan_id: planId, p_price_id: priceId })
    : await supabase.rpc("clear_plan_primary_price", { p_plan_id: planId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_PRICE_PRIMARY_SET",
    entityType: "plan",
    entityId: planId,
    metadata: { price_id: priceId },
  });
}

export async function createPlanBenefit(nutritionistId: string, planId: string, input: PlanBenefitInput): Promise<void> {
  const plan = await requirePlan(planId);
  const nextOrder = plan.benefits.reduce((max, benefit) => Math.max(max, benefit.sortOrder), 0) + 1;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_benefits")
    .insert({ plan_id: planId, label: input.label, active: input.active, sort_order: nextOrder })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_BENEFIT_CREATED",
    entityType: "plan_benefit",
    entityId: data.id,
    metadata: { plan_id: planId, active: input.active, sort_order: nextOrder },
  });
}

export async function updatePlanBenefit(
  nutritionistId: string,
  planId: string,
  benefitId: string,
  input: PlanBenefitInput,
): Promise<void> {
  const plan = await requirePlan(planId);
  const benefit = plan.benefits.find((candidate) => candidate.id === benefitId);
  if (!benefit) throw new DomainError("PLAN_BENEFIT_NOT_FOUND");

  const supabase = await createClient();
  const { error } = await supabase.from("plan_benefits").update({ label: input.label, active: input.active }).eq("id", benefitId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_BENEFIT_UPDATED",
    entityType: "plan_benefit",
    entityId: benefitId,
    metadata: {
      plan_id: planId,
      changed_fields: [...(benefit.label !== input.label ? ["label"] : []), ...(benefit.active !== input.active ? ["active"] : [])],
      active: input.active,
    },
  });
}

/** Sobe/desce um benefício trocando a posição com o vizinho, numa transação. */
export async function movePlanBenefit(
  nutritionistId: string,
  planId: string,
  benefitId: string,
  direction: "up" | "down",
): Promise<void> {
  const plan = await requirePlan(planId);
  const ordered = [...plan.benefits].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((benefit) => benefit.id === benefitId);
  if (index === -1) throw new DomainError("PLAN_BENEFIT_NOT_FOUND");

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  const neighbour = ordered[neighbourIndex];
  // Já está no topo/fim: nada a fazer (não é erro).
  if (!neighbour) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("swap_plan_benefit_order", {
    p_benefit_id: benefitId,
    p_other_benefit_id: neighbour.id,
  });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PLAN_BENEFIT_REORDERED",
    entityType: "plan_benefit",
    entityId: benefitId,
    metadata: { plan_id: planId, direction, swapped_with: neighbour.id },
  });
}
