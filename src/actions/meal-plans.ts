"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { parseQuantity } from "@/domain/meal-plans/quantities";
import {
  addDaySchema,
  createMealPlanSchema,
  dayIdSchema,
  duplicateDaySchema,
  mealIdSchema,
  mealItemIdSchema,
  mealItemSchema,
  mealPlanIdSchema,
  mealSchema,
  moveSchema,
  substitutionIdSchema,
  substitutionSchema,
  updateDaySchema,
  updateMealItemSchema,
  updateMealPlanSchema,
  updateMealSchema,
  updateSubstitutionSchema,
  updateVersionNotesSchema,
  versionIdSchema,
} from "@/validators/meal-plans";
import * as service from "@/services/meal-plans";
import { patientIdSchema } from "@/validators/patients";

/**
 * Server Actions do cardápio (prompt Fase 8 §44–§45): requireNutritionist,
 * Zod só com campos de negócio (patient_id vem da rota/contexto e é
 * reconferido por ownership; nutritionist_id, status, version_number,
 * published_by nunca vêm do client), service, revalidação. Toast só depois
 * do servidor confirmar.
 */

export type MealPlanFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };
export type EditorResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[meal-plans] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateMealPlan(patientId: string, versionId?: string) {
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath(`/dashboard/pacientes/${patientId}/cardapio`, "layout");
  revalidatePath("/dashboard/cardapios");
  revalidatePath("/paciente/cardapio");
  revalidatePath("/paciente");
  if (versionId) revalidatePath(`/dashboard/pacientes/${patientId}/cardapio/${versionId}`);
}

/** Converte números opcionais vindos como texto ("" => null; inválido => NaN para o Zod acusar). */
function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "") return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function run<T>(fn: () => Promise<T>): Promise<EditorResult & { data?: T }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// --- Plano (formulários com redirect) ---------------------------------------------

export async function createMealPlanAction(patientId: string, _prev: MealPlanFormState, formData: FormData): Promise<MealPlanFormState> {
  const nutritionist = await requireNutritionist();
  const values = { title: str(formData, "title"), startDate: str(formData, "startDate"), notes: str(formData, "notes"), sourceVersionId: str(formData, "sourceVersionId") };
  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values };
  const parsed = createMealPlanSchema.safeParse(values);
  if (!parsed.success) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  let created: { planId: string; versionId: string };
  try {
    created = await service.createMealPlan(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateMealPlan(id.data);
  redirect(`/dashboard/pacientes/${id.data}/cardapio/${created.versionId}?toast=meal_plan_created`);
}

export async function updateMealPlanAction(planId: string, patientId: string, _prev: MealPlanFormState, formData: FormData): Promise<MealPlanFormState> {
  const nutritionist = await requireNutritionist();
  const values = { title: str(formData, "title"), startDate: str(formData, "startDate"), notes: str(formData, "notes") };
  const id = mealPlanIdSchema.safeParse(planId);
  if (!id.success) return { error: domainErrorMessage("MEAL_PLAN_NOT_FOUND"), values };
  const parsed = updateMealPlanSchema.safeParse(values);
  if (!parsed.success) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  try {
    await service.updateMealPlan(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateMealPlan(patientId);
  redirect(`/dashboard/pacientes/${patientId}?tab=cardapio&toast=meal_plan_updated`);
}

// --- Ações do editor (retorno simples; a tela faz router.refresh()) ---------------

export async function archiveMealPlanAction(planId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealPlanIdSchema.safeParse(planId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_NOT_FOUND") };
  const result = await run(() => service.archiveMealPlan(nutritionist.id, id.data));
  if (result.ok && result.data) revalidateMealPlan(result.data.patientId);
  return result;
}

export async function createVersionAction(planId: string, sourceVersionId?: string | null): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealPlanIdSchema.safeParse(planId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_NOT_FOUND") };
  const source = sourceVersionId ? versionIdSchema.safeParse(sourceVersionId) : null;
  if (source && !source.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_VERSION_NOT_FOUND") };
  const result = await run(() => service.createMealPlanVersion(nutritionist.id, id.data, source?.data ?? null));
  if (result.ok && result.data) {
    revalidateMealPlan(result.data.patientId, result.data.versionId);
    return { ok: true, id: result.data.versionId };
  }
  return result;
}

export async function publishVersionAction(versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = versionIdSchema.safeParse(versionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_VERSION_NOT_FOUND") };
  const result = await run(() => service.publishMealPlanVersion(nutritionist.id, id.data));
  if (result.ok && result.data) revalidateMealPlan(result.data.patientId, id.data);
  return result;
}

export async function discardVersionAction(versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = versionIdSchema.safeParse(versionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_VERSION_NOT_FOUND") };
  const result = await run(() => service.discardMealPlanVersion(nutritionist.id, id.data));
  if (result.ok && result.data) revalidateMealPlan(result.data.patientId);
  return result;
}

export async function updateVersionNotesAction(versionId: string, patientId: string, input: { notes: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = versionIdSchema.safeParse(versionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_VERSION_NOT_FOUND") };
  const parsed = updateVersionNotesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.updateVersionNotes(nutritionist.id, id.data, parsed.data.notes ?? null));
  if (result.ok) revalidateMealPlan(patientId, id.data);
  return result;
}

// Dias --------------------------------------------------------------------------------

export async function addDayAction(versionId: string, patientId: string, input: { weekday: number }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = versionIdSchema.safeParse(versionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_VERSION_NOT_FOUND") };
  const parsed = addDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.addDay(nutritionist.id, id.data, parsed.data.weekday));
  if (result.ok) revalidateMealPlan(patientId, id.data);
  return result.ok ? { ok: true, id: result.data?.dayId } : result;
}

export async function updateDayAction(dayId: string, patientId: string, versionId: string, input: { notes: string; expectedUpdatedAt: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = dayIdSchema.safeParse(dayId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_DAY_NOT_FOUND") };
  const parsed = updateDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.updateDay(nutritionist.id, id.data, { notes: parsed.data.notes ?? null, expectedUpdatedAt: parsed.data.expectedUpdatedAt }));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function removeDayAction(dayId: string, patientId: string, versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = dayIdSchema.safeParse(dayId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_DAY_NOT_FOUND") };
  const result = await run(() => service.removeDay(nutritionist.id, id.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function duplicateDayAction(dayId: string, patientId: string, versionId: string, input: { targetWeekday: number; replace: boolean }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = dayIdSchema.safeParse(dayId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_DAY_NOT_FOUND") };
  const parsed = duplicateDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.duplicateDay(nutritionist.id, id.data, parsed.data.targetWeekday, parsed.data.replace));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result.ok ? { ok: true, id: result.data?.dayId } : result;
}

// Refeições ----------------------------------------------------------------------------

export async function addMealAction(dayId: string, patientId: string, versionId: string, input: { name: string; timeOfDay: string; notes: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = dayIdSchema.safeParse(dayId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_DAY_NOT_FOUND") };
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.addMeal(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result.ok ? { ok: true, id: result.data?.mealId } : result;
}

export async function updateMealAction(mealId: string, patientId: string, versionId: string, input: { name: string; timeOfDay: string; notes: string; expectedUpdatedAt: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealIdSchema.safeParse(mealId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_NOT_FOUND") };
  const parsed = updateMealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.updateMeal(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function removeMealAction(mealId: string, patientId: string, versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealIdSchema.safeParse(mealId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_NOT_FOUND") };
  const result = await run(() => service.removeMeal(nutritionist.id, id.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function moveMealAction(mealId: string, patientId: string, versionId: string, direction: "up" | "down"): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealIdSchema.safeParse(mealId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_NOT_FOUND") };
  const parsed = moveSchema.safeParse({ direction });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR") };
  const result = await run(() => service.moveMeal(nutritionist.id, id.data, parsed.data.direction));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function duplicateMealAction(mealId: string, patientId: string, versionId: string, targetDayId?: string | null): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealIdSchema.safeParse(mealId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_NOT_FOUND") };
  const target = targetDayId ? dayIdSchema.safeParse(targetDayId) : null;
  if (target && !target.success) return { ok: false, error: domainErrorMessage("MEAL_PLAN_DAY_NOT_FOUND") };
  const result = await run(() => service.duplicateMeal(nutritionist.id, id.data, target?.data ?? null));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result.ok ? { ok: true, id: result.data?.mealId } : result;
}

// Alimentos ---------------------------------------------------------------------------

export type MealItemFormInput = {
  foodName: string;
  quantity: string;
  unit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  instructions: string;
  notes: string;
};

function parseItemInput(input: MealItemFormInput) {
  const quantity = parseQuantity(input.quantity);
  return {
    foodName: input.foodName,
    quantity: quantity ?? Number.NaN,
    unit: input.unit,
    calories: optionalNumber(input.calories),
    proteinG: optionalNumber(input.proteinG),
    carbsG: optionalNumber(input.carbsG),
    fatG: optionalNumber(input.fatG),
    fiberG: optionalNumber(input.fiberG),
    instructions: input.instructions,
    notes: input.notes,
  };
}

export async function addMealItemAction(mealId: string, patientId: string, versionId: string, input: MealItemFormInput): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealIdSchema.safeParse(mealId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_NOT_FOUND") };
  const parsed = mealItemSchema.safeParse(parseItemInput(input));
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.addMealItem(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result.ok ? { ok: true, id: result.data?.itemId } : result;
}

export async function updateMealItemAction(itemId: string, patientId: string, versionId: string, input: MealItemFormInput & { expectedUpdatedAt: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_ITEM_NOT_FOUND") };
  const parsed = updateMealItemSchema.safeParse({ ...parseItemInput(input), expectedUpdatedAt: input.expectedUpdatedAt });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.updateMealItem(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function removeMealItemAction(itemId: string, patientId: string, versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_ITEM_NOT_FOUND") };
  const result = await run(() => service.removeMealItem(nutritionist.id, id.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function moveMealItemAction(itemId: string, patientId: string, versionId: string, direction: "up" | "down"): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_ITEM_NOT_FOUND") };
  const parsed = moveSchema.safeParse({ direction });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR") };
  const result = await run(() => service.moveMealItem(nutritionist.id, id.data, parsed.data.direction));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

// Substituições --------------------------------------------------------------------

export type SubstitutionFormInput = {
  substituteFoodName: string;
  quantity: string;
  unit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  notes: string;
};

function parseSubstitutionInput(input: SubstitutionFormInput) {
  const quantityText = input.quantity.trim();
  const quantity = quantityText === "" ? null : (parseQuantity(quantityText) ?? Number.NaN);
  return {
    substituteFoodName: input.substituteFoodName,
    quantity,
    unit: input.unit.trim() === "" ? null : input.unit,
    calories: optionalNumber(input.calories),
    proteinG: optionalNumber(input.proteinG),
    carbsG: optionalNumber(input.carbsG),
    fatG: optionalNumber(input.fatG),
    notes: input.notes,
  };
}

export async function addSubstitutionAction(itemId: string, patientId: string, versionId: string, input: SubstitutionFormInput): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = mealItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_ITEM_NOT_FOUND") };
  const parsed = substitutionSchema.safeParse(parseSubstitutionInput(input));
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.addSubstitution(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result.ok ? { ok: true, id: result.data?.substitutionId } : result;
}

export async function updateSubstitutionAction(substitutionId: string, patientId: string, versionId: string, input: SubstitutionFormInput & { expectedUpdatedAt: string }): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = substitutionIdSchema.safeParse(substitutionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_SUBSTITUTION_NOT_FOUND") };
  const parsed = updateSubstitutionSchema.safeParse({ ...parseSubstitutionInput(input), expectedUpdatedAt: input.expectedUpdatedAt });
  if (!parsed.success) return { ok: false, error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const result = await run(() => service.updateSubstitution(nutritionist.id, id.data, parsed.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}

export async function removeSubstitutionAction(substitutionId: string, patientId: string, versionId: string): Promise<EditorResult> {
  const nutritionist = await requireNutritionist();
  const id = substitutionIdSchema.safeParse(substitutionId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MEAL_SUBSTITUTION_NOT_FOUND") };
  const result = await run(() => service.removeSubstitution(nutritionist.id, id.data));
  if (result.ok) revalidateMealPlan(patientId, versionId);
  return result;
}
