import { Ban, CircleCheck, CircleDollarSign, FileSignature, RotateCcw, UserPlus, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineEvent, TimelineEventKind } from "@/domain/patients/timeline";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";

const ICONS: Record<TimelineEventKind, LucideIcon> = {
  PATIENT_CREATED: UserPlus,
  PATIENT_ARCHIVED: UserX,
  PATIENT_REACTIVATED: RotateCcw,
  CONTRACT_STARTED: FileSignature,
  CONTRACT_COMPLETED: CircleCheck,
  CONTRACT_CANCELLED: Ban,
  PAYMENT_CONFIRMED: CircleDollarSign,
};

/** Timeline vertical simples, ordenada do mais recente para o mais antigo. */
export function PatientTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((event, index) => {
        const Icon = ICONS[event.kind];
        return (
          <li key={`${event.kind}-${event.at}-${index}`} className="relative">
            <span
              className="absolute -left-[31px] top-0 flex size-5 items-center justify-center rounded-full bg-background ring-1 ring-border"
              aria-hidden="true"
            >
              <Icon className="size-3 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium leading-tight">{event.title}</p>
            {event.description ? <p className="text-xs text-muted-foreground">{event.description}</p> : null}
            <time className="text-xs text-muted-foreground" dateTime={event.at}>
              {event.isCalendarDate ? formatCalendarDate(event.at) : formatDateTime(event.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
