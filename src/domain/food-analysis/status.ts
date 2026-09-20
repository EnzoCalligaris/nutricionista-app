/**
 * Máquina de estados da análise (prompt Fase 11 §23–§27/§40–§41), sobre o
 * enum da Fase 2 (PENDING / ANALYZED / CONFIRMED / FAILED): "processando" é
 * PENDING com claim recente; "arquivada" é `archived_at`. Sem enum novo.
 */

export type AnalysisDbStatus = "PENDING" | "ANALYZED" | "CONFIRMED" | "FAILED";

export type AnalysisLike = {
  status: AnalysisDbStatus;
  processingStartedAt: string | null;
  archivedAt: string | null;
};

/** Um claim mais antigo que isto é considerado abandonado (timeout do provider + folga) e pode ser retomado. */
export const PROCESSING_STALE_MS = 2 * 60 * 1000;

export type AnalysisUiStatus = "UPLOADED" | "PROCESSING" | "REVIEW_REQUIRED" | "CONFIRMED" | "FAILED" | "ARCHIVED";

export const ANALYSIS_STATUS_LABEL: Record<AnalysisUiStatus, string> = {
  UPLOADED: "Aguardando análise",
  PROCESSING: "Analisando",
  REVIEW_REQUIRED: "Revisão pendente",
  CONFIRMED: "Confirmada",
  FAILED: "Falha na análise",
  ARCHIVED: "Arquivada",
};

export function isProcessing(item: Pick<AnalysisLike, "status" | "processingStartedAt">, now: Date = new Date()): boolean {
  if (item.status !== "PENDING" || !item.processingStartedAt) return false;
  return now.getTime() - new Date(item.processingStartedAt).getTime() < PROCESSING_STALE_MS;
}

export function analysisUiStatus(item: AnalysisLike, now: Date = new Date()): AnalysisUiStatus {
  if (item.archivedAt) return "ARCHIVED";
  if (item.status === "CONFIRMED") return "CONFIRMED";
  if (item.status === "ANALYZED") return "REVIEW_REQUIRED";
  if (item.status === "FAILED") return "FAILED";
  return isProcessing(item, now) ? "PROCESSING" : "UPLOADED";
}

/** Pode pedir (ou repetir) a análise: foto enviada e ninguém processando, ou falha anterior (§27/§66). */
export function canRequestAnalysis(item: AnalysisLike, now: Date = new Date()): boolean {
  const ui = analysisUiStatus(item, now);
  return ui === "UPLOADED" || ui === "FAILED";
}

export function canReview(item: AnalysisLike): boolean {
  return analysisUiStatus(item) === "REVIEW_REQUIRED";
}

/** Edição posterior de uma refeição confirmada é permitida com rastreabilidade (§40). */
export function canEditConfirmed(item: AnalysisLike): boolean {
  return analysisUiStatus(item) === "CONFIRMED";
}

export function canArchive(item: AnalysisLike): boolean {
  return item.archivedAt === null && !isProcessing(item);
}

/** Nutricionista acompanha só o que o paciente confirmou (§42). */
export function isVisibleToNutritionistTimeline(item: AnalysisLike): boolean {
  return analysisUiStatus(item) === "CONFIRMED";
}

/** Histórico: mais recente primeiro pela data da refeição (§38). */
export function sortByMealDesc<T extends { mealAt: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.mealAt.localeCompare(a.mealAt) || b.createdAt.localeCompare(a.createdAt));
}

// --- Consentimento (§19–§22) --------------------------------------------------------

export const MEAL_PHOTO_AI_CONSENT_TYPE = "MEAL_PHOTO_AI";
/** Versão do texto abaixo. Mudou o texto ou o processamento → nova versão → novo aceite. */
export const MEAL_PHOTO_AI_CONSENT_VERSION = "meal_photo_ai_v1";

export const MEAL_PHOTO_AI_CONSENT_TEXT = [
  "A foto da sua refeição será processada por uma tecnologia de inteligência artificial para estimar os alimentos, as porções e os valores nutricionais.",
  "O resultado é sempre uma estimativa: pode variar conforme ingredientes, porções e modo de preparo, e não substitui a orientação do seu nutricionista.",
  "A imagem e os dados necessários para a análise podem ser processados pelo fornecedor de IA configurado pela plataforma, conforme a política aplicável.",
  "As fotos ficam disponíveis apenas para você e para o seu nutricionista responsável.",
  "Usar este recurso é opcional: você pode não aceitar agora, e pode revogar o consentimento depois para novas análises.",
] as const;

// --- Data/hora da refeição (§58–§59) ------------------------------------------------

/** Tolerância de relógio para "agora" — nunca uma janela grande de refeição futura. */
export const MEAL_TIME_FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

export function isMealTimeAcceptable(mealAt: Date, now: Date = new Date()): boolean {
  return !Number.isNaN(mealAt.getTime()) && mealAt.getTime() <= now.getTime() + MEAL_TIME_FUTURE_TOLERANCE_MS;
}
