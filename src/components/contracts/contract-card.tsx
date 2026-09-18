import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractActions } from "@/components/contracts/contract-actions";
import { ContractStatusBadge, InstallmentStatusBadge } from "@/components/patients/status-badges";
import { presentInstallmentStatus } from "@/domain/contracts/status";
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
 * parcelas. Contratos antigos nunca são sobrescritos — cada um é um card.
 */
export function ContractCard({ contract, today }: { contract: PatientContract; today: string }) {
  const { financials } = contract;
  const isHiddenPlan = contract.plan.code === "ANUAL";

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
                <TableHead scope="col">Vencimento</TableHead>
                <TableHead scope="col" className="text-right">
                  Valor
                </TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="hidden pr-4 sm:table-cell">
                  Pago em
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.installments.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell className="pl-4 tabular-nums">
                    {installment.number}/{contract.installments.length}
                  </TableCell>
                  <TableCell>{formatCalendarDate(installment.dueDate)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatBRL(installment.amountCents)}</TableCell>
                  <TableCell>
                    <InstallmentStatusBadge
                      status={presentInstallmentStatus(installment.status, installment.dueDate, today)}
                    />
                  </TableCell>
                  <TableCell className="hidden pr-4 text-muted-foreground sm:table-cell">
                    {installment.paidAt ? formatInstantDate(installment.paidAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
