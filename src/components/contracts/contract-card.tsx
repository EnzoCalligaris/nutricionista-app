import Link from "next/link";
import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractActions } from "@/components/contracts/contract-actions";
import { ContractStatusBadge } from "@/components/patients/status-badges";
import { InstallmentBalanceBadge } from "@/components/finance/badges";
import { computeInstallmentBalance } from "@/domain/finance/installments";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate, formatInstantDate } from "@/lib/dates";
import type { PatientContract } from "@/data/contracts";

function Amount({ label, cents, tone }: { label: string; cents: number; tone?: "success" }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${tone === "success" ? "text-success" : ""}`}>{formatBRL(cents)}</dd>
    </div>
  );
}

/**
 * Um contrato do histórico (prompt Fase 5 §36–§37/§41): plano, período,
 * status, contratado/recebido/pendente/previsto (da view financeira) e as
 * parcelas com recebido/restante e ação "Registrar pagamento" (Fase 7
 * §30/§38). Contratos antigos nunca são sobrescritos — cada um é um card.
 */
export function ContractCard({ contract, today, returnTo }: { contract: PatientContract; today: string; returnTo?: string }) {
  const { financials } = contract;
  const isHiddenPlan = contract.plan.code === "ANUAL";
  const canPay = contract.status !== "CANCELLED";
  const payHref = (installmentId: string) =>
    `/dashboard/financeiro/pagamentos/novo?paciente=${contract.patientId}&parcela=${installmentId}&voltar=${encodeURIComponent(returnTo ?? `/dashboard/pacientes/${contract.patientId}?tab=financeiro`)}`;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-medium">{contract.plan.name}</h3>
              <ContractStatusBadge status={contract.status} />
              {isHiddenPlan ? <Badge variant="outline">Não disponível no site</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCalendarDate(contract.startDate)} – {formatCalendarDate(contract.endDate)}
              {contract.planPrice ? ` · ${contract.planPrice.label}` : ""}
              {contract.status === "CANCELLED" && contract.cancelledAt
                ? ` · cancelado em ${formatInstantDate(contract.cancelledAt)}`
                : ""}
            </p>
          </div>
          <ContractActions contractId={contract.id} planName={contract.plan.name} status={contract.status} />
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10">
          <Amount label="Contratado" cents={financials.contractedCents} />
          <Amount label="Recebido" cents={financials.receivedCents} tone="success" />
          <Amount label="Pendente" cents={financials.pendingCents} />
          <Amount label="Previsto" cents={financials.forecastCents} />
        </dl>

        {contract.notes ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Observações:</span> {contract.notes}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="border-t border-border px-0 pt-1">
        {contract.installments.length === 0 ? (
          <p className="px-(--card-spacing) text-sm text-muted-foreground">Nenhuma parcela registrada para este contrato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="pl-4">
                  Parcela
                </TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">Vencimento</TableHead>
                <TableHead scope="col" className="text-right">
                  Valor
                </TableHead>
                <TableHead scope="col" className="hidden text-right md:table-cell">
                  Recebido
                </TableHead>
                <TableHead scope="col" className="hidden text-right md:table-cell">
                  Restante
                </TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="hidden lg:table-cell">
                  Pago em
                </TableHead>
                <TableHead scope="col" className="pr-4 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.installments.map((installment) => {
                const balance = computeInstallmentBalance(installment, today);
                return (
                  <TableRow key={installment.id}>
                    <TableCell className="pl-4 tabular-nums">
                      {installment.number}/{contract.installments.length}
                      <span className="block text-xs text-muted-foreground sm:hidden">{formatCalendarDate(installment.dueDate)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{formatCalendarDate(installment.dueDate)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{formatBRL(installment.amountCents)}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums text-success md:table-cell">{formatBRL(balance.receivedCents)}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">{formatBRL(balance.remainingCents)}</TableCell>
                    <TableCell>
                      <InstallmentBalanceBadge status={balance.uiStatus} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {installment.paidAt ? formatInstantDate(installment.paidAt) : "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {canPay && balance.payable ? (
                        <Button asChild size="xs" variant="outline">
                          <Link href={payHref(installment.id)} aria-label={`Registrar pagamento da parcela ${installment.number}`}>
                            <Banknote data-icon="inline-start" className="md:hidden" />
                            <span className="hidden md:inline">Registrar pagamento</span>
                          </Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
