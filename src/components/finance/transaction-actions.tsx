"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cancelTransactionAction } from "@/actions/finance";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isTransactionCancellable, isTransactionEditable, type TransactionOrigin, type TransactionStatus } from "@/domain/finance/definitions";

/** Ações de lançamento (prompt Fase 7 §20–§21): só MANUAL edita/cancela; nada é apagado. */
export function TransactionActions({
  transactionId,
  description,
  origin,
  status,
  placeholder = true,
}: {
  transactionId: string;
  description: string;
  origin: TransactionOrigin;
  status: TransactionStatus;
  /** Mostra "via pagamento"/"—" quando não há ação (tabela); nos cards fica vazio. */
  placeholder?: boolean;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const editable = isTransactionEditable(origin, status);
  const cancellable = isTransactionCancellable(origin, status);
  if (!editable && !cancellable) {
    if (!placeholder) return null;
    return <span className="text-xs text-muted-foreground">{origin === "MANUAL" ? "—" : "via pagamento"}</span>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações do lançamento ${description}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editable ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/financeiro/${transactionId}/editar`}>
                <Pencil />
                Editar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {cancellable ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
              <Ban />
              Cancelar lançamento
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar o lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{description}&rdquo; deixa de contar nos totais, mas fica no histórico como cancelado. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-reason`}>Motivo (opcional)</Label>
            <Textarea id={`${idPrefix}-reason`} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await cancelTransactionAction(transactionId, reason);
                  if (result.ok) {
                    toast.success("Lançamento cancelado.");
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                  setOpen(false);
                });
              }}
            >
              {isPending ? "Cancelando..." : "Cancelar lançamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
