"use client";

import { useActionState } from "react";
import { transitionPostAction, type PostFormState } from "@/actions/blog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DashboardPostDetail } from "@/data/blog";

const initialState: PostFormState = {};

/** Publicar / despublicar / arquivar (prompt Fase 14 §39). */
export function PostActions({ post }: { post: DashboardPostDetail }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: PostFormState, formData: FormData) => {
      const transition = String(formData.get("transition") ?? "");
      if (transition !== "publish" && transition !== "unpublish" && transition !== "archive") {
        return { error: "Ação inválida." } satisfies PostFormState;
      }
      return transitionPostAction(post.id, transition);
    },
    initialState,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {post.status === "PUBLISHED" ? (
          <form action={formAction}>
            <input type="hidden" name="transition" value="unpublish" />
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? "Removendo..." : "Voltar para rascunho"}
            </Button>
          </form>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="transition" value="publish" />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Publicando..." : post.status === "ARCHIVED" ? "Republicar" : "Publicar"}
            </Button>
          </form>
        )}

        {post.status !== "ARCHIVED" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Arquivar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar este post?</AlertDialogTitle>
                <AlertDialogDescription>
                  O endereço passa a responder 404 no site. O conteúdo é preservado e você pode republicar depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <form action={formAction}>
                  <input type="hidden" name="transition" value="archive" />
                  <AlertDialogAction type="submit">Arquivar</AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
