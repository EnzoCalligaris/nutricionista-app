import { UtensilsCrossed } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CardapiosPage() {
  return (
    <ComingSoon
      icon={UtensilsCrossed}
      title="Cardápios"
      description="Plano alimentar semanal por paciente, com refeições configuráveis e versionamento (rascunho/publicado)."
      phase="Fase 8"
    />
  );
}
