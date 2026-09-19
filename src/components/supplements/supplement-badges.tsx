import { Archive, CheckCircle2, CircleOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SUPPLEMENT_STATUS_LABEL, supplementStatus, type SupplementLike } from "@/domain/patient-content/supplements";

/** Status da recomendação com ícone + texto (nunca só cor, §96). */
export function SupplementStatusBadge({ item }: { item: SupplementLike }) {
  const status = supplementStatus(item);
  if (status === "ARCHIVED") {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-muted text-muted-foreground">
        <Archive className="size-3" aria-hidden="true" />
        {SUPPLEMENT_STATUS_LABEL.ARCHIVED}
      </Badge>
    );
  }
  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-warning/15 text-warning-foreground">
        <CircleOff className="size-3" aria-hidden="true" />
        {SUPPLEMENT_STATUS_LABEL.INACTIVE}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-transparent bg-success/10 text-success">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {SUPPLEMENT_STATUS_LABEL.ACTIVE}
    </Badge>
  );
}
