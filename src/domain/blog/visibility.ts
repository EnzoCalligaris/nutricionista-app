/**
 * Regra pura de visibilidade pública de post (docs/PROJECT_SPEC.md §5):
 * só `PUBLISHED` com `published_at` no passado. Rascunho e agendado nunca
 * aparecem. A RLS (`blog_posts_select_public`) aplica a mesma regra no
 * banco — aqui é a segunda camada, testável sem Supabase.
 */

export type BlogVisibilityInput = {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  published_at: string | null;
};

export function isPostPubliclyVisible(post: BlogVisibilityInput, now: Date = new Date()): boolean {
  if (post.status !== "PUBLISHED") return false;
  if (!post.published_at) return false;
  return new Date(post.published_at).getTime() <= now.getTime();
}

export function filterVisiblePosts<T extends BlogVisibilityInput>(posts: T[], now: Date = new Date()): T[] {
  return posts.filter((post) => isPostPubliclyVisible(post, now));
}
