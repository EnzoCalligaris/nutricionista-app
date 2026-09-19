import { contains, mergeIntervals, overlaps, type Interval } from "@/domain/scheduling/intervals";
import { instantToTime, wallClockToInstant, weekdayOfDate } from "@/lib/timezone";

/**
 * Geração de horários livres (prompt Fase 6 §11–§13). Puro e testado; a UI
 * só consome o resultado. O BANCO continua a fonte da verdade: a função SQL
 * `validate_booking_window` reaplica as mesmas regras antes do INSERT e a
 * exclusion constraint decide a sobreposição.
 *
 * Um slot é livre quando:
 *   1. cabe inteiro numa availability_rule ativa daquele dia da semana (no
 *      fuso do nutricionista) compatível com a modalidade;
 *   2. não intersecta bloqueio;
 *   3. não intersecta consulta ativa;
 *   4. tem a duração configurada;
 *   5. começa no futuro (+ antecedência mínima) e dentro do horizonte;
 *   6. começa num múltiplo da granularidade a partir do início da regra.
 * Duração da consulta e granularidade de início são independentes (ex.:
 * 60 min começando a cada 30 min).
 */

export type Modality = "IN_PERSON" | "ONLINE";

export type AvailabilityRuleInput = {
  weekday: number; // 0 = domingo
  start_time: string; // "HH:mm" ou "HH:mm:ss"
  end_time: string;
  modality: Modality | null;
  active: boolean;
};

export type BusyIntervalInput = { starts_at: string; ends_at: string };

export type SlotGenerationInput = {
  date: string; // YYYY-MM-DD no fuso
  timeZone: string;
  rules: AvailabilityRuleInput[];
  busy: BusyIntervalInput[];
  durationMinutes: number;
  granularityMinutes: number;
  now: Date;
  modality?: Modality | null;
  minNoticeHours?: number | null;
  maxHorizonDays?: number | null;
};

export type Slot = {
  startsAt: string; // ISO UTC
  endsAt: string;
  /** "HH:mm" no fuso, para exibir. */
  label: string;
  /** Modalidades que a regra de origem permite para este slot. */
  modalities: Modality[];
};

function ruleWindow(rule: AvailabilityRuleInput, date: string, timeZone: string): Interval {
  return {
    start: wallClockToInstant(date, rule.start_time.slice(0, 5), timeZone).getTime(),
    end: wallClockToInstant(date, rule.end_time.slice(0, 5), timeZone).getTime(),
  };
}

export function generateSlots(input: SlotGenerationInput): Slot[] {
  const { date, timeZone, durationMinutes, granularityMinutes } = input;
  if (durationMinutes <= 0 || granularityMinutes <= 0) return [];

  const weekday = weekdayOfDate(date);
  const durationMs = durationMinutes * 60_000;
  const stepMs = granularityMinutes * 60_000;

  const earliest = input.now.getTime() + (input.minNoticeHours ?? 0) * 3_600_000;
  const latest =
    input.maxHorizonDays != null ? input.now.getTime() + input.maxHorizonDays * 86_400_000 : Number.POSITIVE_INFINITY;

  const busy = mergeIntervals(
    input.busy.map((interval) => ({
      start: new Date(interval.starts_at).getTime(),
      end: new Date(interval.ends_at).getTime(),
    })),
  );

  const rules = input.rules.filter(
    (rule) =>
      rule.active &&
      rule.weekday === weekday &&
      (input.modality == null || rule.modality == null || rule.modality === input.modality),
  );

  const byStart = new Map<number, Slot>();

  for (const rule of rules) {
    const window = ruleWindow(rule, date, timeZone);
    if (window.end <= window.start) continue;
    const modalities: Modality[] = rule.modality ? [rule.modality] : ["IN_PERSON", "ONLINE"];

    for (let start = window.start; start + durationMs <= window.end; start += stepMs) {
      const candidate: Interval = { start, end: start + durationMs };
      if (candidate.start < earliest || candidate.start > latest) continue;
      if (!contains(window, candidate)) continue;
      if (busy.some((interval) => overlaps(interval, candidate))) continue;

      const existing = byStart.get(start);
      if (existing) {
        for (const modality of modalities) {
          if (!existing.modalities.includes(modality)) existing.modalities.push(modality);
        }
        continue;
      }
      byStart.set(start, {
        startsAt: new Date(candidate.start).toISOString(),
        endsAt: new Date(candidate.end).toISOString(),
        label: instantToTime(new Date(candidate.start), timeZone),
        modalities: [...modalities],
      });
    }
  }

  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}

/** True quando o intervalo cabe inteiro numa regra ativa do dia (mesma checagem da função SQL). */
export function isWithinAvailability(input: {
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  rules: AvailabilityRuleInput[];
  modality: Modality;
}): boolean {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(input.startsAt);
  const weekday = weekdayOfDate(date);
  const candidate: Interval = { start: input.startsAt.getTime(), end: input.endsAt.getTime() };
  return input.rules.some((rule) => {
    if (!rule.active || rule.weekday !== weekday) return false;
    if (rule.modality && rule.modality !== input.modality) return false;
    return contains(ruleWindow(rule, date, input.timeZone), candidate);
  });
}
