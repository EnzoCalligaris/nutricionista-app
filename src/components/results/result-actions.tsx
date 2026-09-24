"use client";

import { useActionState } from "react";
import { transitionResultAction, type ResultFormState } from "@/actions/results";
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
import type { DashboardResult } from "@/data/results";
import { publicationBlockers } from "@/domain/results/status";

const initialState: ResultFormState = {};

/**
 * Publicar / despublicar / arquivar / restaurar (prompt Fase 14 §35/§37).
 * Publicar só fica habilitado quando as condições reais estão satisfeitas; o
 * banco recusa de todo jeito, e os motivos são mostrados em texto.
 */
export function ResultActions({ result }: { result: DashboardResult }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ResultFormState, formData: FormData) => {
      const transition = String(formData.get("transition") ?? "");
      if (transition !== "publish" && transition !== "unpublish" && transition !== "archive" && transition !== "restore") {
        return { error: "Ação inválida." } satisfies ResultFormState;
      }
      return transitionResultAction(result.id, transition);
    },
    initialState,
  );

  const blockers = publicationBlockers({
    published: result.published,
    archivedAt: result.archivedAt,
    beforePath: result.beforePath,
    afterPath: result.afterPath,
    hasValidConsent: Boolean(result.consent && result.consent.revokedAt === null),
  });
  const canPublish = blockers.length === 0 && !result.published;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {result.archivedAt ? (
          <form action={formAction}>
            <input type="hidden" name="transition" value="restore" />
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? "Restaurando..." : "Restaurar"}
            </Button>
          </form>
        ) : (
          <>
            {result.published ? (
              <form action={formAction}>
                <input type="hidden" name="transition" value="unpublish" />
                <Button type="submit" variant="outline" disabled={isPending}>
                  {isPending ? "Removendo..." : "Despublicar"}
                </Button>
              </form>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" disabled={!canPublish || isPending}>
                    Publicar no site
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publicar este resultado?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As fotos passam a ser exibidas na página pública de resultados. O paciente pode revogar o
                      consentimento a qualquer momento, e o resultado sai do ar na hora.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <form action={formAction}>
                      <input type="hidden" name="transition" value="publish" />
                      <AlertDialogAction type="submit">Publicar</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" disabled={isPending}>
                  Arquivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Arquivar este resultado?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ele sai do site e do dia a dia, mas o histórico e o registro de consentimento são preservados.
                    Você pode restaurá-lo depois.
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
          </>
        )}
      </div>

      {!result.published && !result.archivedAt && blockers.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Para publicar, falta:</p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
