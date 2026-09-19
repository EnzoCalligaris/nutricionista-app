import { DEFAULT_TIME_ZONE } from "@/config/site";
import { parseISODate, toISODate, type CalendarDate } from "@/lib/calendar";

/**
 * Conversão entre instantes (UTC, `timestamptz`) e "relógio de parede" num
 * fuso IANA (America/Sao_Paulo por padrão), usando só `Intl` — sem depender
 * do fuso do servidor, do browser ou do Postgres (CLAUDE.md, regra 5). Não
 * assume ausência de horário de verão: o offset é calculado instante a
 * instante.
 */

export type WallClock = CalendarDate & { hour: number; minute: number; second: number; weekday: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = partsCache.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, cached);
  }
  return cached;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Relógio de parede de um instante no fuso dado (weekday 0 = domingo, como EXTRACT(DOW)). */
export function toWallClock(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): WallClock {
  const parts = formatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: WEEKDAYS.indexOf(read("weekday")),
  };
}

/** Offset (ms) do fuso em relação ao UTC no instante dado. */
export function timeZoneOffsetMs(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const wall = toWallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instante correspondente a um relógio de parede (data civil + HH:mm) no
 * fuso. Em transições de DST o offset é reavaliado uma vez — suficiente
 * para horários de agenda (nunca dependemos de não haver horário de verão).
 */
export function wallClockToInstant(
  date: string,
  time: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const parsed = parseISODate(date);
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!parsed || !match) throw new RangeError(`Data/hora inválida: ${date} ${time}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError(`Hora inválida: ${time}`);

  const naive = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute, second);
  const firstGuess = new Date(naive - timeZoneOffsetMs(new Date(naive), timeZone));
  const corrected = new Date(naive - timeZoneOffsetMs(firstGuess, timeZone));
  return corrected;
}

/** Data civil ("YYYY-MM-DD") de um instante no fuso. */
export function instantToDateISO(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const wall = toWallClock(instant, timeZone);
  return toISODate(wall);
}

/** "HH:mm" de um instante no fuso. */
export function instantToTime(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const wall = toWallClock(instant, timeZone);
  return `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite (no fuso) de um instante — para posicionar no calendário. */
export function minutesOfDay(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const wall = toWallClock(instant, timeZone);
  return wall.hour * 60 + wall.minute;
}

/** Início (00:00) e fim (00:00 do dia seguinte) de uma data civil no fuso, como instantes. */
export function dayBounds(date: string, timeZone: string = DEFAULT_TIME_ZONE): { start: Date; end: Date } {
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Data inválida: ${date}`);
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
  return {
    start: wallClockToInstant(date, "00:00", timeZone),
    end: wallClockToInstant(toISODate({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }), "00:00", timeZone),
  };
}

/** Soma dias a uma data civil (aritmética pura de calendário). */
export function addDaysISO(date: string, days: number): string {
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Data inválida: ${date}`);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return toISODate({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}

/** Dia da semana (0 = domingo) de uma data civil. */
export function weekdayOfDate(date: string): number {
  const parsed = parseISODate(date);
  if (!parsed) throw new RangeError(`Data inválida: ${date}`);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

/** Minutos "HH:mm" -> inteiro. */
export function timeToMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) throw new RangeError(`Hora inválida: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
