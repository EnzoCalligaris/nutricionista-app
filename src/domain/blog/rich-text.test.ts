import { describe, expect, it } from "vitest";
import { isRichTextEmpty, isSafeHref, parseRichText, richTextToPlainText, serializeRichText } from "@/domain/blog/rich-text";

/**
 * Conteúdo do post (prompt Fase 14 §40): sintaxe restrita → documento JSON de
 * nós conhecidos. HTML nunca é aceito como marcação.
 */
describe("parseRichText", () => {
  it("texto vazio gera documento vazio (não publicável)", () => {
    expect(isRichTextEmpty(parseRichText(""))).toBe(true);
    expect(isRichTextEmpty(parseRichText("   \n  "))).toBe(true);
  });

  it("parágrafos separados por linha vazia", () => {
    const doc = parseRichText("Primeiro.\n\nSegundo.");
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]!.type).toBe("paragraph");
  });

  it("títulos em h2/h3/h4", () => {
    const doc = parseRichText("## Dois\n\n### Três\n\n#### Quatro");
    expect(doc.content.map((node) => node.attrs?.level)).toEqual([2, 3, 4]);
  });

  it("lista com marcador e numerada", () => {
    const bullets = parseRichText("- um\n- dois");
    expect(bullets.content[0]!.type).toBe("bulletList");
    expect(bullets.content[0]!.content).toHaveLength(2);

    const ordered = parseRichText("1. um\n2. dois");
    expect(ordered.content[0]!.type).toBe("orderedList");
  });

  it("citação", () => {
    const doc = parseRichText("> alguém disse");
    expect(doc.content[0]!.type).toBe("blockquote");
  });

  it("negrito, itálico e link viram marks", () => {
    const doc = parseRichText("Texto **forte**, *leve* e [link](https://exemplo.com).");
    const marks = (doc.content[0]!.content ?? []).flatMap((node) => node.marks ?? []).map((mark) => mark.type);
    expect(marks).toContain("bold");
    expect(marks).toContain("italic");
    expect(marks).toContain("link");
  });

  describe("segurança (§40/§96)", () => {
    it("HTML vira TEXTO, nunca nó de marcação", () => {
      const doc = parseRichText('<script>alert("xss")</script>');
      expect(doc.content[0]!.type).toBe("paragraph");
      const plain = richTextToPlainText(doc);
      expect(plain).toContain("<script>");
      // Nenhum nó fora da lista conhecida foi criado.
      expect(JSON.stringify(doc)).not.toContain('"script"');
    });

    it("não produz nenhum tipo de nó fora da lista que o renderizador conhece", () => {
      const doc = parseRichText("## t\n\n- a\n\n1. b\n\n> c\n\nd **e** [f](https://x.com)");
      const allowed = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "text"]);
      const walk = (nodes: { type: string; content?: { type: string }[] }[]): void => {
        for (const node of nodes) {
          expect(allowed.has(node.type), node.type).toBe(true);
          if (node.content) walk(node.content as { type: string; content?: { type: string }[] }[]);
        }
      };
      walk(doc.content as { type: string; content?: { type: string }[] }[]);
    });

    it("link com protocolo perigoso NÃO vira link — fica texto literal", () => {
      for (const attack of ["javascript:alert(1)", "data:text/html,<script>", "//evil.example.com", "vbscript:x"]) {
        const doc = parseRichText(`veja [aqui](${attack})`);
        expect(JSON.stringify(doc), attack).not.toContain('"link"');
      }
    });

    it("isSafeHref aceita http(s), mailto e caminho interno; recusa o resto", () => {
      expect(isSafeHref("https://exemplo.com/a")).toBe(true);
      expect(isSafeHref("http://exemplo.com")).toBe(true);
      expect(isSafeHref("mailto:alguem@exemplo.com")).toBe(true);
      expect(isSafeHref("/blog/post")).toBe(true);
      expect(isSafeHref("javascript:alert(1)")).toBe(false);
      expect(isSafeHref("//evil.example.com")).toBe(false);
      expect(isSafeHref("https://exemplo.com/a\nmalicioso")).toBe(false);
    });
  });
});

describe("serializeRichText", () => {
  it("faz round-trip da sintaxe suportada", () => {
    const source = [
      "Parágrafo com **negrito** e *itálico*.",
      "",
      "## Subtítulo",
      "",
      "- primeiro",
      "- segundo",
      "",
      "1. um",
      "2. dois",
      "",
      "> citação",
      "",
      "Com [link](https://exemplo.com).",
    ].join("\n");

    expect(serializeRichText(parseRichText(source))).toBe(source);
  });

  it("documento inválido ou vazio serializa como string vazia", () => {
    expect(serializeRichText(null)).toBe("");
    expect(serializeRichText({ type: "paragraph" })).toBe("");
    expect(serializeRichText({ type: "doc", content: [] })).toBe("");
  });

  it("ignora nó desconhecido vindo do banco em vez de quebrar", () => {
    const doc = { type: "doc", content: [{ type: "iframe", attrs: { src: "https://evil" } }, { type: "paragraph", content: [{ type: "text", text: "ok" }] }] };
    expect(serializeRichText(doc)).toBe("ok");
  });
});

describe("richTextToPlainText", () => {
  it("junta o texto dos nós", () => {
    expect(richTextToPlainText(parseRichText("## Título\n\nCorpo do texto."))).toBe("Título Corpo do texto.");
  });
});
