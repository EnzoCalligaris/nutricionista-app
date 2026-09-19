"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, GitBranchPlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { archiveMealPlanAction, createVersionAction, discardVersionAction, publishVersionAction } from "@/actions/meal-plans";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Pending = "publish" | "archive" | "discard" | null;

/**
 * Ações de versionamento (prompt Fase 8 §22–§24/§56): criar nova versão,
 * publicar (confirma quando substitui a atual), descartar rascunho e
 * arquivar plano. Toast só depois da resposta do servidor.
 */
export function PlanActions({
  planId,
  patientId,
  planTitle,
  draft,
  published,
  canCreateVersion,
  publishBlockedReason,
  archived,
  compact = false,
}: {
  planId: string;
  patientId: string;
  planTitle: string;
  draft: { id: string; versionNumber: number } | null;
  published: { id: string; versionNumber: number } | null;
  canCreateVersion: boolean;
  /** Motivo pelo qual publicar está bloqueado (estrutura incompleta) — null quando pode. */
  publishBlockedReason: string | null;
  archived: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  function go(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, success: string, after?: (id?: string) => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        after?.(result.id);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  }

  if (archived) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {draft ? (
          <>
            <Button
              size={compact ? "sm" : "default"}
              disabled={isPending || publishBlockedReason !== null}
              title={publishBlockedReason ?? undefined}
              onClick={() => {
                if (published) setPending("publish");
                else go(() => publishVersionAction(draft.id), "Plano publicado.");
              }}
            >
              <Send data-icon="inline-start" />
              Publicar versão {draft.versionNumber}
            </Button>
            {draft.versionNumber > 1 ? (
              <Button size={compact ? "sm" : "default"} variant="outline" disabled={isPending} onClick={() => setPending("discard")}>
                <Trash2 data-icon="inline-start" />
                Descartar rascunho
              </Button>
            ) : null}
          </>
        ) : null}
        {canCreateVersion ? (
          <Button
            size={compact ? "sm" : "default"}
            variant={draft ? "outline" : "default"}
            disabled={isPending}
            onClick={() =>
              go(() => createVersionAction(planId), "Nova versão criada.", (id) => {
                if (id) router.push(`/dashboard/pacientes/${patientId}/cardapio/${id}`);
              })
            }
          >
            <GitBranchPlus data-icon="inline-start" />
            Criar nova versão
          </Button>
        ) : null}
        <Button size={compact ? "sm" : "default"} variant="ghost" disabled={isPending} onClick={() => setPending("archive")}>
          <Archive data-icon="inline-start" />
          Arquivar plano
        </Button>
      </div>
      {publishBlockedReason && draft ? <p className="mt-2 text-xs text-muted-foreground">{publishBlockedReason}</p> : null}

      <AlertDialog open={pending === "publish"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar a versão {draft?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              A versão {published?.versionNumber} deixa de ser a atual e fica guardada no histórico. O paciente passa a ver a versão {draft?.versionNumber} imediatamente no portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (draft) go(() => publishVersionAction(draft.id), "Plano publicado.");
              }}
            >
              {isPending ? "Publicando..." : "Publicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "discard"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o rascunho da versão {draft?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>Todas as alterações não publicadas deste rascunho serão perdidas. As versões publicadas não são afetadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (draft) go(() => discardVersionAction(draft.id), "Rascunho descartado.", () => router.push(`/dashboard/pacientes/${patientId}?tab=cardapio`));
              }}
            >
              {isPending ? "Descartando..." : "Descartar rascunho"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "archive"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar &ldquo;{planTitle}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              O paciente deixa de ver este cardápio no portal. Todas as versões ficam guardadas no histórico e podem servir de base para um novo plano. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => archiveMealPlanAction(planId), "Plano arquivado.", () => router.push(`/dashboard/pacientes/${patientId}?tab=cardapio`));
              }}
            >
              {isPending ? "Arquivando..." : "Arquivar plano"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
