import { ExternalLink } from "@/components/shared/external-link";
import { formatSupplementPeriod } from "@/domain/patient-content/supplements";
import type { SupplementDetail } from "@/data/supplements";
import { formatCalendarDate } from "@/lib/dates";

/**
 * Card de recomendação no portal (prompt Fase 10 §15–§16/§72): nome,
 * orientação, dose, frequência, período, observação e "Ver produto" quando
 * houver link (nova aba, noopener/noreferrer). Texto puro — sem HTML.
 */
export function SupplementCard({ item }: { item: SupplementDetail }) {
  const period = formatSupplementPeriod(item.startsOn, item.endsOn, formatCalendarDate);
  return (
    <li className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="min-w-0">
        <h2 className="font-heading text-base font-medium break-words">{item.name}</h2>
        {item.brand ? <p className="text-sm text-muted-foreground break-words">{item.brand}</p> : null}
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {item.doseText ? (
          <div>
            <dt className="text-xs text-muted-foreground">Dose</dt>
            <dd className="break-words">{item.doseText}</dd>
          </div>
        ) : null}
        {item.scheduleText ? (
          <div>
            <dt className="text-xs text-muted-foreground">Frequência</dt>
            <dd className="break-words">{item.scheduleText}</dd>
          </div>
        ) : null}
        {period ? (
          <div>
            <dt className="text-xs text-muted-foreground">Período</dt>
            <dd>{period}</dd>
          </div>
        ) : null}
        {item.instructions ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Orientação do nutricionista</dt>
            <dd className="whitespace-pre-line break-words">{item.instructions}</dd>
          </div>
        ) : null}
        {item.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Observações</dt>
            <dd className="whitespace-pre-line break-words">{item.notes}</dd>
          </div>
        ) : null}
      </dl>
      {item.purchaseUrl ? (
        <div className="mt-3 min-w-0">
          <ExternalLink href={item.purchaseUrl} className="text-sm font-medium">
            Ver produto
          </ExternalLink>
        </div>
      ) : null}
    </li>
  );
}
