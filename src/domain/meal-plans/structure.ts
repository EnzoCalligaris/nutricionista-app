import { type Weekday, isWeekday, weekPosition } from "@/domain/meal-plans/definitions";

/**
 * Estrutura aninhada do plano (o que o editor e o portal consomem) e as
 * regras puras de ordenação, reordenação e validação (prompt Fase 8
 * §42/§59). Nenhum I/O aqui.
 */

export type MealSubstitution = {
  id: string;
  substituteFoodName: string;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type MealItem = {
  id: string;
  foodName: string;
  quantity: number;
  unit: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  instructions: string | null;
  notes: string | null;
  sortOrder: number;
  updatedAt: string;
  substitutions: MealSubstitution[];
};

export type Meal = {
  id: string;
  name: string;
  timeOfDay: string | null; // "HH:mm"
  notes: string | null;
  sortOrder: number;
  updatedAt: string;
  items: MealItem[];
};

export type MealPlanDay = {
  id: string;
  weekday: Weekday;
  notes: string | null;
  updatedAt: string;
  meals: Meal[];
};

type Sortable = { sortOrder: number; id: string };

/** Ordem explícita (`sort_order`), com o id como desempate estável — nunca `created_at`. */
export function bySortOrder<T extends Sortable>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/** Dias na ordem da semana (segunda → domingo). */
export function sortDays<T extends { weekday: Weekday }>(days: T[]): T[] {
  return [...days].sort((a, b) => weekPosition(a.weekday) - weekPosition(b.weekday));
}

/** Ordena recursivamente dias → refeições → alimentos → substituições. */
export function sortStructure(days: MealPlanDay[]): MealPlanDay[] {
  return sortDays(days).map((day) => ({
    ...day,
    meals: [...day.meals].sort(bySortOrder).map((meal) => ({
      ...meal,
      items: [...meal.items].sort(bySortOrder).map((item) => ({
        ...item,
        substitutions: [...item.substitutions].sort(bySortOrder),
      })),
    })),
  }));
}

/**
 * Move um elemento uma posição para cima/baixo e devolve a nova lista de
 * `sortOrder` (1..n) para persistir — só os que mudaram. Botões "subir/
 * descer" em vez de drag & drop (§49).
 */
export function moveInOrder<T extends Sortable>(list: T[], id: string, direction: "up" | "down"): { id: string; sortOrder: number }[] {
  const sorted = [...list].sort(bySortOrder);
  const index = sorted.findIndex((entry) => entry.id === id);
  if (index === -1) return [];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= sorted.length) return [];
  const reordered = [...sorted];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  return reordered
    .map((entry, position) => ({ id: entry.id, sortOrder: position + 1 }))
    .filter((entry) => sorted.find((original) => original.id === entry.id)!.sortOrder !== entry.sortOrder);
}

/** Próximo `sort_order` ao acrescentar no fim. */
export function nextSortOrder(list: Sortable[]): number {
  return list.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 1;
}

/** Dias da semana ainda sem registro na versão (para "Adicionar dia"). */
export function availableWeekdays(days: { weekday: number }[]): Weekday[] {
  const used = new Set(days.map((day) => day.weekday));
  return ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).filter((weekday) => !used.has(weekday));
}

export type StructureProblem = "NO_DAYS" | "NO_MEALS" | "NO_ITEMS";

/**
 * Regra de publicação (§24, espelhada em `publish_meal_plan_version`): pelo
 * menos um dia com uma refeição com um alimento. Devolve o motivo para a UI
 * orientar antes de tentar publicar.
 */
export function validateStructureForPublish(days: MealPlanDay[]): { ok: true } | { ok: false; problem: StructureProblem } {
  if (days.length === 0) return { ok: false, problem: "NO_DAYS" };
  if (!days.some((day) => day.meals.length > 0)) return { ok: false, problem: "NO_MEALS" };
  if (!days.some((day) => day.meals.some((meal) => meal.items.length > 0))) return { ok: false, problem: "NO_ITEMS" };
  return { ok: true };
}

export const STRUCTURE_PROBLEM_MESSAGE: Record<StructureProblem, string> = {
  NO_DAYS: "Adicione pelo menos um dia antes de publicar.",
  NO_MEALS: "Adicione pelo menos uma refeição antes de publicar.",
  NO_ITEMS: "Adicione pelo menos um alimento antes de publicar.",
};

/** Contagens para o resumo (aba Cardápio / histórico). */
export function countStructure(days: MealPlanDay[]): { days: number; meals: number; items: number; substitutions: number } {
  let meals = 0;
  let items = 0;
  let substitutions = 0;
  for (const day of days) {
    meals += day.meals.length;
    for (const meal of day.meals) {
      items += meal.items.length;
      for (const item of meal.items) substitutions += item.substitutions.length;
    }
  }
  return { days: days.length, meals, items, substitutions };
}

/**
 * Cópia estrutural pura (mesma regra da função SQL `copy_meal_into_day`):
 * ids novos em todos os níveis, conteúdo idêntico, nenhum vínculo
 * compartilhado. Usada para prever o resultado e nos testes de duplicação.
 */
export function cloneMeal(meal: Meal, newId: () => string, sortOrder: number): Meal {
  return {
    ...meal,
    id: newId(),
    sortOrder,
    items: meal.items.map((item) => ({
      ...item,
      id: newId(),
      substitutions: item.substitutions.map((substitution) => ({ ...substitution, id: newId() })),
    })),
  };
}

export function cloneDayMeals(source: MealPlanDay, target: MealPlanDay, newId: () => string): Meal[] {
  let order = nextSortOrder(target.meals);
  return [...target.meals, ...[...source.meals].sort(bySortOrder).map((meal) => cloneMeal(meal, newId, order++))];
}

/** Dia exibido por padrão no portal: hoje, se existir; senão o primeiro da semana. */
export function defaultDay<T extends { weekday: Weekday }>(days: T[], todayWeekday: number): T | null {
  const sorted = sortDays(days);
  if (sorted.length === 0) return null;
  const today = isWeekday(todayWeekday) ? sorted.find((day) => day.weekday === todayWeekday) : undefined;
  return today ?? sorted[0]!;
}
