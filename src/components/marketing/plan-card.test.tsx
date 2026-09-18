import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCard } from "@/components/marketing/plan-card";
import { presentPlanPrices } from "@/domain/plans/pricing";
import type { PublicPlan } from "@/data/plans";

const avulsa: PublicPlan = {
  id: "a",
  code: "AVULSA",
  name: "Consulta Avulsa",
  durationMonths: null,
  sessionsInPerson: 1,
  sessionsOnline: 0,
  availableForSale: true,
  benefits: [],
  pricing: presentPlanPrices([
    { id: "p1", label: "Consulta avulsa", amount_cents: 23000, installments: 1, payment_type: "AVISTA", is_primary: true, active: true },
  ]),
};

const trimestral: PublicPlan = {
  id: "t",
  code: "TRIMESTRAL",
  name: "Plano Trimestral",
  durationMonths: 3,
  sessionsInPerson: 3,
  sessionsOnline: 2,
  availableForSale: true,
  benefits: ["Planejamento alimentar", "Suporte de segunda a sábado (08h–18h)"],
  pricing: presentPlanPrices([
    { id: "r", label: "Valor cheio (de)", amount_cents: 105000, installments: 1, payment_type: "REFERENCIA", is_primary: false, active: true },
    { id: "p", label: "Parcelado", amount_cents: 68037, installments: 3, payment_type: "PARCELADO", is_primary: false, active: true },
    { id: "v", label: "À vista", amount_cents: 60000, installments: 1, payment_type: "AVISTA", is_primary: false, active: true },
  ]),
};

describe("PlanCard", () => {
  it("consulta avulsa mostra R$ 230 em destaque e explica o que não inclui", () => {
    render(<PlanCard plan={avulsa} />);
    expect(screen.getByText(/R\$\s?230,00/)).toBeInTheDocument();
    expect(screen.getByText(/1 consulta presencial/)).toBeInTheDocument();
    expect(screen.getByText(/Não inclui consulta online adicional nem feedback/)).toBeInTheDocument();
  });

  it("trimestral sem preço primário lista as opções sem eleger uma", () => {
    render(<PlanCard plan={trimestral} />);
    expect(screen.getByText(/Opções de investimento/i)).toBeInTheDocument();
    expect(screen.getByText(/3x de R\$\s?226,79/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?600,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?1\.050,00/)).toBeInTheDocument();
    // Nenhum valor em destaque (o preço grande só existe com is_primary).
    expect(document.querySelector(".text-4xl")).toBeNull();
  });

  it("mostra duração e split presencial/online", () => {
    render(<PlanCard plan={trimestral} />);
    expect(screen.getByText("3 meses de acompanhamento")).toBeInTheDocument();
    expect(screen.getByText("3 consultas presenciais")).toBeInTheDocument();
    expect(screen.getByText("2 consultas online")).toBeInTheDocument();
  });

  it("não usa selos de 'mais vendido' / 'recomendado'", () => {
    render(<PlanCard plan={trimestral} />);
    expect(document.body.textContent).not.toMatch(/mais vendido|melhor escolha|recomendado/i);
  });

  it("CTA leva para o agendamento com o plano na query", () => {
    render(<PlanCard plan={trimestral} />);
    expect(screen.getByRole("link", { name: /Quero começar/ })).toHaveAttribute("href", "/agendar?plano=trimestral");
  });
});
