import { describe, expect, it } from "vitest";
import { dashboardNavItems } from "@/components/layout/dashboard-nav-items";
import { patientNavItems } from "@/components/layout/patient-nav-items";

describe("dashboardNavItems", () => {
  it("tem os 12 itens definidos em docs/PROJECT_SPEC.md §6", () => {
    expect(dashboardNavItems).toHaveLength(12);
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
  it("tem os 8 itens definidos em docs/PROJECT_SPEC.md §7", () => {
    expect(patientNavItems).toHaveLength(8);
  });

  it("não tem hrefs duplicados e todos começam com /paciente", () => {
    const hrefs = patientNavItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith("/paciente"))).toBe(true);
  });
});
