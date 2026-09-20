"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { archiveMealAnalysisAction, updateMealTimeAction } from "@/actions/food-analysis";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Ações do paciente na refeição (prompt Fase 11 §40–§41/§58): corrigir
 * (confirmada), ajustar data/hora, arquivar (confirmação; a foto é
 * removida do armazenamento, o registro fica). Toasts só após o servidor.
 */
export function MealActions({ analysisId, canEdit, canArchive, mealAtLocal, maxMealAt }: { analysisId: string; canEdit: boolean; canArchive: boolean; mealAtLocal: string; maxMealAt: string }) {
  const router = useRouter();
  const id = useId();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [mealAt, setMealAt] = useState(mealAtLocal);
  const [isPending, startTransition] = useTransition();

  function saveTime() {
    startTransition(async () => {
      const result = await updateMealTimeAction(analysisId, mealAt);
      if (result.ok) {
        toast.success("Data e hora atualizadas.");
        setEditingTime(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function archive() {
    startTransition(async () => {
      const result = await archiveMealAnalysisAction(analysisId);
      if (result.ok) {
        toast.success("Refeição arquivada.");
        router.push("/paciente/refeicoes");
        router.refresh();
      } else {
        toast.error(result.error);
        setConfirmArchive(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Ações da refeição">
        {canEdit ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/paciente/refeicoes/${analysisId}?modo=corrigir`}>
              <Pencil data-icon="inline-start" />
              Corrigir itens
            </Link>
          </Button>
        ) : null}
        {canArchive ? (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setEditingTime((value) => !value)} aria-expanded={editingTime}>
              <CalendarClock data-icon="inline-start" />
              Ajustar data/hora
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmArchive(true)}>
              <Archive data-icon="inline-start" />
              Arquivar
            </Button>
          </>
        ) : null}
      </div>
      {editingTime ? (
        <div className="flex max-w-md flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`${id}-meal-at`}>Data e hora da refeição</Label>
            <Input id={`${id}-meal-at`} type="datetime-local" value={mealAt} max={maxMealAt} onChange={(event) => setMealAt(event.target.value)} />
          </div>
          <Button size="sm" disabled={isPending} onClick={saveTime}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmArchive} onOpenChange={(open) => !open && !isPending && setConfirmArchive(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar esta refeição?</AlertDialogTitle>
            <AlertDialogDescription>A foto é removida do armazenamento e a refeição sai do seu histórico e da visão do nutricionista. Fica só um registro mínimo para auditoria. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                archive();
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
