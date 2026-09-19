import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AppointmentForm } from "@/components/scheduling/appointment-form";
import { createAppointmentAction } from "@/actions/scheduling";
import { requireNutritionist } from "@/lib/auth/session";
import { getSchedulingSettings } from "@/data/scheduling";
import { getPatientById } from "@/data/patients";
import { getActiveContractsForPatient } from "@/data/appointments";
import { patientIdSchema } from "@/validators/patients";
import { isValidISODate } from "@/lib/calendar";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Nova consulta" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Nova consulta pelo nutricionista (prompt Fase 6 §19). `?paciente=` pré-seleciona (ownership reconferido). */
export default async function NovaConsultaPage({ searchParams }: PageProps<"/dashboard/agenda/nova">) {
  const nutritionist = await requireNutritionist();
  const params = await searchParams;
  const settings = await getSchedulingSettings(nutritionist.id);
  const today = instantToDateISO(new Date(), settings.timeZone);
  const rawDate = firstParam(params.date);
  const initialDate = rawDate && isValidISODate(rawDate) && rawDate >= today ? rawDate : today;

  const rawPatient = firstParam(params.paciente);
  const parsedPatient = rawPatient ? patientIdSchema.safeParse(rawPatient) : null;
  const patient = parsedPatient?.success ? await getPatientById(nutritionist.id, parsedPatient.data) : null;
  const initialContracts = patient ? await getActiveContractsForPatient(patient.id) : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: `/dashboard/agenda?view=day&date=${initialDate}`, label: "Agenda" }, { label: "Nova consulta" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Nova consulta</h1>
        <p className="text-sm text-muted-foreground">
          Horários livres seguem a sua disponibilidade; o banco recusa sobreposição mesmo com override.
        </p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados da consulta</CardTitle>
          <CardDescription>Duração padrão: {settings.defaultDurationMinutes} min (configurável).</CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentForm
            mode="create"
            action={createAppointmentAction}
            cancelHref={`/dashboard/agenda?view=day&date=${initialDate}`}
            defaultDurationMinutes={settings.defaultDurationMinutes}
            initialDate={initialDate}
            initialPatient={patient ? { id: patient.id, name: patient.full_name } : null}
            initialContracts={initialContracts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
