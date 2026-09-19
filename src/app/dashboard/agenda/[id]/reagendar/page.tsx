import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { RescheduleForm } from "@/components/scheduling/reschedule-form";
import { rescheduleAppointmentAction } from "@/actions/scheduling";
import { requireNutritionist } from "@/lib/auth/session";
import { getAppointmentById } from "@/data/appointments";
import { getSchedulingSettings } from "@/data/scheduling";
import { isActive } from "@/domain/scheduling/state-machine";
import { appointmentIdSchema } from "@/validators/scheduling";
import { formatInstantWeekdayDate, formatTimeRange } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Reagendar consulta" };
export const dynamic = "force-dynamic";

/** Reagendamento pelo nutricionista (prompt Fase 6 §25): original vira RESCHEDULED + nova consulta vinculada. */
export default async function ReagendarConsultaPage({ params }: PageProps<"/dashboard/agenda/[id]/reagendar">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = appointmentIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const appointment = await getAppointmentById(parsedId.data);
  if (!appointment || appointment.nutritionistId !== nutritionist.id) notFound();

  const settings = await getSchedulingSettings(nutritionist.id);
  const date = instantToDateISO(new Date(appointment.startsAt), settings.timeZone);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: `/dashboard/agenda?view=day&date=${date}`, label: "Agenda" },
          { href: `/dashboard/agenda/${appointment.id}`, label: appointment.patientName },
          { label: "Reagendar" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Reagendar consulta</h1>
        <p className="text-sm text-muted-foreground">
          {appointment.patientName} · atual: {formatInstantWeekdayDate(appointment.startsAt)},{" "}
          {formatTimeRange(appointment.startsAt, appointment.endsAt)}
        </p>
      </div>
      {!isActive(appointment.status) ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Só consultas agendadas ou confirmadas podem ser reagendadas.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Novo horário</CardTitle>
            <CardDescription>
              A consulta atual fica no histórico como reagendada e uma nova é criada com a mesma duração, contrato e
              valor — sem nova cobrança.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RescheduleForm
              action={rescheduleAppointmentAction.bind(null, appointment.id)}
              cancelHref={`/dashboard/agenda/${appointment.id}`}
              appointmentId={appointment.id}
              initialDate={date}
              initialModality={appointment.modality}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
