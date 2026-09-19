import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatInstantWeekdayDate, formatTimeRange } from "@/lib/dates";
import type { AppointmentListItem } from "@/data/appointments";

export type UpcomingFilter = "today" | "7d" | "month";

export function parseUpcomingFilter(value: string | undefined): UpcomingFilter {
  return value === "today" || value === "month" ? value : "7d";
}

const FILTERS: { value: UpcomingFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Próximos 7 dias" },
  { value: "month", label: "Este mês" },
];

const PAYMENT_LABEL = { PENDING: "Pendente", CONFIRMED: "Pago", FAILED: "Falhou", REFUNDED: "Estornado" } as const;

function paymentText(item: AppointmentListItem): string {
  if (item.payment) return PAYMENT_LABEL[item.payment.status];
  return "Sem registro";
}

/** Próximas sessões (prompt Fase 6 §33–§35): ativas, mais próxima primeiro; pagamento só do que já existe. */
export function UpcomingSessions({
  items,
  filter,
  hrefForFilter,
}: {
  items: AppointmentListItem[];
  filter: UpcomingFilter;
  hrefForFilter: (filter: UpcomingFilter) => string;
}) {
  return (
    <section aria-labelledby="proximas-sessoes" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="proximas-sessoes" className="font-heading text-lg font-medium">
          Próximas sessões
        </h2>
        <nav aria-label="Período das próximas sessões" className="flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
          {FILTERS.map((option) => {
            const active = option.value === filter;
            return (
              <Link
                key={option.value}
                href={hrefForFilter(option.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma consulta neste período.</CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Data</TableHead>
                  <TableHead scope="col">Horário</TableHead>
                  <TableHead scope="col">Paciente</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col" className="text-right">Valor</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="pr-4">Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4">{formatInstantWeekdayDate(item.startsAt)}</TableCell>
                    <TableCell className="tabular-nums">{formatTimeRange(item.startsAt, item.endsAt)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/agenda/${item.id}`} className="hover:underline">
                        {item.patientName}
                      </Link>
                    </TableCell>
                    <TableCell><ModalityBadge modality={item.modality} /></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{item.amountCents != null ? formatBRL(item.amountCents) : "—"}</TableCell>
                    <TableCell><AppointmentStatusBadge status={item.status} /></TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{paymentText(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ul className="grid gap-2 md:hidden" aria-label="Próximas sessões">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/dashboard/agenda/${item.id}`} className="block rounded-xl bg-card p-3 ring-1 ring-foreground/10 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.patientName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatInstantWeekdayDate(item.startsAt)} · {formatTimeRange(item.startsAt, item.endsAt)}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={item.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ModalityBadge modality={item.modality} />
                    <span>{item.amountCents != null ? formatBRL(item.amountCents) : "Sem valor"}</span>
                    <span>· Pagamento: {paymentText(item)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
