import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";
import { MAX_METRIC_VALUE } from "@/domain/assessments/metrics";

// Schemas Zod das avaliações (prompt Fase 9 §57–§58). Só campos de negócio:
// patient_id vem da rota (reconferido por ownership), nutritionist_id,
// created_by, published_by, storage path, created_at e ator de auditoria
// nunca vêm do client.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** Uma medida já convertida para número (parsing pt-BR acontece na action). */
export const measurementInputSchema = z.object({
  code: z.string().trim().min(1).max(60).regex(/^[A-Z0-9_]+$/, "Código de métrica inválido."),
  value: z.number({ error: "Informe um número válido (ex.: 78,5)." }).positive("O valor precisa ser maior que zero.").max(MAX_METRIC_VALUE, "Valor acima do limite."),
});

export const assessmentSchema = z
  .object({
    assessmentDate: z.string().trim().refine(isValidISODate, { message: "Data da avaliação inválida." }),
    notes: optionalText(2000),
    internalNotes: optionalText(2000),
    visibleToPatient: z.boolean().default(false),
    measurements: z.array(measurementInputSchema).max(60),
  })
  .refine((data) => new Set(data.measurements.map((entry) => entry.code)).size === data.measurements.length, {
    message: "Métrica repetida.",
    path: ["measurements"],
  });

/** Data futura nunca (§5/§77): comparada com "hoje" em America/Sao_Paulo, injetado pela action. */
export function refineNotFuture<T extends { assessmentDate: string }>(schema: z.ZodType<T>, today: string) {
  return schema.refine((data) => data.assessmentDate <= today, { message: "A data da avaliação não pode estar no futuro.", path: ["assessmentDate"] });
}

export const assessmentIdSchema = z.guid({ error: "Identificador de avaliação inválido." });

export const REPORT_MAX_BYTES = 10 * 1024 * 1024;
export const REPORT_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Metadados do arquivo (o conteúdo é validado separadamente pela assinatura). */
export const reportFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().refine((value) => value in REPORT_MIME_TO_EXT, { message: "Envie um PDF ou imagem (JPG/PNG)." }),
  size: z.number().int().positive("Arquivo vazio.").max(REPORT_MAX_BYTES, "O arquivo precisa ter até 10 MB."),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type MeasurementInput = z.infer<typeof measurementInputSchema>;
