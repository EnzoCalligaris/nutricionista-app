"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeBlockedTimeAction } from "@/actions/scheduling";
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
import type { BlockedTime } from "@/data/scheduling";
import { formatDateTime, formatInstantDate } from "@/lib/dates";

function describe(block: BlockedTime): string {
  if (block.allDay) {
    const start = formatInstantDate(block.startsAt);
    const end = formatInstantDate(new Date(new Date(block.endsAt).getTime() - 1).toISOString());
    return start === end ? `${start} · dia inteiro` : `${start} – ${end} · dias inteiros`;
  }
  return `${formatDateTime(block.startsAt)} – ${formatDateTime(block.endsAt)}`;
}

/** Lista de bloqueios futuros com remoção (prompt Fase 6 §9). */
export function BlockedTimesList({ blocks }: { blocks: BlockedTime[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<BlockedTime | null>(null);
  const [isPending, startTransition] = useTransition();

  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum bloqueio futuro.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {blocks.map((block) => (
          <li key={block.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm">{block.reason ?? "Bloqueio"}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{describe(block)}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setPending(block)} aria-label={`Remover bloqueio ${block.reason ?? ""} ${describe(block)}`}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bloqueio?</AlertDialogTitle>
            <AlertDialogDescription>{pending ? describe(pending) : ""} — o período volta a ficar disponível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!pending) return;
                const id = pending.id;
                startTransition(async () => {
                  const result = await removeBlockedTimeAction(id);
                  if (result.ok) {
                    toast.success("Bloqueio removido.");
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                  setPending(null);
                });
              }}
            >
              {isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
