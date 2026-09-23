"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { resolveReconciliationAction, runReconciliationAction } from "@/actions/payments";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Dispara a mesma rotina do job (expirar + conferir pendentes). */
export function RunReconciliationButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      data-testid="run-reconciliation"
      onClick={() =>
        startTransition(async () => {
          const result = await runReconciliationAction();
          if (result.ok) toast.success("Conferência concluída.", { description: result.summary });
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      <Play data-icon="inline-start" />
      {isPending ? "Conferindo..." : "Conferir agora"}
    </Button>
  );
}

/**
 * Resolver uma divergência (prompt Fase 13 §55): o sistema não decide por
 * conta própria — o nutricionista registra o que fez no mundo real e o item
 * sai da fila, com auditoria. Nada de dinheiro é criado ou apagado aqui.
 */
export function ResolveReconciliationButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolve(outcome: "RESOLVED" | "IGNORED") {
    startTransition(async () => {
      const result = await resolveReconciliationAction(itemId, outcome, note);
      if (result.ok) toast.success(outcome === "RESOLVED" ? "Divergência marcada como resolvida." : "Divergência arquivada.");
      else toast.error(result.error);
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="resolve-reconciliation">
        <CheckCheck data-icon="inline-start" />
        Resolver
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar divergência como resolvida?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto apenas tira o item da fila de conferência. Nenhum pagamento é criado, alterado ou apagado — registre o que foi feito para o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`note-${itemId}`}>O que foi feito (opcional)</Label>
            <Textarea id={`note-${itemId}`} rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: devolvido pelo painel do provedor em 01/10." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <Button variant="outline" disabled={isPending} onClick={() => resolve("IGNORED")}>
              Arquivar sem ação
            </Button>
            <AlertDialogAction disabled={isPending} onClick={(event) => { event.preventDefault(); resolve("RESOLVED"); }}>
              {isPending ? "Salvando..." : "Marcar como resolvida"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
