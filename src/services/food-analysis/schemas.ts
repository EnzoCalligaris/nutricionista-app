import { z } from "zod";
import {
  FOOD_UNITS,
  MAX_CALORIES_PER_ITEM,
  MAX_ITEMS,
  MAX_MACRO_G_PER_ITEM,
  MAX_QUANTITY,
  PREPARATION_METHODS,
  computeTotals,
  type AnalysisResult,
  type FoodItem,
} from "@/domain/food-analysis/estimates";

/**
 * Schema da resposta do provider (prompt Fase 11 §6–§7/§107). A IA é entrada
 * NÃO confiável: JSON inválido, campo ausente, número negativo/absurdo ou
 * unidade inesperada = erro de provider (`FOOD_ANALYSIS_INVALID_RESPONSE`);
 * nada é persistido sem passar por aqui. Strings são texto puro, limitadas
 * e sem caracteres de controle — nunca renderizadas como HTML/Markdown.
 */

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim());

const nonNegative = (max: number) => z.number().finite().min(0).max(max);

export const providerFoodSchema = z.object({
  name: safeText(120).pipe(z.string().min(1)),
  estimated_quantity: z.number().finite().positive().max(MAX_QUANTITY),
  unit: z.enum(FOOD_UNITS),
  preparation_method: z.enum(PREPARATION_METHODS).optional().default("nao_informado"),
  estimated_calories: nonNegative(MAX_CALORIES_PER_ITEM),
  estimated_protein_g: nonNegative(MAX_MACRO_G_PER_ITEM),
  estimated_carbs_g: nonNegative(MAX_MACRO_G_PER_ITEM),
  estimated_fat_g: nonNegative(MAX_MACRO_G_PER_ITEM),
  confidence: z.number().finite().min(0).max(1).nullable().optional(),
  uncertain: z.boolean().optional().default(false),
});

export const providerResultSchema = z.object({
  foods: z.array(providerFoodSchema).min(0).max(MAX_ITEMS),
  totals: z
    .object({
      estimated_calories: nonNegative(MAX_CALORIES_PER_ITEM * MAX_ITEMS),
      estimated_protein_g: nonNegative(MAX_MACRO_G_PER_ITEM * MAX_ITEMS),
      estimated_carbs_g: nonNegative(MAX_MACRO_G_PER_ITEM * MAX_ITEMS),
      estimated_fat_g: nonNegative(MAX_MACRO_G_PER_ITEM * MAX_ITEMS),
    })
    .optional(),
  notes: z
    .object({
      ambiguities: z.array(safeText(300)).max(20).optional().default([]),
      assumptions: z.array(safeText(300)).max(20).optional().default([]),
    })
    .optional()
    .default({ ambiguities: [], assumptions: [] }),
});

export type ProviderResult = z.infer<typeof providerResultSchema>;

/**
 * Normaliza a resposta validada para a estrutura persistida (§6): ids
 * estáveis por item, `source: "AI"`, totais RECALCULADOS a partir dos itens
 * (o total declarado pelo provider é ignorado — nunca confiamos numa soma
 * externa), avisos como texto puro.
 */
export function normalizeProviderResult(result: ProviderResult, newId: () => string): AnalysisResult {
  const items: FoodItem[] = result.foods.map((food) => ({
    id: newId(),
    name: food.name,
    quantity: food.estimated_quantity,
    unit: food.unit,
    preparation: food.preparation_method,
    calories: food.estimated_calories,
    proteinG: food.estimated_protein_g,
    carbsG: food.estimated_carbs_g,
    fatG: food.estimated_fat_g,
    confidence: food.confidence ?? null,
    uncertain: food.uncertain,
    source: "AI",
  }));
  return { items, totals: computeTotals(items), ambiguities: result.notes.ambiguities, assumptions: result.notes.assumptions };
}

/** Schema do que fica gravado em `structured_result`/`corrected_result` (leitura defensiva do banco). */
export const storedItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  quantity: z.number().finite().positive().max(MAX_QUANTITY),
  unit: z.enum(FOOD_UNITS),
  preparation: z.enum(PREPARATION_METHODS),
  calories: nonNegative(MAX_CALORIES_PER_ITEM),
  proteinG: nonNegative(MAX_MACRO_G_PER_ITEM),
  carbsG: nonNegative(MAX_MACRO_G_PER_ITEM),
  fatG: nonNegative(MAX_MACRO_G_PER_ITEM),
  confidence: z.number().min(0).max(1).nullable(),
  uncertain: z.boolean(),
  source: z.enum(["AI", "PATIENT"]),
});

export const storedResultSchema = z.object({
  items: z.array(storedItemSchema).max(MAX_ITEMS),
  totals: z.object({ calories: z.number().finite().min(0), proteinG: z.number().finite().min(0), carbsG: z.number().finite().min(0), fatG: z.number().finite().min(0) }),
  ambiguities: z.array(z.string().max(300)).max(20).default([]),
  assumptions: z.array(z.string().max(300)).max(20).default([]),
});

export function parseStoredResult(value: unknown): AnalysisResult | null {
  const parsed = storedResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
