import { FolderOpen } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MateriaisPage() {
  return (
    <ComingSoon
      icon={FolderOpen}
      title="Materiais"
      description="Upload de PDFs e arquivos, atribuição por paciente e revogação de acesso, em storage privado."
      phase="Fase 10"
    />
  );
}
