"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { revalidatePublicBlog } from "@/lib/revalidate";
import { blogPostSchema, postIdSchema } from "@/validators/blog";
import { getDashboardPost } from "@/data/blog";
import * as service from "@/services/blog";

/**
 * Server Actions do CMS do blog (prompt Fase 14 §39–§42).
 * Publicar/despublicar/arquivar revalida `/blog`, a página do post e os
 * endereços antigos (aliases), para nenhum endereço ficar servindo HTML
 * velho depois da mudança de status (§49).
 */

export type PostFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  savedAt?: number;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[blog] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function fieldErrorsFrom(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

async function revalidatePost(postId: string) {
  revalidatePath("/dashboard/blog");
  revalidatePath(`/dashboard/blog/${postId}`);
  const post = await getDashboardPost(postId);
  revalidatePublicBlog(post ? [post.slug, ...post.aliases] : []);
}

function parsePostForm(formData: FormData) {
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  return blogPostSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    content: String(formData.get("content") ?? ""),
    categoryId: categoryId === "" ? null : categoryId,
    seoTitle: String(formData.get("seoTitle") ?? ""),
    metaDescription: String(formData.get("metaDescription") ?? ""),
  });
}

function formValues(formData: FormData): Record<string, string> {
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    content: String(formData.get("content") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    seoTitle: String(formData.get("seoTitle") ?? ""),
    metaDescription: String(formData.get("metaDescription") ?? ""),
  };
}

export async function createPostAction(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const nutritionist = await requireNutritionist();
  const values = formValues(formData);
  const parsed = parsePostForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  let created: { postId: string };
  try {
    created = await service.createPost(nutritionist.id, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  await revalidatePost(created.postId);
  redirect(`/dashboard/blog/${created.postId}?toast=post_created`);
}

export async function updatePostAction(postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const nutritionist = await requireNutritionist();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { error: domainErrorMessage("POST_NOT_FOUND") };

  const values = formValues(formData);
  const parsed = parsePostForm(formData);
  if (!parsed.success) {
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  try {
    await service.updatePost(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  await revalidatePost(id.data);
  return { ok: true, savedAt: Date.now() };
}

type PostTransition = "publish" | "unpublish" | "archive";

const TRANSITIONS: Record<PostTransition, (nutritionistId: string, postId: string) => Promise<void>> = {
  publish: service.publishPost,
  unpublish: service.unpublishPost,
  archive: service.archivePost,
};

export async function transitionPostAction(postId: string, transition: PostTransition): Promise<PostFormState> {
  const nutritionist = await requireNutritionist();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { error: domainErrorMessage("POST_NOT_FOUND") };

  const run = TRANSITIONS[transition];
  if (!run) return { error: domainErrorMessage("VALIDATION_ERROR") };

  try {
    await run(nutritionist.id, id.data);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  await revalidatePost(id.data);
  return { ok: true, savedAt: Date.now() };
}

export async function uploadPostCoverAction(postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  const nutritionist = await requireNutritionist();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { error: domainErrorMessage("POST_NOT_FOUND") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem.", fieldErrors: { file: "Selecione uma imagem." } };
  }

  try {
    await service.uploadPostCover(nutritionist.id, id.data, file);
  } catch (error) {
    const message = errorMessage(error);
    return { error: message, fieldErrors: { file: message } };
  }
  await revalidatePost(id.data);
  return { ok: true, savedAt: Date.now() };
}
