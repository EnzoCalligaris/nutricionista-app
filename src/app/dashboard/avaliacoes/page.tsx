import { Ruler } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function AvaliacoesPage() {
  return (
    <ComingSoon
      icon={Ruler}
      title="Avaliações"
      description="Registro de bioimpedância e evolução do paciente, com métricas opcionais e histórico gráfico."
      phase="Fase 9"
    />
  );
}
