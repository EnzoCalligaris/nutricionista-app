"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Check, CircleCheck, Pencil, UserX } from "lucide-react";
import { toast } from "sonner";
import { cancelAppointmentAction, changeAppointmentStatusAction } from "@/actions/scheduling";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canTransition, type AppointmentStatus } from "@/domain/scheduling/state-machine";

type Pending = "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCEL" | null;

const CONFIRM_COPY: Record<Exclude<Pending, null | "CANCEL">, { title: string; description: string; button: string; success: string }> = {
  CONFIRMED: {
    title: "Confirmar a consulta?",
    description: "A consulta passa a Confirmada. O paciente verá o novo status no portal.",
    button: "Confirmar consulta",
    success: "Consulta confirmada.",
  },
  COMPLETED: {
    title: "Marcar como realizada?",
    description: "Registra que o atendimento aconteceu. Esta ação não pode ser desfeita.",
    button: "Marcar como realizada",
    success: "Consulta marcada como realizada.",
  },
  NO_SHOW: {
    title: "Registrar falta?",
    description: "A consulta é mantida no histórico com status Faltou. Nada é excluído.",
    button: "Registrar falta",
    success: "Falta registrada.",
  },
};

/** Ações do nutricionista sobre a consulta (prompt Fase 6 §24/§27–§32), guiadas pela máquina de estados. */
export function AppointmentActions({ appointmentId, status }: { appointmentId: string; status: AppointmentStatus }) {
  const router = useRouter();
  const idPrefix = useId();
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const can = (to: AppointmentStatus) => canTransition(status, to, "NUTRITIONIST");

  function run(action: () => Promise<ActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPending(null);
      setReason("");
    });
  }

  const copy = pending && pending !== "CANCEL" ? CONFIRM_COPY[pending] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can("CONFIRMED") ? (
        <Button size="sm" onClick={() => setPending("CONFIRMED")}>
          <Check data-icon="inline-start" />
          Confirmar
        </Button>
      ) : null}
      {can("COMPLETED") ? (
        <Button size="sm" variant="outline" onClick={() => setPending("COMPLETED")}>
          <CircleCheck data-icon="inline-start" />
          Realizada
        </Button>
      ) : null}
      {can("NO_SHOW") ? (
        <Button size="sm" variant="outline" onClick={() => setPending("NO_SHOW")}>
          <UserX data-icon="inline-start" />
          Faltou
        </Button>
      ) : null}
      {can("RESCHEDULED") ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/agenda/${appointmentId}/reagendar`}>
            <CalendarClock data-icon="inline-start" />
            Reagendar
          </Link>
        </Button>
      ) : null}
      {can("CONFIRMED") || can("COMPLETED") ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/agenda/${appointmentId}/editar`}>
            <Pencil data-icon="inline-start" />
            Editar
          </Link>
        </Button>
      ) : null}
      {can("CANCELLED") ? (
        <Button size="sm" variant="destructive" onClick={() => setPending("CANCEL")}>
          <Ban data-icon="inline-start" />
          Cancelar
        </Button>
      ) : null}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          {pending === "CANCEL" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar a consulta?</AlertDialogTitle>
                <AlertDialogDescription>
                  O horário é liberado e a consulta fica no histórico como cancelada. Motivo opcional.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-reason`}>Motivo (opcional)</Label>
                <Textarea
                  id={`${idPrefix}-reason`}
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: paciente pediu para remarcar"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    run(() => cancelAppointmentAction(appointmentId, reason), "Consulta cancelada.");
                  }}
                >
                  {isPending ? "Cancelando..." : "Cancelar consulta"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : copy ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{copy.title}</AlertDialogTitle>
                <AlertDialogDescription>{copy.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    const target = pending as Exclude<Pending, null | "CANCEL">;
                    run(() => changeAppointmentStatusAction(appointmentId, target), copy.success);
                  }}
                >
                  {isPending ? "Salvando..." : copy.button}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
