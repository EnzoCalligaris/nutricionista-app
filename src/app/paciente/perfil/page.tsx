import { User } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function MeuPerfilPage() {
  return (
    <ComingSoon
      icon={User}
      title="Meu Perfil"
      description="Seus dados pessoais e de contato, e preferências da sua conta."
      phase="Fase 5"
    />
  );
}
