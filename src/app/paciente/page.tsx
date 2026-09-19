import Link from "next/link";
import { Camera, CalendarPlus, LineChart, MessageSquare, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { requirePatient } from "@/lib/auth/session";
import { listPatientAppointments } from "@/data/appointments";
import { getPatientBookingContext } from "@/services/scheduling";
import { isActive } from "@/domain/scheduling/state-machine";
import { formatTimeRange, formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const futureCards = [
  { title: "Cardápio do dia", icon: UtensilsCrossed, phase: "Fase 8" },
  { title: "Último feedback", icon: MessageSquare, phase: "Fase 10" },
  { title: "Última avaliação", icon: LineChart, phase: "Fase 9" },
] as const;

/** Início do portal: próxima consulta real (Fase 6); demais cards continuam previstos para fases futuras. */
export default async function PatientHomePage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const now = new Date();
  const next = context
    ? (await listPatientAppointments(context.patientId))
        .filter((item) => isActive(item.status) && new Date(item.endsAt).getTime() >= now.getTime())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
    : null;
  const timeZone = context?.settings.timeZone ?? "America/Sao_Paulo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Início</h1>
        <p className="text-sm text-muted-foreground">Olá, {profile.full_name.split(" ")[0]}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Próxima consulta</CardTitle>
            <CalendarPlus className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {next ? (
              <div className="space-y-2">
                <p className="font-heading text-lg font-medium">{formatWeekdayLong(instantToDateISO(new Date(next.startsAt), timeZone))}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{formatTimeRange(next.startsAt, next.endsAt)}</p>
                <div className="flex flex-wrap gap-2">
                  <ModalityBadge modality={next.modality} />
                  <AppointmentStatusBadge status={next.status} />
                </div>
                <Link href={`/paciente/consultas#consulta-${next.id}`} className="text-sm underline underline-offset-4">
                  Ver detalhes
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma consulta agendada.</p>
            )}
          </CardContent>
        </Card>
        {futureCards.map(({ title, icon: Icon, phase }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="font-sans text-sm font-normal text-muted-foreground">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Disponível em uma próxima etapa ({phase}).</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {context?.eligible ? (
          <Button asChild>
            <Link href="/paciente/agendar">
              <CalendarPlus data-icon="inline-start" />
              Agendar consulta
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/paciente/consultas">
              <CalendarPlus data-icon="inline-start" />
              Minhas consultas
            </Link>
          </Button>
        )}
        <Button disabled variant="secondary">
          <Camera data-icon="inline-start" />
          Analisar refeição (Fase 11)
        </Button>
      </div>
    </div>
  );
}
