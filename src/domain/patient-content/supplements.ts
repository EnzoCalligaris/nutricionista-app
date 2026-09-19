/**
 * Regras puras das recomendações de suplemento (prompt Fase 10 §4–§14).
 * O sistema só registra e apresenta a orientação do nutricionista: nada
 * aqui sugere, calcula dose ou interpreta — são regras de status,
 * visibilidade e apresentação.
 */

export type SupplementStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type SupplementLike = { active: boolean; archivedAt: string | null };

export const SUPPLEMENT_STATUS_LABEL: Record<SupplementStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Encerrada",
  ARCHIVED: "Arquivada",
};

/** Status derivado de `active` + `archived_at` — nenhum enum novo no banco (§11). */
export function supplementStatus(item: SupplementLike): SupplementStatus {
  if (item.archivedAt) return "ARCHIVED";
  return item.active ? "ACTIVE" : "INACTIVE";
}

/** Paciente só vê recomendação ATIVA e não arquivada (§15) — a RLS repete a regra. */
export function isSupplementVisibleToPatient(item: SupplementLike): boolean {
  return supplementStatus(item) === "ACTIVE";
}

/** Edição administrativa só enquanto não arquivada (§13). */
export function canEditSupplement(item: SupplementLike): boolean {
  return item.archivedAt === null;
}

/** Encerrada volta a ativa só por ação explícita (§13); arquivada nunca. */
export function canReactivateSupplement(item: SupplementLike): boolean {
  return supplementStatus(item) === "INACTIVE";
}

export function canDeactivateSupplement(item: SupplementLike): boolean {
  return supplementStatus(item) === "ACTIVE";
}

export function canArchiveSupplement(item: SupplementLike): boolean {
  return item.archivedAt === null;
}

/** Período em texto: "desde 01/09/2026", "01/09/2026 a 30/11/2026", "até 30/11/2026" ou null. */
export function formatSupplementPeriod(startsOn: string | null, endsOn: string | null, formatDate: (iso: string) => string): string | null {
  if (startsOn && endsOn) return `${formatDate(startsOn)} a ${formatDate(endsOn)}`;
  if (startsOn) return `desde ${formatDate(startsOn)}`;
  if (endsOn) return `até ${formatDate(endsOn)}`;
  return null;
}

/** Ordem do histórico (§12): ativas primeiro, depois encerradas, depois arquivadas; dentro do grupo, atualização mais recente primeiro. */
export function sortSupplements<T extends SupplementLike & { updatedAt: string }>(items: T[]): T[] {
  const rank: Record<SupplementStatus, number> = { ACTIVE: 0, INACTIVE: 1, ARCHIVED: 2 };
  return [...items].sort((a, b) => {
    const byStatus = rank[supplementStatus(a)] - rank[supplementStatus(b)];
    if (byStatus !== 0) return byStatus;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
