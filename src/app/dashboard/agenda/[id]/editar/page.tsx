import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AppointmentForm } from "@/components/scheduling/appointment-form";
import { updateAppointmentAction } from "@/actions/scheduling";
import { requireNutritionist } from "@/lib/auth/session";
import { getAppointmentById } from "@/data/appointments";
import { getSchedulingSettings } from "@/data/scheduling";
import { isActive } from "@/domain/scheduling/state-machine";
import { appointmentIdSchema } from "@/validators/scheduling";
import { instantToDateISO, instantToTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Editar consulta" };
export const dynamic = "force-dynamic";

/** Edição de data/hora/duração/tipo (prompt Fase 6 §24) — só consultas ativas. */
export default async function EditarConsultaPage({ params }: PageProps<"/dashboard/agenda/[id]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = appointmentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const appointment = await getAppointmentById(parsedId.data);
  if (!appointment || appointment.nutritionistId !== nutritionist.id) notFound();

  const settings = await getSchedulingSettings(nutritionist.id);
  const startsAt = new Date(appointment.startsAt);
  const date = instantToDateISO(startsAt, settings.timeZone);
  const durationMinutes = Math.round((new Date(appointment.endsAt).getTime() - startsAt.getTime()) / 60_000);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: `/dashboard/agenda?view=day&date=${date}`, label: "Agenda" },
          { href: `/dashboard/agenda/${appointment.id}`, label: appointment.patientName },
          { label: "Editar" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Editar consulta</h1>
        <p className="text-sm text-muted-foreground">
          {appointment.patientName}. Para manter o histórico do horário anterior, prefira Reagendar.
        </p>
      </div>
      {!isActive(appointment.status) ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Só consultas agendadas ou confirmadas podem ser editadas.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Dados da consulta</CardTitle>
            <CardDescription>A alteração é revalidada no banco (disponibilidade e sobreposição).</CardDescription>
          </CardHeader>
          <CardContent>
            <AppointmentForm
              mode="edit"
              appointmentId={appointment.id}
              action={updateAppointmentAction.bind(null, appointment.id)}
              cancelHref={`/dashboard/agenda/${appointment.id}`}
              defaultDurationMinutes={settings.defaultDurationMinutes}
              initialDate={date}
              initial={{
                date,
                time: instantToTime(startsAt, settings.timeZone),
                durationMinutes,
                modality: appointment.modality,
                amount: appointment.amountCents != null ? (appointment.amountCents / 100).toFixed(2).replace(".", ",") : "",
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
