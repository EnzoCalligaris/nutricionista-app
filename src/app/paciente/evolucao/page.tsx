import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MinhaEvolucaoPage() {
  return (
    <ComingSoon
      icon={LineChart}
      title="Minha Evolução"
      description="Gráficos de bioimpedância e evolução, com histórico por métrica selecionável."
      phase="Fase 9"
    />
  );
}
