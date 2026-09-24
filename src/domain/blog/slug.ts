/**
 * Slug de post (prompt Fase 14 §42). Determinístico, sem acento, sem
 * caractere que precise de escape em URL. A unicidade é do BANCO
 * (`blog_posts.slug` é unique) — aqui está a forma, não a garantia.
 */

const MAX_SLUG_LENGTH = 90;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Remove diacríticos (combining marks) — "coração" -> "coracao".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

/**
 * Trocar o slug de um post JÁ PUBLICADO muda uma URL que pode estar
 * indexada/compartilhada. O banco guarda o endereço antigo como alias e
 * `/blog/<slug antigo>` passa a redirecionar (308) — mas a UI avisa antes,
 * porque o alias não recupera link que aponte para âncora ou querystring.
 */
export function slugChangeWarning(previousSlug: string, nextSlug: string, wasPublished: boolean): string | null {
  if (previousSlug === nextSlug) return null;
  if (!wasPublished) return null;
  return `O endereço público muda de /blog/${previousSlug} para /blog/${nextSlug}. O endereço antigo passa a redirecionar automaticamente para o novo.`;
}
