import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renderiza o nome Método EM", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Método EM" })).toBeInTheDocument();
  });

  it("indica que a plataforma está em desenvolvimento (sem claims inventados)", () => {
    render(<HomePage />);
    expect(screen.getByText(/em desenvolvimento/i)).toBeInTheDocument();
  });

  it("não menciona preços nem depoimentos ainda (Fase 4 cuida disso)", () => {
    render(<HomePage />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/r\$\s?\d/i);
  });
});
