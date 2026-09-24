/**
 * Estado derivado de um resultado antes/depois. Como em toda a plataforma, o
 * estado NÃO é uma coluna livre: sai das colunas reais
 * (`published`/`archived_at`/consentimento/imagens), então não existe estado
 * inconsistente.
 */

export type ResultState =
  | "DRAFT"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "CONSENT_REVOKED"
  | "ARCHIVED";

export type ResultStateInput = {
  published: boolean;
  archivedAt: string | null;
  beforePath: string | null;
  afterPath: string | null;
  hasValidConsent: boolean;
};

export function resultState(input: ResultStateInput): ResultState {
  if (input.archivedAt) return "ARCHIVED";
  if (input.published) return input.hasValidConsent ? "PUBLISHED" : "CONSENT_REVOKED";
  const hasImages = Boolean(input.beforePath && input.afterPath);
  return hasImages && input.hasValidConsent ? "READY_TO_PUBLISH" : "DRAFT";
}

export const RESULT_STATE_LABELS: Record<ResultState, string> = {
  DRAFT: "Rascunho",
  READY_TO_PUBLISH: "Pronto para publicar",
  PUBLISHED: "Publicado",
  CONSENT_REVOKED: "Fora do ar — consentimento revogado",
  ARCHIVED: "Arquivado",
};

/**
 * Visível no site público? Espelha a policy
 * `before_after_results_select_public` (published + não arquivado +
 * consentimento válido) — segunda camada, testável sem banco (§34).
 */
export function isResultPubliclyVisible(input: ResultStateInput): boolean {
  return resultState(input) === "PUBLISHED";
}

/** O que falta para poder publicar — mensagens para a UI (§70). */
export function publicationBlockers(input: ResultStateInput): string[] {
  const blockers: string[] = [];
  if (input.archivedAt) blockers.push("O resultado está arquivado.");
  if (!input.beforePath) blockers.push("Falta a foto de antes.");
  if (!input.afterPath) blockers.push("Falta a foto de depois.");
  if (!input.hasValidConsent) blockers.push("Falta um consentimento de uso de imagem válido.");
  return blockers;
}

export function canPublish(input: ResultStateInput): boolean {
  return publicationBlockers(input).length === 0 && !input.published;
}
