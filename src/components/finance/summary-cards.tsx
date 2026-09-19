import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import type { PeriodSummary } from "@/domain/finance/summary";

type CardSpec = { title: string; value: string; hint: string; detail?: string; tone?: "success" | "destructive" | "default" };

function SummaryCard({ title, value, hint, detail, tone = "default" }: CardSpec) {
  return (
    <Card size="sm">
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
        <p
          className={cn(
            "font-heading text-2xl font-medium tabular-nums",
            tone === "success" && "text-success",
            tone === "destructive" && "text-destructive",
          )}
        >
          {value}
        </p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Cards do financeiro (prompt Fase 7 §3/§5–§8): definições em src/domain/finance/definitions.ts. */
export function FinanceSummaryCards({ summary, periodLabel }: { summary: PeriodSummary; periodLabel: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard
          title="Receita"
          value={formatBRL(summary.incomeCents)}
          tone="success"
          hint={`Lançamentos de receita com status Pago (data do lançamento em ${periodLabel}). Pagamentos de contratos e consultas entram aqui quando confirmados. Valor contratado nunca conta.`}
          detail="receita paga no período"
        />
        <SummaryCard
          title="Despesas"
          value={formatBRL(summary.expenseCents)}
          hint={`Lançamentos de despesa com status Pago em ${periodLabel}.`}
          detail="despesas pagas no período"
        />
        <SummaryCard
          title="Saldo"
          value={formatBRL(summary.balanceCents)}
          tone={summary.balanceCents < 0 ? "destructive" : "default"}
          hint="Receita paga menos despesas pagas. Pendentes nunca entram no saldo realizado."
          detail="receita − despesas (realizado)"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard
          title="Recebido"
          value={formatBRL(summary.receivedCents)}
          hint={`Pagamentos confirmados de pacientes (contratos, parcelas e consultas) com data de pagamento em ${periodLabel}.`}
          detail="pagamentos confirmados"
        />
        <SummaryCard
          title="Pendente"
          value={formatBRL(summary.pendingCents)}
          hint={`Saldo em aberto das parcelas (valor − recebido) com vencimento em ${periodLabel}, de contratos não cancelados. Pagamentos parciais descontam.`}
          detail={summary.overdueCents > 0 ? `${formatBRL(summary.overdueCents)} em atraso` : "nada em atraso"}
        />
        <SummaryCard
          title="Previsto"
          value={formatBRL(summary.forecastCents)}
          hint={`Saldo em aberto das parcelas com vencimento em ${periodLabel} só de contratos ativos — contrato cancelado ou encerrado não projeta receita.`}
          detail="a receber de contratos ativos"
        />
      </div>
    </div>
  );
}
