import { Users } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function PacientesPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Pacientes"
      description="Cadastro, busca, filtros e perfil completo de cada paciente (contratos, pagamentos, consultas, cardápio, avaliações)."
      phase="Fase 5"
    />
  );
}
