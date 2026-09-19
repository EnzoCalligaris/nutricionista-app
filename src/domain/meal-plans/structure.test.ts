import { describe, expect, it } from "vitest";
import {
  availableWeekdays,
  cloneDayMeals,
  cloneMeal,
  countStructure,
  defaultDay,
  moveInOrder,
  nextSortOrder,
  sortDays,
  sortStructure,
  validateStructureForPublish,
  type Meal,
  type MealPlanDay,
} from "@/domain/meal-plans/structure";

const sub = (id: string, name: string) => ({ id, substituteFoodName: name, quantity: 100, unit: "g", calories: null, proteinG: null, carbsG: null, fatG: null, notes: null, sortOrder: 1, updatedAt: "t" });
const item = (id: string, name: string, sortOrder: number, subs = [] as ReturnType<typeof sub>[]) => ({
  id,
  foodName: name,
  quantity: 100,
  unit: "g",
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
  instructions: null,
  notes: null,
  sortOrder,
  updatedAt: "t",
  substitutions: subs,
});
const meal = (id: string, name: string, sortOrder: number, items: ReturnType<typeof item>[] = []): Meal => ({ id, name, timeOfDay: null, notes: null, sortOrder, updatedAt: "t", items });
const day = (id: string, weekday: MealPlanDay["weekday"], meals: Meal[] = []): MealPlanDay => ({ id, weekday, notes: null, updatedAt: "t", meals });

describe("ordenação", () => {
  it("dias saem de segunda a domingo, independente da ordem de entrada", () => {
    const sorted = sortDays([day("dom", 0), day("sex", 5), day("seg", 1), day("qua", 3)]);
    expect(sorted.map((entry) => entry.weekday)).toEqual([1, 3, 5, 0]);
  });

  it("refeições, alimentos e substituições seguem sort_order (desempate por id), nunca a ordem de chegada", () => {
    const structure = sortStructure([
      day("d", 1, [
        meal("m2", "Almoço", 2, [item("i2", "Arroz", 2), item("i1", "Feijão", 1, [{ ...sub("s2", "B"), sortOrder: 2 }, { ...sub("s1", "A"), sortOrder: 1 }])]),
        meal("m1", "Café", 1),
        meal("m3", "Jantar", 2),
      ]),
    ]);
    expect(structure[0]!.meals.map((entry) => entry.id)).toEqual(["m1", "m2", "m3"]);
    expect(structure[0]!.meals[1]!.items.map((entry) => entry.id)).toEqual(["i1", "i2"]);
    expect(structure[0]!.meals[1]!.items[0]!.substitutions.map((entry) => entry.id)).toEqual(["s1", "s2"]);
  });

  it("moveInOrder troca com o vizinho e devolve só os sort_order alterados (1..n)", () => {
    const list = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ];
    expect(moveInOrder(list, "b", "up")).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
    expect(moveInOrder(list, "b", "down")).toEqual([
      { id: "c", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ]);
    expect(moveInOrder(list, "a", "up")).toEqual([]);
    expect(moveInOrder(list, "c", "down")).toEqual([]);
    expect(moveInOrder(list, "zzz", "down")).toEqual([]);
  });

  it("moveInOrder normaliza buracos (5, 9, 20) para 1..n ao mover", () => {
    const list = [
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 9 },
      { id: "c", sortOrder: 20 },
    ];
    expect(moveInOrder(list, "c", "up")).toEqual([
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ]);
  });

  it("nextSortOrder é máximo + 1 (1 quando vazio)", () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([{ id: "a", sortOrder: 4 }, { id: "b", sortOrder: 2 }])).toBe(5);
  });

  it("availableWeekdays lista os dias que faltam na ordem da semana", () => {
    expect(availableWeekdays([{ weekday: 1 }, { weekday: 0 }])).toEqual([2, 3, 4, 5, 6]);
    expect(availableWeekdays([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday })))).toEqual([]);
  });
});

describe("validação para publicar", () => {
  it("exige ao menos um dia com refeição com alimento", () => {
    expect(validateStructureForPublish([])).toEqual({ ok: false, problem: "NO_DAYS" });
    expect(validateStructureForPublish([day("d", 1)])).toEqual({ ok: false, problem: "NO_MEALS" });
    expect(validateStructureForPublish([day("d", 1, [meal("m", "Café", 1)])])).toEqual({ ok: false, problem: "NO_ITEMS" });
    expect(validateStructureForPublish([day("d", 1, [meal("m", "Café", 1, [item("i", "Ovo", 1)])])])).toEqual({ ok: true });
  });

  it("countStructure conta dias, refeições, alimentos e substituições", () => {
    const days = [day("d1", 1, [meal("m1", "Café", 1, [item("i1", "Ovo", 1, [sub("s1", "Queijo")])]), meal("m2", "Almoço", 2)]), day("d2", 3)];
    expect(countStructure(days)).toEqual({ days: 2, meals: 2, items: 1, substitutions: 1 });
  });
});

describe("duplicação (§70–§71)", () => {
  let counter = 0;
  const newId = () => `new-${++counter}`;

  it("cloneMeal gera ids novos em todos os níveis e mantém o conteúdo", () => {
    counter = 0;
    const original = meal("m1", "Almoço", 1, [item("i1", "Arroz", 1, [sub("s1", "Batata")]), item("i2", "Frango", 2)]);
    const copy = cloneMeal(original, newId, 7);
    expect(copy.id).not.toBe(original.id);
    expect(copy.sortOrder).toBe(7);
    expect(copy.name).toBe("Almoço");
    expect(copy.items.map((entry) => entry.foodName)).toEqual(["Arroz", "Frango"]);
    const ids = new Set([copy.id, ...copy.items.map((entry) => entry.id), ...copy.items.flatMap((entry) => entry.substitutions.map((s) => s.id))]);
    expect(ids.has("m1") || ids.has("i1") || ids.has("i2") || ids.has("s1")).toBe(false);
    expect(ids.size).toBe(4);
    expect(copy.items[0]!.substitutions[0]!.substituteFoodName).toBe("Batata");
    // original intacto
    expect(original.items[0]!.substitutions[0]!.id).toBe("s1");
  });

  it("cloneDayMeals acrescenta ao destino sem apagar o que já existia", () => {
    counter = 0;
    const source = day("seg", 1, [meal("m1", "Café", 1, [item("i1", "Pão", 1)]), meal("m2", "Almoço", 2)]);
    const target = day("ter", 2, [meal("t1", "Ceia", 3)]);
    const merged = cloneDayMeals(source, target, newId);
    expect(merged.map((entry) => entry.name)).toEqual(["Ceia", "Café", "Almoço"]);
    expect(merged.map((entry) => entry.sortOrder)).toEqual([3, 4, 5]);
    expect(merged[0]!.id).toBe("t1");
    expect(merged[1]!.id).not.toBe("m1");
  });
});

describe("defaultDay (portal)", () => {
  const days = [day("seg", 1), day("qua", 3), day("sex", 5)];
  it("abre no dia de hoje quando existe", () => {
    expect(defaultDay(days, 3)?.id).toBe("qua");
  });
  it("cai no primeiro da semana quando hoje não está no plano", () => {
    expect(defaultDay(days, 0)?.id).toBe("seg");
    expect(defaultDay([], 1)).toBeNull();
  });
});
