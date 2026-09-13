import { TrendingUp } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function DashboardResultadosPage() {
  return (
    <ComingSoon
      icon={TrendingUp}
      title="Resultados"
      description="Antes/depois administrável, com controle de publicação e consentimento de uso de imagem obrigatório."
      phase="Fase 14"
    />
  );
}
