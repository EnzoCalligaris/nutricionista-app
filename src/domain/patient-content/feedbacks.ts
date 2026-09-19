/**
 * Regras puras dos feedbacks (prompt Fase 10 §18–§30): comunicação
 * individual do nutricionista para o paciente — não é chat. Rascunho só o
 * nutricionista vê; "Disponibilizar ao paciente" é definitivo; arquivar
 * oculta sem apagar.
 */

export type FeedbackStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type FeedbackLike = { publishedAt: string | null; archivedAt: string | null };

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Disponibilizado",
  ARCHIVED: "Arquivado",
};

export function feedbackStatus(item: FeedbackLike): FeedbackStatus {
  if (item.archivedAt) return "ARCHIVED";
  return item.publishedAt ? "PUBLISHED" : "DRAFT";
}

/** Paciente só vê disponibilizado e não arquivado (§28) — a RLS repete a regra. */
export function isFeedbackVisibleToPatient(item: FeedbackLike): boolean {
  return feedbackStatus(item) === "PUBLISHED";
}

/**
 * Edição (§25): rascunho é livre; já disponibilizado ainda pode ser
 * corrigido pelo nutricionista (com `updated_at` + auditoria — sem
 * versionamento pesado); arquivado é só leitura.
 */
export function canEditFeedback(item: FeedbackLike): boolean {
  return item.archivedAt === null;
}

export function canPublishFeedback(item: FeedbackLike): boolean {
  return feedbackStatus(item) === "DRAFT";
}

export function canArchiveFeedback(item: FeedbackLike): boolean {
  return item.archivedAt === null;
}

/** Só rascunho (nunca exibido) pode ser apagado (§26); o banco também recusa. */
export function canDeleteFeedback(item: FeedbackLike): boolean {
  return feedbackStatus(item) === "DRAFT";
}

/** Histórico: mais recente primeiro (§27), por criação. */
export function sortFeedbacks<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Último feedback disponível ao paciente (home do portal, §30): o disponibilizado mais recente. */
export function latestVisibleFeedback<T extends FeedbackLike & { publishedAt: string | null }>(items: T[]): T | null {
  const visible = items.filter(isFeedbackVisibleToPatient);
  visible.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return visible[0] ?? null;
}

/** Título exibido: o título, ou um genérico a partir da data (nunca id interno, §29). */
export function feedbackDisplayTitle(item: { title: string | null; createdAt: string }, formatDate: (iso: string) => string): string {
  return item.title?.trim() ? item.title : `Feedback de ${formatDate(item.createdAt)}`;
}

/** Prévia curta do conteúdo para listas (o texto completo fica na leitura). */
export function feedbackExcerpt(content: string, max = 140): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
