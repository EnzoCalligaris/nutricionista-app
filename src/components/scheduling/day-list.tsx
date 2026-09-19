import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { formatBRL } from "@/lib/money";
import { formatTimeRange } from "@/lib/dates";
import type { AppointmentListItem } from "@/data/appointments";

const PAYMENT_LABEL = { PENDING: "Pendente", CONFIRMED: "Pago", FAILED: "Falhou", REFUNDED: "Estornado" } as const;

function durationMinutes(item: AppointmentListItem): number {
  return Math.round((new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60_000);
}

/** Visão dia (prompt Fase 6 §18): detalhes maiores por consulta, abaixo da grade. */
export function DayList({ appointments }: { appointments: AppointmentListItem[] }) {
  if (appointments.length === 0) return null;
  return (
    <section aria-label="Consultas do dia" className="space-y-2">
      <h2 className="font-heading text-lg font-medium">Consultas do dia</h2>
      <ul className="grid gap-2 lg:grid-cols-2">
        {appointments.map((item) => (
          <li key={item.id}>
            <Card size="sm">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/dashboard/agenda/${item.id}`} className="block truncate font-medium hover:underline">
                      {item.patientName}
                    </Link>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTimeRange(item.startsAt, item.endsAt)} · {durationMinutes(item)} min
                    </p>
                  </div>
                  <AppointmentStatusBadge status={item.status} />
                </div>
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><ModalityBadge modality={item.modality} /></div>
                  <div><dt className="sr-only">Plano</dt><dd>{item.planName ?? "Sem contrato vinculado"}</dd></div>
                  <div><dt className="sr-only">Valor</dt><dd>{item.amountCents != null ? formatBRL(item.amountCents) : "Sem valor"}</dd></div>
                  <div><dt className="sr-only">Pagamento</dt><dd>Pagamento: {item.payment ? PAYMENT_LABEL[item.payment.status] : "sem registro"}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
