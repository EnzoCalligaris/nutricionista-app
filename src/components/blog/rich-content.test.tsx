import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichContent, richContentIsEmpty } from "@/components/blog/rich-content";

describe("RichContent", () => {
  it("renderiza parágrafos, títulos, listas e marcas", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Texto " },
            { type: "text", marks: [{ type: "bold" }], text: "forte" },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
      ],
    };
    const { container } = render(<RichContent content={doc} />);
    expect(container.querySelector("h2")?.textContent).toBe("Título");
    expect(container.querySelector("strong")?.textContent).toBe("forte");
    expect(container.querySelector("ul li")?.textContent).toBe("item");
  });

  it("nunca injeta HTML cru (texto é escapado)", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }] };
    const { container } = render(<RichContent content={doc} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("descarta links com scheme perigoso", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }], text: "x" }] }],
    };
    const { container } = render(<RichContent content={doc} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("ignora nós desconhecidos sem quebrar", () => {
    const doc = { type: "doc", content: [{ type: "iframe", attrs: { src: "https://evil.example" } }] };
    const { container } = render(<RichContent content={doc} />);
    expect(container.innerHTML).toBe("");
  });

  it("richContentIsEmpty detecta documento vazio", () => {
    expect(richContentIsEmpty({ type: "doc", content: [] })).toBe(true);
    expect(richContentIsEmpty(null)).toBe(true);
    expect(richContentIsEmpty({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
  });
});
