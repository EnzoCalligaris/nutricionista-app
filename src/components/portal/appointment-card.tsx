import { CalendarDays, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { ConfirmPresenceButton } from "@/components/portal/confirm-presence-button";
import { PatientAppointmentActions } from "@/components/portal/patient-appointment-actions";
import { cn } from "@/lib/utils";
import { formatTimeRange, formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";
import type { AppointmentListItem } from "@/data/appointments";

type Props = {
  appointment: AppointmentListItem;
  timeZone: string;
  /** Destaque de "próxima consulta". */
  highlight?: boolean;
  /** Quando true, mostra reagendar/cancelar. */
  canModify?: boolean;
  /** Fase 12: consulta futura ainda SCHEDULED — oferece "Confirmar presença". */
  canConfirm?: boolean;
  canBook?: boolean;
};

/** Card de consulta no portal (prompt Fase 6 §37–§38) — mobile-first. */
export function PatientAppointmentCard({ appointment, timeZone, highlight = false, canModify = false, canBook = true, canConfirm = false }: Props) {
  const date = instantToDateISO(new Date(appointment.startsAt), timeZone);
  return (
    <Card className={cn(highlight && "ring-primary/40")} id={`consulta-${appointment.id}`}>
      <CardContent className="space-y-3">
        {highlight ? <p className="text-xs font-medium tracking-wide text-primary uppercase">Próxima consulta</p> : null}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className={cn("flex items-center gap-2 font-medium", highlight && "font-heading text-lg")}>
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              {formatWeekdayLong(date)}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
              <Clock className="size-4" aria-hidden="true" />
              {formatTimeRange(appointment.startsAt, appointment.endsAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModalityBadge modality={appointment.modality} />
            <AppointmentStatusBadge status={appointment.status} />
          </div>
        </div>
        {appointment.modality === "ONLINE" && highlight ? (
          <p className="text-xs text-muted-foreground">Detalhes da consulta online serão disponibilizados pelo nutricionista.</p>
        ) : null}
        {appointment.status === "CANCELLED" && appointment.cancellationReason ? (
          <p className="text-xs text-muted-foreground">Motivo: {appointment.cancellationReason}</p>
        ) : null}
        {canConfirm || canModify ? (
          <div className="flex flex-wrap items-center gap-2">
            {canConfirm ? <ConfirmPresenceButton appointmentId={appointment.id} /> : null}
            {canModify ? <PatientAppointmentActions appointmentId={appointment.id} canBook={canBook} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
