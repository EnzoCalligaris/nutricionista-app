"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { archiveFeedbackAction, deleteFeedbackAction, publishFeedbackAction } from "@/actions/feedbacks";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/actions/patients";
import { canArchiveFeedback, canDeleteFeedback, canEditFeedback, canPublishFeedback, type FeedbackLike } from "@/domain/patient-content/feedbacks";

type Pending = "archive" | "delete" | "publish" | null;

/**
 * Ações do feedback (prompt Fase 10 §24–§26/§77): disponibilizar (definitivo,
 * com confirmação), editar, arquivar (confirmação) e excluir só rascunho.
 * Toasts só após o servidor.
 */
export function FeedbackActions({ feedbackId, patientId, title, item, variant = "menu", hideEdit = false }: { feedbackId: string; patientId: string; title: string; item: FeedbackLike; variant?: "menu" | "buttons"; hideEdit?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  function go(fn: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  }

  if (!canEditFeedback(item)) return null;

  const dialogs = (
    <>
      <AlertDialog open={pending === "publish"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disponibilizar &ldquo;{title}&rdquo; ao paciente?</AlertDialogTitle>
            <AlertDialogDescription>O feedback passa a aparecer no portal do paciente. Depois disso não volta a rascunho — para ocultar, arquive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => publishFeedbackAction(feedbackId), "Feedback disponibilizado.");
              }}
            >
              Disponibilizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "archive"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>O paciente deixa de ver o feedback; o conteúdo fica guardado no histórico, só leitura. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => archiveFeedbackAction(feedbackId), "Feedback arquivado.");
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "delete"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o rascunho &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Ele nunca foi disponibilizado ao paciente, por isso pode ser excluído de vez.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => deleteFeedbackAction(feedbackId), "Rascunho excluído.");
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        {canPublishFeedback(item) ? (
          <Button size="sm" disabled={isPending} onClick={() => setPending("publish")}>
            <Send data-icon="inline-start" />
            Disponibilizar ao paciente
          </Button>
        ) : null}
        {!hideEdit ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/pacientes/${patientId}/feedbacks/${feedbackId}/editar`}>
              <Pencil data-icon="inline-start" />
              Editar
            </Link>
          </Button>
        ) : null}
        {canArchiveFeedback(item) ? (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setPending("archive")}>
            <Archive data-icon="inline-start" />
            Arquivar
          </Button>
        ) : null}
        {canDeleteFeedback(item) ? (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setPending("delete")}>
            <Trash2 data-icon="inline-start" />
            Excluir rascunho
          </Button>
        ) : null}
        {dialogs}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${title}`} disabled={isPending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPublishFeedback(item) ? (
            <DropdownMenuItem onSelect={() => setPending("publish")}>
              <Send />
              Disponibilizar ao paciente
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/pacientes/${patientId}/feedbacks/${feedbackId}/editar`}>
              <Pencil />
              Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canArchiveFeedback(item) ? (
            <DropdownMenuItem onSelect={() => setPending("archive")}>
              <Archive />
              Arquivar
            </DropdownMenuItem>
          ) : null}
          {canDeleteFeedback(item) ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setPending("delete")}>
              <Trash2 />
              Excluir rascunho
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
