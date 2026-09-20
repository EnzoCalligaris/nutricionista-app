"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePatient } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { wallClockToInstant } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { parseDecimalPtBr } from "@/domain/assessments/numbers";
import { isFoodUnit, isPreparationMethod, type ReviewItemInput } from "@/domain/food-analysis/estimates";
import { getPatientBookingContext } from "@/services/scheduling";
import * as service from "@/services/food-analysis/service";
import { analysisIdSchema, mealPhotoMetaSchema, mealWallClockSchema, reviewSchema } from "@/validators/food-analysis";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions do paciente para a foto da refeição (prompt Fase 11
 * §73–§75): `requirePatient()` + paciente derivado da SESSÃO (nunca de
 * input), Zod só com campos de negócio, service (provider chamado só
 * server-side), revalidação. Nenhum log com imagem/base64/itens.
 */

export type MealPhotoFormState = { error?: string; fieldErrors?: Record<string, string> };
export type ReviewFormState = { error?: string; fieldErrors?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[food-analysis] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

async function requirePatientSession(): Promise<service.PatientSession> {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) redirect("/paciente");
  return { profileId: profile.id, patientId: context.patientId };
}

function revalidateMeals(analysisId?: string, patientId?: string) {
  revalidatePath("/paciente/refeicoes");
  revalidatePath("/paciente");
  if (analysisId) revalidatePath(`/paciente/refeicoes/${analysisId}`);
  if (patientId) revalidatePath(`/dashboard/pacientes/${patientId}`);
}

function parseMealAt(raw: string): Date | null {
  const parsed = mealWallClockSchema.safeParse(raw);
  if (!parsed.success) return null;
  const [date, time] = parsed.data.split("T");
  try {
    return wallClockToInstant(date!, time!, DEFAULT_TIME_ZONE);
  } catch {
    return null;
  }
}

// --- Consentimento --------------------------------------------------------------------

export async function acceptMealAiConsentAction(): Promise<ActionResult> {
  const patient = await requirePatientSession();
  try {
    await service.acceptMealAiConsent(patient);
    revalidateMeals();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function revokeMealAiConsentAction(): Promise<ActionResult> {
  const patient = await requirePatientSession();
  try {
    await service.revokeMealAiConsent(patient);
    revalidateMeals();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// --- Foto -----------------------------------------------------------------------------

/** Envio da foto (multipart via Server Action). Redireciona para a refeição criada (ou para a idêntica já existente). */
export async function createMealPhotoAction(_prev: MealPhotoFormState, formData: FormData): Promise<MealPhotoFormState> {
  const patient = await requirePatientSession();
  // Dois inputs (câmera e galeria) compartilham o nome: só um carrega arquivo.
  const file = formData.getAll("photo").find((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!file) return { fieldErrors: { photo: "Selecione ou tire uma foto da refeição." } };
  const meta = mealPhotoMetaSchema.safeParse({ type: file.type, size: file.size });
  if (!meta.success) return { fieldErrors: { photo: meta.error.issues[0]?.message ?? domainErrorMessage("MEAL_PHOTO_INVALID") } };
  const mealAtRaw = String(formData.get("mealAt") ?? "");
  const mealAt = mealAtRaw ? parseMealAt(mealAtRaw) : new Date();
  if (!mealAt) return { fieldErrors: { mealAt: "Data e hora inválidas." } };

  let created: { analysisId: string; reused: boolean };
  try {
    created = await service.createMealPhotoAnalysis(patient, file, mealAt);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateMeals(created.analysisId, patient.patientId);
  redirect(`/paciente/refeicoes/${created.analysisId}${created.reused ? "?toast=meal_photo_reused" : ""}`);
}

export async function requestMealAnalysisAction(analysisId: string): Promise<ActionResult & { status?: "ANALYZED" | "FAILED" }> {
  const patient = await requirePatientSession();
  const id = analysisIdSchema.safeParse(analysisId);
  if (!id.success) return { ok: false, error: domainErrorMessage("FOOD_ANALYSIS_NOT_FOUND") };
  try {
    const result = await service.requestMealAnalysis(patient, id.data);
    revalidateMeals(id.data, patient.patientId);
    return { ok: true, status: result.status };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// --- Revisão --------------------------------------------------------------------------

/** Lê os itens revisados do formulário: campos `item:<index>:<campo>` em texto pt-BR. */
function parseReviewForm(formData: FormData): { ok: true; items: ReviewItemInput[] } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const count = Math.min(Number(formData.get("itemCount") ?? 0) || 0, 60);
  const items: ReviewItemInput[] = [];
  const formIndexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const key = (field: string) => `item:${index}:${field}`;
    if (formData.get(key("removed")) === "1") continue;
    formIndexes.push(index);
    const num = (field: string, label: string) => {
      const raw = String(formData.get(key(field)) ?? "").trim();
      const value = raw === "" ? null : parseDecimalPtBr(raw);
      if (value === null) fieldErrors[key(field)] = `Informe ${label} (ex.: 12,5).`;
      return value ?? Number.NaN;
    };
    const unit = String(formData.get(key("unit")) ?? "g");
    const preparation = String(formData.get(key("preparation")) ?? "nao_informado");
    items.push({
      id: String(formData.get(key("id")) ?? "") || null,
      name: String(formData.get(key("name")) ?? ""),
      quantity: num("quantity", "a quantidade"),
      unit: isFoodUnit(unit) ? unit : "g",
      preparation: isPreparationMethod(preparation) ? preparation : "nao_informado",
      calories: num("calories", "as calorias"),
      proteinG: num("proteinG", "a proteína"),
      carbsG: num("carbsG", "os carboidratos"),
      fatG: num("fatG", "as gorduras"),
    });
  }
  const parsed = reviewSchema.safeParse({ items });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [, index, field] = issue.path;
      const formIndex = typeof index === "number" ? formIndexes[index] : undefined;
      const key = formIndex != null && field != null ? `item:${formIndex}:${String(field)}` : "form";
      fieldErrors[key] ??= issue.message;
    }
  }
  if (Object.keys(fieldErrors).length > 0 || !parsed.success) return { ok: false, fieldErrors };
  return { ok: true, items: parsed.data.items.map((item) => ({ ...item, id: item.id ?? null })) };
}

export async function confirmMealAnalysisAction(analysisId: string, _prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const patient = await requirePatientSession();
  const id = analysisIdSchema.safeParse(analysisId);
  if (!id.success) return { error: domainErrorMessage("FOOD_ANALYSIS_NOT_FOUND") };
  const form = parseReviewForm(formData);
  if (!form.ok) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: form.fieldErrors };
  const mode = String(formData.get("mode") ?? "confirm");
  try {
    if (mode === "update") await service.updateConfirmedMealAnalysis(patient, id.data, form.items);
    else await service.confirmMealAnalysis(patient, id.data, form.items);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateMeals(id.data, patient.patientId);
  redirect(`/paciente/refeicoes/${id.data}?toast=${mode === "update" ? "meal_updated" : "meal_confirmed"}`);
}

export async function updateMealTimeAction(analysisId: string, mealAtRaw: string): Promise<ActionResult> {
  const patient = await requirePatientSession();
  const id = analysisIdSchema.safeParse(analysisId);
  if (!id.success) return { ok: false, error: domainErrorMessage("FOOD_ANALYSIS_NOT_FOUND") };
  const mealAt = parseMealAt(mealAtRaw);
  if (!mealAt) return { ok: false, error: "Data e hora inválidas." };
  try {
    await service.updateMealTime(patient, id.data, mealAt);
    revalidateMeals(id.data, patient.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function archiveMealAnalysisAction(analysisId: string): Promise<ActionResult> {
  const patient = await requirePatientSession();
  const id = analysisIdSchema.safeParse(analysisId);
  if (!id.success) return { ok: false, error: domainErrorMessage("FOOD_ANALYSIS_NOT_FOUND") };
  try {
    await service.archiveMealAnalysis(patient, id.data);
    revalidateMeals(id.data, patient.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
