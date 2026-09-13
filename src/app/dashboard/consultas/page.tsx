import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function ConsultasPage() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Consultas"
      description="Histórico de atendimentos, com filtros por status e indicadores de comparecimento e receita."
      phase="Fase 6"
    />
  );
}
