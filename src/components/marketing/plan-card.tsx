import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicPlan } from "@/data/plans";
import type { PriceView } from "@/domain/plans/pricing";

function planMeta(plan: PublicPlan): string[] {
  const meta: string[] = [];
  if (plan.durationMonths) meta.push(`${plan.durationMonths} meses de acompanhamento`);
  if (plan.sessionsInPerson) {
    meta.push(`${plan.sessionsInPerson} ${plan.sessionsInPerson === 1 ? "consulta presencial" : "consultas presenciais"}`);
  }
  if (plan.sessionsOnline) {
    meta.push(`${plan.sessionsOnline} ${plan.sessionsOnline === 1 ? "consulta online" : "consultas online"}`);
  }
  return meta;
}

function PriceOption({ price }: { price: PriceView }) {
  if (price.isReference) {
    return (
      <li className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground">
        <span>Valor de referência</span>
        <span className="tabular-nums">{price.total}</span>
      </li>
    );
  }
  if (price.installment) {
    return (
      <li className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Parcelado</span>
        <span className="tabular-nums">
          {price.installments}x de {price.installment}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">À vista</span>
      <span className="tabular-nums">{price.total}</span>
    </li>
  );
}

/**
 * Card de plano (prompt Fase 4 §22). Sem selos de "mais vendido"/"recomendado"
 * — nenhum foi definido pelo nutricionista. O preço em destaque só aparece
 * quando o banco marca `is_primary`; sem primário (TRIMESTRAL/SEMESTRAL,
 * PENDENTE DE DEFINIÇÃO), as opções são listadas lado a lado, nenhuma
 * eleita pelo site.
 */
export function PlanCard({ plan }: { plan: PublicPlan }) {
  const { primary, options, pendingPrimary } = plan.pricing;

  return (
    <article
      data-testid={`plan-${plan.code.toLowerCase()}`}
      className="flex h-full flex-col rounded-[1.5rem] border border-border bg-card p-7 sm:p-8"
    >
      <header>
        <h3 className="font-heading text-2xl font-medium">{plan.name}</h3>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {planMeta(plan).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </header>

      <div className="mt-6 border-t border-border pt-6">
        {primary ? (
          <>
            <p className="font-heading text-4xl font-medium tabular-nums">
              {primary.installment ? (
                <>
                  <span className="text-lg text-muted-foreground">{primary.installments}x de </span>
                  {primary.installment}
                </>
              ) : (
                primary.total
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {primary.installment
                ? `Total ${primary.total}`
                : primary.paymentType === "AVISTA"
                  ? "À vista"
                  : primary.label}
            </p>
            {options.length > 0 ? (
              <ul className="mt-4 space-y-1.5">
                {options.map((price) => (
                  <PriceOption key={price.id} price={price} />
                ))}
              </ul>
            ) : null}
          </>
        ) : pendingPrimary ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Opções de investimento
            </p>
            <ul className="mt-3 space-y-1.5">
              {options.map((price) => (
                <PriceOption key={price.id} price={price} />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Valores sob consulta.</p>
        )}
      </div>

      {plan.benefits.length > 0 ? (
        <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
          {plan.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
          Inclui uma consulta com o nutricionista. Não inclui consulta online adicional nem feedback
          entre consultas.
        </p>
      )}

      <div className="mt-auto pt-8">
        <Button asChild className="w-full" variant={primary ? "default" : "outline"}>
          <Link href={`/agendar?plano=${plan.code.toLowerCase()}`}>
            {plan.availableForSale ? "Quero começar" : "Falar sobre este plano"}
          </Link>
        </Button>
      </div>
    </article>
  );
}
