import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { serializeRichText } from "@/domain/blog/rich-text";
import { safeQuery, type QueryResult } from "@/data/safe-query";
import { filterVisiblePosts } from "@/domain/blog/visibility";
import { siteConfig } from "@/config/site";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["blog_posts"]["Row"];

type PostJoinRow = PostRow & {
  blog_categories: { name: string; slug: string } | null;
  blog_post_tags: { blog_tags: { name: string; slug: string } | null }[];
};

export type PublicPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
  /**
   * O site tem um único autor e `profiles` não é legível por visitante
   * anônimo (RLS) — o nome vem da configuração pública, não de um join.
   */
  authorName: string;
};

export type PublicPost = PublicPostSummary & {
  content: unknown;
  seoTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
};

const POST_SELECT = "*, blog_categories(name, slug), blog_post_tags(blog_tags(name, slug))";

function publicUrl(supabase: ReturnType<typeof createPublicClient>, path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("blog").getPublicUrl(path).data.publicUrl;
}

function toSummary(supabase: ReturnType<typeof createPublicClient>, post: PostJoinRow): PublicPostSummary {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: publicUrl(supabase, post.cover_image_path),
    // filterVisiblePosts garante published_at não nulo.
    publishedAt: post.published_at as string,
    category: post.blog_categories,
    tags: post.blog_post_tags.flatMap((row) => (row.blog_tags ? [row.blog_tags] : [])),
    authorName: siteConfig.professional.name,
  };
}

/** Posts públicos (PUBLISHED + published_at <= agora), mais recentes primeiro. */
export const getPublishedPosts = cache(async (limit?: number): Promise<QueryResult<PublicPostSummary[]>> => {
  return safeQuery("getPublishedPosts", [], async () => {
    const supabase = createPublicClient();
    let query = supabase
      .from("blog_posts")
      .select(POST_SELECT)
      .eq("status", "PUBLISHED")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return filterVisiblePosts((data ?? []) as PostJoinRow[]).map((post) => toSummary(supabase, post));
  });
});

export const getPublishedPostBySlug = cache(async (slug: string): Promise<QueryResult<PublicPost | null>> => {
  return safeQuery("getPublishedPostBySlug", null, async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select(POST_SELECT)
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const post = data as PostJoinRow;
    if (filterVisiblePosts([post]).length === 0) return null;

    return {
      ...toSummary(supabase, post),
      content: post.content,
      seoTitle: post.seo_title,
      metaDescription: post.meta_description,
      ogImageUrl: publicUrl(supabase, post.og_image_path),
    };
  });
});

/** Slugs públicos para o sitemap. */
export const getPublishedPostSlugs = cache(async (): Promise<QueryResult<{ slug: string; updatedAt: string }[]>> => {
  return safeQuery("getPublishedPostSlugs", [], async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, status, published_at")
      .eq("status", "PUBLISHED")
      .lte("published_at", new Date().toISOString());

    if (error) throw new Error(error.message);

    return filterVisiblePosts(data ?? []).map((post) => ({ slug: post.slug, updatedAt: post.updated_at }));
  });
});

// ---------------------------------------------------------------------------
// Redirect de slug antigo (Fase 14 §42)
// ---------------------------------------------------------------------------

/**
 * Slug atual de um post a partir de um endereço ANTIGO. Só resolve alias de
 * post atualmente visível (a policy `blog_post_slug_aliases_select` garante
 * isso) — endereço antigo de rascunho/arquivado continua 404.
 */
export const getPostSlugByAlias = cache(async (alias: string): Promise<QueryResult<string | null>> => {
  return safeQuery("getPostSlugByAlias", null, async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("blog_post_slug_aliases")
      .select("blog_posts(slug, status, published_at)")
      .eq("slug", alias)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const post = data?.blog_posts as { slug: string; status: string; published_at: string | null } | null | undefined;
    if (!post) return null;
    if (filterVisiblePosts([{ status: post.status as "PUBLISHED", published_at: post.published_at }]).length === 0) return null;
    return post.slug;
  });
});

// ---------------------------------------------------------------------------
// Dashboard — CMS do blog (Fase 14 §39)
// ---------------------------------------------------------------------------

export type DashboardPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: PostRow["status"];
  publishedAt: string | null;
  archivedAt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  coverImagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardPostDetail = DashboardPost & {
  /** Conteúdo em texto na sintaxe do editor (reconstruído do documento JSON). */
  contentSource: string;
  content: unknown;
  aliases: string[];
};

type DashboardPostRow = PostRow & { blog_categories: { name: string } | null };

function toDashboardPost(row: DashboardPostRow): DashboardPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    status: row.status,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    categoryId: row.category_id,
    categoryName: row.blog_categories?.name ?? null,
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    coverImagePath: row.cover_image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Todos os posts (rascunho, publicado, arquivado) para o dashboard. */
export async function getDashboardPosts(filters?: { status?: PostRow["status"]; search?: string }): Promise<DashboardPost[]> {
  const supabase = await createServerClient();
  let query = supabase.from("blog_posts").select("*, blog_categories(name)");
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.search) {
    const term = filters.search.trim();
    if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DashboardPostRow[]).map(toDashboardPost);
}

export async function getDashboardPost(postId: string): Promise<DashboardPostDetail | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*, blog_categories(name), blog_post_slug_aliases(slug)")
    .eq("id", postId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as DashboardPostRow & { blog_post_slug_aliases: { slug: string }[] };
  return {
    ...toDashboardPost(row),
    content: row.content,
    contentSource: serializeRichText(row.content),
    aliases: (row.blog_post_slug_aliases ?? []).map((alias) => alias.slug),
  };
}

export async function getBlogCategories(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("blog_categories").select("id, name, slug").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type PostCounters = { total: number; drafts: number; published: number; archived: number };

export function countPosts(posts: DashboardPost[]): PostCounters {
  return {
    total: posts.length,
    drafts: posts.filter((post) => post.status === "DRAFT").length,
    published: posts.filter((post) => post.status === "PUBLISHED").length,
    archived: posts.filter((post) => post.status === "ARCHIVED").length,
  };
}

/** URL pública da capa do post (bucket `blog` é público). */
export async function blogAssetPublicUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createPublicClient();
  return supabase.storage.from("blog").getPublicUrl(path).data.publicUrl;
}
