import { describe, expect, it } from "vitest";
import { isValidSlug, slugChangeWarning, slugify } from "@/domain/blog/slug";

/** Slug de post (prompt Fase 14 §42/§65/§72). */
describe("slugify", () => {
  it("remove acento, pontuação e normaliza para minúsculas com hífen", () => {
    expect(slugify("Como montar o prato — nutrição descomplicada!")).toBe("como-montar-o-prato-nutricao-descomplicada");
    expect(slugify("Hidratação: 5 dicas")).toBe("hidratacao-5-dicas");
    expect(slugify("Ação & Reação")).toBe("acao-reacao");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugify("  --- teste ---  ")).toBe("teste");
  });

  it("título sem caractere aproveitável gera slug vazio (recusado depois)", () => {
    expect(slugify("!!!")).toBe("");
    expect(isValidSlug(slugify("!!!"))).toBe(false);
  });

  it("limita o tamanho sem terminar em hífen", () => {
    const slug = slugify("palavra ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(90);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("aceita só minúsculas, números e hífen simples", () => {
    expect(isValidSlug("como-montar-o-prato")).toBe(true);
    expect(isValidSlug("post-2026")).toBe(true);
  });

  it("recusa maiúscula, espaço, acento, hífen duplo e barra", () => {
    for (const bad of ["Post", "dois termos", "nutrição", "a--b", "a/b", "-a", "a-", ""]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
  });
});

describe("slugChangeWarning", () => {
  it("avisa quando o endereço de um post PUBLICADO muda (§42)", () => {
    const warning = slugChangeWarning("antigo", "novo", true);
    expect(warning).toContain("/blog/antigo");
    expect(warning).toContain("/blog/novo");
  });

  it("não avisa em rascunho (nunca teve URL) nem quando o slug não mudou", () => {
    expect(slugChangeWarning("antigo", "novo", false)).toBeNull();
    expect(slugChangeWarning("igual", "igual", true)).toBeNull();
  });
});
