import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { AppointmentActions } from "@/components/scheduling/appointment-actions";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { requireNutritionist } from "@/lib/auth/session";
import { getAppointmentById, getAppointmentNotes, getRescheduleOrigin } from "@/data/appointments";
import { appointmentIdSchema } from "@/validators/scheduling";
import { formatBRL } from "@/lib/money";
import { formatDateTime, formatInstantWeekdayDate, formatTimeRange } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";
import { getSchedulingSettings } from "@/data/scheduling";

export const metadata: Metadata = { title: "Consulta" };
export const dynamic = "force-dynamic";

const PAYMENT_LABEL = { PENDING: "Pendente", CONFIRMED: "Pago", FAILED: "Falhou", REFUNDED: "Estornado" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Detalhe da consulta (prompt Fase 6 §18/§24). Ownership: id alheio -> 404. */
export default async function ConsultaPage({ params }: PageProps<"/dashboard/agenda/[id]">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = appointmentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const appointment = await getAppointmentById(parsedId.data);
  if (!appointment || appointment.nutritionistId !== nutritionist.id) notFound();

  const settings = await getSchedulingSettings(nutritionist.id);
  const date = instantToDateISO(new Date(appointment.startsAt), settings.timeZone);
  const durationMinutes = Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000);

  const [notes, rescheduledFrom] = await Promise.all([getAppointmentNotes(appointment.id), getRescheduleOrigin(appointment.id)]);

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs
        items={[
          { href: `/dashboard/agenda?view=day&date=${date}`, label: "Agenda" },
          { label: `${appointment.patientName} · ${formatInstantWeekdayDate(appointment.startsAt)}` },
        ]}
      />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium">
              <Link href={`/dashboard/pacientes/${appointment.patientId}`} className="hover:underline">
                {appointment.patientName}
              </Link>
            </h1>
            <AppointmentStatusBadge status={appointment.status} />
            <ModalityBadge modality={appointment.modality} />
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatInstantWeekdayDate(appointment.startsAt)} · {formatTimeRange(appointment.startsAt, appointment.endsAt)} · {durationMinutes} min
          </p>
        </div>
        <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
              <Field label="Plano / contrato">{appointment.planName ?? "Consulta avulsa (sem contrato)"}</Field>
              <Field label="Valor">
                {appointment.amountCents != null ? <span className="font-mono tabular-nums">{formatBRL(appointment.amountCents)}</span> : "Sem valor"}
              </Field>
              <Field label="Pagamento">{appointment.payment ? PAYMENT_LABEL[appointment.payment.status] : "Sem registro"}</Field>
              <Field label="Criada em">{formatDateTime(appointment.createdAt)}</Field>
              <Field label="Criada por">{appointment.createdBy === nutritionist.id ? "Você" : appointment.createdBy ? "Paciente (portal)" : "—"}</Field>
              {appointment.status === "CANCELLED" ? (
                <Field label="Cancelada em">
                  {formatDateTime(appointment.cancelledAt)}
                  {appointment.cancellationReason ? <span className="block text-muted-foreground">{appointment.cancellationReason}</span> : null}
                </Field>
              ) : null}
              {appointment.status === "RESCHEDULED" && appointment.rescheduledToId ? (
                <Field label="Reagendada para">
                  <Link href={`/dashboard/agenda/${appointment.rescheduledToId}`} className="underline underline-offset-4">
                    ver nova consulta
                  </Link>
                </Field>
              ) : null}
              {rescheduledFrom ? (
                <Field label="Origem">
                  Reagendada de{" "}
                  <Link href={`/dashboard/agenda/${rescheduledFrom.id}`} className="underline underline-offset-4">
                    {formatDateTime(rescheduledFrom.startsAt)}
                  </Link>
                </Field>
              ) : null}
            </dl>
            {appointment.modality === "ONLINE" ? (
              <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Plataforma da consulta online: PENDENTE DE DEFINIÇÃO — nenhum link é gerado nesta fase.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Observações internas</CardTitle>
            <CardDescription>Visíveis só para você.</CardDescription>
          </CardHeader>
          <CardContent>
            {notes.length > 0 ? (
              <ul className="space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="space-y-1">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
