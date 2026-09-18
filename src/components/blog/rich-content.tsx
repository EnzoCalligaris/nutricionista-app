import type { ReactNode } from "react";

/**
 * Renderizador mínimo e seguro do documento JSON do blog (formato
 * compatível com TipTap — docs/PROJECT_SPEC.md §5). Só nós conhecidos viram
 * elementos; qualquer coisa fora disso é ignorada. Nunca usa
 * dangerouslySetInnerHTML — texto sempre passa como children React, então
 * não há vetor de XSS por conteúdo vindo do banco (docs/SECURITY.md).
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: Node[];
};

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null;
}

function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  if (/^(https?:\/\/|mailto:|\/)/i.test(href)) return href;
  return null;
}

function renderText(node: Node, key: number): ReactNode {
  let element: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      element = href ? (
        <a href={href} rel="noopener" className="underline underline-offset-4">
          {element}
        </a>
      ) : (
        element
      );
    }
  }
  return <span key={key}>{element}</span>;
}

function renderChildren(nodes: Node[] | undefined): ReactNode[] {
  return (nodes ?? []).map((child, index) => renderNode(child, index));
}

function renderNode(node: Node, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{renderChildren(node.content)}</p>;
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
      const Tag = (level <= 2 ? "h2" : level === 3 ? "h3" : "h4") as "h2" | "h3" | "h4";
      return <Tag key={key}>{renderChildren(node.content)}</Tag>;
    }
    case "bulletList":
      return <ul key={key}>{renderChildren(node.content)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderChildren(node.content)}</ol>;
    case "listItem":
      return <li key={key}>{renderChildren(node.content)}</li>;
    case "blockquote":
      return <blockquote key={key}>{renderChildren(node.content)}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

export function richContentIsEmpty(content: unknown): boolean {
  if (!isNode(content)) return true;
  return !Array.isArray(content.content) || content.content.length === 0;
}

export function RichContent({ content }: { content: unknown }) {
  if (!isNode(content) || content.type !== "doc") return null;
  return <>{renderChildren(content.content)}</>;
}
