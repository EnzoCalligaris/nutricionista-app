import type { MealPlanVersionStatus } from "@/domain/meal-plans/definitions";

/**
 * Versionamento puro (prompt Fase 8 §3/§22–§26). O banco aplica as mesmas
 * regras (`guard_meal_plan_version`, `publish_meal_plan_version`); aqui elas
 * alimentam a UI e ficam testáveis.
 */

export type VersionSummary = {
  id: string;
  versionNumber: number;
  status: MealPlanVersionStatus;
  publishedAt: string | null;
  createdAt: string;
};

/** Próximo número: máximo + 1 (nunca reaproveita número de versão descartada). */
export function nextVersionNumber(versions: { versionNumber: number }[]): number {
  return versions.reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1;
}

/** Versão que o paciente vê: a PUBLISHED — nunca "a última criada". */
export function selectPublished<T extends { status: MealPlanVersionStatus }>(versions: T[]): T | null {
  return versions.find((version) => version.status === "PUBLISHED") ?? null;
}

export function selectDraft<T extends { status: MealPlanVersionStatus }>(versions: T[]): T | null {
  return versions.find((version) => version.status === "DRAFT") ?? null;
}

/** Versão "atual" para o nutricionista: rascunho em andamento, senão a publicada, senão a mais recente. */
export function selectCurrent<T extends VersionSummary>(versions: T[]): T | null {
  return selectDraft(versions) ?? selectPublished(versions) ?? [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

/** Versões em ordem decrescente de número (histórico). */
export function sortVersionsDesc<T extends { versionNumber: number }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
}

export function isEditable(status: MealPlanVersionStatus): boolean {
  return status === "DRAFT";
}

export function canTransition(from: MealPlanVersionStatus, to: MealPlanVersionStatus): boolean {
  if (from === to) return false;
  if (from === "ARCHIVED") return false;
  if (from === "PUBLISHED") return to === "ARCHIVED";
  return to === "PUBLISHED" || to === "ARCHIVED";
}

/** Só pode nascer um rascunho quando não existe outro (um por vez). */
export function canCreateVersion(versions: { status: MealPlanVersionStatus }[], planArchived: boolean): boolean {
  return !planArchived && selectDraft(versions) === null;
}

/**
 * Publicar substitui a versão publicada atual? Quando sim a UI pede
 * confirmação explícita (§56); quando é a primeira publicação basta o clique.
 */
export function publishReplacesCurrent(versions: { status: MealPlanVersionStatus }[]): boolean {
  return selectPublished(versions) !== null;
}

/** Aplica a publicação em memória (para testes e previsões): anterior vira ARCHIVED. */
export function applyPublish<T extends VersionSummary>(versions: T[], versionId: string, publishedAt: string): T[] {
  const target = versions.find((version) => version.id === versionId);
  if (!target || target.status !== "DRAFT") throw new Error("MEAL_PLAN_ALREADY_PUBLISHED");
  return versions.map((version) => {
    if (version.id === versionId) return { ...version, status: "PUBLISHED" as const, publishedAt };
    if (version.status === "PUBLISHED") return { ...version, status: "ARCHIVED" as const };
    return version;
  });
}
