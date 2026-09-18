import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
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
