"use server";

import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { revalidatePublicSite } from "@/lib/revalidate";
import {
  benefitOrderSchema,
  planBenefitIdSchema,
  planBenefitSchema,
  planIdSchema,
  planPriceIdSchema,
  planPriceSchema,
  planSchema,
  planFlagErrors,
} from "@/validators/plans";
import * as service from "@/services/plans";

/**
 * Server Actions de planos/preços/benefícios (prompt Fase 14 §13–§19).
 * Toda alteração revalida o site público: preço e visibilidade são conteúdo
 * público e não podem ficar 10 minutos desatualizados (§49).
 */

export type PlanFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: number;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[plans] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function optionalInteger(formData: FormData, name: string): number | null {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? null : Number(value);
}

function revalidatePlans(planId?: string) {
  revalidatePath("/dashboard/planos");
  if (planId) revalidatePath(`/dashboard/planos/${planId}`);
  revalidatePublicSite();
}

export async function updatePlanAction(planId: string, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const id = planIdSchema.safeParse(planId);
  if (!id.success) return { error: domainErrorMessage("PLAN_NOT_FOUND") };

  const parsed = planSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationMonths: optionalInteger(formData, "durationMonths"),
    sessionsInPerson: optionalInteger(formData, "sessionsInPerson"),
    sessionsOnline: optionalInteger(formData, "sessionsOnline"),
    active: checkbox(formData, "active"),
    publiclyVisible: checkbox(formData, "publiclyVisible"),
    availableForSale: checkbox(formData, "availableForSale"),
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const flagErrors = planFlagErrors(parsed.data);
  if (Object.keys(flagErrors).length > 0) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: flagErrors };
  }

  try {
    await service.updatePlan(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(id.data);
  return { ok: true, savedAt: Date.now() };
}

function parsePriceForm(formData: FormData) {
  return planPriceSchema.safeParse({
    label: String(formData.get("label") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    installments: String(formData.get("installments") ?? "1"),
    paymentType: String(formData.get("paymentType") ?? ""),
    isPrimary: checkbox(formData, "isPrimary"),
    active: checkbox(formData, "active"),
  });
}

export async function createPlanPriceAction(planId: string, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const id = planIdSchema.safeParse(planId);
  if (!id.success) return { error: domainErrorMessage("PLAN_NOT_FOUND") };

  const parsed = parsePriceForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  try {
    await service.createPlanPrice(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(id.data);
  return { ok: true, savedAt: Date.now() };
}

export async function updatePlanPriceAction(
  planId: string,
  priceId: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const plan = planIdSchema.safeParse(planId);
  const price = planPriceIdSchema.safeParse(priceId);
  if (!plan.success || !price.success) return { error: domainErrorMessage("PLAN_PRICE_NOT_FOUND") };

  const parsed = parsePriceForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  try {
    await service.updatePlanPrice(nutritionist.id, plan.data, price.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(plan.data);
  return { ok: true, savedAt: Date.now() };
}

/**
 * Define a condição principal. `priceId` vazio = NENHUMA principal, que é o
 * estado atual (e legítimo) do trimestral/semestral (§16/§17/§67).
 */
export async function setPrimaryPriceAction(planId: string, priceId: string | null): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const plan = planIdSchema.safeParse(planId);
  if (!plan.success) return { error: domainErrorMessage("PLAN_NOT_FOUND") };

  let target: string | null = null;
  if (priceId) {
    const parsed = planPriceIdSchema.safeParse(priceId);
    if (!parsed.success) return { error: domainErrorMessage("PLAN_PRICE_NOT_FOUND") };
    target = parsed.data;
  }

  try {
    await service.setPrimaryPrice(nutritionist.id, plan.data, target);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(plan.data);
  return { ok: true, savedAt: Date.now() };
}

export async function createPlanBenefitAction(planId: string, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const plan = planIdSchema.safeParse(planId);
  if (!plan.success) return { error: domainErrorMessage("PLAN_NOT_FOUND") };

  const parsed = planBenefitSchema.safeParse({
    label: String(formData.get("label") ?? ""),
    active: checkbox(formData, "active"),
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  try {
    await service.createPlanBenefit(nutritionist.id, plan.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(plan.data);
  return { ok: true, savedAt: Date.now() };
}

export async function updatePlanBenefitAction(
  planId: string,
  benefitId: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const plan = planIdSchema.safeParse(planId);
  const benefit = planBenefitIdSchema.safeParse(benefitId);
  if (!plan.success || !benefit.success) return { error: domainErrorMessage("PLAN_BENEFIT_NOT_FOUND") };

  const parsed = planBenefitSchema.safeParse({
    label: String(formData.get("label") ?? ""),
    active: checkbox(formData, "active"),
  });
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  try {
    await service.updatePlanBenefit(nutritionist.id, plan.data, benefit.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(plan.data);
  return { ok: true, savedAt: Date.now() };
}

export async function movePlanBenefitAction(planId: string, benefitId: string, direction: "up" | "down"): Promise<PlanFormState> {
  const nutritionist = await requireNutritionist();
  const plan = planIdSchema.safeParse(planId);
  const parsed = benefitOrderSchema.safeParse({ benefitId, direction });
  if (!plan.success || !parsed.success) return { error: domainErrorMessage("PLAN_BENEFIT_NOT_FOUND") };

  try {
    await service.movePlanBenefit(nutritionist.id, plan.data, parsed.data.benefitId, parsed.data.direction);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePlans(plan.data);
  return { ok: true, savedAt: Date.now() };
}
