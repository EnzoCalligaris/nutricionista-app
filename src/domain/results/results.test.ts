import { describe, expect, it } from "vitest";
import { publicDisplayName, resultImageAlt } from "@/domain/results/display";
import { canPublish, isResultPubliclyVisible, publicationBlockers, resultState } from "@/domain/results/status";
import { MEDIA_CONSENT_DOCUMENT, MEDIA_CONSENT_LEGAL_REVIEW_PENDING, MEDIA_CONSENT_VERSION } from "@/domain/results/consent-document";
import { consentIdSchema, resultIdSchema } from "@/validators/results";

/** Resultados antes/depois (prompt Fase 14 §36/§69/§70/§85). */
describe("publicDisplayName", () => {
  it("anônimo nunca expõe nome", () => {
    expect(publicDisplayName("Maria Aparecida Souza", "ANONYMOUS")).toBeUndefined();
  });

  it("primeiro nome, iniciais e nome completo saem do nome REAL", () => {
    expect(publicDisplayName("Maria Aparecida Souza", "FIRST_NAME")).toBe("Maria");
    expect(publicDisplayName("Maria Aparecida Souza", "INITIALS")).toBe("M. A. S.");
    expect(publicDisplayName("Maria Aparecida Souza", "FULL_NAME")).toBe("Maria Aparecida Souza");
  });

  it("sem nome não inventa nada (§91)", () => {
    expect(publicDisplayName(null, "FIRST_NAME")).toBeUndefined();
    expect(publicDisplayName("   ", "INITIALS")).toBeUndefined();
    expect(publicDisplayName(undefined, "FULL_NAME")).toBeUndefined();
  });

  it("normaliza espaços extras", () => {
    expect(publicDisplayName("  João   Pedro  ", "INITIALS")).toBe("J. P.");
  });
});

describe("resultImageAlt", () => {
  it("tem alt genérico útil quando nada foi escrito (§85)", () => {
    expect(resultImageAlt("before", null)).toContain("antes");
    expect(resultImageAlt("after", null)).toContain("depois");
  });

  it("usa o alt do nutricionista e marca o momento", () => {
    expect(resultImageAlt("after", "Evolução corporal")).toBe("Evolução corporal — depois do acompanhamento");
  });

  it("não vaza nome nem medida por conta própria", () => {
    const alt = resultImageAlt("before", null);
    expect(alt).not.toMatch(/\d+\s?kg/i);
    expect(alt).not.toMatch(/IMC/i);
  });
});

describe("resultState", () => {
  const base = { published: false, archivedAt: null, beforePath: "r/b.webp", afterPath: "r/a.webp", hasValidConsent: true };

  it("rascunho sem fotos nem consentimento", () => {
    expect(resultState({ ...base, beforePath: null, afterPath: null, hasValidConsent: false })).toBe("DRAFT");
  });

  it("pronto para publicar com fotos + consentimento válido", () => {
    expect(resultState(base)).toBe("READY_TO_PUBLISH");
    expect(canPublish(base)).toBe(true);
  });

  it("publicado com consentimento válido é visível no site (§69)", () => {
    const published = { ...base, published: true };
    expect(resultState(published)).toBe("PUBLISHED");
    expect(isResultPubliclyVisible(published)).toBe(true);
  });

  it("consentimento revogado tira do site na hora, mesmo publicado (§31/§69)", () => {
    const revoked = { ...base, published: true, hasValidConsent: false };
    expect(resultState(revoked)).toBe("CONSENT_REVOKED");
    expect(isResultPubliclyVisible(revoked)).toBe(false);
  });

  it("arquivado nunca aparece (§37)", () => {
    const archived = { ...base, published: true, archivedAt: "2026-09-01T00:00:00Z" };
    expect(resultState(archived)).toBe("ARCHIVED");
    expect(isResultPubliclyVisible(archived)).toBe(false);
  });
});

describe("publicationBlockers", () => {
  it("diz exatamente o que falta (§70)", () => {
    const blockers = publicationBlockers({
      published: false,
      archivedAt: null,
      beforePath: null,
      afterPath: null,
      hasValidConsent: false,
    });
    expect(blockers).toHaveLength(3);
    expect(blockers.join(" ")).toContain("consentimento");
  });

  it("sem consentimento válido NUNCA é publicável (§70)", () => {
    const input = { published: false, archivedAt: null, beforePath: "b", afterPath: "a", hasValidConsent: false };
    expect(canPublish(input)).toBe(false);
    expect(publicationBlockers(input)).toHaveLength(1);
  });

  it("nada falta quando está tudo pronto", () => {
    expect(
      publicationBlockers({ published: false, archivedAt: null, beforePath: "b", afterPath: "a", hasValidConsent: true }),
    ).toEqual([]);
  });
});

describe("documento de consentimento", () => {
  it("é versionado e marcado como pendente de revisão jurídica (§88/§89)", () => {
    expect(MEDIA_CONSENT_VERSION).toBe("image_use_v1");
    expect(MEDIA_CONSENT_DOCUMENT.version).toBe(MEDIA_CONSENT_VERSION);
    expect(MEDIA_CONSENT_LEGAL_REVIEW_PENDING).toBe(true);
  });

  it("fala de revogação com efeito imediato e de armazenamento privado", () => {
    const text = MEDIA_CONSENT_DOCUMENT.clauses.join(" ").toLowerCase();
    expect(text).toContain("revogar");
    expect(text).toContain("privado");
  });

  it("não afirma conformidade jurídica plena (§89)", () => {
    const text = `${MEDIA_CONSENT_DOCUMENT.summary} ${MEDIA_CONSENT_DOCUMENT.clauses.join(" ")}`.toLowerCase();
    expect(text).not.toContain("em conformidade com a lgpd");
    expect(text).not.toContain("juridicamente aprovado");
  });
});

describe("ids dos resultados (mesma convenção de src/validators/patients.ts)", () => {
  it("aceita os ids do seed/migrations (z.guid, não z.uuid)", () => {
    const SEED_STYLE_ID = "90000000-0000-0000-0000-000000000010";
    expect(resultIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
    expect(consentIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
  });
});
