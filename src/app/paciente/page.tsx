import Link from "next/link";
import { Camera, CalendarPlus, FolderOpen, LineChart, MessageSquare, Pill, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { requirePatient } from "@/lib/auth/session";
import { listPatientAppointments } from "@/data/appointments";
import { getPatientBookingContext } from "@/services/scheduling";
import { isActive } from "@/domain/scheduling/state-machine";
import { getPublishedMealPlan } from "@/data/meal-plans";
import { listVisibleAssessments } from "@/data/assessments";
import { listVisibleFeedbacksForPatient } from "@/data/feedbacks";
import { listActiveSupplementsForPatient } from "@/data/supplements";
import { listVisibleMaterialsForPatient } from "@/data/materials";
import { feedbackDisplayTitle, feedbackExcerpt } from "@/domain/patient-content/feedbacks";
import { formatInstantDate } from "@/lib/dates";
import { findValue, latestAndPrevious } from "@/domain/assessments/evolution";
import { formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";
import { formatTimeOfDay } from "@/domain/meal-plans/quantities";
import { formatTimeRange, formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO, weekdayOfDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/**
 * Início do portal: próxima consulta (Fase 6), cardápio do dia (Fase 8),
 * última avaliação (Fase 9) e, na Fase 10, último feedback, suplementos
 * ativos e materiais recentes — cards resumidos, só com dado real (§30/§51).
 */
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
  const [feedbacks, supplements, materials] = context
    ? await Promise.all([listVisibleFeedbacksForPatient(context.patientId), listActiveSupplementsForPatient(context.patientId), listVisibleMaterialsForPatient(context.patientId)])
    : [[], [], []];
  const latestFeedback = feedbacks[0] ?? null;

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Último feedback</CardTitle>
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {!latestFeedback ? (
              <p className="text-sm text-muted-foreground">Nenhum feedback disponível ainda.</p>
            ) : (
              <div className="space-y-2">
                <p className="font-heading text-lg font-medium break-words">{feedbackDisplayTitle(latestFeedback, formatInstantDate)}</p>
                <p className="text-sm text-muted-foreground">{formatInstantDate(latestFeedback.publishedAt ?? latestFeedback.createdAt)} · {feedbackExcerpt(latestFeedback.content, 100)}</p>
                <Link href="/paciente/feedbacks" className="text-sm underline underline-offset-4">
                  Ver feedbacks
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Suplementos ativos</CardTitle>
            <Pill className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {supplements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma recomendação de suplemento no momento.</p>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-1 text-sm">
                  {supplements.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      {item.scheduleText ? <span className="shrink-0 truncate text-muted-foreground">{item.scheduleText}</span> : null}
                    </li>
                  ))}
                  {supplements.length > 3 ? <li className="text-xs text-muted-foreground">+ {supplements.length - 3} recomendação(ões)</li> : null}
                </ul>
                <Link href="/paciente/suplementos" className="text-sm underline underline-offset-4">
                  Ver suplementos
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-sans text-sm font-normal text-muted-foreground">Materiais recentes</CardTitle>
            <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum material disponível ainda.</p>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-1 text-sm">
                  {materials.slice(0, 3).map((item) => (
                    <li key={item.id} className="truncate">
                      {item.material.title}
                    </li>
                  ))}
                  {materials.length > 3 ? <li className="text-xs text-muted-foreground">+ {materials.length - 3} material(is)</li> : null}
                </ul>
                <Link href="/paciente/materiais" className="text-sm underline underline-offset-4">
                  Ver materiais
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
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
        <Button asChild variant="secondary">
          <Link href="/paciente/refeicoes/nova">
            <Camera data-icon="inline-start" />
            Registrar refeição
          </Link>
        </Button>
      </div>
    </div>
  );
}
