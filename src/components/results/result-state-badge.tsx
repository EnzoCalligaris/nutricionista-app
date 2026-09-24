import { Badge } from "@/components/ui/badge";
import { RESULT_STATE_LABELS, type ResultState } from "@/domain/results/status";

const VARIANTS: Record<ResultState, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline",
  READY_TO_PUBLISH: "secondary",
  PUBLISHED: "default",
  CONSENT_REVOKED: "destructive",
  ARCHIVED: "outline",
};

/** Estado do resultado, sempre derivado das colunas reais. */
export function ResultStateBadge({ state }: { state: ResultState }) {
  return (
    <Badge variant={VARIANTS[state]} className="font-normal">
      {RESULT_STATE_LABELS[state]}
    </Badge>
  );
}
