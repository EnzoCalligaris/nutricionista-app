import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { formatBRL } from "@/lib/money";
import { formatInstantWeekdayDate, formatTimeRange } from "@/lib/dates";
import type { AppointmentListItem } from "@/data/appointments";

const PAYMENT_LABEL = { PENDING: "Pendente", CONFIRMED: "Pago", FAILED: "Falhou", REFUNDED: "Estornado" } as const;

/** Seção Consultas do perfil do paciente no dashboard (prompt Fase 6 §36) — histórico real, mesmo data layer da agenda. */
export function PatientAppointmentsSection({
  patientId,
  appointments,
  canCreate,
}: {
  patientId: string;
  appointments: AppointmentListItem[];
  canCreate: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {appointments.length === 0
            ? "Nenhuma consulta registrada."
            : `${appointments.length} ${appointments.length === 1 ? "consulta" : "consultas"} — da mais recente à mais antiga.`}
        </p>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/dashboard/agenda/nova?paciente=${patientId}`}>
              <CalendarPlus data-icon="inline-start" />
              Nova consulta
            </Link>
          </Button>
        ) : null}
      </div>

      {appointments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Este paciente ainda não tem consultas.</CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Data</TableHead>
                  <TableHead scope="col">Horário</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">Valor</TableHead>
                  <TableHead scope="col" className="pr-4">Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4">
                      <Link href={`/dashboard/agenda/${item.id}`} className="hover:underline">
                        {formatInstantWeekdayDate(item.startsAt)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatTimeRange(item.startsAt, item.endsAt)}</TableCell>
                    <TableCell><ModalityBadge modality={item.modality} /></TableCell>
                    <TableCell><AppointmentStatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{item.amountCents != null ? formatBRL(item.amountCents) : "—"}</TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{item.payment ? PAYMENT_LABEL[item.payment.status] : "Sem registro"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ul className="grid gap-2 md:hidden" aria-label="Consultas">
            {appointments.map((item) => (
              <li key={item.id}>
                <Link href={`/dashboard/agenda/${item.id}`} className="block rounded-xl bg-card p-3 ring-1 ring-foreground/10 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium tabular-nums">
                      {formatInstantWeekdayDate(item.startsAt)} · {formatTimeRange(item.startsAt, item.endsAt)}
                    </p>
                    <AppointmentStatusBadge status={item.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ModalityBadge modality={item.modality} />
                    <span>{item.amountCents != null ? formatBRL(item.amountCents) : "Sem valor"}</span>
                    <span>· {item.payment ? PAYMENT_LABEL[item.payment.status] : "Sem pagamento"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
