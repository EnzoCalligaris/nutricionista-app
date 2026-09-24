import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Invalidação explícita do cache das páginas PÚBLICAS (prompt Fase 14
 * §49/§50). O site continua com ISR de 10 minutos (`revalidate = 600` no
 * layout público), mas nenhuma mudança administrativa espera esses 10
 * minutos: toda mutação que altera conteúdo público chama isto.
 *
 * Especialmente crítico para a revogação de consentimento (§31): o resultado
 * precisa sair do ar na hora, e sem revalidar a página ficaria servindo HTML
 * antigo.
 */

/** Rotas públicas que leem configuração/planos/resultados. */
const PUBLIC_PATHS = [
  "/",
  "/metodo-em",
  "/sobre",
  "/acompanhamento",
  "/planos",
  "/resultados",
  "/contato",
  "/agendar",
] as const;

export function revalidatePublicSite(): void {
  for (const path of PUBLIC_PATHS) revalidatePath(path);
  // Sitemap/robots derivam do mesmo conteúdo.
  revalidatePath("/sitemap.xml");
}

/** Site público + listagem e páginas de post do blog. */
export function revalidatePublicBlog(slugs: string[] = []): void {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  for (const slug of slugs) revalidatePath(`/blog/${slug}`);
}
