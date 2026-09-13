import { MessageSquare } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function ComentariosPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Comentários"
      description="Comentários internos do nutricionista sobre sessões de cada paciente, com histórico preservado."
      phase="Fase 5"
    />
  );
}
