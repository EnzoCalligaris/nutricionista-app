import { describe, expect, it } from "vitest";
import {
  canArchiveSupplement,
  canDeactivateSupplement,
  canEditSupplement,
  canReactivateSupplement,
  formatSupplementPeriod,
  isSupplementVisibleToPatient,
  sortSupplements,
  supplementStatus,
} from "@/domain/patient-content/supplements";
import {
  canDeleteFeedback,
  canEditFeedback,
  canPublishFeedback,
  feedbackDisplayTitle,
  feedbackExcerpt,
  feedbackStatus,
  isFeedbackVisibleToPatient,
  latestVisibleFeedback,
  sortFeedbacks,
} from "@/domain/patient-content/feedbacks";
import {
  assignmentPresentation,
  canAssignMaterial,
  formatFileSize,
  isAssignmentActive,
  isMaterialComplete,
  materialPatientAction,
  materialStatus,
  materialTypeLabel,
  safeFileDisplayName,
  sortMaterials,
  MATERIAL_MAX_BYTES,
  MATERIAL_MIME_TO_EXT,
} from "@/domain/patient-content/materials";

const br = (iso: string) => iso.split("-").reverse().join("/");

describe("suplementos — status derivado e visibilidade (§11–§15)", () => {
  it("ATIVA / ENCERRADA / ARQUIVADA sem enum novo; arquivada vence encerrada", () => {
    expect(supplementStatus({ active: true, archivedAt: null })).toBe("ACTIVE");
    expect(supplementStatus({ active: false, archivedAt: null })).toBe("INACTIVE");
    expect(supplementStatus({ active: true, archivedAt: "2026-09-01T00:00:00Z" })).toBe("ARCHIVED");
    expect(supplementStatus({ active: false, archivedAt: "2026-09-01T00:00:00Z" })).toBe("ARCHIVED");
  });

  it("paciente só vê ativa; encerrada e arquivada ficam fora", () => {
    expect(isSupplementVisibleToPatient({ active: true, archivedAt: null })).toBe(true);
    expect(isSupplementVisibleToPatient({ active: false, archivedAt: null })).toBe(false);
    expect(isSupplementVisibleToPatient({ active: true, archivedAt: "x" })).toBe(false);
  });

  it("ações por status: editar/arquivar só não arquivada; encerrar só ativa; reativar só encerrada", () => {
    const active = { active: true, archivedAt: null };
    const inactive = { active: false, archivedAt: null };
    const archived = { active: false, archivedAt: "x" };
    expect([canEditSupplement(active), canEditSupplement(inactive), canEditSupplement(archived)]).toEqual([true, true, false]);
    expect([canArchiveSupplement(active), canArchiveSupplement(archived)]).toEqual([true, false]);
    expect([canDeactivateSupplement(active), canDeactivateSupplement(inactive)]).toEqual([true, false]);
    expect([canReactivateSupplement(inactive), canReactivateSupplement(active), canReactivateSupplement(archived)]).toEqual([true, false, false]);
  });

  it("período em texto e ordenação ativas → encerradas → arquivadas, mais recente primeiro", () => {
    expect(formatSupplementPeriod("2026-09-01", "2026-11-30", br)).toBe("01/09/2026 a 30/11/2026");
    expect(formatSupplementPeriod("2026-09-01", null, br)).toBe("desde 01/09/2026");
    expect(formatSupplementPeriod(null, "2026-11-30", br)).toBe("até 30/11/2026");
    expect(formatSupplementPeriod(null, null, br)).toBeNull();
    const sorted = sortSupplements([
      { id: "arch", active: false, archivedAt: "x", updatedAt: "2026-09-09" },
      { id: "old-active", active: true, archivedAt: null, updatedAt: "2026-01-01" },
      { id: "inactive", active: false, archivedAt: null, updatedAt: "2026-09-05" },
      { id: "new-active", active: true, archivedAt: null, updatedAt: "2026-09-01" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new-active", "old-active", "inactive", "arch"]);
  });
});

describe("feedbacks — rascunho, disponibilizado, arquivado (§22–§30)", () => {
  const draft = { publishedAt: null, archivedAt: null };
  const published = { publishedAt: "2026-09-10T00:00:00Z", archivedAt: null };
  const archived = { publishedAt: "2026-09-10T00:00:00Z", archivedAt: "2026-09-12T00:00:00Z" };

  it("status e visibilidade ao paciente", () => {
    expect(feedbackStatus(draft)).toBe("DRAFT");
    expect(feedbackStatus(published)).toBe("PUBLISHED");
    expect(feedbackStatus(archived)).toBe("ARCHIVED");
    expect(isFeedbackVisibleToPatient(draft)).toBe(false);
    expect(isFeedbackVisibleToPatient(published)).toBe(true);
    expect(isFeedbackVisibleToPatient(archived)).toBe(false);
  });

  it("editar até arquivar; publicar só rascunho; apagar só rascunho", () => {
    expect([canEditFeedback(draft), canEditFeedback(published), canEditFeedback(archived)]).toEqual([true, true, false]);
    expect([canPublishFeedback(draft), canPublishFeedback(published)]).toEqual([true, false]);
    expect([canDeleteFeedback(draft), canDeleteFeedback(published), canDeleteFeedback(archived)]).toEqual([true, false, false]);
  });

  it("histórico mais recente primeiro; último visível pela data de disponibilização", () => {
    const items = [
      { id: "a", createdAt: "2026-09-01T00:00:00Z", publishedAt: "2026-09-11T00:00:00Z", archivedAt: null },
      { id: "b", createdAt: "2026-09-05T00:00:00Z", publishedAt: null, archivedAt: null },
      { id: "c", createdAt: "2026-09-03T00:00:00Z", publishedAt: "2026-09-04T00:00:00Z", archivedAt: null },
      { id: "d", createdAt: "2026-09-08T00:00:00Z", publishedAt: "2026-09-12T00:00:00Z", archivedAt: "2026-09-13T00:00:00Z" },
    ];
    expect(sortFeedbacks(items).map((item) => item.id)).toEqual(["d", "b", "c", "a"]);
    expect(latestVisibleFeedback(items)?.id).toBe("a");
    expect(latestVisibleFeedback([])).toBeNull();
  });

  it("título exibido sem id interno e prévia curta", () => {
    expect(feedbackDisplayTitle({ title: "Semana 2", createdAt: "2026-09-01T12:00:00Z" }, () => "01/09/2026")).toBe("Semana 2");
    expect(feedbackDisplayTitle({ title: "  ", createdAt: "2026-09-01T12:00:00Z" }, () => "01/09/2026")).toBe("Feedback de 01/09/2026");
    expect(feedbackExcerpt("linha 1\n\nlinha   2")).toBe("linha 1 linha 2");
    expect(feedbackExcerpt("x".repeat(200), 20)).toHaveLength(20);
    expect(feedbackExcerpt("x".repeat(200), 20).endsWith("…")).toBe(true);
  });
});

describe("materiais — tipo, completude, atribuição (§31–§50)", () => {
  const link = { kind: "LINK" as const, storagePath: null, externalUrl: "https://example.com", mimeType: null, archivedAt: null };
  const pdf = { kind: "FILE" as const, storagePath: "id/a.pdf", externalUrl: null, mimeType: "application/pdf", archivedAt: null };
  const pending = { kind: "FILE" as const, storagePath: null, externalUrl: null, mimeType: null, archivedAt: null };
  const archivedPdf = { ...pdf, archivedAt: "2026-09-01T00:00:00Z" };

  it("rótulo de tipo, ação do paciente e status", () => {
    expect(materialTypeLabel(link)).toBe("Link");
    expect(materialTypeLabel(pdf)).toBe("PDF");
    expect(materialTypeLabel({ kind: "FILE", mimeType: "image/png" })).toBe("Imagem");
    expect(materialPatientAction(link)).toBe("OPEN");
    expect(materialPatientAction(pdf)).toBe("DOWNLOAD");
    expect(materialStatus(pdf)).toBe("ACTIVE");
    expect(materialStatus(archivedPdf)).toBe("ARCHIVED");
  });

  it("arquivo sem upload é incompleto: não atribuível; arquivado não atribuível", () => {
    expect(isMaterialComplete(link)).toBe(true);
    expect(isMaterialComplete(pdf)).toBe(true);
    expect(isMaterialComplete(pending)).toBe(false);
    expect(canAssignMaterial(link)).toBe(true);
    expect(canAssignMaterial(pending)).toBe(false);
    expect(canAssignMaterial(archivedPdf)).toBe(false);
  });

  it("apresentação da atribuição: ativa, revogada, material arquivado", () => {
    expect(isAssignmentActive({ revokedAt: null, material: pdf })).toBe(true);
    expect(isAssignmentActive({ revokedAt: "x", material: pdf })).toBe(false);
    expect(isAssignmentActive({ revokedAt: null, material: archivedPdf })).toBe(false);
    expect(isAssignmentActive({ revokedAt: null, material: pending })).toBe(false);
    expect(assignmentPresentation({ revokedAt: null, material: pdf })).toBe("ACTIVE");
    expect(assignmentPresentation({ revokedAt: "x", material: pdf })).toBe("REVOKED");
    expect(assignmentPresentation({ revokedAt: null, material: archivedPdf })).toBe("MATERIAL_ARCHIVED");
  });

  it("tipos aceitos, limite técnico, nome seguro e tamanho legível", () => {
    expect(Object.keys(MATERIAL_MIME_TO_EXT)).toEqual(["application/pdf", "image/jpeg", "image/png"]);
    expect(MATERIAL_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(safeFileDisplayName("C:\\Users\\x\\Guia <final>.pdf")).toBe("Guia final.pdf");
    expect(safeFileDisplayName("../../etc/passwd")).toBe("passwd");
    expect(safeFileDisplayName("")).toBe("material");
    expect(formatFileSize(500)).toBe("1 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatFileSize(null)).toBe("");
  });

  it("biblioteca: ativos primeiro, mais recentes primeiro", () => {
    const sorted = sortMaterials([
      { id: "arch-new", archivedAt: "x", createdAt: "2026-09-09" },
      { id: "old", archivedAt: null, createdAt: "2026-01-01" },
      { id: "new", archivedAt: null, createdAt: "2026-09-01" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "old", "arch-new"]);
  });
});
