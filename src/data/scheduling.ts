import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import type { AvailabilityRuleInput, BusyIntervalInput, Modality } from "@/domain/scheduling/slots";
import type { Database } from "@/types/database";

/**
 * Leituras de configuração de agenda, disponibilidade e bloqueios (prompt
 * Fase 6 §62). Cliente de sessão (RLS): disponibilidade/bloqueios são
 * legíveis por qualquer autenticado (o paciente precisa deles para ver
 * horários), escrita só do dono.
 */

export type SchedulingSettings = {
  nutritionistId: string;
  defaultDurationMinutes: number;
  slotGranularityMinutes: number;
  minBookingNoticeHours: number | null;
  minCancellationNoticeHours: number | null;
  maxBookingHorizonDays: number | null;
  patientCanBook: boolean;
  patientCanChooseModality: boolean;
  timeZone: string;
  /** False quando ainda não existe linha — valores abaixo são os defaults técnicos de desenvolvimento. */
  configured: boolean;
};

/**
 * Defaults TÉCNICOS (iguais aos defaults de coluna da migration) usados
 * quando o nutricionista ainda não salvou a configuração. Não são os
 * valores reais de Enzo — PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md, Fase 6).
 */
export const TECHNICAL_SCHEDULING_DEFAULTS = {
  defaultDurationMinutes: 60,
  slotGranularityMinutes: 30,
} as const;

export async function getSchedulingSettings(nutritionistId: string): Promise<SchedulingSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduling_settings")
    .select("*")
    .eq("nutritionist_id", nutritionistId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);

  if (!data) {
    return {
      nutritionistId,
      ...TECHNICAL_SCHEDULING_DEFAULTS,
      minBookingNoticeHours: null,
      minCancellationNoticeHours: null,
      maxBookingHorizonDays: null,
      patientCanBook: true,
      patientCanChooseModality: true,
      timeZone: DEFAULT_TIME_ZONE,
      configured: false,
    };
  }

  return {
    nutritionistId,
    defaultDurationMinutes: data.default_duration_minutes,
    slotGranularityMinutes: data.slot_granularity_minutes,
    minBookingNoticeHours: data.min_booking_notice_hours,
    minCancellationNoticeHours: data.min_cancellation_notice_hours,
    maxBookingHorizonDays: data.max_booking_horizon_days,
    patientCanBook: data.patient_can_book,
    patientCanChooseModality: data.patient_can_choose_modality,
    timeZone: data.timezone,
    configured: true,
  };
}

export type AvailabilityRule = AvailabilityRuleInput & { id: string };

export async function getAvailabilityRules(nutritionistId: string): Promise<AvailabilityRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_rules")
    .select("id, weekday, start_time, end_time, modality, active")
    .eq("nutritionist_id", nutritionistId)
    .order("weekday")
    .order("start_time");
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    start_time: row.start_time.slice(0, 5),
    end_time: row.end_time.slice(0, 5),
    modality: row.modality as Modality | null,
    active: row.active,
  }));
}

export type BlockedTime = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  allDay: boolean;
};

export async function getBlockedTimes(nutritionistId: string, fromISO: string, toISO: string): Promise<BlockedTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .select("id, starts_at, ends_at, reason, all_day")
    .eq("nutritionist_id", nutritionistId)
    .lt("starts_at", toISO)
    .gt("ends_at", fromISO)
    .order("starts_at");
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    allDay: row.all_day,
  }));
}

export async function getUpcomingBlockedTimes(nutritionistId: string, fromISO: string, limit = 50): Promise<BlockedTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .select("id, starts_at, ends_at, reason, all_day")
    .eq("nutritionist_id", nutritionistId)
    .gt("ends_at", fromISO)
    .order("starts_at")
    .limit(limit);
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    allDay: row.all_day,
  }));
}

/**
 * Intervalos ocupados (consultas ativas + bloqueios) via função SECURITY
 * DEFINER — o paciente obtém só início/fim, nunca quem ocupa.
 */
export async function getBusyIntervals(nutritionistId: string, fromISO: string, toISO: string): Promise<BusyIntervalInput[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("busy_intervals", {
    p_nutritionist_id: nutritionistId,
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw domainErrorFromDatabase(error);
  return (data ?? []).map((row) => ({ starts_at: row.starts_at, ends_at: row.ends_at }));
}

export type SchedulingSettingsInsert = Database["public"]["Tables"]["scheduling_settings"]["Insert"];
