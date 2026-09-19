import { Archive, Eye, FileEdit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FEEDBACK_STATUS_LABEL, feedbackStatus, type FeedbackLike } from "@/domain/patient-content/feedbacks";

/** Status do feedback com ícone + texto (nunca só cor, §96). */
export function FeedbackStatusBadge({ item }: { item: FeedbackLike }) {
  const status = feedbackStatus(item);
  if (status === "ARCHIVED") {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-muted text-muted-foreground">
        <Archive className="size-3" aria-hidden="true" />
        {FEEDBACK_STATUS_LABEL.ARCHIVED}
      </Badge>
    );
  }
  if (status === "DRAFT") {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-warning/15 text-warning-foreground">
        <FileEdit className="size-3" aria-hidden="true" />
        {FEEDBACK_STATUS_LABEL.DRAFT}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-transparent bg-success/10 text-success">
      <Eye className="size-3" aria-hidden="true" />
      {FEEDBACK_STATUS_LABEL.PUBLISHED}
    </Badge>
  );
}
