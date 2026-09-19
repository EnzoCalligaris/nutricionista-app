import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContractStatusBadge } from "@/components/patients/status-badges";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/definitions";
import type { ReceivableRow } from "@/data/financial";

/**
 * Previsão de recebimentos por contrato (prompt Fase 7 §39/§52–§55).
 * `compact` (home do dashboard) mostra só paciente, plano, pendente, próximo
 * vencimento e status.
 */
export function ReceivablesTable({ rows, compact = false }: { rows: ReceivableRow[]; compact?: boolean }) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma receita prevista.</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="hidden overflow-x-auto py-0 lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="pl-4">Paciente</TableHead>
              <TableHead scope="col">Plano</TableHead>
              {compact ? null : <TableHead scope="col" className="hidden 2xl:table-cell">Duração</TableHead>}
              {compact ? null : <TableHead scope="col" className="text-right">Contratado</TableHead>}
              {compact ? null : <TableHead scope="col" className="text-right">Recebido</TableHead>}
              <TableHead scope="col" className="text-right">Pendente</TableHead>
              {compact ? null : <TableHead scope="col" className="text-right">A receber</TableHead>}
              <TableHead scope="col">Próx. vencimento</TableHead>
              <TableHead scope="col">Status</TableHead>
              {compact ? null : <TableHead scope="col" className="hidden 2xl:table-cell">Método</TableHead>}
              <TableHead scope="col" className="pr-3 text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.contractId}>
                <TableCell className="pl-4 font-medium">
                  <Link href={`/dashboard/pacientes/${row.patientId}?tab=financeiro`} className="hover:underline">
                    {row.patientName}
                  </Link>
                </TableCell>
                <TableCell>{row.planName}</TableCell>
                {compact ? null : <TableCell className="hidden text-muted-foreground 2xl:table-cell">{row.durationMonths ? `${row.durationMonths} meses` : "—"}</TableCell>}
                {compact ? null : <TableCell className="text-right font-mono tabular-nums">{formatBRL(row.contractedCents)}</TableCell>}
                {compact ? null : <TableCell className="text-right font-mono tabular-nums text-success">{formatBRL(row.receivedCents)}</TableCell>}
                <TableCell className="text-right font-mono tabular-nums">{formatBRL(row.pendingCents)}</TableCell>
                {compact ? null : <TableCell className="text-right font-mono tabular-nums">{formatBRL(row.forecastCents)}</TableCell>}
                <TableCell>
                  {row.nextDueDate ? (
                    <span className={cn("inline-flex flex-wrap items-center gap-1.5", row.overdue && "text-destructive")}>
                      {formatCalendarDate(row.nextDueDate)}
                      {row.overdue ? <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">Atrasado</Badge> : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum</span>
                  )}
                </TableCell>
                <TableCell><ContractStatusBadge status={row.contractStatus} /></TableCell>
                {compact ? null : <TableCell className="hidden text-muted-foreground 2xl:table-cell">{row.mainMethod ? PAYMENT_METHOD_LABEL[row.mainMethod] : "—"}</TableCell>}
                <TableCell className="pr-3 text-right whitespace-nowrap">
                  {row.pendingCents > 0 ? (
                    <Button asChild size="xs" variant="outline">
                      <Link href={`/dashboard/financeiro/pagamentos/novo?paciente=${row.patientId}&voltar=${encodeURIComponent("/dashboard/financeiro/previsao")}`}>Registrar pagamento</Link>
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ul className="grid gap-2 lg:hidden" aria-label="Previsão de recebimentos">
        {rows.map((row) => (
          <li key={row.contractId} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/dashboard/pacientes/${row.patientId}?tab=financeiro`} className="block truncate font-medium hover:underline">
                  {row.patientName}
                </Link>
                <p className="text-xs text-muted-foreground">{row.planName}{row.durationMonths ? ` · ${row.durationMonths} meses` : ""}</p>
              </div>
              <ContractStatusBadge status={row.contractStatus} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><dt className="text-muted-foreground">Contratado</dt><dd className="font-mono tabular-nums">{formatBRL(row.contractedCents)}</dd></div>
              <div><dt className="text-muted-foreground">Recebido</dt><dd className="font-mono tabular-nums text-success">{formatBRL(row.receivedCents)}</dd></div>
              <div><dt className="text-muted-foreground">Pendente</dt><dd className="font-mono tabular-nums">{formatBRL(row.pendingCents)}</dd></div>
              <div><dt className="text-muted-foreground">A receber</dt><dd className="font-mono tabular-nums">{formatBRL(row.forecastCents)}</dd></div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Próximo vencimento</dt>
                <dd className={cn(row.overdue && "text-destructive")}>
                  {row.nextDueDate ? formatCalendarDate(row.nextDueDate) : "Nenhum"}
                  {row.overdue ? " · Atrasado" : ""}
                </dd>
              </div>
            </dl>
            {row.pendingCents > 0 ? (
              <Button asChild size="xs" variant="outline" className="mt-2">
                <Link href={`/dashboard/financeiro/pagamentos/novo?paciente=${row.patientId}&voltar=${encodeURIComponent("/dashboard/financeiro/previsao")}`}>Registrar pagamento</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
