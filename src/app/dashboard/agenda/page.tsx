import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { FlashToast } from "@/components/shared/flash-toast";
import { AgendaToolbar } from "@/components/scheduling/agenda-toolbar";
import { MonthView } from "@/components/scheduling/month-view";
import { TimeGrid } from "@/components/scheduling/week-view";
import { UpcomingSessions, parseUpcomingFilter, type UpcomingFilter } from "@/components/scheduling/upcoming-sessions";
import { DayList } from "@/components/scheduling/day-list";
import { requireNutritionist } from "@/lib/auth/session";
import { listAppointmentsInRange, listUpcomingAppointments } from "@/data/appointments";
import { getAvailabilityRules, getBlockedTimes, getSchedulingSettings } from "@/data/scheduling";
import { parseCalendarView, viewRange, weekDatesISO } from "@/domain/scheduling/calendar-views";
import { isValidISODate, monthBoundsISO } from "@/lib/calendar";
import { addDaysISO, dayBounds, instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Agenda do nutricionista (prompt Fase 6 §14–§18/§33). A URL é a fonte de
 * verdade (`?view=&date=&periodo=`): tudo server-rendered, queries
 * limitadas ao período visível (§95–§96), fuso do nutricionista em tudo.
 */
export default async function AgendaPage({ searchParams }: PageProps<"/dashboard/agenda">) {
  const nutritionist = await requireNutritionist();
  const params = await searchParams;
  const settings = await getSchedulingSettings(nutritionist.id);
  const timeZone = settings.timeZone;
  const now = new Date();
  const today = instantToDateISO(now, timeZone);

  const view = parseCalendarView(firstParam(params.view));
  const rawDate = firstParam(params.date);
  const date = rawDate && isValidISODate(rawDate) ? rawDate : today;
  const upcomingFilter = parseUpcomingFilter(firstParam(params.periodo));

  const range = viewRange(view, date);
  const from = dayBounds(range.start, timeZone).start.toISOString();
  const to = dayBounds(range.endExclusive, timeZone).start.toISOString();

  const upcomingTo =
    upcomingFilter === "today"
      ? dayBounds(addDaysISO(today, 1), timeZone).start.toISOString()
      : upcomingFilter === "7d"
        ? dayBounds(addDaysISO(today, 7), timeZone).start.toISOString()
        : dayBounds(addDaysISO(monthBoundsISO(today).end, 1), timeZone).start.toISOString();

  const [appointments, blockedTimes, rules, upcoming] = await Promise.all([
    listAppointmentsInRange(nutritionist.id, from, to),
    getBlockedTimes(nutritionist.id, from, to),
    getAvailabilityRules(nutritionist.id),
    listUpcomingAppointments(nutritionist.id, now.toISOString(), upcomingTo),
  ]);

  const hrefForFilter = (filter: UpcomingFilter) => `/dashboard/agenda?view=${view}&date=${date}&periodo=${filter}#proximas-sessoes`;
  const hasRules = rules.some((rule) => rule.active);

  return (
    <div className="space-y-6">
      <FlashToast />
      <div>
        <h1 className="font-heading text-2xl font-medium">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Consultas, disponibilidade e bloqueios — horários em {timeZone.replace("_", " ")}.
        </p>
      </div>

      {!hasRules ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
          <p>
            Nenhum horário de atendimento configurado — os pacientes não conseguem agendar pelo portal.{" "}
            <Link href="/dashboard/agenda/configuracoes" className="font-medium underline underline-offset-4">
              Configurar disponibilidade
            </Link>
            .
          </p>
        </div>
      ) : null}

      <AgendaToolbar view={view} date={date} today={today} />

      {view === "month" ? (
        <MonthView date={date} today={today} timeZone={timeZone} appointments={appointments} blockedTimes={blockedTimes} />
      ) : (
        <TimeGrid
          dates={view === "day" ? [date] : weekDatesISO(date)}
          today={today}
          timeZone={timeZone}
          appointments={appointments}
          blockedTimes={blockedTimes}
          rules={rules}
          detailed={view === "day"}
        />
      )}

      {view === "day" ? <DayList appointments={appointments} /> : null}

      <UpcomingSessions items={upcoming} filter={upcomingFilter} hrefForFilter={hrefForFilter} />
    </div>
  );
}
