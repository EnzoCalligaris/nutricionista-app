/**
 * Regras puras da análise de foto de refeição (prompt Fase 11 §71). Tudo
 * aqui é ESTIMATIVA: itens, quantidades e macros vindos da IA (ou corrigidos
 * pelo paciente) são somados, arredondados e comparados — nunca
 * interpretados, julgados ou comparados com meta/cardápio (§44–§46).
 */

export const FOOD_UNITS = ["g", "ml", "unidade", "fatia", "colher_sopa", "colher_cha", "xicara", "porcao"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export const FOOD_UNIT_LABEL: Record<FoodUnit, string> = {
  g: "g",
  ml: "ml",
  unidade: "unidade(s)",
  fatia: "fatia(s)",
  colher_sopa: "colher(es) de sopa",
  colher_cha: "colher(es) de chá",
  xicara: "xícara(s)",
  porcao: "porção(ões)",
};

export const PREPARATION_METHODS = ["nao_informado", "cru", "cozido", "grelhado", "assado", "frito", "refogado", "vapor", "outro"] as const;
export type PreparationMethod = (typeof PREPARATION_METHODS)[number];

export const PREPARATION_LABEL: Record<PreparationMethod, string> = {
  nao_informado: "Não informado",
  cru: "Cru / in natura",
  cozido: "Cozido",
  grelhado: "Grelhado",
  assado: "Assado",
  frito: "Frito",
  refogado: "Refogado",
  vapor: "No vapor",
  outro: "Outro",
};

/** Limites TÉCNICOS (não nutricionais) para recusar números absurdos do provider ou do formulário (§7). */
export const MAX_ITEMS = 40;
export const MAX_QUANTITY = 5000;
export const MAX_CALORIES_PER_ITEM = 5000;
export const MAX_MACRO_G_PER_ITEM = 1000;

export type FoodItem = {
  /** Id estável dentro da análise (para diff IA x paciente). */
  id: string;
  name: string;
  quantity: number;
  unit: FoodUnit;
  preparation: PreparationMethod;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** 0–1 quando o provider informa; null = não informado. */
  confidence: number | null;
  /** Item marcado como incerto/não visível pela IA (§30–§31). */
  uncertain: boolean;
  /** Origem: veio da IA ou foi adicionado pelo paciente. */
  source: "AI" | "PATIENT";
};

export type Totals = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type AnalysisResult = {
  items: FoodItem[];
  totals: Totals;
  /** Ambiguidades/suposições declaradas pela IA (texto puro, exibido como aviso). */
  ambiguities: string[];
  assumptions: string[];
};

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/** Totais = soma dos itens (§36): kcal inteiro, macros com 1 casa — recalculados sempre a partir dos itens. */
export function computeTotals(items: Pick<FoodItem, "calories" | "proteinG" | "carbsG" | "fatG">[]): Totals {
  const sum = items.reduce(
    (acc, item) => ({ calories: acc.calories + item.calories, proteinG: acc.proteinG + item.proteinG, carbsG: acc.carbsG + item.carbsG, fatG: acc.fatG + item.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return { calories: Math.round(sum.calories), proteinG: round(sum.proteinG, 1), carbsG: round(sum.carbsG, 1), fatG: round(sum.fatG, 1) };
}

/** Apresentação (§37): kcal inteiro; gramas com até 1 casa, vírgula pt-BR. */
export function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString("pt-BR")} kcal`;
}

export function formatGrams(value: number): string {
  return `${round(value, 1).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} g`;
}

export function formatQuantity(quantity: number, unit: FoodUnit): string {
  const number = round(quantity, 1).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return unit === "g" || unit === "ml" ? `${number} ${unit}` : `${number} ${FOOD_UNIT_LABEL[unit]}`;
}

/** Texto obrigatório de aviso (§1) — único ponto de verdade, reutilizado em todas as telas. */
export const ESTIMATE_DISCLAIMER =
  "Os valores apresentados são estimativas geradas a partir da imagem e podem variar conforme ingredientes, porções e modo de preparo. Revise as informações antes de confirmar.";

export function isFoodUnit(value: string): value is FoodUnit {
  return (FOOD_UNITS as readonly string[]).includes(value);
}

export function isPreparationMethod(value: string): value is PreparationMethod {
  return (PREPARATION_METHODS as readonly string[]).includes(value);
}

// --- Revisão pelo paciente (§32–§36) ------------------------------------------------

export type ReviewItemInput = {
  id?: string | null;
  name: string;
  quantity: number;
  unit: FoodUnit;
  preparation: PreparationMethod;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Monta a versão CONFIRMADA a partir dos itens revisados: mantém o id dos
 * itens da IA que sobreviveram (para o diff), marca os novos como PATIENT,
 * recalcula os totais só com o que ficou (§36) e nunca toca no original.
 */
export function buildConfirmedResult(original: AnalysisResult, reviewed: ReviewItemInput[], newId: () => string): AnalysisResult {
  const originalById = new Map(original.items.map((item) => [item.id, item]));
  const items: FoodItem[] = reviewed.map((input) => {
    const base = input.id ? originalById.get(input.id) : undefined;
    return {
      id: base?.id ?? newId(),
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      preparation: input.preparation,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      confidence: base ? base.confidence : null,
      uncertain: false,
      source: base ? "AI" : "PATIENT",
    };
  });
  return { items, totals: computeTotals(items), ambiguities: original.ambiguities, assumptions: original.assumptions };
}

// --- Diff IA x paciente (§33/§43) ----------------------------------------------------

export type ChangedField = "name" | "quantity" | "unit" | "preparation" | "calories" | "proteinG" | "carbsG" | "fatG";
const CHANGE_FIELDS: readonly ChangedField[] = ["name", "quantity", "unit", "preparation", "calories", "proteinG", "carbsG", "fatG"];

export type ItemChange =
  | { kind: "ADDED"; item: FoodItem }
  | { kind: "REMOVED"; item: FoodItem }
  | { kind: "CHANGED"; before: FoodItem; after: FoodItem; fields: ChangedField[] };

export function diffResults(original: AnalysisResult, confirmed: AnalysisResult): ItemChange[] {
  const changes: ItemChange[] = [];
  const confirmedById = new Map(confirmed.items.map((item) => [item.id, item]));
  for (const before of original.items) {
    const after = confirmedById.get(before.id);
    if (!after) {
      changes.push({ kind: "REMOVED", item: before });
      continue;
    }
    const fields = CHANGE_FIELDS.filter((field) => before[field] !== after[field]);
    if (fields.length > 0) changes.push({ kind: "CHANGED", before, after, fields });
  }
  const originalIds = new Set(original.items.map((item) => item.id));
  for (const item of confirmed.items) {
    if (!originalIds.has(item.id)) changes.push({ kind: "ADDED", item });
  }
  return changes;
}

export const CHANGE_FIELD_LABEL: Record<ChangedField, string> = {
  name: "nome",
  quantity: "quantidade",
  unit: "unidade",
  preparation: "preparo",
  calories: "kcal",
  proteinG: "proteína",
  carbsG: "carboidratos",
  fatG: "gorduras",
};
