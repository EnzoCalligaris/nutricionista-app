import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABEL, EVENT_LABEL, isNotificationEventType, type NotificationChannel } from "@/domain/notifications/events";
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from "@/domain/notifications/retry";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  PENDING: "bg-warning/15 text-warning-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  SENT: "bg-success/10 text-success",
  DELIVERED: "bg-success/20 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
  SKIPPED: "bg-muted text-muted-foreground",
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASS[status])} data-status={status}>
      {DELIVERY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  return <Badge variant="secondary">{CHANNEL_LABEL[channel]}</Badge>;
}

export function eventLabel(eventType: string | null): string {
  if (!eventType) return "—";
  return isNotificationEventType(eventType) ? EVENT_LABEL[eventType] : eventType;
}
