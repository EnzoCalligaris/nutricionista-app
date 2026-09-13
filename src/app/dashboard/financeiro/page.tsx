import { CircleDollarSign } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function FinanceiroPage() {
  return (
    <ComingSoon
      icon={CircleDollarSign}
      title="Financeiro"
      description="Receita, despesa e saldo, com lançamentos manuais e automáticos a partir de consultas e pagamentos."
      phase="Fase 7"
    />
  );
}
