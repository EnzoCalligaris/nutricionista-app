import { Pill } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function SuplementosPage() {
  return (
    <ComingSoon
      icon={Pill}
      title="Suplementos"
      description="Recomendações de suplementação registradas pelo seu nutricionista."
      phase="Fase 10"
    />
  );
}
