import { describe, expect, it } from "vitest";
import { blogPostSchema, postIdSchema, resolveSlug } from "@/validators/blog";

/** Schema do post e SEO (prompt Fase 14 §41/§42/§65). */
const valid = {
  title: "Como montar o prato",
  slug: "",
  excerpt: "",
  content: "Conteúdo do post.",
  categoryId: null,
  seoTitle: "",
  metaDescription: "",
};

describe("blogPostSchema", () => {
  it("aceita post mínimo e transforma campo vazio em null", () => {
    const parsed = blogPostSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.excerpt).toBeNull();
      expect(parsed.data.seoTitle).toBeNull();
      expect(parsed.data.metaDescription).toBeNull();
    }
  });

  it("recusa título curto", () => {
    expect(blogPostSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
  });

  it("recusa slug com caractere inválido", () => {
    expect(blogPostSchema.safeParse({ ...valid, slug: "Com Espaço" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...valid, slug: "acentuação" }).success).toBe(false);
  });

  it("aceita slug válido e normaliza para minúsculas", () => {
    const parsed = blogPostSchema.safeParse({ ...valid, slug: "MEU-POST" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.slug).toBe("meu-post");
  });

  describe("limites de SEO (§41 — sem keyword stuffing)", () => {
    it("título de SEO até 70 caracteres", () => {
      expect(blogPostSchema.safeParse({ ...valid, seoTitle: "x".repeat(70) }).success).toBe(true);
      expect(blogPostSchema.safeParse({ ...valid, seoTitle: "x".repeat(71) }).success).toBe(false);
    });

    it("descrição de SEO até 180 caracteres", () => {
      expect(blogPostSchema.safeParse({ ...valid, metaDescription: "x".repeat(180) }).success).toBe(true);
      expect(blogPostSchema.safeParse({ ...valid, metaDescription: "x".repeat(181) }).success).toBe(false);
    });

    it("não existe campo de palavras-chave no schema", () => {
      const parsed = blogPostSchema.safeParse({ ...valid, keywords: "dieta, emagrecer, nutrição" } as never);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect("keywords" in parsed.data).toBe(false);
    });
  });

  it("recusa categoria que não é uuid", () => {
    expect(blogPostSchema.safeParse({ ...valid, categoryId: "nao-e-uuid" }).success).toBe(false);
  });
});

describe("resolveSlug", () => {
  it("usa o slug informado quando existe", () => {
    expect(resolveSlug({ slug: "meu-endereco", title: "Outro título" })).toEqual({ ok: true, slug: "meu-endereco" });
  });

  it("deriva do título quando o campo fica vazio", () => {
    expect(resolveSlug({ slug: "", title: "Hidratação: 5 dicas" })).toEqual({ ok: true, slug: "hidratacao-5-dicas" });
  });

  it("recusa quando o título não gera nenhum caractere aproveitável", () => {
    const result = resolveSlug({ slug: "", title: "!!!" });
    expect(result.ok).toBe(false);
  });
});

/**
 * Regressão: os ids do projeto (seed e migrations) usam a forma 8-4-4-4-12 sem
 * o nibble de versão RFC (ex.: 90000000-0000-0000-0000-000000000010). O
 * validador do Zod para isso é `z.guid()` — `z.uuid()` exige versão 1–8 e
 * recusaria esses ids, quebrando o formulário com "identificador inválido".
 * Mesma convenção de `src/validators/patients.ts`.
 */
describe("formato de id aceito pelos validadores da Fase 14", () => {
  const SEED_STYLE_ID = "90000000-0000-0000-0000-000000000010";

  it("aceita id no formato do seed/migrations", () => {
    expect(postIdSchema.safeParse(SEED_STYLE_ID).success).toBe(true);
    expect(blogPostSchema.safeParse({ ...valid, categoryId: SEED_STYLE_ID }).success).toBe(true);
  });

  it("continua recusando id malformado", () => {
    expect(postIdSchema.safeParse("90000000-0000-0000-0000").success).toBe(false);
    expect(postIdSchema.safeParse("não-é-id").success).toBe(false);
  });
});
