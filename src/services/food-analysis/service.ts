import "server-only";

import { randomUUID } from "node:crypto";
import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { MealPhotoError, processMealPhoto } from "@/lib/images/meal-photo";
import { mealAnalysisRateLimiter } from "@/lib/auth/rate-limit";
import { buildConfirmedResult, type AnalysisResult, type ReviewItemInput } from "@/domain/food-analysis/estimates";
import {
  MEAL_PHOTO_AI_CONSENT_TYPE,
  MEAL_PHOTO_AI_CONSENT_VERSION,
  PROCESSING_STALE_MS,
  canArchive,
  canEditConfirmed,
  canRequestAnalysis,
  canReview,
  isMealTimeAcceptable,
} from "@/domain/food-analysis/status";
import { findActiveBySha, getFoodAnalysisById, type FoodAnalysisDetail } from "@/data/food-analyses";
import { getActiveConsent, type PatientConsent } from "@/data/patient-consents";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import { FoodAnalysisProviderError, getFoodAnalysisProvider, getFoodAnalysisTimeoutMs } from "@/services/food-analysis";
import { normalizeProviderResult, providerResultSchema } from "@/services/food-analysis/schemas";

/**
 * Casos de uso da análise de foto de refeição (prompt Fase 11 §72). O
 * paciente é sempre o da SESSÃO (nunca de input); o nutricionista só lê
 * (ownership pelo paciente da rota). O provider é chamado exclusivamente
 * aqui, server-side, com timeout; a resposta é entrada não confiável
 * (Zod) e só a estrutura normalizada é persistida. Original da IA e versão
 * confirmada convivem — o original nunca é sobrescrito. Auditoria só com
 * ids/status/provider — nunca imagem, itens, macros ou prompt (§48/§80).
 */

export const MEAL_PHOTO_BUCKET = "meal-photos";
export const SIGNED_URL_SECONDS = 60;

export type PatientSession = { profileId: string; patientId: string };

export async function requireOwnAnalysis(patient: PatientSession, analysisId: string): Promise<FoodAnalysisDetail> {
  const analysis = await getFoodAnalysisById(analysisId);
  if (!analysis) throw new DomainError("FOOD_ANALYSIS_NOT_FOUND");
  // A RLS já esconde análises alheias; a checagem explícita torna a regra visível.
  if (analysis.patientId !== patient.patientId) throw new DomainError("FOOD_ANALYSIS_NOT_FOUND");
  return analysis;
}

// --- Consentimento (§19–§22) --------------------------------------------------------

export async function getMealAiConsent(patientId: string): Promise<PatientConsent | null> {
  return getActiveConsent(patientId, MEAL_PHOTO_AI_CONSENT_TYPE, MEAL_PHOTO_AI_CONSENT_VERSION);
}

export async function acceptMealAiConsent(patient: PatientSession): Promise<{ consentId: string }> {
  const existing = await getMealAiConsent(patient.patientId);
  if (existing) return { consentId: existing.id };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .insert({ patient_id: patient.patientId, consent_type: MEAL_PHOTO_AI_CONSENT_TYPE, consent_version: MEAL_PHOTO_AI_CONSENT_VERSION })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_AI_CONSENT_ACCEPTED", entityType: "patient_consent", entityId: data.id, metadata: { patient_id: patient.patientId, consent_version: MEAL_PHOTO_AI_CONSENT_VERSION } });
  return { consentId: data.id };
}

/** Revoga para análises FUTURAS; análises já processadas permanecem (política documentada). */
export async function revokeMealAiConsent(patient: PatientSession): Promise<void> {
  const existing = await getMealAiConsent(patient.patientId);
  if (!existing) return;
  const supabase = await createClient();
  const { error } = await supabase.from("patient_consents").update({ revoked_at: new Date().toISOString() }).eq("id", existing.id);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_AI_CONSENT_REVOKED", entityType: "patient_consent", entityId: existing.id, metadata: { patient_id: patient.patientId, consent_version: MEAL_PHOTO_AI_CONSENT_VERSION } });
}

// --- Foto (§8–§18/§53–§55) ---------------------------------------------------------

/**
 * Cria a refeição: processa a imagem (assinatura, limite, orientação,
 * redimensionamento, WebP sem EXIF), envia para
 * `<patient_id>/<analysis_id>/<uuid>.webp` e grava a linha PENDING. O
 * original do paciente é descartado. Reenvio idêntico (mesmo sha256 de uma
 * análise ativa) devolve a análise existente em vez de duplicar (§53).
 */
export async function createMealPhotoAnalysis(patient: PatientSession, file: File, mealAt: Date): Promise<{ analysisId: string; reused: boolean }> {
  const consent = await getMealAiConsent(patient.patientId);
  if (!consent) throw new DomainError("MEAL_AI_CONSENT_REQUIRED");
  if (!isMealTimeAcceptable(mealAt)) throw new DomainError("INVALID_MEAL_TIME");

  let processed;
  try {
    processed = await processMealPhoto(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof MealPhotoError) throw new DomainError(error.code);
    throw new DomainError("MEAL_PHOTO_INVALID");
  }

  const existing = await findActiveBySha(patient.patientId, processed.sha256);
  if (existing) return { analysisId: existing.id, reused: true };

  const analysisId = randomUUID();
  const path = `${patient.patientId}/${analysisId}/${randomUUID()}.webp`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(MEAL_PHOTO_BUCKET).upload(path, processed.bytes, { contentType: processed.mime, upsert: false });
  if (uploadError) {
    console.error("[food-analysis] upload da foto falhou:", uploadError.message);
    throw new DomainError("MEAL_PHOTO_UPLOAD_FAILED");
  }
  const { error } = await supabase.from("food_photo_analyses").insert({
    id: analysisId,
    patient_id: patient.patientId,
    storage_path: path,
    meal_at: mealAt.toISOString(),
    image_mime: processed.mime,
    image_size_bytes: processed.bytes.byteLength,
    image_sha256: processed.sha256,
    consent_version: consent.consentVersion,
  });
  if (error) {
    await supabase.storage.from(MEAL_PHOTO_BUCKET).remove([path]);
    throw domainErrorFromDatabase(error);
  }
  await recordAudit({ actorId: patient.profileId, action: "MEAL_PHOTO_UPLOADED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, mime: processed.mime, size_bytes: processed.bytes.byteLength, width: processed.width, height: processed.height } });
  return { analysisId, reused: false };
}

// --- Análise (§23–§31) --------------------------------------------------------------

/**
 * Pede a análise ao provider. Idempotência (§25/§91): um UPDATE condicional
 * "pega" a análise (status PENDING/FAILED e sem claim recente) — a segunda
 * requisição simultânea não afeta linha nenhuma e recebe
 * FOOD_ANALYSIS_ALREADY_PROCESSING. Timeout (§27) → FAILED com código
 * técnico e "Tentar novamente" sem registro novo. Erro cru do provider
 * nunca chega à UI; o log guarda só o código (§28).
 */
export async function requestMealAnalysis(patient: PatientSession, analysisId: string): Promise<{ status: "ANALYZED" | "FAILED" }> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_ARCHIVED");
  if (analysis.status === "CONFIRMED") throw new DomainError("FOOD_ANALYSIS_ALREADY_CONFIRMED");
  if (!canRequestAnalysis(analysis)) throw new DomainError(analysis.status === "ANALYZED" ? "FOOD_ANALYSIS_ALREADY_CONFIRMED" : "FOOD_ANALYSIS_ALREADY_PROCESSING");
  const consent = await getMealAiConsent(patient.patientId);
  if (!consent) throw new DomainError("MEAL_AI_CONSENT_REQUIRED");

  const limit = await mealAnalysisRateLimiter.consume(`meal-analysis:${patient.patientId}`);
  if (!limit.success) throw new DomainError("FOOD_ANALYSIS_RATE_LIMITED");

  const supabase = await createClient();
  const staleBefore = new Date(Date.now() - PROCESSING_STALE_MS).toISOString();
  const claim = await supabase
    .from("food_photo_analyses")
    .update({ status: "PENDING", processing_started_at: new Date().toISOString(), failure_code: null })
    .eq("id", analysisId)
    .in("status", ["PENDING", "FAILED"])
    .or(`processing_started_at.is.null,processing_started_at.lt.${staleBefore}`)
    .select("id");
  if (claim.error) throw domainErrorFromDatabase(claim.error);
  if (!claim.data || claim.data.length === 0) throw new DomainError("FOOD_ANALYSIS_ALREADY_PROCESSING");

  await recordAudit({ actorId: patient.profileId, action: "MEAL_ANALYSIS_REQUESTED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, attempt: analysis.attempts + 1 } });

  let provider;
  try {
    provider = getFoodAnalysisProvider();
  } catch (error) {
    await markFailed(patient, analysisId, analysis.attempts + 1, "PROVIDER_UNAVAILABLE");
    console.error("[food-analysis] provider indisponível:", error instanceof Error ? error.message : "erro");
    throw new DomainError("FOOD_ANALYSIS_PROVIDER_UNAVAILABLE");
  }

  const { data: object, error: downloadError } = await supabase.storage.from(MEAL_PHOTO_BUCKET).download(analysis.storagePath);
  if (downloadError || !object) {
    await markFailed(patient, analysisId, analysis.attempts + 1, "PHOTO_UNAVAILABLE");
    throw new DomainError("FOOD_ANALYSIS_FAILED");
  }
  const imageBytes = new Uint8Array(await object.arrayBuffer());
  const dimensions = await readWebpDimensions(imageBytes);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getFoodAnalysisTimeoutMs());
  const startedAt = Date.now();
  let output;
  try {
    output = await Promise.race([
      provider.analyzeMealPhoto({ imageBytes, mime: analysis.imageMime ?? "image/webp", width: dimensions.width, height: dimensions.height, signal: controller.signal }),
      new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new FoodAnalysisProviderError("PROVIDER_TIMEOUT")), { once: true })),
    ]);
  } catch (error) {
    clearTimeout(timer);
    const code = error instanceof FoodAnalysisProviderError ? error.code : controller.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR";
    await markFailed(patient, analysisId, analysis.attempts + 1, code, provider);
    // Só o código técnico — nunca payload, imagem ou prompt.
    console.error(`[food-analysis] ${code} (${provider.id}/${provider.model})`);
    return { status: "FAILED" };
  }
  clearTimeout(timer);
  const processingMs = Date.now() - startedAt;

  const parsed = providerResultSchema.safeParse(output.result);
  if (!parsed.success) {
    await markFailed(patient, analysisId, analysis.attempts + 1, "INVALID_RESPONSE", provider);
    console.error(`[food-analysis] INVALID_RESPONSE (${provider.id}/${provider.model}): ${parsed.error.issues.length} problema(s) de schema`);
    return { status: "FAILED" };
  }
  const normalized = normalizeProviderResult(parsed.data, () => randomUUID());
  const confidence = normalized.items.length > 0 ? averageConfidence(normalized) : null;

  const { error } = await supabase
    .from("food_photo_analyses")
    .update({
      status: "ANALYZED",
      provider: provider.id,
      model: provider.model,
      structured_result: normalized as unknown as Json,
      confidence,
      processing_ms: processingMs,
      provider_request_id: output.requestId ?? null,
      attempts: analysis.attempts + 1,
      failure_code: null,
    })
    .eq("id", analysisId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: patient.profileId,
    action: "MEAL_ANALYSIS_COMPLETED",
    entityType: "food_photo_analysis",
    entityId: analysisId,
    metadata: { patient_id: patient.patientId, provider: provider.id, model: provider.model, processing_ms: processingMs, items: normalized.items.length, simulated: provider.simulated },
  });
  return { status: "ANALYZED" };
}

async function markFailed(patient: PatientSession, analysisId: string, attempts: number, code: string, provider?: { id: string; model: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("food_photo_analyses").update({ status: "FAILED", failure_code: code, attempts }).eq("id", analysisId);
  if (error) console.error("[food-analysis] não foi possível registrar a falha:", error.message);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_ANALYSIS_FAILED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, code, attempt: attempts, provider: provider?.id ?? null, model: provider?.model ?? null } });
}

function averageConfidence(result: AnalysisResult): number | null {
  const values = result.items.map((item) => item.confidence).filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;
}

/** Dimensões do WebP processado (o fake usa como sinal de cenário de teste; um adapter real pode ignorar). */
async function readWebpDimensions(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

// --- Revisão e confirmação (§32–§40) ------------------------------------------------

export async function confirmMealAnalysis(patient: PatientSession, analysisId: string, reviewed: ReviewItemInput[]): Promise<void> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_ARCHIVED");
  if (!canReview(analysis) || !analysis.original) throw new DomainError(analysis.status === "CONFIRMED" ? "FOOD_ANALYSIS_ALREADY_CONFIRMED" : "FOOD_ANALYSIS_NOT_REVIEWABLE");
  const confirmed = buildConfirmedResult(analysis.original, reviewed, () => randomUUID());
  const supabase = await createClient();
  const { error } = await supabase.from("food_photo_analyses").update({ status: "CONFIRMED", corrected_result: confirmed as unknown as Json }).eq("id", analysisId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: patient.profileId,
    action: "MEAL_ANALYSIS_CONFIRMED",
    entityType: "food_photo_analysis",
    entityId: analysisId,
    metadata: { patient_id: patient.patientId, items: confirmed.items.length, added: confirmed.items.filter((item) => item.source === "PATIENT").length, removed: analysis.original.items.length - confirmed.items.filter((item) => item.source === "AI").length },
  });
}

/** Correção posterior de refeição confirmada (§40): nova versão confirmada, original intacto, auditado. */
export async function updateConfirmedMealAnalysis(patient: PatientSession, analysisId: string, reviewed: ReviewItemInput[]): Promise<void> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_ARCHIVED");
  if (!canEditConfirmed(analysis) || !analysis.original) throw new DomainError("FOOD_ANALYSIS_NOT_REVIEWABLE");
  const confirmed = buildConfirmedResult(analysis.original, reviewed, () => randomUUID());
  const supabase = await createClient();
  const { error } = await supabase.from("food_photo_analyses").update({ corrected_result: confirmed as unknown as Json }).eq("id", analysisId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_ANALYSIS_UPDATED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, items: confirmed.items.length } });
}

export async function updateMealTime(patient: PatientSession, analysisId: string, mealAt: Date): Promise<void> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_ARCHIVED");
  if (!isMealTimeAcceptable(mealAt)) throw new DomainError("INVALID_MEAL_TIME");
  const supabase = await createClient();
  const { error } = await supabase.from("food_photo_analyses").update({ meal_at: mealAt.toISOString() }).eq("id", analysisId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_ANALYSIS_UPDATED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, changed_fields: ["meal_at"] } });
}

/**
 * Arquivar (§41): a linha fica (metadados mínimos para auditoria, original
 * e versão confirmada preservados) e o objeto do bucket é removido — o
 * paciente e o nutricionista perdem a foto. Política de retenção: PENDENTE.
 */
export async function archiveMealAnalysis(patient: PatientSession, analysisId: string): Promise<void> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (!canArchive(analysis)) throw new DomainError(analysis.archivedAt ? "FOOD_ANALYSIS_ARCHIVED" : "FOOD_ANALYSIS_ALREADY_PROCESSING");
  const supabase = await createClient();
  const { error } = await supabase.from("food_photo_analyses").update({ archived_at: new Date().toISOString() }).eq("id", analysisId);
  if (error) throw domainErrorFromDatabase(error);
  const { error: removeError } = await supabase.storage.from(MEAL_PHOTO_BUCKET).remove([analysis.storagePath]);
  if (removeError) console.error("[food-analysis] foto não removida ao arquivar:", removeError.message);
  await recordAudit({ actorId: patient.profileId, action: "MEAL_ANALYSIS_ARCHIVED", entityType: "food_photo_analysis", entityId: analysisId, metadata: { patient_id: patient.patientId, status: analysis.status, photo_removed: !removeError } });
}

// --- Foto: entrega por URL assinada (§17–§18) ---------------------------------------

export async function signMealPhotoForPatient(patient: PatientSession, analysisId: string): Promise<string> {
  const analysis = await requireOwnAnalysis(patient, analysisId);
  if (analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_NOT_FOUND");
  return signObject(analysis.storagePath);
}

export async function signMealPhotoForNutritionist(nutritionistId: string, patientId: string, analysisId: string): Promise<string> {
  await requireOwnedPatient(nutritionistId, patientId);
  const analysis = await getFoodAnalysisById(analysisId);
  if (!analysis || analysis.patientId !== patientId || analysis.archivedAt) throw new DomainError("FOOD_ANALYSIS_NOT_FOUND");
  return signObject(analysis.storagePath);
}

async function signObject(path: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(MEAL_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new DomainError("FOOD_ANALYSIS_NOT_FOUND");
  return data.signedUrl;
}
