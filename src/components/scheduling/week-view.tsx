import Link from "next/link";
import { cn } from "@/lib/utils";
import { APPOINTMENT_BLOCK_CLASS } from "@/components/scheduling/badges";
import { MODALITY_LABEL, APPOINTMENT_STATUS_LABEL } from "@/domain/scheduling/state-machine";
import { availabilityWindowsForDate, itemsForDate, visibleHourRange } from "@/domain/scheduling/calendar-layout";
import type { AvailabilityRuleInput } from "@/domain/scheduling/slots";
import type { AppointmentListItem } from "@/data/appointments";
import type { BlockedTime } from "@/data/scheduling";
import { formatDayMonth, formatTime, formatWeekdayShort } from "@/lib/dates";
import { minutesToTime } from "@/lib/timezone";

const HOUR_PX = 56;

type Props = {
  dates: string[]; // 1 (dia) ou 7 (semana)
  today: string;
  timeZone: string;
  appointments: AppointmentListItem[];
  blockedTimes: BlockedTime[];
  rules: AvailabilityRuleInput[];
  /** Visão dia: blocos maiores com mais detalhe. */
  detailed?: boolean;
};

/**
 * Grade de horários (visões semana e dia — prompt Fase 6 §17–§18). Cada
 * coluna é um dia; a posição vertical é minutos no fuso do nutricionista.
 * Fundo: disponibilidade (claro) e bloqueios (hachurado). Blocos de consulta
 * são links para o detalhe, com nome acessível completo.
 */
export function TimeGrid({ dates, today, timeZone, appointments, blockedTimes, rules, detailed = false }: Props) {
  const columns = dates.map((date) => ({
    date,
    appointments: itemsForDate(appointments, date, timeZone),
    blocks: itemsForDate(blockedTimes, date, timeZone),
    windows: availabilityWindowsForDate(rules, date),
  }));

  const { startHour, endHour } = visibleHourRange({
    windows: columns.flatMap((column) => column.windows),
    items: columns.flatMap((column) => [...column.appointments, ...column.blocks]),
  });
  const totalMinutes = (endHour - startHour) * 60;
  const gridHeight = (totalMinutes / 60) * HOUR_PX;
  const toPx = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX;
  const hasAnything = columns.some((column) => column.appointments.length > 0 || column.blocks.length > 0);

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <div className={cn("min-w-[640px]", dates.length === 1 && "min-w-0")}>
        {/* Cabeçalho dos dias */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `56px repeat(${dates.length}, minmax(0, 1fr))` }}
        >
          <div className="border-r border-border" />
          {columns.map((column) => {
            const isToday = column.date === today;
            return (
              <div key={column.date} className="border-r border-border px-2 py-2 text-center last:border-r-0">
                <Link
                  href={`/dashboard/agenda?view=day&date=${column.date}`}
                  className={cn(
                    "inline-flex flex-col items-center rounded-md px-2 py-0.5 text-xs hover:bg-muted",
                    isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <span className="uppercase tracking-wide">{formatWeekdayShort(column.date)}</span>
                  <span className="text-sm font-medium tabular-nums">{dates.length === 1 ? formatDayMonth(column.date) : column.date.slice(8, 10)}</span>
                </Link>
                {column.appointments.length > 0 ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {column.appointments.length} {column.appointments.length === 1 ? "consulta" : "consultas"}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Grade */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${dates.length}, minmax(0, 1fr))`, height: gridHeight }}
        >
          {/* Coluna de horas */}
          <div className="relative border-r border-border">
            {Array.from({ length: endHour - startHour }, (_, index) => (
              <div
                key={index}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                style={{ top: index * HOUR_PX }}
              >
                {index === 0 ? "" : minutesToTime((startHour + index) * 60)}
              </div>
            ))}
          </div>

          {columns.map((column) => (
            <div key={column.date} className="relative border-r border-border last:border-r-0">
              {/* Linhas de hora */}
              {Array.from({ length: endHour - startHour }, (_, index) => (
                <div
                  key={index}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: index * HOUR_PX }}
                  aria-hidden="true"
                />
              ))}
              {/* Disponibilidade */}
              {column.windows.map((window, index) => (
                <div
                  key={`w-${index}`}
                  className="absolute inset-x-0 bg-success/5"
                  style={{ top: toPx(window.start), height: toPx(window.end) - toPx(window.start) }}
                  aria-hidden="true"
                />
              ))}
              {/* Bloqueios */}
              {column.blocks.map((block) => (
                <div
                  key={block.id}
                  className="absolute inset-x-0.5 rounded-md border border-dashed border-muted-foreground/40 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_12px)] px-1.5 py-1 text-[11px] text-muted-foreground"
                  style={{ top: toPx(block.topMinutes), height: Math.max(toPx(block.topMinutes + block.heightMinutes) - toPx(block.topMinutes), 20) }}
                  title={block.reason ?? "Bloqueio"}
                >
                  <span className="line-clamp-1">{block.reason ?? "Bloqueado"}</span>
                </div>
              ))}
              {/* Consultas */}
              {column.appointments.map((appointment) => {
                const top = toPx(appointment.topMinutes);
                const height = Math.max(toPx(appointment.topMinutes + appointment.heightMinutes) - top, 22);
                const label = `${formatTime(appointment.startsAt)} ${appointment.patientName}, ${MODALITY_LABEL[appointment.modality]}, ${APPOINTMENT_STATUS_LABEL[appointment.status]}`;
                return (
                  <Link
                    key={appointment.id}
                    href={`/dashboard/agenda/${appointment.id}`}
                    aria-label={label}
                    className={cn(
                      "absolute inset-x-1 z-10 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-[11px] leading-tight shadow-sm transition-colors hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      APPOINTMENT_BLOCK_CLASS[appointment.status],
                    )}
                    style={{ top, height }}
                  >
                    <span className="block truncate font-medium tabular-nums">
                      {formatTime(appointment.startsAt)}
                      {detailed ? ` – ${formatTime(appointment.endsAt)}` : ""}
                      {height < 40 ? ` · ${appointment.patientName}` : ""}
                    </span>
                    {height >= 40 ? <span className="block truncate">{appointment.patientName}</span> : null}
                    {height >= 54 ? (
                      <span className="block truncate text-[10px] opacity-80">
                        {MODALITY_LABEL[appointment.modality]} · {APPOINTMENT_STATUS_LABEL[appointment.status]}
                        {detailed && appointment.planName ? ` · ${appointment.planName}` : ""}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!hasAnything ? (
        <p className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
          Nenhuma consulta neste período.
        </p>
      ) : null}
    </div>
  );
}
