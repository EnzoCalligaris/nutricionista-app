/**
 * Conversão entre o texto que o nutricionista escreve no editor e o
 * DOCUMENTO JSON do post (formato compatível com TipTap, o mesmo que
 * `src/components/blog/rich-content.tsx` já renderiza desde a Fase 4).
 *
 * Por que não HTML (prompt Fase 14 §40): o conteúdo nunca é aceito como
 * marcação crua. A aplicação lê uma sintaxe restrita, monta um nó por vez e
 * só emite tipos de nó que o renderizador conhece — o renderizador, por sua
 * vez, nunca usa `dangerouslySetInnerHTML`. Não existe caminho para injetar
 * tag, atributo ou script: o que não casa com a sintaxe vira texto comum.
 *
 * Sintaxe suportada (documentada na própria tela):
 *   ## / ### / ####  título (h2/h3/h4)
 *   -                item de lista
 *   1.               item de lista numerada
 *   >                citação
 *   linha vazia      separa parágrafos
 *   **negrito**  *itálico*  [texto](https://…)
 */

export type RichTextMark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type RichTextNode = {
  type: string;
  text?: string;
  marks?: RichTextMark[];
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
};
export type RichTextDoc = { type: "doc"; content: RichTextNode[] };

export const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

/** Mesma regra do renderizador: http(s), mailto e caminho interno. */
export function isSafeHref(href: string): boolean {
  if (href.includes("\n") || href.includes("\r") || /[\u0000-\u001f\u007f]/.test(href)) return false;
  if (/^https?:\/\/[^\s/]+/i.test(href)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return true;
  // Interno: "/blog/algo". "//host" seria protocol-relative — recusado.
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(href)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Texto → documento
// ---------------------------------------------------------------------------

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;

function textNode(text: string, marks?: RichTextMark[]): RichTextNode {
  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

function parseInline(raw: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(INLINE_PATTERN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(textNode(raw.slice(lastIndex, start)));

    if (token.startsWith("**")) {
      nodes.push(textNode(token.slice(2, -2), [{ type: "bold" }]));
    } else if (token.startsWith("*")) {
      nodes.push(textNode(token.slice(1, -1), [{ type: "italic" }]));
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
      if (linkMatch && isSafeHref(linkMatch[2]!)) {
        nodes.push(textNode(linkMatch[1]!, [{ type: "link", attrs: { href: linkMatch[2]! } }]));
      } else {
        // Link inválido/inseguro NÃO vira link: fica texto literal.
        nodes.push(textNode(token));
      }
    }
    lastIndex = start + token.length;
  }

  if (lastIndex < raw.length) nodes.push(textNode(raw.slice(lastIndex)));
  return nodes.filter((node) => (node.text ?? "").length > 0);
}

function paragraph(raw: string): RichTextNode {
  return { type: "paragraph", content: parseInline(raw) };
}

type PendingList = { type: "bulletList" | "orderedList"; items: RichTextNode[] } | null;

export function parseRichText(source: string): RichTextDoc {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const content: RichTextNode[] = [];
  let list: PendingList = null;
  let quote: string[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    buffer = [];
    if (text) content.push(paragraph(text));
  };
  const flushList = () => {
    if (!list) return;
    content.push({ type: list.type, content: list.items });
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    const text = quote.join(" ").trim();
    quote = [];
    if (text) content.push({ type: "blockquote", content: [paragraph(text)] });
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      content.push({
        type: "heading",
        attrs: { level: heading[1]!.length },
        content: parseInline(heading[2]!.trim()),
      });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (list && list.type !== "bulletList") flushList();
      list ??= { type: "bulletList", items: [] };
      list.items.push({ type: "listItem", content: [paragraph(bullet[1]!.trim())] });
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (list && list.type !== "orderedList") flushList();
      list ??= { type: "orderedList", items: [] };
      list.items.push({ type: "listItem", content: [paragraph(ordered[1]!.trim())] });
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]!.trim());
      continue;
    }

    flushList();
    flushQuote();
    buffer.push(line.trim());
  }

  flushAll();
  return { type: "doc", content };
}

// ---------------------------------------------------------------------------
// Documento → texto (para reabrir no editor)
// ---------------------------------------------------------------------------

function serializeInline(nodes: RichTextNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      const text = node.text ?? "";
      if (!text) return "";
      const marks = node.marks ?? [];
      const link = marks.find((mark): mark is Extract<RichTextMark, { type: "link" }> => mark.type === "link");
      let out = text;
      if (marks.some((mark) => mark.type === "bold")) out = `**${out}**`;
      if (marks.some((mark) => mark.type === "italic")) out = `*${out}*`;
      if (link) out = `[${out}](${link.attrs.href})`;
      return out;
    })
    .join("");
}

function serializeBlock(node: RichTextNode): string[] {
  switch (node.type) {
    case "paragraph":
      return [serializeInline(node.content)];
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? Math.min(Math.max(node.attrs.level, 2), 4) : 2;
      return [`${"#".repeat(level)} ${serializeInline(node.content)}`];
    }
    case "bulletList":
      return (node.content ?? []).map((item) => `- ${serializeInline(item.content?.[0]?.content)}`);
    case "orderedList":
      return (node.content ?? []).map((item, index) => `${index + 1}. ${serializeInline(item.content?.[0]?.content)}`);
    case "blockquote":
      return (node.content ?? []).map((child) => `> ${serializeInline(child.content)}`);
    default:
      return [];
  }
}

export function serializeRichText(doc: unknown): string {
  if (typeof doc !== "object" || doc === null) return "";
  const root = doc as RichTextNode;
  if (root.type !== "doc" || !Array.isArray(root.content)) return "";

  const blocks: string[] = [];
  for (const node of root.content) {
    const lines = serializeBlock(node).filter((line) => line.length > 0);
    if (lines.length > 0) blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

/** Documento vazio não pode ser publicado (§39). */
export function isRichTextEmpty(doc: RichTextDoc): boolean {
  return doc.content.length === 0;
}

/** Texto puro do documento — usado para gerar resumo/contagem. */
export function richTextToPlainText(doc: RichTextDoc): string {
  const walk = (nodes: RichTextNode[] | undefined): string[] =>
    (nodes ?? []).flatMap((node) => (node.text ? [node.text] : walk(node.content)));
  return walk(doc.content).join(" ").replace(/\s+/g, " ").trim();
}
