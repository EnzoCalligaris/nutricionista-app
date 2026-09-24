import { z } from "zod";
import { NAME_DISPLAY_MODES } from "@/domain/results/display";
import { MEDIA_CONSENT_TYPE, MEDIA_CONSENT_VERSION } from "@/domain/results/consent-document";

/**
 * Validação dos resultados antes/depois. Campos que a aplicação DERIVA nunca
 * entram aqui (prompt Fase 14 §56): `nutritionist_id`, `published`,
 * `published_at`, `published_by`, `media_consent_id`, `before_path`,
 * `after_path`, `display_name` e `archived_at` são decididos no servidor.
 */

export const resultIdSchema = z.guid({ error: "Resultado inválido." });
export const consentIdSchema = z.guid({ error: "Consentimento inválido." });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .transform((value) => (value.length > 0 ? value : null))
    .nullable();

export const resultSchema = z.object({
  title: z.string().trim().min(3, { message: "Informe um título com ao menos 3 caracteres." }).max(140, { message: "Use no máximo 140 caracteres." }),
  description: optionalText(2000, "A descrição deve ter no máximo 2000 caracteres."),
  period: optionalText(80, "O período deve ter no máximo 80 caracteres."),
  imageAlt: optionalText(180, "O texto alternativo deve ter no máximo 180 caracteres."),
  patientId: z.guid({ error: "Paciente inválido." }).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type ResultInput = z.infer<typeof resultSchema>;

export const resultUpdateSchema = resultSchema;

/**
 * Registro de consentimento. `consentType`/`version` são fixos pela
 * aplicação — o formulário não escolhe finalidade nem versão do texto (§30).
 */
export const mediaConsentSchema = z.object({
  patientId: z.guid({ error: "Selecione o paciente que autorizou." }),
  nameDisplayMode: z.enum(NAME_DISPLAY_MODES, { message: "Escolha como a pessoa autorizou ser identificada." }),
  evidenceReference: z
    .string()
    .trim()
    .min(5, { message: "Descreva onde a autorização foi registrada (ao menos 5 caracteres)." })
    .max(300, { message: "Use no máximo 300 caracteres." }),
  acknowledged: z.literal(true, { message: "Confirme que a autorização foi obtida e está arquivada." }),
});

export type MediaConsentInput = z.infer<typeof mediaConsentSchema>;

export const consentRevokeSchema = z.object({
  consentId: consentIdSchema,
  reason: optionalText(300, "O motivo deve ter no máximo 300 caracteres."),
});

/** Constantes gravadas junto do consentimento — nunca vêm do client. */
export const CONSENT_FIXED_FIELDS = {
  consentType: MEDIA_CONSENT_TYPE,
  consentVersion: MEDIA_CONSENT_VERSION,
} as const;

/** Imagem de antes/depois (§87): tipo e tamanho conferidos. */
export const resultImageSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["image/webp", "image/png", "image/jpeg"], { message: "Envie uma imagem WEBP, PNG ou JPG." }),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, { message: "A imagem deve ter no máximo 10 MB." }),
});

export const resultSlotSchema = z.enum(["before", "after"], { message: "Posição inválida." });
