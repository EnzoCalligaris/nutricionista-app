import { MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function FeedbacksPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Feedbacks"
      description="Mensagens de feedback enviadas pelo seu nutricionista, com histórico completo."
      phase="Fase 10"
    />
  );
}
