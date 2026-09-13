import { FolderOpen } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function PatientMateriaisPage() {
  return (
    <ComingSoon
      icon={FolderOpen}
      title="Materiais"
      description="PDFs e arquivos atribuídos a você pelo seu nutricionista."
      phase="Fase 10"
    />
  );
}
