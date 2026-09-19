import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { MealPlanVersionStatus, Weekday } from "@/domain/meal-plans/definitions";
import { sortStructure, type MealPlanDay } from "@/domain/meal-plans/structure";
import { sortVersionsDesc, type VersionSummary } from "@/domain/meal-plans/versioning";

/**
 * Queries do cardápio (prompt Fase 8 §41/§60–§61). Cliente de sessão: a RLS
 * da Fase 2 já limita nutricionista aos próprios pacientes e paciente à
 * versão PUBLISHED. Lista de versões = metadata; conteúdo só ao abrir uma
 * versão (uma query aninhada, sem N+1).
 */

export type MealPlanSummary = {
  id: string;
  patientId: string;
  title: string;
  startDate: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions: MealPlanVersionMeta[];
};

export type MealPlanVersionMeta = VersionSummary & {
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string;
  createdByName: string | null;
  publishedByName: string | null;
};

const PLAN_SELECT =
  "id, patient_id, title, start_date, notes, archived_at, created_at, updated_at, meal_plan_versions(id, version_number, status, notes, published_at, archived_at, created_at, updated_at, created_by, published_by, creator:profiles!meal_plan_versions_created_by_fkey(full_name), publisher:profiles!meal_plan_versions_published_by_fkey(full_name))";

type PlanRow = {
  id: string;
  patient_id: string;
  title: string;
  start_date: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  meal_plan_versions: {
    id: string;
    version_number: number;
    status: MealPlanVersionStatus;
    notes: string | null;
    published_at: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    creator: { full_name: string } | null;
    publisher: { full_name: string } | null;
  }[];
};

function toSummary(row: PlanRow): MealPlanSummary {
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    startDate: row.start_date,
    notes: row.notes,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: sortVersionsDesc(
      row.meal_plan_versions.map((version) => ({
        id: version.id,
        versionNumber: version.version_number,
        status: version.status,
        notes: version.notes,
        publishedAt: version.published_at,
        archivedAt: version.archived_at,
        createdAt: version.created_at,
        updatedAt: version.updated_at,
        createdByName: version.creator?.full_name ?? null,
        publishedByName: version.publisher?.full_name ?? null,
      })),
    ),
  };
}

/** Planos do paciente (ativo primeiro, depois arquivados), só metadata. */
export async function listPatientMealPlans(patientId: string): Promise<MealPlanSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select(PLAN_SELECT)
    .eq("patient_id", patientId)
    .order("archived_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as unknown as PlanRow[]).map(toSummary);
}

export async function getMealPlanById(planId: string): Promise<MealPlanSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_plans").select(PLAN_SELECT).eq("id", planId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toSummary(data as unknown as PlanRow) : null;
}

export type MealPlanVersionFull = {
  id: string;
  versionNumber: number;
  status: MealPlanVersionStatus;
  notes: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: { id: string; patientId: string; nutritionistId: string; title: string; startDate: string | null; notes: string | null; archivedAt: string | null };
  days: MealPlanDay[];
};

const VERSION_SELECT =
  "id, version_number, status, notes, published_at, archived_at, created_at, updated_at, meal_plans!inner(id, patient_id, nutritionist_id, title, start_date, notes, archived_at), meal_plan_days(id, weekday, notes, updated_at, meals(id, name, time_of_day, notes, sort_order, updated_at, meal_items(id, food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, instructions, notes, sort_order, updated_at, meal_substitutions(id, substitute_food_name, quantity, unit, calories, protein_g, carbs_g, fat_g, notes, sort_order, updated_at))))";

type VersionRow = {
  id: string;
  version_number: number;
  status: MealPlanVersionStatus;
  notes: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  meal_plans: { id: string; patient_id: string; nutritionist_id: string; title: string; start_date: string | null; notes: string | null; archived_at: string | null };
  meal_plan_days: {
    id: string;
    weekday: number;
    notes: string | null;
    updated_at: string;
    meals: {
      id: string;
      name: string;
      time_of_day: string | null;
      notes: string | null;
      sort_order: number;
      updated_at: string;
      meal_items: {
        id: string;
        food_name: string;
        quantity: number;
        unit: string;
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        fiber_g: number | null;
        instructions: string | null;
        notes: string | null;
        sort_order: number;
        updated_at: string;
        meal_substitutions: {
          id: string;
          substitute_food_name: string;
          quantity: number | null;
          unit: string | null;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          notes: string | null;
          sort_order: number;
          updated_at: string;
        }[];
      }[];
    }[];
  }[];
};

const num = (value: number | string | null): number | null => (value == null ? null : Number(value));

function toVersion(row: VersionRow): MealPlanVersionFull {
  const days: MealPlanDay[] = row.meal_plan_days.map((day) => ({
    id: day.id,
    weekday: day.weekday as Weekday,
    notes: day.notes,
    updatedAt: day.updated_at,
    meals: day.meals.map((meal) => ({
      id: meal.id,
      name: meal.name,
      timeOfDay: meal.time_of_day ? meal.time_of_day.slice(0, 5) : null,
      notes: meal.notes,
      sortOrder: meal.sort_order,
      updatedAt: meal.updated_at,
      items: meal.meal_items.map((item) => ({
        id: item.id,
        foodName: item.food_name,
        quantity: Number(item.quantity),
        unit: item.unit,
        calories: num(item.calories),
        proteinG: num(item.protein_g),
        carbsG: num(item.carbs_g),
        fatG: num(item.fat_g),
        fiberG: num(item.fiber_g),
        instructions: item.instructions,
        notes: item.notes,
        sortOrder: item.sort_order,
        updatedAt: item.updated_at,
        substitutions: item.meal_substitutions.map((substitution) => ({
          id: substitution.id,
          substituteFoodName: substitution.substitute_food_name,
          quantity: num(substitution.quantity),
          unit: substitution.unit,
          calories: num(substitution.calories),
          proteinG: num(substitution.protein_g),
          carbsG: num(substitution.carbs_g),
          fatG: num(substitution.fat_g),
          notes: substitution.notes,
          sortOrder: substitution.sort_order,
          updatedAt: substitution.updated_at,
        })),
      })),
    })),
  }));
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    notes: row.notes,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan: {
      id: row.meal_plans.id,
      patientId: row.meal_plans.patient_id,
      nutritionistId: row.meal_plans.nutritionist_id,
      title: row.meal_plans.title,
      startDate: row.meal_plans.start_date,
      notes: row.meal_plans.notes,
      archivedAt: row.meal_plans.archived_at,
    },
    days: sortStructure(days),
  };
}

/** Uma versão com toda a estrutura (uma query aninhada). RLS decide quem vê. */
export async function getMealPlanVersion(versionId: string): Promise<MealPlanVersionFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_plan_versions").select(VERSION_SELECT).eq("id", versionId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toVersion(data as unknown as VersionRow) : null;
}

/**
 * Versão PUBLICADA do plano ativo do paciente — o que o portal mostra.
 * Nunca "a última criada": só `status = PUBLISHED` de plano não arquivado.
 */
export async function getPublishedMealPlan(patientId: string): Promise<MealPlanVersionFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_versions")
    .select(VERSION_SELECT)
    .eq("status", "PUBLISHED")
    .eq("meal_plans.patient_id", patientId)
    .is("meal_plans.archived_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toVersion(data as unknown as VersionRow) : null;
}

/** Ownership de sub-registros (dia/refeição/item/substituição): devolve a versão + dono. */
type OwnerInfo = { versionId: string; status: MealPlanVersionStatus; patientId: string; nutritionistId: string; planId: string };

const OWNER_VIA_DAY = "id, version_id, meal_plan_versions!inner(id, status, meal_plans!inner(id, patient_id, nutritionist_id))";

type OwnerDayRow = { id: string; version_id: string; meal_plan_versions: { id: string; status: MealPlanVersionStatus; meal_plans: { id: string; patient_id: string; nutritionist_id: string } } };

function ownerFromDay(row: OwnerDayRow): OwnerInfo {
  return {
    versionId: row.meal_plan_versions.id,
    status: row.meal_plan_versions.status,
    patientId: row.meal_plan_versions.meal_plans.patient_id,
    nutritionistId: row.meal_plan_versions.meal_plans.nutritionist_id,
    planId: row.meal_plan_versions.meal_plans.id,
  };
}

export async function getVersionOwner(versionId: string): Promise<OwnerInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_versions")
    .select("id, status, meal_plans!inner(id, patient_id, nutritionist_id)")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const plan = data.meal_plans as unknown as { id: string; patient_id: string; nutritionist_id: string };
  return { versionId: data.id, status: data.status, patientId: plan.patient_id, nutritionistId: plan.nutritionist_id, planId: plan.id };
}

export async function getDayOwner(dayId: string): Promise<(OwnerInfo & { dayId: string; weekday: number }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meal_plan_days").select(`${OWNER_VIA_DAY}, weekday`).eq("id", dayId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  return { ...ownerFromDay(data as unknown as OwnerDayRow), dayId: data.id, weekday: data.weekday };
}

export async function getMealOwner(mealId: string): Promise<(OwnerInfo & { mealId: string; dayId: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select("id, day_id, meal_plan_days!inner(id, version_id, meal_plan_versions!inner(id, status, meal_plans!inner(id, patient_id, nutritionist_id)))")
    .eq("id", mealId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  return { ...ownerFromDay(data.meal_plan_days as unknown as OwnerDayRow), mealId: data.id, dayId: data.day_id };
}

export async function getMealItemOwner(itemId: string): Promise<(OwnerInfo & { itemId: string; mealId: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_items")
    .select("id, meal_id, meals!inner(id, meal_plan_days!inner(id, version_id, meal_plan_versions!inner(id, status, meal_plans!inner(id, patient_id, nutritionist_id))))")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const meal = data.meals as unknown as { meal_plan_days: OwnerDayRow };
  return { ...ownerFromDay(meal.meal_plan_days), itemId: data.id, mealId: data.meal_id };
}

export async function getSubstitutionOwner(substitutionId: string): Promise<(OwnerInfo & { substitutionId: string; itemId: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_substitutions")
    .select("id, meal_item_id, meal_items!inner(id, meals!inner(id, meal_plan_days!inner(id, version_id, meal_plan_versions!inner(id, status, meal_plans!inner(id, patient_id, nutritionist_id)))))")
    .eq("id", substitutionId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const item = data.meal_items as unknown as { meals: { meal_plan_days: OwnerDayRow } };
  return { ...ownerFromDay(item.meals.meal_plan_days), substitutionId: data.id, itemId: data.meal_item_id };
}

/** Visão geral para `/dashboard/cardapios`: um card por paciente do nutricionista. */
export type PatientMealPlanOverview = {
  patientId: string;
  patientName: string;
  patientStatus: string;
  plan: { id: string; title: string; updatedAt: string; current: VersionSummary | null; published: VersionSummary | null } | null;
};

export async function listMealPlanOverview(nutritionistId: string): Promise<PatientMealPlanOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, status, meal_plans(id, title, updated_at, archived_at, meal_plan_versions(id, version_number, status, published_at, created_at))")
    .eq("nutritionist_id", nutritionistId)
    .order("full_name");
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((patient) => {
    const plans = (patient.meal_plans as unknown as { id: string; title: string; updated_at: string; archived_at: string | null; meal_plan_versions: { id: string; version_number: number; status: MealPlanVersionStatus; published_at: string | null; created_at: string }[] }[]) ?? [];
    const active = plans.find((plan) => plan.archived_at === null) ?? null;
    const versions = active
      ? active.meal_plan_versions.map((version) => ({ id: version.id, versionNumber: version.version_number, status: version.status, publishedAt: version.published_at, createdAt: version.created_at }))
      : [];
    return {
      patientId: patient.id,
      patientName: patient.full_name,
      patientStatus: patient.status,
      plan: active
        ? {
            id: active.id,
            title: active.title,
            updatedAt: active.updated_at,
            current: versions.find((version) => version.status === "DRAFT") ?? versions.find((version) => version.status === "PUBLISHED") ?? null,
            published: versions.find((version) => version.status === "PUBLISHED") ?? null,
          }
        : null,
    };
  });
}
