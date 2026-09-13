import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function AgendaPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Agenda"
      description="Visões de dia/semana/mês, horários disponíveis, bloqueios, férias e próximas sessões."
      phase="Fase 6"
    />
  );
}
