import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function ConfiguracoesPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Configurações"
      description="Horários de disponibilidade, dados do profissional e integrações (e-mail, WhatsApp, pagamento)."
      phase="Fase 14"
    />
  );
}
