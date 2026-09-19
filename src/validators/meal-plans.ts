import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";
import { MAX_NUTRIENT, MAX_QUANTITY, UNIT_VALUES } from "@/domain/meal-plans/definitions";

// Schemas Zod do cardápio (prompt Fase 8 §46). Só campos de negócio:
// patient_id/nutritionist_id/version_number/status/published_by/created_at
// nunca passam por aqui (§45) — vêm da sessão, do contexto ou do banco.

const guid = (label: string) => z.guid({ error: `${label} inválido.` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || isValidISODate(value), { message: `${label} inválida.` });

/** Número opcional ≥ 0 com até 2 casas (calorias/macros informados manualmente). */
const optionalNutrient = z
  .number({ error: "Informe um número válido." })
  .min(0, "Não pode ser negativo.")
  .max(MAX_NUTRIENT, "Valor acima do limite.")
  .nullable()
  .optional();

export const quantitySchema = z
  .number({ error: "Informe a quantidade (ex.: 100 ou 1,5)." })
  .positive("A quantidade precisa ser maior que zero.")
  .max(MAX_QUANTITY, "Quantidade acima do limite.");

export const unitSchema = z
  .string()
  .trim()
  .min(1, "Selecione a unidade.")
  .max(40, "Unidade muito longa.")
  .refine((value) => UNIT_VALUES.includes(value), { message: "Unidade inválida." });

const timeOfDay = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => value == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), { message: "Horário inválido (HH:mm)." });

export const weekdaySchema = z.coerce.number().int().min(0).max(6, "Dia da semana inválido.");

export const createMealPlanSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do plano.").max(120, "Nome muito longo."),
  startDate: optionalIsoDate("Data de início"),
  notes: optionalText(2000),
  /** Versão de um plano anterior (arquivado) usada como base — opcional. */
  sourceVersionId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || z.guid().safeParse(value).success, { message: "Versão base inválida." }),
});

export const updateMealPlanSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do plano.").max(120, "Nome muito longo."),
  startDate: optionalIsoDate("Data de início"),
  notes: optionalText(2000),
});

export const updateVersionNotesSchema = z.object({
  notes: optionalText(2000),
});

export const addDaySchema = z.object({
  weekday: weekdaySchema,
});

export const updateDaySchema = z.object({
  notes: optionalText(1000),
  expectedUpdatedAt: z.string().trim().min(1),
});

export const duplicateDaySchema = z.object({
  targetWeekday: weekdaySchema,
  replace: z.boolean().default(false),
});

export const mealSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da refeição.").max(80, "Nome muito longo."),
  timeOfDay,
  notes: optionalText(1000),
});

export const updateMealSchema = mealSchema.extend({
  expectedUpdatedAt: z.string().trim().min(1),
});

export const mealItemSchema = z.object({
  foodName: z.string().trim().min(2, "Informe o alimento.").max(120, "Nome muito longo."),
  quantity: quantitySchema,
  unit: unitSchema,
  calories: optionalNutrient,
  proteinG: optionalNutrient,
  carbsG: optionalNutrient,
  fatG: optionalNutrient,
  fiberG: optionalNutrient,
  instructions: optionalText(1000),
  notes: optionalText(1000),
});

export const updateMealItemSchema = mealItemSchema.extend({
  expectedUpdatedAt: z.string().trim().min(1),
});

export const substitutionSchema = z.object({
  substituteFoodName: z.string().trim().min(2, "Informe o alimento substituto.").max(120, "Nome muito longo."),
  quantity: quantitySchema.nullable().optional(),
  unit: unitSchema.nullable().optional(),
  calories: optionalNutrient,
  proteinG: optionalNutrient,
  carbsG: optionalNutrient,
  fatG: optionalNutrient,
  notes: optionalText(500),
});

export const updateSubstitutionSchema = substitutionSchema.extend({
  expectedUpdatedAt: z.string().trim().min(1),
});

export const moveSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export const mealPlanIdSchema = guid("Identificador do plano");
export const versionIdSchema = guid("Identificador da versão");
export const dayIdSchema = guid("Identificador do dia");
export const mealIdSchema = guid("Identificador da refeição");
export const mealItemIdSchema = guid("Identificador do alimento");
export const substitutionIdSchema = guid("Identificador da substituição");

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
export type MealInput = z.infer<typeof mealSchema>;
export type MealItemInput = z.infer<typeof mealItemSchema>;
export type SubstitutionInput = z.infer<typeof substitutionSchema>;
