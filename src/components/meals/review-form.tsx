"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, Trash2, Undo2 } from "lucide-react";
import { confirmMealAnalysisAction, type ReviewFormState } from "@/actions/food-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { TotalsSummary } from "@/components/meals/meal-shared";
import { cn } from "@/lib/utils";
import { parseDecimalPtBr, toInputValue } from "@/domain/assessments/numbers";
import { FOOD_UNITS, FOOD_UNIT_LABEL, MAX_ITEMS, PREPARATION_LABEL, PREPARATION_METHODS, computeTotals, type AnalysisResult, type FoodUnit, type PreparationMethod } from "@/domain/food-analysis/estimates";

type Row = {
  key: string;
  id: string | null;
  name: string;
  quantity: string;
  unit: FoodUnit;
  preparation: PreparationMethod;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  removed: boolean;
  uncertain: boolean;
  source: "AI" | "PATIENT";
  /** Origem da adição rápida (§32): óleo, molho, acompanhamento. */
  hint?: string;
};

const QUICK_ADDS: { label: string; name: string; unit: FoodUnit; hint: string }[] = [
  { label: "+ Óleo / azeite", name: "Azeite", unit: "colher_sopa", hint: "Óleo ou azeite usado no preparo ou à mesa." },
  { label: "+ Molho", name: "Molho", unit: "colher_sopa", hint: "Molho, ketchup, maionese, shoyu..." },
  { label: "+ Acompanhamento", name: "", unit: "porcao", hint: "Item que a IA não detectou (bebida, sobremesa, farofa...)." },
];

const initialState: ReviewFormState = {};

function rowsFrom(result: AnalysisResult): Row[] {
  return result.items.map((item) => ({
    key: item.id,
    id: item.id,
    name: item.name,
    quantity: toInputValue(item.quantity),
    unit: item.unit,
    preparation: item.preparation,
    calories: toInputValue(item.calories),
    proteinG: toInputValue(item.proteinG),
    carbsG: toInputValue(item.carbsG),
    fatG: toInputValue(item.fatG),
    removed: false,
    uncertain: item.uncertain,
    source: item.source,
  }));
}

function numberOf(value: string): number {
  return parseDecimalPtBr(value) ?? 0;
}

/**
 * Etapa 3 — "Revise sua refeição" (prompt Fase 11 §32–§37): cada item da IA
 * é editável (alimento, quantidade, unidade, preparo, macros), pode ser
 * removido (e restaurado antes de confirmar) e o paciente adiciona itens —
 * óleo, molho e acompanhamentos com adições rápidas. Totais recalculados ao
 * vivo só com o que ficou; o original da IA não é tocado. Também usado para
 * corrigir uma refeição já confirmada (`mode="update"`).
 */
export function ReviewForm({ analysisId, source, mode, cancelHref, simulated }: { analysisId: string; source: AnalysisResult; mode: "confirm" | "update"; cancelHref: string; simulated: boolean }) {
  const action = confirmMealAnalysisAction.bind(null, analysisId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(source));
  const fieldErrors = state.fieldErrors ?? {};

  const totals = useMemo(
    () => computeTotals(rows.filter((row) => !row.removed).map((row) => ({ calories: numberOf(row.calories), proteinG: numberOf(row.proteinG), carbsG: numberOf(row.carbsG), fatG: numberOf(row.fatG) }))),
    [rows],
  );
  const activeCount = rows.filter((row) => !row.removed).length;

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function addRow(preset?: { name: string; unit: FoodUnit; hint: string }) {
    if (activeCount >= MAX_ITEMS) return;
    setRows((current) => [
      ...current,
      { key: `new-${Date.now()}-${current.length}`, id: null, name: preset?.name ?? "", quantity: "1", unit: preset?.unit ?? "g", preparation: "nao_informado", calories: "", proteinG: "", carbsG: "", fatG: "", removed: false, uncertain: false, source: "PATIENT", hint: preset?.hint },
    ]);
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="itemCount" value={rows.length} />

      <ul className="space-y-3" aria-label="Alimentos da refeição">
        {rows.map((row, index) => {
          const key = (field: string) => `item:${index}:${field}`;
          const err = (field: string) => (fieldErrors[key(field)] ? <p className="text-xs text-destructive">{fieldErrors[key(field)]}</p> : null);
          return (
            <li key={row.key} className={cn("rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4", row.removed && "opacity-60")}>
              <input type="hidden" name={key("id")} value={row.id ?? ""} />
              <input type="hidden" name={key("removed")} value={row.removed ? "1" : "0"} />
              {row.removed ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="line-through">{row.name || "Item"}</span> <span className="text-xs text-muted-foreground">removido</span>
                  </p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => update(index, { removed: false })}>
                    <Undo2 data-icon="inline-start" />
                    Restaurar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor={`${id}-${index}-name`}>Alimento</Label>
                      <Input id={`${id}-${index}-name`} name={key("name")} value={row.name} maxLength={120} onChange={(event) => update(index, { name: event.target.value })} aria-invalid={fieldErrors[key("name")] ? true : undefined} placeholder="Ex.: Arroz integral" />
                      {err("name")}
                    </div>
                    <Button type="button" size="icon-xs" variant="ghost" className="mt-6 shrink-0" aria-label={`Remover ${row.name || "item"}`} onClick={() => update(index, { removed: true })}>
                      <Trash2 />
                    </Button>
                  </div>
                  {row.uncertain ? (
                    <p className="flex items-center gap-1 text-xs text-warning-foreground">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      A IA marcou este item como incerto — confira a quantidade.
                    </p>
                  ) : null}
                  {row.hint ? <p className="text-xs text-muted-foreground">{row.hint}</p> : null}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${index}-qty`}>Quantidade</Label>
                      <Input id={`${id}-${index}-qty`} name={key("quantity")} inputMode="decimal" value={row.quantity} onChange={(event) => update(index, { quantity: event.target.value })} aria-invalid={fieldErrors[key("quantity")] ? true : undefined} className="font-mono" />
                      {err("quantity")}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-${index}-unit`}>Unidade</Label>
                      <NativeSelect id={`${id}-${index}-unit`} name={key("unit")} value={row.unit} onChange={(event) => update(index, { unit: event.target.value as FoodUnit })}>
                        {FOOD_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {FOOD_UNIT_LABEL[unit]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label htmlFor={`${id}-${index}-prep`}>Preparo</Label>
                      <NativeSelect id={`${id}-${index}-prep`} name={key("preparation")} value={row.preparation} onChange={(event) => update(index, { preparation: event.target.value as PreparationMethod })}>
                        {PREPARATION_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {PREPARATION_LABEL[method]}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(
                      [
                        ["calories", "kcal (est.)"],
                        ["proteinG", "Proteína g"],
                        ["carbsG", "Carbo g"],
                        ["fatG", "Gordura g"],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <Label htmlFor={`${id}-${index}-${field}`}>{label}</Label>
                        <Input id={`${id}-${index}-${field}`} name={key(field)} inputMode="decimal" value={row[field]} onChange={(event) => update(index, { [field]: event.target.value })} aria-invalid={fieldErrors[key(field)] ? true : undefined} className="font-mono" />
                        {err(field)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <p className="text-sm font-medium">A foto não mostra tudo — confirme o que faltou:</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ADDS.map((preset) => (
            <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => addRow(preset)} disabled={activeCount >= MAX_ITEMS}>
              {preset.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => addRow()} disabled={activeCount >= MAX_ITEMS}>
            <Plus data-icon="inline-start" />
            Outro item
          </Button>
        </div>
      </div>

      <section aria-labelledby={`${id}-totals-h`} className="space-y-2 rounded-xl border border-border p-4">
        <h2 id={`${id}-totals-h`} className="font-heading text-base font-medium">
          Totais estimados ({activeCount} {activeCount === 1 ? "item" : "itens"})
        </h2>
        <TotalsSummary totals={totals} />
        <p className="text-xs text-muted-foreground">Recalculados automaticamente com os itens acima.{simulated ? " Estimativa simulada (ambiente de demonstração)." : ""}</p>
      </section>

      {fieldErrors.form ? (
        <p role="alert" className="text-sm text-destructive">
          {fieldErrors.form}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isPending || activeCount === 0}>
          {isPending ? "Salvando..." : mode === "update" ? "Salvar correção" : "Confirmar refeição"}
        </Button>
      </div>
    </form>
  );
}
