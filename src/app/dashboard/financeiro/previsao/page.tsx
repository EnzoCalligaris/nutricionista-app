import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { requireNutritionist } from "@/lib/auth/session";
import { getReceivablesForecast } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
import { instantToDateISO } from "@/lib/timezone";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Previsão de recebimentos" };
export const dynamic = "force-dynamic";

/**
 * Previsão de recebimentos por contrato (prompt Fase 7 §39/§52–§55).
 * Contratado, recebido e pendente vêm das parcelas; "a receber" só conta
 * contratos ativos (definições em `src/domain/finance/definitions.ts`).
 */
export default async function PrevisaoPage() {
  const nutritionist = await requireNutritionist();
  const settings = await getSchedulingSettings(nutritionist.id);
  const today = instantToDateISO(new Date(), settings.timeZone);
  const rows = await getReceivablesForecast(nutritionist.id, today);

  const totals = rows.reduce(
    (acc, row) => ({
      contracted: acc.contracted + row.contractedCents,
      received: acc.received + row.receivedCents,
      pending: acc.pending + row.pendingCents,
      forecast: acc.forecast + row.forecastCents,
      overdue: acc.overdue + (row.overdue ? 1 : 0),
    }),
    { contracted: 0, received: 0, pending: 0, forecast: 0, overdue: 0 },
  );

  const cards = [
    { label: "Contratado", value: totals.contracted, hint: "Soma dos contratos não cancelados" },
    { label: "Recebido", value: totals.received, hint: "Pagamentos confirmados" },
    {
      label: "Pendente",
      value: totals.pending,
      hint: totals.overdue > 0 ? `${totals.overdue} ${totals.overdue === 1 ? "contrato com parcela atrasada" : "contratos com parcela atrasada"}` : "Parcelas em aberto",
    },
    { label: "A receber", value: totals.forecast, hint: "Só contratos ativos" },
  ];

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs items={[{ href: "/dashboard/financeiro", label: "Financeiro" }, { label: "Previsão de recebimentos" }]} />

      <div>
        <h1 className="font-heading text-2xl font-medium">Previsão de recebimentos</h1>
        <p className="text-sm text-muted-foreground">Parcelas em aberto por contrato, com o próximo vencimento de cada paciente.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} size="sm">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">{formatBRL(card.value)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{card.hint}</CardContent>
          </Card>
        ))}
      </div>

      <ReceivablesTable rows={rows} />
    </div>
  );
}
