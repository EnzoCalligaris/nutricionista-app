import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { moveInOrder, nextSortOrder } from "@/domain/meal-plans/structure";
import { isEditable } from "@/domain/meal-plans/versioning";
import {
  getDayOwner,
  getMealItemOwner,
  getMealOwner,
  getMealPlanById,
  getSubstitutionOwner,
  getVersionOwner,
} from "@/data/meal-plans";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import type { CreateMealPlanInput, MealInput, MealItemInput, SubstitutionInput, UpdateMealPlanInput } from "@/validators/meal-plans";

/**
 * Casos de uso do cardápio (prompt Fase 8 §43). Toda escrita: ownership do
 * nutricionista reconferido no servidor (além da RLS), só versão DRAFT
 * (o banco também recusa), auditoria com ids — nunca alimentos/observações
 * (§63). Cópias e publicação passam pelas funções SQL transacionais.
 */

// --- Ownership helpers ---------------------------------------------------------

async function requireOwnedVersion(nutritionistId: string, versionId: string, options: { editable?: boolean } = {}) {
  const owner = await getVersionOwner(versionId);
  if (!owner || owner.nutritionistId !== nutritionistId) throw new DomainError("MEAL_PLAN_VERSION_NOT_FOUND");
  if (options.editable && !isEditable(owner.status)) throw new DomainError("MEAL_PLAN_VERSION_NOT_EDITABLE");
  return owner;
}

async function requireOwnedDay(nutritionistId: string, dayId: string) {
  const owner = await getDayOwner(dayId);
  if (!owner || owner.nutritionistId !== nutritionistId) throw new DomainError("MEAL_PLAN_DAY_NOT_FOUND");
  if (!isEditable(owner.status)) throw new DomainError("MEAL_PLAN_VERSION_NOT_EDITABLE");
  return owner;
}

async function requireOwnedMeal(nutritionistId: string, mealId: string) {
  const owner = await getMealOwner(mealId);
  if (!owner || owner.nutritionistId !== nutritionistId) throw new DomainError("MEAL_NOT_FOUND");
  if (!isEditable(owner.status)) throw new DomainError("MEAL_PLAN_VERSION_NOT_EDITABLE");
  return owner;
}

async function requireOwnedItem(nutritionistId: string, itemId: string) {
  const owner = await getMealItemOwner(itemId);
  if (!owner || owner.nutritionistId !== nutritionistId) throw new DomainError("MEAL_ITEM_NOT_FOUND");
  if (!isEditable(owner.status)) throw new DomainError("MEAL_PLAN_VERSION_NOT_EDITABLE");
  return owner;
}

async function requireOwnedSubstitution(nutritionistId: string, substitutionId: string) {
  const owner = await getSubstitutionOwner(substitutionId);
  if (!owner || owner.nutritionistId !== nutritionistId) throw new DomainError("MEAL_SUBSTITUTION_NOT_FOUND");
  if (!isEditable(owner.status)) throw new DomainError("MEAL_PLAN_VERSION_NOT_EDITABLE");
  return owner;
}

async function requireOwnedPlan(nutritionistId: string, planId: string) {
  const plan = await getMealPlanById(planId);
  if (!plan) throw new DomainError("MEAL_PLAN_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, plan.patientId);
  return plan;
}

/** Auditoria de edição de conteúdo: só ids e o tipo de operação. */
async function auditContentChange(nutritionistId: string, versionId: string, entity: string, op: "create" | "update" | "delete" | "move") {
  await recordAudit({
    actorId: nutritionistId,
    action: "MEAL_PLAN_UPDATED",
    entityType: "meal_plan_version",
    entityId: versionId,
    metadata: { entity, op },
  });
}

/**
 * Concorrência otimista (§66): a atualização só é aplicada se `updated_at`
 * ainda for o que a tela carregou; 0 linhas => alguém alterou antes.
 */
function ensureUpdated(rows: unknown[] | null): void {
  if (!rows || rows.length === 0) throw new DomainError("CONCURRENT_UPDATE");
}

// --- Plano -----------------------------------------------------------------------

export async function createMealPlan(nutritionistId: string, patientId: string, input: CreateMealPlanInput): Promise<{ planId: string; versionId: string }> {
  await requireOwnedPatient(nutritionistId, patientId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meal_plan", {
    p_patient_id: patientId,
    p_title: input.title,
    p_start_date: input.startDate ?? undefined,
    p_notes: input.notes ?? undefined,
    p_source_version_id: input.sourceVersionId ?? undefined,
  });
  if (error || !data) throw domainErrorFromDatabase(error);
  const plan = await getMealPlanById(data);
  const versionId = plan?.versions[0]?.id ?? "";
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_CREATED", entityType: "meal_plan", entityId: data, metadata: { patient_id: patientId, from_version_id: input.sourceVersionId ?? null } });
  return { planId: data, versionId };
}

export async function updateMealPlan(nutritionistId: string, planId: string, input: UpdateMealPlanInput): Promise<void> {
  const plan = await requireOwnedPlan(nutritionistId, planId);
  if (plan.archivedAt) throw new DomainError("MEAL_PLAN_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({ title: input.title, start_date: input.startDate ?? null, notes: input.notes ?? null })
    .eq("id", planId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_UPDATED", entityType: "meal_plan", entityId: planId, metadata: { entity: "plan", op: "update" } });
}

export async function archiveMealPlan(nutritionistId: string, planId: string): Promise<{ patientId: string }> {
  const plan = await requireOwnedPlan(nutritionistId, planId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_meal_plan", { p_plan_id: planId });
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_ARCHIVED", entityType: "meal_plan", entityId: planId });
  return { patientId: plan.patientId };
}

// --- Versões -----------------------------------------------------------------------

export async function createMealPlanVersion(nutritionistId: string, planId: string, sourceVersionId?: string | null): Promise<{ versionId: string; patientId: string }> {
  const plan = await requireOwnedPlan(nutritionistId, planId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meal_plan_version", { p_plan_id: planId, p_source_version_id: sourceVersionId ?? undefined });
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_VERSION_CREATED", entityType: "meal_plan_version", entityId: data, metadata: { plan_id: planId, source_version_id: sourceVersionId ?? null } });
  return { versionId: data, patientId: plan.patientId };
}

export async function publishMealPlanVersion(nutritionistId: string, versionId: string): Promise<{ patientId: string; planId: string }> {
  const owner = await requireOwnedVersion(nutritionistId, versionId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_meal_plan_version", { p_version_id: versionId });
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_VERSION_PUBLISHED", entityType: "meal_plan_version", entityId: versionId, metadata: { plan_id: owner.planId } });
  return { patientId: owner.patientId, planId: owner.planId };
}

export async function discardMealPlanVersion(nutritionistId: string, versionId: string): Promise<{ patientId: string }> {
  const owner = await requireOwnedVersion(nutritionistId, versionId, { editable: true });
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_meal_plan_version", { p_version_id: versionId });
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_VERSION_DISCARDED", entityType: "meal_plan_version", entityId: versionId, metadata: { plan_id: owner.planId } });
  return { patientId: owner.patientId };
}

export async function updateVersionNotes(nutritionistId: string, versionId: string, notes: string | null): Promise<void> {
  await requireOwnedVersion(nutritionistId, versionId, { editable: true });
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_versions").update({ notes }).eq("id", versionId);
  if (error) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, versionId, "version", "update");
}

// --- Dias -----------------------------------------------------------------------------

export async function addDay(nutritionistId: string, versionId: string, weekday: number): Promise<{ dayId: string }> {
  await requireOwnedVersion(nutritionistId, versionId, { editable: true });
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_plan_days").insert({ version_id: versionId, weekday }).select("id").single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, versionId, "day", "create");
  return { dayId: data.id };
}

export async function updateDay(nutritionistId: string, dayId: string, input: { notes: string | null; expectedUpdatedAt: string }): Promise<void> {
  const owner = await requireOwnedDay(nutritionistId, dayId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_plan_days").update({ notes: input.notes }).eq("id", dayId).eq("updated_at", input.expectedUpdatedAt).select("id");
  if (error) throw domainErrorFromDatabase(error);
  ensureUpdated(data);
  await auditContentChange(nutritionistId, owner.versionId, "day", "update");
}

export async function removeDay(nutritionistId: string, dayId: string): Promise<void> {
  const owner = await requireOwnedDay(nutritionistId, dayId);
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_days").delete().eq("id", dayId);
  if (error) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "day", "delete");
}

export async function duplicateDay(nutritionistId: string, dayId: string, targetWeekday: number, replace: boolean): Promise<{ dayId: string }> {
  const owner = await requireOwnedDay(nutritionistId, dayId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_meal_plan_day", { p_day_id: dayId, p_target_weekday: targetWeekday, p_replace: replace });
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_PLAN_DAY_DUPLICATED", entityType: "meal_plan_version", entityId: owner.versionId, metadata: { source_day_id: dayId, target_day_id: data, replaced: replace } });
  return { dayId: data };
}

// --- Refeições ----------------------------------------------------------------------

export async function addMeal(nutritionistId: string, dayId: string, input: MealInput): Promise<{ mealId: string }> {
  const owner = await requireOwnedDay(nutritionistId, dayId);
  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.from("meals").select("id, sort_order").eq("day_id", dayId);
  if (listError) throw domainErrorFromDatabase(listError);
  const sortOrder = nextSortOrder((existing ?? []).map((meal) => ({ id: meal.id, sortOrder: meal.sort_order })));
  const { data, error } = await supabase
    .from("meals")
    .insert({ day_id: dayId, name: input.name, time_of_day: input.timeOfDay ?? null, notes: input.notes ?? null, sort_order: sortOrder })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "meal", "create");
  return { mealId: data.id };
}

export async function updateMeal(nutritionistId: string, mealId: string, input: MealInput & { expectedUpdatedAt: string }): Promise<void> {
  const owner = await requireOwnedMeal(nutritionistId, mealId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .update({ name: input.name, time_of_day: input.timeOfDay ?? null, notes: input.notes ?? null })
    .eq("id", mealId)
    .eq("updated_at", input.expectedUpdatedAt)
    .select("id");
  if (error) throw domainErrorFromDatabase(error);
  ensureUpdated(data);
  await auditContentChange(nutritionistId, owner.versionId, "meal", "update");
}

export async function removeMeal(nutritionistId: string, mealId: string): Promise<void> {
  const owner = await requireOwnedMeal(nutritionistId, mealId);
  const supabase = await createClient();
  const { error } = await supabase.from("meals").delete().eq("id", mealId);
  if (error) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "meal", "delete");
}

export async function moveMeal(nutritionistId: string, mealId: string, direction: "up" | "down"): Promise<void> {
  const owner = await requireOwnedMeal(nutritionistId, mealId);
  const supabase = await createClient();
  const { data: siblings, error: listError } = await supabase.from("meals").select("id, sort_order").eq("day_id", owner.dayId);
  if (listError) throw domainErrorFromDatabase(listError);
  const changes = moveInOrder((siblings ?? []).map((meal) => ({ id: meal.id, sortOrder: meal.sort_order })), mealId, direction);
  for (const change of changes) {
    const { error } = await supabase.from("meals").update({ sort_order: change.sortOrder }).eq("id", change.id);
    if (error) throw domainErrorFromDatabase(error);
  }
  if (changes.length > 0) await auditContentChange(nutritionistId, owner.versionId, "meal", "move");
}

export async function duplicateMeal(nutritionistId: string, mealId: string, targetDayId?: string | null): Promise<{ mealId: string }> {
  const owner = await requireOwnedMeal(nutritionistId, mealId);
  if (targetDayId) {
    const target = await requireOwnedDay(nutritionistId, targetDayId);
    if (target.versionId !== owner.versionId) throw new DomainError("MEAL_PLAN_DAY_NOT_FOUND");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_meal", { p_meal_id: mealId, p_target_day_id: targetDayId ?? undefined });
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MEAL_DUPLICATED", entityType: "meal_plan_version", entityId: owner.versionId, metadata: { source_meal_id: mealId, new_meal_id: data, target_day_id: targetDayId ?? owner.dayId } });
  return { mealId: data };
}

// --- Alimentos ----------------------------------------------------------------------

function itemPayload(input: MealItemInput) {
  return {
    food_name: input.foodName,
    quantity: input.quantity,
    unit: input.unit,
    calories: input.calories ?? null,
    protein_g: input.proteinG ?? null,
    carbs_g: input.carbsG ?? null,
    fat_g: input.fatG ?? null,
    fiber_g: input.fiberG ?? null,
    instructions: input.instructions ?? null,
    notes: input.notes ?? null,
  };
}

export async function addMealItem(nutritionistId: string, mealId: string, input: MealItemInput): Promise<{ itemId: string }> {
  const owner = await requireOwnedMeal(nutritionistId, mealId);
  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.from("meal_items").select("id, sort_order").eq("meal_id", mealId);
  if (listError) throw domainErrorFromDatabase(listError);
  const sortOrder = nextSortOrder((existing ?? []).map((item) => ({ id: item.id, sortOrder: item.sort_order })));
  const { data, error } = await supabase
    .from("meal_items")
    .insert({ meal_id: mealId, sort_order: sortOrder, ...itemPayload(input) })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "meal_item", "create");
  return { itemId: data.id };
}

export async function updateMealItem(nutritionistId: string, itemId: string, input: MealItemInput & { expectedUpdatedAt: string }): Promise<void> {
  const owner = await requireOwnedItem(nutritionistId, itemId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_items").update(itemPayload(input)).eq("id", itemId).eq("updated_at", input.expectedUpdatedAt).select("id");
  if (error) throw domainErrorFromDatabase(error);
  ensureUpdated(data);
  await auditContentChange(nutritionistId, owner.versionId, "meal_item", "update");
}

export async function removeMealItem(nutritionistId: string, itemId: string): Promise<void> {
  const owner = await requireOwnedItem(nutritionistId, itemId);
  const supabase = await createClient();
  const { error } = await supabase.from("meal_items").delete().eq("id", itemId);
  if (error) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "meal_item", "delete");
}

export async function moveMealItem(nutritionistId: string, itemId: string, direction: "up" | "down"): Promise<void> {
  const owner = await requireOwnedItem(nutritionistId, itemId);
  const supabase = await createClient();
  const { data: siblings, error: listError } = await supabase.from("meal_items").select("id, sort_order").eq("meal_id", owner.mealId);
  if (listError) throw domainErrorFromDatabase(listError);
  const changes = moveInOrder((siblings ?? []).map((item) => ({ id: item.id, sortOrder: item.sort_order })), itemId, direction);
  for (const change of changes) {
    const { error } = await supabase.from("meal_items").update({ sort_order: change.sortOrder }).eq("id", change.id);
    if (error) throw domainErrorFromDatabase(error);
  }
  if (changes.length > 0) await auditContentChange(nutritionistId, owner.versionId, "meal_item", "move");
}

// --- Substituições ----------------------------------------------------------------

function substitutionPayload(input: SubstitutionInput) {
  return {
    substitute_food_name: input.substituteFoodName,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    calories: input.calories ?? null,
    protein_g: input.proteinG ?? null,
    carbs_g: input.carbsG ?? null,
    fat_g: input.fatG ?? null,
    notes: input.notes ?? null,
  };
}

export async function addSubstitution(nutritionistId: string, itemId: string, input: SubstitutionInput): Promise<{ substitutionId: string }> {
  const owner = await requireOwnedItem(nutritionistId, itemId);
  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.from("meal_substitutions").select("id, sort_order").eq("meal_item_id", itemId);
  if (listError) throw domainErrorFromDatabase(listError);
  const sortOrder = nextSortOrder((existing ?? []).map((sub) => ({ id: sub.id, sortOrder: sub.sort_order })));
  const { data, error } = await supabase
    .from("meal_substitutions")
    .insert({ meal_item_id: itemId, sort_order: sortOrder, ...substitutionPayload(input) })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "substitution", "create");
  return { substitutionId: data.id };
}

export async function updateSubstitution(nutritionistId: string, substitutionId: string, input: SubstitutionInput & { expectedUpdatedAt: string }): Promise<void> {
  const owner = await requireOwnedSubstitution(nutritionistId, substitutionId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_substitutions")
    .update(substitutionPayload(input))
    .eq("id", substitutionId)
    .eq("updated_at", input.expectedUpdatedAt)
    .select("id");
  if (error) throw domainErrorFromDatabase(error);
  ensureUpdated(data);
  await auditContentChange(nutritionistId, owner.versionId, "substitution", "update");
}

export async function removeSubstitution(nutritionistId: string, substitutionId: string): Promise<void> {
  const owner = await requireOwnedSubstitution(nutritionistId, substitutionId);
  const supabase = await createClient();
  const { error } = await supabase.from("meal_substitutions").delete().eq("id", substitutionId);
  if (error) throw domainErrorFromDatabase(error);
  await auditContentChange(nutritionistId, owner.versionId, "substitution", "delete");
}
