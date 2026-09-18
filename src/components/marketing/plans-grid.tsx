import { PlanCard } from "@/components/marketing/plan-card";
import type { PublicPlan } from "@/data/plans";
import type { QueryResult } from "@/data/safe-query";

/**
 * Grade de planos com estados honestos: erro de banco (conteúdo indisponível),
 * lista vazia, ou os cards. A Home e /planos usam o mesmo componente.
 */
export function PlansGrid({ plans }: { plans: QueryResult<PublicPlan[]> }) {
  if (!plans.ok) {
    return (
      <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Os planos estão temporariamente indisponíveis. Tente novamente em instantes ou fale com a gente
        pela página de contato.
      </p>
    );
  }

  if (plans.data.length === 0) {
    return (
      <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum plano publicado no momento.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.data.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
