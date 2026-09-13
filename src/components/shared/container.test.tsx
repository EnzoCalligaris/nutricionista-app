import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Container } from "@/components/shared/container";

describe("Container", () => {
  it("renderiza os filhos", () => {
    render(<Container>conteúdo</Container>);
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("mescla className customizada com as classes padrão", () => {
    render(<Container className="custom-class">conteúdo</Container>);
    const el = screen.getByText("conteúdo");
    expect(el).toHaveClass("custom-class");
    expect(el).toHaveClass("mx-auto");
  });
});
