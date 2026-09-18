"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cancelContractAction, completeContractAction } from "@/actions/contracts";
import type { ActionResult } from "@/actions/patients";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canCancelContract, canCompleteContract, type ContractStatus } from "@/domain/contracts/status";

type PendingAction = "cancel" | "complete" | null;

/**
 * Ações de contrato (prompt Fase 5 §35): cancelar (com confirmação) e
 * encerrar. Nada é apagado; toast só depois da resposta da action.
 */
export function ContractActions({
  contractId,
  planName,
  status,
}: {
  contractId: string;
  planName: string;
  status: ContractStatus;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const canCancel = canCancelContract(status);
  const canComplete = canCompleteContract(status);
  if (!canCancel && !canComplete) return null;

  function run(action: () => Promise<ActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPendingAction(null);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações do contrato ${planName}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canComplete ? (
            <DropdownMenuItem onSelect={() => setPendingAction("complete")}>
              <CircleCheck />
              Encerrar contrato
            </DropdownMenuItem>
          ) : null}
          {canCancel ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setPendingAction("cancel")}>
              <Ban />
              Cancelar contrato
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && !isPending && setPendingAction(null)}>
        <AlertDialogContent>
          {pendingAction === "cancel" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar o contrato {planName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  As parcelas em aberto deixam de ser cobradas. Parcelas pagas, pagamentos, lançamentos
                  financeiros e o histórico do contrato são preservados. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    run(() => cancelContractAction(contractId), "Contrato cancelado.");
                  }}
                >
                  {isPending ? "Cancelando..." : "Cancelar contrato"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar o contrato {planName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O contrato passa a &ldquo;Encerrado&rdquo;. Parcelas ainda pendentes continuam como valores
                  a receber. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    run(() => completeContractAction(contractId), "Contrato encerrado.");
                  }}
                >
                  {isPending ? "Encerrando..." : "Encerrar contrato"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
