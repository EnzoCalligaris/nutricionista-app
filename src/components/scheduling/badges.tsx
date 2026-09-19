import { MapPin, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS_LABEL, MODALITY_LABEL, type AppointmentStatus } from "@/domain/scheduling/state-machine";
import type { Modality } from "@/domain/scheduling/slots";

// Status sempre com texto — cor nunca é o único sinal (prompt Fase 6 §75).
export const APPOINTMENT_STATUS_CLASS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-primary/10 text-primary",
  CONFIRMED: "bg-success/10 text-success",
  COMPLETED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-warning/15 text-warning-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  RESCHEDULED: "bg-muted text-muted-foreground",
};

/** Cor de borda/fundo dos blocos no calendário (tokens semânticos do design system). */
export const APPOINTMENT_BLOCK_CLASS: Record<AppointmentStatus, string> = {
  SCHEDULED: "border-primary/60 bg-primary/10 text-foreground",
  CONFIRMED: "border-success/60 bg-success/10 text-foreground",
  COMPLETED: "border-border bg-muted text-muted-foreground",
  NO_SHOW: "border-warning/60 bg-warning/15 text-foreground",
  CANCELLED: "border-destructive/40 bg-destructive/5 text-muted-foreground line-through",
  RESCHEDULED: "border-border bg-muted/60 text-muted-foreground line-through",
};

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", APPOINTMENT_STATUS_CLASS[status], className)}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ModalityBadge({ modality, className }: { modality: Modality; className?: string }) {
  const Icon = modality === "ONLINE" ? Video : MapPin;
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon aria-hidden="true" />
      {MODALITY_LABEL[modality]}
    </Badge>
  );
}
