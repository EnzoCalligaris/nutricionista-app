import { CalendarCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const overviewCards = [
  { title: "Faturamento do mês", icon: Wallet },
  { title: "Consultas do dia", icon: CalendarCheck },
  { title: "Total de pacientes ativos", icon: Users },
  { title: "Previsão de rendimento", icon: TrendingUp },
] as const;

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          Dados reais chegam na Fase 7 (Financeiro) e Fase 5 (Pacientes).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map(({ title, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {title}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Previsão de recebimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tabela de contratado / recebido / pendente / previsto por
            paciente — implementada na Fase 7 (ver docs/PROJECT_SPEC.md §6).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
