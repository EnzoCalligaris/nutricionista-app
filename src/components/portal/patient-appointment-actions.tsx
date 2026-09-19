"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cancelOwnAppointmentAction } from "@/actions/patient-booking";
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

/** Reagendar / cancelar a própria consulta (prompt Fase 6 §68–§69). Só renderizado quando elegível. */
export function PatientAppointmentActions({ appointmentId, canBook }: { appointmentId: string; canBook: boolean }) {
  const router = useRouter();
  const idPrefix = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canBook ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/paciente/agendar?reagendar=${appointmentId}`}>
            <CalendarClock data-icon="inline-start" />
            Reagendar
          </Link>
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Ban data-icon="inline-start" />
        Cancelar
      </Button>
      <AlertDialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>O horário será liberado. Se quiser, conte o motivo (opcional).</AlertDialogDescription>
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
                  const result = await cancelOwnAppointmentAction(appointmentId, reason);
                  if (result.ok) {
                    toast.success("Consulta cancelada.");
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                  setOpen(false);
                });
              }}
            >
              {isPending ? "Cancelando..." : "Cancelar consulta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
