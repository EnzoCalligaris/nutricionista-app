"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, RotateCcw, UserX } from "lucide-react";
import { toast } from "sonner";
import { archivePatientAction, reactivatePatientAction, type ActionResult } from "@/actions/patients";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canArchivePatient, canReactivatePatient, type PatientDbStatus } from "@/domain/patients/status";

type Props = {
  patientId: string;
  fullName: string;
  dbStatus: PatientDbStatus;
  /** "menu": dropdown compacto (linha da tabela). "buttons": botões visíveis (header do perfil). */
  variant?: "menu" | "buttons";
  /** Na listagem mostra "Visualizar"; no perfil não faz sentido. */
  showView?: boolean;
};

type PendingAction = "archive" | "reactivate" | null;

/**
 * Ações do paciente (prompt Fase 5 §11/§54/§55): Visualizar, Editar,
 * Desativar (com confirmação), Reativar (quando o status manual permite).
 * Sem hard delete. O toast só aparece depois da resposta da action.
 */
export function PatientActions({ patientId, fullName, dbStatus, variant = "menu", showView = true }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isPending, startTransition] = useTransition();

  const canArchive = canArchivePatient(dbStatus);
  const canReactivate = canReactivatePatient(dbStatus);

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

  const confirmDialog = (
    <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && !isPending && setPendingAction(null)}>
      <AlertDialogContent>
        {pendingAction === "archive" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar {fullName}?</AlertDialogTitle>
              <AlertDialogDescription>
                O paciente deixa de aparecer como ativo. Contratos, parcelas, pagamentos, consultas e
                todo o histórico são preservados — nada é excluído. Você pode reativar depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={(event) => {
                  event.preventDefault();
                  run(() => archivePatientAction(patientId), "Paciente desativado.");
                }}
              >
                {isPending ? "Desativando..." : "Desativar paciente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Reativar {fullName}?</AlertDialogTitle>
              <AlertDialogDescription>
                O cadastro volta a ficar ativo. O paciente só conta como &ldquo;ativo&rdquo; de fato quando
                houver um contrato vigente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={(event) => {
                  event.preventDefault();
                  run(() => reactivatePatientAction(patientId), "Paciente reativado.");
                }}
              >
                {isPending ? "Reativando..." : "Reativar paciente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link href={`/dashboard/pacientes/${patientId}/editar`}>
            <Pencil data-icon="inline-start" />
            Editar
          </Link>
        </Button>
        {canArchive ? (
          <Button variant="outline" onClick={() => setPendingAction("archive")}>
            <UserX data-icon="inline-start" />
            Desativar
          </Button>
        ) : null}
        {canReactivate ? (
          <Button variant="outline" onClick={() => setPendingAction("reactivate")}>
            <RotateCcw data-icon="inline-start" />
            Reativar
          </Button>
        ) : null}
        {confirmDialog}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${fullName}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/pacientes/${patientId}`}>
                <Eye />
                Visualizar
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/pacientes/${patientId}/editar`}>
              <Pencil />
              Editar
            </Link>
          </DropdownMenuItem>
          {canArchive || canReactivate ? <DropdownMenuSeparator /> : null}
          {canArchive ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setPendingAction("archive")}>
              <UserX />
              Desativar
            </DropdownMenuItem>
          ) : null}
          {canReactivate ? (
            <DropdownMenuItem onSelect={() => setPendingAction("reactivate")}>
              <RotateCcw />
              Reativar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
