import { UtensilsCrossed } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MeuCardapioPage() {
  return (
    <ComingSoon
      icon={UtensilsCrossed}
      title="Meu Cardápio"
      description="A versão publicada do seu plano alimentar semanal, com refeições e substituições."
      phase="Fase 8"
    />
  );
}
