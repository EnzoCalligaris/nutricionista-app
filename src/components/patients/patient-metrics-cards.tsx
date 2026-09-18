import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import type { PatientMetrics } from "@/data/patients";

/**
 * Cards superiores de /dashboard/pacientes (prompt Fase 5 §2–§5). As regras
 * de cálculo estão em `src/data/patients.ts#getPatientMetrics` e
 * `src/domain/patients/metrics.ts`; aqui só apresentação + tooltip
 * explicando cada número.
 */
export function PatientMetricsCards({ metrics }: { metrics: PatientMetrics }) {
  const { averageTicket, ticketPeriod } = metrics;
  const period = `${formatCalendarDate(ticketPeriod.start)} a ${formatCalendarDate(ticketPeriod.end)}`;

  const cards = [
    {
      title: "Pacientes ativos",
      value: String(metrics.activePatients),
      hint: "Pacientes com cadastro ativo e contrato vigente. Cadastros ativos sem contrato vigente não entram aqui.",
      detail: "cadastro ativo + contrato vigente",
    },
    {
      title: "Ticket médio",
      value: formatBRL(averageTicket.averageCents),
      hint: `Receita efetivamente recebida no mês (pagamentos confirmados de ${period}) dividida pelo número de pacientes que pagaram no período. Não usa o valor contratado.`,
      detail:
        averageTicket.payingPatients === 0
          ? "nenhum pagamento no mês"
          : `${formatBRL(averageTicket.receivedCents)} de ${averageTicket.payingPatients} ${averageTicket.payingPatients === 1 ? "pagante" : "pagantes"} no mês`,
    },
    {
      title: "Total de pacientes",
      value: String(metrics.totalPatients),
      hint: "Todos os pacientes cadastrados: ativos, sem contrato e desativados. Nenhum registro é excluído.",
      detail: "ativos + inativos",
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ title, value, hint, detail }) => (
        <Card key={title} size="sm">
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <CardTitle className="font-sans text-sm font-normal text-muted-foreground">{title}</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={`Como é calculado: ${title}`}
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64 text-pretty">
                  {hint}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-medium tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
