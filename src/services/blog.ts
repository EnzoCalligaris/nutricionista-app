import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { recordAudit } from "@/services/audit";
import { getDashboardPost, type DashboardPostDetail } from "@/data/blog";
import { isRichTextEmpty, parseRichText } from "@/domain/blog/rich-text";
import { blogCoverSchema, resolveSlug, type BlogPostInput } from "@/validators/blog";
import type { Json } from "@/types/database";

/**
 * CMS do blog (prompt Fase 14 §39–§42).
 *
 * - O conteúdo NUNCA é aceito como HTML: o texto do editor é convertido em
 *   documento JSON com nós conhecidos (`parseRichText`) e o renderizador
 *   público só entende esses nós, sem `dangerouslySetInnerHTML` (§40);
 * - trocar o slug de um post publicado NÃO quebra a URL: o trigger
 *   `register_blog_post_slug_change` guarda o endereço antigo como alias e
 *   `/blog/<antigo>` passa a redirecionar (§42);
 * - `author_id`, `published_at`, `published_by` e `status` são do servidor.
 */

export const BLOG_BUCKET = "blog";

async function requirePost(postId: string): Promise<DashboardPostDetail> {
  const post = await getDashboardPost(postId);
  if (!post) throw new DomainError("POST_NOT_FOUND");
  return post;
}

export async function createPost(nutritionistId: string, input: BlogPostInput): Promise<{ postId: string }> {
  const slug = resolveSlug({ slug: input.slug, title: input.title });
  if (!slug.ok) throw new DomainError("VALIDATION_ERROR", slug.message);

  const doc = parseRichText(input.content);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      title: input.title,
      slug: slug.slug,
      excerpt: input.excerpt,
      content: doc as unknown as Json,
      category_id: input.categoryId,
      seo_title: input.seoTitle,
      meta_description: input.metaDescription,
      author_id: nutritionistId,
      status: "DRAFT",
      published_at: null,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_CREATED",
    entityType: "blog_post",
    entityId: data.id,
    // Sem título nem conteúdo no log (§53): só o slug (que é público) e flags.
    metadata: { slug: slug.slug, status: "DRAFT", has_category: input.categoryId !== null },
  });

  return { postId: data.id };
}

export async function updatePost(nutritionistId: string, postId: string, input: BlogPostInput): Promise<void> {
  const post = await requirePost(postId);
  const slug = resolveSlug({ slug: input.slug, title: input.title });
  if (!slug.ok) throw new DomainError("VALIDATION_ERROR", slug.message);

  const doc = parseRichText(input.content);
  const supabase = await createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: input.title,
      slug: slug.slug,
      excerpt: input.excerpt,
      content: doc as unknown as Json,
      category_id: input.categoryId,
      seo_title: input.seoTitle,
      meta_description: input.metaDescription,
    })
    .eq("id", postId);
  if (error) throw domainErrorFromDatabase(error);

  const slugChanged = post.slug !== slug.slug;
  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_UPDATED",
    entityType: "blog_post",
    entityId: postId,
    metadata: {
      changed_fields: [
        ...(post.title !== input.title ? ["title"] : []),
        ...(slugChanged ? ["slug"] : []),
        ...((post.excerpt ?? null) !== input.excerpt ? ["excerpt"] : []),
        ...(post.contentSource !== input.content ? ["content"] : []),
        ...(post.categoryId !== input.categoryId ? ["category_id"] : []),
        ...((post.seoTitle ?? null) !== input.seoTitle ? ["seo_title"] : []),
        ...((post.metaDescription ?? null) !== input.metaDescription ? ["meta_description"] : []),
      ],
    },
  });

  if (slugChanged) {
    await recordAudit({
      actorId: nutritionistId,
      action: "BLOG_POST_SLUG_CHANGED",
      entityType: "blog_post",
      entityId: postId,
      metadata: { from: post.slug, to: slug.slug, was_published: post.status === "PUBLISHED" },
    });
  }
}

export async function publishPost(nutritionistId: string, postId: string): Promise<void> {
  const post = await requirePost(postId);
  // Post vazio nunca vai ao ar.
  if (isRichTextEmpty(parseRichText(post.contentSource))) throw new DomainError("POST_EMPTY_CONTENT");

  const supabase = await createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({
      status: "PUBLISHED",
      // Republicar um post arquivado mantém a data original de publicação.
      published_at: post.publishedAt ?? new Date().toISOString(),
      published_by: nutritionistId,
      archived_at: null,
    })
    .eq("id", postId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_PUBLISHED",
    entityType: "blog_post",
    entityId: postId,
    metadata: { slug: post.slug, republished: post.publishedAt !== null },
  });
}

/** Volta para rascunho: sai do site e deixa de ter data de publicação. */
export async function unpublishPost(nutritionistId: string, postId: string): Promise<void> {
  const post = await requirePost(postId);
  if (post.status !== "PUBLISHED") throw new DomainError("POST_NOT_PUBLISHED");

  const supabase = await createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "DRAFT", published_at: null, published_by: null })
    .eq("id", postId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_UNPUBLISHED",
    entityType: "blog_post",
    entityId: postId,
    metadata: { slug: post.slug },
  });
}

/** Arquivar preserva o histórico e o endereço (que passa a responder 404). */
export async function archivePost(nutritionistId: string, postId: string): Promise<void> {
  const post = await requirePost(postId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "ARCHIVED", archived_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_ARCHIVED",
    entityType: "blog_post",
    entityId: postId,
    metadata: { slug: post.slug, was_published: post.status === "PUBLISHED" },
  });
}

function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const MIME_TO_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/** Capa do post no bucket público `blog` (asset institucional, §45). */
export async function uploadPostCover(nutritionistId: string, postId: string, file: File): Promise<void> {
  const post = await requirePost(postId);
  const meta = blogCoverSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (!meta.success) throw new DomainError("SITE_ASSET_INVALID");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new DomainError("SITE_ASSET_INVALID");

  const path = `covers/${postId}/${randomUUID()}.${MIME_TO_EXT[mime]}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(BLOG_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[blog] upload de capa falhou:", uploadError.message);
    throw new DomainError("SITE_ASSET_UPLOAD_FAILED");
  }

  const { error } = await supabase.from("blog_posts").update({ cover_image_path: path }).eq("id", postId);
  if (error) {
    await supabase.storage.from(BLOG_BUCKET).remove([path]);
    throw domainErrorFromDatabase(error);
  }
  if (post.coverImagePath && post.coverImagePath !== path) {
    await supabase.storage.from(BLOG_BUCKET).remove([post.coverImagePath]);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "BLOG_POST_UPDATED",
    entityType: "blog_post",
    entityId: postId,
    metadata: { changed_fields: ["cover_image_path"], mime, bytes: file.size },
  });
}
