import { z } from "zod";
import { isValidSlug, slugify } from "@/domain/blog/slug";

/**
 * Validação do CMS do blog. Campos derivados pelo servidor nunca vêm do
 * formulário (prompt Fase 14 §56): `author_id`, `published_at`,
 * `published_by`, `status`, `archived_at` e o path de storage da capa.
 *
 * O conteúdo chega como TEXTO na sintaxe restrita e é convertido em
 * documento JSON validado (`src/domain/blog/rich-text.ts`) — nunca HTML cru
 * (§40).
 */

export const postIdSchema = z.guid({ error: "Post inválido." });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .transform((value) => (value.length > 0 ? value : null))
    .nullable();

export const blogPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: "Informe um título com ao menos 3 caracteres." })
    .max(160, { message: "Use no máximo 160 caracteres." }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(90, { message: "O endereço deve ter no máximo 90 caracteres." })
    .refine((value) => value === "" || isValidSlug(value), {
      message: "Use apenas letras minúsculas, números e hífens (ex.: como-montar-o-prato).",
    }),
  excerpt: optionalText(320, "O resumo deve ter no máximo 320 caracteres."),
  content: z.string().max(60_000, { message: "O conteúdo está muito longo." }),
  categoryId: z.guid({ error: "Categoria inválida." }).nullable(),
  // SEO (§41). Sem keyword stuffing: limites curtos, um título e uma
  // descrição — nenhum campo de "palavras-chave".
  seoTitle: optionalText(70, "O título de SEO deve ter no máximo 70 caracteres."),
  metaDescription: optionalText(180, "A descrição de SEO deve ter no máximo 180 caracteres."),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

/**
 * Slug final: o informado, ou derivado do título quando o campo fica vazio.
 * Título que não gera nenhum caractere válido (ex.: só símbolos) é recusado
 * em vez de virar slug vazio.
 */
export function resolveSlug(input: { slug: string; title: string }): { ok: true; slug: string } | { ok: false; message: string } {
  const candidate = input.slug.trim() !== "" ? input.slug.trim() : slugify(input.title);
  if (!isValidSlug(candidate)) {
    return { ok: false, message: "Não foi possível gerar um endereço a partir do título. Escreva o endereço manualmente." };
  }
  return { ok: true, slug: candidate };
}

export const blogCoverSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["image/webp", "image/png", "image/jpeg"], { message: "Envie uma imagem WEBP, PNG ou JPG." }),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, { message: "A imagem deve ter no máximo 5 MB." }),
});

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2, { message: "Informe um nome com ao menos 2 caracteres." }).max(80, { message: "Use no máximo 80 caracteres." }),
});
