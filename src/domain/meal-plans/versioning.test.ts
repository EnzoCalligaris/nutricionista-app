import { describe, expect, it } from "vitest";
import {
  applyPublish,
  canCreateVersion,
  canTransition,
  isEditable,
  nextVersionNumber,
  publishReplacesCurrent,
  selectCurrent,
  selectDraft,
  selectPublished,
  sortVersionsDesc,
  type VersionSummary,
} from "@/domain/meal-plans/versioning";

const v = (id: string, versionNumber: number, status: VersionSummary["status"], publishedAt: string | null = null): VersionSummary => ({ id, versionNumber, status, publishedAt, createdAt: `2026-09-0${versionNumber}T00:00:00Z` });

describe("version number", () => {
  it("é máximo + 1 e nunca reaproveita número descartado", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([v("a", 1, "ARCHIVED"), v("b", 3, "PUBLISHED")])).toBe(4);
  });
});

describe("seleção da versão publicada (§58)", () => {
  const versions = [v("v3", 3, "DRAFT"), v("v2", 2, "PUBLISHED", "2026-09-10T00:00:00Z"), v("v1", 1, "ARCHIVED")];

  it("paciente vê a PUBLISHED, não a última criada", () => {
    expect(selectPublished(versions)?.id).toBe("v2");
    expect(selectDraft(versions)?.id).toBe("v3");
  });

  it("selectCurrent prioriza rascunho, depois publicada, depois a mais recente", () => {
    expect(selectCurrent(versions)?.id).toBe("v3");
    expect(selectCurrent([v("v2", 2, "PUBLISHED"), v("v1", 1, "ARCHIVED")])?.id).toBe("v2");
    expect(selectCurrent([v("v2", 2, "ARCHIVED"), v("v1", 1, "ARCHIVED")])?.id).toBe("v2");
    expect(selectCurrent([])).toBeNull();
  });

  it("histórico em ordem decrescente", () => {
    expect(sortVersionsDesc(versions).map((entry) => entry.versionNumber)).toEqual([3, 2, 1]);
  });
});

describe("status e transições (§4/§22)", () => {
  it("só DRAFT é editável", () => {
    expect(isEditable("DRAFT")).toBe(true);
    expect(isEditable("PUBLISHED")).toBe(false);
    expect(isEditable("ARCHIVED")).toBe(false);
  });

  it("DRAFT→PUBLISHED/ARCHIVED, PUBLISHED→ARCHIVED; ARCHIVED é final", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransition("DRAFT", "ARCHIVED")).toBe(true);
    expect(canTransition("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransition("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransition("DRAFT", "DRAFT")).toBe(false);
  });

  it("um rascunho por vez; plano arquivado não ganha versão", () => {
    expect(canCreateVersion([v("v1", 1, "PUBLISHED")], false)).toBe(true);
    expect(canCreateVersion([v("v1", 1, "PUBLISHED"), v("v2", 2, "DRAFT")], false)).toBe(false);
    expect(canCreateVersion([v("v1", 1, "PUBLISHED")], true)).toBe(false);
  });

  it("publicar pede confirmação só quando substitui a atual", () => {
    expect(publishReplacesCurrent([v("v1", 1, "DRAFT")])).toBe(false);
    expect(publishReplacesCurrent([v("v1", 1, "PUBLISHED"), v("v2", 2, "DRAFT")])).toBe(true);
  });
});

describe("publicação em memória (§72–§73)", () => {
  it("v1 publicada + nova versão => v1 continua publicada e v2 é DRAFT; publicar v2 arquiva v1", () => {
    const before = [v("v1", 1, "PUBLISHED", "2026-09-01T00:00:00Z"), v("v2", 2, "DRAFT")];
    expect(selectPublished(before)?.id).toBe("v1");
    const after = applyPublish(before, "v2", "2026-09-19T00:00:00Z");
    expect(after.find((entry) => entry.id === "v2")?.status).toBe("PUBLISHED");
    expect(after.find((entry) => entry.id === "v1")?.status).toBe("ARCHIVED");
    expect(after.filter((entry) => entry.status === "PUBLISHED")).toHaveLength(1);
    expect(after).toHaveLength(2);
  });

  it("publicar o que não é rascunho falha", () => {
    expect(() => applyPublish([v("v1", 1, "PUBLISHED")], "v1", "x")).toThrow("MEAL_PLAN_ALREADY_PUBLISHED");
  });
});
