/**
 * Filtro puro de visibilidade pública de planos. A RLS (`plans_select_public`)
 * já impede que o site veja planos não públicos — este filtro é a segunda
 * camada, aplicada em memória, para que a regra de negócio esteja explícita
 * e testável sem banco (docs/PROJECT_SPEC.md §3: `active`, `publicly_visible`
 * e `available_for_sale` são flags independentes).
 */

export type PlanVisibilityFlags = {
  active: boolean;
  publicly_visible: boolean;
  available_for_sale: boolean;
};

export function isPubliclyListed<T extends PlanVisibilityFlags>(plan: T): boolean {
  return plan.active && plan.publicly_visible;
}

export function isSellable<T extends PlanVisibilityFlags>(plan: T): boolean {
  return isPubliclyListed(plan) && plan.available_for_sale;
}

export function filterPublicPlans<T extends PlanVisibilityFlags>(plans: T[]): T[] {
  return plans.filter(isPubliclyListed);
}

/** Ordem editorial fixa de exibição na página de planos. */
const DISPLAY_ORDER = ["AVULSA", "TRIMESTRAL", "SEMESTRAL"];

export function sortPlansForDisplay<T extends { code: string }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    const ia = DISPLAY_ORDER.indexOf(a.code);
    const ib = DISPLAY_ORDER.indexOf(b.code);
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
  });
}
