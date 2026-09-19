"use client";

import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABEL, WEEKDAY_SHORT } from "@/domain/meal-plans/definitions";
import { formatNutrient, formatQuantity, formatTimeOfDay } from "@/domain/meal-plans/quantities";
import type { Meal, MealItem, MealPlanDay } from "@/domain/meal-plans/structure";

/**
 * Visualização do plano (portal do paciente e versões publicadas/arquivadas
 * no dashboard — prompt Fase 8 §29–§32): abas de dia acessíveis (Radix
 * Tabs, teclado), refeições em cards, substituições em bloco expansível.
 * Nada de tabela; mobile-first.
 */
export function MealPlanView({ days, defaultDayId, showNutrients = false }: { days: MealPlanDay[]; defaultDayId: string | null; showNutrients?: boolean }) {
  if (days.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Esta versão ainda não tem dias cadastrados.</p>;
  }
  return (
    <Tabs defaultValue={defaultDayId ?? days[0]!.id} className="gap-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList aria-label="Dias da semana" className="w-max min-w-full sm:w-auto sm:min-w-0">
          {days.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="px-3">
              <span className="sm:hidden">{WEEKDAY_SHORT[day.weekday]}</span>
              <span className="hidden sm:inline">{WEEKDAY_LABEL[day.weekday]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="space-y-3">
          <h2 className="font-heading text-lg font-medium">{WEEKDAY_LABEL[day.weekday]}</h2>
          {day.notes ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{day.notes}</p> : null}
          {day.meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma refeição neste dia.</p>
          ) : (
            <ol className="space-y-3" aria-label={`Refeições de ${WEEKDAY_LABEL[day.weekday]}`}>
              {day.meals.map((meal, index) => (
                <MealCard key={meal.id} meal={meal} position={index + 1} showNutrients={showNutrients} />
              ))}
            </ol>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MealCard({ meal, position, showNutrients }: { meal: Meal; position: number; showNutrients: boolean }) {
  const time = formatTimeOfDay(meal.timeOfDay);
  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground tabular-nums">Refeição {String(position).padStart(2, "0")}</p>
          <h3 className="font-heading text-lg font-medium">{meal.name}</h3>
        </div>
        {time ? (
          <p className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm tabular-nums">
            <Clock className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Horário: </span>
            {time}
          </p>
        ) : null}
      </header>
      {meal.notes ? <p className="mt-2 text-sm text-muted-foreground">{meal.notes}</p> : null}
      {meal.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sem alimentos nesta refeição.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border" aria-label={`Alimentos de ${meal.name}`}>
          {meal.items.map((item) => (
            <ItemView key={item.id} item={item} showNutrients={showNutrients} />
          ))}
        </ul>
      )}
    </li>
  );
}

function nutrientLine(entity: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG?: number | null }): string | null {
  const parts = [
    formatNutrient(entity.calories, "kcal"),
    formatNutrient(entity.proteinG, "g prot."),
    formatNutrient(entity.carbsG, "g carb."),
    formatNutrient(entity.fatG, "g gord."),
    formatNutrient(entity.fiberG ?? null, "g fibra"),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function ItemView({ item, showNutrients }: { item: MealItem; showNutrients: boolean }) {
  const [open, setOpen] = useState(false);
  const nutrients = showNutrients ? nutrientLine(item) : null;
  const subsId = `subs-${item.id}`;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-medium">{item.foodName}</p>
        <p className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatQuantity(item.quantity, item.unit)}</p>
      </div>
      {item.notes ? <p className="mt-0.5 text-sm text-muted-foreground">{item.notes}</p> : null}
      {item.instructions ? (
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Preparo:</span> {item.instructions}
        </p>
      ) : null}
      {nutrients ? <p className="mt-0.5 text-xs text-muted-foreground">{nutrients}</p> : null}
      {item.substitutions.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-expanded={open}
            aria-controls={subsId}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown className={cn("size-4 transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
            {open ? "Ocultar substituições" : `Ver substituições (${item.substitutions.length})`}
          </button>
          {open ? (
            <ul id={subsId} className="mt-2 space-y-1.5 rounded-lg bg-muted/50 p-3" aria-label={`Substituições para ${item.foodName}`}>
              <li className="text-xs text-muted-foreground">No lugar de {item.foodName}, você pode usar:</li>
              {item.substitutions.map((substitution) => {
                const quantity = formatQuantity(substitution.quantity, substitution.unit);
                const subNutrients = showNutrients ? nutrientLine(substitution) : null;
                return (
                  <li key={substitution.id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{substitution.substituteFoodName}</span>
                      {quantity ? <span className="shrink-0 text-muted-foreground tabular-nums">{quantity}</span> : null}
                    </div>
                    {substitution.notes ? <p className="text-xs text-muted-foreground">{substitution.notes}</p> : null}
                    {subNutrients ? <p className="text-xs text-muted-foreground">{subNutrients}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
