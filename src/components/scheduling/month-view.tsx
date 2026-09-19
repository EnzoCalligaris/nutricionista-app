import Link from "next/link";
import { cn } from "@/lib/utils";
import { countByDate } from "@/domain/scheduling/calendar-layout";
import { isSameMonth, monthGridDatesISO } from "@/domain/scheduling/calendar-views";
import { isActive } from "@/domain/scheduling/state-machine";
import { WEEKDAY_SHORT } from "@/domain/scheduling/availability-rules";
import type { AppointmentListItem } from "@/data/appointments";
import type { BlockedTime } from "@/data/scheduling";
import { formatWeekdayLong } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";
import { parseISODate } from "@/lib/calendar";

type Props = {
  date: string;
  today: string;
  timeZone: string;
  appointments: AppointmentListItem[];
  blockedTimes: BlockedTime[];
};

/**
 * Visão mês (prompt Fase 6 §16): dias, quantidade de consultas ativas,
 * indicador de bloqueio e dia atual — cada célula é um link para a visão
 * dia. Sem tentar encaixar detalhes de cada consulta.
 */
export function MonthView({ date, today, timeZone, appointments, blockedTimes }: Props) {
  const dates = monthGridDatesISO(date);
  const byDate = countByDate(appointments, timeZone);
  const blockedDates = new Set<string>();
  for (const block of blockedTimes) {
    // Marca todas as datas civis cobertas pelo bloqueio.
    let cursor = new Date(block.startsAt);
    const end = new Date(new Date(block.endsAt).getTime() - 1);
    while (cursor.getTime() <= end.getTime()) {
      blockedDates.add(instantToDateISO(cursor, timeZone));
      cursor = new Date(cursor.getTime() + 24 * 3_600_000);
    }
    blockedDates.add(instantToDateISO(end, timeZone));
  }

  // Segunda a domingo.
  const headers = [1, 2, 3, 4, 5, 6, 0].map((weekday) => WEEKDAY_SHORT[weekday]);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {headers.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" role="list" aria-label="Dias do mês">
        {dates.map((cell) => {
          const inMonth = isSameMonth(cell, date);
          const items = byDate.get(cell) ?? [];
          const activeCount = items.filter((item) => isActive(item.status)).length;
          const otherCount = items.length - activeCount;
          const blocked = blockedDates.has(cell);
          const day = parseISODate(cell)?.day ?? "";
          const isToday = cell === today;
          return (
            <Link
              key={cell}
              role="listitem"
              href={`/dashboard/agenda?view=day&date=${cell}`}
              aria-label={`${formatWeekdayLong(cell)}: ${activeCount} ${activeCount === 1 ? "consulta ativa" : "consultas ativas"}${blocked ? ", com bloqueio" : ""}`}
              className={cn(
                "flex min-h-20 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-24 sm:p-2 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day}
              </span>
              <span className="flex flex-wrap gap-1">
                {activeCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums">
                    {activeCount} {activeCount === 1 ? "consulta" : "consultas"}
                  </span>
                ) : null}
                {otherCount > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                    +{otherCount} {otherCount === 1 ? "outra" : "outras"}
                  </span>
                ) : null}
                {blocked ? (
                  <span className="rounded-full border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Bloqueio
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
