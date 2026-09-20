import { z } from "zod";
import { FOOD_UNITS, MAX_CALORIES_PER_ITEM, MAX_ITEMS, MAX_MACRO_G_PER_ITEM, MAX_QUANTITY, PREPARATION_METHODS } from "@/domain/food-analysis/estimates";
import { MEAL_PHOTO_ACCEPTED_MIMES, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/domain/food-analysis/photo";

// Schemas Zod da Fase 11 (prompt §74): só campos de negócio. patient_id vem
// da sessão; nutritionist_id, provider, model, status, storage_path,
// structured_result (original da IA), created_by/confirmed_by nunca vêm do
// client. Números chegam já convertidos (parsing pt-BR na action).

export const analysisIdSchema = z.guid({ error: "Identificador de refeição inválido." });

/** Metadados do arquivo enviado (o conteúdo é validado pela assinatura no processamento). */
export const mealPhotoMetaSchema = z.object({
  type: z.string().refine((value) => (MEAL_PHOTO_ACCEPTED_MIMES as readonly string[]).includes(value), { message: "Envie uma foto em JPG, PNG ou WebP." }),
  size: z.number().int().positive("Arquivo vazio.").max(MEAL_PHOTO_MAX_INPUT_BYTES, "A foto precisa ter até 12 MB."),
});

/** Item revisado pelo paciente (§32): texto puro limitado, números técnicos (≥ 0, sem absurdos). */
export const reviewItemSchema = z.object({
  id: z.string().trim().max(64).nullable().optional(),
  name: z.string().trim().min(1, "Informe o alimento.").max(120, "Máximo de 120 caracteres."),
  quantity: z.number({ error: "Informe a quantidade." }).finite().positive("A quantidade precisa ser maior que zero.").max(MAX_QUANTITY, "Quantidade acima do limite."),
  unit: z.enum(FOOD_UNITS, { error: "Unidade inválida." }),
  preparation: z.enum(PREPARATION_METHODS, { error: "Preparo inválido." }),
  calories: z.number({ error: "Informe as calorias." }).finite().min(0, "Não pode ser negativo.").max(MAX_CALORIES_PER_ITEM, "Valor acima do limite."),
  proteinG: z.number({ error: "Informe a proteína." }).finite().min(0, "Não pode ser negativo.").max(MAX_MACRO_G_PER_ITEM, "Valor acima do limite."),
  carbsG: z.number({ error: "Informe os carboidratos." }).finite().min(0, "Não pode ser negativo.").max(MAX_MACRO_G_PER_ITEM, "Valor acima do limite."),
  fatG: z.number({ error: "Informe as gorduras." }).finite().min(0, "Não pode ser negativo.").max(MAX_MACRO_G_PER_ITEM, "Valor acima do limite."),
});

export const reviewSchema = z.object({
  items: z.array(reviewItemSchema).min(1, "Mantenha pelo menos um alimento na refeição.").max(MAX_ITEMS, `Máximo de ${MAX_ITEMS} itens.`),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** Data/hora da refeição vinda do formulário (`datetime-local`, relógio de parede em America/Sao_Paulo). */
export const mealWallClockSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data e hora inválidas.");
