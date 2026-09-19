import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { BookingFlow } from "@/components/portal/booking-flow";
import { requirePatient } from "@/lib/auth/session";
import { getAvailableSlots, getDatesWithAvailability, getPatientBookingContext, requirePatientAppointment } from "@/services/scheduling";
import { canPatientModify } from "@/domain/scheduling/state-machine";
import { appointmentIdSchema } from "@/validators/scheduling";
import { isValidISODate } from "@/lib/calendar";
import { formatTimeRange, formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Agendar consulta" };
export const dynamic = "force-dynamic";

const LOOKAHEAD_DAYS = 30;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Fluxo de agendamento do paciente (prompt Fase 6 §39–§41). O paciente vem
 * da sessão; datas/horários são calculados no servidor a partir de
 * `busy_intervals` (sem ler consultas alheias) e revalidados no banco na
 * confirmação. `?reagendar=<id>` reaproveita o mesmo fluxo.
 */
export default async function PatientAgendarPage({ searchParams }: PageProps<"/paciente/agendar">) {
  const profile = await requirePatient();
  const params = await searchParams;
  const context = await getPatientBookingContext(profile.id);

  if (!context || !context.eligible) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ href: "/paciente/consultas", label: "Consultas" }, { label: "Agendar" }]} />
        <h1 className="font-heading text-2xl font-medium">Agendar consulta</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {!context
                ? "Sua conta ainda não está vinculada a um cadastro de paciente."
                : context.reason === "BOOKING_DISABLED"
                  ? "O agendamento online não está disponível no momento. Combine o horário diretamente com o nutricionista."
                  : "Seu cadastro está inativo. Fale com o nutricionista para reativar o acompanhamento."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/paciente/consultas">Voltar para consultas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rawReschedule = firstParam(params.reagendar);
  const rescheduleId = rawReschedule ? appointmentIdSchema.safeParse(rawReschedule) : null;
  let rescheduling: { id: string; startsAt: string; endsAt: string } | null = null;
  if (rescheduleId?.success) {
    const current = await requirePatientAppointment(context.patientId, rescheduleId.data).catch(() => null);
    if (
      current &&
      canPatientModify({
        status: current.status,
        startsAt: new Date(current.startsAt),
        now: new Date(),
        minCancellationNoticeHours: context.settings.minCancellationNoticeHours,
      })
    ) {
      rescheduling = { id: current.id, startsAt: current.startsAt, endsAt: current.endsAt };
    }
  }

  const today = instantToDateISO(new Date(), context.settings.timeZone);
  const dates = await getDatesWithAvailability({ nutritionistId: context.nutritionistId, fromDate: today, days: LOOKAHEAD_DAYS, asPatient: true });
  const rawDate = firstParam(params.date);
  const selectedDate = rawDate && isValidISODate(rawDate) ? rawDate : (dates[0] ?? null);
  const { slots } = selectedDate
    ? await getAvailableSlots({
        nutritionistId: context.nutritionistId,
        date: selectedDate,
        asPatient: true,
        ignoreAppointment: rescheduling ? { startsAt: rescheduling.startsAt, endsAt: rescheduling.endsAt } : null,
      })
    : { slots: [] };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/paciente/consultas", label: "Consultas" }, { label: rescheduling ? "Reagendar" : "Agendar" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">{rescheduling ? "Reagendar consulta" : "Agendar consulta"}</h1>
        <p className="text-sm text-muted-foreground">
          {rescheduling
            ? `Consulta atual: ${formatWeekdayLong(instantToDateISO(new Date(rescheduling.startsAt), context.settings.timeZone))}, ${formatTimeRange(rescheduling.startsAt, rescheduling.endsAt)}. Escolha o novo horário.`
            : `Consulta de ${context.settings.defaultDurationMinutes} minutos. Horários em ${context.settings.timeZone.replace("_", " ")}.`}
        </p>
      </div>
      {rescheduleId?.success && !rescheduling ? (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Esta consulta não pode mais ser reagendada pelo portal. Você pode agendar uma nova abaixo.
        </p>
      ) : null}
      <BookingFlow
        dates={dates}
        selectedDate={selectedDate}
        slots={slots}
        canChooseModality={context.settings.patientCanChooseModality}
        rescheduleOf={rescheduling?.id ?? null}
        horizonDays={LOOKAHEAD_DAYS}
      />
    </div>
  );
}
