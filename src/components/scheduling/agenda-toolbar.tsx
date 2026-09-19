import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Settings2, ShieldBan } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shiftDate, startOfWeekISO, type CalendarView } from "@/domain/scheduling/calendar-views";
import { addDaysISO } from "@/lib/timezone";
import { formatDayMonth, formatMonthYear, formatWeekdayLong } from "@/lib/dates";

export function agendaHref(view: CalendarView, date: string): string {
  return `/dashboard/agenda?view=${view}&date=${date}`;
}

function title(view: CalendarView, date: string): string {
  if (view === "month") return formatMonthYear(date);
  if (view === "day") return formatWeekdayLong(date);
  const start = startOfWeekISO(date);
  const end = addDaysISO(start, 6);
  return `${formatDayMonth(start)} – ${formatDayMonth(end)} · ${formatMonthYear(end).split(" de ")[1] ?? ""}`;
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

/** Barra da agenda (prompt Fase 6 §14): navegação por links, sem JS. */
export function AgendaToolbar({ view, date, today }: { view: CalendarView; date: string; today: string }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Navegar no período" className="flex items-center gap-1">
          <Link
            href={agendaHref(view, shiftDate(view, date, -1))}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            aria-label="Período anterior"
          >
            <ChevronLeft />
          </Link>
          <Link
            href={agendaHref(view, shiftDate(view, date, 1))}
            className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            aria-label="Próximo período"
          >
            <ChevronRight />
          </Link>
          <Link href={agendaHref(view, today)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Hoje
          </Link>
        </nav>
        <h2 className="font-heading text-lg font-medium sm:text-xl" aria-live="polite">
          {title(view, date)}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Visualização" className="flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
          {VIEWS.map((option) => {
            const active = option.value === view;
            return (
              <Link
                key={option.value}
                href={agendaHref(option.value, date)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/agenda/bloqueios/novo?date=${date}`}>
            <ShieldBan data-icon="inline-start" />
            Bloquear
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/agenda/configuracoes">
            <Settings2 data-icon="inline-start" />
            Configurações
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/dashboard/agenda/nova?date=${date}`}>
            <CalendarPlus data-icon="inline-start" />
            Nova consulta
          </Link>
        </Button>
      </div>
    </div>
  );
}
