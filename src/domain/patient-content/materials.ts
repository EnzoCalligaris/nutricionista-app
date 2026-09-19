/**
 * Regras puras dos materiais (prompt Fase 10 §31–§50): MATERIAL (reutilizável,
 * arquivo privado OU link externo) separado de ATRIBUIÇÃO ao paciente.
 * Arquivado deixa de aparecer ao paciente e não é atribuído de novo; o
 * histórico administrativo permanece.
 */

export type MaterialKind = "FILE" | "LINK";
export type MaterialStatus = "ACTIVE" | "ARCHIVED";

export type MaterialLike = {
  kind: MaterialKind;
  storagePath: string | null;
  externalUrl: string | null;
  mimeType: string | null;
  archivedAt: string | null;
};

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  FILE: "Arquivo",
  LINK: "Link externo",
};

export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
};

/**
 * Tipos de arquivo aceitos (§37): só PDF, JPG e PNG — assinatura conferida
 * no servidor, nunca só extensão/MIME do browser (§39). Sem executáveis.
 */
export const MATERIAL_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Limite TÉCNICO (§38): 10 MB por arquivo — o mesmo do relatório de
 * bioimpedância (Fase 9) e abaixo do limite do bucket (50 MB). Não é
 * capacidade comercial: pode subir por decisão do profissional.
 */
export const MATERIAL_MAX_BYTES = 10 * 1024 * 1024;

export function materialStatus(item: Pick<MaterialLike, "archivedAt">): MaterialStatus {
  return item.archivedAt ? "ARCHIVED" : "ACTIVE";
}

/** Tipo exibido ao paciente/nutricionista: "PDF", "Imagem" ou "Link". */
export function materialTypeLabel(item: Pick<MaterialLike, "kind" | "mimeType">): string {
  if (item.kind === "LINK") return "Link";
  if (item.mimeType === "application/pdf") return "PDF";
  if (item.mimeType?.startsWith("image/")) return "Imagem";
  return "Arquivo";
}

/** Material de arquivo cujo upload ainda não concluiu é "incompleto": invisível e não atribuível. */
export function isMaterialComplete(item: Pick<MaterialLike, "kind" | "storagePath" | "externalUrl">): boolean {
  return item.kind === "LINK" ? item.externalUrl !== null : item.storagePath !== null;
}

export function canAssignMaterial(item: MaterialLike): boolean {
  return item.archivedAt === null && isMaterialComplete(item);
}

export function canEditMaterial(item: Pick<MaterialLike, "archivedAt">): boolean {
  return item.archivedAt === null;
}

export function canArchiveMaterial(item: Pick<MaterialLike, "archivedAt">): boolean {
  return item.archivedAt === null;
}

/** Ação do paciente conforme o tipo (§49): abrir link ou baixar arquivo. */
export function materialPatientAction(item: Pick<MaterialLike, "kind">): "OPEN" | "DOWNLOAD" {
  return item.kind === "LINK" ? "OPEN" : "DOWNLOAD";
}

export type AssignmentLike = { revokedAt: string | null; material: Pick<MaterialLike, "archivedAt" | "kind" | "storagePath" | "externalUrl"> };

/** Atribuição ativa = não revogada e material ativo e completo — é o que o paciente vê. */
export function isAssignmentActive(item: AssignmentLike): boolean {
  return item.revokedAt === null && item.material.archivedAt === null && isMaterialComplete(item.material);
}

export type AssignmentPresentation = "ACTIVE" | "REVOKED" | "MATERIAL_ARCHIVED";

/** Apresentação no perfil do paciente (§42): ativa, revogada, ou material arquivado (histórico). */
export function assignmentPresentation(item: AssignmentLike): AssignmentPresentation {
  if (item.revokedAt) return "REVOKED";
  if (item.material.archivedAt) return "MATERIAL_ARCHIVED";
  return "ACTIVE";
}

export const ASSIGNMENT_PRESENTATION_LABEL: Record<AssignmentPresentation, string> = {
  ACTIVE: "Disponível ao paciente",
  REVOKED: "Acesso removido",
  MATERIAL_ARCHIVED: "Material arquivado",
};

/** Tamanho legível: KB abaixo de 1 MB (Fase 9, §13 das decisões). */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Nome exibido do arquivo: só o basename, sem separadores/controle, limitado (nunca nome de paciente no path). */
export function safeFileDisplayName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? "material";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return (cleaned || "material").slice(0, 120);
}

/** Ordem da biblioteca (§33): ativos primeiro, mais recentes primeiro. */
export function sortMaterials<T extends Pick<MaterialLike, "archivedAt"> & { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byStatus = (a.archivedAt ? 1 : 0) - (b.archivedAt ? 1 : 0);
    if (byStatus !== 0) return byStatus;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
