import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import type { AnalysisResult } from "@/domain/food-analysis/estimates";
import { sortByMealDesc, type AnalysisDbStatus } from "@/domain/food-analysis/status";
import { parseStoredResult } from "@/services/food-analysis/schemas";

/**
 * Queries das análises de foto de refeição (prompt Fase 11 §69). Cliente de
 * sessão: RLS decide (paciente = próprias; nutricionista = dos próprios
 * pacientes). `raw_result` nunca é selecionado (não é preenchido). Os JSON
 * gravados passam por parsing defensivo — nunca chegam crus à UI.
 */

export type FoodAnalysisDetail = {
  id: string;
  patientId: string;
  storagePath: string;
  status: AnalysisDbStatus;
  provider: string | null;
  model: string | null;
  original: AnalysisResult | null;
  confirmed: AnalysisResult | null;
  confidence: number | null;
  mealAt: string;
  imageMime: string | null;
  imageSizeBytes: number | null;
  imageSha256: string | null;
  consentVersion: string | null;
  processingStartedAt: string | null;
  processingMs: number | null;
  failureCode: string | null;
  attempts: number;
  analyzedAt: string | null;
  confirmedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT =
  "id, patient_id, storage_path, status, provider, model, structured_result, corrected_result, confidence, meal_at, image_mime, image_size_bytes, image_sha256, consent_version, processing_started_at, processing_ms, failure_code, attempts, analyzed_at, confirmed_at, archived_at, created_at, updated_at";

type Row = {
  id: string;
  patient_id: string;
  storage_path: string;
  status: AnalysisDbStatus;
  provider: string | null;
  model: string | null;
  structured_result: unknown;
  corrected_result: unknown;
  confidence: number | string | null;
  meal_at: string;
  image_mime: string | null;
  image_size_bytes: number | null;
  image_sha256: string | null;
  consent_version: string | null;
  processing_started_at: string | null;
  processing_ms: number | null;
  failure_code: string | null;
  attempts: number;
  analyzed_at: string | null;
  confirmed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function toDetail(row: Row): FoodAnalysisDetail {
  return {
    id: row.id,
    patientId: row.patient_id,
    storagePath: row.storage_path,
    status: row.status,
    provider: row.provider,
    model: row.model,
    original: parseStoredResult(row.structured_result),
    confirmed: parseStoredResult(row.corrected_result),
    confidence: row.confidence == null ? null : Number(row.confidence),
    mealAt: row.meal_at,
    imageMime: row.image_mime,
    imageSizeBytes: row.image_size_bytes,
    imageSha256: row.image_sha256,
    consentVersion: row.consent_version,
    processingStartedAt: row.processing_started_at,
    processingMs: row.processing_ms,
    failureCode: row.failure_code,
    attempts: row.attempts,
    analyzedAt: row.analyzed_at,
    confirmedAt: row.confirmed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Histórico do paciente (portal, §38): não arquivadas, mais recente primeiro. */
export async function listPatientFoodAnalyses(patientId: string, { includeArchived = false } = {}): Promise<FoodAnalysisDetail[]> {
  const supabase = await createClient();
  let query = supabase.from("food_photo_analyses").select(SELECT).eq("patient_id", patientId);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw domainErrorFromDatabase(error);
  return sortByMealDesc(((data ?? []) as unknown as Row[]).map(toDetail));
}

export async function getFoodAnalysisById(analysisId: string): Promise<FoodAnalysisDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("food_photo_analyses").select(SELECT).eq("id", analysisId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as unknown as Row) : null;
}

/** Reenvio idêntico (§53): uma análise ativa do mesmo paciente com a mesma imagem processada. */
export async function findActiveBySha(patientId: string, sha256: string): Promise<FoodAnalysisDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("food_photo_analyses").select(SELECT).eq("patient_id", patientId).eq("image_sha256", sha256).is("archived_at", null).limit(1).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as unknown as Row) : null;
}

/** Aba Refeições do nutricionista (§42): confirmadas (acompanhamento) e, à parte, em revisão. */
export async function listPatientFoodAnalysesForNutritionist(patientId: string): Promise<FoodAnalysisDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("food_photo_analyses").select(SELECT).eq("patient_id", patientId).is("archived_at", null).in("status", ["CONFIRMED", "ANALYZED"]);
  if (error) throw domainErrorFromDatabase(error);
  return sortByMealDesc(((data ?? []) as unknown as Row[]).map(toDetail));
}
