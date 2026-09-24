"use client";

import { useActionState, useId, useState } from "react";
import { createPostAction, updatePostAction, type PostFormState } from "@/actions/blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/blog/rich-text-editor";
import { slugify, slugChangeWarning } from "@/domain/blog/slug";
import type { DashboardPostDetail } from "@/data/blog";

const initialState: PostFormState = {};

/**
 * Formulário do post (prompt Fase 14 §39/§41/§42). O aviso de troca de
 * endereço aparece ANTES de salvar (§42): o endereço antigo passa a
 * redirecionar, mas o autor precisa saber que a URL muda.
 */
export function PostForm({
  post,
  categories,
}: {
  post: DashboardPostDetail | null;
  categories: { id: string; name: string }[];
}) {
  const action = post ? updatePostAction.bind(null, post.id) : createPostAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values;

  const [title, setTitle] = useState(values?.title ?? post?.title ?? "");
  const [slug, setSlug] = useState(values?.slug ?? post?.slug ?? "");

  const effectiveSlug = slug.trim() !== "" ? slug.trim() : slugify(title);
  const warning = post ? slugChangeWarning(post.slug, effectiveSlug, post.status === "PUBLISHED") : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-title`}>Título</Label>
          <Input
            id={`${idPrefix}-title`}
            name="title"
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={fieldErrors.title ? true : undefined}
          />
          {fieldErrors.title ? <p className="text-xs text-destructive">{fieldErrors.title}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-slug`}>Endereço (slug)</Label>
          <Input
            id={`${idPrefix}-slug`}
            name="slug"
            maxLength={90}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={slugify(title) || "gerado-a-partir-do-titulo"}
            aria-invalid={fieldErrors.slug ? true : undefined}
          />
          {fieldErrors.slug ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              /blog/{effectiveSlug || "…"} — em branco, é gerado do título.
            </p>
          )}
        </div>
      </div>

      {warning ? (
        <p role="status" className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          {warning}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Categoria</Label>
          <NativeSelect id={`${idPrefix}-category`} name="categoryId" defaultValue={values?.categoryId ?? post?.categoryId ?? ""}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-excerpt`}>Resumo</Label>
          <Textarea
            id={`${idPrefix}-excerpt`}
            name="excerpt"
            rows={2}
            maxLength={320}
            defaultValue={values?.excerpt ?? post?.excerpt ?? ""}
          />
          <p className="text-xs text-muted-foreground">Aparece na listagem do blog.</p>
        </div>
      </div>

      <RichTextEditor name="content" defaultValue={values?.content ?? post?.contentSource ?? ""} error={fieldErrors.content} />

      <fieldset className="space-y-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">SEO</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-seoTitle`}>Título de SEO</Label>
            <Input
              id={`${idPrefix}-seoTitle`}
              name="seoTitle"
              maxLength={70}
              defaultValue={values?.seoTitle ?? post?.seoTitle ?? ""}
              placeholder="Em branco usa o título do post"
              aria-invalid={fieldErrors.seoTitle ? true : undefined}
            />
            {fieldErrors.seoTitle ? <p className="text-xs text-destructive">{fieldErrors.seoTitle}</p> : <p className="text-xs text-muted-foreground">Até 70 caracteres.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-metaDescription`}>Descrição de SEO</Label>
            <Textarea
              id={`${idPrefix}-metaDescription`}
              name="metaDescription"
              rows={2}
              maxLength={180}
              defaultValue={values?.metaDescription ?? post?.metaDescription ?? ""}
              placeholder="Em branco usa o resumo"
              aria-invalid={fieldErrors.metaDescription ? true : undefined}
            />
            {fieldErrors.metaDescription ? (
              <p className="text-xs text-destructive">{fieldErrors.metaDescription}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Até 180 caracteres. Uma frase honesta, sem repetir palavra-chave.</p>
            )}
          </div>
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-primary">
          Post salvo.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : post ? "Salvar post" : "Criar rascunho"}
        </Button>
      </div>
    </form>
  );
}
