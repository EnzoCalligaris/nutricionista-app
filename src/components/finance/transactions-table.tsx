import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinancialTypeBadge, OriginText, TransactionStatusBadge } from "@/components/finance/badges";
import { TransactionActions } from "@/components/finance/transaction-actions";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL, TRANSACTION_ORIGIN_LABEL } from "@/domain/finance/definitions";
import type { TransactionListItem } from "@/data/financial";

function Amount({ item }: { item: TransactionListItem }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums whitespace-nowrap",
        item.status === "CANCELLED" ? "text-muted-foreground line-through" : item.type === "INCOME" ? "text-success" : "text-foreground",
      )}
    >
      {item.type === "EXPENSE" ? "− " : ""}
      {formatBRL(item.amountCents)}
    </span>
  );
}

/**
 * Tabela de lançamentos (prompt Fase 7 §10–§11/§73): completa em `xl`,
 * colunas secundárias escondidas em `lg`, cards abaixo de `lg`.
 */
export function TransactionsTable({ items, hasFilters, compact = false }: { items: TransactionListItem[]; hasFilters: boolean; compact?: boolean }) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {compact ? "Nenhum lançamento vinculado a este paciente." : hasFilters ? "Nenhum lançamento encontrado com esses filtros." : "Nenhum lançamento neste período."}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="hidden py-0 lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="pl-4">Data</TableHead>
              <TableHead scope="col">Descrição</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">Categoria</TableHead>
              <TableHead scope="col">Tipo</TableHead>
              <TableHead scope="col" className="text-right">Valor</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">Método</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">Origem</TableHead>
              {compact ? null : <TableHead scope="col">Paciente</TableHead>}
              <TableHead scope="col" className="w-12 pr-3 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pl-4 text-muted-foreground">{formatCalendarDate(item.occurredOn)}</TableCell>
                <TableCell className="max-w-56 truncate font-medium" title={item.description}>
                  {item.description}
                  {item.dueOn && item.status === "PENDING" ? (
                    <span className="block text-xs font-normal text-muted-foreground">vence {formatCalendarDate(item.dueOn)}</span>
                  ) : null}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">{item.categoryName ?? "—"}</TableCell>
                <TableCell><FinancialTypeBadge type={item.type} /></TableCell>
                <TableCell className="text-right"><Amount item={item} /></TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">{item.paymentMethod ? PAYMENT_METHOD_LABEL[item.paymentMethod] : "—"}</TableCell>
                <TableCell><TransactionStatusBadge status={item.uiStatus} /></TableCell>
                <TableCell className="hidden xl:table-cell"><OriginText origin={item.origin} /></TableCell>
                {compact ? null : (
                  <TableCell className="max-w-40 truncate" title={item.patientName ?? undefined}>
                    {item.patientId && item.patientName ? (
                      <Link href={`/dashboard/pacientes/${item.patientId}?tab=financeiro`} className="hover:underline">
                        {item.patientName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="pr-3 text-right">
                  <TransactionActions transactionId={item.id} description={item.description} origin={item.origin} status={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ul className="grid gap-2 lg:hidden" aria-label="Lançamentos">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCalendarDate(item.occurredOn)}
                  {item.categoryName ? ` · ${item.categoryName}` : ""}
                  {!compact && item.patientName ? ` · ${item.patientName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Amount item={item} />
                <TransactionActions transactionId={item.id} description={item.description} origin={item.origin} status={item.status} placeholder={false} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <FinancialTypeBadge type={item.type} />
              <TransactionStatusBadge status={item.uiStatus} />
              <span>{TRANSACTION_ORIGIN_LABEL[item.origin]}</span>
              {item.paymentMethod ? <span>· {PAYMENT_METHOD_LABEL[item.paymentMethod]}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
