import Link from "next/link";
import { Camera, CalendarPlus, LineChart, MessageSquare, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { requirePatient } from "@/lib/auth/session";
import { listPatientAppointments } from "@/data/appointments";
import { getPatientBookingContext } from "@/services/scheduling";
import { isActive } from "@/domain/scheduling/state-machine";
import { getPublishedMealPlan } from "@/data/meal-plans";
import { listVisibleAssessments } from "@/data/assessments";
import { findValue, latestAndPrevious } from "@/domain/assessments/evolution";
import { formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";
import { formatTimeOfDay } from "@/domain/meal-plans/quantities";
import { formatTimeRange, formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO, weekdayOfDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const futureCards = [{ title: "Último feedback", icon: MessageSquare, phase: "Fase 10" }] as const;

/** Início do portal: próxima consulta real (Fase 6) e cardápio do dia (Fase 8); demais cards continuam previstos para fases futuras. */
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
  const today = instantToDateISO(now, timeZone);
  const mealPlan = context ? await getPublishedMealPlan(context.patientId) : null;
  const todayMeals = mealPlan?.days.find((day) => day.weekday === weekdayOfDate(today))?.meals ?? [];
  const { latest: latestAssessment } = latestAndPrevious(context ? await listVisibleAssessments(context.patientId) : []);
  const latestWeight = latestAssessment ? findValue(latestAssessment, "WEIGHT") : null;

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Cardápio do dia</CardTitle>
            <UtensilsCrossed className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {!mealPlan ? (
              <p className="text-sm text-muted-foreground">Seu plano alimentar ainda não foi publicado.</p>
            ) : todayMeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma refeição cadastrada para hoje.{" "}
                <Link href="/paciente/cardapio" className="underline underline-offset-4">
                  Ver o cardápio completo
                </Link>
              </p>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-1 text-sm">
                  {todayMeals.slice(0, 4).map((meal) => (
                    <li key={meal.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{meal.name}</span>
                      {meal.timeOfDay ? <span className="shrink-0 text-muted-foreground tabular-nums">{formatTimeOfDay(meal.timeOfDay)}</span> : null}
                    </li>
                  ))}
                  {todayMeals.length > 4 ? <li className="text-xs text-muted-foreground">+ {todayMeals.length - 4} refeição(ões)</li> : null}
                </ul>
                <Link href="/paciente/cardapio" className="text-sm underline underline-offset-4">
                  Ver o cardápio completo
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Última avaliação</CardTitle>
            <LineChart className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {!latestAssessment ? (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação disponível ainda.</p>
            ) : (
              <div className="space-y-2">
                <p className="font-heading text-lg font-medium">{formatCalendarDate(latestAssessment.assessmentDate)}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{latestWeight != null ? `Peso: ${formatMetric(latestWeight, "kg")}` : `${latestAssessment.measurements.length} medida(s) registrada(s)`}</p>
                <Link href="/paciente/evolucao" className="text-sm underline underline-offset-4">
                  Ver evolução
                </Link>
              </div>
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
