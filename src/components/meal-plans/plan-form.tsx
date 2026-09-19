"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import type { MealPlanFormState } from "@/actions/meal-plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const initialState: MealPlanFormState = {};

export type SourceVersionOption = { id: string; label: string };

/**
 * Dados do plano (prompt Fase 8 §6): nome, data de início opcional,
 * observação geral. O paciente vem do contexto da rota — nunca de um input.
 * `sources` (opcional) permite usar uma versão de plano anterior como base.
 */
export function MealPlanForm({
  action,
  mode,
  cancelHref,
  initial,
  sources = [],
}: {
  action: (prev: MealPlanFormState, formData: FormData) => Promise<MealPlanFormState>;
  mode: "create" | "edit";
  cancelHref: string;
  initial: { title: string; startDate: string; notes: string };
  sources?: SourceVersionOption[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Nome do plano</Label>
        <Input id={`${idPrefix}-title`} name="title" required maxLength={120} defaultValue={values?.title ?? initial.title} placeholder="Ex.: Plano de reeducação alimentar" aria-invalid={fieldErrors.title ? true : undefined} />
        {err("title")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-startDate`}>Data de início (opcional)</Label>
          <Input id={`${idPrefix}-startDate`} name="startDate" type="date" defaultValue={values?.startDate ?? initial.startDate} aria-invalid={fieldErrors.startDate ? true : undefined} />
          {err("startDate")}
        </div>
        {mode === "create" && sources.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-source`}>Usar como base (opcional)</Label>
            <NativeSelect id={`${idPrefix}-source`} name="sourceVersionId" defaultValue={values?.sourceVersionId ?? ""}>
              <option value="">Começar do zero</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">Copia dias, refeições, alimentos e substituições de um plano anterior para o novo rascunho.</p>
            {err("sourceVersionId")}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Observação geral (opcional)</Label>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={4} maxLength={2000} defaultValue={values?.notes ?? initial.notes} placeholder="Orientações gerais que o paciente verá junto com o plano." />
        {err("notes")}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : mode === "create" ? "Criar plano" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
