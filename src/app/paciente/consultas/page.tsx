import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { PatientAppointmentCard } from "@/components/portal/appointment-card";
import { requirePatient } from "@/lib/auth/session";
import { listPatientAppointments } from "@/data/appointments";
import { getPatientBookingContext } from "@/services/scheduling";
import { canPatientModify, isActive } from "@/domain/scheduling/state-machine";

export const metadata: Metadata = { title: "Consultas" };
export const dynamic = "force-dynamic";

/** Consultas do paciente (prompt Fase 6 §37–§38): próxima, futuras, histórico e ações permitidas. */
export default async function PatientConsultasPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);

  if (!context) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-medium">Consultas</h1>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um cadastro de paciente. Fale com o nutricionista.
          </CardContent>
        </Card>
      </div>
    );
  }

  const appointments = await listPatientAppointments(context.patientId);
  const now = new Date();
  const upcoming = appointments
    .filter((item) => isActive(item.status) && new Date(item.endsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const [next, ...rest] = upcoming;
  const history = appointments.filter((item) => !upcoming.includes(item));
  const canBook = context.eligible;
  const confirmable = (item: (typeof appointments)[number]) => item.status === "SCHEDULED" && new Date(item.startsAt).getTime() > now.getTime();
  const modifiable = (item: (typeof appointments)[number]) =>
    canPatientModify({
      status: item.status,
      startsAt: new Date(item.startsAt),
      now,
      minCancellationNoticeHours: context.settings.minCancellationNoticeHours,
    });

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium">Consultas</h1>
          <p className="text-sm text-muted-foreground">Suas próximas consultas e o histórico de atendimentos.</p>
        </div>
        {canBook ? (
          <Button asChild>
            <Link href="/paciente/agendar">
              <CalendarPlus data-icon="inline-start" />
              Agendar consulta
            </Link>
          </Button>
        ) : null}
      </div>

      {upcoming.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">Você ainda não possui consultas agendadas.</p>
            {canBook ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/paciente/agendar">Agendar consulta</Link>
              </Button>
            ) : (
              <p className="max-w-sm text-sm text-muted-foreground">
                {context.reason === "BOOKING_DISABLED"
                  ? "O agendamento online não está disponível no momento. Combine o horário diretamente com o nutricionista."
                  : "Seu cadastro está inativo. Fale com o nutricionista para reativar o acompanhamento."}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <section aria-label="Próximas consultas" className="space-y-3">
          {next ? (
            <PatientAppointmentCard appointment={next} timeZone={context.settings.timeZone} highlight canModify={modifiable(next)} canConfirm={confirmable(next)} canBook={canBook} />
          ) : null}
          {rest.length > 0 ? (
            <>
              <h2 className="font-heading text-lg font-medium">Outras consultas futuras</h2>
              <ul className="grid gap-3">
                {rest.map((item) => (
                  <li key={item.id}>
                    <PatientAppointmentCard appointment={item} timeZone={context.settings.timeZone} canModify={modifiable(item)} canConfirm={confirmable(item)} canBook={canBook} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      )}

      <section aria-labelledby="historico" className="space-y-3">
        <h2 id="historico" className="font-heading text-lg font-medium">
          Histórico
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta anterior.</p>
        ) : (
          <ul className="grid gap-3">
            {history.map((item) => (
              <li key={item.id}>
                <PatientAppointmentCard appointment={item} timeZone={context.settings.timeZone} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
