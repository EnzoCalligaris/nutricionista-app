"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CircleOff, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { archiveSupplementAction, deactivateSupplementAction, reactivateSupplementAction } from "@/actions/supplements";
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
import { canArchiveSupplement, canDeactivateSupplement, canEditSupplement, canReactivateSupplement, type SupplementLike } from "@/domain/patient-content/supplements";

type Pending = "archive" | "deactivate" | null;

/**
 * Ações da recomendação (prompt Fase 10 §13–§14/§77): editar, encerrar
 * (paciente deixa de ver; reativação explícita), reativar, arquivar
 * (definitivo, com confirmação). Toasts só após o servidor.
 */
export function SupplementActions({ supplementId, patientId, name, item }: { supplementId: string; patientId: string; name: string; item: SupplementLike }) {
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

  if (!canEditSupplement(item) && !canReactivateSupplement(item)) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Ações de ${name}`} disabled={isPending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditSupplement(item) ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/pacientes/${patientId}/suplementos/${supplementId}/editar`}>
                <Pencil />
                Editar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canDeactivateSupplement(item) ? (
            <DropdownMenuItem onSelect={() => setPending("deactivate")}>
              <CircleOff />
              Encerrar recomendação
            </DropdownMenuItem>
          ) : null}
          {canReactivateSupplement(item) ? (
            <DropdownMenuItem onSelect={() => go(() => reactivateSupplementAction(supplementId), "Recomendação reativada.")}>
              <RotateCcw />
              Reativar
            </DropdownMenuItem>
          ) : null}
          {canArchiveSupplement(item) ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setPending("archive")}>
                <Archive />
                Arquivar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pending === "deactivate"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>O paciente deixa de ver esta recomendação como ativa. Ela fica no histórico e pode ser reativada depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => deactivateSupplementAction(supplementId), "Recomendação encerrada.");
              }}
            >
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "archive"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>O paciente deixa de ver a recomendação e ela passa a ser só leitura no histórico. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => archiveSupplementAction(supplementId), "Recomendação arquivada.");
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
