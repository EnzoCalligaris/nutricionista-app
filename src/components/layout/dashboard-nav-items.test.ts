import { describe, expect, it } from "vitest";
import { dashboardNavItems } from "@/components/layout/dashboard-nav-items";
import { patientNavItems } from "@/components/layout/patient-nav-items";

describe("dashboardNavItems", () => {
  it("tem os 12 itens definidos em docs/PROJECT_SPEC.md §6 + Notificações (Fase 12)", () => {
    expect(dashboardNavItems).toHaveLength(13);
    expect(dashboardNavItems.map((item) => item.title)).toContain("Notificações");
  });

  it("não tem hrefs duplicados", () => {
    const hrefs = dashboardNavItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("não oferece 'grupo exclusivo' em nenhum item (removido por decisão de produto)", () => {
    const titles = dashboardNavItems.map((item) => item.title.toLowerCase());
    expect(titles.some((t) => t.includes("grupo exclusivo"))).toBe(false);
  });
});

describe("patientNavItems", () => {
  it("tem os 8 itens definidos em docs/PROJECT_SPEC.md §7 + Refeições (Fase 11) + Notificações (Fase 12) + Pagamentos (Fase 13)", () => {
    expect(patientNavItems).toHaveLength(11);
    expect(patientNavItems.map((item) => item.title)).toContain("Refeições");
    expect(patientNavItems.map((item) => item.title)).toContain("Notificações");
    expect(patientNavItems.map((item) => item.title)).toContain("Pagamentos");
  });

  it("não tem hrefs duplicados e todos começam com /paciente", () => {
    const hrefs = patientNavItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith("/paciente"))).toBe(true);
  });
});
