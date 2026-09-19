import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";
import { EXTERNAL_URL_MESSAGE, validateExternalUrl } from "@/domain/patient-content/urls";
import { MATERIAL_MAX_BYTES, MATERIAL_MIME_TO_EXT } from "@/domain/patient-content/materials";

// Schemas Zod da Fase 10 (prompt §66): só campos de negócio. patient_id vem
// da rota/sessão (reconferido por ownership); nutritionist_id, created_by,
// author_id, published_at/by, archived_at, storage_path, assigned_by e ator
// de auditoria nunca vêm do client (§60 — mass assignment).

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => value == null || isValidISODate(value), { message: "Data inválida." });

/** URL externa opcional: vazio = sem link; qualquer valor passa pelo validador central (§61). */
export const optionalExternalUrlSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const check = validateExternalUrl(value);
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: EXTERNAL_URL_MESSAGE[check.reason] });
      return z.NEVER;
    }
    return check.url;
  })
  .nullable()
  .optional();

/** URL externa obrigatória (material de link). */
export const requiredExternalUrlSchema = z.string().trim().transform((value, ctx) => {
  const check = validateExternalUrl(value);
  if (!check.ok) {
    ctx.addIssue({ code: "custom", message: EXTERNAL_URL_MESSAGE[check.reason] });
    return z.NEVER;
  }
  return check.url;
});

// --- Suplementos --------------------------------------------------------------

export const supplementSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do suplemento.").max(120, "Máximo de 120 caracteres."),
    brand: optionalText(120),
    instructions: optionalText(2000),
    doseText: optionalText(120),
    scheduleText: optionalText(120),
    startsOn: optionalDate,
    endsOn: optionalDate,
    notes: optionalText(2000),
    purchaseUrl: optionalExternalUrlSchema,
  })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    message: "A data final não pode ser anterior à inicial.",
    path: ["endsOn"],
  });

export type SupplementInput = z.infer<typeof supplementSchema>;
export const supplementIdSchema = z.guid({ error: "Identificador de recomendação inválido." });

// --- Feedbacks ----------------------------------------------------------------

export const feedbackSchema = z.object({
  title: optionalText(120),
  content: z.string().trim().min(3, "Escreva a mensagem do feedback.").max(5000, "Máximo de 5000 caracteres."),
  referenceDate: optionalDate,
  /** true = disponibilizar ao paciente já ao salvar; false = guardar como rascunho (§22). */
  publish: z.boolean().default(false),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
export const feedbackIdSchema = z.guid({ error: "Identificador de feedback inválido." });

// --- Materiais ----------------------------------------------------------------

const materialBase = {
  title: z.string().trim().min(2, "Informe o título do material.").max(160, "Máximo de 160 caracteres."),
  description: optionalText(1000),
};

export const materialLinkSchema = z.object({ ...materialBase, kind: z.literal("LINK"), externalUrl: requiredExternalUrlSchema });
export const materialFileSchema = z.object({ ...materialBase, kind: z.literal("FILE") });
/** Criação: arquivo OU link (§35) — o arquivo em si é validado à parte pela assinatura. */
export const materialSchema = z.discriminatedUnion("kind", [materialLinkSchema, materialFileSchema]);
/** Edição: título/descrição (e o link, quando for material de link). Tipo nunca muda. */
export const materialUpdateSchema = z.object({ ...materialBase, externalUrl: optionalExternalUrlSchema });

export type MaterialInput = z.infer<typeof materialSchema>;
export type MaterialUpdateInput = z.infer<typeof materialUpdateSchema>;
export const materialIdSchema = z.guid({ error: "Identificador de material inválido." });
export const assignmentIdSchema = z.guid({ error: "Identificador de atribuição inválido." });

/** Metadados do arquivo (o conteúdo é validado pela assinatura no service). */
export const materialFileMetaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().refine((value) => value in MATERIAL_MIME_TO_EXT, { message: "Envie um PDF ou imagem (JPG/PNG)." }),
  size: z.number().int().positive("Arquivo vazio.").max(MATERIAL_MAX_BYTES, "O arquivo precisa ter até 10 MB."),
});
