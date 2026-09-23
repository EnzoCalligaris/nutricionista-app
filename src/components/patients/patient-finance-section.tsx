import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractCard } from "@/components/contracts/contract-card";
import { PaymentsList } from "@/components/finance/payments-list";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { sumContractFinancials, totalForecast } from "@/domain/finance/summary";
import type { ChargeStatus } from "@/domain/payments/charges";
import { formatBRL } from "@/lib/money";
import type { PatientContract } from "@/data/contracts";
import type { PaymentListItem } from "@/data/payments";
import type { TransactionListItem } from "@/data/financial";

/**
 * Aba Financeiro do perfil do paciente (prompt Fase 7 §36–§41): resumo
 * consolidado dos contratos, parcelas com recebido/restante e ação de
 * pagamento, histórico de pagamentos (com estorno) e lançamentos vinculados.
 */
export function PatientFinanceSection({
  patient,
  contracts,
  payments,
  transactions,
  today,
  activeCharges,
  onlinePaymentEnabled = false,
}: {
  patient: { id: string; name: string; status: string };
  contracts: PatientContract[];
  payments: PaymentListItem[];
  transactions: TransactionListItem[];
  today: string;
  /** Fase 13: cobranças online abertas por parcela. */
  activeCharges?: Map<string, { chargeId: string; status: ChargeStatus }>;
  onlinePaymentEnabled?: boolean;
}) {
  const financials = contracts.map((contract) => ({ contractStatus: contract.status, ...contract.financials }));
  const totals = sumContractFinancials(financials);
  const forecast = totalForecast(financials);
  const openContracts = contracts.filter((contract) => contract.status !== "CANCELLED" && contract.financials.pendingCents > 0);
  const returnTo = `/dashboard/pacientes/${patient.id}?tab=financeiro`;

  const cards = [
    { label: "Contratado", value: totals.contractedCents, hint: "Contratos não cancelados" },
    { label: "Recebido", value: totals.receivedCents, hint: "Pagamentos confirmados" },
    { label: "Pendente", value: totals.pendingCents, hint: "Parcelas em aberto" },
    { label: "A receber", value: forecast, hint: "Só contratos ativos" },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="resumo-financeiro" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="resumo-financeiro" className="font-heading text-lg font-medium">
            Resumo
          </h2>
          {openContracts.length > 0 ? (
            <Button asChild size="sm">
              <Link href={`/dashboard/financeiro/pagamentos/novo?paciente=${patient.id}&voltar=${encodeURIComponent(returnTo)}`}>
                <Plus data-icon="inline-start" />
                Registrar pagamento
              </Link>
            </Button>
          ) : null}
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
      </section>

      <section aria-labelledby="parcelas-heading" className="space-y-3">
        <h2 id="parcelas-heading" className="font-heading text-lg font-medium">
          Contratos e parcelas
        </h2>
        {contracts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="space-y-1 py-8 text-center">
              <p className="font-medium">Nenhum contrato registrado.</p>
              <p className="text-sm text-muted-foreground">Crie um contrato na aba Contratos para gerar as parcelas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} today={today} returnTo={returnTo} activeCharges={activeCharges} onlinePaymentEnabled={onlinePaymentEnabled} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="pagamentos-heading" className="space-y-3">
        <h2 id="pagamentos-heading" className="font-heading text-lg font-medium">
          Pagamentos
        </h2>
        <PaymentsList payments={payments} />
      </section>

      <section aria-labelledby="lancamentos-paciente-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="lancamentos-paciente-heading" className="font-heading text-lg font-medium">
            Lançamentos
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/financeiro/novo">Novo lançamento</Link>
          </Button>
        </div>
        <TransactionsTable items={transactions} hasFilters={false} compact />
      </section>
    </div>
  );
}
