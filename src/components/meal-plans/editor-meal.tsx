"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { EMPTY_ITEM, EMPTY_SUBSTITUTION, ItemForm, MealForm, SubstitutionForm } from "@/components/meal-plans/editor-forms";
import { formatNutrient, formatQuantity, formatTimeOfDay } from "@/domain/meal-plans/quantities";
import { WEEKDAY_LABEL } from "@/domain/meal-plans/definitions";
import type { Meal, MealItem, MealPlanDay, MealSubstitution } from "@/domain/meal-plans/structure";
import type { EditorResult, MealItemFormInput, SubstitutionFormInput } from "@/actions/meal-plans";
import {
  addMealItemAction,
  addSubstitutionAction,
  duplicateMealAction,
  moveMealAction,
  moveMealItemAction,
  removeMealAction,
  removeMealItemAction,
  removeSubstitutionAction,
  updateMealAction,
  updateMealItemAction,
  updateSubstitutionAction,
} from "@/actions/meal-plans";

export type EditorContext = {
  patientId: string;
  versionId: string;
  /** Executa uma action, mostra toast/erros e recarrega os dados do servidor. */
  run: (fn: () => Promise<EditorResult>, success: string) => Promise<EditorResult>;
  pending: boolean;
};

const numberText = (value: number | null) => (value == null ? "" : String(value).replace(".", ","));

function itemToForm(item: MealItem): MealItemFormInput {
  return {
    foodName: item.foodName,
    quantity: numberText(item.quantity),
    unit: item.unit,
    calories: numberText(item.calories),
    proteinG: numberText(item.proteinG),
    carbsG: numberText(item.carbsG),
    fatG: numberText(item.fatG),
    fiberG: numberText(item.fiberG),
    instructions: item.instructions ?? "",
    notes: item.notes ?? "",
  };
}

function substitutionToForm(substitution: MealSubstitution): SubstitutionFormInput {
  return {
    substituteFoodName: substitution.substituteFoodName,
    quantity: numberText(substitution.quantity),
    unit: substitution.unit ?? "",
    calories: numberText(substitution.calories),
    proteinG: numberText(substitution.proteinG),
    carbsG: numberText(substitution.carbsG),
    fatG: numberText(substitution.fatG),
    notes: substitution.notes ?? "",
  };
}

function NutrientLine({ entity }: { entity: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG?: number | null } }) {
  const parts = [
    formatNutrient(entity.calories, "kcal"),
    formatNutrient(entity.proteinG, "g prot."),
    formatNutrient(entity.carbsG, "g carb."),
    formatNutrient(entity.fatG, "g gord."),
    formatNutrient(entity.fiberG ?? null, "g fibra"),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

function SubstitutionRow({ substitution, ctx }: { substitution: MealSubstitution; ctx: EditorContext }) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);

  if (editing) {
    return (
      <SubstitutionForm
        initial={substitutionToForm(substitution)}
        submitLabel="Salvar substituição"
        pending={ctx.pending}
        errors={errors}
        onCancel={() => setEditing(false)}
        onSubmit={async (values) => {
          const result = await ctx.run(() => updateSubstitutionAction(substitution.id, ctx.patientId, ctx.versionId, { ...values, expectedUpdatedAt: substitution.updatedAt }), "Substituição atualizada.");
          if (result.ok) setEditing(false);
          else setErrors(result.fieldErrors ?? {});
        }}
      />
    );
  }

  const quantity = formatQuantity(substitution.quantity, substitution.unit);
  return (
    <li className="flex items-start justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border">
      <div className="min-w-0">
        <p>
          <span className="font-medium">{substitution.substituteFoodName}</span>
          {quantity ? <span className="text-muted-foreground"> · {quantity}</span> : null}
        </p>
        {substitution.notes ? <p className="text-xs text-muted-foreground">{substitution.notes}</p> : null}
        <NutrientLine entity={substitution} />
      </div>
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon-sm" aria-label={`Editar substituição ${substitution.substituteFoodName}`} onClick={() => setEditing(true)} disabled={ctx.pending}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remover substituição ${substitution.substituteFoodName}`} onClick={() => setConfirm(true)} disabled={ctx.pending}>
          <Trash2 />
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a substituição?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{substitution.substituteFoodName}&rdquo; deixa de ser uma alternativa para este alimento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void ctx.run(() => removeSubstitutionAction(substitution.id, ctx.patientId, ctx.versionId), "Substituição removida.").then(() => setConfirm(false));
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function ItemRow({ item, position, total, ctx }: { item: MealItem; position: number; total: number; ctx: EditorContext }) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [showSubs, setShowSubs] = useState(item.substitutions.length > 0);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      {editing ? (
        <ItemForm
          initial={itemToForm(item)}
          submitLabel="Salvar alimento"
          pending={ctx.pending}
          errors={errors}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const result = await ctx.run(() => updateMealItemAction(item.id, ctx.patientId, ctx.versionId, { ...values, expectedUpdatedAt: item.updatedAt }), "Alimento atualizado.");
            if (result.ok) setEditing(false);
            else setErrors(result.fieldErrors ?? {});
          }}
        />
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {item.foodName}
              <span className="block font-normal text-muted-foreground sm:inline sm:before:content-['_·_']">{formatQuantity(item.quantity, item.unit)}</span>
            </p>
            {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
            {item.instructions ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Preparo:</span> {item.instructions}
              </p>
            ) : null}
            <NutrientLine entity={item} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end">
            <Button variant="ghost" size="icon-sm" aria-label={`Subir ${item.foodName}`} disabled={ctx.pending || position === 0} onClick={() => void ctx.run(() => moveMealItemAction(item.id, ctx.patientId, ctx.versionId, "up"), "Ordem atualizada.")}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Descer ${item.foodName}`} disabled={ctx.pending || position === total - 1} onClick={() => void ctx.run(() => moveMealItemAction(item.id, ctx.patientId, ctx.versionId, "down"), "Ordem atualizada.")}>
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${item.foodName}`} disabled={ctx.pending} onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remover ${item.foodName}`} disabled={ctx.pending} onClick={() => setConfirm(true)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      )}

      <div className="mt-2 space-y-2 border-t border-dashed border-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showSubs}
            onClick={() => setShowSubs((value) => !value)}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showSubs ? "rotate-180" : "")} aria-hidden="true" />
            {item.substitutions.length === 0 ? "Sem substituições" : `${item.substitutions.length} substituição(ões)`}
          </button>
          {!adding ? (
            <Button variant="outline" size="xs" disabled={ctx.pending} onClick={() => { setAdding(true); setShowSubs(true); }}>
              <Plus data-icon="inline-start" />
              Substituição
            </Button>
          ) : null}
        </div>
        {showSubs && item.substitutions.length > 0 ? (
          <ul className="space-y-1.5" aria-label={`Substituições de ${item.foodName}`}>
            {item.substitutions.map((substitution) => (
              <SubstitutionRow key={substitution.id} substitution={substitution} ctx={ctx} />
            ))}
          </ul>
        ) : null}
        {adding ? (
          <SubstitutionForm
            initial={EMPTY_SUBSTITUTION}
            submitLabel="Adicionar substituição"
            pending={ctx.pending}
            errors={addErrors}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              const result = await ctx.run(() => addSubstitutionAction(item.id, ctx.patientId, ctx.versionId, values), "Substituição adicionada.");
              if (result.ok) {
                setAdding(false);
                setAddErrors({});
              } else setAddErrors(result.fieldErrors ?? {});
            }}
          />
        ) : null}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover &ldquo;{item.foodName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              O alimento{item.substitutions.length > 0 ? ` e ${item.substitutions.length} substituição(ões)` : ""} saem desta refeição do rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void ctx.run(() => removeMealItemAction(item.id, ctx.patientId, ctx.versionId), "Alimento removido.").then(() => setConfirm(false));
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Uma refeição do rascunho: cabeçalho com ações, alimentos e substituições (§9–§18). */
export function EditorMeal({ meal, position, total, day, days, ctx }: { meal: Meal; position: number; total: number; day: MealPlanDay; days: MealPlanDay[]; ctx: EditorContext }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [targetDay, setTargetDay] = useState(day.id);
  const time = formatTimeOfDay(meal.timeOfDay);
  const contentId = `meal-${meal.id}-content`;

  return (
    <li className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs tabular-nums">{String(position + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <span className="block font-heading text-base font-medium">
              {meal.name}
              {time ? <span className="ml-2 font-sans text-sm font-normal text-muted-foreground tabular-nums">{time}</span> : null}
            </span>
            <span className="block text-xs text-muted-foreground">
              {meal.items.length === 0 ? "Sem alimentos" : `${meal.items.length} alimento(s)`}
              {meal.notes ? ` · ${meal.notes}` : ""}
            </span>
          </span>
          <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        <div className="flex shrink-0 flex-wrap items-center justify-end self-end sm:self-auto">
          <Button variant="ghost" size="icon-sm" aria-label={`Subir refeição ${meal.name}`} disabled={ctx.pending || position === 0} onClick={() => void ctx.run(() => moveMealAction(meal.id, ctx.patientId, ctx.versionId, "up"), "Ordem atualizada.")}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Descer refeição ${meal.name}`} disabled={ctx.pending || position === total - 1} onClick={() => void ctx.run(() => moveMealAction(meal.id, ctx.patientId, ctx.versionId, "down"), "Ordem atualizada.")}>
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Duplicar refeição ${meal.name}`} disabled={ctx.pending} onClick={() => { setTargetDay(day.id); setDuplicating(true); }}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Editar refeição ${meal.name}`} disabled={ctx.pending} onClick={() => { setEditing(true); setOpen(true); }}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Remover refeição ${meal.name}`} disabled={ctx.pending} onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {open ? (
        <div id={contentId} className="space-y-3 border-t border-border p-3">
          {editing ? (
            <MealForm
              initial={{ name: meal.name, timeOfDay: meal.timeOfDay ?? "", notes: meal.notes ?? "" }}
              submitLabel="Salvar refeição"
              pending={ctx.pending}
              errors={errors}
              onCancel={() => setEditing(false)}
              onSubmit={async (values) => {
                const result = await ctx.run(() => updateMealAction(meal.id, ctx.patientId, ctx.versionId, { ...values, expectedUpdatedAt: meal.updatedAt }), "Refeição atualizada.");
                if (result.ok) setEditing(false);
                else setErrors(result.fieldErrors ?? {});
              }}
            />
          ) : null}

          {meal.items.length === 0 && !adding ? <p className="text-sm text-muted-foreground">Esta refeição ainda não possui alimentos.</p> : null}
          {meal.items.length > 0 ? (
            <ul className="space-y-2" aria-label={`Alimentos de ${meal.name}`}>
              {meal.items.map((item, index) => (
                <ItemRow key={item.id} item={item} position={index} total={meal.items.length} ctx={ctx} />
              ))}
            </ul>
          ) : null}

          {adding ? (
            <ItemForm
              initial={EMPTY_ITEM}
              submitLabel="Adicionar alimento"
              pending={ctx.pending}
              errors={addErrors}
              onCancel={() => setAdding(false)}
              onSubmit={async (values) => {
                const result = await ctx.run(() => addMealItemAction(meal.id, ctx.patientId, ctx.versionId, values), "Alimento adicionado.");
                if (result.ok) {
                  setAdding(false);
                  setAddErrors({});
                } else setAddErrors(result.fieldErrors ?? {});
              }}
            />
          ) : (
            <Button variant="outline" size="sm" disabled={ctx.pending} onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" />
              Adicionar alimento
            </Button>
          )}
        </div>
      ) : null}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a refeição &ldquo;{meal.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {meal.items.length > 0 ? `Os ${meal.items.length} alimento(s) e suas substituições saem do rascunho junto com a refeição.` : "A refeição sai do rascunho."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void ctx.run(() => removeMealAction(meal.id, ctx.patientId, ctx.versionId), "Refeição removida.").then(() => setConfirm(false));
              }}
            >
              Remover refeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicating} onOpenChange={setDuplicating}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar &ldquo;{meal.name}&rdquo;</AlertDialogTitle>
            <AlertDialogDescription>Copia a refeição com todos os alimentos e substituições (ids novos) para o fim do dia escolhido.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label htmlFor={`dup-${meal.id}`} className="text-sm font-medium">
              Dia de destino
            </label>
            <NativeSelect id={`dup-${meal.id}`} value={targetDay} onChange={(event) => setTargetDay(event.target.value)}>
              {days.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {WEEKDAY_LABEL[candidate.weekday]}
                  {candidate.id === day.id ? " (este dia)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void ctx.run(() => duplicateMealAction(meal.id, ctx.patientId, ctx.versionId, targetDay === day.id ? null : targetDay), "Refeição duplicada.").then(() => setDuplicating(false));
              }}
            >
              Duplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
