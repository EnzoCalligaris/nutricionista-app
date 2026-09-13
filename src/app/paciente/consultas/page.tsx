import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function PatientConsultasPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Consultas"
      description="Suas próximas consultas e histórico de atendimentos, com opção de agendar/reagendar."
      phase="Fase 6"
    />
  );
}
