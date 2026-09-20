import { AlertTriangle, ArrowRight } from "lucide-react";
import { TotalsSummary } from "@/components/meals/meal-shared";
import { CHANGE_FIELD_LABEL, FOOD_UNIT_LABEL, PREPARATION_LABEL, diffResults, formatGrams, formatKcal, formatQuantity, type AnalysisResult, type ChangedField, type FoodItem } from "@/domain/food-analysis/estimates";
import { cn } from "@/lib/utils";

function ItemList({ items, ariaLabel, viewer }: { items: FoodItem[]; ariaLabel: string; viewer: "patient" | "nutritionist" }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum alimento identificado.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium break-words">
              {item.name}
              {item.source === "PATIENT" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">{viewer === "patient" ? "adicionado por você" : "adicionado pelo paciente"}</span> : null}
              {item.uncertain ? (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-warning-foreground">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  incerto
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatQuantity(item.quantity, item.unit)}
              {item.preparation !== "nao_informado" ? ` · ${PREPARATION_LABEL[item.preparation]}` : ""}
            </p>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">{formatKcal(item.calories)}</span> · P {formatGrams(item.proteinG)} · C {formatGrams(item.carbsG)} · G {formatGrams(item.fatG)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Leitura da refeição (prompt Fase 11 §39/§43): versão CONFIRMADA em
 * destaque ("Estimativa revisada pelo paciente"), e o que a IA estimou
 * originalmente como informação secundária, com as diferenças por item
 * (adicionado / removido / alterado) — sem nota, score ou julgamento (§44).
 */
export function MealResultView({ original, confirmed, viewer, className }: { original: AnalysisResult | null; confirmed: AnalysisResult | null; viewer: "patient" | "nutritionist"; className?: string }) {
  const primary = confirmed ?? original;
  if (!primary) return null;
  const changes = original && confirmed ? diffResults(original, confirmed) : [];
  const you = viewer === "patient" ? "você" : "o paciente";

  return (
    <div className={cn("space-y-6", className)}>
      <section aria-labelledby="itens-h" className="space-y-3">
        <div>
          <h2 id="itens-h" className="font-heading text-lg font-medium">
            {confirmed ? "Refeição confirmada" : "Estimativa da IA"}
          </h2>
          <p className="text-sm text-muted-foreground">{confirmed ? `Estimativa revisada ${viewer === "patient" ? "por você" : "pelo paciente"}.` : "Ainda não revisada."}</p>
        </div>
        <ItemList items={primary.items} ariaLabel={confirmed ? "Alimentos confirmados" : "Alimentos estimados"} viewer={viewer} />
        <TotalsSummary totals={primary.totals} label="Totais estimados" />
      </section>

      {confirmed && original ? (
        <details className="group rounded-xl border border-border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
            O que a IA estimou inicialmente
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {changes.length === 0
                ? `(nenhuma alteração ${viewer === "patient" ? "sua" : "do paciente"})`
                : `(${changes.length} ${changes.length === 1 ? "alteração" : "alterações"} ${viewer === "patient" ? (changes.length === 1 ? "sua" : "suas") : "do paciente"})`}
            </span>
          </summary>
          <div className="space-y-4 border-t border-border px-4 py-4">
            {changes.length > 0 ? (
              <ul className="space-y-1 text-sm" aria-label="Diferenças entre a IA e a versão confirmada">
                {changes.map((change, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-1">
                    {change.kind === "ADDED" ? (
                      <>
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">adicionado</span> {change.item.name} ({formatQuantity(change.item.quantity, change.item.unit)})
                      </>
                    ) : change.kind === "REMOVED" ? (
                      <>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">removido</span> {change.item.name}
                      </>
                    ) : (
                      <>
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning-foreground">alterado</span> {change.before.name}:{" "}
                        {change.fields.map((field, position) => (
                          <span key={field} className="inline-flex items-center gap-1 text-muted-foreground">
                            {position > 0 ? "· " : ""}
                            {CHANGE_FIELD_LABEL[field]} {describe(change.before, field)} <ArrowRight className="size-3" aria-hidden="true" /> {describe(change.after, field)}
                          </span>
                        ))}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <ItemList items={original.items} ariaLabel="Alimentos estimados pela IA" viewer={viewer} />
            <TotalsSummary totals={original.totals} label="Totais estimados pela IA" />
            {original.ambiguities.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">A IA sinalizou:</p>
                <ul className="list-disc pl-5">
                  {original.ambiguities.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Comparação informativa: mostra o que {you} alterou — não é uma avaliação da refeição.</p>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function describe(item: FoodItem, field: ChangedField): string {
  switch (field) {
    case "name":
      return item.name;
    case "quantity":
      return formatQuantity(item.quantity, item.unit);
    case "unit":
      return FOOD_UNIT_LABEL[item.unit];
    case "preparation":
      return PREPARATION_LABEL[item.preparation];
    case "calories":
      return formatKcal(item.calories);
    case "proteinG":
      return formatGrams(item.proteinG);
    case "carbsG":
      return formatGrams(item.carbsG);
    case "fatG":
      return formatGrams(item.fatG);
    default:
      return "";
  }
}
