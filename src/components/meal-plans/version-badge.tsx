import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VERSION_STATUS_LABEL, type MealPlanVersionStatus } from "@/domain/meal-plans/definitions";

const CLASS: Record<MealPlanVersionStatus, string> = {
  DRAFT: "bg-warning/15 text-warning-foreground",
  PUBLISHED: "bg-success/10 text-success",
  ARCHIVED: "bg-muted text-muted-foreground",
};

/** Status da versão do cardápio — texto sempre presente (cor nunca é o único sinal). */
export function VersionStatusBadge({ status, className }: { status: MealPlanVersionStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", CLASS[status], className)}>
      {VERSION_STATUS_LABEL[status]}
    </Badge>
  );
}
